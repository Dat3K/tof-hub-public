import { afterEach, describe, expect, it, vi } from 'vitest';
import { RankingResponseCache } from './response-cache';
import type { GearTopEntry, RankingResponse } from './types';

const response = (length: number) => ({ available: true, entries: Array.from({ length }, (_, rank) => ({ rank })) }) as RankingResponse<GearTopEntry>;
afterEach(() => vi.useRealTimers());
describe('Ranking tab response retention', () => {
  it('budgets rows across boards and evicts the least recently viewed board', () => {
    const cache = new RankingResponseCache();
    const a = response(200), b = response(200), c = response(200);
    cache.set('a', a); cache.set('b', b); cache.set('c', c);
    expect(cache.get('a')).toBe(a);
    cache.set('d', response(200));
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toBe(a);
    cache.set('a', response(601));
    expect(cache.get('a')).toBeNull();
  });
  it('expires untouched boards on other cache activity without extending TTL on pagination', () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const cache = new RankingResponseCache();
    cache.set('a', response(100));
    vi.setSystemTime(30_000); cache.set('a', response(200));
    vi.setSystemTime(60_000); cache.set('b', response(1));
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).not.toBeNull();
    cache.clear(); expect(cache.get('b')).toBeNull();
  });
});
