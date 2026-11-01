import type { SortOption, FilterVariant } from '@tof-hub/ui';
import type { SimulacraStrings, ElementFilterId, RoleFilterId } from './types';

export const DEFAULT_SORT = 'release_desc';

export interface ElementFilterOption {
  id: ElementFilterId;
  variant?: FilterVariant;
  iconPath?: string;
  copyKey: keyof SimulacraStrings;
}

export const ELEMENT_FILTER_OPTIONS: ElementFilterOption[] = [
  {
    id: 'all',
    variant: 'all',
    copyKey: 'filterAll',
  },
  {
    id: 'physical',
    variant: 'phys',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_wu',
    copyKey: 'filterPhys',
  },
  {
    id: 'flame',
    variant: 'flame',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
    copyKey: 'filterFlame',
  },
  {
    id: 'frost',
    variant: 'frost',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_bing',
    copyKey: 'filterFrost',
  },
  {
    id: 'volt',
    variant: 'volt',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_lei',
    copyKey: 'filterVolt',
  },
  {
    id: 'altered',
    variant: 'altered',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_element_powers',
    copyKey: 'filterAltered',
  },
];

export interface RoleFilterOption {
  id: RoleFilterId;
  variant?: FilterVariant;
  iconPath?: string;
  copyKey: keyof SimulacraStrings;
}

export const ROLE_FILTER_OPTIONS: RoleFilterOption[] = [
  {
    id: 'all',
    variant: 'all',
    copyKey: 'filterAll',
  },
  {
    id: 'dps',
    variant: 'dps',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_qianggong',
    copyKey: 'filterDps',
  },
  {
    id: 'tank',
    variant: 'tank',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_fangyu',
    copyKey: 'filterTank',
  },
  {
    id: 'benediction',
    variant: 'benediction',
    iconPath: 'Hotta/Content/Resources/UI/wuqi/icon_zengyi',
    copyKey: 'filterBene',
  },
];

export function getSimulacraSortOptions(strings: SimulacraStrings): SortOption[] {
  return [
    {
      value: 'release_desc',
      label: strings.sortReleaseDesc,
    },
    {
      value: 'release_asc',
      label: strings.sortReleaseAsc,
    },
    {
      value: 'name_asc',
      label: strings.sortNameAsc,
      dividerBefore: true,
    },
    {
      value: 'name_desc',
      label: strings.sortNameDesc,
    },
  ];
}

export interface MatrixSlotDef {
  id: 'mind' | 'memory' | 'belief' | 'emotion';
  num: number;
  name_en: string;
  name_ru: string;
  icon?: string;
}

export const MATRIX_SLOTS_DEF: MatrixSlotDef[] = [
  {
    id: 'mind',
    num: 1,
    name_en: 'Mind',
    name_ru: 'Разум',
    icon: 'Hotta/Content/Resources/UI/yizhi/yizhick_mind_big',
  },
  {
    id: 'memory',
    num: 2,
    name_en: 'Memory',
    name_ru: 'Память',
    icon: 'Hotta/Content/Resources/UI/yizhi/yizhick_memory_big',
  },
  {
    id: 'belief',
    num: 3,
    name_en: 'Belief',
    name_ru: 'Вера',
    icon: 'Hotta/Content/Resources/UI/yizhi/yizhick_believe_big',
  },
  {
    id: 'emotion',
    num: 4,
    name_en: 'Emotion',
    name_ru: 'Эмоция',
    icon: 'Hotta/Content/Resources/UI/yizhi/yizhick_emotion_big',
  },
];

export const STAT_ICONS = {
  atk: 'Hotta/Content/Resources/UI/AttributeIcon/icon_atk',
  hp: 'Hotta/Content/Resources/UI/AttributeIcon/icon_hp',
  crit: 'Hotta/Content/Resources/UI/AttributeIcon/icon_baoji',
  resist: 'Hotta/Content/Resources/UI/AttributeIcon/icon_resist_all',
  def: 'Hotta/Content/Resources/UI/AttributeIcon/icon_resist_all',
};

export { STAT_GRADE_ICONS as GRADE_ICONS } from '@tof-hub/game-assets';

export function getStatGrade(val: string | number | undefined | null): string | null {
  if (val === undefined || val === null) return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (Number.isNaN(num)) return null;
  if (num >= 15.0) return 'SS';
  if (num >= 10.0) return 'S';
  if (num >= 8.0) return 'A';
  if (num >= 4.0) return 'B';
  return 'C';
}

export interface ReactionPassiveDef {
  name_en: string;
  name_ru: string;
  desc_en: string;
  desc_ru: string;
  icon: string;
}

export const REACTION_PASSIVES_DATA: Record<string, ReactionPassiveDef> = {
  Frost: {
    name_en: 'Ice Shell',
    name_ru: 'Ледяная оболочка',
    desc_en:
      "When the weapon is fully charged, the next attack will strongly freeze targets for 2 seconds and leave them frostbitten for 6 seconds. Breaking the ice shell deals damage equal to 151% of ATK. While frostbitten, the target's weapon charge rate is reduced by 50%.",
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака интенсивно замораживает цели на 2 сек. и оставляет их обмороженными на 6 сек. Если разбить ледяную оболочку, это нанесет урон в размере 151% от АТК. Пока цель обморожена, скорость заряда ее оружия снижается на 50%.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_bing',
  },
  Flame: {
    name_en: 'Flame',
    name_ru: 'Огонь',
    desc_en:
      "When the weapon is fully charged, the next attack will ignite the target for 8 seconds, dealing damage equal to 58% of ATK every second. While ignited, targets' healing effect is reduced by 50%.",
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака на 8 секунд поджигает цель, нанося урон в размере 58% от АТК каждую секунду. У горящих целей эффективность лечения снижается на 50%.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
  },
  Physical: {
    name_en: 'Grievous',
    name_ru: 'Тяжелое ранение',
    desc_en:
      'When the weapon is fully charged, the next attack will inflict grievous on the target for 7 seconds, making them take 20% more damage and dealing damage equal to 100% of ATK.',
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака наносит цели тяжелое ранение на 7 сек., увеличивая получаемый ею урон на 20% и нанося урон в размере 100% от АТК.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_wu',
  },
  Volt: {
    name_en: 'Volt',
    name_ru: 'Электричество',
    desc_en:
      'When the weapon is fully charged, the next attack will paralyze targets for 1 second and electrify them for 6 seconds, negating all buffs and dealing damage equal to 106% of ATK. Targets cannot receive any buffs for the next 6 seconds.',
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака парализует цели на 1 сек. и электризует их на 6 сек., снимая все баффы и нанося урон в размере 106% от АТК. В течение следующих 6 сек. цели не могут получать баффы.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_lei',
  },
  Altered: {
    name_en: 'Superpower',
    name_ru: 'Аберрация',
    desc_en:
      'When the weapon is fully charged, the next attack will trigger a strong resonance, dealing damage equal to 125% of ATK and increasing elemental damage by 15% for 10 seconds.',
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака вызывает мощный резонанс, нанося урон в размере 125% от АТК и повышая стихийный урон на 15% на 10 сек.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_powers',
  },
};

/**
 * MMO uses the Balance variants of the elemental weapon-charge passives.
 * These values mirror the authoritative QRSLCommon_ST localization entries:
 * ui_weapon_charge_*_desc_0_Balance.
 */
export const MMO_REACTION_PASSIVES_DATA: Record<string, ReactionPassiveDef> = {
  Altered: {
    name_en: 'Altered Damage',
    name_ru: 'Измененный урон',
    desc_en:
      "When the weapon is fully charged, the next attack will mark the target, causing an explosion after 5 seconds. Additionally, inflict damage equal to 25% of all damage received by the target during the duration of the mark, up to a total of 160% of the Wanderer's ATK. Only 1 mark can exist on a target at a time.",
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака пометит цель, вызывая взрыв через 5 секунд. Дополнительно наносит урон в размере 25% от получаемого целью урона в течение действия метки, всего до 160% от ATK Странника. Одновременно на цели может находиться только 1 метка.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_powers',
  },
  Frost: {
    name_en: 'Ice Shell',
    name_ru: 'Ледяная оболочка',
    desc_en:
      "When the weapon is fully charged, the next attack will strongly freeze targets for 1 second and leave them frostbitten for 6 seconds. Breaking the ice shell deals damage equal to 100% of ATK. While frostbitten, the target's speed is reduced by 30%.",
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака интенсивно замораживает цели на 1 сек. и оставляет их обмороженными на 6 сек. Когда ледяная оболочка разбивается, цель получает урон в размере 100% от АТК. Пока цель обморожена, ее скорость снижается на 30%.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_bing',
  },
  Volt: {
    name_en: 'Volt',
    name_ru: 'Электричество',
    desc_en:
      "When the weapon is fully charged, the next attack will strongly paralyze targets for 1 second, leave them electrified for 5 seconds, and deal damage equal to 100% of ATK. While paralyzed and/or electrified, the target can't receive any buffs.",
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака интенсивно парализует цели на 1 сек. и электризует их на 5 сек., нанося урон в размере 100% от АТК. Парализованные и/или наэлектризованные цели не могут получать никаких баффов.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_lei',
  },
  Flame: {
    name_en: 'Flame',
    name_ru: 'Огонь',
    desc_en:
      'When the weapon is fully charged, the next attack will ignite the target for 8 seconds, dealing damage equal to 20% of ATK every second.',
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака на 8 сек. поджигает цель, нанося урон в размере 20% от АТК каждую секунду.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo',
  },
  Physical: {
    name_en: 'Grievous',
    name_ru: 'Тяжелое ранение',
    desc_en:
      'When the weapon is fully charged, the next attack will cause enemies to become grievous for 7 seconds, reducing their healing effect by 30% and dealing damage equal to 100% of ATK.',
    desc_ru:
      'Когда оружие полностью заряжено, следующая атака накладывает на врагов эффект тяжелого ранения на 7 сек., ослабляя их эффекты лечения на 30% и нанося урон в размере 100% от АТК.',
    icon: 'Hotta/Content/Resources/UI/wuqi/icon_element_wu',
  },
};
