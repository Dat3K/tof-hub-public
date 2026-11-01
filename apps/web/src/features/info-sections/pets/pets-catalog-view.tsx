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
import { usePetsData } from '@/lib/game-data-client';
import type { Locale } from '@tof-hub/i18n';
import type { PetsCatalogViewProps } from './types';
import { PET_ELEMENT_FILTER_OPTIONS, PET_MODULE_TYPE_OPTIONS } from './constants';
import { usePetsCatalog } from './use-pets-catalog';
import { PetServantCard } from './pet-servant-card';
import { PetModuleCard } from './pet-module-card';
import { PetServantModal } from './pet-servant-modal';
import { PetModuleModal } from './pet-module-modal';
import styles from './pets.module.css';
import {normalizePetStats} from './pet-stats';
import {useRuntimeDetail,RuntimeDetailStatus} from '../common/use-runtime-detail';

type PetControlIconKind = 'servants' | 'modules' | 'universal' | 'exclusive';

function PetControlIcon({ kind }: { kind: PetControlIconKind }) {
  const commonProps = {
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

  if (kind === 'servants') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="11" width="18" height="10" rx="3" />
        <circle cx="8.5" cy="16" r="1.5" />
        <circle cx="15.5" cy="16" r="1.5" />
        <path d="M12 2v5" />
        <circle cx="12" cy="2" r="1" />
        <line x1="2" y1="16" x2="3" y2="16" />
        <line x1="21" y1="16" x2="22" y2="16" />
      </svg>
    );
  }

  if (kind === 'modules') {
    return (
      <svg {...commonProps}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 1v3" />
        <path d="M15 1v3" />
        <path d="M9 20v3" />
        <path d="M15 20v3" />
        <path d="M20 9h3" />
        <path d="M20 14h3" />
        <path d="M1 9h3" />
        <path d="M1 14h3" />
      </svg>
    );
  }

  if (kind === 'universal') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export const PetsCatalogView: React.FC<PetsCatalogViewProps> = ({
  initialData,
  initialLocale = 'en',
  initialCategory = null,
  initialServerMode = null,
  initialSearchQuery = '',
  initialElements = [],
  initialModuleFilter = null,
  initialSort = null,
  initialSelectedPetId = null,
  initialSelectedModuleId = null,
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;

  const { data: dataset, isLoading } = usePetsData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const effectiveData = dataset || initialData || null;

  const catalog = usePetsCatalog({
    initialData: effectiveData,
    locale: currentLocale,
    initialCategory,
    initialServerMode,
    initialSearchQuery,
    initialElements,
    initialModuleFilter,
    initialSort,
    initialSelectedPetId,
    initialSelectedModuleId,
  });

  const isServants = catalog.category === 'servants';
  const detail = useRuntimeDetail(catalog.selectedPet,currentLocale);
  if (detail.isLoading || detail.error) return <RuntimeDetailStatus detail={detail} locale={currentLocale} onClose={()=>catalog.selectPet(null)} />;

  if (isLoading && !effectiveData) {
    return <LoadingState fullPage message={catalog.strings.loading} />;
  }

  if (catalog.isModeLoading) {
    return <LoadingState fullPage message={catalog.strings.loadingMmo} />;
  }

  return (
    <div className={`info-ui pets-catalog-page ${styles.petsContainer}`}>
      {/* Screen reader accessible heading matching outline */}
      <h1 className={styles.srOnly}>{catalog.strings.title}</h1>

      {catalog.selectedPet ? (
        <PetServantModal
          isOpen
          onClose={() => catalog.selectPet(null)}
          pet={normalizePetStats(detail.data || catalog.selectedPet)}
          locale={currentLocale}
          strings={catalog.strings}
          roster={catalog.filteredServants}
          onSelectPet={(petId) => {
            const nextPet = catalog.filteredServants.find((item) => item.id === petId);
            if (nextPet) catalog.selectPet(nextPet);
          }}
          onSelectModuleFamily={(famId) => {
            catalog.setCategory('modules');
            const mod = catalog.allModuleFamilies.find(
              (m) => m.family_id.toLowerCase() === famId.toLowerCase() || m.id.toLowerCase() === famId.toLowerCase()
            );
            if (mod) catalog.selectModule(mod);
          }}
          moduleFamilies={catalog.allModuleFamilies}
        />
      ) : (
        <>
      {/* 3-Tier Composite Controls Bar with embedded ServerModeSwitcher */}
      <CatalogControls
        id="pets-controls-bar"
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
        entityLabel={isServants ? catalog.strings.servants : catalog.strings.modules}
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
        {/* Category Filter Tabs (Smart Servants vs Skill Modules) */}
        <FilterGroup
          label={catalog.strings.filterCategory}
          filterGroup="category"
          ariaLabel={catalog.strings.filterCategory}
        >
          <FilterChip
            value="servants"
            active={isServants}
            role="tab"
            className={styles.petCategoryChipServants}
            icon={<PetControlIcon kind="servants" />}
            onClick={() => catalog.setCategory('servants')}
          >
            {catalog.strings.categoryServants}
          </FilterChip>
          {catalog.serverMode !== 'mmo' && (
            <FilterChip
              value="modules"
              active={!isServants}
              role="tab"
              className={styles.petCategoryChipModules}
              icon={<PetControlIcon kind="modules" />}
              onClick={() => catalog.setCategory('modules')}
            >
              {catalog.strings.categoryModules}
            </FilterChip>
          )}
        </FilterGroup>

        {/* When Servants view is active: Element Filter */}
        {isServants && (
          <FilterGroup
            label={catalog.strings.filterElement}
            filterGroup="element"
            ariaLabel={catalog.strings.filterElement}
          >
            {PET_ELEMENT_FILTER_OPTIONS.map((elem) => {
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
        )}

        {/* When Modules view is active: Module Type Filter */}
        {!isServants && (
          <FilterGroup
            label={catalog.strings.filterModuleType}
            filterGroup="module-type"
            ariaLabel={catalog.strings.filterModuleType}
          >
            {PET_MODULE_TYPE_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.id}
                value={opt.id}
                active={catalog.moduleTypeFilter === opt.id}
                className={
                  opt.id === 'universal'
                    ? styles.petModuleChipUniversal
                    : opt.id === 'exclusive'
                      ? styles.petModuleChipExclusive
                      : undefined
                }
                icon={
                  opt.id === 'universal' ? (
                    <PetControlIcon kind="universal" />
                  ) : opt.id === 'exclusive' ? (
                    <PetControlIcon kind="exclusive" />
                  ) : undefined
                }
                onClick={() => catalog.setModuleTypeFilter(opt.id)}
              >
                {catalog.strings[opt.copyKey]}
              </FilterChip>
            ))}
          </FilterGroup>
        )}
      </CatalogControls>

      {/* Grid of Servants or Modules */}
      <EntityGrid
        columns="auto"
        gap="md"
        loading={isLoading && !effectiveData}
        empty={catalog.filteredCount === 0}
        emptyTitle={catalog.strings.emptyTitle}
        emptyDescription={catalog.strings.emptyDescription}
        emptyAction={
          catalog.hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={catalog.handleResetFilters}
            >
              {catalog.strings.resetFilters}
            </Button>
          ) : undefined
        }
        className={`${isServants ? '' : styles.moduleGrid} mt-6`}
      >
        {isServants
          ? catalog.filteredServants.map((servant) => (
              <PetServantCard
                key={servant.id}
                item={servant}
                locale={currentLocale}
                strings={catalog.strings}
                onSelect={() => catalog.selectPet(servant)}
              />
            ))
          : catalog.filteredModules.map((moduleFam) => (
              <PetModuleCard
                key={moduleFam.family_id || moduleFam.id}
                item={moduleFam}
                locale={currentLocale}
                strings={catalog.strings}
                onSelect={() => catalog.selectModule(moduleFam)}
                servants={catalog.allServants}
              />
            ))}
      </EntityGrid>
        </>
      )}

      {/* Module Detail Modal */}
      <PetModuleModal
        isOpen={Boolean(catalog.selectedModule)}
        onClose={() => catalog.selectModule(null)}
        module={catalog.selectedModule}
        locale={currentLocale}
        strings={catalog.strings}
        onSelectServant={(servantId) => {
          catalog.setCategory('servants');
          const s = catalog.allServants.find((item) => item.id.toLowerCase() === servantId.toLowerCase());
          if (s) catalog.selectPet(s);
        }}
        servants={catalog.allServants}
      />
    </div>
  );
};
