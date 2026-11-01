import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerRelics } from '@/lib/game-data-server';
import { RelicsCatalogView } from '@/features/info-sections';
import { getRelicsStrings } from '@/features/info-sections/relics/copy';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/info/relics/', props);
}


type RelicsPageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function RelicsPage({
  searchParams,
}: {
  searchParams?: Promise<RelicsPageSearchParams>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const initialData = await loadServerRelics(locale, { throwOnNotFound: false, selectedId:firstParam(params.relic), selectedCollection:firstParam(params.server) || undefined });

  const serverRaw = firstParam(params.server)?.toLowerCase();
  let serverMode = serverRaw === 'gacha' || serverRaw === 'mmo' ? serverRaw : null;
  const relicRaw = (firstParam(params.relic) || '').trim();
  const selectedRelicId = relicRaw || null;
  // Resolve the pool from the relic itself when the link has no explicit
  // server, so ?relic=<mmo-id> renders the MMO pool on the first paint.
  if (!serverMode && selectedRelicId) {
    const target = selectedRelicId.toLowerCase();
    const pools = [
      { mode: 'gacha', items: (initialData as any)?.gacha || [] },
      { mode: 'mmo', items: (initialData as any)?.mmo || [] },
    ] as const;
    const found = pools.find(({ items }) =>
      items.some(
        (r: any) =>
          String(r.id || '').toLowerCase() === target ||
          String(r.canonical_id || '').toLowerCase() === target,
      ),
    );
    if (found) serverMode = found.mode;
    else if (/[-_]mmo$/.test(target)) serverMode = 'mmo';
  }

  const parseList = (value: string | string[] | undefined) =>
    (firstParam(value) || '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && part.toLowerCase() !== 'all');

  return (
    <RelicsCatalogView
      initialData={initialData}
      initialLocale={locale}
      initialServerMode={serverMode as 'gacha' | 'mmo' | null}
      initialSearchQuery={firstParam(params.q) || firstParam(params.search) || ''}
      initialElements={parseList(params.elem ?? params.element).map((e) => e.toLowerCase() as any)}
      initialProperties={parseList(params.prop ?? params.property) as any}
      initialSort={firstParam(params.sort)}
      initialSelectedRelicId={selectedRelicId}
    />
  );
}
