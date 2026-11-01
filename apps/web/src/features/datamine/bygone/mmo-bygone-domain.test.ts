import { describe, expect, it } from 'vitest';
import type { HandbookMmoBygoneEnemy } from '../contracts/handbook';
import { mmoBygoneLineup, mmoBygoneMaxEnemyHp, mmoBygoneWindow, mmoBygoneValue, mmoBygoneRounds, type MmoBygoneRound } from './mmo-bygone-domain';

const enemy = (classPath: string | null, count: number | null): HandbookMmoBygoneEnemy => ({classPath, count, type: 'normal', name: null, localizedNameKey: null, attributeId: null, stats: null});
const round = (index: number): MmoBygoneRound => ({index, pool: null, monsterLevelCurveValue: null, common: null, curveValues: {}}) as MmoBygoneRound;
const hpEnemy = (hp: number | null, count = 1) => ({...enemy(`enemy-${hp}`, count), hp, stats: hp == null ? null : {maxHealth: hp} as NonNullable<HandbookMmoBygoneEnemy['stats']>});
const hpRound = (index: number, monsters: HandbookMmoBygoneEnemy[]): MmoBygoneRound => ({...round(index), pool: {monsters} as NonNullable<MmoBygoneRound['pool']>});

describe('MMO Bygone presentation data', () => {
  it('projects resolved names into chart/export rows without replacing combat data or mutating the snapshot', () => {
    const original = hpRound(1, [hpEnemy(100)]);
    const season = {rounds: [original]} as Parameters<typeof mmoBygoneRounds>[0];
    const projected = mmoBygoneRounds(season, {'enemy-100': {name: {en: 'Known enemy', ru: null}, codeName: 'enemy-100', actorKey: null}})[0];
    expect(projected.pool?.monsters[0].name?.en).toBe('Known enemy');
    expect(projected.pool?.monsters[0].stats).toBe(original.pool?.monsters[0].stats);
    expect(original.pool?.monsters[0].name).toBeNull();
  });
  it('combines exact configured variants, omits classless slots and retains enemies without stats', () => {
    const pool = {monsters: [enemy('known', 2), enemy('known', 3), {...enemy('known', 1), attributeId: 'different-variant'}, enemy(null, 2), enemy(null, 1), enemy('', 1), enemy('empty', 0), enemy('unknown-count', null), enemy('invalid-count', NaN)]} as NonNullable<MmoBygoneRound['pool']>;
    const lineup = mmoBygoneLineup({pool});
    expect(lineup.map(entry => [entry.classPath, entry.count])).toEqual([['known', 5], ['known', 1]]);
    expect(lineup.reduce((sum, entry) => sum + entry.count, 0)).toBe(6);
    expect(lineup.map(entry => entry.sourceSlots)).toEqual([[1, 2], [3]]);
    expect(lineup.every(entry => entry.stats === null)).toBe(true);
  });
  it('keeps a configured-floor window within bounds, including non-contiguous floors', () => {
    const rounds = [1, 2, 10, 11, 20].map(round);
    expect(mmoBygoneWindow(rounds, 1, 3)).toEqual({minFloor: 1, maxFloor: 10});
    expect(mmoBygoneWindow(rounds, 20, 3)).toEqual({minFloor: 10, maxFloor: 20});
    expect(mmoBygoneWindow(rounds, 10, 3)).toEqual({minFloor: 2, maxFloor: 11});
    expect(mmoBygoneWindow(rounds, 20, 100)).toEqual({minFloor: 1, maxFloor: 20});
  });
  it('omits unavailable chart values instead of fabricating zeroes', () => {
    expect(mmoBygoneValue(round(1), 'hp')).toBeNull();
    expect(mmoBygoneValue({...round(1), curveValues: {HpBuffCount: NaN}}, 'hp')).toBeNull();
    expect(mmoBygoneValue(hpRound(1, [hpEnemy(0), hpEnemy(NaN), hpEnemy(null)]), 'hp')).toBeNull();
  });
  it('takes one enemy maximum, without summing or multiplying counts or plotting the buff curve', () => {
    const floor = {...hpRound(2, [hpEnemy(100, 100), hpEnemy(500, 2), hpEnemy(10000, 0)]), curveValues: {HpBuffCount: 12345}};
    expect(mmoBygoneValue(floor, 'hp')).toBe(500);
    expect(mmoBygoneMaxEnemyHp(floor).enemy?.stats?.maxHealth).toBe(500);
    expect(mmoBygoneMaxEnemyHp(floor).missingHpEnemyCount).toBe(0);
    expect(mmoBygoneValue({...floor, curveValues: {HpBuffCount: NaN}}, 'hp')).toBe(500);
  });
  it('uses generated floor HP and never substitutes the raw baseline when calculation is missing', () => {
    const calculated = {...hpEnemy(500), stats: {maxHealth: 100} as NonNullable<HandbookMmoBygoneEnemy['stats']>};
    expect(mmoBygoneMaxEnemyHp(hpRound(7, [calculated])).hp).toBe(500);
    const unavailable = {...calculated, hp: undefined};
    expect(mmoBygoneMaxEnemyHp(hpRound(7, [unavailable]))).toEqual({hp: null, enemy: null, missingHpEnemyCount: 1});
  });
  it('preserves a maximum of known values while exposing missing enemy HP', () => {
    const maximum = mmoBygoneMaxEnemyHp(hpRound(1, [hpEnemy(500), enemy(null, 2), hpEnemy(null, 3), hpEnemy(-1), hpEnemy(Infinity)]));
    expect(maximum.hp).toBe(500);
    expect(maximum.missingHpEnemyCount).toBe(5);
  });
  it('compares consecutive single-enemy maxima, including decreases and unknown comparisons', () => {
    const previous = hpRound(1, [hpEnemy(100, 50)]);
    const current = hpRound(2, [hpEnemy(150, 2), hpEnemy(50, 100)]);
    expect(mmoBygoneValue(current, 'powercreep', previous)).toBe(50);
    expect(mmoBygoneValue(hpRound(3, [hpEnemy(75)]), 'powercreep', current)).toBe(-50);
    expect(mmoBygoneValue(hpRound(2, [hpEnemy(0)]), 'powercreep', previous)).toBeNull();
    expect(mmoBygoneValue(current, 'powercreep', hpRound(1, [hpEnemy(0)]))).toBeNull();
    expect(mmoBygoneValue(previous, 'powercreep')).toBeNull();
    expect(mmoBygoneValue(current, 'powercreep', round(1))).toBeNull();
  });
});
