'use client';

import {setEntitySelection} from '../common/entity-url';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { matchesPrimaryElement, normalizeRole } from '@tof-hub/game-domain';
import type { Locale } from '@tof-hub/i18n';
import type { MatricesDataset } from '@tof-hub/contracts';
import type { MatrixItem, ElementFilterId, RoleFilterId } from './types';
import { DEFAULT_SORT, getMatricesSortOptions } from './constants';
import { getMatricesStrings } from './copy';
import { useInfoDocumentTitle } from '../common/use-info-document-title';

interface UseMatricesCatalogProps {
  initialData?: MatricesDataset | null;
  locale: Locale;
  initialSearchQuery?: string;
  initialElements?: ElementFilterId[];
  initialRoles?: RoleFilterId[];
  initialSort?: string | null;
  initialSelectedMatrixId?: string | null;
}

export function useMatricesCatalog({
  initialData,
  locale,
  initialSearchQuery = '',
  initialElements = [],
  initialRoles = [],
  initialSort = null,
  initialSelectedMatrixId = null,
}: UseMatricesCatalogProps) {
  const strings = useMemo(() => getMatricesStrings(locale), [locale]);
  const sortOptions = useMemo(() => getMatricesSortOptions(strings), [strings]);

  // Seed from the server-parsed URL params so shared filter links render
  // filtered on the first paint instead of correcting after mount.
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedElements, setSelectedElements] = useState<Set<ElementFilterId>>(
    () => new Set(initialElements)
  );
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleFilterId>>(
    () => new Set(initialRoles)
  );
  const [sortValue, setSortValue] = useState(initialSort ?? DEFAULT_SORT);
  const [selectedMatrixId, setSelectedMatrixId] = useState<string | null>(initialSelectedMatrixId);

  const allItems: MatrixItem[] = useMemo(() => {
    if (!initialData) return [];
    return (initialData.items || initialData.suits || []) as MatrixItem[];
  }, [initialData]);

  // Reconcile URL params and hash after mount. State is seeded from the
  // server-parsed params, so assignments only fire on disagreement.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';

      const q = params.get('q') || params.get('search');
      if (q) setSearchQuery((prev) => (prev === q ? prev : q));

      const elem = params.get('elem') || params.get('element');
      if (elem) {
        const parts = elem.split(',').map((e) => e.trim().toLowerCase() as ElementFilterId);
        const list = parts.filter((p) => p !== 'all');
        setSelectedElements((prev) =>
          prev.size === list.length && list.every((v) => prev.has(v)) ? prev : new Set(list)
        );
      }

      const role = params.get('role');
      if (role) {
        const parts = role.split(',').map((r) => r.trim().toLowerCase() as RoleFilterId);
        const list = parts.filter((p) => p !== 'all');
        setSelectedRoles((prev) =>
          prev.size === list.length && list.every((v) => prev.has(v)) ? prev : new Set(list)
        );
      }

      const sort = params.get('sort');
      if (sort) setSortValue((prev) => (prev === sort ? prev : sort));

      const suitId = hash || params.get('suit');
      if (suitId) {
        const match = allItems.find((m) => m.id.toLowerCase() === suitId.toLowerCase());
        if (match) {
          setSelectedMatrixId((prev) => (prev === match.id ? prev : match.id));
        }
      }
    } catch {
      // Gracefully ignore URL parsing errors
    }
  }, [allItems]);

  // Sync hashchange & popstate listener for modal deep-linking & back navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHistoryChange = () => {
      try {
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
        const params = new URLSearchParams(window.location.search);
        const suitId = hash || params.get('suit');
        if (!suitId) {
          setSelectedMatrixId((prev) => (prev ? null : prev));
          return;
        }
        const match = allItems.find((m) => m.id.toLowerCase() === suitId.toLowerCase());
        if (match) {
          setSelectedMatrixId(match.id);
        }
      } catch {
        // Gracefully ignore
      }
    };

    window.addEventListener('hashchange', handleHistoryChange);
    window.addEventListener('popstate', handleHistoryChange);
    return () => {
      window.removeEventListener('hashchange', handleHistoryChange);
      window.removeEventListener('popstate', handleHistoryChange);
    };
  }, [allItems]);

  // Sync state to URL
  const updateUrl = useCallback(
    (
      query: string,
      elems: Set<ElementFilterId>,
      roles: Set<RoleFilterId>,
      sort: string,
      modalId: string | null
    ) => {
      if (typeof window === 'undefined' || !window.history?.replaceState) return;

      try {
        const url = new URL(window.location.href);

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

        if (roles.size > 0) {
          url.searchParams.set('role', Array.from(roles).join(','));
        } else {
          url.searchParams.delete('role');
        }

        if (sort && sort !== DEFAULT_SORT) {
          url.searchParams.set('sort', sort);
        } else {
          url.searchParams.delete('sort');
        }

        setEntitySelection(url, 'suit', modalId);

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

  const toggleElement = useCallback(
    (elemId: ElementFilterId) => {
      setSelectedElements((prev) => {
        const next = new Set(prev);
        if (elemId === 'all') {
          next.clear();
        } else if (next.has(elemId)) {
          next.delete(elemId);
        } else {
          next.add(elemId);
        }
        updateUrl(searchQuery, next, selectedRoles, sortValue, selectedMatrixId);
        return next;
      });
    },
    [searchQuery, selectedRoles, sortValue, selectedMatrixId, updateUrl]
  );

  const toggleRole = useCallback(
    (roleId: RoleFilterId) => {
      setSelectedRoles((prev) => {
        const next = new Set(prev);
        if (roleId === 'all') {
          next.clear();
        } else if (next.has(roleId)) {
          next.delete(roleId);
        } else {
          next.add(roleId);
        }
        updateUrl(searchQuery, selectedElements, next, sortValue, selectedMatrixId);
        return next;
      });
    },
    [searchQuery, selectedElements, sortValue, selectedMatrixId, updateUrl]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrl(query, selectedElements, selectedRoles, sortValue, selectedMatrixId);
    },
    [selectedElements, selectedRoles, sortValue, selectedMatrixId, updateUrl]
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      setSortValue(sort);
      updateUrl(searchQuery, selectedElements, selectedRoles, sort, selectedMatrixId);
    },
    [searchQuery, selectedElements, selectedRoles, selectedMatrixId, updateUrl]
  );

  const handleSelectMatrix = useCallback(
    (id: string | null) => {
      setSelectedMatrixId(id);
      updateUrl(searchQuery, selectedElements, selectedRoles, sortValue, id);
    },
    [searchQuery, selectedElements, selectedRoles, sortValue, updateUrl]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim().length > 0 ||
      selectedElements.size > 0 ||
      selectedRoles.size > 0 ||
      sortValue !== DEFAULT_SORT
    );
  }, [searchQuery, selectedElements, selectedRoles, sortValue]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedElements(new Set());
    setSelectedRoles(new Set());
    setSortValue(DEFAULT_SORT);
    updateUrl('', new Set(), new Set(), DEFAULT_SORT, selectedMatrixId);
  }, [selectedMatrixId, updateUrl]);

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    const isRu = locale === 'ru';
    const q = searchQuery.trim().toLowerCase();

    const filtered = allItems.filter((item) => {
      // Element filter (checks carriers)
      if (selectedElements.size > 0) {
        const hasElem = item.carriers?.some((c) => matchesPrimaryElement(c.element, selectedElements));
        if (!hasElem) return false;
      }

      // Role filter (checks carriers)
      if (selectedRoles.size > 0) {
        const hasRole = item.carriers?.some((c) => {
          if (!c.role) return false;
          const norm = normalizeRole(c.role).toLowerCase();
          return selectedRoles.has(norm as RoleFilterId);
        });
        if (!hasRole) return false;
      }

      // Search Query
      if (q) {
        const nameMatch =
          item.name?.toLowerCase().includes(q) ||
          item.name_en?.toLowerCase().includes(q) ||
          item.name_ru?.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q);

        const carrierMatch = item.carriers?.some((c) => {
          return (
            c.name?.toLowerCase().includes(q) ||
            c.name_en?.toLowerCase().includes(q) ||
            c.name_ru?.toLowerCase().includes(q) ||
            c.char_name_en?.toLowerCase().includes(q) ||
            c.char_name_ru?.toLowerCase().includes(q) ||
            c.weapon_name?.toLowerCase().includes(q) ||
            c.weapon_name_en?.toLowerCase().includes(q) ||
            c.weapon_name_ru?.toLowerCase().includes(q) ||
            c.char_id?.toLowerCase().includes(q) ||
            c.weapon_id?.toLowerCase().includes(q)
          );
        });

        const pieceMatch = item.pieces?.some((p) => {
          return (
            p.name?.toLowerCase().includes(q) ||
            p.name_en?.toLowerCase().includes(q) ||
            p.name_ru?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.description_en?.toLowerCase().includes(q) ||
            p.description_ru?.toLowerCase().includes(q)
          );
        });

        const effectMatch = item.effects?.some((eff) => {
          return (
            eff.desc?.toLowerCase().includes(q) ||
            eff.desc_en?.toLowerCase().includes(q) ||
            eff.desc_ru?.toLowerCase().includes(q) ||
            eff.text_en?.toLowerCase().includes(q) ||
            eff.text_ru?.toLowerCase().includes(q) ||
            eff.stars?.some(
              (s) =>
                s.text?.toLowerCase().includes(q) ||
                s.text_en?.toLowerCase().includes(q) ||
                s.text_ru?.toLowerCase().includes(q)
            )
          );
        });

        if (!nameMatch && !carrierMatch && !pieceMatch && !effectMatch) {
          return false;
        }
      }

      return true;
    });

    // Apply Sorting
    return filtered.sort((a, b) => {
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
  }, [allItems, locale, searchQuery, selectedElements, selectedRoles, sortValue]);

  const selectedMatrix = useMemo(() => {
    if (!selectedMatrixId) return null;
    return allItems.find((m) => m.id.toLowerCase() === selectedMatrixId.toLowerCase()) || null;
  }, [allItems, selectedMatrixId]);
  const selectedMatrixName = selectedMatrix
    ? locale === 'ru'
      ? selectedMatrix.name_ru || selectedMatrix.name || selectedMatrix.name_en
      : selectedMatrix.name_en || selectedMatrix.name
    : null;
  useInfoDocumentTitle(strings.title, selectedMatrixName || null);

  return {
    strings,
    sortOptions,
    searchQuery,
    setSearchQuery: handleSearchChange,
    selectedElements,
    toggleElement,
    selectedRoles,
    toggleRole,
    sortValue,
    setSortValue: handleSortChange,
    selectedMatrixId,
    selectedMatrix,
    setSelectedMatrixId: handleSelectMatrix,
    filteredItems,
    filteredCount: filteredItems.length,
    totalCount: allItems.length,
    hasActiveFilters,
    handleResetFilters,
  };
}
