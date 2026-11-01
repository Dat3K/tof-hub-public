'use client';
import { translateUiText } from '@tof-hub/i18n';

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
import { useRelicsData } from '@/lib/game-data-client';
import type { Locale } from '@tof-hub/i18n';
import type { RelicsCatalogViewProps } from './types';
import {
  RELIC_ELEMENT_FILTER_OPTIONS,
  RELIC_PROPERTY_FILTER_OPTIONS,
} from './constants';
import { useRelicsCatalog } from './use-relics-catalog';
import { RelicCardItem } from './relic-card-item';
import { RelicDetailModal } from './relic-detail-modal';
import styles from './relics.module.css';
import {useRuntimeDetail} from '../common/use-runtime-detail';

export const RelicsCatalogView: React.FC<RelicsCatalogViewProps> = ({
  initialData,
  initialLocale = 'en',
  initialServerMode = null,
  initialSearchQuery = '',
  initialElements = [],
  initialProperties = [],
  initialSort = null,
  initialSelectedRelicId = null,
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;

  const { data: dataset, isLoading } = useRelicsData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const effectiveData = dataset || initialData || null;

  const catalog = useRelicsCatalog({
    initialData: effectiveData,
    locale: currentLocale,
    initialServerMode,
    initialSearchQuery,
    initialElements,
    initialProperties,
    initialSort,
    initialSelectedRelicId,
  });

  const detail = useRuntimeDetail(catalog.selectedRelic,currentLocale);

  if (isLoading && !effectiveData) {
    return <LoadingState fullPage message={catalog.strings.loading} />;
  }

  if (catalog.isModeLoading) {
    return <LoadingState fullPage message={catalog.strings.loadingMmo} />;
  }

  return (
    <div className={`info-ui relics-catalog-page ${styles.relicsContainer}`}>
      {/* Screen reader accessible heading matching outline */}
      <h1 className={styles.srOnly}>{catalog.strings.title}</h1>

      {/* 3-Tier Composite Controls Bar with embedded ServerModeSwitcher */}
      <CatalogControls
        id="relics-controls-bar"
        searchQuery={catalog.searchQuery}
        onSearchChange={catalog.setSearchQuery}
        searchPlaceholder={catalog.strings.searchPlaceholder}
        serverMode={catalog.serverMode}
        onServerModeChange={catalog.setServerMode}
        serverModeAriaLabel={translateUiText('Server Mode', activeLocale)}
        showServerMode={true}
        sortValue={catalog.sortValue}
        onSortChange={catalog.setSortValue}
        sortOptions={catalog.sortOptions}
        sortLabel={catalog.strings.sortBy}
        count={catalog.filteredCount}
        total={catalog.totalCount}
        entityLabel={catalog.strings.relics}
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
        {/* Element / 4★ Passive Stat Filter Group */}
        <FilterGroup
          label={catalog.strings.filterElement}
          filterGroup="element"
          ariaLabel={catalog.strings.filterElement}
        >
          {RELIC_ELEMENT_FILTER_OPTIONS.map((elem) => {
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

        {/* Property Filter Group (Attack / Defense / Assist / Function) */}
        <FilterGroup
          label={catalog.strings.filterProperty}
          filterGroup="property"
          ariaLabel={catalog.strings.filterProperty}
        >
          {RELIC_PROPERTY_FILTER_OPTIONS.map((prop) => {
            const isAll = prop.id === 'all';
            const isActive = isAll
              ? catalog.selectedProperties.size === 0
              : catalog.selectedProperties.has(prop.id);
            const label = catalog.strings[prop.copyKey];

            return (
              <FilterChip
                key={prop.id}
                value={prop.id}
                variant={prop.variant}
                active={isActive}
                icon={prop.iconPath}
                iconAlt=""
                onClick={() => catalog.toggleProperty(prop.id)}
              >
                {label}
              </FilterChip>
            );
          })}
        </FilterGroup>
      </CatalogControls>

      {/* Grid View of Relics */}
      <section className="relics-grid-section" aria-label={catalog.strings.title}>
        <EntityGrid
          className="relics-grid"
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
            <RelicCardItem
              key={item.id}
              item={item}
              locale={currentLocale}
              serverMode={catalog.serverMode}
              passiveStat={catalog.passiveStatsMap.get(item.id) ?? null}
              strings={catalog.strings}
              onSelect={(id) => catalog.setSelectedRelicId(id)}
            />
          ))}
        </EntityGrid>
      </section>

      {/* Relic Detail Modal */}
      <RelicDetailModal
        isOpen={Boolean(catalog.selectedRelic)}
        onClose={() => catalog.setSelectedRelicId(null)}
        relic={detail.data ?? catalog.selectedRelic}
        locale={currentLocale}
        serverMode={catalog.serverMode}
        passiveStat={catalog.selectedRelic ? catalog.passiveStatsMap.get(catalog.selectedRelic.id) ?? null : null}
        strings={catalog.strings}
      />
    </div>
  );
};

RelicsCatalogView.displayName = 'RelicsCatalogView';
