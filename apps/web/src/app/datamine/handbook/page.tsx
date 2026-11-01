import type { Metadata } from 'next';
import { resolveServerLocale } from '@/lib/i18n/server';
import { buildMetadata } from '@/lib/seo';
import { HANDBOOK_COPY, HANDBOOK_PATH, HandbookView, parseHandbookMode } from '@/features/datamine/handbook';
import { loadHandbook } from '@/features/datamine/handbook/handbook-data';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  return buildMetadata({
    title: 'Handbook',
    description: HANDBOOK_COPY[locale].subtitle,
    path: HANDBOOK_PATH,
  });
}

export default async function HandbookPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (searchParams ? await searchParams : undefined) || {};
  const mode = parseHandbookMode(params.server);
  const { sections, data } = await loadHandbook(mode);
  return <HandbookView mode={mode} sections={sections} data={data} />;
}
