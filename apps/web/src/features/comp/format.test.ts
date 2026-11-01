import { describe, expect, it } from 'vitest';
import { formatRelicRank, formatStars, parseSlotNumber } from './format';

describe('squad slot badges', () => {
  it('prefixes numbers, keeps custom text and falls back on empty values', () => {
    expect(formatStars(5, 6)).toBe('★5');
    expect(formatStars(' 3 ', 6)).toBe('★3');
    expect(formatStars('★6', 6)).toBe('★6');
    expect(formatStars('max', 6)).toBe('max');
    expect(formatStars('', 6)).toBe('★6');
    expect(formatStars(undefined)).toBe('');
    expect(formatRelicRank(4, 5)).toBe('R4');
    expect(formatRelicRank('R3', 5)).toBe('R3');
    expect(formatRelicRank(null, 5)).toBe('R5');
  });
  it('reads the number of a value', () => {
    expect(parseSlotNumber('12')).toBe(12);
    expect(parseSlotNumber(2)).toBe(2);
    expect(parseSlotNumber('R5')).toBeNull();
  });
});
