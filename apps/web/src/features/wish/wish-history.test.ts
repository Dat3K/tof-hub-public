import { describe, expect, it } from 'vitest';
import { DEV_PLAYERS_DATA } from './dev-players-data';
import { calculateCashbackSummary, replayPityChain } from '@tof-hub/game-domain';
import demoBanners from '../../../public/game-data/wish-demo-banners.json';

const demo = DEV_PLAYERS_DATA.find((profile) => profile.id === 'full-history-demo');
if (!demo) throw new Error('Missing full history demo');
const pulls = demo.getPulls();

describe('full history demo', () => {
  it('uses real recent banners in chronological order, with plausible banner dates', () => {
    expect([...new Set(pulls.weaponLimited.map((pull) => pull.banner_id))]).toEqual([
      'weapon-agleia', 'weapon-berry', 'weapon-gefion', 'weapon-zoey',
    ]);
    expect([...new Set(pulls.matrixLimited.map((pull) => pull.banner_id))]).toEqual([
      'matrix-agleia', 'matrix-berry', 'matrix-zoey',
    ]);
    for (const banner of demoBanners) {
      const track = banner.bannerType === 'matrix_limited' ? pulls.matrixLimited : pulls.weaponLimited;
      const bannerPulls = track.filter((pull) => pull.banner_id === banner.id);
      expect(bannerPulls.length).toBeGreaterThan(0);
      expect(bannerPulls.every((pull) => pull.pull_timestamp >= banner.startDate
        && pull.pull_timestamp <= banner.endDate)).toBe(true);
    }
    expect(pulls.weaponLimited.filter((pull) => pull.banner_id === 'weapon-zoey')
      .every((pull) => pull.pull_timestamp.startsWith('2026-05-20'))).toBe(true);
  });

  it('carries pity between limited banners and gives Berry seven featured copies', () => {
    const agleia = pulls.weaponLimited.filter((pull) => pull.banner_id === 'weapon-agleia');
    const berry = pulls.weaponLimited.filter((pull) => pull.banner_id === 'weapon-berry');
    expect(agleia.at(-1)?.pity_count).toBe(10);
    expect(berry[0].pity_count).toBe(11);
    expect(replayPityChain(agleia, 'weapon_limited').currentPity).toBe(10);
    expect(replayPityChain([...agleia, ...berry], 'weapon_limited').currentPity).toBe(0);
    expect(pulls.weaponLimited.every((pull, index) => index === 0
      || BigInt(pull.group_ticks ?? 0) >= BigInt(pulls.weaponLimited[index - 1].group_ticks ?? 0))).toBe(true);
    expect(berry.filter((pull) => pull.rarity === 5 && pull.is_featured)).toHaveLength(7);
    expect(pulls.weaponLimited.filter((pull) => pull.banner_id === 'weapon-gefion'
      && pull.rarity === 5 && pull.is_featured)).toHaveLength(1);
    for (const track of [pulls.weaponLimited, pulls.matrixLimited]) {
      const outcomes = track.filter((pull) => pull.rarity === 5).map((pull) => pull.streak_outcome);
      expect(outcomes.every((outcome, index) => index < 2
        || outcome !== outcomes[index - 1]
        || outcome !== outcomes[index - 2])).toBe(true);
    }
  });

  it('fills both R0 matrix sets and keeps permanent orders separate', () => {
    for (const bannerId of ['matrix-agleia', 'matrix-berry']) {
      const featured = pulls.matrixLimited.filter((pull) => pull.banner_id === bannerId
        && pull.rarity === 5 && pull.is_featured);
      expect(featured).toHaveLength(4);
      expect(new Set(featured.map((pull) => pull.slot))).toEqual(
        new Set(['mind', 'memory', 'belief', 'emotion']),
      );
    }
    expect(pulls.standardWeapon).toHaveLength(110);
    expect(pulls.standardMatrix).toHaveLength(48);
    expect(pulls.blackNucleus).toHaveLength(320);
    expect(demo.pullsByTrack.weapon_limited).toBe(pulls.weaponLimited.length);
  });

  it('records duplicate bonuses in the veteran account cashback', () => {
    const berry = pulls.weaponLimited.filter((pull) => pull.banner_id === 'weapon-berry');
    expect(berry.filter((pull) => pull.rarity === 4).length).toBeGreaterThan(0);
    expect(berry.filter((pull) => pull.rarity === 4)
      .every((pull) => pull.compensation?.amount === 2)).toBe(true);
    expect(berry.find((pull) => pull.item_id.toLowerCase() === 'bigsword_ice')
      ?.compensation?.amount).toBe(11);
    const cashback = calculateCashbackSummary(berry, { expectedCashbackCurrency: 'flame_gold' });
    expect(cashback.baseCurrency).toBe(470);
    expect(cashback.extraDuplicateCurrency).toBe(60);
    expect(cashback.totalCurrencyAwarded).toBe(530);
  });
});
