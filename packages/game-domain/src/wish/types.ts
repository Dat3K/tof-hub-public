/** Special Order tracks (the API schema in @tof-hub/contracts and the Wish page read this list). */
export const WISH_BANNER_TYPES = [
  'weapon_limited',
  'matrix_limited',
  'standard_weapon',
  'standard_matrix',
  'black_nucleus',
] as const;
export type WishBannerType = (typeof WISH_BANNER_TYPES)[number];

/** Event orders: the "All banners" scope, 50/50 streaks and event luck. */
export const EVENT_BANNER_TYPES = ['weapon_limited', 'matrix_limited'] as const satisfies readonly WishBannerType[];
/** Tracks with a hard pity counter (80 weapon / 40 matrix); Black Nucleus has none. */
export const PITY_BANNER_TYPES = ['weapon_limited', 'matrix_limited', 'standard_weapon', 'standard_matrix'] as const satisfies readonly WishBannerType[];

export const WISH_MATRIX_SLOTS = ['mind', 'memory', 'belief', 'emotion'] as const;
export type WishMatrixSlot = (typeof WISH_MATRIX_SLOTS)[number];

export const WISH_STREAK_OUTCOMES = ['win', 'loss', 'unknown'] as const;
export type WishStreakOutcome = (typeof WISH_STREAK_OUTCOMES)[number];

export type WishNextStreakPrediction =
  | 'forced_win'
  | 'forced_loss'
  | 'neutral_50_50'
  | 'unknown';

export interface WishCompensation {
  currency_id: string;
  amount: number;
  extra_items: Array<{
    item_id: string;
    count: number;
  }>;
}

export interface WishPitySnapshot {
  banner_type: WishBannerType;
  current_pity: number;
  captured_at: string;
  raw_banner_code?: string;
  group_ticks?: string;
  item_index?: number;
  source?: 'game' | 'manual';
}

export interface WishRecordDto {
  id: string;
  profile_id: string;
  banner_id: string;
  banner_type: WishBannerType;
  item_id: string;
  item_name: string;
  item_name_ru?: string;
  item_type: 'weapon' | 'matrix' | 'material';
  rarity: number;
  pity_count: number;
  /** Verified absolute ordinal in this independent track; omitted for unanchored imports. */
  track_pull_number?: number;
  is_guaranteed_pity: boolean;
  is_featured: boolean;
  streak_outcome?: WishStreakOutcome | null;
  slot?: WishMatrixSlot;
  pull_timestamp: string;
  group_ticks?: string;
  raw_banner_code?: string;
  item_index?: number;
  compensation?: WishCompensation;
}

export interface WishSsrFeedItem {
  item_id: string;
  item_name: string;
  rarity: number;
  pity_at_drop: number;
  is_guaranteed: boolean;
  streak_outcome: WishStreakOutcome | null;
  slot?: WishMatrixSlot;
  pulls_since_last_ssr: number;
  timestamp: string;
}

export interface WishBannerDto {
  id: string;
  name: string;
  name_en: string;
  name_ru: string;
  banner_type: WishBannerType;
  character_id: string;
  weapon_id?: string;
  matrix_id?: string;
  pity_target: number;
  start_date: string;
  end_date: string;
  currency:
    | 'unknown'
    | 'red_nucleus'
    | 'special_voucher'
    | 'gold_nucleus'
    | 'proof_of_purchase'
    | 'black_nucleus';
  cashback_currency:
    | 'flame_gold'
    | 'overclocking_chip'
    | 'black_gold'
    | 'base_chip'
    | 'none';
  featured_ssr: string[];
  featured_sr?: string[];
  standard_pool_items?: string[];
  assets: {
    background: string;
    splash: string;
    icon: string;
    weapon_icon?: string;
    matrix_icon?: string;
  };
}

export interface WishAnalyticsDto {
  total_pulls: number;
  total_ssr: number;
  ssr_rate: number;
  avg_ssr_interval: number;
  median_ssr_interval: number;
  early_ssr_count: number;
  pity_ssr_count: number;
  wins_count: number;
  losses_count: number;
  neutral_50_50_rate: number;
  interval_distribution: Record<string, number>;
  cashback_breakdown: {
    base_currency: number;
    extra_duplicate_currency: number;
  };
  matrix_distribution?: Record<WishMatrixSlot, number>;
}

export interface WishProfileSummaryDto {
  profile_id: string;
  total_pulls: number;
  weapon_pulls: number;
  matrix_pulls: number;
  current_weapon_pity: number;
  current_matrix_pity: number;
  weapon_ssr_count: number;
  matrix_ssr_count: number;
  weapon_early_ssr_count: number;
  matrix_early_ssr_count: number;
  next_weapon_streak: WishNextStreakPrediction;
  next_matrix_streak: WishNextStreakPrediction;
  recent_weapon_streaks: WishStreakOutcome[];
  recent_matrix_streaks: WishStreakOutcome[];
  cashback: {
    flame_gold_awarded: number;
    overclocking_chips_awarded: number;
    base_currency: number;
    extra_duplicate_currency: number;
  };
  matrix_slots: Record<WishMatrixSlot, number>;
  recent_ssr_feed: WishSsrFeedItem[];
}

export interface WishSimulationConfig {
  mode: 'weapon' | 'matrix' | 'both';
  targetWeaponAdvancement: number;
  targetMatrixCopiesPerSlot: number;
  currentWeaponCopies: number;
  currentMatrixCopies: Record<WishMatrixSlot, number>;
  currentWeaponPity: number;
  currentMatrixPity: number;
  recentWeaponStreaks: WishStreakOutcome[];
  recentMatrixStreaks: WishStreakOutcome[];
  initialFlameGold: number;
  initialOverclockingChips: number;
  bought50Box: boolean;
  blockedSlot: WishMatrixSlot | null;
  autoBlock: boolean;
  srMaxed: boolean;
  standardSsrMaxed: boolean;
  trials: number;
  seed?: number;
}

export interface WishSimulationResult {
  worstCase: {
    weaponPulls: number;
    matrixPulls: number;
    totalPulls: number;
    weaponCopiesFromPity: number;
    weaponCopiesFromShop: number;
    matrixPiecesFromPity: number;
    matrixPiecesFromShop: number;
    flameGoldSpent: number;
    chipsSpent: number;
    used50Box: boolean;
  };
  zeroExtraDeterministic: {
    weaponPulls: number;
    matrixPulls: number;
    totalPulls: number;
  };
  monteCarlo: {
    trials: number;
    meanPulls: number;
    medianPulls: number;
    stdDev: number;
    minPulls: number;
    maxPulls: number;
    percentiles: {
      p1: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
    costHistogram: Array<{
      binStart: number;
      binEnd: number;
      count: number;
    }>;
  };
}

export type WishLuckTier =
  | 'very_unlucky'
  | 'unlucky'
  | 'expected'
  | 'lucky'
  | 'very_lucky';

export interface WishLuckMetric {
  hasReliableExposure?: boolean;
  actualCount: number;
  expectedCount: number;
  actualRate: number;
  expectedRate: number;
  multiplier: number;
  positionPct: number;
  tier: WishLuckTier;
  totalPulls: number;
}

export interface WishWinRateLuckMetric {
  winsCount: number;
  totalOutcomes: number;
  actualWinRate: number;
  expectedWinRate: number;
  multiplier: number;
  positionPct: number;
  tier: WishLuckTier;
  neutralWins?: number;
  neutralTotal?: number;
}

export type WishLuckScope = 'all' | 'event' | 'standard' | 'black_nucleus' | 'weapon' | 'matrix' | 'current';

export interface WishLuckSummary {
  scope: WishLuckScope;
  dropRateLuck: WishLuckMetric;
  winRateLuck: WishWinRateLuckMetric;
  overallScore: number;
  overallTier: WishLuckTier;
}

export interface WishTallyPityPoint {
  pity: number;
  total_ssr: number;
  won_ssr: number;
  lost_ssr: number;
  cumulative_rate: number;
}

export interface WishTallyItemDrop {
  item_id: string;
  item_name: string;
  item_name_ru: string;
  item_type: 'weapon' | 'matrix' | 'material';
  rarity: number;
  icon: string;
  count: number;
  share_pct: number;
  avg_pity: number;
  min_pity: number;
  max_pity: number;
  is_featured: boolean;
}

export interface WishTallyBannerSummary {
  banner_id: string;
  banner_name: string;
  banner_name_ru: string;
  banner_type: WishBannerType;
  featured_character: string;
  featured_character_ru: string;
  start_date: string;
  end_date: string;
  icon: string;
  splash: string;
  total_pulls: number;
  total_ssr: number;
  ssr_rate: number;
  avg_ssr_pity: number;
  won_count: number;
  lost_count: number;
  win_rate: number;
  total_sr: number;
  sr_rate: number;
  avg_sr_pity: number;
  total_users: number;
}

export interface WishTallyData {
  banner: WishBannerDto;
  summary: WishTallyBannerSummary;
  pity_distribution: WishTallyPityPoint[];
  ssr_drops: WishTallyItemDrop[];
  sr_drops: WishTallyItemDrop[];
  all_banner_summaries: WishTallyBannerSummary[];
}

