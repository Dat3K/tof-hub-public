import type { WishMatrixSlot, WishStreakOutcome } from '../types';
import { PITY_MAX_WEAPON, PITY_MAX_MATRIX, CASHBACK, MATRIX_SLOTS } from '../constants';
import { evaluateStreak } from '../streak';

export interface WorstCaseWeaponOptions {
  targetCopies: number; // e.g. 7 for A6
  currentCopies?: number;
  currentPity?: number;
  initialFlameGold?: number;
  recentStreaks?: readonly WishStreakOutcome[];
  reserve50ForBox?: boolean;
}

export interface WorstCaseWeaponResult {
  totalPulls: number;
  copiesFromPity: number;
  copiesFromShop: number;
  flameGoldSpent: number;
  flameGoldRemaining: number;
  featuredCopies: number;
  matrixBoxPurchased: boolean;
}

export function calculateWorstCaseWeapon(options: WorstCaseWeaponOptions): WorstCaseWeaponResult {
  const target = Math.max(0, Math.min(7, options.targetCopies));
  let currentCopies = Math.max(0, Math.min(7, options.currentCopies ?? 0));
  let pity = Math.max(0, Math.min(PITY_MAX_WEAPON - 1, options.currentPity ?? 0));
  let fg = Math.max(0, options.initialFlameGold ?? 0);
  const streakHistory: WishStreakOutcome[] = options.recentStreaks ? [...options.recentStreaks] : [];

  let pulls = 0;
  let copiesFromPity = 0;
  let copiesFromShop = 0;
  let fgSpent = 0;
  let srPityCounter = 0;
  let matrixBoxPurchased = false;

  const reserveCost = options.reserve50ForBox ? CASHBACK.FLAME_GOLD_MATRIX_BOX_COST : 0;

  // Initial shop check
  while (fg - reserveCost >= CASHBACK.FLAME_GOLD_WEAPON_COST && currentCopies + copiesFromShop < target) {
    fg -= CASHBACK.FLAME_GOLD_WEAPON_COST;
    fgSpent += CASHBACK.FLAME_GOLD_WEAPON_COST;
    copiesFromShop += 1;
  }

  while (currentCopies + copiesFromShop < target) {
    pulls += 1;
    pity += 1;
    srPityCounter += 1;
    fg += CASHBACK.PULL_BASE;

    // Hard pity SSR at 80
    if (pity >= PITY_MAX_WEAPON) {
      pity = 0;
      srPityCounter = 0;

      // In worst-case, streak rule determines outcome: forced win only if L-L, otherwise loss
      const streakEval = evaluateStreak(streakHistory);
      const isWin = streakEval.nextPrediction === 'forced_win';

      if (isWin) {
        currentCopies += 1;
        copiesFromPity += 1;
        streakHistory.push('win');
      } else {
        // Standard SSR duplicate loss yields +10 extra FG
        fg += CASHBACK.STANDARD_SSR_BONUS;
        streakHistory.push('loss');
      }
    } else if (srPityCounter >= 10) {
      // Guaranteed SR every 10 pulls gives +1 extra FG
      srPityCounter = 0;
      fg += CASHBACK.SR_DUPLICATE_BONUS;
    }

    // Check shop purchase
    while (fg - reserveCost >= CASHBACK.FLAME_GOLD_WEAPON_COST && currentCopies + copiesFromShop < target) {
      fg -= CASHBACK.FLAME_GOLD_WEAPON_COST;
      fgSpent += CASHBACK.FLAME_GOLD_WEAPON_COST;
      copiesFromShop += 1;
    }
  }

  // If reserving 50 FG for box, deduct it if accumulated
  if (options.reserve50ForBox && fg >= CASHBACK.FLAME_GOLD_MATRIX_BOX_COST) {
    fg -= CASHBACK.FLAME_GOLD_MATRIX_BOX_COST;
    fgSpent += CASHBACK.FLAME_GOLD_MATRIX_BOX_COST;
    matrixBoxPurchased = true;
  }

  return {
    totalPulls: pulls,
    copiesFromPity,
    copiesFromShop,
    flameGoldSpent: fgSpent,
    flameGoldRemaining: fg,
    featuredCopies: currentCopies + copiesFromShop,
    matrixBoxPurchased,
  };
}

export interface WorstCaseMatrixOptions {
  targetCopiesPerSlot: number; // e.g. 4 for 4-pc 3★
  currentInventory?: Record<WishMatrixSlot, number>;
  currentPity?: number;
  initialChips?: number;
  useMatrixBox?: boolean;
  blockedSlot?: WishMatrixSlot | null;
  autoBlock?: boolean;
  recentStreaks?: readonly WishStreakOutcome[];
}

export interface WorstCaseMatrixResult {
  totalPulls: number;
  piecesFromPity: number;
  piecesFromShop: number;
  chipsSpent: number;
  chipsRemaining: number;
  finalInventory: Record<WishMatrixSlot, number>;
  used50Box: boolean;
}

export function calculateWorstCaseMatrix(options: WorstCaseMatrixOptions): WorstCaseMatrixResult {
  const targetPerSlot = Math.max(0, Math.min(4, options.targetCopiesPerSlot));
  const inventory: Record<WishMatrixSlot, number> = {
    mind: Math.max(0, options.currentInventory?.mind ?? 0),
    memory: Math.max(0, options.currentInventory?.memory ?? 0),
    belief: Math.max(0, options.currentInventory?.belief ?? 0),
    emotion: Math.max(0, options.currentInventory?.emotion ?? 0),
  };

  let chips = Math.max(0, options.initialChips ?? 0);
  let pity = Math.max(0, Math.min(PITY_MAX_MATRIX - 1, options.currentPity ?? 0));
  let srPityCounter = 0;
  const streakHistory: WishStreakOutcome[] = options.recentStreaks ? [...options.recentStreaks] : [];
  let pulls = 0;
  let chipsSpent = 0;
  let piecesFromPity = 0;
  let piecesFromShop = 0;

  // If using 50-FG matrix box, consume it to complete the most deficit slot
  let used50Box = false;
  if (options.useMatrixBox) {
    const sortedSlots = [...MATRIX_SLOTS].sort((a, b) => inventory[a] - inventory[b]);
    if (inventory[sortedSlots[0]] < targetPerSlot) {
      inventory[sortedSlots[0]] += 1;
      used50Box = true;
    }
  }

  const isComplete = () => MATRIX_SLOTS.every((s) => inventory[s] >= targetPerSlot);

  // Initial shop redemption
  while (chips >= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST && !isComplete()) {
    const needed = MATRIX_SLOTS.filter((s) => inventory[s] < targetPerSlot);
    if (needed.length === 0) break;
    chips -= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST;
    chipsSpent += CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST;
    inventory[needed[0]] += 1;
    piecesFromShop += 1;
  }

  while (!isComplete()) {
    pulls += 1;
    pity += 1;
    srPityCounter += 1;
    chips += CASHBACK.PULL_BASE;

    if (pity >= PITY_MAX_MATRIX) {
      pity = 0;
      srPityCounter = 0;

      // Matrix SSR has 50/50 and follows streak rules: forced win only after 2 losses
      const streakEval = evaluateStreak(streakHistory);
      const isWin = streakEval.nextPrediction === 'forced_win';

      if (isWin) {
        piecesFromPity += 1;
        streakHistory.push('win');

        // Determine blocked slot (max 1 slot)
        let activeBlocked: WishMatrixSlot | null = options.blockedSlot ?? null;
        if (!activeBlocked && options.autoBlock) {
          const maxed = MATRIX_SLOTS.filter((s) => inventory[s] >= targetPerSlot);
          if (maxed.length > 0) {
            activeBlocked = maxed[0];
          }
        }

        const availableSlots = MATRIX_SLOTS.filter((s) => s !== activeBlocked);
        // In worst-case, drop lands on slot with most pieces (closest to target or already maxed) to maximize waste
        const sortedAvailable = [...availableSlots].sort((a, b) => inventory[b] - inventory[a]);
        inventory[sortedAvailable[0]] += 1;
      } else {
        // Standard matrix drop on 50/50 loss
        streakHistory.push('loss');
        chips += CASHBACK.STANDARD_SSR_BONUS;
      }
    } else if (srPityCounter >= 10) {
      srPityCounter = 0;
      chips += CASHBACK.SR_DUPLICATE_BONUS;
    }

    // Check shop redemption
    while (chips >= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST && !isComplete()) {
      const needed = MATRIX_SLOTS.filter((s) => inventory[s] < targetPerSlot);
      if (needed.length === 0) break;
      chips -= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST;
      chipsSpent += CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST;
      inventory[needed[0]] += 1;
      piecesFromShop += 1;
    }
  }

  return {
    totalPulls: pulls,
    piecesFromPity,
    piecesFromShop,
    chipsSpent,
    chipsRemaining: chips,
    finalInventory: { ...inventory },
    used50Box,
  };
}

