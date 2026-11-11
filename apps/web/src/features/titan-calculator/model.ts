/**
 * Best-Titan calculator: removes the Titan worn during a parse from its damage table, then searches every legal
 * Titan level set for the highest damage. Game values (effect by summed level, per-slot pools, obtainable item level)
 * all come from the generated `handbook/titan.json`; see docs/tools/titan-calculator.md for sources and limits.
 */
import type {HandbookTitanData} from '@/features/datamine/contracts/handbook';
import {curveValue} from '@/features/datamine/handbook/handbook-domain';

export const TITAN_STATS={
  normal:'CommonAtkAggravatingInjury',
  dodge:'EvadeAtkAggravatingInjury',
  skill:'SkillAtkAggravatingInjury',
  discharge:'ChangeSkillAtkAggravatingInjury',
  dmgBoost:'CommonAggravatingInjury',
  weakPoint:'CommonWeaknessIncreaseInjury',
} as const;
export type TitanStat=keyof typeof TITAN_STATS;
export const TITAN_STAT_KEYS=Object.keys(TITAN_STATS) as TitanStat[];
export type TitanLevels=Record<TitanStat,number>;
export const NO_TITAN:TitanLevels={normal:0,dodge:0,skill:0,discharge:0,dmgBoost:0,weakPoint:0};
export const titanStatsByLevel=(levels:TitanLevels)=>[...TITAN_STAT_KEYS].sort((a,b)=>levels[b]-levels[a]);
export const isTitanLevel=(level:number,limit:number)=>Number.isInteger(level)&&level>=0&&level<=limit;

/** Rows of the in-game damage table, in on-screen order. */
export const DAMAGE_CATEGORIES=['normal','dodge','discharge','passive','skill'] as const;
export type DamageCategory=typeof DAMAGE_CATEGORIES[number];
export type DamageVector=Record<DamageCategory,number>;

export function sumDamage(damage: DamageVector): number {
  return DAMAGE_CATEGORIES.reduce((total, category) => total + damage[category], 0);
}

export interface TitanOptions {
  /** The hit actually receives the Weak Point bonus. */
  weakPoint:boolean;
}

export interface TitanCandidate {levels:TitanLevels;assignment:Record<string,TitanStat>}
export interface TitanSlot {slot:string;options:{stat:TitanStat;level:number;obtainable:number[]}[]}
export interface TitanModel {
  /** Effect fraction by summed level; index 0 is the absent property. */
  effects:Record<TitanStat,number[]>;
  maxLevel:number;
  slots:TitanSlot[];
  candidates:TitanCandidate[];
}

const STAT_BY_ID=new Map<string,TitanStat>(TITAN_STAT_KEYS.map(stat=>[TITAN_STATS[stat],stat]));
const levelKey=(levels:TitanLevels)=>TITAN_STAT_KEYS.map(stat=>levels[stat]).join(',');

/** Every distinct total level set, keeping one item assignment for each: moving a stat between items changes nothing. */
function enumerateCandidates(slots:TitanSlot[]):TitanCandidate[] {
  let layer=new Map<string,TitanCandidate>([[levelKey(NO_TITAN),{levels:NO_TITAN,assignment:{}}]]);
  for(const {slot,options} of slots) {
    const next=new Map<string,TitanCandidate>();
    for(const candidate of layer.values()) for(const {stat,level} of options) {
      const levels={...candidate.levels,[stat]:candidate.levels[stat]+level};
      const key=levelKey(levels);
      if(!next.has(key))next.set(key,{levels,assignment:{...candidate.assignment,[slot]:stat}});
    }
    layer=next;
  }
  return [...layer.values()];
}

/** Null when generated data lacks a required curve or slot pool: the page then shows an unavailable state. */
export function buildTitanModel(data:HandbookTitanData):TitanModel|null {
  const maxLevel=data.rareValueLevelLimit;
  const effects={} as Record<TitanStat,number[]>;
  for(const stat of TITAN_STAT_KEYS) {
    const values=data.rareValues.find(item=>item.id===TITAN_STATS[stat])?.values;
    if(!values?.length)return null;
    const curve=[0];
    // The generated curve stores only its keys; levels between them are interpolated as in the game.
    for(let level=1;level<=maxLevel;level++)curve.push(curveValue(values,level)!);
    effects[stat]=curve;
  }
  const slots:TitanSlot[]=[];
  for(const pool of data.pools) {
    const options=pool.properties.flatMap(property=>{
      const stat=STAT_BY_ID.get(property.id);
      if(!stat)return [];
      // Levels listed with weight 0 (+4/+5) exist in the table but cannot be rolled.
      const obtainable=property.levels.filter(entry=>entry.weight>0&&entry.level>0).map(entry=>entry.level).sort((a,b)=>b-a);
      return obtainable.length?[{stat,level:obtainable[0]!,obtainable}]:[];
    });
    if(!options.length)return null;
    slots.push({slot:pool.slot,options});
  }
  return slots.length?{effects,maxLevel,slots,candidates:enumerateCandidates(slots)}:null;
}

/** Summed level → effect. Curves are constant past their last key, as the game's SimpleCurve. */
export function titanEffect(model:Pick<TitanModel,'effects'>,stat:TitanStat,level:number) {
  const curve=model.effects[stat];
  return curve[Math.max(0,Math.min(curve.length-1,Math.floor(level)))]!;
}

/** The single place that defines how Titan bonuses combine for one damage category. */
export function categoryMultiplier(category:DamageCategory,levels:TitanLevels,model:Pick<TitanModel,'effects'>,options:TitanOptions) {
  const own=category==='passive'?0:titanEffect(model,category,levels[category]);
  const boost=titanEffect(model,'dmgBoost',levels.dmgBoost);
  const weak=options.weakPoint?titanEffect(model,'weakPoint',levels.weakPoint):0;
  // Multiplying is the owner's working assumption; the in-game formula is not confirmed.
  return (1+own)*(1+boost)*(1+weak);
}

export function removeTitan(parse:DamageVector,levels:TitanLevels,model:Pick<TitanModel,'effects'>,options:TitanOptions):DamageVector {
  const clean={} as DamageVector;
  for(const category of DAMAGE_CATEGORIES)clean[category]=parse[category]/categoryMultiplier(category,levels,model,options);
  return clean;
}

export function damageWithTitan(clean:DamageVector,levels:TitanLevels,model:Pick<TitanModel,'effects'>,options:TitanOptions) {
  return DAMAGE_CATEGORIES.reduce((total,category)=>total+clean[category]*categoryMultiplier(category,levels,model,options),0);
}

export function damageByTypeWithTitan(clean:DamageVector,levels:TitanLevels,model:Pick<TitanModel,'effects'>,options:TitanOptions):DamageVector {
  const projected={} as DamageVector;
  for(const category of DAMAGE_CATEGORIES)projected[category]=clean[category]*categoryMultiplier(category,levels,model,options);
  return projected;
}

export interface RankedTitan extends TitanCandidate {damage:number}
export interface TitanChoice {rank:number|null; custom:TitanLevels|null}

export function editedTitanLevels(choice:TitanChoice, ranked:readonly RankedTitan[]) {
  const base=ranked[choice.rank??0]??ranked[0];
  const {custom}=choice;
  return custom&&base&&TITAN_STAT_KEYS.some(stat=>custom[stat]!==base.levels[stat])?custom:null;
}

/** Best level sets first. Without Weak Point its levels only waste items, so those sets are left out. */
export function rankTitans(clean:DamageVector,model:TitanModel,options:TitanOptions,limit=5):RankedTitan[] {
  const pool=options.weakPoint?model.candidates:model.candidates.filter(candidate=>candidate.levels.weakPoint===0);
  return pool
    .map(candidate=>({...candidate,damage:damageWithTitan(clean,candidate.levels,model,options)}))
    .sort((a,b)=>b.damage-a.damage||levelKey(a.levels).localeCompare(levelKey(b.levels)))
    .slice(0,limit);
}

export type TitanAssignment = Partial<Record<string, { stat: TitanStat; level: number }>>;

/** Find a legal slot assignment, allowing empty slots and rolls below the item maximum. */
export function assignTitanLevels(levels:TitanLevels,model:TitanModel):TitanAssignment|null {
  if(!TITAN_STAT_KEYS.every(stat=>isTitanLevel(levels[stat],model.maxLevel)))return null;
  const total=TITAN_STAT_KEYS.reduce((sum,stat)=>sum+levels[stat],0);
  if(!total)return {};
  // Any possible set can be extended to a max-level set with at least these totals.
  if(!model.candidates.some(candidate=>TITAN_STAT_KEYS.every(stat=>candidate.levels[stat]>=levels[stat])))return null;

  const remaining={...levels};
  const missed=new Set<string>();
  const assignment:TitanAssignment={};
  function fits(slotIndex:number,unassigned:number):boolean {
    if(!unassigned)return true;
    const slot=model.slots[slotIndex];
    if(!slot)return false;
    const key=`${slotIndex}/${levelKey(remaining)}`;
    if(missed.has(key))return false;
    for(const {stat,obtainable} of slot.options)for(const level of obtainable) {
      if(level>remaining[stat])continue;
      remaining[stat]-=level;
      if(fits(slotIndex+1,unassigned-level)) {
        assignment[slot.slot]={stat,level};
        return true;
      }
      remaining[stat]+=level;
    }
    if(fits(slotIndex+1,unassigned))return true;
    missed.add(key);
    return false;
  }
  return fits(0,total)?assignment:null;
}

export function isLegalTitan(levels:TitanLevels,model:TitanModel) {
  return assignTitanLevels(levels,model)!==null;
}

/** Summed Titan levels of a saved Build draft; null for anything that does not look like one. */
export function draftTitanLevels(value:unknown):TitanLevels|null {
  const gear=(value as {gear?:unknown}|null)?.gear;
  if(!Array.isArray(gear))return null;
  const levels={...NO_TITAN};
  for(const item of gear as {titan?:unknown;rareId?:unknown;rareLevel?:unknown}[]) {
    const stat=typeof item?.rareId==='string'?STAT_BY_ID.get(item.rareId):undefined;
    if(stat&&item.titan&&typeof item.rareLevel==='number'&&item.rareLevel>0)levels[stat]+=item.rareLevel;
  }
  return levels;
}
