import {BuildCaptureSchema} from '@tof-hub/contracts';
import {rollValueQuality,rollValueGradeLabels,formatStatMaximum} from './presentation';
import titanBoots from './__fixtures__/titan-boots.json';
import {getBuildAugmentPools,getBuildTitanPrimaries,getBuildTitanProjection,getBuildRollQuality,getBuildRollValue,getBuildRVWeight,getBuildIdealItem,getBuildCurrentValue} from '@tof-hub/game-domain';
import {standardRVProfile,personalRVProfile} from './rv-profile';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import {cardGear,artworkIdFromLink,randomLoadingArtwork,analyzeGear,combatRates,enhanceAllGear,emptyDraft,restoreDraft,summaryStats,supportSystem,titanMaximums,gearRVRemovedStats,gearCombatScore,gearRollValue,gearCurrentRollValue,enhancementResonance,gearBaseStats,combatStatWinners,weaponMarkBonus,additionalDamageSources,gearPercentInheritance,elementTotalAttack} from './model';
import type {BuildCatalog} from './types';
import {supportAttack} from './support-attack';
import {weaponStatBonuses,matrixStatBonuses,matrixSetPieces,matrixAttackPercentSources,attackPercentContributions,petStatBonuses,enhancementShotBonuses,petModuleBudget,petModuleOptions,petModuleRanks,gearAugmentOptions,buildRollValue,selectBuildWeapon,selectBuildMatrix,selectBuildPet,selectBuildPetModule} from './model';
import {gearElementStat,gearStatContributions,equippedGearStats,rollValueContext} from './model';
// Checked-in generated fixture: unit tests do not require the external game-data mount.
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
// Baseline cases enter totals with no selected temporary consumables.
const unbuffedDraft=()=>{const draft=structuredClone(catalog.demoDraft);draft.consumables=catalog.consumables.map(()=>'');return draft;};
it('separates fixed gear progression and random stats without changing the total',()=>{
  const draft=unbuffedDraft();
  for(const type of ['Attack','Resistance','HP','Crit','Physical Attack','Physical Attack %']) {
    const parts=gearStatContributions(draft,catalog,[type]);
    const total=draft.gear.filter(gear=>gear.equipped).flatMap(gear=>equippedGearStats(gear,catalog)).filter(stat=>stat.type===type).reduce((sum,stat)=>sum+stat.value,0);
    expect(parts.total).toBeCloseTo(total);expect(parts.progression+parts.rolls).toBeCloseTo(total);
  }
  for(const element of ['Physical','Flame','Frost','Volt'])expect(gearElementStat(draft,catalog,element,'Attack')).toBeCloseTo(gearElementStat(draft,catalog,element,'Attack','progression')+gearElementStat(draft,catalog,element,'Attack','rolls'));
  draft.gear.forEach(gear=>{gear.equipped=false;});
  expect(gearStatContributions(draft,catalog,['Attack'])).toEqual({progression:0,rolls:0,total:0});
});
it.each((['prv','grv'] as const).flatMap(mode=>['dps','healer','tank'].flatMap(role=>['Frost','Volt','Altered'].map(element=>({mode,role,element})))))('keeps fast $mode/$role/$element totals equal to the detailed card ratings',({mode,role,element})=>{
    const draft=unbuffedDraft();
    draft.gear=draft.gear.slice(0,2);
    draft.profile.role=role;draft.rv={mode,element,includeCrit:true};
    for(const partial of [false,true]) {
      if(partial)draft.gear[0].equipped=false;
      const detailed=draft.gear.map(gear=>gearCurrentRollValue(cardGear(gear,draft,catalog),draft,catalog));
      const equipped=detailed.filter((_,index)=>draft.gear[index].equipped);
      const actual=buildRollValue(draft,catalog);
      expect(actual.value).toBe(equipped.every(score=>score.value!==null)?equipped.reduce((sum,score)=>sum+score.value!,0):null);
      expect(actual.maximum).toBe(detailed.reduce((sum,score)=>sum+score.maximum,0));
    }
},20000);
it('rates Build GRV flat ATK from the whole duo pair regardless of selected element',()=>{
  const draft=unbuffedDraft();draft.rv={mode:'grv',element:'Frost',includeCrit:true};
  const gear=draft.gear.find(item=>item.id==='reactor')!;
  gear.rows=[{type:'Volt Attack',value:912,beforeTitan:600},{type:'Frost Attack',value:800,beforeTitan:500},
    {type:'Attack',value:495,beforeTitan:400},{type:'HP',value:23398,beforeTitan:20000}];
  gear.augments=[];
  const frost=gearCurrentRollValue(gear,draft,catalog);
  expect(frost.flatElements).toEqual(['Frost','Volt']);
  expect(frost.entries.find(row=>row.type==='Volt Attack')?.rv).toBeGreaterThan(0);
  expect(frost.entries.find(row=>row.type==='Frost Attack')?.rv).toBe(0);
  draft.rv.element='Volt';
  const volt=gearCurrentRollValue(gear,draft,catalog);
  expect(volt.value).toBeCloseTo(frost.value!,12);
  expect(volt.maximum).toBeCloseTo(frost.maximum,12);
  expect(volt.entries.find(row=>row.type==='Volt Attack')?.rv).toBeCloseTo(frost.entries.find(row=>row.type==='Volt Attack')!.rv,12);
  draft.rv.element='Frost';gear.rows[1]!.value=1000;
  const switched=gearCurrentRollValue(gear,draft,catalog);
  expect(switched.entries.find(row=>row.type==='Frost Attack')?.rv).toBeGreaterThan(0);
  expect(switched.entries.find(row=>row.type==='Volt Attack')?.rv).toBe(0);
  draft.weapons=[];
  expect(gearCurrentRollValue(gear,draft,catalog).flatElements).toBeUndefined();
  draft.profile.role='tank';
  expect(gearCurrentRollValue(gear,draft,catalog).flatElements).toBeUndefined();
});
it('caps finite PRV rolls and recalculates both Crit weights at the selected enemy level',()=>{
  const draft=unbuffedDraft();draft.weapons=[];
  draft.rv={mode:'prv',element:'Frost',includeCrit:true};draft.enemyLevel=100;
  const denominator=catalog.reference.critFormula.denominators[100]!;
  draft.combat.crit=denominator*.999;draft.combat.additionalCritRate=0;
  const anchor={...draft.gear[0]!,equipped:false};
  const score=gearRollValue(anchor,draft,catalog);
  for(const type of ['Crit','Crit Rate %']) {
    const row=score.rollWeights.find(row=>row.type===type)!;
    const expected=100*.001*.5/(1+.999*.5)/score.normalization;
    expect(row.value).toBeCloseTo(expected,10);
    expect(row.minValue).toBeCloseTo(expected,10);
  }
  const options={types:catalog.reference.statTypes,growth:catalog.reference.titanGrowth,element:'Frost',percentElements:['Frost'],includeCrit:true,
    allowedTypes:catalog.gear.find(gear=>gear.id==='boots')!.allowedStats,maxStats:4,maxRolls:5,profile:score.profile!};
  const ideal=getBuildIdealItem(options);
  expect(ideal.stats.reduce((sum,row)=>sum+row.rolls,0)).toBe(5);
  expect(ideal.stats.find(row=>row.type==='Crit')?.rolls??0).toBe(0);
  expect(getBuildCurrentValue({...options,rows:ideal.stats,added:ideal.augments}).value).toBeCloseTo(ideal.maximum,10);
  const rating=draft.combat.crit;
  draft.enemyLevel=1;
  const capped=gearRollValue(anchor,draft,catalog);
  for(const type of ['Crit','Crit Rate %'])expect(capped.rollWeights.find(row=>row.type===type)!.value).toBe(0);
  expect(draft.combat.crit).toBe(rating);
  draft.rv.mode='grv';
  const global=gearRollValue(anchor,draft,catalog);draft.enemyLevel=100;
  expect(gearRollValue(anchor,draft,catalog).rollWeights).toEqual(global.rollWeights);
});
it('counts own Space Support once and removes partner support before inheriting its base',()=>{
  const draft=unbuffedDraft();
  draft.rv={mode:'prv',element:'Volt',includeCrit:true};
  draft.support.forEach(module=>{module.level=module.id===catalog.support.modules.find(item=>item.attackStat==='Volt Attack')!.id?5:0;});
  const frost=draft.combat.elements.find(item=>item.id==='Frost')!;
  const volt=draft.combat.elements.find(item=>item.id==='Volt')!;
  // No gear ATK% here: the result follows the own ATK% column only.
  draft.gear.forEach(gear=>{gear.equipped=false;});
  frost.attack=60000;frost.attackPercent=0;volt.attack=50000;volt.attackPercent=0;
  expect(supportAttack(draft,catalog,'Volt')).toBe(750);
  // (max base without support + own S) × (1 + ATK%)
  expect(elementTotalAttack(draft,catalog,'Volt')).toMatchObject({base:60000,supportBase:750,attack:60750,support:0,total:60750,source:'Frost'});
  expect(elementTotalAttack(draft,catalog,'Frost').total).toBe(60000);
  volt.attackPercent=.5;
  expect(elementTotalAttack(draft,catalog,'Volt').total).toBe(91125);
  volt.attack=70000;
  expect(elementTotalAttack(draft,catalog,'Volt')).toMatchObject({base:69250,total:105000,inherited:false});
  // The partner takes the higher base but not Volt's Space Support.
  expect(elementTotalAttack(draft,catalog,'Frost').total).toBe(69250);
  draft.support.forEach(module=>{module.level=0;});
  expect(elementTotalAttack(draft,catalog,'Volt').total).toBe(105000);
});
it('Fusion Frost–Volt reproduces Lilou 118900.21 using native endpoints and one support bonus',()=>{
  const draft=unbuffedDraft();
  draft.rv={mode:'prv',element:'Frost',includeCrit:true};
  const frostModule=catalog.support.modules.find(item=>item.attackStat==='Frost Attack')!;
  draft.support.forEach(module=>{module.level=module.id===frostModule.id?5:0;});
  const frost=draft.combat.elements.find(item=>item.id==='Frost')!,volt=draft.combat.elements.find(item=>item.id==='Volt')!;
  // Real Lilou build: DisplayBase and gear ATK% (Volt 0.203174 wins over Frost 0.128666). The displayed totals 142.9% /
  // 88.3% are rounded; the exact own ATK% follows from the in-game final ATK (Frost 112067.695 = DisplayBase × (1 + p), Volt 88037.961).
  const frostPercent=112067.6953125/46143.7265625-1,voltPercent=88037.9609375/46749.78125-1;
  Object.assign(frost,{attack:46143.7265625,attackPercent:frostPercent});
  Object.assign(volt,{attack:46749.78125,attackPercent:voltPercent});
  const row=(type:string,value:number)=>({type,value,beforeTitan:null});
  draft.gear.forEach(gear=>{gear.equipped=false;gear.titan=false;gear.augmented=false;});
  Object.assign(draft.gear[0]!,{equipped:true,rows:[row('Frost Attack %',.128666),row('Volt Attack %',.203174)]});
  const S=supportAttack(draft,catalog,'Frost');
  expect(S).toBe(750);expect(supportAttack(draft,catalog,'Volt')).toBe(0);
  const result=elementTotalAttack(draft,catalog,'Frost');
  expect(result).toMatchObject({base:46749.78125,supportBase:750,source:'Volt',inherited:true});
  expect(result.percent).toBeCloseTo(frostPercent-.128666+.203174,10);
  expect(result.total).toBeCloseTo((46749.78125+S)*(1+frostPercent-.128666+.203174),6);
  // Independent in-game tooltip observation: 118 900 after rounding.
  expect(result.total).toBeCloseTo(118900.21279521023,6);
  expect(Math.round(result.total)).toBe(118900);
  // Control: Volt is the maximum base with S = 0 and keeps the in-game total.
  expect(elementTotalAttack(draft,catalog,'Volt')).toMatchObject({base:46749.78125,supportBase:0,source:'Volt',inherited:false});
  expect(elementTotalAttack(draft,catalog,'Volt').total).toBeCloseTo(88037.9609375,6);
  // The ranking baseline is untouched.
  expect(standardRVProfile(catalog).flatAttack).toBe(52500);
});
it('restores optional weapon configuration, rejects invalid choices and clears it on replacement',()=>{
  const configured=structuredClone(catalog),id=configured.demoDraft.weapons[0].id;
  const weapon=configured.weapons.find(weapon=>weapon.id===id)!;
  weapon.selectableElements=[{id:'Volt',elements:['Volt','Frost']}];
  weapon.selectableSkills=['one','two'].map(id=>({id,name:{en:id,ru:id},icon:'',description:{en:'',ru:''}}));
  const draft=structuredClone(configured.demoDraft);
  draft.weapons[0].element='Volt';draft.weapons[0].skills=['two','one'];
  expect(restoreDraft(draft,configured)?.weapons[0]).toMatchObject({element:'Volt',skills:['two','one']});
  draft.weapons[0].skills=['one','one'];expect(restoreDraft(draft,configured)).toBeNull();
  draft.weapons[0].skills=['one',''];draft.weapons[0].element='invalid';expect(restoreDraft(draft,configured)).toBeNull();
  selectBuildWeapon(draft,0,id,configured);
  expect(draft.weapons[0].element).toBeUndefined();expect(draft.weapons[0].skills).toBeUndefined();
});
// Independent reference math: 100 RV is one maximal Crit gain after Titan.
const RV_Q=1169*1.1*.5/(28213*1.375);
const RV_FLAT_UNIT=52500*RV_Q;
it('uses one common damage baseline and normalizes the strongest Titan roll to 100',()=>{
  const profile=standardRVProfile(catalog);
  const expected:{type:string;rv:number}[]=[{type:'Crit',rv:100},{type:'Frost Attack',rv:41.4144636441403*50000/52500},{type:'Attack',rv:31.0608477331052*50000/52500},{type:'Frost Attack %',rv:36.4910658682635},{type:'Frost Damage %',rv:33.7880239520958*1.35/1.5},{type:'Crit Rate %',rv:27.4143739793141}];
  for(const {type,rv} of expected){const bounds=catalog.reference.statTypes[type];expect(100*bounds.randomStatMaxRollValue*(1+bounds.maxAugmentIncreaseMultiplier)*getBuildRVWeight(type,profile)/RV_Q).toBeCloseTo(rv,8);}
  const draft=unbuffedDraft();
  const before=draft.gear.map(g=>gearRollValue(g,draft,catalog));
  draft.combat.crit=99999;draft.combat.additionalCritRate=1;draft.combat.critDamage=2;draft.enemyLevel=1;
  draft.combat.elements.forEach(e=>{e.attack*=3;e.attackPercent=4;e.damage=2;});
  expect(draft.gear.map(g=>gearRollValue(g,draft,catalog))).toEqual(before);
});
it('accepts another explicit reference profile without using owner stats or stale ceilings',()=>{
  const gear=catalog.demoDraft.gear[0];
  const options={rows:gear.rows.map(r=>({type:r.type,beforeTitan:r.beforeTitan})),types:catalog.reference.statTypes,growth:catalog.reference.titanGrowth,element:'Frost',percentElements:['Frost','Volt'],includeCrit:true,allowedTypes:catalog.gear[0].allowedStats,stars:5,maxStats:4,maxRolls:5};
  const original=getBuildRollValue({...options,profile:standardRVProfile(catalog)});
  const changed=getBuildRollValue({...options,profile:{...standardRVProfile(catalog),flatAttack:2*standardRVProfile(catalog).flatAttack}});
  expect(changed.value).toBeCloseTo(original.value!/2);
  expect(changed.maximum).toBeCloseTo(original.maximum/2);
  expect(changed.normalization).toBe(original.normalization);
  expect(getBuildRollValue({...options,profile:{...standardRVProfile(catalog),flatAttack:0}}).value).toBeNull();
});
it('starts Crit DMG at 50% and derives example damage only from generated sources',()=>{
  expect(emptyDraft(catalog).combat.critDamage).toBe(.5);
  expect(emptyDraft(catalog).combat.elements.every(element=>element.damage===0)).toBe(true);
  expect(catalog.demoDraft.combat.critDamage).toBe(.5);
  const draft=catalog.demoDraft;
  for(const element of draft.combat.elements) {
    const gear=draft.gear.filter(g=>g.equipped).flatMap(g=>[...g.rows,...(g.augmented||g.titan?g.augments:[])]).filter(s=>s.type===`${element.id} Damage %`||s.type==='Damage %').reduce((sum,s)=>sum+s.value,0);
    const systems=additionalDamageSources(draft,catalog).filter(s=>!s.conditional&&s.elements.includes(element.id)).reduce((sum,s)=>sum+s.value,0);
    expect(element.damage).toBeCloseTo(gear+systems);
  }
});
it('highlights matrix pairs in display order without changing the strongest rank',()=>{
  const matrices=catalog.demoDraft.weapons[0].matrices;
  // Display order Emotion, Mind / Belief, Memory = slots 3, 0 / 2, 1.
  expect(matrixSetPieces(matrices,3).indices).toEqual([3,0]);
  expect(matrixSetPieces(matrices,3).rank(2)).toBe(3);
  expect(matrixSetPieces(matrices,1).indices).toEqual([3,0,2,1]);
});
it('calculates the pet Crit chance against the selected enemy without player Crit bonuses',()=>{
  const draft=unbuffedDraft();
  draft.combat.additionalCritRate=.99;
  expect(petStatBonuses(draft,catalog)!.critChance).toBeCloseTo(5950/catalog.reference.critFormula.denominators[draft.enemyLevel]);
  draft.enemyLevel=100;
  expect(petStatBonuses(draft,catalog)!.critChance).toBeCloseTo(5950/catalog.reference.critFormula.denominators[100]);
  draft.enemyLevel=999;
  expect(petStatBonuses(draft,catalog)!.critChance).toBeNull();
});
it('selects the strongest two-piece ATK% sources and distinguishes element scopes',()=>{
  const draft=unbuffedDraft();
  const sources=matrixAttackPercentSources(draft,catalog);
  expect(sources).toHaveLength(3);
  const frost=sources.find(s=>s.weaponIndex===0)!;
  expect(frost.indices).toEqual([3,0]);
  expect(frost.rank).toBe(3);
  expect(frost.bonuses[0]).toMatchObject({elements:['Frost'],value:.34});
  expect(sources.find(s=>s.weaponIndex===1)!.bonuses[0].elements).toEqual(Object.keys(catalog.elementIcons));
  // Night City: ★2 + ★1 pieces rank the pair at ★1.
  expect(sources.find(s=>s.weaponIndex===2)!).toMatchObject({indices:[2,3],rank:1});
  expect(sources.find(s=>s.weaponIndex===2)!.bonuses[0]).toMatchObject({value:expect.closeTo(.026,10),maxStacks:5,conditional:true});
  draft.weapons[1].matrices=draft.weapons[0].matrices.map(m=>({...m,stars:1}));
  expect(matrixAttackPercentSources(draft,catalog).filter(s=>s.id===frost.id)).toHaveLength(1);
  expect(matrixAttackPercentSources(draft,catalog).find(s=>s.id===frost.id)!.weaponIndex).toBe(0);
  draft.weapons[0].matrices.forEach((m,i)=>{if(i!==0)m.id='';});
  expect(matrixAttackPercentSources(draft,catalog).find(s=>s.id===frost.id)!.weaponIndex).toBe(1);
  const pair=attackPercentContributions([{elements:['Flame','Physical'],values:[.2,.22,.24,.26]}],2,catalog);
  expect(pair[0]).toMatchObject({elements:['Flame','Physical'],value:.24});
  const conditional=[{elements:'all' as const,values:[.3],condition:'benediction' as const}];
  expect(attackPercentContributions(conditional,0,catalog)).toEqual([]);
  expect(attackPercentContributions(conditional,0,catalog,true)[0].value).toBe(.3);
});
it('materializes the mutually exclusive attack shots and elemental food bonuses',()=>{
  const shots=catalog.consumables.find(g=>g.id==='attack')!.items;
  expect(shots.map(item=>item.attackPercentBonuses![0].values[0]).sort()).toEqual([.025,.035]);
  const food=catalog.consumables.find(g=>g.id==='food')!.items.find(item=>item.name.en==='Power Nutripaste')!;
  expect(attackPercentContributions(food.attackPercentBonuses,0,catalog)[0]).toMatchObject({elements:['Physical'],value:.12});
});
it('uses Global pet inheritance, averages four elements and keeps pet stats separate from the player',()=>{
  const draft=unbuffedDraft();
  const result=petStatBonuses(draft,catalog)!;
  expect(result.attack).toBe(6855);
  expect(result.crit).toBe(5950);
  expect(result.critDamage).toBe(.5);
  expect(result.inheritanceRate).toBe(.1);
  expect(result.inheritanceElements).toEqual(['Flame','Frost','Volt','Physical']);
  const average=['Flame','Frost','Volt','Physical'].reduce((sum,id)=>sum+draft.combat.elements.find(e=>e.id===id)!.attack,0)/4;
  expect(result.inheritedAttack).toBeCloseTo(average*.1);
  expect(result.totalAttack).toBeCloseTo(6855+average*.1);
  draft.combat.elements.find(e=>e.id==='Altered')!.attack=999999;
  expect(petStatBonuses(draft,catalog)).toEqual(result);
  draft.pet.stars=0;
  expect(petStatBonuses(draft,catalog)!.inheritedAttack).toBeCloseTo(average*.04);
  draft.pet.level=1;
  expect(petStatBonuses(draft,catalog)!.attack).toBe(685);
  draft.combat.elements=draft.combat.elements.filter(e=>e.id!=='Flame');
  expect(petStatBonuses(draft,catalog)!.inheritedAttack).toBeNull();
  draft.pet.id='';
  expect(petStatBonuses(draft,catalog)).toBeNull();
});
it('calculates Enhancement Shot gains from weapon levels and matrix levels/stars',()=>{
  const draft=unbuffedDraft();
  const demo=enhancementShotBonuses(draft,catalog);
  // Demo: Lv.200/180/160 weapons; ★3 Lv.100 matrices are complete, lower stars or levels still gain.
  expect(demo.weapons.map(w=>w.weapon.some(s=>s.value>0))).toEqual([false,true,true]);
  expect(demo.weapons.map(w=>w.matrices.map(m=>m.some(s=>s.value>0)))).toEqual([[false,true,true,false],[true,true,true,true],[false,true,true,true]]);
  const weapon=draft.weapons[0];
  weapon.level=100;
  weapon.matrices[0].level=50;
  weapon.matrices[0].stars=0;
  const result=enhancementShotBonuses(draft,catalog).weapons[0];
  const current=weaponStatBonuses(weapon,catalog);
  const maximum=weaponStatBonuses({...weapon,level:catalog.defaultLevels.weapon},catalog);
  expect(result.weapon).toEqual(maximum.map(s=>({id:s.id,value:s.value-current.find(c=>c.id===s.id)!.value})));
  expect(result.matrices[0].every(s=>s.value>0)).toBe(true);
  // Advancement scales weapon stats (WeaponUpgradeStarData), so the gain is recomputed at ★0.
  weapon.stars=0;
  const unstarred=weaponStatBonuses(weapon,catalog);
  expect(enhancementShotBonuses(draft,catalog).weapons[0].weapon).toEqual(weaponStatBonuses({...weapon,level:catalog.defaultLevels.weapon},catalog).map(s=>({id:s.id,value:s.value-unstarred.find(c=>c.id===s.id)!.value})));
});
it('scores Enhancement Shot flat gains once and keeps zero/missing weights explicit',()=>{
  const reference=structuredClone(catalog),draft=emptyDraft(reference);
  const matrix=structuredClone(catalog.demoDraft.weapons[0].matrices[0]);
  matrix.level=50;matrix.stars=0;draft.weapons[0].matrices[0]=matrix;
  const profile=reference.matrixStats.profiles[reference.matrices.find(m=>m.id===matrix.id)!.statProfiles[0]];
  profile.levels=[{level:50,stats:[{id:'CommonAtkAdded',value:100},{id:'MaxHealthAdded',value:1000},{id:'CritAdded',value:25},{id:'ElementDef',value:10}]},
    {level:100,stats:[{id:'CommonAtkAdded',value:200},{id:'MaxHealthAdded',value:2000},{id:'CritAdded',value:50},{id:'ElementDef',value:20}]}];
  profile.starMultipliers=[{stars:0,multiplier:1},{stars:3,multiplier:2}];
  // +300 universal ATK, +3000 HP, +75 Crit, +30 universal RES; each counts once.
  expect(enhancementShotBonuses(draft,reference).combatScore).toBe(753);
  draft.combat.elements.forEach(element=>{element.attackPercent=3;});
  expect(enhancementShotBonuses(draft,reference).combatScore).toBe(753);
  delete reference.csRules.weights.Crit;
  expect(enhancementShotBonuses(draft,reference).combatScore).toBeNull();
  matrix.level=100;matrix.stars=3;
  expect(enhancementShotBonuses(draft,reference).combatScore).toBe(0);
  expect(enhancementShotBonuses(emptyDraft(reference),reference).combatScore).toBe(0);
});

it('grades Crit gains after removing the base and minimum roll contribution',()=>{
  const bounds=catalog.reference.statTypes.Crit;
  expect(getBuildRollQuality(726-bounds.randomStatDefaultValue,1,bounds)).toBe(0);
  expect(getBuildRollQuality(1076.5-bounds.randomStatDefaultValue,1,bounds)).toBe(.5);
  expect(getBuildRollQuality(1427-bounds.randomStatDefaultValue,1,bounds)).toBe(1);
  const draft=unbuffedDraft();
  const summary=summaryStats(draft,catalog).find(stat=>stat.type==='Crit')!;
  expect(summary.rolls).toBe(6);
  expect(summary.quality).toBeCloseTo(5/6);
});
it('restores optional consumables and rejects items in the wrong slot',()=>{
  const draft=emptyDraft(catalog);
  expect(draft.consumables).toEqual(['','','','']);
  delete draft.consumables;
  expect(restoreDraft(draft,catalog)?.consumables).toEqual(['','','','']);
  draft.consumables=catalog.consumables.map(group=>group.items[0].id);
  expect(restoreDraft(draft,catalog)?.consumables).toEqual(draft.consumables);
  draft.consumables[1]=catalog.consumables[1].items[1].id;
  expect(restoreDraft(draft,catalog)?.consumables?.[1]).toBe(catalog.consumables[1].items[1].id);
  draft.consumables[0]=draft.consumables[1];
  expect(restoreDraft(draft,catalog)).toBeNull();
  expect(catalog.consumables[0].items.length).toBeGreaterThan(0);
  expect(catalog.consumables.slice(1).map(group=>group.items.length)).toEqual([2,1,1]);
  expect(catalog.consumables.map((group,index)=>group.items.find(item=>item.id===catalog.demoDraft.consumables?.[index])?.name.en)).toEqual(['Power Nutripaste','Enhanced Blade Shot','Enhancement Shot','Piercing Shot']);
});
it('totals equipped RV slots from current values and skips unequipped ones',()=>{
  const draft=unbuffedDraft();
  // The card scores each item as the build uses it: on a duo pair only the winning ATK % / DMG % element (cardGear).
  const expected=draft.gear.reduce((sum,gear)=>sum+gearCurrentRollValue(cardGear(gear,draft,catalog),draft,catalog).value!,0);
  expect(buildRollValue(draft,catalog).value).toBeCloseTo(expected);
  expect(expected).toBeLessThan(draft.gear.reduce((sum,gear)=>sum+gearCurrentRollValue(gear,draft,catalog).value!,0));
  const first=gearCurrentRollValue(draft.gear[0],draft,catalog).value!;
  draft.gear[0].equipped=false;
  expect(expected-first).toBeGreaterThan(0);
  expect(buildRollValue(draft,catalog).value).toBeCloseTo(expected-first);
  // Current values need no pre-Titan history: an unknown base no longer blanks the total.
  draft.gear[1].rows[0].beforeTitan=null;
  expect(buildRollValue(draft,catalog).value).toBeCloseTo(expected-first);
  draft.gear.forEach(gear=>gear.equipped=false);
  expect(buildRollValue(draft,catalog).value).toBeNull();
});

describe('build draft and calculations',()=>{
  it('restores an empty draft with unset level contexts and numeric zeroes',()=>{
    const draft=emptyDraft(catalog);
    expect(draft.profile).toMatchObject({name:'',level:0,cs:0,apexCs:0});
    expect(draft.enemyLevel).toBe(0);
    expect(restoreDraft(draft,catalog)).toEqual(draft);
    expect(restoreDraft({...draft,profile:{...draft.profile,cs:null,apexCs:null}},catalog)?.profile.cs).toBeNull();
  });
  it('preserves the maximum GS achievement time with an explicit timezone',()=>{
    const draft=emptyDraft(catalog);
    expect(restoreDraft(draft,catalog)?.profile.apexGsAchievedAt).toBeUndefined();
    expect(restoreDraft({...draft,profile:{...draft.profile,apexGsAchievedAt:null}},catalog)?.profile.apexGsAchievedAt).toBeNull();
    expect(restoreDraft({...draft,profile:{...draft.profile,apexGsAchievedAt:'2026-10-02T14:34:56+02:00'}},catalog)?.profile.apexGsAchievedAt).toBe('2026-10-02T12:34:56.000Z');
    for(const time of ['2026-10-02T12:34:56','not-a-date','2026-99-99T12:34:56Z','2026-02-31T12:34:56Z'])expect(restoreDraft({...draft,profile:{...draft.profile,apexGsAchievedAt:time}},catalog)).toBeNull();
  });
  it('restores catalog-backed drafts and strips untrusted provenance/media fields',()=>{
    const value={...catalog.demoDraft,status:'verified',customArt:'javascript:alert(1)'};
    const restored=restoreDraft(value,catalog);
    // Drafts without the Titan click count (older ones, the demo) restore it as unknown.
    expect(restored).toEqual({...catalog.demoDraft,art:{...catalog.demoDraft.art,offsetX:0,offsetY:0},gear:catalog.demoDraft.gear.map(gear=>({...gear,augmentCount:gear.augmentCount??null})),
      profile:{...catalog.demoDraft.profile,roleId:catalog.demoDraft.profile.roleId??''}});
    expect(restoreDraft({...value,gear:value.gear.map(gear=>({...gear,augmentCount:180}))},catalog)?.gear[0]?.augmentCount).toBe(180);
    expect(restoreDraft({...value,gear:value.gear.map(gear=>({...gear,augmentCount:-1}))},catalog)).toBeNull();
    expect(restored).not.toHaveProperty('status');
    expect(restored).not.toHaveProperty('customArt');
    expect(restoreDraft({...value,art:{...value.art,offsetX:-180,offsetY:240}},catalog)?.art).toMatchObject({offsetX:-180,offsetY:240});
    expect(restoreDraft({...value,art:{...value.art,offsetX:Infinity}},catalog)).toBeNull();
    const updatedAt='2026-10-01T12:00:00.000Z';
    expect(restoreDraft({...value,updatedAt},catalog)?.updatedAt).toBe(updatedAt);
    expect(restoreDraft({...value,updatedAt:'invalid'},catalog)).not.toHaveProperty('updatedAt');
    const legacyProfile={...value.profile,avatarId:'gefion'};delete legacyProfile.avatarFrameId;
    expect(restoreDraft({...value,profile:legacyProfile},catalog)?.profile.avatarId).toBe(catalog.avatarAliases.gefion);
    expect(restoreDraft({...value,profile:legacyProfile},catalog)?.profile.avatarFrameId).toBe('');
    expect(restoreDraft({...value,profile:{...value.profile,avatarFrameId:'invalid'}},catalog)).toBeNull();
    const legacyPet={...value.pet};delete legacyPet.moduleLevels;
    const legacyCombat={...value.combat};delete legacyCombat.endurance;
    expect(restoreDraft({...value,combat:legacyCombat},catalog)?.combat.endurance).toBe(0);
    expect(restoreDraft({...value,pet:legacyPet},catalog)?.pet.moduleLevels).toEqual([0,0,0,0]);
    expect(restoreDraft({...value,pet:{...value.pet,moduleLevels:[999,0,0,0]}},catalog)).toBeNull();
    expect(restoreDraft({...value,weapons:[]},catalog)).toBeNull();
    const invalid=structuredClone(value);invalid.weapons[0].id='https://untrusted.test/image';
    expect(restoreDraft(invalid,catalog)).toBeNull();
  });
  it('uses enemy level for crit while preserving original rating',()=>{
    const draft=unbuffedDraft();
    expect(combatRates(draft,catalog).base).toBeCloseTo(.8353,4);
    draft.enemyLevel=100;
    expect(combatRates(draft,catalog).base).toBeCloseTo(.7032,4);
    expect(draft.combat.crit).toBe(19840);
  });
  it('determines rolls from all four stats and never guesses missing histories',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]);
    expect(analyzeGear(gear,catalog).rolls).toEqual([3,1,1,0]);
    gear.rows[0].beforeTitan=null;
    expect(analyzeGear(gear,catalog).rolls).toEqual([null,null,null,null]);
    expect(titanMaximums(gear,catalog).added).toEqual([null,null]);
  });
  it('keeps the captured boots elemental ATK below their ceilings regardless of tied row order',()=>{
    const gear=structuredClone(titanBoots);
    for(const reverse of [false,true]) {
      if(reverse)gear.rows.reverse();
      const maximum=titanMaximums(gear,catalog);
      for(const type of ['Volt Attack','Physical Attack']) {
        const index=gear.rows.findIndex(row=>row.type===type);
        expect(maximum.random[index]).toBeCloseTo(400.9);
        expect(gear.rows[index].value/maximum.random[index]!).toBeLessThan(1);
      }
    }
  });
  it('matches upstream fractional Titan maxima and primary-scaled fallback growth',()=>{
    // apache1123/tof-tools@52a960e: RandomStat.getMaxAugmentTotalValue;
    // AugmentStat inherits RandomStat. Flat values are not rounded in this model.
    const gear=structuredClone(catalog.demoDraft.gear.find(g=>g.id==='boots')!);
    gear.rows=[
      {type:'Frost Attack',beforeTitan:69,value:400},
      {type:'Attack',beforeTitan:52,value:301},
      {type:'Crit',beforeTitan:6103,value:7934},
      {type:'HP',beforeTitan:4125,value:24062},
    ];
    gear.augments=[{type:'Frost Resistance',value:1253},{type:'Volt Resistance',value:1253}];
    const maximum=titanMaximums(gear,catalog);
    expect(maximum.random).toEqual(expect.arrayContaining([expect.closeTo(400.9),expect.closeTo(301.2),expect.closeTo(7934.3),expect.closeTo(24062.5)]));
    // Resistance additions take addedStatShare of the Crit primary's rolls after Titan, in the Resistance range, no growth.
    const crit=catalog.reference.statTypes.Crit,res=catalog.reference.statTypes['Frost Resistance'];
    const share=catalog.reference.titanGrowth.addedStatShare??1;
    const resistance=res.randomStatDefaultValue+share*(7934.3-crit.randomStatDefaultValue)/crit.randomStatMaxRollValue*res.randomStatMaxRollValue;
    expect(maximum.added).toEqual([expect.closeTo(resistance),expect.closeTo(resistance)]);
    expect(400/maximum.random[0]!*100).toBeCloseTo(99.7755,4);
    expect(formatStatMaximum(maximum.random[0]!,false,'en')).toBe('400.9');
    expect(formatStatMaximum(maximum.random[0]!,false,'ru')).toBe('400,9');
    expect(formatStatMaximum(.03681,true,'en')).toBe('3.6810%');
    gear.stars=4;gear.rows[2].beforeTitan=4934;
    expect(analyzeGear(gear,catalog).combinations.length).toBeGreaterThan(0);
    expect(titanMaximums(gear,catalog)).toEqual({random:[null,null,null,null],added:[null,null]});
  });
  it('keeps a known Titan ceiling despite ambiguous roll counts',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]);
    gear.rows=[
      {type:'Frost Attack',beforeTitan:693,value:1087},
      {type:'HP',beforeTitan:26565,value:48746},
      {type:'Attack',beforeTitan:52,value:301},
      {type:'Resistance',beforeTitan:64,value:375},
    ];
    // Ambiguous splits still show the most likely one, marked as an estimate.
    expect(analyzeGear(gear,catalog).estimated.slice(0,2)).toEqual([true,true]);
    expect(analyzeGear(gear,catalog).rolls.slice(0,2).every(n=>Number.isInteger(n))).toBe(true);
    expect(titanMaximums(gear,catalog).random[0]).toBeCloseTo(1087.3);
    // Added elemental ATK: a share of the primary's rolls after Titan (addedStatShare), not upstream's fixed 0.95 × primary.
    const share=catalog.reference.titanGrowth.addedStatShare!;
    expect(titanMaximums(gear,catalog).added[0]).toBeCloseTo(69+share*(1087.3-69));
  });
  it('uses selected Titan ATK% additions to resolve a tied ATK% vs DMG% primary',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]);
    gear.stars=5;
    gear.rows=[
      {type:'Frost Attack %',beforeTitan:.0414,value:.0510},
      {type:'Flame Damage %',beforeTitan:.0209,value:.0258},
      {type:'Volt Damage %',beforeTitan:.0065,value:.0234},
      {type:'Physical Attack',beforeTitan:194,value:628},
    ];
    gear.augments=[{type:'Volt Attack %',value:.048},{type:'Physical Attack %',value:.0489}];
    expect(analyzeGear(gear,catalog).combinations.length).toBeGreaterThan(0);
    const primaries=getBuildTitanPrimaries(gear.rows,catalog.reference.statTypes);
    expect(primaries).toEqual([0,1]);
    expect(titanMaximums(gear,catalog).added.every(value=>value!==null)).toBe(true);
  });
  it('excludes Titan additions and main stats from the footer',()=>{
    const d=unbuffedDraft();
    const before=summaryStats(d,catalog);
    expect(before.every(stat=>stat.rolls!==0)).toBe(true);
    expect(before.some(stat=>stat.type==='Flame Attack')).toBe(false);
    d.gear[0].augments[0].value+=10000;
    d.gear[0].base[0].value+=10000;
    d.gear[0].rows[0].value+=10000;
    expect(summaryStats(d,catalog)).toEqual(before);
    expect(before[0].type).toBe('HP');
    const resistance=before.find(stat=>stat.type==='Flame Resistance %')!;
    expect(resistance).toMatchObject({rolls:1});
    expect(resistance.value).toBeCloseTo(.09,8);
    expect(resistance.maximum).toBeCloseTo(.09,8);
    for(const stat of before){
      const bounds=catalog.reference.statTypes[stat.type];
      const contribution=d.gear.filter(g=>g.equipped).flatMap(g=>g.rows).filter(r=>r.type===stat.type&&r.beforeTitan!==null).reduce((sum,row)=>sum+row.beforeTitan!-bounds.randomStatDefaultValue,0);
      expect(stat.value).toBeCloseTo(contribution,8);
      expect(stat.maximum).toBeCloseTo(stat.rolls!*bounds.randomStatMaxRollValue,8);
    }
  });
  it('unlocks support only when every module reaches the next tier threshold',()=>{
    const d=emptyDraft(catalog);
    d.support.forEach(s=>{s.level=0;});
    expect(supportSystem(d,catalog).maxModuleLevel).toBe(5);
    d.support.forEach(s=>{s.level=5;});
    expect(supportSystem(d,catalog).maxModuleLevel).toBe(10);
    d.support.at(-1)!.level=4;
    expect(supportSystem(d,catalog).maxModuleLevel).toBe(5);
  });
  it('keeps the approved element and computing order and valid Titan maxima',()=>{
    expect(catalog.demoDraft.combat.elements.map(e=>e.id)).toEqual(['Frost','Volt','Flame','Physical','Altered']);
    expect(catalog.demoDraft.computing.map(n=>n.id)).toEqual(catalog.computing.map(n=>n.id));
    const first=catalog.demoDraft.gear[0].rows[0];
    const bounds=catalog.reference.statTypes[first.type];
    const titan=first.beforeTitan!*(1+bounds.maxAugmentIncreaseMultiplier)+bounds.maxAugmentIncreaseFlat;
    expect(titanMaximums(catalog.demoDraft.gear[0],catalog).added[0]).toBeCloseTo(bounds.randomStatDefaultValue+catalog.reference.titanGrowth.addedStatShare!*(titan-bounds.randomStatDefaultValue));
  });
  it('generates varied, valid five-roll gear and legal Titan values',()=>{
    const distributions=new Set<string>();
    const qualities=new Set<string>();
    for(const gear of catalog.demoDraft.gear) {
      const analysis=analyzeGear(gear,catalog);
      expect(analysis.combinations).toHaveLength(1);
      expect(analysis.rolls.reduce<number>((a,b)=>a+b!,0)).toBe(5);
      distributions.add(analysis.rolls.join(','));
      const maxima=titanMaximums(gear,catalog);
      gear.rows.forEach((row,i)=>{
        const type=catalog.reference.statTypes[row.type];
        const count=analysis.rolls[i]!;
        if(!count)expect(row.beforeTitan).toBeCloseTo(type.randomStatDefaultValue,8);
        expect(row.value).toBeGreaterThanOrEqual(row.beforeTitan!);
        expect(row.value).toBeLessThanOrEqual(maxima.random[i]!+1e-8);
        if(count&&type.randomStatMinRollValue!==type.randomStatMaxRollValue)qualities.add((row.beforeTitan!/(type.randomStatDefaultValue+count*type.randomStatMaxRollValue)).toFixed(2));
      });
      gear.augments.forEach((stat,i)=>{
        expect(gear.rows.some(row=>row.type===stat.type)).toBe(false);
        expect(maxima.added[i]).not.toBeNull();
        expect(stat.value).toBeLessThanOrEqual(maxima.added[i]!+1e-8);
      });
    }
    expect(distributions.size).toBeGreaterThan(5);
    expect(qualities.size).toBeGreaterThan(5);
  });
  it('covers zero, poor, medium, excellent and perfect RV with legal fallback additions',()=>{
    const draft=catalog.demoDraft;
    const ratios=draft.gear.map(gear=>{const score=gearRollValue(gear,draft,catalog);expect(score.value).not.toBeNull();return score.value!/score.maximum;});
    expect(Math.min(...ratios)).toBe(0);
    expect(Math.max(...ratios)).toBeCloseTo(1);
    expect(ratios.some(v=>v>0&&v<.4)).toBe(true);
    expect(ratios.some(v=>v>=.4&&v<.6)).toBe(true);
    expect(ratios.some(v=>v>=.6&&v<.75)).toBe(true);
    expect(ratios.some(v=>v>=.75&&v<.9)).toBe(true);
    expect(ratios.some(v=>v>=.85&&v<1)).toBe(true);
    const {statTypes:types,titanGrowth:growth}=catalog.reference;
    for(const gear of draft.gear) {
      const primary=getBuildTitanPrimaries(gear.rows,types)[0],pool=getBuildAugmentPools(gear.rows,growth,primary);
      const projection=getBuildTitanProjection(gear.rows,types,growth,primary);
      for(const stat of gear.augments) {
        expect(pool.priority.concat(pool.fallback)).toContain(stat.type);
        if(pool.fallback.includes(stat.type)||stat.type.includes('Resistance')) {
          const bounds=types[stat.type],source=types[gear.rows[primary].type];
          // A share of the primary's rolls after Titan, in the added stat's own range, without Titan growth.
          const rolls=Math.max(0,(projection.random[primary]!-source.randomStatDefaultValue)/source.randomStatMaxRollValue);
          expect(projection.added(stat.type)).toBeCloseTo(bounds.randomStatDefaultValue+(growth.addedStatShare??1)*rolls*bounds.randomStatMaxRollValue,8);
        }
      }
      if(pool.priority.length>=growth.maxAddedStats)expect(pool.fallback).toEqual([]);
      expect(projection.added(gear.rows[0].type)).toBeNull();
    }
    const belt=draft.gear.find(g=>g.id==='belt')!;
    expect(belt.rows.some(r=>r.type==='Frost Attack')).toBe(false);
    expect(belt.augments.some(r=>r.type==='Frost Attack')).toBe(true);
    const beltPool=getBuildAugmentPools(belt.rows,growth,getBuildTitanPrimaries(belt.rows,types)[0]);
    expect(beltPool.priority).toEqual(['Frost Attack']);
    expect(beltPool.fallback).toContain('HP');
    expect(belt.augments[1].type).toBe('HP');
    const gloves=draft.gear.find(g=>g.id==='gloves')!,crit=gloves.rows.find(r=>r.type==='Crit')!;
    expect(crit.beforeTitan).toBe(types.Crit.randomStatDefaultValue+types.Crit.randomStatMinRollValue);
  });
  it('grades each useful stat against its own five-roll Titan ceiling',()=>{
    const draft=unbuffedDraft(),helmet=draft.gear[0];
    const score=gearRollValue(helmet,draft,catalog);
    const frost=score.entries.find(entry=>entry.type==='Frost Attack')!;
    const attack=score.entries.find(entry=>entry.type==='Attack')!;
    expect(frost.maximumRV).toBeCloseTo(255.44952822925578*50000/52500);
    expect(attack.maximumRV).toBeCloseTo(100*1588.2/RV_FLAT_UNIT);
    expect(rollValueQuality(score.value,score.maximum).grade).toBe('purple');
    expect(rollValueQuality(frost.rv,frost.maximumRV).grade).toBe('green');
    expect(rollValueQuality(attack.rv,attack.maximumRV).grade).toBe('neutral');
    const boots=gearRollValue(draft.gear.find(gear=>gear.id==='boots')!,draft,catalog);
    const crit=boots.entries.find(entry=>entry.type==='Crit')!;
    expect(crit.rv).toBeCloseTo(crit.maximumRV);
    expect(rollValueQuality(crit.rv,crit.maximumRV).grade).toBe('titan');
    expect(score.entries.filter(entry=>!entry.useful).every(entry=>entry.maximumRV===0)).toBe(true);
  });
  it('weights universal ATK in the elemental pool and includes full Titan presence',()=>{
    const draft=unbuffedDraft(),gear=draft.gear[0];
    const original=gearRollValue(gear,draft,catalog),types=catalog.reference.statTypes;
    const t=(type:string,v:number)=>v*(1+types[type].maxAugmentIncreaseMultiplier)+types[type].maxAugmentIncreaseFlat;
    const unit=RV_FLAT_UNIT;
    expect(original.maximum).toBeCloseTo(100*(5*312*1.1+t('Attack',52)+t('Frost Attack',69))/unit);
    expect(original.entries.find(row=>row.type==='HP')?.rv).toBe(0);
    expect(original.entries.find(row=>row.type==='Attack')?.rv).toBeCloseTo(100*t('Attack',gear.rows[1].beforeTitan!)/unit);
    gear.enhancement+=100;gear.rows.forEach(row=>{row.value*=2;});gear.augments.forEach(stat=>{stat.value*=2;});draft.combat.elements[0].attack*=2;
    expect(gearRollValue(gear,draft,catalog).value).toBe(original.value);
    const visor=draft.gear.find(g=>g.id==='visor')!,score=gearRollValue(visor,draft,catalog);
    expect(score.entries.find(e=>e.type==='Frost Attack %')?.rv).toBeCloseTo(100*t('Frost Attack %',visor.rows[0].beforeTitan!)/score.entries.find(e=>e.type==='Frost Attack %')!.maximumRoll);
    draft.rv!.includeCrit=false;expect(gearRollValue(visor,draft,catalog)).toEqual(score);
    expect(restoreDraft(draft,catalog)?.rv?.includeCrit).toBe(true);
    gear.rows[0].beforeTitan=null;expect(gearRollValue(gear,draft,catalog).value).toBeNull();
    gear.rows[0].beforeTitan=1;expect(gearRollValue(gear,draft,catalog).reason).toBe('invalid');
    const legacy=unbuffedDraft();delete legacy.rv;
    expect(restoreDraft(legacy,catalog)?.rv).toEqual({element:'',includeCrit:true,weaponId:'',mode:'grv'});
  });
  it('credits a missing desired element through the correct primary pool, without summing foreign attacks',()=>{
    const draft=unbuffedDraft(),gear=draft.gear[0];
    gear.rows=['Physical Attack','Attack','HP','Resistance'].map((type,i)=>({type,beforeTitan:catalog.reference.statTypes[type].randomStatDefaultValue+(i===0?5*catalog.reference.statTypes[type].randomStatMaxRollValue:0),value:0}));
    const score=gearRollValue(gear,draft,catalog),carried=score.entries.find(e=>e.type==='Frost Attack')!;
    expect(carried.added).toBe(true);expect(carried.source).toBe('Physical Attack');
    // The carried Frost ATK is a share of the five-roll Physical ATK after Titan (was 0.95 × it).
    const physical=(69+5*312)*1.1+325,share=catalog.reference.titanGrowth.addedStatShare!;
    expect(carried.rv).toBeCloseTo(242.677051817793*50000/52500*(69+share*(physical-69))/(0.95*physical));
    expect(score.entries.find(e=>e.type==='Physical Attack')?.rv).toBe(0);
    gear.rows[0]={type:'Attack',beforeTitan:52+5*234,value:0};gear.rows[1]={type:'Physical Attack',beforeTitan:69,value:0};
    expect(gearRollValue(gear,draft,catalog).entries.some(e=>e.type==='Frost Attack')).toBe(false);
  });
  it('hits each slot ceiling with perfect useful stats and gives ATK rolls a smaller weight',()=>{
    const draft=unbuffedDraft();
    for(const id of ['helmet','boots','visor','core']) {
      const gear=draft.gear.find(g=>g.id===id)!;
      const types=id==='helmet'?['Attack','Frost Attack','HP','Resistance']:id==='boots'?['Attack','Frost Attack','Crit','HP']:id==='visor'?['Attack','Frost Attack','Frost Attack %','Crit Rate %']:['Attack','Frost Attack','Frost Attack %','Frost Damage %'];
      const primary=id==='boots'?'Crit':'Frost Attack';
      gear.rows=types.map(type=>({type,beforeTitan:catalog.reference.statTypes[type].randomStatDefaultValue+(type===primary?5*catalog.reference.statTypes[type].randomStatMaxRollValue:0),value:0}));
      const best=gearRollValue(gear,draft,catalog);
      expect(best.value).toBeCloseTo(best.maximum,7);
      if(id==='helmet') {
        gear.rows[0].beforeTitan=52+5*234;gear.rows[1].beforeTitan=69;
        expect(best.value!-gearRollValue(gear,draft,catalog).value!).toBeCloseTo(51.76807955517535*50000/52500);
      }
    }
  });
  it('keeps Altered independent from core-element scores, projection and Eyepiece ceilings',()=>{
    const draft=unbuffedDraft(),gear=draft.gear.find(g=>g.id==='visor')!,types=catalog.reference.statTypes;
    for(const element of ['Frost','Volt','Flame','Physical']) {
      draft.rv!.element=element;draft.rv!.weaponId='nemesis-voidpiercer';
      gear.rows=[element+' Attack',element+' Attack %','Crit Rate %','Altered Attack'].map(type=>({type,beforeTitan:types[type].randomStatDefaultValue+(type==='Altered Attack'?5*types[type].randomStatMaxRollValue:0),value:0}));
      const score=gearRollValue(gear,draft,catalog);
      expect(score.entries.find(e=>e.type==='Altered Attack')?.rv).toBe(0);
      expect(score.entries.find(e=>e.type===element+' Attack')?.source).toBe(element+' Attack');
      expect(titanMaximums(gear,catalog).random[0]).toBeCloseTo(69*1.1+325);
      const expected=100*((52*1.1+244)/52500+(69*1.1+325)/52500+(.0126*1.05+.00846)/2.5+(.0105*1.05+.014)/2.75+5*312*1.1/52500)/RV_Q;
      expect(score.maximum).toBeCloseTo(expected);
      const contribution=score.entries.find(e=>e.type===element+' Attack')!.rv;
      // Both snapshots are valid; reallocating the five rolls to crit must not
      // change the untouched elemental contribution or the slot denominator.
      gear.rows[3].beforeTitan=types['Altered Attack'].randomStatDefaultValue;
      gear.rows[2].beforeTitan=types['Crit Rate %'].randomStatDefaultValue+5*types['Crit Rate %'].randomStatMaxRollValue;
      const withoutAlteredRolls=gearRollValue(gear,draft,catalog);
      expect(withoutAlteredRolls.maximum).toBeCloseTo(score.maximum);
      expect(withoutAlteredRolls.entries.find(e=>e.type===element+' Attack')?.rv).toBeCloseTo(contribution);
    }
    draft.rv!.element='Altered';
    gear.rows=['Altered Attack','Crit Rate %','HP','Resistance'].map(type=>({type,beforeTitan:types[type].randomStatDefaultValue+(type==='Altered Attack'?5*types[type].randomStatMaxRollValue:0),value:0}));
    const altered=gearRollValue(gear,draft,catalog);
    // Altered inherits the strongest element's final ATK; Altered ATK is added after that element's ATK% (×1/(1+a)).
    expect(altered.inheritFrom).toBeTruthy();
    // Altered ATK grows with Titan like elemental ATK (raw SuperpowerAtkAdded level 120 = 650.4; multiplier from Frost ATK).
    expect(altered.entries.find(e=>e.type==='Altered Attack')?.rv).toBeCloseTo(100*((137+5*623)*1.1+650.4)/RV_FLAT_UNIT/(1+1.5));
    expect(altered.maximum).toBeGreaterThan(altered.value!);
    gear.rows=[altered.inheritFrom+' Attack','Attack','Altered Attack','Crit Rate %'].map(type=>({type,beforeTitan:types[type].randomStatDefaultValue,value:0}));
    const inherited=gearRollValue(gear,draft,catalog);
    expect(inherited.entries.find(e=>e.type===altered.inheritFrom+' Attack')?.useful).toBe(true);
    expect(inherited.entries.find(e=>e.type==='Attack')?.useful).toBe(true);
  });
  it('inherits only gear ATK%/DMG% inside the duo pair and marks the element supplying it',()=>{
    const draft=unbuffedDraft();
    draft.rv!.element='Frost';
    draft.combat.elements[0]={...draft.combat.elements[0],attack:50000,attackPercent:1.2,damage:.5};
    draft.combat.elements[1]={...draft.combat.elements[1],attack:60000,attackPercent:.8,damage:.6};
    draft.combat.elements[4]={...draft.combat.elements[4],attack:999999,attackPercent:10,damage:10};
    const row=(type:string,value:number)=>({type,value,beforeTitan:null});
    draft.gear.forEach(gear=>{gear.equipped=false;gear.titan=false;gear.augmented=false;});
    const [first,second]=draft.gear;
    Object.assign(first,{equipped:true,rows:[row('Frost Attack %',.1),row('Volt Attack %',.05),row('Frost Damage %',.02),row('HP',1)]});
    Object.assign(second,{equipped:true,rows:[row('Volt Attack %',.2),row('Physical Attack %',.9),row('HP',1),row('HP',1)]});
    // The table highlights the winner of each stat by GEAR only (2026-10-11): Volt has the larger gear ATK % (0.25 vs
    // 0.10), Frost the larger gear flat ATK and gear DMG %. Element totals (the 50k/60k base) do not decide it.
    expect(combatStatWinners(draft,catalog)).toEqual({element:'Frost',attack:'Frost',attackPercent:'Volt',damage:'Frost'});
    const attack=gearPercentInheritance(draft,catalog,'Attack %');
    expect(attack.elements).toEqual(['Frost','Volt']);
    expect(attack.inherited).toBeCloseTo(.25);
    expect(attack.byElement.Frost).toBe(0);
    expect(attack.byElement.Volt).toBeCloseTo(.25);
    // Frost inherits Volt's higher ATK; Frost's own ATK% applies to that inherited ATK.
    // Frost takes Volt's higher base and the winning gear ATK% (0.25) instead of its own gear 0.10: 1.2 − 0.10 + 0.25.
    expect(elementTotalAttack(draft,catalog,'Frost')).toMatchObject({own:50000,base:59700,supportBase:750,source:'Volt',inherited:true});
    expect(elementTotalAttack(draft,catalog,'Frost').percent).toBeCloseTo(1.35);
    expect(elementTotalAttack(draft,catalog,'Frost').total).toBeCloseTo((59700+750)*2.35);
    expect(elementTotalAttack(draft,catalog,'Volt')).toMatchObject({base:59700,source:'Volt',inherited:false});
    expect(elementTotalAttack(draft,catalog,'Volt').percent).toBeCloseTo(.8);
    draft.combat.elements[0].damage=0;draft.combat.elements[0].attackPercent=0;first.equipped=false;second.equipped=false;
    // No gear DMG % on either element: DMG % highlights the native element (2026-10-11).
    expect(combatStatWinners(draft,catalog).damage).toBe('Frost');
    // A pinned weapon outside the Frost pair keeps only the selected element; its native zero-percent rows stay highlighted.
    draft.weapons[2]={...draft.weapons[2],id:'salidy',mode:undefined};draft.rv!.weaponId='salidy';
    expect(combatStatWinners(draft,catalog)).toEqual({element:'Frost',attack:null,attackPercent:'Frost',damage:'Frost'});
  });
  it('keeps GRV flat ATK within the duo pair with independent per-item percent winners',()=>{
    const draft=unbuffedDraft(),gear=draft.gear.find(g=>g.id==='core')!;
    gear.rows=['Frost Damage %','Volt Attack %','Frost Attack','HP'].map((type,i)=>({type,beforeTitan:catalog.reference.statTypes[type].randomStatDefaultValue+[3,1,1,0][i]*catalog.reference.statTypes[type].randomStatMaxRollValue,value:0}));
    let score=gearRollValue(gear,draft,catalog);
    expect(score.percentElements).toEqual(['Frost','Volt']);
    expect(score.entries.filter(e=>e.useful).map(e=>e.type)).toEqual(['Frost Damage %','Volt Attack %','Frost Attack']);
    expect(score.entries.filter(e=>e.useful&&e.type.endsWith('Damage %'))).toHaveLength(1);
    draft.combat.elements[1].attack=100000;
    // Switching the selected element is explicit: Auto now follows the main resonance, regardless of higher ATK.
    draft.rv={...draft.rv,element:'Volt',includeCrit:true};
    score=gearRollValue(gear,draft,catalog);expect(score.element).toBe('Volt');
    // GRV rates the same pair after selecting Volt: the existing Frost ATK still counts.
    expect(score.entries.some(e=>e.useful&&e.type==='Frost Attack')).toBe(true);
    expect(score.entries.some(e=>e.useful&&e.type==='Volt Attack')).toBe(false);
    // Selecting Frost again retains the same flat family and independent percent winners.
    draft.rv!.element='Frost';
    score=gearRollValue(gear,draft,catalog);
    expect(score.element).toBe('Frost');
    expect(score.percentElements).toEqual(['Frost','Volt']);
    expect(score.entries.filter(e=>e.useful).map(e=>e.type)).toEqual(['Frost Damage %','Volt Attack %','Frost Attack']);
    draft.rv!.element='Frost';draft.weapons[2]={...draft.weapons[2],id:'salidy',mode:undefined};draft.rv!.weaponId='salidy';expect(gearRollValue(gear,draft,catalog).percentElements).toEqual(['Frost']);
  });
  it('uses roll weight rather than roll count, marks tied primaries and rejects unconfirmed fourth-element pull-up',()=>{
    const draft=unbuffedDraft(),gear=draft.gear[0],types=catalog.reference.statTypes;
    gear.rows=['Physical Attack','HP','Attack','Resistance'].map((type,i)=>({type,beforeTitan:types[type].randomStatDefaultValue+(i===0?2*312:i===1?3*7480:0),value:0}));
    expect(analyzeGear(gear,catalog).combinations).toContainEqual([2,3,0,0]);
    expect(analyzeGear(gear,catalog).rolls.slice(0,2).reduce((a,b)=>a!+b!,0)).toBe(5);
    expect(analyzeGear(gear,catalog).estimated.slice(0,2)).toEqual([true,true]);
    expect(gearRollValue(gear,draft,catalog).entries.find(e=>e.type==='Frost Attack')?.source).toBe('Physical Attack');
    draft.rv!.element='Volt';draft.combat.elements[1].attack=100000;
    gear.rows=['Frost Attack','Physical Attack','HP','Attack'].map((type,i)=>({type,beforeTitan:types[type].randomStatDefaultValue+(i<2?2*312:i===2?7480:0),value:0}));
    // Both tied projections supply the same winning pair ATK, so the GRV is unambiguous.
    expect(gearRollValue(gear,draft,catalog).conservative).toBe(false);
    gear.rows=['Frost Attack','Physical Attack','Volt Attack','Flame Attack'].map((type,i)=>({type,beforeTitan:69+(i===0?5*312:0),value:0}));
    expect(gearRollValue(gear,draft,catalog).reason).toBe('unsupported');
    const legacy=unbuffedDraft();
    delete legacy.rv!.weaponId;for(const element of legacy.combat.elements)delete element.attackPercent;
    expect(restoreDraft(legacy,catalog)?.rv?.weaponId).toBe('');
    expect(restoreDraft(legacy,catalog)?.combat.elements.every(e=>e.attackPercent===0)).toBe(true);
  });
  it('materializes system effects and preserves the supercomputing level-10 boundary',()=>{
    const node=catalog.computing[0];
    expect(node.maxLevel).toBe(20);
    const bonus=(level:number)=>node.levels.find(l=>l.level===level)!.value;
    expect(bonus(0)).toBe(0);
    expect(bonus(10)).toBe(.05);
    expect(bonus(11)).toBe(.06);
    expect(bonus(15)).toBe(.1);
    expect(bonus(16)).toBe(.105);
    expect(bonus(20)).toBe(.125);
    expect(node.effects.map(effect=>effect.id)).toEqual(['icon_acceptUp_all','icon_resistUp_all','icon_zhiliaoUP']);
    expect(node.effects[2].levels.find(item=>item.level===20)?.value).toBe(.1);
    const eyepiece=catalog.computing.find(item=>item.id==='supercomputing-1')!;
    expect(eyepiece.effects[1].levels.find(item=>item.level===20)?.value).toBe(.2);
    const physical=catalog.support.modules.find(m=>m.id==='PhysicalAttack')!;
    expect(physical.levels.find(l=>l.level===1)).toEqual({level:1,value:150,percentage:false});
    const content=catalog.support.modules.find(m=>m.id==='NewRow_23')!;
    expect(content.levels.find(l=>l.level===5)).toEqual({level:5,value:.05,percentage:true});
    const invalid=unbuffedDraft();invalid.computing[0].level=21;
    expect(restoreDraft(invalid,catalog)).toBeNull();
  });
});

it('uses all eight basic enhancement slots, excludes Vera gear and respects tier thresholds',()=>{
  const draft=unbuffedDraft();
  for(const gear of draft.gear)gear.enhancement=catalog.enhancementResonance.slotIds.includes(gear.id)?55:0;
  expect(enhancementResonance(draft,catalog)).toMatchObject({level:11,enhancement:55,stats:{atk:880,res:440,hp:70400,crit:440}});
  const lowest=draft.gear.find(gear=>catalog.enhancementResonance.slotIds.includes(gear.id))!;
  lowest.enhancement=54;
  expect(enhancementResonance(draft,catalog)?.level).toBe(10);
  lowest.enhancement=0;
  expect(enhancementResonance(draft,catalog)).toBeNull();
  lowest.enhancement=80;lowest.equipped=false;
  expect(enhancementResonance(draft,catalog)).toBeNull();
});

it('sums displayed base, per-level enhancement and every unlocked milestone from the supplied screenshots',()=>{
  const draft=unbuffedDraft();
  const fixtures=[
    {id:'visor',level:56,values:{Resistance:1311,HP:49033,Crit:1558}},
    {id:'gloves',level:80,values:{Attack:2387,Crit:5276,HP:24874}},
    {id:'boots',level:70,values:{Attack:2001,HP:85462}},
  ];
  for(const fixture of fixtures) {
    const gear=draft.gear.find(item=>item.id===fixture.id)!;
    gear.enhancement=fixture.level;gear.titan=true;gear.augmented=true;
    const stats=gearBaseStats(gear,catalog);
    expect(Object.fromEntries(stats.map(stat=>[stat.label,stat.value]))).toEqual(fixture.values);
    expect(stats.every(stat=>stat.value===stat.base+stat.enhancement+stat.unlocked)).toBe(true);
    const titan=stats;gear.titan=false;gear.augmented=false;
    expect(gearBaseStats(gear,catalog)).not.toEqual(titan);
    gear.equipped=false;expect(gearBaseStats(gear,catalog)).toEqual([]);
  }
});

it('uses maximum levels on selection and preserves existing custom levels',()=>{
  const draft=emptyDraft(catalog);
  expect(draft.support.every(module=>module.level===0)).toBe(true);
  selectBuildWeapon(draft,0,catalog.weapons[0].id,catalog);
  selectBuildMatrix(draft,0,0,catalog.matrices[0].id,catalog);
  const pet=catalog.pets[0];selectBuildPet(draft,pet.id,catalog);
  const module=pet.modules[0];selectBuildPetModule(draft,0,module.id,catalog);
  expect(draft.weapons[0].level).toBe(catalog.defaultLevels.weapon);
  expect(draft.weapons[0].matrices[0].level).toBe(catalog.defaultLevels.matrix);
  expect(draft.pet.level).toBe(catalog.defaultLevels.pet);
  expect(draft.pet.stars).toBe(pet.maxStars);
  expect(draft.pet.moduleLevels![0]).toBe(Math.max(...module.levels.map(item=>item.level)));
  draft.weapons[0].level=20;draft.weapons[0].matrices[0].level=10;draft.pet.level=3;draft.pet.stars=0;draft.support[0].level=1;
  expect(restoreDraft(draft,catalog)).toEqual(draft);
  selectBuildPetModule(draft,0,'',catalog);expect(draft.pet.moduleLevels![0]).toBe(0);
  selectBuildPet(draft,'',catalog);expect(draft.pet).toMatchObject({id:'',level:0,stars:0});
});

it('grades RV against each slot ceiling rather than the raw RV total',()=>{
  const vera=rollValueQuality(600,722.1),classic=rollValueQuality(480,544.3);
  expect(vera.ratio).toBeLessThan(classic.ratio!);
  expect(vera.grade).toBe('purple');
  expect(classic.grade).toBe('gold');
  expect(rollValueQuality(490,544.3).grade).toBe('titan');
  expect(rollValueQuality(59.94,100).grade).toBe('neutral');
  expect(rollValueQuality(60,100).grade).toBe('green');
  expect(rollValueQuality(69.94,100).grade).toBe('green');
  expect(rollValueQuality(70,100).grade).toBe('blue');
  expect(rollValueQuality(79.94,100).grade).toBe('blue');
  expect(rollValueQuality(80,100).grade).toBe('purple');
  expect(rollValueQuality(84.94,100).grade).toBe('purple');
  expect(rollValueQuality(85,100).grade).toBe('gold');
  expect(rollValueQuality(89.94,100).grade).toBe('gold');
  expect(rollValueQuality(89.96,100).grade).toBe('titan');
  expect(rollValueQuality(90,100).grade).toBe('titan');
  expect(rollValueQuality(100,100).grade).toBe('titan');
  expect(rollValueGradeLabels().map(band=>band.label)).toEqual(['<60%','60–<70%','70–<80%','80–<85%','85–<90%','90–100%']);
  expect(rollValueQuality(null,544.3).ratio).toBeNull();
  expect(rollValueQuality(0,544.3).grade).toBe('neutral');
});

it('uses marked weapon stars outside the build and Nan Yin stars inside, with all marks from A1',()=>{
  const draft=unbuffedDraft(),weapon=draft.weapons[0];
  for(const stars of [0,1,6]) {
    weapon.stars=stars;
    expect(weaponMarkBonus(draft,catalog,weapon)).toMatchObject({enabled:true,inBuild:false,all:false,total:.01+stars*.01});
  }
  const owner=draft.weapons[2];owner.id=catalog.weaponMark.simulacrumId;
  for(const stars of [0,1,2,6]) {
    owner.stars=stars;
    expect(weaponMarkBonus(draft,catalog,weapon)).toMatchObject({enabled:true,inBuild:true,all:stars>=1,total:.09+stars*.01});
    expect(weaponMarkBonus(draft,catalog,draft.weapons[1]).enabled).toBe(stars>=1);
  }
});

it('lists only unlocked damage sources with their element and content conditions',()=>{
  const draft=unbuffedDraft();
  const sources=additionalDamageSources(draft,catalog);
  expect(sources.find(s=>s.kind==='synthesis'&&s.id==='lin')?.value).toBeCloseTo(.03);
  expect(sources.find(s=>s.kind==='synthesis'&&s.id==='fiona')?.value).toBeCloseTo(.06);
  expect(sources.filter(s=>s.kind==='computing')).toHaveLength(4);
  expect(sources.find(s=>s.id==='NewRow_7')).toMatchObject({elements:['Frost'],conditional:false});
  expect(sources.some(s=>s.id==='NewRow_25')).toBe(false);
  expect(sources.filter(s=>s.conditional)).toHaveLength(1);
  draft.support.find(s=>s.id==='NewRow_22')!.level=5;
  expect(additionalDamageSources(draft,catalog).filter(s=>s.conditional)).toHaveLength(1);
  draft.support.find(s=>s.id==='NewRow_23')!.level=0;
  expect(additionalDamageSources(draft,catalog).filter(s=>s.conditional).map(s=>s.id)).toEqual(['NewRow_22']);
  expect(sources.find(s=>s.id==='NewRow_23')).toMatchObject({conditional:true,elements:Object.keys(catalog.elementIcons)});
  expect(sources.some(s=>s.id==='NewRow_5')).toBe(false);
  draft.synthesis.forEach(s=>s.stage=0);draft.computing.forEach(s=>s.level=0);draft.support.forEach(s=>s.level=0);
  expect(additionalDamageSources(draft,catalog)).toEqual([]);
});

it('filters Titan additions through the generated primary pool and excludes occupied types',()=>{
  const gear=structuredClone(catalog.demoDraft.gear[0]);
  const options=gearAugmentOptions(gear,catalog,0);
  expect(options).not.toContain(gear.augments[1].type);
  for(const row of gear.rows)expect(options).not.toContain(row.type);
  const primary=getBuildTitanPrimaries(gear.rows,catalog.reference.statTypes);
  const expected=primary.flatMap(i=>{const p=getBuildAugmentPools(gear.rows,catalog.reference.titanGrowth,i);return p.priority.concat(p.fallback);});
  for(const type of options)expect(expected).toContain(type);
});
it('enforces pet Load at maximum module rank and releases the replaced slot',()=>{
  const draft=emptyDraft(catalog);
  const pet=catalog.pets.find(p=>p.modules.length&&p.moduleCapacity?.length)!;
  selectBuildPet(draft,pet.id,catalog);
  const module=petModuleOptions(draft,catalog,0)[0];
  expect(module).toBeDefined();
  selectBuildPetModule(draft,0,module.id,catalog);
  const load=module.levels.find(l=>l.level===draft.pet.moduleLevels![0])!.load!;
  expect(petModuleBudget(draft,catalog).used).toBe(load);
  expect(petModuleBudget(draft,catalog,0).used).toBe(0);
  expect(petModuleOptions(draft,catalog,0).map(m=>m.id)).toContain(module.id);
  for(let i=1;i<4;i++)for(const m of petModuleOptions(draft,catalog,i))expect(petModuleBudget(draft,catalog,i).used+m.levels.at(-1)!.load!).toBeLessThanOrEqual(petModuleBudget(draft,catalog).max);
  draft.pet.stars=0;
  expect(petModuleOptions(draft,catalog,1)).toEqual([]);
  for(const l of petModuleRanks(draft,catalog,0))expect(l.load!).toBeLessThanOrEqual(petModuleBudget(draft,catalog).max);
});

it('hides modules that exceed the remaining Load and refuses bypassed selections',()=>{
  const draft=emptyDraft(catalog);
  const pet=catalog.pets.find(p=>p.modules.length&&p.moduleCapacity?.length)!;
  selectBuildPet(draft,pet.id,catalog);
  const costly=pet.modules.filter(m=>m.levels.at(-1)?.load).sort((a,b)=>b.levels.at(-1)!.load!-a.levels.at(-1)!.load!)[0];
  for(let i=0;i<draft.pet.modules.length;i++){
    const budget=petModuleBudget(draft,catalog,i);
    const load=costly.levels.at(-1)!.load!;
    if(budget.used+load>budget.max){
      expect(petModuleOptions(draft,catalog,i).map(m=>m.id)).not.toContain(costly.id);
      selectBuildPetModule(draft,i,costly.id,catalog);
      expect(draft.pet.modules[i]).toBe('');
      return;
    }
    selectBuildPetModule(draft,i,costly.id,catalog);
  }
  throw new Error('Fixture must exercise insufficient Load');
});

it('uses matrix slot attributes, level growth and star multipliers from the game tables',()=>{
  const matrix={...catalog.demoDraft.weapons[0].matrices[0],level:100,stars:3};
  expect(catalog.matrixStats.source).toContain('Overseas');
  expect(matrixStatBonuses(matrix,0,catalog).map(s=>s.id)).toEqual(['MaxHealthAdded','CritAdded']);
  expect(matrixStatBonuses(matrix,1,catalog).map(s=>s.id)).toEqual(['CommonAtkAdded','MaxHealthAdded']);
  expect(matrixStatBonuses(matrix,2,catalog).map(s=>s.id)).toEqual(['CommonAtkAdded','MaxHealthAdded']);
  expect(matrixStatBonuses(matrix,3,catalog).map(s=>s.id)).toEqual(['CommonAtkAdded','ElementDef']);
  expect(matrixStatBonuses(matrix,0,catalog)[0].value).toBeCloseTo(70000,2);
  expect(matrixStatBonuses(matrix,0,catalog)[1].value).toBeCloseTo(833.333444,4);
  expect(matrixStatBonuses(matrix,1,catalog)[0].value).toBeCloseTo(645.83328,4);
  const zeroStars=matrixStatBonuses({...matrix,stars:0},0,catalog);
  expect(zeroStars[0].value*2).toBeCloseTo(matrixStatBonuses(matrix,0,catalog)[0].value);
  expect(matrixStatBonuses({...matrix,level:0},0,catalog)[0].value).toBeLessThan(zeroStars[0].value);
  expect(matrixStatBonuses({...matrix,id:''},0,catalog)).toEqual([]);
});

it('uses raw weapon level growth and advancement coefficients',()=>{
  const weapon={...catalog.demoDraft.weapons[0],level:200,stars:6};
  const growth=catalog.weapons.find(w=>w.id===weapon.id)!.stats!.growth!;
  expect(growth.stats.map(s=>s.id)).toEqual(weaponStatBonuses(weapon,catalog).map(s=>s.id));
  const six=weaponStatBonuses(weapon,catalog),unstarred=weaponStatBonuses({...weapon,stars:0},catalog);
  six.forEach((stat,i)=>expect(stat.value).toBeGreaterThan(unstarred[i].value));
  expect(weaponStatBonuses({...weapon,level:100},catalog)[0].value).toBeLessThan(six[0].value);
  expect(weaponStatBonuses({...weapon,id:''},catalog)).toEqual([]);
});

it('resolves Arts links, selects only loading defaults and migrates legacy backgrounds',()=>{
  const loading=catalog.artworks.filter(art=>art.loading);
  expect(randomLoadingArtwork(catalog,()=>0)).toBe(loading[0].id);
  expect(randomLoadingArtwork(catalog,()=>.99999)).toBe(loading.at(-1)!.id);
  const id=catalog.artworks.find(art=>!art.loading)!.id;
  for(const link of [id,`/info/arts/#${id}`,`https://example.com/info/arts/?cat=character_bg#${id}`])expect(artworkIdFromLink(link,catalog)).toBe(id);
  for(const link of ['javascript:alert(1)','/info/simulacra/#'+id,'/info/arts/#missing','%'])expect(artworkIdFromLink(link,catalog)).toBe('');
  const legacy=unbuffedDraft();legacy.art.id=legacy.weapons[0].id;
  const restored=restoreDraft(legacy,catalog)!;
  expect(restored.weapons).toEqual(legacy.weapons);
  expect(catalog.artworks.some(art=>art.id===restored.art.id)).toBe(true);
  const cleared=unbuffedDraft();cleared.art.id='';
  expect(restoreDraft(cleared,catalog)?.art.id).toBe('');
});

it('offers no module replacements or additions at full Load until a module is removed',()=>{
  const draft=unbuffedDraft();
  expect(petModuleBudget(draft,catalog)).toMatchObject({used:15,max:15});
  for(let index=0;index<4;index++)expect(petModuleOptions(draft,catalog,index)).toEqual([]);
  const original=draft.pet.modules[2];
  selectBuildPetModule(draft,2,catalog.pets[0].modules[0].id,catalog);
  expect(draft.pet.modules[2]).toBe(original);
  selectBuildPetModule(draft,2,'',catalog);
  expect(petModuleBudget(draft,catalog).used).toBeLessThan(15);
  expect(petModuleOptions(draft,catalog,2).length).toBeGreaterThan(0);
});

it('derives separate item-free PRV profiles, caps remaining Crit, and preserves GRV',()=>{
  const draft=unbuffedDraft();
  draft.rv={element:'Frost',includeCrit:true,mode:'prv'};
  const stats=draft.combat.elements.find(e=>e.id==='Frost')!;
  const denominator=catalog.reference.critFormula.denominators[draft.enemyLevel];
  const profile=personalRVProfile(draft,catalog,'Frost')!;
  expect(profile.flatAttack).toBeCloseTo(stats.attack);
  expect(profile.critChance).toBeCloseTo(Math.min(1,draft.combat.crit/denominator+draft.combat.additionalCritRate));
  const scores=draft.gear.map(g=>gearRollValue(g,draft,catalog));
  expect(scores.every(s=>s.profile?.critDenominator===denominator)).toBe(true);
  expect(new Set(scores.map(s=>s.profile?.flatAttack)).size).toBeGreaterThan(1);
  expect(buildRollValue(draft,catalog).value).toBeCloseTo(draft.gear.reduce((sum,g)=>sum+gearCurrentRollValue(cardGear(g,draft,catalog),draft,catalog).value!,0));
  draft.combat.additionalCritRate=1;
  const capped=gearRollValue(draft.gear[6],draft,catalog);
  expect(capped.profile?.critChance).toBe(1);
  expect(getBuildRVWeight('Crit',capped.profile!)).toBe(0);
  expect(getBuildRVWeight('Crit Rate %',capped.profile!)).toBe(0);
  expect(capped.entries.find(e=>e.type==='Crit')?.rv).toBe(0);
  expect(capped.value).not.toBeNull();
  for(const score of draft.gear.map(g=>gearRollValue(g,draft,catalog)))expect(score.value!).toBeLessThanOrEqual(score.maximum+1e-8);
  draft.rv.mode='grv';
  expect(gearRollValue(draft.gear[6],draft,catalog).entries.find(e=>e.type==='Crit')?.rv).toBeGreaterThan(0);
});
it('does not silently replace unavailable PRV with GRV or accept unknown modes',()=>{
  const draft=emptyDraft(catalog);draft.rv!.mode='prv';
  expect(gearRollValue(draft.gear[0],draft,catalog)).toMatchObject({value:null,profile:null,maximum:0});
  const populated=unbuffedDraft();populated.rv!.mode='prv';
  expect(restoreDraft(populated,catalog)?.rv?.mode).toBe('prv');
  const legacy=structuredClone(populated);delete legacy.rv!.mode;
  expect(restoreDraft(legacy,catalog)?.rv?.mode).toBe('grv');
  expect(restoreDraft({...populated,rv:{...populated.rv,mode:'unknown'}},catalog)).toBeNull();
  populated.enemyLevel=0;
  expect(personalRVProfile(populated,catalog,'Frost')).toBeNull();
});

it('matches local damage weights to independent finite differences at the personal baseline',()=>{
  const profile=personalRVProfile(unbuffedDraft(),catalog,'Frost')!;
  const logDamage=(p:typeof profile)=>Math.log((p.flatAttack*(1+p.attackPercent)+(p.postPercentAttack??0))*(1+p.damagePercent)*(1+p.critChance*p.critDamageBonus));
  for(const [type,key,step] of [['Frost Attack','flatAttack',.01],['Attack','flatAttack',.01],['Frost Attack %','attackPercent',1e-6],['Frost Damage %','damagePercent',1e-6],['Crit Rate %','critChance',1e-6]] as const){
    const high={...profile,[key]:profile[key]+step},low={...profile,[key]:profile[key]-step};
    expect(getBuildRVWeight(type,profile)).toBeCloseTo((logDamage(high)-logDamage(low))/(2*step),7);
  }
  expect(getBuildRVWeight('Crit',profile)*profile.critDenominator).toBeCloseTo(getBuildRVWeight('Crit Rate %',profile),10);
  expect(getBuildRVWeight('HP',profile)).toBe(0);
});

it('enhances every gear slot atomically while preserving stats and equipment state',()=>{
  const draft=unbuffedDraft();draft.gear[11].equipped=false;
  const rows=draft.gear.map(g=>structuredClone(g.rows));
  enhanceAllGear(draft,catalog,{enhancement:65,stars:5,stage:''});
  expect(draft.gear.every(g=>g.enhancement===65&&g.stars===5)).toBe(true);
  expect(draft.gear[11].equipped).toBe(false);
  expect(draft.gear.map(g=>g.rows)).toEqual(rows);
  enhanceAllGear(draft,catalog,{enhancement:999,stars:0,stage:'titan'});
  for(const [i,g] of draft.gear.entries()){
    expect(g.enhancement).toBe(catalog.gear[i].baseStats.titan.at(-1)!.level);
    expect(g.stars).toBe(catalog.reference.limits.maxNumOfRandomStatRolls);
    expect(g.titan&&g.augmented).toBe(true);
  }
  enhanceAllGear(draft,catalog,{enhancement:null,stars:0,stage:'normal'});
  expect(draft.gear.every(g=>!g.titan&&!g.augmented&&g.stars===0)).toBe(true);
});

it('rates an equipped item on exactly the same baseline as a manually removed item',()=>{
  const draft=unbuffedDraft();draft.rv={mode:'prv',element:'Frost',includeCrit:true};
  const gear=draft.gear[0],score=gearRollValue(gear,draft,catalog),removed=score.removed!;
  const resonance=enhancementResonance(draft,catalog)!.stats;
  const base=gearBaseStats(gear,catalog).find(stat=>stat.label==='Attack')!.value;
  expect(removed.flatAttack).toBeCloseTo(base+1122+393+resonance.atk);
  expect(removed.critRating).toBeCloseTo(resonance.crit);
  const input=personalRVProfile(draft,catalog,'Frost')!,without=structuredClone(draft);
  const stats=without.combat.elements.find(e=>e.id==='Frost')!;
  stats.attackPercent=stats.attackPercent!-removed.attackPercent;
  stats.attack=input.flatAttack-removed.flatAttack;
  stats.damage-=removed.damagePercent;
  without.combat.crit-=removed.critRating;without.combat.additionalCritRate-=removed.critRate;
  without.gear[0].equipped=false;
  const candidate=gearRollValue(without.gear[0],without,catalog);
  // The damage baseline matches; the tank pools (resistance, HP) are not rebuilt by hand here.
  for(const key of (Object.keys(score.profile!) as (keyof NonNullable<typeof score.profile>)[]).filter(key=>!key.startsWith('resistance')&&!key.startsWith('hp'))) {
    const value=score.profile![key];
    if(typeof value==='number')expect(candidate.profile![key]).toBeCloseTo(value,8);
    else expect(candidate.profile![key]).toBe(value);
  }
  expect(candidate.value).toBeCloseTo(score.value!,8);
  expect(candidate.maximum).toBeCloseTo(score.maximum,8);
  expect(candidate.removed).toEqual({flatAttack:0,attackPercent:0,damagePercent:0,critRating:0,critRate:0,resistance:0,resistancePercent:0,hp:0,hpPercent:0});
  expect(score.profile!.flatAttack).toBeLessThan(input.flatAttack);
});

it('removes current duo winners and raw Crit before capping, never the Titan projection',()=>{
  const draft=unbuffedDraft();draft.rv={mode:'prv',element:'Frost',includeCrit:true};
  const gear=draft.gear[8];
  gear.augments=[{type:'Volt Attack %',value:.07},{type:'Volt Damage %',value:.09}];
  const removed=gearRVRemovedStats(gear,draft,catalog)!;
  expect(removed.attackPercent).toBeCloseTo(.07,12);
  const context=rollValueContext(draft,catalog),without={...draft,gear:draft.gear.map(item=>item.id===gear.id?{...item,equipped:false}:item)};
  const pool=(state:typeof draft)=>Math.max(...context.percentElements.map(element=>gearElementStat(state,catalog,element,'Damage %')));
  expect(removed.damagePercent).toBeCloseTo(pool(draft)-pool(without),12);
  expect(removed.damagePercent).toBeLessThan(.09); // Removing it changes the whole-loadout winner.
  expect(removed.flatAttack).toBe(485);
  const original=personalRVProfile(draft,catalog,'Frost')!;
  const stats=draft.combat.elements.find(e=>e.id==='Frost')!;
  const score=gearRollValue(gear,draft,catalog);
  expect(score.profile!.flatAttack).toBeCloseTo(original.flatAttack-485);
  expect(score.profile!.attackPercent).toBeCloseTo(elementTotalAttack(draft,catalog,'Frost').percent-.07);
  expect(score.profile!.flatAttack).not.toBeCloseTo(stats.attack/(1+stats.attackPercent!-.07)-485);
  const boots=draft.gear[6],denominator=catalog.reference.critFormula.denominators[draft.enemyLevel];
  draft.combat.crit=denominator*1.1;draft.combat.additionalCritRate=0;
  const bootScore=gearRollValue(boots,draft,catalog);
  expect(bootScore.profile!.critChance).toBeCloseTo(1.1-bootScore.removed!.critRating/denominator);
  expect(bootScore.profile!.critChance).toBeLessThan(1);
  expect(getBuildRVWeight('Crit',bootScore.profile!)).toBeGreaterThan(0);
});

it('leaves inconsistent panel totals unavailable instead of clamping a negative item-free pool',()=>{
  const draft=unbuffedDraft();draft.rv={mode:'prv',element:'Frost',includeCrit:true};
  draft.combat.elements.find(e=>e.id==='Frost')!.attack=1;
  expect(gearRollValue(draft.gear[0],draft,catalog)).toMatchObject({value:null,profile:null});
  draft.rv.mode='grv';expect(gearRollValue(draft.gear[0],draft,catalog).value).not.toBeNull();
});

it('derives the demo additional Crit Rate exclusively from the equipped eyepiece',()=>{
  const sources=catalog.demoDraft.gear.filter(gear=>gear.equipped).flatMap(gear=>[...gear.rows,...(gear.augmented||gear.titan?gear.augments:[])].filter(stat=>stat.type==='Crit Rate %'&&stat.value>0).map(stat=>({id:gear.id,value:stat.value})));
  expect(sources).toHaveLength(1);
  expect(sources[0].id).toBe('visor');
  expect(catalog.demoDraft.combat.additionalCritRate).toBeCloseTo(sources[0].value,10);
});

it('reports maximum-roll rating weights using Titan multipliers, context and the active profile',()=>{
  const draft=unbuffedDraft();draft.rv={mode:'grv',element:'Frost',includeCrit:true};
  for(const mode of ['grv','prv'] as const){
    draft.rv.mode=mode;
    const score=gearRollValue(draft.gear[0],draft,catalog);
    for(const row of score.rollWeights){
      const bounds=catalog.reference.statTypes[row.type];
      expect(row.beforeTitan).toBe(bounds.randomStatMaxRollValue);
      expect(row.afterTitan).toBeCloseTo(row.beforeTitan*(1+bounds.maxAugmentIncreaseMultiplier),10);
      expect(row.value!).toBeLessThanOrEqual(100+1e-8);
    }
    const attack=score.rollWeights.find(row=>row.type==='Attack')!;
    expect(attack.value).toBeCloseTo(100*attack.afterTitan/(score.profile!.flatAttack+(score.profile!.postPercentAttack??0)/(1+score.profile!.attackPercent))/score.normalization,10);
    const elemental=score.rollWeights.find(row=>row.type==='Frost Attack')!;
    expect(attack.value!/elemental.value!).toBeCloseTo(attack.afterTitan/elemental.afterTitan,10);
    expect(score.rollWeights.find(row=>row.type==='Flame Attack')!.value).toBe(0);
    expect(score.rollWeights.find(row=>row.type==='HP')!.value).toBe(0);
    expect(score.rollWeights.find(row=>row.type==='Flame Resistance')!.value).toBe(0);
  }
  draft.combat.elements.find(element=>element.id==='Frost')!.attack=1;
  expect(gearRollValue(draft.gear[0],draft,catalog).rollWeights.every(row=>row.value===null)).toBe(true);
});

it('uses raw CS coefficients and matches the supplied large-value observations without residuals',()=>{
  const draft=unbuffedDraft(),gear=draft.gear[0];
  for(const [type,value,expected] of [['Physical Resistance',100000,48000],['HP',100000,2500],['Resistance',100000,160000],['Crit',100000,40000],['Attack',100000,200000],['Physical Attack',100000,150000],['Physical Damage %',100,7520000],['Crit Rate %',100,7520000]] as const){
    gear.rows=[{type,value,beforeTitan:null}];gear.augments=[];
    const entry=gearCombatScore(gear,draft,catalog).entries.find(e=>e.type===type&&e.value===value)!;
    expect(entry.cs).toBeCloseTo(expected,8);
  }
});
it('uses pre-percentage CS pools including the item and rejects missing percentage bases',()=>{
  const draft=unbuffedDraft(),gear=draft.gear[8];
  const physical=draft.combat.elements.find(e=>e.id==='Physical')!;
  physical.attack=1000000;physical.attackPercent=3;
  physical.resistance=800000;physical.resistancePercent=3;
  draft.combat.hp=8000000;draft.combat.hpPercent=3;
  gear.rows=[{type:'Physical Attack %',value:1,beforeTitan:null},{type:'HP %',value:3,beforeTitan:null},{type:'Physical Resistance %',value:3,beforeTitan:null}];gear.augments=[];
  const score=gearCombatScore(gear,draft,catalog);
  expect(score.entries.find(e=>e.type==='Physical Attack %')!.cs).toBe(1500000);
  expect(score.entries.find(e=>e.type==='HP %')!.cs).toBe(150000);
  expect(score.entries.find(e=>e.type==='Physical Resistance %')!.cs).toBe(288000);
  expect(score.estimated).toBe(false);
  // ATK is already the pre-percentage pool; changing ATK% must not divide it again.
  physical.attackPercent=0;
  expect(gearCombatScore(gear,draft,catalog).entries.find(e=>e.type==='Physical Attack %')!.cs).toBe(1500000);
  delete physical.attackPercent;
  expect(gearCombatScore(gear,draft,catalog).entries.find(e=>e.type==='Physical Attack %')!.cs).toBe(1500000);
  // A capture has no total HP%: the equipped gear's own HP% stands in for it.
  delete draft.combat.hpPercent;
  for(const other of draft.gear)if(other!==gear)other.equipped=false;
  gear.equipped=true;
  const estimate=gearCombatScore(gear,draft,catalog);
  expect(estimate.estimated).toBe(true);
  expect(estimate.entries.find(e=>e.type==='HP %')!.base).toBe(2000000);
  expect(estimate.value).not.toBeNull();
  draft.combat.hp=0;
  expect(gearCombatScore(gear,draft,catalog).value).toBeNull();
  const legacy=unbuffedDraft();delete legacy.combat.hpPercent;
  for(const e of legacy.combat.elements)delete e.resistancePercent;
  const restored=restoreDraft(legacy,catalog)!;
  expect(restored.combat.hpPercent).toBeNull();
  expect(restored.combat.elements.every(e=>e.resistancePercent===null)).toBe(true);
});

it('scores HP% against final HP divided by the full multiplier, keeping gear-only estimates explicit',()=>{
  const draft=unbuffedDraft(),gear=draft.gear[8];
  for(const other of draft.gear)other.equipped=other===gear;
  gear.rows=[{type:'HP %',value:.1,beforeTitan:null}];gear.augments=[];
  draft.combat.hp=3000000;draft.combat.hpPercent=.5;
  const exact=gearCombatScore(gear,draft,catalog);
  expect(exact.entries.find(e=>e.type==='HP %')!.base).toBe(2000000);
  expect(exact.entries.find(e=>e.type==='HP %')!.cs).toBe(5000);
  expect(exact.estimated).toBe(false);
  draft.combat.hpPercent=null;
  const approximate=gearCombatScore(gear,draft,catalog);
  expect(approximate.entries.find(e=>e.type==='HP %')!.cs).toBeCloseTo(6818.181818,5);
  expect(approximate.estimated).toBe(true);
});

it.each(['Frost','Volt','Flame','Physical','Altered'])('scores %s RES% against its own final resistance and total percentage',element=>{
  const draft=unbuffedDraft(),gear=draft.gear[8];
  for(const other of draft.gear)other.equipped=other===gear;
  draft.weapons.forEach(weapon=>{weapon.id='';});draft.computing=[];
  draft.relicResistance={[element]:.02};
  gear.rows=[{type:element+' Resistance %',value:.1,beforeTitan:null},{type:'Resistance %',value:.2,beforeTitan:null},{type:'HP %',value:.5,beforeTitan:null}];gear.augments=[];
  const combat=draft.combat.elements.find(e=>e.id===element)!;
  combat.resistance=13200;combat.resistancePercent=.32;
  const exact=gearCombatScore(gear,draft,catalog).entries.find(e=>e.type===element+' Resistance %')!;
  expect(exact.base).toBe(10000);
  expect(exact.cs).toBe(480);
  combat.resistancePercent=null;
  const estimated=gearCombatScore(gear,draft,catalog);
  expect(estimated.entries.find(e=>e.type===element+' Resistance %')!.cs).toBe(480);
  expect(estimated.estimated).toBe(true);
  expect(estimated.entries.find(e=>e.type==='Resistance %')!.cs).toBe(0); // raw ElementDefMult weight is zero
});

it.each(['Frost','Volt','Flame','Physical'])('uses the stored %s ATK base for item CS independently of combat percentage and inheritance',element=>{
  const draft=unbuffedDraft(),gear=draft.gear[8];
  const combat=draft.combat.elements.find(e=>e.id===element)!;
  combat.attack=50000;
  gear.rows=[{type:element+' Attack %',value:0.05,beforeTitan:null}];gear.augments=[];
  for(const percent of [0,0.73,1.56,3]){
    combat.attackPercent=percent;
    const entry=gearCombatScore(gear,draft,catalog).entries.find(e=>e.type===element+' Attack %')!;
    expect(entry.base).toBe(50000);
    expect(entry.cs).toBe(3750);
  }
  combat.attack=0;
  expect(gearCombatScore(gear,draft,catalog).value).toBeNull();
});

it('includes rare Titan CS at the item level using the supplied table, independently of the combined effect level',()=>{
  const draft=unbuffedDraft(),gear=draft.gear[0];
  const observations=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../../../scripts/data/build-titan-observations.json'),'utf8')) as {items:{id:string;calculatedCS:number[]}[]};
  gear.titan=true;
  for(const item of observations.items){
    gear.rareId=item.id;
    for(let level=1;level<=3;level++){
      gear.rareLevel=level;
      const score=gearCombatScore(gear,draft,catalog);
      expect(score.titanCS).toBeCloseTo(item.calculatedCS[level-1],0);
      expect(score.value).toBe(Math.trunc(score.numeric+score.titanCS!));
      const other=draft.gear[1];other.equipped=true;other.titan=true;other.rareId=item.id;other.rareLevel=3;
      expect(gearCombatScore(gear,draft,catalog).titanCS).toBe(score.titanCS);
    }
  }
  gear.titan=false;
  expect(gearCombatScore(gear,draft,catalog).titanCS).toBe(0);
});

it('preserves manual relic A4 totals independently of equipped relics and accepts old drafts',()=>{
  const draft=unbuffedDraft();
  expect(restoreDraft(draft,catalog)).not.toBeNull();
  draft.relicDamage={Frost:0.052,Flame:0,Physical:null};
  expect(restoreDraft(draft,catalog)?.relicDamage).toEqual(draft.relicDamage);
  draft.relics.forEach(relic=>{relic.id='';relic.stars=0;});
  expect(restoreDraft(draft,catalog)?.relicDamage).toEqual(draft.relicDamage);
  const invalidTotals:Record<string,number|null>[]=[{Altered:.05},{Frost:-.01},{Frost:Infinity},{Unknown:.05}];
  for(const value of invalidTotals){
    draft.relicDamage=value;
    expect(restoreDraft(draft,catalog)).toBeNull();
  }
});

it('preserves a custom servant name, validates imports and resets it with pet selection',()=>{
  const draft=unbuffedDraft();
  draft.pet.customName='  A custom servant  ';
  expect(restoreDraft(draft,catalog)?.pet.customName).toBe('A custom servant');
  draft.pet.customName='x'.repeat(121);
  expect(restoreDraft(draft,catalog)).toBeNull();
  selectBuildPet(draft,draft.pet.id,catalog);
  expect(draft.pet.customName).toBeUndefined();
});

it('restores valid weapon modes, rejects unknown modes and clears mode on weapon replacement',()=>{
  const configured=structuredClone(catalog);
  const id=configured.demoDraft.weapons[0].id;
  configured.weapons.find(w=>w.id===id)!.selectableModes=[{id:'mode-one',name:{en:'One',ru:'Первый'},icon:'',description:{en:'',ru:''}}];
  const draft=structuredClone(configured.demoDraft);
  draft.weapons[0].mode='mode-one';
  expect(restoreDraft(draft,configured)?.weapons[0].mode).toBe('mode-one');
  draft.weapons[0].mode='unknown';expect(restoreDraft(draft,configured)).toBeNull();
  selectBuildWeapon(draft,0,id,configured);
  expect(draft.weapons[0].mode).toBeUndefined();
});

it('keeps PRV when one item rounds its crit rate above the captured extra-crit total',()=>{
  // 2026-10-09 card: Eyepiece CR 3.66 % with a captured 3.65 % total made the whole PRV total "—".
  const draft=unbuffedDraft();draft.combat.additionalCritRate=.0365;
  const base={flatAttack:0,attackPercent:0,damagePercent:0,critRating:0,critRate:0};
  const rounded=personalRVProfile(draft,catalog,'Frost',{...base,critRate:.0366})!;
  expect(rounded).not.toBeNull();
  expect(rounded.critChance).toBeCloseTo(personalRVProfile(draft,catalog,'Frost',{...base,critRate:.0365})!.critChance,12);
  expect(personalRVProfile(draft,catalog,'Frost',{...base,critRate:.04})).toBeNull();
});


it('copies the highest final element into Altered, then applies its own flat addition and percent without double counting',()=>{
  const draft=emptyDraft(catalog);
  draft.rv={element:'Altered',includeCrit:true,mode:'prv'};
  const frost=draft.combat.elements.find(item=>item.id==='Frost')!,volt=draft.combat.elements.find(item=>item.id==='Volt')!,altered=draft.combat.elements.find(item=>item.id==='Altered')!;
  frost.attack=1000;frost.attackPercent=1;volt.attack=1500;volt.attackPercent=.1;
  altered.attack=2300;altered.attackPercent=.1;
  const capture=BuildCaptureSchema.parse(JSON.parse(readFileSync(resolve(process.cwd(),'packages/contracts/src/__fixtures__/build-capture.json'),'utf8')));
  capture.combat.attack={IceAtk:2000,ThunderAtk:1650,FireAtk:0,PhysicalAttack:0,SuperpowerAtk:2530};
  draft.captureSource={kind:'file',digest:'test',capture,unresolved:[]};
  expect(elementTotalAttack(draft,catalog,'Altered')).toMatchObject({source:'Frost',attack:2300,ownAdded:300,total:2530});
  volt.attack=2400;
  expect(elementTotalAttack(draft,catalog,'Altered')).toMatchObject({source:'Volt',attack:2940,ownAdded:300});
  expect(elementTotalAttack(draft,catalog,'Altered').total).toBeCloseTo(3234);
  altered.attack=2000;altered.attackPercent=0;
  expect(elementTotalAttack(draft,catalog,'Altered')).toMatchObject({source:'Volt',attack:2640,ownAdded:0,total:2640});
});
