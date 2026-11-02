import type { Locale } from '@tof-hub/i18n';

/**
 * Standard cache key format: <locale>:<dataset>
 */
export type GameDataCacheKey = `${Locale | string}:${string}`;

/**
 * Options for network fetches of game datasets.
 */
export interface FetchGameDataOptions {
  /**
   * Custom fetch implementation (useful in test environments or SSR).
   */
  fetchFn?: typeof fetch;

  /**
   * Base URL path for game data files.
   * Defaults to '/game-data'.
   */
  baseUrl?: string;

  /**
   * Optional abort signal.
   */
  signal?: AbortSignal;

  /**
   * Optional custom request headers.
   */
  headers?: HeadersInit;
}

/**
 * Options for the useGameData React hook.
 */
export interface UseGameDataOptions extends FetchGameDataOptions {
  /** Shared, unlocalized catalogs use the data root or the Handbook namespace. */
  namespace?: '' | 'handbook';
  /**
   * Explicit locale override. Defaults to active locale from useLocale().
   */
  locale?: Locale;

  /**
   * Whether fetching is enabled. Defaults to true.
   */
  enabled?: boolean;

  /**
   * Initial data for SSR hydration to avoid duplicate network fetch on mount.
   */
  initialData?: unknown;
}

/**
 * Return type for the useGameData React hook.
 */
export interface UseGameDataReturn<T> {
  /**
   * Loaded dataset or null if not yet loaded / errored.
   */
  data: T | null;

  /**
   * Loading indicator for the current dataset.
   */
  isLoading: boolean;

  /**
   * Error object if the fetch failed, or null.
   */
  error: Error | null;

  /**
   * Force reloads the dataset by clearing the cache entry and re-fetching.
   */
  reload: () => Promise<T>;

  /**
   * The locale currently represented by the hook.
   */
  locale: Locale | string;

  /**
   * The dataset name currently loaded or requested.
   */
  dataset: string | null;
}
