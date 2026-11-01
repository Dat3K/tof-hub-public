import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CatalogDemo,
  MOCK_SIMULACRA,
  MOCK_RELICS,
} from '@/dev/catalog-demo';
import {
  CatalogControls,
  CatalogSearch,
  ServerModeSwitcher,
  FilterGroup,
  FilterChip,
  CatalogSort,
  CatalogCounter,
  ResetFiltersButton,
  EntityGrid,
  EntityCard,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
  ModalFooter,
  Dialog,
  MediaLightbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
} from '@tof-hub/ui';

describe('Catalog Demo Dev Harness & Legacy Visual Parity', () => {
  describe('1. Full Dev Harness Render & Baseline Parity', () => {
    it('renders the complete CatalogDemo harness with all master tiers and mock cards', () => {
      const html = renderToStaticMarkup(<CatalogDemo />);

      // Top-level dev harness container
      expect(html).toContain('catalog-demo-harness');
      expect(html).toContain('dev-harness-bar');

      // Canonical legacy controls container class
      expect(html).toContain('sim-controls-bar');

      // Tier 1: Search and Server Mode Switcher
      expect(html).toContain('sim-search-box');
      expect(html).toContain('sim-search-input');
      expect(html).toContain('sim-search-icon');
      expect(html).toContain('sim-mode-toggle');
      expect(html).toContain('sim-mode-btn');

      // Tier 2: Two-column Filter Groups & Sort Listbox
      expect(html).toContain('sim-filter-groups');
      expect(html).toContain('sim-filter-groups__left');
      expect(html).toContain('sim-filter-group');
      expect(html).toContain('sim-filter-label');
      expect(html).toContain('sim-filter-btn');
      expect(html).toContain('sim-sort-box');
      expect(html).toContain('sim-sort-control');
      expect(html).toContain('sim-sort-trigger');

      // Tier 3: Counter & Status Bar
      expect(html).toContain('sim-status-bar');
      expect(html).toContain('sim-status-count');
      expect(html).toContain('data-page-count');
      expect(html).toContain('data-page-total');

      // Grid & Entity Cards
      expect(html).toContain('sim-grid');
      expect(html).toContain('sim-grid-card');
      expect(html).toContain('sim-grid-card__art-box');
      expect(html).toContain('sim-grid-card__badges-overlay');
      expect(html).toContain('sim-grid-card__rarity-overlay');
      expect(html).toContain('sim-grid-card__info');

      // Verify mock data presence in initial render
      expect(html).toContain('Saki Fuwa');
      expect(html).toContain('Heartstream');
      expect(html).toContain('Fenrir');
      expect(html).toContain('Gleipnir');
    });

    it('enforces WAI-ARIA and accessibility invariants across catalog controls', () => {
      const html = renderToStaticMarkup(<CatalogDemo />);

      // Radiogroup for server mode
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Server Mode"');
      expect(html).toContain('role="radio"');
      expect(html).toContain('aria-checked="true"');

      // Sort trigger WAI-ARIA listbox contract
      expect(html).toContain('aria-haspopup="listbox"');
      expect(html).toContain('aria-expanded="false"');

      // Status counter screen reader announcement contract
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-atomic="true"');
    });
  });

  describe('2. Primitives on Multiple Catalog Shapes (Simulacra vs Relics)', () => {
    it('renders Mock Catalog Form 1 (Simulacra Catalog: Element, Rarity, Role, Gacha/MMO)', () => {
      const sortOptions = [
        { value: 'release-desc', label: 'Release Order (Newest First)' },
        { value: 'name-asc', label: 'Name (A–Z)' },
      ];

      const html = renderToStaticMarkup(
        <CatalogControls id="simulacra-catalog-test" ariaLabel="Simulacra Filters">
          <CatalogControls.Top>
            <CatalogSearch
              id="sim-search"
              value=""
              onChange={() => {}}
              placeholder="Search simulacra..."
            />
            <ServerModeSwitcher value="gacha" onChange={() => {}} />
          </CatalogControls.Top>
          <CatalogControls.Middle>
            <CatalogControls.Left>
              <FilterGroup label="Element:">
                <FilterChip active={true}>All</FilterChip>
                <FilterChip variant="frost" active={false}>Frost</FilterChip>
                <FilterChip variant="flame" active={false}>Flame</FilterChip>
                <FilterChip variant="volt" active={false}>Volt</FilterChip>
                <FilterChip variant="physical" active={false}>Phys</FilterChip>
                <FilterChip variant="altered" active={false}>Altered</FilterChip>
              </FilterGroup>
              <FilterGroup label="Rarity:">
                <FilterChip active={true}>All</FilterChip>
                <FilterChip variant="ssr" active={false}>SSR</FilterChip>
                <FilterChip variant="sr" active={false}>SR</FilterChip>
              </FilterGroup>
              <FilterGroup label="Role:">
                <FilterChip active={true}>All</FilterChip>
                <FilterChip variant="attack" active={false}>DPS</FilterChip>
                <FilterChip variant="defense" active={false}>Defense</FilterChip>
                <FilterChip variant="assist" active={false}>Support</FilterChip>
              </FilterGroup>
            </CatalogControls.Left>
            <CatalogControls.Right>
              <CatalogSort
                id="sim-sort"
                value="release-desc"
                onChange={() => {}}
                options={sortOptions}
              />
            </CatalogControls.Right>
          </CatalogControls.Middle>
          <CatalogControls.Bottom>
            <CatalogCounter count={12} total={12} entityLabel="simulacra" />
          </CatalogControls.Bottom>
        </CatalogControls>
      );

      expect(html).toContain('Element:');
      expect(html).toContain('Rarity:');
      expect(html).toContain('Role:');
      expect(html).toContain('sim-filter-btn--frost');
      expect(html).toContain('sim-filter-btn--flame');
      expect(html).toContain('sim-filter-btn--volt');
      expect(html).toContain('sim-filter-btn--phys');
      expect(html).toContain('sim-filter-btn--altered');
      expect(html).toContain('sim-filter-btn--ssr');
      expect(html).toContain('Showing');
      expect(html).toContain('12');
      expect(html).toContain('simulacra');
    });

    it('renders Mock Catalog Form 2 (Relics Catalog: Property, Quality, Cooldown, Gacha/MMO)', () => {
      const relicSortOptions = [
        { value: 'quality-desc', label: 'Quality (High → Low)' },
        { value: 'cd-asc', label: 'Cooldown (Shortest First)' },
      ];

      const html = renderToStaticMarkup(
        <CatalogControls id="relics-catalog-test" ariaLabel="Relic Filters">
          <CatalogControls.Top>
            <CatalogSearch
              id="relic-search"
              value="Omnium"
              onChange={() => {}}
              placeholder="Search relic name or property..."
            />
            <ServerModeSwitcher value="mmo" onChange={() => {}} />
          </CatalogControls.Top>
          <CatalogControls.Middle>
            <CatalogControls.Left>
              <FilterGroup label="Property:">
                <FilterChip active={true}>All</FilterChip>
                <FilterChip variant="attack" active={false}>Attack</FilterChip>
                <FilterChip variant="defense" active={false}>Defense</FilterChip>
                <FilterChip variant="assist" active={false}>Assist</FilterChip>
                <FilterChip variant="function" active={false}>Function</FilterChip>
              </FilterGroup>
              <FilterGroup label="Grade:">
                <FilterChip active={false}>All</FilterChip>
                <FilterChip variant="ssr" active={true}>SSR</FilterChip>
                <FilterChip variant="sr" active={false}>SR</FilterChip>
              </FilterGroup>
            </CatalogControls.Left>
            <CatalogControls.Right>
              <CatalogSort
                id="relic-sort"
                value="quality-desc"
                onChange={() => {}}
                options={relicSortOptions}
              />
            </CatalogControls.Right>
          </CatalogControls.Middle>
          <CatalogControls.Bottom>
            <CatalogCounter count={2} total={8} entityLabel="relics" />
            <ResetFiltersButton onClick={() => {}} visible={true} label="Reset Filters" />
          </CatalogControls.Bottom>
        </CatalogControls>
      );

      expect(html).toContain('Property:');
      expect(html).toContain('Grade:');
      expect(html).toContain('sim-filter-btn--attack');
      expect(html).toContain('sim-filter-btn--defense');
      expect(html).toContain('sim-filter-btn--function');
      expect(html).toContain('sim-reset-filters-btn');
      expect(html).toContain('Reset Filters');
      expect(html).toContain('Showing');
      expect(html).toContain('2');
      expect(html).toContain('8');
      expect(html).toContain('relics');
    });
  });

  describe('3. Cards Grid, Empty State & Skeleton Loading States', () => {
    it('renders EntityGrid with EntityCard items matching legacy visual tokens', () => {
      const testItem = MOCK_SIMULACRA[0];
      const html = renderToStaticMarkup(
        <EntityGrid>
          <EntityCard
            key={testItem.id}
            title={testItem.name}
            subtitle={testItem.weaponName}
            description={testItem.description}
            rarity={testItem.rarity}
            element={testItem.element}
            image={testItem.avatarUrl}
            aspectRatio="square"
            cornerSlot={<span className="corner-test">3★</span>}
          />
        </EntityGrid>
      );

      expect(html).toContain('sim-grid');
      expect(html).toContain('sim-grid-card');
      expect(html).toContain('Saki Fuwa');
      expect(html).toContain('Heartstream');
      expect(html).toContain('corner-test');
      expect(html).toContain('SSR');
    });

    it('renders EmptyState when zero results match filter criteria', () => {
      const html = renderToStaticMarkup(
        <EntityGrid
          empty={true}
          emptyTitle="No simulacra found"
          emptyDescription="Try clearing your search term or filter chips."
        />
      );

      expect(html).toContain('No simulacra found');
      expect(html).toContain('Try clearing your search term or filter chips.');
    });

    it('renders the shared loading status when loading is active', () => {
      const html = renderToStaticMarkup(
        <EntityGrid loading={true} skeletonCount={4} />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('Loading');
    });
  });

  describe('4. Modals, Tabs, Dialogs, and Lightbox Primitives', () => {
    it('renders accessible Modal with Header, Title, Tabs, and Body', () => {
      const html = renderToStaticMarkup(
        <Modal isOpen={true} onClose={() => {}} size="lg" ariaLabel="Test Character Modal">
          <ModalHeader>
            <ModalTitle>Saki Fuwa — Heartstream</ModalTitle>
            <ModalClose onClick={() => {}} />
          </ModalHeader>
          <ModalBody>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="skills">Skills</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <p>Overview lore text for Saki Fuwa.</p>
              </TabsContent>
              <TabsContent value="skills">
                <p>Combat skill multipliers.</p>
              </TabsContent>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <button type="button">Close</button>
          </ModalFooter>
        </Modal>
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Saki Fuwa — Heartstream');
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('Overview lore text for Saki Fuwa.');
    });

    it('renders Dialog confirmation modal with warning variant and actions', () => {
      const html = renderToStaticMarkup(
        <Dialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Reset All Filters?"
          description="This will clear your active filters."
          variant="warning"
          confirmLabel="Reset Now"
          cancelLabel="Cancel"
        />
      );

      expect(html).toContain('Reset All Filters?');
      expect(html).toContain('This will clear your active filters.');
      expect(html).toContain('Reset Now');
      expect(html).toContain('Cancel');
    });

    it('renders MediaLightbox with full-screen stage and caption', () => {
      const html = renderToStaticMarkup(
        <MediaLightbox
          isOpen={true}
          onClose={() => {}}
          src="/game-assets/splash/saki-full.webp"
          title="Saki Fuwa — Full Splash Art"
          caption="Official High-Resolution Character Illustration"
        />
      );

      expect(html).toContain('sim-lightbox');
      expect(html).toContain('sim-lightbox__dialog');
      expect(html).toContain('sim-lightbox__stage');
      expect(html).toContain('sim-lightbox__img');
      expect(html).toContain('Saki Fuwa — Full Splash Art');
      expect(html).toContain('Official High-Resolution Character Illustration');
    });
  });
});
