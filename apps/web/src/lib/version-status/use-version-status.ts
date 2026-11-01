'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SiteVersionStatusData } from './types';
import { VERSION_STATUS_STRINGS } from './strings';
import { getVersionStatusCached, _resetVersionStatusCache } from './loader';
import { createLocaleCopies } from '@tof-hub/i18n';

const DEFAULT_LOADING_STATE: SiteVersionStatusData = {
  state: 'loading',
  datasetVersion: null,
  globalVersion: null,
  isCurrent: null,
  updateAvailable: false,
  exportedAt: null,
  formattedExportDate: createLocaleCopies({ en: '—', ru: '—' }),
  sources: [],
  sourceBranch: createLocaleCopies({ en: '—', ru: '—' }),
  checkedAt: null,
  labels: VERSION_STATUS_STRINGS,
};
const VERSION_STATUS_UI_TIMEOUT_MS = 6000;

export function useVersionStatus(initialData?: Partial<SiteVersionStatusData>) {
  const [status, setStatus] = useState<SiteVersionStatusData>(() => {
    if (initialData && initialData.state) {
      return {
        ...DEFAULT_LOADING_STATE,
        ...initialData,
        labels: VERSION_STATUS_STRINGS,
      } as SiteVersionStatusData;
    }
    return DEFAULT_LOADING_STATE;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!initialData?.state || initialData.state === 'loading');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await Promise.race([
        getVersionStatusCached(),
        new Promise<SiteVersionStatusData>((resolve) => {
          window.setTimeout(() => {
            resolve({
              ...DEFAULT_LOADING_STATE,
              state: 'unavailable',
            });
          }, VERSION_STATUS_UI_TIMEOUT_MS);
        }),
      ]);
      setStatus(data);
    } catch {
      setStatus({
        ...DEFAULT_LOADING_STATE,
        state: 'unavailable',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // If already seeded with resolved data, avoid re-fetching
    if (initialData?.state && initialData.state !== 'loading') {
      return;
    }
    load();
  }, [load, initialData?.state]);

  const reload = useCallback(async () => {
    _resetVersionStatusCache();
    await load();
  }, [load]);

  return {
    status,
    isLoading,
    isCurrent: status.isCurrent,
    updateAvailable: status.updateAvailable,
    reload,
  };
}
