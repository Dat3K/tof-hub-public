import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { deepClone } from '../split-merge';
import { gameAsset } from '../../../packages/game-assets/src/resolver';

const FALLBACK_SEQ_DATASET = {
  meta: {
    generatedAt: new Date().toISOString(),
    sourceFile: 'DT_MonsterStaticData_Overseas.json',
    cachedUpToStage: 35,
    effectiveHpMultiplier: 1.3471,
    rowCount: 1,
  },
  rows: {
    endless_special_boss_1: 266444540,
  },
  stages: [
    {
      stage: 1,
      codename: 'endless_special_boss_1',
      enemyCode: 'boss_hum_001',
      enemyNameEn: 'Franken',
      enemyNameRu: 'Франкен',
      name_en: 'Franken',
      name_ru: 'Франкен',
      maxHealth: 266444540,
      effectiveHp: 358927440,
      atk: 86094,
      def: 7500,
      crit: 0,
      critResist: 0.01,
      element: 'Physical',
      portrait: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss005.webp',
      mechanics: null,
    },
  ],
};

export function normalizeSeqDataset(legacySourceDir: string): DatasetNormalizationResult {
  const cachePath = path.join(legacySourceDir, 'datamine', 'seq', 'data', 'seq-boss-cache.json');
  let rawData: any = null;

  if (fs.existsSync(cachePath)) {
    try {
      rawData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {
      rawData = null;
    }
  }

  if (!rawData) {
    rawData = deepClone(FALLBACK_SEQ_DATASET);
  }

  const rawStages: any[] = Array.isArray(rawData.stages) ? rawData.stages : [];

  const coreStages: any[] = [];
  const overlayEnStages: any[] = [];
  const overlayRuStages: any[] = [];
  const matEnStages: any[] = [];
  const matRuStages: any[] = [];

  for (const s of rawStages) {
    const stageNum = Number(s.stage ?? 0);

    const core = {
      stage: stageNum,
      id: stageNum,
      codename: String(s.codename || `stage_${stageNum}`),
      enemyCode: s.enemyCode || undefined,
      maxHealth: Number(s.maxHealth ?? 0),
      effectiveHp: Number(s.effectiveHp ?? 0),
      atk: typeof s.atk === 'number' ? s.atk : undefined,
      def: typeof s.def === 'number' ? s.def : undefined,
      crit: typeof s.crit === 'number' ? s.crit : undefined,
      critResist: typeof s.critResist === 'number' ? s.critResist : undefined,
      element: s.element || undefined,
      portrait: s.portrait ? gameAsset(s.portrait, 'webp') : null,
    };

    const overlayEn = {
      stage: stageNum,
      id: stageNum,
      enemyName: s.enemyNameEn ?? s.name_en ?? null,
      roomName: s.roomNameEn ?? null,
      mechanics: s.mechanics ?? null,
    };

    const overlayRu = {
      stage: stageNum,
      id: stageNum,
      enemyName: s.enemyNameRu ?? s.name_ru ?? s.enemyNameEn ?? null,
      roomName: s.roomNameRu ?? s.roomNameEn ?? null,
      mechanics: s.mechanics ?? null,
    };

    const matEn = {
      ...s,
      stage: stageNum,
      portrait: s.portrait ? gameAsset(s.portrait, 'webp') : null,
      enemyNameEn: s.enemyNameEn ?? s.name_en ?? null,
      name_en: s.name_en ?? s.enemyNameEn ?? null,
    };

    const matRu = {
      ...s,
      stage: stageNum,
      portrait: s.portrait ? gameAsset(s.portrait, 'webp') : null,
      enemyNameRu: s.enemyNameRu ?? s.name_ru ?? s.enemyNameEn ?? null,
      name_ru: s.name_ru ?? s.enemyNameRu ?? s.name_en ?? null,
    };

    coreStages.push(core);
    overlayEnStages.push(overlayEn);
    overlayRuStages.push(overlayRu);
    matEnStages.push(matEn);
    matRuStages.push(matRu);
  }

  const matEn = {
    meta: rawData.meta || {},
    rows: rawData.rows || {},
    stages: matEnStages,
  };

  const matRu = {
    meta: rawData.meta || {},
    rows: rawData.rows || {},
    stages: matRuStages,
  };

  return {
    datasetName: 'seq',
    core: {
      meta: rawData.meta || {},
      rows: rawData.rows || {},
      total: coreStages.length,
      stages: coreStages,
    },
    overlays: {
      en: {
        total: overlayEnStages.length,
        stages: overlayEnStages,
      },
      ru: {
        total: overlayRuStages.length,
        stages: overlayRuStages,
      },
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts: {
      total: matEnStages.length,
    },
  };
}
