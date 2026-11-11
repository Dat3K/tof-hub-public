import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

// Mock resolveServerLocale so Next.js server components can render outside incoming HTTP request
vi.mock('@/lib/i18n/server', async () => {
  const actual = await vi.importActual<any>('@/lib/i18n/server');
  return {
    ...actual,
    resolveServerLocale: vi.fn(async () => ({ locale: 'en', source: 'fallback' })),
  };
});

// Info App Routes & Views
import InfoLayout from './layout';
import InfoHubPage from './page';
import SimulacraPage from './simulacra/page';
import SimulacraChangelogPage from './simulacra/changelog/page';
import MatricesPage from './matrices/page';
import RelicsPage from './relics/page';
import PetsPage from './pets/page';
import CosmeticsPage from './cosmetics/page';
import ArtsPage from './arts/page';

describe('Route Smoke Tests: Every /info Route', () => {
  beforeEach(() => {
    cleanup();
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/info');
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    cleanup();
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
    }
  });

  describe('1. Root Info Layout', () => {
    it('renders layout container and preserves children', () => {
      render(
        <InfoLayout>
          <div data-testid="test-child">Child Content</div>
        </InfoLayout>
      );

      expect(screen.getByTestId('test-child')).toBeDefined();
      expect(screen.getByText('Child Content')).toBeDefined();
    });
  });

  describe('2. Route: /info (Info Hub)', () => {
    it('renders the Information Hub with all encyclopedia section cards and links', async () => {
      const pageUi = await InfoHubPage();
      render(pageUi);

      // Hero section
      expect(
        screen.getByRole('heading', { level: 1, name: /Tower of Fantasy encyclopedia/i })
      ).toBeDefined();

      // All major section cards must be present with valid links
      const links = screen.getAllByRole('link');
      const hrefs = links.map((l) => l.getAttribute('href'));

      expect(hrefs).toContain('/info/simulacra');
      expect(hrefs).toContain('/info/matrices');
      expect(hrefs).toContain('/info/relics');
      expect(hrefs).toContain('/info/pets');
      expect(hrefs).toContain('/info/food');
      expect(hrefs).toContain('/info/cosmetics');
      expect(hrefs).toContain('/info/arts');

      // Check section titles
      expect(screen.getByText('Simulacra & Weapons')).toBeDefined();
      expect(screen.getByText('Matrices & Sets')).toBeDefined();
      expect(screen.getByText('Relics & Gadgets')).toBeDefined();
      expect(screen.getByText('Smart Servants')).toBeDefined();
      expect(screen.getByText('Food & Cooking Recipes')).toBeDefined();
      expect(screen.getByText('Cosmetics Gallery')).toBeDefined();
      expect(screen.getByText('Artworks & Wallpapers')).toBeDefined();
    });
  });

  describe('3. Route: /info/simulacra (Simulacra & Weapons Catalog)', () => {
    it('renders simulacra catalog with controls, filters, and character grid', async () => {
      const pageUi = await SimulacraPage();
      const { container } = render(pageUi);
      const controls = within(container.querySelector('#sim-controls-bar')!);

      // Main heading
      expect(
        screen.getByRole('heading', { level: 1, name: /Character & Weapon Profiles/i })
      ).toBeDefined();

      // Search input
      const searchInput = controls.getByPlaceholderText(/Search/i);
      expect(searchInput).toBeDefined();

      // Mode toggle (Gacha / MMO)
      expect(controls.getAllByRole('radiogroup', { name: /Server Mode/i }).length).toBeGreaterThan(0);

      // Element filter buttons
      expect(controls.getByRole('button', { name: /Frost/i })).toBeDefined();
      expect(controls.getByRole('button', { name: /Flame/i })).toBeDefined();
      expect(controls.getByRole('button', { name: /Volt/i })).toBeDefined();
      expect(controls.getByRole('button', { name: /Phys/i })).toBeDefined();
      expect(controls.getByRole('button', { name: /Altered/i })).toBeDefined();

      // Sort listbox trigger
      expect(controls.getByRole('button', { name: /Sort by/i })).toBeDefined();

      // Character cards must be rendered (with h3 name headings)
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
    }, 15_000);

    it('smoke test interactive search filtering on /info/simulacra', async () => {
      const pageUi = await SimulacraPage();
      render(pageUi);

      const searchInput = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(searchInput, { target: { value: 'Saki' } });

      // Saki Fuwa card must be visible
      expect(screen.getByText(/Saki Fuwa/i)).toBeDefined();
    });
  });

  describe('4. Route: /info/simulacra/changelog (Simulacra Weapon Changelog)', () => {
    it('renders the simulacra changelog feed and client version comparison', async () => {
      const pageUi = await SimulacraChangelogPage();
      render(pageUi);

      // Heading
      expect(
        screen.getByRole('heading', { level: 1, name: /Simulacra Changelogs/i })
      ).toBeDefined();

      // Navigation back link to simulacra
      const backLink = screen.getByRole('link', { name: /Back to Simulacra/i });
      expect(backLink).toBeDefined();
      expect(backLink.getAttribute('href')).toBe('/info/simulacra');

      // Server / Game mode controls
      expect(screen.getByRole('radiogroup', { name: /Game Mode/i })).toBeDefined();
    });
  });

  describe('5. Route: /info/matrices (Matrices Catalog)', () => {
    it('renders matrices catalog with search, rarity filters, and set bonus cards', async () => {
      const pageUi = await MatricesPage({});
      render(pageUi);

      // Heading
      expect(
        screen.getByRole('heading', { level: 1, name: /Matrix Sets & Set Effects/i })
      ).toBeDefined();

      // Search
      expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();

      // Element filters
      expect(screen.getByRole('button', { name: /Frost/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Flame/i })).toBeDefined();

      // Sort control
      expect(screen.getByRole('button', { name: /Sort by/i })).toBeDefined();

      // Matrix cards must be present (rendered with h3 title headings)
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
    });
  });

  describe('6. Route: /info/relics (Relics Catalog)', () => {
    it('renders relics catalog with mode toggle, grade filters, and relic cards', async () => {
      const pageUi = await RelicsPage({});
      render(pageUi);

      // Heading
      expect(
        screen.getByRole('heading', { level: 1, name: /Relics & Artifacts/i })
      ).toBeDefined();

      // Search & Server Mode Switcher
      expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();
      expect(screen.getAllByRole('radiogroup', { name: /Server Mode/i }).length).toBeGreaterThan(0);

      // Property filter buttons
      expect(screen.getByRole('button', { name: /Attack/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Defense/i })).toBeDefined();

      // Relic cards rendered
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
    });
  });

  describe('7. Route: /info/pets (Smart Servants Catalog)', () => {
    it('renders smart servants catalog with category tabs and servant cards', async () => {
      const pageUi = await PetsPage({});
      render(pageUi);

      // Heading
      expect(
        screen.getByRole('heading', { level: 1, name: /Smart Servants Database/i })
      ).toBeDefined();

      // Category tabs: Smart Servants & Skill Modules
      expect(screen.getByRole('tab', { name: /Smart Servants/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Skill Modules/i })).toBeDefined();

      // Search input
      expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();

      // Servant cards rendered
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
    });
  });

  describe('9. Route: /info/cosmetics (Cosmetics & Fashion Gallery)', () => {
    it('renders cosmetics catalog with category filters and items grid', async () => {
      const pageUi = await CosmeticsPage({});
      render(pageUi);

      // Heading
      expect(
        screen.getByRole('heading', { level: 1, name: /Cosmetics & Fashion Gallery/i })
      ).toBeDefined();

      // Search
      expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();

      // Category filters (Outfits, Headwear, Mounts, etc.)
      const controlsBar = document.getElementById('cosmetics-controls-bar')!;
      expect(within(controlsBar).getByRole('button', { name: /Cosmetics/i })).toBeDefined();
      expect(within(controlsBar).getByRole('button', { name: /Mounts/i })).toBeDefined();

      // Cosmetic cards rendered
      expect(document.querySelectorAll('article').length).toBeGreaterThan(0);
    });
  });

  describe('10. Route: /info/arts (Wallpapers & Media Gallery)', () => {
    it('renders artworks gallery with category filter buttons and artwork cards', async () => {
      const pageUi = await ArtsPage({});
      render(pageUi);

      // Heading
      expect(
        screen.getByRole('heading', { level: 1, name: /Artworks & Wallpapers Gallery/i })
      ).toBeDefined();

      // Search
      expect(screen.getByPlaceholderText(/Search/i)).toBeDefined();

      // Category filter buttons scoped to controls bar
      const controlsBar = document.getElementById('arts-controls-bar')!;
      expect(within(controlsBar).getByRole('button', { name: /^All/i })).toBeDefined();
      expect(within(controlsBar).getByRole('button', { name: /^Loading Screens/i })).toBeDefined();

      // Artwork cards rendered
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
    });
  });
});
