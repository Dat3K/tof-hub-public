import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { cache } from 'react';
import type { Locale } from '@tof-hub/i18n';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerSimulacra } from '@/lib/game-data-server';
import { SimulacraCatalogView } from '@/features/simulacra';
import type { SimulacraDataset, SimulacraDatasetItemRaw } from '@tof-hub/contracts';

const getSimulacraDataset = cache((locale: Locale) =>
  loadServerSimulacra(locale, { throwOnNotFound: false }),
);


function matchesCharacter(item: SimulacraDatasetItemRaw, id: string): boolean {
  const raw = item as any;
  return [item.id, raw.slug, raw.canonical_id].some(value => String(value || '').toLowerCase() === id.toLowerCase());
}

type SimulacraPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value.length > 0 ? value[0] ?? null : null;
  return value ?? null;
}

// Mirror the client catalog's URL parsing so the SSR HTML and the first
// client render already reflect shared filter links (?server=&q=&elem=&
// role=&sort=&char=) instead of loading defaults and correcting after mount.
function parseSimulacraSearchParams(params: Record<string, string | string[] | undefined>) {
  const serverRaw = firstParam(params.server)?.toLowerCase();
  const serverMode = serverRaw === 'gacha' || serverRaw === 'mmo' ? serverRaw : null;

  const searchQuery = firstParam(params.q) ?? firstParam(params.search) ?? '';

  const parseList = (value: string | string[] | undefined) =>
    (firstParam(value) ?? '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

  return {
    serverMode,
    searchQuery,
    elements: parseList(params.elem ?? params.element),
    roles: parseList(params.role ?? params.reso),
    sort: firstParam(params.sort),
  };
}

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/info/simulacra/', props);
}

export default function SimulacraPage(): Promise<any>;
export default function SimulacraPage(props: SimulacraPageProps): Promise<any>;
export default async function SimulacraPage({
  searchParams,
}: SimulacraPageProps = {}) {
  const { locale } = await resolveServerLocale();
  const params = (await searchParams) || {};
  const rawChar = firstParam(params.char);
  const selectedId = rawChar?.trim() ? rawChar.trim() : null;
  const filters = parseSimulacraSearchParams(params);
  // When the link selects a character without an explicit server, resolve
  // the roster from the character edition so the detail payload and the
  // first paint agree (avoids a gacha→mmo refetch after mount).
  let serverMode = filters.serverMode;
  if (!serverMode && selectedId) {
    const data = await getSimulacraDataset(locale);
    const match = [...(data?.gacha || []), ...(data?.mmo || []), ...(data?.items || [])]
      .find((item) => matchesCharacter(item, selectedId));
    const edition = String(
      (match as any)?.server_mode || (match as any)?.edition || '',
    ).toLowerCase();
    if (edition === 'mmo' || edition === 'gacha') serverMode = edition;
    else if (selectedId.toLowerCase().endsWith('-mmo')) serverMode = 'mmo';
  }
  const initialData = await loadServerSimulacra(locale, {throwOnNotFound:false, selectedId, selectedCollection:serverMode || undefined});

  return (
    <SimulacraCatalogView
      initialData={initialData}
      initialLocale={locale}
      initialSelectedCharId={selectedId}
      initialServerMode={serverMode as 'gacha' | 'mmo' | null}
      initialSearchQuery={filters.searchQuery}
      initialElements={filters.elements}
      initialRoles={filters.roles}
      initialSort={filters.sort}
    />
  );
}
