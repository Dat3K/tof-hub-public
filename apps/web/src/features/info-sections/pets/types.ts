import type { ReactNode } from 'react';
import type { Locale } from '@tof-hub/i18n';
import type { FilterVariant, ServerMode, SortOption } from '@tof-hub/ui';

export type PetCategoryTab = 'servants' | 'modules';

export type PetElementFilterId = 'all' | 'phys' | 'fire' | 'frost' | 'volt' | 'altered';

export type PetModuleTypeFilterId = 'all' | 'universal' | 'exclusive';

export interface PetSkillItem {
  name: string;
  name_en?: string;
  name_ru?: string;
  icon?: string | null;
  icon_thumb?: string | null;
  media?: {
    icon?: {
      assetRef?: string;
      role?: string;
      joinIdentity?: string;
    };
  };
  description: string;
  description_en?: string;
  description_ru?: string;
}

export interface PetStarItem {
  star: number;
  atk_inheritance?: string;
  module_slots?: number;
  module_load?: number;
  gold_cost?: number;
  pet_level_req?: number;
  desc?: string;
  description?: string;
}

export interface PetItem {
  id: string;
  category?: string;
  source_edition?: string;
  quality?: string;
  element?: string;
  element_norm?: string;
  property?: string;
  role?: string;
  role_norm?: string;
  icon?: string | null;
  icon_thumb?: string | null;
  photo?: string | null;
  photo_thumb?: string | null;
  token_icon?: string | null;
  token_icon_thumb?: string | null;
  stats_progression?: {
    max_level?: number;
    levels?: Record<
      string,
      {
        level?: number;
        atk?: number;
        crit?: number;
        crit_dmg?: number;
      }
    >;
  } | null;
  stars?: PetStarItem[];
  skills?: PetSkillItem[];
  name?: string;
  name_en?: string;
  name_ru?: string;
  desc?: string;
  desc_en?: string;
  desc_ru?: string;
  description?: string;
  original_name?: string;
  media?: {
    photo?: { assetRef?: string; role?: string; joinIdentity?: string };
    token_icon?: { assetRef?: string; role?: string; joinIdentity?: string };
    source_edition?: string;
  };
}

export interface PetModuleLevel {
  level: number;
  id: string;
  name_en?: string;
  name_ru?: string;
  desc_en?: string;
  desc_ru?: string;
  need_load?: number;
  icon?: string | null;
  icon_thumb?: string | null;
}

export interface PetModuleFamily {
  id: string;
  group_id?: string;
  family_id: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  owner?: string | null;
  owner_en?: string | null;
  owner_ru?: string | null;
  owner_id?: string | null;
  quality?: string;
  need_load?: number;
  icon?: string | null;
  icon_thumb?: string | null;
  levels?: PetModuleLevel[];
  level?: number;
}

export interface PetsStrings {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  filterCategory: string;
  categoryServants: string;
  categoryModules: string;
  filterElement: string;
  filterModuleType: string;
  all: string;
  elemPhys: string;
  elemFlame: string;
  elemFrost: string;
  elemVolt: string;
  elemAltered: string;
  moduleUniversal: string;
  moduleExclusive: string;
  sortBy: string;
  sortReleaseDesc: string;
  sortReleaseAsc: string;
  sortNameAsc: string;
  sortNameDesc: string;
  sortLoadDesc: string;
  sortLoadAsc: string;
  servants: string;
  modules: string;
  items: string;
  showing: string;
  of: string;
  resetFilters: string;
  loading: string;
  loadingMmo: string;
  emptyTitle: string;
  emptyDescription: string;
  combatSkills: string;
  starAdvancements: string;
  starLevel: string;
  atkInherit: string;
  moduleSlots: string;
  moduleLoad: string;
  loadCost: string;
  compatibleModules: string;
  exclusiveServant: string;
  universalModuleDesc: string;
  levelLabel: string;
  loreTitle: string;
  exclusiveModules: string;
  universalModules: string;
  close: string;
  openLightbox: string;
  petAssetsTitle: string;
  petAssetsDisclaimer: string;
  petAssetsCategories: string;
  petAssetArt: string;
  petAssetToken: string;
  petAssetSkillFallback: string;
  petAssetOpen: string;
  petAssetCopyPath: string;
  petFilterArt: string;
  petFilterToken: string;
  petFilterSkill: string;
  petFilterModule: string;
  petFilterElement: string;
  petFilterResonance: string;
  petModuleExclusive: string;
  petModuleUniversal: string;
  petLoadTag: string;
  petModuleLevel: string;
  petLevel: string;
  petStar: string;
  petOpenImage: string;
  petModuleUniversalSingle: string;
  petStarRank: string;
  petStarRankLabel: string;
  petModuleCarrier: string;
  petCarrierOwner: string;
  petModuleCaption: string;
  petNavNavigation: string;
  petNavPager: string;
  petNavBack: string;
  petNavPrevious: string;
  petNavNext: string;
  petStatAtkLevel: string;
  petStatCritLevel: string;
  petStatCritDmg: string;
  petDevTitle: string;
  petDevTitleShort: string;
  petDevDisclaimer: string;
  petDevCategories: string;
  devLabelCn: string;
  devLabelCategory: string;
  devLabelQuality: string;
  devLabelElement: string;
  devLabelRole: string;
  devLabelStars: string;
  devLabelSkills: string;
  devPetIdentifier: string;
  devSkillAction: string;
  devFamilyId: string;
  devType: string;
  devExclusive: string;
  devOwner: string;
  devLevels: string;
  devUniversalPool: string;
  devFamilies: string;
  devPhotoAsset: string;
  devTokenAsset: string;
  devSkillIconLabel: string;
  devAssetsFilterArt: string;
  devAssetsFilterAvatar: string;
  devAssetsFilterSkill: string;
  devAssetsFilterItem: string;
  devAssetsCopyPath: string;
  devAssetsCopied: string;
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
  devTechId: string;
  devTechLevel: string;
  devTechAtk: string;
  devTechCrit: string;
  devTechCritDmg: string;
  devTechSlots: string;
  devTechLoad: string;
}

export interface PetsCatalogViewProps {
  initialData?: any;
  initialLocale?: string;
  initialCategory?: PetCategoryTab | null;
  initialServerMode?: ServerMode | null;
  initialSearchQuery?: string;
  initialElements?: PetElementFilterId[];
  initialModuleFilter?: PetModuleTypeFilterId | null;
  initialSort?: string | null;
  initialSelectedPetId?: string | null;
  initialSelectedModuleId?: string | null;
}

export interface PetServantCardProps {
  item: PetItem;
  locale: Locale;
  strings: PetsStrings;
  onSelect: (pet: PetItem) => void;
}

export interface PetModuleCardProps {
  item: PetModuleFamily;
  locale: Locale;
  strings: PetsStrings;
  onSelect: (module: PetModuleFamily) => void;
  servants: PetItem[];
}

export interface PetServantModalProps {
  isOpen: boolean;
  onClose: () => void;
  pet: PetItem | null;
  locale: Locale;
  strings: PetsStrings;
  roster?: PetItem[];
  onSelectPet?: (petId: string) => void;
  onSelectModuleFamily?: (familyId: string) => void;
  moduleFamilies?: PetModuleFamily[];
}

export interface PetModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: PetModuleFamily | null;
  locale: Locale;
  strings: PetsStrings;
  onSelectServant?: (servantId: string) => void;
  servants?: PetItem[];
}
