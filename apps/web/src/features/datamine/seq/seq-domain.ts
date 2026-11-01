import type { SeqStageItem, SeqStageView } from './seq-types';

export const BASE_RESIST_RATE = 0.3471;

/** Resistance ignore slider: 0–50% in 5% steps (fractions). */
export const SEQ_RESIST_IGNORE_RANGE = { min: 0, max: 0.5, step: 0.05, initial: 0.3 } as const;
/** Initial Space Support "Sequential Phantasm" module level (max comes from game data). */
export const SEQ_SUPPORT_LEVEL_INITIAL = 5;

interface SeqSupportModuleSource {
  name_en: string;
  levels: { level: number; value: number }[];
}

/**
 * DMG% by Space Support "Sequential Phantasm" module level (index = level, fractions),
 * from build-page.json `support.modules`. All four element modules share the same values;
 * the first one found is used. Returns null when the data is unavailable.
 */
export function seqSupportDamageByLevel(modules: SeqSupportModuleSource[] | null | undefined): number[] | null {
  const module = modules?.find((m) => /Sequential Phantasm/i.test(m.name_en));
  if (!module || module.levels.length === 0) return null;
  const maxLevel = Math.max(...module.levels.map((l) => l.level));
  const byLevel = Array.from({ length: maxLevel + 1 }, () => 0);
  for (const l of module.levels) {
    if (l.level >= 0 && Number.isFinite(l.value)) byLevel[l.level] = l.value;
  }
  return byLevel;
}
/** Reference fighter's existing additive DMG% (the cactus test already includes it). */
export const SEQ_REFERENCE_DAMAGE_PERCENT = 0.5;

export interface SeqRequiredDamageInput {
  maxHealth: number;
  /** Boss numeric RES (DEF field in DT_MonsterStaticData). */
  resistance: number | null;
  /** Defence constant K for L100 from build-reference.json. */
  resistanceConstant: number | null;
  resistIgnore: number;
  damageBonus: number;
  baseDamagePercent?: number;
}

/**
 * Multiplier of boss HP from its RES after attacker's ignore: 1 + R·(1 − i) / K.
 * Same R/(R+K) model as Build.
 */
export function seqResistanceHpMultiplier(
  resistance: number,
  resistanceConstant: number,
  resistIgnore: number
): number {
  return 1 + (resistance * (1 - resistIgnore)) / resistanceConstant;
}

/**
 * Damage gain of an extra additive DMG% on top of an existing DMG% total:
 * (1 + D + d) / (1 + D). Diminishes as D grows.
 */
export function seqDamageBonusMultiplier(
  damageBonus: number,
  baseDamagePercent: number = SEQ_REFERENCE_DAMAGE_PERCENT
): number {
  return (1 + baseDamagePercent + damageBonus) / (1 + baseDamagePercent);
}

/**
 * Damage a zero-RES cactus must take in the same 150 s to clear the stage:
 * HP × RES multiplier ÷ Sequential DMG% gain. Mechanics are not included.
 */
export function seqRequiredCactusDamage(input: SeqRequiredDamageInput): number | null {
  const { maxHealth, resistance, resistanceConstant, resistIgnore, damageBonus } = input;
  if (!Number.isFinite(maxHealth) || maxHealth <= 0) return null;
  if (resistance === null || !Number.isFinite(resistance) || resistance < 0) return null;
  if (resistanceConstant === null || !Number.isFinite(resistanceConstant) || resistanceConstant <= 0) {
    return null;
  }
  return (
    (maxHealth * seqResistanceHpMultiplier(resistance, resistanceConstant, resistIgnore)) /
    seqDamageBonusMultiplier(damageBonus, input.baseDamagePercent)
  );
}

/**
 * Formats large values into compact representations (G, M, K).
 */
export function formatCompact(value: number): string {
  const num = Number(value || 0);
  const abs = Math.abs(num);
  if (abs >= 1e9) {
    return `${(num / 1e9).toFixed(1)}G`;
  }
  if (abs >= 1e6) {
    return `${(num / 1e6).toFixed(1)}M`;
  }
  if (abs >= 1e3) {
    return `${(num / 1e3).toFixed(1)}K`;
  }
  return Math.round(num).toLocaleString('en-US');
}

/**
 * Formats integers with comma separation.
 */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Formats powercreep percentage with sign and 2 decimal points.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Formats Crit Resist coefficient to percentage.
 */
export function formatCritResist(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '0%';
  }
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Filters sequential rows according to stage view selection (All vs 16+).
 */
export function getVisibleSequentialRows(
  rows: SeqStageItem[],
  stageView: SeqStageView = '16plus'
): SeqStageItem[] {
  if (!Array.isArray(rows)) return [];
  if (stageView === '16plus') {
    return rows.filter((entry) => entry.stage >= 16);
  }
  return rows;
}

/**
 * Returns localized mechanics note.
 */
export function getMechanicsNote(
  entry: SeqStageItem,
  isRu: boolean,
  defaultNote: string
): string {
  if (!entry?.isMechanicsAdjusted) return '';
  if (isRu) return defaultNote;
  return entry.mechanicsNote || defaultNote;
}

/**
 * Finds the chart point nearest to the given SVG x-coordinate.
 * Powers the full-plot crosshair guide (legacy parity).
 */
export function findNearestChartPoint<T extends { x: number }>(
  points: T[],
  x: number
): T | null {
  if (!Array.isArray(points) || points.length === 0) return null;
  let nearest = points[0];
  let best = Math.abs(nearest.x - x);
  for (const point of points) {
    const distance = Math.abs(point.x - x);
    if (distance < best) {
      best = distance;
      nearest = point;
    }
  }
  return nearest;
}
