import { FEEDBACK_PATHS, SITE_PAGE_COPY } from '@tof-hub/config';
import { localizedUi, type Locale } from '@tof-hub/i18n';
import { INFO_NAV_ITEMS, DATAMINE_NAV_ITEMS, TOOLS_NAV_ITEMS, MAIN_NAV_ITEMS } from '@/components/site-shell/site-navigation';

export type FeedbackPageTarget = { path: string; label: string; group: number };
const readingLabels: Record<string, { en: string; ru: string }> = {
  '/': { en: 'Home', ru: 'Главная' }, '/about/': { en: 'About the data', ru: 'О данных сайта' },
  '/changelog/': { en: 'Changelog', ru: 'История изменений' }, '/contribute/': { en: 'Contribute', ru: 'Помощь проекту' },
  '/privacy/': { en: 'Privacy', ru: 'Конфиденциальность' },
  '/projects/': { en: 'ToF resources', ru: 'Ресурсы ToF' },
  '/tools/build/mmo/': { en: 'MMO build card', ru: 'Карточка билда MMO' },
  '/info/simulacra/changelog/': { en: 'Simulacra changelog', ru: 'История изменений симулякров' },
  '/datamine/multype/guide/': { en: 'Damage type guide', ru: 'Руководство по типам урона' },
};

export function pageTargets(locale: Locale): FeedbackPageTarget[] {
  const navigation = [...INFO_NAV_ITEMS, ...DATAMINE_NAV_ITEMS, ...TOOLS_NAV_ITEMS, ...MAIN_NAV_ITEMS];
  return FEEDBACK_PATHS.map(path => {
    const nav = navigation.find(item => `${item.href}/` === path);
    const copy = readingLabels[path] ?? nav?.label ?? { en: SITE_PAGE_COPY[path as keyof typeof SITE_PAGE_COPY][0] };
    return { path, label: localizedUi(copy, locale), group: path.startsWith('/info/') ? 1 : path.startsWith('/datamine/') ? 2 : path.startsWith('/tools/') ? 3 : 0 };
  });
}
