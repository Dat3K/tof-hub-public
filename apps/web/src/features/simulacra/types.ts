import type { ReactNode } from 'react';
import type { ServerMode, SortOption } from '@tof-hub/ui';
import type { SimulacraDataset, SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import type { Locale } from '@tof-hub/i18n';

export type ElementFilterId = 'all' | 'physical' | 'flame' | 'frost' | 'volt' | 'altered';
export type RoleFilterId = 'all' | 'dps' | 'tank' | 'benediction';

export interface SimulacraFilterState {
  serverMode: ServerMode;
  searchQuery: string;
  selectedElements: Set<string>;
  selectedRoles: Set<string>;
  sortValue: string;
}

export interface SimulacraStrings {
  // Catalog Header & Controls
  eyebrow: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  filterElement: string;
  filterRole: string;
  filterAll: string;
  filterPhys: string;
  filterFlame: string;
  filterFrost: string;
  filterVolt: string;
  filterAltered: string;
  filterDps: string;
  filterTank: string;
  filterBene: string;
  sortBy: string;
  sortReleaseDesc: string;
  sortReleaseAsc: string;
  sortNameAsc: string;
  sortNameDesc: string;
  showing: string;
  of: string;
  simulacra: string;
  clearFilters: string;
  emptyTitle: string;
  emptyDescription: string;
  loading: string;
  loadingMmo: string;
  loadingDetail: string;
  loadingDetailHint: string;
  modeGacha: string;
  modeMmo: string;
  viewProfileAria: string;

  // Detail Navigation
  backToGrid: string;
  prevCharacter: string;
  nextCharacter: string;

  // Detail Stats
  statShatter: string;
  statCharge: string;
  statAtkMax: string;
  statHpMax: string;
  statCritMax: string;
  statDefMax: string;

  // Advancements
  sectionAdvancements: string;
  showAllStars: string;
  hideFillerStars: string;
  noAdvDesc: string;
  advFallbackName: string;

  // Traits
  sectionTraits: string;
  pointsAffinity: string;
  noTraitDesc: string;

  // Passives
  passivesTitle: string;
  noPassives: string;

  // Matrix
  sectionMatrix: string;
  matrixSet: string;
  matrixSlotsLabel: string;
  noMatrixSet: string;
  pieceSet2: string;
  pieceSet4: string;

  // Skills Compendium
  sectionSkills: string;
  comboGuide: string;
  catAll: string;
  catNormal: string;
  catDodge: string;
  catSkill: string;
  catDischarge: string;
  catPassive: string;
  catOther: string;
  level: string;
  levelShort: string;
  maxBtn: string;
  noSkills: string;
  comboWordAttack: string;
  comboWordHold: string;
  comboWordJump: string;
  comboWordDodge: string;
  comboWordDodgeForward: string;
  comboWordDodgeBack: string;

  // Character Assets & Media
  assetsTitle: string;
  assetsDisclaimer: string;
  assetsFilterAll: string;
  assetsFilterArt: string;
  assetsFilterAvatar: string;
  assetsFilterWeapon: string;
  assetsFilterSkill: string;
  assetsFilterMatrix: string;
  assetsFilterItem: string;
  assetsFilterDorm: string;
  assetsCopyPath: string;
  assetsCopied: string;
  assetsOpenPng: string;
  assetsOpenWebp: string;

  // Developer & Technical Data
  devDataTitle: string;
  devDataDisclaimer: string;
  devServerMode: string;
  devSeason: string;
  devCanonicalId: string;
  devCharId: string;
  devAvatarId: string;
  devImitationId: string;
  devWeaponId: string;
  devMatrixSuitId: string;
  devMatrixSuitName: string;
  devBaseStatsTitle: string;
  devBaseAtk: string;
  devBaseHp: string;
  devBaseDef: string;
  devBaseCrit: string;
  devBaseShatter: string;
  devBaseCharge: string;
  devCatAll: string;
  devCatIdentifiers: string;
  devCatStats: string;
  devCatStars: string;
  devCatBaseStats: string;
  devCatMatrix: string;
  devCatTraits: string;
  devCatCoefficients: string;
  devCatAdvancements: string;
  devCatCurves: string;
  devCatSkills: string;
  devCatModules: string;
  devCatAssets: string;
  devCatRawJson: string;
  devGroupIdentifiers: string;
  devGroupBaseStats: string;
  devGroupAdvMult: string;
  devGroupSkillProv: string;
  devGroupModuleFam: string;
  devGroupAssetPaths: string;
  devGroupTechIdentifiers: string;
  devColSkill: string;
  devColSource: string;
  devColParameter: string;
  devColValues: string;
  devSourcePathsTag: string;
  devSourcePathsExample: string;
  devCategoriesAria: string;
  devQuality: string;
  devDriver: string;
  devSkillCurves: string;
  devCurvesShort: string;
  devSkillProvenance: string;
  devFallbackTrait: string;

  // Radar
  abilityRadarTitle: string;

  // Detail error state
  detailErrorTitle: string;
  detailErrorMessage: string;
  detailRetry: string;

  // Lightbox
  lightboxTitle: string;
  lightboxClose: string;
  lightboxZoomIn: string;
  lightboxZoomOut: string;
  lightboxPrev: string;
  lightboxNext: string;

  // Changelog fallbacks
  sectionOther: string;
  changelogTypeTrait: string;
  changelogTypeAdv: string;
  changelogTypeSkill: string;
  changelogTypePassive: string;
  changelogTypeOther: string;
  changelogSectionTitle: string;
  changelogDisclaimer: string;
}

export type SimulacraAssetCategory =
  | 'all'
  | 'art'
  | 'avatar'
  | 'weapon'
  | 'skill'
  | 'matrix'
  | 'item'
  | 'dorm';

export interface SimulacraAssetItem {
  id: string;
  file: string;
  name_en: string;
  name_ru: string;
  category: 'art' | 'avatar' | 'weapon' | 'skill' | 'matrix' | 'item' | 'dorm';
  badge_en: string;
  badge_ru: string;
  width?: number;
  height?: number;
  resolution?: string;
  pngUrl: string;
  webpUrl?: string;
  unrealPath: string;
  sizeBytes?: number;
}

export type SimulacraSkillCategory =
  | 'normal'
  | 'dodge'
  | 'skill'
  | 'discharge'
  | 'passive'
  | 'other';

export interface UseSimulacraCatalogOptions {
  initialData?: SimulacraDataset | null;
  locale: Locale;
  initialSelectedCharId?: string | null;
  initialServerMode?: ServerMode | null;
  initialSearchQuery?: string;
  initialElements?: string[];
  initialRoles?: string[];
  initialSort?: string | null;
}

export interface UseSimulacraCatalogReturn {
  serverMode: ServerMode;
  setServerMode: (mode: ServerMode) => void;
  isModeLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedElements: Set<string>;
  toggleElement: (elementId: string) => void;
  selectedRoles: Set<string>;
  toggleRole: (roleId: string) => void;
  sortValue: string;
  setSortValue: (sort: string) => void;
  filteredItems: SimulacraDatasetItemRaw[];
  totalCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
  handleResetFilters: () => void;
  sortOptions: SortOption[];
  strings: SimulacraStrings;
  selectedCharId: string | null;
  setSelectedCharId: (id: string | null) => void;
  selectedCharacter: SimulacraDatasetItemRaw | null;
}

export interface SimulacraCatalogViewProps {
  initialData?: SimulacraDataset | null;
  initialLocale?: Locale;
  initialSelectedCharId?: string | null;
  initialServerMode?: ServerMode | null;
  initialSearchQuery?: string;
  initialElements?: string[];
  initialRoles?: string[];
  initialSort?: string | null;
}

export interface SimulacraCardItemProps {
  item: SimulacraDatasetItemRaw;
  locale: Locale;
  serverMode: ServerMode;
  strings: SimulacraStrings;
  onSelect?: (id: string) => void;
}

export interface SimulacraDetailViewProps {
  character: SimulacraDatasetItemRaw;
  roster: SimulacraDatasetItemRaw[];
  locale: Locale;
  serverMode: ServerMode;
  strings: SimulacraStrings;
  onBack: () => void;
  onSelectCharacter: (id: string) => void;
  detailLoadError?: {
    onRetry: () => void;
  };
}

// ============================================================================
// Changelog Types
// ============================================================================

export type ChangelogCategory =
  | 'Skill'
  | 'Normal'
  | 'Dodge'
  | 'Discharge'
  | 'Passive'
  | 'Advancement'
  | 'Trait'
  | 'Matrix'
  | 'Stat'
  | 'Other';

export interface ChangelogValueChange {
  type: ChangelogCategory;
  path: string;
  old: string | number;
  new: string | number;
  field?: string;
  skill_id?: string;
  action_id?: string;
  passive_id?: string;
}

export interface CharacterChangelogEntry {
  patch: string;
  client?: string;
  clientRu?: string;
  date?: string;
  edition?: 'gacha' | 'mmo';
  server_mode?: 'gacha' | 'mmo';
  changes: ChangelogValueChange[];
}

export interface ChangelogSectionItem {
  change: ChangelogValueChange;
  info: {
    name: string;
    typeLabel: string;
    sectionKey: 'traits' | 'advancements' | 'skills' | 'passives' | 'matrices' | 'other';
    icon?: string;
    star?: number | null;
    category?: string;
    affinity?: number | null;
  };
  diffHtml: string;
}

export interface CharacterPatchGroup {
  patch: string;
  client?: string;
  clientRu?: string;
  date: string;
  characters: {
    character: SimulacraDatasetItemRaw;
    changes: ChangelogValueChange[];
  }[];
}

export interface SimulacraChangelogStrings {
  title: string;
  gameMode: string;
  modeGacha: string;
  modeMmo: string;
  noChanges: string;
  loading: string;
  metaDescription: string;
  loadingMmo: string;
  errorLoading: string;
  sectionTraits: string;
  sectionAdvancements: string;
  sectionSkills: string;
  sectionPassives: string;
  sectionMatrix: string;
  sectionOther: string;
  pointsAffinity: string;
  catNormal: string;
  catDodge: string;
  catSkill: string;
  catDischarge: string;
  catPassive: string;
  catOther: string;
  filterCharacter: string;
  clearFilter: string;
  backToCatalog: string;
  starAdvancement: string;
  changeFallbackDischarge: string;
  changeFallbackNormal: string;
  changeFallbackDodge: string;
  changeFallbackPassive: string;
  changeStatAtk: string;
  changeStatHp: string;
  changeStatCrit: string;
  changeStatDef: string;
  changeStatShatter: string;
  changeStatCharge: string;
  trait: string;
  weaponSkill: string;
  matrix2pc: string;
  matrix4pc: string;
  roleUnknown: string;
}

export interface SimulacraChangelogViewProps {
  initialData?: SimulacraDataset | null;
  initialLocale?: Locale;
  defaultClientEn?: string;
  defaultClientRu?: string;
  initialCharId?: string | null;
  initialServerMode?: ServerMode;
}
