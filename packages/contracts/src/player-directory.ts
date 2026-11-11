import {z} from 'zod';
import {ServerRegionCodeSchema} from './wish/servers';

/** Every column of the player directory sorts on the server; ids stay stable because shared links keep them. */
export const PLAYER_DIRECTORY_SORTS=[
  'region-server','name','uid','role-id','level','crew','title','current-cs','cs','max-cs-at',
  'login-days','consecutive-days','packs','outfits','recharge','recharge-value','recharge-rmb-ticket',
  'activity-recharge','activity-recharge-rmb-ticket','payment-fake-diamond','monthly-card','starter-card','reports',
  'anti-cheat-reports','augmentation-spent','equipped','equipped-pieces','backpack','backpack-pieces','spent-usd',
  'stats-at','first-seen','updated',
] as const;
export const PlayerDirectoryQuerySchema=z.object({
  q:z.string().trim().max(40).default(''),
  region:ServerRegionCodeSchema.optional(),
  server:z.string().regex(/^\d{1,10}$/).optional(),
  sort:z.enum(PLAYER_DIRECTORY_SORTS).default('recharge'),
  direction:z.enum(['asc','desc']).default('desc'),
  known:z.enum(['0','1']).default('0'),
  /** A verified player has imported a capture of their own profile. */
  verified:z.enum(['0','1']).default('1'),
  offset:z.coerce.number().int().min(0).max(100_000).default(0),
  limit:z.coerce.number().int().min(1).max(100).default(100),
});
export type PlayerDirectoryQuery=z.infer<typeof PlayerDirectoryQuerySchema>;

/** Explicitly public counters captured from the player's own build card. */
export const PLAYER_DIRECTORY_ACCOUNT_STAT_KEYS=[
  'totalRecharge','totalRechargeValue','totalRechargeValueByRmbTicket','activityRecharge','activityRechargeByRmbTicket',
  'paymentFakeDiamond','buyGemCount','buyFashionCount','monthCardLeftDays','tyroMonthCardLeftDays','totalLoginDays',
  'continueLoginDays','reportCount','antiPluginReportCount','augmentationSpent','equippedAugmentationSpent',
  'equippedPieceCount','backpackAugmentationSpent','backpackPieceCount',
] as const;

/** Decimal strings preserve raw integer counters through JSON, including values beyond Number.MAX_SAFE_INTEGER. */
export interface PlayerDirectoryEntry {
  id:string;
  nickname:string|null;
  uid:string|null;
  roleId:string|null;
  region:string|null;
  serverId:string|null;
  level:number|null;
  crew:string|null;
  titleId:string|null;
  combatScore:number|null;
  /** Game date of maxCombatScore (own capture only). */
  maxCombatScoreAt:string|null;
  /** USD spending from a verified source, as a decimal string. */
  spentUsd:string|null;
  /** When the account counters were last captured. */
  accountStatsAt:string|null;
  firstSeenAt:string;
  packsBought:string|null;
  totalRecharge:string|null;
  totalRechargeValue:string|null;
  /** Decimal strings preserve integer counters without precision loss. */
  accountStats:Partial<Record<typeof PLAYER_DIRECTORY_ACCOUNT_STAT_KEYS[number],string|null>>;
  maxCombatScore:number|null;
  lastSeenAt:string;
}
export interface PlayerDirectoryResponse {
  available:boolean;
  entries:PlayerDirectoryEntry[];
  total:number;
  filtered:number;
  offset:number;
  limit:number;
}
