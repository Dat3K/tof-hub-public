'use client';

import { translateUiText } from '@tof-hub/i18n';
import React, { useCallback } from 'react';
import {
  CatalogControls,
  LoadingState,
  FilterGroup,
  FilterChip,
  Button,
  ServerModeSwitcher,
} from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { useI18n } from '@/lib/i18n';
import { useFoodData, useFoodMmoData } from '@/lib/game-data-client';
import type { Locale } from '@tof-hub/i18n';
import type { FoodCatalogViewProps } from './types';
import {
  FOOD_RARITY_OPTIONS,
  FOOD_POTION_SUBCATEGORY_OPTIONS,
  FOOD_EFFECT_FILTER_OPTIONS,
} from './constants';
import { useFoodCatalog, useFoodServerMode } from './use-food-catalog';
import { useServerModeLoading } from '../common/use-server-mode-loading';
import { FoodDishCard } from './food-dish-card';
import { FoodIngredientCard } from './food-ingredient-card';
import { FoodPotionCard } from './food-potion-card';
import { FoodDetailModal } from './food-detail-modal';
import styles from './food.module.css';

export const FoodCatalogView: React.FC<FoodCatalogViewProps> = ({
  initialData,
  initialMmoData,
  initialServerMode = null,
  initialLocale = 'en',
  initialTab = null,
  initialSearchQuery = '',
  initialRarity = null,
  initialRecipe = null,
  initialPotionSubcategory = null,
  initialEffects = [],
  initialSort = null,
  initialSelectedItemId = null,
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;

  const { data: dataset, isLoading } = useFoodData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const [serverMode, setServerMode] = useFoodServerMode(initialServerMode);
  const isMmo = serverMode === 'mmo';

  // The MMO dataset is a separate generated file, fetched the first time MMO is selected.
  const { data: mmoDataset } = useFoodMmoData({
    initialData: initialMmoData ?? undefined,
    locale: currentLocale,
    enabled: isMmo || Boolean(initialMmoData),
  });

  const gachaData = dataset || initialData || null;
  const mmoData = mmoDataset || initialMmoData || null;
  const effectiveData = isMmo ? mmoData : gachaData;

  const { isLoading: isModeLoading, startLoading: startModeLoading } = useServerModeLoading({
    mode: serverMode,
    modeDataReady: Boolean(effectiveData),
  });

  const handleServerModeChange = useCallback(
    (mode: typeof serverMode) => {
      startModeLoading(mode);
      setServerMode(mode);
    },
    [setServerMode, startModeLoading]
  );

  const catalog = useFoodCatalog({
    initialData: effectiveData,
    locale: currentLocale,
    serverMode,
    initialTab,
    initialSearchQuery,
    initialRarity,
    initialRecipe,
    initialPotionSubcategory,
    initialEffects,
    initialSort,
    initialSelectedItemId,
  });

  const isDishes = catalog.activeTab === 'dishes';
  const isIngredients = catalog.activeTab === 'ingredients';
  const isPotions = catalog.activeTab === 'potions';

  const handleCloseDetail = useCallback(() => {
    catalog.selectItem(null);
  }, [catalog.selectItem]);

  if (isLoading && !gachaData && !isMmo) {
    return <LoadingState fullPage message={catalog.strings.loading} />;
  }

  if (isModeLoading || (isMmo && !mmoData)) {
    return <LoadingState fullPage message={catalog.strings.loadingMmo} />;
  }

  return (
    <div
      className={`info-ui info-catalog food-catalog-page ${styles.foodContainer} ${
        isIngredients ? styles.ingredientsView : ''
      }`}
    >
      {/* Screen reader accessible heading matching outline */}
      <h1 className={styles.srOnly}>{catalog.strings.title}</h1>

      {/* 3-Tier Composite Controls Bar from Shared UI */}
      <CatalogControls
        id="food-controls-bar"
        searchQuery={catalog.searchQuery}
        onSearchChange={catalog.setSearchQuery}
        searchPlaceholder={catalog.strings.searchPlaceholder}
        searchSlot={
          <div className={styles.foodSearchAccessory}>
            <FilterGroup
              label={catalog.strings.filterRarity}
              filterGroup="rarity"
              ariaLabel={catalog.strings.filterRarity}
            >
              {FOOD_RARITY_OPTIONS.filter(opt => opt.id !== 'GOLD' || isMmo).map((opt) => (
                <FilterChip
                  key={opt.id}
                  value={opt.id}
                  variant={opt.variant}
                  className={styles.foodRarityFilter}
                  active={catalog.rarityFilter === opt.id}
                  onClick={() => catalog.setRarityFilter(opt.id)}
                >
                  {opt.id === 'GOLD' ? translateUiText('Gold', currentLocale) : opt.label}
                </FilterChip>
              ))}
            </FilterGroup>
            <ServerModeSwitcher value={serverMode} onChange={handleServerModeChange} ariaLabel={translateUiText('Server Mode', activeLocale)} />
          </div>
        }
        sortValue={catalog.sortValue}
        onSortChange={catalog.setSortValue}
        sortOptions={catalog.sortOptions}
        sortLabel={catalog.strings.sortBy}
        count={catalog.filteredCount}
        total={catalog.totalCount}
        entityLabel={
          isDishes
            ? catalog.strings.recipes
            : isIngredients
            ? catalog.strings.ingredientsCount
            : catalog.strings.potionsCount
        }
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
        {/* Category Tabs: Dishes, Potions, Ingredients */}
        <FilterGroup
          label={catalog.strings.filterCategory}
          className="self-start"
          filterGroup="category"
          ariaLabel={catalog.strings.filterCategory}
        >
          <FilterChip
            value="dishes"
            variant="attack"
            active={isDishes}
            onClick={() => catalog.setActiveTab('dishes')}
          >
            {catalog.strings.tabDishes} ({catalog.allDishes.length})
          </FilterChip>
          <FilterChip
            value="potions"
            variant="assist"
            active={isPotions}
            onClick={() => catalog.setActiveTab('potions')}
          >
            {catalog.strings.tabPotions} ({catalog.allPotions.length})
          </FilterChip>
          <FilterChip
            value="ingredients"
            variant="function"
            active={isIngredients}
            onClick={() => catalog.setActiveTab('ingredients')}
          >
            {catalog.strings.tabIngredients} ({catalog.allIngredients.length})
          </FilterChip>
        </FilterGroup>

        {/* Effect Strip Filters (applicable to dishes and potions) */}
        {!isIngredients && (
          <FilterGroup
            label={catalog.strings.filterEffects}
            layout="flow"
            filterGroup="effects"
            ariaLabel={catalog.strings.filterEffects}
          >
            <FilterChip
              value="all"
              active={catalog.selectedEffects.size === 0}
              onClick={() => catalog.toggleEffect('all')}
            >
              {catalog.strings.allEffects}
            </FilterChip>

            {FOOD_EFFECT_FILTER_OPTIONS.map((fx) => {
              const isActive = catalog.selectedEffects.has(fx.id);
              const fullLabel = currentLocale === 'ru' ? fx.labelRu : translateUiText(fx.labelEn, currentLocale);
              const shortLabel = currentLocale === 'ru' ? fx.shortLabelRu : translateUiText(fx.shortLabelEn, currentLocale);

              return (
                <FilterChip
                  key={fx.id}
                  value={fx.id}
                  variant={fx.variant}
                  active={isActive}
                  icon={gameAsset(fx.iconPath)}
                  iconAlt=""
                  title={fullLabel}
                  onClick={() => catalog.toggleEffect(fx.id)}
                >
                  <span aria-hidden="true">{shortLabel}</span>
                  <span className="sr-only">{fullLabel}</span>
                </FilterChip>
              );
            })}
          </FilterGroup>
        )}

        {/* Potion type: its own row under the effect filters */}
        {isPotions && (
          <FilterGroup
            label={catalog.strings.filterSubcategory}
            className="basis-full"
            filterGroup="potion-sub"
            ariaLabel={catalog.strings.filterSubcategory}
          >
            {FOOD_POTION_SUBCATEGORY_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.id}
                value={opt.id}
                variant={opt.variant}
                active={catalog.potionSubcategory === opt.id}
                onClick={() => catalog.setPotionSubcategory(opt.id)}
              >
                {catalog.strings[opt.copyKey]}
              </FilterChip>
            ))}
          </FilterGroup>
        )}
      </CatalogControls>

      {/* One board (as Ranking): the column header and the rows share a panel. */}
      <div className={styles.board}>
      {/* 3-Column Table Header */}
      <div className={styles.tableHeader} role="row">
        <div className={styles.colItem}>
          {isDishes
            ? catalog.strings.colItem
            : isIngredients
            ? catalog.strings.colIngredient
            : catalog.strings.colPotion}
        </div>
        <div className={styles.colEffect}>
          {isDishes
            ? catalog.strings.colEffect
            : isIngredients
            ? catalog.strings.colSources
            : catalog.strings.colEffect}
        </div>
        <div className={styles.colRecipe}>
          {isDishes
            ? catalog.strings.colRecipe
            : isIngredients
            ? catalog.strings.colUsedIn
            : catalog.strings.colPotionType}
        </div>
      </div>

      {/* Cards List or Empty State */}
      {catalog.filteredCount === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-white/70 text-base mb-4">
            {isDishes
              ? catalog.strings.noMatches
              : isIngredients
              ? catalog.strings.noIngredients
              : catalog.strings.noPotions}
          </p>
          {catalog.hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={catalog.handleResetFilters}
            >
              {catalog.strings.resetFilters}
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.cardsList} role="list">
          {isDishes &&
            catalog.filteredDishes.map((dish) => (
              <FoodDishCard
                key={dish.id}
                item={dish}
                locale={currentLocale}
                strings={catalog.strings}
                onSelect={(d) => catalog.selectItem(d.id)}
                onSelectIngredient={(ingName) => {
                  catalog.setActiveTab('ingredients');
                  catalog.setSearchQuery(ingName);
                }}
              />
            ))}

          {isIngredients &&
            catalog.filteredIngredients.map((ing) => (
              <FoodIngredientCard
                key={ing.id}
                item={ing}
                locale={currentLocale}
                strings={catalog.strings}
                onSelectDish={(dishId) => {
                  catalog.setActiveTab('dishes');
                  catalog.selectItem(dishId);
                }}
              />
            ))}

          {isPotions &&
            catalog.filteredPotions.map((potion) => (
              <FoodPotionCard
                key={potion.id}
                item={potion}
                locale={currentLocale}
                strings={catalog.strings}
                onSelect={(p) => catalog.selectItem(p.id)}
              />
            ))}
        </div>
      )}
      </div>

      {/* Food Detail Modal for Dishes and Potions */}
      <FoodDetailModal
        isOpen={Boolean(catalog.selectedItem)}
        onClose={handleCloseDetail}
        item={catalog.selectedItem}
        locale={currentLocale}
        strings={catalog.strings}
        onSelectIngredient={(ingName) => {
          catalog.setActiveTab('ingredients');
          catalog.setSearchQuery(ingName);
        }}
      />
    </div>
  );
};
