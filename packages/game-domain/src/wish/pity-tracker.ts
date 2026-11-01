import type {
  WishRecordDto,
  WishBannerType,
  WishStreakOutcome,
  WishSsrFeedItem,
  WishMatrixSlot,
} from './types';
import { PITY_MAX_WEAPON, PITY_MAX_MATRIX } from './constants';
import { evaluateStreak } from './streak';

export interface ProcessedPityState {
  totalPulls: number;
  currentPity: number;
  pityTarget: number;
  pullsToGuarantee: number;
  totalSsr: number;
  earlySsrCount: number;
  pitySsrCount: number;
  completedIntervals: number[];
  currentIncompleteInterval: number;
  streaks: WishStreakOutcome[];
  ssrFeed: WishSsrFeedItem[];
}

/**
 * Replays and validates the pity chain for a list of pulls sorted in chronological order (oldest first).
 */
export function replayPityChain(
  pulls: readonly WishRecordDto[],
  bannerType: WishBannerType,
  options: {
    initialPity?: number;
    currentPity?: number;
    initialStreaks?: readonly WishStreakOutcome[];
  } = {}
): ProcessedPityState {
  const isBlackNucleus = bannerType === 'black_nucleus';
  const isStandard = bannerType === 'standard_weapon' || bannerType === 'standard_matrix';
  const pityTarget = isBlackNucleus
    ? 0
    : bannerType.includes('matrix')
    ? PITY_MAX_MATRIX
    : PITY_MAX_WEAPON;

  let currentPity = pityTarget > 0 ? Math.max(0, Math.min(pityTarget - 1, options.initialPity ?? 0)) : 0;
  const streaks: WishStreakOutcome[] = options.initialStreaks ? [...options.initialStreaks] : [];
  const completedIntervals: number[] = [];
  const ssrFeed: WishSsrFeedItem[] = [];

  let earlySsrCount = 0;
  let pitySsrCount = 0;
  let lastSsrPullIndex = 0;
  let lastSsrTrackNumber: number | undefined;
  let intervalKnown = !pulls[0]?.raw_banner_code;

  for (let i = 0; i < pulls.length; i++) {
    const pullNumber = i + 1;
    const record = pulls[i];
    if(record.rarity===0){intervalKnown=false;streaks.length=0;}
    if (i > 0 && record.raw_banner_code && (record.track_pull_number === undefined
      || pulls[i - 1].track_pull_number === undefined || record.track_pull_number !== pulls[i - 1].track_pull_number! + 1)) {
      intervalKnown = false;
      streaks.length = 0;
    }
    if (record.raw_banner_code) {
      // Imported fragments never establish a zero origin by themselves.
      currentPity = record.track_pull_number === undefined ? -1
        : pityTarget > 0 ? (record.track_pull_number - 1) % pityTarget + 1 : record.track_pull_number;
    } else if (pityTarget > 0 && currentPity >= 0) {
      currentPity += 1;
    }
    const isHardPity = pityTarget > 0 && currentPity === pityTarget;
    const isSsr = record.rarity === 5;

    if (isSsr) {
      const pullsSinceLast = intervalKnown ? pullNumber - lastSsrPullIndex : -1;
      if (intervalKnown) completedIntervals.push(pullsSinceLast);
      lastSsrPullIndex = pullNumber;
      lastSsrTrackNumber = record.track_pull_number;
      intervalKnown = !record.raw_banner_code || lastSsrTrackNumber !== undefined;

      if (isHardPity) {
        pitySsrCount += 1;
        currentPity = 0; // Hard pity resets counter
      } else if (currentPity >= 0 || isBlackNucleus) {
        earlySsrCount += 1;
        // Early SSR does NOT reset pity counter!
      }

      // 50/50 outcomes only apply to limited banners
      let outcome: WishStreakOutcome | null = null;
      if (!isStandard && !isBlackNucleus) {
        const isFeat = Boolean(record.is_featured ?? (record as any).isFeatured);
        outcome = record.streak_outcome ?? (record as any).streakOutcome ?? (isFeat ? 'win' : 'loss');
        if (outcome === 'win' || outcome === 'loss') {
          streaks.push(outcome);
        } else streaks.length=0;
      }

      ssrFeed.push({
        item_id: record.item_id,
        item_name: record.item_name,
        rarity: 5,
        pity_at_drop: isHardPity ? pityTarget : (isBlackNucleus ? (currentPity < 0 ? -1 : pullsSinceLast) : currentPity),
        is_guaranteed: isHardPity,
        streak_outcome: outcome,
        slot: record.slot,
        pulls_since_last_ssr: pullsSinceLast,
        timestamp: record.pull_timestamp,
      });
    } else if (isHardPity) {
      // In case hard pity was reached without an SSR recorded, reset counter
      currentPity = 0;
    }
  }

  const currentIncompleteInterval = intervalKnown ? pulls.length - lastSsrPullIndex : -1;
  if (options.currentPity !== undefined && pityTarget > 0 && options.currentPity >= 0 && options.currentPity < pityTarget) currentPity = options.currentPity;
  const pullsToGuarantee = pityTarget > 0 ? currentPity < 0 ? -1 : pityTarget - currentPity : 0;

  return {
    totalPulls: pulls.length,
    currentPity,
    pityTarget,
    pullsToGuarantee,
    totalSsr: pulls.filter((pull) => pull.rarity === 5).length,
    earlySsrCount,
    pitySsrCount,
    completedIntervals,
    currentIncompleteInterval,
    streaks,
    // Recent feed is returned newest first
    ssrFeed: ssrFeed.reverse(),
  };
}
