import {deriveDamagePercentDraft,DRAFT_KEY,emptyDraft,restoreDraft} from './model';
import type {BuildCatalog,BuildDraft,GearDraft} from './types';
import {rememberBrowserOwner} from '../players/browser-owner';

/** Shared browser persistence for the two views of a .tofbuild. */
export const OPTIMIZER_STORAGE_KEY='tof-optimizer-session-v1';
export interface InventoryPiece {key:string;gear:GearDraft;scenario?:'plain'|'partial'|'mature'|'unknown'}
/** Modeling controls, not game coefficients. */
export const DEFAULT_TITAN_TARGET=98;
export function titanTarget(value:number) {return Number.isFinite(value)?Math.max(1,Math.min(100,value)):DEFAULT_TITAN_TARGET;}
export interface OptimizerSession {
  version:1;
  draft:BuildDraft;
  example:boolean;
  inventory:InventoryPiece[];
  inventoryReceived:boolean;
  target:number;
}
export const exampleSession=(catalog:BuildCatalog):OptimizerSession=>({version:1,draft:structuredClone(catalog.demoDraft),example:true,inventory:[],inventoryReceived:false,target:DEFAULT_TITAN_TARGET});

/** Refresh Optimizer's sample from Build's Test data action while retaining its target. */
export function syncDemoBuildToOptimizer(draft:BuildDraft,catalog:BuildCatalog):OptimizerSession|null {
  const previous=(()=>{try{return restoreOptimizerSession(JSON.parse(localStorage.getItem(OPTIMIZER_STORAGE_KEY)??'null'),catalog);}catch{return null;}})();
  const session={...exampleSession(catalog),draft:structuredClone(draft),target:previous?.target??DEFAULT_TITAN_TARGET};
  try {localStorage.setItem(OPTIMIZER_STORAGE_KEY,JSON.stringify(session));return session;}
  catch {return null;}
}

/** Reuse Build's catalog validation for both the saved profile and each backpack piece. */
export function restoreOptimizerSession(value:unknown,catalog:BuildCatalog):OptimizerSession|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const saved=value as Record<string,unknown>;
  if(saved.version!==1||typeof saved.example!=='boolean'||typeof saved.inventoryReceived!=='boolean'||
    typeof saved.target!=='number'||!Number.isFinite(saved.target)||!Array.isArray(saved.inventory))return null;
  const draft=restoreDraft(saved.draft,catalog);
  if(!draft||(!saved.inventoryReceived&&saved.inventory.length))return null;
  if(saved.example&&draft.captureSource&&draft.captureSource.digest!==catalog.demoDraft.captureSource?.digest)return null;
  if(saved.example&&catalog.demoDraft.captureSource&&draft.captureSource?.signature!==catalog.demoDraft.captureSource.signature)
    return {...exampleSession(catalog),target:titanTarget(saved.target)};
  const inventory:InventoryPiece[]=[],keys=new Set<string>(),template=emptyDraft(catalog);
  for(const entry of saved.inventory) {
    if(!entry||typeof entry!=='object'||typeof entry.key!=='string'||!entry.key||entry.key.length>500||keys.has(entry.key))return null;
    const slot=template.gear.findIndex(gear=>gear.id===entry.gear?.id);
    if(slot<0)return null;
    const validated=restoreDraft({...template,gear:template.gear.map((gear,index)=>index===slot?entry.gear:gear)},catalog);
    if(!validated)return null;
    keys.add(entry.key);
    inventory.push({key:entry.key,gear:{...validated.gear[slot]!,equipped:false}});
  }
  return {version:1,draft,example:saved.example,inventory,inventoryReceived:saved.inventoryReceived,target:titanTarget(saved.target)};
}

type ImportedBuild=Pick<OptimizerSession,'draft'|'inventory'|'inventoryReceived'>;
/** Called only after a successful import. Other edits and Clear remain local to their own view. */
export function saveImportedBuild(imported:ImportedBuild,catalog:BuildCatalog,target?:number) {
  const failed:('build'|'optimizer')[]=[],buildDraft=structuredClone(deriveDamagePercentDraft(imported.draft,catalog));
  let previousOptimizer:OptimizerSession|null=null;
  try {previousOptimizer=restoreOptimizerSession(JSON.parse(localStorage.getItem(OPTIMIZER_STORAGE_KEY)??'null'),catalog);} catch { /* A malformed old cache cannot block a fresh import. */ }
  // A background is a browser preference and is absent from captures.
  try {
    const previous=restoreDraft(JSON.parse(localStorage.getItem(DRAFT_KEY)??'null'),catalog);
    if(!buildDraft.art.id&&previous?.art.id)buildDraft.art={...previous.art};
  } catch { /* Import still works without a previous background. */ }
  buildDraft.updatedAt=new Date().toISOString();
  const optimizer:OptimizerSession={...imported,draft:structuredClone(buildDraft),version:1,example:false,target:titanTarget(target??previousOptimizer?.target??DEFAULT_TITAN_TARGET)};
  try {localStorage.setItem(DRAFT_KEY,JSON.stringify(buildDraft));} catch {failed.push('build');}
  try {localStorage.setItem(OPTIMIZER_STORAGE_KEY,JSON.stringify(optimizer));} catch {failed.push('optimizer');}
  const capture=buildDraft.captureSource;
  if(!buildDraft.demo&&capture?.kind==='file')rememberBrowserOwner({uid:capture.capture.capture.subject.uid,nickname:capture.capture.profile.name});
  return {optimizer,failed};
}

/** Backpack Titan counts for the test example or the same .tofbuild from Optimizer storage. */
export function backpackForDraft(draft:BuildDraft,catalog:BuildCatalog,providedSession?:OptimizerSession):Pick<GearDraft,'augmentCount'>[]|undefined {
  if(draft.demo&&draft.captureSource?.digest===catalog.demoDraft.captureSource?.digest&&catalog.demoBackpack)
    return catalog.demoBackpack;
  const own=draft.captureSource?.capture.capture.subject.uid;
  if(!own||draft.captureSource?.kind!=='file')return undefined;
  try {
    const raw=providedSession?null:localStorage.getItem(OPTIMIZER_STORAGE_KEY);
    const session=providedSession??(raw?restoreOptimizerSession(JSON.parse(raw),catalog):null);
    if(!session?.inventoryReceived)return undefined;
    if(session.draft.captureSource?.capture.capture.subject.uid!==own)return undefined;
    return session.inventory.map(piece=>piece.gear);
  } catch {return undefined;}
}

