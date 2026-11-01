import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult, SupportedLocale } from '../types';

type Locale = SupportedLocale;

function emptyDataset() {
  return {
    schemaVersion: 1,
    summary: {},
    tables: [],
    localizedTexts: [],
    mediaAssets: [],
    source: {},
    unresolved: {},
  };
}

export function normalizeMmoBuildDataset(legacySourceDir: string): DatasetNormalizationResult {
  const filePath = path.join(legacySourceDir, 'datamine', 'mmo-build', 'data', 'mmo-build.json');
  const raw = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : emptyDataset();
  const texts = Array.isArray(raw.localizedTexts) ? raw.localizedTexts : [];
  const tables = Array.isArray(raw.tables) ? raw.tables : [];
  const mediaAssets = Array.isArray(raw.mediaAssets) ? raw.mediaAssets : [];
  const core = { ...raw, localizedTexts: undefined };

  const overlays = Object.fromEntries((['en', 'ru'] as const).map((locale) => [locale, {
    localizedTexts: texts.map((entry: any) => ({
      table: entry.table,
      row: entry.row,
      field: entry.field,
      reference: entry.reference,
      text: entry[locale]?.text || '',
      localization: {
        status: entry[locale]?.status || 'unresolved',
        resolvedLocale: entry[locale]?.resolvedLocale ?? null,
      },
    })),
  }])) as Record<Locale, any>;

  const materialize = (locale: Locale) => ({
    ...core,
    locale,
    localizedTexts: overlays[locale].localizedTexts,
  });

  return {
    datasetName: 'mmo-build',
    core,
    overlays,
    materialized: { en: materialize('en'), ru: materialize('ru') },
    counts: {
      total: tables.reduce((sum: number, table: any) => sum + (Number(table.rowCount) || 0), 0),
      equipment: Number(raw.summary?.equipmentItems) || 0,
      modCards: Number(raw.summary?.modCards) || 0,
      tables: tables.length,
      mediaAssets: mediaAssets.length,
    },
  };
}
