import { localized } from '@tof-hub/i18n';
import type { Metadata } from 'next';
import { InfoHubView, INFO_HUB_COPY } from '@/features/info-hub';
import { loadHubSummary } from '@/lib/hub-summary/server';
import { buildMetadata } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  return buildMetadata({
    title: 'Info',
    description: localized(INFO_HUB_COPY, locale)?.heroSubtitle ?? INFO_HUB_COPY.en.heroSubtitle,
    path: '/info/',
  });
}

export default async function InfoHubPage() {
  const summary = await loadHubSummary();
  return <InfoHubView summary={summary} />;
}
