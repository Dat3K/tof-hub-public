import {describe, expect, it} from 'vitest';
import {estimateMmoBygoneDefense, getMmoBygoneHp, getMmoBygoneHpScaling} from './mmo-bygone';

describe('MMO Bygone floor HP', () => {
  it('matches the floor-7 observation model using whole stacks instead of percentages or rounding up', () => {
    const scaling = getMmoBygoneHpScaling(4.2275);
    expect(scaling).toEqual({curveValue: 4.2275, stacks: 4, multiplier: 5});
    expect(getMmoBygoneHp(321101.8, scaling)).toBe(1605509);
    expect(getMmoBygoneHpScaling(1496.9336)?.stacks).toBe(1496);
  });

  it('retains a fractional baseline at zero stacks and leaves unavailable inputs unknown', () => {
    expect(getMmoBygoneHp(120413.17, getMmoBygoneHpScaling(0))).toBe(120413.17);
    for (const curve of [null, undefined, NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) {
      expect(getMmoBygoneHpScaling(curve)).toBeNull();
    }
    for (const hp of [null, undefined, 0, -1, NaN, Infinity]) {
      expect(getMmoBygoneHp(hp, getMmoBygoneHpScaling(4))).toBeNull();
    }
    expect(getMmoBygoneHp(321101.8, null)).toBeNull();
    expect(getMmoBygoneHp(Number.MAX_VALUE, getMmoBygoneHpScaling(4))).toBeNull();
  });
});

describe('MMO Bygone defense estimate', () => {
  it('keeps the assumed model explicit and adds whole stacks to each known baseline', () => {
    const result = estimateMmoBygoneDefense({physical: 1, flame: 2, frost: null, volt: 0}, 11376.15);
    expect(result).toEqual({model: 'base-plus-whole-defense-stacks', verified: false, curveValue: 11376.15, stacks: 11376,
      values: {physical: 11377, flame: 11378, frost: null, volt: 11376, altered: null}});
    expect(estimateMmoBygoneDefense({physical: 1}, 0)?.values.physical).toBe(1);
  });
  it('does not replace missing or invalid inputs with invented defense', () => {
    for (const curve of [null, undefined, -1, NaN, Infinity]) expect(estimateMmoBygoneDefense({physical: 1}, curve)).toBeNull();
    expect(estimateMmoBygoneDefense(null, 1)).toBeNull();
    expect(estimateMmoBygoneDefense({physical: Infinity, flame: -1}, 1)?.values.physical).toBeNull();
    expect(estimateMmoBygoneDefense({physical: 1}, Number.MAX_SAFE_INTEGER)?.values.physical).toBeNull();
  });
});
