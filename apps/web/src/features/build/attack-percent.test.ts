import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import type {AttackPercentBonus,BuildCatalog} from './types';
import {matrixAttackPercentSources,attackPercentContributions,emptyDraft} from './model';
const parse=createRequire(import.meta.url)(resolve(import.meta.dirname,'../../../../../scripts/generators/build-attack-percent.cjs')) as (text:string)=>AttackPercentBonus[];
const calculateDemo=createRequire(import.meta.url)(resolve(import.meta.dirname,'../../../../../scripts/generators/build-demo-attack-percent.cjs')) as (catalog:BuildCatalog,options?:{matrixStacks?:Record<string,number>;resonance?:{elements:string[];value:number}[]})=>void;
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;

it('derives the authored ATK% totals from gear, strongest matrix pairs, shots, food, computing and resonance',()=>{
  const draft=catalog.demoDraft;
  for(const element of draft.combat.elements) {
    const gear=draft.gear.flatMap(g=>[...g.rows,...g.augments]).filter(s=>s.type===`${element.id} Attack %`||s.type==='Attack %').reduce((sum,s)=>sum+s.value,0);
    const matrices=matrixAttackPercentSources(draft,catalog).flatMap(s=>s.bonuses).filter(b=>b.elements.includes(element.id)).reduce((sum,b)=>sum+b.value*(b.maxStacks??1),0);
    const consumables=catalog.consumables.flatMap((g,i)=>attackPercentContributions(g.items.find(item=>item.id===draft.consumables?.[i])?.attackPercentBonuses,0,catalog)).filter(b=>b.elements.includes(element.id)).reduce((sum,b)=>sum+b.value,0);
    const computing=draft.computing.reduce((sum,n)=>sum+(catalog.computing.find(item=>item.id===n.id)?.effects.filter(e=>e.attackStat==='Attack %').reduce((total,e)=>total+(e.levels.find(l=>l.level===n.level)?.value??0),0)??0),0);
    const resonance=['Frost','Volt'].includes(element.id) ? .15 : 0;
    expect(element.attackPercent).toBeCloseTo(gear+matrices+consumables+computing+resonance,10);
  }
  expect(draft.combat.elements.map(e=>Number((e.attackPercent!*100).toFixed(1)))).toEqual([126,91.7,73.2,80.5,68.5]);
  const food=catalog.consumables[0].items.find(item=>item.name.en==='Power Nutripaste')!;
  expect(food.flatAttackBonuses).toEqual([{elements:['Physical'],value:500}]);
});
it('does not invent ATK% and applies only explicitly active matrix stacks',()=>{
  const variant=structuredClone(catalog);
  variant.demoDraft=emptyDraft(variant);
  variant.demoDraft.computing.forEach(n=>n.level=0);variant.demoDraft.support.forEach(n=>n.level=0);
  calculateDemo(variant);
  expect(variant.demoDraft.combat.elements.every(e=>e.attackPercent===0)).toBe(true);
  calculateDemo(variant,{resonance:[{elements:['Frost','Volt'],value:.15}]});
  expect(variant.demoDraft.combat.elements.map(e=>e.attackPercent)).toEqual([.15,.15,0,0,0]);
  const active=structuredClone(catalog),inactive=structuredClone(catalog);
  calculateDemo(active,{matrixStacks:{suit_SSR18:5}});calculateDemo(inactive);
  for(const element of active.demoDraft.combat.elements)expect(element.attackPercent!-inactive.demoDraft.combat.elements.find(e=>e.id===element.id)!.attackPercent!).toBeCloseTo(.13);
});

it('extracts all-element, single-element and paired-element ATK without confusing damage',()=>{
  expect(parse('Increase all elemental ATK by 26%/28%/30%/32%.')[0]).toMatchObject({elements:'all',values:[.26,.28,.3,.32]});
  expect(parse('Increases Frost Attack by 28%/30%/32%/34%.')[0].elements).toEqual(['Frost']);
  expect(parse('Increase physical and flame ATK by 20%/22%/24%/26%.')[0].elements).toEqual(['Physical','Flame']);
  expect(parse('Increase physical ATK and flame ATK by 14%/16%/18%/20%.')[0].elements).toEqual(['Physical','Flame']);
  expect(parse('Increase frost and volt damage by 13%/15%/17%/19%, frost and volt ATK by 5%.')).toEqual([{elements:['Frost','Volt'],values:[.05]}]);
  expect(parse('Deal damage equal to 50%/65%/90%/120% of volt ATK.')).toEqual([]);
  expect(parse('Increase crit damage by 50%. Restores (20% + 60,000) HP.')).toEqual([]);
});
it('recognizes food, both shots, stacking and resonance conditions',()=>{
  expect(parse('Frost Attack +1% + 45 for 900s')).toEqual([{elements:['Frost'],values:[.01]}]);
  expect(parse('Increase Physical Attack 12%, Physical Attack 500 for 900 seconds.')).toEqual([{elements:['Physical'],values:[.12]}]);
  expect(parse('Increase ATK by 2.5% for 7 days.')[0].values).toEqual([.025]);
  expect(parse('Increase ATK by 3.5% for 7 days.')[0].values).toEqual([.035]);
  expect(parse('Increase ATK by 2.1%/2.6%/3.1%/3.6% on hit for 18 seconds, stacking up to 5 times.')[0]).toMatchObject({maxStacks:5,conditional:true});
  expect(parse('When non-Benediction Resonance is active, increase frost ATK by 24%/26%/28%/30%. When Benediction Resonance is active, increase all attack by 24%/26%/28%/30%.').map(b=>b.condition)).toEqual(['non-benediction','benediction']);
});
