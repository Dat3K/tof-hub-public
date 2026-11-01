import {BuildCaptureSchema,isMmoProfileRole,type BuildCapture,type MmoProfileRole} from '@tof-hub/contracts';
import demoCapture from './demo-capture.json';
import {mmoCardStats,mmoRandomStatTotals,mmoThresholdLevel} from '@tof-hub/game-domain';
import {detectResonance} from '../../comp/state';
import {brainfieldStats} from '../../datamine/handbook/brainfield-domain';
import type {MmoBuildCatalog,MmoBuildDraft,MmoCard,MmoGearDraft,MmoGearItem} from './types';

export const MMO_DRAFT_KEY='tof-hub:build-mmo-draft';
export const MMO_WEAPON_SLOTS=3;
/** The highest +N of MMO weapons (StaticWeaponDataTable_MMO.MaxUpgradeStar; one advancement per step in the generated data). */
export const mmoWeaponMaxStars=(catalog:MmoBuildCatalog,id:string)=>catalog.weapons.find(weapon=>weapon.id===id)?.advancements.length??0;

export const emptyMmoGear=():MmoGearDraft=>({itemId:'',rolls:[],card:null});
export function emptyMmoDraft(catalog:MmoBuildCatalog):MmoBuildDraft {
  return {version:1,mode:'mmo',
    profile:{name:'',uid:'',level:1,cs:null,season:catalog.seasons.filter(season=>!season.editorial).at(-1)?.index??null,crew:'',characterTitle:'',signature:'',avatarId:'',avatarFrameId:''},
    art:{id:catalog.artworks.find(art=>art.loading)?.id??catalog.artworks[0]?.id??'',zoom:1,x:50,y:49},
    stats:{},gear:Object.fromEntries(catalog.slots.map(slot=>[slot.id,emptyMmoGear()])),
    weapons:Array.from({length:MMO_WEAPON_SLOTS},()=>({id:'',stars:0})),weaponMode:null,brainfield:{},pet:null,consumables:{food:'',potion:''}};
}

const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const finite=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
const nullableNumber=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
const text=(value:unknown,max=500)=>typeof value==='string'?value.slice(0,max):'';
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const cosmeticId=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,64}$/.test(value)?value:'';

/** Rebuilds a stored or edited draft against the current catalog; ids the catalog no longer has become empty. */
export function restoreMmoDraft(value:unknown,catalog:MmoBuildCatalog):MmoBuildDraft|null {
  if(!isRecord(value)||value.version!==1||value.mode!=='mmo')return null;
  const draft=emptyMmoDraft(catalog);
  if(value.demo===true)draft.demo=true;
  if(typeof value.updatedAt==='string')draft.updatedAt=value.updatedAt;
  const profile=isRecord(value.profile)?value.profile:{};
  draft.profile={name:text(profile.name,120),uid:text(profile.uid,32),level:clamp(Math.trunc(finite(profile.level,1)),0,1000),cs:nullableNumber(profile.cs),
    season:catalog.seasons.some(season=>season.index===profile.season)?profile.season as number:null,crew:text(profile.crew,120),characterTitle:text(profile.characterTitle,120),signature:text(profile.signature),
    // A captured id the cosmetics catalog does not have yet is kept (shown as a fallback until the pipeline publishes it).
    avatarId:cosmeticId(profile.avatarId),avatarFrameId:cosmeticId(profile.avatarFrameId)};
  const art=isRecord(value.art)?value.art:{};
  draft.art={id:art.id===''||catalog.artworks.some(item=>item.id===art.id)?art.id as string:draft.art.id,zoom:clamp(finite(art.zoom,1),0.25,3),x:clamp(finite(art.x,50),0,100),y:clamp(finite(art.y,49),0,100),
    ...(typeof art.offsetX==='number'?{offsetX:art.offsetX}:{}),...(typeof art.offsetY==='number'?{offsetY:art.offsetY}:{})};
  if(isRecord(value.stats))for(const prop of mmoPanelAttributes(catalog))if(prop in value.stats)draft.stats[prop]=nullableNumber(value.stats[prop]);
  const gear=isRecord(value.gear)?value.gear:{};
  for(const slot of catalog.slots) {
    const stored=isRecord(gear[slot.id])?gear[slot.id] as Record<string,unknown>:{};
    const item=catalog.gear.find(entry=>entry.id===stored.itemId&&entry.slot===slot.id);
    const pool=new Set(item?.pool?catalog.pools[item.pool]:[]);
    const rolls=Array.isArray(stored.rolls)?stored.rolls.filter(isRecord).map(roll=>({prop:pool.has(roll.prop as string)?roll.prop as string:'',value:nullableNumber(roll.value)})).slice(0,pool.size):[];
    const card=isRecord(stored.card)?catalog.cards.find(entry=>entry.id===(stored.card as Record<string,unknown>).id&&entry.slots.includes(slot.id)):undefined;
    draft.gear[slot.id]={itemId:item?.id??'',rolls,
      card:card?{id:card.id,stars:clamp(Math.trunc(finite((stored.card as Record<string,unknown>).stars,0)),0,card.maxStars)}:null};
  }
  if(Array.isArray(value.weapons))value.weapons.slice(0,MMO_WEAPON_SLOTS).forEach((weapon,index)=>{
    if(!isRecord(weapon)||!catalog.weapons.some(item=>item.id===weapon.id))return;
    draft.weapons[index]={id:weapon.id as string,stars:clamp(Math.trunc(finite(weapon.stars,0)),0,mmoWeaponMaxStars(catalog,weapon.id as string))};
  });
  draft.weaponMode=value.weaponMode==='fixed'||value.weaponMode==='regular'?value.weaponMode:null;
  if(isRecord(value.brainfield))for(const node of catalog.brainfield.flatMap(chain=>chain.nodes)) {
    const level=value.brainfield[node.id];
    if(typeof level==='number'&&level>0)draft.brainfield[node.id]=clamp(Math.trunc(level),0,node.maxLevel);
  }
  if(isRecord(value.pet)) {
    const pet=catalog.pets.find(item=>item.id===(value.pet as Record<string,unknown>).id);
    if(pet){
      // The capture contract carries at most four serialized slots. Preserve unknown ids rather than
      // silently discarding capture values when a generated module definition is unavailable.
      const modules=Array.isArray(value.pet.modules)?value.pet.modules.filter(isRecord).filter(row=>typeof row.slot==='number'&&Number.isInteger(row.slot)&&row.slot>=0&&row.slot<4&&typeof row.id==='string'&&row.id.length>0).slice(0,4).map(row=>({slot:row.slot as number,id:text(row.id,128)})).sort((a,b)=>a.slot-b.slot):[];
      draft.pet={id:pet.id,level:clamp(Math.trunc(finite(value.pet.level,1)),1,pet.levels.length),inheritedAttack:nullableNumber(value.pet.inheritedAttack),stars:clamp(Math.trunc(finite(value.pet.stars,0)),0,pet.maxAdvance),modules};
    }
  }
  const consumables=isRecord(value.consumables)?value.consumables:{};
  draft.consumables={food:catalog.foods.some(food=>food.id===consumables.food)?consumables.food as string:'',potion:catalog.potions.some(potion=>potion.id===consumables.potion)?consumables.potion as string:''};
  if(isMmoProfileRole(value.role))draft.role=value.role;
  const source=isRecord(value.source)?value.source:null;
  const capture=source?BuildCaptureSchema.safeParse(source.capture):null;
  if(draft.demo&&source?.digest===''&&source.signature==='')
    // The deliberately stripped demo is not a full signed-file contract. Restore its trusted account context only;
    // never accept an arbitrary unsigned capture from browser storage as an import.
    draft.source={capture:demoCapture as unknown as BuildCapture,digest:'',signature:''};
  else if(source&&capture?.success&&typeof source.digest==='string'&&/^[0-9a-f]{64}$/.test(source.digest)&&typeof source.signature==='string'&&/^[A-Za-z0-9_-]{16,1024}$/.test(source.signature))
    draft.source={capture:capture.data,digest:source.digest,signature:source.signature};
  return draft;
}

/** Every attribute of the in-game Special and Basic panels, in panel order. */
export const mmoPanelAttributes=(catalog:MmoBuildCatalog)=>[...catalog.panels.special,...catalog.panels.elements.flatMap(row=>[row.attack,row.resistance]),...catalog.panels.basic];
export const mmoGearItem=(catalog:MmoBuildCatalog,id:string):MmoGearItem|undefined=>id?catalog.gear.find(item=>item.id===id):undefined;
export const mmoRollRange=(catalog:MmoBuildCatalog,prop:string,quality:string)=>catalog.randomStats[prop]?.ranges[quality]??null;
export const mmoAttribute=(catalog:MmoBuildCatalog,prop:string)=>catalog.attributes[catalog.randomStats[prop]?.attribute??prop]??catalog.attributes[prop.replace(/_\d+$/,'')];
export const mmoPetModuleLimit=(draft:MmoBuildDraft,catalog:MmoBuildCatalog)=>draft.pet?catalog.petModuleLimits?.[draft.pet.id]?.[draft.pet.stars??0]??null:null;
export function mmoPetModuleChoices(draft:MmoBuildDraft,catalog:MmoBuildCatalog,slot:number) {
  const pet=draft.pet,limit=mmoPetModuleLimit(draft,catalog);
  if(!pet||!limit||slot>=limit.slots)return [];
  const element=catalog.pets.find(item=>item.id===pet.id)?.element;
  const others=(pet.modules??[]).filter(row=>row.slot!==slot).map(row=>catalog.petModules?.find(module=>module.id===row.id));
  if(others.some(module=>!module))return [];
  const otherLoad=others.reduce((sum,module)=>sum+module!.load,0);
  return (catalog.petModules??[]).filter(module=>(!module.exclusivePets.length||module.exclusivePets.includes(pet.id))&&(!module.elements.length||module.elements.some(value=>value.split('::').at(-1)===element))&&module.load+otherLoad<=limit.load);
}

/**
 * Hover-inspection key of an attribute: its game name (EN). Gear modifiers and panel rows are different attributes of
 * one stat (CritAdded → Crit, MaxHealthAdded → HP) and share that name, as the Global card keys stats by label.
 */
export const mmoStatKey=(catalog:MmoBuildCatalog,prop:string)=>mmoAttribute(catalog,prop)?.name?.en??prop;

/**
 * Crit rating → chance at the character's own level (game text: "when attacking a same-level opponent"): rating ÷ the
 * shared CritFormula curve at that level, plus the flat Crit Rate (FinalCrit). Model: the curve is the Global one.
 */
export function mmoCritChance(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  const scale=mmoCritScale(draft,catalog);
  const rating=draft.stats.Crit;
  if(!scale||rating===undefined||rating===null)return null;
  const base=rating/scale.denominator,additional=draft.stats.FinalCrit??0;
  return {...scale,rating,base,additional,total:base+additional};
}

/** The crit-rating divisor at the character's level (shared by the player's and the Smart Servant's Crit). */
export function mmoCritScale(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  const denominators=catalog.critFormula?.denominators;
  if(!denominators)return null;
  const level=Math.min(Math.max(1,Math.trunc(draft.profile.level)),Math.max(...Object.keys(denominators).map(Number)));
  const denominator=denominators[level];
  return denominator?{level,denominator}:null;
}

/**
 * Keys a source answers to: its attribute's key, and for the all-element Resistance every element's own key, because an
 * element's RES cell inspects only its element (the shared highlight drops the generic key there).
 */
export const mmoStatKeys=(catalog:MmoBuildCatalog,prop:string)=>{
  const key=mmoStatKey(catalog,prop);
  return mmoAttribute(catalog,prop)===catalog.attributes.ElementDef?[key,...catalog.panels.elements.map(row=>`${row.element} ${key}`)]:[key];
};

/** Hover-inspection key that links the header Combat Strength with each weapon's part. */
export const MMO_COMBAT_STRENGTH='@mmo-combat-strength';

/** Weapon Combat Strength: the reached "Increases Combat Strength by N" steps. */
export function mmoWeaponCombatStrength(catalog:MmoBuildCatalog,entry:{id:string;stars:number}) {
  return catalog.weapons.find(weapon=>weapon.id===entry.id)?.advancements.filter(advancement=>advancement.star<=entry.stars).reduce((sum,advancement)=>sum+advancement.combatStrength,0)??0;
}

/** Expansion-card base stats at its stars, scaled by the character level (model, see docs/imports.md). */
export const mmoCardStatValues=(catalog:MmoBuildCatalog,card:MmoCard,stars:number,level:number)=>mmoCardStats(card.stats,stars,catalog.cardCoefficients,level);

/** A new item keeps the slot's card; rolls outside the new item's pool are cleared. */
export function selectMmoGear(draft:MmoBuildDraft,slot:string,itemId:string,catalog:MmoBuildCatalog) {
  const item=mmoGearItem(catalog,itemId),current=draft.gear[slot]??emptyMmoGear();
  if(item&&item.slot!==slot)return;
  if(!item){draft.gear[slot]={...emptyMmoGear(),card:current.card};return;}
  const pool=item.pool?catalog.pools[item.pool]:[];
  const kept=current.rolls.filter(roll=>pool.includes(roll.prop));
  draft.gear[slot]={itemId:item.id,card:current.card,
    rolls:kept.length?kept:pool.slice(0,Math.min(3,pool.length)).map(prop=>({prop,value:mmoRollRange(catalog,prop,item.quality)?.base??null}))};
}

const equippedRolls=(draft:MmoBuildDraft)=>Object.values(draft.gear).filter(gear=>gear.itemId).flatMap(gear=>gear.rolls);

/** Random-stat totals by quality-suffixed property, as the seasonal tracks key them. */
export const mmoRollTotals=(draft:MmoBuildDraft)=>mmoRandomStatTotals(equippedRolls(draft));

/** Footer sums by attribute (all seasons together), percent attributes as fractions. */
export function mmoAttributeTotals(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  const totals=new Map<string,{value:number;pieces:number;min:number;max:number;known:boolean}>();
  // `pieces`: in how many equipped items the attribute rolls at least once.
  for(const gear of Object.values(draft.gear).filter(item=>item.itemId)) {
    const item=mmoGearItem(catalog,gear.itemId);
    const seen=new Set<string>();
    for(const roll of gear.rolls) {
      if(!roll.prop||roll.value===null)continue;
      const attribute=catalog.randomStats[roll.prop]?.attribute??roll.prop;
      const entry=totals.get(attribute)??{value:0,pieces:0,min:0,max:0,known:true};
      entry.value+=roll.value;
      const range=item?mmoRollRange(catalog,roll.prop,item.quality):null;
      if(range){entry.min+=range.min;entry.max+=range.max;}
      else entry.known=false;
      if(!seen.has(attribute)){seen.add(attribute);entry.pieces+=1;}
      totals.set(attribute,entry);
    }
  }
  return [...totals].map(([attribute,{value,pieces,min,max,known}])=>({attribute,value,pieces,
    quality:!known?null:max>min?Math.min(1,Math.max(0,(value-min)/(max-min))):value>=max?1:null}));
}

export function mmoThresholds(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  const totals=mmoRollTotals(draft);
  const referenceCounts=new Map<string,number>();
  for(const track of catalog.thresholds) {
    const reference=track.reference??'';
    referenceCounts.set(reference,(referenceCounts.get(reference)??0)+(Object.hasOwn(totals,track.prop)?1:0));
  }
  const preferred=[...referenceCounts].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const groups=new Map<string,MmoBuildCatalog['thresholds']>();
  for(const track of catalog.thresholds)groups.set(track.attribute,[...groups.get(track.attribute)??[],track]);
  // Current and historical exports use distinct property ids (_2 versus _3). Only exact ids count; never alias
  // an old roll to a new season's thresholds. Mixed equipment retains separate tracks when both are present.
  return [...groups.values()].flatMap(tracks=>{
    const matching=tracks.filter(track=>Object.hasOwn(totals,track.prop));
    return (matching.length?matching:[tracks.find(track=>(track.reference??'')===preferred)??tracks[0]!]).map(track=>({...track,total:totals[track.prop]??0,level:mmoThresholdLevel(track.levels,totals[track.prop]??0)}));
  });
}

/** Equipped expansion cards by pack; their count is the curve time of the pack's text, stats sum every card's stars. */
export function mmoCardSets(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  const equipped=new Map<string,number[]>();
  for(const gear of Object.values(draft.gear))if(gear.card)equipped.set(gear.card.id,[...equipped.get(gear.card.id)??[],gear.card.stars]);
  return [...equipped].flatMap(([id,stars])=>{
    const card=catalog.cards.find(item=>item.id===id);
    if(!card)return [];
    const stats=card.stats.map((stat,index)=>{
      const values=stars.map(star=>mmoCardStatValues(catalog,card,star,draft.profile.level)[index]!.value);
      return {prop:stat.prop,value:values.some(value=>value===null)?null:values.reduce<number>((sum,value)=>sum+value!,0)};
    });
    return [{card,count:stars.length,stats}];
  }).sort((a,b)=>b.count-a.count||a.card.id.localeCompare(b.card.id));
}

/**
 * Chain level totals and the sum of the reached levels' direct attribute rows, with the Handbook Brainfield rule
 * (`brainfieldStats`: additive, non-tag; skill buffs excluded; not a verified final account stat).
 */
export function mmoBrainfieldChains(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  return catalog.brainfield.map(chain=>{
    const ids=new Set(chain.nodes.map(node=>node.id));
    const stats=Object.entries(brainfieldStats((catalog.brainfieldStats??[]).filter(node=>ids.has(node.id)),draft.brainfield)).map(([prop,value])=>({prop,value}));
    return {...chain,level:chain.nodes.reduce((sum,node)=>sum+(draft.brainfield[node.id]??0),0),stats};
  });
}

/** Weapon role resonance with the Global card's rule (comp `detectResonance`: 2+ of one role, otherwise Balance). */
export function mmoRoleResonance(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  const equipped=draft.weapons.filter(chosen=>catalog.weapons.some(item=>item.id===chosen.id));
  if(equipped.length<2)return null;
  const view={weapons:catalog.weapons.map(({id,weaponId,role})=>({id,weaponId,role}))} as unknown as Parameters<typeof detectResonance>[1];
  const role=detectResonance(equipped.map(chosen=>({id:chosen.id,stars:chosen.stars,matrix:null})),view);
  return catalog.roleResonances.find(item=>item.id===role)??null;
}

/** The card's role: the header choice, else the weapon resonance, else DPS. */
export function mmoCardRole(draft:MmoBuildDraft,catalog:MmoBuildCatalog):MmoProfileRole {
  const resonance=mmoRoleResonance(draft,catalog)?.id;
  return draft.role??(isMmoProfileRole(resonance)?resonance:'dps');
}

export function mmoPetStats(draft:MmoBuildDraft,catalog:MmoBuildCatalog) {
  const pet=draft.pet&&catalog.pets.find(item=>item.id===draft.pet!.id);
  if(!pet||!draft.pet)return null;
  const row=pet.levels.find(([level])=>level===draft.pet!.level);
  return {pet,attack:row?.[1]??null,crit:row?.[2]??null,inheritedAttack:draft.pet.inheritedAttack};
}

