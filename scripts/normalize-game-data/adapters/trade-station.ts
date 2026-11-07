import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';

/**
 * Trade Station rows are locale-independent: item names and category labels stay English in every
 * locale tree. The normalizer therefore writes a single `runtime/trade-station.json`, the file the
 * page reads, instead of one projection per locale.
 */
interface TradeStationProjection {
  currency: { code: string; name: string };
  sections: unknown[];
  rows: Array<{ canList?: boolean }>;
  rules?: unknown;
}

const EMPTY_DATASET: TradeStationProjection = {
  currency: { code: 'TradeDiamond', name: 'Universal Crystal' },
  sections: [],
  rows: [],
};

/**
 * Materialized from the processor's staging file. A checkout without a game export has no file, so
 * the dataset stays empty and the page renders its own empty state instead of failing the route.
 */
export function normalizeTradeStationDataset(legacySourceDir: string): DatasetNormalizationResult {
  const file = path.join(legacySourceDir, 'datamine', 'trade-station', 'data', 'trade-station.json');
  let dataset: TradeStationProjection = EMPTY_DATASET;

  if (fs.existsSync(file)) {
    try {
      // Parsed JSON boundary: the processor owns this file's shape; the guard below checks it.
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as TradeStationProjection;
      if (Array.isArray(parsed?.rows) && Array.isArray(parsed?.sections)) {
        dataset = parsed;
      }
    } catch {
      // Keep the empty projection: one unreadable staging file must not fail the other datasets.
    }
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
