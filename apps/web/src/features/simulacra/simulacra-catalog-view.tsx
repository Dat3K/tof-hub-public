'use client';
import { translateUiText } from '@tof-hub/i18n';

import React, { useEffect, useState } from 'react';
import {
  CatalogControls,
  FilterGroup,
  FilterChip,
  EntityGrid,
  Button,
} from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { useI18n } from '@/lib/i18n';
import { useSimulacraData } from '@/lib/game-data-client';
import { LoadingState } from '@/components/site-shell';
import type { Locale } from '@tof-hub/i18n';
import type { SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import type { SimulacraCatalogViewProps } from './types';
import { ELEMENT_FILTER_OPTIONS, ROLE_FILTER_OPTIONS } from './constants';
import { useSimulacraCatalog } from './use-simulacra-catalog';
import { SimulacraCardItem } from './simulacra-card-item';
import { SimulacraDetailView } from './components/simulacra-detail-view';
import styles from './simulacra.module.css';

export const SimulacraCatalogView: React.FC<SimulacraCatalogViewProps> = ({
  initialData,
  initialLocale = 'en',
  initialSelectedCharId = null,
  initialServerMode = null,
  initialSearchQuery = '',
  initialElements = [],
  initialRoles = [],
  initialSort = null,
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;

  // React-cached client data loader with SSR hydration seeding
  const { data: dataset, isLoading } = useSimulacraData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const effectiveData = dataset || initialData || null;

  const catalog = useSimulacraCatalog({
    initialData: effectiveData,
    locale: currentLocale,
    initialSelectedCharId,
    initialServerMode,
    initialSearchQuery,
    initialElements,
    initialRoles,
    initialSort,
  });

  const [detailData, setDetailData] = useState<SimulacraDatasetItemRaw | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const [detailRetryToken, setDetailRetryToken] = useState(0);
  const selectedSummary = catalog.selectedCharacter;

  useEffect(() => {
    let cancelled = false;
    setDetailData(null);
    setDetailLoadError(false);

    if (!selectedSummary) {
      setDetailLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const raw = selectedSummary as any;
    const alreadyDetailed = Boolean(raw.assets || raw.sources || raw.weapon?.skills || raw.matrix?.pieces);
    if (alreadyDetailed) {
      setDetailData(selectedSummary);
      setDetailLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setDetailLoading(true);
    const params = new URLSearchParams({
      locale: currentLocale,
      server: catalog.serverMode,
    });

    fetch(`/api/game-data/simulacra/${encodeURIComponent(selectedSummary.id)}?${params.toString()}`, {
      // Detail responses must never reuse a compact catalog response that may
      // have been cached by an earlier build of the page.
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load simulacra detail (${response.status})`);
        return (await response.json()) as SimulacraDatasetItemRaw;
      })
      .then((item) => {
        if (!cancelled) {
          setDetailData(item);
          setDetailLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailData(null);
          setDetailLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSummary, currentLocale, catalog.serverMode, detailRetryToken]);

  const selectedCharacter = detailData || selectedSummary;

  if (catalog.isModeLoading) {
    return (
      <main id="main-content" className="simulacra-main">
        <LoadingState
          message={catalog.strings.loadingMmo}
          fullPage
        />
      </main>
    );
  }

  // If a character is selected, render the full Detail View
  if (selectedCharacter && !detailLoading) {
    const activeRoster =
      catalog.filteredItems.length > 0
        ? catalog.filteredItems
        : catalog.serverMode === 'mmo'
        ? effectiveData?.mmo || []
        : effectiveData?.gacha || effectiveData?.items || [];

    const charHeading =
      currentLocale === 'ru'
        ? selectedCharacter.name_ru || selectedCharacter.name || selectedCharacter.name_en || selectedCharacter.id
        : selectedCharacter.name_en || selectedCharacter.name || selectedCharacter.id;

    return (
      <main id="main-content" className={`simulacra-main ${styles.simulacraContainer}`}>
        <h1 className={styles.srOnly}>{charHeading}</h1>
        <SimulacraDetailView
          character={selectedCharacter}
          roster={activeRoster}
          locale={currentLocale}
          serverMode={catalog.serverMode}
          strings={catalog.strings}
          onBack={() => catalog.setSelectedCharId(null)}
          onSelectCharacter={(id) => catalog.setSelectedCharId(id)}
          detailLoadError={
            detailLoadError
              ? { onRetry: () => setDetailRetryToken((token) => token + 1) }
              : undefined
          }
        />
      </main>
    );
  }

  if (selectedSummary && detailLoading) {
    return (
      <main id="main-content" className="simulacra-main">
        <LoadingState
          message={catalog.strings.loadingDetail}
          submessage={catalog.strings.loadingDetailHint}
          variant="spinner"
          fullPage
        />
      </main>
    );
  }

  return (
    <main id="main-content" className={`simulacra-main ${styles.simulacraContainer}`}>
      {/* Screen reader heading matching legacy outline */}
      <h1 className={styles.srOnly}>{catalog.strings.title}</h1>

      {/* 3-Tier Composite Controls Bar */}
      <CatalogControls
        id="sim-controls-bar"
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
        entityLabel={catalog.strings.simulacra}
        hasActiveFilters={catalog.hasActiveFilters}
        onResetFilters={catalog.handleResetFilters}
        resetLabel={catalog.strings.clearFilters}
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

      {/* Grid View of Characters */}
      <section className="simulacra-grid-view" aria-label={catalog.strings.title}>
        <EntityGrid
          className="simulacra-grid"
          columns="auto"
          gap="md"
          empty={catalog.filteredCount === 0 && !isLoading}
          emptyTitle={catalog.strings.emptyTitle}
          emptyDescription={catalog.strings.emptyDescription}
          emptyAction={
            catalog.hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={catalog.handleResetFilters}>
                {catalog.strings.clearFilters}
              </Button>
            ) : undefined
          }
          loading={isLoading && !effectiveData}
          skeletonCount={12}
        >
          {catalog.filteredItems.map((item) => (
            <SimulacraCardItem
              key={item.id}
              item={item}
              locale={currentLocale}
              serverMode={catalog.serverMode}
              strings={catalog.strings}
              onSelect={(id) => catalog.setSelectedCharId(id)}
            />
          ))}
        </EntityGrid>
      </section>
    </main>
  );
};

SimulacraCatalogView.displayName = 'SimulacraCatalogView';
