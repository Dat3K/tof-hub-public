import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {GearCell,GearScore,OptimizerInventoryGrid} from './optimizer-inventory';
import {gearBeforeTitan,rankInventory} from './model';
import {formatValue} from '../build/presentation';
import type {BuildCatalog} from '../build/types';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../build/__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
const maximumTitle='Current value / Titan maximum for this item’s rolls';
const maximumValues=()=>Array.from(document.querySelectorAll(`[data-hint="${maximumTitle}"]`));

describe('optimizer gear ceilings',()=>{
  it('combines counted partner ATK with universal ATK in the gear summary',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]!);
    gear.rows=[{type:'Attack',value:589,beforeTitan:400},{type:'Volt Attack',value:1296,beforeTitan:900}];gear.augments=[];
    render(<GearCell gear={gear} catalog={catalog} locale="en" label="Exoskeleton" ratedTypes={['Attack','Volt Attack']}
      summaryContext={{element:'Frost',role:'dps'}}/>);
    const summary=screen.getByLabelText('Useful stat totals');
    expect(summary.textContent).toBe(formatValue(1885,false,'en'));
  });
  it('tries the displayed right-hand forecast and falls back to actual gear when no forecast exists',()=>{
    const draft=structuredClone(catalog.demoDraft);
    const piece={key:'test-piece',gear:{...gearBeforeTitan(draft.gear[0]!)!,equipped:false}};
    const entry=rankInventory([piece],draft,catalog,98)[0]!;
    expect(entry.forecast).toBeTruthy();
    expect(entry.projection.kind).toBe('transfer');
    const onTry=vi.fn();
    const props={draft,catalog,locale:'en' as const,metric:'DMG',target:98,label:'Inventory',onCompare:vi.fn(),onTry};
    const {rerender}=render(<OptimizerInventoryGrid {...props} entries={[entry]}/>);
    fireEvent.click(screen.getByRole('button',{name:'Try on Helmet test-piece'}));
    expect(onTry).toHaveBeenLastCalledWith('test-piece',true);
    rerender(<OptimizerInventoryGrid {...props} entries={[{...entry,forecast:null,projection:{...entry.projection,gear:null}}]}/>);
    fireEvent.click(screen.getByRole('button',{name:'Try on Helmet test-piece'}));
    expect(onTry).toHaveBeenLastCalledWith('test-piece',false);
  });
  it('exposes temporary state and its revert action without depending on colour',()=>{
    const revert=vi.fn();
    render(<GearCell gear={catalog.demoDraft.gear[0]!} catalog={catalog} locale="ru" label="Шлем" tone="whatif"
      status={<><span>Временно · из рюкзака</span><button type="button" aria-label="Вернуть Шлем" onClick={revert}>↶</button></>}
      score={<GearScore prv={120} baseline={100} maximum={200} locale="ru"/>}/>);
    expect(screen.getByRole('region',{name:'Шлем'}).getAttribute('data-tone')).toBe('whatif');
    expect(screen.getByText('Временно · из рюкзака')).toBeTruthy();
    const button=screen.getByRole('button',{name:'Вернуть Шлем'});button.focus();expect(document.activeElement).toBe(button);
    fireEvent.click(button);expect(revert).toHaveBeenCalledOnce();
  });
  it('shows the personal share of the slot ceiling in EN/RU and omits it when PRV is unavailable',()=>{
    const {rerender}=render(<GearScore prv={221.1} maximum={276.375} locale="en" gain={.01844} metric="DMG"/>);
    expect(screen.getByTitle('Share of the slot’s maximum PRV for the current build').textContent).toBe('80.0%');
    expect(screen.getByTitle('Δ DMG').textContent).toBe('+1.844%');
    rerender(<GearScore prv={221.1} maximum={276.375} locale="ru"/>);
    expect(screen.getByTitle('Доля максимального PRV слота для текущего билда').textContent).toBe('80,0%');
    rerender(<GearScore prv={null} maximum={276.375} locale="en"/>);
    expect(screen.queryByText(/%/)).toBeNull();
    rerender(<GearScore prv={221.1} maximum={0} locale="en"/>);
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('keeps actual stats and roll details beside known Titan ceilings, and removes ceilings when the base is unknown',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]!);
    gear.equipped=false; // A known backpack item has the same intrinsic ceiling as an equipped item.
    const {rerender}=render(<GearCell gear={gear} catalog={catalog} locale="en" label="Helmet" density="compact"/>);
    expect(maximumValues()).toHaveLength(gear.rows.length+gear.augments.length);
    for(const row of gear.rows)expect(maximumValues().some(value=>value.textContent?.startsWith(formatValue(row.value,!!catalog.reference.statTypes[row.type]?.isPercentageBased,'en')))).toBe(true);
    expect(screen.getAllByText(/^×/)).toHaveLength(gear.rows.length);
    gear.rows=gear.rows.map(row=>({...row,beforeTitan:null}));
    rerender(<GearCell gear={gear} catalog={catalog} locale="en" label="Helmet" density="compact"/>);
    expect(maximumValues()).toHaveLength(0);
    expect(screen.getByText(formatValue(gear.rows[0]!.value,false,'en'),{exact:true})).toBeTruthy();
  });

  it('leaves an empty manual slot without stats or a fabricated maximum',()=>{
    const gear={...catalog.demoDraft.gear[0]!,equipped:false};
    render(<GearCell gear={gear} catalog={catalog} locale="ru" label="Шлем" empty density="compact"/>);
    expect(screen.getByText('Пустой слот',{exact:true})).toBeTruthy();
    expect(maximumValues()).toHaveLength(0);
    expect(screen.queryByText(/^×/)).toBeNull();
  });
});
