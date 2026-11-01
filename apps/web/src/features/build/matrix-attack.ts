import type {AttackPercentBonus,BuildCatalog,BuildDraft} from './types';
export const MATRIX_DISPLAY_ORDER=[3,0,2,1];

export function matrixSetPieces(matrices:BuildDraft['weapons'][number]['matrices'],index:number) {
  const matching=MATRIX_DISPLAY_ORDER.filter(i=>matrices[i]?.id&&matrices[i].id===matrices[index].id);
  const strongest=matching.slice().sort((a,b)=>matrices[b].stars-matrices[a].stars||MATRIX_DISPLAY_ORDER.indexOf(a)-MATRIX_DISPLAY_ORDER.indexOf(b));
  const count=matching.length;
  const level=count>=4&&matching.indexOf(index)>=2?4:count>=2?2:0;
  return {count,level,strongest,indices:level===4?matching:matching.slice(0,2),rank:(pieces:number)=>pieces>0&&strongest.length>=pieces?matrices[strongest[pieces-1]].stars:undefined};
}
export interface AttackPercentContribution {elements:string[];value:number;conditional?:boolean;maxStacks?:number}
export interface MatrixAttackPercentSource {weaponIndex:number;id:string;indices:number[];rank:number;bonuses:AttackPercentContribution[]}
export function attackPercentContributions(bonuses:AttackPercentBonus[]|undefined,rank:number,catalog:BuildCatalog,benediction=false):AttackPercentContribution[] {
  return (bonuses??[]).filter(b=>!b.condition||(b.condition==='benediction')===benediction).flatMap(b=>{
    const value=b.values.length===1?b.values[0]:b.values[rank];
    return value>0?[{elements:b.elements==='all'?Object.keys(catalog.elementIcons):b.elements,value,conditional:b.conditional,maxStacks:b.maxStacks}]:[];
  });
}
export function matrixAttackPercentSources(draft:BuildDraft,catalog:BuildCatalog) {
  const sources=new Map<string,MatrixAttackPercentSource>();
  const benediction=draft.weapons.filter(w=>catalog.weapons.find(item=>item.id===w.id)?.role==='benediction').length>=2;
  draft.weapons.forEach((weapon,weaponIndex)=>{
    for(const id of new Set(weapon.matrices.map(m=>m.id).filter(Boolean))) {
      const pieces=matrixSetPieces(weapon.matrices,weapon.matrices.findIndex(m=>m.id===id));
      const rank=pieces.rank(2);
      if(rank===undefined)continue;
      const bonuses=attackPercentContributions(catalog.matrices.find(m=>m.id===id)?.effects?.find(e=>e.level===2)?.attackPercentBonuses,rank,catalog,benediction);
      if(bonuses.length&&(!sources.has(id)||sources.get(id)!.rank<rank))sources.set(id,{weaponIndex,id,indices:pieces.strongest.slice(0,2),rank,bonuses});
    }
  });
  return [...sources.values()];
}
