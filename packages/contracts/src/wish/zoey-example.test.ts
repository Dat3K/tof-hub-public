import { describe, it, expect } from 'vitest';
import {
  ZOEY_WEAPON_PULLS,
  ZOEY_MATRIX_PULLS,
  ZOEY_WEAPON_BANNER,
  ZOEY_MATRIX_BANNER,
  getZoeyWeaponPulls,
  getZoeyMatrixPulls,
  WishRecordDtoSchema,
} from './index';
import { replayPityChain } from '@tof-hub/game-domain';

describe('Zoey example history (sanitized real export)', () => {
  it('covers the full exported history: 98 weapon + 137 matrix pulls', () => {
    expect(ZOEY_WEAPON_PULLS).toHaveLength(98);
    expect(ZOEY_MATRIX_PULLS).toHaveLength(137);
  });

  it('validates every record against WishRecordDtoSchema', () => {
    for (const record of [...ZOEY_WEAPON_PULLS, ...ZOEY_MATRIX_PULLS]) {
      expect(() => WishRecordDtoSchema.parse(record)).not.toThrow();
    }
  });

  it('carries no account data', () => {
    const dump = JSON.stringify({ ZOEY_WEAPON_PULLS, ZOEY_MATRIX_PULLS });
    expect(dump).not.toContain('42945382287671897');
    expect(dump).not.toContain('ht4002');
    for (const record of [...ZOEY_WEAPON_PULLS, ...ZOEY_MATRIX_PULLS]) {
      expect(record).not.toHaveProperty('uid');
      expect(record).not.toHaveProperty('nickname');
    }
  });

  it('stores pulls oldest-first with unique stable ids', () => {
    for (const pulls of [ZOEY_WEAPON_PULLS, ZOEY_MATRIX_PULLS]) {
      const times = pulls.map((p) => Date.parse(p.pull_timestamp));
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
      expect(new Set(pulls.map((p) => p.id)).size).toBe(pulls.length);
    }
  });

  it('keeps pity within banner targets and flags hard pity exactly', () => {
    const cases = [
      { pulls: ZOEY_WEAPON_PULLS, target: ZOEY_WEAPON_BANNER.pity_target },
      { pulls: ZOEY_MATRIX_PULLS, target: ZOEY_MATRIX_BANNER.pity_target },
    ];
    for (const { pulls, target } of cases) {
      let running = 0;
      for (const record of pulls) {
        running += 1;
        expect(record.pity_count).toBe(running);
        expect(record.pity_count).toBeLessThanOrEqual(target);
        expect(record.is_guaranteed_pity).toBe(record.rarity === 5 && running === target);
        // App model (mirrors replayPityChain): reset at the target even
        // without an SSR on it.
        if (running === target) running = 0;
      }
    }
  });

  it('marks featured SSR as wins and off-banner SSR as losses', () => {
    const weaponSsr = ZOEY_WEAPON_PULLS.filter((p) => p.rarity === 5);
    expect(weaponSsr).toHaveLength(5);
    for (const ssr of weaponSsr) {
      const expected = ssr.item_id === 'Zoey_Phy' ? 'win' : 'loss';
      expect(ssr.streak_outcome).toBe(expected);
      expect(ssr.is_featured).toBe(expected === 'win');
    }
    expect(weaponSsr.filter((p) => p.streak_outcome === 'win')).toHaveLength(3);

    const matrixSsr = ZOEY_MATRIX_PULLS.filter((p) => p.rarity === 5);
    expect(matrixSsr).toHaveLength(7);
    for (const ssr of matrixSsr) {
      const expected = ssr.item_id.toLowerCase().startsWith('matrix_ssr70_') ? 'win' : 'loss';
      expect(ssr.streak_outcome).toBe(expected);
      expect(ssr.is_featured).toBe(expected === 'win');
    }
    expect(matrixSsr.filter((p) => p.streak_outcome === 'win')).toHaveLength(4);
  });

  it('assigns a valid matrix slot to every matrix pull', () => {
    for (const record of ZOEY_MATRIX_PULLS) {
      expect(['mind', 'memory', 'belief', 'emotion']).toContain(record.slot);
    }
  });

  it('agrees with the pity replay used by the client', () => {
    const cases = [
      { pulls: ZOEY_WEAPON_PULLS, type: 'weapon_limited' as const, total: 5 },
      { pulls: ZOEY_MATRIX_PULLS, type: 'matrix_limited' as const, total: 7 },
    ];
    for (const { pulls, type, total } of cases) {
      const replayed = replayPityChain(pulls, type);
      expect(replayed.totalSsr).toBe(total);
      // Every replayed SSR feed entry matches the stored row
      // (the replay returns the feed newest-first).
      const storedSsr = pulls.filter((p) => p.rarity === 5).reverse();
      expect(replayed.ssrFeed).toHaveLength(storedSsr.length);
      replayed.ssrFeed.forEach((feed, i) => {
        expect(feed.item_id).toBe(storedSsr[i].item_id);
        expect(feed.pity_at_drop).toBe(storedSsr[i].pity_count);
        expect(feed.is_guaranteed).toBe(storedSsr[i].is_guaranteed_pity);
      });
      const last = pulls[pulls.length - 1];
      const expectedCurrent = last.pity_count === replayed.pityTarget ? 0 : last.pity_count;
      expect(replayed.currentPity).toBe(expectedCurrent);
    }
  });

  it('returns defensive copies from getters', () => {
    const first = getZoeyWeaponPulls();
    expect(first).toHaveLength(98);
    expect(getZoeyMatrixPulls()).toHaveLength(137);
    first[0].item_name = 'MUTATED';
    expect(ZOEY_WEAPON_PULLS[0].item_name).not.toBe('MUTATED');
  });
});
