import { generatePageMetadata, type SeoPageProps } from '@/lib/seo/server';
import { loadServerGameData } from '@/lib/game-data-server';
import { loadServerOowSummary } from '@/features/datamine/data';
import { resolveServerLocale } from '@/lib/i18n/server';
import type { HandbookMmoRaidData, HandbookTeamRaidData } from '@/features/datamine/contracts/handbook';
import { RaidsView } from '@/features/datamine/raids/raids-view';
import { RaidRankingDatasetSchema } from '@tof-hub/contracts';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/datamine/raids/', props);
}

export default async function RaidsPage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>}) {
  const { locale } = await resolveServerLocale();
  const params = await searchParams ?? {};
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const [mmoData, originalData, oowPresentation, rankings] = await Promise.all([
    loadServerGameData<HandbookMmoRaidData | null>('handbook', 'mmo-raids', { throwOnNotFound: false }),
    loadServerGameData<HandbookTeamRaidData | null>('handbook', 'team-raids', { throwOnNotFound: false }),
    loadServerOowSummary(locale, { throwOnNotFound: false }),
    loadServerGameData<unknown | null>('handbook', 'raid-rankings', { throwOnNotFound: false }),
  ]);
  const parsedRankings = RaidRankingDatasetSchema.safeParse(rankings);
  // Raw provenance stays in the generated archive; the interactive view uses only presentation fields.
  const rankingData = parsedRankings.success ? {...parsedRankings.data, boards: parsedRankings.data.boards.map(({raw: _raw, ...board}) => ({
    ...board, entries: board.entries.map(({raw: _entryRaw, ...entry}) => entry),
  }))} : null;
  const serverParam = first(params.server);
  const legacyMmoSelection = first(params.mode) === 'mmo' || Boolean(first(params.stage) || first(params.schedule));
  const server = serverParam === 'mmo' || (!serverParam && legacyMmoSelection) ? 'mmo' : 'original';
  return <RaidsView originalData={originalData} mmoData={mmoData} rankingData={rankingData} rankingError={rankings !== null && !parsedRankings.success} critIcon={oowPresentation?.statIcons?.crit} hpIcon={oowPresentation?.statIcons?.hp} selection={{
    server,
    raid: first(params.raid),
    variant: first(params.variant),
    stage: first(params.stage),
    schedule: first(params.schedule),
    tab: first(params.tab), season: first(params.season), region: first(params.region),
    layout: first(params.layout), unique: first(params.unique), q: first(params.q), player: first(params.player), names: first(params.names), sort: first(params.sort), places: first(params.places),
  }} />;
}
