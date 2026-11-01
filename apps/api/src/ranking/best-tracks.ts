import {preferScoringTrack} from '@tof-hub/game-domain';
import type {TrackScore} from '../players/player-store.repository';

/** Role prefix of a stored track (game-domain roleTrackId): '' for DPS, `healer:` / `tank:`. */
const ROLE_PREFIX=/^(healer:|tank:)/;
const BEST='best:';

/** Stored id of a precomputed best row: `best:all` or `best:<pair>` with the pair's elements sorted, role-prefixed. */
export function bestTrackId(role:'dps'|'healer'|'tank',key:string) {
  const id=key==='all'?`${BEST}all`:`${BEST}${key.split('-').sort().join('-')}`;
  return role==='dps'?id:`${role}:${id}`;
}
export const isBestTrack=(track:string)=>track.replace(ROLE_PREFIX,'').startsWith(BEST);

/**
 * Best rows written next to the per-track scores so that `all` and unordered pairs are read like any single track:
 * one indexed range with LIMIT instead of every track of every item sorted in the API.
 * - `best:all` — the item / player at its best track of the role, Altered included; on a tie the mono track wins
 *   (a pair only wins when the second element's ATK % / DMG % really adds something);
 * - `best:<A>-<B>` — the better of the two stored orientations of a pair (the better flat ATK of the two elements).
 * `sourceTrack` keeps the stored track the row came from.
 */
export function withBestTracks(scores:TrackScore[]):TrackScore[] {
  const groups=new Map<string,TrackScore[]>();
  for(const score of scores) {
    if(isBestTrack(score.track))continue;
    const prefix=ROLE_PREFIX.exec(score.track)?.[1]??'';
    groups.set(prefix,[...groups.get(prefix)??[],score]);
  }
  const best:TrackScore[]=[];
  const better=(a:TrackScore,b:TrackScore)=>preferScoringTrack({track:b.track,percent:b.score,value:b.selectionValue},{track:a.track,percent:a.score,value:a.selectionValue});
  for(const [prefix,rows] of groups) {
    let top:TrackScore|null=null;
    const pairs=new Map<string,TrackScore>();
    for(const row of rows) {
      const track=row.track.slice(prefix.length);
      if(!top||better(top,row))top=row;
      if(track.includes('-')) {
        const key=track.split('-').sort().join('-'),current=pairs.get(key);
        if(!current||better(current,row))pairs.set(key,row);
      }
    }
    const row=(key:string,source:TrackScore)=>({track:`${prefix}${BEST}${key}`,score:source.score,maxScore:source.maxScore,sourceTrack:source.track,...(source.gearIds?{gearIds:source.gearIds}:{})});
    if(top)best.push(row('all',top));
    for(const [key,source] of pairs)best.push(row(key,source));
  }
  return [...scores.filter(score=>!isBestTrack(score.track)),...best];
}
