import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SortListbox,
  sortListboxReducer,
  getFirstEnabledOptionIndex,
  getLastEnabledOptionIndex,
  getNextEnabledOptionIndex,
  type SortListboxState,
} from '../sort-listbox';
import type { SortOption } from './types';
import { ServerModeSwitcher, handleServerModeKeyDown } from './server-mode-switcher';
import { FilterChip } from './filter-chip';
import { CatalogSearch, handleSearchInputKeyDown } from './catalog-search';
import { ResetFiltersButton } from './reset-filters-button';

describe('Keyboard Flow, A11y & ARIA Compliance', () => {
  const testOptions: SortOption[] = [
    { value: 'quality-desc', label: 'Quality (High → Low)' },
    { value: 'quality-asc', label: 'Quality (Low → High)' },
    { value: 'release-desc', label: 'Release Order (Newest First)', dividerBefore: true },
    { value: 'disabled-opt', label: 'Unavailable Option', disabled: true },
    { value: 'name-asc', label: 'Name (A–Z)' },
  ];

  describe('1. SortListbox WAI-ARIA Markup & Non-Color-Only States', () => {
    it('renders correct WAI-ARIA listbox and option roles with single-line invariant', () => {
      const html = renderToStaticMarkup(
        <SortListbox
          id="custom-sort"
          value="quality-desc"
          onChange={() => {}}
          options={testOptions}
          label="Sort by:"
        />
      );

      // Trigger ARIA attributes
      expect(html).toContain('sim-sort-trigger');
      expect(html).toContain('aria-haspopup="listbox"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="custom-sort-menu"');
      expect(html).toContain('aria-labelledby="custom-sort-label custom-sort-trigger"');

      // Dropdown Listbox ARIA attributes
      expect(html).toContain('role="listbox"');
      expect(html).toContain('aria-orientation="vertical"');
      expect(html).toContain('id="custom-sort-menu"');

      // Option ARIA attributes
      expect(html).toContain('role="option"');
      expect(html).toContain('data-sort-option');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
      expect(html).toContain('aria-disabled="true"');

      // Strict single-line invariant
      expect(html).toContain('whitespace-nowrap overflow-hidden text-ellipsis');
    });

    it('renders visual checkmark icon ONLY on selected option (non-color-only state)', () => {
      const html = renderToStaticMarkup(
        <SortListbox
          value="release-desc"
          onChange={() => {}}
          options={testOptions}
        />
      );

      // Checkmark SVG (.sim-sort-check) exists for release-desc
      expect(html).toContain('sim-sort-check');

      // Check that only 1 checkmark icon is rendered
      const matches = html.match(/sim-sort-check/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
    });

    it('renders visible focus ring classes on trigger and options', () => {
      const html = renderToStaticMarkup(
        <SortListbox
          value="quality-desc"
          onChange={() => {}}
          options={testOptions}
        />
      );

      expect(html).toContain('focus-visible:ring-2');
      expect(html).toContain('focus-visible:ring-[#2ba6df]');
      expect(html).toContain('focus-visible:ring-offset-2');
      expect(html).toContain('focus-visible:ring-1');
    });
  });

  describe('2. SortListbox Keyboard Flow & State Reducer Transitions', () => {
    const initialState: SortListboxState = {
      isOpen: false,
      focusedIndex: -1,
    };

    it('correctly resolves first and last enabled options skipping disabled items', () => {
      expect(getFirstEnabledOptionIndex(testOptions)).toBe(0);
      // Index 3 is disabled, so last enabled index is 4
      expect(getLastEnabledOptionIndex(testOptions)).toBe(4);
    });

    it('opens on OPEN action with selected, first, or last focus target', () => {
      // Selected option is 'release-desc' (index 2)
      const stateSelected = sortListboxReducer(
        initialState,
        { type: 'OPEN', focusTarget: 'selected' },
        testOptions,
        'release-desc'
      );
      expect(stateSelected.isOpen).toBe(true);
      expect(stateSelected.focusedIndex).toBe(2);

      // First enabled option (index 0)
      const stateFirst = sortListboxReducer(
        initialState,
        { type: 'OPEN', focusTarget: 'first' },
        testOptions,
        'release-desc'
      );
      expect(stateFirst.isOpen).toBe(true);
      expect(stateFirst.focusedIndex).toBe(0);

      // Last enabled option (index 4, skipping disabled index 3)
      const stateLast = sortListboxReducer(
        initialState,
        { type: 'OPEN', focusTarget: 'last' },
        testOptions,
        'release-desc'
      );
      expect(stateLast.isOpen).toBe(true);
      expect(stateLast.focusedIndex).toBe(4);
    });

    it('navigates cyclically with MOVE_FOCUS delta +1 (ArrowDown flow), skipping disabled items', () => {
      let state: SortListboxState = { isOpen: true, focusedIndex: 0 }; // 'quality-desc'

      // Move down: index 0 -> 1 ('quality-asc')
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: 1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(1);

      // Move down: index 1 -> 2 ('release-desc')
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: 1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(2);

      // Move down: index 2 -> skips disabled index 3 -> lands on index 4 ('name-asc')
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: 1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(4);

      // Cyclic wrap: index 4 -> wraps around to index 0 ('quality-desc')
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: 1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(0);
    });

    it('navigates cyclically with MOVE_FOCUS delta -1 (ArrowUp flow), skipping disabled items', () => {
      let state: SortListboxState = { isOpen: true, focusedIndex: 0 }; // 'quality-desc'

      // Move up: wraps from 0 to last enabled index 4 ('name-asc', index 3 disabled)
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: -1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(4);

      // Move up: index 4 -> skips disabled index 3 -> lands on index 2 ('release-desc')
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: -1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(2);

      // Move up: index 2 -> 1
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: -1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(1);

      // Move up: index 1 -> 0
      state = sortListboxReducer(state, { type: 'MOVE_FOCUS', delta: -1 }, testOptions, 'quality-desc');
      expect(state.focusedIndex).toBe(0);
    });

    it('handles TOGGLE action cleanly', () => {
      const opened = sortListboxReducer(initialState, { type: 'TOGGLE' }, testOptions, 'quality-desc');
      expect(opened.isOpen).toBe(true);
      expect(opened.focusedIndex).toBe(0);

      const closed = sortListboxReducer(opened, { type: 'TOGGLE' }, testOptions, 'quality-desc');
      expect(closed.isOpen).toBe(false);
      expect(closed.focusedIndex).toBe(-1);
    });

    it('handles CLOSE action cleanly on Escape or Tab', () => {
      const openState: SortListboxState = { isOpen: true, focusedIndex: 2 };
      const closed = sortListboxReducer(openState, { type: 'CLOSE' }, testOptions, 'release-desc');
      expect(closed.isOpen).toBe(false);
      expect(closed.focusedIndex).toBe(-1);
    });

    it('handles TYPEAHEAD prefix jumping to matching options', () => {
      const state: SortListboxState = { isOpen: true, focusedIndex: 0 };

      // Typing 'r' matches 'Release Order' (index 2)
      const matchR = sortListboxReducer(state, { type: 'TYPEAHEAD', char: 'r' }, testOptions, 'quality-desc');
      expect(matchR.focusedIndex).toBe(2);

      // Typing 'n' matches 'Name (A–Z)' (index 4)
      const matchN = sortListboxReducer(state, { type: 'TYPEAHEAD', char: 'n' }, testOptions, 'quality-desc');
      expect(matchN.focusedIndex).toBe(4);

      // Non-matching character keeps current focus
      const noMatch = sortListboxReducer(state, { type: 'TYPEAHEAD', char: 'z' }, testOptions, 'quality-desc');
      expect(noMatch.focusedIndex).toBe(0);
    });
  });

  describe('3. ServerModeSwitcher Keyboard Flow & Non-Color States', () => {
    it('renders role="radiogroup" with roving tabIndex and non-color-only indicator', () => {
      const htmlGacha = renderToStaticMarkup(
        <ServerModeSwitcher value="gacha" onChange={() => {}} />
      );

      expect(htmlGacha).toContain('role="radiogroup"');
      expect(htmlGacha).toContain('role="radio"');
      // Gacha active: tabIndex 0, aria-checked true
      expect(htmlGacha).toContain('aria-checked="true"');
      expect(htmlGacha).toContain('tabindex="0"');
      // Inactive MMO: tabIndex -1, aria-checked false
      expect(htmlGacha).toContain('aria-checked="false"');
      expect(htmlGacha).toContain('tabindex="-1"');
      // Active non-color indicator dot
      expect(htmlGacha).toContain('sim-mode-indicator');
      // Visible focus ring
      expect(htmlGacha).toContain('focus-visible:ring-2');

      const htmlMmo = renderToStaticMarkup(
        <ServerModeSwitcher value="mmo" onChange={() => {}} />
      );
      expect(htmlMmo).toContain('data-server-filter="mmo"');
      expect(htmlMmo).toContain('sim-mode-indicator');
    });

    it('switches mode on ArrowRight, ArrowDown, ArrowLeft, ArrowUp', () => {
      const onChange = vi.fn();
      const focusGacha = vi.fn();
      const focusMmo = vi.fn();

      // From gacha, ArrowRight switches to mmo
      const eventRight = { key: 'ArrowRight', preventDefault: vi.fn() };
      handleServerModeKeyDown(eventRight, 'gacha', onChange, focusGacha, focusMmo);
      expect(eventRight.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith('mmo');
      expect(focusMmo).toHaveBeenCalled();

      // From gacha, ArrowDown switches to mmo
      onChange.mockClear();
      const eventDown = { key: 'ArrowDown', preventDefault: vi.fn() };
      handleServerModeKeyDown(eventDown, 'gacha', onChange, focusGacha, focusMmo);
      expect(eventDown.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith('mmo');

      // From mmo, ArrowLeft switches to gacha
      onChange.mockClear();
      const eventLeft = { key: 'ArrowLeft', preventDefault: vi.fn() };
      handleServerModeKeyDown(eventLeft, 'mmo', onChange, focusGacha, focusMmo);
      expect(eventLeft.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith('gacha');
      expect(focusGacha).toHaveBeenCalled();

      // From mmo, ArrowUp switches to gacha
      onChange.mockClear();
      const eventUp = { key: 'ArrowUp', preventDefault: vi.fn() };
      handleServerModeKeyDown(eventUp, 'mmo', onChange, focusGacha, focusMmo);
      expect(eventUp.preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith('gacha');
    });
  });

  describe('4. FilterChip Keyboard Flow & Non-Color States', () => {
    it('supports aria-pressed for toggle buttons and roving tabIndex for tabs/radios', () => {
      // Standard button role (toggle)
      const htmlActiveBtn = renderToStaticMarkup(
        <FilterChip value="flame" variant="flame" active>
          Flame
        </FilterChip>
      );
      expect(htmlActiveBtn).toContain('aria-pressed="true"');
      expect(htmlActiveBtn).toContain('focus-visible:ring-2');
      expect(htmlActiveBtn).toContain('font-bold');

      const htmlInactiveBtn = renderToStaticMarkup(
        <FilterChip value="flame" variant="flame">
          Flame
        </FilterChip>
      );
      expect(htmlInactiveBtn).toContain('aria-pressed="false"');

      // Tab role
      const htmlActiveTab = renderToStaticMarkup(
        <FilterChip value="servants" role="tab" active>
          Servants
        </FilterChip>
      );
      expect(htmlActiveTab).toContain('role="tab"');
      expect(htmlActiveTab).toContain('aria-selected="true"');
      expect(htmlActiveTab).toContain('tabindex="0"');

      const htmlInactiveTab = renderToStaticMarkup(
        <FilterChip value="modules" role="tab">
          Modules
        </FilterChip>
      );
      expect(htmlInactiveTab).toContain('aria-selected="false"');
      expect(htmlInactiveTab).toContain('tabindex="-1"');
    });

    it('triggers onClick on Enter and Space keydown', () => {
      const onClick = vi.fn();
      const element = FilterChip({ value: 'volt', onClick, children: 'Volt' });

      const onKeyDown = element.props.onKeyDown;
      expect(typeof onKeyDown).toBe('function');

      onKeyDown({ key: 'Enter', preventDefault: vi.fn() });
      expect(onClick).toHaveBeenCalledWith('volt', expect.anything());

      onClick.mockClear();
      onKeyDown({ key: ' ', preventDefault: vi.fn() });
      expect(onClick).toHaveBeenCalledWith('volt', expect.anything());
    });
  });

  describe('5. CatalogSearch Keyboard Flow & Visible Focus', () => {
    it('renders visible focus ring and clears on Escape key', () => {
      const onChange = vi.fn();
      const html = renderToStaticMarkup(
        <CatalogSearch value="Lin" onChange={onChange} />
      );

      expect(html).toContain('focus-visible:ring-2');
      expect(html).toContain('sim-search-clear');

      // Test Escape keyboard handler
      const onClear = vi.fn();
      const onFlush = vi.fn();
      const eventEscape = { key: 'Escape', preventDefault: vi.fn() };
      handleSearchInputKeyDown(eventEscape, 'Lin', onClear, onFlush);

      expect(eventEscape.preventDefault).toHaveBeenCalled();
      expect(onClear).toHaveBeenCalled();
      expect(onFlush).not.toHaveBeenCalled();
    });

    it('flushes search on Enter key', () => {
      const onClear = vi.fn();
      const onFlush = vi.fn();
      const eventEnter = { key: 'Enter', preventDefault: vi.fn() };
      handleSearchInputKeyDown(eventEnter, 'Fiona', onClear, onFlush);

      expect(eventEnter.preventDefault).toHaveBeenCalled();
      expect(onFlush).toHaveBeenCalledWith('Fiona');
      expect(onClear).not.toHaveBeenCalled();
    });
  });

  describe('6. ResetFiltersButton Keyboard Flow & Visible Focus', () => {
    it('renders visible focus ring, aria-label, and activates on Enter/Space', () => {
      const onClick = vi.fn();
      const html = renderToStaticMarkup(
        <ResetFiltersButton visible onClick={onClick} />
      );

      expect(html).toContain('focus-visible:ring-2');
      expect(html).toContain('aria-label="Reset Filters"');

      const btn = ResetFiltersButton({ visible: true, onClick });
      const onKeyDown = btn!.props.onKeyDown;
      expect(typeof onKeyDown).toBe('function');

      onKeyDown({ key: 'Enter', preventDefault: vi.fn() });
      expect(onClick).toHaveBeenCalledTimes(1);

      onKeyDown({ key: ' ', preventDefault: vi.fn() });
      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });
});
