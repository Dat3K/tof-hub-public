import {activeWeaponResonances} from './weapon-resonances';
import type {BuildCatalog,BuildDraft} from './types';

/**
 * An element's RES% when the card has no entered total: the equipped gear's RES% (element + general), the active
 * elemental weapon resonance (e.g. Frost Resonance +25%, pipeline `resonances[].resistancePercent`) and Supercomputing
 * resistance effects (e.g. All resistances +6%).
 */
export function estimatedResistancePercent(draft:BuildDraft,element:string,catalog?:BuildCatalog) {
  const types=[element+' Resistance %','Resistance %'];
  const resonance=catalog?activeWeaponResonances(draft,catalog).filter(item=>item.element===element).reduce((sum,item)=>sum+(item.resistancePercent??0),0):0;
  // Supercomputing nodes with a resistance effect (e.g. "All resistances" +6%) at their current level.
  const computing=catalog?draft.computing.reduce((sum,node)=>sum+(catalog.computing.find(item=>item.id===node.id)?.effects
    .filter(effect=>effect.resistanceStat&&types.includes(effect.resistanceStat))
    .reduce((total,effect)=>total+(effect.levels.find(level=>level.level===node.level)?.value??0),0)??0),0):0;
  const relic=draft.relicResistance?.[element]??0;
  return gearPercentTotal(draft,types)+resonance+computing+relic;
}
/** Sum of the equipped gear's stats of these types (random rows and Titan-added stats). */
export function gearPercentTotal(draft:BuildDraft,types:string[]):number {
  return draft.gear.filter(item=>item.equipped).reduce((sum,item)=>sum+[...item.rows,...(item.titan||item.augmented?item.augments:[])]
    .filter(stat=>types.includes(stat.type)).reduce((total,stat)=>total+stat.value,0),0);
}
