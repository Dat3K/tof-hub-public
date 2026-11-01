import type { WishRecordDto } from './types';
import { CASHBACK } from './constants';

export interface CashbackSummaryOptions {
  expectedCashbackCurrency?: string;
}

export interface CashbackSummary {
  baseCurrency: number;
  extraDuplicateCurrency: number;
  totalCurrencyAwarded: number;
  unrecognizedItemsCount: number;
  otherCompensationItems: Array<{ item_id: string; count: number }>;
}

const KNOWN_CURRENCY_ALIASES: Record<string, string[]> = {
  flame_gold: ['flame_gold', 'WeaponFragment_UP29', 'WeaponFragment_UP74'],
  overclocking_chip: ['overclocking_chip'],
  black_gold: ['black_gold', 'black_gold_token', 'Item_Gold_Token'],
  base_chip: ['base_chip', 'base_chip_token', 'Item_Base_Chip'],
  none: [],
};

function isMatchingCurrency(actualId?: string | null, expected?: string | null): boolean {
  if (!actualId) return false;
  if (expected === 'none') return false;
  if (!expected) {
    // If no expectation provided, accept known standard tokens or weapon fragments
    return (
      actualId.toLowerCase().includes('fragment') ||
      actualId === 'flame_gold' ||
      actualId === 'overclocking_chip' ||
      actualId === 'black_gold' ||
      actualId === 'base_chip'
    );
  }
  if (actualId === expected) return true;
  const aliases = KNOWN_CURRENCY_ALIASES[expected] ?? [];
  return aliases.includes(actualId);
}

/**
 * Calculates cashback totals from recorded pulls.
 * - Base currency is awarded per pull (+1) unless banner has no cashback ('none').
 * - Extra duplicate currency is only awarded if recorded in compensation with matching currency.
 * - Does NOT guess bonus by rarity when compensation is absent.
 * - Non-matching or unknown items are tracked separately.
 */
export function calculateCashbackSummary(
  pulls: readonly WishRecordDto[],
  options: CashbackSummaryOptions = {}
): CashbackSummary {
  let baseCurrency = 0;
  let extraDuplicateCurrency = 0;
  let unrecognizedItemsCount = 0;
  const otherCompensationItems: Array<{ item_id: string; count: number }> = [];

  for (const pull of pulls) {
    const supportsDuplicateCashback =
      pull.banner_type === 'weapon_limited' || pull.banner_type === 'standard_weapon';

    if (options.expectedCashbackCurrency !== 'none') {
      baseCurrency += CASHBACK.PULL_BASE;
    }

    if (pull.compensation) {
      const currId = pull.compensation.currency_id;
      if (isMatchingCurrency(currId, options.expectedCashbackCurrency)) {
        // Matrix banners award one chip per pull; duplicate matrix drops do not
        // add cashback. Weapon duplicate bonuses remain based on recorded data.
        const extra = supportsDuplicateCashback
          ? Math.max(0, pull.compensation.amount - CASHBACK.PULL_BASE)
          : 0;
        extraDuplicateCurrency += extra;
      } else {
        // Unrecognized or non-cashback currency compensation (e.g. materials, shards)
        unrecognizedItemsCount += 1;
        otherCompensationItems.push({
          item_id: currId,
          count: pull.compensation.amount,
        });
      }

      // Check extra_items array
      if (Array.isArray(pull.compensation.extra_items)) {
        for (const item of pull.compensation.extra_items) {
          if (isMatchingCurrency(item.item_id, options.expectedCashbackCurrency)) {
            // Count extra items if matching
          } else {
            otherCompensationItems.push(item);
          }
        }
      }
    }
    // Without compensation data, no rarity-based bonus is substituted.
  }

  return {
    baseCurrency,
    extraDuplicateCurrency,
    totalCurrencyAwarded: baseCurrency + extraDuplicateCurrency,
    unrecognizedItemsCount,
    otherCompensationItems,
  };
}

