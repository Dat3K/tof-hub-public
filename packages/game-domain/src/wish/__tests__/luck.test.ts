import { describe, it, expect } from 'vitest';
import {
  calculateDropRateLuck,
  calculateWinRateLuck,
  calculateLuckSummary,
  resolveLuckTier,
  EXPECTED_SSR_RATES,
} from '../luck';
import type { WishRecordDto } from '../types';

function makeMockPull(partial: Partial<WishRecordDto>): WishRecordDto {
  return {
    id: 'p_default',
    profile_id: 'test',
    banner_id: 'weapon-test',
    banner_type: 'weapon_limited',
    item_id: 'item_test',
    item_name: 'Test Item',
    item_type: 'weapon',
    rarity: 3,
    pity_count: 1,
    is_guaranteed_pity: false,
    is_featured: false,
    streak_outcome: null,
    pull_timestamp: '2026-09-01T00:00:00Z',
    item_index: 0,
    group_ticks: '1',
    ...partial,
  };
}

describe('Wish Luck Calculation Engine', () => {
  describe('Constants and Tiers', () => {
    it('uses ToF expected consolidate rates (2% weapon, 4.2% matrix, 50% win rate)', () => {
      expect(EXPECTED_SSR_RATES.WEAPON).toBe(0.02);
      expect(EXPECTED_SSR_RATES.MATRIX).toBe(0.042);
      expect(EXPECTED_SSR_RATES.WIN_RATE_BASELINE).toBe(50.0);
    });

    it('resolves correct luck tiers', () => {
      expect(resolveLuckTier(2.0)).toBe('very_lucky');
      expect(resolveLuckTier(1.6)).toBe('very_lucky');
      expect(resolveLuckTier(1.3)).toBe('lucky');
      expect(resolveLuckTier(1.0)).toBe('expected');
      expect(resolveLuckTier(0.9)).toBe('expected');
      expect(resolveLuckTier(0.7)).toBe('unlucky');
      expect(resolveLuckTier(0.4)).toBe('very_unlucky');
      expect(resolveLuckTier(0.0)).toBe('very_unlucky');
    });
  });

  describe('Drop Rate Luck', () => {
    it('calculates expected SSRs and multipliers for weapon pulls', () => {
      // 100 weapon pulls with 3 SSRs (expected = 2.0 SSRs)
      const mockPulls: WishRecordDto[] = Array.from({ length: 100 }, (_, i) =>
        makeMockPull({
          id: `p_${i}`,
          item_id: i < 3 ? 'ssr_weapon' : 'r_weapon',
          item_name: i < 3 ? 'SSR Weapon' : 'R Weapon',
          rarity: i < 3 ? 5 : 3,
          pity_count: (i % 80) + 1,
          is_featured: true,
          streak_outcome: 'win',
          pull_timestamp: new Date(Date.now() + i * 1000).toISOString(),
          group_ticks: String(i),
        })
      );

      const res = calculateDropRateLuck(mockPulls, 'weapon');
      expect(res.totalPulls).toBe(100);
      expect(res.actualCount).toBe(3);
      expect(res.expectedCount).toBe(2);
      expect(res.actualRate).toBe(3.0);
      expect(res.expectedRate).toBe(2.0);
      expect(res.multiplier).toBe(1.5);
      // Position: 1.5 / 2.0 = 75%
      expect(res.positionPct).toBe(75);
      expect(res.tier).toBe('lucky');
    });

    it('calculates expected SSRs for matrix pulls (4.2% rate)', () => {
      // 100 matrix pulls with 4 SSRs (expected = 4.2 SSRs)
      const mockPulls: WishRecordDto[] = Array.from({ length: 100 }, (_, i) =>
        makeMockPull({
          id: `m_${i}`,
          banner_type: 'matrix_limited',
          item_type: 'matrix',
          item_id: i < 4 ? 'ssr_matrix' : 'r_matrix',
          item_name: i < 4 ? 'SSR Matrix' : 'R Matrix',
          rarity: i < 4 ? 5 : 3,
          pity_count: (i % 40) + 1,
          is_featured: true,
          streak_outcome: 'win',
          pull_timestamp: new Date(Date.now() + i * 1000).toISOString(),
          group_ticks: String(i),
        })
      );

      const res = calculateDropRateLuck(mockPulls, 'matrix');
      expect(res.totalPulls).toBe(100);
      expect(res.actualCount).toBe(4);
      expect(res.expectedCount).toBe(4.2);
      expect(res.actualRate).toBe(4.0);
      expect(res.multiplier).toBe(0.95);
      expect(res.positionPct).toBe(48);
      expect(res.tier).toBe('expected');
    });

    it('handles empty pulls gracefully', () => {
      const res = calculateDropRateLuck([]);
      expect(res.totalPulls).toBe(0);
      expect(res.multiplier).toBe(1.0);
      expect(res.positionPct).toBe(50);
      expect(res.tier).toBe('expected');
    });
  });

  describe('50/50 Win Rate Luck (Matching screenshot 2 behavior)', () => {
    it('yields 2.0x Very Lucky for 1 of 1 wins (100% vs 50% baseline)', () => {
      const mockPulls: WishRecordDto[] = [
        makeMockPull({
          id: 'p_1',
          item_id: 'featured_ssr',
          item_name: 'Featured SSR',
          rarity: 5,
          pity_count: 50,
          is_featured: true,
          streak_outcome: 'win',
        }),
      ];

      const res = calculateWinRateLuck(mockPulls);
      expect(res.winsCount).toBe(1);
      expect(res.totalOutcomes).toBe(1);
      expect(res.actualWinRate).toBe(100.0);
      expect(res.expectedWinRate).toBe(50.0);
      expect(res.multiplier).toBe(2.0);
      // Far right position (100%)
      expect(res.positionPct).toBe(100);
      expect(res.tier).toBe('very_lucky');
    });

    it('yields 1.0x Expected for 1 win and 1 loss (50% vs 50% baseline)', () => {
      const mockPulls: WishRecordDto[] = [
        makeMockPull({
          id: 'p_1',
          item_id: 'featured_ssr',
          item_name: 'Featured SSR',
          rarity: 5,
          pity_count: 50,
          is_featured: true,
          streak_outcome: 'win',
          pull_timestamp: '2026-09-01T00:00:00Z',
        }),
        makeMockPull({
          id: 'p_2',
          item_id: 'standard_ssr',
          item_name: 'Standard SSR',
          rarity: 5,
          pity_count: 30,
          is_featured: false,
          streak_outcome: 'loss',
          pull_timestamp: '2026-09-02T00:00:00Z',
        }),
      ];

      const res = calculateWinRateLuck(mockPulls);
      expect(res.winsCount).toBe(1);
      expect(res.totalOutcomes).toBe(2);
      expect(res.actualWinRate).toBe(50.0);
      expect(res.multiplier).toBe(1.0);
      expect(res.positionPct).toBe(50);
      expect(res.tier).toBe('expected');
    });

    it('yields 0.0x Unlucky for 0 wins and 2 losses', () => {
      const mockPulls: WishRecordDto[] = [
        makeMockPull({
          id: 'p_1',
          item_id: 'std_1',
          item_name: 'Standard SSR 1',
          rarity: 5,
          pity_count: 80,
          is_guaranteed_pity: true,
          is_featured: false,
          streak_outcome: 'loss',
          pull_timestamp: '2026-09-01T00:00:00Z',
        }),
        makeMockPull({
          id: 'p_2',
          item_id: 'std_2',
          item_name: 'Standard SSR 2',
          rarity: 5,
          pity_count: 80,
          is_guaranteed_pity: true,
          is_featured: false,
          streak_outcome: 'loss',
          pull_timestamp: '2026-09-02T00:00:00Z',
        }),
      ];

      const res = calculateWinRateLuck(mockPulls);
      expect(res.winsCount).toBe(0);
      expect(res.totalOutcomes).toBe(2);
      expect(res.actualWinRate).toBe(0.0);
      expect(res.multiplier).toBe(0.0);
      expect(res.positionPct).toBe(0);
      expect(res.tier).toBe('very_unlucky');
    });
  });

  describe('Combined Luck Summary for all banners simultaneously', () => {
    it('aggregates weapon and matrix pulls into unified luck assessment', () => {
      const weaponPulls: WishRecordDto[] = Array.from({ length: 80 }, (_, i) =>
        makeMockPull({
          id: `w_${i}`,
          banner_type: 'weapon_limited',
          item_id: i === 79 ? 'feat_w' : 'r_w',
          item_name: i === 79 ? 'Featured Weapon' : 'R Weapon',
          rarity: i === 79 ? 5 : 3,
          pity_count: i + 1,
          is_guaranteed_pity: i === 79,
          is_featured: true,
          streak_outcome: 'win',
          pull_timestamp: new Date(Date.now() + i * 1000).toISOString(),
          group_ticks: String(i),
        })
      );

      const matrixPulls: WishRecordDto[] = Array.from({ length: 40 }, (_, i) =>
        makeMockPull({
          id: `m_${i}`,
          banner_type: 'matrix_limited',
          item_type: 'matrix',
          item_id: i === 39 ? 'feat_m' : 'r_m',
          item_name: i === 39 ? 'Featured Matrix' : 'R Matrix',
          rarity: i === 39 ? 5 : 3,
          pity_count: i + 1,
          is_guaranteed_pity: i === 39,
          is_featured: true,
          streak_outcome: 'win',
          pull_timestamp: new Date(Date.now() + (100 + i) * 1000).toISOString(),
          group_ticks: String(100 + i),
        })
      );

      const allPulls = [...weaponPulls, ...matrixPulls];
      const summary = calculateLuckSummary(allPulls, 'all');

      expect(summary.scope).toBe('all');
      expect(summary.dropRateLuck.totalPulls).toBe(120);
      expect(summary.dropRateLuck.actualCount).toBe(2); // 1 weapon + 1 matrix
      // Expected: 80 * 0.02 + 40 * 0.042 = 1.6 + 1.68 = 3.28
      expect(summary.dropRateLuck.expectedCount).toBe(3.28);
      expect(summary.winRateLuck.winsCount).toBe(2);
      expect(summary.winRateLuck.totalOutcomes).toBe(2);
      expect(summary.winRateLuck.actualWinRate).toBe(100.0);
      expect(summary.winRateLuck.multiplier).toBe(2.0);
    });
  });
});

describe('Imported history exposure', () => {
  it('does not advertise 50x luck for an unanchored single SSR', () => {
    const pull = makeMockPull({rarity: 5, raw_banner_code: 'WeaponLottery_example', pity_count: -1});
    expect(calculateDropRateLuck([pull])).toMatchObject({multiplier: 1, hasReliableExposure: false});
    expect(calculateLuckSummary([pull]).overallScore).toBe(1);
  });
  it('uses the confirmed 23rd position rather than one imported record', () => {
    const pull = makeMockPull({rarity: 5, raw_banner_code: 'WeaponLottery_example', track_pull_number: 23, pity_count: 23});
    expect(calculateDropRateLuck([pull])).toMatchObject({totalPulls: 23, multiplier: 2.17});
  });
  it('preserves the usual consolidated-rate formula at hard pity', () => {
    const pull = makeMockPull({rarity: 5, raw_banner_code: 'WeaponLottery_example', track_pull_number: 160, pity_count: 80, is_guaranteed_pity: true});
    expect(calculateDropRateLuck([pull])).toMatchObject({totalPulls: 80, multiplier: 0.63});
  });
});
