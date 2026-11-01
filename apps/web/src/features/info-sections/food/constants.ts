import type { FilterVariant, ServerMode, SortOption } from '@tof-hub/ui';
import type {
  FoodCornerBadge,
  FoodDishItem,
  FoodPotionItem,
  FoodPotionSubcategory,
  FoodRarityFilter,
  FoodRecipeFilter,
  FoodStrings,
  FoodViewTab,
} from './types';

export const DEFAULT_FOOD_SORT = 'idDesc';
export const DEFAULT_DISH_SORT = 'buffPercentDesc';
/** MMO dishes follow the in-game recipe list order (cooking level 1 → 20). */
export const DEFAULT_MMO_DISH_SORT = 'cookLevelAsc';

export function getDefaultFoodSort(tab: FoodViewTab, mode: ServerMode = 'gacha'): string {
  if (tab !== 'dishes') return DEFAULT_FOOD_SORT;
  return mode === 'mmo' ? DEFAULT_MMO_DISH_SORT : DEFAULT_DISH_SORT;
}

export const FOOD_RARITY_OPTIONS: { id: FoodRarityFilter; label: string; variant: FilterVariant }[] = [
  { id: 'all', label: 'All', variant: 'all' },
  { id: 'GOLD', label: 'Gold', variant: 'yellow' },
  { id: 'SSR', label: 'SSR', variant: 'ssr' },
  { id: 'SR', label: 'SR', variant: 'sr' },
  { id: 'R', label: 'R', variant: 'r' },
  { id: 'N', label: 'N', variant: 'n' },
];

export const FOOD_RECIPE_OPTIONS: {
  id: FoodRecipeFilter;
  copyKey: keyof FoodStrings;
  variant: FilterVariant;
}[] = [
  { id: 'all', copyKey: 'all', variant: 'all' },
  { id: 'has-recipe', copyKey: 'hasRecipe', variant: 'function' },
  { id: 'no-recipe', copyKey: 'noRecipe', variant: 'default' },
];

export const FOOD_POTION_SUBCATEGORY_OPTIONS: {
  id: FoodPotionSubcategory;
  copyKey: keyof FoodStrings;
  variant: FilterVariant;
}[] = [
  { id: 'all', copyKey: 'potionSub_all', variant: 'all' },
  { id: 'shots', copyKey: 'potionSub_shots', variant: 'attack' },
  { id: 'mushrooms', copyKey: 'potionSub_mushrooms', variant: 'altered' },
  { id: 'nutripastes', copyKey: 'potionSub_nutripastes', variant: 'function' },
  { id: 'utility', copyKey: 'potionSub_utility', variant: 'assist' },
  { id: 'drinks', copyKey: 'potionSub_drinks', variant: 'survive' },
  { id: 'pills', copyKey: 'potionSub_pills', variant: 'function' },
  { id: 'combat_food', copyKey: 'potionSub_combatFood', variant: 'attack' },
];

export interface FoodEffectFilterOption {
  id: string;
  labelEn: string;
  labelRu: string;
  shortLabelEn: string;
  shortLabelRu: string;
  iconPath: string;
  category: 'atk' | 'def' | 'util';
  variant: FilterVariant;
}

export const FOOD_EFFECT_FILTER_OPTIONS: FoodEffectFilterOption[] = [
  // 1. Damage Elements
  {
    id: 'PhyAtk',
    labelEn: 'Physical Attack',
    labelRu: 'Физическая атака',
    shortLabelEn: 'Phys Atk',
    shortLabelRu: 'Физ. атака',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_wu',
    category: 'atk',
    variant: 'phys',
  },
  {
    id: 'FireAtk',
    labelEn: 'Flame Attack',
    labelRu: 'Огненная атака',
    shortLabelEn: 'Flame Atk',
    shortLabelRu: 'Огн. атака',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_huo',
    category: 'atk',
    variant: 'flame',
  },
  {
    id: 'IceAtk',
    labelEn: 'Frost Attack',
    labelRu: 'Ледяная атака',
    shortLabelEn: 'Frost Atk',
    shortLabelRu: 'Лед. атака',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_bing',
    category: 'atk',
    variant: 'frost',
  },
  {
    id: 'ThunderAtk',
    labelEn: 'Volt Attack',
    labelRu: 'Громовая атака',
    shortLabelEn: 'Volt Atk',
    shortLabelRu: 'Вольт. атака',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_lei',
    category: 'atk',
    variant: 'volt',
  },
  // 2. Resistance Elements
  {
    id: 'PhyDef',
    labelEn: 'Physical Resistance',
    labelRu: 'Физическое сопротивление',
    shortLabelEn: 'Phys Def',
    shortLabelRu: 'Физ. защита',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def',
    category: 'def',
    variant: 'phys',
  },
  {
    id: 'FireDef',
    labelEn: 'Flame Resistance',
    labelRu: 'Огненное сопротивление',
    shortLabelEn: 'Flame Def',
    shortLabelRu: 'Огн. защита',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def_huo',
    category: 'def',
    variant: 'flame',
  },
  {
    id: 'IceDef',
    labelEn: 'Frost Resistance',
    labelRu: 'Ледяное сопротивление',
    shortLabelEn: 'Frost Def',
    shortLabelRu: 'Лед. защита',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def_bing',
    category: 'def',
    variant: 'frost',
  },
  {
    id: 'ThunderDef',
    labelEn: 'Volt Resistance',
    labelRu: 'Громовое сопротивление',
    shortLabelEn: 'Volt Def',
    shortLabelRu: 'Вольт. защита',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def_lei',
    category: 'def',
    variant: 'volt',
  },
  // 3. Utility
  {
    id: 'AddSatiety',
    labelEn: 'Recover Satiety',
    labelRu: 'Восстановление сытости',
    shortLabelEn: 'Satiety',
    shortLabelRu: 'Сытость',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_full',
    category: 'util',
    variant: 'survive',
  },
  {
    id: 'AddHealth',
    labelEn: 'Recover HP',
    labelRu: 'Восстановление здоровья',
    shortLabelEn: 'HP',
    shortLabelRu: 'HP',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_hp',
    category: 'util',
    variant: 'survive',
  },
  {
    id: 'RecoverHp',
    labelEn: 'HP Regen',
    labelRu: 'Регенерация HP',
    shortLabelEn: 'HP Regen',
    shortLabelRu: 'Реген. HP',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_item_RecoveryHp',
    category: 'util',
    variant: 'survive',
  },
  {
    id: 'AddEnergyRecover',
    labelEn: 'Recover Endurance',
    labelRu: 'Восстановление выносливости',
    shortLabelEn: 'Endurance',
    shortLabelRu: 'Выносл.',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_energy',
    category: 'util',
    variant: 'assist',
  },
  {
    id: 'EnergyConsumeDown',
    labelEn: 'Reduce Endurance Consumption',
    labelRu: 'Снижение расхода выносливости',
    shortLabelEn: 'Endurance Cost',
    shortLabelRu: 'Расход выносл.',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_item_EnergyConsumeDown',
    category: 'util',
    variant: 'assist',
  },
  {
    id: 'DiveSpeed',
    labelEn: 'Dive Speed',
    labelRu: 'Скорость погружения',
    shortLabelEn: 'Dive Speed',
    shortLabelRu: 'Погружение',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_item_DiveSpeed',
    category: 'util',
    variant: 'function',
  },
  {
    id: 'CleanBuff',
    labelEn: 'Clean Poison',
    labelRu: 'Очищение от яда',
    shortLabelEn: 'Cleanse',
    shortLabelRu: 'Очищение',
    iconPath: 'Hotta/Content/Resources/UI/AttributeIcon/icon_item_CleanBuff',
    category: 'util',
    variant: 'function',
  },
];

export function getDishCornerBadges(
  item: FoodDishItem | FoodPotionItem,
  isRu: boolean
): { tl: FoodCornerBadge | null; tr: FoodCornerBadge | null } {
  let tl: FoodCornerBadge | null = null;
  let tr: FoodCornerBadge | null = null;

  const categories = Array.isArray(item.categories) ? item.categories : [];

  // 1. Top-Right: Healing or Defense
  const hasHeal = Boolean(
    ('has_heal' in item && item.has_heal) ||
    categories.includes('AddHealth') ||
    categories.includes('RecoverHp') ||
    categories.includes('FoodRecoverHp') ||
    (item.buffs &&
      item.buffs.some(
        (b) => b.buff_id === 'buff_AddHealthFoodBase' || b.buff_id === 'buff_Food_AddRecoveryHp'
      ))
  );

  if (hasHeal) {
    tr = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_hp',
      title: isRu ? 'Восстановление здоровья' : 'Restores HP',
      isHeal: true,
    };
  } else if (categories.includes('PhyDef')) {
    tr = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def',
      title: isRu ? 'Физическое сопротивление' : 'Physical Resistance',
      isHeal: false,
    };
  } else if (categories.includes('IceDef')) {
    tr = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def_bing',
      title: isRu ? 'Ледяное сопротивление' : 'Frost Resistance',
      isHeal: false,
    };
  } else if (categories.includes('FireDef')) {
    tr = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def_huo',
      title: isRu ? 'Огненное сопротивление' : 'Flame Resistance',
      isHeal: false,
    };
  } else if (categories.includes('ThunderDef')) {
    tr = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_def_lei',
      title: isRu ? 'Громовое сопротивление' : 'Volt Resistance',
      isHeal: false,
    };
  }

  // 2. Top-Left: Offense, Endurance, or Utility
  if (categories.includes('AddEnergyRecover')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_energy',
      title: isRu ? 'Восстановление выносливости' : 'Recover Endurance',
    };
  } else if (categories.includes('EnergyConsumeDown')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_item_EnergyConsumeDown',
      title: isRu ? 'Снижение расхода выносливости' : 'Reduce Endurance Consumption',
    };
  } else if (categories.includes('IceAtk')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_bing',
      title: isRu ? 'Ледяная атака' : 'Frost Attack',
    };
  } else if (categories.includes('PhyAtk')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_wu',
      title: isRu ? 'Физическая атака' : 'Physical Attack',
    };
  } else if (categories.includes('FireAtk')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_huo',
      title: isRu ? 'Огненная атака' : 'Flame Attack',
    };
  } else if (categories.includes('ThunderAtk')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_Item_lei',
      title: isRu ? 'Громовая атака' : 'Volt Attack',
    };
  } else if (categories.includes('DiveSpeed')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_item_DiveSpeed',
      title: isRu ? 'Скорость погружения' : 'Dive Speed',
    };
  } else if (categories.includes('CleanBuff')) {
    tl = {
      icon: 'Hotta/Content/Resources/UI/AttributeIcon/icon_item_CleanBuff',
      title: isRu ? 'Очищение от яда' : 'Clean Poison',
    };
  }

  return { tl, tr };
}

export function getFoodSortOptions(
  strings: FoodStrings,
  tab: FoodViewTab,
  hasEffectSort = false,
  mode: ServerMode = 'gacha'
): SortOption[] {
  const effectSortOptions: SortOption[] = hasEffectSort
    ? [
        { value: 'effectDesc', label: strings.sortEffectDesc, dividerBefore: true },
        { value: 'effectAsc', label: strings.sortEffectAsc },
      ]
    : [];

  // MMO dishes have no satiety values or release order; the cooking level replaces both.
  if (tab === 'dishes' && mode === 'mmo') {
    return [
      { value: 'cookLevelAsc', label: strings.sortCookLevelAsc },
      { value: 'cookLevelDesc', label: strings.sortCookLevelDesc },
      { value: 'qualityDesc', label: strings.sortQualityDesc, dividerBefore: true },
      ...effectSortOptions,
      { value: 'nameAsc', label: strings.sortNameAsc, dividerBefore: true },
      { value: 'nameDesc', label: strings.sortNameDesc },
    ];
  }

  if (tab === 'dishes') {
    return [
      { value: 'idDesc', label: strings.sortIdDesc },
      { value: 'idAsc', label: strings.sortIdAsc },
      { value: 'qualityDesc', label: strings.sortQualityDesc, dividerBefore: true },
      { value: 'buffPercentDesc', label: strings.sortBuffPercentDesc, dividerBefore: true },
      { value: 'buffPercentAsc', label: strings.sortBuffPercentAsc },
      ...effectSortOptions,
      { value: 'nameAsc', label: strings.sortNameAsc, dividerBefore: true },
      { value: 'nameDesc', label: strings.sortNameDesc },
    ];
  }

  if (tab === 'ingredients') {
    return [
      { value: 'idDesc', label: strings.sortIdDesc },
      { value: 'idAsc', label: strings.sortIdAsc },
      { value: 'nameAsc', label: strings.sortNameAsc, dividerBefore: true },
      { value: 'nameDesc', label: strings.sortNameDesc },
    ];
  }

  // Potions
  return [
    { value: 'idDesc', label: strings.sortIdDesc },
    { value: 'idAsc', label: strings.sortIdAsc },
    { value: 'qualityDesc', label: strings.sortQualityDesc, dividerBefore: true },
    { value: 'qualityAsc', label: strings.sortQualityAsc },
    ...effectSortOptions,
    { value: 'durationDesc', label: strings.sortDurationDesc, dividerBefore: true },
    { value: 'durationAsc', label: strings.sortDurationAsc },
    { value: 'nameAsc', label: strings.sortNameAsc, dividerBefore: true },
    { value: 'nameDesc', label: strings.sortNameDesc },
  ];
}
