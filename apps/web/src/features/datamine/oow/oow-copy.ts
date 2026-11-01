import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface OowCopyTable {
  heroSubtitle: string;
  heroTitle: string;
  tabTitle: string;
  gameModeLabel: string;
  mmoModeLabel: string;
  tableTabLabel: string;
  chartsTabLabel: string;
  difficultyTabLabel: string;
  seasonsLabel: string;
  collapseSeasonsTitle: string;
  expandSeasonsTitle: string;
  allFloorsLabel: string;
  rampLabel: string;
  challengeLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  exactLabel: string;
  compareLabelText: string;
  compareTitle: string;
  versusLabel: string;
  compareWithLabel: string;
  floorLabel: string;
  totalHpLabel: string;
  maxMobLabel: string;
  mobsLabel: string;
  mainEnemiesLabel: string;
  waveDistributionLabel: string;
  rawHpTag: string;
  effectiveHpLabel: string;
  rawHpLabel: string;
  resistsLabel: string;
  affixesLabel: string;
  primaryStatsLabel: string;
  elementalResistancesLabel: string;
  difficultyContextLabel: string;
  mechanicsTitleLabel: string;
  mechanicsLoadingLabel: string;
  viewFullFceLabel: string;
  overridesLabel: string;
  closeLabel: string;
  zoomImageTitle: string;
  closeImageLabel: string;
  hpModeLabel: string;
  metricLabel: string;
  floorRangeLabel: string;
  bossHpLabel: string;
  totalFloorLabel: string;
  chartRampLabel: string;
  chartChallengeLabel: string;
  allLabel: string;
  presetsLabel: string;
  chartPaletteLabel: string;
  chartPaletteAria: string;
  lightLabel: string;
  darkLabel: string;
  seasonsOnChartLabel: string;
  downloadPngLabel: string;
  downloadCsvLabel: string;
  historyChartTitle: string;
  historyChartDescription: string;
  jumpTitleFloor: string;
  jumpTitleSeason: string;
  jumpSubFloor: string;
  jumpSubSeason: string;
  seasonToSeasonLabel: string;
  floorToFloorLabel: string;
  diffFloorTitle: string;
  difficultyDescription: string;
  allFloorsDifficultyTitle: string;
  peakLabel: string;
  peakWindowLabel: string;
  baselineFromLabel: string;
  stepsLabel: string;
  timelineLabel: string;
  goToFloorPlaceholder: string;
  liveNowLabel: string;
  activeSeasonBadge: string;
  badgeDrop: string;
  badgeMutator: string;
  badgeAffix: string;
  slotTypeFallback: string;
  chartTotalSeasonEhp: string;
  chartFinalBossEhp: string;
  daySingle: string;
  dayPlural: string;
  dayShort: string;
  statMaxHealth: string;
  statBaseAtk: string;
  statShield: string;
  statShieldSub: string;
  statCritRes: string;
  statCritResSub: string;
  seasonOne: string;
  seasonFew: string;
  seasonMany: string;
  seasonWord: string;
  challengeName: string;
  waveName: string;
  waveHeader: string;
  waveFinalBoss: string;
  waveVanguard: string;
  waveAssault: string;
  waveLineup: string;
  kindBoss: string;
  kindElite: string;
  kindCreep: string;
  deepStatsHint: string;
  rangeCurrent: string;
  rangeLast4: string;
  rangeLast10: string;
  hpScalingTitle: string;
  dblClickRestore: string;
  dblClickEnlarge: string;
  moveToTop: string;
  moveDown: string;
  jumpSeasonButton: string;
  jumpFloorButton: string;
  blueprintId: string;
  defenseShieldPrefix: string;
  defenseCritResPrefix: string;
  ovrPhysDefIgnore: string;
  ovrFireDefIgnore: string;
  ovrIceDefIgnore: string;
  ovrThunderDefIgnore: string;
  ovrSuperpowerDefIgnore: string;
  ovrExecute: string;
  ovrCrit: string;
  ovrCritDef: string;
  ovrFinalCrit: string;
  ovrAbnormal: string;
  ovrAbnormalRes: string;
  ovrRigidity: string;
  ovrRigidityRes: string;
  ovrMaxRage: string;
}

export const OOW_COPY: Record<Locale, (Record<'en' | 'ru', OowCopyTable>)['en']> = createLocaleCopies(({
  en: {
    heroSubtitle: 'DATAMINE · ORIGIN OF WAR',
    heroTitle: 'Enemy Stats & Seasonal Scaling',
    tabTitle: 'Origin of War',
    gameModeLabel: 'GAME MODE',
    mmoModeLabel: 'MMO',
    tableTabLabel: 'Floor Table & Lineups',
    chartsTabLabel: 'Inflation & EHP Charts',
    difficultyTabLabel: 'Difficulty Schedule',
    seasonsLabel: 'SEASONS',
    collapseSeasonsTitle: 'Collapse seasons rail',
    expandSeasonsTitle: 'Expand seasons rail',
    allFloorsLabel: 'All Floors',
    rampLabel: 'Ramp 17–28',
    challengeLabel: 'Challenge 26–28',
    searchPlaceholder: 'Search floor, boss, code…',
    clearSearch: 'Clear search',
    exactLabel: 'Exact',
    compareLabelText: 'Compare',
    compareTitle: 'Season Comparison',
    versusLabel: 'vs',
    compareWithLabel: 'Compare with:',
    floorLabel: 'Floor',
    totalHpLabel: 'Effective HP',
    maxMobLabel: 'Max Mob EHP',
    mobsLabel: 'Mobs',
    mainEnemiesLabel: 'Main Enemies',
    waveDistributionLabel: 'Wave Distribution',
    rawHpTag: 'raw',
    effectiveHpLabel: 'Effective HP',
    rawHpLabel: 'Raw HP',
    resistsLabel: 'Resists',
    affixesLabel: 'Floor Mutators & Buffs',
    primaryStatsLabel: 'Primary Combat Stats',
    elementalResistancesLabel: 'Elemental Resistances',
    difficultyContextLabel: 'Context at peak difficulty',
    mechanicsTitleLabel: 'Boss Mechanics',
    mechanicsLoadingLabel: 'Loading mechanics...',
    viewFullFceLabel: 'View full boss card',
    overridesLabel: 'Notable Overrides & Inherent Buffs',
    closeLabel: 'Close',
    zoomImageTitle: 'Click to enlarge artwork',
    closeImageLabel: 'Close image viewer',
    hpModeLabel: 'HP Mode',
    metricLabel: 'Metric',
    floorRangeLabel: 'Floor Range',
    bossHpLabel: 'Boss HP',
    totalFloorLabel: 'Total Floor',
    chartRampLabel: 'Ramp 17–28',
    chartChallengeLabel: 'Challenge 26–28',
    allLabel: 'All',
    presetsLabel: 'Presets:',
    chartPaletteLabel: 'Chart palette:',
    chartPaletteAria: 'Chart palette',
    lightLabel: 'Light',
    darkLabel: 'Dark',
    seasonsOnChartLabel: 'Seasons on chart:',
    downloadPngLabel: 'Download PNG',
    downloadCsvLabel: 'Download CSV',
    historyChartTitle: 'Historical final-floor inflation',
    historyChartDescription: 'Final boss HP from the first season to now — raw vs effective on a logarithmic scale.',
    jumpTitleFloor: 'Floor-over-floor HP jump',
    jumpTitleSeason: 'Season-over-season HP growth (per floor)',
    jumpSubFloor: '% increase of each floor vs the previous floor.',
    jumpSubSeason: '% growth of each floor vs the same floor last season.',
    seasonToSeasonLabel: 'Season to Season',
    floorToFloorLabel: 'Floor to Floor',
    diffFloorTitle: 'Day-by-Day Difficulty & Dates',
    difficultyDescription: 'Shows how difficulty multiplier decays step by step over the season duration.',
    allFloorsDifficultyTitle: 'All Floors Difficulty Schedules',
    peakLabel: 'Peak',
    peakWindowLabel: 'Peak Window',
    baselineFromLabel: 'Baseline Date',
    stepsLabel: 'Steps',
    timelineLabel: 'Timeline & Decay Schedule',
    goToFloorPlaceholder: 'Go to floor…',
    liveNowLabel: 'Live now',
    activeSeasonBadge: 'Active',
    badgeDrop: 'DROP',
    badgeMutator: 'MUTATOR',
    badgeAffix: 'AFFIX',
    slotTypeFallback: 'Type {slot}',
    chartTotalSeasonEhp: 'Total Season EHP',
    chartFinalBossEhp: 'Final Boss EHP',
    daySingle: 'Day',
    dayPlural: 'Days',
    dayShort: 'd',
    statMaxHealth: 'Max Health',
    statBaseAtk: 'Base Attack (ATK)',
    statShield: 'Shield Points (Armor)',
    statShieldSub: 'shield points',
    statCritRes: 'Crit Resistance (FinalCritDef)',
    statCritResSub: 'reduce crit chance',
    seasonOne: 'season',
    seasonFew: 'seasons',
    seasonMany: 'seasons',
    seasonWord: 'Season',
    challengeName: 'Challenge {label}',
    waveName: 'Wave {wave}',
    waveHeader: 'WAVE',
    waveFinalBoss: 'FINAL BOSS',
    waveVanguard: 'VANGUARD',
    waveAssault: 'ASSAULT',
    waveLineup: 'Wave Lineup',
    kindBoss: 'Boss',
    kindElite: 'Elite',
    kindCreep: 'Creep',
    deepStatsHint: 'Click for deep stats',
    rangeCurrent: 'Current',
    rangeLast4: 'Last 4',
    rangeLast10: 'Last 10',
    hpScalingTitle: 'Floor-by-Floor HP Scaling Curves',
    dblClickRestore: 'Double-click to restore',
    dblClickEnlarge: 'Double-click to enlarge',
    moveToTop: 'Move to top',
    moveDown: 'Restore down',
    jumpSeasonButton: 'Season → Season',
    jumpFloorButton: 'Floor → Floor',
    blueprintId: 'Blueprint ID',
    defenseShieldPrefix: 'Shield',
    defenseCritResPrefix: 'Crit Res',
    ovrPhysDefIgnore: 'Phys Def Ignore Mult',
    ovrFireDefIgnore: 'Flame Def Ignore Mult',
    ovrIceDefIgnore: 'Frost Def Ignore Mult',
    ovrThunderDefIgnore: 'Volt Def Ignore Mult',
    ovrSuperpowerDefIgnore: 'Altered Def Ignore Mult',
    ovrExecute: 'Execution Multiplier',
    ovrCrit: 'Base Crit Rate',
    ovrCritDef: 'Base Crit Evasion',
    ovrFinalCrit: 'Final Crit Probability',
    ovrAbnormal: 'Abnormal State Infliction',
    ovrAbnormalRes: 'Abnormal State Resistance',
    ovrRigidity: 'Rigidity (Stagger Power)',
    ovrRigidityRes: 'Rigidity Resistance',
    ovrMaxRage: 'Max Rage Gauge',
  },
  ru: {
    heroSubtitle: 'ДАТАМАЙН · ИСТОКИ ВОЙНЫ',
    heroTitle: 'Характеристики противников и сезонная сложность',
    tabTitle: 'Истоки войны',
    gameModeLabel: 'РЕЖИМ ИГРЫ',
    mmoModeLabel: 'MMO',
    tableTabLabel: 'Таблица этажей и составы',
    chartsTabLabel: 'Графики инфляции и EHP',
    difficultyTabLabel: 'График сложности',
    seasonsLabel: 'СЕЗОНЫ',
    collapseSeasonsTitle: 'Свернуть список сезонов',
    expandSeasonsTitle: 'Развернуть список сезонов',
    allFloorsLabel: 'Все этажи',
    rampLabel: 'Разгон 17–28',
    challengeLabel: 'Испытание 26–28',
    searchPlaceholder: 'Поиск этажа, босса, кода…',
    clearSearch: 'Очистить поиск',
    exactLabel: 'Точно',
    compareLabelText: 'Сравнить',
    compareTitle: 'Сравнение сезонов',
    versusLabel: 'против',
    compareWithLabel: 'Сравнить с:',
    floorLabel: 'Этаж',
    totalHpLabel: 'Эффективное HP',
    maxMobLabel: 'Макс моб EHP',
    mobsLabel: 'Мобы',
    mainEnemiesLabel: 'Основные враги',
    waveDistributionLabel: 'Распределение волн',
    rawHpTag: 'ном.',
    effectiveHpLabel: 'Эффективное HP',
    rawHpLabel: 'Номинальное HP',
    resistsLabel: 'Сопротивления',
    affixesLabel: 'Мутаторы и баффы этажа',
    primaryStatsLabel: 'Основные боевые параметры',
    elementalResistancesLabel: 'Стихийные сопротивления',
    difficultyContextLabel: 'Параметры на пиковой сложности',
    mechanicsTitleLabel: 'Механики босса',
    mechanicsLoadingLabel: 'Загрузка механик...',
    viewFullFceLabel: 'Открыть карточку босса',
    overridesLabel: 'Особые параметры и врожденные баффы',
    closeLabel: 'Закрыть',
    zoomImageTitle: 'Нажмите для увеличения иллюстрации',
    closeImageLabel: 'Закрыть просмотр изображения',
    hpModeLabel: 'Режим HP',
    metricLabel: 'Показатель',
    floorRangeLabel: 'Диапазон этажей',
    bossHpLabel: 'HP Босса',
    totalFloorLabel: 'Всего за этаж',
    chartRampLabel: 'Разгон 17–28',
    chartChallengeLabel: 'Испытание 26–28',
    allLabel: 'Все',
    presetsLabel: 'Наборы:',
    chartPaletteLabel: 'Палитра графиков:',
    chartPaletteAria: 'Палитра графиков',
    lightLabel: 'Светлая',
    darkLabel: 'Тёмная',
    seasonsOnChartLabel: 'Сезоны на графике:',
    downloadPngLabel: 'Скачать PNG',
    downloadCsvLabel: 'Скачать CSV',
    historyChartTitle: 'Историческая инфляция финального этажа',
    historyChartDescription: 'HP финального босса от первого сезона до текущего — номинальное против EHP (лог. шкала).',
    jumpTitleFloor: 'Рост HP от этажа к этажу',
    jumpTitleSeason: 'Инфляция HP между сезонами (по этажам)',
    jumpSubFloor: '% прироста каждого этажа относительно предыдущего.',
    jumpSubSeason: '% роста каждого этажа относительно того же этажа в прошлом сезоне.',
    seasonToSeasonLabel: 'Между сезонами',
    floorToFloorLabel: 'По этажам',
    diffFloorTitle: 'Поэтапный спад сложности и даты',
    difficultyDescription: 'Показывает, как множитель сложности снижается шаг за шагом в течение сезона.',
    allFloorsDifficultyTitle: 'График спада сложности для всех этажей',
    peakLabel: 'Пик',
    peakWindowLabel: 'Период пика',
    baselineFromLabel: 'Базовая дата',
    stepsLabel: 'Шаги',
    timelineLabel: 'Хронология и спад сложности',
    goToFloorPlaceholder: 'К этажу…',
    liveNowLabel: 'Сейчас активно',
    activeSeasonBadge: 'Активен',
    badgeDrop: 'ДРОП',
    badgeMutator: 'МУТАТОР',
    badgeAffix: 'АФФИКС',
    slotTypeFallback: 'Тип {slot}',
    chartTotalSeasonEhp: 'Всего EHP за сезон',
    chartFinalBossEhp: 'Финальный босс EHP',
    daySingle: 'День',
    dayPlural: 'Дни',
    dayShort: ' дн.',
    statMaxHealth: 'Максимальное ОЗ',
    statBaseAtk: 'Базовая атака (ATK)',
    statShield: 'Прочность щита (Armor)',
    statShieldSub: 'базовый щит',
    statCritRes: 'Сопротивление криту (FinalCritDef)',
    statCritResSub: 'снижает шанс крита',
    seasonOne: 'сезон',
    seasonFew: 'сезона',
    seasonMany: 'сезонов',
    seasonWord: 'Сезон',
    challengeName: 'Испытание {label}',
    waveName: 'Волна {wave}',
    waveHeader: 'ВОЛНА',
    waveFinalBoss: 'ФИНАЛЬНЫЙ БОСС',
    waveVanguard: 'АВАНГАРД',
    waveAssault: 'ШТУРМ',
    waveLineup: 'Состав волн',
    kindBoss: 'Босс',
    kindElite: 'Элита',
    kindCreep: 'Моб',
    deepStatsHint: 'Нажмите для подробной информации',
    rangeCurrent: 'Текущий',
    rangeLast4: 'Посл. 4',
    rangeLast10: 'Посл. 10',
    hpScalingTitle: 'Масштабирование HP по этажам',
    dblClickRestore: 'Двойной клик — вернуть',
    dblClickEnlarge: 'Двойной клик — увеличить',
    moveToTop: 'Переместить вверх',
    moveDown: 'Вернуть вниз',
    jumpSeasonButton: 'Сезон → Сезон',
    jumpFloorButton: 'Этаж → Этаж',
    blueprintId: 'ID шаблона',
    defenseShieldPrefix: 'Щит',
    defenseCritResPrefix: 'Сопр. крита',
    ovrPhysDefIgnore: 'Игнор физ. защиты',
    ovrFireDefIgnore: 'Игнор огненной защиты',
    ovrIceDefIgnore: 'Игнор ледяной защиты',
    ovrThunderDefIgnore: 'Игнор электро защиты',
    ovrSuperpowerDefIgnore: 'Игнор альтер защиты',
    ovrExecute: 'Множитель казни',
    ovrCrit: 'Базовый крит. шанс',
    ovrCritDef: 'Базовое уклонение от крита',
    ovrFinalCrit: 'Итоговый крит. шанс',
    ovrAbnormal: 'Сила аномального состояния',
    ovrAbnormalRes: 'Сопротивление аномалиям',
    ovrRigidity: 'Сила ошеломления',
    ovrRigidityRes: 'Сопротивление пошатыванию',
    ovrMaxRage: 'Макс. шкала ярости',
  },
}) satisfies Pick<Record<'en' | 'ru', OowCopyTable>, 'en' | 'ru'>);
