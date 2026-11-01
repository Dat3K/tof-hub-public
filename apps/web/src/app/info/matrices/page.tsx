import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerMatrices } from '@/lib/game-data-server';
import { MatricesCatalogView } from '@/features/info-sections';
import { getMatricesStrings } from '@/features/info-sections/matrices/copy';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/info/matrices/', props);
}


export default async function MatricesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const parseList = (value: string | string[] | undefined) =>
    (first(value) || '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part && part !== 'all');
  const initialData = await loadServerMatrices(locale, { throwOnNotFound: false });

  return (
    <MatricesCatalogView
      initialData={initialData}
      initialLocale={locale}
      initialSearchQuery={first(params.q) || first(params.search) || ''}
      initialElements={parseList(params.elem ?? params.element) as any}
      initialRoles={parseList(params.role) as any}
      initialSort={first(params.sort)}
      initialSelectedMatrixId={(first(params.suit) || '').trim() || null}
    />
  );
}
