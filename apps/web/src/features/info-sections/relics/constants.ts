import type { SortOption, FilterVariant } from '@tof-hub/ui';
import type { RelicPropertyId, RelicElementFilterId, RelicsStrings, RelicItem, RelicPassiveStat } from './types';

export const DEFAULT_RELICS_SORT = 'id_desc';
export const DEFAULT_SORT = DEFAULT_RELICS_SORT;

export interface RelicElementFilterOption {
  id: RelicElementFilterId;
  variant?: FilterVariant;
  iconPath?: string;
  copyKey: keyof RelicsStrings;
}

export const RELIC_ELEMENT_FILTER_OPTIONS: RelicElementFilterOption[] = [
  {
    id: 'all',
    variant: 'all',
    copyKey: 'all',
  },
  {
    id: 'phys',
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

export interface RelicPropertyFilterOption {
  id: RelicPropertyId;
  variant?: FilterVariant;
  iconPath?: string;
  copyKey: keyof RelicsStrings;
}

export const RELIC_PROPERTY_FILTER_OPTIONS: RelicPropertyFilterOption[] = [
  {
    id: 'all',
    variant: 'all',
    copyKey: 'all',
  },
  {
    id: 'Attack',
    variant: 'attack',
    iconPath: '/datamine/shared/assets/icons/relics/type_attack.webp',
    copyKey: 'propAttack',
  },
  {
    id: 'Defense',
    variant: 'defense',
    iconPath: '/datamine/shared/assets/icons/relics/type_defense.webp',
    copyKey: 'propDefense',
  },
  {
    id: 'Assist',
    variant: 'assist',
    iconPath: '/datamine/shared/assets/icons/relics/type_assist.webp',
    copyKey: 'propAssist',
  },
  {
    id: 'Function',
    variant: 'function',
    iconPath: '/datamine/shared/assets/icons/relics/type_function.webp',
    copyKey: 'propFunction',
  },
];

export function getRelicsSortOptions(strings: RelicsStrings): SortOption[] {
  return [
    {
      value: 'quality_desc',
      label: strings.sortQuality,
    },
    {
      value: 'quality_asc',
      label: strings.sortQualityAsc,
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
    {
      value: 'cooldown',
      label: strings.sortCooldown,
      dividerBefore: true,
    },
    {
      value: 'cooldown_desc',
      label: strings.sortCooldownDesc,
    },
    {
      value: 'id_desc',
      label: strings.sortIdDesc,
      dividerBefore: true,
    },
    {
      value: 'id_asc',
      label: strings.sortIdAsc,
    },
  ];
}

/**
 * Extracts passive stat from star 4 (Gacha) or star 5 (MMO).
 */
export function parseRelicPassiveStat(
  relic: RelicItem | null | undefined,
  isMmo: boolean
): RelicPassiveStat | null {
  if (!relic || !Array.isArray(relic.stars)) return null;

  const targetStar = isMmo ? 5 : 4;
  const starRow = relic.stars.find((s) => s && s.star === targetStar);
  if (!starRow) return null;

  const descEn = (starRow.desc_en || starRow.desc || starRow.description || '').trim();
  const descRu = (starRow.desc_ru || starRow.desc || starRow.description || '').trim();

  function normElement(raw: string | undefined): 'phys' | 'flame' | 'frost' | 'volt' | 'altered' | null {
    if (!raw) return null;
    const str = raw.toLowerCase();
    if (/phys|физическ/i.test(str)) return 'phys';
    if (/flame|fire|огн/i.test(str)) return 'flame';
    if (/frost|ice|холод|мороз|ледян/i.test(str)) return 'frost';
    if (/volt|thunder|электр|вольт/i.test(str)) return 'volt';
    if (/altered|изменен|аберрац/i.test(str)) return 'altered';
    return null;
  }

  const neutralStat = (
    type: 'hp' | 'crit',
    value: string,
  ): RelicPassiveStat => ({
    element: 'neutral',
    type,
    value,
    label_en: `+${value} ${type === 'hp' ? 'Max HP' : 'Crit Rate'}`,
    label_ru: `+${value} ${type === 'hp' ? 'Макс. HP' : 'Шанс крита'}`,
  });

  // MMO universal stats (e.g. Max HP and Final Crit Rate).
  const hpEn = descEn.match(
    /(?:increase|increases)\s+(?:the\s+)?max\s+hp\s+(?:by\s+)?(\d+(?:[.,]\d+)?%)/i,
  );
  const critEn = descEn.match(
    /(?:increase|increases)\s+(?:the\s+)?(?:final\s+)?crit(?:ical)?\s+rate\s+(?:by\s+)?(\d+(?:[.,]\d+)?%)/i,
  );

  if (hpEn) return neutralStat('hp', hpEn[1].replace(',', '.'));
  if (critEn) return neutralStat('crit', critEn[1].replace(',', '.'));

  // Damage buffs (e.g. "Increase flame damage by 1.5%")
  const atkEn = descEn.match(
    /(?:increase|increases)\s+(?:all\s+)?(physical|flame|frost|volt|altered)\s+(?:damage|attack)\s+(?:by\s+)?(\d+(?:[.,]\d+)?%)/i
  );
  const atkRu =
    descRu.match(
      /(?:увеличивает)\s+(?:всеобщий\s+)?(?:атаку\s+)?(физическ[а-яё]*|огненн[а-яё]*|морозн[а-яё]*|ледян[а-яё]*(?:\s+стихией)?|электрическ[а-яё]*|изменен[а-яё]*|volt|вольт[а-яё]*)\s*(?:атаку|стихией|урон от огня|урон от холода|урон от электричества|урон)?\s*(?:на\s+)?(\d+(?:[.,]\d+)?%)/i
    ) ||
    descRu.match(
      /(?:увеличивает)\s+(?:всеобщий\s+)?(?:(физическ[а-яё]*|изменен[а-яё]*)\s+урон|урон\s+от\s+(огня|холода|электричества|измененных\s+эффектов))\s*на\s*(\d+(?:[.,]\d+)?%)/i
    ) ||
    descRu.match(/(?:увеличивает)\s+атаку\s+(volt|ледяной стихией)\s+на\s*(\d+(?:[.,]\d+)?%)/i);

  if (atkEn || atkRu) {
    const rawElem = atkEn ? atkEn[1] : (atkRu![1] || atkRu![2]);
    const rawVal = atkEn ? atkEn[2] : (atkRu![3] || atkRu![2]);
    const elem = normElement(rawElem);
    if (elem) {
      const labelsEn: Record<string, string> = {
        phys: 'Phys DMG',
        flame: 'Flame DMG',
        frost: 'Frost DMG',
        volt: 'Volt DMG',
        altered: 'Altered DMG',
      };
      const labelsRu: Record<string, string> = {
        phys: 'Физ. урон',
        flame: 'Огн. урон',
        frost: 'Лед. урон',
        volt: 'Эл. урон',
        altered: 'Измен. урон',
      };
      const val = (rawVal || '').replace(',', '.');
      return {
        element: elem,
        type: 'atk',
        value: val,
        label_en: `+${val} ${labelsEn[elem]}`,
        label_ru: `+${val} ${labelsRu[elem]}`,
      };
    }
  }

  // Defense buffs (e.g. "Reduce physical damage received by 1.5%")
  const defEn = descEn.match(
    /(?:reduce|reduces)\s+(?:all\s+)?(physical|flame|frost|volt|altered)\s+damage\s+received\s+(?:by\s+)?(\d+(?:[.,]\d+)?%)/i
  ) ||
    descEn.match(
      /(?:increase|increases)\s+(?:all\s+)?(physical|flame|frost|volt|altered)\s+(?:defense|resistance)\s+(?:by\s+)?(\d+(?:[.,]\d+)?%)/i
    );
  const defRu =
    descRu.match(
      /(?:уменьшает|снижает)\s+получаемый\s+(?:всеобщий\s+)?(?:(физическ[а-яё]*|огненн[а-яё]*|морозн[а-яё]*|ледян[а-яё]*|электрическ[а-яё]*|изменен[а-яё]*)\s+урон|урон\s+от\s+(огня|холода|электричества|измененных\s+эффектов))\s*(?:на\s+)?(\d+(?:[.,]\d+)?%)/i
    ) ||
    descRu.match(
      /(?:уменьшает|снижает)\s+(?:(физическ[а-яё]*|огненн[а-яё]*|морозн[а-яё]*|ледян[а-яё]*|электрическ[а-яё]*|изменен[а-яё]*)\s+урон|урон\s+от\s+(огня|холода|электричества|измененных\s+эффектов))\s*на\s*(\d+(?:[.,]\d+)?%)/i
    ) ||
    descRu.match(
      /(?:увеличивает)\s+(?:сопротивление(?:\s+к|\s+физическому)?|сопр\.?)\s*(морозу|огню|вольту|холоду|электричеству|измененности|физическ[а-яё]*)\s*(?:урону)?\s*на\s*(\d+(?:[.,]\d+)?%)/i
    ) ||
    descRu.match(
      /(?:увеличивает)\s+(физическое|огненное|ледяное|морозное)\s+сопротивление\s+на\s*(\d+(?:[.,]\d+)?%)/i
    );

  if (defEn || defRu) {
    const rawElem = defEn ? defEn[1] : (defRu![1] || defRu![2]);
    const rawVal = defEn ? defEn[2] : (defRu![3] || defRu![2]);
    const elem = normElement(rawElem);
    if (elem) {
      const labelsEn: Record<string, string> = {
        phys: 'Phys DEF',
        flame: 'Flame DEF',
        frost: 'Frost DEF',
        volt: 'Volt DEF',
        altered: 'Altered DEF',
      };
      const labelsRu: Record<string, string> = {
        phys: 'Физ. защита',
        flame: 'Огн. защита',
        frost: 'Лед. защита',
        volt: 'Эл. защита',
        altered: 'Измен. защита',
      };
      const val = (rawVal || '').replace(',', '.');
      return {
        element: elem,
        type: 'def',
        value: val,
        label_en: `+${val} ${labelsEn[elem]}`,
        label_ru: `+${val} ${labelsRu[elem]}`,
      };
    }
  }

  return null;
}
