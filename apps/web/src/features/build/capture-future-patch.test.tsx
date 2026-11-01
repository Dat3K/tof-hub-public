import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import capture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import {draftFromCapture,type CaptureImportCatalog} from './capture-import';
import {BuildCard} from './build-card';
import {BuildInspection} from './build-inspection';
import {restoreDraft} from './model';
import type {BuildCatalog,BuildDraft} from './types';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/build-page.json'),'utf8')) as BuildCatalog;
const mapping=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/capture-card-map.json'),'utf8')) as CaptureImportCatalog;
const digest='b'.repeat(64);
const render=(draft:BuildDraft)=>renderToStaticMarkup(<BuildInspection locale="en"><BuildCard draft={draft} catalog={catalog} locale="en"/></BuildInspection>);

/** A capture from a newer game patch: every identity is unknown to this catalog and some values are out of the usual range. */
function futurePatch() {
  const input=BuildCaptureSchema.parse(structuredClone(capture));
  const future=(id:string)=>`future_${id}`;
  Object.assign(input.profile,{avatarId:'future_avatar',avatarFrameId:'future_frame',titleId:'future_title',suppressorId:'future_suppressor',level:200});
  for(const weapon of input.weapons)Object.assign(weapon,{itemId:future(weapon.itemId),level:1000,stars:6});
  for(const entry of input.matrices)if(entry.matrix)Object.assign(entry.matrix,{itemId:future(entry.matrix.itemId),suitId:future(entry.matrix.suitId??'suit'),level:1000,stars:6});
  for(const [index,gear] of input.gear.entries()){
    // Half the items are unknown, the rest keep their item but carry new stats, a new rare effect and odd values.
    if(index%2)gear.itemId=future(gear.itemId);
    gear.enhancement=200;gear.stars=5;
    gear.stats=[...gear.stats.slice(0,3),{attribute:'FutureAtkMult',value:.1,tag:'None'},{attribute:'IceAtkAdded',value:-50,tag:'None'},{attribute:'future_rare',value:9,tag:'FutureAggravatingInjury_Lv9'}];
  }
  if(input.trait)input.trait.weaponId='future_trait';
  for(const relic of input.relics)relic.itemId=future(relic.itemId);
  input.relicPassives.push({attribute:'FutureDamageMult',fraction:5,stackCount:1,sourceCount:1});
  if(input.pet)Object.assign(input.pet,{itemId:'future_pet',modules:input.pet.modules.map(module=>({...module,typeId:'SkillModule_future'}))});
  input.computing=[...(input.computing??[]),{slot:99,level:100,progress:5}];
  input.support={modules:[{id:'future_support',level:100}],reset:{storedCivilTime:null,availability:'unknown',availableAt:null}};
  input.synthesis=[{itemId:'future_synthesis',stage:6}];
  input.buffs.records.push({definition:'Default__Buff_Future_C',stackCount:3,durationSeconds:60,remainingSeconds:30,expiresAt:null});
  input.weaponSettings.elements={future_setting:{code:255,aux:255}};
  input.weaponSettings.settings={future_mode:255};
  // A new temporary effect can push the received ATK below the base; the card must not reject it.
  input.combat.attack.IceAtk=1;
  return input;
}

describe('a capture from a newer game patch',()=>{
  it.each(['en','ru'] as const)('shows the last addition/edit date in %s while keeping status labels for PNG export',(locale)=>{
    const draft=draftFromCapture(capture,catalog,mapping,'en',digest);
    draft.updatedAt='2026-10-11T12:34:00.000Z';
    const html=renderToStaticMarkup(<BuildInspection locale={locale}><BuildCard draft={draft} catalog={catalog} locale={locale}/></BuildInspection>);
    const dom=new DOMParser().parseFromString(html,'text/html');
    expect(dom.querySelector('time[data-build-provenance]')?.textContent).toBe('11.10.2026 12:34 UTC');
    expect(dom.querySelector('time[data-build-provenance]')?.getAttribute('dateTime')).toBe(draft.updatedAt);
    expect(dom.querySelectorAll('[data-export-active]')).toHaveLength(0);
  });
  it('imports, lists what it could not match and keeps the card restorable',()=>{
    const draft=draftFromCapture(futurePatch(),catalog,mapping,'en',digest);
    expect(draft.weapons.every(weapon=>weapon.id==='')).toBe(true);
    expect(draft.weapons.flatMap(weapon=>weapon.matrices).every(matrix=>matrix.id==='')).toBe(true);
    expect(draft.relics.every(relic=>relic.id==='')).toBe(true);
    expect(draft.pet.id).toBe('');
    const unresolved=draft.captureSource?.unresolved??[];
    for(const text of ['weapon: future_','matrix: future_suit','relic: future_','pet: future_pet','trait: future_trait','computing: 99','support: future_support','synthesis: future_synthesis'])
      expect(unresolved.some(item=>item.startsWith(text))).toBe(true);
    expect(draft.gear.some(gear=>gear.equipped)).toBe(true);
    // Fitting value by value is enough: no section had to be emptied, and the odd values are listed.
    expect(unresolved.filter(item=>item.startsWith('section reset'))).toEqual([]);
    expect(unresolved.some(item=>item.startsWith('enemy level: 200'))).toBe(true);
    expect(unresolved.some(item=>item.includes('stat: Frost Attack -50'))).toBe(true);
    expect(draft.combat.elements.find(element=>element.id==='Frost')!.attackPercent).toBe(0);
    expect(restoreDraft(JSON.parse(JSON.stringify(draft)),catalog)).not.toBeNull();
  });
  it('renders the card with the unknown parts left empty',()=>{
    const html=render(draftFromCapture(futurePatch(),catalog,mapping,'en',digest));
    expect(html).toContain('Example player');
  });
});
