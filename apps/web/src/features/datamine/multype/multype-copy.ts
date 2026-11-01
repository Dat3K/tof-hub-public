import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface MultypeCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  loadingTitle: string;
  loadingBody: string;
  loadError: string;
  source: string;
  sourceFile: string;
  total: string;
  categories: string;
  subcategories: string;
  buffs: string;
  exportJson: string;
  exportJsonAria: string;
  openJson: string;
  viewSource: string;
  renamed: string;
  combined: string;
  datamined: string;
  aiGuess: string;
  search: string;
  searchPlaceholder: string;
  clearSearch: string;
  main: string;
  sub: string;
  allMain: string;
  allSub: string;
  all: string;
  renamedOnly: string;
  unrenamedOnly: string;
  emptyTitle: string;
  emptyBody: string;
  subColumns: string;
  files: string;
  zoomOut: string;
  zoomIn: string;
  zoomFit: string;
  zoomFitTitle: string;
  zoomResetTitle: string;
  resetFilters: string;
  filtersActive: string;
  focusTable: string;
  displayMode: string;
  renameStatus: string;
  elementCategory: string;
  elemAll: string;
  elemFinal: string;
  elemFire: string;
  elemIce: string;
  elemVolt: string;
  elemPhys: string;
  elemSuper: string;
  tableScale: string;
  exportImage: string;
  exportTableImage: string;
  currentFilteredTable: string;
  closeExport: string;
  exportQuality: string;
  palette: string;
  paletteLight: string;
  paletteDark: string;
  output: string;
  canvas: string;
  estimatedPng: string;
  raw: string;
  exportPng: string;
  exportPreparing: string;
  exportRendering: string;
  exportEncoding: string;
  exportReady: string;
  exportComplete: string;
  exportNothing: string;
  exportTooLarge: string;
  exportNarrow: string;
  exportMeasureError: string;
  exportRendererError: string;
  exportBlobError: string;
  guideButton: string;
  guideTitle: string;
  copyOriginalAria: string;
  copiedOriginal: string;
  copyOriginalFailed: string;
  datasetVersion: string;
  versionUnavailable: string;
  popoverTitle: string;
  datasetKey: string;
  globalKey: string;
  updateAvailable: string;
  updateNotice: string;
  updateDesc: string;
  timeWarning: string;
  howToHelp: string;
  manualRename: string;
  generalCategory: string;
  aiMatchExact: string;
  aiMatchStrong: string;
  aiMatchPartial: string;
  aiSourceFiles: string;
  aiMatrixSet: string;
}

export const MULTYPE_COPY: Record<Locale, (Record<'en' | 'ru', MultypeCopy>)['en']> = createLocaleCopies(({
  en: {
    eyebrow: 'MULTYPE',
    title: 'Multiplicative buffs',
    subtitle:
      'Buff grouping and multiplier data. Columns multiply with each other; values in the same column are additive.',
    loadingTitle: 'Loading datamine JSON...',
    loadingBody: 'Building the Main / Sub / Value model and rename dictionary.',
    loadError: 'Load error',
    source: 'Source',
    sourceFile: 'Source file',
    total: 'Total',
    categories: 'categories',
    subcategories: 'subcategories',
    buffs: 'buffs',
    exportJson: 'Export JSON',
    exportJsonAria: 'Export full module_extra_to_files_mapping3.json dataset as JSON',
    openJson: 'Open local JSON',
    viewSource: 'View exporter source',
    renamed: 'Renamed',
    combined: 'Combined',
    datamined: 'Datamined',
    aiGuess: 'AI guess',
    search: 'Search',
    searchPlaceholder: 'Search original keys or renamed labels...',
    clearSearch: 'Clear search',
    main: 'Main',
    sub: 'Sub',
    allMain: 'All Main',
    allSub: 'All Sub',
    all: 'All',
    renamedOnly: 'Renamed only',
    unrenamedOnly: 'Unrenamed only',
    emptyTitle: 'Nothing matched',
    emptyBody: 'Try another mode, clear filters, or remove the search query.',
    subColumns: 'sub columns',
    files: 'files',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    zoomFit: 'Fit',
    zoomFitTitle: 'Fit table to width',
    zoomResetTitle: 'Click to reset to 100%',
    resetFilters: 'Reset filters',
    filtersActive: 'filters active',
    focusTable: 'Focus table',
    displayMode: 'Display',
    renameStatus: 'Rename status',
    elementCategory: 'Element',
    elemAll: 'All',
    elemFinal: 'Final',
    elemFire: 'Flame',
    elemIce: 'Frost',
    elemVolt: 'Volt',
    elemPhys: 'Physical',
    elemSuper: 'Altered',
    tableScale: 'Table scale',
    exportImage: 'Export image',
    exportTableImage: 'Export table image',
    currentFilteredTable: 'Current filtered table',
    closeExport: 'Close export',
    exportQuality: 'Quality',
    palette: 'Palette',
    paletteLight: 'Light',
    paletteDark: 'Dark',
    output: 'Output',
    canvas: 'Canvas',
    estimatedPng: 'Est. PNG',
    raw: 'raw',
    exportPng: 'Export PNG',
    exportPreparing: 'Preparing table…',
    exportRendering: 'Rendering image…',
    exportEncoding: 'Encoding PNG…',
    exportReady: 'Ready to export.',
    exportComplete: 'PNG downloaded.',
    exportNothing: 'Nothing to export for the current filters.',
    exportTooLarge: 'This table is too large to export as a single PNG in this browser.',
    exportNarrow: 'Choose a lower quality or narrow the table using the available filters.',
    exportMeasureError: 'Could not measure the table for export.',
    exportRendererError: 'Could not render the table image.',
    exportBlobError: 'Could not encode the PNG.',
    guideButton: 'README (GUIDE)',
    guideTitle: 'README (Buff stacking & multipliers guide)',
    copyOriginalAria: 'Copy original key: {key}',
    copiedOriginal: 'Copied original key: {key}',
    copyOriginalFailed: 'Could not copy the original key.',
    datasetVersion: 'Dataset version',
    versionUnavailable: 'Version information is unavailable',
    popoverTitle: 'Dataset details',
    datasetKey: 'Dataset',
    globalKey: 'Global',
    updateAvailable: 'Update available',
    updateNotice: 'Global version is newer than this Multype dataset.',
    updateDesc: 'Refreshing Multype requires a full game export and a large-scale modifier scan.',
    timeWarning: '~2 hours required',
    howToHelp: 'How to help →',
    manualRename: 'Manual rename',
    generalCategory: 'General / No Category',
    aiMatchExact: 'exact ID match',
    aiMatchStrong: 'strong ID match',
    aiMatchPartial: 'partial ID match',
    aiSourceFiles: 'Source buff files',
    aiMatrixSet: 'Set',
  },
  ru: {
    eyebrow: 'MULTYPE',
    title: 'Мультипликативные усиления',
    subtitle:
      'Группировка усилений и коэффициенты. Разные столбцы перемножаются, а значения внутри одного столбца складываются.',
    loadingTitle: 'Загрузка данных...',
    loadingBody: 'Формируем структуру Main / Sub / Value и словарь переименований.',
    loadError: 'Ошибка загрузки',
    source: 'Источник',
    sourceFile: 'Исходный файл',
    total: 'Всего',
    categories: 'категорий',
    subcategories: 'подкатегорий',
    buffs: 'усилений',
    exportJson: 'Экспорт JSON',
    exportJsonAria: 'Скачать полный файл module_extra_to_files_mapping3.json в формате JSON',
    openJson: 'Открыть локальный JSON',
    viewSource: 'Открыть источник экспортёра',
    renamed: 'Переименованные',
    combined: 'Вместе',
    datamined: 'Исходные',
    aiGuess: 'Догадка AI',
    search: 'Поиск',
    searchPlaceholder: 'Поиск по исходным ключам и новым названиям...',
    clearSearch: 'Очистить поиск',
    main: 'Main',
    sub: 'Sub',
    allMain: 'Все Main',
    allSub: 'Все Sub',
    all: 'Все',
    renamedOnly: 'Только переименованные',
    unrenamedOnly: 'Без переименования',
    emptyTitle: 'Ничего не найдено',
    emptyBody: 'Смените режим, сбросьте фильтры или очистите поисковый запрос.',
    subColumns: 'подкатегорий',
    files: 'файлов',
    zoomOut: 'Уменьшить масштаб',
    zoomIn: 'Увеличить масштаб',
    zoomFit: 'По ширине',
    zoomFitTitle: 'Подогнать таблицу по ширине экрана',
    zoomResetTitle: 'Нажмите для сброса на 100%',
    resetFilters: 'Сбросить фильтры',
    filtersActive: 'активных фильтра',
    focusTable: 'Перейти к таблице',
    displayMode: 'Отображение',
    renameStatus: 'Статус названий',
    elementCategory: 'Элемент',
    elemAll: 'Все',
    elemFinal: 'Финал',
    elemFire: 'Огонь',
    elemIce: 'Лед',
    elemVolt: 'Электро',
    elemPhys: 'Физ.',
    elemSuper: 'Аберрация',
    tableScale: 'Масштаб таблицы',
    exportImage: 'Экспорт изображения',
    exportTableImage: 'Экспорт таблицы',
    currentFilteredTable: 'Текущая отфильтрованная таблица',
    closeExport: 'Закрыть экспорт',
    exportQuality: 'Качество',
    palette: 'Палитра',
    paletteLight: 'Светлая',
    paletteDark: 'Тёмная',
    output: 'Размер',
    canvas: 'Холст',
    estimatedPng: 'Оценочный размер PNG',
    raw: 'без сжатия',
    exportPng: 'Экспорт PNG',
    exportPreparing: 'Подготавливаем таблицу…',
    exportRendering: 'Создаём изображение…',
    exportEncoding: 'Кодируем PNG…',
    exportReady: 'Готово к экспорту.',
    exportComplete: 'PNG скачан.',
    exportNothing: 'При текущих фильтрах экспортировать нечего.',
    exportTooLarge: 'Эта таблица слишком велика для экспорта одним PNG в этом браузере.',
    exportNarrow: 'Выберите качество ниже или сузьте таблицу с помощью фильтров.',
    exportMeasureError: 'Не удалось рассчитать размер таблицы для экспорта.',
    exportRendererError: 'Не удалось создать изображение таблицы.',
    exportBlobError: 'Не удалось закодировать PNG.',
    guideButton: 'README (ГАЙД)',
    guideTitle: 'README (Руководство по стакам баффов)',
    copyOriginalAria: 'Скопировать исходный ключ: {key}',
    copiedOriginal: 'Скопирован исходный ключ: {key}',
    copyOriginalFailed: 'Не удалось скопировать исходный ключ.',
    datasetVersion: 'Версия данных',
    versionUnavailable: 'Информация о версии недоступна',
    popoverTitle: 'Сведения о наборе данных',
    datasetKey: 'Датасет',
    globalKey: 'Global',
    updateAvailable: 'Доступно обновление',
    updateNotice: 'Версия Global новее этого набора данных Multype.',
    updateDesc: 'Обновление Multype требует полного экспорта игры и масштабного сканирования модификаторов.',
    timeWarning: 'Требуется ~2 часа',
    howToHelp: 'Как помочь →',
    manualRename: 'Ручной rename',
    generalCategory: 'Общее / без категории',
    aiMatchExact: 'точное совпадение ID',
    aiMatchStrong: 'сильное совпадение ID',
    aiMatchPartial: 'частичное совпадение ID',
    aiSourceFiles: 'Исходные buff-файлы',
    aiMatrixSet: 'Комплект',
  },
}) satisfies Pick<Record<'en' | 'ru', MultypeCopy>, 'en' | 'ru'>);

export const CATEGORY_LABELS_RU: Record<string, string> = {
  NoModule: 'Без категории',
  ModuleExtraType_Talent: 'Матрицы',
  ModuleExtraType_WeaponActive: 'Оружие (активное)',
  ModuleExtraType_WeaponPassive: 'Оружие (пассивное)',
  ModuleExtraType_ProfessionPassive: 'Резонанс класса',
  ModuleExtraType_Pet: 'Трейты симулякров',
  ModuleExtraType_CardPassive: 'Реликвии',
  ModuleExtraType_Wormhole: 'Былое + старый контент',
  ModuleExtraType_CardActive: 'Реликвии (активные)',
  ModuleExtraType_Enchantment: 'Зачарование',
  ModuleExtraType_ProfessionActive: 'Резонанс класса (активный)',
  ModuleExtraType_RedEquip: 'Титан экипировка',
  ModuleExtraType_SeasonBuff: 'Сезонные баффы',
  ModuleExtraType_Suit: 'Комплект брони',
  ModuleExtraType_WeaponBonus: 'Бонус оружия',
  ModuleExtraType_Whip: 'Кнут',
};
