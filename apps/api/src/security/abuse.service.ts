import {HttpException,Inject,Injectable,Optional,ServiceUnavailableException} from '@nestjs/common';
import type {PrismaClient} from '@prisma/client';
import {createHmac,randomBytes} from 'node:crypto';
import {PRISMA} from '../database/database.module';
import {normalizeIp} from '../wish/wish-query.validation';

export const DAY=86_400_000;
type Counter={count:number;expiresAt:Date};
/** Only malformed envelopes, failed authentication and forged capture signatures count as violations. */
export class UploadViolation extends HttpException {
  constructor(message:string) {super({message,code:'INVALID_UPLOAD'},400);}
}
export function abuseError(code:string,message:string,retryAfter:number) {
  return new HttpException({code,message,retryAfter:Math.max(1,Math.ceil(retryAfter))},429);
}

@Injectable()
export class AbuseService {
  private readonly memory=new Map<string,Counter>();
  private nextSweep=0;
  private readonly secret=process.env.IP_HASH_SALT??randomBytes(32).toString('hex');
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}
  identity(ip:string) {return createHmac('sha256',this.secret).update(normalizeIp(ip)).digest('hex');}
  scopedIdentity(ip:string,scope:string) {return this.key(ip,scope);}
  async feedbackBudget(ip:string,now=Date.now()) {
    const row=(await this.counter(this.key(ip,'feedback-submit'),true,now))!;
    if(row.count>20)throw abuseError('FEEDBACK_BUDGET','Daily feedback limit reached', (row.expiresAt.getTime()-now)/1000);
  }
  private key(ip:string,scope:string) {return createHmac('sha256',this.secret).update(`${this.identity(ip)}:${scope}`).digest('hex');}
  private async counter(key:string,increment:boolean,now:number):Promise<Counter|null> {
    if(this.prisma) {
      if(!increment) {
        const rows=await this.prisma.$queryRaw<Counter[]>`SELECT count, expires_at AS "expiresAt" FROM abuse_counters WHERE key=${key} AND expires_at>${new Date(now)}`;
        return rows[0]??null;
      }
      const rows=await this.prisma.$queryRaw<Counter[]>`
        INSERT INTO abuse_counters (key,count,expires_at) VALUES (${key},1,${new Date(now+DAY)})
        ON CONFLICT (key) DO UPDATE SET count=CASE WHEN abuse_counters.expires_at<=${new Date(now)} THEN 1 ELSE abuse_counters.count+1 END,
        expires_at=CASE WHEN abuse_counters.expires_at<=${new Date(now)} THEN EXCLUDED.expires_at ELSE abuse_counters.expires_at END
        RETURNING count,expires_at AS "expiresAt"`;
      return rows[0]!;
    }
    if(now>=this.nextSweep) {
      for(const [id,row] of this.memory)if(row.expiresAt.getTime()<=now)this.memory.delete(id);
      this.nextSweep=now+60_000;
    }
    let row=this.memory.get(key)??null;
    if(row&&row.expiresAt.getTime()<=now) {this.memory.delete(key);row=null;}
    if(increment) {
      if(!row&&this.memory.size>=20_000)throw new ServiceUnavailableException('Security capacity reached; retry later');
      row={count:(row?.count??0)+1,expiresAt:row?.expiresAt??new Date(now+DAY)};
      this.memory.set(key,row);
    }
    return row;
  }
  async assertAllowed(ip:string,now=Date.now()) {
    const ban=await this.counter(this.key(ip,'ban'),false,now);
    if(ban)throw abuseError('IP_BLOCKED','Uploads are temporarily blocked after repeated invalid files',(ban.expiresAt.getTime()-now)/1000);
  }
  async violation(ip:string,now=Date.now()) {
    const row=(await this.counter(this.key(ip,'invalid'),true,now))!;
    if(row.count>=5) {
      await this.counter(this.key(ip,'ban'),true,now);
      throw abuseError('IP_BLOCKED','Uploads are blocked for 24 hours after five invalid files',DAY/1000);
    }
    return {code:'INVALID_UPLOAD',remainingAttempts:5-row.count};
  }
  /** A third identical file is a warning/refusal, never an automatic IP ban (shared networks and retries). */
  async duplicate(ip:string,digest:string,now=Date.now()) {
    const row=(await this.counter(this.key(ip,`file:${digest}`),true,now))!;
    if(row.count>=3)throw abuseError('DUPLICATE_UPLOAD','This file was already submitted twice. Use the existing result or a new capture.',(row.expiresAt.getTime()-now)/1000);
  }
  async uploadBudget(ip:string,kind:string,now=Date.now()) {
    const limit=kind==='players-import'?20:kind==='build-import'?30:120;
    const row=(await this.counter(this.key(ip,`budget:${kind}`),true,now))!;
    if(row.count>limit)throw abuseError('UPLOAD_BUDGET','Daily upload limit reached. Try again tomorrow.',(row.expiresAt.getTime()-now)/1000);
  }
  async cleanup() {
    if(this.prisma)await this.prisma.$executeRaw`DELETE FROM abuse_counters WHERE expires_at<=${new Date()}`;
  }
}
