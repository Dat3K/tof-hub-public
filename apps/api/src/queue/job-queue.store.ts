import {Prisma,type PrismaClient} from '@prisma/client';
import {HttpException,ServiceUnavailableException} from '@nestjs/common';

export const QUEUE_PAYLOAD_BUDGET=128*1024*1024;
function assertAdmission(active:{ipHash:string;state:string;bytes:number}[],ipHash:string,bytes:number) {
  if(bytes>64*1024*1024)throw new HttpException('Queue payload exceeds limit',413);
  if(active.some(row=>row.ipHash===ipHash))throw new HttpException('One operation at a time: wait for your queued one to finish',429);
  if(active.filter(row=>row.state==='queued').length>=20||active.reduce((sum,row)=>sum+row.bytes,bytes)>QUEUE_PAYLOAD_BUDGET)throw new ServiceUnavailableException('The queue is full, try again in a minute');
}

import {QUEUE_KINDS,type QueueJobError,type QueueKind,type QueueState} from '@tof-hub/contracts';

/** Heavy operations of the shared queue (docs/architecture/job-queue.md); the API contract is in @tof-hub/contracts. */
export const JOB_KINDS=QUEUE_KINDS;
export type JobKind=QueueKind;
export type JobState=QueueState;
export type JobError=QueueJobError;
export interface StoredJob {
  id:string;seq:number;kind:JobKind;state:JobState;ipHash:string;ip:string|null;result:unknown;delivery:unknown;deliveryExpiresAt:Date|null;error:JobError|null;
  createdAt:Date;startedAt:Date|null;finishedAt:Date|null;
}
export interface ClaimedJob extends StoredJob {payload:Buffer}

/** Where jobs live: Postgres when configured, otherwise this process' memory (local runs, tests). */
export interface QueueStore {
  insert(job:{id:string;kind:JobKind;ipHash:string;ip:string;payload:Buffer}):Promise<StoredJob>;
  get(id:string):Promise<StoredJob|null>;
  /** Queued and processing jobs, oldest first. */
  active():Promise<StoredJob[]>;
  /** Finished jobs since `since`, newest first. */
  finished(since:Date,limit:number):Promise<StoredJob[]>;
  /** The oldest queued job, now processing; null when none waits. */
  claim(now:Date):Promise<ClaimedJob|null>;
  finish(id:string,state:'complete'|'failed',result:unknown,delivery:unknown,error:JobError|null,now:Date):Promise<void>;
  /** Return and clear a result intended for the submitting page, if it has not expired. */
  takeDelivery(id:string,ipHash:string,now:Date):Promise<unknown|null>;
  /** Mark interrupted processing jobs older than one hour failed without replaying writes. */
  expireStale():Promise<number>;
  /** Keep only the newest `limit` finished jobs, with results, per requester. */
  prune(limit:number):Promise<void>;
}

export class MemoryQueueStore implements QueueStore {
  private readonly jobs=new Map<string,StoredJob&{payload:Buffer|null}>();
  private seq=0;
  async insert(job:{id:string;kind:JobKind;ipHash:string;ip:string;payload:Buffer}) {
    assertAdmission([...this.jobs.values()].filter(row=>!row.finishedAt).map(row=>({...row,bytes:row.payload?.length??0})),job.ipHash,job.payload.length);
    const row={...job,seq:++this.seq,state:'queued' as JobState,result:null,delivery:null,deliveryExpiresAt:null,error:null,createdAt:new Date(),startedAt:null,finishedAt:null};
    this.jobs.set(job.id,row);
    return strip(row);
  }
  async get(id:string) {const row=this.jobs.get(id);return row?strip(row):null;}
  async active() {return [...this.jobs.values()].filter(job=>job.state==='queued'||job.state==='processing').sort((a,b)=>a.seq-b.seq).map(strip);}
  async finished(since:Date,limit:number) {
    return [...this.jobs.values()].filter(job=>job.finishedAt&&job.finishedAt>=since).sort((a,b)=>b.seq-a.seq).slice(0,limit).map(strip);
  }
  async claim(now:Date) {
    if([...this.jobs.values()].some(job=>job.state==='processing'))return null;
    const next=[...this.jobs.values()].filter(job=>job.state==='queued').sort((a,b)=>a.seq-b.seq)[0];
    if(!next)return null;
    next.state='processing';next.startedAt=now;
    return {...strip(next),payload:next.payload??Buffer.alloc(0)};
  }
  async finish(id:string,state:'complete'|'failed',result:unknown,delivery:unknown,error:JobError|null,now:Date) {
    const row=this.jobs.get(id);
    if(row)Object.assign(row,{state,result,delivery,deliveryExpiresAt:delivery===null?null:new Date(now.getTime()+60*60*1000),error,finishedAt:now,payload:null,ip:null});
  }
  async takeDelivery(id:string,ipHash:string,now:Date) {
    const row=this.jobs.get(id);
    if(!row||row.ipHash!==ipHash||row.delivery===null||!row.deliveryExpiresAt||row.deliveryExpiresAt<=now)return null;
    const delivery=row.delivery;row.delivery=null;row.deliveryExpiresAt=null;return delivery;
  }
  async expireStale() {return 0;}
  async prune(limit:number) {
    const finishedByRequester=new Map<string,Array<StoredJob&{payload:Buffer|null}>>();
    for(const row of this.jobs.values()) {
      if(row.finishedAt&&row.finishedAt.getTime()<Date.now()-86_400_000) {this.jobs.delete(row.id);continue;}
      if(row.deliveryExpiresAt&&row.deliveryExpiresAt<=new Date()) {row.delivery=null;row.deliveryExpiresAt=null;}
      if(!row.finishedAt)continue;
      const finished=finishedByRequester.get(row.ipHash)??[];
      finished.push(row);
      finishedByRequester.set(row.ipHash,finished);
    }
    for(const finished of finishedByRequester.values()) {
      finished.sort((a,b)=>b.seq-a.seq);
      for(const row of finished.slice(limit))this.jobs.delete(row.id);
    }
  }
}
const strip=({payload:_payload,...job}:StoredJob&{payload?:Buffer|null}):StoredJob=>({...job});

type Row={id:string;seq:number;kind:string;state:string;ipHash:string;ip:string|null;result:Prisma.JsonValue|null;delivery:Prisma.JsonValue|null;deliveryExpiresAt:Date|null;error:Prisma.JsonValue|null;
  createdAt:Date;startedAt:Date|null;finishedAt:Date|null};
const fromRow=(row:Row):StoredJob=>({...row,kind:row.kind as JobKind,state:row.state as JobState,error:row.error as unknown as JobError|null});
const COLUMNS={id:true,seq:true,kind:true,state:true,ipHash:true,ip:true,result:true,delivery:true,deliveryExpiresAt:true,error:true,createdAt:true,startedAt:true,finishedAt:true} as const;

export class PrismaQueueStore implements QueueStore {
  constructor(private readonly prisma:PrismaClient) {}
  async insert(job:{id:string;kind:JobKind;ipHash:string;ip:string;payload:Buffer}) {
    return this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(734921)`;
      const active=await tx.$queryRaw<{ipHash:string;state:string;bytes:number}[]>`SELECT ip_hash AS "ipHash",state,COALESCE(octet_length(payload),0) AS bytes FROM queue_jobs WHERE state IN ('queued','processing')`;
      assertAdmission(active,job.ipHash,job.payload.length);
      return fromRow(await tx.queueJob.create({data:{...job,payload:new Uint8Array(job.payload),state:'queued'},select:COLUMNS}));
    });
  }
  async get(id:string) {const row=await this.prisma.queueJob.findUnique({where:{id},select:COLUMNS});return row?fromRow(row):null;}
  async active() {
    return (await this.prisma.queueJob.findMany({where:{state:{in:['queued','processing']}},orderBy:{seq:'asc'},select:COLUMNS})).map(fromRow);
  }
  async finished(since:Date,limit:number) {
    return (await this.prisma.queueJob.findMany({where:{finishedAt:{gte:since}},orderBy:{seq:'desc'},take:limit,select:COLUMNS})).map(fromRow);
  }
  async claim(now:Date) {
    // Admission and claims share a lock: only one heavy job can run across API processes.
    const rows=await this.prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(734921)`;
      return tx.$queryRaw<{id:string;payload:Uint8Array|null}[]>`
      UPDATE "queue_jobs" SET "state"='processing',"started_at"=${now}
      WHERE NOT EXISTS (SELECT 1 FROM queue_jobs WHERE state='processing')
      AND "id"=(SELECT "id" FROM "queue_jobs" WHERE "state"='queued' ORDER BY "seq" LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING "id","payload"`;
    });
    const claimed=rows[0];
    if(!claimed)return null;
    const job=await this.get(claimed.id);
    return job?{...job,payload:Buffer.from(claimed.payload??new Uint8Array())}:null;
  }
  async finish(id:string,state:'complete'|'failed',result:unknown,delivery:unknown,error:JobError|null,now:Date) {
    await this.prisma.queueJob.update({where:{id},data:{state,finishedAt:now,payload:null,ip:null,
      result:result===undefined||result===null?Prisma.JsonNull:result as Prisma.InputJsonValue,
      delivery:delivery===undefined||delivery===null?Prisma.JsonNull:delivery as Prisma.InputJsonValue,
      deliveryExpiresAt:delivery===undefined||delivery===null?null:new Date(now.getTime()+60*60*1000),
      error:error?error as unknown as Prisma.InputJsonValue:Prisma.JsonNull}});
  }
  async takeDelivery(id:string,ipHash:string,now:Date) {
    return this.prisma.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{delivery:Prisma.JsonValue|null}[]>`
        SELECT "delivery" FROM "queue_jobs"
        WHERE "id"=${id} AND "ip_hash"=${ipHash} AND "delivery" IS NOT NULL AND "delivery_expires_at">${now}
        FOR UPDATE`;
      const delivery=rows[0]?.delivery??null;
      if(delivery===null)return null;
      await tx.$executeRaw`UPDATE "queue_jobs" SET "delivery"=NULL,"delivery_expires_at"=NULL WHERE "id"=${id}`;
      return delivery;
    });
  }
  async expireStale() {
    // Never reset a live worker merely because another process started. Expired work fails, avoiding replayed writes.
    return (await this.prisma.queueJob.updateMany({where:{state:'processing',startedAt:{lt:new Date(Date.now()-60*60*1000)}},data:{state:'failed',finishedAt:new Date(),payload:null,ip:null,error:{status:503,message:'Interrupted job expired; submit a new capture'}}})).count;
  }
  async prune(limit:number) {
    await this.prisma.queueJob.deleteMany({where:{finishedAt:{lt:new Date(Date.now()-86_400_000)}}});
    await this.prisma.$executeRaw`UPDATE "queue_jobs" SET "delivery"=NULL,"delivery_expires_at"=NULL
      WHERE "delivery_expires_at" IS NOT NULL AND "delivery_expires_at"<=${new Date()}`;
    await this.prisma.$executeRaw`
      DELETE FROM "queue_jobs"
      WHERE "id" IN (
        SELECT "id"
        FROM (
          SELECT "id", ROW_NUMBER() OVER (PARTITION BY "ip_hash" ORDER BY "seq" DESC) AS "requester_rank"
          FROM "queue_jobs"
          WHERE "state" IN ('complete', 'failed')
        ) AS ranked_jobs
        WHERE "requester_rank" > ${limit}
      )`;
  }
}
