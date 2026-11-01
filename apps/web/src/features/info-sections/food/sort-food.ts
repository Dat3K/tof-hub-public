import type { FoodDishItem, FoodPotionItem } from './types';

type FoodSortableItem = FoodDishItem | FoodPotionItem;

const PHYSICAL_ATTACK_PATTERN =
  /(?:physical\s+(?:atk|attack)|phys\.?\s*atk|физическ\w*\s+атак\w*)\s*(?:by|на|=)?\s*([+-]?\d+(?:\.\d+)?)\s*(%?)/gi;
const PHYSICAL_DEFENSE_PATTERN =
  /(?:physical\s+(?:resistance|def(?:ense)?)|phys\.?\s*(?:def|res)|физическ\w*\s+(?:сопротивлен\w*|защит\w*))\s*(?:by|на|=)?\s*([+-]?\d+(?:\.\d+)?)\s*(%?)/gi;

function getEffectText(item: FoodSortableItem): string[] {
  const texts = [
    ...(item.formatted_effects_en || []),
    ...(item.formatted_effects_ru || []),
    ...(item.formatted_effects || []),
    'effect_text_en' in item && item.effect_text_en ? item.effect_text_en : '',
    'effect_text_ru' in item && item.effect_text_ru ? item.effect_text_ru : '',
    'effect_text' in item && item.effect_text ? item.effect_text : '',
  ];

  return texts.filter(Boolean);
}

function parsePhysicalEffectValues(item: FoodSortableItem, effectId: 'PhyAtk' | 'PhyDef') {
  // MMO dishes carry structured flat buffs; their tooltip numbers use thousands separators.
  if ('effects' in item && Array.isArray(item.effects)) {
    const kind = effectId === 'PhyAtk' ? 'atk_flat' : 'def_flat';
    const effect = item.effects.find((entry) => entry.kind === kind && entry.element === 'Phy');
    return [0, effect?.value ?? 0] as const;
  }

  if (
    effectId === 'PhyAtk' &&
    'atk_percent' in item &&
    (typeof item.atk_percent === 'number' || typeof item.atk_flat === 'number')
  ) {
    return [item.atk_percent || 0, item.atk_flat || 0] as const;
  }

  const pattern = effectId === 'PhyAtk' ? PHYSICAL_ATTACK_PATTERN : PHYSICAL_DEFENSE_PATTERN;
  const values: number[] = [];

  for (const text of getEffectText(item)) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      values.push(Number(match[1] || 0));
    }
  }

  return [values[0] || 0, values[1] || 0] as const;
}

/** Shared magnitude ordering: percentage first, then flat contribution. */
export function compareFoodBuffMagnitudes(a:{percentage:number;flat:number},b:{percentage:number;flat:number},direction:'asc'|'desc'='desc') {
  const multiplier=direction==='desc'?-1:1;
  return (a.percentage-b.percentage)*multiplier||(a.flat-b.flat)*multiplier;
}

export function compareFoodEffectValues(
  a: FoodSortableItem,
  b: FoodSortableItem,
  effectId: 'PhyAtk' | 'PhyDef',
  direction: 'asc' | 'desc'
) {
  const [aPercent, aFlat] = parsePhysicalEffectValues(a, effectId);
  const [bPercent, bFlat] = parsePhysicalEffectValues(b, effectId);
  return compareFoodBuffMagnitudes({percentage:aPercent,flat:aFlat},{percentage:bPercent,flat:bFlat},direction);
}
