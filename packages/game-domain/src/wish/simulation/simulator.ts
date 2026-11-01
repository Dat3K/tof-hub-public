import type {
  WishSimulationConfig,
  WishSimulationResult,
  WishStreakOutcome,
  WishMatrixSlot,
} from '../types';
import {
  PITY_MAX_WEAPON,
  PITY_MAX_MATRIX,
  SR_PITY_INTERVAL,
  BASE_RATES,
  CASHBACK,
  MATRIX_SLOTS,
} from '../constants';
import { resolve50_50 } from '../streak';
import { createMulberry32 } from './prng';
import { calculateWorstCaseWeapon, calculateWorstCaseMatrix } from './worst-case';

export function runFullSimulation(config: WishSimulationConfig): WishSimulationResult {
  const worstCase = runWorstCase(config);
  const zeroExtraDeterministic = runZeroExtraDeterministic(config);
  const monteCarlo = runMonteCarlo(config);

  return {
    worstCase,
    zeroExtraDeterministic,
    monteCarlo,
  };
}

export function runWorstCase(config: WishSimulationConfig): WishSimulationResult['worstCase'] {
  let weaponPulls = 0;
  let matrixPulls = 0;
  let weaponCopiesFromPity = 0;
  let weaponCopiesFromShop = 0;
  let matrixPiecesFromPity = 0;
  let matrixPiecesFromShop = 0;
  let flameGoldSpent = 0;
  let chipsSpent = 0;
  let matrixBoxAvailable = config.bought50Box;
  let used50Box = false;

  const targetWeaponCopies = config.targetWeaponAdvancement + 1; // e.g. A6 = 7 copies total

  if (config.mode === 'weapon' || config.mode === 'both') {
    const res = calculateWorstCaseWeapon({
      targetCopies: targetWeaponCopies,
      currentCopies: config.currentWeaponCopies,
      currentPity: config.currentWeaponPity,
      initialFlameGold: config.initialFlameGold,
      recentStreaks: config.recentWeaponStreaks,
      reserve50ForBox: config.mode === 'both' && !config.bought50Box,
    });
    weaponPulls = res.totalPulls;
    weaponCopiesFromPity = res.copiesFromPity;
    weaponCopiesFromShop = res.copiesFromShop;
    flameGoldSpent = res.flameGoldSpent;
    matrixBoxAvailable ||= res.matrixBoxPurchased;
  }

  if (config.mode === 'matrix' || config.mode === 'both') {
    const res = calculateWorstCaseMatrix({
      targetCopiesPerSlot: config.targetMatrixCopiesPerSlot,
      currentInventory: config.currentMatrixCopies,
      currentPity: config.currentMatrixPity,
      initialChips: config.initialOverclockingChips,
      useMatrixBox: matrixBoxAvailable,
      blockedSlot: config.blockedSlot,
      autoBlock: config.autoBlock,
      recentStreaks: config.recentMatrixStreaks,
    });
    matrixPulls = res.totalPulls;
    matrixPiecesFromPity = res.piecesFromPity;
    matrixPiecesFromShop = res.piecesFromShop;
    chipsSpent = res.chipsSpent;
    used50Box = res.used50Box;
  }

  return {
    weaponPulls,
    matrixPulls,
    totalPulls: weaponPulls + matrixPulls,
    weaponCopiesFromPity,
    weaponCopiesFromShop,
    matrixPiecesFromPity,
    matrixPiecesFromShop,
    flameGoldSpent,
    chipsSpent,
    used50Box,
  };
}

export function runZeroExtraDeterministic(
  config: WishSimulationConfig
): WishSimulationResult['zeroExtraDeterministic'] {
  // Models standard 80/40 pity drops only, but with simulated average 50/50 rolls
  const rng = createMulberry32(config.seed ?? 12345);
  let weaponPulls = 0;
  let matrixPulls = 0;
  let hasMatrixBox = config.bought50Box;

  const targetWeaponCopies = config.targetWeaponAdvancement + 1;

  if (config.mode === 'weapon' || config.mode === 'both') {
    let copies = config.currentWeaponCopies;
    let pity = config.currentWeaponPity;
    let fg = config.initialFlameGold;
    let streakHistory: WishStreakOutcome[] = [...config.recentWeaponStreaks];
    let srPity = 0;

    while (copies < targetWeaponCopies) {
      weaponPulls += 1;
      pity += 1;
      srPity += 1;
      fg += CASHBACK.PULL_BASE;

      if (pity >= PITY_MAX_WEAPON) {
        pity = 0;
        srPity = 0;
        const res = resolve50_50(streakHistory, rng);
        streakHistory = res.updatedStreakHistory;
        if (res.isWin) {
          copies += 1;
        } else {
          fg += CASHBACK.STANDARD_SSR_BONUS;
        }
      } else if (srPity >= SR_PITY_INTERVAL) {
        srPity = 0;
        fg += CASHBACK.SR_DUPLICATE_BONUS;
      }

      // If in combined mode, reserve and acquire 50 FG box first
      if (config.mode === 'both' && !hasMatrixBox && fg >= CASHBACK.FLAME_GOLD_MATRIX_BOX_COST) {
        fg -= CASHBACK.FLAME_GOLD_MATRIX_BOX_COST;
        hasMatrixBox = true;
      }

      while (fg >= CASHBACK.FLAME_GOLD_WEAPON_COST && copies < targetWeaponCopies) {
        fg -= CASHBACK.FLAME_GOLD_WEAPON_COST;
        copies += 1;
      }
    }
  }

  if (config.mode === 'matrix' || config.mode === 'both') {
    const inv: Record<WishMatrixSlot, number> = { ...config.currentMatrixCopies };
    let pity = config.currentMatrixPity;
    let chips = config.initialOverclockingChips;
    let matrixStreakHistory: WishStreakOutcome[] = [...config.recentMatrixStreaks];
    let srPity = 0;
    const target = config.targetMatrixCopiesPerSlot;

    // Apply 50 FG matrix box if available
    if (hasMatrixBox) {
      const sortedSlots = [...MATRIX_SLOTS].sort((a, b) => inv[a] - inv[b]);
      if (inv[sortedSlots[0]] < target) {
        inv[sortedSlots[0]] += 1;
      }
    }

    const isComplete = () => MATRIX_SLOTS.every((s) => inv[s] >= target);

    while (!isComplete()) {
      matrixPulls += 1;
      pity += 1;
      srPity += 1;
      chips += CASHBACK.PULL_BASE;

      if (pity >= PITY_MAX_MATRIX) {
        pity = 0;
        srPity = 0;
        const res = resolve50_50(matrixStreakHistory, rng);
        matrixStreakHistory = res.updatedStreakHistory;

        if (res.isWin) {
          let blocked = config.blockedSlot;
          if (!blocked && config.autoBlock) {
            const maxed = MATRIX_SLOTS.filter((s) => inv[s] >= target);
            if (maxed.length > 0) blocked = maxed[0];
          }
          const available = MATRIX_SLOTS.filter((s) => s !== blocked);
          const chosen = available[Math.floor(rng() * available.length)];
          inv[chosen] += 1;
        } else {
          // 50/50 Loss on matrix banner gives standard SSR matrix (+10 chips)
          chips += CASHBACK.STANDARD_SSR_BONUS;
        }
      } else if (srPity >= SR_PITY_INTERVAL) {
        srPity = 0;
        chips += CASHBACK.SR_DUPLICATE_BONUS;
      }

      while (chips >= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST && !isComplete()) {
        const needed = MATRIX_SLOTS.filter((s) => inv[s] < target);
        if (needed.length === 0) break;
        chips -= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST;
        inv[needed[0]] += 1;
      }
    }
  }

  return {
    weaponPulls,
    matrixPulls,
    totalPulls: weaponPulls + matrixPulls,
  };
}

export function runMonteCarlo(
  config: WishSimulationConfig,
  onProgress?: (progressPercent: number) => void
): WishSimulationResult['monteCarlo'] {
  const trials = config.trials;
  const rng = createMulberry32(config.seed ?? Date.now());
  const pullCounts = new Int32Array(trials);
  let totalPullsSum = 0;

  const targetWeaponCopies = config.targetWeaponAdvancement + 1;
  const targetMatrixCopies = config.targetMatrixCopiesPerSlot;

  const simulateOneTrial = (): number => {
    let pulls = 0;
    let hasMatrixBox = config.bought50Box;

    // 1. Weapon simulation
    if (config.mode === 'weapon' || config.mode === 'both') {
      let copies = config.currentWeaponCopies;
      let pity = config.currentWeaponPity;
      let fg = config.initialFlameGold;
      let streakHistory: WishStreakOutcome[] = [...config.recentWeaponStreaks];
      let srPity = 0;

      while (copies < targetWeaponCopies) {
        pulls += 1;
        pity += 1;
        srPity += 1;
        fg += CASHBACK.PULL_BASE;

        let isSsr = false;
        if (pity >= PITY_MAX_WEAPON) {
          isSsr = true;
          pity = 0; // Hard pity resets
        } else if (rng() < BASE_RATES.WEAPON_SSR) {
          isSsr = true;
          // Early SSR: pity does NOT reset!
        }

        if (isSsr) {
          srPity = 0;
          const res = resolve50_50(streakHistory, rng);
          streakHistory = res.updatedStreakHistory;
          if (res.isWin) {
            copies += 1;
          } else {
            fg += config.standardSsrMaxed ? CASHBACK.STANDARD_SSR_BONUS : 0;
          }
        } else if (srPity >= SR_PITY_INTERVAL || rng() < BASE_RATES.WEAPON_SR) {
          srPity = 0;
          fg += config.srMaxed ? CASHBACK.SR_DUPLICATE_BONUS : 0;
        }

        // Buy 50 FG matrix box if combined mode
        if (config.mode === 'both' && !hasMatrixBox && fg >= CASHBACK.FLAME_GOLD_MATRIX_BOX_COST) {
          fg -= CASHBACK.FLAME_GOLD_MATRIX_BOX_COST;
          hasMatrixBox = true;
        }

        while (fg >= CASHBACK.FLAME_GOLD_WEAPON_COST && copies < targetWeaponCopies) {
          fg -= CASHBACK.FLAME_GOLD_WEAPON_COST;
          copies += 1;
        }
      }
    }

    // 2. Matrix simulation
    if (config.mode === 'matrix' || config.mode === 'both') {
      const inv: Record<WishMatrixSlot, number> = { ...config.currentMatrixCopies };
      let pity = config.currentMatrixPity;
      let chips = config.initialOverclockingChips;
      let matrixStreakHistory: WishStreakOutcome[] = [...config.recentMatrixStreaks];
      let srPity = 0;

      // Apply 50 FG box if acquired
      if (hasMatrixBox) {
        const sortedSlots = [...MATRIX_SLOTS].sort((a, b) => inv[a] - inv[b]);
        if (inv[sortedSlots[0]] < targetMatrixCopies) {
          inv[sortedSlots[0]] += 1;
        }
      }

      const isComplete = () => MATRIX_SLOTS.every((s) => inv[s] >= targetMatrixCopies);

      while (!isComplete()) {
        pulls += 1;
        pity += 1;
        srPity += 1;
        chips += CASHBACK.PULL_BASE;

        let isSsr = false;
        if (pity >= PITY_MAX_MATRIX) {
          isSsr = true;
          pity = 0; // Hard pity resets
        } else if (rng() < BASE_RATES.MATRIX_SSR) {
          isSsr = true;
          // Early SSR: pity does NOT reset!
        }

        if (isSsr) {
          srPity = 0;
          const res = resolve50_50(matrixStreakHistory, rng);
          matrixStreakHistory = res.updatedStreakHistory;

          if (res.isWin) {
            let blocked = config.blockedSlot;
            if (!blocked && config.autoBlock) {
              const maxed = MATRIX_SLOTS.filter((s) => inv[s] >= targetMatrixCopies);
              if (maxed.length > 0) blocked = maxed[0];
            }
            const available = MATRIX_SLOTS.filter((s) => s !== blocked);
            const chosen = available[Math.floor(rng() * available.length)];
            inv[chosen] += 1;
          } else {
            // Standard matrix duplicate on 50/50 loss
            chips += config.standardSsrMaxed ? CASHBACK.STANDARD_SSR_BONUS : 0;
          }
        } else if (srPity >= SR_PITY_INTERVAL || rng() < BASE_RATES.MATRIX_SR) {
          srPity = 0;
          chips += config.srMaxed ? CASHBACK.SR_DUPLICATE_BONUS : 0;
        }

        while (chips >= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST && !isComplete()) {
          const needed = MATRIX_SLOTS.filter((s) => inv[s] < targetMatrixCopies);
          if (needed.length === 0) break;
          chips -= CASHBACK.OVERCLOCKING_CHIP_MATRIX_COST;
          inv[needed[0]] += 1;
        }
      }
    }

    return pulls;
  };

  const reportInterval = Math.max(100, Math.floor(trials / 10));


  for (let t = 0; t < trials; t++) {
    const resultPulls = simulateOneTrial();
    pullCounts[t] = resultPulls;
    totalPullsSum += resultPulls;

    if (onProgress && t % reportInterval === 0) {
      onProgress(Math.floor((t / trials) * 100));
    }
  }

  pullCounts.sort();
  const mean = Number((totalPullsSum / trials).toFixed(1));

  let varianceSum = 0;
  for (let t = 0; t < trials; t++) {
    const diff = pullCounts[t] - mean;
    varianceSum += diff * diff;
  }
  const stdDev = Number(Math.sqrt(varianceSum / trials).toFixed(1));

  const getPercentile = (p: number): number => {
    const idx = Math.min(trials - 1, Math.max(0, Math.floor((p / 100) * trials)));
    return pullCounts[idx];
  };

  // Build histogram bins (20 bins spanning min to max)
  const minPulls = pullCounts[0];
  const maxPulls = pullCounts[trials - 1];
  const binCount = 20;
  const binWidth = Math.max(1, Math.ceil((maxPulls - minPulls + 1) / binCount));
  const histogram: Array<{ binStart: number; binEnd: number; count: number }> = [];

  for (let b = 0; b < binCount; b++) {
    const bStart = minPulls + b * binWidth;
    const bEnd = bStart + binWidth - 1;
    histogram.push({ binStart: bStart, binEnd: bEnd, count: 0 });
  }

  for (let t = 0; t < trials; t++) {
    const val = pullCounts[t];
    const bIdx = Math.min(binCount - 1, Math.floor((val - minPulls) / binWidth));
    histogram[bIdx].count += 1;
  }

  return {
    trials,
    meanPulls: mean,
    medianPulls: getPercentile(50),
    stdDev,
    minPulls,
    maxPulls,
    percentiles: {
      p1: getPercentile(1),
      p10: getPercentile(10),
      p25: getPercentile(25),
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99),
    },
    costHistogram: histogram,
  };
}
