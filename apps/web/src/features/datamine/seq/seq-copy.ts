import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface SeqCopyTable {
  pageTitle: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  chartsTitle: string;
  chartEffective: string;
  chartPure: string;
  chartPowercreep: string;
  downloadPng: string;
  downloadCsv: string;
  loadedTitle: string;
  loadedDescription: string;
  stage: string;
  row: string;
  effectiveHp: string;
  powercreep: string;
  loading: string;
  noRows: string;
  noChart: string;
  axisStage: string;
  mechanicsNote: string;
  zoomEyebrow: string;
  zoomHint: string;
  zoomAria: string;
  close: string;
  chartPalette: string;
  paletteLight: string;
  paletteDark: string;
  stageViewLabel: string;
  stageViewAria: string;
  stageViewAll: string;
  stageView16Plus: string;
  statAtk: string;
  statDef: string;
  statCritResist: string;
  mechanicsCol: string;
  resistIgnoreLabel: string;
  damageBonusLabel: string;
  totalMultiplierLabel: string;
  formulaButton: string;
  supportModuleLabel: string;
  levelShort: string;
  noResistConstant: string;
}

export const SEQ_COPY: Record<Locale, (Record<'en' | 'ru', SeqCopyTable>)['en']> = createLocaleCopies(({
  en: {
    pageTitle: 'ToF | Sequential',
    eyebrow: 'DATAMINE · SEQUENTIAL',
    title: 'Sequential boss scaling from datamined data',
    subtitle: 'Difficulty curves across the ladder with per-enemy stats and mechanics notes',
    chartsTitle: 'Charts',
    chartEffective: 'Sequential: required cactus damage in 150s (without stage mechanics)',
    chartPure: 'Boss HP in Sequential (pure HP, without resistances)',
    chartPowercreep: 'Approximated powercreep from the previous stage',
    downloadPng: 'Download PNG',
    downloadCsv: 'Download CSV',
    loadedTitle: 'Loaded values',
    loadedDescription:
      'Preview of the current rows and calculated values. The export buttons above save CSV files that open directly in Excel.',
    stage: 'STAGE',
    row: 'CODENAME',
    effectiveHp: 'EFFECTIVE HP',
    powercreep: 'POWERCREEP',
    loading: 'Loading...',
    noRows: 'No rows loaded.',
    noChart: 'No valid rows are available for this chart.',
    axisStage: 'Sequential stage',
    mechanicsNote: 'Includes a mechanics-adjusted HP formula.',
    zoomEyebrow: 'Chart zoom',
    zoomHint: 'Click a chart to open zoom. In zoom view, use the mouse wheel to scale and drag to pan.',
    zoomAria: 'Chart zoom',
    close: 'Close',
    chartPalette: 'Chart palette',
    paletteLight: 'Light',
    paletteDark: 'Dark',
    stageViewLabel: 'Selection',
    stageViewAria: 'Selection',
    stageViewAll: 'All',
    stageView16Plus: '16+',
    statAtk: 'ATK',
    statDef: 'DEF',
    statCritResist: 'CRIT RESIST',
    mechanicsCol: 'MECHANICS NOTE',
    resistIgnoreLabel: 'Resistance ignore',
    damageBonusLabel: 'Sequential SSS',
    supportModuleLabel: 'Sequential SSS',
    levelShort: 'Lv.',
    totalMultiplierLabel: 'HP multiplier',
    formulaButton: 'How it is calculated',
    noResistConstant: 'The defence constant is unavailable, so required damage cannot be calculated.',
  },
  ru: {
    pageTitle: 'TOF — графики Последовательности',
    eyebrow: 'ДАТАМАЙН · ПОСЛЕДОВАТЕЛЬНОСТЬ',
    title: 'Рост характеристик боссов по данным Datamine',
    subtitle: 'Кривые сложности по этапам, характеристики врагов и заметки о механике',
    chartsTitle: 'Графики',
    chartEffective: 'Последовательность: урон по кактусу за 150с (без механик этапов)',
    chartPure: 'HP босса в Последовательности (чистое HP без сопротивлений)',
    chartPowercreep: 'Примерный рост относительно предыдущего этапа',
    downloadPng: 'Скачать PNG',
    downloadCsv: 'Скачать CSV',
    loadedTitle: 'Загруженные значения',
    loadedDescription:
      'Предпросмотр текущих строк и рассчитанных значений. Кнопки экспорта сохраняют файлы CSV для открытия в таблицах.',
    stage: 'ЭТАП',
    row: 'КОДОВОЕ ИМЯ',
    effectiveHp: 'ЭФФЕКТИВНОЕ HP',
    powercreep: 'РОСТ',
    loading: 'Загрузка...',
    noRows: 'Данные не загружены.',
    noChart: 'Для этого графика нет корректных данных.',
    axisStage: 'Этап Последовательности',
    mechanicsNote: 'Используется формула HP с учётом механик.',
    zoomEyebrow: 'Масштабирование графика',
    zoomHint:
      'Нажмите на график, чтобы открыть его крупнее. Используйте колесо мыши для масштаба и перетаскивание для перемещения.',
    zoomAria: 'Увеличенный график',
    close: 'Закрыть',
    chartPalette: 'Палитра графиков',
    paletteLight: 'Светлая',
    paletteDark: 'Тёмная',
    stageViewLabel: 'Выборка',
    stageViewAria: 'Выборка',
    stageViewAll: 'Все',
    stageView16Plus: '16+',
    statAtk: 'АТК',
    statDef: 'ЗАЩ',
    statCritResist: 'СОПР. КРИТУ',
    mechanicsCol: 'ЗАМЕТКА О МЕХАНИКЕ',
    resistIgnoreLabel: 'Игнор сопротивления',
    damageBonusLabel: 'Последовательность SSS',
    supportModuleLabel: 'Последовательность SSS',
    levelShort: 'Ур.',
    totalMultiplierLabel: 'Множитель HP',
    formulaButton: 'Как считается',
    noResistConstant: 'Константа защиты недоступна, необходимый урон не рассчитать.',
  },
}) satisfies Pick<Record<'en' | 'ru', SeqCopyTable>, 'en' | 'ru'>);
