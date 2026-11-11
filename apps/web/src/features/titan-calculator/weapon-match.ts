import type { BuildCatalog } from '@/features/build/types';
import type { ResonanceWeapon } from '@/features/build/weapon-resonances';
import type { TitanStat } from './model';

export type TitanWeapon=ResonanceWeapon & Pick<BuildCatalog['weapons'][number],'icon'>;
export type TitanCatalog={weapons:readonly TitanWeapon[];statIcons:Partial<Record<TitanStat,string>>}
  & Pick<BuildCatalog,'titanMark'|'elementIcons'> & Partial<Pick<BuildCatalog,'roleResonances'>>;
const normalize=(value:string)=>value.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');

function editDistance(left:string,right:string) {
  let row=Array.from({length:right.length+1},(_,index)=>index);
  for(let i=0;i<left.length;i++) {
    const next=[i+1];
    for(let j=0;j<right.length;j++)next.push(Math.min(row[j+1]!+1,next[j]!+1,row[j]!+Number(left[i]!==right[j])));
    row=next;
  }
  return row[right.length]!;
}

/** Match the in-game weapon name, not the owner's name. Ambiguous OCR stays visible as read. */
export function matchWeapon<Weapon extends Pick<TitanWeapon, 'weapon'>>(raw: string, catalog: readonly Weapon[]): Weapon | undefined {
  const query=normalize(raw);
  if(!query)return undefined;
  const candidates=catalog.flatMap(weapon=>{
    const names=Object.values(weapon.weapon??{}).flatMap(name=>typeof name==='string'&&name?[normalize(name)]:[]);
    const distance=Math.min(...names.filter(name=>Math.abs(name.length-query.length)<=2).map(name=>editDistance(query,name)));
    return distance<=Math.min(2,Math.floor(query.length/5))?[{weapon,distance}]:[];
  }).sort((a,b)=>a.distance-b.distance);
  return candidates[0]&&candidates[0].distance!==candidates[1]?.distance?candidates[0].weapon:undefined;
}
