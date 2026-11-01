import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ToastProvider} from '@tof-hub/ui';
import type {BuildCatalog} from '../build/types';
import {importBuildCapture} from '../build/capture-import';
import {OptimizerView} from './optimizer-view';
import {OPTIMIZER_STORAGE_KEY,exampleSession} from './storage';

const language=vi.hoisted(()=>({locale:'en' as 'en'|'ru'}));
vi.mock('@/lib/i18n',async importOriginal=>({...await importOriginal<object>(),useLocale:()=>({locale:language.locale})}));
vi.mock('../build/capture-import',()=>({importBuildCapture:vi.fn(),serverRefusalNotice:()=>''}));
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../build/__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
const gear={...structuredClone(catalog.demoDraft.gear[0]!),equipped:false};
gear.rows.find(row=>row.type==='Frost Attack')!.value+=1000;
const demo={schemaVersion:1 as const,source:'demo' as const,pieces:[{key:'test-helmet',gear}]};
const view=()=> <ToastProvider><OptimizerView catalog={catalog} demo={demo}/></ToastProvider>;
const equipment=()=>screen.getByRole('region',{name:language.locale==='en'?'Equipped gear':'Надетый гир'});
const inventory=()=>screen.getByRole('list',{name:language.locale==='en'?'Inventory comparison':'Сравнение инвентаря'});
// A temporary replacement marks the slot cell (data-tone="whatif") and the counter above the gear grid.
const helmetTone=()=>within(equipment()).getByRole('region',{name:language.locale==='en'?'Helmet':'Шлем'}).getAttribute('data-tone');
const temporaryCounter=()=>within(equipment()).queryByText(/Temporary changes|Временные замены/);
async function openInventory() {
  await screen.findByRole('heading',{name:'Gear optimizer'});
  fireEvent.click(screen.getByRole('radio',{name:/^All pieces/}));
}

beforeEach(()=>{localStorage.clear();language.locale='en';vi.clearAllMocks();});
describe('optimizer temporary page state',()=>{
  it('temporarily fills an empty slot and restores that empty slot',async()=>{
    const session=exampleSession(catalog);session.draft.gear[0]!.equipped=false;
    localStorage.setItem(OPTIMIZER_STORAGE_KEY,JSON.stringify(session));
    render(view());await openInventory();
    fireEvent.click(within(inventory()).getByRole('button',{name:'Try on Helmet test-helmet'}));
    await waitFor(()=>expect(helmetTone()).toBe('whatif'));
    // The real slot was empty: no real piece moves into the inventory.
    expect(screen.queryByRole('article',{name:'Helmet · equipped-helmet'})).toBeNull();
    fireEvent.click(within(equipment()).getByRole('button',{name:'Reset all'}));
    const helmet=within(equipment()).getByRole('region',{name:'Helmet'});
    expect(within(helmet).getByText('Empty slot')).toBeTruthy();
    expect(temporaryCounter()).toBeNull();
  },20000);
  it('moves backpack gear into the build and the real item into inventory; locale, revert and reset keep the baseline intact',async()=>{
    const saved=JSON.stringify(exampleSession(catalog));localStorage.setItem(OPTIMIZER_STORAGE_KEY,saved);
    const rendered=render(view());await openInventory();
    fireEvent.click(within(inventory()).getByRole('button',{name:'Try on Helmet test-helmet'}));
    await waitFor(()=>expect(helmetTone()).toBe('whatif'));
    expect(within(inventory()).queryByRole('article',{name:'Helmet · test-helmet'})).toBeNull();
    const real=within(inventory()).getByRole('article',{name:'Helmet · equipped-helmet'});
    expect(within(real).getByText('Equipped (real)')).toBeTruthy();
    expect(temporaryCounter()!.textContent).toContain('1');
    expect(localStorage.getItem(OPTIMIZER_STORAGE_KEY)).toBe(saved);
    language.locale='ru';rendered.rerender(view());
    expect(within(inventory()).getByText('Надето в реальном билде')).toBeTruthy();
    // Resetting the real piece from the inventory reverts that slot.
    fireEvent.click(within(inventory()).getByRole('button',{name:'Сбросить Шлем equipped-helmet'}));
    expect(helmetTone()).not.toBe('whatif');
    expect(temporaryCounter()).toBeNull();
    language.locale='en';rendered.rerender(view());
    fireEvent.click(within(inventory()).getByRole('button',{name:'Try on Helmet test-helmet'}));
    fireEvent.click(within(equipment()).getByRole('button',{name:'Reset all'}));
    expect(within(inventory()).getByRole('article',{name:'Helmet · test-helmet'})).toBeTruthy();
    expect(within(inventory()).queryByRole('article',{name:'Helmet · equipped-helmet'})).toBeNull();
    rendered.unmount();render(view());await screen.findByRole('heading',{name:'Gear optimizer'});
    expect(temporaryCounter()).toBeNull();
    expect(localStorage.getItem(OPTIMIZER_STORAGE_KEY)).toBe(saved);
  },20000);
  it('tries a comparison scenario and drops the temporary state on a successful import',async()=>{
    render(view());await openInventory();
    fireEvent.click(within(inventory()).getByRole('button',{name:'Compare Helmet test-helmet'}));
    const dialog=await screen.findByRole('dialog',{name:'Gear comparison'});
    fireEvent.click(within(dialog).getByRole('radio',{name:'Equip now'}));
    fireEvent.click(within(dialog).getByRole('button',{name:'Try on this state'}));
    expect(screen.queryByRole('dialog',{name:'Gear comparison'})).toBeNull();
    expect(helmetTone()).toBe('whatif');
    vi.mocked(importBuildCapture).mockRejectedValueOnce(new Error('test import failure'));
    fireEvent.change(screen.getByLabelText('Build capture file'),{target:{files:[new File(['capture'],'bad.tofbuild')]}});
    await screen.findByText(/Could not import .tofbuild/);
    expect(helmetTone()).toBe('whatif');
    vi.mocked(importBuildCapture).mockResolvedValue({draft:structuredClone(catalog.demoDraft),inventory:[],inventoryReceived:true,serverRefusal:null,outdatedExporter:null});
    fireEvent.change(screen.getByLabelText('Build capture file'),{target:{files:[new File(['capture'],'new.tofbuild')]}});
    await waitFor(()=>expect(temporaryCounter()).toBeNull());
    expect(helmetTone()).not.toBe('whatif');
    expect(screen.getByText('No inventory pieces yet.')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(OPTIMIZER_STORAGE_KEY)!).draft.gear).toEqual(catalog.demoDraft.gear);
  },20000);
  it('clears temporary changes together with the real build and shows an empty inventory',async()=>{
    render(view());await openInventory();
    fireEvent.click(within(inventory()).getByRole('button',{name:'Try on Helmet test-helmet'}));
    fireEvent.click(screen.getByRole('button',{name:'Clear'}));
    const dialog=await screen.findByRole('dialog',{name:'Clear this build?'});
    fireEvent.click(within(dialog).getByRole('button',{name:'Clear'}));
    expect(temporaryCounter()).toBeNull();
    expect(screen.getByText('No inventory pieces yet.')).toBeTruthy();
    expect(within(equipment()).getAllByText('Empty slot')).toHaveLength(catalog.demoDraft.gear.length);
  },20000);
});
