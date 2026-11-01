'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerMode } from '@tof-hub/ui';

interface UseServerModeLoadingOptions {
  mode: ServerMode;
  modeDataReady: boolean;
  minimumVisibleMs?: number;
}

interface UseServerModeLoadingReturn {
  isLoading: boolean;
  startLoading: (nextMode: ServerMode) => void;
}

/** Shows the shared loading state the first time a server mode is selected. */
export function useServerModeLoading({
  mode,
  modeDataReady,
  minimumVisibleMs = 140,
}: UseServerModeLoadingOptions): UseServerModeLoadingReturn {
  const loadedModesRef = useRef<Set<ServerMode>>(new Set());
  const [loadingMode, setLoadingMode] = useState<ServerMode | null>(null);

  const startLoading = useCallback(
    (nextMode: ServerMode) => {
      if (nextMode === mode) return;

      if (loadedModesRef.current.has(nextMode)) {
        setLoadingMode(null);
      } else {
        setLoadingMode(nextMode);
      }
    },
    [mode],
  );

  useEffect(() => {
    if (!modeDataReady) return;

    loadedModesRef.current.add(mode);
    if (loadingMode !== mode) return;

    const timeoutId = window.setTimeout(() => {
      setLoadingMode(null);
    }, minimumVisibleMs);

    return () => window.clearTimeout(timeoutId);
  }, [loadingMode, minimumVisibleMs, mode, modeDataReady]);

  return {
    isLoading: loadingMode !== null,
    startLoading,
  };
}
