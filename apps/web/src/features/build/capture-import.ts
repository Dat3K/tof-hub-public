import { localeText } from '@/lib/i18n/text';
import {BuildCaptureSchema,formatServerDisplay,resolvePlayerServer,type BuildCapture,type PlayerServerRefusal} from '@tof-hub/contracts';
import {mapCaptureGear,temporaryAttackAtCapture,type TemporaryAttackCatalog} from '@tof-hub/game-domain';
import {deriveDamagePercentDraft,emptyDraft,restoreDraft,totalAugmentationSpent} from './model';
import {CAPTURE_ELEMENT_ATTRIBUTES as attributes} from './capture-attributes';
import {fitCaptureDraft} from './capture-fit';
import {estimatedResistancePercent} from './rv-profile';
import {applyConsumableStats} from './consumable-stats';
import type {BuildCatalog,BuildDraft,BuildLocale,GearDraft} from './types';
import {SealedFileError,submitSealedFile} from '../queue/sealed-upload';
import {QueueError,queueMessage,type QueueJob} from '../queue/client';
import {loadCaptureCatalogs,type CaptureCatalogs} from './capture-catalogs';
import {MmoPageMismatchError} from './mmo/capture-import';
import type {BuildImportResult} from './import-handoff';

export interface CaptureImportCatalog {
  gear:Record<string,{id:string;stage:'normal'|'augmented'|'titan'}>;
  /** Duel (PvP) armour ids: left out of the card and listed as duel gear. */
  duelGear?:string[];
  titles:Record<string,{en:string;ru:string}>;
  computingSlots:Record<string,number>;
  consumables:Record<string,string[]>;
  /** Element option (word0) → main element; word1 holds the main element as a bit (elementBits). */
  elementCodes:Record<string,string>;
  elementBits?:Record<string,string>;
  elementSettings:Record<string,string>;
  /** Weapon mode setting → weapon and the value of its first selectableModes entry. */
  modeSettings?:Record<string,{weaponId:string;base:number;verified:boolean}>;
  fionaWeaponId:string;fionaSkills:Record<string,string>;
}

type MappedGear=ReturnType<typeof mapCaptureGear>['gear'][number];
function applyCaptureGear(target:GearDraft,item:MappedGear,state:Pick<GearDraft,'equipped'|'enhancement'|'stars'>) {
  Object.assign(target,{...state,titan:item.stage==='titan',augmented:item.stage!=='normal'});
  item.rows.forEach((row,index)=>{if(index<target.rows.length)target.rows[index]=row;});
  item.augments.forEach((augment,index)=>{if(index<target.augments.length)target.augments[index]=augment;});
  if(item.rareId){target.rareId=item.rareId;target.rareLevel=item.rareLevel;}
  target.augmentCount=item.augmentCount;
}

/**
 * Backpack pieces of a capture (`inventory`, absent in older files) as Optimizer pieces. Enhancement and stars come from
 * the equipped piece of the slot: the game transfers both to the piece put on (screen, source observation). Duel and unknown
 * items are skipped.
 */
export function inventoryFromCapture(capture:BuildCapture,draft:BuildDraft,catalog:BuildCatalog,mapping:CaptureImportCatalog) {
  const statLabels=Object.fromEntries(Object.entries(catalog.csRules.attributes).map(([label,attribute])=>[attribute,label]));
  const mapped=mapCaptureGear((capture.inventory??[]).map(entry=>({...entry,enhancement:0,stars:null})),{items:mapping.gear,labels:statLabels,
    rareIds:catalog.reference.titanRare.items.map(item=>item.id),rowsPerItem:catalog.reference.limits.maxNumOfRandomStats,
    augmentsPerItem:catalog.reference.limits.maxNumOfAugmentStats,duel:mapping.duelGear});
  const blank=emptyDraft(catalog);
  return mapped.gear.flatMap((item,index)=>{
    const template=blank.gear.find(gear=>gear.id===item.slot),slot=draft.gear.find(gear=>gear.id===item.slot);
    if(!template)return [];
    const gear=structuredClone(template);
    applyCaptureGear(gear,item,{equipped:false,enhancement:slot?.enhancement??0,stars:slot?.stars??0});
    return [{key:`inventory-${index}`,gear}];
  });
}

/** Only exact generated identities affect formulas. Unknown weapons/matrices retain text-only captured IDs. */
export function draftFromCapture(value:unknown,catalog:BuildCatalog,mapping:CaptureImportCatalog,locale:BuildLocale,digest:string,temporary?:TemporaryAttackCatalog,signature?:string):BuildDraft {
  const capture=BuildCaptureSchema.parse(value),draft=emptyDraft(catalog),unresolved:string[]=[];
  const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
  const lookup=<T extends {id:string}>(id:string|null|undefined,items:T[],field:string):T|undefined=>{
    if(!id||id.toLowerCase()==='none')return undefined;const match=items.find(item=>same(item.id,id));
    if(!match)unresolved.push(`${field}: ${id}`);return match;
  };
  const weapon=(id:string)=>catalog.weapons.find(item=>same(item.weaponId,id));
  const p=capture.profile;
  const {server}=resolvePlayerServer({uid:capture.capture.subject.uid});
  Object.assign(draft.profile,{name:p.name??'',uid:capture.capture.subject.uid,roleId:capture.capture.subject.roleId??'',server:server?formatServerDisplay(server):'',level:p.level??0,signature:p.signature??'',crew:p.crew??'',
    cs:p.cs===null?null:Math.floor(p.cs),apexCs:p.maxCs===null?null:Math.floor(p.maxCs),characterTitle:p.titleId??''});
  draft.profile.suppressorId=lookup(p.suppressorId,catalog.suppressors,'suppressor')?.id??'';
  draft.profile.avatarId=lookup(p.avatarId,catalog.avatars,'avatar')?.id??'';
  draft.profile.avatarFrameId=lookup(p.avatarFrameId,catalog.avatarFrames,'frame')?.id??'';
  draft.combat.hp=capture.combat.hp??0;draft.combat.endurance=capture.combat.endurance??0;
  draft.combat.crit=capture.combat.crit??0;draft.combat.critDamage=capture.combat.critDamage??0;
  draft.combat.additionalCritRate=capture.combat.additionalCritRate??0;
  draft.enemyLevel=capture.profile.level??0;
  const temporaryPercent=temporary?temporaryAttackAtCapture(capture.buffs.records,temporary).percent:{};
  for(const element of draft.combat.elements) {
    const keys=attributes[element.id as keyof typeof attributes];if(!keys)continue;
    const final=capture.combat.attack[keys[0]],base=capture.combat.attackBase[keys[1]];
    element.attack=base??final??0;
    // Direct ratio of two received numbers; no claim about individual ATK% sources.
    element.attackPercent=base&&final!==null&&final!==undefined?final/base-1:0;
    // Constant temporary ATK% active at login (e.g. Proof of Trust 4-piece +20%) is not part of the build.
    element.attackPercent-=temporaryPercent[element.id]??0;
    element.resistance=capture.combat.resistance[keys[2]]??null;
  }
  for(const entry of capture.weapons) {
    if(!entry.itemId||entry.itemId.toLowerCase()==='none')continue;
    const meta=weapon(entry.itemId);if(!meta){
      unresolved.push('weapon: '+entry.itemId);
      Object.assign(draft.weapons[entry.slot],{capturedId:entry.itemId,level:entry.level,stars:entry.stars,upgradeLevel:entry.upgradeLevel});
      continue;
    }
    Object.assign(draft.weapons[entry.slot],{id:meta.id,level:entry.level,stars:entry.stars,upgradeLevel:entry.upgradeLevel});
    if(same(entry.itemId,mapping.fionaWeaponId)&&capture.weaponSettings.fionaSkills)
      draft.weapons[entry.slot].skills=capture.weaponSettings.fionaSkills.map(code=>mapping.fionaSkills[code]??'');
    for(const [field,rawId] of Object.entries(mapping.elementSettings)) {
      if(!same(rawId,entry.itemId)||!capture.weaponSettings.elements[field]||meta.elementFromResonance)continue;
      const {code,aux}=capture.weaponSettings.elements[field];
      const label=mapping.elementCodes[code];
      // The option is named by its main element (first of the pair); word1 must agree when it is known.
      const bit=mapping.elementBits?.[aux];
      const selected=bit&&bit!==label?undefined:meta.selectableElements?.find(option=>option.elements[0]===label);
      if(selected)draft.weapons[entry.slot].element=selected.id;
      else if(meta.selectableElements?.length)unresolved.push(`element: ${entry.itemId}`);
    }
  }
  for(const [setting,{weaponId,base}] of Object.entries(mapping.modeSettings??{})) {
    const raw=capture.weaponSettings.settings[setting],slot=capture.weapons.find(entry=>same(entry.itemId,weaponId))?.slot;
    if(slot===undefined||typeof raw!=='number')continue;
    const chosen=weapon(weaponId)?.selectableModes?.[raw-base];
    if(chosen)draft.weapons[slot].mode=chosen.id;else unresolved.push(`mode: ${weaponId} ${raw}`);
  }
  // `Nanyin_superpower` record: weaponId of the marked weapon (docs/imports.md, Nan Yin mark).
  const mark=capture.weaponSettings.nanYinMark;
  if(mark&&mark.toLowerCase()!=='none'){const marked=weapon(mark);if(marked)draft.markWeaponId=marked.weaponId;else unresolved.push('mark: '+mark);}
  for(const entry of capture.matrices) {
    const matrix=draft.weapons[entry.weaponSlot].matrices[entry.slot-1];
    if(entry.state==='empty')continue;
    if(!entry.matrix){unresolved.push(`matrix: ${entry.weaponSlot}/${entry.slot}`);continue;}
    const meta=lookup(entry.matrix.suitId,catalog.matrices,'matrix');
    if(meta)Object.assign(matrix,{id:meta.id,level:entry.matrix.level,stars:entry.matrix.stars});
    else {
      if(!entry.matrix.suitId)unresolved.push('matrix: '+entry.matrix.itemId);
      Object.assign(matrix,{capturedId:entry.matrix.suitId||entry.matrix.itemId,level:entry.matrix.level,stars:entry.matrix.stars});
    }
  }
  const statLabels=Object.fromEntries(Object.entries(catalog.csRules.attributes).map(([label,attribute])=>[attribute,label]));
  const mapped=mapCaptureGear(capture.gear,{items:mapping.gear,labels:statLabels,rareIds:catalog.reference.titanRare.items.map(item=>item.id),
    rowsPerItem:catalog.reference.limits.maxNumOfRandomStats,augmentsPerItem:catalog.reference.limits.maxNumOfAugmentStats,duel:mapping.duelGear});
  unresolved.push(...mapped.unresolved,...mapped.duel.map(id=>'duel gear (not a PvE piece): '+id));
  for(const item of mapped.gear) {
    const target=draft.gear.find(gear=>gear.id===item.slot);
    if(!target){unresolved.push('gear: '+item.itemId);continue;}
    applyCaptureGear(target,item,{equipped:true,enhancement:item.enhancement,stars:item.stars});
  }
  if(capture.trait?.enabled&&capture.trait.weaponId&&capture.trait.weaponId.toLowerCase()!=='none') {
    const meta=weapon(capture.trait.weaponId);if(meta)draft.traitId=meta.id;else unresolved.push('trait: '+capture.trait.weaponId);
    draft.traitPoints=capture.trait.points??0;
  }
  for(const entry of capture.relics) {
    const meta=lookup(entry.itemId,catalog.relics,'relic');if(meta)draft.relics[entry.slot]={id:meta.id,stars:entry.stars};
  }
  // A partially read relic loadout leaves slots empty with no unknown identity: the capture-date tooltip says so.
  if(capture.relics.length<2&&capture.availability.relicLoadout?.state!=='received')unresolved.push(`relic: ${capture.relics.length} of 2 captured (${capture.availability.relicLoadout?.state??'unknown'})`);
  if(capture.account)draft.account={...capture.account};
  draft.relicDamage={};draft.relicResistance={};
  for(const element of draft.combat.elements) {
    const passive=(stat:string)=>capture.relicPassives.find(item=>item.attribute===catalog.csRules.attributes[element.id+' '+stat]);
    const damage=passive('Damage %'),resistance=passive('Resistance %');
    if(damage&&element.id!=='Altered')draft.relicDamage[element.id]=damage.fraction;
    if(resistance)draft.relicResistance[element.id]=resistance.fraction;
  }
  if(capture.pet) {
    const meta=lookup(capture.pet.itemId,catalog.pets,'pet');
    if(meta) {
      Object.assign(draft.pet,{id:meta.id,customName:capture.pet.customName,level:capture.pet.level,stars:capture.pet.stars});
      for(const module of capture.pet.modules) {
        const type=module.typeId.replace(/^SkillModule_/,'');
        const chosen=lookup(type,meta.modules,'pet module');
        if(chosen){draft.pet.modules[module.slot]=chosen.id;draft.pet.moduleLevels![module.slot]=module.level;}
      }
    }
  }
  for(const entry of capture.computing??[]) {
    const meta=catalog.computing.find(item=>mapping.computingSlots[(item as typeof item&{slot?:string}).slot??'']===entry.slot);
    const target=draft.computing.find(item=>item.id===meta?.id);if(target){target.level=entry.level;target.progress=entry.progress;}else unresolved.push('computing: '+entry.slot);
  }
  if(capture.support)for(const entry of capture.support.modules) {
    if(!entry.id||entry.id.toLowerCase()==='none')continue;
    const target=draft.support.find(item=>same(item.id,entry.id));if(target)target.level=entry.level;else unresolved.push('support: '+entry.id);
  }
  for(const entry of capture.synthesis) {
    if(!entry.itemId||entry.itemId.toLowerCase()==='none')continue;
    const meta=weapon(entry.itemId),target=draft.synthesis.find(item=>item.id===meta?.id);
    if(target)target.stage=entry.stage;else unresolved.push('synthesis: '+entry.itemId);
  }
  for(const buff of capture.buffs.records) {
    const candidates=mapping.consumables[buff.definition]?.filter(id=>catalog.consumables.some(group=>group.items.some(item=>same(item.id,id))))??[];
    if(candidates.length!==1){
      if(candidates.length>1)unresolved.push(`consumable: ${buff.definition} (${candidates.length} matching items; identity unavailable)`);
      continue;
    }
    for(const [index,group] of catalog.consumables.entries()) {
      const item=group.items.find(item=>same(item.id,candidates[0]));if(!item)continue;
      if(draft.consumables![index]){unresolved.push('consumable: '+buff.definition);continue;}
      draft.consumables![index]=item.id;
      if(buff.expiresAt){draft.consumableExpiresAt??={};draft.consumableExpiresAt[item.id]=buff.expiresAt;}
    }
  }
  // Values from a newer game patch are fitted to this catalog and listed, never a reason to reject the file.
  fitCaptureDraft(draft,catalog,unresolved);
  // Final resistance is captured; the known multiplier sums gear, resonance, computing and relic A4.
  // An unobserved external buff can still make this inferred percentage incomplete.
  for(const element of draft.combat.elements)element.resistancePercent=estimatedResistancePercent(draft,element.id,catalog);
  // DisplayBase includes Space Support. The native final/base ratio therefore retains its ATK% multiplier.
  const foodFlat=applyConsumableStats(draft,catalog).combat.consumableStatsApplied?.postPercentElementAttack??{};
  for(const element of draft.combat.elements) {
    const keys=attributes[element.id as keyof typeof attributes];if(!keys)continue;
    const base=capture.combat.attackBase[keys[1]],final=capture.combat.attack[keys[0]];
    if(base&&final!==null&&final!==undefined) {
      const percent=(final-(foodFlat[element.id]??0))/base-1-(temporaryPercent[element.id]??0);
      if(percent<0&&element.attackPercent!==0)unresolved.push(`attack percent: ${element.id} ${percent}`);
      element.attackPercent=Math.max(0,percent);
    }
  }
  if(capture.inventory!==undefined) {
    const inventory=inventoryFromCapture(capture,draft,catalog,mapping).map(piece=>piece.gear);
    const total=totalAugmentationSpent(draft,inventory);
    draft.augmentationSpent=total.unknown===0?total.total:null;
  }
  draft.captureSource={kind:'file',digest,...(signature?{signature}:{}),capture,unresolved};
  const validated=restoreDraft(draft,catalog);
  if(!validated)throw new Error('Captured values do not match this card catalog');
  return deriveDamagePercentDraft(validated,catalog);
}

/** Rebuild cached imported values after mapping/formula updates, keeping display choices and manual drafts. */
export async function refreshCapturedDraft(draft:BuildDraft,catalog:BuildCatalog,locale:BuildLocale,sources?:CaptureCatalogs):Promise<BuildDraft> {
  const source=draft.captureSource;
  if(source?.kind!=='file')return draft;
  // The generated example includes authored presentation absent from its signed capture
  // (the marked weapon and pet name). Rebuilding it from only the capture drops those fields.
  let refreshed:BuildDraft;
  if(draft.demo&&source.digest===catalog.demoDraft.captureSource?.digest)refreshed=structuredClone(catalog.demoDraft);
  else {
    const {mapping,temporary}=sources??await loadCaptureCatalogs();
    refreshed=draftFromCapture(source.capture,catalog,mapping,locale,source.digest,temporary,source.signature);
  }
  refreshed.art=structuredClone(draft.art);
  refreshed.rv=structuredClone(draft.rv);
  refreshed.enemyLevel=draft.enemyLevel;
  refreshed.profile.role=draft.profile.role;
  refreshed.demo=draft.demo;
  refreshed.updatedAt=draft.updatedAt;
  return refreshed;
}

/** `onQueue`: the import's place in the shared queue (decryption and signing run there). */
export async function importBuildFile(file:File,catalog:BuildCatalog,locale:BuildLocale,onQueue?:(job:QueueJob)=>void):Promise<BuildDraft> {
  return (await importBuildCapture(file,catalog,locale,onQueue)).draft;
}

/** The card and the backpack pieces of the same file (Optimizer). `inventoryReceived` is false for files without a backpack. */
export async function importBuildCapture(file:File,catalog:BuildCatalog,locale:BuildLocale,onQueue?:(job:QueueJob)=>void) {
  // The browser gate (extension, size, format signature, complete text) refuses a file before it is sent.
  const imported=submitSealedFile<BuildImportResult>('build',file,
    {url:'/api/v1/build/import',locale,onUpdate:onQueue}).catch((error:unknown)=>{
    if(error instanceof SealedFileError)throw error;
    const reason=error instanceof Error?error.message:'';
    const temporary=/^Temporary ATK buffs were active at login: (.+?)\. /.exec(reason);
    if(temporary)throw Object.assign(new Error(reason),{name:'TemporaryAttackError',buffs:temporary[1]});
    throw new Error(error instanceof QueueError&&error.status===503&&/not configured/i.test(reason)?'Build import is not configured':queueMessage(error,locale==='ru','The build file could not be imported'));
  });
  const [result,catalogs]=await Promise.all([imported,loadCaptureCatalogs()]);
  return buildCaptureFromResult(result,catalog,locale,catalogs);
}

/** The card and backpack of a server import result (a file sent here or handed over from the MMO page). */
export async function buildCaptureFromResult(result:BuildImportResult,catalog:BuildCatalog,locale:BuildLocale,catalogs?:CaptureCatalogs) {
  const {mapping,temporary}=catalogs??await loadCaptureCatalogs();
  // MMO (Warp) cards have their own page and card model.
  if(result.data.mmo)throw new MmoPageMismatchError(localeText(locale)('This file is an MMO character: it is opened on the Build → MMO page.', 'Это файл MMO-персонажа: он открыт на странице Build → MMO.'),result);
  const draft=draftFromCapture(result.data,catalog,mapping,locale,result.source.digest,temporary,result.source.signature);
  // The server returns the backpack beside the signed card; it is not part of the card or its digest.
  return {draft,inventoryReceived:result.inventory!==undefined,inventory:inventoryFromCapture({...result.data,inventory:result.inventory},draft,catalog,mapping),
    // Unknown or Warp (MMO) server: shown here, but the site stored nothing (no ranking, no saved profile).
    serverRefusal:result.serverRefusal??null,
    // Capture app older than the verified minimum: shown here, gear not verified or ranked.
    outdatedExporter:result.outdatedExporter??null};
}

/** Notice suffix for a card the site showed but did not store. */
export function serverRefusalNotice(refusal:PlayerServerRefusal|null,locale:BuildLocale,outdatedExporter:string|null=null) {
  if(outdatedExporter)return locale==='ru'
    ?` Файл снят старой версией приложения захвата: билд показан, но гир не верифицирован и не попадёт в рейтинг. Обновите приложение до ${outdatedExporter} или новее и снимите заново.`
    :` The file comes from an old capture app: the build is shown, but its gear is not verified or ranked. Update the app to ${outdatedExporter} or newer and capture again.`;
  if(!refusal)return '';
  return refusal==='unknown-server'
    ?(localeText(locale)(' The server is missing from the site catalog: the build is shown but not stored or ranked.', ' Сервер не найден в каталоге сайта: билд показан, но не сохранён и не попадёт в рейтинг.'))
    :(localeText(locale)(' Warp (MMO) servers are not supported yet: the build is shown but not stored or ranked.', ' Варп-серверы (MMO) пока не поддерживаются: билд показан, но не сохранён и не попадёт в рейтинг.'));
}
