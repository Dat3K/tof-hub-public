'use client';

import React from 'react';
import {
  CatalogControls,
  LoadingState,
  FilterGroup,
  FilterChip,
  EntityGrid,
  Button,
} from '@tof-hub/ui';
import { useI18n } from '@/lib/i18n';
import { useArtsData } from '@/lib/game-data-client';
import type { Locale } from '@tof-hub/i18n';
import type { ArtsCatalogViewProps } from './types';
import { ART_CATEGORY_OPTIONS } from './constants';
import { useArtsCatalog } from './use-arts-catalog';
import { ArtCardItem } from './art-card-item';
import { ArtCategoryIcon } from './art-category-icon';
import { ArtLightboxModal } from './art-lightbox-modal';
import styles from './arts.module.css';

export const ArtsCatalogView: React.FC<ArtsCatalogViewProps> = ({
  initialData,
  initialLocale = 'en',
  initialCategory = null,
  initialSearchQuery = '',
  initialSort = null,
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;

  const { data: dataset, isLoading } = useArtsData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const effectiveData = dataset || initialData || null;

  const catalog = useArtsCatalog({
    initialData: effectiveData,
    locale: currentLocale,
    initialCategory,
    initialSearchQuery,
    initialSort,
  });

  if (isLoading && !effectiveData) {
    return <LoadingState fullPage message={catalog.strings.loading} />;
  }

  return (
    <div className={`info-ui arts-catalog-page ${styles.artsContainer}`}>
      {/* Screen reader accessible title */}
      <h1 className={styles.srOnly}>{catalog.strings.title}</h1>

      {/* Catalog Controls Bar from Shared UI */}
      <CatalogControls
        id="arts-controls-bar"
        searchQuery={catalog.searchQuery}
        onSearchChange={catalog.setSearchQuery}
        searchPlaceholder={catalog.strings.searchPlaceholder}
        sortValue={catalog.sortValue}
        onSortChange={catalog.setSortValue}
        sortOptions={catalog.sortOptions}
        sortLabel={catalog.strings.sortBy}
        count={catalog.filteredCount}
        total={catalog.totalCount}
        entityLabel={catalog.strings.artworks}
        hasActiveFilters={catalog.hasActiveFilters}
        onResetFilters={catalog.handleResetFilters}
        resetLabel={catalog.strings.resetFilters}
        counterFormat={(count, total, entityLabel) => (
          <span>
            {catalog.strings.showing} <strong data-page-count>{count}</strong> {catalog.strings.of}{' '}
            <strong data-page-total>{total}</strong> {entityLabel}
          </span>
        )}
      >
        {/* Category Filter Group */}
        <FilterGroup
          label={catalog.strings.filterCategory}
          filterGroup="category"
          ariaLabel={catalog.strings.filterCategory}
        >
          {ART_CATEGORY_OPTIONS.map((cat) => {
            const isActive = catalog.activeCategory === cat.id;
            const count = catalog.categoryCounts[cat.id] ?? 0;
            const label = catalog.strings[cat.copyKey] || cat.id;

            return (
              <FilterChip
                key={cat.id}
                value={cat.id}
                active={isActive}
                icon={cat.icon ? <ArtCategoryIcon name={cat.icon} /> : undefined}
                className={`${styles.categoryChip} ${styles[`categoryChip--${cat.tone ?? 'neutral'}`]}`}
                onClick={() => catalog.setActiveCategory(cat.id)}
              >
                {label} {count > 0 && `(${count})`}
              </FilterChip>
            );
          })}
        </FilterGroup>
      </CatalogControls>

      {/* Results Grid / Empty State */}
      {catalog.filteredCount === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-[#111827] border border-white/10 rounded-xl my-6">
          <span className="text-4xl mb-3">🎨</span>
          <h2 className="text-lg font-bold text-white mb-1">{catalog.strings.noResultsTitle}</h2>
          <p className="text-base text-gray-400 mb-4">{catalog.strings.noResultsDesc}</p>
          {catalog.hasActiveFilters && (
            <Button variant="secondary" onClick={catalog.handleResetFilters}>
              {catalog.strings.resetFilters}
            </Button>
          )}
        </div>
      ) : (
        <>
          <EntityGrid
            columns={4}
            className="my-6"
          >
            {catalog.visibleItems.map((art, idx) => (
              <ArtCardItem
                key={art.id || art.originalFileName || idx}
                artwork={art}
                strings={catalog.strings}
                isRu={catalog.isRu}
                locale={catalog.locale}
                index={idx}
                onClick={catalog.openLightbox}
              />
            ))}
          </EntityGrid>

          {catalog.hasMore && (
            <div
              ref={catalog.sentinelRef}
              className={styles.loadMoreSentinel}
              aria-hidden="true"
            />
          )}
        </>
      )}

      {/* Fullscreen Art Lightbox Modal */}
      <ArtLightboxModal
        isOpen={catalog.lightboxIndex !== null}
        artworks={catalog.items}
        activeIndex={catalog.lightboxIndex ?? 0}
        onClose={catalog.closeLightbox}
        onNavigate={catalog.navigateLightbox}
        strings={catalog.strings}
        isRu={catalog.isRu}
                locale={catalog.locale}
      />
    </div>
  );
};
