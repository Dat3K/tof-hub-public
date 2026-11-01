import {getWeaponStatsAtLevel} from '@tof-hub/game-domain';
import type {BuildCatalog,BuildDraft} from './types';

export function weaponStatBonuses(weapon:BuildDraft['weapons'][number],catalog:BuildCatalog) {
  const stats=catalog.weapons.find(w=>w.id===weapon.id)?.stats;
  if(!stats||weapon.level===0)return [];
  const result=getWeaponStatsAtLevel(stats,weapon.level,weapon.stars);
  const keys=['attack','hp',...(stats.max_stats.resistance!==undefined||stats.max_stats.def!==undefined?['resistance']:['crit'])] as const;
  return keys.flatMap(key=>{const value=result[key as 'attack'|'hp'|'crit'|'resistance'];return typeof value==='number'?[{id:key,value}]:[];});
}
export function matrixStatBonuses(matrix:BuildDraft['weapons'][number]['matrices'][number],index:number,catalog:BuildCatalog) {
  const entry=catalog.matrices.find(m=>m.id===matrix.id);
  const profile=catalog.matrixStats?.profiles[entry?.statProfiles?.[index]??''];
  const level=profile?.levels.find(l=>l.level===matrix.level);
  const multiplier=profile?.starMultipliers.find(s=>s.stars===matrix.stars)?.multiplier;
  return level&&multiplier!==undefined?level.stats.map(s=>({...s,value:s.value*multiplier})):[];
}
/** Displayed matrix stat: the game truncates the float32 value (Mind Lv100 Crit 416.6667 → 416, HP 34999.9995 → 35000). Scores keep the raw value. */
export function matrixDisplayValue(value:number) {
  return Math.floor(Math.fround(value));
}
/** Enhancement Shot changes weapon levels and matrix levels/advancements only. */
export function enhancementShotBonuses(draft:BuildDraft,catalog:BuildCatalog) {
  const ids:Record<string,string>={CommonAtkAdded:'attack',MaxHealthAdded:'hp',CritAdded:'crit',ElementDef:'resistance'};
  const difference=(current:{id:string;value:number}[],maximum:{id:string;value:number}[])=>maximum.map(stat=>({id:ids[stat.id]??stat.id,value:Math.max(0,stat.value-(current.find(s=>s.id===stat.id)?.value??0))}));
  const weapons=draft.weapons.map(weapon=>({
    weapon:difference(weaponStatBonuses(weapon,catalog),weaponStatBonuses({...weapon,level:catalog.defaultLevels.weapon},catalog)),
    matrices:weapon.matrices.map((matrix,index)=>{
      const entry=catalog.matrices.find(m=>m.id===matrix.id);
      const profile=catalog.matrixStats.profiles[entry?.statProfiles[index]??''];
      if(!profile)return [];
      const level=Math.max(...profile.levels.map(l=>l.level));
      const stars=Math.max(...profile.starMultipliers.map(s=>s.stars));
      return difference(matrixStatBonuses(matrix,index,catalog),matrixStatBonuses({...matrix,level,stars},index,catalog));
    }),
  }));
  const totals=new Map<string,number>();
  for(const source of weapons)for(const stat of [...source.weapon,...source.matrices.flat()])totals.set(stat.id,(totals.get(stat.id)??0)+stat.value);
  const total=[...totals].map(([id,value])=>({id,value}));
  const labels:Record<string,string>={attack:'Attack',hp:'HP',crit:'Crit',resistance:'Resistance'};
  const entries=total.filter(stat=>stat.value>0).map(stat=>({value:stat.value,weight:catalog.csRules?.weights[labels[stat.id]]}));
  // These are flat weapon/matrix gains. Score universal ATK/RES once, without combat % multipliers.
  const combatScore=entries.some(stat=>stat.weight===undefined||!Number.isFinite(stat.weight)||!Number.isFinite(stat.value))
    ?null:entries.reduce((sum,stat)=>sum+stat.value*stat.weight!,0);
  return {weapons,total,combatScore};
}
