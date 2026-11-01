import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {emptyDraft} from '../build/model';
import type {BuildCatalog} from '../build/types';
import {exampleSession,restoreOptimizerSession} from './storage';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../build/__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
describe('optimizer session restoration',()=>{
  it('keeps a cleared/manual build and its settings instead of replacing it with the example',()=>{
    const state={...exampleSession(catalog),example:false,draft:emptyDraft(catalog),target:95};
    state.draft.rv!.element='Frost';state.draft.combat.crit=9000;
    const restored=restoreOptimizerSession(JSON.parse(JSON.stringify(state)),catalog)!;
    expect(restored.example).toBe(false);
    expect(restored.draft.combat.crit).toBe(9000);
    expect(restored.draft.rv!.element).toBe('Frost');
    expect(restored.target).toBe(95);
    expect(restored.inventory).toEqual([]);
    expect(restored.inventoryReceived).toBe(false);
  });
  it('restores separate pieces of the same slot, with canonical gear and no cached media URLs',()=>{
    const gear=structuredClone(catalog.demoDraft.gear[0]!);gear.equipped=false;
    const state={...exampleSession(catalog),example:false,inventoryReceived:true,
      inventory:[{key:'a',gear:{...gear,url:'https://invalid.test/custom.png'}},{key:'b',gear:structuredClone(gear)}]};
    const restored=restoreOptimizerSession(state,catalog)!;
    expect(restored.inventory).toHaveLength(2);
    expect(restored.inventory.map(piece=>piece.key)).toEqual(['a','b']);
    expect(restored.inventory[0]!.gear).toEqual(gear);
    expect(restored.inventory.every(piece=>!piece.gear.equipped)).toBe(true);
    expect(restored.inventory[0]!.gear).not.toHaveProperty('url');
  });
  it('rejects incompatible or malformed drafts, unknown slots and duplicate identities',()=>{
    const state=exampleSession(catalog),gear=structuredClone(state.draft.gear[0]!);
    for(const invalid of [null,{}, {...state,version:2},{...state,target:NaN},{...state,draft:{}},
      {...state,example:false,inventoryReceived:true,inventory:[{key:'a',gear:{...gear,id:'unknown'}}]},
      {...state,example:false,inventoryReceived:true,inventory:[{key:'a',gear},{key:'a',gear}]}]) {
      expect(restoreOptimizerSession(invalid,catalog)).toBeNull();
    }
  });
});
