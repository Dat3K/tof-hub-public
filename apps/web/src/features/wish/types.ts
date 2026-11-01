import type { WishBannerType } from '@tof-hub/game-domain';
import type {
  WishBannerDto,
  WishRecordDto,
  WishAnalyticsDto,
  WishProfileSummaryDto,
  WishSimulationConfig,
  WishSimulationResult,
} from '@tof-hub/contracts';

export type WishTab = 'overview' | 'history' | 'analytics' | 'simulation';
export type BannerKind = 'weapon' | 'matrix';
/** A Special Order track (WISH_BANNER_TYPES in @tof-hub/game-domain). */
export type BannerTrack = WishBannerType;

export type PrimaryCategory = 'all' | 'limited' | 'standard' | 'black_nucleus';
export type ItemTypeFilter = 'all' | 'weapon' | 'matrix';

export interface WishFilters {
  primaryCategory: PrimaryCategory;
  itemType: ItemTypeFilter;
  bannerId: string;
  rarity: 'ALL' | '5' | '4' | '3';
  outcome: 'ALL' | 'win' | 'loss';
  isGuaranteed: 'ALL' | 'guaranteed' | 'early';
  slot: 'ALL' | 'mind' | 'memory' | 'belief' | 'emotion';
  hideLosses: boolean;
  search: string;
}

export interface WishViewState {
  activeTab: WishTab;
  activeTrack: BannerTrack;
  activeBannerId: string;
  activeKind: BannerKind;
  viewMode: 'cards' | 'table';
  filters: WishFilters;
  page: number;
}
