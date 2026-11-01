import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,it} from 'vitest';
import {buildCombatDraft,combatRates,elementTotalAttack,emptyDraft,gearCombatScore,restoreDraft,matrixAttackPercentSources} from './model';
import {elementResistanceBase,personalRVProfile} from './rv-profile';
import {applyGearSwap,statImpactModel} from '../optimizer/model';
import type {BuildCatalog} from './types';

function fixture() {
  const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
  const draft=emptyDraft(catalog),matrix=structuredClone(catalog.demoDraft.weapons[0].matrices[0]);
  catalog.gear[0].allowedStats.push('HP %','Frost Resistance %');
  matrix.level=50;matrix.stars=0;draft.weapons[0].matrices[0]=matrix;
  const profile=catalog.matrixStats.profiles[catalog.matrices.find(item=>item.id===matrix.id)!.statProfiles[0]];
  profile.levels=[{level:50,stats:[{id:'CommonAtkAdded',value:100},{id:'MaxHealthAdded',value:1000},{id:'CritAdded',value:25},{id:'ElementDef',value:10}]},
    {level:100,stats:[{id:'CommonAtkAdded',value:200},{id:'MaxHealthAdded',value:2000},{id:'CritAdded',value:50},{id:'ElementDef',value:20}]}];
  profile.starMultipliers=[{stars:0,multiplier:1},{stars:3,multiplier:2}];
  const shot=catalog.consumables.findIndex(group=>group.id==='enhancement');
  draft.consumables![shot]=catalog.consumables[shot].items[0].id;
  draft.profile.level=100;draft.enemyLevel=100;draft.profile.cs=1000;
  draft.combat.hp=100000;draft.combat.hpPercent=.2;draft.combat.crit=1000;
  for(const element of draft.combat.elements){element.attack=element.id==='Altered'?15000:10000;element.attackPercent=element.id==='Altered'?0:.5;element.resistance=10000;element.resistancePercent=.3;}
  draft.rv={element:'Frost',mode:'prv',includeCrit:true,weaponId:''};
  return {draft,catalog,shot};
}

it('applies selected flat gains before percentages, updates crit and CS, and preserves the raw snapshot',()=>{
  const {draft,catalog}=fixture(),original=structuredClone(draft),combat=buildCombatDraft(draft,catalog);
  expect(combat.combat.hp).toBeCloseTo(103600);
  expect(combat.combat.crit).toBe(1075);
  expect(combat.profile.cs).toBe(1753);
  expect(elementTotalAttack(draft,catalog,'Frost').total).toBe(15450);
  expect(elementTotalAttack(combat,catalog,'Altered').total).toBe(15450);
  expect(elementResistanceBase(draft,'Frost',catalog)!.base).toBeCloseTo(10000/1.3+30);
  expect(combatRates(draft,catalog).base).toBeCloseTo(1075/catalog.reference.critFormula.denominators[100]);
  expect(buildCombatDraft(combat,catalog).combat).toEqual(combat.combat);
  expect(draft).toEqual(original);
});

it('updates percent CS pools and optimizer personal weights using the same enhanced bases',()=>{
  const {draft,catalog}=fixture(),gear=draft.gear[0];gear.equipped=true;
  gear.rows=[{type:'Frost Attack %',value:.05,beforeTitan:null},{type:'HP %',value:.03,beforeTitan:null},{type:'Frost Resistance %',value:.1,beforeTitan:null}];
  const score=gearCombatScore(gear,draft,catalog),pool=(type:string)=>score.entries.find(row=>row.type===type)!.base;
  expect(pool('Frost Attack %')).toBe(10300);
  expect(pool('HP %')).toBeCloseTo(100000/1.2+3000);
  expect(pool('Frost Resistance %')).toBeCloseTo(10000/1.3+30);
  expect(personalRVProfile(draft,catalog,'Frost')!.flatAttack).toBe(10300);
  expect(statImpactModel(draft,catalog)!.profile.flatAttack).toBe(10300);
});

it('adds selected native ATK% once and lets Altered inherit it without a second multiplier or upgraded set effects',()=>{
  const {draft,catalog}=fixture();
  const index=catalog.consumables.findIndex(group=>group.items.some(item=>item.attackPercentBonuses?.some(bonus=>bonus.elements==='all'&&bonus.values[0]===.035)));
  draft.consumables![index]=catalog.consumables[index].items.find(item=>item.attackPercentBonuses?.some(bonus=>bonus.elements==='all'&&bonus.values[0]===.035))!.id;
  const combat=buildCombatDraft(draft,catalog);
  expect(elementTotalAttack(combat,catalog,'Frost').total).toBeCloseTo(10300*1.535);
  expect(elementTotalAttack(combat,catalog,'Altered').total).toBeCloseTo(10300*1.535);
  expect(buildCombatDraft(combat,catalog).combat).toEqual(combat.combat);
  const demo=structuredClone(catalog.demoDraft);
  expect(matrixAttackPercentSources(buildCombatDraft(demo,catalog),catalog)).toEqual(matrixAttackPercentSources(demo,catalog));
});

it('keeps shot gains through optimizer swaps and restore, and removes or recalculates them once',()=>{
  const {draft,catalog,shot}=fixture(),gear=draft.gear[0];gear.equipped=true;
  const piece=structuredClone(gear);piece.rows=[{type:'Frost Attack',value:1000,beforeTitan:null},{type:'HP %',value:.1,beforeTitan:null},{type:'Frost Resistance %',value:.2,beforeTitan:null},...piece.rows.slice(3)];
  const swapped=applyGearSwap(draft,catalog,piece.id,piece)!;
  expect(swapped).not.toBeNull();
  expect(swapped.combat.hp).toBeCloseTo((100000/1.2+3000)*1.3);
  expect(swapped.combat.elements.find(row=>row.id==='Frost')!.attack).toBe(11300);
  expect(swapped.combat.elements.find(row=>row.id==='Frost')!.resistance).toBeCloseTo((10000/1.3+30)*1.5);
  const restored=restoreDraft(swapped,catalog)!;
  expect(restored).not.toBeNull();
  expect(buildCombatDraft(restored,catalog).combat).toEqual(swapped.combat);
  const disabled=structuredClone(swapped);disabled.consumables![shot]='';
  const without=buildCombatDraft(disabled,catalog);
  expect(without.combat.hp).toBeCloseTo(100000/1.2*1.3);
  expect(without.combat.elements.find(row=>row.id==='Frost')!.attack).toBe(11000);
  expect(without.combat.crit).toBe(1000);
  expect(without.profile.cs).toBe(1000);
  const max=buildCombatDraft(draft,catalog);max.weapons[0].matrices[0].level=100;max.weapons[0].matrices[0].stars=3;
  expect(buildCombatDraft(max,catalog).combat.hp).toBeCloseTo(draft.combat.hp);
});
