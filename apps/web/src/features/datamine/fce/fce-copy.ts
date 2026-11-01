import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
import type { FceCopyTable } from './fce-types';

export const FCE_COPY: Record<Locale, (Record<'en' | 'ru', FceCopyTable>)['en']> = createLocaleCopies(({
  en: {
    brand: 'Boss Mechanics',
    eyebrow: 'DATAMINE · BOSSES',
    title: 'Boss mechanics archive',
    metaDescription: 'Browse 36 bosses with concise mechanic cards in English and Russian. Export any guide as a PNG.',
    gameMode: 'GAME MODE',
    mmoMode: 'MMO',
    download: 'Download PNG',
    rendering: 'Rendering...',
    downloadAria: 'Download current boss card as PNG',
    loading: 'Loading boss card...',
    noBoss: 'No boss selected.',
    loadError: 'Could not load boss list.',
    bossLoadError: 'Could not load this boss.',
    retry: 'Retry',
    downloadError: 'Could not render the card for download.',
  },
  ru: {
    brand: 'Механики боссов',
    eyebrow: 'ДАТАМАЙН · БОССЫ',
    title: 'Архив механик боссов',
    metaDescription: '36 боссов с краткими карточками механик на английском и русском. Экспорт любого гайда в PNG.',
    gameMode: 'РЕЖИМ ИГРЫ',
    mmoMode: 'MMO',
    download: 'Скачать PNG',
    rendering: 'Рендер...',
    downloadAria: 'Скачать текущую карточку босса в формате PNG',
    loading: 'Загрузка карточки босса...',
    noBoss: 'Босс не выбран.',
    loadError: 'Не удалось загрузить список боссов.',
    bossLoadError: 'Не удалось загрузить этого босса.',
    retry: 'Повторить',
    downloadError: 'Не удалось подготовить изображение для скачивания.',
  },
}) satisfies Pick<Record<'en' | 'ru', FceCopyTable>, 'en' | 'ru'>);
