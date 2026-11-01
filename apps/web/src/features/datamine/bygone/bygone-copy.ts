import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface BygoneCopyTable {
  eyebrow: string;
  title: string;
  metaDescription: string;
  sourceTitle: string;
  sourceBody: string;
  statTotalFloors: string;
  statBossFloors: string;
  statF571Diff: string;
  statF571Stacks: string;
  chartsTitle: string;
  chartTitle: string;
  chartHpTitle: string;
  chartPowercreepTitle: string;
  chartHpUnit: string;
  chartSubtitle: string;
  downloadPng: string;
  downloadCsv: string;
  ctrlMetrics: string;
  ctrlScale: string;
  ctrlRange: string;
  rangeLatest20: string;
  rangeAll: string;
  rangeEarly: string;
  rangeLate: string;
  rangeStatus: string;
  ctrlZoom: string;
  zoomReset: string;
  scaleLinear: string;
  scaleLog: string;
  showRepeats: string;
  curveDiff: string;
  curveHp: string;
  curveAtk: string;
  curveLevel: string;
  curvePowercreep: string;
  legendDiff: string;
  legendHp: string;
  legendAtk: string;
  legendLevel: string;
  legendPowercreep: string;
  overviewLabel: string;
  chartHint: string;
  floorsTitle: string;
  floorsSubtitle: string;
  filterAll: string;
  filterBoss: string;
  filterEarly: string;
  filterLate: string;
  searchPlaceholder: string;
  clearSearch: string;
  floor: string;
  difficulty: string;
  hpStacks: string;
  atkStacks: string;
  level: string;
  powercreep: string;
  gs: string;
  scalingFloor: string;
  scalingTemplate: string;
  lineupUnknown: string;
  retainedEndpoint: string;
  weakness: string;
  noWeakness: string;
  chartPalette: string;
  paletteLight: string;
  paletteDark: string;
  zoomEyebrow: string;
  zoomHint: string;
  close: string;
  statusCol: string;
  repeatsFloor: string;
  sourcesTitle: string;
  sourcesOverseas: string;
  sourcesBase: string;
}

export const BYGONE_COPY: Record<Locale, (Record<'en' | 'ru', BygoneCopyTable>)['en']> = createLocaleCopies(({
  en: {
    eyebrow: 'DATAMINE · BYGONE PHANTASM',
    title: 'Bygone Phantasm (BigSecret) scaling curves',
    metaDescription: 'Bygone Phantasm floor data, difficulty scaling, and enemy weaknesses in Tower of Fantasy.',
    sourceTitle: 'Datamined source only',
    sourceBody: 'The values on this page are extracted from authoritative datamined game data in BigSecretBuffCount_Overseas.json, DT_MonsterStaticData_Overseas.json (row BigSecret_Boss), and DT_BigSecretMonsterPoolConfig_Overseas.json. Floor scaling curves apply Buff_BigSecret_AddHp001 (+1% HP per stack) and Buff_BigSecret_AddAtk001 (+1% ATK per stack) to the base template. Enemy lineups for floors 1–500 are datamined from encounter pools; enemy lineups after Floor 500 are not exported in game data.',
    statTotalFloors: 'Total Floors Tracked',
    statBossFloors: 'Boss Encounters (1–500)',
    statF571Diff: 'Floor 571 Difficulty',
    statF571Stacks: 'Floor 571 HP Stacks',
    chartsTitle: 'Charts',
    chartTitle: 'Floor Scaling Curves (1–600)',
    chartHpTitle: 'Bygone: HP scaling by floor',
    chartPowercreepTitle: 'Bygone: powercreep from the previous floor',
    chartHpUnit: 'AddHp001 stacks · displayed in G',
    chartSubtitle: 'Interactive visualization with Linear/Log10 scaling, range presets, brush zoom, and displayed difficulty decoding.',
    downloadPng: 'Download PNG',
    downloadCsv: 'Download CSV',
    ctrlMetrics: 'Series:',
    ctrlScale: 'Scale:',
    ctrlRange: 'Range:',
    rangeLatest20: 'Latest 20',
    rangeAll: 'All',
    rangeEarly: '1–500',
    rangeLate: '501+',
    rangeStatus: 'Floors {start}–{end} · {count} floors',
    ctrlZoom: 'Zoom:',
    zoomReset: 'Reset',
    scaleLinear: 'Linear',
    scaleLog: 'Log10',
    showRepeats: 'Show duplicate floors',
    curveDiff: 'Displayed Diff',
    curveHp: 'HP Stacks',
    curveAtk: 'ATK Stacks',
    curveLevel: 'Monster Level',
    curvePowercreep: 'Step Delta %',
    legendDiff: 'Displayed Difficulty (Emerald)',
    legendHp: 'AddHp001 Stacks (Rose)',
    legendAtk: 'AddAtk001 Stacks (Cyan)',
    legendLevel: 'Monster Level (Gold)',
    legendPowercreep: 'Step Growth (Purple)',
    overviewLabel: 'Mini Overview Navigator (1–600):',
    chartHint: '💡 Tip: Wheel / pinch to zoom centered on pointer. Drag to pan. Click or drag the mini overview below to navigate floors 1–600. Arrow keys pan, +/- zoom, Esc resets.',
    floorsTitle: 'Loaded values',
    floorsSubtitle: 'Preview of the current floors, difficulty decoding, and combat-stat base values. The export buttons above save CSV files that open directly in Excel.',
    filterAll: 'All Floors',
    filterBoss: 'Boss Floors (1–500)',
    filterEarly: 'Floors 1–500',
    filterLate: 'Floors 501–600',
    searchPlaceholder: 'Jump to floor (e.g. 505 or 571)...',
    clearSearch: 'Clear search',
    floor: 'Floor',
    difficulty: 'Difficulty:',
    hpStacks: 'HP Stacks:',
    atkStacks: 'ATK Stacks:',
    level: 'Level:',
    powercreep: 'Powercreep:',
    gs: 'GS:',
    scalingFloor: 'Scaling Floor (Post-500)',
    scalingTemplate: 'Scaling Template: BigSecret_Boss',
    lineupUnknown: 'Enemy lineup after Floor 500 is not exported/known in game data',
    retainedEndpoint: 'Final Scaling State ({count} repeats)',
    weakness: 'Weakness',
    noWeakness: 'No elemental weakness',
    chartPalette: 'Chart palette:',
    paletteLight: 'Light',
    paletteDark: 'Dark',
    zoomEyebrow: 'Chart zoom',
    zoomHint: 'Click a chart to open zoom. In zoom view, use the mouse wheel to scale and drag to pan.',
    close: 'Close',
    statusCol: 'ENCOUNTER / SCALING STATUS',
    repeatsFloor: 'Repeats Floor {floor}',
    sourcesTitle: 'Datamined Source Tables:',
    sourcesOverseas: 'Overseas / Global',
    sourcesBase: 'Base Standard (No Oversea variant)',
  },
  ru: {
    eyebrow: 'ДАТАМАЙН · БЫЛОЙ ФАНТАЗМ',
    title: 'Кривые масштабирования Былого фантазма (BigSecret)',
    metaDescription: 'Этажи Былого фантазма, рост сложности и слабости врагов в Tower of Fantasy.',
    sourceTitle: 'Только данные Datamine',
    sourceBody: 'Значения на этой странице извлечены из данных датамайна: BigSecretBuffCount_Overseas.json, DT_MonsterStaticData_Overseas.json (строка BigSecret_Boss) и DT_BigSecretMonsterPoolConfig_Overseas.json. Масштабирование применяет стаки баффов Buff_BigSecret_AddHp001 (+1% HP за стак) и Buff_BigSecret_AddAtk001 (+1% ATK за стак) к базовому шаблону. Линейки врагов для этажей 1–500 взяты из пулов; после 500 этажа состав врагов в данных игры отсутствует.',
    statTotalFloors: 'Всего этажей',
    statBossFloors: 'Этапы с боссами (1–500)',
    statF571Diff: 'Сложность (571 эт.)',
    statF571Stacks: 'Стаки HP (571 эт.)',
    chartsTitle: 'Графики',
    chartTitle: 'Кривые масштабирования этажей (1–600)',
    chartHpTitle: 'Bygone: масштабирование HP по этажам',
    chartPowercreepTitle: 'Bygone: пауэркрип относительно прошлого этажа',
    chartHpUnit: 'Стаки AddHp001 · отображаются в G',
    chartSubtitle: 'Интерактивная визуализация с линейной/Log10 шкалой, пресетами диапазонов, зумом к курсору, мини-обзором и шагом пауэркрипа.',
    downloadPng: 'Скачать PNG',
    downloadCsv: 'Скачать CSV',
    ctrlMetrics: 'Ряды:',
    ctrlScale: 'Шкала:',
    ctrlRange: 'Диапазон:',
    rangeLatest20: 'Последние 20',
    rangeAll: 'Все',
    rangeEarly: '1–500',
    rangeLate: '501+',
    rangeStatus: 'Этажи {start}–{end} · {count} эт.',
    ctrlZoom: 'Масштаб:',
    zoomReset: 'Сброс',
    scaleLinear: 'Линейная',
    scaleLog: 'Log10',
    showRepeats: 'Показать повторы',
    curveDiff: 'Отображ. сложность',
    curveHp: 'Стаки HP',
    curveAtk: 'Стаки ATK',
    curveLevel: 'Уровень монстров',
    curvePowercreep: 'Прирост шага %',
    legendDiff: 'Отображаемая сложность (Изумрудный)',
    legendHp: 'Стаки AddHp001 (Розовый)',
    legendAtk: 'Стаки AddAtk001 (Голубой)',
    legendLevel: 'Уровень монстров (Золотой)',
    legendPowercreep: 'Прирост сложности (Фиолетовый)',
    overviewLabel: 'Мини-навигатор обзора (1–600):',
    chartHint: '💡 Подсказка: Колесо / жест pinch для зума к курсору. Перетаскивание для панорамирования. Клик или перетаскивание мини-обзора внизу для навигации по этажам 1–600. Стрелки смещают, +/- меняют масштаб, Esc сбрасывает.',
    floorsTitle: 'Загруженные значения',
    floorsSubtitle: 'Предпросмотр текущих строк, декодирование сложности и базовые параметры. Кнопки экспорта сохраняют файлы CSV для открытия в таблицах.',
    filterAll: 'Все этажи',
    filterBoss: 'Боссы (1–500)',
    filterEarly: 'Этажи 1–500',
    filterLate: 'Этажи 501–600',
    searchPlaceholder: 'Перейти к этажу (напр. 505 или 571)...',
    clearSearch: 'Очистить поиск',
    floor: 'Этаж',
    difficulty: 'Сложность:',
    hpStacks: 'Стаки HP:',
    atkStacks: 'Стаки ATK:',
    level: 'Уровень:',
    powercreep: 'Пауэркрип:',
    gs: 'GS:',
    scalingFloor: 'Этаж масштабирования (501+)',
    scalingTemplate: 'Шаблон масштабирования: BigSecret_Boss',
    lineupUnknown: 'Линейка противников после 500 этажа не экспортирована/неизвестна в данных игры',
    retainedEndpoint: 'Финальное масштабирование ({count} повт.)',
    weakness: 'Слабость',
    noWeakness: 'Нет элементной слабости',
    chartPalette: 'Палитра графиков:',
    paletteLight: 'Светлая',
    paletteDark: 'Тёмная',
    zoomEyebrow: 'Масштабирование графика',
    zoomHint: 'Нажмите на график, чтобы открыть его крупнее. Используйте колесо мыши для масштаба и перетаскивание для перемещения.',
    close: 'Закрыть',
    statusCol: 'ПРОТИВНИК / СТАТУС МАСШТАБИРОВАНИЯ',
    repeatsFloor: 'Повтор этажа {floor}',
    sourcesTitle: 'Источники данных (Датамайн):',
    sourcesOverseas: 'Глобал / Зарубежный',
    sourcesBase: 'Базовый (Без _Overseas варианта)',
  },
}) satisfies Pick<Record<'en' | 'ru', BygoneCopyTable>, 'en' | 'ru'>);
