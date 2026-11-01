import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {getPlayerRoleLabel} from '@tof-hub/game-domain';
import {CalculationsModal} from './build-info';
import {BuildCalculationDetails} from './build-calculation-details';
import type {BuildCatalog} from './types';
import {scoringCatalog} from '../ranking/scoring';
import type {RankingCatalog} from '../ranking/types';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;

beforeEach(()=>{
  Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,writable:true,value:vi.fn(()=>({cancel:vi.fn(),onfinish:null}))});
});
afterEach(()=>{
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

describe('Build calculation help',()=>{
  it.each(['en','ru'] as const)('limits Ranking help to its board and explains inverse tank comparison · %s',locale=>{
    const slim:RankingCatalog={reference:catalog.reference,gear:catalog.gear,elementIcons:catalog.elementIcons,
      statTypeIcons:catalog.statTypeIcons,displayIcons:catalog.displayIcons,resistanceIcons:catalog.resistanceIcons,titanMark:catalog.titanMark,
      pairs:[],regions:[],example:{player:{nickname:null,uid:null,region:null,serverId:null},gear:[],capturedAt:''}};
    render(<CalculationsModal audience="ranking" isOpen onClose={vi.fn()} locale={locale} catalog={scoringCatalog(slim)} element="Frost" alteredFrom="Frost" role="tank"/>);
    expect(screen.queryByRole('heading',{name:/^PRV/})).toBeNull();
    expect(screen.queryByRole('region',{name:locale==='ru'?'АТК стихии и Space Support':'Element ATK and Space Support'})).toBeNull();
    expect(screen.queryByText(locale==='ru'?'Другие расчёты и неочевидные правила игры':'Other calculations and game rules that are not obvious')).toBeNull();
    expect(screen.getByText('gain = EHP(reference + item B) / EHP(reference + item A) − 1',{exact:true})).toBeDefined();
    expect(screen.getByText(locale==='ru'?/Прогноз Titan сохраняет собственный потолок/:/Titan forecasts keep each original stat/)).toBeDefined();
    expect(screen.getByText('≈ exp((GRV_B × Q_B − GRV_A × Q_A) / 100) − 1',{exact:true})).toBeDefined();
    expect(screen.getByText(/Apex CS/)).toBeDefined();
  });

  it('animates disclosure state through the accessible calculation heading',()=>{
    render(<CalculationsModal isOpen onClose={vi.fn()} locale="en" catalog={catalog} element="Frost" alteredFrom="Frost" role="dps"/>);
    const heading=screen.getByRole('button',{name:'Maximum roll weights (GRV)'});
    const panel=document.getElementById(heading.getAttribute('aria-controls')!);
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('aria-hidden')).toBeNull();

    fireEvent.click(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
    expect(panel?.hasAttribute('inert')).toBe(true);

    fireEvent.click(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('aria-hidden')).toBeNull();
  });

  it.each(['en','ru'] as const)('opens reference weights without a personal combat draft and changes role · %s',locale=>{
    render(<CalculationsModal isOpen onClose={vi.fn()} locale={locale} catalog={catalog} element="Frost" alteredFrom="Frost" role="dps"/>);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('region',{name:locale==='ru'?'АТК стихии и Space Support':'Element ATK and Space Support'}).textContent).toContain('ATK = B × (1 + a)');
    fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${getPlayerRoleLabel('tank',locale)}$`)}));
    expect(screen.getByText('w(RES) = (1 + r) / (K + R(1 + r))',{exact:true})).toBeDefined();
    expect(screen.queryByText('w(Crit) = w(Crit Rate%) / enemy-level denominator',{exact:true})).toBeNull();
  });

  it('renders changed catalog coefficients and calibrations, retaining zero and unknown distinctions',()=>{
    const changed=structuredClone(catalog);
    changed.csRules.weights.HP=.03125;
    changed.reference.titanGrowth.addedStatShare=.91325;
    delete changed.reference.critFormula.denominators[100];
    render(<BuildCalculationDetails catalog={changed} locale="en"/>);
    expect(screen.getByText('Titan maximum = max(T(own pre-Titan stat), T(strongest pre-Titan family stat) × rank factor)',{exact:true})).toBeDefined();
    expect(screen.getByText('CS = value × 0.03125',{exact:true})).toBeDefined();
    expect(screen.getByText('91.325%',{exact:true})).toBeDefined();
    const missing=screen.getByText('Crit denominator · enemy Lv. 100',{exact:true}).parentElement?.parentElement;
    expect(missing?.textContent).toContain('—');
    const zero=screen.getByText('RES %',{exact:true}).parentElement?.parentElement;
    expect(zero?.textContent).toContain('CS = 0');
    expect(zero?.textContent).toContain('a base is not required');
  });
});
