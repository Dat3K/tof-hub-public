'use client';

import {replaceEntitySelection} from '../common/entity-url';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Locale } from '@tof-hub/i18n';
import type { CosmeticsDataset, CosmeticAnimation } from '@tof-hub/contracts';
import type {
  CosmeticCategory,
  CosmeticItem,
  CosmeticsStrings,
} from './types';
import {
  DEFAULT_COSMETICS_SORT,
  COSMETIC_CATEGORY_OPTIONS,
  getCosmeticsSortOptions,
  getItemCategory,
  normalizeQuality,
  idTail,
  MOUNT_CRAFTING_PARTS,
} from './constants';
import { getCosmeticsStrings } from './copy';
import { useInfoDocumentTitle } from '../common/use-info-document-title';
import { useBatchedList } from '@tof-hub/ui';

export interface UseCosmeticsCatalogOptions {
  initialData?: CosmeticsDataset | null;
  locale: Locale;
  initialCategory?: CosmeticCategory | null;
  initialSearchQuery?: string;
  initialSort?: string | null;
}

export interface UseCosmeticsCatalogReturn {
  strings: CosmeticsStrings;
  isRu: boolean;
  categoryOptions: typeof COSMETIC_CATEGORY_OPTIONS;
  activeCategory: CosmeticCategory;
  setActiveCategory: (cat: CosmeticCategory) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortValue: string;
  setSortValue: (sort: string) => void;
  sortOptions: ReturnType<typeof getCosmeticsSortOptions>;
  totalCount: number;
  filteredCount: number;
  categoryCounts: Record<string, number>;
  visibleItems: CosmeticItem[];
  hasMore: boolean;
  loadMore: () => void;
  sentinelRef: import('react').RefObject<HTMLDivElement | null>;
  selectedItem: CosmeticItem | null;
  setSelectedItem: (item: CosmeticItem | null) => void;
  handleOpenModal: (item: CosmeticItem) => void;
  handleCloseModal: () => void;
  lightbox: {
    isOpen: boolean;
    src: string;
    webpSrc?: string;
    animation?: CosmeticAnimation;
    caption: string;
  };
  openLightbox: (src: string, caption: string, webpSrc?: string, animation?: CosmeticAnimation) => void;
  closeLightbox: () => void;
  hasActiveFilters: boolean;
  handleResetFilters: () => void;
}

const PAGE_BATCH_SIZE = 60;

function compareHauteCouture(a: CosmeticItem, b: CosmeticItem, isDesc = true): number {
  const getOwnerNum = (it: CosmeticItem) =>
    parseInt(it.owner_simulacrum_id?.match(/\d+/)?.[0] || it.id.match(/_(\d+)/)?.[1] || '0', 10);
  const ownerA = getOwnerNum(a);
  const ownerB = getOwnerNum(b);

  if (ownerA !== ownerB) {
    return isDesc ? ownerB - ownerA : ownerA - ownerB;
  }

  function getVariation(id: string, ownerNum: number) {
    if (id.includes('sen')) return 3;
    const m = id.match(/(?:_(\d+)$|_(\d+)_w$|_w_(\d+)$)/);
    if (m) {
      const num = parseInt(m[1] || m[2] || m[3], 10);
      if (num !== ownerNum) return num;
    }
    return 1;
  }

  const varA = getVariation(a.id, ownerA);
  const varB = getVariation(b.id, ownerB);
  if (varA !== varB) {
    return isDesc ? varA - varB : varB - varA;
  }

  function getItemSubRank(it: CosmeticItem) {
    const isAltWeapon = !it.id.includes('fashion') && it.id.endsWith('_w');
    const isWeapon = it.id.endsWith('_w') || it.id.includes('_w_');
    if (isWeapon && !isAltWeapon) return 0;
    if (!isWeapon) return 1;
    return 2;
  }

  const subA = getItemSubRank(a);
  const subB = getItemSubRank(b);
  if (subA !== subB) {
    return subA - subB;
  }

  return String(a.id).localeCompare(String(b.id));
}

export function useCosmeticsCatalog({
  initialData,
  locale,
  initialCategory = null,
  initialSearchQuery = '',
  initialSort = null,
}: UseCosmeticsCatalogOptions): UseCosmeticsCatalogReturn {
  const isRu = locale === 'ru';
  const strings = useMemo(() => getCosmeticsStrings(locale), [locale]);
  const sortOptions = useMemo(() => getCosmeticsSortOptions(strings), [strings]);

  // Seed from the server-parsed URL params so shared links render filtered
  // on the first paint instead of correcting after mount.
  const [activeCategory, setActiveCategory] = useState<CosmeticCategory>(initialCategory ?? 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [sortValue, setSortValue] = useState(initialSort ?? DEFAULT_COSMETICS_SORT);
  const [selectedItem, setSelectedItem] = useState<CosmeticItem | null>(null);
  const selectedItemName = selectedItem
    ? locale === 'ru'
      ? selectedItem.name_ru || selectedItem.name || selectedItem.name_en
      : selectedItem.name_en || selectedItem.name
    : null;
  useInfoDocumentTitle(strings.title, selectedItemName || selectedItem?.sub_type || null);
  const [lightbox, setLightbox] = useState<{ isOpen: boolean; src: string; webpSrc?: string; animation?: CosmeticAnimation; caption: string }>({
    isOpen: false,
    src: '',
    caption: '',
  });

  const rawItems = useMemo<CosmeticItem[]>(() => {
    if (!initialData) return [];
    const dataAny = initialData as any;
    const hasImage = (item: CosmeticItem) =>
      item.category === 'chatStickers' || item.category === 'badges'
      || [item.icon, item.photo].some((value) => typeof value === 'string' && value.trim().length > 0);

    if (Array.isArray(dataAny.items) && dataAny.items.length > 0) {
      return dataAny.items.filter(hasImage);
    }

    const fallback: CosmeticItem[] = [];
    const categories = [
      'chatStickers',
      'badges',
      'avatars',
      'avatarFrames',
      'chatBackgrounds',
      'mounts',
      'outfits',
      'titles',
      'cutePets',
      'enemies',
    ];
    for (const cat of categories) {
      if (Array.isArray(dataAny[cat])) {
        fallback.push(...dataAny[cat]);
      }
    }
    return fallback.filter(hasImage);
  }, [initialData]);

  // Enrich mounts with crafting parts if missing
  const allItems = useMemo<CosmeticItem[]>(() => {
    return rawItems.map((item) => {
      if ((item.fashion_type === 'Mount' || item.category === 'mounts') && (!item.parts || item.parts.length === 0)) {
        const parts = MOUNT_CRAFTING_PARTS[item.id];
        if (parts) {
          return { ...item, parts };
        }
      }
      return item;
    });
  }, [rawItems]);

  // Precompute category counts
  const categoryCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = { all: allItems.length };
    for (const item of allItems) {
      const cat = getItemCategory(item);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allItems]);

  // Deep-linking via URL hash & query params on mount
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (hasHydratedRef.current || typeof window === 'undefined') return;
    hasHydratedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    // Legacy uses `?type=Glider`; keep the old `cat` alias readable for existing links.
    // State is seeded from the server-parsed params: only correct on disagreement.
    const catParam = (params.get('type') || params.get('cat')) as CosmeticCategory | null;
    if (catParam && COSMETIC_CATEGORY_OPTIONS.some((o) => o.id === catParam)) {
      setActiveCategory((prev) => (prev === catParam ? prev : catParam));
    }
    const qParam = params.get('search') || params.get('q');
    if (qParam) {
      setSearchQuery((prev) => (prev === qParam ? prev : qParam));
    }
    const sortParam = params.get('sort');
    const normalizedSortParam =
      sortParam === 'id_desc' ? 'order_desc' : sortParam === 'id_asc' ? 'order_asc' : sortParam;
    if (normalizedSortParam && sortOptions.some((o) => o.value === normalizedSortParam)) {
      setSortValue((prev) => (prev === normalizedSortParam ? prev : normalizedSortParam));
    }

    const hash = window.location.hash.replace(/^#/, '');
    const directId = hash || params.get('outfit') || params.get('id');
    if (directId) {
      const found = allItems.find((o) => o.id.toLowerCase() === directId.toLowerCase());
      if (found) {
        setSelectedItem((prev) => (prev?.id === found.id ? prev : found));
      }
    }
  }, [allItems, sortOptions]);

  // Sync hashchange listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) {
        setSelectedItem((prev) => (prev ? null : prev));
        return;
      }
      const match = allItems.find((o) => o.id.toLowerCase() === hash.toLowerCase());
      if (match) {
        setSelectedItem(match);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [allItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allItems.filter((item) => {
      if (activeCategory !== 'all') {
        const cat = getItemCategory(item);
        if (cat !== activeCategory) {
          return false;
        }
      }

      if (q) {
        const nameEn = (item.name_en || '').toLowerCase();
        const nameRu = (item.name_ru || '').toLowerCase();
        const nameBase = (item.name || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        const fashionType = (item.fashion_type || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        const descEn = (item.desc_en || item.description || '').toLowerCase();
        const descRu = (item.desc_ru || '').toLowerCase();
        const source = (item.source_en || item.source_ru || item.source || item.active_source || '').toLowerCase();
        const owner = (item.owner_simulacrum_id || '').toLowerCase();
        const subType = (item.sub_type || '').toLowerCase();
        const partsText = Array.isArray(item.parts)
          ? item.parts
              .map(
                (p) =>
                  `${p.name_en || ''} ${p.name_ru || ''} ${p.source_en || ''} ${p.source_ru || ''} ${p.lore_en || ''}`
              )
              .join(' ')
              .toLowerCase()
          : '';

        const matches =
          nameEn.includes(q) ||
          nameRu.includes(q) ||
          nameBase.includes(q) ||
          id.includes(q) ||
          fashionType.includes(q) ||
          category.includes(q) ||
          descEn.includes(q) ||
          descRu.includes(q) ||
          source.includes(q) ||
          owner.includes(q) ||
          subType.includes(q) ||
          partsText.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [allItems, activeCategory, searchQuery]);

  // Sort items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];

    list.sort((a, b) => {
      if (sortValue === 'order_desc') {
        if (a.fashion_type === 'SimulacrumHauteCouture' && b.fashion_type === 'SimulacrumHauteCouture') {
          return compareHauteCouture(a, b, true);
        }
        return idTail(b.id) - idTail(a.id) || String(b.id).localeCompare(String(a.id));
      }
      if (sortValue === 'order_asc') {
        if (a.fashion_type === 'SimulacrumHauteCouture' && b.fashion_type === 'SimulacrumHauteCouture') {
          return compareHauteCouture(a, b, false);
        }
        return idTail(a.id) - idTail(b.id) || String(a.id).localeCompare(String(b.id));
      }
      if (sortValue === 'name') {
        const nameA = isRu ? a.name_ru || a.name_en || a.name || '' : a.name_en || a.name || '';
        const nameB = isRu ? b.name_ru || b.name_en || b.name || '' : b.name_en || b.name || '';
        return nameA.localeCompare(nameB);
      }
      if (sortValue === 'name_desc') {
        const nameA = isRu ? a.name_ru || a.name_en || a.name || '' : a.name_en || a.name || '';
        const nameB = isRu ? b.name_ru || b.name_en || b.name || '' : b.name_en || b.name || '';
        return nameB.localeCompare(nameA);
      }
      if (sortValue === 'quality') {
        const qOrder: Record<string, number> = { SSR: 1, SR: 2, R: 3, N: 4 };
        const qA = normalizeQuality(a.quality || a.rarity);
        const qB = normalizeQuality(b.quality || b.rarity);
        const diff = (qOrder[qA] || 99) - (qOrder[qB] || 99);
        if (diff !== 0) return diff;
        return idTail(b.id) - idTail(a.id) || String(b.id).localeCompare(String(a.id));
      }
      if (sortValue === 'quality_asc') {
        const qOrder: Record<string, number> = { N: 1, R: 2, SR: 3, SSR: 4 };
        const qA = normalizeQuality(a.quality || a.rarity);
        const qB = normalizeQuality(b.quality || b.rarity);
        const diff = (qOrder[qA] || 99) - (qOrder[qB] || 99);
        if (diff !== 0) return diff;
        return idTail(a.id) - idTail(b.id) || String(a.id).localeCompare(String(b.id));
      }
      if (sortValue === 'id_desc') {
        return idTail(b.id) - idTail(a.id) || String(b.id).localeCompare(String(a.id));
      }
      if (sortValue === 'id_asc') {
        return idTail(a.id) - idTail(b.id) || String(a.id).localeCompare(String(b.id));
      }
      return 0;
    });

    return list;
  }, [filteredItems, sortValue, isRu]);

  const { visibleItems, hasMore, loadMore, sentinelRef } = useBatchedList(sortedItems, {
    batchSize: PAGE_BATCH_SIZE,
    resetKey: `${activeCategory}\u0000${searchQuery}\u0000${sortValue}`,
  });

  const setActiveCategoryWithUrl = useCallback((category: CosmeticCategory) => {
    setActiveCategory(category);
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    params.delete('cat');
    if (category === 'all') {
      params.delete('type');
    } else {
      params.set('type', category);
    }

    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    );
  }, []);

  const handleOpenModal = useCallback((item: CosmeticItem) => {
    setSelectedItem(item);
    if (typeof window !== 'undefined') {
      replaceEntitySelection('outfit', item.id);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedItem(null);
    if (typeof window !== 'undefined') replaceEntitySelection('outfit', null);
  }, []);

  useEffect(() => {
    if (!selectedItem || lightbox.isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, lightbox.isOpen, handleCloseModal]);

  const openLightbox = useCallback((src: string, caption: string, webpSrc?: string, animation?: CosmeticAnimation) => {
    setLightbox({ isOpen: true, src, webpSrc, caption, animation });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const hasActiveFilters = Boolean(searchQuery || activeCategory !== 'all' || sortValue !== DEFAULT_COSMETICS_SORT);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setActiveCategoryWithUrl('all');
    setSortValue(DEFAULT_COSMETICS_SORT);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [setActiveCategoryWithUrl]);

  return {
    strings,
    isRu,
    categoryOptions: COSMETIC_CATEGORY_OPTIONS,
    activeCategory,
    setActiveCategory: setActiveCategoryWithUrl,
    searchQuery,
    setSearchQuery,
    sortValue,
    setSortValue,
    sortOptions,
    totalCount: allItems.length,
    filteredCount: sortedItems.length,
    categoryCounts,
    visibleItems,
    hasMore,
    loadMore,
    sentinelRef,
    selectedItem,
    setSelectedItem,
    handleOpenModal,
    handleCloseModal,
    lightbox,
    openLightbox,
    closeLightbox,
    hasActiveFilters,
    handleResetFilters,
  };
}
