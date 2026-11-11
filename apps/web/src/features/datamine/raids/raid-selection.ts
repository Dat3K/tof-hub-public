import type { RaidRankingDataset } from '@tof-hub/game-domain';

type Seasons = RaidRankingDataset['seasons'];

export function latestRaidSeason(seasons: Seasons) {
  return [...seasons].sort((a, b) => a.label.localeCompare(b.label, undefined, {numeric: true})).at(-1);
}

/** Explicit seasons win; legacy raid links still select the corresponding season. */
export function selectedRaidSeason(params: URLSearchParams, seasons: Seasons) {
  return seasons.find(season => season.id === params.get('season'))
    ?? seasons.find(season => season.raidId && season.raidId === params.get('raid'))
    ?? latestRaidSeason(seasons);
}

/** Keep shareable overrides, without serializing the page's implicit defaults. */
export function normalizeRaidSelection(params: URLSearchParams, seasons: Seasons) {
  const defaults: Record<string, string> = {tab: 'overview', region: 'all', layout: 'teams', unique: '0', names: 'historical', sort: 'time', places: 'region', q: '', player: ''};
  if (params.get('server') !== 'mmo' && params.get('mode') !== 'mmo') {
    const season = selectedRaidSeason(params, seasons);
    if (season && (params.has('season') || season.raidId === params.get('raid'))) {
      if (season.id === latestRaidSeason(seasons)?.id) params.delete('season');
      else params.set('season', season.id);
      if (season.raidId === params.get('raid')) params.delete('raid');
    }
  }
  if (params.get('region') !== 'PS' || !params.get('subregion')) params.delete('subregion');
  for (const [key, value] of Object.entries(defaults)) if (params.get(key) === value) params.delete(key);
  return params;
}
