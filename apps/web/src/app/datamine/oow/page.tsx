import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { loadServerGameData } from '@/lib/game-data-server';
import type { FceViewProps } from '@/features/datamine/fce/fce-types';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerOowSummary } from '@/features/datamine/data';
import { OowView } from '@/features/datamine/oow';
import { OOW_COPY } from '@/features/datamine/oow';
import type { OowViewProps } from '@/features/datamine/oow/oow-types';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/datamine/oow/', props);
}


export default async function OowPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const modeRaw = first(params.mode);
  const tabRaw = first(params.tab);
  const seasonRaw = Number.parseInt(first(params.s) || '', 10);
  const floorRaw = Number.parseInt(first(params.floor) || '', 10);
  const [initialSummary, effectCatalog, initialBossCards] = await Promise.all([
    loadServerOowSummary(locale, { throwOnNotFound: false }),
    loadServerGameData<OowViewProps['initialEffectCatalog']>(locale, 'oow/effects', { throwOnNotFound: false }),
    loadServerGameData<FceViewProps['initialCards']>('', 'fce-cards', { throwOnNotFound: false }),
  ]);
  // Provenance stays in the generated dataset; the interactive view receives presentation fields only.
  const present = (effects: NonNullable<OowViewProps['initialEffectCatalog']>['modes']['standard']) =>
    effects.map(({ id, name, description, icon }) => ({ id, name, description, icon }));
  const initialEffectCatalog = effectCatalog ? { modes: { standard: present(effectCatalog.modes.standard), mmo: present(effectCatalog.modes.mmo) } } : null;
  return (
    <OowView
      initialSummary={initialSummary}
      initialEffectCatalog={initialEffectCatalog}
      initialBossCards={initialBossCards}
      initialLocale={locale}
      initialMode={modeRaw === 'mmo' ? 'mmo' : null}
      initialTab={tabRaw === 'charts' || tabRaw === 'difficulty' || tabRaw === 'table' ? tabRaw : null}
      initialSeason={Number.isNaN(seasonRaw) ? null : seasonRaw}
      initialFloor={Number.isNaN(floorRaw) ? null : floorRaw}
    />
  );
}
