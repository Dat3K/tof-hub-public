'use client';
import {compareSimulacraRelease} from '../info-sections/common/catalog-release-order';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ServerMode } from '@tof-hub/ui';
import { getStoredServerMode, setStoredServerMode } from '@tof-hub/ui';
import { matchesPrimaryElement, normalizeRole } from '@tof-hub/game-domain';
import type { SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import type { UseSimulacraCatalogOptions, UseSimulacraCatalogReturn } from './types';
import { getSimulacraStrings } from './copy';
import { useInfoDocumentTitle } from '../info-sections/common/use-info-document-title';
import { DEFAULT_SORT, getSimulacraSortOptions } from './constants';
import { useServerModeLoading } from '@/features/info-sections/common/use-server-mode-loading';

function getItemDisplayName(item: SimulacraDatasetItemRaw, locale: string): string {
  if (locale === 'ru') {
    return item.name_ru || item.name || item.name_en || item.id;
  }
  return item.name_en || item.name || item.id;
}

function escapeRegex(text: string): string {
  return text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function matchesQuery(item: SimulacraDatasetItemRaw, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const searchableTexts = [
    item.name_en,
    item.name_ru,
    item.name,
    item.weapon_name_en,
    item.weapon_name_ru,
    item.weapon_name,
    item.id,
    item.avatar_id,
  ]
    .filter(Boolean)
    .map((t) => String(t).toLowerCase());

  return tokens.every((token) => {
    // Prefix / word boundary regex
    const wordBoundaryRegex = new RegExp('(?:^|[^\\p{L}\\p{N}_])' + escapeRegex(token), 'iu');
    return searchableTexts.some((text) => wordBoundaryRegex.test(text) || text.includes(token));
  });
}

export function useSimulacraCatalog({
  initialData,
  locale,
  initialSelectedCharId = null,
  initialServerMode = null,
  initialSearchQuery = '',
  initialElements = [],
  initialRoles = [],
  initialSort = null,
}: UseSimulacraCatalogOptions): UseSimulacraCatalogReturn {
  const strings = useMemo(() => getSimulacraStrings(locale), [locale]);
  const sortOptions = useMemo(() => getSimulacraSortOptions(strings), [strings]);

  // Seed the first client render from the server-parsed URL params so a
  // shared link (e.g. ?server=mmo&char=...) renders the selected state
  // immediately instead of loading defaults and correcting after mount.
  // Browser storage is still read after mount, but only when neither the
  // URL nor the server initial has an explicit value.
  const [serverMode, setServerModeState] = useState<ServerMode>(initialServerMode ?? 'gacha');
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(() => new Set(initialElements));
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(() => new Set(initialRoles));
  const [sortValue, setSortValue] = useState<string>(initialSort ?? DEFAULT_SORT);
  const [selectedCharId, setSelectedCharIdState] = useState<string | null>(initialSelectedCharId);
  const [isInitialized, setIsInitialized] = useState(false);

  const modeDataReady = Boolean(
    initialData &&
      (serverMode === 'mmo'
        ? Array.isArray(initialData.mmo)
        : Array.isArray(initialData.gacha || initialData.items)),
  );
  const { isLoading: isModeLoading, startLoading: startModeLoading } = useServerModeLoading({
    mode: serverMode,
    modeDataReady,
  });

  const isPopStateRef = useRef(false);
  const prevCharIdRef = useRef<string | null>(initialSelectedCharId);
  const initialServerModeRef = useRef(initialServerMode);

  // Reconcile state with the URL after mount. State is already seeded from
  // the server-parsed params, so each assignment below only fires when the
  // live URL disagrees (client-side navigation without remount, or a stored
  // preference when the URL is silent). Equal values never re-render.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sameList = (a: Set<string>, b: string[]) => {
      if (a.size !== b.length) return false;
      return b.every((v) => a.has(v));
    };

    try {
      const params = new URLSearchParams(window.location.search);
      const serverParam = params.get('server')?.toLowerCase();
      if (serverParam === 'gacha' || serverParam === 'mmo') {
        setServerModeState((prev) => (prev === serverParam ? prev : serverParam));
      } else if (!initialServerModeRef.current) {
        const stored = getStoredServerMode('gacha');
        setServerModeState((prev) => (prev === stored ? prev : stored));
      }

      const qParam = params.get('q') || params.get('search');
      if (qParam) {
        setSearchQuery((prev) => (prev === qParam ? prev : qParam));
      }

      const elemParam = params.get('elem') || params.get('element');
      if (elemParam) {
        const elems = elemParam
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        if (elems.length > 0) {
          setSelectedElements((prev) => (sameList(prev, elems) ? prev : new Set(elems)));
        }
      }

      const roleParam = params.get('role') || params.get('reso');
      if (roleParam) {
        const roles = roleParam
          .split(',')
          .map((r) => r.trim().toLowerCase())
          .filter(Boolean);
        if (roles.length > 0) {
          setSelectedRoles((prev) => (sameList(prev, roles) ? prev : new Set(roles)));
        }
      }

      const sortParam = params.get('sort');
      if (sortParam) {
        setSortValue((prev) => (prev === sortParam ? prev : sortParam));
      }

      const charParam = params.get('char')?.trim();
      if (charParam) {
        setSelectedCharIdState((prev) => (prev === charParam ? prev : charParam));
        prevCharIdRef.current = charParam;
      }
    } catch (_) {}

    setIsInitialized(true);

    const handlePopState = () => {
      try {
        const p = new URLSearchParams(window.location.search);
        isPopStateRef.current = true;
        const newCharId = p.get('char')?.trim() || null;
        prevCharIdRef.current = newCharId;
        setSelectedCharIdState(newCharId);
      } catch (_) {}
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync state changes to URL query parameters
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined' || !window.history?.replaceState) return;

    try {
      const url = new URL(window.location.href);

      // Server mode: keep the default out of the URL. The param is only
      // needed for a non-default server or to resolve an open character.
      if (selectedCharId || serverMode !== 'gacha') {
        url.searchParams.set('server', serverMode);
      } else {
        url.searchParams.delete('server');
      }

      // Search query
      if (searchQuery.trim()) {
        url.searchParams.set('q', searchQuery.trim());
      } else {
        url.searchParams.delete('q');
        url.searchParams.delete('search');
      }

      // Elements
      if (selectedElements.size > 0) {
        url.searchParams.set('elem', Array.from(selectedElements).join(','));
      } else {
        url.searchParams.delete('elem');
        url.searchParams.delete('element');
      }

      // Roles
      if (selectedRoles.size > 0) {
        url.searchParams.set('role', Array.from(selectedRoles).join(','));
      } else {
        url.searchParams.delete('role');
        url.searchParams.delete('reso');
      }

      // Sort
      if (sortValue && sortValue !== DEFAULT_SORT) {
        url.searchParams.set('sort', sortValue);
      } else {
        url.searchParams.delete('sort');
      }

      // Character detail
      if (selectedCharId) {
        url.searchParams.set('char', selectedCharId);
      } else {
        url.searchParams.delete('char');
      }

      const isCharChange = prevCharIdRef.current !== selectedCharId;
      prevCharIdRef.current = selectedCharId;

      const shouldPush = isCharChange && !isPopStateRef.current && typeof window.history?.pushState === 'function';
      isPopStateRef.current = false;

      const nextUrl = url.pathname + (url.search ? url.search : '') + url.hash;
      const currentUrl = window.location.pathname + window.location.search + window.location.hash;

      if (nextUrl !== currentUrl) {
        if (shouldPush) {
          window.history.pushState(null, '', nextUrl);
        } else {
          window.history.replaceState(null, '', nextUrl);
        }
      }
    } catch (_) {}
  }, [serverMode, searchQuery, selectedElements, selectedRoles, sortValue, selectedCharId, isInitialized]);

  const setServerMode = useCallback((mode: ServerMode) => {
    startModeLoading(mode);
    setServerModeState(mode);
    setStoredServerMode(mode, true);
  }, [startModeLoading]);

  const setSelectedCharId = useCallback((id: string | null) => {
    // A skill/panel hash belongs to the currently displayed character. Clear
    // it before leaving the detail view or switching to another character so
    // the catalog cannot reopen the previous character's anchor.
    if (typeof window !== 'undefined' && window.location.hash && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }

    setSelectedCharIdState(id);
  }, []);

  const toggleElement = useCallback((elementId: string) => {
    if (elementId === 'all') {
      setSelectedElements(new Set());
      return;
    }

    const norm = elementId.toLowerCase();
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) {
        next.delete(norm);
      } else {
        next.add(norm);
      }
      return next;
    });
  }, []);

  const toggleRole = useCallback((roleId: string) => {
    if (roleId === 'all') {
      setSelectedRoles(new Set());
      return;
    }

    const norm = roleId.toLowerCase();
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) {
        next.delete(norm);
      } else {
        next.add(norm);
      }
      return next;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedElements(new Set());
    setSelectedRoles(new Set());
    setSortValue(DEFAULT_SORT);
  }, []);

  // Source items based on Gacha vs MMO server mode divergence
  const currentModeItems = useMemo<SimulacraDatasetItemRaw[]>(() => {
    if (!initialData) return [];
    if (serverMode === 'mmo') {
      return initialData.mmo || [];
    }
    return initialData.gacha || initialData.items || [];
  }, [initialData, serverMode]);

  const totalCount = currentModeItems.length;

  // Filtered & sorted items
  const filteredItems = useMemo<SimulacraDatasetItemRaw[]>(() => {
    const items = currentModeItems.filter((item) => {
      // 1. Element filter (additive)
      if (selectedElements.size > 0) {
        if (!matchesPrimaryElement(item.element, selectedElements)) return false;
      }

      // 2. Role filter (additive)
      if (selectedRoles.size > 0) {
        const roleNorm = normalizeRole(item.role || item.resonance).toLowerCase();
        if (!selectedRoles.has(roleNorm)) return false;
      }

      // 3. Search query matching
      if (searchQuery.trim() && !matchesQuery(item, searchQuery)) {
        return false;
      }

      return true;
    });

    // 4. Sorting
    items.sort((a, b) => {
      if (sortValue === 'release_desc') return compareSimulacraRelease(a,b,serverMode==='mmo');
      if (sortValue === 'release_asc') return compareSimulacraRelease(a,b,serverMode==='mmo',true);

      if (sortValue === 'name_asc') {
        const nameA = getItemDisplayName(a, locale);
        const nameB = getItemDisplayName(b, locale);
        return nameA.localeCompare(nameB, locale, { sensitivity: 'base' });
      }

      if (sortValue === 'name_desc') {
        const nameA = getItemDisplayName(a, locale);
        const nameB = getItemDisplayName(b, locale);
        return nameB.localeCompare(nameA, locale, { sensitivity: 'base' });
      }

      return 0;
    });

    return items;
  }, [currentModeItems, selectedElements, selectedRoles, searchQuery, sortValue, serverMode, locale]);

  const filteredCount = filteredItems.length;

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      selectedElements.size > 0 ||
      selectedRoles.size > 0 ||
      sortValue !== DEFAULT_SORT
    );
  }, [searchQuery, selectedElements, selectedRoles, sortValue]);

  // Selected character lookup
  const selectedCharacter = useMemo<SimulacraDatasetItemRaw | null>(() => {
    if (!selectedCharId || !initialData) return null;
    const targetId = selectedCharId.toLowerCase();

    // Look in current mode items first
    const foundInMode = currentModeItems.find(
      (c) =>
        c.id.toLowerCase() === targetId ||
        ((c as any).canonical_id && String((c as any).canonical_id).toLowerCase() === targetId)
    );
    if (foundInMode) return foundInMode;

    // Search all available datasets
    const all = [
      ...(initialData.gacha || []),
      ...(initialData.mmo || []),
      ...(initialData.items || []),
    ];
    return (
      all.find(
        (c) =>
          c.id.toLowerCase() === targetId ||
          ((c as any).canonical_id && String((c as any).canonical_id).toLowerCase() === targetId)
      ) || null
    );
  }, [selectedCharId, currentModeItems, initialData]);

  const selectedCharacterName = selectedCharacter
    ? locale === 'ru'
      ? selectedCharacter.name_ru || selectedCharacter.name || selectedCharacter.name_en
      : selectedCharacter.name_en || selectedCharacter.name
    : null;
  useInfoDocumentTitle(strings.title, selectedCharacterName || null);

  // If selecting a character whose edition does not match active serverMode, sync serverMode
  useEffect(() => {
    if (selectedCharacter) {
      const charMode = (
        selectedCharacter.server_mode ||
        selectedCharacter.edition ||
        (selectedCharacter.id.endsWith('-mmo') ? 'mmo' : 'gacha')
      ).toLowerCase();

      if ((charMode === 'mmo' || charMode === 'gacha') && charMode !== serverMode) {
        setServerModeState(charMode as ServerMode);
      }
    }
  }, [selectedCharacter, serverMode]);

  return {
    serverMode,
    setServerMode,
    isModeLoading,
    searchQuery,
    setSearchQuery,
    selectedElements,
    toggleElement,
    selectedRoles,
    toggleRole,
    sortValue,
    setSortValue,
    filteredItems,
    totalCount,
    filteredCount,
    hasActiveFilters,
    handleResetFilters,
    sortOptions,
    strings,
    selectedCharId,
    setSelectedCharId,
    selectedCharacter,
  };
}
