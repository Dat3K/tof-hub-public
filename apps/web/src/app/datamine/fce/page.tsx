import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { loadServerGameData } from '@/lib/game-data-server';
import type { FceViewProps } from '@/features/datamine/fce/fce-types';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerFceIndex, loadServerOowSummary } from '@/features/datamine/data';
import { FceView } from '@/features/datamine/fce';
import { FCE_COPY } from '@/features/datamine/fce';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/datamine/fce/', props);
}


export default async function FcePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const modeRaw = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const initialData = await loadServerFceIndex(locale, { throwOnNotFound: false });

  const initialCards = await loadServerGameData<FceViewProps['initialCards']>('', 'fce-cards', {throwOnNotFound: false});
  const oowPresentation = await loadServerOowSummary(locale, { throwOnNotFound: false });
  return (
    <FceView
      initialData={initialData}
      initialCards={initialCards}
      initialLocale={locale}
      initialMode={modeRaw === 'mmo' ? 'mmo' : null}
      initialBoss={typeof params.boss === 'string' ? params.boss : null}
      statIcons={oowPresentation?.statIcons}
    />
  );
}
