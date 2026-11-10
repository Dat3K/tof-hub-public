import {getBuildCurrentValue,getBuildIdealItem,getBuildRollValue,type BuildRVProfile,type BuildRVRole,type BuildStatBounds,type BuildTitanGrowth,getBuildRVFactors,type BuildRVFactor} from './stats';

/**
 * Stored score track of a role: DPS keeps the plain element track (`Frost`, `Frost-Volt`), healer and tank prefix it
 * (`healer:Frost`, `tank:Frost`). A tank has no pair tracks: resistance is not inherited.
 */
export const roleTrackId=(role:BuildRVRole,track:string)=>role==='dps'?track:`${role}:${track}`;
export function parseRoleTrackId(id:string):{role:BuildRVRole;track:string} {
  const match=/^(healer|tank):(.+)$/.exec(id);
  return match?{role:match[1] as BuildRVRole,track:match[2]!}:{role:'dps',track:id};
}
export const roleTracks=(role:BuildRVRole,tracks:string[][])=>role==='tank'?tracks.filter(track=>track.length===1):tracks;

/**
 * Site reference player for Global Roll Value (an editorial assumption, not game data):
 * 52,500 flat ATK, +150% ATK, +50% DMG, 75% crit chance, +50% crit damage, enemy level 100.
 */
// Tank GRV (editorial): 2 500 000 HP with no HP% on top, 30 000 resistance before RES%, and as RES% one element's RES%
// stat with every roll at the maximum (`STANDARD_RV_RESISTANCE_PERCENT_ROLLS`, read from the stat catalog); the
// defence constant K is the game's at the reference level (resistanceFormula.constants[level]).
export const STANDARD_RV_PROFILE={id:'standard',version:7,enemyLevel:100,flatAttack:52500,attackPercent:1.5,damagePercent:.5,critChance:.75,critDamageBonus:.5,resistance:30000,hp:2500000,hpPercent:0} as const;
export const STANDARD_RV_RESISTANCE_PERCENT_ROLLS=5;

export interface GearScoreReference {
  statTypes:Record<string,BuildStatBounds>;
  titanGrowth:BuildTitanGrowth;
  critFormula:{denominators:Record<string,number>};
  limits:{maxNumOfRandomStats:number;maxNumOfRandomStatRolls:number};
  /** Defence constants by level (tank effective HP); optional for callers that never rate tanks. */
  resistanceFormula?:{constants:Record<string,number>};
}
export interface GearScoreInput {
  rows:{type:string;value:number;beforeTitan:number|null}[];
  stars:number;
  /** Augmented or Titan: random stats are rated from their values before Titan. */
  augmented:boolean;
  allowedTypes:string[];
}

/** Tank reference RES%: an elemental RES% stat at its initial value plus five maximum rolls (pre-Titan). */
export function standardResistancePercent(statTypes?:Record<string,BuildStatBounds>) {
  const bounds=statTypes&&Object.entries(statTypes).find(([type])=>/^\w+ Resistance %$/.test(type))?.[1];
  return bounds?bounds.randomStatDefaultValue+STANDARD_RV_RESISTANCE_PERCENT_ROLLS*bounds.randomStatMaxRollValue:0;
}
export function standardRVProfile(reference:Pick<GearScoreReference,'critFormula'>&Partial<Pick<GearScoreReference,'statTypes'|'resistanceFormula'>>,element?:string):BuildRVProfile {
  return {...STANDARD_RV_PROFILE,resistance:element==='Altered'?15000:STANDARD_RV_PROFILE.resistance,resistancePercent:element==='Altered'?.2:standardResistancePercent(reference.statTypes),
    resistanceConstant:reference.resistanceFormula?.constants[STANDARD_RV_PROFILE.enemyLevel],
    critDenominator:reference.critFormula.denominators[STANDARD_RV_PROFILE.enemyLevel]!};
}

/** Native ATK sources available in the generated catalog; a whole Altered build uses one source. */
export function alteredAttackSources(reference:GearScoreReference) {
  return reference.titanGrowth.universalAttackElements.filter(element=>element!=='Altered'&&reference.statTypes[element+' Attack']);
}
function bestAlteredScore<T extends {value:number|null}>(reference:GearScoreReference,score:(source:string)=>T) {
  return alteredAttackSources(reference).map(source=>({...score(source),inheritFrom:source}))
    .reduce((best,item)=>(item.value??0)>(best.value??0)+1e-9?item:best);
}

/**
 * GRV of one gear piece for an element track: a mono element (`['Frost']`) or an ordered pair (`['Frost','Volt']`),
 * where flat ATK, ATK% and DMG% each count their largest value in the pair. Same as Build GRV.
 */
export function scoreGearForTrack(gear:GearScoreInput,track:string[],reference:GearScoreReference,role:BuildRVRole='dps',inheritFrom?:string):{inheritFrom?:string;value:number|null;maximum:number;percent:number|null} {
  if(track[0]==='Altered'&&role!=='tank'&&!inheritFrom)return bestAlteredScore(reference,source=>scoreGearForTrack(gear,track,reference,role,source));
  const score=getBuildRollValue({rows:gear.rows.map(row=>({type:row.type,beforeTitan:gear.augmented?row.beforeTitan:row.value})),
    types:reference.statTypes,growth:reference.titanGrowth,element:track[0]!,inheritFrom,percentElements:inheritFrom?[inheritFrom]:track,flatElements:role!=='tank'&&track.length===2?track:undefined,includeCrit:true,
    profile:standardRVProfile(reference,track[0]),allowedTypes:gear.allowedTypes,stars:gear.stars,
    maxStats:reference.limits.maxNumOfRandomStats,maxRolls:reference.limits.maxNumOfRandomStatRolls,role});
  return {inheritFrom,value:score.value,maximum:score.maximum,percent:score.value===null||score.maximum<=0?null:score.value/score.maximum*100};
}

/** Mono tracks plus every ordered pair of a dual-element weapon or selectable dual form. */
export function elementTracks(elements:string[],weapons:{elements:string[];selectableElements?:{elements:string[]}[]}[]):string[][] {
  const pairs=new Map<string,string[]>();
  for(const weapon of weapons)for(const pair of [weapon.elements,...(weapon.selectableElements??[]).map(option=>option.elements)]) {
    if(pair.length===2)pairs.set(pair.join('-'),[...pair]);
  }
  return [...elements.map(element=>[element]),...pairs.values()];
}

export interface CurrentGearScoreInput {
  rows:{type:string;value:number}[];
  /** Stats added by Titan (EquipmentTupo), at their current values. */
  augments:{type:string;value:number}[];
  allowedTypes:string[];
}
/** GRV of the item as it is now, for ranking: same families and slot ceiling as scoreGearForTrack, no Titan projection. */
interface CurrentScoreContext {inheritFrom?:string;profile:BuildRVProfile;ceiling?:{maximum:number;normalization:number}}
export function scoreCurrentGearForTrack(gear:CurrentGearScoreInput,track:string[],reference:GearScoreReference,role:BuildRVRole='dps',context?:CurrentScoreContext):{inheritFrom?:string;value:number;maximum:number;percent:number|null;entries:ReturnType<typeof getBuildCurrentValue>['entries'];normalization:number} {
  const inheritFrom=context?.inheritFrom;
  if(track[0]==='Altered'&&role!=='tank'&&!inheritFrom)return bestAlteredScore(reference,source=>scoreCurrentGearForTrack(gear,track,reference,role,{profile:context?.profile??standardRVProfile(reference,track[0]),inheritFrom:source}));
  const score=getBuildCurrentValue({rows:gear.rows,added:gear.augments,types:reference.statTypes,growth:reference.titanGrowth,
    element:track[0]!,inheritFrom,percentElements:inheritFrom?[inheritFrom]:track,flatElements:role!=='tank'&&track.length===2?track:undefined,includeCrit:true,allowedTypes:gear.allowedTypes,
    maxStats:reference.limits.maxNumOfRandomStats,maxRolls:reference.limits.maxNumOfRandomStatRolls,profile:context?.profile??standardRVProfile(reference,track[0]),role,ceiling:context?.ceiling});
  return {inheritFrom,value:score.value,maximum:score.maximum,percent:score.maximum>0?score.value/score.maximum*100:null,entries:score.entries,normalization:score.normalization};
}

/** Batch-local reuse of slot ceilings. A new batch reads the reference again; item values are always recomputed. */
export function createCurrentGearScorer(reference:GearScoreReference,inheritFrom?:string):(gear:CurrentGearScoreInput,track:string[],role?:BuildRVRole)=>ReturnType<typeof scoreCurrentGearForTrack> {
  const alteredScorers=!inheritFrom?alteredAttackSources(reference).map(source=>({source,score:createCurrentGearScorer(reference,source)})):[];
  const ceilings=new Map<string,{maximum:number;normalization:number}>();
  return (gear:CurrentGearScoreInput,track:string[],role:BuildRVRole='dps')=>{
    if(track[0]==='Altered'&&role!=='tank'&&!inheritFrom)return alteredScorers.map(({source,score})=>({...score(gear,track,role),inheritFrom:source})).reduce((best,item)=>item.value>best.value+1e-9?item:best);
    const profile=standardRVProfile(reference,track[0]);
    const key=JSON.stringify([gear.allowedTypes,track,role]);
    let ceiling=ceilings.get(key);
    if(!ceiling) {
      const score=scoreCurrentGearForTrack({rows:[],augments:[],allowedTypes:gear.allowedTypes},track,reference,role,{profile,inheritFrom});
      ceiling={maximum:score.maximum,normalization:score.normalization};ceilings.set(key,ceiling);
    }
    return scoreCurrentGearForTrack(gear,track,reference,role,{profile,ceiling,inheritFrom});
  };
}

/**
 * Exact gain of item A over item B (2026-10-09, the "Gear Compare" sheet method): the standard profile wearing A's
 * counted stats against the same profile wearing B's, `output(A) / output(B) − 1` (getBuildRVFactors: damage for DPS,
 * ATK for healers, effective HP for tanks). Each item uses its own track; personal factors are the universal fighter's.
 * `factors` splits the gain by multiplicative factor (ATK, ATK %, DMG %, crit, ...): their (1 + gain) multiply to the total.
 */
export function compareCurrentGearForTrack(a:{gear:CurrentGearScoreInput;track:string[]},b:{gear:CurrentGearScoreInput;track:string[]},reference:GearScoreReference,role:BuildRVRole='dps') {
  const factors=(side:typeof a)=>{const score=scoreCurrentGearForTrack(side.gear,side.track,reference,role);return getBuildRVFactors(score.entries,standardRVProfile(reference,side.track[0]),side.track[0]!,score.inheritFrom,role);};
  const mine=factors(a),theirs=factors(b);
  return compareBuildOutputFactors(mine,theirs);
}

/** Exact multiplicative comparison, shared by global gear Ranking and personal replacement forecasts. */
export function compareBuildOutputFactors(candidate:readonly BuildRVFactor[],reference:readonly BuildRVFactor[]) {
  const factors=candidate.map(factor=>({id:factor.id,gain:factor.value/reference.find(item=>item.id===factor.id)!.value-1}));
  return {gain:factors.reduce((product,factor)=>product*(1+factor.gain),1)-1,factors};
}
/**
 * First-order gain between two GRV totals (players, 2026-10-09): GRV is 100 × the local weighted stat sum over `normalization`,
 * so totals on different tracks compare through `exp((V_A·N_A − V_B·N_B) / 100) − 1`. The profile already stands for a
 * whole build, so a build cannot be added to it exactly; this is the linear estimate of the same output.
 */
export function compareGrvTotals(a:{value:number;normalization:number},b:{value:number;normalization:number}) {
  return Math.exp((a.value*a.normalization-b.value*b.normalization)/100)-1;
}

/**
 * A whole duo build independently inherits the larger complete-set flat ATK, ATK% and DMG% total (2026-10-18).
 * The three sources can differ. Universal ATK counts once. A single item keeps its own best source.
 */
export type PairStatChoice={'Attack':string;'Attack %':string;'Damage %':string}|null;
const PAIR_KINDS=['Attack','Attack %','Damage %'] as const;
const excludedPairTypes=(track:string[],choice:NonNullable<PairStatChoice>)=>
  new Set(PAIR_KINDS.flatMap(kind=>track.filter(element=>element!==choice[kind]).map(element=>element+' '+kind)));
/** Drops only the unused native source of each kind; universal ATK is retained. */
export function restrictPairStats<T extends {type:string}>(stats:readonly T[],track:string[],choice:PairStatChoice):T[] {
  if(!choice)return [...stats];
  return stats.filter(stat=>!PAIR_KINDS.some(kind=>track.some(element=>element!==choice[kind]&&stat.type===element+' '+kind)));
}
/** The in-game choice for fixed gear: per kind the pair element with the higher gear total (ties: the first). */
export function pairStatChoice(total:(element:string,kind:typeof PAIR_KINDS[number])=>number,track:string[]):PairStatChoice {
  if(track.length<2)return null;
  const pick=(kind:typeof PAIR_KINDS[number])=>track.reduce((best,element)=>total(element,kind)>total(best,kind)+1e-12?element:best,track[0]!);
  return {'Attack':pick('Attack'),'Attack %':pick('Attack %'),'Damage %':pick('Damage %')};
}
/** Every coherent build context; standalone pieces may still use their own best source. */
export function pairStatChoices(track:string[]):PairStatChoice[] {
  return track.length===2?track.flatMap(flat=>track.flatMap(attack=>track.map(damage=>({'Attack':flat,'Attack %':attack,'Damage %':damage})))):[null];
}
const restrictInput=(gear:CurrentGearScoreInput,excluded:Set<string>|null):CurrentGearScoreInput=>
  excluded?{...gear,rows:gear.rows.filter(stat=>!excluded.has(stat.type)),augments:gear.augments.filter(stat=>!excluded.has(stat.type))}:gear;
/**
 * A whole build on a track from candidate pieces (several per slot allowed; the first wins a tie): per slot the best
 * piece, and on a pair track independent whole-set ATK, ATK% and DMG% sources. All eight combinations are tried;
 * a choice counts only when its elements really have the higher gear totals among the pieces it picks.
 */
export function scoreBuildForTrack<T>(pieces:readonly T[],slot:(piece:T)=>string,input:(piece:T)=>CurrentGearScoreInput|null,
  track:string[],reference:GearScoreReference,role:BuildRVRole='dps',inheritFrom?:string,scorerForSource?:(source?:string)=>ReturnType<typeof createCurrentGearScorer>) {
  const build=createBuildTrackAccumulator<T,undefined>(slot,input,track,reference,role,inheritFrom,scorerForSource);
  const scope=[undefined];
  for(const piece of pieces)build.add(piece,scope);
  return build.result(undefined);
}

/** Retain just the slot winners for each coherent choice, even when candidates arrive in pages.
 * A piece can contribute to multiple scopes with the same score (for example, global and regional).
 */
export function createBuildTrackAccumulator<T,Scope>(slot:(piece:T)=>string,input:(piece:T)=>CurrentGearScoreInput|null,
  track:string[],reference:GearScoreReference,role:BuildRVRole='dps',inheritFrom?:string,scorerForSource?:(source?:string)=>ReturnType<typeof createCurrentGearScorer>) {
  type Slot={piece:T;score:ReturnType<typeof scoreCurrentGearForTrack>};
  const choices=role==='tank'?[null]:pairStatChoices(track);
  const sources=track[0]==='Altered'&&role!=='tank'&&!inheritFrom?alteredAttackSources(reference):[inheritFrom];
  const profile=standardRVProfile(reference,track[0]);
  const candidates=sources.map(source=>{
    const shared=scorerForSource?.(source);
    const ceilings=new WeakMap<string[],{maximum:number;normalization:number}>();
    const scoreGear=(gear:CurrentGearScoreInput)=>{
      if(shared)return shared(gear,track,role);
      let ceiling=ceilings.get(gear.allowedTypes);
      if(!ceiling) {
        const {maximum,normalization}=scoreCurrentGearForTrack(
          {rows:[],augments:[],allowedTypes:gear.allowedTypes},track,reference,role,{profile,inheritFrom:source});
        ceiling={maximum,normalization};
        ceilings.set(gear.allowedTypes,ceiling);
      }
      return scoreCurrentGearForTrack(gear,track,reference,role,{profile,inheritFrom:source,ceiling});
    };
    return {source,scoreGear,choices:choices.map(choice=>({
      choice,excluded:choice?excludedPairTypes(track,choice):null,scopes:new Map<Scope,Map<string,Slot>>(),
    }))};
  });
  function add(piece:T,scopes:readonly Scope[]) {
    const gear=input(piece);
    if(!gear)return;
    const key=slot(piece);
    for(const {scoreGear,choices} of candidates)for(const {excluded,scopes:byScope} of choices) {
      const score=scoreGear(restrictInput(gear,excluded));
      for(const scope of scopes) {
        let slots=byScope.get(scope);
        if(!slots){slots=new Map();byScope.set(scope,slots);}
        const current=slots.get(key);
        if(!current||score.value>current.score.value+1e-9)slots.set(key,{piece,score});
      }
    }
  }
  function result(scope:Scope) {
    return candidates.map(({source,scoreGear,choices})=>{
      let best:{choice:PairStatChoice;excluded:Set<string>|null;slots:Map<string,Slot>;value:number;valid:boolean}|null=null;
      for(const {choice,excluded,scopes} of choices) {
        const slots=scopes.get(scope)??new Map<string,Slot>();
        const value=[...slots.values()].reduce((sum,entry)=>sum+entry.score.value,0);
        const picked=choice?[...slots.values()].map(entry=>input(entry.piece)!):[];
        const total=(element:string,kind:string)=>picked.reduce((sum,gear)=>sum+[...gear.rows,...gear.augments].filter(stat=>stat.type===element+' '+kind).reduce((v,stat)=>v+stat.value,0),0);
        const valid=!choice||JSON.stringify(pairStatChoice(total,track))===JSON.stringify(choice);
        if(!best||(valid&&!best.valid)||(valid===best.valid&&value>best.value+1e-9))best={choice,excluded,slots,value,valid};
      }
      const {choice,excluded,slots,value}=best!;
      return {inheritFrom:source,choice,slots,value,
        score:(gear:CurrentGearScoreInput)=>scoreGear(restrictInput(gear,excluded))};
    }).reduce((best,item)=>item.value>best.value+1e-9?item:best);
  }
  return {add,result};
}

/** The perfect item of a slot for a track (game-domain getBuildIdealItem) with the ranking' standard profile. */
export function idealGearForTrack(allowedTypes:string[],track:string[],reference:GearScoreReference,role:BuildRVRole='dps',rolledType?:string,inheritFrom=track[0]==='Altered'&&role!=='tank'?(rolledType?.endsWith(' Attack %')?rolledType.slice(0,-9):alteredAttackSources(reference)[0]):undefined) {
  return getBuildIdealItem({types:reference.statTypes,growth:reference.titanGrowth,element:track[0]!,inheritFrom,percentElements:inheritFrom?[inheritFrom]:track,flatElements:role!=='tank'&&track.length===2?track:undefined,includeCrit:true,
    allowedTypes,maxStats:reference.limits.maxNumOfRandomStats,maxRolls:reference.limits.maxNumOfRandomStatRolls,profile:standardRVProfile(reference,track[0]),role,rolledType});
}

/** All-track choice: Altered must improve actual gear points, not only its share of another ceiling.
 * At equal output prefer a native match, then mono over a pair. Within native tracks retain percentage ordering. */
export function preferScoringTrack(candidate:{track:string;percent:number;value?:number},current:{track:string;percent:number;value?:number}) {
  const altered=(track:string)=>track.replace(/^(healer|tank):/,'')==='Altered';
  const candidateAltered=altered(candidate.track),currentAltered=altered(current.track);
  if(candidateAltered!==currentAltered&&candidate.value!==undefined&&current.value!==undefined){
    const delta=candidate.value-current.value;
    if(Math.abs(delta)>1e-7)return delta>0;
    return !candidateAltered;
  }
  if(Math.abs(candidate.percent-current.percent)>1e-9)return candidate.percent>current.percent;
  if(candidateAltered!==currentAltered)return !candidateAltered;
  return !candidate.track.includes('-')&&current.track.includes('-');
}
