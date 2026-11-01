import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerBygone, loadServerOowSummary } from '@/features/datamine/data';
import { BygoneView } from '@/features/datamine/bygone';
import { loadServerGameData } from '@/lib/game-data-server';
import type { HandbookMmoBygoneData, HandbookMmoBygoneMedia } from '@/features/datamine/contracts/handbook';
import { MmoBygoneView } from '@/features/datamine/bygone/mmo-bygone-view';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/datamine/bygone/', props);
}


export default async function BygonePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const server = Array.isArray(params.server) ? params.server[0] : params.server;
  if (mode === 'mmo' || server === 'mmo') {
    const [data, media, presentation] = await Promise.all([
      loadServerGameData<HandbookMmoBygoneData | null>('handbook', 'mmo-bygone', { throwOnNotFound: false }),
      loadServerGameData<HandbookMmoBygoneMedia | null>('handbook', 'mmo-bygone-media', { throwOnNotFound: false }),
      loadServerOowSummary(locale, { throwOnNotFound: false }),
    ]);
    return <MmoBygoneView combatIcons={presentation?.statIcons} data={data} portraits={media?.portraits} identities={media?.identities} selection={{season: first(params.season), floor: first(params.floor)}} />;
  }
  const themeRaw = Array.isArray(params.chartTheme) ? params.chartTheme[0] : params.chartTheme;
  const initialData = await loadServerBygone(locale, { throwOnNotFound: false });

  return (
    <BygoneView
      initialData={initialData}
      initialLocale={locale}
      initialChartTheme={themeRaw === 'light' || themeRaw === 'dark' ? themeRaw : null}
    />
  );
}
