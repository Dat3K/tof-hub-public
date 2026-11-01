import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
import type { HandbookSectionId } from '../contracts/handbook';

export interface HandbookCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  navAria: string;
  modeAria: string;
  gachaLabel: string;
  mmoLabel: string;
  sourceTitle: string;
  sourceIntro: string;
  methodTitle: string;
  rawFilesTitle: string;
  close: string;
  unavailableTitle: string;
  unavailableBody: string;
  sections: Record<HandbookSectionId, { nav: string; title: string }>;
}

export const HANDBOOK_COPY: Record<Locale, (Record<'en' | 'ru', HandbookCopy>)['en']> = createLocaleCopies(({
  en: {
    eyebrow: 'Handbook',
    title: 'Game systems handbook',
    subtitle: 'Gear stats, Titan, CS, upgrade costs and formulas from the game files.',
    navAria: 'Handbook sections',
    modeAria: 'Server mode',
    gachaLabel: 'Gacha',
    mmoLabel: 'MMO',
    sourceTitle: 'Where the data comes from',
    sourceIntro: 'Every number in this section is generated from the game files by the data pipeline; nothing is typed in by hand.',
    methodTitle: 'How it is calculated',
    rawFilesTitle: 'Game files (raw export)',
    close: 'Close',
    unavailableTitle: 'No data yet',
    unavailableBody: 'This section’s generated data is not available on the server.',
    sections: {
      'random-stats': {
        nav: 'Gear stats',
        title: 'Gear stats',
      },
      titan: {
        nav: 'Titan',
        title: 'Titan',
      },
      cs: {
        nav: 'CS',
        title: 'Combat Score',
      },
      enhancement: {
        nav: 'Enhancement',
        title: 'Gear enhancement',
      },
      supercomputer: {
        nav: 'Supercomputer',
        title: 'Supercomputer',
      },
      suppressor: {
        nav: 'Suppressor',
        title: 'Suppressor',
      },
      expansion: {nav: 'Expansion Packs', title: 'Expansion Packs · MMO'},
      brainfield: {
        nav: 'Brainfield',
        title: 'Brainfield · MMO',
      },
      'space-support': {
        nav: 'Space Support',
        title: 'Space Support',
      },
      'combat-formulas': {
        nav: 'Formulas',
        title: 'Combat formulas',
      },
      servers: {
        nav: 'Servers',
        title: 'Servers and UID',
      },
    },
  },
  ru: {
    eyebrow: 'Пособие',
    title: 'Пособие по игровым системам',
    subtitle: 'Статы гира, Titan, CS, стоимость прокачки и формулы из файлов игры.',
    navAria: 'Разделы пособия',
    modeAria: 'Режим сервера',
    gachaLabel: 'Gacha',
    mmoLabel: 'MMO',
    sourceTitle: 'Откуда данные',
    sourceIntro: 'Все числа раздела сгенерированы пайплайном из файлов игры; ничего не вписано вручную.',
    methodTitle: 'Как считается',
    rawFilesTitle: 'Файлы игры (raw-экспорт)',
    close: 'Закрыть',
    unavailableTitle: 'Данных пока нет',
    unavailableBody: 'Сгенерированные данные этого раздела недоступны на сервере.',
    sections: {
      'random-stats': {
        nav: 'Статы гира',
        title: 'Статы гира',
      },
      titan: {
        nav: 'Titan',
        title: 'Titan',
      },
      cs: {
        nav: 'CS',
        title: 'Боевой рейтинг (CS)',
      },
      enhancement: {
        nav: 'Усиление',
        title: 'Усиление гира',
      },
      supercomputer: {
        nav: 'Суперкомпьютер',
        title: 'Суперкомпьютер',
      },
      suppressor: {
        nav: 'Супрессор',
        title: 'Супрессор',
      },
      expansion: {nav: 'Пакеты расширения', title: 'Пакеты расширения · MMO'},
      brainfield: {
        nav: 'Нейронная цепь',
        title: 'Мозговое поле · MMO',
      },
      'space-support': {
        nav: 'Space Support',
        title: 'Space Support',
      },
      'combat-formulas': {
        nav: 'Формулы',
        title: 'Формулы боя',
      },
      servers: {
        nav: 'Серверы',
        title: 'Серверы и UID',
      },
    },
  },
}) satisfies Pick<Record<'en' | 'ru', HandbookCopy>, 'en' | 'ru'>);
