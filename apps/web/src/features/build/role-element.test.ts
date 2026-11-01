import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {emptyDraft,rollValueElement,supportRoleElement} from './model';
import type {BuildCatalog} from './types';

// Generated catalog keeps weapons newest-first, so the lower index is the later release.
const catalog=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;
const loadout=(...ids:string[])=>{
  const draft=emptyDraft(catalog);
  draft.weapons=ids.map(id=>({id,stars:0,level:1,matrices:[]}));
  return draft;
};

describe('auto element of support builds',()=>{
  it('uses the newest healer weapon instead of the highest ATK',()=>{
    // Builds default to DPS; a support element needs the role chosen explicitly.
    const draft=loadout('kekelite','ling','zoey');draft.profile.role='healer';
    expect(supportRoleElement({...draft,profile:{...draft.profile,role:''}},catalog)).toBe('');
    const index=(id:string)=>catalog.weapons.findIndex(item=>item.id===id);
    expect(index('ling')).toBeLessThan(index('kekelite'));
    draft.combat.elements.find(item=>item.id==='Frost')!.attack=90000;
    expect(supportRoleElement(draft,catalog)).toBe('Flame');
    expect(rollValueElement(draft,catalog)).toBe('Flame');
  });
  it('uses the newest tank weapon for a tank build',()=>{
    const tank=(...ids:string[])=>{const draft=loadout(...ids);draft.profile.role='tank';return draft;};
    expect(supportRoleElement(tank('meryl','saki-fuwa','zoey'),catalog)).toBe('Frost');
    expect(supportRoleElement(tank('meryl','huang','zoey'),catalog)).toBe('Volt');
  });
  it('keeps the highest ATK rule for DPS and the manual element everywhere',()=>{
    const dps=loadout('gefion','zoey','skull');
    expect(supportRoleElement(dps,catalog)).toBe('');
    const healer=loadout('kekelite','ling');
    healer.rv={element:'Volt',includeCrit:true};
    expect(rollValueElement(healer,catalog)).toBe('Volt');
    healer.profile.role='dps';
    expect(supportRoleElement(healer,catalog)).toBe('');
  });
});
