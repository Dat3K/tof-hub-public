import {alteredAttackSources,createCurrentGearScorer,pairStatChoices,restrictPairStats,roleTracks,type GearScoreReference,type CurrentGearScoreInput,type PairStatChoice} from './gear-score';
import type {BuildRVRole} from './stats';
export const TOP_RV_ROLES:readonly BuildRVRole[]=['dps','healer','tank'];

export interface GearChampion<T> {key:string;role:BuildRVRole;track:string;slot:string;choice:PairStatChoice;piece:T;value:number}
/** Minimal retained pool for current RV: standalone leaders plus every whole-build inheritance choice. */
export function gearChampions<T>(pieces:readonly T[],slot:(piece:T)=>string,input:(piece:T)=>CurrentGearScoreInput|null,
  tracks:string[][],reference:GearScoreReference):GearChampion<T>[] {
  const winners=new Map<string,GearChampion<T>>();
  const scoreGear=createCurrentGearScorer(reference);
  const sourceScorers=new Map(alteredAttackSources(reference).map(source=>[source,createCurrentGearScorer(reference,source)]));
  for(const role of TOP_RV_ROLES)for(const track of roleTracks(role,tracks)) {
    const choices:PairStatChoice[]=track.length>1?[null,...pairStatChoices(track)]:[null];
    const sources=track[0]==='Altered'&&role!=='tank'?[undefined,...sourceScorers.keys()]:[undefined];
    for(const inheritFrom of sources)for(const choice of choices)for(const piece of pieces) {
      const gear=input(piece);if(!gear)continue;
      const restricted=choice?{...gear,rows:restrictPairStats(gear.rows,track,choice),augments:restrictPairStats(gear.augments,track,choice)}:gear;
      const score=(inheritFrom?sourceScorers.get(inheritFrom)!:scoreGear)(restricted,track,role);if(score.value<=0)continue;
      const key=[role,track.join('-'),slot(piece),choice?`${choice.Attack}/${choice['Attack %']}/${choice['Damage %']}`:inheritFrom??'item'].join(':');
      const previous=winners.get(key);
      // Existing pieces are passed first: equal and duplicate uploads keep their original champion.
      if(!previous||score.value>previous.value+1e-9)winners.set(key,{key,role,track:track.join('-'),slot:slot(piece),choice,piece,value:score.value});
    }
  }
  return [...winners.values()];
}
