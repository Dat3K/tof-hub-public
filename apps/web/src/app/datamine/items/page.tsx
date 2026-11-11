import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerDatamineItems } from '@/features/datamine/data';
import { loadServerGameData } from '@/lib/game-data-server';
import type { ItemTradeReference } from '@tof-hub/contracts';
import { ItemsView } from '@/features/datamine/items';
import { resolveItemsFilter, resolveItemsTradeFilter } from '@/features/datamine/items/items-types';

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
  const mode = first(params.mode) === 'mmo' ? 'mmo' : 'gacha';
  const filterRaw = first(params.filter);
  const searchRaw = first(params.q) || first(params.item);
  const [initialData, tradeRules] = await Promise.all([
    mode === 'mmo' ? null : loadServerDatamineItems(locale, { throwOnNotFound: false }),
    loadServerGameData<ItemTradeReference | null>('en', 'items-trade-rules', { throwOnNotFound: false }),
  ]);

  return (
    <ItemsView
      initialData={initialData}
      tradeRules={tradeRules}
      initialLocale={locale}
      initialMode={mode}
      initialFilter={resolveItemsFilter(mode, filterRaw)}
      initialTradeFilter={resolveItemsTradeFilter(mode, first(params.section), first(params.type))}
      initialSearch={typeof searchRaw === 'string' ? searchRaw : null}
    />
  );
}
