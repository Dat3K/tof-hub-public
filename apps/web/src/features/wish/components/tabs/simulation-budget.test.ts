import { describe, it, expect } from 'vitest';
import { estimateBudgetSuccessLabel } from './simulation-tab';

const LADDER = {
  p1: 50,
  p10: 120,
  p25: 200,
  p50: 320,
  p75: 430,
  p90: 520,
  p95: 580,
  p99: 700,
};

describe('estimateBudgetSuccessLabel', () => {
  it('returns exact ladder points', () => {
    expect(estimateBudgetSuccessLabel(320, LADDER)).toBe('50%');
    expect(estimateBudgetSuccessLabel(200, LADDER)).toBe('25%');
    expect(estimateBudgetSuccessLabel(700, LADDER)).toBe('99%');
  });

  it('interpolates between ladder points', () => {
    // Midpoint between P25 (200) and P50 (320) -> ~38%.
    expect(estimateBudgetSuccessLabel(260, LADDER)).toBe('38%');
  });

  it('clamps outside the ladder range', () => {
    expect(estimateBudgetSuccessLabel(10, LADDER)).toBe('< 1%');
    expect(estimateBudgetSuccessLabel(1000, LADDER)).toBe('≥ 99%');
  });

  it('handles non-positive budgets', () => {
    expect(estimateBudgetSuccessLabel(0, LADDER)).toBe('0%');
    expect(estimateBudgetSuccessLabel(-5, LADDER)).toBe('0%');
  });

  it('handles flat ladder segments without NaN', () => {
    const flat = { ...LADDER, p10: 120, p25: 120 };
    expect(estimateBudgetSuccessLabel(120, flat)).toBe('10%');
    expect(estimateBudgetSuccessLabel(119, flat)).toMatch(/^\d+%$/);
  });
});
