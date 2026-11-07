import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface ToolsHubCopy {
  title: string;
  subtitle: string;
  sectionsAria: string;
  openPage: string;
  latestBanner: string;
  ranking: {
    title: string;
    description: string;
    players: string;
    elementsLabel: string;
    topLabel: string;
    loading: string;
    error: string;
    empty: string;
    verified: string;
    boardsLabel: string;
    gearBoard: string;
  };
  build: { title: string; description: string; weapons: string; stats: string; equipment: string };
  optimizer: { title: string; description: string; weights: string; stat: string; minRoll: string; maxRoll: string };
  /** Role chips of the Comp preview and the Ranking role boards, by Comp squad role. */
  roles: { dps: string; tank: string; healer: string; balance: string };
  wish: {
    title: string;
    description: string;
    shortcutsLabel: string;
    shortcuts: {
      history: { title: string; description: string };
      overview: { title: string; description: string };
      simulation: { title: string; description: string };
    };
  };
  comp: { title: string; description: string };
  tradeStation: { title: string; description: string };
}

export const TOOLS_HUB_COPY: Record<Locale, (Record<'en' | 'ru', ToolsHubCopy>)['en']> = createLocaleCopies(({
  en: {
    title: 'Tower of Fantasy tools',
    subtitle: 'Gear ranking, build cards, gear optimizer, wish tracker and team compositions.',
    sectionsAria: 'Tools',
    openPage: 'Open tool',
    latestBanner: 'Latest banner',
    ranking: {
      title: 'Ranking',
      description: 'Best gear and builds by Global Roll Value for every element and element pair.',
      players: 'players',
      elementsLabel: 'Element boards',
      topLabel: 'Top DPS · all elements',
      loading: 'Loading the leaderboard…',
      error: 'The ranking is unavailable right now.',
      empty: 'No ranked players yet.',
      verified: 'Verified player',
      boardsLabel: 'Role and gear boards',
      gearBoard: 'Gear board',
    },
    build: {
      title: 'Build card',
      description: 'Weapons, matrices, combat stats, gear, relics and supercomputing in one shareable card.',
      weapons: 'Weapons & matrices',
      stats: 'Combat stats',
      equipment: 'Equipment',
    },
    optimizer: {
      title: 'Gear optimizer',
      description: 'Compare personal gear value and damage after replacement and Titan transfer.',
      weights: 'Stat weights · PRV',
      stat: 'Stat',
      minRoll: 'Min. roll',
      maxRoll: 'Max. roll',
    },
    roles: { dps: 'DPS', tank: 'Tank', healer: 'Healer', balance: 'Balance' },
    wish: {
      title: 'Wish Tracker',
      description: 'Special Orders pull history, pity, 50/50 streaks and pull simulation.',
      shortcutsLabel: 'Wish Tracker shortcuts',
      shortcuts: {
        history: { title: 'Pull history', description: 'Review orders by banner' },
        overview: { title: 'Pity overview', description: 'Check pity and 50/50' },
        simulation: { title: 'Simulator', description: 'Test a pull plan' },
      },
    },
    comp: { title: 'Comp showcase', description: 'Squad and raid compositions with simulacra, matrices and relics.' },
    tradeStation: { title: 'Trade Station', description: 'Which items can be listed, their reference price and the allowed price band.' },
  },
  ru: {
    title: 'Инструменты Tower of Fantasy',
    subtitle: 'Рейтинг гира, карточки билдов, оптимайзер, трекер круток и составы отрядов.',
    sectionsAria: 'Инструменты',
    openPage: 'Открыть',
    latestBanner: 'Последний баннер',
    ranking: {
      title: 'Рейтинг',
      description: 'Лучшие вещи и билды по Global Roll Value для каждой стихии и пары стихий.',
      players: 'игроков',
      elementsLabel: 'Рейтинги стихий',
      topLabel: 'Топ DPS · все стихии',
      loading: 'Загрузка рейтинга…',
      error: 'Рейтинг сейчас недоступен.',
      empty: 'В рейтинге пока нет игроков.',
      verified: 'Проверенный игрок',
      boardsLabel: 'Рейтинги ролей и гира',
      gearBoard: 'Рейтинг гира',
    },
    build: {
      title: 'Карточка билда',
      description: 'Оружие, матрицы, боевые статы, гир, реликвии и суперкомпьютер в одной карточке, которой можно поделиться.',
      weapons: 'Оружие и матрицы',
      stats: 'Боевые статы',
      equipment: 'Экипировка',
    },
    optimizer: {
      title: 'Оптимайзер гира',
      description: 'Сравнение гира по персональному PRV и урону после замены и переноса титана.',
      weights: 'Веса статов · PRV',
      stat: 'Стат',
      minRoll: 'Мин. ролл',
      maxRoll: 'Макс. ролл',
    },
    roles: { dps: 'DPS', tank: 'Танк', healer: 'Хил', balance: 'Баланс' },
    wish: {
      title: 'Крутки',
      description: 'История круток спецзаказов, гарант, серии 50/50 и симуляция.',
      shortcutsLabel: 'Разделы трекера круток',
      shortcuts: {
        history: { title: 'История круток', description: 'Заказы по баннерам' },
        overview: { title: 'Гарант и 50/50', description: 'Текущий прогресс' },
        simulation: { title: 'Симулятор', description: 'Проверь план круток' },
      },
    },
    comp: { title: 'Конструктор', description: 'Составы отрядов и рейдов с симулякрами, матрицами и реликвиями.' },
    tradeStation: { title: 'Торговая станция', description: 'Что можно выставить, базовая цена и допустимый диапазон цен.' },
  },
}) satisfies Pick<Record<'en' | 'ru', ToolsHubCopy>, 'en' | 'ru'>);
