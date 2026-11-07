export interface NavItem { id: string; href: string; label: {en: string; ru: string} }

export const INFO_NAV_ITEMS: NavItem[] = [
  { id: 'simulacra', href: '/info/simulacra', label: { en: 'Simulacra', ru: 'Симулякры' } },
  { id: 'matrices', href: '/info/matrices', label: { en: 'Matrices', ru: 'Матрицы' } },
  { id: 'relics', href: '/info/relics', label: { en: 'Relics', ru: 'Реликвии' } },
  { id: 'pets', href: '/info/pets', label: { en: 'Pets', ru: 'Питомцы' } },
  { id: 'food', href: '/info/food', label: { en: 'Food', ru: 'Еда' } },
  { id: 'cosmetics', href: '/info/cosmetics', label: { en: 'Cosmetics', ru: 'Косметика' } },
  { id: 'arts', href: '/info/arts', label: { en: 'Arts', ru: 'Арты' } },
];

export const DATAMINE_NAV_ITEMS: NavItem[] = [
  { id: 'oow', href: '/datamine/oow', label: { en: 'Origin of War', ru: 'Истоки войны' } },
  { id: 'fce', href: '/datamine/fce', label: { en: 'Bosses', ru: 'Боссы' } },
  { id: 'bygone', href: '/datamine/bygone', label: { en: 'Bygone', ru: 'Былой фантазм' } },
  { id: 'seq', href: '/datamine/seq', label: { en: 'Sequential', ru: 'Последовательность' } },
  { id: 'raids', href: '/datamine/raids', label: { en: 'Raids', ru: 'Рейды' } },
  { id: 'handbook', href: '/datamine/handbook', label: { en: 'Handbook', ru: 'Пособие' } },
  { id: 'multype', href: '/datamine/multype', label: { en: 'Multype', ru: 'Multype' } },
  { id: 'items', href: '/datamine/items', label: { en: 'Items', ru: 'Предметы' } },
];

export const TOOLS_NAV_ITEMS: NavItem[] = [
  { id: 'ranking', href: '/tools/ranking', label: { en: 'Ranking', ru: 'Рейтинг' } },
  { id: 'build', href: '/tools/build', label: { en: 'Build card', ru: 'Карточка билда' } },
  { id: 'optimizer', href: '/tools/optimizer', label: { en: 'Gear optimizer', ru: 'Оптимайзер гира' } },
  { id: 'wish', href: '/tools/wish', label: { en: 'Wish Tracker', ru: 'Крутки' } },
  { id: 'comp', href: '/tools/comp', label: { en: 'Comp showcase', ru: 'Конструктор' } },
  { id: 'trade-station', href: '/tools/trade-station', label: { en: 'Trade Station', ru: 'Торговая станция' } },
];


export const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'info', href: '/info', label: { en: 'Info', ru: 'База знаний' } },
  { id: 'tools', href: '/tools', label: { en: 'Tools', ru: 'Инструменты' } },
  { id: 'datamine', href: '/datamine', label: { en: 'Datamine', ru: 'Датамайн' } },
];
