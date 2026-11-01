import type { LocalizedText } from '@tof-hub/game-domain';

export type OowMode = 'standard' | 'mmo';

export type OowSeasonTab = 'stages' | 'charts' | 'difficulty' | 'table';

export interface OowDeepLinkParams {
  mode?: OowMode | null;
  s?: number | null;
  tab?: OowSeasonTab | null;
  floor?: number | null;
  mob?: string | null;
}

export interface OowSeasonSummary {
  season: number;
  title: string;
  startDate?: string;
  endDate?: string;
  startISO?: string;
  endISO?: string;
  floorCount: number;
  bossName?: string;
  bossNameRu?: string;
  bossImage?: string;
  bossImageThumb?: string;
  totalSeasonHp?: number;
  totalSeasonEffectiveHp?: number;
}

export interface OowCurrentSummary {
  schemaVersion: number;
  meta: {
    generatedAt?: string;
    standardActiveSeason?: number;
    mmoActiveSeason?: number;
  };
  recentSeasons: OowSeasonSummary[];
  mmoRecentSeasons: OowSeasonSummary[];
  currentSeason: OowSeasonSummary;
  mmoCurrentSeason: OowSeasonSummary;
}

export interface OowResistanceInfo {
  sourceStatus: string;
  isEmpirical: boolean;
  X: number;
  level: number;
  K: number;
  resistK: number;
  resistPct: number;
  resistPercent: number;
  resistPercentFormatted: string;
  effectiveMultiplier: number;
  formula: string;
  formulaDescription: string;
}

export interface OowBuff {
  id: string;
  buffType: string | null;
  slot: string;
  slotLabel: LocalizedText;
  name: LocalizedText;
  desc: LocalizedText;
  icon: string | null;
  iconThumb: string | null;
  modifiers: Record<string, unknown> | null;
}

export interface OowEnemy {
  wave: number;
  mob: number;
  key: string;
  name: LocalizedText;
  codeName: string;
  bossId: string | null;
  monsterType: string;
  count: number;
  level: number;
  mode: OowMode;
  season: number;
  floor: number;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  hp: number;
  combinedHp: number;
  hpFormatted: string;
  atk: number;
  def: number;
  effectiveHp: number;
  effHpFormatted: string;
  image: string | null;
  imagePng?: string | null;
  detailImagePng?: string | null;
  imageThumb: string | null;
  lineupPortrait: string | null;
  enemyKind: 'normal' | 'elite' | 'boss';
  inherentBuffs: OowBuff[];
  stats: Record<string, number | string>;
  resistanceInfo: OowResistanceInfo;
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
  enemies: OowEnemy[];
  dropBuffs: string[];
  resistanceInfo: OowResistanceInfo;
}

export interface OowSeasonDetail {
  season: number;
  title: string;
  startDate: string;
  endDate: string;
  floorCount: number;
  minFloor: number;
  maxFloor: number;
  totalSeasonHp: number;
  totalSeasonEffectiveHp: number;
  finalBossHp: number;
  finalBossEffectiveHp: number;
  bossName: LocalizedText;
  bossImage: string;
  floors: OowFloor[];
  resistanceInfo: OowResistanceInfo;
}
