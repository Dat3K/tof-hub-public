import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerArts } from '@/lib/game-data-server';
import {
  ART_CATEGORY_OPTIONS,
  ArtsCatalogView,
  getArtsSortOptions,
  getArtsStrings,
} from '@/features/info-sections/arts';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/info/arts/', props);
}


export default async function ArtsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const initialData = await loadServerArts(locale, { throwOnNotFound: false });

  const catRaw = first(params.cat);
  const category =
    catRaw && ART_CATEGORY_OPTIONS.some((o) => o.id === catRaw) ? catRaw : null;
  const sortRaw = first(params.sort);
  const sortOptions = getArtsSortOptions(getArtsStrings(locale));
  const sort =
    sortRaw && sortOptions.some((o) => o.value === sortRaw) ? sortRaw : null;

  return (
    <ArtsCatalogView
      initialData={initialData}
      initialLocale={locale}
      initialCategory={category as any}
      initialSearchQuery={first(params.search) || first(params.q) || ''}
      initialSort={sort}
    />
  );
}
