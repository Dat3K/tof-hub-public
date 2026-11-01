import { z } from 'zod';
import {CaptureSessionSchema} from '../capture-session';
import { WISH_BANNER_TYPES, WISH_MATRIX_SLOTS, WISH_STREAK_OUTCOMES } from '@tof-hub/game-domain';

export const WishBannerTypeSchema = z.enum(WISH_BANNER_TYPES);
export type WishBannerType = z.infer<typeof WishBannerTypeSchema>;

export const WishMatrixSlotSchema = z.enum(WISH_MATRIX_SLOTS);
export type WishMatrixSlot = z.infer<typeof WishMatrixSlotSchema>;

export const WishStreakOutcomeSchema = z.enum(WISH_STREAK_OUTCOMES);
export type WishStreakOutcome = z.infer<typeof WishStreakOutcomeSchema>;

export const WishNextStreakPredictionSchema = z.enum([
  'forced_win',
  'forced_loss',
  'neutral_50_50',
  'unknown',
]);
export type WishNextStreakPrediction = z.infer<typeof WishNextStreakPredictionSchema>;

export const WishCompensationSchema = z.object({
  currency_id: z.string(),
  amount: z.number(),
  extra_items: z.array(
    z.object({
      item_id: z.string(),
      count: z.number(),
    })
  ).default([]),
});
export type WishCompensation = z.infer<typeof WishCompensationSchema>;

export const WishRecordDtoSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  banner_id: z.string(),
  banner_type: WishBannerTypeSchema,
  raw_banner_codes: z.array(z.string()).optional(),
  item_id: z.string(),
  item_name: z.string(),
  item_name_ru: z.string().optional(),
  item_type: z.enum(['weapon', 'matrix', 'material']),
  /** 0 means the capture and current catalog cannot identify rarity. */
  rarity: z.union([z.literal(0),z.number().int().min(3).max(5)]),
  pity_count: z.number().int(),
  track_pull_number: z.number().int().positive().max(2147483647).optional(),
  is_guaranteed_pity: z.boolean(),
  is_featured: z.boolean(),
  streak_outcome: WishStreakOutcomeSchema.nullable().optional(),
  slot: WishMatrixSlotSchema.optional(),
  pull_timestamp: z.string(),
  group_ticks: z.string().optional(),
  raw_banner_code: z.string().optional(),
  item_index: z.number().int().optional(),
  compensation: WishCompensationSchema.optional(),
});
export type WishRecordDto = z.infer<typeof WishRecordDtoSchema>;

export const WishBannerDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_en: z.string(),
  name_ru: z.string(),
  banner_type: WishBannerTypeSchema,
  character_id: z.string(),
  weapon_id: z.string().optional(),
  matrix_id: z.string().optional(),
  pity_target: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  currency: z.enum([
    'unknown',
    'red_nucleus',
    'special_voucher',
    'gold_nucleus',
    'proof_of_purchase',
    'black_nucleus',
  ]),
  cashback_currency: z.enum([
    'flame_gold',
    'overclocking_chip',
    'black_gold',
    'base_chip',
    'none',
  ]),
  featured_ssr: z.array(z.string()),
  featured_sr: z.array(z.string()).default([]),
  standard_pool_items: z.array(z.string()).default([]),
  assets: z.object({
    background: z.string(),
    splash: z.string(),
    icon: z.string(),
    weapon_icon: z.string().optional(),
    matrix_icon: z.string().optional(),
    title_image_en: z.string().optional(),
    title_image_ru: z.string().optional(),
  }),
});
export type WishBannerDto = z.infer<typeof WishBannerDtoSchema>;

export const WishSsrFeedItemSchema = z.object({
  item_id: z.string(),
  item_name: z.string(),
  rarity: z.number().int(),
  pity_at_drop: z.number().int(),
  is_guaranteed: z.boolean(),
  streak_outcome: WishStreakOutcomeSchema.nullable(),
  slot: WishMatrixSlotSchema.optional(),
  pulls_since_last_ssr: z.number().int(),
  timestamp: z.string(),
});
export type WishSsrFeedItem = z.infer<typeof WishSsrFeedItemSchema>;

export const WishProfileSummaryDtoSchema = z.object({
  profile_id: z.string(),
  total_pulls: z.number().int(),
  weapon_pulls: z.number().int(),
  matrix_pulls: z.number().int(),
  current_weapon_pity: z.number().int(),
  current_matrix_pity: z.number().int(),
  weapon_ssr_count: z.number().int(),
  matrix_ssr_count: z.number().int(),
  weapon_early_ssr_count: z.number().int(),
  matrix_early_ssr_count: z.number().int(),
  next_weapon_streak: WishNextStreakPredictionSchema,
  next_matrix_streak: WishNextStreakPredictionSchema,
  recent_weapon_streaks: z.array(WishStreakOutcomeSchema),
  recent_matrix_streaks: z.array(WishStreakOutcomeSchema),
  cashback: z.object({
    flame_gold_awarded: z.number().int(),
    overclocking_chips_awarded: z.number().int(),
    base_currency: z.number().int(),
    extra_duplicate_currency: z.number().int(),
  }),
  matrix_slots: z.record(WishMatrixSlotSchema, z.number().int()),
  recent_ssr_feed: z.array(WishSsrFeedItemSchema),
});
export type WishProfileSummaryDto = z.infer<typeof WishProfileSummaryDtoSchema>;

export const WishAnalyticsDtoSchema = z.object({
  total_pulls: z.number().int(),
  total_ssr: z.number().int(),
  ssr_rate: z.number(),
  avg_ssr_interval: z.number(),
  median_ssr_interval: z.number(),
  early_ssr_count: z.number().int(),
  pity_ssr_count: z.number().int(),
  wins_count: z.number().int(),
  losses_count: z.number().int(),
  neutral_50_50_rate: z.number(),
  interval_distribution: z.record(z.string(), z.number().int()),
  cashback_breakdown: z.object({
    base_currency: z.number().int(),
    extra_duplicate_currency: z.number().int(),
  }),
  matrix_distribution: z.record(WishMatrixSlotSchema, z.number().int()).optional(),
});
export type WishAnalyticsDto = z.infer<typeof WishAnalyticsDtoSchema>;

export const WishPullsResponseDtoSchema = z.object({
  items: z.array(WishRecordDtoSchema),
  next_cursor: z.string().nullable(),
  total_count: z.number().int(),
});
export type WishPullsResponseDto = z.infer<typeof WishPullsResponseDtoSchema>;

export const WishSimulationConfigSchema = z.object({
  mode: z.enum(['weapon', 'matrix', 'both']),
  targetWeaponAdvancement: z.number().int().min(0).max(6).default(6),
  targetMatrixCopiesPerSlot: z.number().int().min(0).max(4).default(4),
  currentWeaponCopies: z.number().int().min(0).max(7).default(0),
  currentMatrixCopies: z.record(WishMatrixSlotSchema, z.number().int().min(0).max(4)).default({
    mind: 0,
    memory: 0,
    belief: 0,
    emotion: 0,
  }),
  currentWeaponPity: z.number().int().min(0).max(79).default(0),
  currentMatrixPity: z.number().int().min(0).max(39).default(0),
  recentWeaponStreaks: z.array(WishStreakOutcomeSchema).default([]),
  recentMatrixStreaks: z.array(WishStreakOutcomeSchema).default([]),
  initialFlameGold: z.number().int().min(0).default(0),
  initialOverclockingChips: z.number().int().min(0).default(0),
  bought50Box: z.boolean().default(false),
  blockedSlot: WishMatrixSlotSchema.nullable().default(null),
  autoBlock: z.boolean().default(true),
  srMaxed: z.boolean().default(true),
  standardSsrMaxed: z.boolean().default(true),
  trials: z.number().int().min(100).max(10000).default(10000),
  seed: z.number().int().optional(),
});
export type WishSimulationConfig = z.infer<typeof WishSimulationConfigSchema>;

export const WishSimulationResultSchema = z.object({
  worstCase: z.object({
    weaponPulls: z.number().int(),
    matrixPulls: z.number().int(),
    totalPulls: z.number().int(),
    weaponCopiesFromPity: z.number().int(),
    weaponCopiesFromShop: z.number().int(),
    matrixPiecesFromPity: z.number().int(),
    matrixPiecesFromShop: z.number().int(),
    flameGoldSpent: z.number().int(),
    chipsSpent: z.number().int(),
    used50Box: z.boolean(),
  }),
  zeroExtraDeterministic: z.object({
    weaponPulls: z.number().int(),
    matrixPulls: z.number().int(),
    totalPulls: z.number().int(),
  }),
  monteCarlo: z.object({
    trials: z.number().int(),
    meanPulls: z.number(),
    medianPulls: z.number(),
    stdDev: z.number(),
    minPulls: z.number().int(),
    maxPulls: z.number().int(),
    percentiles: z.object({
      p1: z.number().int(),
      p10: z.number().int(),
      p25: z.number().int(),
      p50: z.number().int(),
      p75: z.number().int(),
      p90: z.number().int(),
      p95: z.number().int(),
      p99: z.number().int(),
    }),
    costHistogram: z.array(
      z.object({
        binStart: z.number().int(),
        binEnd: z.number().int(),
        count: z.number().int(),
      })
    ),
  }),
});
export type WishSimulationResult = z.infer<typeof WishSimulationResultSchema>;

export const WishLuckTierSchema = z.enum([
  'very_unlucky',
  'unlucky',
  'expected',
  'lucky',
  'very_lucky',
]);
export type WishLuckTier = z.infer<typeof WishLuckTierSchema>;

export const WishLuckMetricSchema = z.object({
  hasReliableExposure: z.boolean().optional(),
  actualCount: z.number().int(),
  expectedCount: z.number(),
  actualRate: z.number(),
  expectedRate: z.number(),
  multiplier: z.number(),
  positionPct: z.number(),
  tier: WishLuckTierSchema,
  totalPulls: z.number().int(),
});
export type WishLuckMetric = z.infer<typeof WishLuckMetricSchema>;

export const WishWinRateLuckMetricSchema = z.object({
  winsCount: z.number().int(),
  totalOutcomes: z.number().int(),
  actualWinRate: z.number(),
  expectedWinRate: z.number(),
  multiplier: z.number(),
  positionPct: z.number(),
  tier: WishLuckTierSchema,
  neutralWins: z.number().int().optional(),
  neutralTotal: z.number().int().optional(),
});
export type WishWinRateLuckMetric = z.infer<typeof WishWinRateLuckMetricSchema>;

export const WishLuckSummarySchema = z.object({
  scope: z.enum(['all', 'event', 'standard', 'black_nucleus', 'weapon', 'matrix', 'current']),
  dropRateLuck: WishLuckMetricSchema,
  winRateLuck: WishWinRateLuckMetricSchema,
  overallScore: z.number(),
  overallTier: WishLuckTierSchema,
});
export type WishLuckSummary = z.infer<typeof WishLuckSummarySchema>;
export type WishLuckScope = z.infer<typeof WishLuckSummarySchema>['scope'];

export const WishPitySnapshotSchema = z.object({
  banner_type: WishBannerTypeSchema,
  current_pity: z.number().int().min(0).max(79),
  captured_at: z.string().datetime(),
  raw_banner_code: z.string().regex(/^[A-Za-z0-9_]{1,80}$/).optional(),
  group_ticks: z.string().regex(/^\d{15,20}$/).optional(),
  item_index: z.number().int().min(0).max(9).optional(),
  source: z.enum(['game', 'manual']).optional(),
}).strict();
export type WishPitySnapshot = z.infer<typeof WishPitySnapshotSchema>;

export const WishImportV2PayloadSchema = z.object({
  pity_snapshots: z.array(WishPitySnapshotSchema).max(4).optional(),
  version: z.literal(2),
  export_metadata: z.object({
    exported_at: z.string(),
    exporter_name: z.string(),
    exporter_version: z.string(),
    scan: CaptureSessionSchema.optional(),
  }),
  account: z.object({
    uid: z.string(),
    region: z.string(),
    server_id: z.string(),
    nickname: z.string().optional(),
    avatar_id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).optional(),
    avatar_frame_id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).optional(),
    timezone: z.string().default('UTC'),
    /** Game server clock minus UTC, read from the capture. Present only when batch timestamps were
     * converted from the server's local `T` to UTC; such a file may correct stored timestamps. */
    server_utc_offset_minutes: z.number().int().min(-720).max(840).optional(),
  }),
  batches: z.array(
    z.object({
      batch_id: z.string(),
      banner_id: z.string(),
      raw_banner_code: z.string(),
      banner_type: WishBannerTypeSchema,
      group_ticks: z.string(),
      timestamp: z.string(),
      pulls: z.array(
        z.object({
          index_in_batch: z.number().int().min(0).max(9),
          track_pull_number: z.number().int().positive().max(2147483647).optional(),
          item_id: z.string(),
          rarity: z.union([z.literal(0),z.number().int().min(3).max(5)]),
          is_featured: z.boolean(),
          slot: WishMatrixSlotSchema.optional(),
          compensation: WishCompensationSchema.optional(),
        })
      ),
    })
  ),
});
export type WishImportV2Payload = z.infer<typeof WishImportV2PayloadSchema>;

export const WishTallyPityPointSchema = z.object({
  pity: z.number().int().min(1),
  total_ssr: z.number().int().min(0),
  won_ssr: z.number().int().min(0),
  lost_ssr: z.number().int().min(0),
  cumulative_rate: z.number().min(0).max(100),
});
export type WishTallyPityPoint = z.infer<typeof WishTallyPityPointSchema>;

export const WishTallyItemDropSchema = z.object({
  item_id: z.string(),
  item_name: z.string(),
  item_name_ru: z.string(),
  item_type: z.enum(['weapon', 'matrix', 'material']),
  rarity: z.union([z.literal(0),z.number().int().min(3).max(5)]),
  icon: z.string(),
  count: z.number().int().min(0),
  share_pct: z.number().min(0).max(100),
  avg_pity: z.number().min(0),
  min_pity: z.number().int().min(0),
  max_pity: z.number().int().min(0),
  is_featured: z.boolean(),
});
export type WishTallyItemDrop = z.infer<typeof WishTallyItemDropSchema>;

export const WishTallyBannerSummarySchema = z.object({
  banner_id: z.string(),
  banner_name: z.string(),
  banner_name_ru: z.string(),
  banner_type: WishBannerTypeSchema,
  featured_character: z.string(),
  featured_character_ru: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  icon: z.string(),
  splash: z.string(),
  total_pulls: z.number().int().min(0),
  total_ssr: z.number().int().min(0),
  ssr_rate: z.number().min(0),
  avg_ssr_pity: z.number().min(0),
  won_count: z.number().int().min(0),
  lost_count: z.number().int().min(0),
  win_rate: z.number().min(0).max(100),
  total_sr: z.number().int().min(0),
  sr_rate: z.number().min(0),
  avg_sr_pity: z.number().min(0),
  total_users: z.number().int().min(0),
});
export type WishTallyBannerSummary = z.infer<typeof WishTallyBannerSummarySchema>;

export const WishTallyDataSchema = z.object({
  banner: WishBannerDtoSchema,
  summary: WishTallyBannerSummarySchema,
  pity_distribution: z.array(WishTallyPityPointSchema),
  ssr_drops: z.array(WishTallyItemDropSchema),
  sr_drops: z.array(WishTallyItemDropSchema),
  all_banner_summaries: z.array(WishTallyBannerSummarySchema),
});
export type WishTallyData = z.infer<typeof WishTallyDataSchema>;

