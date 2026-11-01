'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Locale } from '@tof-hub/i18n';
import {normalizePetStats} from './pet-stats';
import { getStoredServerMode, setStoredServerMode } from '@tof-hub/ui';
import type { ServerMode } from '@tof-hub/ui';
import { useServerModeLoading } from '../common/use-server-mode-loading';
import type {
  PetCategoryTab,
  PetElementFilterId,
  PetItem,
  PetModuleFamily,
  PetModuleTypeFilterId,
} from './types';
import { DEFAULT_PETS_SORT, getPetsSortOptions, normalizePetElement } from './constants';
import { getPetsStrings } from './copy';
import { useInfoDocumentTitle } from '../common/use-info-document-title';

interface UsePetsCatalogProps {
  initialData?: any;
  locale: Locale;
  initialCategory?: PetCategoryTab | null;
  initialServerMode?: ServerMode | null;
  initialSearchQuery?: string;
  initialElements?: PetElementFilterId[];
  initialModuleFilter?: PetModuleTypeFilterId | null;
  initialSort?: string | null;
  initialSelectedPetId?: string | null;
  initialSelectedModuleId?: string | null;
}

export function usePetsCatalog({
  initialData,
  locale,
  initialCategory = null,
  initialServerMode = null,
  initialSearchQuery = '',
  initialElements = [],
  initialModuleFilter = null,
  initialSort = null,
  initialSelectedPetId = null,
  initialSelectedModuleId = null,
}: UsePetsCatalogProps) {
  const strings = useMemo(() => getPetsStrings(locale), [locale]);

  // Seed from the server-parsed URL params so direct links render the
  // selected category/pool on the first paint.
  const [category, setCategoryState] = useState<PetCategoryTab>(initialCategory ?? 'servants');
  const [serverMode, setServerModeState] = useState<ServerMode>(initialServerMode ?? 'gacha');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedElements, setSelectedElements] = useState<Set<PetElementFilterId>>(
    () => new Set(initialElements)
  );
  const [moduleTypeFilter, setModuleTypeFilter] = useState<PetModuleTypeFilterId>(
    initialModuleFilter ?? 'all'
  );
  const [sortValue, setSortValue] = useState(initialSort ?? DEFAULT_PETS_SORT);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(initialSelectedPetId);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(initialSelectedModuleId);

  // Fall back to the persisted preference only when neither the URL nor
  // the server-provided initial has an explicit server mode, so
  // ?server=mmo links are not overruled after mount.
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

  const sortOptions = useMemo(() => getPetsSortOptions(strings, category), [strings, category]);

  // Extract raw lists
  const allServants: PetItem[] = useMemo(() => {
    if (!initialData) return [];
    const items = (initialData.items || initialData.pets || []) as PetItem[];
    return items
      .filter((p) => p.category === 'combat')
      .map(normalizePetStats);
  }, [initialData]);

  const allModuleFamilies: PetModuleFamily[] = useMemo(() => {
    if (!initialData) return [];
    const fams = (initialData.module_families || initialData.modules || []) as PetModuleFamily[];
    return fams;
  }, [initialData]);

  // Server Mode filtering
  const modeFilteredServants = useMemo(() => {
    if (serverMode === 'mmo') {
      return allServants.filter(
        (s) => s.source_edition === 'mmo' || s.id.toLowerCase().startsWith('mmo_')
      );
    }
    return allServants.filter(
      (s) => s.source_edition !== 'mmo' && !s.id.toLowerCase().startsWith('mmo_')
    );
  }, [allServants, serverMode]);

  const modeFilteredModules = useMemo(() => {
    if (serverMode === 'mmo') {
      return [];
    }
    return allModuleFamilies;
  }, [allModuleFamilies, serverMode]);

  const { isLoading: isModeLoading, startLoading: startModeLoading } = useServerModeLoading({
    mode: serverMode,
    modeDataReady: modeFilteredServants.length > 0,
  });

  // Reconcile URL params and hash after mount. State is seeded from the
  // server-parsed params, so assignments only fire on disagreement.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';

      const sMode = params.get('server');
      if (sMode === 'mmo' || sMode === 'gacha') {
        setServerModeState((prev) => (prev === sMode ? prev : sMode));
      }

      const cat = params.get('category') || params.get('cat') || params.get('tab');
      if (cat === 'modules') {
        setCategoryState((prev) => (prev === 'modules' ? prev : 'modules'));
      }

      const q = params.get('q') || params.get('search');
      if (q) setSearchQuery((prev) => (prev === q ? prev : q));

      const elem = params.get('elem') || params.get('element');
      if (elem) {
        const parts = elem.split(',').map((e) => e.trim().toLowerCase() as PetElementFilterId);
        const list = parts.filter((p) => p !== 'all');
        setSelectedElements((prev) =>
          prev.size === list.length && list.every((v) => prev.has(v)) ? prev : new Set(list)
        );
      }

      const mod = params.get('module') || params.get('mod');
      if (mod === 'universal' || mod === 'exclusive') {
        setModuleTypeFilter((prev) => (prev === mod ? prev : mod));
      }

      const sort = params.get('sort');
      if (sort) setSortValue((prev) => (prev === sort ? prev : sort));

      // Deep link to pet or module via query param or hash. Section hashes
      // follow the Simulacra pattern: ?pet=FightPet_12#pet-skills-section.
      const petParam = params.get('pet') || params.get('module');
      const hashPetId = hash.split('--')[0];
      const targetId = hash.startsWith('pet-') ? petParam : hashPetId || petParam;
      if (targetId) {
        const matchPet = allServants.find((s) => s.id.toLowerCase() === targetId.toLowerCase());
        if (matchPet) {
          setSelectedPetId((prev) => (prev === matchPet.id ? prev : matchPet.id));
          return;
        }

        const matchModule = allModuleFamilies.find(
          (m) =>
            m.family_id.toLowerCase() === targetId.toLowerCase() ||
            m.id.toLowerCase() === targetId.toLowerCase()
        );
        if (matchModule) {
          const moduleId = matchModule.family_id || matchModule.id;
          setCategoryState((prev) => (prev === 'modules' ? prev : 'modules'));
          setSelectedModuleId((prev) => (prev === moduleId ? prev : moduleId));
        }
      }
    } catch {
      // Gracefully ignore
    }
  }, [allServants, allModuleFamilies]);

  // Sync popstate & hashchange listener for modal deep-linking & back navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHistoryChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
        const petParam = params.get('pet') || params.get('module');
        const hashPetId = hash.split('--')[0];
        const targetId = hash.startsWith('pet-') ? petParam : hashPetId || petParam;
        if (!targetId) {
          setSelectedPetId((prev) => (prev ? null : prev));
          setSelectedModuleId((prev) => (prev ? null : prev));
          return;
        }

        const matchPet = allServants.find((s) => s.id.toLowerCase() === targetId.toLowerCase());
        if (matchPet) {
          setSelectedPetId(matchPet.id);
          setSelectedModuleId(null);
          return;
        }

        const matchModule = allModuleFamilies.find(
          (m) =>
            m.family_id.toLowerCase() === targetId.toLowerCase() ||
            m.id.toLowerCase() === targetId.toLowerCase()
        );
        if (matchModule) {
          setCategoryState('modules');
          setSelectedModuleId(matchModule.family_id || matchModule.id);
          setSelectedPetId(null);
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
  }, [allServants, allModuleFamilies]);

  // Sync to URL
  const updateUrl = useCallback(
    (
      cat: PetCategoryTab,
      mode: ServerMode,
      query: string,
      elems: Set<PetElementFilterId>,
      modFilter: PetModuleTypeFilterId,
      sort: string,
      petId: string | null,
      modId: string | null
    ) => {
      if (typeof window === 'undefined' || !window.history?.replaceState) return;

      try {
        const url = new URL(window.location.href);

        if (cat === 'modules') {
          url.searchParams.set('category', 'modules');
        } else {
          url.searchParams.delete('category');
        }

        if (mode === 'mmo') {
          url.searchParams.set('server', 'mmo');
        } else {
          url.searchParams.delete('server');
        }

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

        if (modFilter !== 'all') {
          url.searchParams.set('mod', modFilter);
        } else {
          url.searchParams.delete('mod');
        }

        if (sort !== DEFAULT_PETS_SORT) {
          url.searchParams.set('sort', sort);
        } else {
          url.searchParams.delete('sort');
        }

        if (petId) {
          // Keep the entity in the query so the hash is free for a detail
          // panel anchor, matching the Simulacra detail URL contract.
          url.searchParams.set('pet', petId);
          url.searchParams.delete('module');
          url.hash = petId;
        } else if (modId) {
          url.searchParams.delete('pet');
          url.searchParams.set('module', modId);
          url.hash = '';
        } else {
          url.searchParams.delete('pet');
          url.searchParams.delete('module');
          url.hash = '';
        }

        window.history.replaceState(null, '', url.toString());
      } catch {
        // Ignore
      }
    },
    []
  );

  // Filter Servants
  const filteredServants = useMemo(() => {
    let list = [...modeFilteredServants];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const nameEn = (s.name_en || '').toLowerCase();
        const nameRu = (s.name_ru || '').toLowerCase();
        const origName = (s.original_name || '').toLowerCase();
        const id = s.id.toLowerCase();
        const matchesSkill = Array.isArray(s.skills) && s.skills.some(
          (sk) =>
            (sk.name_en && sk.name_en.toLowerCase().includes(q)) ||
            (sk.name_ru && sk.name_ru.toLowerCase().includes(q)) ||
            (sk.name && sk.name.toLowerCase().includes(q))
        );
        return (
          nameEn.includes(q) ||
          nameRu.includes(q) ||
          origName.includes(q) ||
          id.includes(q) ||
          matchesSkill
        );
      });
    }

    if (selectedElements.size > 0) {
      list = list.filter((s) => {
        const elem = normalizePetElement(s.element_norm || s.element);
        return selectedElements.has(elem);
      });
    }

    list.sort((a, b) => {
      if (sortValue === 'name_asc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameA.localeCompare(nameB);
      }
      if (sortValue === 'name_desc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameB.localeCompare(nameA);
      }
      if (sortValue === 'release_asc') {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }
      // release_desc default
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    });

    return list;
  }, [modeFilteredServants, searchQuery, selectedElements, sortValue, locale]);

  // Filter Modules
  const filteredModules = useMemo(() => {
    let list = [...modeFilteredModules];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const nameEn = (m.name_en || '').toLowerCase();
        const nameRu = (m.name_ru || '').toLowerCase();
        const ownerEn = (m.owner_en || m.owner || '').toLowerCase();
        const ownerRu = (m.owner_ru || '').toLowerCase();
        const id = (m.id || m.family_id).toLowerCase();
        return (
          nameEn.includes(q) ||
          nameRu.includes(q) ||
          ownerEn.includes(q) ||
          ownerRu.includes(q) ||
          id.includes(q)
        );
      });
    }

    if (moduleTypeFilter === 'universal') {
      list = list.filter((m) => !m.owner_en && !m.owner && !m.owner_id);
    } else if (moduleTypeFilter === 'exclusive') {
      list = list.filter((m) => Boolean(m.owner_en || m.owner || m.owner_id));
    }

    list.sort((a, b) => {
      if (sortValue === 'name_asc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameA.localeCompare(nameB);
      }
      if (sortValue === 'name_desc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameB.localeCompare(nameA);
      }
      if (sortValue === 'load_desc') {
        const loadA = a.need_load ?? a.levels?.[0]?.need_load ?? 0;
        const loadB = b.need_load ?? b.levels?.[0]?.need_load ?? 0;
        return loadB - loadA;
      }
      if (sortValue === 'load_asc') {
        const loadA = a.need_load ?? a.levels?.[0]?.need_load ?? 0;
        const loadB = b.need_load ?? b.levels?.[0]?.need_load ?? 0;
        return loadA - loadB;
      }
      if (sortValue === 'release_asc') {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }
      // release_desc
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    });

    return list;
  }, [modeFilteredModules, searchQuery, moduleTypeFilter, sortValue, locale]);

  // Active counts
  const filteredCount = category === 'servants' ? filteredServants.length : filteredModules.length;
  const totalCount = category === 'servants' ? modeFilteredServants.length : modeFilteredModules.length;

  const hasActiveFilters = useMemo(() => {
    return (
      category !== 'servants' ||
      searchQuery.trim().length > 0 ||
      selectedElements.size > 0 ||
      moduleTypeFilter !== 'all' ||
      sortValue !== DEFAULT_PETS_SORT
    );
  }, [category, searchQuery, selectedElements, moduleTypeFilter, sortValue]);

  // Handlers
  const handleServerModeChange = useCallback(
    (newMode: ServerMode) => {
      startModeLoading(newMode);
      setServerModeState(newMode);
      setStoredServerMode(newMode);
      updateUrl(
        category,
        newMode,
        searchQuery,
        selectedElements,
        moduleTypeFilter,
        sortValue,
        selectedPetId,
        selectedModuleId
      );
    },
    [
      category,
      searchQuery,
      selectedElements,
      moduleTypeFilter,
      sortValue,
      selectedPetId,
      selectedModuleId,
      startModeLoading,
      updateUrl,
    ]
  );

  const handleCategoryChange = useCallback(
    (newCategory: PetCategoryTab) => {
      setCategoryState(newCategory);
      updateUrl(
        newCategory,
        serverMode,
        searchQuery,
        selectedElements,
        moduleTypeFilter,
        sortValue,
        selectedPetId,
        selectedModuleId
      );
    },
    [
      serverMode,
      searchQuery,
      selectedElements,
      moduleTypeFilter,
      sortValue,
      selectedPetId,
      selectedModuleId,
      updateUrl,
    ]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrl(
        category,
        serverMode,
        query,
        selectedElements,
        moduleTypeFilter,
        sortValue,
        selectedPetId,
        selectedModuleId
      );
    },
    [
      category,
      serverMode,
      selectedElements,
      moduleTypeFilter,
      sortValue,
      selectedPetId,
      selectedModuleId,
      updateUrl,
    ]
  );

  const toggleElement = useCallback(
    (elem: PetElementFilterId) => {
      setSelectedElements((prev) => {
        const next = new Set(prev);
        if (elem === 'all') {
          next.clear();
        } else if (next.has(elem)) {
          next.delete(elem);
        } else {
          next.add(elem);
        }
        updateUrl(
          category,
          serverMode,
          searchQuery,
          next,
          moduleTypeFilter,
          sortValue,
          selectedPetId,
          selectedModuleId
        );
        return next;
      });
    },
    [
      category,
      serverMode,
      searchQuery,
      moduleTypeFilter,
      sortValue,
      selectedPetId,
      selectedModuleId,
      updateUrl,
    ]
  );

  const handleModuleTypeChange = useCallback(
    (type: PetModuleTypeFilterId) => {
      setModuleTypeFilter(type);
      updateUrl(
        category,
        serverMode,
        searchQuery,
        selectedElements,
        type,
        sortValue,
        selectedPetId,
        selectedModuleId
      );
    },
    [
      category,
      serverMode,
      searchQuery,
      selectedElements,
      sortValue,
      selectedPetId,
      selectedModuleId,
      updateUrl,
    ]
  );

  const handleSortChange = useCallback(
    (val: string) => {
      setSortValue(val);
      updateUrl(
        category,
        serverMode,
        searchQuery,
        selectedElements,
        moduleTypeFilter,
        val,
        selectedPetId,
        selectedModuleId
      );
    },
    [
      category,
      serverMode,
      searchQuery,
      selectedElements,
      moduleTypeFilter,
      selectedPetId,
      selectedModuleId,
      updateUrl,
    ]
  );

  const handleSelectPet = useCallback(
    (pet: PetItem | null) => {
      setSelectedPetId(pet ? pet.id : null);
      updateUrl(
        category,
        serverMode,
        searchQuery,
        selectedElements,
        moduleTypeFilter,
        sortValue,
        pet ? pet.id : null,
        null
      );
    },
    [
      category,
      serverMode,
      searchQuery,
      selectedElements,
      moduleTypeFilter,
      sortValue,
      updateUrl,
    ]
  );

  const handleSelectModule = useCallback(
    (mod: PetModuleFamily | null) => {
      setSelectedModuleId(mod ? mod.family_id || mod.id : null);
      updateUrl(
        category,
        serverMode,
        searchQuery,
        selectedElements,
        moduleTypeFilter,
        sortValue,
        null,
        mod ? mod.family_id || mod.id : null
      );
    },
    [
      category,
      serverMode,
      searchQuery,
      selectedElements,
      moduleTypeFilter,
      sortValue,
      updateUrl,
    ]
  );

  const handleResetFilters = useCallback(() => {
    setCategoryState('servants');
    setSearchQuery('');
    setSelectedElements(new Set());
    setModuleTypeFilter('all');
    setSortValue(DEFAULT_PETS_SORT);
    setSelectedPetId(null);
    setSelectedModuleId(null);
    updateUrl(
      'servants',
      serverMode,
      '',
      new Set(),
      'all',
      DEFAULT_PETS_SORT,
      null,
      null
    );
  }, [serverMode, updateUrl]);

  // Selected entities
  const selectedPet = useMemo(() => {
    if (!selectedPetId) return null;
    return allServants.find((s) => s.id.toLowerCase() === selectedPetId.toLowerCase()) || null;
  }, [selectedPetId, allServants]);

  const selectedModule = useMemo(() => {
    if (!selectedModuleId) return null;
    return (
      allModuleFamilies.find(
        (m) =>
          m.family_id.toLowerCase() === selectedModuleId.toLowerCase() ||
          m.id.toLowerCase() === selectedModuleId.toLowerCase()
      ) || null
    );
  }, [selectedModuleId, allModuleFamilies]);
  const selectedEntityName = selectedModule
    ? locale === 'ru'
      ? selectedModule.name_ru || selectedModule.name || selectedModule.name_en
      : selectedModule.name_en || selectedModule.name
    : selectedPet
      ? locale === 'ru'
        ? selectedPet.name_ru || selectedPet.name || selectedPet.name_en
        : selectedPet.name_en || selectedPet.name
      : null;
  useInfoDocumentTitle(strings.title, selectedEntityName || null);

  return {
    strings,
    sortOptions,
    category,
    setCategory: handleCategoryChange,
    serverMode,
    setServerMode: handleServerModeChange,
    isModeLoading,
    searchQuery,
    setSearchQuery: handleSearchChange,
    selectedElements,
    toggleElement,
    moduleTypeFilter,
    setModuleTypeFilter: handleModuleTypeChange,
    sortValue,
    setSortValue: handleSortChange,
    filteredServants,
    filteredModules,
    allServants,
    allModuleFamilies,
    filteredCount,
    totalCount,
    hasActiveFilters,
    handleResetFilters,
    selectedPet,
    selectedPetId,
    selectPet: handleSelectPet,
    selectedModule,
    selectedModuleId,
    selectModule: handleSelectModule,
  };
}
