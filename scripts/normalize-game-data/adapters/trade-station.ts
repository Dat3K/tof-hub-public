import fs from 'node:fs';
import path from 'node:path';
import type { TradeStationDataset } from '../../../packages/contracts/src/trade-station';
import type { DatasetNormalizationResult } from '../types';

/** A checkout without the processor output can still normalize other datasets. */
export function normalizeTradeStationDataset(legacySourceDir: string):
  DatasetNormalizationResult<TradeStationDataset, Record<string, never>, TradeStationDataset> | null {
  const file = path.join(legacySourceDir, 'datamine', 'trade-station', 'data', 'trade-station.json');
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  let dataset: TradeStationDataset;
  try {
    dataset = JSON.parse(raw.replace(/^\uFEFF/, '')) as TradeStationDataset;
  } catch (error) {
    throw new Error(`Invalid Trade Station JSON at ${file}`, { cause: error });
  }
  if (typeof dataset?.currency?.code !== 'string' || typeof dataset.currency.name !== 'string'
    || !Array.isArray(dataset.sections) || !dataset.sections.length
    || !Array.isArray(dataset.rows) || !dataset.rows.length
    || dataset.rows.some(row => typeof row?.id !== 'string' || typeof row.canList !== 'boolean')) {
    throw new Error(`Invalid Trade Station dataset at ${file}`);
  }

  return {
    datasetName: 'trade-station',
    localeIndependent: true,
    core: dataset,
    overlays: { en: {}, ru: {} },
    materialized: { en: dataset, ru: dataset },
    counts: {
      total: dataset.rows.length,
      listable: dataset.rows.filter((row) => row.canList === true).length,
      sections: dataset.sections.length,
    },
  };
}
