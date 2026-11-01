import {mapCaptureGear,normalizeCharacterTitle,type CaptureGearEntry} from '@tof-hub/game-domain';
import type {PlayerSnapshot} from '@tof-hub/contracts';
import type {ScoringCatalog} from './scoring-catalog';

/** Decrypted `<uid>.stats` from the capture app (player-inspect-v1). */
export interface InspectPayload {
  version:1;
  observer:{uid:string|null;role_id:string|null;server_id:string|null};
  player:{uid:string|null;role_id:string|null;name:string|null;level:number|null;cs:number|null;max_cs:number|null;
    guild:string|null;title:string|null;properties:Record<string,unknown>;last_seen_at:string;profile_captured_at:string|null};
}

/**
 * One `Equipment_<n>` profile value: `itemId#enhancement#stat|stat…#stars##`, each stat `1,<attribute>;2,<value>;5,<tag>;`.
 * Tags: `None` (random stat), `EquipmentTupo` (Titan-added stat), `<effect>_Lv<n>` with `uncommon_<n>` (Titan rare effect).
 * Values are current (after Titan); the profile has no pre-Titan values.
 */
export function parseInspectEquipment(value:string):CaptureGearEntry|null {
  const [itemId,enhancement,stats,stars]=value.split('#');
  if(!itemId||!/^[A-Za-z0-9_]{1,80}$/.test(itemId)||!stats)return null;
  const entries=stats.split('|').flatMap(text=>{
    const fields=Object.fromEntries(text.split(';').filter(Boolean).map(pair=>{const at=pair.indexOf(',');return [pair.slice(0,at),pair.slice(at+1)];}));
    const number=Number(fields['2']);
    return fields['1']&&Number.isFinite(number)?[{attribute:fields['1'],value:number,tag:fields['5']??null}]:[];
  });
  const level=Number(enhancement),starCount=Number(stars);
  return {itemId,enhancement:Number.isInteger(level)?level:0,stars:Number.isInteger(starCount)?starCount:null,stats:entries,beforeTitan:null};
}

const text=(value:unknown,max=120)=>typeof value==='string'&&value.trim()?value.slice(0,max):undefined;
/**
 * A nickname is kept exactly as the game sends it, also when it is only spaces (2026-10-08: twelve U+00A0, U+2003 or
 * U+3000 mixes; the game draws them blank). Trimming had stored no nickname at all.
 */
const nickname=(value:unknown)=>{const clean=typeof value==='string'?value.replace(/\u0000/g,''):'';return clean.length?clean.slice(0,64):undefined;};
const whole=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.floor(value):undefined;

/** A decrypted inspect file as a player snapshot (source `inspect`: someone else's profile, current gear only). */
export function snapshotFromInspect(payload:InspectPayload,catalog:ScoringCatalog):{snapshot:PlayerSnapshot;unresolved:string[]} {
  const p=payload.player,properties=p.properties??{};
  const equipment=Object.entries(properties).filter(([key])=>/^Equipment_\d+$/.test(key)).flatMap(([,value])=>{
    const entry=typeof value==='string'?parseInspectEquipment(value):null;return entry?[entry]:[];
  });
  const {gear,unresolved}=mapCaptureGear(equipment,catalog.captureGear);
  // Missing counters are unavailable, not zero: Number(null/blank) would erase a known recharge value.
  const rawRecharge=properties.TotalRecharge;
  const recharge=whole(typeof rawRecharge==='number'?rawRecharge:
    typeof rawRecharge==='string'&&rawRecharge.trim()?Number(rawRecharge):undefined);
  return {unresolved,snapshot:{source:'inspect',capturedAt:new Date(p.profile_captured_at??p.last_seen_at).toISOString(),
    player:{uid:p.uid&&/^\d{1,24}$/.test(p.uid)?p.uid:undefined,roleId:p.role_id&&/^\d{1,24}$/.test(p.role_id)?p.role_id:undefined,
      nickname:nickname(p.name),level:whole(p.level),crew:text(p.guild,64),titleId:normalizeCharacterTitle(p.title)||undefined,
      avatarId:text(properties.AvatarId),avatarFrameId:text(properties.AvatarFrameId),
      combatScore:whole(p.cs),maxCombatScore:whole(p.max_cs),...(recharge===undefined?{}:{totalRecharge:recharge})},
    gear:gear.map(item=>({slot:item.slot,itemId:item.itemId,stars:Math.min(5,Math.max(0,item.stars)),enhancement:item.enhancement,
      titan:item.stage==='titan',augmented:item.stage!=='normal',rareId:item.rareId||null,rareLevel:item.rareId?item.rareLevel:null,
      stats:item.rows.map(row=>({type:row.type,value:row.value})),
      // A normal item's current values are its original rolls; Titan values cannot be inverted (ranking.md).
      statsBeforeTitan:item.stage==='normal'?item.rows.map(row=>row.value):null,augments:item.augments}))}};
}
