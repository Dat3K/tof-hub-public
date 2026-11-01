import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { sortById, deepClone, extractLocalizedStrings } from '../split-merge';

function normalizeGameSourcePath(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  if (/^(?:Hotta|Engine)\/Content\//i.test(normalized)) return normalized;
  if (/^Content\//i.test(normalized)) return `Hotta/${normalized}`;
  return normalized;
}

export function normalizeArtsDataset(legacySourceDir: string): DatasetNormalizationResult {
  const filePath = path.join(legacySourceDir, 'info', 'arts', 'data', 'artworks.json');
  let rawData: any = { total: 0, categories: {}, items: [] };

  if (fs.existsSync(filePath)) {
    try {
      rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      rawData = { total: 0, categories: {}, items: [] };
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

  for (const raw of rawItems) {
    const id = String(raw.id || '');
    const titles = extractLocalizedStrings(raw, 'title');
    const charNames = extractLocalizedStrings(raw, 'characterName');
    const sourcePath = normalizeGameSourcePath(raw.sourcePath);
    const hasGameSourcePath = /^(?:Hotta|Engine)\/Content\//i.test(sourcePath);
    const gameWebpUrl = hasGameSourcePath
      ? `/datamine/shared/media/${sourcePath}.webp`
      : '';
    const gamePngUrl = hasGameSourcePath
      ? `/datamine/shared/media/${sourcePath}.png`
      : '';

    const core: Record<string, any> = {
      id,
      category: raw.category || 'others',
      subCategory: raw.subCategory || null,
      themeTag: raw.themeTag || null,
      width: Number(raw.width ?? 1920),
      height: Number(raw.height ?? 1080),
      aspectRatio: raw.aspectRatio || '16:9',
      aspectLabel: raw.aspectLabel || '16:9',
      url: gameWebpUrl || raw.url || raw.webpUrl || '',
      webpUrl: gameWebpUrl || raw.webpUrl || raw.url || '',
      pngUrl: gamePngUrl || raw.pngUrl || raw.url || '',
      thumbUrl: gameWebpUrl || raw.thumbUrl || raw.webpUrl || raw.url || '',
      originalFileName: raw.originalFileName || '',
      sourcePath,
      sizeBytes: Number(raw.sizeBytes ?? 0),
      pngSizeBytes: typeof raw.pngSizeBytes === 'number' ? raw.pngSizeBytes : undefined,
      characterKey: raw.characterKey || null,
      season: raw.season != null ? String(raw.season) : null,
    };

    const overlayEn = {
      id,
      title: titles.en,
      characterName: charNames.en || null,
    };

    const overlayRu = {
      id,
      title: titles.ru,
      characterName: charNames.ru || null,
    };

    const matEn = {
      ...deepClone(core),
      title: titles.en,
      characterName: charNames.en || null,
    };

    const matRu = {
      ...deepClone(core),
      title: titles.ru,
      characterName: charNames.ru || null,
    };

    coreItems.push(core);
    overlayEnItems.push(overlayEn);
    overlayRuItems.push(overlayRu);
    materializedEnItems.push(matEn);
    materializedRuItems.push(matRu);
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
    categories: rawData.categories || {},
    items: sortedMatEn,
  };

  const matRu = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedMatRu.length,
    categories: rawData.categories || {},
    items: sortedMatRu,
  };

  return {
    datasetName: 'arts',
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
    },
  };
}
