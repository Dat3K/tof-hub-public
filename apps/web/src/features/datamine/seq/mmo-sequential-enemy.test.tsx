import {cleanup, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {HandbookBiochemicalMedia} from '../contracts/handbook';
import {MmoSequentialEnemyDetails} from './mmo-sequential-enemy-details';
import {knownEnemyValue, sequentialEnemyMedia, sequentialEnemyPortrait, sequentialLineup, type SequentialPod} from './mmo-sequential-enemy';

vi.mock('../handbook/sections/handbook-ui', () => ({useHandbookText: () => ({
  locale: 'en', t: (en: string) => en, name: (text?: {en?: string} | null, fallback = '') => text?.en || fallback,
  num: (value: number) => value.toLocaleString('en'),
  pct: (value: number) => `${value * 100}%`,
})}));

afterEach(cleanup);

const pod = {
  id: 'fixture', name: {en: 'Fixture pod'}, bossIcon: '/game-assets/boss.webp', bossName: {en: 'Boss'}, buffs: [],
  waves: [{index: 1, enemies: [{name: {en: 'Boss'}, count: 1, level: 47, type: 'BS_MONSTER_BOSS', attributeId: 'fixture', stats: null}]}],
} as unknown as SequentialPod;

it('retains the wave slot identity and rejects mismatched or missing media in an indexed pod', () => {
  const enemy = sequentialLineup(pod)[0];
  expect(enemy.sourceSlot).toBe('1:0');
  expect(sequentialEnemyPortrait(pod, enemy)).toBe(pod.bossIcon);
  const media = {pods: {fixture: {enemies: {'1:0': {name: {en: 'Different enemy'}, portrait: '/game-assets/other.webp'}}}}} as unknown as HandbookBiochemicalMedia;
  expect(sequentialEnemyMedia(pod, enemy, media)).toBeUndefined();
  expect(sequentialEnemyPortrait(pod, enemy, media)).toBeNull();
  expect(sequentialEnemyPortrait(pod, enemy, {pods: {fixture: {enemies: {}}}} as unknown as HandbookBiochemicalMedia)).toBeNull();
});

it('shows unknown attributes without replacing them with zero or importing OoW percentages', () => {
  render(<MmoSequentialEnemyDetails pod={pod} enemy={sequentialLineup(pod)[0]} onClose={() => {}} />);
  const primary = screen.getByRole('region', {name: 'Primary combat stats'});
  expect(within(primary).getAllByText('Unknown').length).toBeGreaterThanOrEqual(4);
  const defense = screen.getByRole('region', {name: 'Base elemental defense'});
  expect(within(defense).getAllByText('Unknown')).toHaveLength(5);
  expect(defense.textContent).not.toContain('%');
  expect(screen.queryByText('Effective HP')).toBeNull();
});

it('distinguishes verified zero from unavailable or non-finite data', () => {
  expect(knownEnemyValue(0)).toBe(true);
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) expect(knownEnemyValue(value)).toBe(false);
});

it('presents fractional critical resistance without a technical identifiers section', () => {
  const enemy = sequentialLineup(pod)[0];
  render(<MmoSequentialEnemyDetails pod={pod} enemy={{...enemy, stats: {
    maxHealth: 100, attack: 10, armor: 0, critDefense: .3,
    resistances: {physical: 0, flame: 0, frost: 0, volt: 0, altered: 0},
    modifyMaxHpOffsetLevel: null, modifyAttackOffsetLevel: null,
  }}} onClose={() => {}} />);
  expect(within(screen.getByRole('region', {name: 'Primary combat stats'})).getByText('30%')).toBeTruthy();
  expect(screen.getAllByText('30%')).toHaveLength(1);
  expect(screen.queryByText('Game data identifiers')).toBeNull();
  expect(screen.queryByText('FinalCritDef')).toBeNull();
});
