import { describe, expect, it } from 'vitest';
import { challengeDefenses } from './boss-stats';

const derived = (resist: number, crit: number) => ({formulaLevel: 100, resistK: 1, resistPct: {physical: resist}, finalCritDefPct: crit});
const row = (rowId: string, maxHealth: number, resist = 50) => ({rowId, selection: 'overseas-row', sourcePath: 'x', fields: {MaxHealth: maxHealth}, derived: derived(resist, 8)});
const raid = (stats: ReturnType<typeof row>[]) => ({bosses: [{id: 'Boss_hum_001', stats}]}) as never;

describe('challengeDefenses', () => {
  it('uses the Challenge-suffixed row (_II, _KN, _NM) and ignores Heroic rows', () => {
    for (const suffix of ['_II', '_KN', '_NM']) {
      const result = challengeDefenses(raid([row('Boss_x_8P', 1), row(`Boss_x_8P${suffix}`, 9)]), ['Boss_hum_001']);
      expect(result?.maxHealth).toBe(9);
    }
  });

  it('prefers the boss row over its shadow/element variants', () => {
    const result = challengeDefenses(raid([row('Boss_x_II', 9), row('Boss_x_Shadow_II', 1)]), ['Boss_hum_001']);
    expect(result?.maxHealth).toBe(9);
  });

  it('hides the plate when unsuffixed rows disagree', () => {
    expect(challengeDefenses(raid([row('Boss_x_A', 1), row('Boss_x_B', 2)]), ['Boss_hum_001'])).toBeNull();
    expect(challengeDefenses(raid([row('Boss_x_A', 1), row('Boss_x_B', 1)]), ['Boss_hum_001'])?.maxHealth).toBe(1);
  });
});
