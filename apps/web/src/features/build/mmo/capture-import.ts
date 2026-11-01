import { localeText } from '@/lib/i18n/text';
import type {BuildCapture} from '@tof-hub/contracts';
import {SealedFileError,submitSealedFile} from '../../queue/sealed-upload';
import {queueMessage,type QueueJob} from '../../queue/client';
import type {BuildLocale} from '../types';
import {emptyMmoDraft,mmoPanelAttributes,mmoWeaponMaxStars,restoreMmoDraft} from './model';
import type {MmoBuildCatalog,MmoBuildDraft} from './types';
import {buildImportPage,type BuildImportPage,type BuildImportResult} from '../import-handoff';

/** What an MMO capture did not carry, for the import notice (each id is localized by the page). */
export type MmoMissingPart='brainfield'|'cards'|'mode'|'pet'|'weapons'|'gear'|'panel';

/**
 * The MMO card of an own `.tofbuild` (capture app 1.3+, `mmo` block; docs/imports.md). Parts the
 * login did not send stay empty and are listed; ids the MMO catalog does not know are dropped by restoreMmoDraft.
 */
export function mmoDraftFromCapture(capture:BuildCapture,catalog:MmoBuildCatalog):{draft:MmoBuildDraft;missing:MmoMissingPart[]} {
  const mmo=capture.mmo,draft=emptyMmoDraft(catalog),missing:MmoMissingPart[]=[],profile=capture.profile;
  draft.updatedAt=capture.capture.capturedAt;
  draft.profile={...draft.profile,name:profile.name??'',uid:capture.capture.subject.uid,level:profile.level??draft.profile.level,
    cs:profile.cs===null?null:Math.round(profile.cs),crew:profile.crew??'',characterTitle:profile.titleId??'',signature:profile.signature??'',
    avatarId:profile.avatarId??'',avatarFrameId:profile.avatarFrameId??''};
  const panel=mmo?.panel??{};
  for(const prop of mmoPanelAttributes(catalog))if(typeof panel[prop]==='number')draft.stats[prop]=panel[prop];
  if(!mmoPanelAttributes(catalog).some(prop=>typeof panel[prop]==='number'))missing.push('panel');
  // Gear: the item's MMO slot; rolls keep the game's quality-suffixed RandomProp ids, which the item pools list.
  for(const piece of capture.gear) {
    const item=catalog.gear.find(entry=>entry.id===piece.itemId);
    if(!item)continue;
    const slot=mmo?.slotCards?.find(entry=>entry.slot===item.slot);
    const stars=slot?.active?slot.cards.find(card=>card.id===slot.active)?.value:undefined;
    draft.gear[item.slot]={itemId:item.id,rolls:piece.stats.map(stat=>({prop:stat.attribute,value:stat.value})),
      card:slot?.active?{id:slot.active,stars:stars??0}:null};
  }
  // Expansion is attached to an equipment slot, not to its currently equipped item. Partial captures can contain
  // the slot cards before the gear binding; keep them through normalization and later item selection.
  for(const slot of mmo?.slotCards??[]) {
    if(!slot.slot||!draft.gear[slot.slot]||!slot.active)continue;
    draft.gear[slot.slot]!.card={id:slot.active,stars:slot.cards.find(card=>card.id===slot.active)?.value??0};
  }
  if(!Object.values(draft.gear).some(gear=>gear.itemId))missing.push('gear');
  if(!mmo?.slotCards)missing.push('cards');
  // MMO weapons by the game's weapon id (case differs between the profile and the tables); `stars` is the +N.
  capture.weapons.forEach((weapon,index)=>{
    const entry=catalog.weapons.find(item=>item.weaponId.toLowerCase()===weapon.itemId.toLowerCase());
    if(entry&&index<draft.weapons.length)draft.weapons[index]={id:entry.id,stars:Math.min(weapon.stars,mmoWeaponMaxStars(catalog,entry.id))};
  });
  if(!draft.weapons.some(weapon=>weapon.id))missing.push('weapons');
  draft.weaponMode=mmo?.weaponMode??null;
  if(!draft.weaponMode)missing.push('mode');
  for(const chain of mmo?.brainfield??[])for(const node of chain.nodes)draft.brainfield[node.id]=node.level;
  if(!mmo?.brainfield)missing.push('brainfield');
  const pet=capture.pet&&catalog.pets.find(item=>item.id===capture.pet!.itemId);
  if(pet&&capture.pet)draft.pet={id:pet.id,level:capture.pet.level??1,stars:capture.pet.stars??0,
    modules:(capture.pet.modules??[]).map(row=>({slot:row.slot,id:catalog.petModules?.find(module=>module.id.toLowerCase()===row.itemId.toLowerCase())?.id??row.itemId})),
    inheritedAttack:capture.pet.inheritedAttack??mmoInheritedAttack(capture,pet.inheritance?.[capture.pet.stars??0])};
  else missing.push('pet');
  return {draft:restoreMmoDraft(draft,catalog)??draft,missing};
}

/**
 * Smart Servant inherited ATK, computed as the client does (the server never sends it): the advancement's
 * PlayerModifyCoefficient × the average Fire/Ice/Volt/Physical *AtkDisplayBase. source observation–22 own screenshot:
 * (34082.39 + 3 × 33182.39) / 4 × 1 = 33407.39, shown "+33407" (floor vs round not yet distinguishable).
 */
export function mmoInheritedAttack(capture:BuildCapture,coefficient:number|null|undefined):number|null {
  const bases=['FireAtkDisplayBase','IceAtkDisplayBase','ThunderAtkDisplayBase','PhyAtkDisplayBase'].map(key=>capture.combat.attackBase[key]);
  if(typeof coefficient!=='number'||bases.some(value=>typeof value!=='number'))return null;
  return Math.floor((bases as number[]).reduce((sum,value)=>sum+value,0)/bases.length*coefficient);
}

/**
 * A `.tofbuild` of a Global character on the MMO page (or the reverse): the file is valid, the page is not. It carries the
 * server result, so the page hands it to the right one (import-handoff.ts) instead of asking for the file again.
 */
export class MmoPageMismatchError extends Error {
  readonly target:BuildImportPage;
  constructor(message:string,readonly result:BuildImportResult) {super(message);this.name='MmoPageMismatchError';this.target=buildImportPage(result);}
}

/** Sends the sealed file to the shared build import (decryption, player storage); the card stays in this browser. */
export async function importMmoCapture(file:File,catalog:MmoBuildCatalog,locale:BuildLocale,onQueue?:(job:QueueJob)=>void) {
  const result=await submitSealedFile<BuildImportResult>('build',file,
    {url:'/api/v1/build/import',locale,onUpdate:onQueue}).catch((error:unknown)=>{
    if(error instanceof SealedFileError)throw error;
    throw new Error(queueMessage(error,locale==='ru','The build file could not be imported'));
  });
  return mmoCaptureFromResult(result,catalog,locale);
}

/** The MMO card of a server import result (a file sent here or handed over from the Gacha page). */
export function mmoCaptureFromResult(result:BuildImportResult,catalog:MmoBuildCatalog,locale:BuildLocale) {
  if(!result.data.mmo)throw new MmoPageMismatchError(localeText(locale)('This file is a Global (Gacha) character: it is opened on the Build page.', 'Это файл обычного (Gacha) персонажа: он открыт на странице Build.'),result);
  // Korea and Taiwan DEV clients: shown, never stored (BuildImportService).
  const distribution=result.data.capture.scan?.distribution;
  const devClient=distribution==='korea-dev'||distribution==='taiwan-dev'?distribution:null;
  const imported=mmoDraftFromCapture(result.data,catalog);
  // The signed capture goes along: a public save (mmo/profiles.ts) stores only this unedited capture.
  if(result.source.signature)imported.draft.source={capture:result.data,digest:result.source.digest,signature:result.source.signature};
  return {...imported,serverRefusal:result.serverRefusal??null,outdatedExporter:result.outdatedExporter??null,devClient};
}
