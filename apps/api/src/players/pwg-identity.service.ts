import {Inject,Injectable,Optional,ServiceUnavailableException} from '@nestjs/common';
import {Prisma,type PrismaClient} from '@prisma/client';
import {canonicalPlayerUid,type BuildCapture} from '@tof-hub/contracts';
import {PRISMA} from '../database/database.module';

/** Private UID ledger: missing optional data never deletes a previous association. */
@Injectable()
export class PwgIdentityService {
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}

  async remember(capture:BuildCapture,fileHash:string):Promise<void> {
    // The canonical character UID needs the server ID; without it the file is accepted and the ledger is left as it is.
    const identity=capture.pwg;if(!identity?.serverId)return;
    if(!this.prisma)throw new ServiceUnavailableException('PWG identity storage is not configured');
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO player_pwg_identities(uid,pwg_uid,role_id,server_id,app_id,observed_at,file_hash,updated_at)
      VALUES (${canonicalPlayerUid(capture.capture.subject.uid,{roleId:identity.roleId,serverId:identity.serverId})},${identity.uid},${identity.roleId},${identity.serverId},${identity.appId??null},
        ${new Date(identity.observedAt)}::timestamp,${fileHash},CURRENT_TIMESTAMP)
      ON CONFLICT(uid) DO UPDATE SET pwg_uid=EXCLUDED.pwg_uid,role_id=EXCLUDED.role_id,server_id=EXCLUDED.server_id,
        app_id=COALESCE(EXCLUDED.app_id,player_pwg_identities.app_id),observed_at=EXCLUDED.observed_at,file_hash=EXCLUDED.file_hash,updated_at=CURRENT_TIMESTAMP
      WHERE EXCLUDED.observed_at>player_pwg_identities.observed_at`);
  }
}
