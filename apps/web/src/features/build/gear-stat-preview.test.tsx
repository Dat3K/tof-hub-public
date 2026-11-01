import {render,screen,within} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {GearStatPreview} from './gear-stat-preview';
import {GearBaseStats} from './gear-base-stats';
import {gearBaseStats} from './model';
import {formatValue,statLabel} from './presentation';
import type {BuildCatalog} from './types';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;

describe('shared read-only gear preview',()=>{
  it('preserves a known zero augmentation count and distinguishes current stats from their known ceilings',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]!);gear.augmentCount=0;
    render(<GearStatPreview gear={gear} catalog={catalog} locale="en" showCount maximums={{random:gear.rows.map(()=>2000),added:gear.augments.map(()=>2000)}}/>);
    expect(screen.getByText('Helmet',{exact:true})).toBeTruthy();
    expect(screen.getByText('Aug:').parentElement?.textContent).toBe('Aug: 0');
    expect(document.querySelectorAll('[data-hint="Current value / Titan maximum for this item’s rolls"]').length).toBe(gear.rows.length+gear.augments.length);
  });
  it('omits non-augmented lower stats, absent counts and invented ceilings, with localized names',()=>{
    const gear={...structuredClone(catalog.demoDraft.gear[0]!),titan:false,augmented:false,augmentCount:null};
    render(<GearStatPreview gear={gear} catalog={catalog} locale="ru" showCount/>);
    expect(screen.getByText('Шлем',{exact:true})).toBeTruthy();
    expect(screen.queryByText('Aug:')).toBeNull();
    expect(screen.queryByText('Электро АТК',{exact:true})).toBeNull();
  });
  it('shows all game item sections immediately while keeping unrated stats and stage identity',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]!);
    const base=gearBaseStats({...gear,equipped:true},catalog);
    const meta=catalog.gear.find(item=>item.id===gear.id)!;
    const {container}=render(<GearStatPreview gear={gear} catalog={catalog} locale="en" presentation="item" showCount
      ratedTypes={[gear.rows[0]!.type]} score={<span>CS ≈ 123</span>}
      baseDetails={<GearBaseStats stats={base} catalog={catalog} locale="en"/>}/>);
    const item=screen.getByRole('article',{name:`${meta.name.en} · Item stats`});
    expect(within(item).getByRole('heading',{name:'Base Stats'})).toBeTruthy();
    expect(within(item).getByRole('heading',{name:'Enhancement Unlocked'})).toBeTruthy();
    expect(within(item).getByRole('heading',{name:'Random stats'})).toBeTruthy();
    expect(within(item).getByRole('heading',{name:'Titan'})).toBeTruthy();
    expect(within(item).queryByRole('button')).toBeNull();
    expect(within(item).getByLabelText(`${gear.stars} ★`)).toBeTruthy();
    expect(item.querySelector('[data-hint="Enhancement Level"]')?.textContent).toBe(`+${gear.enhancement}`);
    expect(within(item).getByText('CS ≈ 123')).toBeTruthy();
    expect(item.querySelector('header img')?.getAttribute('src')).toBe(meta.icons.titan);
    const rows=container.querySelectorAll('ul[data-presentation="item"] li');
    expect(rows).toHaveLength(gear.rows.length+gear.augments.length);
    expect(Array.from(rows).filter(row=>row.hasAttribute('data-rated')).length).toBeLessThan(rows.length);
    for(const row of [...gear.rows,...gear.augments])expect(within(item).getAllByText(statLabel(row.type,'en'),{exact:true}).length).toBeGreaterThan(0);
    const rare=catalog.reference.titanRare.items.find(rare=>rare.id===gear.rareId)!;
    expect(within(item).getByText(`${rare.nameEn} +${gear.rareLevel}`)).toBeTruthy();
  });
  it('keeps generated base, enhancement and unlocked values separate, without fabricating absent sections',()=>{
    const gear=catalog.demoDraft.gear[0]!;
    const stats=gearBaseStats({...gear,equipped:true},catalog);
    const {container,rerender}=render(<GearBaseStats stats={stats} catalog={catalog} locale="ru"/>);
    const sections=container.querySelectorAll('section');
    const base=Array.from(stats).filter(stat=>stat.base+stat.enhancement>0);
    const unlocked=Array.from(stats).filter(stat=>stat.unlocked>0);
    expect(sections).toHaveLength(2);
    for(const stat of base){
      expect(sections[0]!.textContent).toContain(`+${formatValue(stat.base,false,'ru')} +${formatValue(stat.enhancement,false,'ru')}`);
    }
    for(const stat of unlocked)expect(sections[1]!.textContent).toContain(`+${formatValue(stat.unlocked,false,'ru')}`);
    // Stats that only have an unlocked bonus stay out of the base section instead of showing "+0 +0".
    expect(sections[0]!.textContent).not.toContain(`+${formatValue(0,false,'ru')} +${formatValue(0,false,'ru')}`);
    rerender(<GearBaseStats stats={[]} catalog={catalog} locale="ru" combatScore={null}/>);
    expect(screen.getByText('Базовые статы',{exact:true})).toBeTruthy();
    expect(screen.queryByText('Открытые бонусы усиления',{exact:true})).toBeNull();
    expect(container.querySelector('[data-gear-cs]')?.textContent).toBe('КС—');
  });
});
