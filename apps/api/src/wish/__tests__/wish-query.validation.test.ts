import { describe, expect, it } from 'vitest';
import {
  __resetExportRateLimitForTests,
  assertExportRateLimit,
  assertJobId,
  assertReadableProfileId,
  MAX_PULLS_LIMIT,
  parseAnalyticsQuery,
  parsePullsQuery,
} from '../wish-query.validation';

describe('wish-query.validation', () => {
  it('accepts demo aliases and server-issued import ids only', () => {
    expect(() => assertReadableProfileId('demo')).not.toThrow();
    expect(() => assertReadableProfileId('demo-user-profile')).not.toThrow();
    expect(() => assertReadableProfileId('import-0123456789abcdef0123456789abcdef')).not.toThrow();
    expect(() => assertReadableProfileId('import-xyz')).toThrow();
    expect(() => assertReadableProfileId('../../etc/passwd')).toThrow();
    expect(() => assertReadableProfileId('demo-user-profile/../x')).toThrow();
    expect(() => assertReadableProfileId('')).toThrow();
  });

  it('rejects malformed job ids', () => {
    expect(() => assertJobId('123e4567-e89b-12d3-a456-426614174000')).not.toThrow();
    expect(() => assertJobId('not-a-job')).toThrow();
    expect(() => assertJobId('../../etc')).toThrow();
  });

  it('parses pulls query with allowlists and clamps limit', () => {
    expect(parsePullsQuery({})).toMatchObject({ limit: 50 });
    expect(parsePullsQuery({ limit: '20' }).limit).toBe(20);
    expect(parsePullsQuery({ limit: '100000' }).limit).toBe(MAX_PULLS_LIMIT);
    expect(() => parsePullsQuery({ limit: 'abc' })).toThrow();
    expect(() => parsePullsQuery({ limit: 'NaN' })).toThrow();
    expect(() => parsePullsQuery({ rarity: 'abc' })).toThrow();
    expect(() => parsePullsQuery({ rarity: '2' })).toThrow();
    expect(parsePullsQuery({ rarity: '5' }).rarity).toBe(5);
    expect(() => parsePullsQuery({ bannerType: 'weapon' })).toThrow();
    expect(parsePullsQuery({ bannerType: 'black_nucleus' }).bannerType).toBe('black_nucleus');
    expect(() => parsePullsQuery({ streakOutcome: 'maybe' })).toThrow();
    expect(() => parsePullsQuery({ slot: 'head' })).toThrow();
    expect(() => parsePullsQuery({ bannerId: '../escape' })).toThrow();
    expect(() => parsePullsQuery({ cursor: 'x'.repeat(513) })).toThrow();
  });

  it('parses analytics query with a default track', () => {
    expect(parseAnalyticsQuery({})).toEqual({ bannerType: 'weapon_limited', bannerId: undefined });
    expect(() => parseAnalyticsQuery({ bannerType: 'standard_weapon' })).toThrow();
    expect(() => parseAnalyticsQuery({ bannerId: '../x' })).toThrow();
  });

  it('throttles export bursts per IP', () => {
    __resetExportRateLimitForTests();
    for (let i = 0; i < 30; i++) assertExportRateLimit('192.0.2.99');
    expect(() => assertExportRateLimit('192.0.2.99')).toThrow();
    expect(() => assertExportRateLimit('192.0.2.100')).not.toThrow();
    __resetExportRateLimitForTests();
  });
});
