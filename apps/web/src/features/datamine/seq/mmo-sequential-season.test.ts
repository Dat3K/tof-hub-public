import {expect, it} from 'vitest';
import type {HandbookBiochemicalData, HandbookBiochemicalDate} from '../contracts/handbook';
import {currentSequentialSeason, SEQUENTIAL_GLOBAL_REGION, sequentialSeasonPeriod} from './mmo-sequential-season';

type Season = HandbookBiochemicalData['seasons'][number];
const date = (day: number): HandbookBiochemicalDate => ({year: 2026, month: 10, day, hour: 21, minute: 0, second: 0});
const season = (id: string, start: number, end: number) => ({id, start: date(1), end: date(31), regionalPeriods: [
  {region: SEQUENTIAL_GLOBAL_REGION, start: date(start), end: date(end)},
]} as Season);

it('uses the regional override and treats the end as exclusive', () => {
  const previous = season('previous', 1, 19), current = season('current', 19, 30);
  expect(sequentialSeasonPeriod(current).start).toEqual(date(19));
  expect(currentSequentialSeason([previous, current], new Date('2026-10-19T20:59:59Z'))?.id).toBe('previous');
  expect(currentSequentialSeason([previous, current], new Date('2026-10-19T21:00:00Z'))?.id).toBe('current');
  expect(currentSequentialSeason([previous, current], new Date('2026-10-30T21:00:00Z'))).toBeUndefined();
});

it('does not call an unverified base period current in Global', () => {
  const base = {...season('base', 1, 31), regionalPeriods: []};
  const incomplete = {...season('incomplete', 1, 31), regionalPeriods: [{region: SEQUENTIAL_GLOBAL_REGION, start: date(1), end: null}]};
  expect(sequentialSeasonPeriod(base).regional).toBe(false);
  expect(currentSequentialSeason([base, incomplete], new Date('2026-10-23T12:00:00Z'))).toBeUndefined();
});
