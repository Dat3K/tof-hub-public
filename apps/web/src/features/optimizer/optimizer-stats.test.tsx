import {render,screen,within} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {supportAttack} from '../build/support-attack';
import {RollValueProfile} from '../build/gear-roll-value';
import {personalRVProfile} from '../build/rv-profile';
import {formatValue} from '../build/presentation';
import {duoInheritedValue,elementTotalAttack,elementTotalDamagePercent,gearRollValue,gearElementStat} from '../build/model';
import type {BuildCatalog} from '../build/types';
import {OptimizerStats} from './optimizer-stats';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../build/__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
// Baseline cases enter totals with no selected temporary consumables.
const unbuffedDraft=()=>{const draft=structuredClone(catalog.demoDraft);draft.consumables=catalog.consumables.map(()=>'');return draft;};
const makeDraft=()=>{const draft=unbuffedDraft();draft.rv={mode:'prv',element:'Frost',includeCrit:true};return draft;};

describe('visible optimizer baseline',()=>{
  it.each(['en','ru'] as const)('highlights the larger gear ATK and includes both flat roll types in %s',locale=>{
    const draft=makeDraft();
    draft.gear.forEach(gear=>{gear.rows=[];gear.augments=[];});
    draft.gear[0]!.rows=[{type:'Frost Attack',value:1000,beforeTitan:700},{type:'Volt Attack',value:1296,beforeTitan:900}];
    draft.combat.elements.find(row=>row.id==='Frost')!.attack=50000;
    draft.combat.elements.find(row=>row.id==='Volt')!.attack=60000;
    const {container}=render(<OptimizerStats draft={draft} catalog={catalog} locale={locale}/>);
    const table=screen.getByRole('table',{name:locale==='en'?'Equipped gear totals':'Сумма статов надетого гира'});
    const rows=within(table).getAllByRole('row').slice(1);
    expect(rows[0]!.querySelector('td[colspan="2"]')?.hasAttribute('data-used')).toBe(false);
    expect(rows[1]!.querySelector('td[colspan="2"]')?.getAttribute('data-used')).toBe('true');
    expect(container.querySelector('[data-rv-roll-type="Frost Attack"]')?.getAttribute('data-rv-roll-weight')).toBe('0');
    expect(Number(container.querySelector('[data-rv-roll-type="Volt Attack"]')?.getAttribute('data-rv-roll-weight'))).toBeGreaterThan(0);
  });
  it('updates both Crit weights across the cap when enemy level changes in EN and RU',()=>{
    for(const locale of ['en','ru'] as const) {
      const draft=makeDraft();draft.weapons=[];draft.enemyLevel=100;
      draft.combat.crit=catalog.reference.critFormula.denominators[100]!*.999;draft.combat.additionalCritRate=0;
      const view=render(<OptimizerStats draft={draft} catalog={catalog} locale={locale}/>);
      const weight=(type:string)=>Number(view.container.querySelector(`[data-rv-roll-type="${type}"]`)!.getAttribute('data-rv-roll-weight'));
      for(const type of ['Crit','Crit Rate %'])expect(weight(type)).toBeGreaterThan(0);
      view.rerender(<OptimizerStats draft={{...draft,enemyLevel:1}} catalog={catalog} locale={locale}/>);
      for(const type of ['Crit','Crit Rate %'])expect(weight(type)).toBe(0);
      view.rerender(<OptimizerStats draft={draft} catalog={catalog} locale={locale}/>);
      for(const type of ['Crit','Crit Rate %'])expect(weight(type)).toBeGreaterThan(0);
      view.unmount();
    }
  });
  it('does not repeat support already included in the personal base',()=>{
    const profile=personalRVProfile(makeDraft(),catalog,'Frost')!;
    for(const role of ['dps','healer','tank'] as const) {
      const view=render(<RollValueProfile profile={profile} enemyLevel={100} locale="ru" role={role}/>);
      expect(screen.queryByText('Space Support · после АТК%')).toBeNull();
      view.unmount();
    }
  });
  it('can omit post-percentage attack from the comparison presentation',()=>{
    const profile=personalRVProfile(makeDraft(),catalog,'Frost')!;
    render(<RollValueProfile profile={profile} enemyLevel={100} locale="en" showPostPercentAttack={false}/>);
    expect(screen.queryByText('Space Support · after ATK%')).toBeNull();
    expect(screen.getByText('Flat ATK before ATK%')).toBeTruthy();
  });
  it('shows base and final attack, limits rows to the pair, and exposes actual gear percentages',()=>{
    const draft=makeDraft();render(<OptimizerStats draft={draft} catalog={catalog} locale="en"/>);
    const combat=screen.getByRole('table',{name:'Combat stats'}),gear=screen.getByRole('table',{name:'Equipped gear totals'});
    const gearFrost=within(gear).getByRole('row',{name:/^Frost /});
    expect(within(gearFrost).getByText(formatValue(gearElementStat(draft,catalog,'Frost','Attack','rolls'),false,'en',0))).toBeTruthy();
    expect(within(combat).getAllByRole('row')).toHaveLength(2);
    expect(within(combat).queryByText('Flame')).toBeNull();
    expect(within(combat).getByText(formatValue(elementTotalAttack(draft,catalog,'Frost').attack,false,'en',0))).toBeTruthy();
    // Strip each source support before inheritance and retain destination support once.
    const total=elementTotalAttack(draft,catalog,'Frost'),support=supportAttack(draft,catalog,'Frost');
    expect(total.total).toBeCloseTo((Math.max(...draft.combat.elements.filter(row=>row.id==='Frost'||row.id==='Volt').map(row=>row.attack-supportAttack(draft,catalog,row.id)))+support)*(1+total.percent));
    expect(within(combat).getByText(`+ ${formatValue(total.attack*total.percent,false,'en',0)}`)).toBeTruthy();
    expect(within(combat).getByText(`= ${formatValue(total.total,false,'en',0)}`)).toBeTruthy();
    expect(within(gear).getByText(formatValue(gearElementStat(draft,catalog,'Frost','Damage %'),true,'en',1))).toBeTruthy();
    expect(screen.queryByText('Resistance')).toBeNull();
    expect(screen.queryByText('Titan · total levels')).toBeNull();
  });
  it('converts the selected element’s own ATK% using the inherited base and marks each used column like Build',()=>{
    const draft=makeDraft(),frost=draft.combat.elements.find(row=>row.id==='Frost')!,volt=draft.combat.elements.find(row=>row.id==='Volt')!;
    frost.attack=50000;frost.attackPercent=1.2;frost.damage=.5;
    volt.attack=60000;volt.attackPercent=2;volt.damage=.8;
    render(<OptimizerStats draft={draft} catalog={catalog} locale="en"/>);
    const table=screen.getByRole('table',{name:'Combat stats'});
    const selected=within(table).getByRole('row',{name:/^Frost /});
    expect(within(table).queryByRole('row',{name:/^Volt /})).toBeNull();
    const fusion=elementTotalAttack(draft,catalog,'Frost');
    expect(fusion.base).toBe(59700);
    expect(within(selected).getByText(`+ ${formatValue(fusion.attack*fusion.percent,false,'en',0)}`)).toBeTruthy();
    expect(within(selected).getByText(`= ${formatValue(fusion.total,false,'en',0)}`)).toBeTruthy();
    expect(within(selected).queryByText(/Base:/)).toBeNull();
    const totals=(key:'attackPercent'|'damage')=>Object.fromEntries(draft.combat.elements.map(row=>[row.id,row[key]??0]));
    const percentSource=duoInheritedValue(draft,catalog,'Frost','Attack %',totals('attackPercent'))?.from??'Frost';
    const damageSource=duoInheritedValue(draft,catalog,'Frost','Damage %',totals('damage'))?.from??'Frost';
    const cells=Array.from(selected.querySelectorAll('td'));
    expect(cells[0]!.querySelector('[data-element]')?.getAttribute('data-element')).toBe('Volt');
    expect(cells[2]!.querySelector('[data-element]')?.getAttribute('data-element')).toBe(percentSource);
    expect(cells[3]!.querySelector('[data-element]')?.getAttribute('data-element')).toBe(damageSource);
    expect(cells[3]!.textContent).toBe(formatValue(elementTotalDamagePercent(draft,catalog,'Frost'),true,'en',1));
  });
  it('does not invent an ATK% bonus or a final attack when the percentage is missing',()=>{
    const draft=makeDraft();draft.combat.elements.find(row=>row.id==='Frost')!.attackPercent=undefined;
    render(<OptimizerStats draft={draft} catalog={catalog} locale="ru"/>);
    const row=within(screen.getByRole('table',{name:'Боевые показатели'})).getByRole('row',{name:/^Л[её]д /});
    expect(within(row).getByText('+ —')).toBeTruthy();
    expect(within(row).getByText('= —')).toBeTruthy();
  });
  it('leaves attack columns unmarked for Tank, matching Build’s resistance focus',()=>{
    const draft=makeDraft();draft.profile.role='tank';
    render(<OptimizerStats draft={draft} catalog={catalog} locale="en"/>);
    for(const name of ['Combat stats','Equipped gear totals'])expect(screen.getByRole('table',{name}).querySelector('[data-used],[data-counted]')).toBeNull();
    expect(screen.queryByText(/On a duo pair/)).toBeNull();
  });
  it('uses complete equipped-build weights and preserves a useful zero Crit weight at cap',()=>{
    const draft=makeDraft();draft.weapons=[];
    draft.combat.crit=catalog.reference.critFormula.denominators[draft.enemyLevel]!*2;
    const {container}=render(<OptimizerStats draft={draft} catalog={catalog} locale="en"/>);
    const full=gearRollValue({...draft.gear[0]!,equipped:false},draft,catalog);
    const rows=container.querySelectorAll('[data-rv-roll-weight]');
    for(const row of rows){const expected=full.rollWeights.find(weight=>weight.type===row.getAttribute('data-rv-roll-type'))!;expect(Number(row.getAttribute('data-rv-roll-weight'))).toBeCloseTo(expected.value!,12);}
    expect(container.querySelector('[data-rv-roll-type="Crit"]')?.getAttribute('data-rv-roll-weight')).toBe('0');
    expect(container.querySelector('[data-rv-roll-type="HP"]')).toBeNull();
    expect(within(screen.getByRole('table',{name:'Combat stats'})).getAllByRole('row')).toHaveLength(2);
  });
  it('localizes tables and keeps missing weights unavailable',()=>{
    const draft=makeDraft();draft.enemyLevel=0;render(<OptimizerStats draft={draft} catalog={catalog} locale="ru"/>);
    expect(screen.getByRole('table',{name:'Боевые показатели'})).toBeTruthy();
    expect(screen.getByRole('columnheader',{name:'Итоговая АТК'})).toBeTruthy();
    expect(screen.getByText('Недостаточно боевых данных для персональных весов.')).toBeTruthy();
    expect(screen.queryByRole('table',{name:'Веса статов · PRV'})).toBeNull();
  });
});
