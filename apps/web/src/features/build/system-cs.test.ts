import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {computingCombatScore,matrixCombatScore,matrixSetScores,supportCombatScore,suppressorCombatScore,weaponCombatScore,weaponMatricesCombatScore} from './system-cs';
import type {BuildCatalog,BuildDraft} from './types';

// Generated catalog: the server values below were captured in source observation (2026-10-05, own RPC958 fWeaponScore/fMatrixScore).
const catalog=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;
type Weapon=BuildDraft['weapons'][number];
const weapon=(weaponId:string,stars:number,level:number,matrices:Weapon['matrices']=[]):Weapon=>({id:catalog.weapons.find(item=>item.weaponId?.toLowerCase()===weaponId.toLowerCase())!.id,stars,level,matrices});
const matrix=(suit:string,stars:number,level:number)=>({id:catalog.matrices.find(item=>item.id.toLowerCase()===suit.toLowerCase())!.id,stars,level});
const empty={id:'',stars:0,level:0};
const fullSet=(suit:string)=>[0,1,2,3].map(()=>matrix(suit,3,100));

describe('weapon and matrix CS against server scores',()=>{
  it('reproduces fWeaponScore 15221.153 for the login loadout',()=>{
    const total=[weapon('GreyFoxSP_ice',0,0),weapon('BlackStar_SuperPower',6,200),weapon('Lana_SuperPower',6,200)].reduce((sum,item)=>sum+weaponCombatScore(item,catalog)!,0);
    expect(total).toBeCloseTo(15221.153,1);
  });
  it('reproduces fMatrixScore: three Lv.100 ★3 sets = 25720.008, 8573.336 each',()=>{
    const sets=['suit_SSR53','suit_SSR51','suit_SSR63'].map(suit=>weaponMatricesCombatScore(weapon('Lana_SuperPower',6,200,fullSet(suit)),catalog));
    for(const value of sets)expect(value).toBeCloseTo(8573.336,2);
    expect(matrixSetScores(fullSet('suit_SSR53'),catalog).map(set=>set.score)).toEqual([80,160]);
  });
  it('counts single matrices and a 2-piece ★0 set bonus',()=>{
    expect(matrixCombatScore(matrix('suit_SSR7',3,100),3,catalog)).toBeCloseTo(2083.333,2);
    expect(matrixCombatScore(matrix('suit_SSR7',0,3),3,catalog)).toBeCloseTo(60.680,2);
    const pair=weaponMatricesCombatScore(weapon('Lana_SuperPower',6,200,[empty,empty,matrix('suit_SSR7',0,3),matrix('suit_SSR7',0,3)]),catalog);
    expect(pair).toBeCloseTo(171.359,2);
  });
  it('stays empty for unknown weapons or matrices',()=>{
    expect(weaponCombatScore({id:'',stars:0,level:0,matrices:[]},catalog)).toBeNull();
    expect(matrixCombatScore(empty,0,catalog)).toBeNull();
  });
});

// Raw attributes: EquipSlotEvolution curves, DT_OuterSpaceSupportModule, DT_Suppressor_Overseas → ModifyDataTable_Overseas.
describe('Supercomputing, Space Support and suppressor CS',()=>{
  const draft=catalog.demoDraft;
  const node=(slot:string,level:number)=>({id:catalog.computing.find(item=>item.slot===slot)!.id,level});
  it('weights the suppressor step package: V12.5 = 6018.16',()=>{
    expect(suppressorCombatScore({...draft,profile:{...draft.profile,suppressorId:'12_5'}},catalog)!.value).toBeCloseTo(6018.16,2);
    expect(suppressorCombatScore({...draft,profile:{...draft.profile,suppressorId:''}},catalog)).toBeNull();
  });
  it('scores Space Support ATK and DMG% modules',()=>{
    expect(supportCombatScore({id:'PhysicalAttack',level:10},catalog)!.value).toBeCloseTo(2250,6);
    expect(supportCombatScore({id:'PhysicalDamage',level:10},catalog)!.value).toBeCloseTo(3760,6);
    expect(supportCombatScore({id:'PhysicalDamage',level:0},catalog)!.parts).toEqual([]);
  });
  it('scores content modules (Buff_FinDamageUp_WH<Lv>) like DMG%: twice the base DMG module',()=>{
    for(const level of [1,5,10])expect(supportCombatScore({id:'NewRow_4',level},catalog)!.value)
      .toBeCloseTo(2*supportCombatScore({id:'PhysicalDamage',level},catalog)!.value,6);
    expect(supportCombatScore({id:'NewRow_19',level:10},catalog)!.value).toBeCloseTo(7520,6);
  });
  it('scores the five fixed-base DMG% of a node: Lv.1 1880, Lv.10 18800, Lv.20 47000',()=>{
    for(const slot of ['EQUIPMENT_SLOT_HEAD','EQUIPMENT_SLOT_REACTION_FURNACE','EQUIPMENT_SLOT_ECTOSKELETON','EQUIPMENT_SLOT_EYEPIECE'])
      expect([1,10,20].map(level=>computingCombatScore(node(slot,level),catalog)!.value)).toEqual([1880,18800,47000].map(value=>expect.closeTo(value,6)));
  });
  it('leaves pool-dependent ATK% / RES%, healing and Shatter out',()=>{
    expect(computingCombatScore(node('EQUIPMENT_SLOT_ECTOSKELETON',20),catalog)!.unscored).toEqual(['BreakDefMult','PhyAtkMult','IceAtkMult','FireAtkMult','ThunderAtkMult']);
    expect(computingCombatScore(node('EQUIPMENT_SLOT_HEAD',20),catalog)!.unscored).toEqual(expect.arrayContaining(['HealUpMult','PhyDefMult','SuperpowerDefMult']));
  });
});
