/**
 * Trade Station fees on the Overseas MMO server.
 *
 * The listing fee is paid in Gold and equals the listing's UC value (Pass: 20% off). The
 * sale fee is 5% of the sale, taken in UC from the seller's proceeds. Neither depends on
 * Trade Station level: the curated rules file records the fees, and the client's level table
 * (`PutawayPriceRatio`) has no consumer here. See `docs/game-data/trade-station.md`.
 */

export const SALE_FEE_RATE = 0.05;
export const PASS_LISTING_DISCOUNT = 0.2;

export interface FeeBreakdown {
  /** Listing value in Universal Crystals: price × quantity. */
  grossUC: number;
  /** Paid in Gold when the listing is created. */
  listingFeeGold: number;
  /** Taken in UC when the listing sells. */
  saleFeeUC: number;
  /** UC the seller receives after the sale fee. */
  netUC: number;
}

export function computeFees(priceUC: number, quantity: number, pass: boolean): FeeBreakdown {
  const grossUC = priceUC * quantity;
  const listingFeeGold = Math.round(grossUC * (pass ? 1 - PASS_LISTING_DISCOUNT : 1));
  const saleFeeUC = Math.round(grossUC * SALE_FEE_RATE);
  return { grossUC, listingFeeGold, saleFeeUC, netUC: grossUC - saleFeeUC };
}

/** Keeps a typed price inside the item's listing band and on a whole UC amount. */
export function clampPrice(price: number, minPrice: number, maxPrice: number): number {
  if (!Number.isFinite(price)) return minPrice;
  return Math.min(maxPrice, Math.max(minPrice, Math.round(price)));
}

/**
 * `TradePriceMinDif` is the client's own price increment, a ratio of the reference price. The station
 * shows whole UC, so `max(1, …)` keeps a 10% step on a 4 UC item from collapsing to 0 UC (0.4 → 1),
 * and rounding turns 13.3333% of 12 UC into the 2 UC step the station lists (1.6 → 2).
 */
export function priceStepOf(basePrice: number, priceStep: number): number {
  return Math.max(1, Math.round(basePrice * priceStep));
}

export interface PriceRung {
  price: number;
  /** Percent from the reference price, as the station labels it: 0 for the reference price itself. */
  percent: number;
}

export interface PriceBandInput {
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  minRatio: number;
  maxRatio: number;
  priceStep: number;
  bandSource: 'client' | 'server';
  /** A curated band's own price buttons, as the percents the station labels them with. */
  percentRungs?: number[];
}

const ratioEpsilon = 1e-9;

/**
 * Every price the station accepts for one item, bottom of the band first.
 *
 * A client band (`PutAwardRange`) is walked in whole UC steps from `minPrice`, which is how the
 * price buttons line up with both ends of the band. A curated band carries the rungs the server
 * shows instead: the rare weapon-enhancement modules open at -40% and climb in 13.3333% steps to
 * +146%, where a whole UC step cannot express 13.3333% of a 12 UC reference price.
 */
export function priceLadder(input: PriceBandInput): PriceRung[] {
  const { basePrice, minPrice, maxPrice } = input;
  if (!(basePrice > 0) || !(maxPrice >= minPrice)) return [];
  const percentOf = (ratio: number) => Math.round((ratio - 1) * 100);

  if (input.bandSource === 'server') {
    // The rung labels are the station's own: rounding the ratio would print +107% where it shows +106%.
    return uniqueRungs(
      (input.percentRungs ?? []).map((percent) => {
        const price = roundHalfUp(basePrice * (1 + percent / 100));
        // The reference price is always 0%, even when the grid lands a rounding step beside it.
        return { price, percent: price === basePrice ? 0 : percent };
      }),
    );
  }

  const step = priceStepOf(basePrice, input.priceStep);
  const rungs: PriceRung[] = [];
  for (let price = minPrice; price <= maxPrice; price += step) rungs.push({ price, percent: percentOf(price / basePrice) });
  const ladder = uniqueRungs(rungs);
  // The band ends and the reference price are always offerable, even off the step grid.
  for (const price of [minPrice, basePrice, maxPrice]) {
    if (!ladder.some((rung) => rung.price === price)) {
      ladder.push({ price, percent: percentOf(price / basePrice) });
    }
  }
  return ladder.sort((a, b) => a.price - b.price);
}

function uniqueRungs(rungs: PriceRung[]): PriceRung[] {
  const seen = new Set<number>();
  return rungs.filter((rung) => (seen.has(rung.price) ? false : seen.add(rung.price)));
}

/** Rounds half up, matching the dataset: 29.5 UC is 30 UC. The epsilon absorbs binary-float drift. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + ratioEpsilon);
}
