import type { SortOption, FilterVariant } from '@tof-hub/ui';
import type { ElementFilterId, RoleFilterId, MatricesStrings } from './types';
export { getDualElementIconPath } from '../common/element-icons';

export const DEFAULT_MATRICES_SORT = 'id_desc';
export const DEFAULT_SORT = DEFAULT_MATRICES_SORT;

export interface ElementFilterOption {
  id: ElementFilterId;
  variant?: FilterVariant;
  iconPath?: string;
  copyKey: keyof MatricesStrings;
}

export const ELEMENT_FILTER_OPTIONS: ElementFilterOption[] = [
  {
    id: 'all',
    variant: 'all',
    copyKey: 'all',
  },
  {
    id: 'physical',
    variant: 'phys',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_wu',
    copyKey: 'elemPhysical',
  },
  {
    id: 'flame',
    variant: 'flame',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
    copyKey: 'elemFire',
  },
  {
    id: 'frost',
    variant: 'frost',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_bing',
    copyKey: 'elemIce',
  },
  {
    id: 'volt',
    variant: 'volt',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_lei',
    copyKey: 'elemThunder',
  },
  {
    id: 'altered',
    variant: 'altered',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_powers',
    copyKey: 'elemSuperpower',
  },
];

export interface RoleFilterOption {
  id: RoleFilterId;
  variant?: FilterVariant;
  iconPath?: string;
  copyKey: keyof MatricesStrings;
}

export const ROLE_FILTER_OPTIONS: RoleFilterOption[] = [
  {
    id: 'all',
    variant: 'all',
    copyKey: 'all',
  },
  {
    id: 'dps',
    variant: 'dps',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_qianggong',
    copyKey: 'roleDps',
  },
  {
    id: 'tank',
    variant: 'tank',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_fangyu',
    copyKey: 'roleTank',
  },
  {
    id: 'benediction',
    variant: 'benediction',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_zengyi',
    copyKey: 'roleBenediction',
  },
];

export function getMatricesSortOptions(strings: MatricesStrings): SortOption[] {
  return [
    {
      value: 'id_desc',
      label: strings.sortIdDesc,
    },
    {
      value: 'id_asc',
      label: strings.sortIdAsc,
    },
    {
      value: 'name',
      label: strings.sortName,
      dividerBefore: true,
    },
    {
      value: 'name_desc',
      label: strings.sortNameDesc,
    },
  ];
}

export interface SlotConfig {
  slot: number;
  key: 'mind' | 'memory' | 'belief' | 'emotion';
  labelKey: keyof MatricesStrings;
  iconPath: string;
}

export const MATRIX_SLOT_CONFIGS: SlotConfig[] = [
  {
    slot: 1,
    key: 'mind',
    labelKey: 'slotMind',
    iconPath: 'Hotta/Content/Resources/UI/yizhi/yizhick_mind_big',
  },
  {
    slot: 2,
    key: 'memory',
    labelKey: 'slotMemory',
    iconPath: 'Hotta/Content/Resources/UI/yizhi/yizhick_memory_big',
  },
  {
    slot: 3,
    key: 'belief',
    labelKey: 'slotBelief',
    iconPath: 'Hotta/Content/Resources/UI/yizhi/yizhick_believe_big',
  },
  {
    slot: 4,
    key: 'emotion',
    labelKey: 'slotEmotion',
    iconPath: 'Hotta/Content/Resources/UI/yizhi/yizhick_emotion_big',
  },
];

export const CANONICAL_CHAR_ID_MAP: Record<string, string> = {
  mark: 'make',
  immortal: 'baiyuekui',
  zero: 'ling',
  hammer: 'ene',
  cannon: 'hilda',
  stave: 'pepper',
  spear: 'aige',
  bow: 'bai-ling',
  digger: 'wuwan',
  bigsword: 'meryl',
  shieldaxe: 'xiuma',
  sickle: 'king',
  gun: 'gulan',
  sword: 'claudia',
  darts: 'shiro',
  cube: 'ling',
  dgun: 'saimier',
  suspension: 'avatar06',
  frigg: 'avatar12',
  funnel: 'ruby',
  dkatana: 'saki-fuwa',
  fan: 'lin',
  arm: 'xinghuan',
  tianlang: 'tian-lang',
  snipe: 'annabella',
  iceblade: 'alyss',
  whip: 'umi',
  umbrella: 'lan',
  yoyo: 'icarus',
  queen: 'fiona',
  chainsaw: 'gnonno',
  brush: 'liu-huo',
  mimi: 'huang',
  linghan: 'ling-han',
  nanyin: 'nan-yin',
  killknife: 'yanmiao',
  blevi: 'brevey',
  paradox: 'plotti',
  lances: 'yanuo',
  ayanamirei: 'rei-ayanami',
  dfishchess: 'ji-yu',
  loslyn: 'roslyn',
  ace: 'anka',
  merylx: 'meryl-ironheart',
  tkatana: 'asilada',
  swordx: 'claudia-storm',
  blackstar: 'nemesis-voidpiercer',
  gunbox: 'carrot',
  commodore: 'ciper',
  greyfoxsp: 'ageleia',
};
