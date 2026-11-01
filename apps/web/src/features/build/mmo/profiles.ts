import {MMO_PROFILE_ROLES,captureOrigin,canPublishGearCapture,mmoProfileRefusal,type MmoProfileDirectoryQuery,type MmoProfileDirectoryResponse,type MmoProfileRole,type MmoProfileSummary,type ProfileArt,type BuildCapture} from '@tof-hub/contracts';
import {verifyBuildCaptureSource,type CardProvenance} from '../card-verification';
import {QueueError,queueMessage,runQueued,type QueueJob} from '../../queue/client';
import type {SaveResult} from '../profiles';
import type {BuildLocale} from '../types';
import {mmoDraftFromCapture} from './capture-import';
import {restoreMmoDraft} from './model';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';

/**
 * Public MMO builds per character UID × role (apps/api build-profiles.service.ts "MMO", docs/imports.md
 * "Saved MMO builds"), opened at /tools/build/mmo/<uid>/<role>/.
 */
export {MMO_PROFILE_ROLES,type MmoProfileRole,type MmoProfileSummary};
export const mmoProfileHref=(uid:string,role?:MmoProfileRole|null)=>`/tools/build/mmo/${encodeURIComponent(uid)}/${role?`${role}/`:''}`;
export const MMO_PROFILES_HREF='/tools/build/mmo/profiles/';

/** Card parts a public save keeps: the presentation choices (role, background, date) never mark a card edited. */
const comparable=({profile,stats,gear,weapons,weaponMode,brainfield,pet,consumables}:MmoBuildDraft)=>JSON.stringify({profile,stats,gear,weapons,weaponMode,brainfield,pet,consumables});
/** True when the card values differ from its signed capture (a public save stores the capture, not the edits). */
export function mmoCardEdited(draft:MmoBuildDraft,catalog:MmoBuildCatalog):boolean {
  if(!draft.source)return false;
  // Both sides through the same restore, so normalization alone never reads as an edit.
  const fresh=restoreMmoDraft(mmoDraftFromCapture(draft.source.capture,catalog).draft,catalog),current=restoreMmoDraft(draft,catalog);
  return !fresh||!current||comparable(fresh)!==comparable(current);
}

/** Why this card cannot be saved publicly, or null. */
export function mmoSaveBlock(draft:MmoBuildDraft,catalog:MmoBuildCatalog):'no-capture'|'test-capture'|'not-warp'|'edited'|null {
  if(draft.demo||!draft.source?.signature||!draft.source.digest)return 'no-capture';
  const refusal=mmoProfileRefusal(draft.source.capture);
  if(refusal==='test-capture'||refusal==='not-warp')return refusal;
  if(refusal)return 'no-capture';
  return mmoCardEdited(draft,catalog)?'edited':null;
}

/** Export provenance follows the same signature and unchanged-values checks as the ordinary Build card. */
export async function verifyMmoBuildCard(draft:MmoBuildDraft,catalog:MmoBuildCatalog,publicKeyPem?:string):Promise<CardProvenance> {
  if(!draft.source)return 'edited';
  const refusal=mmoProfileRefusal(draft.source.capture);
  if(refusal==='test-capture')return canPublishGearCapture(draft.source.capture.capture.scan)?'incomplete-capture':captureOrigin(draft.source.capture.capture.scan)==='test'?'test-server':'unknown-server';
  if(refusal==='not-warp')return 'unknown-server';
  if(refusal||mmoCardEdited(draft,catalog))return 'edited';
  try {return await verifyBuildCaptureSource(draft.source,publicKeyPem)?'verified':'edited';}
  catch {return 'edited';}
}

export async function fetchMmoProfiles(uid:string,signal?:AbortSignal):Promise<{available:boolean;profiles:MmoProfileSummary[]}> {
  const response=await fetch(`/api/v1/build/mmo-profiles/${encodeURIComponent(uid)}`,{cache:'no-store',signal});
  if(!response.ok)return {available:false,profiles:[]};
  return response.json() as Promise<{available:boolean;profiles:MmoProfileSummary[]}>;
}

export async function fetchMmoDirectory(query:Partial<MmoProfileDirectoryQuery>,signal?:AbortSignal):Promise<MmoProfileDirectoryResponse> {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query))if(value!==undefined&&value!=='')params.set(key,String(value));
  const response=await fetch(`/api/v1/build/mmo-profiles?${params}`,{cache:'no-store',signal});
  if(!response.ok)throw new Error('unavailable');
  return response.json() as Promise<MmoProfileDirectoryResponse>;
}

/** A public MMO build as a card: rebuilt from its signed capture, with the saved role and background. */
export async function loadMmoProfileDraft(uid:string,role:MmoProfileRole,catalog:MmoBuildCatalog,signal?:AbortSignal):Promise<MmoBuildDraft> {
  const response=await fetch(`/api/v1/build/mmo-profiles/${encodeURIComponent(uid)}/${role}`,{cache:'no-store',signal});
  if(!response.ok)throw new Error(response.status===404?'not-found':'unavailable');
  const profile=await response.json() as {role:MmoProfileRole;savedAt:string;capture:BuildCapture;
    source:{digest:string;signature:string};art:ProfileArt|null};
  const {draft}=mmoDraftFromCapture(profile.capture,catalog);
  draft.role=profile.role;
  draft.source={capture:profile.capture,digest:profile.source.digest,signature:profile.source.signature};
  if(profile.art&&catalog.artworks.some(art=>art.id===profile.art!.id))draft.art=profile.art;
  draft.updatedAt=profile.savedAt;
  return draft;
}

/** Saves the card's signed capture as the public build of `role`; a site background goes along, a custom image never does. */
export async function saveMmoProfile(draft:MmoBuildDraft,role:MmoProfileRole,art:ProfileArt|null,overwrite:boolean,onQueue?:(job:QueueJob)=>void,locale:BuildLocale='en'):Promise<SaveResult> {
  const source=draft.source;
  if(!source)return {ok:false,reason:'rejected'};
  try {
    await runQueued<{role:MmoProfileRole}>('/api/v1/build/mmo-profiles',{headers:{'Content-Type':'application/json'},
      body:JSON.stringify({capture:source.capture,digest:source.digest,signature:source.signature,role,art,overwrite})},onQueue);
    return {ok:true,slot:role};
  } catch(error) {
    if(!(error instanceof QueueError))return {ok:false,reason:'unavailable'};
    const savedAt=typeof error.data.savedAt==='string'?error.data.savedAt:undefined;
    if(error.status===409)return {ok:false,reason:error.message==='A newer capture is already saved'?'newer':'exists',savedAt};
    if(error.status===429||(error.status===503&&/queue/i.test(error.message)))return {ok:false,reason:'busy',message:queueMessage(error,locale==='ru',error.message)};
    return {ok:false,reason:error.status===503?'unavailable':'rejected',message:error.message};
  }
}
