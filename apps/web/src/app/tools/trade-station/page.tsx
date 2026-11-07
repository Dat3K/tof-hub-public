import { localized } from '@tof-hub/i18n';
import { generatePageMetadata, type SeoPageProps } from '@/lib/seo/server';
import { loadServerGameData } from '@/lib/game-data-server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { isTradeSort, TRADE_STATION_COPY, TradeStationView } from '@/features/trade-station';
import type { TradeStationDataset } from '@/features/trade-station';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/tools/trade-station/', props);
}

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

// `runtime/trade-station.json` is produced by scripts/game-processors; a checkout without a game
// export has no file, so the page must render without it instead of failing the route.
export default async function Page({ searchParams }: { searchParams?: Promise<Search> }) {
  const dataset = await loadServerGameData<TradeStationDataset>('', 'runtime/trade-station', {
    throwOnNotFound: false,
  });
  const { locale } = await resolveServerLocale();
  const copy = localized(TRADE_STATION_COPY, locale);

  if (!dataset || !Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    return (
      <main style={{ maxWidth: '70ch', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.625rem', margin: '0 0 0.5rem' }}>{copy.title}</h1>
        <p style={{ margin: 0, opacity: 0.75 }}>{copy.datasetMissing}</p>
      </main>
    );
  }

  const params = (searchParams ? await searchParams : undefined) ?? {};
  const sectionParam = first(params.section);
  const section = dataset.sections.find((entry) => entry.id === sectionParam)?.id ?? 'all';
  // `Number(null)` is 0, so an absent parameter must stay absent instead of filtering on index 0.
  const indexParam = (value: string | null) => {
    if (value === null || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  };
  const sortParam = first(params.sort);

  return (
    <TradeStationView
      dataset={dataset}
      initial={{
        // A link that names a filter is followed as written; only a bare visit replays the tab's own.
        explicit: ['q', 'section', 'type', 'sort', 'all'].some((key) => params[key] !== undefined),
        search: first(params.q) ?? '',
        section,
        type: indexParam(first(params.type)),
        sort: isTradeSort(sortParam) ? sortParam : 'category',
        showUnlistable: first(params.all) === '1',
      }}
    />
  );
}
