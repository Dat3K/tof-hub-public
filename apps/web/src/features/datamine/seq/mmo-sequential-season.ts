import type {HandbookBiochemicalData, HandbookBiochemicalDate} from '../contracts/handbook';

type Season = HandbookBiochemicalData['seasons'][number];
export const SEQUENTIAL_GLOBAL_REGION = 'EHottaServiceRegionType::Region_Oversea';

export function sequentialSeasonPeriod(season: Season) {
  const regional = season.regionalPeriods?.find(period => period.region === SEQUENTIAL_GLOBAL_REGION);
  return regional ? {...regional, regional: true} : {start: season.start, end: season.end, regional: false};
}

/** Raw civil-time comparison, matching OoW's source-calendar selection without inventing a timezone. */
export function sequentialDateValue(value: HandbookBiochemicalDate | null) {
  return value ? Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second) : NaN;
}

export function currentSequentialSeason(seasons: Season[], now = new Date()) {
  return seasons.filter(season => {
    const period = sequentialSeasonPeriod(season);
    return period.regional && sequentialDateValue(period.start) <= now.getTime() && now.getTime() < sequentialDateValue(period.end);
  }).sort((a, b) => sequentialDateValue(sequentialSeasonPeriod(b).start) - sequentialDateValue(sequentialSeasonPeriod(a).start))[0];
}
