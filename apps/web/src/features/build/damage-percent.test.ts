import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import type {BuildCatalog} from './types';
import {buildCombatDraft,deriveDamagePercentDraft,duoInheritedValue,elementDamagePercent,gearElementStat} from './model';
import {OPTIMIZER_STORAGE_KEY,saveImportedBuild} from './browser-storage';
import {applyGearSwap,slotComparison,statImpactModel} from '../optimizer/model';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/build-page.json'),'utf8')) as BuildCatalog;
afterEach(()=>localStorage.clear());
it('includes each element’s relic A4 once and inherits only the partner’s gear damage',()=>{
  const draft=structuredClone(catalog.demoDraft);
  const combat=buildCombatDraft(draft,catalog),totals=Object.fromEntries(combat.combat.elements.map(row=>[row.id,row.damage]));
  for(const element of ['Frost','Volt','Flame','Physical']){
    const without=structuredClone(draft);without.relicDamage={};
    expect(totals[element]-elementDamagePercent(without,catalog,element)).toBeCloseTo(draft.relicDamage![element]!);
  }
  expect(totals.Physical).toBeCloseTo(.64);
  expect(totals.Flame).toBeCloseTo(.757225);
  const inherited=duoInheritedValue(combat,catalog,'Physical','Damage %',totals)!;
  expect(inherited.from).toBe('Flame');expect(inherited.value).toBeCloseTo(.702225);
  expect(buildCombatDraft(combat,catalog).combat).toEqual(combat.combat);
});
it('imports the same calculated totals into Optimizer and preserves relics through repeated gear swaps',()=>{
  const draft=structuredClone(catalog.demoDraft);delete draft.demo;
  const imported=saveImportedBuild({draft,inventory:[],inventoryReceived:false},catalog);
  const optimizer=JSON.parse(localStorage.getItem(OPTIMIZER_STORAGE_KEY)!).draft;
  expect(optimizer.combat).toEqual(deriveDamagePercentDraft(draft,catalog).combat);
  expect(imported.optimizer.draft.combat).toEqual(optimizer.combat);
  expect(statImpactModel(optimizer,catalog)!.profile.damagePercent).toBeCloseTo(.702225);
  const changed=structuredClone(draft.gear.find(gear=>gear.id==='core')!);
  changed.augments.push({type:'Flame Damage %',value:.01});
  const next=applyGearSwap(optimizer,catalog,changed.id,changed)!;
  expect(slotComparison(optimizer,catalog,changed.id)!.compare(changed).gain).toBeCloseTo(.01/1.702225);
  const same=applyGearSwap(next,catalog,changed.id,changed)!;
  expect(next.relicDamage).toEqual(draft.relicDamage);
  expect(buildCombatDraft(next,catalog).combat).toEqual(same.combat);
  const physical=next.combat.elements.find(row=>row.id==='Physical')!;
  expect(physical.damage-gearElementStat(next,catalog,'Physical','Damage %')).toBeCloseTo(.64);
});
