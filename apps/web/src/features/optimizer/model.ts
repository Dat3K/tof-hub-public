import {getBuildRatedFamilies,alteredAttackSources,compareBuildOutputFactors,getBuildAugmentPools,getBuildCurrentValue,getBuildRVFactors,getBuildTitanPrimaries,getBuildTitanProjection,type BuildRVProfile} from '@tof-hub/game-domain';
import {alteredSource,analyzeGear,buildCombatDraft,buildRollValue,cardGear,elementTotalAttack,elementTotalDamagePercent,enhancementResonance,equippedGearStats,gearElementStat,gearRVRemovedStats,rollValueContext,titanMaximums,type RollValueContext} from '../build/model';
import {elementResistanceBase,gearPercentTotal,personalRVProfile} from '../build/rv-profile';
import {supportAttack} from '../build/support-attack';
import type {BuildCatalog,BuildDraft,GearDraft} from '../build/types';

import {titanTarget,type InventoryPiece} from '../build/browser-storage';
export {DEFAULT_TITAN_TARGET,titanTarget,type InventoryPiece} from '../build/browser-storage';
export interface OptimizerDemo {schemaVersion:1;source:'demo';pieces:InventoryPiece[]}
/** Exact additions on the complete current build, using the base actually inherited by its selected element. */
export function statImpactModel(draft:BuildDraft,catalog:BuildCatalog) {
  const combat=buildCombatDraft(draft,catalog),context=rollValueContext({...combat,rv:{element:'',includeCrit:true,...combat.rv,mode:'prv'}},catalog);
  if(context.role==='tank'||context.role==='dps'&&draft.captureSource?.capture.combat.crit===null)return null;
  const source=context.inheritFrom??context.element;
  const personal=personalRVProfile(combat,catalog,source);
  if(!personal)return null;
  const attack=context.inheritFrom?{attack:personal.flatAttack,percent:personal.attackPercent,support:elementTotalAttack(combat,catalog,'Altered').ownAdded??0,foodAttack:personal.postPercentAttack??0}:elementTotalAttack(combat,catalog,source);
  // Use the same base and effective percentage as Build; support is already inside the multiplied base.
  const profile={...personal,flatAttack:attack.attack,postPercentAttack:attack.support+attack.foodAttack,attackPercent:attack.percent,
    damagePercent:elementTotalDamagePercent(combat,catalog,context.element)};
  const pairBases=!context.inheritFrom&&context.percentElements.length===2
    ?context.percentElements.map(element=>({element,value:(combat.combat.elements.find(row=>row.id===element)?.attack??NaN)-supportAttack(combat,catalog,element)})):[];
  if(pairBases.some(base=>!Number.isFinite(base.value)||base.value<=0))return null;
  const counted=(type:string,value:number)=>{
    const base=pairBases.find(base=>type===base.element+' Attack');
    return base?Math.max(0,base.value+value-Math.max(...pairBases.map(base=>base.value))):value;
  };
  const alteredProfiles=context.inheritFrom?alteredAttackSources(catalog.reference).flatMap(source=>{
    const profile=personalRVProfile(combat,catalog,source);
    return profile?[{source,profile:{...profile,damagePercent:combat.combat.elements.find(element=>element.id==='Altered')?.damage??0,postPercentAttack:attack.support+(profile.postPercentAttack??0)}}]:[];
  }):[];
  const output=(type?:string,value=0,support=0)=>alteredProfiles.length?Math.max(...alteredProfiles.map(({source,profile})=>{
    const types=getBuildRatedFamilies('Altered',[source],true,catalog.reference.titanGrowth,source,context.role).flat();
    return getBuildRVFactors(type&&types.includes(type)?[{type,value}]:[],{...profile,postPercentAttack:(profile.postPercentAttack??0)+support},'Altered',source,context.role).reduce((total,factor)=>total*factor.value,1);
  })):getBuildRVFactors(type?[{type,value:counted(type,value)}]:[],
    {...profile,postPercentAttack:(profile.postPercentAttack??0)+support},context.element,context.inheritFrom,context.role)
    .reduce((total,factor)=>total*factor.value,1);
  const baseline=output();
  if(!(baseline>0)||!Number.isFinite(baseline))return null;
  const increase=(type:string,value:number)=>Number.isFinite(value)&&value>=0?output(type,value)-baseline:null;
  const flatType=source+' Attack';
  // EQ ATK refers to one counted base-ATK point, even when the selected element currently loses inheritance.
  const flatUnit=pairBases.length?increase(pairBases.reduce((best,base)=>base.value>best.value?base:best).element+' Attack',1)!:increase(flatType,1)!;
  const bounds=catalog.reference.statTypes[flatType];
  const minimum=bounds?.randomStatMinRollValue??null,maximum=bounds?.randomStatMaxRollValue??null;
  const equivalent=(type:string,value:number)=>{
    const impact=increase(type,value),attack=impact===null||flatUnit<=0?null:impact/flatUnit;
    return {impact,attack,quality:attack===null||minimum===null||maximum===null||maximum<=minimum?null:impact===0?0:(attack-minimum)/(maximum-minimum)};
  };
  const prv=(type:string,value:number)=>Number.isFinite(value)&&value>=0?getBuildCurrentValue({
    rows:[{type:pairBases.some(base=>type===base.element+' Attack')?context.element+' Attack':type,value:counted(type,value)}],added:[],types:catalog.reference.statTypes,growth:catalog.reference.titanGrowth,
    element:context.element,percentElements:context.percentElements,includeCrit:true,allowedTypes:[],
    maxStats:catalog.reference.limits.maxNumOfRandomStats,maxRolls:catalog.reference.limits.maxNumOfRandomStatRolls,
    profile,inheritFrom:context.inheritFrom,role:context.role}).value:null;
  const module=catalog.support.modules.find(item=>item.attackStat===`${context.element} Attack`);
  const supportStep=module?.levels.find(item=>item.level===1&&!item.percentage)?.value;
  // The support flat ATK is multiplied by ATK% (Gear Compare I11), except when ATK was inherited (Altered): then it is added after.
  const supportScale=context.inheritFrom?1:1+profile.attackPercent;
  return {context,profile,baseline,increase,prv,equivalent,minimum,maximum,supportStep,
    supportComparison:(damage:number)=>{
      if(context.role!=='dps'||supportStep===undefined||!(damage>0))return null;
      const damageImpact=increase(context.element+' Damage %',damage);
      return damageImpact!==null&&damageImpact>0?(output(undefined,0,supportStep*supportScale)-baseline)/damageImpact:null;
    }};
}
export type ProjectionKind='transfer'|'augment'|'reroll'|'headroom';
export type ProjectionReason='originals'|'stars'|'primary'|'pool'|null;
/** One legal lower-stat pair at the target: its added values (order of `pair`) and the output gain it gives. */
export interface LowerPairOption {pair:string[];values:number[];gain:number}
export interface GearProjection {gear:GearDraft|null;kind:ProjectionKind;reason:ProjectionReason;choices:string[][];maximums:ReturnType<typeof titanMaximums>;options:LowerPairOption[]}

export const matureTitan=(gear:GearDraft)=>gear.titan&&gear.augmentCount!==null&&gear.augmentCount!==undefined&&gear.augmentCount>120;

const replace=(draft:BuildDraft,gear:GearDraft)=>({...draft,gear:draft.gear.map(item=>item.id===gear.id?{...gear,equipped:true}:item)});
const without=(draft:BuildDraft,slot:string)=>({...draft,gear:draft.gear.map(item=>item.id===slot?{...item,equipped:false}:item)});
const sumStats=(rows:readonly {type:string;value:number}[])=>{
  const result=new Map<string,number>();
  for(const row of rows)if(row.type)result.set(row.type,(result.get(row.type)??0)+row.value);
  return [...result].map(([type,value])=>({type,value}));
};
const percentPool=(draft:BuildDraft,catalog:BuildCatalog,context:RollValueContext,kind:'Attack %'|'Damage %')=>
  Math.max(0,...context.percentElements.map(element=>gearElementStat(draft,catalog,element,kind)));

/** The same item-free contribution is used by comparison and by temporary equipment. */
function slotContribution(draft:BuildDraft,catalog:BuildCatalog,slot:string,context:RollValueContext) {
  const empty=without(draft,slot),emptyResonance=enhancementResonance(empty,catalog)?.stats;
  return (piece:GearDraft)=>{
    const equipped={...piece,equipped:true},loadout=replace(draft,equipped);
    const rows=equippedGearStats(equipped,catalog).filter(row=>!context.percentElements.some(element=>row.type===element+' Attack %'||row.type===element+' Damage %'));
    for(const kind of ['Attack %','Damage %'] as const)rows.push({type:context.percentElements[0]+' '+kind,
      value:percentPool(loadout,catalog,context,kind)-percentPool(empty,catalog,context,kind)});
    const resonance=enhancementResonance(loadout,catalog)?.stats;
    for(const [type,key] of [['Attack','atk'],['Crit','crit'],['HP','hp'],['Resistance','res']] as const)
      rows.push({type,value:(resonance?.[key]??0)-(emptyResonance?.[key]??0)});
    return sumStats(rows);
  };
}

/** One common item-free personal profile for BOTH sides; a backpack piece is never removed from the player's totals. */
export function slotComparison(draft:BuildDraft,catalog:BuildCatalog,slot:string,context:RollValueContext=rollValueContext(draft,catalog)) {
  draft=buildCombatDraft(draft,catalog);
  if(context.inheritFrom){const source=alteredSource(draft,catalog);context={...context,inheritFrom:source,percentElements:[source]};}
  const current=draft.gear.find(item=>item.id===slot);
  if(!current)return null;
  const removed=gearRVRemovedStats(current,draft,catalog,context);
  if(!removed)return null;
  const personal=personalRVProfile(draft,catalog,context.inheritFrom??context.element,removed);
  // The card's effective ATK% (own, with the pair's winning gear ATK%) less what removing this item takes from the winner.
  const effective=elementTotalAttack(draft,catalog,context.inheritFrom??context.element).percent;
  const ownRemoved=current.equipped?equippedGearStats(current,catalog).filter(row=>row.type==='Altered Attack').reduce((sum,row)=>sum+row.value,0):0;
  const personalProfile=personal&&context.percentElements.length===2&&!context.inheritFrom?{...personal,attackPercent:Math.max(0,effective-removed.attackPercent),damagePercent:Math.max(0,elementTotalDamagePercent(draft,catalog,context.element)-removed.damagePercent)}:personal&&context.inheritFrom?{...personal,damagePercent:draft.combat.elements.find(element=>element.id==='Altered')?.damage??0,postPercentAttack:(personal.postPercentAttack??0)+Math.max(0,(elementTotalAttack(draft,catalog,'Altered').ownAdded??0)-ownRemoved)}:personal;
  if(!personalProfile||context.role==='tank'&&(!personalProfile.hp||!personalProfile.resistanceConstant||!personalProfile.resistance))return null;
  // Personal weights and exact output follow the duo's higher base ATK,
  // which can come from a different element after the slot is removed or replaced.
  const pairBases=context.percentElements.length===2&&!context.inheritFrom&&context.role!=='tank'
    ?context.percentElements.map(element=>{
      const attack=draft.combat.elements.find(row=>row.id===element)?.attack;
      const contribution=gearRVRemovedStats(current,draft,catalog,{...context,element,selected:element,percentElements:[element]})?.flatAttack;
      return {element,value:attack!==undefined&&contribution!==undefined?attack-contribution-supportAttack(draft,catalog,element):null};
    }):[];
  if(pairBases.some(row=>row.value===null||!Number.isFinite(row.value)||row.value<=0))return null;
  const profile=pairBases.length?{...personalProfile,flatAttack:Math.max(...pairBases.map(base=>base.value!))+supportAttack(draft,catalog,context.element)}:personalProfile;
  const contribution=slotContribution(draft,catalog,slot,context);
  const rate=(piece:GearDraft)=>{
    if(alteredProfiles.length){
      const chosen=alteredProfiles.map(item=>{
        const types=getBuildRatedFamilies('Altered',[item.source],true,catalog.reference.titanGrowth,item.source,context.role).flat();
        const factors=getBuildRVFactors(item.contribution(piece).filter(row=>types.includes(row.type)),item.profile,'Altered',item.source,context.role);
        return {...item,attack:factors[0].value};
      }).reduce((best,item)=>item.attack>best.attack+1e-9?item:best);
      return getBuildCurrentValue({rows:piece.rows,added:piece.titan||piece.augmented?piece.augments:[],types:catalog.reference.statTypes,growth:catalog.reference.titanGrowth,
        element:'Altered',percentElements:[chosen.source],inheritFrom:chosen.source,includeCrit:true,allowedTypes:catalog.gear.find(item=>item.id===slot)?.allowedStats??[],
        maxStats:catalog.reference.limits.maxNumOfRandomStats,maxRolls:catalog.reference.limits.maxNumOfRandomStatRolls,profile:chosen.profile,role:context.role});
    }
    const inBuild=cardGear({...piece,equipped:true},replace({...draft,rv:{element:context.selected,includeCrit:true,...draft.rv,mode:'prv'}},piece),catalog);
    return getBuildCurrentValue({rows:inBuild.rows,added:inBuild.titan||inBuild.augmented?inBuild.augments:[],
      types:catalog.reference.statTypes,growth:catalog.reference.titanGrowth,element:context.element,percentElements:context.percentElements,
      flatElements:context.role!=='tank'&&context.percentElements.length===2?context.percentElements:undefined,
      includeCrit:true,allowedTypes:catalog.gear.find(item=>item.id===slot)?.allowedStats??[],
      maxStats:catalog.reference.limits.maxNumOfRandomStats,maxRolls:catalog.reference.limits.maxNumOfRandomStatRolls,
      profile,inheritFrom:context.inheritFrom,role:context.role});
  };
  const alteredProfiles=context.inheritFrom?alteredAttackSources(catalog.reference).flatMap(source=>{
    const sourceContext={...context,inheritFrom:source,percentElements:[source]};
    const removed=gearRVRemovedStats(current,draft,catalog,sourceContext);
    const profile=removed?personalRVProfile(draft,catalog,source,removed):null;
    const ownRemoved=current.equipped?equippedGearStats(current,catalog).filter(row=>row.type==='Altered Attack').reduce((sum,row)=>sum+row.value,0):0;
    return profile?[{source,context:sourceContext,profile:{...profile,damagePercent:draft.combat.elements.find(element=>element.id==='Altered')?.damage??0,postPercentAttack:(profile.postPercentAttack??0)+Math.max(0,(elementTotalAttack(draft,catalog,'Altered').ownAdded??0)-ownRemoved)},contribution:slotContribution(draft,catalog,slot,sourceContext)}]:[];
  }):[];
  const output=(piece:GearDraft|null)=>{
    if(alteredProfiles.length)return alteredProfiles.map(({source,profile,contribution})=>{
      const types=getBuildRatedFamilies('Altered',[source],true,catalog.reference.titanGrowth,source,context.role).flat();
      const stats=(piece?contribution(piece):[]).filter(row=>types.includes(row.type));
      return getBuildRVFactors(stats,profile,'Altered',source,context.role);
    }).reduce((best,factors)=>factors[0].value>best[0].value?factors:best);
    const stats=piece?contribution(piece):[];
    const entries=getBuildCurrentValue({rows:stats,added:[],types:catalog.reference.statTypes,growth:catalog.reference.titanGrowth,
      element:context.element,percentElements:context.percentElements,includeCrit:true,allowedTypes:catalog.gear.find(item=>item.id===slot)?.allowedStats??[],maxStats:catalog.reference.limits.maxNumOfRandomStats,
      maxRolls:catalog.reference.limits.maxNumOfRandomStatRolls,profile,inheritFrom:context.inheritFrom,role:context.role}).entries;
    const factors=getBuildRVFactors(entries,profile,context.element,context.inheritFrom,context.role);
    if(!pairBases.length)return factors;
    const attack=Math.max(...pairBases.map(base=>base.value!+stats.reduce((sum,row)=>sum+(
      row.type===base.element+' Attack'||row.type==='Attack'&&catalog.reference.titanGrowth.universalAttackElements.includes(base.element)?row.value:0),0)));
    const support=supportAttack(draft,catalog,context.element);
    const percent=factors.find(factor=>factor.id==='attackPercent')?.value??1;
    return factors.map(factor=>factor.id==='attack'?{...factor,value:attack+support+(profile.postPercentAttack??0)/percent}:factor);
  };
  const baseline=output(current.equipped?current:null);
  // Each factor also carries its value with the candidate and with the equipped piece, for absolute deltas in Compare.
  const compare=(piece:GearDraft)=>{
    const candidate=output(piece),result=compareBuildOutputFactors(candidate,baseline);
    return {...result,factors:result.factors.map(factor=>({...factor,value:candidate.find(item=>item.id===factor.id)!.value,reference:baseline.find(item=>item.id===factor.id)!.value}))};
  };
  return {current,profile,context,rate,compare};
}

/** Adjust captured/manual combat totals without touching the real session or the capture provenance. */
export function applyGearSwap(draft:BuildDraft,catalog:BuildCatalog,slot:string,piece:GearDraft):BuildDraft|null {
  if(piece.id!==slot||!slotComparison(draft,catalog,slot))return null;
  return applyComparedGearSwap(draft,catalog,slot,piece);
}

/** Internal path after the caller has validated this build/slot once for all its candidates. */
function applyComparedGearSwap(draft:BuildDraft,catalog:BuildCatalog,slot:string,piece:GearDraft):BuildDraft {
  draft=buildCombatDraft(draft,catalog);
  const current=draft.gear.find(gear=>gear.id===slot)!;
  const context=rollValueContext(draft,catalog),loadout=replace(draft,piece);
  const delta=(selected:RollValueContext)=>{
    const contribution=slotContribution(draft,catalog,slot,selected);
    const added=contribution(piece),removed=current.equipped?contribution(current):[];
    return (types:readonly string[])=>added.filter(row=>types.includes(row.type)).reduce((sum,row)=>sum+row.value,0)
      -removed.filter(row=>types.includes(row.type)).reduce((sum,row)=>sum+row.value,0);
  };
  const common=delta(context),hpPercent=draft.combat.hpPercent??gearPercentTotal(draft,['HP %']);
  const nextHpPercent=hpPercent+common(['HP %']);
  return {...loadout,combat:{...draft.combat,damageSource:'totals',
    hp:(draft.combat.hp/(1+hpPercent)+common(['HP']))*(1+nextHpPercent),hpPercent:nextHpPercent,
    crit:Math.max(0,draft.combat.crit+common(['Crit'])),additionalCritRate:Math.max(0,draft.combat.additionalCritRate+common(['Crit Rate %'])),
    elements:draft.combat.elements.map(element=>{
      const percentElements=context.percentElements.includes(element.id)&&context.percentElements.length===2?context.percentElements:[element.id];
      const change=delta({...context,element:element.id,selected:element.id,inheritFrom:undefined,percentElements});
      const percentType=percentElements[0]!;
      const pool=elementResistanceBase(draft,element.id,catalog);
      const resistancePercent=pool?pool.percent+change([element.id+' Resistance %','Resistance %']):element.resistancePercent;
      return {...element,
        attack:element.attack+change([element.id+' Attack',...(catalog.reference.titanGrowth.universalAttackElements.includes(element.id)?['Attack']:[])]),
        attackPercent:element.attackPercent===undefined?undefined:element.attackPercent+change([percentType+' Attack %']),
        damage:element.damage+gearElementStat(loadout,catalog,element.id,'Damage %')-gearElementStat(draft,catalog,element.id,'Damage %'),
        resistance:pool?(pool.base+change(['Resistance',element.id+' Resistance']))*(1+resistancePercent!):element.resistance,
        resistancePercent};
    })}};
}

export type WhatIfChange={kind:'swap';pieceKey:string;forecast?:boolean;allowTransfer?:boolean;/** The worn donor at activation, so a second forecast matches its comparison preview. */donor?:GearDraft}|{kind:'forecast'};
export type WhatIfFailure=Exclude<ProjectionReason,null>|'comparison'|'missing';
/** Resolve from the real build every time; changing a slot never stacks or mutates inventory. */
/**
 * Output change of the temporary build against the real one: each changed slot is compared in turn against the
 * build with the earlier replacements applied, and the relative gains compound. Null when a slot cannot be compared.
 */
export function temporaryOutputGain(real:BuildDraft,temporary:BuildDraft,changed:ReadonlySet<string>,catalog:BuildCatalog):number|null {
  let current=real,total=1;
  for(const slot of changed) {
    const next=temporary.gear.find(gear=>gear.id===slot);
    const result=next?slotComparison(current,catalog,slot)?.compare(next):null;
    if(!next||!result||!Number.isFinite(result.gain))return null;
    total*=1+result.gain;
    current={...current,gear:current.gear.map(gear=>gear.id===slot?next:gear)};
  }
  return total-1;
}

export function resolveWhatIf(real:BuildDraft,inventory:readonly InventoryPiece[],changes:Readonly<Record<string,WhatIfChange>>,catalog:BuildCatalog,target:number,selections:Record<string,string[]>={}) {
  let draft=real;
  const changed=new Set<string>(),failed:Record<string,WhatIfFailure>={},worn:InventoryPiece[]=[];
  const byKey=new Map(inventory.map(piece=>[piece.key,piece]));
  for(const slot of real.gear.map(gear=>gear.id)) {
    const change=changes[slot];if(!change)continue;
    const original=real.gear.find(gear=>gear.id===slot)!;
    // Selecting the real equipped item is equivalent to reverting this slot.
    if(change.kind==='swap'&&change.pieceKey===`equipped-${slot}`)continue;
    const source=change.kind==='swap'?byKey.get(change.pieceKey):{key:`equipped-${slot}`,gear:original};
    if(!source||source.gear.id!==slot||change.kind==='forecast'&&!original.equipped){failed[slot]='missing';continue;}
    let gear=source.gear;
    if(change.kind==='forecast'||change.forecast) {
      const comparison=slotComparison(draft,catalog,slot);
      if(!comparison){failed[slot]='comparison';continue;}
      const projection=projectGear(gear,change.kind==='forecast'?gear:change.donor??original,catalog,target,
        candidate=>comparison.compare(candidate).gain,selections[source.key],change.kind==='swap'&&change.allowTransfer!==false);
      if(!projection.gear){failed[slot]=projection.reason??'comparison';continue;}
      if(matureTitan(gear)&&comparison.compare(projection.gear).gain<=comparison.compare(gear).gain+1e-12){failed[slot]='comparison';continue;}
      gear=projection.gear;
    }
    const next=applyGearSwap(draft,catalog,slot,gear);
    if(!next){failed[slot]='comparison';continue;}
    draft=next;changed.add(slot);
    if(change.kind==='swap')worn.push({...source,gear:{...gear,equipped:true}});
  }
  for(const slot of Object.keys(changes))if(!real.gear.some(gear=>gear.id===slot))failed[slot]='missing';
  const wornKeys=new Set(worn.map(piece=>piece.key));
  const pool=inventory.filter(piece=>!wornKeys.has(piece.key));
  for(const piece of worn) {
    const original=real.gear.find(gear=>gear.id===piece.gear.id)!;
    if(original.equipped)pool.push({key:`equipped-${original.id}`,gear:{...original,equipped:false}});
  }
  return {draft,pool,worn,changed,failed};
}

/** Legal lower-stat PAIRS, including the priority-fill rule, not two independent dropdown pools. */
function lowerPairs(rows:GearDraft['rows'],catalog:BuildCatalog,primary:number) {
  const pools=getBuildAugmentPools(rows,catalog.reference.titanGrowth,primary);
  const count=catalog.reference.limits.maxNumOfAugmentStats;
  const pool=[...new Set([...pools.priority,...pools.fallback])];
  const required=Math.min(count,pools.priority.length);
  const choose=(start:number,selected:string[]):string[][]=>selected.length===count
    ?selected.filter(type=>pools.priority.includes(type)).length>=required?[selected]:[]
    :pool.flatMap((type,index)=>index>=start?choose(index+1,[...selected,type]):[]);
  return choose(0,[]);
}

/** Forecast uses the recipient's own pre-Titan rolls. Clicks/effect can travel; rolled stat values cannot. */
export function projectGear(piece:GearDraft,donor:GearDraft,catalog:BuildCatalog,target:number,score:(gear:GearDraft)=>number,selected?:string[],allowTransfer=true):GearProjection {
  if(!allowTransfer)donor=piece;
  const originals={...piece,equipped:true,rows:piece.rows.map(row=>({...row,beforeTitan:piece.titan||piece.augmented?row.beforeTitan:row.value}))};
  const maximums=titanMaximums(originals,catalog);
  const mature=matureTitan(piece);
  const kind:ProjectionKind=mature?'headroom':allowTransfer&&donor.id===piece.id&&(donor.titan||donor.augmented)?'transfer':'augment';
  const fail=(reason:ProjectionReason):GearProjection=>({gear:null,kind,reason,choices:[],maximums,options:[]});
  if(originals.rows.some(row=>row.beforeTitan===null))return fail('originals');
  if(piece.stars!==catalog.reference.limits.maxNumOfRandomStatRolls||!analyzeGear(originals,catalog).combinations.length)return fail('stars');
  const primaries=getBuildTitanPrimaries(originals.rows,catalog.reference.statTypes);
  if(primaries.length!==1||maximums.random.some(value=>value===null))return fail('primary');
  const projection=getBuildTitanProjection(originals.rows,catalog.reference.statTypes,catalog.reference.titanGrowth,primaries[0]!);
  const choices=lowerPairs(originals.rows,catalog,primaries[0]!);
  if(!choices.length)return fail('pool');
  const fraction=titanTarget(target)/100;
  const make=(types:string[]):GearDraft=>({...originals,titan:true,augmented:true,
    enhancement:mature?piece.enhancement:Math.max(piece.enhancement,donor.enhancement),
    // Counts do not establish a deterministic stat-growth curve or reroll probability.
    augmentCount:mature?piece.augmentCount:donor.titan||donor.augmented?donor.augmentCount:piece.augmentCount,
    rareId:mature?piece.rareId:donor.rareId||piece.rareId,rareLevel:mature?piece.rareLevel:donor.rareId?donor.rareLevel:piece.rareLevel,
    rows:originals.rows.map((row,index)=>({...row,value:mature?piece.rows[index]!.value:Math.max(row.beforeTitan!,maximums.random[index]!*fraction)})),
    augments:types.map(type=>({type,value:projection.added(type)!*fraction}))});
  const legal=selected&&choices.find(pair=>pair.length===selected.length&&pair.every(type=>selected.includes(type)));
  // Every legal pair is scored once: the list of alternatives in Compare and the default best pair.
  const options=choices.map(pair=>{const gear=make(pair);return {pair,gear,values:gear.augments.map(stat=>stat.value),gain:score(gear)};});
  let bestOption=legal?options.find(option=>option.pair.every(type=>legal.includes(type)))!:options[0]!;
  if(!legal)for(const option of options.slice(1))if(option.gain>bestOption.gain+1e-12)bestOption=option;
  const best=bestOption.gear;
  const listed=options.map(({pair,values,gain})=>({pair,values,gain})).sort((a,b)=>b.gain-a.gain);
  const changed=best.augments.some(stat=>!piece.augments.some(old=>old.type===stat.type));
  // A developed item's existing values stay actual. Only a beneficial change of lower-stat types is forecast.
  if(mature&&(!changed||!legal&&bestOption.gain<=score(piece)+1e-12))return {...fail(null),choices,options:listed};
  return {gear:best,kind:mature?'reroll':kind,reason:null,choices,options:listed,
    maximums:{random:maximums.random,added:best.augments.map(stat=>projection.added(stat.type))}};
}

/**
 * The same piece before Titan / augmentation: its recorded pre-Titan random values, the normal stage, no added stats
 * or rare effect. Null for a plain piece or when any pre-Titan value is unknown.
 */
export function gearBeforeTitan(gear:GearDraft):GearDraft|null {
  if(!gear.titan&&!gear.augmented||gear.rows.some(row=>row.type&&row.beforeTitan===null))return null;
  return {...gear,titan:false,augmented:false,augments:[],rareId:'',rareLevel:0,augmentCount:null,rows:gear.rows.map(row=>({...row,value:row.beforeTitan??row.value}))};
}

export type OutputComparison=NonNullable<ReturnType<typeof slotComparison>>['compare'] extends (piece:GearDraft)=>infer R?R:never;
export interface RankedPiece {
  piece:InventoryPiece;current:GearDraft;now:OutputComparison|null;
  forecast:OutputComparison|null;projection:GearProjection;
  nowPrv:number|null;forecastPrv:number|null;ratedTypes:string[];gain:number|null;profile:BuildRVProfile|null;
  /** A developed piece as it was before Titan, compared like the piece itself (not part of the headline gain). */
  before:{gear:GearDraft;prv:number|null;gain:number|null}|null;
  /** The slot's PRV ceiling (same for every state of the piece): grades the PRV colour like Build's GRV badge. */
  prvMaximum:number;
}
/** Inventory restriction: every piece, or only mature Titan pieces (Aug > 120). */
export type UpgradeStage='all'|'mature';
export const reachesStage=(gear:GearDraft,stage:UpgradeStage)=>stage==='all'||!!matureTitan(gear);

export function rankInventory(pieces:readonly InventoryPiece[],draft:BuildDraft,catalog:BuildCatalog,target:number,selections:Record<string,string[]>={},options:{stage?:UpgradeStage}={}) {
  const context=rollValueContext(draft,catalog);
  const stage=options.stage??'all';
  const slots=new Map<string,ReturnType<typeof slotComparison>>();
  return pieces.filter(piece=>reachesStage(piece.gear,stage)).map((piece):RankedPiece=>{
    if(!slots.has(piece.gear.id))slots.set(piece.gear.id,slotComparison(draft,catalog,piece.gear.id,context));
    const comparison=slots.get(piece.gear.id);
    const current=comparison?.current??draft.gear.find(gear=>gear.id===piece.gear.id)??piece.gear;
    const now=comparison?.compare(piece.gear)??null;
    const comparisons=new Map<GearDraft,OutputComparison|null>([[piece.gear,now]]);
    const compare=(gear:GearDraft)=>{
      if(!comparisons.has(gear))comparisons.set(gear,comparison?.compare(gear)??null);
      return comparisons.get(gear)!;
    };
    const projection=projectGear(piece.gear,current,catalog,target,gear=>compare(gear)?.gain??0,selections[piece.key],stage==='all');
    const forecast=projection.gear?compare(projection.gear):null;
    const actualScore=comparison?.rate(piece.gear);
    const score=projection.gear?comparison?.rate(projection.gear):actualScore;
    const base=gearBeforeTitan(piece.gear);
    const before=base?{gear:base,prv:comparison?.rate(base).value??null,gain:comparison?.compare(base).gain??null}:null;
    const gains=[now?.gain,forecast?.gain].filter((gain):gain is number=>gain!==undefined&&Number.isFinite(gain));
    return {piece,current,now,forecast,projection,nowPrv:actualScore?.value??null,prvMaximum:actualScore?.maximum??0,forecastPrv:projection.gear?score?.value??null:null,
      ratedTypes:score?.entries.map(entry=>entry.type)??[],gain:gains.length?Math.max(...gains):null,profile:comparison?.profile??null,before};
  }).sort((a,b)=>(b.gain??-Infinity)-(a.gain??-Infinity)||a.piece.key.localeCompare(b.piece.key));
}

export interface LoadoutPotential {
  current:number|null;
  maximum:number;
  best:number|null;
  bestMaximum:number;
  gain:number|null;
  changedSlots:number;
  evaluated:number;
}

type LoadoutOption={key:string;gear:GearDraft|null;changed:boolean};
type LoadoutState={draft:BuildDraft;value:number;maximum:number;path:string[];changedSlots:number};
const LOADOUT_BEAM_WIDTH=24;

/**
 * Search complete builds, re-scoring every gear choice against the currently assembled loadout.
 * The beam bounds work for large backpacks; each slot still considers every piece and legal Aug pair.
 */
export function optimizeLoadout(pieces:readonly InventoryPiece[],draft:BuildDraft,catalog:BuildCatalog,target:number,
  options:{stage?:UpgradeStage;mode?:'prv'|'grv';selected?:string}={}):LoadoutPotential {
  const stage=options.stage??'all',mode=options.mode??draft.rv?.mode??'prv';
  const context=rollValueContext(draft,catalog),selected=options.selected??context.selected;
  const score=(build:BuildDraft)=>buildRollValue({...buildCombatDraft(build,catalog),rv:{...build.rv,element:selected,includeCrit:true,mode}},catalog);
  const initial=score(draft),current=initial.value;
  if(current===null)return {current:null,maximum:initial.maximum,best:null,bestMaximum:initial.maximum,gain:null,changedSlots:0,evaluated:0};
  let evaluated=0;
  let baseline:LoadoutState={draft,value:current,maximum:initial.maximum,path:[],changedSlots:0};
  let beam:LoadoutState[]=[baseline];
  const slots=draft.gear.map(gear=>gear.id);

  for(const slot of slots) {
    const worn=draft.gear.find(gear=>gear.id===slot)!;
    const slotPieces=pieces.filter(piece=>piece.gear.id===slot&&reachesStage(piece.gear,stage));
    const choices:LoadoutOption[]=[];
    const seen=new Set<string>();
    const add=(key:string,gear:GearDraft,changed:boolean)=>{
      const signature=`${slot}:${gear.enhancement}:${gear.stars}:${gear.titan}:${gear.augmented}:${gear.rows.map(row=>`${row.type}:${row.value}:${row.beforeTitan}`).join(',')}:${gear.augments.map(row=>`${row.type}:${row.value}`).join(',')}:${gear.rareId}:${gear.rareLevel}`;
      if(seen.has(signature))return;
      seen.add(signature);choices.push({key,gear:{...gear,equipped:false},changed});
    };
    if(worn.equipped)add(`equipped-${slot}`,worn,false);
    else choices.push({key:`empty-${slot}`,gear:null,changed:false});
    for(const piece of slotPieces)add(piece.key,piece.gear,true);

    // Generate every legal target pair once. The search scores these variants later in each full-build state.
    const projectionSources=[...(worn.equipped?[{key:`equipped-${slot}`,gear:worn}]:[]),...slotPieces];
    const sourceSeen=new Set<string>();
    for(const source of projectionSources) {
      const before=source.gear;
      const sourceKey=`${source.key}:${before.titan}:${before.augmented}:${before.augmentCount}:${before.augments.map(row=>row.type).join(',')}`;
      if(sourceSeen.has(sourceKey))continue;
      sourceSeen.add(sourceKey);
      const variants:GearDraft[]=[];
      const projection=projectGear(before,worn,catalog,target,gear=>{variants.push(gear);return 0;},undefined,stage==='all');
      if(projection.gear)variants.push(projection.gear);
      variants.forEach((gear,index)=>add(`${source.key}:target:${index}`,gear,true));
    }

    const stay=choices.find(choice=>!choice.changed)!;
    baseline={...baseline,path:[...baseline.path,stay.key]};

    const next:LoadoutState[]=[];
    for(const state of beam) {
      const canSwap=!!slotComparison(state.draft,catalog,slot);
      for(const choice of choices) {
        if(choice.changed&&!canSwap)continue;
        const swapped=choice.changed&&choice.gear?applyComparedGearSwap(state.draft,catalog,slot,choice.gear):state.draft;
        const result=choice.changed?score(swapped):{value:state.value,maximum:state.maximum};if(choice.changed)evaluated++;
        if(result.value===null)continue;
        next.push({draft:swapped,value:result.value,maximum:result.maximum,path:[...state.path,choice.key],changedSlots:state.changedSlots+(choice.changed?1:0)});
      }
    }
    if(!next.length)break;
    next.sort((a,b)=>b.value-a.value||a.changedSlots-b.changedSlots);
    const unique=new Set<string>([baseline.path.join('|')]);
    beam=[baseline];
    for(const state of next) {
      const key=state.path.join('|');if(unique.has(key))continue;
      unique.add(key);beam.push(state);
      if(beam.length===LOADOUT_BEAM_WIDTH)break;
    }
  }
  const best=beam.reduce((top,state)=>state.value>top.value+1e-9||Math.abs(state.value-top.value)<=1e-9&&state.changedSlots<top.changedSlots?state:top,beam[0]!);
  return {current,maximum:initial.maximum,best:best.value,bestMaximum:best.maximum,gain:best.value-current,changedSlots:best.changedSlots,evaluated};
}

/**
 * Top weights on the complete current build. Duo ATK%/DMG% follow the higher gear total; flat ATK follows the
 * inherited combat base without source support, so a roll of the other element only counts above that winning total:
 * `max(0, own + roll − winner)`. The strongest remaining roll is renormalized to 100 (2026-10-09).
 */
export function pairMarginalWeights<T extends {type:string;afterTitan:number;value:number|null;minAfterTitan?:number;minValue?:number|null}>(rows:readonly T[],draft:BuildDraft,catalog:BuildCatalog,context:RollValueContext=rollValueContext(draft,catalog)):T[] {
  if(context.inheritFrom||context.percentElements.length!==2)return [...rows];
  // The weight of one roll of `size` whose full-roll weight is `value`.
  const counted=(row:T,size:number,value:number|null|undefined)=>{
    for(const kind of ['Attack','Attack %','Damage %'] as const){
      const element=context.percentElements.find(id=>row.type===`${id} ${kind}`);
      if(!element||value===null||value===undefined||size<=0)continue;
      const total=(element:string)=>kind==='Attack'
        ?(draft.combat.elements.find(row=>row.id===element)?.attack??0)-supportAttack(draft,catalog,element)
        :gearElementStat(draft,catalog,element,kind);
      const counts=Math.min(size,Math.max(0,total(element)+size-Math.max(...context.percentElements.map(total))));
      return value*counts/size;
    }
    return value;
  };
  const scaled=rows.map(row=>({...row,value:counted(row,row.afterTitan,row.value),
    ...(row.minAfterTitan!==undefined?{minValue:counted(row,row.minAfterTitan,row.minValue)}:{})}));
  const top=Math.max(0,...scaled.map(row=>row.value??0));
  const norm=(value:number|null|undefined)=>value===null||value===undefined||top<=0?value:value*100/top;
  // Pair rows sit together (Frost ATK % next to Volt ATK %), ranked by the stronger one; the selected element first.
  const group=(type:string)=>(['Attack','Attack %','Damage %'] as const).find(kind=>context.percentElements.some(id=>type===`${id} ${kind}`))??type;
  const result=scaled.map(row=>({...row,value:norm(row.value),...(row.minAfterTitan!==undefined?{minValue:norm(row.minValue)}:{})}) as T);
  const best=new Map<string,number>();
  for(const row of result)best.set(group(row.type),Math.max(best.get(group(row.type))??-Infinity,row.value??0));
  const own=(type:string)=>context.percentElements.findIndex(id=>type.startsWith(`${id} `));
  return result.sort((a,b)=>best.get(group(b.type))!-best.get(group(a.type))!||group(a.type).localeCompare(group(b.type))||own(a.type)-own(b.type));
}
