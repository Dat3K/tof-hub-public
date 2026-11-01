import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
import type { VersionStatusLabels } from './types';

export const VERSION_STATUS_STRINGS: Record<Locale, ({ en: VersionStatusLabels; ru: VersionStatusLabels })['en']> = createLocaleCopies(({
  en: {
    version: 'Version:',
    versionUnavailable: 'Version unavailable',
    loading: 'Loading...',
    snapshot: 'Dataset snapshot',
    tooltipTitle: 'Export details',
    updated: 'Updated',
    sources: 'Sources',
    global: 'Global',
    updateAvailable: 'UPDATE AVAILABLE',
    updateNotice: (v: string) => `Global ${v} is newer than the game data currently on this site.`,
    updateHelpText:
      'You can help update the site’s game data. It takes about 30 minutes and requires an installed PC copy of Tower of Fantasy.',
    howToHelp: 'How to help →',
    howToHelpHref: '/contribute/#regular',
  },
  ru: {
    version: 'Версия:',
    versionUnavailable: 'Версия недоступна',
    loading: 'Загрузка...',
    snapshot: 'Снимок данных',
    tooltipTitle: 'Данные экспорта',
    updated: 'Обновлено',
    sources: 'Источники',
    global: 'Global',
    updateAvailable: 'ДОСТУПНО ОБНОВЛЕНИЕ',
    updateNotice: (v: string) => `Global ${v} новее игровых данных, которые сейчас используются на сайте.`,
    updateHelpText:
      'Вы можете помочь обновить игровые данные сайта. Это займёт около 30 минут; для этого нужна установленная версия Tower of Fantasy для ПК.',
    howToHelp: 'Как помочь →',
    howToHelpHref: '/contribute/#regular',
  },
}) satisfies Pick<{ en: VersionStatusLabels; ru: VersionStatusLabels }, 'en' | 'ru'>);
