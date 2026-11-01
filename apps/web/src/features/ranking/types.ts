import type {BuildCatalog,GearCatalogItem,GearDraft} from '../build/types';
import type {TestServerParticipation} from '@tof-hub/contracts';

/** Mono element (`['Frost']`) or an ordered pair (`['Frost','Volt']`): flat ATK of the first, best ATK%/DMG% in the pair. */
export type ElementTrack=string[];
export type RankingBoard='gear'|'players';

/** The part of the build catalog the ranking page needs; base-stat tables stay on the build page. */
export type RankingCatalog=Pick<BuildCatalog,'reference'|'statTypeIcons'|'displayIcons'|'elementIcons'|'resistanceIcons'|'titanMark'>&{
  gear:Omit<GearCatalogItem,'baseStats'>[];
  /** Pair tracks from dual-element weapons and selectable element forms in the weapon catalog. */
  pairs:ElementTrack[];
  regions:{code:string;name:string}[];
  /** Editorial example: the build page's sample card, shown only on request while ranking are empty. */
  example:{player:TopPlayer;gear:GearDraft[];capturedAt:string};
};

export interface TopPlayer {nickname:string|null;uid:string|null;region:string|null;serverId:string|null;combatScore?:number|null;
  /** The player's highest CS (Apex CS on the card); the row shows it under the CS label. */
  maxCombatScore?:number|null;
  /** The game's date of that highest CS (HistoryMaxGSChangeTime, own cards only; civil time as ISO). */
  maxCombatScoreAt?:string|null;
  testServers?:TestServerParticipation[]}
export interface TopStat {type:string;value:number}
export interface GearTopEntry {
  /** Client-only copy shown above the board by Me; keeps its original rank. */
  ownerPin?:true;
  rank:number;score:number;maxScore:number;player:TopPlayer;
  /** Track of the score (API); with the All filter it is the item's best track. */
  track?:string;
  gear:TopGear;
  /** Synthetic reference item (client-side, never stored). */
  ideal?:boolean;
  /** ATK% comparison piece, separate from the 100% ideal item. */
  reference?:'attack-percent'|'resistance-only'|'altered-resistance-percent';
}
/** A stored gear piece (API `gear_items`): values before Titan follow the order of `stats` and may be unknown. */
export interface TopGear {
  /** Stored piece id (API); absent on client-side rows such as the perfect item and the example. */
  id?:string;slot:string;itemId:string;stars:number;enhancement:number;titan:boolean;augmented:boolean;rareId:string|null;rareLevel:number|null;
  stats:TopStat[];statsBeforeTitan:(number|null)[]|null;augments:TopStat[];lastSeenAt:string;
  /** Titan clicks (Augmentation Count) when an own capture brought it. */
  augmentCount?:number|null;
  /** Persisted capture provenance: self = own .tofbuild, inspect = another player's profile. */
  source?:string;
  /** Owner of a piece selected for a synthetic Pioneer/Global build. */
  ownerNickname?:string|null;ownerRegion?:string|null;ownerServerId?:string|null}
export interface PlayerTopEntry {rank:number;score:number;maxScore:number;player:TopPlayer;
  /** An own sealed profile was accepted; this does not certify a build card or every selected item. */
  verified?:boolean;
  /** Client-only copy shown above the board by Me; keeps its original rank. */
  ownerPin?:true;
  synthetic?:'pioneer'|'global'|'regional';comparisonDelta?:number;
  /** Track of the score (API); with the All filter it is the player's best track. */
  track?:string;
  /** Null for players known only from gear updates (someone else's inspect), without a build card. */
  buildId:string|null;updatedAt:string;
  /** The pieces behind the score: per slot the best known piece for the track (equipped or not). */
  gear:TopGear[];
  /** Synthetic reference player (client-side, never stored). */
  ideal?:boolean;
  /** Additional synthetic player shown by the same reference toggle. */
  reference?:'attack-percent'|'resistance-only'}
/**
 * One page of a board. First page only: `total` = rows of the whole board with these filters and this search;
 * `overall` = every stored player (players board) or piece (gear board), whatever the filters.
 */
export interface RankingResponse<T> {available:boolean;entries:T[];total?:number;overall?:number;databaseEmpty?:boolean}
