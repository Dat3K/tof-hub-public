import { WISH_MATRIX_SLOTS, type WishMatrixSlot } from './types';

export const PITY_MAX_WEAPON = 80;
export const PITY_MAX_MATRIX = 40;
export const SR_PITY_INTERVAL = 10;
/** Dark Crystals per pull on a weapon or matrix Special Order (the "DC equivalent" of a pull count). */
export const PULL_DC_COST = 150;

/**
 * Base drop rates verified against game client specifications and Special Orders disclosures.
 * Note: Matrix SSR is 1.70% and SR is 7.50% (legacy 0.75% and 1.50% were erroneous defects).
 */
export const BASE_RATES = Object.freeze({
  WEAPON_SSR: 0.0075, // 0.75% base rate
  WEAPON_SR: 0.01,    // 1.00% base rate
  MATRIX_SSR: 0.017,  // 1.70% base rate
  MATRIX_SR: 0.075,   // 7.50% base rate
});

export const CASHBACK = Object.freeze({
  PULL_BASE: 1,                      // 1 Flame Gold or Overclocking Chip per pull
  SR_DUPLICATE_BONUS: 1,             // +1 extra Flame Gold for maxed (6★) SR weapon
  STANDARD_SSR_BONUS: 10,            // +10 extra Flame Gold for standard SSR duplicate (loss)
  FLAME_GOLD_WEAPON_COST: 120,       // 120 Flame Gold buys 1 featured weapon copy
  FLAME_GOLD_MATRIX_BOX_COST: 50,    // 50 Flame Gold buys 1 matrix box of choice (limit 1)
  OVERCLOCKING_CHIP_MATRIX_COST: 80, // 80 Overclocking Chips buys 1 featured matrix (choice of slot)
});

export const MATRIX_SLOTS: readonly WishMatrixSlot[] = WISH_MATRIX_SLOTS;

export const MATRIX_SLOT_INDEX_MAP: Record<number, WishMatrixSlot> = Object.freeze({
  1: 'mind',
  2: 'memory',
  3: 'belief',
  4: 'emotion',
});
