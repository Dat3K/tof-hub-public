import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { deepClone } from '../split-merge';

const FALLBACK_BYGONE_DATASET = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  totalFloors: 5,
  totalUniqueFloors: 5,
  floors: [
    {
      floor: 1,
      is_boss_floor: false,
      monster_level: 18,
      round_gs: 10800,
      hp_multiplier: 1.13,
      atk_multiplier: 1.08,
      final_hp: 203,
      final_atk: 2,
      weakness: [],
      primary_enemy: {
        canonicalEnemyId: 'elite_ldz_dljqr',
        name_en: 'Elite LDZ DLJQR',
        name_ru: 'Elite LDZ DLJQR',
        element: 'None',
        is_boss: false,
      },
      monsters: [],
    },
    {
      floor: 5,
      is_boss_floor: true,
      monster_level: 22,
      round_gs: 11300,
      hp_multiplier: 1.43,
      atk_multiplier: 1.21,
      final_hp: 1015,
      final_atk: 8,
      weakness: [{ element: 'Physical', element_ru: 'Физический' }],
      primary_enemy: {
        canonicalEnemyId: 'mon_hum_006',
        name_en: 'Minotaur',
        name_ru: 'Минотавр',
        element: 'Physical',
        is_boss: true,
      },
      monsters: [],
    },
  ],
};

export function normalizeBygoneDataset(legacySourceDir: string): DatasetNormalizationResult {
  const filePath = path.join(legacySourceDir, 'datamine', 'bygone', 'data', 'bygone.json');
  let rawData: any = null;

  if (fs.existsSync(filePath)) {
    try {
      rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      rawData = null;
    }
  }

  if (!rawData) {
    rawData = deepClone(FALLBACK_BYGONE_DATASET);
  }

  const rawFloors: any[] = Array.isArray(rawData.floors) ? rawData.floors : [];

  const coreFloors: any[] = [];
  const overlayEnFloors: any[] = [];
  const overlayRuFloors: any[] = [];
  const matEnFloors: any[] = [];
  const matRuFloors: any[] = [];

  for (const f of rawFloors) {
    const floorNum = Number(f.floor ?? 0);
    const prim = f.primary_enemy || {};

    const coreFloor = {
      floor: floorNum,
      is_boss_floor: Boolean(f.is_boss_floor),
      monster_level: f.monster_level,
      round_gs: f.round_gs,
      hp_multiplier: f.hp_multiplier,
      atk_multiplier: f.atk_multiplier,
      final_hp: f.final_hp,
      final_atk: f.final_atk,
      scaling: f.scaling,
      computed_stats: f.computed_stats,
      primary_enemy: {
        canonicalEnemyId: prim.canonicalEnemyId || prim.class_name || null,
        element: prim.element || 'None',
        is_boss: Boolean(prim.is_boss),
        image: prim.image || null,
        imageThumb: prim.imageThumb || null,
      },
      monsters: f.monsters || [],
    };

    const overlayEn = {
      floor: floorNum,
      primary_enemy: {
        name: prim.name_en || prim.name || '',
      },
      weakness: Array.isArray(f.weakness)
        ? f.weakness.map((w: any) => ({ element: w.element || '' }))
        : [],
    };

    const overlayRu = {
      floor: floorNum,
      primary_enemy: {
        name: prim.name_ru || prim.name_en || prim.name || '',
      },
      weakness: Array.isArray(f.weakness)
        ? f.weakness.map((w: any) => ({ element: w.element_ru || w.element || '' }))
        : [],
    };

    // Materialized preserve full shape per BygoneFloorRawSchema
    const matEn = {
      ...f,
      primary_enemy: {
        ...prim,
        name: prim.name_en || prim.name || '',
      },
    };

    const matRu = {
      ...f,
      primary_enemy: {
        ...prim,
        name: prim.name_ru || prim.name_en || prim.name || '',
      },
    };

    coreFloors.push(coreFloor);
    overlayEnFloors.push(overlayEn);
    overlayRuFloors.push(overlayRu);
    matEnFloors.push(matEn);
    matRuFloors.push(matRu);
  }

  const matEn = {
    schemaVersion: rawData.schemaVersion || 2,
    generatedAt: rawData.generatedAt || new Date().toISOString(),
    totalFloors: matEnFloors.length,
    floors: matEnFloors,
    monsterPools: rawData.monsterPools || [],
    identityCoverage: rawData.identityCoverage,
    sources: rawData.sources,
  };

  const matRu = {
    schemaVersion: rawData.schemaVersion || 2,
    generatedAt: rawData.generatedAt || new Date().toISOString(),
    totalFloors: matRuFloors.length,
    floors: matRuFloors,
    monsterPools: rawData.monsterPools || [],
    identityCoverage: rawData.identityCoverage,
    sources: rawData.sources,
  };

  return {
    datasetName: 'bygone',
    core: {
      schemaVersion: rawData.schemaVersion || 2,
      totalFloors: coreFloors.length,
      floors: coreFloors,
      monsterPools: rawData.monsterPools || [],
    identityCoverage: rawData.identityCoverage,
    sources: rawData.sources,
    },
    overlays: {
      en: {
        totalFloors: overlayEnFloors.length,
        floors: overlayEnFloors,
      },
      ru: {
        totalFloors: overlayRuFloors.length,
        floors: overlayRuFloors,
      },
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts: {
      total: matEnFloors.length,
    },
  };
}
