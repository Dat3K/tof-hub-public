import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SimulacraDataset, SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import { useSimulacraCatalog } from './use-simulacra-catalog';

// Helper to construct deterministic simulacra test items
function createMockSimulacrum(overrides: Partial<SimulacraDatasetItemRaw> = {}): SimulacraDatasetItemRaw {
  return {
    id: overrides.id || 'char-1',
    avatar_id: overrides.avatar_id || 'Char1',
    imitation_id: overrides.imitation_id || 'imitation_10',
    weapon_id: overrides.weapon_id || 'weapon_1',
    matrix_suit_id: overrides.matrix_suit_id || 'suit_SSR10',
    matrix_suit_num: overrides.matrix_suit_num ?? 10,
    element: overrides.element || 'Frost',
    element_secondary: overrides.element_secondary,
    role: overrides.role || 'DPS',
    resonance: overrides.resonance || overrides.role || 'DPS',
    rarity: overrides.rarity || 'SSR',
    server_mode: overrides.server_mode || 'gacha',
    edition: overrides.edition || 'gacha',
    has_matrices: overrides.has_matrices ?? true,
    no_matrices: overrides.no_matrices ?? false,
    season: overrides.season ?? null,
    name: overrides.name || 'Frost Hero',
    name_en: overrides.name_en || overrides.name || 'Frost Hero',
    name_ru: overrides.name_ru || 'Ледяной Герой',
    weapon_name: overrides.weapon_name || 'Ice Blade',
    weapon_name_en: overrides.weapon_name_en || overrides.weapon_name || 'Ice Blade',
    weapon_name_ru: overrides.weapon_name_ru || 'Ледяной Клинок',
    avatar: '/media/avatar1.webp',
    avatar_thumb: '/media/avatar1_thumb.webp',
    portrait: '/media/portrait1.webp',
    portrait_thumb: '/media/portrait1_thumb.webp',
    detail_art: '/media/detail1.webp',
    detail_art_thumb: '/media/detail1_thumb.webp',
    card: '/media/card1.webp',
    card_thumb: '/media/card1_thumb.webp',
    art_focus: null,
    icon: '/media/icon1.webp',
    icon_thumb: '/media/icon1_thumb.webp',
    base_stats: { attack: 10, hp: 1000, crit: 5, shatter: 10, charge: 10 },
    ...overrides,
  };
}

const mockGachaItems: SimulacraDatasetItemRaw[] = [
  createMockSimulacrum({
    id: 'saki-fuwa',
    avatar_id: 'SakiFuwa',
    imitation_id: 'imitation_20',
    matrix_suit_num: 20,
    element: 'Frost',
    role: 'Defense',
    resonance: 'Defense',
    name: 'Saki Fuwa',
    name_en: 'Saki Fuwa',
    name_ru: 'Саки Фува',
    weapon_name: 'Heartstream',
    weapon_name_en: 'Heartstream',
    weapon_name_ru: 'Сердечный Поток',
  }),
  createMockSimulacrum({
    id: 'fenrir',
    avatar_id: 'Fenrir',
    imitation_id: 'imitation_30',
    matrix_suit_num: 30,
    element: 'Volt',
    role: 'DPS',
    resonance: 'DPS',
    name: 'Fenrir',
    name_en: 'Fenrir',
    name_ru: 'Фенрир',
    weapon_name: 'Gleipnir',
    weapon_name_en: 'Gleipnir',
    weapon_name_ru: 'Глейпнир',
  }),
  createMockSimulacrum({
    id: 'fiona',
    avatar_id: 'Fiona',
    imitation_id: 'imitation_35',
    matrix_suit_num: 35,
    element: 'Altered',
    role: 'Support',
    resonance: 'Support',
    name: 'Fiona',
    name_en: 'Fiona',
    name_ru: 'Фиона',
    weapon_name: 'Moonstar Bracelet',
    weapon_name_en: 'Moonstar Bracelet',
    weapon_name_ru: 'Лунный Браслет',
  }),
  createMockSimulacrum({
    id: 'annabella',
    avatar_id: 'Annabella',
    imitation_id: 'imitation_25',
    matrix_suit_num: 25,
    element: 'Flame',
    role: 'DPS',
    resonance: 'DPS',
    name: 'Annabella',
    name_en: 'Annabella',
    name_ru: 'Аннабелла',
    weapon_name: 'Clover Cross',
    weapon_name_en: 'Clover Cross',
    weapon_name_ru: 'Клеверный Крест',
  }),
  createMockSimulacrum({
    id: 'lyra',
    avatar_id: 'Lyra',
    imitation_id: 'imitation_22',
    matrix_suit_num: 22,
    element: 'Physical',
    role: 'Benediction',
    resonance: 'Benediction',
    name: 'Lyra',
    name_en: 'Lyra',
    name_ru: 'Лира',
    weapon_name: 'Vespers',
    weapon_name_en: 'Vespers',
    weapon_name_ru: 'Вечерня',
  }),
  createMockSimulacrum({
    id: 'brevey',
    avatar_id: 'Brevey',
    imitation_id: 'imitation_50',
    matrix_suit_num: 50,
    element: 'Volt',
    element_secondary: 'Frost',
    role: 'Support',
    resonance: 'Support',
    name: 'Brevey',
    name_en: 'Brevey',
    name_ru: 'Бреви',
    weapon_name: 'Pactpo',
    weapon_name_en: 'Pactpo',
    weapon_name_ru: 'Пактпо',
  }),
];

const mockMmoItems: SimulacraDatasetItemRaw[] = [
  createMockSimulacrum({
    id: 'saki-fuwa-mmo',
    name: 'Saki Fuwa (MMO)',
    name_en: 'Saki Fuwa (MMO)',
    name_ru: 'Саки Фува (MMO)',
    server_mode: 'mmo',
    edition: 'mmo',
    season: 1,
    matrix_suit_num: 20,
    element: 'Frost',
    role: 'Defense',
  }),
  createMockSimulacrum({
    id: 'fenrir-mmo',
    name: 'Fenrir (MMO)',
    name_en: 'Fenrir (MMO)',
    name_ru: 'Фенрир (MMO)',
    server_mode: 'mmo',
    edition: 'mmo',
    season: 2,
    matrix_suit_num: 30,
    element: 'Volt',
    role: 'DPS',
  }),
];

const mockDataset: SimulacraDataset = {
  schemaVersion: 1,
  generatedAt: '2026-09-18T00:00:00.000Z',
  total: mockGachaItems.length,
  counts: {
    total: mockGachaItems.length,
    gacha: mockGachaItems.length,
    mmo: mockMmoItems.length,
  },
  items: mockGachaItems,
  gacha: mockGachaItems,
  mmo: mockMmoItems,
};

describe('Simulacra Catalog Filter, Search, Sort & Server Mode Logic', () => {
  beforeEach(() => {
    // Clear URL parameters and storage between tests
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/info/simulacra');
      window.localStorage.clear();
    }
  });

  describe('1. Search Filter Logic', () => {
    it('returns all items when search query is empty or only whitespace', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      expect(result.current.filteredCount).toBe(6);
      expect(result.current.totalCount).toBe(6);

      act(() => {
        result.current.setSearchQuery('   ');
      });

      expect(result.current.filteredCount).toBe(6);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('filters case-insensitively by English character name', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setSearchQuery('sAkI');
      });

      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('saki-fuwa');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('filters by Russian character name', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'ru' })
      );

      act(() => {
        result.current.setSearchQuery('Фенрир');
      });

      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('fenrir');
    });

    it('filters by weapon English and Russian names', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      // Search by weapon name English: "Heartstream"
      act(() => {
        result.current.setSearchQuery('Heartstream');
      });
      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('saki-fuwa');

      // Search by weapon name Russian: "Сердечный"
      act(() => {
        result.current.setSearchQuery('Сердечный');
      });
      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('saki-fuwa');
    });

    it('supports multi-token queries requiring all tokens to match (AND semantics)', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      // Both "Saki" and "Heart" match Saki Fuwa
      act(() => {
        result.current.setSearchQuery('Saki Heart');
      });
      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('saki-fuwa');

      // "Saki" matches Saki, but "Gleipnir" matches Fenrir -> zero results
      act(() => {
        result.current.setSearchQuery('Saki Gleipnir');
      });
      expect(result.current.filteredCount).toBe(0);
    });

    it('safely handles special regex characters in query without crashing', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      expect(() => {
        act(() => {
          result.current.setSearchQuery('[test.*+?^${}()|\\');
        });
      }).not.toThrow();

      expect(result.current.filteredCount).toBe(0);
    });
  });

  describe('2. Element Filter Logic', () => {
    it('filters by a single element (e.g. Frost)', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleElement('frost');
      });

      // The secondary Frost badge on Brevey does not change its Volt classification.
      const ids = result.current.filteredItems.map((i) => i.id);
      expect(ids).toContain('saki-fuwa');
      expect(ids).not.toContain('brevey');
      expect(ids).not.toContain('fenrir');
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('keeps Physical/Flame and pure Physical, but excludes Flame/Physical', () => {
      const duals = [
        createMockSimulacrum({ id: 'physical-flame', element: 'Physical', element_secondary: 'Flame' }),
        createMockSimulacrum({ id: 'physical-only', element: 'Physical' }),
        createMockSimulacrum({ id: 'flame-physical', element: 'Flame', element_secondary: 'Physical' }),
      ];
      const { result } = renderHook(() => useSimulacraCatalog({
        initialData: { ...mockDataset, gacha: duals, items: duals },
        locale: 'en',
      }));

      act(() => result.current.toggleElement('physical'));
      expect(result.current.filteredItems.map((item) => item.id).sort()).toEqual(['physical-flame', 'physical-only']);
    });

    it('supports additive multi-element filters (OR semantics between selected elements)', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleElement('flame');
        result.current.toggleElement('physical');
      });

      const ids = result.current.filteredItems.map((i) => i.id);
      expect(ids).toContain('annabella'); // Flame
      expect(ids).toContain('lyra');      // Physical
      expect(ids).not.toContain('saki-fuwa');
      expect(ids).not.toContain('fenrir');
      expect(result.current.filteredCount).toBe(2);
    });

    it('toggles element off when clicked again', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleElement('flame');
      });
      expect(result.current.filteredCount).toBe(1);

      act(() => {
        result.current.toggleElement('flame');
      });
      expect(result.current.filteredCount).toBe(6);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('resets all elements when toggling "all"', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleElement('frost');
        result.current.toggleElement('volt');
      });
      expect(result.current.selectedElements.size).toBe(2);

      act(() => {
        result.current.toggleElement('all');
      });
      expect(result.current.selectedElements.size).toBe(0);
      expect(result.current.filteredCount).toBe(6);
    });
  });

  describe('3. Role / Resonance Filter Logic', () => {
    it('filters by DPS role', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleRole('dps');
      });

      // Fenrir and Annabella are DPS
      const ids = result.current.filteredItems.map((i) => i.id);
      expect(ids).toContain('fenrir');
      expect(ids).toContain('annabella');
      expect(ids).not.toContain('saki-fuwa'); // Defense/Tank
      expect(ids).not.toContain('fiona');     // Support/Benediction
      expect(result.current.filteredCount).toBe(2);
    });

    it('filters by Tank role', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleRole('tank');
      });

      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('saki-fuwa');
    });

    it('filters by Benediction / Support role', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleRole('benediction');
      });

      // Fiona, Lyra, Brevey (all normalize to Benediction)
      const ids = result.current.filteredItems.map((i) => i.id);
      expect(ids).toContain('fiona');
      expect(ids).toContain('lyra');
      expect(ids).toContain('brevey');
      expect(result.current.filteredCount).toBe(3);
    });

    it('combines Element and Role filters simultaneously', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.toggleElement('volt');
        result.current.toggleRole('dps');
      });

      // Volt + DPS = Fenrir only (Brevey is Volt Support/Benediction)
      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('fenrir');
    });
  });

  describe('4. Server Mode Divergence (Gacha vs MMO)', () => {
    it('defaults to gacha mode and switches cleanly to mmo mode', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      expect(result.current.serverMode).toBe('gacha');
      expect(result.current.totalCount).toBe(6);

      act(() => {
        result.current.setServerMode('mmo');
      });

      expect(result.current.serverMode).toBe('mmo');
      expect(result.current.totalCount).toBe(2);
      expect(result.current.filteredCount).toBe(2);
      expect(result.current.filteredItems[0].id).toBe('fenrir-mmo');
    });

    it('preserves search and filters across server mode switch', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setSearchQuery('Fenrir');
      });
      expect(result.current.filteredCount).toBe(1);

      act(() => {
        result.current.setServerMode('mmo');
      });
      // Fenrir exists in MMO as fenrir-mmo
      expect(result.current.filteredCount).toBe(1);
      expect(result.current.filteredItems[0].id).toBe('fenrir-mmo');
    });
  });

  describe('4b. Server URL Param (defaults stay out of the link)', () => {
    it('omits ?server=gacha for the default list view', () => {
      renderHook(() => useSimulacraCatalog({ initialData: mockDataset, locale: 'en' }));

      expect(window.location.search).not.toContain('server');
    });

    it('keeps server+char when a character is open', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setSelectedCharId('saki-fuwa');
      });

      const params = new URLSearchParams(window.location.search);
      expect(params.get('server')).toBe('gacha');
      expect(params.get('char')).toBe('saki-fuwa');
    });

    it('keeps ?server=mmo for the non-default mode without a character', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setServerMode('mmo');
      });

      expect(new URLSearchParams(window.location.search).get('server')).toBe('mmo');
    });

    it('drops a stale ?server=gacha from the list view URL', () => {
      window.history.replaceState(null, '', '/info/simulacra?server=gacha');

      renderHook(() => useSimulacraCatalog({ initialData: mockDataset, locale: 'en' }));

      expect(window.location.search).not.toContain('server');
    });
  });

  describe('5. Sorting Logic', () => {
    it('sorts by release_desc (newest first based on matrix suit num / imitation num)', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setSortValue('release_desc');
      });

      // Suit nums: Brevey (50) > Fiona (35) > Fenrir (30) > Annabella (25) > Lyra (22) > Saki Fuwa (20)
      const ids = result.current.filteredItems.map((i) => i.id);
      expect(ids[0]).toBe('brevey');
      expect(ids[1]).toBe('fiona');
      expect(ids[2]).toBe('fenrir');
      expect(ids[ids.length - 1]).toBe('saki-fuwa');
    });

    it('sorts by release_asc (oldest first)', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setSortValue('release_asc');
      });

      const ids = result.current.filteredItems.map((i) => i.id);
      expect(ids[0]).toBe('saki-fuwa');
      expect(ids[ids.length - 1]).toBe('brevey');
    });

    it('sorts by name_asc alphabetically in English', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setSortValue('name_asc');
      });

      const names = result.current.filteredItems.map((i) => i.name_en);
      // Annabella, Brevey, Fenrir, Fiona, Lyra, Saki Fuwa
      expect(names).toEqual([
        'Annabella',
        'Brevey',
        'Fenrir',
        'Fiona',
        'Lyra',
        'Saki Fuwa',
      ]);
    });

    it('sorts by name_asc alphabetically in Russian', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'ru' })
      );

      act(() => {
        result.current.setSortValue('name_asc');
      });

      const namesRu = result.current.filteredItems.map((i) => i.name_ru);
      // Cyrillic alphabetical: А (Аннабелла) < Б (Бреви) < Л (Лира) < С (Саки) < Фенрир < Фиона
      expect(namesRu[0]).toBe('Аннабелла');
      expect(namesRu[1]).toBe('Бреви');
      expect(namesRu[2]).toBe('Лира');
      expect(namesRu[3]).toBe('Саки Фува');
    });

    it('sorts by MMO season descending in MMO mode', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      act(() => {
        result.current.setServerMode('mmo');
        result.current.setSortValue('release_desc');
      });

      // Fenrir is season 2, Saki Fuwa is season 1
      expect(result.current.filteredItems[0].id).toBe('fenrir-mmo');
      expect(result.current.filteredItems[1].id).toBe('saki-fuwa-mmo');
    });
  });

  describe('6. Reset Filters & Active State Detection', () => {
    it('correctly tracks active filters and resets everything on handleResetFilters', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      expect(result.current.hasActiveFilters).toBe(false);

      act(() => {
        result.current.setSearchQuery('Saki');
        result.current.toggleElement('frost');
        result.current.toggleRole('tank');
        result.current.setSortValue('name_desc');
      });

      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.searchQuery).toBe('Saki');
      expect(result.current.selectedElements.size).toBe(1);
      expect(result.current.selectedRoles.size).toBe(1);
      expect(result.current.sortValue).toBe('name_desc');

      act(() => {
        result.current.handleResetFilters();
      });

      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.selectedElements.size).toBe(0);
      expect(result.current.selectedRoles.size).toBe(0);
      expect(result.current.sortValue).toBe('release_desc');
      expect(result.current.filteredCount).toBe(6);
    });
  });

  describe('7. Character Detail Selection', () => {
    it('selects character by ID and looks up details across dataset', () => {
      const { result } = renderHook(() =>
        useSimulacraCatalog({ initialData: mockDataset, locale: 'en' })
      );

      expect(result.current.selectedCharacter).toBeNull();

      act(() => {
        result.current.setSelectedCharId('saki-fuwa');
      });

      expect(result.current.selectedCharacter).not.toBeNull();
      expect(result.current.selectedCharacter?.id).toBe('saki-fuwa');
      expect(result.current.selectedCharacter?.name_en).toBe('Saki Fuwa');

      // Deselect
      act(() => {
        result.current.setSelectedCharId(null);
      });
      expect(result.current.selectedCharacter).toBeNull();
    });
  });
});
