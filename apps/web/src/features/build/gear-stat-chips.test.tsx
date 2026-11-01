import {render,screen,fireEvent,within} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {GearStatChips} from './gear-stat-chips';
import type {BuildCatalog} from './types';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;

describe('shared gear table stat chips',()=>{
  it.each([
    ['Frost Attack %',.02,'Frost ATK % 2.00%','≈ +400'],
    ['Frost Damage %',.03,'Frost DMG % 3.00%','≈ +800'],
    ['Crit Rate %',.02,'CR % 2.00%','≈ +500'],
  ] as const)('converts %s into base units using the complete reference profile',async(type,value,accessible,expected)=>{
    render(<GearStatChips entries={[{type,value}]} element="Frost" catalog={catalog} locale="en" equivalenceProfile={{flatAttack:40000,attackPercent:1,damagePercent:.5,critChance:.5,critDamageBonus:.5,critDenominator:25000}}/>);
    fireEvent.focus(screen.getByLabelText(accessible));
    expect(within(await screen.findByRole('tooltip')).getByText(expected)).toBeTruthy();
  });
  it('combines counted duo ATK into one chip with both sources in its keyboard tooltip',async()=>{
    const {container}=render(<GearStatChips entries={[{type:'Attack',value:495},{type:'Volt Attack',value:912}]} element="Frost" flatElements={['Frost','Volt']} catalog={catalog} locale="en"/>);
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    fireEvent.focus(screen.getByLabelText('Volt ATK 1,407'));
    const tooltip=await screen.findByRole('tooltip');
    expect(within(tooltip).getAllByText('Volt ATK')).toHaveLength(2);
    expect(within(tooltip).getByText('912')).toBeTruthy();
  });
  it.each([
    {element:'Physical',pair:['Physical','Flame'],winner:'Flame',other:'Physical'},
    {element:'Volt',pair:['Volt','Frost'],winner:'Frost',other:'Volt'},
  ])('labels a mixed $element duo total by its larger counted ATK source',async({element,pair,winner,other})=>{
    const {container}=render(<GearStatChips entries={[{type:'Attack',value:5006},{type:`${other} Attack`,value:1880},{type:`${winner} Attack`,value:12336}]} element={element} flatElements={pair} catalog={catalog} locale="en"/>);
    const chip=screen.getByLabelText(`${winner} ATK 17,342`);
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(chip.querySelector('img')?.getAttribute('src')).toBe(catalog.statTypeIcons[`${winner} Attack`]!.icon);
    fireEvent.focus(chip);
    const tooltip=await screen.findByRole('tooltip');
    expect(within(tooltip).queryByText(`${other} ATK`)).toBeNull();
    expect(within(tooltip).queryByText('1,880')).toBeNull();
    expect(within(tooltip).getByText('12,336')).toBeTruthy();
  });
  it('converts attack percent in the styled tooltip when a real build base is supplied',async()=>{
    render(<GearStatChips entries={[{type:'Frost Attack %',value:.0159}]} element="Frost" attackBase={39052} catalog={catalog} locale="en"/>);
    fireEvent.focus(screen.getByLabelText('Frost ATK % 1.59%'));
    const tooltip=await screen.findByRole('tooltip');
    expect(within(tooltip).getByText('≈ +621')).toBeTruthy();
    expect(within(tooltip).queryByText('Base ATK')).toBeNull();
  });
  it('combines flat attack and orders crit, flat attack, attack percent and damage percent',async()=>{
    const {container}=render(<GearStatChips entries={[{type:'Frost Damage %',value:.01},{type:'Attack',value:100},{type:'Frost Attack %',value:.02},{type:'Crit',value:800},{type:'Frost Attack',value:200}]} element="Frost" catalog={catalog} locale="en"/>);
    expect([...container.children].map(node=>node.textContent)).toEqual(['800','300','A2.00%','D1.00%']);
    expect(screen.getByLabelText('Frost ATK 300')).toBeTruthy();
    fireEvent.focus(screen.getByLabelText('Frost ATK 300'));
    const tooltip=await screen.findByRole('tooltip');
    expect(within(tooltip).getByText('ATK')).toBeTruthy();
    expect(within(tooltip).getByText('100')).toBeTruthy();
    expect(within(tooltip).getByText('200')).toBeTruthy();
  });
  it('sums repeated stats and keeps crit rate before attack, damage, resistance and HP',()=>{
    const entries=[{type:'HP %',value:.02},{type:'HP',value:100},{type:'Frost Resistance %',value:.03},{type:'Frost Resistance',value:60},{type:'Resistance',value:20},{type:'Frost Damage %',value:.01},{type:'Frost Attack %',value:.02},{type:'Volt Attack',value:70},{type:'Frost Attack',value:200},{type:'Attack',value:100},{type:'Crit Rate %',value:.01},{type:'Crit',value:800},{type:'Crit',value:200}];
    const {container}=render(<GearStatChips entries={entries} element="Frost" catalog={catalog} locale="en"/>);
    expect([...container.querySelectorAll('[aria-label]')].map(node=>node.getAttribute('aria-label'))).toEqual(['Crit 1,000','CR % 1.00%','Volt ATK 70','Frost ATK 300','Frost ATK % 2.00%','Frost DMG % 1.00%','RES 20','Frost RES 60','Frost RES % 3.00%','HP 100','HP % 2.00%']);
  });
  it('combines tank resistance and lets the caller provide generic/localized labels',()=>{
    render(<GearStatChips entries={[{type:'Resistance',value:30},{type:'Frost Resistance',value:70}]} element="Frost" catalog={catalog} locale="ru" role="tank" label={()=>'Сопротивление'}/>);
    expect(screen.getByLabelText('Сопротивление 100')).toBeTruthy();
  });
});

it.each(['dps','healer'] as const)('combines inherited Frost and universal ATK under Altered %s without scaling or mixing own Altered ATK',async role=>{
  const {container}=render(<GearStatChips entries={[{type:'Frost Attack',value:1960.4},{type:'Attack',value:297.6},{type:'Altered Attack',value:500}]} element="Altered" flatElements={['Altered']} catalog={catalog} locale="en" role={role}/>);
  expect(screen.getByLabelText('Frost ATK 2,258')).toBeTruthy();
  expect(screen.getByLabelText('Altered ATK 500')).toBeTruthy();
  expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(2);
  fireEvent.focus(screen.getByLabelText('Frost ATK 2,258'));
  const tooltip=await screen.findByRole('tooltip');
  expect(within(tooltip).getByText('ATK')).toBeTruthy();
  expect(within(tooltip).getByText('298')).toBeTruthy();
});
it('keeps universal ATK separate from own Altered ATK when no native stat is counted',()=>{
  render(<GearStatChips entries={[{type:'Attack',value:100},{type:'Altered Attack',value:500}]} element="Altered" catalog={catalog} locale="en"/>);
  expect(screen.getByLabelText('ATK 100')).toBeTruthy();expect(screen.getByLabelText('Altered ATK 500')).toBeTruthy();
});
