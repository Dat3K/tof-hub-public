import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerPets } from '@/lib/game-data-server';
import { PetsCatalogView } from '@/features/info-sections/pets';
import { getPetsStrings } from '@/features/info-sections/pets/copy';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/info/pets/', props);
}


export default async function PetsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const initialData = await loadServerPets(locale, { throwOnNotFound: false, selectedId:first(params.pet) });

  const serverRaw = first(params.server)?.toLowerCase();
  let serverMode = serverRaw === 'gacha' || serverRaw === 'mmo' ? serverRaw : null;
  const categoryRaw = first(params.category) || first(params.cat) || first(params.tab);
  const petRaw = (first(params.pet) || '').trim();
  // Resolve the pool from the pet itself when the link has no explicit
  // server, so MMO pet links render the MMO pool on the first paint.
  if (!serverMode && petRaw) {
    const target = petRaw.toLowerCase();
    const items = ((initialData as any)?.items || (initialData as any)?.pets || []) as any[];
    const match = items.find((p) => String(p.id || '').toLowerCase() === target);
    if (match) {
      serverMode =
        match.source_edition === 'mmo' || String(match.id || '').toLowerCase().startsWith('mmo_')
          ? 'mmo'
          : 'gacha';
    } else if (target.startsWith('mmo_')) serverMode = 'mmo';
  }

  const modRaw = first(params.module) || first(params.mod);
  const parseList = (value: string | string[] | undefined) =>
    (first(value) || '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part && part !== 'all');

  return (
    <PetsCatalogView
      initialData={initialData}
      initialLocale={locale}
      initialCategory={categoryRaw === 'modules' ? 'modules' : null}
      initialServerMode={serverMode as 'gacha' | 'mmo' | null}
      initialSearchQuery={first(params.q) || first(params.search) || ''}
      initialElements={parseList(params.elem ?? params.element) as any}
      initialModuleFilter={modRaw === 'universal' || modRaw === 'exclusive' ? modRaw : null}
      initialSort={first(params.sort)}
      initialSelectedPetId={petRaw || null}
      initialSelectedModuleId={first(params.module)}
    />
  );
}
