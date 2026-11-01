import type {GearTopEntry} from './ranking.service';

/** Public fields shared by live and synthetic boards; instance ids and observation provenance stay private. */
export function gearTopView(gear:Omit<GearTopEntry['gear'],'lastSeenAt'>&{lastSeenAt:Date|string}):GearTopEntry['gear'] {
  return {id:gear.id,slot:gear.slot,itemId:gear.itemId,stars:gear.stars,enhancement:gear.enhancement,titan:gear.titan,augmented:gear.augmented,rareId:gear.rareId,
    rareLevel:gear.rareLevel,stats:gear.stats,statsBeforeTitan:gear.statsBeforeTitan,augments:gear.augments,lastSeenAt:typeof gear.lastSeenAt==='string'?gear.lastSeenAt:gear.lastSeenAt.toISOString(),
    augmentCount:gear.augmentCount,source:gear.source};
}
