import {cleanup, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MmoBygoneEnemyDetails, type MmoEnemyInspection} from './mmo-bygone-enemy-details';

vi.mock('../handbook/sections/handbook-ui', () => ({useHandbookText: () => ({
  locale: 'en', t: (en: string) => en, name: (text?: {en?: string} | null, fallback = '') => text?.en || fallback,
  num: (value: number) => value.toLocaleString('en'), pct: (value: number) => `${value * 100}%`,
})}));
afterEach(cleanup);

const inspection: MmoEnemyInspection = {
  floor: 200, pool: 200, defenseCurveValue: 11376.15,
  enemy: {type: 'BS_MONSTER_BOSS', count: 1, classPath: '/Game/Test/Boss.Boss_C', name: {en: 'Fixture boss', ru: null},
    sourceSlots: [1], attributeId: 'fixture', localizedNameKey: 'fixture', hp: 100,
    stats: {maxHealth: 100, attack: 10, armor: 1500, physical: 1, flame: 1, frost: 1, volt: 1, altered: 1,
      crit: null, critDamage: null, critDefense: null, finalCritDefense: .3},
    defenseEstimate: {model: 'base-plus-whole-defense-stacks', verified: false, curveValue: 11376.15, stacks: 11376,
      values: {physical: 11377, flame: 11377, frost: 11377, volt: 11377, altered: 11377}}},
};

it('shows generated defense including floor stacks in each elemental card, retaining bases and estimate status', () => {
  render(<MmoBygoneEnemyDetails inspection={inspection} media={{portraits: {}}} onClose={() => {}} />);
  const section = screen.getByRole('region', {name: 'Elemental defense'});
  expect(within(section).getAllByText('11,377', {exact: true})).toHaveLength(5);
  expect(within(section).getAllByText('Base DEF: 1', {exact: true})).toHaveLength(5);
  expect(within(section).getByText('Estimated · floor stacks')).toBeTruthy();
  expect(within(section).getByText('11,376', {exact: true})).toBeTruthy();
  expect(section.textContent).not.toContain('%');
});

it('does not silently show a source baseline as estimated floor defense when the estimate is unavailable', () => {
  render(<MmoBygoneEnemyDetails inspection={{...inspection, enemy: {...inspection.enemy, defenseEstimate: null}}} media={{portraits: {}}} onClose={() => {}} />);
  const section = screen.getByRole('region', {name: 'Elemental defense'});
  expect(within(section).getAllByText('Unknown', {exact: true})).toHaveLength(6);
  expect(within(section).getAllByText('Base DEF: 1', {exact: true})).toHaveLength(5);
  expect(within(section).queryByText('1', {exact: true})).toBeNull();
});
