import type { FilterVariant, SortOption } from '@tof-hub/ui';
import type {
  PetCategoryTab,
  PetElementFilterId,
  PetModuleTypeFilterId,
  PetsStrings,
} from './types';

export const DEFAULT_PETS_SORT = 'release_desc';

export interface PetElementFilterOption {
  id: PetElementFilterId;
  variant?: FilterVariant;
  iconPath?: string;
  copyKey: keyof PetsStrings;
}

export const PET_ELEMENT_FILTER_OPTIONS: PetElementFilterOption[] = [
  {
    id: 'all',
    variant: 'all',
    copyKey: 'all',
  },
  {
    id: 'phys',
    variant: 'phys',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_wu',
    copyKey: 'elemPhys',
  },
  {
    id: 'fire',
    variant: 'fire',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
    copyKey: 'elemFlame',
  },
  {
    id: 'frost',
    variant: 'frost',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_bing',
    copyKey: 'elemFrost',
  },
  {
    id: 'volt',
    variant: 'volt',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_lei',
    copyKey: 'elemVolt',
  },
  {
    id: 'altered',
    variant: 'altered',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_powers',
    copyKey: 'elemAltered',
  },
];

export interface PetModuleTypeOption {
  id: PetModuleTypeFilterId;
  copyKey: keyof PetsStrings;
}

export const PET_MODULE_TYPE_OPTIONS: PetModuleTypeOption[] = [
  {
    id: 'all',
    copyKey: 'all',
  },
  {
    id: 'universal',
    copyKey: 'moduleUniversal',
  },
  {
    id: 'exclusive',
    copyKey: 'moduleExclusive',
  },
];

export function getPetsSortOptions(
  strings: PetsStrings,
  category: PetCategoryTab
): SortOption[] {
  const baseOptions: SortOption[] = [
    { value: 'release_desc', label: strings.sortReleaseDesc },
    { value: 'release_asc', label: strings.sortReleaseAsc },
    { value: 'name_asc', label: strings.sortNameAsc, dividerBefore: true },
    { value: 'name_desc', label: strings.sortNameDesc },
  ];

  if (category === 'modules') {
    return [
      ...baseOptions,
      { value: 'load_desc', label: strings.sortLoadDesc, dividerBefore: true },
      { value: 'load_asc', label: strings.sortLoadAsc },
    ];
  }

  return baseOptions;
}

export function normalizePetElement(elem?: string): PetElementFilterId {
  if (!elem) return 'all';
  const lower = elem.toLowerCase();
  if (lower.includes('phys')) return 'phys';
  if (lower.includes('fire') || lower.includes('flame') || lower.includes('huo')) return 'fire';
  if (lower.includes('ice') || lower.includes('frost') || lower.includes('bing')) return 'frost';
  if (lower.includes('thunder') || lower.includes('volt') || lower.includes('lei')) return 'volt';
  if (lower.includes('altered') || lower.includes('power') || lower.includes('superpower')) return 'altered';
  return 'all';
}
