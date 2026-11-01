import {matrixSetPieces,matrixStatBonuses,MATRIX_DISPLAY_ORDER} from './model';
import type {BuildCatalog,BuildDraft} from './types';

type WeaponDraft=BuildDraft['weapons'][number];
type MatrixDraft=WeaponDraft['matrices'][number];

/** Raw attribute weight from AttributeStaticDataTable via the generated CS rules. */
function rawWeight(attribute:string,catalog:BuildCatalog) {
  const label=Object.entries(catalog.csRules.attributes).find(([,raw])=>raw===attribute)?.[0];
  return label?catalog.csRules.weights[label]??0:0;
}

/** Σ((base + level growth) × star coefficient × weight) + StarSkillScore. Matches server fWeaponScore. */
export function weaponCombatScore(weapon:WeaponDraft,catalog:BuildCatalog):number|null {
  const meta=catalog.weapons.find(item=>item.id===weapon.id);
  const table=meta?.weaponId?catalog.systemCs?.weapons[meta.weaponId.toLowerCase()]:undefined;
  const star=table?.stars[weapon.stars];
  if(!table||!star)return null;
  const values=[...table.base];
  for(const [from,to,add] of table.segments) {
    const levels=Math.max(0,Math.min(to,weapon.level)-from+1);
    add.forEach((value,i)=>{values[i]+=value*levels;});
  }
  return values.reduce((sum,value,i)=>sum+value*star.coefficients[i]*table.weights[i],0)+star.skillScore;
}

/** One matrix's weighted stats; set bonuses are counted once per weapon by matrixSetScore. */
export function matrixCombatScore(matrix:MatrixDraft,index:number,catalog:BuildCatalog):number|null {
  if(!matrix.id)return null;
  const stats=matrixStatBonuses(matrix,index,catalog);
  return stats.length?stats.reduce((sum,stat)=>sum+stat.value*rawWeight(stat.id,catalog),0):null;
}

/** AddScore of every reached piece threshold of each set on one weapon, ranked by the set's stars. */
export function matrixSetScores(matrices:WeaponDraft['matrices'],catalog:BuildCatalog) {
  const seen=new Set<string>(),result:{id:string;pieces:number;stars:number;score:number}[]=[];
  for(const index of MATRIX_DISPLAY_ORDER) {
    const id=matrices[index]?.id;
    if(!id||seen.has(id))continue;
    seen.add(id);
    const {count,rank}=matrixSetPieces(matrices,index);
    const table=catalog.systemCs?.matrixSets[id.toLowerCase()];
    for(const [pieces,byStars] of Object.entries(table??{}).map(([key,value])=>[Number(key),value] as const).sort((a,b)=>a[0]-b[0])) {
      if(count<pieces)continue;
      const stars=rank(pieces)??0,score=byStars[Math.min(stars,byStars.length-1)];
      if(Number.isFinite(score))result.push({id,pieces,stars,score});
    }
  }
  return result;
}

/** Matrices of one weapon including set bonuses. Matches server fMatrixScore per weapon. */
export function weaponMatricesCombatScore(weapon:WeaponDraft,catalog:BuildCatalog):number {
  const matrices=weapon.matrices.reduce((sum,matrix,index)=>sum+(matrixCombatScore(matrix,index,catalog)??0),0);
  return matrices+matrixSetScores(weapon.matrices,catalog).reduce((sum,set)=>sum+set.score,0);
}

export type SystemCombatScore={
  value:number;
  parts:{attribute:string;label:string;value:number;weight:number;cs:number}[];
  /** Raw attributes left out: no CS weight (HealUpMult, BreakDefMult) or a pool-dependent ATK% / RES%. */
  unscored:string[];
};

/**
 * Raw system attributes: flat × weight and fixed-base DMG% × weight. Pool-dependent ATK% / RES% are left out:
 * weighting Supercomputing ATK% / RES% by the build's ATK / RES bases exceeds the whole unexplained remainder
 * of captured total CS, so these systems do not score them like gear.
 */
export function attributesCombatScore(pairs:readonly (readonly [string,number])[]|undefined,catalog:BuildCatalog):SystemCombatScore|null {
  if(!pairs)return null;
  const labels=Object.fromEntries(Object.entries(catalog.csRules.attributes).map(([label,raw])=>[raw,label]));
  const parts:SystemCombatScore['parts']=[],unscored:string[]=[];
  for(const [attribute,value] of pairs) {
    // Derived weights (pipeline): content-module FinalDamageExtraUpMult is scored like elemental DMG%.
    const label=labels[attribute]??catalog.systemCs?.derivedWeights?.[attribute],weight=label?catalog.csRules.weights[label]:undefined,base=label?catalog.csRules.bases[label]:undefined;
    if(!label||weight===undefined||(base&&base!=='fixedPercent'))unscored.push(attribute);
    else if(value>0)parts.push({attribute,label,value,weight,cs:value*weight});
  }
  return {value:parts.reduce((sum,part)=>sum+part.cs,0),parts,unscored};
}

/** One Supercomputing node at its current level. */
export function computingCombatScore(node:BuildDraft['computing'][number],catalog:BuildCatalog) {
  const slot=catalog.computing.find(item=>item.id===node.id)?.slot;
  return slot?attributesCombatScore(catalog.systemCs?.computing?.[slot]?.[node.level],catalog):null;
}

/** One Space Support module; content modules (AttributeID=None) score their BuffClass FinalDamageExtraUpMult. */
export function supportCombatScore(module:BuildDraft['support'][number],catalog:BuildCatalog) {
  return attributesCombatScore(catalog.systemCs?.support?.[module.id]?.[module.level],catalog);
}

/** The selected suppressor step: its own ModifyData package, not a sum of previous steps. */
export function suppressorCombatScore(draft:BuildDraft,catalog:BuildCatalog) {
  const id=draft.profile.suppressorId;
  return id?attributesCombatScore(catalog.systemCs?.suppressor?.[id],catalog):null;
}
