import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildRole,estimatedResistancePercent,gearCurrentRollValue,rollValueContext} from './model';
import {activeWeaponResonances} from './weapon-resonances';
import {standardRVProfile} from './rv-profile';
import {getBuildAugmentPools,getBuildRatedWeight,idealGearForTrack,type GearScoreReference} from '@tof-hub/game-domain';
import type {BuildCatalog,BuildDraft,GearDraft} from './types';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/build-page.json'),'utf8')) as BuildCatalog;

const item=(draft:BuildDraft,slot:string,rows:[string,number][]):GearDraft=>{
  const gear=structuredClone(draft.gear.find(g=>g.id===slot)!);
  Object.assign(gear,{equipped:true,titan:false,augmented:false,stars:5,enhancement:0,rareId:'',rareLevel:0,
    rows:rows.map(([type,value])=>({type,value,beforeTitan:value})),augments:gear.augments.map(()=>({type:'',value:0}))});
  return gear;
};
const draftFor=(role:string)=>{const draft=structuredClone(catalog.demoDraft);draft.profile.role=role;draft.rv={element:'Frost',includeCrit:true,weaponId:'',mode:'grv'};return draft;};

describe('roll value by role',()=>{
  it('treats Balance and an empty role as DPS',()=>{
    expect(buildRole(draftFor('balance'))).toBe('dps');
    expect(buildRole(draftFor(''))).toBe('dps');
    expect(buildRole(draftFor('tank'))).toBe('tank');
  });
  it('rates a healer by one ATK only: no crit, no DMG%',()=>{
    const draft=draftFor('healer');
    expect(rollValueContext(draft,catalog).role).toBe('healer');
    const gear=item(draft,'helmet',[['Frost Attack',1000],['Crit',3000],['Attack',500],['HP',10000]]);
    const score=gearCurrentRollValue(gear,draft,catalog);
    const useful=score.entries.filter(entry=>entry.useful).map(entry=>entry.type);
    expect(useful).toEqual(expect.arrayContaining(['Frost Attack','Attack']));
    expect(useful).not.toContain('Crit');
    expect(score.rollWeights.find(weight=>weight.type==='Crit')?.value??0).toBe(0);
    // The best ATK roll is the healer's 100.
    expect(Math.max(...score.rollWeights.map(weight=>weight.value??0))).toBeCloseTo(100);
  });
  it('rates a tank by resistance from the 30 000 RES reference',()=>{
    const draft=draftFor('tank');
    const gear=item(draft,'helmet',[['Resistance',2000],['Frost Resistance',2000],['Volt Resistance',2000],['Crit',3000]]);
    const score=gearCurrentRollValue(gear,draft,catalog);
    const entry=(type:string)=>score.entries.find(item=>item.type===type)!;
    expect(entry('Resistance').useful).toBe(true);
    expect(entry('Volt Resistance').useful).toBe(false);
    expect(entry('Crit').useful).toBe(false);
    // Only the selected element (Frost): general RES and Frost RES add to the same resistance; Volt RES does not count.
    expect(entry('Resistance').rv).toBeCloseTo(entry('Frost Resistance').rv);
    expect(score.profile?.resistance).toBe(30000);
    // RES% of the tank reference: an elemental RES% stat with five maximum rolls (7.87% + 5 × 9%).
    expect(score.profile?.resistancePercent).toBeCloseTo(catalog.reference.statTypes['Frost Resistance %']!.randomStatDefaultValue+5*catalog.reference.statTypes['Frost Resistance %']!.randomStatMaxRollValue);
    expect(score.profile?.resistancePercent).toBeCloseTo(.5287,4);
  });
});

describe('estimated RES% without an entered total',()=>{
  it('adds the gear RES%, the active elemental resonance and Supercomputing resistance',()=>{
    const draft=structuredClone(catalog.demoDraft);
    draft.gear.forEach(gear=>{gear.equipped=false;});
    for(const node of draft.computing)node.level=0;
    const base=estimatedResistancePercent(draft,'Frost',catalog);
    const node=catalog.computing.find(item=>item.effects.some(effect=>effect.resistanceStat==='Resistance %'))!;
    const effect=node.effects.find(item=>item.resistanceStat==='Resistance %')!;
    draft.computing.find(item=>item.id===node.id)!.level=6;
    expect(estimatedResistancePercent(draft,'Frost',catalog)-base).toBeCloseTo(effect.levels.find(level=>level.level===6)!.value);
    const resonance=activeWeaponResonances(draft,catalog).find(item=>item.element==='Frost');
    // The demo card's resonance (when active) is part of the base: its RES% is in the pipeline catalog.
    if(resonance)expect(resonance.resistancePercent).toBeCloseTo(.25);
  });
});

describe('tank effective HP weights',()=>{
  it('rates RES% over element RES over HP% over HP and general RES, with the 2.5 M HP / 30 000 RES reference',()=>{
    const draft=draftFor('tank');
    const gear=item(draft,'helmet',[['HP',1000]]);
    const weights=Object.fromEntries(gearCurrentRollValue(gear,draft,catalog).rollWeights.map(weight=>[weight.type,weight.value??0]));
    expect(weights['Frost Resistance %']).toBeCloseTo(100,0);
    expect(weights['Frost Resistance']).toBeGreaterThan(55);expect(weights['Frost Resistance']).toBeLessThan(61);
    expect(weights['HP %']).toBeGreaterThan(21);expect(weights['HP %']).toBeLessThan(27);
    expect(weights.HP).toBeGreaterThan(15);expect(weights.HP).toBeLessThan(20);
    // General RES counts as much as the element's own RES per point.
    expect(weights.Resistance!/weights['Frost Resistance']!).toBeCloseTo(catalog.reference.statTypes.Resistance!.randomStatMaxRollValue/catalog.reference.statTypes['Frost Resistance']!.randomStatMaxRollValue,3);
    expect(weights['Volt Resistance']??0).toBe(0);
  });
  it('gives each further point of resistance less (diminishing returns)',()=>{
    const low=getBuildRatedWeight('Frost Resistance',{...standardRVProfile(catalog)},'Frost',undefined,'tank');
    const high=getBuildRatedWeight('Frost Resistance',{...standardRVProfile(catalog),resistance:60000},'Frost',undefined,'tank');
    expect(high).toBeLessThan(low);
  });
});

describe('tank ceiling with the stats Titan adds',()=>{
  it('counts the HP and resistances Titan adds below, following the primary stat pools',()=>{
    const allowed=catalog.gear.find(item=>item.id==='boots')!.allowedStats;
    const ideal=idealGearForTrack(allowed,['Physical'],catalog.reference as unknown as GearScoreReference,'tank');
    expect(ideal.augments.length).toBeGreaterThan(0);
    expect(ideal.maximum).toBeCloseTo(ideal.stats.reduce((sum,stat)=>sum+stat.rv,0)+ideal.augments.reduce((sum,stat)=>sum+stat.rv,0),6);
    // Fallback (HP) opens only when fewer than two priority stats are left: a Physical RES primary with one other
    // elemental RES on top still has two unused elemental resistances, so HP cannot be added below.
    const growth=catalog.reference.titanGrowth;
    const row=(type:string)=>({type,beforeTitan:1});
    expect(getBuildAugmentPools([row('Physical Resistance'),row('Frost Resistance'),row('Crit'),row('Attack')],growth,0).fallback).toEqual([]);
    expect(getBuildAugmentPools([row('Physical Resistance'),row('Frost Resistance'),row('Flame Resistance'),row('Attack')],growth,0).fallback).toContain('HP');
    expect(getBuildAugmentPools([row('Crit'),row('Attack'),row('Frost Attack'),row('Resistance')],growth,0).fallback).toContain('HP');
  });
});
