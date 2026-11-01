import { loadServerGameData, resolveServerDatasetPath } from '@/lib/game-data-server';
import type { ServerGameDataOptions } from '@/lib/game-data-server';
import type {
  FceIndexDataset,
  OowCurrentSummaryDataset,
  BygoneDataset,
  SeqCacheDataset,
  MultypeRenamesDataset,
  DatamineItemsDataset,
} from '@tof-hub/contracts';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Server Loader: FCE Boss Mechanics Catalog
 */
export async function loadServerFceIndex(
  locale: string,
  options?: ServerGameDataOptions
): Promise<FceIndexDataset> {
  return loadServerGameData<FceIndexDataset>(locale, 'fce', options);
}

/**
 * Server Loader: FCE Specific Boss Mechanics
 */
export async function loadServerFceBoss(
  slug: string,
  locale: string,
  options?: ServerGameDataOptions
): Promise<any | null> {
  try {
    const catalog = await loadServerFceIndex(locale, options);
    const boss = catalog.bosses.find((b) => b.slug === slug || b.boss_id === slug);
    if (boss) {
      return boss;
    }
  } catch {
    // Continue to disk fallback
  }

  // Fallback to dedicated boss shard if present
  try {
    const bossFile = resolveServerDatasetPath(locale, `datamine/fce/bosses/${slug}`, options?.dataRoot);
    if (fs.existsSync(bossFile)) {
      const raw = await fs.promises.readFile(bossFile, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Server Loader: Origin of War Summary & Current Seasons
 */
export async function loadServerOowSummary(
  locale: string,
  options?: ServerGameDataOptions
): Promise<OowCurrentSummaryDataset> {
  return loadServerGameData<OowCurrentSummaryDataset>(locale, 'oow', options);
}

/**
 * Server Loader: Origin of War Specific Season Details
 */
export async function loadServerOowSeason(
  season: number,
  locale: string,
  options?: ServerGameDataOptions
): Promise<any | null> {
  // Check for season file in public data root
  const candidates = [
    `oow/seasons/s${String(season).padStart(2, '0')}`,
    `datamine/oow/seasons/s${String(season).padStart(2, '0')}`,
    `oow-s${season}`,
  ];

  for (const cand of candidates) {
    try {
      const data = await loadServerGameData<any>(locale, cand, { ...options, throwOnNotFound: false });
      if (data) return data;
    } catch {
      // Try next candidate
    }
  }

  return null;
}

/**
 * Server Loader: Bygone Phantasm (Floors 1-600)
 */
export async function loadServerBygone(
  locale: string,
  options?: ServerGameDataOptions
): Promise<BygoneDataset> {
  return loadServerGameData<BygoneDataset>(locale, 'bygone', options);
}

/**
 * Server Loader: Sequential Phantasm (Stages 1-35)
 */
export async function loadServerSeqCache(
  locale: string,
  options?: ServerGameDataOptions
): Promise<SeqCacheDataset> {
  return loadServerGameData<SeqCacheDataset>(locale, 'seq', options);
}

/**
 * Server Loader: Multi-type Multipliers Taxonomy & Mapping
 */
export async function loadServerMultype(
  locale: string,
  options?: ServerGameDataOptions
): Promise<MultypeRenamesDataset> {
  return loadServerGameData<MultypeRenamesDataset>(locale, 'multype', options);
}

/**
 * Server Loader: Item Datamine Catalog
 */
export async function loadServerDatamineItems(
  locale: string,
  options?: ServerGameDataOptions
): Promise<DatamineItemsDataset> {
  return loadServerGameData<DatamineItemsDataset>(locale, 'items', options);
}
