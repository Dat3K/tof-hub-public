import {describe,it,expect} from 'vitest';
import {activeWeaponResonances,buildWeaponElements,mainWeaponResonance} from './weapon-resonances';
import {rollValueContext,rollValueElement} from './model';
import {setWeaponSkill} from '../info-sections/common/weapon-options';
import type {BuildCatalog,BuildDraft,WeaponItem} from './types';
const localized={en:'Test',ru:'Тест'};
const resonance=(element:string,id:string)=>({id,element,requiredWeapons:2,name:localized,description:localized,icon:''});
const weapon=(id:string,elements:string[],resonanceElements:string[]):WeaponItem=>({id,elements,weapon:localized,name:localized,icon:'',weaponId:id,role:'dps',avatar:'',art:'',traitIcon:'',trait:localized,resonances:resonanceElements.map(element=>resonance(element,id+element))});
const newest=weapon('new',['Volt','Frost'],['Volt','Frost']);
const older=weapon('old',['Volt'],['Volt']);
const ancient=weapon('ancient',['Volt'],[]);
const dynamic={...weapon('dynamic',['Altered'],['Volt','Frost','Altered']),selectableElements:[{id:'Volt',elements:['Volt','Frost']},{id:'Altered',elements:['Altered']}]};
const catalog={weapons:[newest,dynamic,older,ancient]} as BuildCatalog;
const draft=(ids:string[])=>({weapons:ids.map(id=>({id,stars:0,level:1,matrices:[]}))}) as unknown as BuildDraft;
describe('elemental resonance selection',()=>{
  it('uses the main active resonance for Auto even when the other element has greater ATK, retaining the pair',()=>{
    const selected=draft(['dynamic','new']);selected.weapons[0].element='Volt';
    selected.profile={role:'dps'} as BuildDraft['profile'];
    selected.combat={elements:[{id:'Volt',attack:100},{id:'Frost',attack:10000}]} as BuildDraft['combat'];
    expect(rollValueElement(selected,catalog)).toBe('Volt');
    expect(rollValueContext(selected,catalog).percentElements).toEqual(['Volt','Frost']);
    // A raw table lists Frost first, but the weapon's selected/main element is Volt.
    const reversed={...catalog,weapons:[{...newest,resonances:[...newest.resonances!].reverse()},dynamic,older,ancient]};
    expect(mainWeaponResonance(selected,reversed)?.element).toBe('Volt');
    selected.rv={element:'Frost',includeCrit:true};
    expect(rollValueElement(selected,catalog)).toBe('Frost');
    expect(rollValueContext(selected,catalog).percentElements).toEqual(['Frost','Volt']);
    selected.rv.element='';selected.weapons=[];
    expect(rollValueElement(selected,catalog)).toBe('Frost');
  });
  it('keeps one Volt resonance from the newest eligible weapon regardless of slot order',()=>{
    expect(activeWeaponResonances(draft(['old','new','ancient']),catalog).map(item=>item.id)).toEqual(['newVolt']);
  });
  it('does not invent a resonance on old weapons',()=>{
    expect(activeWeaponResonances(draft(['ancient','ancient']),catalog)).toEqual([]);
  });
  it('counts both elements of a selected pair and keeps parallel resonances',()=>{
    const selected=draft(['new','dynamic']);selected.weapons[1].element='Volt';
    expect(activeWeaponResonances(selected,catalog).map(item=>item.element)).toEqual(['Volt','Frost']);
    delete selected.weapons[1].element;
    expect(activeWeaponResonances(selected,catalog)).toEqual([]);
    selected.weapons[1].element='Altered';
    expect(activeWeaponResonances(selected,catalog)).toEqual([]);
  });
  it('preserves the order of Scatter slots and avoids duplicate techniques',()=>{
    expect(setWeaponSkill(['a','b'],1,'a')).toEqual(['','a']);
    expect(setWeaponSkill(undefined,0,'a')).toEqual(['a','']);
  });
});

it('copies established resonance elements without counting the automatic weapon to establish them',()=>{
  const auto={...weapon('auto',['Altered'],['Frost','Volt']),elementFromResonance:true};
  const frost=weapon('frost',['Frost'],['Frost']);
  const setup={weapons:[auto,newest,frost,ancient]} as BuildCatalog;
  expect(buildWeaponElements(draft(['auto','new','frost']),setup)[0]).toEqual(['Frost']);
  expect(buildWeaponElements(draft(['auto','new','new']),setup)[0]).toEqual(['Volt','Frost']);
  expect(buildWeaponElements(draft(['auto','frost']),setup)[0]).toEqual(['Altered']);
  expect(buildWeaponElements(draft(['auto','ancient','ancient']),setup)[0]).toEqual(['Altered']);
  expect(activeWeaponResonances(draft(['auto','new','frost']),setup).map(r=>r.element)).toEqual(['Frost']);
});
