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
import { gameAsset } from '@tof-hub/game-assets';
import { useI18n } from '@/lib/i18n';
import { useMatricesData } from '@/lib/game-data-client';
import type { Locale } from '@tof-hub/i18n';
import type { MatricesCatalogViewProps } from './types';
import { ELEMENT_FILTER_OPTIONS, ROLE_FILTER_OPTIONS } from './constants';
import { useMatricesCatalog } from './use-matrices-catalog';
import { MatrixCardItem } from './matrix-card-item';
import { MatrixDetailModal } from './matrix-detail-modal';
import styles from './matrices.module.css';

export const MatricesCatalogView: React.FC<MatricesCatalogViewProps> = ({
  initialData,
  initialLocale = 'en',
  initialSearchQuery = '',
  initialElements = [],
  initialRoles = [],
  initialSort = null,
  initialSelectedMatrixId = null,
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;

  const { data: dataset, isLoading } = useMatricesData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const effectiveData = dataset || initialData || null;

  const catalog = useMatricesCatalog({
    initialData: effectiveData,
    locale: currentLocale,
    initialSearchQuery,
    initialElements,
    initialRoles,
    initialSort,
    initialSelectedMatrixId,
  });

  if (isLoading && !effectiveData) {
    return <LoadingState fullPage message={catalog.strings.loading} />;
  }

  return (
    <div className={`info-ui matrices-catalog-page ${styles.matricesContainer}`}>
      {/* Screen reader accessible heading matching outline */}
      <h1 className={styles.srOnly}>{catalog.strings.title}</h1>

      {/* 3-Tier Composite Controls Bar from Shared UI */}
      <CatalogControls
        id="matrices-controls-bar"
        searchQuery={catalog.searchQuery}
        onSearchChange={catalog.setSearchQuery}
        searchPlaceholder={catalog.strings.searchPlaceholder}
        sortValue={catalog.sortValue}
        onSortChange={catalog.setSortValue}
        sortOptions={catalog.sortOptions}
        sortLabel={catalog.strings.sortBy}
        count={catalog.filteredCount}
        total={catalog.totalCount}
        entityLabel={catalog.strings.sets}
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
        {/* Element Filter Group */}
        <FilterGroup
          label={catalog.strings.filterElement}
          filterGroup="element"
          ariaLabel={catalog.strings.filterElement}
        >
          {ELEMENT_FILTER_OPTIONS.map((elem) => {
            const isAll = elem.id === 'all';
            const isActive = isAll
              ? catalog.selectedElements.size === 0
              : catalog.selectedElements.has(elem.id);
            const label = catalog.strings[elem.copyKey];

            return (
              <FilterChip
                key={elem.id}
                value={elem.id}
                variant={elem.variant}
                active={isActive}
                icon={elem.iconPath ? gameAsset(elem.iconPath) : undefined}
                iconAlt=""
                onClick={() => catalog.toggleElement(elem.id)}
              >
                {label}
              </FilterChip>
            );
          })}
        </FilterGroup>

        {/* Role Filter Group */}
        <FilterGroup
          label={catalog.strings.filterRole}
          filterGroup="role"
          ariaLabel={catalog.strings.filterRole}
        >
          {ROLE_FILTER_OPTIONS.map((role) => {
            const isAll = role.id === 'all';
            const isActive = isAll
              ? catalog.selectedRoles.size === 0
              : catalog.selectedRoles.has(role.id);
            const label = catalog.strings[role.copyKey];

            return (
              <FilterChip
                key={role.id}
                value={role.id}
                variant={role.variant}
                active={isActive}
                icon={role.iconPath ? gameAsset(role.iconPath) : undefined}
                iconAlt=""
                onClick={() => catalog.toggleRole(role.id)}
              >
                {label}
              </FilterChip>
            );
          })}
        </FilterGroup>
      </CatalogControls>

      {/* Grid View of Matrix Sets */}
      <section className="matrices-grid-section" aria-label={catalog.strings.title}>
        <EntityGrid
          className="matrices-grid"
          columns="auto"
          gap="md"
          empty={catalog.filteredCount === 0 && !isLoading}
          emptyTitle={catalog.strings.emptyTitle}
          emptyDescription={catalog.strings.emptyDescription}
          emptyAction={
            catalog.hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={catalog.handleResetFilters}>
                {catalog.strings.resetFilters}
              </Button>
            ) : undefined
          }
          loading={isLoading && !effectiveData}
          skeletonCount={12}
        >
          {catalog.filteredItems.map((item) => (
            <MatrixCardItem
              key={item.id}
              item={item}
              locale={currentLocale}
              strings={catalog.strings}
              onSelect={(id) => catalog.setSelectedMatrixId(id)}
            />
          ))}
        </EntityGrid>
      </section>

      {/* Matrix Detail Modal */}
      <MatrixDetailModal
        isOpen={Boolean(catalog.selectedMatrix)}
        onClose={() => catalog.setSelectedMatrixId(null)}
        matrix={catalog.selectedMatrix}
        locale={currentLocale}
        strings={catalog.strings}
      />
    </div>
  );
};

MatricesCatalogView.displayName = 'MatricesCatalogView';
