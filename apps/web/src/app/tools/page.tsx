import type { Metadata } from 'next';
import { adaptCompCatalog } from '@tof-hub/game-domain';
import type { HandbookTitanData } from '@/features/datamine/contracts/handbook';
import { ToolsHubView, TOOLS_HUB_COPY } from '@/features/tools-hub';
import { buildCompPreview } from '@/features/tools-hub/comp-preview';
import { buildTitanPreview } from '@/features/tools-hub/titan-preview';
import { loadHubSummary } from '@/lib/hub-summary/server';
import { loadServerGameData } from '@/lib/game-data-server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  return buildMetadata({
    title: 'Tools',
    description: TOOLS_HUB_COPY[locale].subtitle,
    path: '/tools/',
  });
}

export default async function ToolsHubPage() {
  const [summary, compData, titanData] = await Promise.all([
    loadHubSummary(),
    // Icons are not localized: the English Comp catalog resolves the default squad for every locale. Read the runtime
    // projection the Comp page fetches (en/runtime/comp.json): the release does not ship the full en/comp.json.
    loadServerGameData<unknown>('en', 'runtime/comp', { throwOnNotFound: false }),
    loadServerGameData<HandbookTitanData | null>('handbook', 'titan', { throwOnNotFound: false }),
  ]);
  const catalog = compData ? adaptCompCatalog(compData) : null;
  return <ToolsHubView summary={summary} compPreview={buildCompPreview(catalog)} titanPreview={buildTitanPreview(titanData, catalog)} />;
}
