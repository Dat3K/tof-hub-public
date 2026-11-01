import {describe,expect,it,vi} from 'vitest';
import {BadRequestException,ConflictException} from '@nestjs/common';
import {JobQueueService,MAX_WAITING,withQueueDelivery} from './job-queue.service';
import {MemoryQueueStore} from './job-queue.store';

const gate=()=>{let open!:()=>void;const opened=new Promise<void>(resolve=>{open=resolve;});return {open,opened};};

describe('JobQueueService',()=>{
  it('retries a failed result write without executing the import twice',async()=>{
    vi.useFakeTimers();
    const store=new MemoryQueueStore(),queue=new JobQueueService(store),handler=vi.fn(async()=>({ok:true}));
    const finish=vi.spyOn(store,'finish').mockRejectedValueOnce(Object.assign(Error('private database message'),{code:'P2028'}));
    queue.register('build-import',handler);
    try {
      const job=await queue.enqueue('build-import',Buffer.from('private input'),'192.0.2.71');
      await vi.advanceTimersByTimeAsync(1);
      expect((await queue.get(job.id,'192.0.2.71'))?.state).toBe('processing');
      await vi.advanceTimersByTimeAsync(2001);queue.kick();await vi.advanceTimersByTimeAsync(1);
      expect((await queue.get(job.id,'192.0.2.71'))?.state).toBe('complete');
      expect(handler).toHaveBeenCalledOnce();expect(finish).toHaveBeenCalledTimes(2);
    }finally{vi.useRealTimers();}
  });
  it('runs jobs one at a time in order and reports places in the queue',async()=>{
    const queue=new JobQueueService(new MemoryQueueStore());
    const order:string[]=[],first=gate();
    queue.register('players-import',async payload=>{order.push(payload.toString());if(payload.toString()==='a')await first.opened;return {ok:payload.toString()};});
    const a=await queue.enqueue('players-import',Buffer.from('a'),'192.0.2.1');
    const b=await queue.enqueue('players-import',Buffer.from('b'),'192.0.2.2');
    const c=await queue.enqueue('players-import',Buffer.from('c'),'192.0.2.3');
    expect((await queue.get(a.id))?.state).toBe('processing');
    expect((await queue.get(b.id))?.position).toBe(1);
    expect((await queue.get(c.id))?.position).toBe(2);
    const board=await queue.board('192.0.2.3');
    expect(board.active.map(job=>[job.seq,job.position,job.mine])).toEqual([[a.seq,0,false],[b.seq,1,false],[c.seq,2,true]]);
    first.open();await queue.idle();
    expect(order).toEqual(['a','b','c']);
    expect((await queue.get(c.id,'192.0.2.3'))?.result).toEqual({ok:'c'});
    const done=await queue.board('192.0.2.1');
    expect(done.active).toEqual([]);
    expect(done.recent.map(job=>[job.seq,job.state,job.mine])).toEqual([[c.seq,'complete',false],[b.seq,'complete',false],[a.seq,'complete',true]]);
    expect(JSON.stringify(done)).not.toContain('ok');
    expect(done.recent[0]).not.toHaveProperty('result');
    expect(done.averageMs['players-import']).toBeGreaterThanOrEqual(0);
  });

  it('returns personal summaries only through the requester-bound job endpoint',async()=>{
    const queue=new JobQueueService(new MemoryQueueStore());
    queue.register('build-import',async()=>({name:'Private nickname',uid:'1302104471',gear:12}));
    const submitted=await queue.enqueue('build-import',Buffer.from('file'),'192.0.2.44');
    await queue.idle();
    expect(await queue.get(submitted.id,'192.0.2.45')).toBeNull();
    expect((await queue.get(submitted.id,'192.0.2.44'))?.result).toEqual({name:'Private nickname',uid:'1302104471',gear:12});
    const board=await queue.board('192.0.2.44');
    expect(JSON.stringify(board)).not.toContain('Private nickname');
    expect(JSON.stringify(board)).not.toContain('1302104471');
  });

  it('stores only the compact result and delivers private build data once to its owner',async()=>{
    const queue=new JobQueueService(new MemoryQueueStore());
    const summary={uid:'1302104471',gear:8},privateResult={data:{secret:'capture'}};
    queue.register('build-import',async()=>withQueueDelivery(summary,privateResult));
    const submitted=await queue.enqueue('build-import',Buffer.from('file'),'192.0.2.84');
    await queue.idle();
    const own=await queue.get(submitted.id,'192.0.2.84');
    expect(own?.result).toEqual(summary);
    expect(own?.deliveryAvailable).toBe(true);
    expect(await queue.takeDelivery(submitted.id,'192.0.2.85')).toBeNull();
    expect(await queue.takeDelivery(submitted.id,'192.0.2.84')).toEqual(privateResult);
    expect((await queue.get(submitted.id,'192.0.2.84'))?.deliveryAvailable).toBeUndefined();
    expect((await queue.get(submitted.id,'192.0.2.84'))?.result).toEqual(summary);
  });

  it('allows one active job per IP across kinds, binds polling to the IP and refuses a full queue',async()=>{
    const queue=new JobQueueService(new MemoryQueueStore()),hold=gate();
    queue.register('wish-import',async()=>{await hold.opened;return null;});
    queue.register('build-profile',async()=>null);
    const job=await queue.enqueue('wish-import',Buffer.from('x'),'192.0.2.9');
    await expect(queue.enqueue('build-profile',Buffer.from('y'),'::ffff:192.0.2.9')).rejects.toMatchObject({status:429});
    expect(await queue.get(job.id,'192.0.2.10')).toBeNull();
    expect(await queue.get(job.id,'192.0.2.9')).not.toBeNull();
    for(let index=0;index<MAX_WAITING;index++)await queue.enqueue('build-profile',Buffer.from(''),`198.51.100.${index}`);
    await expect(queue.enqueue('build-profile',Buffer.from(''),'203.0.113.1')).rejects.toMatchObject({status:503});
    hold.open();await queue.idle();
  });

  it('fails a job with the status, message and extra fields of the operation',async()=>{
    const queue=new JobQueueService(new MemoryQueueStore());
    queue.register('build-profile',async payload=>{
      if(payload.toString()==='exists')throw new ConflictException({message:'Profile already saved',savedAt:'2026-10-08T00:00:00.000Z'});
      if(payload.toString()==='bad')throw new BadRequestException('Invalid card data');
      throw new Error('database down');
    });
    const run=async(text:string,ip:string)=>{const job=await queue.enqueue('build-profile',Buffer.from(text),ip);await queue.idle();return queue.get(job.id);};
    expect((await run('exists','192.0.2.1'))?.error).toEqual({status:409,message:'Profile already saved',data:{savedAt:'2026-10-08T00:00:00.000Z'}});
    expect((await run('bad','192.0.2.1'))?.error).toEqual({status:400,message:'Invalid card data'});
    expect((await run('boom','192.0.2.1'))?.error).toEqual({status:500,message:'The operation failed on the server'});
  });
});
