import type { DatamineItemsDataset, ItemTradeData, ItemTradeReference } from '@tof-hub/contracts';
import type { Rarity } from '@tof-hub/game-domain';

export type ItemsMode = 'gacha' | 'mmo';
export type ItemsFilter = 'all' | 'renamed' | 'tradeable' | 'unlistable';
export interface ItemsTradeFilter {
  section: string;
  type: number | null;
}

export function resolveItemsTradeFilter(mode: ItemsMode, section?: string | null, type?: string | null): ItemsTradeFilter {
  if (mode !== 'mmo' || !section) return {section: '', type: null};
  const index = type && /^\d+$/.test(type) ? Number(type) : null;
  return {section, type: index !== null && Number.isSafeInteger(index) ? index : null};
}

export function resolveItemsFilter(mode: ItemsMode, value?: string | null): ItemsFilter {
  if (value === 'all' || value === 'renamed') return value;
  if (mode === 'mmo') return value === 'unlistable' ? 'unlistable' : 'tradeable';
  return 'all';
}
export type ItemsSortColumn = 'num' | 'icon' | 'id' | 'name' | 'description' | 'original' | 'rename' | 'trade';
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
  trade?: ItemTradeData;
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
  tradeRules?: ItemTradeReference | null;
  initialLocale?: string;
  initialMode?: ItemsMode | null;
  initialFilter?: ItemsFilter | null;
  initialSearch?: string | null;
  initialTradeFilter?: ItemsTradeFilter;
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
    trade?: ItemTradeData;
  }>;
}
