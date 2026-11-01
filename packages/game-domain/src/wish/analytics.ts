import type {
  WishRecordDto,
  WishBannerType,
  WishAnalyticsDto,
  WishMatrixSlot,
  WishStreakOutcome,
} from './types';
import { replayPityChain } from './pity-tracker';
import { calculateCashbackSummary } from './cashback';
import { evaluateStreak } from './streak';

export function calculateAnalytics(
  pulls: readonly WishRecordDto[],
  bannerType: WishBannerType,
  options: {
    initialPity?: number;
    initialStreaks?: readonly WishStreakOutcome[];
  } = {}
): WishAnalyticsDto {
  if (pulls.length === 0) {
    return {
      total_pulls: 0,
      total_ssr: 0,
      ssr_rate: 0,
      avg_ssr_interval: 0,
      median_ssr_interval: 0,
      early_ssr_count: 0,
      pity_ssr_count: 0,
      wins_count: 0,
      losses_count: 0,
      neutral_50_50_rate: 0,
      interval_distribution: {},
      cashback_breakdown: {
        base_currency: 0,
        extra_duplicate_currency: 0,
      },
      matrix_distribution: bannerType.includes('matrix')
        ? { mind: 0, memory: 0, belief: 0, emotion: 0 }
        : undefined,
    };
  }

  // Ensure chronological order (oldest first)
  const sortedPulls = [...pulls].sort(
    (a, b) => new Date(a.pull_timestamp).getTime() - new Date(b.pull_timestamp).getTime()
  );

  const pityState = replayPityChain(sortedPulls, bannerType, options);
  const cashback = calculateCashbackSummary(sortedPulls);

  // Interval analytics
  const intervals = pityState.completedIntervals;
  let avgInterval = 0;
  let medianInterval = 0;

  if (intervals.length > 0) {
    const sum = intervals.reduce((acc, v) => acc + v, 0);
    avgInterval = Number((sum / intervals.length).toFixed(1));

    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const mid = Math.floor(sortedIntervals.length / 2);
    medianInterval =
      sortedIntervals.length % 2 !== 0
        ? sortedIntervals[mid]
        : (sortedIntervals[mid - 1] + sortedIntervals[mid]) / 2;
  }

  // Interval distribution histogram (bins of 10: 1-10, 11-20, ..., 71-80)
  const intervalDistribution: Record<string, number> = {};
  for (const interval of intervals) {
    const binStart = Math.floor((interval - 1) / 10) * 10 + 1;
    const binEnd = binStart + 9;
    const binLabel = `${binStart}-${binEnd}`;
    intervalDistribution[binLabel] = (intervalDistribution[binLabel] ?? 0) + 1;
  }

  // 50/50 Analytics: Calculate TRUE win rate on neutral (free) rolls,
  // excluding forced wins (L-L -> W) and forced losses (W-W -> L)
  let winsCount = 0;
  let lossesCount = 0;
  let neutralWins = 0;
  let neutralRollsTotal = 0;

  const currentStreakHistory: WishStreakOutcome[] = options.initialStreaks
    ? [...options.initialStreaks]
    : [];

  for (const pull of sortedPulls) {
    if(pull.rarity===0){currentStreakHistory.length=0;continue;}
    if (pull.rarity === 5) {
      const isFeat = Boolean(pull.is_featured ?? (pull as any).isFeatured);
      const outcome = pull.streak_outcome ?? (pull as any).streakOutcome ?? (isFeat ? 'win' : 'loss');
      if(outcome!=='win'&&outcome!=='loss'){currentStreakHistory.length=0;continue;}
      if (outcome === 'win') winsCount++;
      if (outcome === 'loss') lossesCount++;

      // Check if this roll was forced by prior streak
      const streakEval = evaluateStreak(currentStreakHistory);
      const isForced =
        streakEval.nextPrediction === 'forced_win' || streakEval.nextPrediction === 'forced_loss';

      if (!isForced) {
        neutralRollsTotal++;
        if (outcome === 'win') {
          neutralWins++;
        }
      }

      if (outcome === 'win' || outcome === 'loss') {
        currentStreakHistory.push(outcome);
      }
    }
  }

  const ssrRate = Number(((pityState.totalSsr / sortedPulls.length) * 100).toFixed(2));
  const neutral50_50Rate =
    neutralRollsTotal > 0
      ? Number(((neutralWins / neutralRollsTotal) * 100).toFixed(1))
      : 50.0;

  // Matrix slot distribution
  let matrixDistribution: Record<WishMatrixSlot, number> | undefined;
  if (bannerType.includes('matrix')) {
    matrixDistribution = { mind: 0, memory: 0, belief: 0, emotion: 0 };
    for (const pull of sortedPulls) {
      if (pull.rarity === 5 && pull.slot) {
        matrixDistribution[pull.slot] = (matrixDistribution[pull.slot] ?? 0) + 1;
      }
    }
  }

  return {
    total_pulls: sortedPulls.length,
    total_ssr: pityState.totalSsr,
    ssr_rate: ssrRate,
    avg_ssr_interval: avgInterval,
    median_ssr_interval: medianInterval,
    early_ssr_count: pityState.earlySsrCount,
    pity_ssr_count: pityState.pitySsrCount,
    wins_count: winsCount,
    losses_count: lossesCount,
    neutral_50_50_rate: neutral50_50Rate,
    interval_distribution: intervalDistribution,
    cashback_breakdown: {
      base_currency: cashback.baseCurrency,
      extra_duplicate_currency: cashback.extraDuplicateCurrency,
    },
    matrix_distribution: matrixDistribution,
  };
}
