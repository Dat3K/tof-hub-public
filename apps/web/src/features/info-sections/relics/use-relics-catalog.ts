'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Locale } from '@tof-hub/i18n';
import type { RelicsDataset } from '@tof-hub/contracts';
import { getStoredServerMode, setStoredServerMode } from '@tof-hub/ui';
import type { ServerMode } from '@tof-hub/ui';
import { useServerModeLoading } from '../common/use-server-mode-loading';
import type { RelicItem, RelicElementFilterId, RelicPropertyId, RelicPassiveStat } from './types';
import { DEFAULT_SORT, getRelicsSortOptions, parseRelicPassiveStat } from './constants';
import { getRelicsStrings } from './copy';
import { useInfoDocumentTitle } from '../common/use-info-document-title';

interface UseRelicsCatalogProps {
  initialData?: RelicsDataset | null;
  locale: Locale;
  initialServerMode?: ServerMode | null;
  initialSearchQuery?: string;
  initialElements?: RelicElementFilterId[];
  initialProperties?: RelicPropertyId[];
  initialSort?: string | null;
  initialSelectedRelicId?: string | null;
}

export function useRelicsCatalog({
  initialData,
  locale,
  initialServerMode = null,
  initialSearchQuery = '',
  initialElements = [],
  initialProperties = [],
  initialSort = null,
  initialSelectedRelicId = null,
}: UseRelicsCatalogProps) {
  const strings = useMemo(() => getRelicsStrings(locale), [locale]);
  const sortOptions = useMemo(() => getRelicsSortOptions(strings), [strings]);

  // Seed from the server-parsed URL params so direct links (?server=mmo&
  // relic=...) resolve against the right pool on the first paint.
  const [serverMode, setServerModeState] = useState<ServerMode>(initialServerMode ?? 'gacha');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedElements, setSelectedElements] = useState<Set<RelicElementFilterId>>(
    () => new Set(initialElements)
  );
  const [selectedProperties, setSelectedProperties] = useState<Set<RelicPropertyId>>(
    () => new Set(initialProperties)
  );
  const [sortValue, setSortValue] = useState(initialSort ?? DEFAULT_SORT);
  const [selectedRelicId, setSelectedRelicId] = useState<string | null>(initialSelectedRelicId);

  // Fall back to the persisted preference only when neither the URL nor
  // the server-provided initial has an explicit server mode. Explicit
  // values must win so MMO relic links resolve correctly.
  const initialServerModeRef = useRef(initialServerMode);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialServerModeRef.current) return;
    try {
      const serverParam = new URLSearchParams(window.location.search).get('server');
      if (serverParam === 'mmo' || serverParam === 'gacha') return;
    } catch {
      // Fall through to the stored preference on parse errors.
    }
    const stored = getStoredServerMode('gacha');
    setServerModeState((prev) => (prev === stored ? prev : stored));
  }, []);

  const allDatasetItems = useMemo(() => {
    if (!initialData) return { gacha: [] as RelicItem[], mmo: [] as RelicItem[] };

    const gachaPool = (initialData.gacha ||
      initialData.items?.filter((r) => r.server_mode !== 'mmo') ||
      []) as RelicItem[];

    const mmoPool = (initialData.mmo ||
      initialData.items?.filter((r) => r.server_mode === 'mmo') ||
      []) as RelicItem[];

    return { gacha: gachaPool, mmo: mmoPool };
  }, [initialData]);

  const activePool: RelicItem[] = useMemo(() => {
    return serverMode === 'mmo' ? allDatasetItems.mmo : allDatasetItems.gacha;
  }, [allDatasetItems, serverMode]);

  const { isLoading: isModeLoading, startLoading: startModeLoading } = useServerModeLoading({
    mode: serverMode,
    modeDataReady: Array.isArray(serverMode === 'mmo' ? allDatasetItems.mmo : allDatasetItems.gacha),
  });

  // Pre-calculate passive stats for active pool
  const passiveStatsMap = useMemo(() => {
    const map = new Map<string, RelicPassiveStat | null>();
    const isMmo = serverMode === 'mmo';
    for (const relic of activePool) {
      map.set(relic.id, parseRelicPassiveStat(relic, isMmo));
    }
    return map;
  }, [activePool, serverMode]);

  // Reconcile non-modal URL params after mount. State is seeded from the
  // server-parsed params, so assignments only fire on disagreement.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sameValues = <T,>(a: Set<T>, b: T[]) =>
      a.size === b.length && b.every((v) => a.has(v));

    try {
      const params = new URLSearchParams(window.location.search);

      const q = params.get('q') || params.get('search');
      if (q) setSearchQuery((prev) => (prev === q ? prev : q));

      const elem = params.get('elem') || params.get('element');
      if (elem) {
        const parts = elem.split(',').map((e) => e.trim().toLowerCase() as RelicElementFilterId);
        const list = parts.filter((p) => p !== 'all');
        setSelectedElements((prev) => (sameValues(prev, list) ? prev : new Set(list)));
      }

      const prop = params.get('prop') || params.get('property');
      if (prop) {
        const parts = prop.split(',').map((p) => p.trim() as RelicPropertyId);
        const list = parts.filter((p) => p !== 'all');
        setSelectedProperties((prev) => (sameValues(prev, list) ? prev : new Set(list)));
      }

      const sort = params.get('sort');
      if (sort === 'cooldown' || sort === 'cooldown_desc') {
        setSortValue((prev) => (prev === DEFAULT_SORT ? prev : DEFAULT_SORT));
      } else if (sort) {
        setSortValue((prev) => (prev === sort ? prev : sort));
      }

    } catch {
      // Gracefully ignore URL parsing errors
    }
  }, []);

  // Resolve the modal only after the URL-selected server pool is active.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const relicId = (window.location.hash ? window.location.hash.replace(/^#/, '') : '') || params.get('relic');
    if (!relicId) return;

    const match = activePool.find(
      (r) =>
        r.id.toLowerCase() === relicId.toLowerCase() ||
        r.canonical_id?.toLowerCase() === relicId.toLowerCase()
    );
    if (match) setSelectedRelicId((prev) => (prev === match.id ? prev : match.id));
  }, [activePool]);

  // Sync popstate & hashchange listener for modal deep-linking & back navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHistoryChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
        const relicId = hash || params.get('relic');
        if (!relicId) {
          setSelectedRelicId((prev) => (prev ? null : prev));
          return;
        }
        const match = activePool.find(
          (r) =>
            r.id.toLowerCase() === relicId.toLowerCase() ||
            r.canonical_id?.toLowerCase() === relicId.toLowerCase()
        );
        if (match) {
          setSelectedRelicId(match.id);
        }
      } catch {
        // Gracefully ignore
      }
    };

    window.addEventListener('popstate', handleHistoryChange);
    window.addEventListener('hashchange', handleHistoryChange);
    return () => {
      window.removeEventListener('popstate', handleHistoryChange);
      window.removeEventListener('hashchange', handleHistoryChange);
    };
  }, [activePool]);

  // Sync state to URL
  const updateUrl = useCallback(
    (
      mode: ServerMode,
      query: string,
      elems: Set<RelicElementFilterId>,
      props: Set<RelicPropertyId>,
      sort: string,
      modalId: string | null
    ) => {
      if (typeof window === 'undefined' || !window.history?.replaceState) return;

      try {
        const url = new URL(window.location.href);

        url.searchParams.set('server', mode);

        if (query) {
          url.searchParams.set('q', query);
        } else {
          url.searchParams.delete('q');
        }

        if (elems.size > 0) {
          url.searchParams.set('elem', Array.from(elems).join(','));
        } else {
          url.searchParams.delete('elem');
        }

        if (props.size > 0) {
          url.searchParams.set('prop', Array.from(props).join(','));
        } else {
          url.searchParams.delete('prop');
        }

        if (sort && sort !== DEFAULT_SORT) {
          url.searchParams.set('sort', sort);
        } else {
          url.searchParams.delete('sort');
        }

        if (modalId) {
          url.searchParams.set('relic', modalId);
        } else {
          url.searchParams.delete('relic');
          url.hash = '';
        }

        const nextPath = url.pathname + url.search + url.hash;
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        if (nextPath !== currentPath) {
          window.history.replaceState(null, '', nextPath);
        }
      } catch {
        // Ignore URL replace errors
      }
    },
    []
  );

  const handleServerModeChange = useCallback(
    (mode: ServerMode) => {
      startModeLoading(mode);
      setServerModeState(mode);
      setStoredServerMode(mode, false);
      // Reset selected modal or switch to corresponding canonical relic.
      const cleanPrev = selectedRelicId?.replace(/[-_]mmo$/, '');
      const targetPool = mode === 'mmo' ? allDatasetItems.mmo : allDatasetItems.gacha;
      const match = cleanPrev
        ? targetPool.find(
            (r) =>
              r.id.replace(/[-_]mmo$/, '') === cleanPrev ||
              r.canonical_id === cleanPrev
          )
        : undefined;
      const nextId = match ? match.id : null;

      setSelectedRelicId(nextId);
      updateUrl(mode, searchQuery, selectedElements, selectedProperties, sortValue, nextId);
    },
    [
      allDatasetItems,
      searchQuery,
      selectedElements,
      selectedProperties,
      selectedRelicId,
      sortValue,
      startModeLoading,
      updateUrl,
    ]
  );

  const toggleElement = useCallback(
    (elemId: RelicElementFilterId) => {
      setSelectedElements((prev) => {
        const next = new Set(prev);
        if (elemId === 'all') {
          next.clear();
        } else if (next.has(elemId)) {
          next.delete(elemId);
        } else {
          next.add(elemId);
        }
        updateUrl(serverMode, searchQuery, next, selectedProperties, sortValue, selectedRelicId);
        return next;
      });
    },
    [serverMode, searchQuery, selectedProperties, sortValue, selectedRelicId, updateUrl]
  );

  const toggleProperty = useCallback(
    (propId: RelicPropertyId) => {
      setSelectedProperties((prev) => {
        const next = new Set(prev);
        if (propId === 'all') {
          next.clear();
        } else if (next.has(propId)) {
          next.delete(propId);
        } else {
          next.add(propId);
        }
        updateUrl(serverMode, searchQuery, selectedElements, next, sortValue, selectedRelicId);
        return next;
      });
    },
    [serverMode, searchQuery, selectedElements, sortValue, selectedRelicId, updateUrl]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrl(serverMode, query, selectedElements, selectedProperties, sortValue, selectedRelicId);
    },
    [serverMode, selectedElements, selectedProperties, sortValue, selectedRelicId, updateUrl]
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      setSortValue(sort);
      updateUrl(serverMode, searchQuery, selectedElements, selectedProperties, sort, selectedRelicId);
    },
    [serverMode, searchQuery, selectedElements, selectedProperties, selectedRelicId, updateUrl]
  );

  const handleSelectRelic = useCallback(
    (id: string | null) => {
      setSelectedRelicId(id);
      updateUrl(serverMode, searchQuery, selectedElements, selectedProperties, sortValue, id);
    },
    [serverMode, searchQuery, selectedElements, selectedProperties, sortValue, updateUrl]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim().length > 0 ||
      selectedElements.size > 0 ||
      selectedProperties.size > 0 ||
      sortValue !== DEFAULT_SORT
    );
  }, [searchQuery, selectedElements, selectedProperties, sortValue]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedElements(new Set());
    setSelectedProperties(new Set());
    setSortValue(DEFAULT_SORT);
    updateUrl(serverMode, '', new Set(), new Set(), DEFAULT_SORT, selectedRelicId);
  }, [serverMode, selectedRelicId, updateUrl]);

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    const isRu = locale === 'ru';
    const q = searchQuery.trim().toLowerCase();

    const filtered = activePool.filter((relic) => {
      // Element / Passive Stat Filter
      if (selectedElements.size > 0) {
        const passive = passiveStatsMap.get(relic.id);
        if (!passive || passive.element === 'neutral' || !selectedElements.has(passive.element)) {
          return false;
        }
      }

      // Property Filter
      if (selectedProperties.size > 0) {
        const prop = (relic.property || '').trim();
        if (!selectedProperties.has(prop as RelicPropertyId)) {
          return false;
        }
      }

      // Search Query
      if (q) {
        const nameMatch =
          relic.name?.toLowerCase().includes(q) ||
          relic.name_en?.toLowerCase().includes(q) ||
          relic.name_ru?.toLowerCase().includes(q) ||
          relic.id.toLowerCase().includes(q) ||
          relic.canonical_id?.toLowerCase().includes(q);

        const descMatch =
          relic.desc?.toLowerCase().includes(q) ||
          relic.desc_en?.toLowerCase().includes(q) ||
          relic.desc_ru?.toLowerCase().includes(q) ||
          relic.flavor_desc_en?.toLowerCase().includes(q) ||
          relic.flavor_desc_ru?.toLowerCase().includes(q);

        const abilityTagMatch = relic.ability_tag?.toLowerCase().includes(q);

        const starMatch = relic.stars?.some(
          (s) =>
            s.desc?.toLowerCase().includes(q) ||
            s.desc_en?.toLowerCase().includes(q) ||
            s.desc_ru?.toLowerCase().includes(q)
        );

        if (!nameMatch && !descMatch && !abilityTagMatch && !starMatch) {
          return false;
        }
      }

      return true;
    });

    // Apply Sorting
    return filtered.sort((a, b) => {
      if (sortValue === 'quality_desc') {
        const qOrder: Record<string, number> = { SSR: 1, SR: 2, R: 3, N: 4 };
        const qA = qOrder[a.quality || 'SSR'] || 99;
        const qB = qOrder[b.quality || 'SSR'] || 99;
        if (qA !== qB) return qA - qB;
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numB - numA;
        return a.id.localeCompare(b.id);
      }

      if (sortValue === 'quality_asc') {
        const qOrder: Record<string, number> = { N: 1, R: 2, SR: 3, SSR: 4 };
        const qA = qOrder[a.quality || 'SSR'] || 99;
        const qB = qOrder[b.quality || 'SSR'] || 99;
        if (qA !== qB) return qA - qB;
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
        return a.id.localeCompare(b.id);
      }

      if (sortValue === 'name') {
        const nameA = isRu ? a.name_ru || a.name_en || a.name || '' : a.name_en || a.name || '';
        const nameB = isRu ? b.name_ru || b.name_en || b.name || '' : b.name_en || b.name || '';
        return nameA.localeCompare(nameB, locale);
      }

      if (sortValue === 'name_desc') {
        const nameA = isRu ? a.name_ru || a.name_en || a.name || '' : a.name_en || a.name || '';
        const nameB = isRu ? b.name_ru || b.name_en || b.name || '' : b.name_en || b.name || '';
        return nameB.localeCompare(nameA, locale);
      }

      if (sortValue === 'cooldown') {
        const cdA = typeof a.cooldown === 'number' && a.cooldown > 0 ? a.cooldown : 9999;
        const cdB = typeof b.cooldown === 'number' && b.cooldown > 0 ? b.cooldown : 9999;
        if (cdA !== cdB) return cdA - cdB;
        return a.id.localeCompare(b.id);
      }

      if (sortValue === 'cooldown_desc') {
        const cdA = typeof a.cooldown === 'number' ? a.cooldown : 0;
        const cdB = typeof b.cooldown === 'number' ? b.cooldown : 0;
        if (cdA !== cdB) return cdB - cdA;
        return a.id.localeCompare(b.id);
      }

      if (sortValue === 'id_desc') {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numB - numA;
        return b.id.localeCompare(a.id);
      }

      if (sortValue === 'id_asc') {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
        return a.id.localeCompare(b.id);
      }

      return 0;
    });
  }, [activePool, locale, passiveStatsMap, searchQuery, selectedElements, selectedProperties, sortValue]);

  const selectedRelic = useMemo(() => {
    if (!selectedRelicId) return null;
    return (
      activePool.find(
        (r) =>
          r.id.toLowerCase() === selectedRelicId.toLowerCase() ||
          r.canonical_id?.toLowerCase() === selectedRelicId.toLowerCase()
      ) || null
    );
  }, [activePool, selectedRelicId]);

  const selectedRelicName = selectedRelic
    ? locale === 'ru'
      ? selectedRelic.name_ru || selectedRelic.name || selectedRelic.name_en
      : selectedRelic.name_en || selectedRelic.name
    : null;
  useInfoDocumentTitle(strings.title, selectedRelicName || null);

  return {
    strings,
    sortOptions,
    serverMode,
    setServerMode: handleServerModeChange,
    isModeLoading,
    searchQuery,
    setSearchQuery: handleSearchChange,
    selectedElements,
    toggleElement,
    selectedProperties,
    toggleProperty,
    sortValue,
    setSortValue: handleSortChange,
    selectedRelicId,
    selectedRelic,
    setSelectedRelicId: handleSelectRelic,
    filteredItems,
    filteredCount: filteredItems.length,
    totalCount: activePool.length,
    hasActiveFilters,
    handleResetFilters,
    passiveStatsMap,
  };
}
