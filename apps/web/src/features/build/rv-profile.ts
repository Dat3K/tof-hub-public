import {getBuildCriticalRates,standardRVProfile as referenceRVProfile,STANDARD_RV_PROFILE,type BuildRVProfile} from '@tof-hub/game-domain';
import {estimatedResistancePercent,gearPercentTotal} from './resistance-stats';
export {estimatedResistancePercent,gearPercentTotal} from './resistance-stats';
import {applyConsumableStats} from './consumable-stats';
import type {BuildCatalog,BuildDraft} from './types';

// Editorial comparison baseline, shared with the API ranking scoring (game-domain build/gear-score.ts).
// Game coefficients, including the enemy-level denominator, remain pipeline data.
export {STANDARD_RV_PROFILE};
export function standardRVProfile(catalog:BuildCatalog,element?:string):BuildRVProfile {
  return referenceRVProfile(catalog.reference,element);
}

/**
 * An element's resistance before RES%: final RES / (1 + total RES%). The total comes from the advanced editor, else
 * from known gear, resonance, computing and account relic RES%, as for equipment CS pools (`estimated`).
 */
export function elementResistanceBase(draft:BuildDraft,element:string,catalog?:BuildCatalog) {
  if(catalog)draft=applyConsumableStats(draft,catalog);
  const stats=draft.combat.elements.find(item=>item.id===element);
  if(!stats||stats.resistance===null||!(stats.resistance>0))return null;
  const known=stats.resistancePercent!==null&&stats.resistancePercent!==undefined;
  const percent=known?stats.resistancePercent!:estimatedResistancePercent(draft,element,catalog);
  return {base:stats.resistance/(1+percent),percent,estimated:!known};
}

/**
 * The game rounds the captured crit totals and each item roll separately: one item's 3.66 % crit rate can exceed a
 * 3.65 % extra-crit total (2026-10-09). A removal within this rounding empties the total instead of rejecting the
 * profile; a larger excess still means inconsistent data and PRV stays unavailable.
 */
const CRIT_ROUNDING={rate:5e-4,rating:1};
export interface RVRemovedStats {flatAttack:number;attackPercent:number;damagePercent:number;critRating:number;critRate:number;resistance?:number;resistancePercent?:number;hp?:number;hpPercent?:number}
/** Undo the current item's contributions before constructing local personal weights. */
export function personalRVProfile(draft:BuildDraft,catalog:BuildCatalog,element:string,removed:RVRemovedStats={flatAttack:0,attackPercent:0,damagePercent:0,critRating:0,critRate:0}):BuildRVProfile|null {
  draft=applyConsumableStats(draft,catalog);
  const stats=draft.combat.elements.find(item=>item.id===element);
  const denominator=catalog.reference.critFormula.denominators[draft.enemyLevel];
  if(!stats||stats.attack<=0||stats.attackPercent===undefined||!denominator)return null;
  if(!Object.values(removed).every(value=>Number.isFinite(value)&&value>=0)||removed.critRating>draft.combat.crit+CRIT_ROUNDING.rating||removed.critRate>draft.combat.additionalCritRate+CRIT_ROUNDING.rate)return null;
  const rates=getBuildCriticalRates(Math.max(0,draft.combat.crit-removed.critRating),denominator,Math.max(0,draft.combat.additionalCritRate-removed.critRate));
  if(rates.total===null)return null;
  // Build stores the displayed base ATK before ATK%, including on capture import.
  // Remove flat and percentage contributions independently; never divide the base again.
  const profile={flatAttack:stats.attack-removed.flatAttack,postPercentAttack:draft.combat.consumableStatsApplied?.postPercentElementAttack?.[element]??0,attackPercent:stats.attackPercent-removed.attackPercent,damagePercent:stats.damage-removed.damagePercent,
    critChance:Math.min(1,rates.total),critDamageBonus:draft.combat.critDamage,critDenominator:denominator};
  // Tank PRV (effective HP): the selected element's resistance before RES% and its RES%, HP before HP% and HP%, and
  // the defence constant of the character level, all without this item.
  const pool=elementResistanceBase(draft,element,catalog);
  const resistance=pool?pool.base-(removed.resistance??0):undefined;
  const resistancePercent=pool?pool.percent-(removed.resistancePercent??0):undefined;
  const hpPercentTotal=draft.combat.hpPercent??gearPercentTotal(draft,['HP %']);
  const hp=draft.combat.hp>0?draft.combat.hp/(1+hpPercentTotal)-(removed.hp??0):undefined;
  const hpPercent=hpPercentTotal-(removed.hpPercent??0);
  const resistanceConstant=catalog.reference.resistanceFormula.constants[draft.profile.level];
  const tank=resistance!==undefined&&resistance>0&&resistancePercent!==undefined&&hp!==undefined&&hp>0&&resistanceConstant
    ?{resistance,resistancePercent:Math.max(0,resistancePercent),hp,hpPercent:Math.max(0,hpPercent),resistanceConstant}:{};
  return Object.values(profile).every(Number.isFinite)&&profile.flatAttack>0&&profile.attackPercent>=-1e-8&&profile.damagePercent>=-1e-8?{...profile,...tank,capCritContribution:true,attackPercent:Math.max(0,profile.attackPercent),damagePercent:Math.max(0,profile.damagePercent)}:null;
}
