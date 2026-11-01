import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface ItemsCopy {
  pageTitle: string;
  eyebrow: string;
  title: string;
  metaDescription: string;
  loading: string;
  rendering: string;
  loadError: string;
  rowFilterAria: string;
  all: string;
  renamed: string;
  searchPlaceholder: string;
  clearSearch: string;
  itemSourceAria: string;
  gacha: string;
  mmo: string;
  num: string;
  icon: string;
  id: string;
  name: string;
  description: string;
  original: string;
  rename: string;
  noRows: string;
  matches: string;
  rows: string;
  copied: string;
  copyFailed: string;
  copyIdTitle: string;
  exportJson: string;
  exportJsonAria: string;
  exportedToast: string;
  loadAll: string;
  stopLoading: string;
  sortAscending: string;
  sortDescending: string;
  viewImage: string;
}

export const ITEMS_COPY: Record<Locale, (Record<'en' | 'ru', ItemsCopy>)['en']> = createLocaleCopies(({
  en: {
    pageTitle: 'ToF | Items',
    eyebrow: 'ITEMS',
    title: 'Item ID database',
    metaDescription: 'Search 12,855 Tower of Fantasy item IDs, developer names, and translated labels.',
    loading: 'Loading...',
    rendering: 'Rendering...',
    loadError: 'Load error',
    rowFilterAria: 'Row filter',
    all: 'All',
    renamed: 'Renamed',
    searchPlaceholder: 'Search by ID, name, original, description, or translation',
    clearSearch: 'Clear search',
    itemSourceAria: 'Item source',
    gacha: 'Gacha',
    mmo: 'MMO',
    num: 'NUM',
    icon: 'ICON',
    id: 'ID',
    name: 'NAME',
    description: 'DESCRIPTION',
    original: 'ORIGINAL',
    rename: 'RENAME',
    noRows: 'No rows match the current filter.',
    matches: 'matches',
    rows: 'rows',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    copyIdTitle: 'Click to copy ID',
    exportJson: 'Export JSON',
    exportJsonAria: 'Export current Items dataset as JSON',
    exportedToast: 'JSON exported',
    loadAll: 'Load all',
    stopLoading: 'Stop loading',
    sortAscending: 'ascending',
    sortDescending: 'descending',
    viewImage: 'View full-size image',
  },
  ru: {
    pageTitle: 'TOF — база идентификаторов предметов',
    eyebrow: 'ITEMS',
    title: 'Идентификаторы предметов',
    metaDescription: 'Поиск по 12 855 ID предметов Tower of Fantasy, техническим именам и переводам.',
    loading: 'Загрузка...',
    rendering: 'Отрисовка...',
    loadError: 'Ошибка загрузки',
    rowFilterAria: 'Фильтр строк',
    all: 'Все',
    renamed: 'Переименованные',
    searchPlaceholder: 'Поиск по ID, имени, оригиналу, описанию или переводу',
    clearSearch: 'Очистить поиск',
    itemSourceAria: 'Источник предметов',
    gacha: 'Gacha',
    mmo: 'MMO',
    num: 'NUM',
    icon: 'ИКОНКА',
    id: 'ID',
    name: 'NAME',
    description: 'ОПИСАНИЕ',
    original: 'ORIGINAL',
    rename: 'RENAME',
    noRows: 'Для текущего фильтра нет строк.',
    matches: 'совпадений',
    rows: 'строк',
    copied: 'Скопировано',
    copyFailed: 'Не удалось скопировать',
    copyIdTitle: 'Нажмите, чтобы скопировать ID',
    exportJson: 'Скачать JSON',
    exportJsonAria: 'Скачать текущий набор предметов в JSON',
    exportedToast: 'JSON скачан',
    loadAll: 'Загрузить всё',
    stopLoading: 'Остановить загрузку',
    sortAscending: 'по возрастанию',
    sortDescending: 'по убыванию',
    viewImage: 'Открыть изображение полностью',
  },
}) satisfies Pick<Record<'en' | 'ru', ItemsCopy>, 'en' | 'ru'>);
