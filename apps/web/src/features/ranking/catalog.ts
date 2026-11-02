import {rankingRegions} from '../players/regions';
import {elementTracks} from '@tof-hub/game-domain';
import type {BuildCatalog, GearCatalogItem} from '../build/types';
import type {ElementTrack,RankingCatalog} from './types';

/** Pair tracks come from the weapon catalog: every dual-element weapon or selectable dual form (shared with the API). */
export type RankingCatalogSource = Pick<BuildCatalog,'schemaVersion'|'titanMark'|'reference'|'statTypeIcons'|'displayIcons'|'elementIcons'|'resistanceIcons'|'demoDraft'> & {
  weapons:{elements:string[];selectableElements?:{elements:string[]}[]}[];
  gear:(Omit<GearCatalogItem,'baseStats'> & Partial<Pick<GearCatalogItem,'baseStats'>>)[];
};

export function elementPairs(catalog:Pick<RankingCatalogSource,'weapons'>):ElementTrack[] {
  return elementTracks([],catalog.weapons);
}

export function buildRankingCatalog(catalog:RankingCatalogSource):RankingCatalog {
  const regions=rankingRegions();
  const demo=catalog.demoDraft;
  const server=/^(.*?)\s*\/\s*(.*)$/.exec(demo.profile.server);
  return {
    titanMark:catalog.titanMark,
    reference:catalog.reference,statTypeIcons:catalog.statTypeIcons,displayIcons:catalog.displayIcons,elementIcons:catalog.elementIcons,resistanceIcons:catalog.resistanceIcons,
    gear:catalog.gear.map(({baseStats:_baseStats,...item})=>item),pairs:elementPairs(catalog),regions,
    example:{player:{nickname:demo.profile.name||null,uid:demo.profile.uid||null,region:server?.[1]||null,serverId:server?.[2]||null,combatScore:demo.profile.cs??null},
      gear:demo.gear.filter(item=>item.equipped),capturedAt:demo.profile.apexGsAchievedAt??''},
  };
}
