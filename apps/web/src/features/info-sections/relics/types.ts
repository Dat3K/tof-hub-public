import type { Locale } from '@tof-hub/i18n';
import type { RelicsDataset } from '@tof-hub/contracts';
import type { ServerMode } from '@tof-hub/ui';

export type RelicPropertyId = 'all' | 'Attack' | 'Defense' | 'Assist' | 'Function';
export type RelicElementFilterId = 'all' | 'phys' | 'flame' | 'frost' | 'volt' | 'altered';

export interface RelicStarItem {
  star: number;
  desc?: string;
  desc_en?: string;
  desc_ru?: string;
  description?: string;
}

export interface RelicPassiveStat {
  element: 'phys' | 'flame' | 'frost' | 'volt' | 'altered' | 'neutral';
  type: 'atk' | 'def' | 'hp' | 'crit';
  value: string;
  label_en: string;
  label_ru: string;
  iconPath?: string;
}

export interface RelicItem {
  id: string;
  canonical_id?: string;
  server_mode?: string;
  edition?: string;
  quality?: string;
  property?: string;
  card_image?: string;
  card_image_thumb?: string;
  attack_icon?: string;
  attack_icon_thumb?: string;
  item_icon?: string;
  item_icon_thumb?: string;
  drawing?: string | null;
  drawing_thumb?: string | null;
  fragment_item_id?: string | null;
  ability_tag?: string | null;
  cooldown?: number | null;
  stars?: RelicStarItem[];
  name?: string;
  name_en?: string;
  name_ru?: string;
  original_name?: string;
  desc?: string;
  desc_en?: string;
  desc_ru?: string;
  description?: string;
  flavor_desc_en?: string;
  flavor_desc_ru?: string;
}

export interface RelicsStrings {
  eyebrow: string;
  title: string;
  subtitle: string;
  totalRelics: string;
  ssrRelics: string;
  srRelics: string;
  filteredMatches: string;
  searchPlaceholder: string;
  filterQuality: string;
  qualityAll: string;
  filterProperty: string;
  all: string;
  propAttack: string;
  propDefense: string;
  propAssist: string;
  propFunction: string;
  propSurvive: string;
  filterFeature: string;
  withEffectNumbers: string;
  withAdvancements: string;
  starRank: string;
  allStars: string;
  starBase: string;
  sortBy: string;
  sortQuality: string;
  sortQualityAsc: string;
  sortName: string;
  sortNameDesc: string;
  sortCooldown: string;
  sortCooldownDesc: string;
  sortIdDesc: string;
  sortIdAsc: string;
  showing: string;
  of: string;
  relics: string;
  resetFilters: string;
  loading: string;
  loadingMmo: string;
  noMatches: string;
  emptyTitle: string;
  emptyDescription: string;
  cooldownSec: string;
  abilityTag: string;
  baseDescription: string;
  starAdvancements: string;
  effectParameters: string;
  originalAssets: string;
  copyAssetPath: string;
  copied: string;
  abilityIcon: string;
  inventoryIcon: string;
  artwork: string;
  downloadPng: string;
  downloadWebp: string;
  downloaded: string;
  clickToZoom: string;
  relicTag: string;
  abilityTagWord: string;
  filterElement: string;
  filterPhys: string;
  filterFlame: string;
  filterFrost: string;
  filterVolt: string;
  filterAltered: string;
  filterStat: string;
  statPhysAtk: string;
  statFireAtk: string;
  statFrostAtk: string;
  statVoltAtk: string;
  statPhysDef: string;
  statFireDef: string;
  statFrostDef: string;
  statVoltDef: string;
  statAlteredDef: string;
  filterMode: string;
  modeGacha: string;
  modeMmo: string;
  close: string;
  clickToCopyId: string;
}

export interface RelicsCatalogViewProps {
  initialData?: RelicsDataset | null;
  initialLocale?: Locale;
  initialServerMode?: ServerMode | null;
  initialSearchQuery?: string;
  initialElements?: RelicElementFilterId[];
  initialProperties?: RelicPropertyId[];
  initialSort?: string | null;
  initialSelectedRelicId?: string | null;
}

export interface RelicCardItemProps {
  item: RelicItem;
  locale: Locale;
  serverMode: ServerMode;
  passiveStat: RelicPassiveStat | null;
  strings: RelicsStrings;
  onSelect: (id: string) => void;
}

export interface RelicDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  relic: RelicItem | null;
  locale: Locale;
  serverMode: ServerMode;
  passiveStat: RelicPassiveStat | null;
  strings: RelicsStrings;
}
