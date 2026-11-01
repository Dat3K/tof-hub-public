'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from '../i18n';
import { DEFAULT_LOCALE, type Locale } from '@tof-hub/i18n';
import { fetchGameData } from './loader';
import { gameDataCache, GameDataCache } from './cache';
import type { UseGameDataOptions, UseGameDataReturn } from './types';

/**
 * Hook to lazily load and cache localized game datasets.
 * - Only fetches the dataset for the active page and current locale.
 * - Switching back to a previously loaded locale serves data immediately from in-memory cache.
 * - Navigating to a new dataset loads only that dataset for the current locale.
 * - Protects against race conditions: delayed responses from previous locales do not overwrite current view.
 */
export function useGameData<T>(
  dataset: string | null,
  options: UseGameDataOptions = {},
  cache: GameDataCache = gameDataCache
): UseGameDataReturn<T> {
  const { locale: contextLocale } = useLocale();
  const activeLocale: Locale = options.locale ?? contextLocale ?? DEFAULT_LOCALE;
  const enabled = options.enabled !== false && Boolean(dataset);

  // The module cache lives for the whole server process, so on the server it would serve another request's data
  // (e.g. the compact catalog instead of this page's full selected character) and break hydration. Server renders
  // use only this request's initial data; the browser seeds its cache with it.
  const isServer = typeof window === 'undefined';
  // Older datasets and ID-keyed records have no metadata field. Associate their
  // SSR payload with the first render, so a language switch cannot seed old copy.
  const initialLocaleRef = useRef(activeLocale);
  const initialLocale = (options.initialData as {_locale?:string} | null)?._locale ?? initialLocaleRef.current;
  const initialDataMatchesLocale = initialLocale === activeLocale;

  // If initial SSR data is provided and not yet cached, seed the cache
  if (!isServer && dataset && options.initialData !== undefined && initialDataMatchesLocale && !cache.has(activeLocale, dataset)) {
    cache.seed(activeLocale, dataset, options.initialData as T);
  }

  const getInitialState = (): { data: T | null; isLoading: boolean } => {
    if (!dataset || !enabled) {
      return { data: null, isLoading: false };
    }
    if (isServer) {
      return options.initialData !== undefined && initialDataMatchesLocale
        ? { data: options.initialData as T, isLoading: false }
        : { data: null, isLoading: true };
    }
    if (cache.hasResolved(activeLocale, dataset)) {
      return {
        data: cache.getResolved<T>(activeLocale, dataset) ?? null,
        isLoading: false,
      };
    }
    return { data: null, isLoading: true };
  };

  const [state, setState] = useState<{ data: T | null; isLoading: boolean; error: Error | null }>(() => ({
    ...getInitialState(),
    error: null,
  }));

  // Track latest locale and dataset in refs to guard against stale responses
  const activeLocaleRef = useRef(activeLocale);
  activeLocaleRef.current = activeLocale;

  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;

  useEffect(() => {
    if (!dataset || !enabled) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    const currentLocale = activeLocale;
    const currentDataset = dataset;
    let isCancelled = false;

    // Fast-path: return resolved cache immediately without loading flash
    if (cache.hasResolved(currentLocale, currentDataset)) {
      setState({
        data: cache.getResolved<T>(currentLocale, currentDataset) ?? null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetchGameData<T>(currentLocale, currentDataset, options, cache)
      .then((data) => {
        // Discard late response if user switched locale or navigated away
        if (
          isCancelled ||
          activeLocaleRef.current !== currentLocale ||
          datasetRef.current !== currentDataset
        ) {
          return;
        }

        setState({
          data,
          isLoading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (
          isCancelled ||
          activeLocaleRef.current !== currentLocale ||
          datasetRef.current !== currentDataset
        ) {
          return;
        }

        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [activeLocale, dataset, enabled, cache, options.baseUrl]);

  const reload = useCallback(async (): Promise<T> => {
    if (!dataset) {
      throw new Error('Cannot reload without a specified dataset');
    }
    cache.delete(activeLocale, dataset);
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await fetchGameData<T>(activeLocale, dataset, options, cache);
      if (activeLocaleRef.current === activeLocale && datasetRef.current === dataset) {
        setState({ data, isLoading: false, error: null });
      }
      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      if (activeLocaleRef.current === activeLocale && datasetRef.current === dataset) {
        setState({ data: null, isLoading: false, error: errorObj });
      }
      throw errorObj;
    }
  }, [activeLocale, dataset, cache, options]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    reload,
    locale: activeLocale,
    dataset,
  };
}
