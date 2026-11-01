import fs from 'node:fs';
import path from 'node:path';
import { getStandardPetStatsAtLevel } from '@tof-hub/game-domain';
import type { DatasetNormalizationResult } from '../types';
import { sortById, deepClone, extractLocalizedStrings } from '../split-merge';

function normalizeCombatPetStats(raw: any) {
  const progression = raw?.stats_progression;
  const id = String(raw?.id || '').toLowerCase();
  const isMmo = raw?.source_edition === 'mmo' || id.startsWith('mmo_');
  if (isMmo || !progression?.levels) return progression || null;

  const levels = Object.fromEntries(
    Object.entries(progression.levels).map(([key, value]) => {
      const stats = value as Record<string, unknown>;
      const corrected = getStandardPetStatsAtLevel(
        typeof stats.level === 'number' ? stats.level : Number(key),
      );
      return [key, { ...stats, ...corrected }];
    }),
  );

  return { ...progression, levels };
}

export function normalizePetsDataset(legacySourceDir: string): DatasetNormalizationResult {
  const filePath = path.join(legacySourceDir, 'info', 'pets', 'data', 'pets.json');
  let rawData: any = { items: [], modules: [] };

  if (fs.existsSync(filePath)) {
    try {
      rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      rawData = { items: [], modules: [] };
    }
  }

  const rawItems: any[] = Array.isArray(rawData.items)
    ? rawData.items
    : Array.isArray(rawData)
      ? rawData
      : [];

  const rawModules: any[] = Array.isArray(rawData.modules) ? rawData.modules : [];

  const coreItems: any[] = [];
  const overlayEnItems: any[] = [];
  const overlayRuItems: any[] = [];
  const materializedEnItems: any[] = [];
  const materializedRuItems: any[] = [];

  for (const raw of rawItems) {
    const id = String(raw.id || '');
    const names = extractLocalizedStrings(raw, 'name');
    const descs = extractLocalizedStrings(raw, 'desc');

    const core: Record<string, any> = {
      id,
      category: raw.category || 'combat',
      source_edition: raw.source_edition || 'standard',
      quality: raw.quality || 'SSR',
      element: raw.element || 'Physics',
      element_norm: raw.element_norm || 'phys',
      property: raw.property || 'Attack',
      role: raw.role || 'Attack',
      role_norm: raw.role_norm || 'dps',
      icon: raw.icon || '',
      icon_thumb: raw.icon_thumb || raw.icon || '',
      photo: raw.photo || raw.icon || '',
      photo_thumb: raw.photo_thumb || raw.photo || raw.icon || '',
      token_icon: raw.token_icon || '',
      token_icon_thumb: raw.token_icon_thumb || raw.token_icon || '',
      media: raw.media || undefined,
      stats_progression: normalizeCombatPetStats(raw),
    };

    const starsCore: any[] = [];
    const starsEn: any[] = [];
    const starsRu: any[] = [];

    if (Array.isArray(raw.stars)) {
      for (const s of raw.stars) {
        starsCore.push({
          star: Number(s.star ?? 0),
          atk_inheritance: s.atk_inheritance,
          module_slots: s.module_slots,
          module_load: s.module_load,
          gold_cost: s.gold_cost,
          pet_level_req: s.pet_level_req,
        });
        const sDescs = extractLocalizedStrings(s, 'desc');
        starsEn.push({ star: Number(s.star ?? 0), desc: sDescs.en, description: sDescs.en });
        starsRu.push({ star: Number(s.star ?? 0), desc: sDescs.ru, description: sDescs.ru });
      }
    }
    core.stars = starsCore;

    const skillsCore: any[] = [];
    const skillsEn: any[] = [];
    const skillsRu: any[] = [];

    if (Array.isArray(raw.skills)) {
      for (const sk of raw.skills) {
        skillsCore.push({
          icon: sk.icon || '',
          icon_thumb: sk.icon_thumb || sk.icon || '',
          media: sk.media || undefined,
        });
        const skNames = extractLocalizedStrings(sk, 'name');
        const skDescs = extractLocalizedStrings(sk, 'desc');
        skillsEn.push({
          icon: sk.icon || '',
          icon_thumb: sk.icon_thumb || sk.icon || '',
          media: sk.media || undefined,
          name: skNames.en,
          description: skDescs.en,
        });
        skillsRu.push({
          icon: sk.icon || '',
          icon_thumb: sk.icon_thumb || sk.icon || '',
          media: sk.media || undefined,
          name: skNames.ru,
          description: skDescs.ru,
        });
      }
    }
    core.skills = skillsCore;

    const overlayEn = {
      id,
      name: names.en,
      name_en: names.en,
      name_ru: names.ru,
      original_name: raw.original_name || names.en,
      desc: descs.en,
      desc_en: descs.en,
      desc_ru: descs.ru,
      description: descs.en,
      stars: starsEn,
      skills: skillsEn,
    };

    const overlayRu = {
      id,
      name: names.ru,
      name_en: names.en,
      name_ru: names.ru,
      original_name: raw.original_name || names.en,
      desc: descs.ru,
      desc_en: descs.en,
      desc_ru: descs.ru,
      description: descs.ru,
      stars: starsRu,
      skills: skillsRu,
    };

    const materializedEn = {
      ...deepClone(core),
      ...overlayEn,
      stars: starsCore.map((sc, i) => ({ ...sc, ...(starsEn[i] || {}) })),
      skills: skillsEn,
    };

    const materializedRu = {
      ...deepClone(core),
      ...overlayRu,
      stars: starsCore.map((sc, i) => ({ ...sc, ...(starsRu[i] || {}) })),
      skills: skillsRu,
    };

    coreItems.push(core);
    overlayEnItems.push(overlayEn);
    overlayRuItems.push(overlayRu);
    materializedEnItems.push(materializedEn);
    materializedRuItems.push(materializedRu);
  }

  // Modules processing
  const modulesEn: any[] = [];
  const modulesRu: any[] = [];
  for (const m of rawModules) {
    const mNames = extractLocalizedStrings(m, 'name');
    modulesEn.push({
      ...m,
      name: mNames.en,
      name_en: mNames.en,
      name_ru: mNames.ru,
    });
    modulesRu.push({
      ...m,
      name: mNames.ru,
      name_en: mNames.en,
      name_ru: mNames.ru,
    });
  }

  const sortedCore = sortById(coreItems);
  const sortedOverlayEn = sortById(overlayEnItems);
  const sortedOverlayRu = sortById(overlayRuItems);
  const sortedMatEn = sortById(materializedEnItems);
  const sortedMatRu = sortById(materializedRuItems);

  const matEn = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedMatEn.length,
    counts: rawData.counts || { total: sortedMatEn.length },
    items: sortedMatEn,
    pets: sortedMatEn,
    modules: modulesEn,
    module_families: rawData.module_families || [],
  };

  const matRu = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedMatRu.length,
    counts: rawData.counts || { total: sortedMatRu.length },
    items: sortedMatRu,
    pets: sortedMatRu,
    modules: modulesRu,
    module_families: rawData.module_families || [],
  };

  return {
    datasetName: 'pets',
    core: {
      schemaVersion: 1,
      total: sortedCore.length,
      items: sortedCore,
      modules: rawModules,
    },
    overlays: {
      en: {
        total: sortedOverlayEn.length,
        items: sortedOverlayEn,
        modules: modulesEn,
      },
      ru: {
        total: sortedOverlayRu.length,
        items: sortedOverlayRu,
        modules: modulesRu,
      },
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts: {
      total: sortedMatEn.length,
      modules: rawModules.length,
    },
  };
}
