import fs from 'node:fs';
import path from 'node:path';
import type { TradeStationDataset } from '../../../packages/contracts/src/trade-station';

export function readTradeStationDataset(legacySourceDir: string): TradeStationDataset | null {
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
    throw new Error(`Invalid Trade Station JSON at ${file}`, {cause: error});
  }
  if (typeof dataset?.currency?.code !== 'string' || typeof dataset.currency.name !== 'string'
    || !Array.isArray(dataset.rows) || !dataset.rows.length
    || dataset.rows.some(row => typeof row?.id !== 'string' || typeof row.canList !== 'boolean')
    || !Array.isArray(dataset.sections)) {
    throw new Error(`Invalid Trade Station dataset at ${file}`);
  }
  return dataset;
}
