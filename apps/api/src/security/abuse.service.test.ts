// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {AbuseService,DAY,UploadViolation} from './abuse.service';
import {assertJsonDepth,safeJsonReviver} from './json-safety';
import {MemoryQueueStore,QUEUE_PAYLOAD_BUDGET} from '../queue/job-queue.store';
import {JobQueueService,withQueueDelivery} from '../queue/job-queue.service';

describe('Tools abuse protection',()=>{
  it('blocks only after five invalid files, keeps other IPs available and expires the ban',async()=>{
    const service=new AbuseService();
    for(let index=0;index<4;index++)expect(await service.violation('192.0.2.1',1000)).toMatchObject({remainingAttempts:4-index});
    await service.assertAllowed('192.0.2.1',1001);
    await expect(service.violation('::ffff:192.0.2.1',1002)).rejects.toMatchObject({status:429});
    await expect(service.assertAllowed('192.0.2.1',1003)).rejects.toMatchObject({status:429});
    await service.assertAllowed('192.0.2.2',1003);
    await service.assertAllowed('192.0.2.1',DAY+1003);
  });
  it('refuses a third duplicate without banning, resets on expiry and keeps fingerprints private',async()=>{
    const service=new AbuseService();
    expect(service.identity('192.0.2.1')).toBe(service.identity('::ffff:192.0.2.1'));
    expect(service.identity('192.0.2.1')).not.toContain('192.0.2');
    await service.duplicate('192.0.2.1','a',1000);await service.duplicate('192.0.2.1','a',1001);
    await expect(service.duplicate('192.0.2.1','a',1002)).rejects.toMatchObject({status:429});
    await service.assertAllowed('192.0.2.1',1003);
    await service.duplicate('192.0.2.1','b',1003);
    await service.duplicate('192.0.2.2','a',1003);
    await service.duplicate('192.0.2.1','a',DAY+1001);
  });
  it('enforces a daily budget independently of signatures and duplicates',async()=>{
    const service=new AbuseService();
    for(let index=0;index<20;index++)await service.uploadBudget('192.0.2.1','players-import',1000);
    await expect(service.uploadBudget('192.0.2.1','players-import',1001)).rejects.toMatchObject({status:429});
    await service.uploadBudget('192.0.2.1','build-import',1001);
    await service.assertAllowed('192.0.2.1',1001);
  });
  it('reopens identical builds after delivery while retaining the daily upload budget',async()=>{
    const queue=new JobQueueService(new MemoryQueueStore(),new AbuseService());
    queue.register('build-import',async()=>withQueueDelivery({success:true},{data:{gear:[]},inventory:[]}));
    for(let index=0;index<30;index++) {
      const job=await queue.enqueue('build-import',Buffer.from('same build'),'192.0.2.1');
      await queue.idle();
      expect((await queue.get(job.id,'192.0.2.1'))?.state).toBe('complete');
      expect(await queue.takeDelivery(job.id,'192.0.2.2')).toBeNull();
      expect(await queue.takeDelivery(job.id,'192.0.2.1')).toEqual({data:{gear:[]},inventory:[]});
      expect(await queue.takeDelivery(job.id,'192.0.2.1')).toBeNull();
    }
    await expect(queue.enqueue('build-import',Buffer.from('same build'),'192.0.2.1')).rejects.toMatchObject({
      status:429,response:{code:'UPLOAD_BUDGET',message:'Daily upload limit reached. Try again tomorrow.'},
    });
  });
  it('resets the build upload budget after a day without extending it on refused retries',async()=>{
    const service=new AbuseService(),startedAt=1000;
    for(let index=0;index<30;index++)await service.uploadBudget('192.0.2.1','build-import',startedAt);
    for(const elapsed of [1000,DAY-1000])await expect(service.uploadBudget('192.0.2.1','build-import',startedAt+elapsed)).rejects.toMatchObject({
      status:429,response:{code:'UPLOAD_BUDGET',retryAfter:Math.ceil((DAY-elapsed)/1000)},
    });
    await service.uploadBudget('192.0.2.2','build-import',startedAt+DAY-1);
    await service.uploadBudget('192.0.2.1','build-import',startedAt+DAY);
    for(let index=0;index<120;index++)await service.uploadBudget('192.0.2.1','wish-import',startedAt);
    await expect(service.uploadBudget('192.0.2.1','wish-import',startedAt)).rejects.toMatchObject({status:429});
  });
  it('still refuses a third identical Players upload',async()=>{
    const queue=new JobQueueService(new MemoryQueueStore(),new AbuseService());
    queue.register('players-import',async()=>({success:true}));
    for(let index=0;index<2;index++) {
      await queue.enqueue('players-import',Buffer.from('same players'),'192.0.2.1');
      await queue.idle();
    }
    await expect(queue.enqueue('players-import',Buffer.from('same players'),'192.0.2.1')).rejects.toMatchObject({
      status:429,response:{code:'DUPLICATE_UPLOAD'},
    });
  });
  it('bounds nesting before parsers, including escaped quotes and brackets in strings',()=>{
    expect(()=>assertJsonDepth('['.repeat(65)+']'.repeat(65))).toThrow('nesting');
    expect(()=>assertJsonDepth(JSON.stringify({text:'[\\"'.repeat(200)}))).not.toThrow();
    expect(()=>assertJsonDepth('['.repeat(64)+'0'+']'.repeat(64))).not.toThrow();
    expect(()=>JSON.parse('{"__proto__":{"polluted":true}}',safeJsonReviver)).toThrow('Unsafe');
    expect(()=>JSON.parse('{"\\u005f_proto__":1}',safeJsonReviver)).toThrow('Unsafe');
  });
  it('admits one active job atomically even when all requests arrive together',async()=>{
    const store=new MemoryQueueStore();
    const attempts=await Promise.allSettled(Array.from({length:30},(_,index)=>store.insert({id:String(index),kind:'build-import',ipHash:'same',ip:'192.0.2.1',payload:Buffer.from('x')})));
    expect(attempts.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const first=await store.claim(new Date());expect(first).not.toBeNull();
    await store.insert({id:'other',kind:'build-import',ipHash:'other',ip:'192.0.2.2',payload:Buffer.from('x')});
    expect(await store.claim(new Date())).toBeNull();
    await store.finish(first!.id,'complete',null,null,null,new Date());
    expect((await store.claim(new Date()))?.id).toBe('other');
    expect(QUEUE_PAYLOAD_BUDGET).toBe(128*1024*1024);
  });
  it('accounts for worker authentication failures and refuses further uploads after the fifth',async()=>{
    const abuse=new AbuseService(),queue=new JobQueueService(new MemoryQueueStore(),abuse);
    queue.register('build-import',async()=>{throw new UploadViolation('Invalid tag');});
    for(let index=0;index<5;index++) {
      const job=await queue.enqueue('build-import',Buffer.from('same invalid build'),'192.0.2.1');await queue.idle();
      expect((await queue.get(job.id,'192.0.2.1'))?.error?.status).toBe(index===4?429:400);
    }
    await expect(queue.enqueue('build-import',Buffer.from('next'),'192.0.2.1')).rejects.toMatchObject({status:429});
  });
});
