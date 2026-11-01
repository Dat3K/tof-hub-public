import type { Metadata } from 'next';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerSimulacra, loadServerReleaseManifest } from '@/lib/game-data-server';
import { SimulacraChangelogView, getSimulacraChangelogStrings } from '@/features/simulacra';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  const strings = getSimulacraChangelogStrings(locale);
  return {
    ...buildMetadata({
      title: 'Simulacra changes',
      description: strings.metaDescription,
      path: '/info/simulacra/changelog/',
    }),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SimulacraChangelogPage() {
  const { locale } = await resolveServerLocale();
  const initialData = await loadServerSimulacra(locale, { throwOnNotFound: false });
  const manifest = await loadServerReleaseManifest({ throwOnNotFound: false });

  const firstSource = manifest?.snapshot?.sources?.[0];
  const defaultClientEn = firstSource?.client || 'Korea Dev 1';
  const defaultClientRu = firstSource?.clientRu || 'Корея Dev 1';

  return (
    <SimulacraChangelogView
      initialData={initialData}
      initialLocale={locale}
      defaultClientEn={defaultClientEn}
      defaultClientRu={defaultClientRu}
    />
  );
}
