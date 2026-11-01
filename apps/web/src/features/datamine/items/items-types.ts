import type { DatamineItemsDataset } from '@tof-hub/contracts';
import type { Rarity } from '@tof-hub/game-domain';

export type ItemsMode = 'gacha' | 'mmo';
export type ItemsFilter = 'all' | 'renamed';
export type ItemsSortColumn = 'num' | 'icon' | 'id' | 'name' | 'description' | 'original' | 'rename';
export type ItemsSortDirection = 'ascending' | 'descending';

export interface ItemRow {
  key: string;
  num: number | string;
  id: string;
  name: string;
  original: string;
  rename: string;
  quality: string;
  hasQuality: boolean;
  icon: string;
  description_en: string;
  description_ru: string;
  rarity: Rarity;
  searchText: string;
}

export interface ItemsFilterState {
  mode: ItemsMode;
  filter: ItemsFilter;
  search: string;
  qualityFilter: string;
  page: number;
  pageSize: number;
}

export interface ItemsViewProps {
  initialData?: DatamineItemsDataset | null;
  initialLocale?: string;
  initialMode?: ItemsMode | null;
  initialFilter?: ItemsFilter | null;
  initialSearch?: string | null;
}

export interface ItemsExportPayload {
  dataset: ItemsMode;
  count: number;
  items: Array<{
    num: number | string;
    id: string;
    name: string;
    original: string;
    rename: string;
    quality?: string;
    icon?: string;
    description_en?: string;
    description_ru?: string;
  }>;
}
