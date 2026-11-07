import { describe, expect, it } from 'vitest';
import { clampPrice, computeFees, priceLadder, priceStepOf } from './fees';

describe('computeFees', () => {
  it('charges a listing fee in Gold equal to the listing value', () => {
    expect(computeFees(100, 5, false)).toEqual({
      grossUC: 500,
      listingFeeGold: 500,
      saleFeeUC: 25,
      netUC: 475,
    });
  });

  it('applies the pass discount to the listing fee and to nothing else', () => {
    expect(computeFees(100, 5, true)).toEqual({
      grossUC: 500,
      listingFeeGold: 400,
      saleFeeUC: 25,
      netUC: 475,
    });
  });

  it('rounds the sale fee half up', () => {
    // 5% of 30 is 1.5, which the seller pays as 2.
    expect(computeFees(30, 1, false).saleFeeUC).toBe(2);
    // 5% of 29.9 rounds to 1, and a whole UC price is what the client stores anyway.
    expect(computeFees(29, 1, false).saleFeeUC).toBe(1);
  });

  it('settles a single unit at the item reference price', () => {
    expect(computeFees(4, 1, false)).toEqual({ grossUC: 4, listingFeeGold: 4, saleFeeUC: 0, netUC: 4 });
  });
});

describe('clampPrice', () => {
  it('keeps a price inside the listing band', () => {
    expect(clampPrice(999, 2, 10)).toBe(10);
    expect(clampPrice(0, 2, 10)).toBe(2);
    expect(clampPrice(6.4, 2, 10)).toBe(6);
  });

  it('falls back to the minimum for input that is not a number', () => {
    expect(clampPrice(Number.NaN, 2, 10)).toBe(2);
  });
});

describe('priceLadder', () => {
  const clientBand = (over: Partial<Parameters<typeof priceLadder>[0]> = {}) => ({
    basePrice: 60,
    minPrice: 18,
    maxPrice: 240,
    minRatio: 0.3,
    maxRatio: 4,
    priceStep: 0.1,
    bandSource: 'client' as const,
    ...over,
  });

  it('steps a client band by ten percent of the reference price', () => {
    // A 60 UC shard: 0.1 × 60 = 6 UC steps across the 18–240 band.
    const ladder = priceLadder(clientBand());
    expect(ladder.slice(0, 3).map((rung) => rung.price)).toEqual([18, 24, 30]);
    expect(ladder.map((rung) => rung.price)).toContain(60);
    expect(ladder.at(-1)?.price).toBe(240);
    const prices = ladder.map((rung) => rung.price);
    expect(prices.every((price, index) => index === 0 || price - prices[index - 1] === 6)).toBe(true);
  });

  it('never emits a step below one UC', () => {
    // Base 4 with a 10% ratio is 0.4 UC, which no player can enter; the client stores 25% instead.
    expect(priceStepOf(4, 0.25)).toBe(1);
    expect(priceStepOf(4, 0.1)).toBe(1);
    // Base 12 × 0.133 is 1.596 UC and rounds to a 2 UC step.
    expect(priceStepOf(12, 0.133)).toBe(2);
    expect(priceLadder(clientBand({ basePrice: 4, minPrice: 2, maxPrice: 10, minRatio: 0.5, maxRatio: 2.5, priceStep: 0.25 })).map((rung) => rung.price)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('always offers the reference price and both ends of the band', () => {
    const prices = priceLadder(
      clientBand({ basePrice: 128, minPrice: 45, maxPrice: 448, minRatio: 0.35, maxRatio: 3.5 })
    ).map((rung) => rung.price);
    expect(prices[0]).toBe(45);
    expect(prices.at(-1)).toBe(448);
    expect(prices).toContain(128);
    expect(new Set(prices).size).toBe(prices.length);
  });

  it('offers the rungs a server band is labelled with', () => {
    // The rare weapon-enhancement modules: -40% to +146% in 13.3333% steps on a 12 UC reference
    // price. The labels are the station's own, so they are not re-derived from the ratio.
    const ladder = priceLadder({
      basePrice: 12,
      minPrice: 7,
      maxPrice: 30,
      minRatio: 0.6,
      maxRatio: 2.46,
      priceStep: 0.133,
      bandSource: 'server',
      percentRungs: [-40, -27, -13, 0, 13, 27, 40, 53, 67, 80, 93, 106, 120, 133, 146],
    });
    expect(ladder.map((rung) => rung.percent)).toEqual([
      -40, -27, -13, 0, 13, 27, 40, 53, 67, 80, 93, 106, 120, 133, 146,
    ]);
    expect(ladder.map((rung) => rung.price)).toEqual([
      7, 9, 10, 12, 14, 15, 17, 18, 20, 22, 23, 25, 26, 28, 30,
    ]);
  });
});
