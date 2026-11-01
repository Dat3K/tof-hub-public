import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import { FALLBACK_LOCALE } from '@tof-hub/i18n';
import type {
  ReleaseManifest,
  SimulacraDataset,
  MatricesDataset,
  RelicsDataset,
  PetsDataset,
  CosmeticsDataset,
  ArtworksDataset,
} from '@tof-hub/contracts';
import {
  resolveServerDatasetPath,
  resolveServerManifestPath,
  resolveServerChangelogPath,
  getServerGameDataRoot,
} from './config';
import type { ServerGameDataOptions } from './types';
import { runtimeDatasetName, runtimeDetailPath, matchesRuntimeEntity } from '../game-data-runtime';

/**
 * Request-scoped deduplication disk loader using React's cache().
 *
 * In Next.js Server Components, cache() guarantees:
 * - Within a single incoming HTTP request, identical calls (same locale + dataset + root)
 *   read from disk and parse JSON only once.
 * - No cross-request in-memory cache exists: when the user reloads the browser, a fresh
 *   request lifecycle begins and disk files are re-read anew.
 * - Mutable game JSON is never bundled at build time.
 */
const readDatasetFileCached = cache(
  async (locale: string, dataset: string, dataRoot?: string): Promise<string> => {
    const filePath = resolveServerDatasetPath(locale, dataset, dataRoot);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Game dataset file not found: [${locale}/${dataset}.json] at ${filePath}`);
    }
    return fs.promises.readFile(filePath, 'utf8');
  }
);

/**
 * Loads a localized game dataset from the server data root with request-scoped deduplication.
 */
export async function loadServerGameData<T = unknown>(
  locale: string,
  dataset: string,
  options: ServerGameDataOptions = {}
): Promise<T> {
  try {
    // Resolve the culture once for both the list and its hashed detail shards.
    if (locale !== FALLBACK_LOCALE && !fs.existsSync(resolveServerDatasetPath(locale, runtimeDatasetName(dataset), options.dataRoot)) && !fs.existsSync(resolveServerDatasetPath(locale, dataset, options.dataRoot))) {
      const fallback = await loadServerGameData<T>(FALLBACK_LOCALE, dataset, options);
      return fallback && typeof fallback === 'object' && '_locale' in fallback
        ? { ...fallback, _locale: locale, _sourceLocale: FALLBACK_LOCALE } : fallback;
    }
    const runtimeName = runtimeDatasetName(dataset);
    // Old fixture/data roots remain readable while deployment preflight requires
    // generated runtime files. Never substitute old data for a broken runtime JSON.
    const name = runtimeName !== dataset && fs.existsSync(resolveServerDatasetPath(locale,runtimeName,options.dataRoot))
      ? runtimeName : dataset;
    const data = await readParsedDatasetCached(locale,name,options.dataRoot);
    if (!options.selectedId || !data || typeof data !== 'object') return data as T;
    const entries = Object.entries(data);
    const arrays = entries.filter(([,value])=>Array.isArray(value));
    const selected = [...arrays.filter(([key])=>key === options.selectedCollection), ...arrays]
      .flatMap(([,value])=>value as unknown[])
      .find(item=>item && matchesRuntimeEntity(item,options.selectedId!));
    const detailPath = runtimeDetailPath(selected);
    if (!detailPath) return data as T;
    const detail = await readParsedDatasetCached(locale,detailPath,options.dataRoot);
    // Return a request-local copy. A selected full entity must never overwrite
    // another request's catalog or another collection's same-id entity.
    return Object.fromEntries(entries.map(([key,value])=>[key,Array.isArray(value)
      ? value.map(item=>runtimeDetailPath(item) === detailPath ? detail : item) : value])) as T;
  } catch (error: any) {
    if (options.throwOnNotFound === false) {
      return null as T;
    }
    throw new Error(
      `Failed to load server game data for [${locale}:${dataset}]: ${error?.message || error}`
    );
  }
}

const readParsedDatasetCached = cache(async (locale:string,dataset:string,dataRoot?:string):Promise<any> =>
  JSON.parse(await readDatasetFileCached(locale,dataset,dataRoot)),
);

/**
 * Typed loader: Simulacra dataset
 */
export async function loadServerSimulacra(
  locale: string,
  options?: ServerGameDataOptions
): Promise<SimulacraDataset> {
  const data = await loadServerGameData<SimulacraDataset>(locale, 'simulacra', options);
  return data && !(data as any)._runtime ? withWeaponGrowth(data, options?.dataRoot) : data;
}

const readWeaponGrowth = cache((dataRoot?: string): Record<string, unknown> => {
  const filePath = path.join(getServerGameDataRoot(dataRoot), 'weapon-growth.json');
  try {
    return (JSON.parse(fs.readFileSync(filePath, 'utf8')) as { weapons?: Record<string, unknown> }).weapons ?? {};
  } catch {
    return {};
  }
});

/**
 * Raw level/star growth (scripts/generators/build-weapon-growth.cjs) for gacha weapons. MMO weapons use
 * separate upgrade tables and keep the legacy endpoints.
 */
function withWeaponGrowth(data: SimulacraDataset, dataRoot?: string): SimulacraDataset {
  const growth = readWeaponGrowth(dataRoot);
  const attach = (items?: SimulacraDataset['items']) => items?.map((item) => {
    const entry = item.weapon_id ? growth[String(item.weapon_id).toLowerCase()] : undefined;
    return entry ? { ...item, growth: entry } : item;
  });
  return { ...data, items: attach(data.items) ?? data.items, gacha: attach(data.gacha) } as SimulacraDataset;
}

/**
 * Typed loader: Matrices dataset
 */
export async function loadServerMatrices(
  locale: string,
  options?: ServerGameDataOptions
): Promise<MatricesDataset> {
  return loadServerGameData<MatricesDataset>(locale, 'matrices', options);
}

/**
 * Typed loader: Relics dataset
 */
export async function loadServerRelics(
  locale: string,
  options?: ServerGameDataOptions
): Promise<RelicsDataset> {
  return loadServerGameData<RelicsDataset>(locale, 'relics', options);
}

/**
 * Typed loader: Pets dataset
 */
export async function loadServerPets(
  locale: string,
  options?: ServerGameDataOptions
): Promise<PetsDataset> {
  return loadServerGameData<PetsDataset>(locale, 'pets', options);
}

/**
 * Typed loader: Food dataset
 */
export async function loadServerFood(
  locale: string,
  options?: ServerGameDataOptions
): Promise<any> {
  return loadServerGameData<any>(locale, 'food', options);
}

/**
 * Typed loader: MMO food dataset (scripts/generators/build-mmo-food.cjs), same item shapes as Food.
 */
export async function loadServerFoodMmo(
  locale: string,
  options?: ServerGameDataOptions
): Promise<any> {
  return loadServerGameData<any>(locale, 'food-mmo', options);
}

/**
 * Typed loader: Cosmetics dataset
 */
export async function loadServerCosmetics(
  locale: string,
  options?: ServerGameDataOptions
): Promise<CosmeticsDataset> {
  return loadServerGameData<CosmeticsDataset>(locale, 'cosmetics', options);
}

/**
 * Typed loader: Arts dataset
 */
export async function loadServerArts(
  locale: string,
  options?: ServerGameDataOptions
): Promise<ArtworksDataset> {
  return loadServerGameData<ArtworksDataset>(locale, 'arts', options);
}

/**
 * Request-scoped cached reader for release manifest.
 */
const readManifestFileCached = cache(async (dataRoot?: string): Promise<string> => {
  const filePath = resolveServerManifestPath(dataRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Release manifest file not found at ${filePath}`);
  }
  return fs.promises.readFile(filePath, 'utf8');
});

/**
 * Typed loader: Release Manifest
 */
export async function loadServerReleaseManifest(
  options: ServerGameDataOptions = {}
): Promise<ReleaseManifest> {
  try {
    const raw = await readManifestFileCached(options.dataRoot);
    return JSON.parse(raw) as ReleaseManifest;
  } catch (error: any) {
    if (options.throwOnNotFound === false) {
      return null as any;
    }
    throw new Error(`Failed to load server release manifest: ${error?.message || error}`);
  }
}

/**
 * Request-scoped cached reader for changelog baselines.
 */
const readChangelogFileCached = cache(
  async (filename: string, dataRoot?: string): Promise<string> => {
    const filePath = resolveServerChangelogPath(filename, dataRoot);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Changelog baseline file not found at ${filePath}`);
    }
    return fs.promises.readFile(filePath, 'utf8');
  }
);

/**
 * Typed loader: Changelog baseline for Gacha or MMO edition
 */
export async function loadServerChangelogBaseline<T = unknown>(
  edition: 'gacha' | 'mmo',
  options: ServerGameDataOptions = {}
): Promise<T> {
  const filename = edition === 'mmo' ? 'simulacra-mmo' : 'simulacra';
  try {
    const raw = await readChangelogFileCached(filename, options.dataRoot);
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (options.throwOnNotFound === false) {
      return null as any;
    }
    throw new Error(
      `Failed to load changelog baseline [${edition}] (${filename}.json): ${error?.message || error}`
    );
  }
}
