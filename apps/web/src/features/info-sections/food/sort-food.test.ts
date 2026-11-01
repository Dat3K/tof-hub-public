import { describe, expect, it } from 'vitest';
import { compareFoodEffectValues } from './sort-food';

describe('compareFoodEffectValues', () => {
  it('sorts the selected physical attack instead of an earlier unrelated percentage', () => {
    const lower = {
      id: 'lower',
      formatted_effects_en: ['Increase speed by 30% and physical ATK by 10% for 900 seconds.'],
    };
    const higher = {
      id: 'higher',
      formatted_effects_en: ['Increase speed by 30% and physical ATK by 12% for 900 seconds.'],
    };

    expect(compareFoodEffectValues(higher, lower, 'PhyAtk', 'desc')).toBeLessThan(0);
  });

  it('reads MMO structured flat buffs instead of comma-grouped tooltip numbers', () => {
    const lower = {
      id: 'lower',
      formatted_effects_en: ['Increases Physical Attack by 2,343 for 1,800s.'],
      effects: [{ kind: 'atk_flat', element: 'Phy', value: 2343 }],
    };
    const higher = {
      id: 'higher',
      formatted_effects_en: ['Increases Physical Attack by 2,665 for 1,800s.'],
      effects: [{ kind: 'atk_flat', element: 'Phy', value: 2665 }],
    };

    expect(compareFoodEffectValues(higher, lower, 'PhyAtk', 'desc')).toBeLessThan(0);
    expect(Math.abs(compareFoodEffectValues(higher, lower, 'PhyDef', 'desc'))).toBe(0);
  });

  it('uses the flat value as the tie-breaker after the percentage', () => {
    const lower = { id: 'lower', atk_percent: 12, atk_flat: 500 };
    const higher = { id: 'higher', atk_percent: 12, atk_flat: 600 };

    expect(compareFoodEffectValues(higher, lower, 'PhyAtk', 'desc')).toBeLessThan(0);
    expect(compareFoodEffectValues(higher, lower, 'PhyAtk', 'asc')).toBeGreaterThan(0);
  });
});
