import type { GameDataCacheKey } from './types';

/**
 * Normalizes dataset name by removing leading slashes and .json extension.
 */
export function normalizeDatasetName(dataset: string): string {
  return dataset
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.json$/, '');
}

/**
 * Constructs a cache key with the format `<locale>:<dataset>`.
 */
export function buildCacheKey(locale: string, dataset: string): GameDataCacheKey {
  return `${locale}:${normalizeDatasetName(dataset)}`;
}

/**
 * In-memory, Promise-aware game dataset cache.
 * Stored only in tab memory during application lifecycle.
 */
export class GameDataCache {
  private readonly entries = new Map<string, Promise<unknown>>();
  private readonly resolved = new Map<string, unknown>();

  /**
   * Returns the pending or resolved Promise for the given locale and dataset, if cached.
   */
  public get<T>(locale: string, dataset: string): Promise<T> | undefined {
    const key = buildCacheKey(locale, dataset);
    return this.entries.get(key) as Promise<T> | undefined;
  }

  /**
   * Returns the synchronously resolved data if the dataset has already completed loading.
   */
  public getResolved<T>(locale: string, dataset: string): T | undefined {
    const key = buildCacheKey(locale, dataset);
    return this.resolved.get(key) as T | undefined;
  }

  /**
   * Checks whether a Promise exists in the cache for the given locale and dataset.
   */
  public has(locale: string, dataset: string): boolean {
    const key = buildCacheKey(locale, dataset);
    return this.entries.has(key);
  }

  /**
   * Checks whether the dataset is already resolved in memory.
   */
  public hasResolved(locale: string, dataset: string): boolean {
    const key = buildCacheKey(locale, dataset);
    return this.resolved.has(key);
  }

  /**
   * Stores a Promise in the cache immediately.
   * On resolution, saves the resolved data for synchronous access.
   * On rejection, automatically removes the failed entry so subsequent requests can retry.
   */
  public set<T>(locale: string, dataset: string, promise: Promise<T>): Promise<T> {
    const key = buildCacheKey(locale, dataset);
    this.entries.set(key, promise as Promise<unknown>);

    promise
      .then((data) => {
        if (this.entries.get(key) === promise) {
          this.resolved.set(key, data);
        }
        return data;
      })
      .catch(() => {
        // Evict failed entry to allow retry on next attempt
        if (this.entries.get(key) === promise) {
          this.entries.delete(key);
          this.resolved.delete(key);
        }
      });

    return promise;
  }

  /**
   * Returns existing cached Promise if present; otherwise creates, caches, and returns a new Promise.
   * Placing the pending Promise into cache immediately guarantees duplicate concurrent requests
   * share a single fetch.
   */
  public getOrFetch<T>(
    locale: string,
    dataset: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const existing = this.get<T>(locale, dataset);
    if (existing) {
      return existing;
    }

    const promise = Promise.resolve().then(() => fetcher());
    this.set(locale, dataset, promise);
    return promise;
  }

  /**
   * Seeds the cache with pre-resolved data (e.g. from SSR hydration).
   */
  public seed<T>(locale: string, dataset: string, data: T): void {
    const key = buildCacheKey(locale, dataset);
    this.entries.set(key, Promise.resolve(data));
    this.resolved.set(key, data);
  }

  /**
   * Removes a specific dataset from cache.
   */
  public delete(locale: string, dataset: string): boolean {
    const key = buildCacheKey(locale, dataset);
    const hadEntry = this.entries.delete(key);
    this.resolved.delete(key);
    return hadEntry;
  }

  /**
   * Clears the entire in-memory dataset cache.
   */
  public clear(): void {
    this.entries.clear();
    this.resolved.clear();
  }

  /**
   * Number of active entries in cache.
   */
  public size(): number {
    return this.entries.size;
  }

  /**
   * List of all cached keys.
   */
  public keys(): string[] {
    return Array.from(this.entries.keys());
  }
}

/**
 * Tab-level singleton game data cache instance.
 */
export const gameDataCache = new GameDataCache();
