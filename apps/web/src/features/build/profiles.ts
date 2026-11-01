import {PROFILE_ELEMENTS,PROFILE_ROLES,ProfileArtSchema,canSaveBuildCapture,parseProfileSlot,profileSlot,type BuildCapture,type ProfileArt,type ProfileElement,type ProfileRole,type ProfileSummary} from '@tof-hub/contracts';
import {draftFromCapture} from './capture-import';
import {loadCaptureCatalogs} from './capture-catalogs';
import {buildRole,centredArt,randomLoadingArtwork,rollValueElement} from './model';
import type {BuildCatalog,BuildDraft,BuildLocale} from './types';
import {QueueError,queueMessage,runQueued,type QueueJob} from '../queue/client';

/**
 * Saved profiles per character UID (apps/api build-profiles.service.ts, docs/imports.md "Saved
 * profiles"): one card per role × element, opened at /tools/build/<uid>/<role>-<element>/. Roles, elements and slots
 * are shared with the API in @tof-hub/contracts.
 */
export {PROFILE_ELEMENTS,PROFILE_ROLES,parseProfileSlot,profileSlot,type ProfileArt,type ProfileElement,type ProfileRole,type ProfileSummary};
export const profileHref=(uid:string,slot?:string|null)=>`/tools/build/${encodeURIComponent(uid)}/${slot?`${slot}/`:''}`;

/** The slot a card would be saved to: its header role and its rated element. */
export function draftSlot(draft:BuildDraft,catalog:BuildCatalog):{role:ProfileRole;element:ProfileElement}|null {
  const element=rollValueElement(draft,catalog);
  const matched=PROFILE_ELEMENTS.find(item=>item===element);
  return matched?{role:buildRole(draft),element:matched}:null;
}
/** UID of the character a card was captured from (only cards imported from a .tofbuild have one). */
export const draftUid=(draft:BuildDraft)=>draft.captureSource?.capture.capture.subject.uid??null;

/** Only catalog IDs and framing go public; old profiles get the same fallback on every load. */
export function profileArtwork(art:BuildDraft['art']|ProfileArt|null|undefined,catalog:BuildCatalog,key:string):ProfileArt|null {
  const parsed=ProfileArtSchema.safeParse(art?{id:art.id,zoom:art.zoom,x:art.x,y:art.y,offsetX:art.offsetX??0,offsetY:art.offsetY??0}:null);
  if(parsed.success&&catalog.artworks.some(item=>item.id===parsed.data.id))return parsed.data;
  let seed=2166136261;
  for(const char of key)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  const id=randomLoadingArtwork(catalog,()=>seed/0x100000000)||catalog.artworks[seed%catalog.artworks.length]?.id;
  return id?centredArt({id,zoom:1,x:50,y:50,offsetX:0,offsetY:0}) as ProfileArt:null;
}

export async function fetchProfiles(uid:string,signal?:AbortSignal):Promise<{available:boolean;profiles:ProfileSummary[]}> {
  const response=await fetch(`/api/v1/build/profiles/${encodeURIComponent(uid)}`,{cache:'no-store',signal});
  if(!response.ok)return {available:false,profiles:[]};
  return response.json() as Promise<{available:boolean;profiles:ProfileSummary[]}>;
}

/** A saved profile as a card: rebuilt from its signed capture, with the slot's role and element and the saved background. */
export async function loadProfileDraft(uid:string,slot:string,catalog:BuildCatalog,locale:BuildLocale,signal?:AbortSignal):Promise<BuildDraft> {
  const [response,catalogs]=await Promise.all([
    fetch(`/api/v1/build/profiles/${encodeURIComponent(uid)}/${encodeURIComponent(slot)}`,{cache:'no-store',signal}),
    loadCaptureCatalogs().catch(()=>null),
  ]);
  if(!response.ok)throw new Error(response.status===404?'not-found':'unavailable');
  if(!catalogs)throw new Error('unavailable');
  const profile=await response.json() as {role:ProfileRole;element:ProfileElement;savedAt:string;capture:BuildCapture;source:{digest:string;signature:string};art:ProfileArt|null};
  const draft=draftFromCapture(profile.capture,catalog,catalogs.mapping,locale,profile.source.digest,catalogs.temporary,profile.source.signature);
  // Role, rated element and background are presentation: the card stays verified.
  draft.profile.role=profile.role;
  draft.rv={...draft.rv,element:profile.element,includeCrit:draft.rv?.includeCrit??true,weaponId:draft.rv?.weaponId??'',mode:draft.rv?.mode??'grv'};
  const art=profileArtwork(profile.art,catalog,`${uid}:${slot}`);
  if(art)draft.art=art;
  draft.updatedAt=profile.savedAt;
  return draft;
}

export type SaveResult={ok:true;slot:string}|{ok:false;reason:'exists'|'newer'|'rejected'|'unavailable'|'busy';savedAt?:string;message?:string};
/**
 * Saves the card's signed capture to a slot; a site background goes along, a custom image never does. The save runs in
 * the shared queue: `onQueue` sees its place until it finishes.
 */
export async function saveProfile(draft:BuildDraft,slot:{role:ProfileRole;element:ProfileElement},art:ProfileArt|null,overwrite:boolean,onQueue?:(job:QueueJob)=>void,locale:BuildLocale='en'):Promise<SaveResult> {
  const source=draft.captureSource;
  if(!source?.signature||!canSaveBuildCapture(source.capture.capture.scan))return {ok:false,reason:'rejected'};
  try {
    const result=await runQueued<{slot:string}>('/api/v1/build/profiles',{headers:{'Content-Type':'application/json'},
      body:JSON.stringify({capture:source.capture,digest:source.digest,signature:source.signature,role:slot.role,element:slot.element,art,overwrite})},onQueue);
    return {ok:true,slot:result.slot};
  } catch(error) {
    if(!(error instanceof QueueError))return {ok:false,reason:'unavailable'};
    const savedAt=typeof error.data.savedAt==='string'?error.data.savedAt:undefined;
    if(error.status===409)return {ok:false,reason:error.message==='A newer capture is already saved'?'newer':'exists',savedAt};
    // One operation per IP / a full queue: the message says which.
    if(error.status===429||(error.status===503&&/queue/i.test(error.message)))return {ok:false,reason:'busy',message:queueMessage(error,locale==='ru',error.message)};
    return {ok:false,reason:error.status===503?'unavailable':'rejected',message:error.message};
  }
}
