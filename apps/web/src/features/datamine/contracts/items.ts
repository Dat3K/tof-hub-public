import type { DatamineItemCore, ItemQuality, Rarity } from '@tof-hub/game-domain';

export type ItemsMode = 'gacha' | 'mmo';

export interface ItemsDeepLinkParams {
  mode?: ItemsMode | null;
  q?: string | null;
  quality?: string | null;
  page?: number | null;
}

export type DatamineItem = DatamineItemCore;

export interface ItemsDatasetPayload {
  mode: ItemsMode;
  total: number;
  items: DatamineItem[];
}

export interface ItemsFilterState {
  searchQuery: string;
  selectedQuality: ItemQuality | 'ALL';
  selectedRarity: Rarity | 'ALL';
  currentPage: number;
  pageSize: number;
}
