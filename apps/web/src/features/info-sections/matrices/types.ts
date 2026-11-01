import type { Locale } from '@tof-hub/i18n';
import type { MatricesDataset } from '@tof-hub/contracts';

export type ElementFilterId = 'all' | 'physical' | 'flame' | 'frost' | 'volt' | 'altered';
export type RoleFilterId = 'all' | 'dps' | 'tank' | 'benediction';

export interface MatrixSlotPiece {
  id?: string;
  slot?: number | string;
  slot_name?: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  description?: string;
  description_en?: string;
  description_ru?: string;
  icon?: string;
  icon_thumb?: string;
  stats?: Array<{ name: string; value: number }>;
}

export interface MatrixStarEffect {
  star: number;
  cs_score?: number;
  buff_id?: string | null;
  is_global?: boolean;
  text?: string;
  text_en?: string;
  text_ru?: string;
  html?: string;
  html_en?: string;
  html_ru?: string;
}

export interface MatrixSetEffect {
  piece_count?: number;
  count?: number;
  name?: string;
  name_en?: string;
  name_ru?: string;
  desc?: string;
  desc_en?: string;
  desc_ru?: string;
  text_en?: string;
  text_ru?: string;
  buff_id?: string | null;
  stars?: MatrixStarEffect[];
}

export interface MatrixCarrierInfo {
  id?: string;
  char_id?: string;
  weapon_id?: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  char_name_en?: string;
  char_name_ru?: string;
  weapon_name?: string;
  weapon_name_en?: string;
  weapon_name_ru?: string;
  element?: string;
  element_secondary?: string | null;
  element_combo_icon?: string | null;
  role?: string;
  role_icon?: string;
  icon?: string;
  icon_thumb?: string;
  avatar?: string;
  avatar_thumb?: string;
}

export interface MatrixItem {
  id: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  original_name?: string;
  quality?: string;
  icon?: string;
  icon_thumb?: string;
  piece_icon?: string;
  piece_icon_thumb?: string;
  suit_portrait?: string;
  suit_portrait_thumb?: string;
  remould_icon?: string | null;
  remould_icon_thumb?: string | null;
  is_opened?: boolean;
  playable_carrier?: boolean;
  has_carrier?: boolean;
  pieces?: MatrixSlotPiece[];
  effects?: MatrixSetEffect[];
  carriers?: MatrixCarrierInfo[];
}

export interface MatricesStrings {
  eyebrow: string;
  title: string;
  subtitle: string;
  totalMatrices: string;
  ssrSets: string;
  srSets: string;
  filteredMatches: string;
  searchPlaceholder: string;
  qualityAll: string;
  filterPiece: string;
  all: string;
  piece2: string;
  piece4: string;
  piece3: string;
  filterElement: string;
  filterRole: string;
  filterGrade: string;
  elemPhysical: string;
  elemFire: string;
  elemIce: string;
  elemThunder: string;
  elemSuperpower: string;
  starRank: string;
  allStars: string;
  sortBy: string;
  sortName: string;
  sortNameDesc: string;
  sortIdDesc: string;
  sortIdAsc: string;
  showing: string;
  of: string;
  sets: string;
  loading: string;
  noMatches: string;
  emptyTitle: string;
  emptyDescription: string;
  carriers: string;
  noCarriers: string;
  pieceSet: string;
  csScore: string;
  matrixPieces: string;
  slotMind: string;
  slotMemory: string;
  slotBelief: string;
  slotEmotion: string;
  recommendedWeapons: string;
  roleDps: string;
  roleTank: string;
  roleBenediction: string;
  roleUnknown: string;
  resetFilters: string;
  close: string;
  setCarrierOwner: string;
  noPlayableCarrier: string;
  downloadPng: string;
  downloadWebp: string;
  downloaded: string;
  clickToZoom: string;
  simulacrumLink: string;
}

export interface MatricesCatalogViewProps {
  initialData?: MatricesDataset | null;
  initialLocale?: Locale;
  initialSearchQuery?: string;
  initialElements?: ElementFilterId[];
  initialRoles?: RoleFilterId[];
  initialSort?: string | null;
  initialSelectedMatrixId?: string | null;
}

export interface MatrixCardItemProps {
  item: MatrixItem;
  locale: Locale;
  strings: MatricesStrings;
  onSelect: (id: string) => void;
}

export interface MatrixDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: MatrixItem | null;
  locale: Locale;
  strings: MatricesStrings;
  allMatrices?: MatrixItem[];
}
