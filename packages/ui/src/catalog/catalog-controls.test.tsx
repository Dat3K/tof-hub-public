import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FilterChip,
  FilterGroup,
  CatalogSearch,
  ServerModeSwitcher,
  CatalogSort,
  CatalogCounter,
  ResetFiltersButton,
  CatalogControls,
  getStoredServerMode,
  setStoredServerMode,
} from './index';

describe('Catalog Controls System', () => {
  it('composes a responsive search accessory independently of the lower filters',()=>{
    const html=renderToStaticMarkup(<CatalogControls searchQuery="" onSearchChange={()=>{}} searchSlot={<span>Rarity choices</span>} leadingFilters={<span>Type choices</span>}><span>Effect choices</span></CatalogControls>);
    expect(html).toContain('data-responsive-slot="true"');
    expect(html.indexOf('Rarity choices')).toBeLessThan(html.indexOf('sim-filter-groups'));
    expect(html.indexOf('Type choices')).toBeGreaterThan(html.indexOf('sim-filter-groups'));
    expect(html.indexOf('Type choices')).toBeLessThan(html.indexOf('Effect choices'));
  });
  it('uses the shared neutral surfaces for the bar, search and sort on every page', () => {
    const search = renderToStaticMarkup(<CatalogSearch value="amine" onChange={() => {}} placeholder="Search player" />);
    expect(search).toContain('sim-search-input');
    expect(search).toContain('aria-label="Search player"');
    const sort = renderToStaticMarkup(<CatalogSort value="grv" onChange={() => {}} options={[{ value: 'grv', label: 'GRV: High → Low' }]} />);
    expect(sort.match(/bg-\[var\(--surface-panel\)\]/g)).toHaveLength(2);
    expect(sort).toContain('aria-selected="true"');
    for (const html of [renderToStaticMarkup(<CatalogControls><span>Filters</span></CatalogControls>), renderToStaticMarkup(<CatalogControls count={2} total={10} />)])
      expect(html).toContain('bg-[var(--surface-panel)]');
  });
  describe('1. FilterChip (.sim-filter-btn)', () => {
    it('renders default inactive chip with correct classes and No-Glare icon rules', () => {
      const html = renderToStaticMarkup(
        <FilterChip value="phys" variant="phys" icon="/media/icon_element_wu.webp">
          Physical
        </FilterChip>
      );

      expect(html).toContain('sim-filter-btn');
      expect(html).toContain('sim-filter-btn--phys');
      expect(html).not.toContain('active');
      expect(html).toContain('data-val="phys"');
      // No-Glare Icon rule: flat icon with grayscale/opacity
      expect(html).toContain('sim-filter-icon');
      expect(html).toContain('grayscale');
      expect(html).not.toContain('drop-shadow');
    });

    it('renders active neon styling for elemental and role variants', () => {
      const htmlPhys = renderToStaticMarkup(
        <FilterChip value="phys" variant="phys" active>
          Phys
        </FilterChip>
      );
      expect(htmlPhys).toContain('active is-active');
      expect(htmlPhys).toContain('border-[#f59e0b]');
      expect(htmlPhys).toContain('shadow-[0_0_12px_rgba(245,158,11,0.35)]');

      const htmlFlame = renderToStaticMarkup(
        <FilterChip value="flame" variant="flame" active>
          Flame
        </FilterChip>
      );
      expect(htmlFlame).toContain('border-[#ef4444]');
      expect(htmlFlame).toContain('shadow-[0_0_12px_rgba(239,68,68,0.35)]');

      const htmlFrost = renderToStaticMarkup(
        <FilterChip value="frost" variant="frost" active>
          Frost
        </FilterChip>
      );
      expect(htmlFrost).toContain('border-[#06b6d4]');
      expect(htmlFrost).toContain('shadow-[0_0_12px_rgba(6,182,212,0.35)]');

      const htmlVolt = renderToStaticMarkup(
        <FilterChip value="volt" variant="volt" active>
          Volt
        </FilterChip>
      );
      expect(htmlVolt).toContain('border-[#a855f7]');
      expect(htmlVolt).toContain('shadow-[0_0_12px_rgba(168,85,247,0.35)]');

      const htmlAltered = renderToStaticMarkup(
        <FilterChip value="altered" variant="altered" active>
          Altered
        </FilterChip>
      );
      expect(htmlAltered).toContain('border-[#10b981]');
      expect(htmlAltered).toContain('shadow-[0_0_12px_rgba(16,185,129,0.35)]');

      const htmlAll = renderToStaticMarkup(
        <FilterChip value="all" variant="all" active>
          All
        </FilterChip>
      );
      expect(htmlAll).toContain('border-[#3b82f6]');
      expect(htmlAll).toContain('shadow-[0_0_12px_rgba(59,130,246,0.35)]');
    });

    it('renders rarity gradient variants correctly', () => {
      const htmlSsr = renderToStaticMarkup(
        <FilterChip value="ssr" variant="ssr" active>
          SSR
        </FilterChip>
      );
      expect(htmlSsr).toContain('sim-filter-btn--ssr');
      expect(htmlSsr).toContain('from-[#f59e0b]');
      expect(htmlSsr).toContain('to-[#b45309]');

      const htmlSr = renderToStaticMarkup(
        <FilterChip value="sr" variant="sr" active>
          SR
        </FilterChip>
      );
      expect(htmlSr).toContain('sim-filter-btn--sr');
      expect(htmlSr).toContain('from-[#a855f7]');
    });

    it('supports tab/radio roles for fundamental categories without All', () => {
      const html = renderToStaticMarkup(
        <FilterChip
          value="servants"
          role="tab"
          active
          aria-controls="section-servants"
        >
          Smart Servants
        </FilterChip>
      );
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-controls="section-servants"');
    });
  });

  describe('2. FilterGroup (.sim-filter-group)', () => {
    it('renders label with uppercase bold typography and chips inside', () => {
      const html = renderToStaticMarkup(
        <FilterGroup label="Element:" filterGroup="element">
          <FilterChip value="all" active>
            All
          </FilterChip>
          <FilterChip value="phys" variant="phys">
            Phys
          </FilterChip>
        </FilterGroup>
      );

      expect(html).toContain('sim-filter-group');
      expect(html).toContain('data-filter-group="element"');
      expect(html).toContain('sim-filter-label');
      expect(html).toContain('Element:');
      expect(html).toContain('uppercase');
      expect(html).toContain('All');
      expect(html).toContain('Phys');
    });

    it('supports two-rows layout for balanced categories (cosmetics)', () => {
      const html = renderToStaticMarkup(
        <FilterGroup label="Category:" layout="two-rows">
          <div className="row1">
            <FilterChip value="1">1</FilterChip>
          </div>
          <div className="row2">
            <FilterChip value="2">2</FilterChip>
          </div>
        </FilterGroup>
      );

      expect(html).toContain('outfits-filter-chips--two-rows');
    });

    it('supports tablist layout for fundamental category mode switchers (pets)', () => {
      const html = renderToStaticMarkup(
        <FilterGroup label="Category:" layout="tabs" role="tablist">
          <FilterChip value="servants" role="tab" active>
            Smart Servants
          </FilterChip>
          <FilterChip value="modules" role="tab">
            Skill Modules
          </FilterChip>
        </FilterGroup>
      );

      expect(html).toContain('pets-tab-bar');
      expect(html).toContain('role="tablist"');
      expect(html).toContain('Smart Servants');
      expect(html).toContain('Skill Modules');
    });
  });

  describe('3. ServerModeSwitcher (.sim-mode-toggle)', () => {
    it('renders Gacha active state with amber neon theme', () => {
      const html = renderToStaticMarkup(
        <ServerModeSwitcher value="gacha" onChange={() => {}} />
      );

      expect(html).toContain('sim-mode-toggle');
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('data-server-filter="gacha"');
      expect(html).toContain('border-[#fb923c]');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('data-server-filter="mmo"');
      expect(html).toContain('aria-checked="false"');
    });

    it('renders MMO active state with rose/crimson neon theme', () => {
      const html = renderToStaticMarkup(
        <ServerModeSwitcher value="mmo" onChange={() => {}} />
      );

      expect(html).toContain('data-server-filter="mmo"');
      expect(html).toContain('border-[#f43f5e]');
      expect(html).toContain('aria-checked="true"');
    });

    it('reads and writes to localStorage with fallback keys', () => {
      const mockStorage: Record<string, string> = {};
      const fakeLocalStorage = {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
      };

      vi.stubGlobal('localStorage', fakeLocalStorage);
      vi.stubGlobal('window', {
        localStorage: fakeLocalStorage,
        location: { search: '', href: 'http://localhost/info/simulacra/' },
      });

      // Initially default
      expect(getStoredServerMode('gacha')).toBe('gacha');

      // Persist mmo
      setStoredServerMode('mmo');
      expect(mockStorage['tof_server_mode']).toBe('mmo');
      expect(mockStorage['tof_sim_server']).toBe('mmo');
      expect(mockStorage['tof_relics_server']).toBe('mmo');
      expect(getStoredServerMode()).toBe('mmo');

      vi.unstubAllGlobals();
    });
  });

  describe('4. CatalogSearch (.sim-search-box)', () => {
    it('renders full-width input and search icon', () => {
      const html = renderToStaticMarkup(
        <CatalogSearch value="" onChange={() => {}} placeholder="Search simulacra..." />
      );

      expect(html).toContain('sim-search-box');
      expect(html).toContain('sim-search-icon');
      expect(html).toContain('sim-search-input');
      expect(html).toContain('placeholder="Search simulacra..."');
      // When empty, clear button is omitted
      expect(html).not.toContain('sim-search-clear');
    });

    it('renders clear button when query is not empty', () => {
      const html = renderToStaticMarkup(
        <CatalogSearch value="Fiona" onChange={() => {}} />
      );

      expect(html).toContain('sim-search-clear');
      expect(html).toContain('×');
      expect(html).toContain('value="Fiona"');
    });

    it('accommodates embedded server mode switcher on the right', () => {
      const html = renderToStaticMarkup(
        <CatalogSearch
          value=""
          onChange={() => {}}
          hasServerMode
          serverModeSlot={<ServerModeSwitcher value="gacha" onChange={() => {}} />}
        />
      );

      expect(html).toContain('pr-[160px]');
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('sim-mode-toggle');
    });
  });

  describe('5. CatalogSort (.sim-sort-box, .sim-sort-control)', () => {
    const testOptions = [
      { value: 'quality-desc', label: 'Quality (High → Low)' },
      { value: 'quality-asc', label: 'Quality (Low → High)' },
      { value: 'release-desc', label: 'Release Order (Newest First)', dividerBefore: true },
      { value: 'name-asc', label: 'Name (A–Z)' },
    ];

    it('renders right-pinned sort box with single-line trigger and menu', () => {
      const html = renderToStaticMarkup(
        <CatalogSort value="quality-desc" onChange={() => {}} options={testOptions} />
      );

      expect(html).toContain('sim-sort-box');
      expect(html).toContain('ml-auto');
      expect(html).toContain('sim-sort-control');
      expect(html).toContain('sim-sort-trigger');
      expect(html).toContain('sim-sort-trigger__value');
      expect(html).toContain('Quality (High → Low)');
      expect(html).toContain('sim-sort-menu');
      expect(html).toContain('sim-sort-option');
      expect(html).toContain('sim-sort-option--divider');
      expect(html).toContain('sim-sort-native');
    });

    it('ensures single-line invariant classes on trigger value and options', () => {
      const html = renderToStaticMarkup(
        <CatalogSort value="quality-desc" onChange={() => {}} options={testOptions} />
      );

      expect(html).toContain('whitespace-nowrap overflow-hidden text-ellipsis');
    });
  });

  describe('6. CatalogCounter (.sim-status-count)', () => {
    it('renders exact format with data-page-count and data-page-total attributes', () => {
      const html = renderToStaticMarkup(
        <CatalogCounter count={49} total={49} entityLabel="relics" />
      );

      expect(html).toContain('sim-status-count');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('Showing');
      expect(html).toContain('data-page-count');
      expect(html).toContain('49');
      expect(html).toContain('of');
      expect(html).toContain('data-page-total');
      expect(html).toContain('relics');
    });
  });

  describe('7. ResetFiltersButton (.sim-reset-filters-btn)', () => {
    it('renders undo svg icon and label when visible', () => {
      const html = renderToStaticMarkup(
        <ResetFiltersButton visible onClick={() => {}} />
      );

      expect(html).toContain('sim-reset-filters-btn');
      expect(html).toContain('Reset Filters');
      expect(html).toContain('svg');
    });

    it('returns null when visible is false', () => {
      const html = renderToStaticMarkup(
        <ResetFiltersButton visible={false} onClick={() => {}} />
      );

      expect(html).toBe('');
    });
  });

  describe('8. CatalogControls Composition', () => {
    const sortOptions = [
      { value: 'quality-desc', label: 'Quality (High → Low)' },
      { value: 'name-asc', label: 'Name (A–Z)' },
    ];

    it('renders complete Top/Middle/Bottom 3-tier hierarchy declaratively', () => {
      const html = renderToStaticMarkup(
        <CatalogControls
          id="test-controls"
          searchQuery="Alyss"
          onSearchChange={() => {}}
          serverMode="gacha"
          onServerModeChange={() => {}}
          showServerMode
          sortValue="quality-desc"
          onSortChange={() => {}}
          sortOptions={sortOptions}
          count={1}
          total={49}
          entityLabel="simulacra"
          hasActiveFilters
          onResetFilters={() => {}}
        >
          <FilterGroup label="Element:">
            <FilterChip value="all" active>
              All
            </FilterChip>
            <FilterChip value="frost" variant="frost">
              Frost
            </FilterChip>
          </FilterGroup>
        </CatalogControls>
      );

      // Root container (.sim-controls-bar)
      expect(html).toContain('id="test-controls"');
      expect(html).toContain('sim-controls-bar');
      expect(html).toContain('aria-label="Filters"');

      // Top Tier
      expect(html).toContain('sim-search-box');
      expect(html).toContain('value="Alyss"');
      expect(html).toContain('sim-mode-toggle');

      // Middle Tier
      expect(html).toContain('sim-filter-groups');
      expect(html).toContain('sim-filter-groups__left');
      expect(html).toContain('Element:');
      expect(html).toContain('Frost');
      expect(html).toContain('sim-sort-box');
      expect(html).toContain('sim-sort-trigger');

      // Bottom Tier
      expect(html).toContain('sim-status-bar');
      expect(html).toContain('sim-status-count');
      expect(html).toContain('data-page-count');
      expect(html).toContain('data-page-total');
      expect(html).toContain('sim-reset-filters-btn');
    });

    it('supports granular compound component composition', () => {
      const html = renderToStaticMarkup(
        <CatalogControls>
          <CatalogControls.Top>
            <CatalogSearch value="" onChange={() => {}} />
          </CatalogControls.Top>
          <CatalogControls.Middle>
            <CatalogControls.Left>
              <FilterGroup label="Category:">
                <FilterChip value="servants" active>
                  Smart Servants
                </FilterChip>
              </FilterGroup>
            </CatalogControls.Left>
            <CatalogControls.Right>
              <CatalogSort value="name-asc" onChange={() => {}} options={sortOptions} />
            </CatalogControls.Right>
          </CatalogControls.Middle>
          <CatalogControls.Bottom>
            <CatalogCounter count={14} total={14} entityLabel="servants" />
            <ResetFiltersButton visible={false} onClick={() => {}} />
          </CatalogControls.Bottom>
        </CatalogControls>
      );

      expect(html).toContain('sim-controls-bar');
      expect(html).toContain('sim-search-box');
      expect(html).toContain('sim-filter-groups');
      expect(html).toContain('sim-filter-groups__left');
      expect(html).toContain('Smart Servants');
      expect(html).toContain('sim-sort-box');
      expect(html).toContain('sim-status-bar');
      expect(html).toContain('sim-status-count');
    });
  });
});
