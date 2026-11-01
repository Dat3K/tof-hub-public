import type { OowCurrentSummaryDataset } from '@tof-hub/contracts';

export type OowMode = 'standard' | 'mmo';
export type OowTab = 'table' | 'charts' | 'difficulty';
export type OowHpUnit = 'G' | 'M' | 'RAW';
export type OowFilter = 'all' | 'ramp' | 'boss';
export type OowChartMetric = 'boss' | 'total';
export type OowChartMode = 'ehp' | 'raw';
export type OowChartRange = 'ramp' | 'overtime' | 'all';
export type OowChartTheme = 'light' | 'dark';

export interface OowDeepLinkParams {
  mode?: OowMode | null;
  s?: number | null;
  tab?: OowTab | null;
  floor?: number | null;
  mob?: string | null;
}

export interface OowResistanceInfo {
  sourceStatus?: string;
  isEmpirical?: boolean;
  X?: number;
  level?: number;
  K?: number;
  resistK?: number;
  rawResistPct?: number;
  resistPct?: number;
  resistPercent?: number;
  resistPercentFormatted?: string;
  effectiveMultiplier?: number;
  effectiveHpMult?: number;
  ehpMultiplier?: number;
  effectiveHp?: number;
  effHp?: number;
  effectiveHpFormatted?: string;
  formula?: string;
  formulaDescription?: string;
  [key: string]: unknown;
}

export interface OowBuff {
  id: string;
  nameEn: string;
  nameRu: string;
  descEn: string;
  descRu: string;
  icon?: string | null;
  iconThumb?: string | null;
  slot?: string;
  slotLabelEn?: string;
  slotLabelRu?: string;
  buffPoolId?: string;
  buffType?: string;
  type?: string | null;
  probability?: number;
  probabilityPercent?: number;
  weight?: number;
  [key: string]: unknown;
}

export interface OowEnemy {
  wave: number;
  mob: number;
  key: string;
  nameEn: string;
  nameRu: string;
  codeName?: string;
  bossId?: string | null;
  monsterType?: string;
  enemyKind: 'normal' | 'elite' | 'boss';
  count: number;
  level: number;
  hp: number;
  combinedHp: number;
  hpFormatted?: string;
  atk: number;
  def: number;
  effectiveHp: number;
  effHpFormatted?: string;
  image?: string | null;
  imagePng?: string | null;
  imageThumb?: string | null;
  lineupPortraitThumb?: string | null;
  lineupPortraitFull?: string | null;
  detailImageFull?: string | null;
  detailImagePng?: string | null;
  stats?: Record<string, number | string | undefined>;
  resistanceInfo?: OowResistanceInfo;
  inherentBuffs?: OowBuff[];
  floor?: number;
  [key: string]: unknown;
}

export interface OowDifficultyStep {
  startDay: number;
  endDay: number;
  durationDays: number;
  pct: number;
  multiplier: number;
  [key: string]: unknown;
}

export interface OowFloorDifficulty {
  floor?: number;
  unlockDay?: number;
  initialPct?: number;
  finalPct?: number;
  daysToMin?: number;
  stepsCount?: number;
  steps?: OowDifficultyStep[];
  curveTable?: string | any;
  rowName?: string;
  appliedCoefficient?: number;
  keys?: any[];
  [key: string]: unknown;
}

export interface OowFloor {
  floor: number;
  unlockDay: number;
  mobCount: number;
  totalHp: number;
  maxHp: number;
  resistPercent: number;
  effectiveHp: number;
  effectiveHpFormatted: string;
  maxMobEffectiveHp: number;
  maxMobEffectiveHpFormatted: string;
  dropBuffs: (string | OowBuff | any)[];
  resistanceInfo?: OowResistanceInfo;
  enemies: OowEnemy[];
  difficultySchedule?: OowFloorDifficulty;
  [key: string]: unknown;
}

export interface OowSeasonSummary {
  season: number;
  title?: string;
  startDate: string;
  endDate: string;
  startISO?: string;
  endISO?: string;
  floorCount: number;
  minFloor?: number;
  maxFloor?: number;
  totalSeasonHp: number;
  totalSeasonEffectiveHp: number;
  finalBossHp?: number;
  finalBossEffectiveHp?: number;
  finalBossName?: string;
  finalBossNameRu?: string;
  bossName?: string;
  bossNameRu?: string;
  bossImage?: string;
  bossImageThumb?: string;
  maxDifficulty?: number;
  curveProfile?: string;
  resistanceInfo?: OowResistanceInfo;
  totalSeasonHpBillions?: number;
  totalSeasonEffectiveHpBillions?: number;
  difficultySummary?: {
    maxDifficulty: number;
    curveProfile: string;
    floors: OowFloorDifficulty[];
  };
  [key: string]: unknown;
}

export interface OowMainEnemyItem {
  isBoss: boolean;
  isMobCount?: boolean;
  label?: string;
  name?: string;
  color?: string | null;
  avatar?: string | null;
  fallbackAvatar?: string | null;
  hp?: number;
  wave?: number;
  hasSeparator?: boolean;
}

export interface OowViewProps {
  initialEffectCatalog?: { modes: Record<'standard' | 'mmo', import('../components/encounter-effect-catalog').EncounterCatalogEffect[]> } | null;
  initialBossCards?: import('../fce/fce-types').FceViewProps['initialCards'];
  initialSummary?: OowCurrentSummaryDataset | null;
  initialLocale?: string;
  initialMode?: OowMode | null;
  initialTab?: OowTab | null;
  initialSeason?: number | null;
  initialFloor?: number | null;
}
