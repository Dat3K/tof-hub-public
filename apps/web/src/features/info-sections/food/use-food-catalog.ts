'use client';

import {setEntitySelection} from '../common/entity-url';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Locale } from '@tof-hub/i18n';
import { getStoredServerMode, setStoredServerMode } from '@tof-hub/ui';
import type { ServerMode } from '@tof-hub/ui';
import type {
  FoodDishItem,
  FoodIngredientItem,
  FoodPotionItem,
  FoodPotionSubcategory,
  FoodRarityFilter,
  FoodRecipeFilter,
  FoodViewTab,
} from './types';
import { getDefaultFoodSort, getFoodSortOptions } from './constants';
import { getFoodStrings } from './copy';
import { compareFoodEffectValues } from './sort-food';
import { useInfoDocumentTitle } from '../common/use-info-document-title';

/**
 * Gacha / MMO mode shared with the other Info catalogs: URL `?server=` first, then the server-parsed
 * initial, then the stored cross-page preference.
 */
export function useFoodServerMode(initialServerMode: ServerMode | null = null) {
  const [serverMode, setServerModeState] = useState<ServerMode>(initialServerMode ?? 'gacha');
  const initialServerModeRef = useRef(initialServerMode);

  useEffect(() => {
    if (typeof window === 'undefined' || initialServerModeRef.current) return;
    let next: ServerMode | null = null;
    try {
      const serverParam = new URLSearchParams(window.location.search).get('server');
      if (serverParam === 'mmo' || serverParam === 'gacha') next = serverParam;
    } catch {
      // Fall through to the stored preference on parse errors.
    }
    const resolved = next ?? getStoredServerMode('gacha');
    setServerModeState((prev) => (prev === resolved ? prev : resolved));
  }, []);

  const setServerMode = useCallback((mode: ServerMode) => {
    setServerModeState(mode);
    setStoredServerMode(mode);
  }, []);

  return [serverMode, setServerMode] as const;
}

interface UseFoodCatalogProps {
  initialData?: any;
  locale: Locale;
  serverMode?: ServerMode;
  initialTab?: FoodViewTab | null;
  initialSearchQuery?: string;
  initialRarity?: FoodRarityFilter | null;
  initialRecipe?: FoodRecipeFilter | null;
  initialPotionSubcategory?: FoodPotionSubcategory | null;
  initialEffects?: string[];
  initialSort?: string | null;
  initialSelectedItemId?: string | null;
}

const RARITY_ORDER: Record<string, number> = {
  N: 1,
  R: 2,
  SR: 3,
  GOLD: 5,
  SSR: 4,
};

const NUMERIC_EFFECT_IDS = new Set(['PhyAtk', 'PhyDef']);

function getSelectedNumericEffectId(selectedEffects: Set<string>): 'PhyAtk' | 'PhyDef' | null {
  for (const effect of selectedEffects) {
    if (NUMERIC_EFFECT_IDS.has(effect)) return effect as 'PhyAtk' | 'PhyDef';
  }
  return null;
}

export function useFoodCatalog({
  initialData,
  locale,
  serverMode = 'gacha',
  initialTab = null,
  initialSearchQuery = '',
  initialRarity = null,
  initialRecipe = null,
  initialPotionSubcategory = null,
  initialEffects = [],
  initialSort = null,
  initialSelectedItemId = null,
}: UseFoodCatalogProps) {
  const strings = useMemo(() => getFoodStrings(locale), [locale]);

  // Seed from the server-parsed URL params so shared links render the
  // selected tab/filters on the first paint instead of correcting after mount.
  const [activeTab, setActiveTabState] = useState<FoodViewTab>(initialTab ?? 'dishes');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [rarityFilter, setRarityFilter] = useState<FoodRarityFilter>(initialRarity ?? 'all');
  const [recipeFilter, setRecipeFilter] = useState<FoodRecipeFilter>(initialRecipe ?? 'all');
  const [potionSubcategory, setPotionSubcategory] = useState<FoodPotionSubcategory>(
    initialPotionSubcategory ?? 'all'
  );
  const [selectedEffects, setSelectedEffects] = useState<Set<string>>(() => new Set(initialEffects));
  const [sortValue, setSortValue] = useState(
    initialSort ?? getDefaultFoodSort(initialTab ?? 'dishes', serverMode)
  );
  // Read by updateUrl, so every handler keeps `?server=mmo` without threading the mode through.
  const serverModeRef = useRef(serverMode);
  serverModeRef.current = serverMode;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialSelectedItemId);

  const selectedNumericEffectId = getSelectedNumericEffectId(selectedEffects);
  const sortOptions = useMemo(
    () =>
      getFoodSortOptions(
        strings,
        activeTab,
        activeTab !== 'ingredients' && selectedNumericEffectId !== null,
        serverMode
      ),
    [strings, activeTab, selectedNumericEffectId, serverMode]
  );

  // Extract data pools
  const allDishes: FoodDishItem[] = useMemo(() => {
    if (!initialData) return [];
    return (initialData.items || initialData.dishes || []) as FoodDishItem[];
  }, [initialData]);

  const allIngredients: FoodIngredientItem[] = useMemo(() => {
    if (!initialData) return [];
    return (initialData.ingredients || []) as FoodIngredientItem[];
  }, [initialData]);

  const allPotions: FoodPotionItem[] = useMemo(() => {
    if (!initialData) return [];
    return (initialData.potions || []) as FoodPotionItem[];
  }, [initialData]);

  // Reconcile URL params and hash after mount. State is seeded from the
  // server-parsed params, so assignments only fire on disagreement.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';

      const viewParam = params.get('view');
      if (viewParam === 'ingredients' || viewParam === 'potions') {
        setActiveTabState((prev) => (prev === viewParam ? prev : viewParam));
      }

      const q = params.get('q') || params.get('search');
      if (q) {
        setSearchQuery((prev) => (prev === q ? prev : q));

        // A direct search link has no active tab yet. Prefer an exact item
        // match so links such as ?q=Honey open the ingredient list instead
        // of leaving the user on the default dishes tab.
        if (!viewParam) {
          const normalizedQuery = q.toLowerCase().trim();
          const matchesNameOrId = (
            items: Array<{ id: string; name_en?: string; name_ru?: string }>,
            exact: boolean
          ) =>
            items.some((item) =>
              [item.name_en, item.name_ru, item.id].some((value) => {
                const normalizedValue = value?.toLowerCase();
                return exact
                  ? normalizedValue === normalizedQuery
                  : Boolean(normalizedValue?.includes(normalizedQuery));
              })
            );

          const exactMatches = {
            dishes: matchesNameOrId(allDishes, true),
            ingredients: matchesNameOrId(allIngredients, true),
            potions: matchesNameOrId(allPotions, true),
          };

          const exactTab = (['ingredients', 'potions', 'dishes'] as const).find(
            (tab) => exactMatches[tab]
          );

          if (exactTab) {
            setActiveTabState((prev) => (prev === exactTab ? prev : exactTab));
          } else {
            const matchingTabs = (['dishes', 'ingredients', 'potions'] as const).filter((tab) => {
              const items = tab === 'dishes' ? allDishes : tab === 'ingredients' ? allIngredients : allPotions;
              return matchesNameOrId(items, false);
            });

            if (matchingTabs.length === 1) {
              setActiveTabState((prev) => (prev === matchingTabs[0] ? prev : matchingTabs[0]));
            }
          }
        }
      }

      const r = params.get('rarity');
      if (r && ['GOLD', 'SSR', 'SR', 'R', 'N'].includes(r.toUpperCase())) {
        const rarity = r.toUpperCase() as FoodRarityFilter;
        setRarityFilter((prev) => (prev === rarity ? prev : rarity));
      }

      const rec = params.get('recipe');
      if (rec === 'has-recipe' || rec === 'no-recipe') {
        setRecipeFilter((prev) => (prev === rec ? prev : rec));
      }

      const pSub = params.get('potionSub');
      if (pSub) {
        setPotionSubcategory((prev) => (prev === pSub ? prev : (pSub as FoodPotionSubcategory)));
      }

      const fx = params.get('effects') || params.get('effect');
      let parsedEffects = new Set<string>();
      if (fx) {
        const parts = fx.split(',').map((x) => x.trim());
        parsedEffects = new Set(parts.filter((p) => p !== 'all'));
        const list = Array.from(parsedEffects);
        setSelectedEffects((prev) =>
          prev.size === list.length && list.every((v) => prev.has(v)) ? prev : new Set(list)
        );
      }

      const sort = params.get('sort');
      const defaultTab = viewParam === 'ingredients' || viewParam === 'potions' ? viewParam : 'dishes';
      if (sort) {
        const nextSort = sort === 'default' ? getDefaultFoodSort(defaultTab, serverModeRef.current) : sort;
        setSortValue((prev) => (prev === nextSort ? prev : nextSort));
      } else if (getSelectedNumericEffectId(parsedEffects)) {
        setSortValue((prev) => (prev === 'effectDesc' ? prev : 'effectDesc'));
      } else {
        const nextSort = getDefaultFoodSort(defaultTab, serverModeRef.current);
        setSortValue((prev) => (prev === nextSort ? prev : nextSort));
      }

      // Deep link item by hash or id param
      const targetId = hash || params.get('item') || params.get('dish') || params.get('potion');
      if (targetId) {
        const matchDish = allDishes.find((d) => d.id.toLowerCase() === targetId.toLowerCase());
        if (matchDish) {
          setActiveTabState((prev) => (prev === 'dishes' ? prev : 'dishes'));
          setSelectedItemId((prev) => (prev === matchDish.id ? prev : matchDish.id));
          return;
        }

        const matchPotion = allPotions.find((p) => p.id.toLowerCase() === targetId.toLowerCase());
        if (matchPotion) {
          setActiveTabState((prev) => (prev === 'potions' ? prev : 'potions'));
          setSelectedItemId((prev) => (prev === matchPotion.id ? prev : matchPotion.id));
          return;
        }

        const matchIngredient = allIngredients.find((i) => i.id.toLowerCase() === targetId.toLowerCase());
        if (matchIngredient) {
          const ingredientQuery = matchIngredient.name_en || matchIngredient.name || matchIngredient.id;
          setActiveTabState((prev) => (prev === 'ingredients' ? prev : 'ingredients'));
          setSearchQuery((prev) => (prev === ingredientQuery ? prev : ingredientQuery));
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, [allDishes, allIngredients, allPotions]);

  // Sync popstate & hashchange listener for modal deep-linking & back navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHistoryChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
        const targetId = hash || params.get('item') || params.get('dish') || params.get('potion');
        if (!targetId) {
          setSelectedItemId((prev) => (prev ? null : prev));
          return;
        }

        const matchDish = allDishes.find((d) => d.id.toLowerCase() === targetId.toLowerCase());
        if (matchDish) {
          setActiveTabState('dishes');
          setSelectedItemId(matchDish.id);
          return;
        }

        const matchPotion = allPotions.find((p) => p.id.toLowerCase() === targetId.toLowerCase());
        if (matchPotion) {
          setActiveTabState('potions');
          setSelectedItemId(matchPotion.id);
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
  }, [allDishes, allPotions]);

  // Sync to URL
  const updateUrl = useCallback(
    (
      tab: FoodViewTab,
      query: string,
      rarity: FoodRarityFilter,
      recipe: FoodRecipeFilter,
      subcat: FoodPotionSubcategory,
      effects: Set<string>,
      sort: string,
      itemId: string | null
    ) => {
      if (typeof window === 'undefined' || !window.history?.replaceState) return;

      try {
        const url = new URL(window.location.href);

        if (serverModeRef.current === 'mmo') {
          url.searchParams.set('server', 'mmo');
        } else {
          url.searchParams.delete('server');
        }

        if (tab !== 'dishes') {
          url.searchParams.set('view', tab);
        } else {
          url.searchParams.delete('view');
        }

        if (query) {
          url.searchParams.set('q', query);
        } else {
          url.searchParams.delete('q');
        }

        if (rarity !== 'all') {
          url.searchParams.set('rarity', rarity);
        } else {
          url.searchParams.delete('rarity');
        }

        if (recipe !== 'all') {
          url.searchParams.set('recipe', recipe);
        } else {
          url.searchParams.delete('recipe');
        }

        if (subcat !== 'all') {
          url.searchParams.set('potionSub', subcat);
        } else {
          url.searchParams.delete('potionSub');
        }

        if (effects.size > 0) {
          url.searchParams.set('effects', Array.from(effects).join(','));
        } else {
          url.searchParams.delete('effects');
        }

        if (sort !== getDefaultFoodSort(tab, serverModeRef.current)) {
          url.searchParams.set('sort', sort);
        } else {
          url.searchParams.delete('sort');
        }

        const linkedIngredient = tab === 'ingredients'
          ? allIngredients.find(ingredient => ingredient.id === url.searchParams.get('item') &&
            [ingredient.id, ingredient.name_en, ingredient.name_ru, ingredient.name].includes(query))
          : undefined;
        setEntitySelection(url, 'item', itemId || linkedIngredient?.id || null);

        window.history.replaceState(null, '', url.toString());
      } catch {
        // Ignore
      }
    },
    [allIngredients]
  );

  // Filter Dishes
  const filteredDishes = useMemo(() => {
    let list = [...allDishes];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((dish) => {
        const nameEn = (dish.name_en || '').toLowerCase();
        const nameRu = (dish.name_ru || '').toLowerCase();
        const id = dish.id.toLowerCase();
        const effectEn = (dish.effect_text_en || '').toLowerCase();
        const effectRu = (dish.effect_text_ru || '').toLowerCase();
        const matchesIng = dish.recipe?.ingredients?.some(
          (ing) =>
            (ing.name_en && ing.name_en.toLowerCase().includes(q)) ||
            (ing.name_ru && ing.name_ru.toLowerCase().includes(q)) ||
            (ing.name && ing.name.toLowerCase().includes(q))
        );
        return (
          nameEn.includes(q) ||
          nameRu.includes(q) ||
          id.includes(q) ||
          effectEn.includes(q) ||
          effectRu.includes(q) ||
          matchesIng
        );
      });
    }

    if (rarityFilter !== 'all') {
      list = list.filter((d) => (d.rarity || 'N').toUpperCase() === rarityFilter);
    }

    if (recipeFilter === 'has-recipe') {
      list = list.filter((d) => Boolean(d.recipe?.ingredients && d.recipe.ingredients.length > 0));
    } else if (recipeFilter === 'no-recipe') {
      list = list.filter((d) => !Boolean(d.recipe?.ingredients && d.recipe.ingredients.length > 0));
    }

    if (selectedEffects.size > 0) {
      list = list.filter((d) => {
        const cats = d.categories || [];
        for (const effect of selectedEffects) {
          if (cats.includes(effect)) return true;
          if (effect === 'AddHealth' && d.has_heal) return true;
        }
        return false;
      });
    }

    // Sort Dishes
    list.sort((a, b) => {
      const rarA = RARITY_ORDER[(a.rarity || 'N').toUpperCase()] || 0;
      const rarB = RARITY_ORDER[(b.rarity || 'N').toUpperCase()] || 0;

      if (sortValue === 'qualityDesc') {
        const diff = rarB - rarA;
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      if (sortValue === 'cookLevelAsc' || sortValue === 'cookLevelDesc') {
        const diff =
          sortValue === 'cookLevelAsc'
            ? (a.cook_level ?? 0) - (b.cook_level ?? 0)
            : (b.cook_level ?? 0) - (a.cook_level ?? 0);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      if (sortValue === 'buffPercentDesc') {
        const satA = a.satiety || 0;
        const satB = b.satiety || 0;
        return satB - satA;
      }

      if (sortValue === 'buffPercentAsc') {
        const satA = a.satiety || 0;
        const satB = b.satiety || 0;
        return satA - satB;
      }

      if ((sortValue === 'effectDesc' || sortValue === 'effectAsc') && selectedNumericEffectId) {
        const diff = compareFoodEffectValues(
          a,
          b,
          selectedNumericEffectId,
          sortValue === 'effectDesc' ? 'desc' : 'asc'
        );
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      if (sortValue === 'nameAsc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameA.localeCompare(nameB);
      }

      if (sortValue === 'nameDesc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameB.localeCompare(nameA);
      }

      if (sortValue === 'idDesc') {
        return b.id.localeCompare(a.id, undefined, { numeric: true });
      }

      if (sortValue === 'idAsc') {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      // Legacy/default fallback: new defaults use release order.
      const diff = rarA - rarB;
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    return list;
  }, [
    allDishes,
    searchQuery,
    rarityFilter,
    recipeFilter,
    selectedEffects,
    selectedNumericEffectId,
    sortValue,
    locale,
  ]);

  // Filter Ingredients
  const filteredIngredients = useMemo(() => {
    let list = [...allIngredients];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((ing) => {
        const nameEn = (ing.name_en || '').toLowerCase();
        const nameRu = (ing.name_ru || '').toLowerCase();
        const id = ing.id.toLowerCase();
        const descEn = (ing.description_en || '').toLowerCase();
        const descRu = (ing.description_ru || '').toLowerCase();
        const matchesDish = ing.used_in?.some(
          (d) =>
            (d.name_en && d.name_en.toLowerCase().includes(q)) ||
            (d.name_ru && d.name_ru.toLowerCase().includes(q))
        );
        return (
          nameEn.includes(q) ||
          nameRu.includes(q) ||
          id.includes(q) ||
          descEn.includes(q) ||
          descRu.includes(q) ||
          matchesDish
        );
      });
    }

    if (rarityFilter !== 'all') {
      list = list.filter((i) => (i.rarity || 'N').toUpperCase() === rarityFilter);
    }

    // Sort Ingredients
    list.sort((a, b) => {
      if (sortValue === 'nameDesc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameB.localeCompare(nameA);
      }
      if (sortValue === 'idDesc') {
        return b.id.localeCompare(a.id, undefined, { numeric: true });
      }
      if (sortValue === 'idAsc') {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }
      // 'nameAsc' default for ingredients
      const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
      const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
      return nameA.localeCompare(nameB);
    });

    return list;
  }, [allIngredients, searchQuery, rarityFilter, sortValue, locale]);

  // Filter Potions
  const filteredPotions = useMemo(() => {
    let list = [...allPotions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const nameEn = (p.name_en || '').toLowerCase();
        const nameRu = (p.name_ru || '').toLowerCase();
        const id = p.id.toLowerCase();
        const descEn = (p.description_en || '').toLowerCase();
        const descRu = (p.description_ru || '').toLowerCase();
        const sub = (p.subcategory || '').toLowerCase();
        return (
          nameEn.includes(q) ||
          nameRu.includes(q) ||
          id.includes(q) ||
          descEn.includes(q) ||
          descRu.includes(q) ||
          sub.includes(q)
        );
      });
    }

    if (rarityFilter !== 'all') {
      list = list.filter((p) => (p.rarity || 'SSR').toUpperCase() === rarityFilter);
    }

    if (potionSubcategory !== 'all') {
      list = list.filter((p) => p.subcategory === potionSubcategory);
    }

    if (selectedEffects.size > 0) {
      list = list.filter((p) => {
        const cats = p.categories || [];
        for (const effect of selectedEffects) {
          if (cats.includes(effect)) return true;
        }
        return false;
      });
    }

    // Sort Potions
    list.sort((a, b) => {
      const rarA = RARITY_ORDER[(a.rarity || 'SSR').toUpperCase()] || 0;
      const rarB = RARITY_ORDER[(b.rarity || 'SSR').toUpperCase()] || 0;

      if (sortValue === 'qualityAsc') {
        const diff = rarA - rarB;
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      if (sortValue === 'durationDesc') {
        const durA = a.duration || 0;
        const durB = b.duration || 0;
        return durB - durA;
      }

      if (sortValue === 'durationAsc') {
        const durA = a.duration || 0;
        const durB = b.duration || 0;
        return durA - durB;
      }

      if ((sortValue === 'effectDesc' || sortValue === 'effectAsc') && selectedNumericEffectId) {
        const diff = compareFoodEffectValues(
          a,
          b,
          selectedNumericEffectId,
          sortValue === 'effectDesc' ? 'desc' : 'asc'
        );
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      if (sortValue === 'nameAsc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameA.localeCompare(nameB);
      }

      if (sortValue === 'nameDesc') {
        const nameA = locale === 'ru' ? a.name_ru || a.name_en || a.id : a.name_en || a.id;
        const nameB = locale === 'ru' ? b.name_ru || b.name_en || b.id : b.name_en || b.id;
        return nameB.localeCompare(nameA);
      }

      if (sortValue === 'idDesc') {
        return b.id.localeCompare(a.id, undefined, { numeric: true });
      }

      if (sortValue === 'idAsc') {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      if (sortValue === 'qualityDesc') {
        const diff = rarB - rarA;
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      // Legacy/default fallback: new defaults use release order.
      const diff = rarB - rarA;
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    return list;
  }, [
    allPotions,
    searchQuery,
    rarityFilter,
    potionSubcategory,
    selectedEffects,
    selectedNumericEffectId,
    sortValue,
    locale,
  ]);

  // Active counts
  const filteredCount =
    activeTab === 'dishes'
      ? filteredDishes.length
      : activeTab === 'ingredients'
      ? filteredIngredients.length
      : filteredPotions.length;

  const totalCount =
    activeTab === 'dishes'
      ? allDishes.length
      : activeTab === 'ingredients'
      ? allIngredients.length
      : allPotions.length;

  const hasActiveFilters = useMemo(() => {
    return (
      activeTab !== 'dishes' ||
      searchQuery.trim().length > 0 ||
      rarityFilter !== 'all' ||
      recipeFilter !== 'all' ||
      potionSubcategory !== 'all' ||
      selectedEffects.size > 0 ||
      sortValue !== getDefaultFoodSort(activeTab, serverMode)
    );
  }, [activeTab, searchQuery, rarityFilter, recipeFilter, potionSubcategory, selectedEffects, sortValue, serverMode]);

  // Handlers
  const handleTabChange = useCallback(
    (tab: FoodViewTab) => {
      setActiveTabState(tab);
      const nextSort =
        tab !== 'ingredients' && selectedNumericEffectId ? 'effectDesc' : getDefaultFoodSort(tab, serverMode);
      setSortValue(nextSort);
      updateUrl(
        tab,
        searchQuery,
        rarityFilter,
        recipeFilter,
        potionSubcategory,
        selectedEffects,
        nextSort,
        selectedItemId
      );
    },
    [
      searchQuery,
      rarityFilter,
      recipeFilter,
      potionSubcategory,
      selectedEffects,
      selectedNumericEffectId,
      selectedItemId,
      serverMode,
      updateUrl,
    ]
  );

  const handleSearchChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      updateUrl(
        activeTab,
        q,
        rarityFilter,
        recipeFilter,
        potionSubcategory,
        selectedEffects,
        sortValue,
        selectedItemId
      );
    },
    [activeTab, rarityFilter, recipeFilter, potionSubcategory, selectedEffects, sortValue, selectedItemId, updateUrl]
  );

  const handleRarityChange = useCallback(
    (r: FoodRarityFilter) => {
      setRarityFilter(r);
      updateUrl(
        activeTab,
        searchQuery,
        r,
        recipeFilter,
        potionSubcategory,
        selectedEffects,
        sortValue,
        selectedItemId
      );
    },
    [activeTab, searchQuery, recipeFilter, potionSubcategory, selectedEffects, sortValue, selectedItemId, updateUrl]
  );

  const handleRecipeChange = useCallback(
    (rec: FoodRecipeFilter) => {
      setRecipeFilter(rec);
      updateUrl(
        activeTab,
        searchQuery,
        rarityFilter,
        rec,
        potionSubcategory,
        selectedEffects,
        sortValue,
        selectedItemId
      );
    },
    [activeTab, searchQuery, rarityFilter, potionSubcategory, selectedEffects, sortValue, selectedItemId, updateUrl]
  );

  const handlePotionSubcategoryChange = useCallback(
    (subcat: FoodPotionSubcategory) => {
      setPotionSubcategory(subcat);
      updateUrl(
        activeTab,
        searchQuery,
        rarityFilter,
        recipeFilter,
        subcat,
        selectedEffects,
        sortValue,
        selectedItemId
      );
    },
    [activeTab, searchQuery, rarityFilter, recipeFilter, selectedEffects, sortValue, selectedItemId, updateUrl]
  );

  const toggleEffect = useCallback(
    (effect: string) => {
      const next = new Set(selectedEffects);
      if (effect === 'all') {
        next.clear();
      } else if (next.has(effect)) {
        next.delete(effect);
      } else {
        next.add(effect);
      }

      const nextNumericEffectId = getSelectedNumericEffectId(next);
      const nextSort =
        activeTab !== 'ingredients' && nextNumericEffectId
          ? 'effectDesc'
          : sortValue === 'effectDesc' || sortValue === 'effectAsc'
          ? getDefaultFoodSort(activeTab, serverMode)
          : sortValue;

      setSelectedEffects(next);
      setSortValue(nextSort);
      updateUrl(
        activeTab,
        searchQuery,
        rarityFilter,
        recipeFilter,
        potionSubcategory,
        next,
        nextSort,
        selectedItemId
      );
    },
    [
      activeTab,
      searchQuery,
      rarityFilter,
      recipeFilter,
      potionSubcategory,
      selectedEffects,
      sortValue,
      selectedItemId,
      serverMode,
      updateUrl,
    ]
  );

  const handleSortChange = useCallback(
    (val: string) => {
      setSortValue(val);
      updateUrl(
        activeTab,
        searchQuery,
        rarityFilter,
        recipeFilter,
        potionSubcategory,
        selectedEffects,
        val,
        selectedItemId
      );
    },
    [activeTab, searchQuery, rarityFilter, recipeFilter, potionSubcategory, selectedEffects, selectedItemId, updateUrl]
  );

  const handleSelectItem = useCallback(
    (id: string | null) => {
      setSelectedItemId(id);
      updateUrl(
        activeTab,
        searchQuery,
        rarityFilter,
        recipeFilter,
        potionSubcategory,
        selectedEffects,
        sortValue,
        id
      );
    },
    [activeTab, searchQuery, rarityFilter, recipeFilter, potionSubcategory, selectedEffects, sortValue, updateUrl]
  );

  const handleResetFilters = useCallback(() => {
    const defaultSort = getDefaultFoodSort('dishes', serverMode);
    setActiveTabState('dishes');
    setSearchQuery('');
    setRarityFilter('all');
    setRecipeFilter('all');
    setPotionSubcategory('all');
    setSelectedEffects(new Set());
    setSortValue(defaultSort);
    setSelectedItemId(null);
    updateUrl('dishes', '', 'all', 'all', 'all', new Set(), defaultSort, null);
  }, [serverMode, updateUrl]);

  // Gacha and MMO ids differ (mmo_ prefix): a mode switch closes the detail, keeps the tab and
  // filters, and moves a default or unavailable sort to the new mode's default.
  const previousServerModeRef = useRef(serverMode);
  useEffect(() => {
    const previousMode = previousServerModeRef.current;
    if (previousMode === serverMode) return;
    previousServerModeRef.current = serverMode;
    const nextSort =
      sortValue === getDefaultFoodSort(activeTab, previousMode) ||
      !getFoodSortOptions(strings, activeTab, true, serverMode).some((option) => option.value === sortValue)
        ? getDefaultFoodSort(activeTab, serverMode)
        : sortValue;
    setSelectedItemId(null);
    setSortValue(nextSort);
    updateUrl(activeTab, searchQuery, rarityFilter, recipeFilter, potionSubcategory, selectedEffects, nextSort, null);
  }, [
    serverMode,
    activeTab,
    searchQuery,
    rarityFilter,
    recipeFilter,
    potionSubcategory,
    selectedEffects,
    sortValue,
    strings,
    updateUrl,
  ]);

  // Selected Item entity
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    const target = selectedItemId.toLowerCase();
    const dish = allDishes.find((d) => d.id.toLowerCase() === target);
    if (dish) return dish;
    const potion = allPotions.find((p) => p.id.toLowerCase() === target);
    if (potion) return potion;
    return null;
  }, [selectedItemId, allDishes, allPotions]);
  const selectedItemName = selectedItem
    ? locale === 'ru'
      ? selectedItem.name_ru || selectedItem.name || selectedItem.name_en
      : selectedItem.name_en || selectedItem.name
    : null;
  useInfoDocumentTitle(strings.title, selectedItemName || null);

  return {
    strings,
    sortOptions,
    activeTab,
    setActiveTab: handleTabChange,
    searchQuery,
    setSearchQuery: handleSearchChange,
    rarityFilter,
    setRarityFilter: handleRarityChange,
    recipeFilter,
    setRecipeFilter: handleRecipeChange,
    potionSubcategory,
    setPotionSubcategory: handlePotionSubcategoryChange,
    selectedEffects,
    toggleEffect,
    sortValue,
    setSortValue: handleSortChange,
    filteredDishes,
    filteredIngredients,
    filteredPotions,
    allDishes,
    allIngredients,
    allPotions,
    filteredCount,
    totalCount,
    hasActiveFilters,
    handleResetFilters,
    selectedItem,
    selectedItemId,
    selectItem: handleSelectItem,
  };
}
