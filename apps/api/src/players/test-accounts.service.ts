import {Inject,Injectable,Optional} from '@nestjs/common';
import {Prisma,type PrismaClient} from '@prisma/client';
import {canonicalPlayerUid,type CaptureSession,type TestServerParticipation} from '@tof-hub/contracts';
import {PRISMA} from '../database/database.module';
import {testCaptureDistribution} from '../import/capture-import-policy';

export interface TestAccountObservation {uid:string|null;roleId?:string|null;nickname?:string|null;scan?:CaptureSession;
  firstSeenAt?:string|null;lastSeenAt?:string|null;capturedAt?:string|null}

export function canonicalTestDistribution(value:string):string {
  return value.replace(/^legacy-/,'');
}
function timestamp(value:string|null|undefined):Date|null {
  if(!value||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const at=new Date(value);return Number.isFinite(at.getTime())?at:null;
}
/** Packet observation boundaries have priority over scan boundaries and upload time. */
export function testObservationInterval(row:TestAccountObservation,importedAt:Date) {
  const first=timestamp(row.firstSeenAt),last=timestamp(row.lastSeenAt),captured=timestamp(row.capturedAt);
  if(first&&last&&first>last)return null;
  const observedFirst=first??captured??last,observedLast=last??captured??first;
  const start=timestamp(row.scan?.startedAt),finish=timestamp(row.scan?.finishedAt);
  const firstAt=observedFirst??start??finish??importedAt,lastAt=observedLast??finish??start??importedAt;
  if(firstAt>lastAt)return null;
  return {firstAt,lastAt,firstSource:observedFirst?'observation':start||finish?'scan':'import',
    lastSource:observedLast?'observation':start||finish?'scan':'import'};
}

/** UID ledger is independent of live players and retained Pioneer winners. No test stats enter live profiles. */
@Injectable()
export class TestAccountsService {
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}
  get available() {return !!this.prisma;}
  async observe(observations:TestAccountObservation[],source:{fileHash?:string;kind?:'players'|'build';importedAt?:Date}={}):Promise<number> {
    if(!this.prisma)return 0;
    const eligible=observations.map(row=>({...row,uid:row.uid?canonicalPlayerUid(row.uid,{roleId:row.roleId}):row.uid}))
      .filter(row=>row.uid&&/^\d{6,24}$/.test(row.uid)&&testCaptureDistribution(row.scan));
    if(!eligible.length)return 0;
    return this.prisma.$transaction(async tx=>{
      let importedAt=source.importedAt??new Date();
      if(source.fileHash) {
        const times=await tx.$queryRaw<{imported_at:Date}[]>(Prisma.sql`INSERT INTO test_account_imports(file_hash,imported_at)
          VALUES(${source.fileHash},${importedAt}) ON CONFLICT(file_hash) DO UPDATE SET file_hash=EXCLUDED.file_hash RETURNING imported_at`);
        importedAt=times[0].imported_at;
      }
      const rows=eligible.flatMap(row=>{
        const interval=testObservationInterval(row,importedAt);if(!interval)return [];
        const distribution=canonicalTestDistribution(testCaptureDistribution(row.scan)!);
        const evidence=JSON.stringify({kind:source.kind??null,fileHash:source.fileHash??null,scanId:row.scan?.scanId??null,
          detection:testCaptureDistribution(row.scan),environmentSource:row.scan?.environmentSource??null});
        return [Prisma.sql`(${row.uid},${row.roleId??null}::text,${row.nickname??null}::text,${distribution},
          ${interval.firstAt}::timestamp,${interval.lastAt}::timestamp,${interval.firstSource},${interval.lastSource},${evidence}::jsonb)`];
      });
      if(!rows.length)return 0;
      const incoming=Prisma.sql`WITH incoming(uid,role_id,nickname,distribution,first_at,last_at,first_source,last_source,evidence) AS (VALUES ${Prisma.join(rows)})`;
      await tx.$executeRaw(Prisma.sql`${incoming},
      identities AS (SELECT DISTINCT ON(uid) uid,role_id,nickname FROM incoming ORDER BY uid,last_at DESC,nickname NULLS LAST),
      observations AS (SELECT uid,ARRAY_AGG(DISTINCT distribution) AS distributions,MIN(first_at) AS first_seen_at,MAX(last_at) AS last_seen_at FROM incoming GROUP BY uid)
      INSERT INTO test_accounts(uid,role_id,nickname,distributions,first_seen_at,last_seen_at)
      SELECT uid,role_id,nickname,distributions,first_seen_at,last_seen_at FROM identities JOIN observations USING(uid)
      ON CONFLICT(uid) DO UPDATE SET
        role_id=CASE WHEN EXCLUDED.last_seen_at>=test_accounts.last_seen_at THEN COALESCE(EXCLUDED.role_id,test_accounts.role_id) ELSE COALESCE(test_accounts.role_id,EXCLUDED.role_id) END,
        nickname=CASE WHEN EXCLUDED.last_seen_at>=test_accounts.last_seen_at THEN COALESCE(EXCLUDED.nickname,test_accounts.nickname) ELSE COALESCE(test_accounts.nickname,EXCLUDED.nickname) END,
        distributions=ARRAY(SELECT DISTINCT unnest(test_accounts.distributions||EXCLUDED.distributions)),
        first_seen_at=LEAST(test_accounts.first_seen_at,EXCLUDED.first_seen_at),
        last_seen_at=GREATEST(test_accounts.last_seen_at,EXCLUDED.last_seen_at)`);
      await tx.$executeRaw(Prisma.sql`${incoming},
        firsts AS (SELECT DISTINCT ON(uid,distribution) * FROM incoming ORDER BY uid,distribution,first_at,array_position(ARRAY['import','scan','observation'],first_source) DESC),
        lasts AS (SELECT DISTINCT ON(uid,distribution) * FROM incoming ORDER BY uid,distribution,last_at DESC,array_position(ARRAY['import','scan','observation'],last_source) DESC)
        INSERT INTO test_account_servers(uid,distribution,first_seen_at,last_seen_at,first_time_source,last_time_source,first_evidence,last_evidence)
        SELECT f.uid,f.distribution,f.first_at,l.last_at,f.first_source,l.last_source,f.evidence,l.evidence
        FROM firsts f JOIN lasts l USING(uid,distribution)
        ON CONFLICT(uid,distribution) DO UPDATE SET
          first_time_source=CASE WHEN EXCLUDED.first_seen_at<test_account_servers.first_seen_at OR
            (EXCLUDED.first_seen_at=test_account_servers.first_seen_at AND array_position(ARRAY['import','scan','observation'],EXCLUDED.first_time_source)>array_position(ARRAY['import','scan','observation'],test_account_servers.first_time_source))
            THEN EXCLUDED.first_time_source ELSE test_account_servers.first_time_source END,
          first_evidence=CASE WHEN EXCLUDED.first_seen_at<test_account_servers.first_seen_at OR
            (EXCLUDED.first_seen_at=test_account_servers.first_seen_at AND array_position(ARRAY['import','scan','observation'],EXCLUDED.first_time_source)>array_position(ARRAY['import','scan','observation'],test_account_servers.first_time_source))
            THEN EXCLUDED.first_evidence ELSE test_account_servers.first_evidence END,
          last_time_source=CASE WHEN EXCLUDED.last_seen_at>test_account_servers.last_seen_at OR
            (EXCLUDED.last_seen_at=test_account_servers.last_seen_at AND array_position(ARRAY['import','scan','observation'],EXCLUDED.last_time_source)>array_position(ARRAY['import','scan','observation'],test_account_servers.last_time_source))
            THEN EXCLUDED.last_time_source ELSE test_account_servers.last_time_source END,
          last_evidence=CASE WHEN EXCLUDED.last_seen_at>test_account_servers.last_seen_at OR
            (EXCLUDED.last_seen_at=test_account_servers.last_seen_at AND array_position(ARRAY['import','scan','observation'],EXCLUDED.last_time_source)>array_position(ARRAY['import','scan','observation'],test_account_servers.last_time_source))
            THEN EXCLUDED.last_evidence ELSE test_account_servers.last_evidence END,
          first_seen_at=LEAST(test_account_servers.first_seen_at,EXCLUDED.first_seen_at),
          last_seen_at=GREATEST(test_account_servers.last_seen_at,EXCLUDED.last_seen_at)`);
      return new Set(eligible.filter(row=>testObservationInterval(row,importedAt)).map(row=>row.uid)).size;
    },{timeout:30_000,maxWait:30_000});
  }

  /** One query per page, including legacy clients whose individual dates are unknown. */
  async forUids(uids:(string|null)[]):Promise<Map<string,TestServerParticipation[]>> {
    const ids=[...new Set(uids.filter((uid):uid is string=>!!uid))],result=new Map<string,TestServerParticipation[]>();
    if(!this.prisma||!ids.length)return result;
    const rows=await this.prisma.$queryRaw<{uid:string;distribution:string;first_seen_at:Date|null;last_seen_at:Date|null;
      first_time_source?:TestServerParticipation['firstTimeSource'];last_time_source?:TestServerParticipation['lastTimeSource']}[]>(Prisma.sql`
      SELECT uid,distribution,first_seen_at,last_seen_at,first_time_source,last_time_source FROM test_account_servers WHERE uid IN (${Prisma.join(ids)})
      UNION ALL SELECT a.uid,regexp_replace(d,'^legacy-',''),NULL,NULL,NULL,NULL FROM test_accounts a CROSS JOIN unnest(a.distributions) d
      WHERE a.uid IN (${Prisma.join(ids)}) AND NOT EXISTS(SELECT 1 FROM test_account_servers s WHERE s.uid=a.uid AND s.distribution=regexp_replace(d,'^legacy-',''))
      ORDER BY uid,distribution`);
    for(const row of rows) {
      const entries=result.get(row.uid)??[];
      if(!entries.some(entry=>entry.distribution===row.distribution))entries.push({distribution:row.distribution,
        firstSeenAt:row.first_seen_at?.toISOString()??null,lastSeenAt:row.last_seen_at?.toISOString()??null,
        ...(row.first_time_source?{firstTimeSource:row.first_time_source}:{}),...(row.last_time_source?{lastTimeSource:row.last_time_source}:{})});
      result.set(row.uid,entries);
    }
    return result;
  }
}
