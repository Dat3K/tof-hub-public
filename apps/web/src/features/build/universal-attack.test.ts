import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {emptyDraft,universalAttack} from './model';
import type {BuildCatalog} from './types';

const catalog=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;

describe('universal ATK',()=>{
  // Numbers from a captured card: DisplayBase per element and the elemental flat ATK of its gear.
  it('is the shared remainder of element base ATK minus elemental gear ATK',()=>{
    const draft=emptyDraft(catalog);
    const bases:Record<string,number>={Frost:48783.277,Flame:49211.512,Volt:52089.262,Physical:49091.336};
    const gear:Record<string,number>={Frost:10335.848,Flame:10764.082,Volt:13641.832,Physical:10643.906};
    for(const element of draft.combat.elements)element.attack=bases[element.id]??0;
    draft.gear[0].equipped=true;
    draft.gear[0].rows=Object.entries(gear).map(([element,value])=>({type:`${element} Attack`,value,beforeTitan:null}));
    expect(universalAttack(draft)).toBeCloseTo(38447.43,1);
  });
  it('stays empty when elements disagree or are missing',()=>{
    const draft=emptyDraft(catalog);
    expect(universalAttack(draft)).toBeNull();
    for(const [i,element] of draft.combat.elements.entries())element.attack=1000+i*100;
    expect(universalAttack(draft)).toBeNull();
  });
});
