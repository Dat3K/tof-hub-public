'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface UseBatchedListOptions {
  /** Positive number of items in the initial and each subsequent batch. */
  batchSize?: number;
  /** Stable value or reference identifying the current filtered/ordered list. */
  resetKey: unknown;
  /** Distance before the list end at which the next batch is rendered. */
  rootMargin?: string;
}

export interface UseBatchedListReturn<T> {
  visibleItems: T[];
  hasMore: boolean;
  loadMore: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

/** Render a local list in batches as its end approaches the viewport. */
export function useBatchedList<T>(
  items: readonly T[],
  { batchSize = 60, resetKey, rootMargin = '600px 0px' }: UseBatchedListOptions,
): UseBatchedListReturn<T> {
  const [state, setState] = useState({ resetKey, batchSize, limit: batchSize });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Reset before rendering children, so a new tab never mounts the old batch size.
  const changed = !Object.is(state.resetKey, resetKey) || state.batchSize !== batchSize;
  if (changed) setState({ resetKey, batchSize, limit: batchSize });
  const visibleLimit = changed ? batchSize : state.limit;
  const visibleItems = useMemo(() => items.slice(0, visibleLimit), [items, visibleLimit]);
  const hasMore = visibleLimit < items.length;

  const loadMore = useCallback(() => {
    setState(previous => Object.is(previous.resetKey, resetKey) && previous.batchSize === batchSize
      ? { ...previous, limit: Math.min(previous.limit + batchSize, items.length) }
      : previous);
  }, [batchSize, items.length, resetKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    let active = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (active && entry?.isIntersecting) {
        active = false;
        observer.disconnect();
        loadMore();
      }
    }, { rootMargin });
    observer.observe(sentinel);
    return () => { active = false; observer.disconnect(); };
  }, [hasMore, loadMore, rootMargin, visibleLimit]);

  return { visibleItems, hasMore, loadMore, sentinelRef };
}
