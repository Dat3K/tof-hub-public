import {getStandardPetStatsAtLevel} from '@tof-hub/game-domain';
import type {PetItem} from './types';

/** Same generated stat correction for SSR entities and lazily loaded details. */
export function normalizePetStats(pet:PetItem):PetItem {
  const isMmo = pet.source_edition === 'mmo' || pet.id.toLowerCase().startsWith('mmo_');
  if (isMmo || !pet.stats_progression?.levels) return pet;
  const levels = Object.fromEntries(Object.entries(pet.stats_progression.levels).map(([key,stats])=>
    [key,{...stats,...getStandardPetStatsAtLevel(stats.level ?? Number(key))}],
  ));
  return {...pet,stats_progression:{...pet.stats_progression,levels}};
}
