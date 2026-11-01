import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {HandbookBrainfieldData} from '../../datamine/contracts/handbook';
import type {BuildCatalog} from '../types';
import {demoMmoDraft} from './demo';
import {restoreMmoDraft} from './model';
import {mmoSaveBlock} from './profiles';
import type {MmoBuildCatalog,MmoGeneratedCatalog} from './types';

const data=(name:string)=>JSON.parse(readFileSync(resolve(import.meta.dirname,`../../../../public/game-data/${name}.json`),'utf8'));
const mmo=data('build-mmo-page') as MmoGeneratedCatalog,build=data('build-page') as BuildCatalog,brainfield=data('handbook/mmo-brainfield') as HandbookBrainfieldData;
const catalog:MmoBuildCatalog={...mmo,artworks:build.artworks,elementIcons:build.elementIcons,avatars:build.avatars,avatarFrames:build.avatarFrames,
  roleResonances:build.roleResonances.items,titles:build.titles,
  brainfieldStats:brainfield.groups.flatMap(group=>group.nodes.map(({id,kind,maxLevel,levels})=>({id,kind,maxLevel,levels:levels.map(({level,attribute})=>({level,attribute}))})))};

describe('MMO test data',()=>{
  it('is the stripped own capture, marked as a demo',()=>{
    const draft=demoMmoDraft(catalog);
    expect(draft.demo).toBe(true);
    expect(draft.source).toMatchObject({signature:'',capture:{capture:{subject:{uid:'888800113'}}}});
    expect(draft.profile).toMatchObject({level:85,cs:185991,crew:'EOS'});
    expect(Object.values(draft.gear).filter(gear=>gear.itemId)).toHaveLength(12);
    expect(draft).toMatchObject({art:{id:'gashapon_btz_bg_btz'},profile:{avatarId:'Zuoyi'}});
    expect(draft.weaponMode).toBe('regular');
    expect(draft.weapons.map(weapon=>weapon.id)).toEqual(['salidy-mmo','berry-mmo','gnonno-mmo']);
  });
  it('retains the stripped demo account context after presentation edits without allowing a save',()=>{
    const draft=demoMmoDraft(catalog);draft.role='healer';draft.art.zoom=1.2;
    const restored=restoreMmoDraft(JSON.parse(JSON.stringify(draft)),catalog)!;
    expect(restored.source?.capture.account).toEqual(draft.source?.capture.account);
    expect(restored.source?.capture.pwg).toEqual(draft.source?.capture.pwg);
    expect(mmoSaveBlock(restored,catalog)).toBe('no-capture');
    restored.art.id='';expect(restoreMmoDraft(restored,catalog)?.art.id).toBe('');
  });
});
