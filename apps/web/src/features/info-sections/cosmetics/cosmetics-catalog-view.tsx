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
import { useCosmeticsData } from '@/lib/game-data-client';
import type { Locale } from '@tof-hub/i18n';
import type { CosmeticsCatalogViewProps } from './types';
import { COSMETIC_CATEGORY_OPTIONS, getCosmeticCategoryTone } from './constants';
import { useCosmeticsCatalog } from './use-cosmetics-catalog';
import { CosmeticCardItem } from './cosmetic-card-item';
import { CosmeticDetailModal } from './cosmetic-detail-modal';
import { InfoLightbox } from '../common/info-lightbox';
import styles from './cosmetics.module.css';

const CategoryIcon: React.FC<{ name?: string }> = ({ name }) => {
  if (!name) return null;

  const common = {
    className: styles.categoryIcon,
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'sparkle':
      return <svg {...common}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /></svg>;
    case 'dress':
      return <svg {...common}><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></svg>;
    case 'headwear':
      return <svg {...common}><path d="M2 18h20" /><path d="M4 18a8 8 0 0 1 16 0" /><circle cx="12" cy="7" r="1.5" /></svg>;
    case 'glider':
      return <svg {...common}><polygon points="12 2 2 22 12 17 22 22 12 2" /></svg>;
    case 'servant':
      return <svg {...common}><rect x="3" y="11" width="18" height="10" rx="3" /><circle cx="8.5" cy="16" r="1.5" /><circle cx="15.5" cy="16" r="1.5" /><path d="M12 2v5" /><circle cx="12" cy="2" r="1" /><line x1="2" y1="16" x2="3" y2="16" /><line x1="21" y1="16" x2="22" y2="16" /></svg>;
    case 'medal':
      return <svg {...common}><circle cx="12" cy="8" r="6" /><path d="m15.4 12.5 3.6 7.5-7-3-7 3 3.6-7.5" /></svg>;
    case 'pet':
      return <svg {...common}><circle cx="11" cy="4" r="1.5" /><circle cx="18" cy="7" r="1.5" /><circle cx="6" cy="7" r="1.5" /><circle cx="15" cy="4" r="1.5" /><path d="M9 18a4.5 4.5 0 0 1-5-4.5C4 10 7.5 9 12 9s8 1 8 4.5a4.5 4.5 0 0 1-5 4.5c-.8 0-1.5-.2-2-.5-.5.3-1.2.5-2 .5s-1.5-.2-2-.5c-.5.3-1.2.5-2 .5z" /></svg>;
    case 'mount':
      return <svg {...common}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>;
    case 'avatar':
      return <svg {...common}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'frame':
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
    case 'chat':
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case 'enemy':
      return <svg {...common}><path d="M12 2a8 8 0 0 0-8 8c0 2.9 1.6 5.4 4 6.7V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3.3c2.4-1.3 4-3.8 4-6.7a8 8 0 0 0-8-8Z" /><circle cx="9" cy="10" r="1" /><circle cx="15" cy="10" r="1" /><path d="M12 13v3" /></svg>;
    case 'chatbox':
      return <svg {...common}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>;
    default:
      return null;
  }
};

export const CosmeticsCatalogView: React.FC<CosmeticsCatalogViewProps> = ({
  initialData,
  initialLocale = 'en',
  initialCategory = null,
  initialSearchQuery = '',
  initialSort = null,
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;

  const { data: dataset, isLoading } = useCosmeticsData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const effectiveData = dataset || initialData || null;

  const catalog = useCosmeticsCatalog({
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
    <div className={`info-ui cosmetics-catalog-page ${styles.cosmeticsContainer}`}>
      {/* Screen reader accessible title */}
      <h1 className={styles.srOnly}>{catalog.strings.title}</h1>

      {/* Catalog Controls Bar from Shared UI */}
      <CatalogControls
        id="cosmetics-controls-bar"
        searchQuery={catalog.searchQuery}
        onSearchChange={catalog.setSearchQuery}
        searchPlaceholder={catalog.strings.searchPlaceholder}
        sortValue={catalog.sortValue}
        onSortChange={catalog.setSortValue}
        sortOptions={catalog.sortOptions}
        sortLabel={catalog.strings.sortBy}
        count={catalog.filteredCount}
        total={catalog.totalCount}
        entityLabel={catalog.strings.items}
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
          {COSMETIC_CATEGORY_OPTIONS.map((cat) => {
            const isActive = catalog.activeCategory === cat.id;
            const count = catalog.categoryCounts[cat.id] ?? 0;
            const label = catalog.strings[cat.copyKey] || cat.id;

            return (
              <FilterChip
                key={cat.id}
                value={cat.id}
                active={isActive}
                onClick={() => catalog.setActiveCategory(cat.id)}
                icon={cat.icon ? <CategoryIcon name={cat.icon} /> : undefined}
                className={`${styles.categoryChip} ${styles[`categoryChip--${getCosmeticCategoryTone(cat.id)}`]}`}
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
          <span className="text-4xl mb-3">👗</span>
          <p className="text-base text-gray-300 mb-4">{catalog.strings.noMatches}</p>
          {catalog.hasActiveFilters && (
            <Button variant="secondary" onClick={catalog.handleResetFilters}>
              {catalog.strings.resetFilters}
            </Button>
          )}
        </div>
      ) : (
        <>
          <EntityGrid
            columns="auto"
            className="my-6"
          >
            {catalog.visibleItems.map((item) => (
              <CosmeticCardItem
                key={item.id}
                item={item}
                strings={catalog.strings}
                isRu={catalog.isRu}
                onClick={catalog.handleOpenModal}
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

      {/* Detail Modal */}
      <CosmeticDetailModal
        isOpen={Boolean(catalog.selectedItem)}
        item={catalog.selectedItem}
        onClose={catalog.handleCloseModal}
        isRu={catalog.isRu}
        strings={catalog.strings}
        onOpenLightbox={catalog.openLightbox}
      />

      {/* Artwork Lightbox */}
      <InfoLightbox
        isOpen={catalog.lightbox.isOpen}
        onClose={catalog.closeLightbox}
        src={catalog.lightbox.src}
        webpSrc={catalog.lightbox.webpSrc}
        animation={catalog.lightbox.animation?.status === 'ready' ? {src: catalog.lightbox.animation.webp, gifSrc: catalog.lightbox.animation.gif} : undefined}
        caption={catalog.lightbox.caption}
        alt={catalog.lightbox.caption}
        isRu={catalog.isRu}
      />
    </div>
  );
};
