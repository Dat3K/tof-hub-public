import type {
  WishStreakOutcome,
  WishNextStreakPrediction,
} from './types';

export interface StreakEvaluationResult {
  nextPrediction: WishNextStreakPrediction;
  winProbability: number;
  streakType: 'win_win' | 'loss_loss' | 'neutral' | 'unknown';
}

/**
 * Evaluates the 50/50 streak state according to Tower of Fantasy streak laws:
 * - W-W -> Forced Loss (0.00 win probability, next must lose)
 * - L-L -> Forced Win (1.00 win probability, next must win)
 * - Mixed (W-L, L-W) -> Neutral 50/50 (0.50 win probability)
 * - < 2 known outcomes -> Unknown (not enough data to assume 50/50 or forced outcome)
 */
export function evaluateStreak(
  streakHistory: readonly WishStreakOutcome[]
): StreakEvaluationResult {
  // Filter out any unknown / corrupted outcomes to inspect only known wins and losses
  const validOutcomes = streakHistory.filter(
    (s): s is 'win' | 'loss' => s === 'win' || s === 'loss'
  );

  if (validOutcomes.length < 2) {
    return {
      nextPrediction: 'unknown',
      winProbability: 0.5,
      streakType: 'unknown',
    };
  }

  const n = validOutcomes.length;
  const prev2 = validOutcomes[n - 2];
  const prev1 = validOutcomes[n - 1];

  if (prev2 === 'win' && prev1 === 'win') {
    return {
      nextPrediction: 'forced_loss',
      winProbability: 0.0,
      streakType: 'win_win',
    };
  }

  if (prev2 === 'loss' && prev1 === 'loss') {
    return {
      nextPrediction: 'forced_win',
      winProbability: 1.0,
      streakType: 'loss_loss',
    };
  }

  return {
    nextPrediction: 'neutral_50_50',
    winProbability: 0.5,
    streakType: 'neutral',
  };
}

export interface Resolve5050Result {
  isWin: boolean;
  isForced: boolean;
  outcome: 'win' | 'loss';
  updatedStreakHistory: WishStreakOutcome[];
}

/**
 * Resolves a 50/50 roll taking prior streak history into account.
 */
export function resolve50_50(
  streakHistory: readonly WishStreakOutcome[],
  rng: () => number = Math.random
): Resolve5050Result {
  const evalResult = evaluateStreak(streakHistory);
  let isWin: boolean;
  let isForced = false;

  if (evalResult.nextPrediction === 'forced_win') {
    isWin = true;
    isForced = true;
  } else if (evalResult.nextPrediction === 'forced_loss') {
    isWin = false;
    isForced = true;
  } else {
    isWin = rng() < 0.5;
  }

  const outcome: 'win' | 'loss' = isWin ? 'win' : 'loss';
  const updatedStreakHistory = [...streakHistory, outcome];

  return {
    isWin,
    isForced,
    outcome,
    updatedStreakHistory,
  };
}
