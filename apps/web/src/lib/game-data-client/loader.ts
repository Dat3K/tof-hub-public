import { buildCacheKey, gameDataCache, GameDataCache, normalizeDatasetName } from './cache';
import type { FetchGameDataOptions } from './types';
import { runtimeDatasetName } from '../game-data-runtime';
import { FALLBACK_LOCALE } from '@tof-hub/i18n';

/**
 * Builds the static URL for a localized dataset file.
 * Root page datasets use `/game-data/<locale>/runtime/<dataset>.json`.
 * Explicit nested shard paths remain unchanged.
 */
export function buildDatasetUrl(locale: string, dataset: string, baseUrl = '/game-data'): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedDataset = runtimeDatasetName(normalizeDatasetName(dataset));
  return `${normalizedBase}/${[locale, normalizedDataset].filter(Boolean).join('/')}.json`;
}

/**
 * Loads a localized game dataset using the Promise-aware cache.
 * Concurrent requests for the same <locale>:<dataset> share one network call.
 * If rejected, the entry is automatically evicted to allow future retry.
 */
export async function fetchGameData<T>(
  locale: string,
  dataset: string,
  options: FetchGameDataOptions = {},
  cache: GameDataCache = gameDataCache
): Promise<T> {
  const fetchFn = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) {
    throw new Error('fetch is not available in the current environment');
  }

  return cache.getOrFetch<T>(locale, dataset, async () => {
    const url = buildDatasetUrl(locale, dataset, options.baseUrl);
    let response = await fetchFn(url, {
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    });

    // Only an absent culture/dataset falls back. Network, server and JSON errors
    // remain visible, and the requested locale keeps its own cache entry.
    const usesFallback = response.status === 404 && locale !== FALLBACK_LOCALE && locale !== '' && locale !== 'handbook';
    if (usesFallback) {
      response = await fetchFn(buildDatasetUrl(FALLBACK_LOCALE, dataset, options.baseUrl), {
        signal: options.signal,
        headers: { Accept: 'application/json', ...options.headers },
      });
    }

    if (!response.ok) {
      throw new Error(
        `Failed to load game data [${buildCacheKey(locale, dataset)}] from ${url} (HTTP ${response.status})`
      );
    }

    const data = await response.json();
    return (usesFallback && data && typeof data === 'object' && '_locale' in data
      ? { ...data, _locale: locale, _sourceLocale: FALLBACK_LOCALE } : data) as T;
  });
}
