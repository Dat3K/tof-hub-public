import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatricesCatalog } from './matrices/use-matrices-catalog';
import { useRelicsCatalog } from './relics/use-relics-catalog';
import { usePetsCatalog } from './pets/use-pets-catalog';
import { useFoodCatalog } from './food/use-food-catalog';
import { useCosmeticsCatalog } from './cosmetics/use-cosmetics-catalog';
import { useArtsCatalog } from './arts/use-arts-catalog';

describe('Info Sections Catalog Filter, Search & Sort Logic', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/info');
      window.localStorage.clear();
    }
  });

  describe('1. Matrices Catalog Filter & Search Logic', () => {
    const mockMatricesData: any = {
      schemaVersion: 1,
      total: 3,
      items: [
        {
          id: 'suit_SSR20',
          suit_id: 'suit_SSR20',
          name: 'Saki Fuwa Matrix',
          name_en: 'Saki Fuwa Matrix',
          name_ru: 'Матрица Саки Фува',
          rarity: 'SSR',
          carriers: [{ element: 'Frost', role: 'Defense', char_name_en: 'Saki Fuwa' }],
          suit_num: 20,
          hash: 'saki-matrix',
        },
        {
          id: 'suit_SSR30',
          suit_id: 'suit_SSR30',
          name: 'Fenrir Matrix',
          name_en: 'Fenrir Matrix',
          name_ru: 'Матрица Фенрир',
          rarity: 'SSR',
          carriers: [{ element: 'Volt', role: 'DPS', char_name_en: 'Fenrir' }],
          suit_num: 30,
          hash: 'fenrir-matrix',
        },
        {
          id: 'suit_SSR15',
          suit_id: 'suit_SSR15',
          name: 'Coco Ritter Matrix',
          name_en: 'Coco Ritter Matrix',
          name_ru: 'Матрица Коко Риттер',
          rarity: 'SSR',
          carriers: [{ element: 'Frost', role: 'Support', char_name_en: 'Coco Ritter' }],
          suit_num: 15,
          hash: 'coco-matrix',
        },
      ],
    };

    it('filters matrices by element (Frost)', () => {
      const { result } = renderHook(() =>
        useMatricesCatalog({ initialData: mockMatricesData, locale: 'en' })
      );

      expect(result.current.filteredItems.length).toBe(3);

      act(() => {
        result.current.toggleElement('frost');
      });

      expect(result.current.filteredItems.length).toBe(2);
      const ids = result.current.filteredItems.map((m) => m.id);
      expect(ids).toContain('suit_SSR20');
      expect(ids).toContain('suit_SSR15');
      expect(ids).not.toContain('suit_SSR30');
    });

    it('filters matrices by search query', () => {
      const { result } = renderHook(() =>
        useMatricesCatalog({ initialData: mockMatricesData, locale: 'en' })
      );

      act(() => {
        result.current.setSearchQuery('fenrir');
      });

      expect(result.current.filteredItems.length).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('suit_SSR30');
    });

    it('sorts matrices by release order descending (id_desc)', () => {
      const { result } = renderHook(() =>
        useMatricesCatalog({ initialData: mockMatricesData, locale: 'en' })
      );

      act(() => {
        result.current.setSortValue('id_desc');
      });

      // Suit nums from ID: 30 (Fenrir) > 20 (Saki) > 15 (Coco)
      const ids = result.current.filteredItems.map((m) => m.id);
      expect(ids).toEqual(['suit_SSR30', 'suit_SSR20', 'suit_SSR15']);
    });

    it('resets matrix filters cleanly', () => {
      const { result } = renderHook(() =>
        useMatricesCatalog({ initialData: mockMatricesData, locale: 'en' })
      );

      act(() => {
        result.current.toggleElement('volt');
        result.current.setSearchQuery('fenrir');
      });
      expect(result.current.hasActiveFilters).toBe(true);

      act(() => {
        result.current.handleResetFilters();
      });

      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.filteredItems.length).toBe(3);
    });
  });

  describe('2. Relics Catalog Filter, Search & Server Mode Logic', () => {
    const mockRelicsData: any = {
      schemaVersion: 1,
      total: 3,
      gacha: [
        {
          id: 'relic_ssr_1',
          name: 'Omnium Shield',
          name_en: 'Omnium Shield',
          name_ru: 'Омниум Щит',
          rarity: 'SSR',
          quality: 5,
          server_mode: 'gacha',
          property: 'def',
          cooldown: 90,
        },
        {
          id: 'relic_sr_1',
          name: 'Jetpack',
          name_en: 'Jetpack',
          name_ru: 'Реактивный Ранец',
          rarity: 'SR',
          quality: 4,
          server_mode: 'gacha',
          property: 'utility',
          cooldown: 0,
        },
      ],
      mmo: [
        {
          id: 'relic_ssr_1_mmo',
          name: 'Omnium Shield (MMO)',
          name_en: 'Omnium Shield (MMO)',
          name_ru: 'Омниум Щит (MMO)',
          rarity: 'SSR',
          quality: 5,
          server_mode: 'mmo',
          property: 'def',
          cooldown: 60,
        },
      ],
    };

    it('switches between Gacha and MMO pools', () => {
      const { result } = renderHook(() =>
        useRelicsCatalog({ initialData: mockRelicsData, locale: 'en' })
      );

      expect(result.current.serverMode).toBe('gacha');
      expect(result.current.filteredItems.length).toBe(2);

      act(() => {
        result.current.setServerMode('mmo');
      });

      expect(result.current.serverMode).toBe('mmo');
      expect(result.current.filteredItems.length).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('relic_ssr_1_mmo');
    });

    it('filters relics by property', () => {
      const { result } = renderHook(() =>
        useRelicsCatalog({ initialData: mockRelicsData, locale: 'en' })
      );

      act(() => {
        result.current.toggleProperty('def' as any);
      });

      expect(result.current.filteredItems.length).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('relic_ssr_1');
    });

    it('searches relics by English and Russian names', () => {
      const { result } = renderHook(() =>
        useRelicsCatalog({ initialData: mockRelicsData, locale: 'en' })
      );

      act(() => {
        result.current.setSearchQuery('Jetpack');
      });
      expect(result.current.filteredItems.length).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('relic_sr_1');

      act(() => {
        result.current.setSearchQuery('Ранец');
      });
      expect(result.current.filteredItems.length).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('relic_sr_1');
    });
  });

  describe('3. Pets Catalog Filter & Category Tabs Logic', () => {
    const mockPetsData: any = {
      schemaVersion: 1,
      items: [
        {
          id: 'pet_1',
          name: 'Mia',
          name_en: 'Mia',
          name_ru: 'Миа',
          category: 'combat',
          element: 'Frost',
          rarity: 'SSR',
          quality: 5,
        },
        {
          id: 'pet_2',
          name: 'Angela',
          name_en: 'Angela',
          name_ru: 'Анджела',
          category: 'combat',
          element: 'Flame',
          rarity: 'SR',
          quality: 4,
        },
      ],
      module_families: [
        {
          family_id: 'fam_1',
          id: 'fam_1',
          name: 'Attack Module',
          name_en: 'Attack Module',
          name_ru: 'Атакующий Модуль',
          type: 'attack',
        },
      ],
    };

    it('switches between servants and modules tabs', () => {
      const { result } = renderHook(() =>
        usePetsCatalog({ initialData: mockPetsData, locale: 'en' })
      );

      expect(result.current.category).toBe('servants');
      expect(result.current.filteredServants.length).toBe(2);

      act(() => {
        result.current.setCategory('modules');
      });

      expect(result.current.category).toBe('modules');
      expect(result.current.filteredModules.length).toBe(1);
    });

    it('filters combat servants by element', () => {
      const { result } = renderHook(() =>
        usePetsCatalog({ initialData: mockPetsData, locale: 'en' })
      );

      act(() => {
        result.current.toggleElement('frost');
      });

      expect(result.current.filteredServants.length).toBe(1);
      expect(result.current.filteredServants[0].id).toBe('pet_1');
    });
  });

  describe('4. Food Catalog Filter & View Tabs Logic', () => {
    const mockFoodData: any = {
      schemaVersion: 1,
      items: [
        {
          id: 'dish_1',
          name: 'Braised Meat',
          name_en: 'Braised Meat',
          name_ru: 'Тушеное мясо',
          rarity: 'SR',
          recipe: { ingredients: [{ id: 'ing_meat', amount: 2 }] },
          satiety: 20,
        },
        {
          id: 'dish_2',
          name: 'Fried Rice',
          name_en: 'Fried Rice',
          name_ru: 'Жареный рис',
          rarity: 'R',
          recipe: null,
          satiety: 10,
        },
      ],
      ingredients: [
        {
          id: 'ing_meat',
          name: 'Prime Meat',
          name_en: 'Prime Meat',
          name_ru: 'Отборное мясо',
          rarity: 'SR',
        },
      ],
      potions: [
        {
          id: 'potion_1',
          name: 'Health Potion',
          name_en: 'Health Potion',
          name_ru: 'Зелье здоровья',
          rarity: 'R',
        },
      ],
    };

    it('switches tabs across dishes, ingredients, and potions', () => {
      const { result } = renderHook(() =>
        useFoodCatalog({ initialData: mockFoodData, locale: 'en' })
      );

      expect(result.current.activeTab).toBe('dishes');
      expect(result.current.filteredDishes.length).toBe(2);

      act(() => {
        result.current.setActiveTab('ingredients');
      });
      expect(result.current.activeTab).toBe('ingredients');
      expect(result.current.filteredIngredients.length).toBe(1);

      act(() => {
        result.current.setActiveTab('potions');
      });
      expect(result.current.activeTab).toBe('potions');
      expect(result.current.filteredPotions.length).toBe(1);
    });

    it('opens the matching ingredient tab for a direct q search link', () => {
      window.history.replaceState(null, '', '/info/food/?q=Prime%20Meat');

      const { result } = renderHook(() =>
        useFoodCatalog({ initialData: mockFoodData, locale: 'en' })
      );

      expect(result.current.activeTab).toBe('ingredients');
      expect(result.current.filteredIngredients).toHaveLength(1);
      expect(result.current.filteredIngredients[0].id).toBe('ing_meat');
    });

    it('filters dishes by rarity and recipe availability', () => {
      const { result } = renderHook(() =>
        useFoodCatalog({ initialData: mockFoodData, locale: 'en' })
      );

      act(() => {
        result.current.setRarityFilter('SR');
      });
      expect(result.current.filteredDishes.length).toBe(1);
      expect(result.current.filteredDishes[0].id).toBe('dish_1');

      act(() => {
        result.current.setRarityFilter('all');
        result.current.setRecipeFilter('has-recipe');
      });
      expect(result.current.filteredDishes.length).toBe(1);
      expect(result.current.filteredDishes[0].id).toBe('dish_1');
    });
  });

  describe('5. Cosmetics Catalog Filter & Categories Logic', () => {
    const mockCosmeticsData: any = {
      schemaVersion: 1,
      total: 3,
      items: [
        {
          id: 'outfit_1',
          name: 'Wasteland Hunter',
          name_en: 'Wasteland Hunter',
          name_ru: 'Охотник пустоши',
          fashion_type: 'Dress',
          quality: 'SSR',
          icon: '/cosmetics/outfit_1.webp',
        },
        {
          id: 'skin_1',
          name: 'Summer Breeze',
          name_en: 'Summer Breeze',
          name_ru: 'Летний бриз',
          fashion_type: 'SimulacrumHauteCouture',
          quality: 'SSR',
          icon: '/cosmetics/skin_1.webp',
        },
        {
          id: 'mount_1',
          name: 'Monocross',
          name_en: 'Monocross',
          name_ru: 'Монокросс',
          fashion_type: 'Mount',
          quality: 'SR',
          icon: '/cosmetics/mount_1.webp',
        },
      ],
    };

    it('filters cosmetics by subcategory', () => {
      const { result } = renderHook(() =>
        useCosmeticsCatalog({ initialData: mockCosmeticsData, locale: 'en' })
      );

      expect(result.current.activeCategory).toBe('all');
      expect(result.current.filteredCount).toBe(3);

      act(() => {
        result.current.setActiveCategory('Mount');
      });

      expect(result.current.activeCategory).toBe('Mount');
      expect(result.current.filteredCount).toBe(1);
      expect(result.current.visibleItems[0].id).toBe('mount_1');
    });

    it('searches cosmetics by name', () => {
      const { result } = renderHook(() =>
        useCosmeticsCatalog({ initialData: mockCosmeticsData, locale: 'en' })
      );

      act(() => {
        result.current.setSearchQuery('Hunter');
      });

      expect(result.current.filteredCount).toBe(1);
      expect(result.current.visibleItems[0].id).toBe('outfit_1');
    });

    it('hides cosmetics without an image source', () => {
      const { result } = renderHook(() =>
        useCosmeticsCatalog({
          initialData: {
            ...mockCosmeticsData,
            items: [...mockCosmeticsData.items, { id: 'missing_art', name: 'Missing Art' }],
          },
          locale: 'en',
        })
      );

      expect(result.current.totalCount).toBe(3);
      expect(result.current.filteredCount).toBe(3);
      expect(result.current.visibleItems.some((item) => item.id === 'missing_art')).toBe(false);
    });
  });

  describe('6. Arts Catalog Filter & Lightbox Logic', () => {
    const mockArtsData: any = {
      schemaVersion: 1,
      total: 3,
      items: [
        {
          id: 'art_wp_1',
          title: 'Vera Desert Sunset',
          name: 'Vera Desert Sunset',
          category: 'wallpapers',
          url: '/arts/wp1.webp',
          width: 1920,
          height: 1080,
        },
        {
          id: 'art_char_1',
          title: 'Lin Awakening',
          name: 'Lin Awakening',
          category: 'characters',
          url: '/arts/char1.webp',
          width: 1080,
          height: 1920,
        },
        {
          id: 'art_wp_2',
          title: 'Aesperia Tower',
          name: 'Aesperia Tower',
          category: 'wallpapers',
          url: '/arts/wp2.webp',
          width: 1920,
          height: 1080,
        },
      ],
    };

    it('filters arts by category', () => {
      const { result } = renderHook(() =>
        useArtsCatalog({ initialData: mockArtsData, locale: 'en' })
      );

      expect(result.current.activeCategory).toBe('all');
      expect(result.current.filteredCount).toBe(3);

      act(() => {
        result.current.setActiveCategory('wallpapers');
      });

      expect(result.current.activeCategory).toBe('wallpapers');
      expect(result.current.filteredCount).toBe(2);
    });

    it('renders arts in batches and resets the batch after filtering', () => {
      const batchedArtsData = {
        ...mockArtsData,
        items: Array.from({ length: 61 }, (_, index) => ({
          ...mockArtsData.items[0],
          id: `art_wp_${index + 10}`,
          title: `Wallpaper ${index + 10}`,
        })),
      };
      const { result } = renderHook(() =>
        useArtsCatalog({ initialData: batchedArtsData, locale: 'en' })
      );

      expect(result.current.visibleItems).toHaveLength(60);
      expect(result.current.hasMore).toBe(true);

      act(() => {
        result.current.loadMore();
      });
      expect(result.current.visibleItems).toHaveLength(61);
      expect(result.current.hasMore).toBe(false);

      act(() => {
        result.current.setSearchQuery('not-found');
      });
      expect(result.current.visibleItems).toHaveLength(0);
      expect(result.current.hasMore).toBe(false);
    });

    it('navigates through artworks lightbox', () => {
      const { result } = renderHook(() =>
        useArtsCatalog({ initialData: mockArtsData, locale: 'en' })
      );

      expect(result.current.lightboxIndex).toBeNull();

      // Open first artwork
      act(() => {
        result.current.openLightbox(0);
      });
      expect(result.current.lightboxIndex).toBe(0);
      // The lightbox follows the visible order (release date, newest first by default).
      const [first,second]=result.current.visibleItems;
      expect(result.current.activeLightboxArtwork?.id).toBe(first!.id);

      // Navigate next
      act(() => {
        result.current.navigateLightbox(1);
      });
      expect(result.current.lightboxIndex).toBe(1);
      expect(result.current.activeLightboxArtwork?.id).toBe(second!.id);

      // Navigate previous
      act(() => {
        result.current.navigateLightbox(-1);
      });
      expect(result.current.lightboxIndex).toBe(0);

      // Close lightbox
      act(() => {
        result.current.closeLightbox();
      });
      expect(result.current.lightboxIndex).toBeNull();
      expect(result.current.activeLightboxArtwork).toBeNull();
    });
  });
});
