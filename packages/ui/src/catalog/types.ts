import type { ReactNode, MouseEvent } from 'react';

/**
 * Server mode options for gameplay-divergent pages (simulacra, relics, pets).
 */
export type ServerMode = 'gacha' | 'mmo';

/**
 * Supported visual variants for catalog filter chips.
 * Maps to canonical legacy design tokens and neon glow themes.
 */
export type FilterVariant =
  | 'default'
  | 'all'
  // Neutral aggregate (e.g. Final on multype)
  | 'final'
  // Elements
  | 'phys'
  | 'physical'
  | 'flame'
  | 'fire'
  | 'frost'
  | 'volt'
  | 'altered'
  // Roles / Resonances
  | 'dps'
  | 'tank'
  | 'benediction'
  // Relic / Entity Properties
  | 'attack'
  | 'defense'
  | 'assist'
  | 'function'
  | 'survive'
  // Plain accent colour without a game meaning (e.g. a region: Korea on the Ranking board)
  | 'yellow'
  | 'indigo'
  // Rarity / Quality Tiers
  | 'ssr'
  | 'sr'
  | 'r'
  | 'n';

/**
 * Props for the FilterChip component.
 */
export interface FilterChipProps {
  /** Unique filter value identifier */
  value?: string;
  /** Optional display label. Falls back to children */
  label?: ReactNode;
  /** Whether this chip is currently active */
  active?: boolean;
  /** Visual variant theme (neon glow, color spectrum, or rarity gradient) */
  variant?: FilterVariant;
  /** Optional icon URL (string) or custom ReactNode */
  icon?: string | ReactNode;
  /** Accessible alt text for image icon */
  iconAlt?: string;
  /** Click handler */
  onClick?: (value: string, event: MouseEvent<HTMLButtonElement>) => void;
  /** WAI-ARIA role (default: 'button', or 'radio' / 'tab' for fundamental categories) */
  role?: string;
  /** WAI-ARIA selected state */
  'aria-selected'?: boolean;
  /** WAI-ARIA checked state */
  'aria-checked'?: boolean;
  /** ID of controlled element */
  'aria-controls'?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Optional tooltip title */
  title?: string;
  /** Custom CSS class names */
  className?: string;
  /** Child content */
  children?: ReactNode;
  /** Optional data-val attribute for legacy script compatibility */
  dataVal?: string;
}

/**
 * Props for the FilterGroup component.
 */
export interface FilterGroupProps {
  /** Group title label (e.g. "Element:", "Role:", "Category:") */
  label: ReactNode;
  /** Chips or controls inside the group */
  children: ReactNode;
  /** DOM ID */
  id?: string;
  /** Filter group identifier attribute */
  filterGroup?: string;
  /** Group layout variant */
  /** flow lets desktop chips wrap in the parent filter row; mobile retains the scrolling group. */
  layout?: 'row' | 'two-rows' | 'tabs' | 'flow';
  /** Additional container classes */
  className?: string;
  /** Custom label classes */
  labelClassName?: string;
  /** Accessible role (e.g. 'group', 'tablist', 'radiogroup') */
  role?: string;
  /** Accessible label */
  ariaLabel?: string;
}

/**
 * Props for the CatalogSearch input component.
 */
export interface CatalogSearchProps {
  /** Current search input value */
  value: string;
  /** Callback fired with debounced or cleared search string */
  onChange: (value: string) => void;
  /** Input placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds (default: 250ms) */
  debounceMs?: number;
  /** Slot for embedding the ServerModeSwitcher on the right side */
  serverModeSlot?: ReactNode;
  /** Measure variable-width embedded controls; fixed preserves the standard two-mode layout. */
  serverModeSizing?: 'fixed' | 'content';
  /** Move the accessory below the input on narrow screens. */
  responsiveSlot?: boolean;
  /** Whether server mode switcher is present (adjusts right padding) */
  hasServerMode?: boolean;
  /** Input element DOM ID */
  id?: string;
  /** Clear button accessible label */
  clearAriaLabel?: string;
  /** Additional wrapper CSS classes */
  className?: string;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Props for the ServerModeSwitcher component.
 */
/** Active colours; the role tones match the role FilterChip variants (Info Simulacra). */
export type ModeSwitcherTone = 'orange' | 'rose' | 'gold' | 'sky' | 'dps' | 'tank' | 'benediction';
export interface ModeSwitcherOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Active colour (default: 'orange') */
  tone?: ModeSwitcherTone;
  /** Optional icon (image URL) before the label, e.g. a role icon. */
  icon?: string;
}
export interface ModeSwitcherProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly ModeSwitcherOption<T>[];
  /** Data attribute carrying each option's value (default: 'data-mode') */
  dataAttribute?: `data-${string}`;
  className?: string;
  ariaLabel?: string;
  /** Embedded keeps the compact search-slot frame; standalone fits longer labels and can wrap options. */
  presentation?: 'embedded' | 'standalone';
}

export interface ServerModeSwitcherProps {
  /** Active server mode */
  value: ServerMode;
  /** Change callback */
  onChange: (mode: ServerMode) => void;
  /** Label for Gacha mode (default: 'Gacha') */
  gachaLabel?: ReactNode;
  /** Label for MMO mode (default: 'MMO') */
  mmoLabel?: ReactNode;
  /** Storage key for cross-page persistence (default: 'tof_server_mode') */
  storageKey?: string;
  /** Whether to sync mode with URL query parameter ?server= (default: false) */
  syncUrl?: boolean;
  /** Additional container CSS classes */
  className?: string;
  /** Accessible label for the radio group */
  ariaLabel?: string;
}

/**
 * Single sort option in the CatalogSort listbox.
 */
export interface SortOption {
  /** Option value key (e.g. 'quality-desc', 'name-asc') */
  value: string;
  /** Human-readable label with directional clarifier in parentheses (e.g. "Quality (High → Low)") */
  label: string;
  /** Optional visual divider line above this option */
  dividerBefore?: boolean;
  /** Whether this option is disabled */
  disabled?: boolean;
}

/**
 * Props for the custom accessible WAI-ARIA CatalogSort listbox component.
 */
export interface CatalogSortProps {
  /** Currently selected sort value */
  value: string;
  /** Selection change callback */
  onChange: (value: string) => void;
  /** Available sort options */
  options: SortOption[];
  /** Label text (default: 'Sort by:') */
  label?: ReactNode;
  /** DOM ID prefix */
  id?: string;
  /** Additional wrapper classes */
  className?: string;
  /** Name for the hidden fallback select */
  name?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Props for the CatalogCounter component.
 */
export interface CatalogCounterProps {
  /** DOM ID prefix */
  id?: string;
  /** Number of currently matching / visible entities */
  count: number;
  /** Total count of entities in the active category */
  total: number;
  /** Entity noun for default formatter (e.g. 'entities', 'simulacra') */
  entityLabel?: string;
  /** Optional custom formatter function */
  formatString?: (count: number, total: number, entityLabel: string) => ReactNode;
  /** Additional container classes */
  className?: string;
}

/**
 * Props for the ResetFiltersButton component.
 */
export interface ResetFiltersButtonProps {
  /** DOM ID */
  id?: string;
  /** Reset action callback */
  onClick: () => void;
  /** Whether the reset button should be visible (reactive to non-default state) */
  visible?: boolean;
  /** Button label (default: 'Reset Filters') */
  label?: ReactNode;
  /** Additional classes */
  className?: string;
  /** Button tooltip title */
  title?: string;
  /** Accessible label */
  ariaLabel?: string;
}

/**
 * Top-level props for CatalogControls composite component.
 */
export interface CatalogControlsProps {
  /** DOM element ID */
  id?: string;
  /** Additional container CSS classes */
  className?: string;
  /** Accessible landmark label (default: 'Filters') */
  ariaLabel?: string;
  /** Visitors can select and copy the text of chips, labels, switchers and the counter (Ranking); off in the Info catalogs. */
  textSelectable?: boolean;

  // Declarative convenience props (optional)
  /** Current search query */
  searchQuery?: string;
  /** Search query change handler */
  onSearchChange?: (query: string) => void;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Right-side search accessory; wraps below the input on narrow screens. */
  searchSlot?: ReactNode;
  /** Full-width filters above the row containing the pinned sort control. */
  leadingFilters?: ReactNode;
  /** Search debounce milliseconds */
  debounceMs?: number;

  /** Active server mode */
  serverMode?: ServerMode;
  /** Server mode change handler */
  onServerModeChange?: (mode: ServerMode) => void;
  /** Accessible name of the Gacha / MMO switcher; the app passes its translation. */
  serverModeAriaLabel?: string;
  /** Whether to render the server mode switcher */
  showServerMode?: boolean;

  /** Current sort value */
  sortValue?: string;
  /** Sort value change handler */
  onSortChange?: (value: string) => void;
  /** List of sort options */
  sortOptions?: SortOption[];
  /** Label for sort box */
  sortLabel?: ReactNode;

  /** Filtered entity count */
  count?: number;
  /** Total entity count */
  total?: number;
  /** Entity label for counter */
  entityLabel?: string;
  /** Custom counter formatter */
  counterFormat?: (count: number, total: number, entityLabel: string) => ReactNode;

  /** Whether active filters are applied (controls Reset button visibility) */
  hasActiveFilters?: boolean;
  /** Reset filters action handler */
  onResetFilters?: () => void;
  /** Reset filters button label */
  resetLabel?: ReactNode;

  /** Content / child filter groups */
  children?: ReactNode;
}
