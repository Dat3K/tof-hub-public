import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerCosmetics } from '@/lib/game-data-server';
import {
  COSMETIC_CATEGORY_OPTIONS,
  CosmeticsCatalogView,
  getCosmeticsSortOptions,
  getCosmeticsStrings,
} from '@/features/info-sections/cosmetics';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/info/cosmetics/', props);
}


export default async function CosmeticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const initialData = await loadServerCosmetics(locale, { throwOnNotFound: false });

  const catRaw = first(params.type) || first(params.cat);
  const category =
    catRaw && COSMETIC_CATEGORY_OPTIONS.some((o) => o.id === catRaw) ? catRaw : null;
  const sortRaw = first(params.sort);
  const normalizedSort =
    sortRaw === 'id_desc' ? 'order_desc' : sortRaw === 'id_asc' ? 'order_asc' : sortRaw;
  const sortOptions = getCosmeticsSortOptions(getCosmeticsStrings(locale));
  const sort =
    normalizedSort && sortOptions.some((o) => o.value === normalizedSort) ? normalizedSort : null;

  return (
    <CosmeticsCatalogView
      initialData={initialData}
      initialLocale={locale}
      initialCategory={category as any}
      initialSearchQuery={first(params.search) || first(params.q) || ''}
      initialSort={sort}
    />
  );
}
