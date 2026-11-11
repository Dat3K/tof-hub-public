import {Inject,Injectable,Optional} from '@nestjs/common';
import {Prisma,type PrismaClient} from '@prisma/client';
import {PLAYER_DIRECTORY_ACCOUNT_STAT_KEYS,type PlayerDirectoryEntry,type PlayerDirectoryQuery,type PlayerDirectoryResponse} from '@tof-hub/contracts';
import {PRISMA} from '../database/database.module';
import {playerSearchSql} from './player-search';

/** Explicitly public counters are projected as decimal strings. Missing/invalid values are never treated as zero. */
function counter(key:'buyGemCount'|'totalRecharge'|'totalRechargeValue'):Prisma.Sql {
  return Prisma.sql`CASE WHEN (p.account_stats->>${key}) ~ '^[0-9]{1,20}$'
    THEN (p.account_stats->>${key})::numeric ELSE NULL END`;
}
const packs=counter('buyGemCount');
const recharge=Prisma.sql`COALESCE(p.total_recharge::numeric,${counter('totalRecharge')})`;
const rechargeValue=counter('totalRechargeValue');
const accountCounter=(key:typeof PLAYER_DIRECTORY_ACCOUNT_STAT_KEYS[number])=>Prisma.sql`CASE
  WHEN (p.account_stats->>${key}) ~ '^[0-9]{1,20}$' THEN (p.account_stats->>${key})::numeric ELSE NULL END`;
/** Text ids order as numbers when they are digits (UID, role id), so 9… never sorts after 10…. */
const digits=(column:Prisma.Sql)=>Prisma.sql`CASE WHEN ${column} ~ '^[0-9]{1,40}$' THEN ${column}::numeric ELSE NULL END`;
const sorts={
  'region-server':Prisma.sql`(p.region,p.server_id)`,name:Prisma.sql`p.search_name`,
  uid:digits(Prisma.sql`p.uid`),'role-id':digits(Prisma.sql`p.role_id`),level:Prisma.sql`p.level`,crew:Prisma.sql`lower(p.crew)`,
  title:Prisma.sql`p.title_id`,'current-cs':Prisma.sql`p.combat_score`,'max-cs-at':Prisma.sql`p.max_combat_score_at`,
  'login-days':accountCounter('totalLoginDays'),'consecutive-days':accountCounter('continueLoginDays'),packs,
  outfits:accountCounter('buyFashionCount'),recharge,'recharge-value':rechargeValue,
  'recharge-rmb-ticket':accountCounter('totalRechargeValueByRmbTicket'),
  'activity-recharge':accountCounter('activityRecharge'),'activity-recharge-rmb-ticket':accountCounter('activityRechargeByRmbTicket'),
  'payment-fake-diamond':accountCounter('paymentFakeDiamond'),'monthly-card':accountCounter('monthCardLeftDays'),
  'starter-card':accountCounter('tyroMonthCardLeftDays'),reports:accountCounter('reportCount'),
  'anti-cheat-reports':accountCounter('antiPluginReportCount'),'augmentation-spent':accountCounter('augmentationSpent'),
  equipped:accountCounter('equippedAugmentationSpent'),'equipped-pieces':accountCounter('equippedPieceCount'),
  backpack:accountCounter('backpackAugmentationSpent'),'backpack-pieces':accountCounter('backpackPieceCount'),
  'spent-usd':Prisma.sql`p.spent_usd`,cs:Prisma.sql`p.max_combat_score`,'stats-at':Prisma.sql`p.account_stats_at`,
  'first-seen':Prisma.sql`p.first_seen_at`,updated:Prisma.sql`p.last_seen_at`,
} satisfies Record<PlayerDirectoryQuery['sort'],Prisma.Sql>;
type Dates='lastSeenAt'|'firstSeenAt'|'accountStatsAt'|'maxCombatScoreAt';
type Row=Omit<PlayerDirectoryEntry,Dates|'accountStats'>&{lastSeenAt:Date;firstSeenAt:Date;accountStatsAt:Date|null;maxCombatScoreAt:Date|null;accountStats:unknown};

function publicAccountStats(value:unknown):PlayerDirectoryEntry['accountStats'] {
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const stored=value as Record<string,unknown>;
  const result:PlayerDirectoryEntry['accountStats']={};
  for(const key of PLAYER_DIRECTORY_ACCOUNT_STAT_KEYS) {
    const counter=stored[key];
    if(counter===null)result[key]=null;
    else if(typeof counter==='number'&&Number.isSafeInteger(counter)&&counter>=0)result[key]=String(counter);
  }
  return result;
}

export function playerDirectoryPageSql(query:PlayerDirectoryQuery,where:Prisma.Sql):Prisma.Sql {
  const direction=query.direction==='asc'?Prisma.sql`ASC`:Prisma.sql`DESC`;
  return Prisma.sql`SELECT p.id,p.nickname,p.uid,p.role_id AS "roleId",p.region,p.server_id AS "serverId",
    p.level,p.crew,p.title_id AS "titleId",p.combat_score AS "combatScore",p.max_combat_score_at AS "maxCombatScoreAt",
    p.spent_usd::text AS "spentUsd",p.account_stats_at AS "accountStatsAt",p.first_seen_at AS "firstSeenAt",
    (${packs})::text AS "packsBought",(${recharge})::text AS "totalRecharge",(${rechargeValue})::text AS "totalRechargeValue",
    p.account_stats AS "accountStats",
    p.max_combat_score AS "maxCombatScore",p.last_seen_at AS "lastSeenAt"
    FROM players p WHERE ${where}
    ORDER BY ${sorts[query.sort]} ${direction} NULLS LAST,p.id ASC LIMIT ${query.limit} OFFSET ${query.offset}`;
}

@Injectable()
export class PlayerDirectoryService {
  constructor(@Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}

  async list(query:PlayerDirectoryQuery):Promise<PlayerDirectoryResponse> {
    const empty={available:false,entries:[],total:0,filtered:0,offset:query.offset,limit:query.limit};
    if(!this.prisma)return empty;
    const conditions=[Prisma.sql`p.hidden=false`];
    if(query.region)conditions.push(Prisma.sql`p.region=${query.region}`);
    if(query.server)conditions.push(Prisma.sql`p.server_id=${query.server}`);
    if(query.q)conditions.push(playerSearchSql(query.q));
    if(query.verified==='1')conditions.push(Prisma.sql`p.self_capture_at IS NOT NULL`);
    if(query.known==='1')conditions.push(Prisma.sql`(${packs} IS NOT NULL OR ${recharge} IS NOT NULL OR ${rechargeValue} IS NOT NULL OR
      (p.account_stats IS NOT NULL AND p.account_stats <> '{}'::jsonb))`);
    const where=Prisma.join(conditions,' AND ');
    const [rows,counts,total]=await Promise.all([
      this.prisma.$queryRaw<Row[]>(playerDirectoryPageSql(query,where)),
      this.prisma.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT COUNT(*) AS count FROM players p WHERE ${where}`),
      this.prisma.player.count({where:{hidden:false}}),
    ]);
    return {available:true,entries:rows.map(row=>({...row,accountStats:publicAccountStats(row.accountStats),
      lastSeenAt:row.lastSeenAt.toISOString(),firstSeenAt:row.firstSeenAt.toISOString(),
      accountStatsAt:row.accountStatsAt?.toISOString()??null,maxCombatScoreAt:row.maxCombatScoreAt?.toISOString()??null})),total,
      filtered:Number(counts[0]?.count??0),offset:query.offset,limit:query.limit};
  }
}
