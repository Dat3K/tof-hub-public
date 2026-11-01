import type { OowCurrentSummaryDataset } from '@tof-hub/contracts';
import { normalizeLocale } from '@tof-hub/i18n';
import type { OowBuff, OowFloor, OowMode, OowSeasonSummary } from './oow-types';

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toSeasonSummary(value: unknown): OowSeasonSummary | null {
  const raw = asRecord(value);
  const season = asNumber(raw?.season);
  if (!season) return null;

  return {
    season,
    title: asString(raw?.title),
    startDate: asString(raw?.startDate ?? raw?.startISO),
    endDate: asString(raw?.endDate ?? raw?.endISO),
    floorCount: asNumber(raw?.floorCount),
    minFloor: asNumber(raw?.minFloor),
    maxFloor: asNumber(raw?.maxFloor),
    totalSeasonHp: asNumber(raw?.totalSeasonHp),
    totalSeasonEffectiveHp: asNumber(raw?.totalSeasonEffectiveHp),
    finalBossHp: asNumber(raw?.finalBossHp),
    finalBossEffectiveHp: asNumber(raw?.finalBossEffectiveHp),
    finalBossName: asString(raw?.finalBossName ?? raw?.bossName),
    finalBossNameRu: asString(raw?.finalBossNameRu ?? raw?.bossNameRu),
    bossName: asString(raw?.bossName),
    bossNameRu: asString(raw?.bossNameRu),
    bossImage: asString(raw?.bossImage),
    bossImageThumb: asString(raw?.bossImageThumb),
  };
}

/** Returns only seasons materialized by the data pipeline; never static fallbacks. */
export function getSeasonsList(
  summary: OowCurrentSummaryDataset | null | undefined,
  mode: OowMode
): OowSeasonSummary[] {
  const source = mode === 'mmo' ? summary?.mmoRecentSeasons : summary?.recentSeasons;
  const current = mode === 'mmo' ? summary?.mmoCurrentSeason : summary?.currentSeason;
  const bySeason = new Map<number, OowSeasonSummary>();

  for (const item of [...(source || []), current]) {
    const season = toSeasonSummary(item);
    if (season) bySeason.set(season.season, season);
  }

  return [...bySeason.values()].sort((a, b) => a.season - b.season);
}

/** Builds the mutator lookup from the materialized OoW summary. */
export function getBuffsDictionary(
  buffs: Record<string, unknown> | undefined
): Map<string, OowBuff> {
  const dictionary = new Map<string, OowBuff>();

  for (const [id, value] of Object.entries(buffs || {})) {
    const raw = asRecord(value);
    if (!raw) continue;
    dictionary.set(id, {
      id,
      nameEn: asString(raw.nameEn ?? raw.name),
      nameRu: asString(raw.nameRu ?? raw.name),
      descEn: asString(raw.descEn ?? raw.desc),
      descRu: asString(raw.descRu ?? raw.desc),
      icon: asString(raw.icon) || null,
      slot: asString(raw.slot) || undefined,
      slotLabelEn: asString(raw.slotLabelEn) || undefined,
      slotLabelRu: asString(raw.slotLabelRu) || undefined,
      buffType: asString(raw.buffType) || undefined,
      probability: typeof raw.probability === 'number' ? raw.probability : undefined,
      probabilityPercent: typeof raw.probabilityPercent === 'number' ? raw.probabilityPercent : undefined,
      weight: typeof raw.weight === 'number' ? raw.weight : undefined,
    });
  }

  return dictionary;
}

/** Loads a materialized season file. Missing data stays empty; it is never fabricated. */
export async function fetchSeasonFloors(mode: OowMode, season: number, locale = 'en'): Promise<OowFloor[]> {
  if (typeof window === 'undefined') return [];

  const prefix = mode === 'mmo' ? 'mmo_s' : 's';
  const padded = String(season).padStart(2, '0');
  const safeLocale = normalizeLocale(locale);
  const url = `/game-data/${safeLocale}/oow/seasons/${prefix}${padded}.json`;

  try {
    let response = await fetch(url);
    if (response.status === 404 && safeLocale !== 'en') response = await fetch(`/game-data/en/oow/seasons/${prefix}${padded}.json`);
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.floors) ? json.floors : [];
  } catch {
    return [];
  }
}
