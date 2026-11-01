import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const inclusion: (weights: number[], slots: number) => number[] | null = require('../../scripts/lib/weighted-stat-inclusion.cjs');

describe('weighted whole-item stat model', () => {
  it('selects equally weighted unique stats with k/n marginal probability', () => {
    for (const probability of inclusion([1, 1, 1, 1, 1], 4)!) expect(probability).toBeCloseTo(0.8, 12);
  });
  it('matches exact unequal-weight enumeration', () => {
    const result = inclusion([1, 2, 3], 2)!;
    expect(result[0]).toBeCloseTo(5 / 12, 12);
    expect(result[1]).toBeCloseTo(11 / 15, 12);
    expect(result[2]).toBeCloseTo(17 / 20, 12);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(2, 12);
  });
  it('reserves guaranteed slots and never selects zero weights', () => {
    expect(inclusion([-1, 1, 1, 0], 2)).toEqual([1, 0.5, 0.5, 0]);
    expect(inclusion([-1, -1, -1, 2, 3], 4)).toEqual([1, 1, 1, 0.4, 0.6]);
    expect(inclusion([-1, 2], 1)).toEqual([1, 0]);
  });
  it('returns unavailable for impossible counts or unsupported negative weights', () => {
    expect(inclusion([-1, -1], 1)).toBeNull();
    expect(inclusion([1, 2], 4)).toBeNull();
    expect(inclusion([-2, 1], 1)).toBeNull();
  });
});
