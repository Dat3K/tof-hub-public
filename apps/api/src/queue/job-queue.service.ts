import {HttpException,HttpStatus,Inject,Injectable,Logger,Optional,type OnModuleDestroy,type OnModuleInit,ServiceUnavailableException} from '@nestjs/common';
import {createHash,randomUUID} from 'node:crypto';
import {normalizeIp} from '../wish/wish-query.validation';
import type {QueueBoard,QueueJob} from '@tof-hub/contracts';
import {MemoryQueueStore,type JobError,type JobKind,type JobState,type QueueStore,type StoredJob} from './job-queue.store';
import {AbuseService,UploadViolation} from '../security/abuse.service';
import {NotificationsService} from '../notifications/notifications.service';

export const QUEUE_STORE='QUEUE_STORE';
/** Jobs waiting at once (all kinds); one more is refused with 503. */
export const MAX_WAITING=20;
/** Keep the latest five finished jobs, including results, for each requester. */
const RECENT_JOBS_PER_REQUESTER=5;
const QUEUE_DELIVERY=Symbol('queue-delivery');
export interface QueueHandlerDelivery {
  [QUEUE_DELIVERY]:true;
  result:unknown;
  delivery:unknown;
}
/** Persist a compact job result while making a short-lived private result available to the submitting page. */
export function withQueueDelivery(result:unknown,delivery:unknown):QueueHandlerDelivery {
  return {[QUEUE_DELIVERY]:true,result,delivery};
}
function isQueueHandlerDelivery(value:unknown):value is QueueHandlerDelivery {
  return !!value&&typeof value==='object'&&(value as QueueHandlerDelivery)[QUEUE_DELIVERY]===true;
}
/** Recent finished jobs shown in the queue history. */
const BOARD_LIMIT=20;
/** A worker of another process may have enqueued work: the queue is also checked on this beat. */
const POLL_MS=2000,PRUNE_MS=10*60*1000;

/** Codes are safe to report; ORM messages/stacks can contain the private import payload. */
function failureCode(reason:unknown) {
  const code=reason&&typeof reason==='object'&&'code' in reason?String(reason.code):'';
  return `${reason instanceof Error?reason.name:'unknown error'}${/^(?:P\d{4}|\d{5}|ECONN\w+|ETIMEDOUT)$/.test(code)?` ${code}`:''}`;
}

/** Runs one job's payload; throws an HttpException to fail it with that status and message. */
export type JobHandler=(payload:Buffer,context:{ip:string})=>Promise<unknown>;

/** A job as its requester sees it; the board of /tools/queue (both in @tof-hub/contracts). */
export type PublicJob=QueueJob;
export type {QueueBoard};

export const hashIp=(ip:string)=>createHash('sha256').update((process.env.IP_HASH_SALT??'')+normalizeIp(ip)).digest('hex');
const iso=(date:Date|null)=>date?date.toISOString():null;
const duration=(job:StoredJob)=>job.startedAt&&job.finishedAt?job.finishedAt.getTime()-job.startedAt.getTime():null;

/**
 * The shared queue of heavy operations (docs/architecture/job-queue.md): wish imports, player files, build imports and
 * profile saves run one at a time, oldest first, so a burst of uploads cannot overload the API or the database. One
 * active job per IP; the requester polls its job, everyone can see the queue without names.
 */
@Injectable()
export class JobQueueService implements OnModuleInit,OnModuleDestroy {
  private readonly handlers=new Map<JobKind,JobHandler>();
  private readonly logger=new Logger('JobQueue');
  private draining=false;
  private pendingFinish:(()=>Promise<void>)|null=null;
  private failures=0;
  private retryAt=0;
  private lastFailureLog=0;
  private timers:ReturnType<typeof setInterval>[]=[];
  private readonly store:QueueStore;
  constructor(@Optional() @Inject(QUEUE_STORE) store?:QueueStore|null,@Optional() @Inject(AbuseService) private readonly abuse?:AbuseService,
    @Optional() @Inject(NotificationsService) private readonly notifications?:NotificationsService) {this.store=store??new MemoryQueueStore();}

  async onModuleInit() {
    const expired=await this.store.expireStale().catch(()=>0);
    if(expired)this.logger.warn(`${expired} interrupted job(s) expired`);
    // Clean up retained history before accepting new traffic after a restart.
    await this.prune();
    this.timers=[setInterval(()=>this.kick(),POLL_MS),setInterval(()=>void this.prune(),PRUNE_MS)];
    for(const timer of this.timers)timer.unref();
    this.kick();
  }
  onModuleDestroy() {for(const timer of this.timers)clearInterval(timer);}

  register(kind:JobKind,handler:JobHandler) {this.handlers.set(kind,handler);}

  /** Queues a payload that passed the cheap checks; refuses a second active job of the same IP and a full queue. */
  async enqueue(kind:JobKind,payload:Buffer,ip:string):Promise<PublicJob> {
    if(!this.handlers.has(kind))throw new ServiceUnavailableException('This operation is not available');
    const ipHash=hashIp(ip),active=await this.store.active();
    if(active.some(job=>job.ipHash===ipHash))throw new HttpException('One operation at a time: wait for your queued one to finish',HttpStatus.TOO_MANY_REQUESTS);
    if(active.filter(job=>job.state==='queued').length>=MAX_WAITING)throw new ServiceUnavailableException('The queue is full, try again in a minute');
    if(this.abuse) {
      await this.abuse.assertAllowed(ip);
      await this.abuse.uploadBudget(ip,kind);
      // Build files also reopen the editor/optimizer: validate and deliver them again.
      // Player storage deduplicates captures; queue admission and the daily budget still apply.
      if(kind!=='build-profile'&&kind!=='build-import') {
        const sealed=kind==='wish-import'?(JSON.parse(payload.toString('utf8')) as {envelope:{format:string;wrapped_key:string;nonce:string;ciphertext:string;tag:string}}).envelope:undefined;
        const identity=sealed?JSON.stringify([sealed.format,sealed.wrapped_key,sealed.nonce,sealed.ciphertext,sealed.tag]):payload;
        await this.abuse.duplicate(ip,createHash('sha256').update(kind).update(identity).digest('hex'));
      }
    }
    const job=await this.store.insert({id:randomUUID(),kind,ipHash,ip:normalizeIp(ip),payload});
    await this.notifications?.queued(job,payload.length);
    this.kick();
    return this.view(job,[...active,job],await this.averages());
  }

  /** The job for its requester: another IP gets null (a leaked id alone reveals nothing). Without `ip`: no check (tests). */
  async get(id:string,ip?:string):Promise<PublicJob|null> {
    if(!/^[0-9a-f-]{36}$/.test(id))return null;
    const job=await this.store.get(id);
    if(!job||(ip!==undefined&&job.ipHash!==hashIp(ip)))return null;
    return this.view(job,job.finishedAt?[]:await this.store.active(),await this.averages());
  }

  /** One-time, IP-bound response for the page that submitted a job. */
  async takeDelivery(id:string,ip:string):Promise<unknown|null> {
    if(!/^[0-9a-f-]{36}$/.test(id))return null;
    return this.store.takeDelivery(id,hashIp(ip),new Date());
  }

  async board(ip:string):Promise<QueueBoard> {
    const ipHash=hashIp(ip),active=await this.store.active(),finished=await this.store.finished(new Date(0),BOARD_LIMIT);
    let waiting=0;
    return {
      active:active.map(job=>({seq:job.seq,kind:job.kind,state:job.state,position:job.state==='queued'?++waiting:0,createdAt:job.createdAt.toISOString(),
        startedAt:iso(job.startedAt),mine:job.ipHash===ipHash})),
      recent:finished.map(job=>({seq:job.seq,kind:job.kind,state:job.state,createdAt:job.createdAt.toISOString(),startedAt:iso(job.startedAt),
        finishedAt:iso(job.finishedAt),durationMs:duration(job),mine:job.ipHash===ipHash})),
      averageMs:await this.averages(),limits:{maxWaiting:MAX_WAITING,perIp:1},
    };
  }

  private async averages() {return averagesOf(await this.store.finished(new Date(0),200));}

  private view(job:StoredJob,active:StoredJob[],averages:Partial<Record<JobKind,number>>):PublicJob {
    const queued=active.filter(item=>item.state==='queued');
    const position=job.state==='queued'?queued.findIndex(item=>item.id===job.id)+1:0;
    // Ahead: the running job's remaining time and every job queued before; then this job itself.
    let estimateMs:number|null=null;
    if(!job.finishedAt) {
      const ahead=active.filter(item=>item.seq<job.seq&&item.id!==job.id),each=[...ahead,job].map(item=>{
        const average=averages[item.kind];
        if(average===undefined)return null;
        return item.state==='processing'&&item.startedAt?Math.max(0,average-(Date.now()-item.startedAt.getTime())):average;
      });
      estimateMs=each.every(value=>value!==null)?each.reduce<number>((sum,value)=>sum+value!,0):null;
    }
    return {id:job.id,seq:job.seq,kind:job.kind,state:job.state,position,estimateMs,createdAt:job.createdAt.toISOString(),
      startedAt:iso(job.startedAt),finishedAt:iso(job.finishedAt),
      ...(job.state==='complete'&&job.result!==null?{result:job.result}:{}),
      ...(job.state==='complete'&&job.delivery!==null&&job.deliveryExpiresAt!==null&&job.deliveryExpiresAt.getTime()>Date.now()?{deliveryAvailable:true}:{}),
      ...(job.error?{error:job.error}:{})};
  }

  /** Starts the worker unless it runs; it takes jobs until none waits. */
  kick() {if(!this.draining&&Date.now()>=this.retryAt)void this.drain();}
  /** Resolves once the worker has nothing left (tests). */
  async idle() {while(this.draining||(await this.store.active()).length)await new Promise(resolve=>setTimeout(resolve,5));}

  private async drain() {
    this.draining=true;
    try {
      for(;;) {
        // A DB outage after the handler committed must not lose its result or execute the import again.
        if(this.pendingFinish){await this.pendingFinish();this.pendingFinish=null;}
        const job=await this.store.claim(new Date());
        this.failures=0;this.retryAt=0;this.lastFailureLog=0;
        if(!job)break;
        const handler=this.handlers.get(job.kind);
        let result:unknown=null,delivery:unknown=null,error:JobError|null=null;
        try {
          if(!handler)throw new ServiceUnavailableException('This operation is not available');
          await this.abuse?.assertAllowed(job.ip??'unknown');
          result=await handler(job.payload,{ip:job.ip??'unknown'});
          if(isQueueHandlerDelivery(result)) {delivery=result.delivery;result=result.result;}
        } catch(reason) {
          error=jobError(reason);
          if(reason instanceof UploadViolation&&this.abuse) {
            try {error.data={...error.data,...await this.abuse.violation(job.ip??'unknown')};}
            catch(blocked) {error=jobError(blocked);}
          }
          // ORM errors may embed the uploaded capture and tokens in their stack/message. Never log payloads.
          if(error.status>=500)this.logger.error(`${job.kind} #${job.seq} failed (${failureCode(reason)})`);
        }
        const finishedAt=new Date();
        this.pendingFinish=async()=>{
          await this.store.finish(job.id,error?'failed':'complete',error?null:result,error?null:delivery,error,finishedAt);
          await this.notifications?.finished(job,result,error);
        };
      }
    } catch(reason) {
      this.failures++;
      this.retryAt=Date.now()+Math.min(30_000,2000*2**Math.min(this.failures-1,4));
      if(!this.lastFailureLog||Date.now()-this.lastFailureLog>=60_000){
        this.logger.error(`Queue worker stopped (${failureCode(reason)}); retry scheduled`);this.lastFailureLog=Date.now();
      }
    } finally {this.draining=false;}
  }

  private async prune() {
    await this.store.expireStale().catch(()=>this.logger.warn('Expired queue job cleanup failed'));
    await this.abuse?.cleanup().catch(()=>this.logger.warn('Abuse counter cleanup failed'));
    await this.store.prune(RECENT_JOBS_PER_REQUESTER).catch(error=>this.logger.warn(`Queue cleanup failed: ${String(error)}`));
  }
}

function averagesOf(finished:StoredJob[]) {
  const sums:Partial<Record<JobKind,{total:number;count:number}>>={};
  for(const job of finished) {
    // Failures end early (a bad file): only completed jobs tell how long one takes.
    const ms=job.state==='complete'?duration(job):null;
    if(ms===null)continue;
    const entry=sums[job.kind]??={total:0,count:0};entry.total+=ms;entry.count++;
  }
  return Object.fromEntries(Object.entries(sums).map(([kind,entry])=>[kind,Math.round(entry!.total/entry!.count)])) as Partial<Record<JobKind,number>>;
}

/** The answer the operation would have given directly: status, message and the extra fields of its HttpException. */
function jobError(reason:unknown):JobError {
  if(reason instanceof HttpException) {
    const response=reason.getResponse(),status=reason.getStatus();
    if(typeof response==='string')return {status,message:response};
    const {message,statusCode:_statusCode,error:_error,...data}=response as Record<string,unknown>;
    const text=Array.isArray(message)?message.join('; '):typeof message==='string'?message:reason.message;
    return Object.keys(data).length?{status,message:text,data}:{status,message:text};
  }
  return {status:500,message:'The operation failed on the server'};
}
