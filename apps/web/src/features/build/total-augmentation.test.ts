import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import {totalAugmentationSpent} from './model';
import type {BuildCatalog} from './types';

// Checked-in generated fixture: unit tests do not require the external game-data mount.
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;

describe('totalAugmentationSpent',()=>{
  it('sums equipped gear and the whole backpack, including pieces no ranking would pick',()=>{
    const draft=structuredClone(catalog.demoDraft);
    draft.gear.forEach((gear,index)=>{gear.equipped=index<2;gear.augmentCount=index===0?180:index===1?0:null;});
    const spent=totalAugmentationSpent(draft,[{augmentCount:249},{augmentCount:7},{augmentCount:null}]);
    expect(spent).toMatchObject({total:436,equipped:180,backpack:256,equippedPieces:2,backpackPieces:2,unknown:1,backpackKnown:true});
  });
  it('ignores empty slots and reports a missing backpack inventory as unknown, not zero',()=>{
    const draft=structuredClone(catalog.demoDraft);
    draft.gear.forEach(gear=>{gear.equipped=false;gear.augmentCount=50;});
    const spent=totalAugmentationSpent(draft);
    expect(spent).toMatchObject({total:0,equipped:0,backpack:0,backpackKnown:false});
    expect(spent.unknown).toBe(0);
  });
  it('treats unread counts as unknown rather than confirmed zero',()=>{
    const draft=structuredClone(catalog.demoDraft);
    draft.gear.forEach((gear,index)=>{gear.equipped=index<3;gear.augmentCount=index===0?100:null;});
    const spent=totalAugmentationSpent(draft,[]);
    expect(spent).toMatchObject({total:100,equippedPieces:1,unknown:2,backpackKnown:true});
  });
});
