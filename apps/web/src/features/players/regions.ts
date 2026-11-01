import {getAllServers, ServerRegionCodeSchema, UNRANKED_REGION_CODES} from '@tof-hub/contracts';

/** Tools Ranking's region catalog/order, shared with encounter leaderboards. */
export function rankingRegions() {
  const servers = getAllServers();
  const tail = (code: string) => code === 'PS' ? 3 : code === 'TW' ? 2 : code === 'KR' ? 1 : 0;
  return [...ServerRegionCodeSchema.options].filter(code => !UNRANKED_REGION_CODES.includes(code)).sort((a, b) => tail(a) - tail(b))
    .map(code => ({code, name: servers.find(server => server.regionCode === code)?.region ?? code}));
}
