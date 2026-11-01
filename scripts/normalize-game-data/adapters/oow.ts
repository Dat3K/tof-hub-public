import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { deepClone } from '../split-merge';
import { oowStatIcons } from '../oow-stat-media';
import { createOowDifficultyRestorer } from '../oow-difficulty';
import { buildOowEffectCatalog } from '../oow-effects';

type OowRecord = Record<string, any>;

function readJson(filePath: string): OowRecord | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as OowRecord;
  } catch (error) {
    throw new Error(`Invalid OoW JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function seasonNumber(value: unknown): number | null {
  const valueAsNumber = Number(value);
  return Number.isInteger(valueAsNumber) && valueAsNumber > 0 ? valueAsNumber : null;
}

function createSeasonSummary(
  season: OowRecord,
  existing: OowRecord = {},
  mode: 'standard' | 'mmo' = 'standard',
): OowRecord {
  const lastFloor = Array.isArray(season.floors) ? season.floors[season.floors.length - 1] : null;
  const strongest = season.strongestEnemy || lastFloor?.enemies?.[0] || null;
  const bossName = season.bossName || strongest?.nameEn || existing.bossName;
  const isMmoDevourer = mode === 'mmo' && /devourer|пожиратель/i.test(String(bossName || ''));
  const mmoDevourerImage = '/datamine/shared/media/Hotta/Content/Resources/UI/WorldBossList/BOSS/Boss_7.webp';

  return {
    ...existing,
    season: seasonNumber(season.season),
    title: season.title || existing.title,
    startDate: season.startDate || existing.startDate,
    endDate: season.endDate || existing.endDate,
    floorCount: season.floorCount || season.floors?.length || existing.floorCount,
    minFloor: season.minFloor || existing.minFloor,
    maxFloor: season.maxFloor || season.floors?.length || existing.maxFloor,
    totalSeasonHp: season.totalSeasonHp ?? existing.totalSeasonHp,
    totalSeasonEffectiveHp: season.totalSeasonEffectiveHp ?? existing.totalSeasonEffectiveHp,
    finalBossHp: season.finalBossHp ?? strongest?.hp ?? existing.finalBossHp,
    finalBossEffectiveHp:
      season.finalBossEffectiveHp ?? strongest?.effectiveHp ?? strongest?.effHp ?? existing.finalBossEffectiveHp,
    strongestEnemy: strongest || existing.strongestEnemy,
    bossName,
    bossNameRu: season.bossNameRu || strongest?.nameRu || existing.bossNameRu,
    bossImage: isMmoDevourer ? mmoDevourerImage : season.bossImage || strongest?.image || existing.bossImage,
    bossImageThumb: isMmoDevourer ? mmoDevourerImage : season.bossImageThumb || strongest?.imageThumb || existing.bossImageThumb,
    finalBossName: season.finalBossName || season.bossName || strongest?.nameEn || existing.finalBossName,
    finalBossNameRu: season.finalBossNameRu || season.bossNameRu || strongest?.nameRu || existing.finalBossNameRu,
  };
}

function normalizeSeasonPayload(season: OowRecord): OowRecord {
  return {
    ...season,
    floors: (season.floors || []).map((floor: OowRecord) => ({
      ...floor,
      enemies: (floor.enemies || []).map((enemy: OowRecord) => {
        const level =
          typeof enemy.level === 'number' && enemy.level > 0
            ? enemy.level
            : typeof enemy.Level === 'number' && enemy.Level > 0
            ? enemy.Level
            : typeof enemy.resistanceInfo?.level === 'number' && enemy.resistanceInfo.level > 0
            ? enemy.resistanceInfo.level
            : undefined;
        return {
          ...enemy,
          ...(level ? { level } : {}),
        };
      }),
      dropBuffs: (floor.dropBuffs || [])
        .map((buff: unknown) =>
          typeof buff === 'string' ? buff : (buff as OowRecord)?.id || (buff as OowRecord)?.buffPoolId
        )
        .filter(Boolean),
    })),
  };
}

function loadSeasonFiles(seasonsDir: string): {
  standard: Record<string, OowRecord>;
  mmo: Record<string, OowRecord>;
} {
  const standard: Record<string, OowRecord> = {};
  const mmo: Record<string, OowRecord> = {};
  if (!fs.existsSync(seasonsDir)) return { standard, mmo };

  for (const fileName of fs.readdirSync(seasonsDir).filter((file: string) => /^(?:mmo_)?s\d+\.json$/i.test(file))) {
    const season = readJson(path.join(seasonsDir, fileName));
    const number = seasonNumber(season?.season);
    if (!season || number === null || !Array.isArray(season.floors)) continue;
    const target = /^mmo_/i.test(fileName) ? mmo : standard;
    target[String(number)] = normalizeSeasonPayload(season);
  }

  return { standard, mmo };
}

function resolveOowPath(legacySourceDir: string, ...relCandidates: string[]): string {
  for (const rel of relCandidates) {
    const full = path.join(legacySourceDir, rel);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  return path.join(legacySourceDir, relCandidates[0]);
}

export function normalizeOowDataset(legacySourceDir: string, rawSourceDir?: string): DatasetNormalizationResult {
  const summaryPath = resolveOowPath(
    legacySourceDir,
    'datamine/oow/data/current/summary.json'
  );
  const seasonsDir = resolveOowPath(
    legacySourceDir,
    'datamine/oow/data/seasons'
  );
  const buffsPath = resolveOowPath(
    legacySourceDir,
    'datamine/oow/data/oow_buffs_catalog.json'
  );

  const rawSummary = readJson(summaryPath);
  const seasonFiles = loadSeasonFiles(seasonsDir);
  const bundledRaw = path.join(legacySourceDir, 'tof-fast-datamine', 'raw_exports', 'raw_exports');
  const restoreDifficulty = createOowDifficultyRestorer(rawSourceDir || (fs.existsSync(bundledRaw) ? bundledRaw : undefined));
  for (const [number, season] of Object.entries(seasonFiles.standard)) {
    seasonFiles.standard[number] = restoreDifficulty(season);
  }
  if (!rawSummary && Object.keys(seasonFiles.standard).length === 0 && Object.keys(seasonFiles.mmo).length === 0) {
    const fallbackNormalized = resolveOowPath(
      legacySourceDir,
      'pipeline/normalized/core/oow.json',
      'apps/web/public/pipeline/normalized/core/oow.json',
      'local-deploy/pipeline/normalized/core/oow.json'
    );
    const fallbackPublicEn = resolveOowPath(
      legacySourceDir,
      'apps/web/public/game-data/en/datamine/oow.json',
      'local-deploy/game-data/en/datamine/oow.json'
    );
    const fallbackPublicRu = resolveOowPath(
      legacySourceDir,
      'apps/web/public/game-data/ru/datamine/oow.json',
      'local-deploy/game-data/ru/datamine/oow.json'
    );

    if (fs.existsSync(fallbackNormalized) && fs.existsSync(fallbackPublicEn) && fs.existsSync(fallbackPublicRu)) {
      const core = readJson(fallbackNormalized);
      const matEn = readJson(fallbackPublicEn);
      const matRu = readJson(fallbackPublicRu);
      return {
        datasetName: 'oow',
        counts: {
          total: Array.isArray(matEn?.recentSeasons) ? matEn.recentSeasons.length : 0,
          core: Array.isArray(core?.recentSeasons) ? core.recentSeasons.length : 0,
          locales: Array.isArray(matEn?.recentSeasons) ? matEn.recentSeasons.length : 0,
        },
        core,
        overlays: { en: {}, ru: {} },
        materialized: { en: matEn, ru: matRu },
      };
    }

    throw new Error(`OoW export is incomplete: no summary or season files found under ${path.dirname(summaryPath)}`);
  }

  const rawBuffs = (readJson(buffsPath) || {}) as Record<string, OowRecord>;

  // Build localized buffs
  const buffsEn: Record<string, any> = {};
  const buffsRu: Record<string, any> = {};

  for (const [buffId, buff] of Object.entries(rawBuffs)) {
    buffsEn[buffId] = {
      id: buffId,
      name: buff.nameEn || buff.name || buffId,
      desc: buff.descEn || buff.desc || '',
      icon: buff.icon || '',
      type: buff.type || '',
    };
    buffsRu[buffId] = {
      id: buffId,
      name: buff.nameRu || buff.nameEn || buff.name || buffId,
      desc: buff.descRu || buff.descEn || buff.desc || '',
      icon: buff.icon || '',
      type: buff.type || '',
    };
  }

  const rawStandard = Array.isArray(rawSummary?.recentSeasons) ? rawSummary.recentSeasons : [];
  const rawMmo = Array.isArray(rawSummary?.mmoRecentSeasons) ? rawSummary.mmoRecentSeasons : [];
  const mergeSeasons = (items: OowRecord[], files: Record<string, OowRecord>) =>
    Object.values(files)
      .map((season) => createSeasonSummary(season, items.find((item) => item.season === season.season)))
      .sort((a, b) => a.season - b.season);
  const recentSeasons = mergeSeasons(rawStandard, seasonFiles.standard);
  const mmoRecentSeasons = Object.values(seasonFiles.mmo)
    .map((season) => createSeasonSummary(season, rawMmo.find((item) => item.season === season.season), 'mmo'))
    .sort((a, b) => a.season - b.season);
  const standardCurrent = rawSummary?.currentSeason?.season
    ? createSeasonSummary(seasonFiles.standard[String(rawSummary.currentSeason.season)] || rawSummary.currentSeason, rawSummary.currentSeason)
    : recentSeasons[recentSeasons.length - 1] || null;
  const mmoCurrent = rawSummary?.mmoCurrentSeason?.season
    ? createSeasonSummary(seasonFiles.mmo[String(rawSummary.mmoCurrentSeason.season)] || rawSummary.mmoCurrentSeason, rawSummary.mmoCurrentSeason, 'mmo')
    : mmoRecentSeasons[mmoRecentSeasons.length - 1] || null;

  const core = {
    statIcons: oowStatIcons,
    schemaVersion: rawSummary?.schemaVersion || 2,
    meta: rawSummary?.meta || {},
    recentSeasons,
    mmoRecentSeasons,
    currentSeason: standardCurrent,
    mmoCurrentSeason: mmoCurrent,
  };

  const overlayEn = {
    recentSeasons: recentSeasons.map((s: any) => ({
      season: s.season,
      title: s.title,
      bossName: s.bossName || s.bossNameRu || '',
    })),
  };

  const overlayRu = {
    recentSeasons: recentSeasons.map((s: any) => ({
      season: s.season,
      title: s.title,
      bossName: s.bossNameRu || s.bossName || '',
    })),
  };

  const totalSeasons =
    Object.keys(seasonFiles.standard).length + Object.keys(seasonFiles.mmo).length;

  const matEn = {
    ...deepClone(core),
    total: totalSeasons,
    buffs: buffsEn,
  };

  const matRu = {
    ...deepClone(core),
    total: totalSeasons,
    buffs: buffsRu,
  };

  const materializedFiles = {
    en: {} as Record<string, unknown>,
    ru: {} as Record<string, unknown>,
  };
  if (rawSourceDir) {
    const catalog = buildOowEffectCatalog(rawSourceDir, rawBuffs, seasonFiles);
    materializedFiles.en['oow/effects.json'] = catalog;
    materializedFiles.ru['oow/effects.json'] = deepClone(catalog);
  }
  for (const [number, season] of Object.entries(seasonFiles.standard)) {
    materializedFiles.en[`oow/seasons/s${String(number).padStart(2, '0')}.json`] = season;
    materializedFiles.ru[`oow/seasons/s${String(number).padStart(2, '0')}.json`] = deepClone(season);
  }
  for (const [number, season] of Object.entries(seasonFiles.mmo)) {
    materializedFiles.en[`oow/seasons/mmo_s${String(number).padStart(2, '0')}.json`] = season;
    materializedFiles.ru[`oow/seasons/mmo_s${String(number).padStart(2, '0')}.json`] = deepClone(season);
  }

  return {
    datasetName: 'oow',
    core: {
      ...core,
      total: totalSeasons,
    },
    overlays: {
      en: overlayEn,
      ru: overlayRu,
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    materializedFiles,
    counts: {
      total: totalSeasons,
      standardSeasons: Object.keys(seasonFiles.standard).length,
      mmoSeasons: Object.keys(seasonFiles.mmo).length,
      buffs: Object.keys(buffsEn).length,
    },
  };
}
