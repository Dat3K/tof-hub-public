import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMatricesCatalog } from './matrices/use-matrices-catalog';
import { useRelicsCatalog } from './relics/use-relics-catalog';
import { useFoodCatalog } from './food/use-food-catalog';
import { useSimulacraCatalog } from '../simulacra/use-simulacra-catalog';

describe('Catalog URL initials: server-parsed filters apply on first paint', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      // No query params: proves the seeded initials alone drive the state,
      // without the mount effect correcting anything afterwards.
      window.history.replaceState(null, '', '/info');
      window.localStorage.clear();
    }
  });

  it('matrices: seeded search filters the grid immediately', () => {
    const data: any = {
      items: [
        {
          id: 'suit_SSR20',
          name: 'Saki Fuwa Matrix',
          name_en: 'Saki Fuwa Matrix',
          carriers: [{ element: 'Frost', role: 'Defense' }],
        },
        {
          id: 'suit_SSR30',
          name: 'Fenrir Matrix',
          name_en: 'Fenrir Matrix',
          carriers: [{ element: 'Volt', role: 'DPS' }],
        },
      ],
    };
    const { result } = renderHook(() =>
      useMatricesCatalog({ initialData: data, locale: 'en', initialSearchQuery: 'fenrir' })
    );

    expect(result.current.searchQuery).toBe('fenrir');
    expect(result.current.filteredItems.map((m) => m.id)).toEqual(['suit_SSR30']);
  });

  it('relics: seeded mmo mode resolves the mmo pool and relic at once', () => {
    const data: any = {
      gacha: [{ id: 'relic_a', name_en: 'Relic A' }],
      mmo: [{ id: 'relic_b-mmo', name_en: 'Relic B' }],
    };
    const { result } = renderHook(() =>
      useRelicsCatalog({
        initialData: data,
        locale: 'en',
        initialServerMode: 'mmo',
        initialSelectedRelicId: 'relic_b-mmo',
      })
    );

    expect(result.current.serverMode).toBe('mmo');
    expect(result.current.totalCount).toBe(1);
    expect(result.current.selectedRelic?.id).toBe('relic_b-mmo');
  });

  it('food: seeded tab opens potions without a mount correction', () => {
    const data: any = {
      dishes: [{ id: 'dish_1', name_en: 'Spicy Burger' }],
      potions: [{ id: 'potion_1', name_en: 'Enhancement Serum' }],
    };
    const { result } = renderHook(() =>
      useFoodCatalog({ initialData: data, locale: 'en', initialTab: 'potions' })
    );

    expect(result.current.activeTab).toBe('potions');
  });

  it('food: mmo mode sorts dishes by cooking level and keeps ?server=mmo', () => {
    const data: any = {
      items: [
        { id: 'mmo_Item_Cooking_2', name_en: 'High', cook_level: 18 },
        { id: 'mmo_Item_Cooking_1', name_en: 'Low', cook_level: 1 },
      ],
    };
    const { result } = renderHook(() =>
      useFoodCatalog({
        initialData: data,
        locale: 'en',
        serverMode: 'mmo',
        initialSelectedItemId: 'mmo_Item_Cooking_2',
      })
    );

    expect(result.current.sortValue).toBe('cookLevelAsc');
    expect(result.current.filteredDishes.map((dish) => dish.id)).toEqual([
      'mmo_Item_Cooking_1',
      'mmo_Item_Cooking_2',
    ]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.selectedItem?.id).toBe('mmo_Item_Cooking_2');

    result.current.setSearchQuery('low');
    expect(new URL(window.location.href).searchParams.get('server')).toBe('mmo');
  });

  it('food: switching the server mode closes the detail and resets the mode default sort', () => {
    const data: any = { items: [{ id: 'dish_1', name_en: 'Dish', cook_level: 3 }] };
    const { result, rerender } = renderHook(
      ({ serverMode }: { serverMode: 'gacha' | 'mmo' }) =>
        useFoodCatalog({ initialData: data, locale: 'en', serverMode, initialSelectedItemId: 'dish_1' }),
      { initialProps: { serverMode: 'gacha' } }
    );

    expect(result.current.sortValue).toBe('buffPercentDesc');
    rerender({ serverMode: 'mmo' });

    expect(result.current.sortValue).toBe('cookLevelAsc');
    expect(result.current.selectedItemId).toBeNull();
    expect(new URL(window.location.href).searchParams.get('server')).toBe('mmo');
  });

  it('simulacra: seeded mmo mode resolves the mmo character at once', () => {
    const data: any = {
      gacha: [{ id: 'zoey', name_en: 'Zoey' }],
      mmo: [{ id: 'zoey-mmo', name_en: 'Zoey', server_mode: 'mmo' }],
    };
    const { result } = renderHook(() =>
      useSimulacraCatalog({
        initialData: data,
        locale: 'en',
        initialServerMode: 'mmo',
        initialSelectedCharId: 'zoey-mmo',
      })
    );

    expect(result.current.serverMode).toBe('mmo');
    expect(result.current.selectedCharacter?.id).toBe('zoey-mmo');
  });
});
