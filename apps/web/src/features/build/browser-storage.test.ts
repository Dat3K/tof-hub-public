import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {BuildCatalog} from './types';
import {augmentationTotalValue,DRAFT_KEY,restoreDraft} from './model';
import {backpackForDraft,OPTIMIZER_STORAGE_KEY,exampleSession,restoreOptimizerSession,saveImportedBuild} from './browser-storage';
import {readBrowserOwner} from '../players/browser-owner';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import rawCapture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();});
describe('shared .tofbuild browser persistence',()=>{
  it('remembers the captured owner of a real import independently of editable profile fields',()=>{
    const draft=structuredClone(catalog.demoDraft);delete draft.demo;
    draft.captureSource={kind:'file',digest:'fixture',capture:BuildCaptureSchema.parse(rawCapture),unresolved:[]};
    draft.profile.uid='999999';
    saveImportedBuild({draft,inventoryReceived:false,inventory:[]},catalog);
    expect(readBrowserOwner()?.uid).toBe(draft.captureSource!.capture.capture.subject.uid);
  });
  it('uses the original example backpack and keeps an explicitly unknown full augmentation total unknown',()=>{
    const current=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/build-page.json'),'utf8')) as BuildCatalog;
    const session=exampleSession(current);
    expect(backpackForDraft(session.draft,current,session)).toBe(current.demoBackpack);
    expect(augmentationTotalValue(session.draft,[])).toBe(current.demoDraft.augmentationSpent);
    session.draft.augmentationSpent=null;
    expect(augmentationTotalValue(session.draft,current.demoBackpack)).toBeNull();
    delete session.draft.augmentationSpent;
    expect(augmentationTotalValue(session.draft,current.demoBackpack)).toBe(11628);
  });
  it('saves both views, retains the Optimizer target and Build background, and replaces a previous backpack',()=>{
    const previous=exampleSession(catalog);previous.target=95;
    localStorage.setItem(OPTIMIZER_STORAGE_KEY,JSON.stringify(previous));
    localStorage.setItem(DRAFT_KEY,JSON.stringify(previous.draft));
    const imported=structuredClone(previous.draft);imported.profile.name='Imported account';imported.art.id='';
    const gear={...structuredClone(imported.gear[0]!),equipped:false};
    const {failed}=saveImportedBuild({draft:imported,inventoryReceived:true,inventory:[{key:'a',gear}]},catalog);
    expect(failed).toEqual([]);
    const build=restoreDraft(JSON.parse(localStorage.getItem(DRAFT_KEY)!),catalog)!;
    const optimizer=restoreOptimizerSession(JSON.parse(localStorage.getItem(OPTIMIZER_STORAGE_KEY)!),catalog)!;
    expect(build.profile.name).toBe('Imported account');expect(build.art).toEqual(previous.draft.art);
    expect(optimizer.draft.profile.name).toBe(build.profile.name);expect(optimizer.example).toBe(false);
    expect(optimizer.target).toBe(95);expect(optimizer.inventory).toEqual([{key:'a',gear}]);
    saveImportedBuild({draft:imported,inventoryReceived:false,inventory:[]},catalog);
    const replaced=restoreOptimizerSession(JSON.parse(localStorage.getItem(OPTIMIZER_STORAGE_KEY)!),catalog)!;
    expect(replaced.inventory).toEqual([]);expect(replaced.inventoryReceived).toBe(false);
  });
  it('reports a failed browser write while keeping the other view usable and honoring the current target',()=>{
    const setItem=Storage.prototype.setItem;
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){
      if(key===DRAFT_KEY)throw new Error('Storage quota');setItem.call(this,key,value);
    });
    const imported={draft:structuredClone(catalog.demoDraft),inventoryReceived:true,inventory:[]};
    const {optimizer,failed}=saveImportedBuild(imported,catalog,92);
    expect(failed).toEqual(['build']);expect(optimizer.target).toBe(92);
    expect(restoreOptimizerSession(JSON.parse(localStorage.getItem(OPTIMIZER_STORAGE_KEY)!),catalog)?.target).toBe(92);
  });
});
