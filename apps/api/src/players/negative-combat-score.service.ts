import {Inject,Injectable,Optional} from '@nestjs/common';
import {Prisma,type PrismaClient} from '@prisma/client';
import {canonicalPlayerUid,type CaptureSession} from '@tof-hub/contracts';
import {PRISMA} from '../database/database.module';

export interface NegativeCombatScoreObservation {
  uid:string|null;
  cs:number|null;
  scan?:CaptureSession;
  capturedAt?:string|null;
  lastSeenAt?:string|null;
}

function timestamp(value:string|null|undefined):Date|null {
  if(!value||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const at=new Date(value);return Number.isFinite(at.getTime())?at:null;
}

/** Largest negative current CS by magnitude; never derived from the game's historical max CS. */
export function negativeCombatScorePeak(row:NegativeCombatScoreObservation) {
  if(!row.uid||!/^\d{1,24}$/.test(row.uid)||typeof row.cs!=='number'||!Number.isFinite(row.cs)||row.cs>=0||row.cs< -1e12)return null;
  const capturedAt=timestamp(row.capturedAt)??timestamp(row.lastSeenAt);
  const scanAt=timestamp(row.scan?.startedAt)??timestamp(row.scan?.finishedAt);
  return {uid:canonicalPlayerUid(row.uid),score:row.cs,scannedAt:scanAt??capturedAt,capturedAt,
    timeSource:scanAt?'scan':capturedAt?'observation':'unknown',scanId:row.scan?.scanId??null,distribution:row.scan?.distribution??null};
}

/** Independent UID ledger: test clients and gearless profiles need no live Player row. */
@Injectable()
export class NegativeCombatScoreService {
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}

  async observe(observations:NegativeCombatScoreObservation[],source:{kind:'players'|'build';fileHash:string}):Promise<number> {
    if(!this.prisma)return 0;
    const peaks=new Map<string,NonNullable<ReturnType<typeof negativeCombatScorePeak>>>();
    for(const row of observations) {
      const peak=negativeCombatScorePeak(row);if(!peak)continue;
      const previous=peaks.get(peak.uid);
      if(!previous||peak.score<previous.score||(peak.score===previous.score&&(peak.scannedAt?.getTime()??-Infinity)>(previous.scannedAt?.getTime()??-Infinity)))peaks.set(peak.uid,peak);
    }
    if(!peaks.size)return 0;
    const rows=[...peaks.values()].sort((a,b)=>a.uid.localeCompare(b.uid)).map(peak=>Prisma.sql`(${peak.uid},${peak.score},${peak.scannedAt}::timestamp,
      ${peak.capturedAt}::timestamp,${peak.timeSource},${peak.scanId}::text,${peak.distribution}::text,${source.kind},${source.fileHash})`);
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO negative_combat_scores(uid,score,scanned_at,captured_at,time_source,scan_id,distribution,source_kind,file_hash)
      VALUES ${Prisma.join(rows)}
      ON CONFLICT(uid) DO UPDATE SET score=EXCLUDED.score,scanned_at=EXCLUDED.scanned_at,captured_at=EXCLUDED.captured_at,
        time_source=EXCLUDED.time_source,scan_id=EXCLUDED.scan_id,distribution=EXCLUDED.distribution,
        source_kind=EXCLUDED.source_kind,file_hash=EXCLUDED.file_hash
      WHERE EXCLUDED.score<negative_combat_scores.score OR (EXCLUDED.score=negative_combat_scores.score AND
        EXCLUDED.scanned_at IS NOT NULL AND (negative_combat_scores.scanned_at IS NULL OR EXCLUDED.scanned_at>negative_combat_scores.scanned_at))`);
    return peaks.size;
  }
}
