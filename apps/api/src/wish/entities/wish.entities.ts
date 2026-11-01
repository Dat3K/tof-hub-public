import type {
  WishBannerType,
  WishMatrixSlot,
  WishStreakOutcome,
  WishCompensation,
  WishPitySnapshot,
} from '@tof-hub/game-domain';

export interface WishProfileEntity {
  id: string;
  uid: string;
  name: string;
  isDefault: boolean;
  pitySnapshots?: WishPitySnapshot[];
  avatarId?: string;
  avatarFrameId?: string;
  isDemo: boolean;
  region: string;
  server: string;
  createdAt: string;
  updatedAt: string;
}

export interface WishBannerEntity {
  id: string;
  name: string;
  nameEn: string;
  nameRu: string;
  bannerType: WishBannerType;
  characterId: string;
  weaponId?: string;
  matrixId?: string;
  pityTarget: number;
  startDate: string;
  endDate: string;
  currency: string;
  cashbackCurrency: string;
  featuredSsr: string[];
  featuredSr?: string[];
  standardPoolItems?: string[];
  assets: {
    background: string;
    splash: string;
    icon: string;
    weapon_icon?: string;
    matrix_icon?: string;
  };
}

export interface WishRecordEntity {
  id: string;
  profileId: string;
  bannerId: string;
  bannerType: WishBannerType;
  itemId: string;
  itemName: string;
  itemType: 'weapon' | 'matrix' | 'material';
  rarity: number;
  pityCount: number;
  trackPullNumber?: number;
  isGuaranteedPity: boolean;
  isFeatured: boolean;
  streakOutcome?: WishStreakOutcome | null;
  slot?: WishMatrixSlot;
  pullTimestamp: string;
  groupTicks?: string;
  rawBannerCode?: string;
  itemIndex?: number;
  compensation?: WishCompensation;
}

export interface WishCashbackTransactionEntity {
  id: string;
  profileId: string;
  bannerId?: string;
  currencyType: string;
  amountChange: number;
  balanceAfter: number;
  reason: string;
  timestamp: string;
}
