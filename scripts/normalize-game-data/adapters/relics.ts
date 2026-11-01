import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { sortById, deepClone, extractLocalizedStrings } from '../split-merge';

export function normalizeRelicsDataset(legacySourceDir: string): DatasetNormalizationResult {
  const filePath = path.join(legacySourceDir, 'info', 'relics', 'data', 'relics.json');
  let rawData: any = { items: [] };

  if (fs.existsSync(filePath)) {
    try {
      rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      rawData = { items: [] };
    }
  }

  const rawItems: any[] = Array.isArray(rawData.items)
    ? rawData.items
    : Array.isArray(rawData)
      ? rawData
      : [];

  const coreItems: any[] = [];
  const overlayEnItems: any[] = [];
  const overlayRuItems: any[] = [];
  const materializedEnItems: any[] = [];
  const materializedRuItems: any[] = [];

  const gachaEn: any[] = [];
  const gachaRu: any[] = [];
  const mmoEn: any[] = [];
  const mmoRu: any[] = [];

  for (const raw of rawItems) {
    const id = String(raw.id || '');
    const names = extractLocalizedStrings(raw, 'name');
    const descs = extractLocalizedStrings(raw, 'desc');

    const core: Record<string, any> = {
      id,
      canonical_id: raw.canonical_id || id,
      server_mode: raw.server_mode || 'gacha',
      edition: raw.edition || 'overseas',
      quality: raw.quality || 'SSR',
      property: raw.property || 'Assist',
      card_image: raw.card_image || raw.icon || '',
      card_image_thumb: raw.card_image_thumb || raw.card_image || raw.icon || '',
      attack_icon: raw.attack_icon || raw.icon || '',
      attack_icon_thumb: raw.attack_icon_thumb || raw.attack_icon || '',
      item_icon: raw.item_icon || raw.icon || '',
      item_icon_thumb: raw.item_icon_thumb || raw.item_icon || '',
      drawing: raw.drawing || null,
      drawing_thumb: raw.drawing_thumb || raw.drawing || null,
      fragment_item_id: raw.fragment_item_id || null,
      ability_tag: raw.ability_tag || null,
      cooldown: typeof raw.cooldown === 'number' ? raw.cooldown : null,
      variants: Array.isArray(raw.variants) ? raw.variants : undefined,
    };

    const starsCore: any[] = [];
    const starsEn: any[] = [];
    const starsRu: any[] = [];

    if (Array.isArray(raw.stars)) {
      for (const s of raw.stars) {
        starsCore.push({ star: Number(s.star ?? 0) });
        const sDescs = extractLocalizedStrings(s, 'desc');
        starsEn.push({ star: Number(s.star ?? 0), desc: sDescs.en, description: sDescs.en });
        starsRu.push({ star: Number(s.star ?? 0), desc: sDescs.ru, description: sDescs.ru });
      }
    }
    core.stars = starsCore;

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
    };

    const materializedEn = {
      ...deepClone(core),
      ...overlayEn,
      stars: starsEn,
    };

    const materializedRu = {
      ...deepClone(core),
      ...overlayRu,
      stars: starsRu,
    };

    coreItems.push(core);
    overlayEnItems.push(overlayEn);
    overlayRuItems.push(overlayRu);
    materializedEnItems.push(materializedEn);
    materializedRuItems.push(materializedRu);

    if (core.server_mode === 'mmo') {
      mmoEn.push(materializedEn);
      mmoRu.push(materializedRu);
    } else {
      gachaEn.push(materializedEn);
      gachaRu.push(materializedRu);
    }
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
    relics: sortedMatEn,
    gacha: sortById(gachaEn),
    mmo: sortById(mmoEn),
  };

  const matRu = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedMatRu.length,
    counts: rawData.counts || { total: sortedMatRu.length },
    items: sortedMatRu,
    relics: sortedMatRu,
    gacha: sortById(gachaRu),
    mmo: sortById(mmoRu),
  };

  return {
    datasetName: 'relics',
    core: {
      schemaVersion: 1,
      total: sortedCore.length,
      items: sortedCore,
    },
    overlays: {
      en: {
        total: sortedOverlayEn.length,
        items: sortedOverlayEn,
      },
      ru: {
        total: sortedOverlayRu.length,
        items: sortedOverlayRu,
      },
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts: {
      total: sortedMatEn.length,
      gacha: gachaEn.length,
      mmo: mmoEn.length,
    },
  };
}
