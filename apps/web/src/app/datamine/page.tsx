import type { Metadata } from 'next';
import { resolveServerLocale } from '@/lib/i18n/server';
import { DatamineHubView, DATAMINE_HUB_COPY } from '@/features/datamine';
import { loadHubSummary } from '@/lib/hub-summary/server';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  return buildMetadata({
    title: 'Datamine',
    description: DATAMINE_HUB_COPY[locale].subtitle,
    path: '/datamine/',
  });
}

export default async function DatamineHubPage() {
  const summary = await loadHubSummary();
  return <DatamineHubView summary={summary} today={new Date().toISOString().slice(0, 10)} />;
}
