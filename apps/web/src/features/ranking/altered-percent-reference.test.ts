import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {buildRankingCatalog} from './catalog';
import {resistanceGearTop,entryGear,gearCurrentScore,idealGearDraft} from './scoring';
import type {BuildCatalog} from '../build/types';

it('keeps five Altered RES% rolls at rank 0.5 against the unrestricted perfect ceiling',()=>{
  const build=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;
  const catalog=buildRankingCatalog(build),row=resistanceGearTop(catalog,['Altered'],'visor')[0]!;
  const gear=entryGear(row),percent=gear.rows.find(row=>row.type==='Altered Resistance %')!;
  const bounds=build.reference.statTypes['Altered Resistance %']!;
  expect(row.reference).toBe('altered-resistance-percent');
  expect(percent.beforeTitan).toBeCloseTo(bounds.randomStatDefaultValue+5*bounds.randomStatMaxRollValue,12);
  expect(gear.augments.some(row=>row.type==='Resistance'||row.type==='Altered Resistance')).toBe(false);
  expect(gear.augments.some(row=>row.type==='HP')).toBe(true);
  expect(gear.rows.some(row=>row.type==='Resistance')).toBe(true);
  const perfect=gearCurrentScore(idealGearDraft('visor',['Altered'],catalog,'tank'),['Altered'],catalog,'tank');
  expect(row.maxScore).toBeCloseTo(perfect.maximum,9);
  expect(row.score).toBeCloseTo(90.4772504141,6);
});
