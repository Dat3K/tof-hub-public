'use client';

import {replaceEntitySelection} from '../common/entity-url';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { Locale } from '@tof-hub/i18n';
import type { ArtworksDataset } from '@tof-hub/contracts';
import type { ArtCategory, ArtworkItem, ArtsStrings } from './types';
import {
  DEFAULT_ARTS_SORT,
  ART_CATEGORY_OPTIONS,
  getArtsSortOptions,
  cleanArtTitle,
  filterMatchesCategory,
} from './constants';
import { getArtsStrings } from './copy';
import { useBatchedList } from '@tof-hub/ui';
import { useInfoDocumentTitle } from '../common/use-info-document-title';

export interface UseArtsCatalogOptions {
  initialData?: ArtworksDataset | null;
  locale: Locale;
  initialCategory?: ArtCategory | null;
  initialSearchQuery?: string;
  initialSort?: string | null;
}

export interface UseArtsCatalogReturn {
  strings: ArtsStrings;
  isRu: boolean;
  locale: Locale;
  categoryOptions: typeof ART_CATEGORY_OPTIONS;
  activeCategory: ArtCategory;
  setActiveCategory: (cat: ArtCategory) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortValue: string;
  setSortValue: (sort: string) => void;
  sortOptions: ReturnType<typeof getArtsSortOptions>;
  totalCount: number;
  filteredCount: number;
  categoryCounts: Record<string, number>;
  items: ArtworkItem[];
  visibleItems: ArtworkItem[];
  hasMore: boolean;
  loadMore: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
  lightboxIndex: number | null;
  activeLightboxArtwork: ArtworkItem | null;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  navigateLightbox: (direction: -1 | 1) => void;
  hasActiveFilters: boolean;
  handleResetFilters: () => void;
}

export function useArtsCatalog({
  initialData,
  locale,
  initialCategory = null,
  initialSearchQuery = '',
  initialSort = null,
}: UseArtsCatalogOptions): UseArtsCatalogReturn {
  const isRu = locale === 'ru';
  const strings = useMemo(() => getArtsStrings(locale), [locale]);
  const sortOptions = useMemo(() => getArtsSortOptions(strings), [strings]);

  // Seed from the server-parsed URL params so shared links render filtered
  // on the first paint instead of correcting after mount.
  const [activeCategory, setActiveCategory] = useState<ArtCategory>(initialCategory ?? 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [sortValue, setSortValue] = useState(initialSort ?? DEFAULT_ARTS_SORT);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const allItems = useMemo<ArtworkItem[]>(() => {
    if (!initialData) return [];
    if (Array.isArray(initialData.items)) {
      return initialData.items as ArtworkItem[];
    }
    return [];
  }, [initialData]);

  // Precompute category counts
  const categoryCounts = useMemo<Record<string, number>>(() => {
    return {
      all: allItems.length,
      wallpapers: allItems.filter((a) => a.category === 'wallpapers').length,
      characters: allItems.filter((a) => a.category === 'characters').length,
      character_bg: allItems.filter((a) => a.category === 'character_bg' || a.subCategory === 'season_bg').length,
      loading: allItems.filter((a) => a.subCategory && a.subCategory.includes('loading')).length,
      gashapon: allItems.filter((a) => a.subCategory === 'gashapon').length,
      events: allItems.filter((a) => a.subCategory === 'events').length,
      others: allItems.filter((a) => a.subCategory === 'others' || a.category === 'others').length,
    };
  }, [allItems]);

  // Filtering
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allItems.filter((art) => {
      if (!filterMatchesCategory(art, activeCategory)) {
        return false;
      }

      if (q) {
        const titleEn = typeof art.title === 'string' ? art.title.toLowerCase() : (art.title?.en || '').toLowerCase();
        const titleRu = typeof art.title === 'string' ? '' : (art.title?.ru || '').toLowerCase();
        const orig = (art.originalFileName || '').toLowerCase();
        const theme = (art.themeTag || '').toLowerCase();
        const charKey = (art.characterKey || '').toLowerCase();
        const charNameEn =
          typeof art.characterName === 'string'
            ? art.characterName.toLowerCase()
            : (art.characterName?.en || '').toLowerCase();
        const charNameRu =
          typeof art.characterName === 'string'
            ? ''
            : (art.characterName?.ru || '').toLowerCase();
        const sourcePath = (art.sourcePath || '').toLowerCase();

        const matches =
          titleEn.includes(q) ||
          titleRu.includes(q) ||
          orig.includes(q) ||
          theme.includes(q) ||
          charKey.includes(q) ||
          charNameEn.includes(q) ||
          charNameRu.includes(q) ||
          sourcePath.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [allItems, activeCategory, searchQuery]);

  // Sorting
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];

    if (sortValue === 'release_desc') {
      list.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
    } else if (sortValue === 'release_asc') {
      list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    } else if (sortValue === 'title') {
      list.sort((a, b) => {
        const tA = cleanArtTitle(a.title, isRu, locale);
        const tB = cleanArtTitle(b.title, isRu, locale);
        return tA.localeCompare(tB);
      });
    } else if (sortValue === 'title_desc') {
      list.sort((a, b) => {
        const tA = cleanArtTitle(a.title, isRu, locale);
        const tB = cleanArtTitle(b.title, isRu, locale);
        return tB.localeCompare(tA);
      });
    } else if (sortValue === 'res') {
      list.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
    } else if (sortValue === 'res_asc') {
      list.sort((a, b) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)));
    } else if (sortValue === 'size') {
      list.sort(
        (a, b) => (b.pngSizeBytes || b.sizeBytes || 0) - (a.pngSizeBytes || a.sizeBytes || 0)
      );
    } else if (sortValue === 'size_asc') {
      list.sort(
        (a, b) => (a.pngSizeBytes || a.sizeBytes || 0) - (b.pngSizeBytes || b.sizeBytes || 0)
      );
    }

    return list;
  }, [filteredItems, sortValue, isRu, locale]);

  const { visibleItems, hasMore, loadMore, sentinelRef } = useBatchedList(sortedItems, {
    resetKey: `${activeCategory}\u0000${searchQuery}\u0000${sortValue}`,
  });

  // Deep linking via URL hash & query params on mount
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (hasHydratedRef.current || typeof window === 'undefined') return;
    hasHydratedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    // State is seeded from the server-parsed params: only correct on disagreement.
    const catParam = params.get('cat') as ArtCategory | null;
    if (catParam && ART_CATEGORY_OPTIONS.some((o) => o.id === catParam)) {
      setActiveCategory((prev) => (prev === catParam ? prev : catParam));
    }
    const qParam = params.get('search') || params.get('q');
    if (qParam) {
      setSearchQuery((prev) => (prev === qParam ? prev : qParam));
    }
    const sortParam = params.get('sort');
    if (sortParam && sortOptions.some((o) => o.value === sortParam)) {
      setSortValue((prev) => (prev === sortParam ? prev : sortParam));
    }

    const hash = window.location.hash.replace(/^#/, '');
    const directId = hash || params.get('art') || params.get('id');
    if (directId) {
      const idx = sortedItems.findIndex(
        (a) =>
          a.id.toLowerCase() === directId.toLowerCase() ||
          (a.originalFileName && a.originalFileName.toLowerCase() === directId.toLowerCase())
      );
      if (idx !== -1) {
        setLightboxIndex((prev) => (prev === idx ? prev : idx));
      }
    }
  }, [sortedItems, sortOptions]);

  // Sync hashchange listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) {
        setLightboxIndex((prev) => (prev !== null ? null : prev));
        return;
      }
      const idx = sortedItems.findIndex(
        (a) =>
          a.id.toLowerCase() === hash.toLowerCase() ||
          (a.originalFileName && a.originalFileName.toLowerCase() === hash.toLowerCase())
      );
      if (idx !== -1) {
        setLightboxIndex(idx);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [sortedItems]);

  const setActiveCategoryWithUrl=useCallback((category:ArtCategory)=>{
    setActiveCategory(category);
    const params=new URLSearchParams(window.location.search);
    if(category==='all')params.delete('cat');else params.set('cat',category);
    const query=params.toString();
    window.history.replaceState(null,'',`${window.location.pathname}${query?`?${query}`:''}${window.location.hash}`);
  },[]);

  const openLightbox = useCallback(
    (index: number) => {
      if (index >= 0 && index < sortedItems.length) {
        setLightboxIndex(index);
        const art = sortedItems[index];
        if (typeof window !== 'undefined') {
          replaceEntitySelection('art', art.id);
        }
      }
    },
    [sortedItems]
  );

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    if (typeof window !== 'undefined') replaceEntitySelection('art', null);
  }, []);

  const navigateLightbox = useCallback(
    (direction: -1 | 1) => {
      setLightboxIndex((prev) => {
        if (prev === null || sortedItems.length === 0) return null;
        let nextIdx = prev + direction;
        if (nextIdx < 0) nextIdx = sortedItems.length - 1;
        if (nextIdx >= sortedItems.length) nextIdx = 0;

        const nextArt = sortedItems[nextIdx];
        if (typeof window !== 'undefined') {
          replaceEntitySelection('art', nextArt.id);
        }
        return nextIdx;
      });
    },
    [sortedItems]
  );

  const activeLightboxArtwork = useMemo(() => {
    if (lightboxIndex === null || lightboxIndex < 0 || lightboxIndex >= sortedItems.length) {
      return null;
    }
    return sortedItems[lightboxIndex];
  }, [lightboxIndex, sortedItems]);
  useInfoDocumentTitle(
    strings.title,
    activeLightboxArtwork ? cleanArtTitle(activeLightboxArtwork.title, isRu, locale) || activeLightboxArtwork.id : null
  );

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        navigateLightbox(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        navigateLightbox(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, closeLightbox, navigateLightbox]);

  const hasActiveFilters = Boolean(searchQuery || activeCategory !== 'all' || sortValue !== DEFAULT_ARTS_SORT);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setActiveCategory('all');
    setSortValue(DEFAULT_ARTS_SORT);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return {
    strings,
    isRu,
    locale,
    categoryOptions: ART_CATEGORY_OPTIONS,
    activeCategory,
    setActiveCategory:setActiveCategoryWithUrl,
    searchQuery,
    setSearchQuery,
    sortValue,
    setSortValue,
    sortOptions,
    totalCount: allItems.length,
    filteredCount: sortedItems.length,
    categoryCounts,
    items: sortedItems,
    visibleItems,
    hasMore,
    loadMore,
    sentinelRef,
    lightboxIndex,
    activeLightboxArtwork,
    openLightbox,
    closeLightbox,
    navigateLightbox,
    hasActiveFilters,
    handleResetFilters,
  };
}
