import { describe, it, expect } from 'vitest';
import {
  evaluateStreak,
  resolve50_50,
  replayPityChain,
  calculateAnalytics,
  calculateWorstCaseWeapon,
  calculateWorstCaseMatrix,
  runFullSimulation,
  runMonteCarlo,
  createMulberry32,
  BASE_RATES,
} from '../index';
import {
  generateYanmiaoWeaponPulls,
  generateYanmiaoMatrixPulls,
  YANMIAO_WEAPON_BANNER,
  YANMIAO_MATRIX_BANNER,
} from '../fixtures';

describe('Wish Domain Engine', () => {
  describe('Base Rates Sanity Check', () => {
    it('has corrected Matrix SSR rate of 1.7% and SR rate of 7.5%', () => {
      expect(BASE_RATES.MATRIX_SSR).toBe(0.017);
      expect(BASE_RATES.MATRIX_SR).toBe(0.075);
      expect(BASE_RATES.WEAPON_SSR).toBe(0.0075);
      expect(BASE_RATES.WEAPON_SR).toBe(0.01);
    });
  });

  describe('Streak Rule (50/50 State Machine)', () => {
    it('returns unknown when fewer than 2 known outcomes are available', () => {
      expect(evaluateStreak([]).nextPrediction).toBe('unknown');
      expect(evaluateStreak(['win']).nextPrediction).toBe('unknown');
      expect(evaluateStreak(['loss']).nextPrediction).toBe('unknown');
    });

    it('forces LOSS after 2 consecutive wins (Win-Win -> Loss)', () => {
      const res = evaluateStreak(['win', 'win']);
      expect(res.nextPrediction).toBe('forced_loss');
      expect(res.winProbability).toBe(0.0);
      expect(res.streakType).toBe('win_win');
    });

    it('forces WIN after 2 consecutive losses (Loss-Loss -> Win)', () => {
      const res = evaluateStreak(['loss', 'loss']);
      expect(res.nextPrediction).toBe('forced_win');
      expect(res.winProbability).toBe(1.0);
      expect(res.streakType).toBe('loss_loss');
    });

    it('returns neutral 50/50 for mixed history', () => {
      expect(evaluateStreak(['win', 'loss']).nextPrediction).toBe('neutral_50_50');
      expect(evaluateStreak(['loss', 'win']).nextPrediction).toBe('neutral_50_50');
      expect(evaluateStreak(['win', 'win', 'loss']).nextPrediction).toBe('neutral_50_50');
    });

    it('resolves forced rolls deterministically', () => {
      const forcedLossRes = resolve50_50(['win', 'win'], () => 0.01);
      expect(forcedLossRes.isWin).toBe(false);
      expect(forcedLossRes.isForced).toBe(true);

      const forcedWinRes = resolve50_50(['loss', 'loss'], () => 0.99);
      expect(forcedWinRes.isWin).toBe(true);
      expect(forcedWinRes.isForced).toBe(true);
    });
  });

  describe('Pity Tracking & Non-Resetting Hard Pity', () => {
    it('verifies Yanmiao 248 pull fixture with early SSR and non-resetting 80 hard pity', () => {
      const weaponPulls = generateYanmiaoWeaponPulls();
      expect(weaponPulls.length).toBe(248);

      const state = replayPityChain(weaponPulls, 'weapon_limited', {
        initialStreaks: ['loss', 'win'],
      });

      expect(state.totalPulls).toBe(248);
      expect(state.totalSsr).toBe(5);
      expect(state.earlySsrCount).toBe(2); // at 23, 137
      expect(state.pitySsrCount).toBe(3);  // at 80, 160, 240
      expect(state.currentPity).toBe(8);   // 248 - 240 = 8
      expect(state.pullsToGuarantee).toBe(72);

      // Completed intervals: [23, 57, 57, 23, 80]
      expect(state.completedIntervals).toEqual([23, 57, 57, 23, 80]);
      expect(state.currentIncompleteInterval).toBe(8);

      // Streaks: initial [loss, win] + [win, loss, loss, win, loss]
      expect(state.streaks.slice(2)).toEqual(['win', 'loss', 'loss', 'win', 'loss']);
    });

    it('verifies Yanmiao 120 matrix pull fixture with 40 hard pity and 4 slots', () => {
      const matrixPulls = generateYanmiaoMatrixPulls();
      expect(matrixPulls.length).toBe(120);

      const state = replayPityChain(matrixPulls, 'matrix_limited');
      expect(state.totalPulls).toBe(120);
      expect(state.totalSsr).toBe(4);
      expect(state.pitySsrCount).toBe(3); // at 40, 80, 120
      expect(state.earlySsrCount).toBe(1); // at 72
      expect(state.currentPity).toBe(0); // 120 is hard pity, resets to 0
      expect(state.pullsToGuarantee).toBe(40);
    });
  });

  describe('Personal Analytics', () => {
    it('calculates average, median, and true 50/50 win rate excluding forced rolls', () => {
      const weaponPulls = generateYanmiaoWeaponPulls();
      const analytics = calculateAnalytics(weaponPulls, YANMIAO_WEAPON_BANNER.banner_type, {
        initialStreaks: ['loss', 'win'],
      });

      expect(analytics.total_pulls).toBe(248);
      expect(analytics.total_ssr).toBe(5);
      expect(analytics.avg_ssr_interval).toBe(48.0); // (23+57+57+23+80)/5 = 240/5 = 48
      expect(analytics.median_ssr_interval).toBe(57);

      // 5 SSRs total: 2 wins, 3 losses
      expect(analytics.wins_count).toBe(2);
      expect(analytics.losses_count).toBe(3);

      // Base currency: 248 pulls = 248 base
      expect(analytics.cashback_breakdown.base_currency).toBe(248);
      // Extra: 21 SRs (multiples of 10 excluding 80, 160, 240 SSRs) * 1 + 3 SSR losses * 10 = 21 + 30 = 51
      expect(analytics.cashback_breakdown.extra_duplicate_currency).toBe(51);
    });

    it('handles empty history safely without division by zero or NaN', () => {
      const analytics = calculateAnalytics([], 'weapon_limited');
      expect(analytics.total_pulls).toBe(0);
      expect(analytics.total_ssr).toBe(0);
      expect(analytics.ssr_rate).toBe(0);
      expect(analytics.avg_ssr_interval).toBe(0);
      expect(analytics.median_ssr_interval).toBe(0);
      expect(analytics.neutral_50_50_rate).toBe(0);
      expect(Number.isNaN(analytics.avg_ssr_interval)).toBe(false);
      expect(Number.isNaN(analytics.neutral_50_50_rate)).toBe(false);
    });

    it('handles partial history with unknown starting state correctly', () => {
      const pulls = generateYanmiaoWeaponPulls().slice(0, 35); // 35 pulls, SSR at 23
      const analytics = calculateAnalytics(pulls, 'weapon_limited', { initialPity: 10 });
      expect(analytics.total_pulls).toBe(35);
      expect(analytics.total_ssr).toBe(1);
      // Completed intervals has the first SSR at 23, and current incomplete interval is 12 (35 - 23)
      expect(analytics.avg_ssr_interval).toBe(23);
    });

  });

  describe('Simulation & Worst-Case Logic', () => {
    it('calculates worst-case weapon pulls for A6 (7 copies total)', () => {
      const res = calculateWorstCaseWeapon({
        targetCopies: 7,
        currentCopies: 0,
        currentPity: 0,
        initialFlameGold: 0,
      });

      expect(res.featuredCopies).toBeGreaterThanOrEqual(7);
      expect(res.totalPulls).toBeGreaterThan(0);
      expect(res.copiesFromShop).toBeGreaterThan(0);
    });

    it('deducts 50 Flame Gold when reserve50ForBox is enabled', () => {
      const res = calculateWorstCaseWeapon({
        targetCopies: 1,
        currentCopies: 0,
        currentPity: 79, // will drop on 1 pull
        initialFlameGold: 60,
        reserve50ForBox: true,
      });

      expect(res.flameGoldSpent).toBeGreaterThanOrEqual(50);
    });

    it('calculates worst-case matrix pulls for 4-pc 3★ (16 pieces) respecting 50/50 losses', () => {
      const res = calculateWorstCaseMatrix({
        targetCopiesPerSlot: 4,
        autoBlock: true,
      });

      expect(res.finalInventory.mind).toBeGreaterThanOrEqual(4);
      expect(res.finalInventory.memory).toBeGreaterThanOrEqual(4);
      expect(res.finalInventory.belief).toBeGreaterThanOrEqual(4);
      expect(res.finalInventory.emotion).toBeGreaterThanOrEqual(4);
      // In worst case with 50/50 losses, shop redemption provides significant pieces
      expect(res.piecesFromShop).toBeGreaterThan(0);
    });

    it('auto-blocks an R0 matrix slot after its first copy', () => {
      const config = {
        mode: 'matrix' as const,
        targetWeaponAdvancement: 0,
        targetMatrixCopiesPerSlot: 1,
        currentWeaponCopies: 0,
        currentMatrixCopies: { mind: 1, memory: 0, belief: 0, emotion: 0 },
        currentWeaponPity: 0,
        currentMatrixPity: 0,
        recentWeaponStreaks: [],
        recentMatrixStreaks: [],
        initialFlameGold: 0,
        initialOverclockingChips: 0,
        bought50Box: false,
        blockedSlot: null,
        srMaxed: true,
        standardSsrMaxed: true,
        trials: 2000,
        seed: 107,
      };

      const withBlock = runMonteCarlo({ ...config, autoBlock: true });
      const withoutBlock = runMonteCarlo({ ...config, autoBlock: false });
      expect(withBlock.meanPulls).toBeLessThan(withoutBlock.meanPulls);
    });


    it('runs deterministic simulation with Mulberry32 PRNG reproducibly', () => {
      const rng1 = createMulberry32(42);
      const val1 = [rng1(), rng1(), rng1()];

      const rng2 = createMulberry32(42);
      const val2 = [rng2(), rng2(), rng2()];

      expect(val1).toEqual(val2);
    });

    it('runs full simulation configuration and returns complete result shape', () => {
      const sim = runFullSimulation({
        mode: 'weapon',
        targetWeaponAdvancement: 0, // 1 copy needed
        targetMatrixCopiesPerSlot: 1,
        currentWeaponCopies: 0,
        currentMatrixCopies: { mind: 0, memory: 0, belief: 0, emotion: 0 },
        currentWeaponPity: 0,
        currentMatrixPity: 0,
        recentWeaponStreaks: [],
        recentMatrixStreaks: [],
        initialFlameGold: 0,
        initialOverclockingChips: 0,
        bought50Box: false,
        blockedSlot: null,
        autoBlock: true,
        srMaxed: true,
        standardSsrMaxed: true,
        trials: 200,
        seed: 999,
      });

      expect(sim.worstCase.totalPulls).toBeGreaterThan(0);
      expect(sim.zeroExtraDeterministic.totalPulls).toBeGreaterThan(0);
      expect(sim.monteCarlo.trials).toBe(200);
      expect(sim.monteCarlo.percentiles.p1).toBeLessThanOrEqual(sim.monteCarlo.percentiles.p10);
      expect(sim.monteCarlo.percentiles.p10).toBeLessThanOrEqual(sim.monteCarlo.percentiles.p25);
      expect(sim.monteCarlo.percentiles.p25).toBeLessThanOrEqual(sim.monteCarlo.percentiles.p50);
      expect(sim.monteCarlo.percentiles.p50).toBeLessThanOrEqual(sim.monteCarlo.percentiles.p90);
      expect(sim.monteCarlo.percentiles.p90).toBeLessThanOrEqual(sim.monteCarlo.percentiles.p95);
      expect(sim.monteCarlo.percentiles.p95).toBeLessThanOrEqual(sim.monteCarlo.percentiles.p99);
    });
  });

  describe('Multi-Banner Shared Pity & Category Mechanics', () => {
    it('shares the 80-pity counter between concurrent limited weapon banners (active + rerun)', () => {
      // 50 pulls on active banner (weapon-zoey)
      const zoeyPulls = Array.from({ length: 50 }, (_, i) => ({
        id: `zoey_${i + 1}`,
        profile_id: 'test',
        banner_id: 'weapon-zoey',
        banner_type: 'weapon_limited' as const,
        item_id: 'bow_fire',
        item_name: 'Composite Bow',
        item_type: 'weapon' as const,
        rarity: 3,
        pity_count: i + 1,
        is_guaranteed_pity: false,
        is_featured: false,
        pull_timestamp: new Date(1700000000000 + (i + 1) * 1000).toISOString(),
      }));

      // Followed by 35 pulls on parallel rerun banner (weapon-saki-rerun)
      const rerunPulls = Array.from({ length: 35 }, (_, i) => ({
        id: `rerun_${i + 1}`,
        profile_id: 'test',
        banner_id: 'weapon-saki-rerun',
        banner_type: 'weapon_limited' as const,
        item_id: i === 29 ? 'katana_ice' : 'bow_fire', // SSR at pull 30 of rerun (pull 80 globally!)
        item_name: i === 29 ? 'Heartstream' : 'Composite Bow',
        item_type: 'weapon' as const,
        rarity: i === 29 ? 5 : 3,
        pity_count: 50 + i + 1,
        is_guaranteed_pity: i === 29, // global pull 80!
        is_featured: i === 29,
        streak_outcome: (i === 29 ? 'win' : null) as 'win' | null,
        pull_timestamp: new Date(1700000000000 + (50 + i + 1) * 1000).toISOString(),
      }));

      const combinedPulls = [...zoeyPulls, ...rerunPulls];
      const state = replayPityChain(combinedPulls, 'weapon_limited');

      expect(state.totalPulls).toBe(85);
      expect(state.pitySsrCount).toBe(1);
      expect(state.currentPity).toBe(5); // 85 - 80 = 5
      expect(state.pullsToGuarantee).toBe(75);
      expect(state.streaks).toEqual(['win']);
    });

    it('tracks standard weapon banner with 80-pity counter but no 50/50 win/loss streaks', () => {
      const stdPulls = Array.from({ length: 90 }, (_, i) => ({
        id: `std_${i + 1}`,
        profile_id: 'test',
        banner_id: 'weapon-standard',
        banner_type: 'standard_weapon' as const,
        item_id: i === 79 ? 'dual_pistol' : 'bow_fire',
        item_name: i === 79 ? 'Dual EM Stars' : 'Composite Bow',
        item_type: 'weapon' as const,
        rarity: i === 79 ? 5 : 3,
        pity_count: (i % 80) + 1,
        is_guaranteed_pity: i === 79,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: new Date(1700000000000 + (i + 1) * 1000).toISOString(),
      }));

      const state = replayPityChain(stdPulls, 'standard_weapon');

      expect(state.totalPulls).toBe(90);
      expect(state.pityTarget).toBe(80);
      expect(state.currentPity).toBe(10);
      expect(state.pullsToGuarantee).toBe(70);
      expect(state.pitySsrCount).toBe(1);
      // Standard banners do not populate 50/50 streaks
      expect(state.streaks).toEqual([]);
    });

    it('tracks black nucleus banner with 0 pity target and no hard pity resets', () => {
      const bnPulls = Array.from({ length: 100 }, (_, i) => ({
        id: `bn_${i + 1}`,
        profile_id: 'test',
        banner_id: 'weapon-black-nucleus',
        banner_type: 'black_nucleus' as const,
        item_id: i === 50 ? 'dual_pistol' : 'bow_fire',
        item_name: i === 50 ? 'Dual EM Stars' : 'Composite Bow',
        item_type: 'weapon' as const,
        rarity: i === 50 ? 5 : 3,
        pity_count: i + 1,
        is_guaranteed_pity: false,
        is_featured: false,
        pull_timestamp: new Date(1700000000000 + (i + 1) * 1000).toISOString(),
      }));

      const state = replayPityChain(bnPulls, 'black_nucleus');

      expect(state.totalPulls).toBe(100);
      expect(state.pityTarget).toBe(0);
      expect(state.pullsToGuarantee).toBe(0);
      expect(state.currentPity).toBe(0);
      expect(state.totalSsr).toBe(1);
      expect(state.earlySsrCount).toBe(1);
      expect(state.pitySsrCount).toBe(0);
      expect(state.streaks).toEqual([]);
      expect(state.completedIntervals).toEqual([51]);
      expect(state.currentIncompleteInterval).toBe(49);
    });
  });
});

describe('Imported pity anchors', () => {
  it('shows the current game bar without requiring any history records', () => {
    expect(replayPityChain([], 'matrix_limited', { currentPity: 31 })).toMatchObject({ currentPity: 31, pullsToGuarantee: 9, totalPulls: 0, totalSsr: 0 });
    expect(replayPityChain([], 'weapon_limited', { currentPity: 0 })).toMatchObject({ currentPity: 0, pullsToGuarantee: 80 });
  });
  const example = generateYanmiaoWeaponPulls().slice(0, 2);
  it('does not infer a zero origin for a fragment', () => {
    const state = replayPityChain(example.map(pull => ({...pull, raw_banner_code: 'WeaponLottery_example', pity_count: -1})), 'weapon_limited');
    expect(state.currentPity).toBe(-1);
    expect(state.pullsToGuarantee).toBe(-1);
  });
  it('preserves the 41st pull and a gap without resetting on an early SSR', () => {
    const pulls = example.map((pull, i) => ({...pull, raw_banner_code: 'WeaponLottery_example', track_pull_number: i ? 49 : 41, rarity: i ? 3 : 5}));
    expect(replayPityChain(pulls, 'weapon_limited').currentPity).toBe(49);
    expect(replayPityChain(pulls, 'weapon_limited').ssrFeed[0].pity_at_drop).toBe(41);
  });
});
