import {BadRequestException,Inject,Injectable,Optional} from '@nestjs/common';
import {Prisma,type PrismaClient} from '@prisma/client';
import {BuildProfileDirectoryQuerySchema,getAllServers,parseProfileSlot,profileSlot,resolvePlayerServer,type BuildProfileDirectoryResponse,type ProfileRole,type ProfileElement} from '@tof-hub/contracts';
import {PRISMA} from '../database/database.module';
import {playerSearchSql} from '../players/player-search';

type Row={uid:string;name:string|null;region:string|null;serverId:string|null;avatarId:string|null;avatarFrameId:string|null;updatedAt:Date};

/** One public row per character. Captures, signatures and account/payment fields are never projected. */
@Injectable()
export class BuildProfileDirectoryService {
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}
  async list(input:Record<string,unknown>):Promise<BuildProfileDirectoryResponse> {
    const parsed=BuildProfileDirectoryQuerySchema.safeParse(input);
    if(!parsed.success)throw new BadRequestException('Invalid profiles query');
    const query=parsed.data,empty={entries:[],total:0,filtered:0,offset:query.offset,limit:query.limit};
    if(!this.prisma)return {available:false,...empty};
    const visible=Prisma.sql`COALESCE(p.hidden,false)=false`;
    const conditions=[visible];
    if(query.q){
      const literal=query.q.replace(/[\\%_]/g,'\\$&');
      conditions.push(Prisma.sql`(${playerSearchSql(query.q)} OR bp.uid LIKE ${literal+'%'} OR bp.name ILIKE ${'%'+literal+'%'})`);
    }
    if(query.region){
      const servers=getAllServers().filter(server=>server.regionCode===query.region);
      const fallback=servers.length?Prisma.sql`(p.region IS NULL AND (${Prisma.join(servers.map(server=>Prisma.sql`bp.uid LIKE ${server.id+'%'}`),' OR ')}))`:Prisma.sql`false`;
      conditions.push(Prisma.sql`(p.region=${query.region} OR ${fallback})`);
    }
    if(query.role)conditions.push(Prisma.sql`bp.role=${query.role}`);
    if(query.element)conditions.push(Prisma.sql`bp.element=${query.element}`);
    const matching=Prisma.sql`FROM build_profiles bp LEFT JOIN players p ON p.uid=bp.uid WHERE ${Prisma.join(conditions,' AND ')}`;
    const order=query.sort==='name'||query.sort==='name-asc'?Prisma.sql`name ASC NULLS LAST,uid ASC`
      :query.sort==='name-desc'?Prisma.sql`name DESC NULLS LAST,uid DESC`
      :query.sort==='builds'?Prisma.sql`builds DESC,"updatedAt" DESC,uid ASC`
      :query.sort==='builds-asc'?Prisma.sql`builds ASC,"updatedAt" DESC,uid ASC`
      :query.sort==='updated-asc'?Prisma.sql`"updatedAt" ASC,uid ASC`
      :Prisma.sql`"updatedAt" DESC,uid ASC`;
    const [rows,counts,total]=await Promise.all([
      this.prisma.$queryRaw<Row[]>(Prisma.sql`SELECT * FROM (
        SELECT bp.uid,COALESCE(p.nickname,(array_agg(bp.name ORDER BY bp.saved_at DESC))[1]) AS name,
          p.region,p.server_id AS "serverId",p.avatar_id AS "avatarId",p.avatar_frame_id AS "avatarFrameId",
          MAX(bp.saved_at) AS "updatedAt",COUNT(*) AS builds ${matching} GROUP BY bp.uid,p.id
        ) entries ORDER BY ${order} LIMIT ${query.limit} OFFSET ${query.offset}`),
      this.prisma.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT COUNT(DISTINCT bp.uid) AS count ${matching}`),
      this.prisma.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT COUNT(DISTINCT bp.uid) AS count FROM build_profiles bp LEFT JOIN players p ON p.uid=bp.uid WHERE ${visible}`),
    ]);
    const profiles=rows.length?await this.prisma.buildProfile.findMany({where:{uid:{in:rows.map(row=>row.uid)},...(query.role?{role:query.role}:{}),...(query.element?{element:query.element}:{})},
      select:{uid:true,role:true,element:true,name:true,savedAt:true,capturedAt:true},orderBy:[{role:'asc'},{element:'asc'}]}):[];
    return {available:true,...empty,total:Number(total[0]?.count??0),filtered:Number(counts[0]?.count??0),entries:rows.map(row=>{
      const {server,regionCode}=resolvePlayerServer({uid:row.uid,serverId:row.serverId});
      return {uid:row.uid,name:row.name,region:row.region??regionCode,serverId:row.serverId??server?.id??null,
        avatarId:row.avatarId,avatarFrameId:row.avatarFrameId,updatedAt:row.updatedAt.toISOString(),profiles:profiles.filter(profile=>profile.uid===row.uid&&parseProfileSlot(`${profile.role}-${profile.element.toLowerCase()}`)).map(profile=>({
          role:profile.role as ProfileRole,element:profile.element as ProfileElement,slot:profileSlot(profile.role as ProfileRole,profile.element as ProfileElement),name:profile.name,savedAt:profile.savedAt.toISOString(),capturedAt:profile.capturedAt.toISOString(),
        }))};
    })};
  }
}
