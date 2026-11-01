import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerDatamineItems } from '@/features/datamine/data';
import { ItemsView } from '@/features/datamine/items';
import { ITEMS_COPY } from '@/features/datamine/items';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/datamine/items/', props);
}


export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const modeRaw = first(params.mode);
  const filterRaw = first(params.filter);
  const searchRaw = first(params.q) || first(params.item);
  const initialData = await loadServerDatamineItems(locale, { throwOnNotFound: false });

  return (
    <ItemsView
      initialData={initialData}
      initialLocale={locale}
      initialMode={modeRaw === 'mmo' || modeRaw === 'gacha' ? modeRaw : null}
      initialFilter={filterRaw === 'renamed' || filterRaw === 'all' ? filterRaw : null}
      initialSearch={typeof searchRaw === 'string' ? searchRaw : null}
    />
  );
}
