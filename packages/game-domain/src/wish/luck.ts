import type {
  WishRecordDto,
  WishLuckMetric,
  WishWinRateLuckMetric,
  WishLuckSummary,
  WishLuckTier,
  WishStreakOutcome,
  WishLuckScope,
} from './types';
import { evaluateStreak } from './streak';

/**
 * Expected consolidated SSR rate incorporating non-resetting hard pity (80/40)
 * and base drop probabilities (0.75% weapon / 1.70% matrix).
 *
 * Weapon: 1 guarantee + 80 * 0.0075 early drops = 1.60 SSR / 80 pulls = 2.00%
 * Matrix: 1 guarantee + 40 * 0.017 early drops = 1.68 SSR / 40 pulls = 4.20%
 */
export const EXPECTED_SSR_RATES = Object.freeze({
  WEAPON: 0.02, // 2.00% (1 SSR per 50 pulls)
  MATRIX: 0.042, // 4.20% (1 SSR per ~23.8 pulls)
  WIN_RATE_BASELINE: 50.0, // 50.0% classic 50/50 baseline
});

export function resolveLuckTier(multiplier: number, hasData: boolean = true): WishLuckTier {
  if (!hasData) return 'expected';
  if (multiplier >= 1.6) return 'very_lucky';
  if (multiplier >= 1.15) return 'lucky';
  if (multiplier >= 0.85) return 'expected';
  if (multiplier >= 0.5) return 'unlucky';
  return 'very_unlucky';
}

export function calculateDropRateLuck(
  pulls: readonly WishRecordDto[],
  scope: WishLuckScope = 'all'
): WishLuckMetric {
  const filtered = pulls.filter((p) => {
    if (scope === 'current') return true;
    if (scope === 'event') return p.banner_type === 'weapon_limited' || p.banner_type === 'matrix_limited';
    if (scope === 'standard') return p.banner_type === 'standard_weapon' || p.banner_type === 'standard_matrix';
    if (scope === 'black_nucleus') return p.banner_type === 'black_nucleus';
    if (scope === 'weapon') return !p.banner_type.includes('matrix');
    if (scope === 'matrix') return p.banner_type.includes('matrix');
    return true;
  });

  const hasReliableExposure = filtered.every((pull) => pull.rarity!==0&&(!pull.raw_banner_code || pull.track_pull_number !== undefined));
  let totalPulls = filtered.length;
  const exposures = new Map<WishRecordDto["banner_type"], number>();
  // A fragment may start at pull 23 or contain holes. Count the observed span,
  // while leaving missing outcomes out of actualCount and the history grid.
  if (hasReliableExposure && filtered.some((pull) => pull.track_pull_number !== undefined)) {
    totalPulls = 0;
    for (const type of new Set(filtered.map((pull) => pull.banner_type))) {
      const track = filtered.filter((pull) => pull.banner_type === type);
      const numbers = track.map((pull) => pull.track_pull_number).filter((number): number is number => number !== undefined);
      const target = type === 'black_nucleus' ? 0 : type.includes('matrix') ? 40 : 80;
      const exposure = numbers.length === track.length
        ? Math.max(...numbers) - Math.min(...numbers) + (target ? (Math.min(...numbers) - 1) % target + 1 : 1)
        : track.length;
      totalPulls += exposure;
      exposures.set(type, exposure);
    }
  }
  if (totalPulls === 0) {
    const expectedRate =
      scope === 'black_nucleus'
        ? 0.3
        : scope === 'matrix'
        ? 4.2
        : 2.0;
    return {
      actualCount: 0,
      expectedCount: 0,
      actualRate: 0,
      expectedRate,
      multiplier: 1.0,
      positionPct: 50,
      tier: 'expected',
      totalPulls: 0,
    };
  }

  let expectedCount = 0;
  let actualCount = 0;

  for (const pull of filtered) {
    const isBlack = pull.banner_type === 'black_nucleus';
    const isMatrix = pull.banner_type.includes('matrix');
    expectedCount += isBlack ? 0.003 : isMatrix ? EXPECTED_SSR_RATES.MATRIX : EXPECTED_SSR_RATES.WEAPON;
    if (pull.rarity === 5) {
      actualCount += 1;
    }
  }

  if (!hasReliableExposure) {
    return { actualCount, expectedCount: 0, actualRate: 0, expectedRate: 0,
      multiplier: 1, positionPct: 50, tier: 'expected', totalPulls, hasReliableExposure: false };
  }
  if (totalPulls !== filtered.length) {
    for (const [type, exposure] of exposures) {
      const recorded = filtered.filter(pull => pull.banner_type === type).length;
      const rate = type === 'black_nucleus' ? 0.003 : type.includes('matrix') ? EXPECTED_SSR_RATES.MATRIX : EXPECTED_SSR_RATES.WEAPON;
      expectedCount += (exposure - recorded) * rate;
    }
  }
  expectedCount = Number(expectedCount.toFixed(3));
  const actualRate = Number(((actualCount / totalPulls) * 100).toFixed(2));
  const expectedRate = Number(((expectedCount / totalPulls) * 100).toFixed(2));

  const multiplier = expectedCount > 0
    ? Number((actualCount / expectedCount).toFixed(2))
    : 1.0;

  // Scale: 0.0x = 0%, 1.0x (Expected) = 50%, 2.0x (Very Lucky) = 100%
  const positionPct = Math.min(100, Math.max(0, Math.round((multiplier / 2.0) * 100)));
  const tier = resolveLuckTier(multiplier, actualCount > 0 || totalPulls >= 20);

  return {
    hasReliableExposure,
    actualCount,
    expectedCount,
    actualRate,
    expectedRate,
    multiplier,
    positionPct,
    tier,
    totalPulls,
  };
}

export function calculateWinRateLuck(
  pulls: readonly WishRecordDto[],
  scope: WishLuckScope = 'all'
): WishWinRateLuckMetric {
  if (scope === 'standard' || scope === 'black_nucleus') {
    return {
      winsCount: 0,
      totalOutcomes: 0,
      actualWinRate: 50.0,
      expectedWinRate: EXPECTED_SSR_RATES.WIN_RATE_BASELINE,
      multiplier: 1.0,
      positionPct: 50,
      tier: 'expected',
      neutralWins: 0,
      neutralTotal: 0,
    };
  }

  const filtered = pulls.filter((p) => {
    // 50/50 outcomes only apply to limited banners
    if (p.banner_type !== 'weapon_limited' && p.banner_type !== 'matrix_limited') {
      return false;
    }
    if (scope === 'current') return true;
    if (scope === 'event') return true;
    if (scope === 'weapon') return !p.banner_type.includes('matrix');
    if (scope === 'matrix') return p.banner_type.includes('matrix');
    return true;
  });

  // Sort chronological for streak tracking
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.pull_timestamp).getTime() - new Date(b.pull_timestamp).getTime()
  );

  let winsCount = 0;
  let lossesCount = 0;
  let neutralWins = 0;
  let neutralTotal = 0;
  const streakHistory: WishStreakOutcome[] = [];

  for (const pull of sorted) {
    if(pull.rarity===0){streakHistory.length=0;continue;}
    if (pull.rarity === 5) {
      const isFeat = Boolean(pull.is_featured ?? (pull as any).isFeatured);
      const outcome = pull.streak_outcome ?? (pull as any).streakOutcome ?? (isFeat ? 'win' : 'loss');
      if (outcome !== 'win' && outcome !== 'loss') {streakHistory.length=0;continue;}

      if (outcome === 'win') winsCount++;
      if (outcome === 'loss') lossesCount++;

      // Check if roll was forced by Markov streak rule
      const evalStreak = evaluateStreak(streakHistory);
      const isForced = evalStreak.nextPrediction === 'forced_win' || evalStreak.nextPrediction === 'forced_loss';
      if (!isForced) {
        neutralTotal++;
        if (outcome === 'win') neutralWins++;
      }

      if (outcome === 'win' || outcome === 'loss') {
        streakHistory.push(outcome);
      }
    }
  }

  const totalOutcomes = winsCount + lossesCount;

  if (totalOutcomes === 0) {
    return {
      winsCount: 0,
      totalOutcomes: 0,
      actualWinRate: 50.0,
      expectedWinRate: EXPECTED_SSR_RATES.WIN_RATE_BASELINE,
      multiplier: 1.0,
      positionPct: 50,
      tier: 'expected',
      neutralWins: 0,
      neutralTotal: 0,
    };
  }

  const actualWinRate = Number(((winsCount / totalOutcomes) * 100).toFixed(1));
  const expectedWinRate = EXPECTED_SSR_RATES.WIN_RATE_BASELINE;

  // Multiplier relative to 50%: 100% win rate = 2.0x, 50% = 1.0x, 0% = 0.0x
  const multiplier = Number((actualWinRate / expectedWinRate).toFixed(2));
  const positionPct = Math.min(100, Math.max(0, Math.round((multiplier / 2.0) * 100)));
  const tier = resolveLuckTier(multiplier, true);

  return {
    winsCount,
    totalOutcomes,
    actualWinRate,
    expectedWinRate,
    multiplier,
    positionPct,
    tier,
    neutralWins,
    neutralTotal,
  };
}

export function calculateLuckSummary(
  allPulls: readonly WishRecordDto[],
  scope: WishLuckScope = 'all'
): WishLuckSummary {
  const dropRateLuck = calculateDropRateLuck(allPulls, scope);
  const winRateLuck = calculateWinRateLuck(allPulls, scope);

  let overallScore = 1.0;
  if (scope === 'standard' || scope === 'black_nucleus' || winRateLuck.totalOutcomes === 0) {
    overallScore = dropRateLuck.multiplier;
  } else if (dropRateLuck.totalPulls > 0 && winRateLuck.totalOutcomes > 0) {
    overallScore = Number(((dropRateLuck.multiplier * 0.5 + winRateLuck.multiplier * 0.5)).toFixed(2));
  } else if (dropRateLuck.totalPulls > 0) {
    overallScore = dropRateLuck.multiplier;
  } else if (winRateLuck.totalOutcomes > 0) {
    overallScore = winRateLuck.multiplier;
  }

  if (dropRateLuck.hasReliableExposure === false) overallScore = 1;

  const hasData = dropRateLuck.totalPulls > 0 || (scope !== 'standard' && scope !== 'black_nucleus' && winRateLuck.totalOutcomes > 0);
  const overallTier = resolveLuckTier(overallScore, hasData);

  return {
    scope,
    dropRateLuck,
    winRateLuck,
    overallScore,
    overallTier,
  };
}
