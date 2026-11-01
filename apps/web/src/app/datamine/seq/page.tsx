import type { Metadata } from 'next';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerSeqCache, loadServerOowSummary } from '@/features/datamine/data';
import { loadServerGameData } from '@/lib/game-data-server';
import { SeqView, seqSupportDamageByLevel } from '@/features/datamine/seq';
import { buildMetadata } from '@/lib/seo';
import { SEQ_COPY } from '@/features/datamine/seq';
import type { HandbookBiochemicalData, HandbookBiochemicalMedia } from '@/features/datamine/contracts/handbook';
import { MmoSequentialView } from '@/features/datamine/seq/mmo-sequential-view';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  return buildMetadata({
    title: 'Sequential Phantasm',
    description: SEQ_COPY[locale].subtitle,
    path: '/datamine/seq/',
  });
}


export default async function SeqPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  if (first(params.mode) === 'mmo' || first(params.server) === 'mmo') {
    const [data, media, oowPresentation] = await Promise.all([
      loadServerGameData<HandbookBiochemicalData | null>('handbook', 'biochemical-collapse', { throwOnNotFound: false }),
      loadServerGameData<HandbookBiochemicalMedia | null>('handbook', 'biochemical-collapse-media', { throwOnNotFound: false }),
      loadServerOowSummary(locale, { throwOnNotFound: false }),
    ]);
    return <MmoSequentialView data={data} media={media} combatIcons={oowPresentation?.statIcons} selection={{season: first(params.season) ?? undefined, pod: first(params.pod) ?? undefined}} />;
  }
  const stageViewRaw = first(params.stageView);
  const chartThemeRaw = first(params.chartTheme);
  const [initialData, buildReference, buildPage] = await Promise.all([
    loadServerSeqCache(locale, { throwOnNotFound: false }),
    loadServerGameData<{ resistanceFormula?: { constants?: Record<string, number> } } | null>(
      '',
      'build-reference',
      { throwOnNotFound: false }
    ),
    loadServerGameData<{
      support?: { modules?: { name_en: string; levels: { level: number; value: number }[] }[] };
    } | null>('', 'build-page', { throwOnNotFound: false }),
  ]);
  // Sequential bosses are treated as L100 targets: K = 14106 turns DEF 7500 into 34.71%.
  const resistanceConstant = buildReference?.resistanceFormula?.constants?.['100'] ?? null;

  return (
    <SeqView
      initialData={initialData}
      initialLocale={locale}
      initialStageView={stageViewRaw === 'all' || stageViewRaw === '16plus' ? stageViewRaw : null}
      initialChartTheme={chartThemeRaw === 'light' || chartThemeRaw === 'dark' ? chartThemeRaw : null}
      resistanceConstant={resistanceConstant}
      supportDamageByLevel={seqSupportDamageByLevel(buildPage?.support?.modules)}
    />
  );
}
