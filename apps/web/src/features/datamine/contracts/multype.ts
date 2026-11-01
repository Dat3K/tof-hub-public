export interface MultypeDeepLinkParams {
  category?: string | null;
  character?: string | null;
  sub?: string | null;
}

export type MultypeCategoryKey =
  | 'ModuleExtraType_Talent'
  | 'ModuleExtraType_WeaponActive'
  | 'ModuleExtraType_WeaponPassive'
  | 'ModuleExtraType_ProfessionPassive'
  | 'ModuleExtraType_Pet'
  | 'ModuleExtraType_CardPassive'
  | 'ModuleExtraType_CardActive'
  | 'ModuleExtraType_Wormhole'
  | 'NoModule';

export interface MultypeRenamesStore {
  version: number;
  sourceFile: string;
  mainRenames: Record<string, string>;
  subRenames: Record<string, string>;
  valueRenames: Record<string, string>;
  groupRenames: Record<string, string>;
}

export interface MultypeBuffEntry {
  buffId: string;
  displayName: string;
  category: string;
  property: string;
  formula?: string;
  value?: number;
  conditions?: string[];
  rawFile?: string;
}

export interface MultypeCharacterRecord {
  character: string;
  weaponId?: string;
  canonicalCharId?: string | null;
  avatar?: string;
  avatarThumb?: string;
  weaponIcon?: string;
  weaponIconThumb?: string;
  element?: string;
  type?: string;
  maxStar?: number;
  coefficientsCount?: number;
  advancementsCount?: number;
  matricesCount?: number;
  coefficients?: unknown[];
  advancements?: unknown[];
  matrices?: unknown[];
}

export interface MultypeDatasetPayload {
  renames: MultypeRenamesStore;
  mapping: Record<string, Record<string, Record<string, unknown>>>;
  characters?: Record<string, MultypeCharacterRecord>;
}

export interface MultypeFilterState {
  searchQuery: string;
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  selectedCharacter: string | null;
}
