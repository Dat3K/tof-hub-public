"use client";

import React from "react";
import type { ReactNode } from "react";
import type { CatalogControlsProps } from "./types";
import { CatalogSearch } from "./catalog-search";
import { ServerModeSwitcher } from "./server-mode-switcher";
import { CatalogSort } from "./catalog-sort";
import { CatalogCounter } from "./catalog-counter";
import { ResetFiltersButton } from "./reset-filters-button";
import { FilterGroup } from "./filter-group";
import { FilterChip } from "./filter-chip";

/**
 * CatalogControls — Composite container for the unified catalog controls bar (.sim-controls-bar).
 * Three-tier layout:
 * 1. Top Tier: Full-width search bar with debounce, clear button, and optional right-embedded Gacha/MMO switcher.
 * 2. Middle Tier: Two-column layout with left filter chip groups and right-pinned accessible sort listbox.
 * 3. Bottom Tier: Status bar with polite entity counter on the left and conditional reset filters button on the right.
 *
 * Can be used as a declarative unified component or composed flexibly using its compound subcomponents.
 */
export function CatalogControls({
  id,
  className = "",
  ariaLabel = "Filters",
  // Declarative props
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  searchSlot,
  leadingFilters,
  debounceMs,
  serverMode,
  onServerModeChange,
  serverModeAriaLabel,
  showServerMode = false,
  sortValue,
  onSortChange,
  sortOptions,
  sortLabel,
  count,
  total,
  entityLabel = "entities",
  counterFormat,
  hasActiveFilters = false,
  onResetFilters,
  resetLabel,
  children,
  textSelectable = false,
}: CatalogControlsProps) {
  // If declarative search or sort or counter is specified, render canonical 3-tier structure
  const isDeclarative =
    onSearchChange !== undefined ||
    onSortChange !== undefined ||
    count !== undefined ||
    onResetFilters !== undefined;

  if (isDeclarative) {
    const modeSwitcherNode =
      showServerMode && serverMode && onServerModeChange ? (
        <ServerModeSwitcher value={serverMode} onChange={onServerModeChange} ariaLabel={serverModeAriaLabel} />
      ) : null;

    return (
      <section
        id={id}
        data-search-accessory={Boolean(searchSlot) || undefined}
        aria-label={ariaLabel}
        data-text-selectable={textSelectable || undefined}
        className={[
          "sim-controls-bar",
          "relative z-20 w-full bg-[var(--surface-panel)] border border-[var(--surface-border)]",
          "rounded-xl p-[0.875rem_1.125rem] mb-5 flex flex-col gap-3 box-border font-sans backdrop-blur-md shadow-[0_0.5rem_2rem_rgba(0,0,0,0.4)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Tier 1: Top Row (Search + Embedded Gacha/MMO Switcher) */}
        {onSearchChange && (
          <CatalogSearch
            value={searchQuery ?? ""}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            debounceMs={debounceMs}
            serverModeSlot={searchSlot ?? modeSwitcherNode}
            serverModeSizing={searchSlot ? 'content' : 'fixed'}
            responsiveSlot={Boolean(searchSlot)}
            hasServerMode={Boolean(searchSlot ?? modeSwitcherNode)}
          />
        )}

        {leadingFilters && <CatalogControls.Middle><CatalogControls.Left>{leadingFilters}</CatalogControls.Left></CatalogControls.Middle>}
        {/* Tier 2: Middle Row (Filter Groups left, Sort right-pinned) */}
        {(children || (sortOptions && onSortChange && sortValue !== undefined)) && (
          <div className="sim-filter-groups flex flex-wrap items-center justify-between gap-x-4 gap-y-2 w-full box-border">
            {/* Left Column: Filter Chip Groups */}
            <div className="sim-filter-groups__left flex flex-wrap items-center gap-x-3.5 gap-y-2 flex-1 min-w-0">
              {children}
            </div>

            {/* Right Column: Pinned Sort Listbox */}
            {sortOptions && onSortChange && sortValue !== undefined && (
              <CatalogSort
                value={sortValue}
                onChange={onSortChange}
                options={sortOptions}
                label={sortLabel}
              />
            )}
          </div>
        )}

        {/* Tier 3: Bottom Row (Counter left, Reset button right) */}
        {(count !== undefined || (hasActiveFilters && onResetFilters)) && (
          <div className="sim-status-bar flex items-center justify-between w-full pt-1.5 mt-0 border-t border-[rgba(255,255,255,0.08)] text-[0.8rem] text-[#9ca3af] box-border">
            {count !== undefined && total !== undefined ? (
              <CatalogCounter
                count={count}
                total={total}
                entityLabel={entityLabel}
                formatString={counterFormat}
              />
            ) : (
              <span className="sim-status-count mr-auto" />
            )}

            {onResetFilters && (
              <ResetFiltersButton
                visible={hasActiveFilters}
                onClick={onResetFilters}
                label={resetLabel}
              />
            )}
          </div>
        )}
      </section>
    );
  }

  // Raw / custom compound usage
  return (
    <section
      id={id}
      data-text-selectable={textSelectable || undefined}
      aria-label={ariaLabel}
      className={[
        "sim-controls-bar",
        "relative z-20 w-full bg-[var(--surface-panel)] border border-[var(--surface-border)]",
        "rounded-xl p-[0.875rem_1.125rem] mb-5 flex flex-col gap-3 box-border font-sans backdrop-blur-md shadow-[0_0.5rem_2rem_rgba(0,0,0,0.4)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

// Compound components for granular composition
CatalogControls.Top = function CatalogControlsTop({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["sim-controls-top w-full", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
};

CatalogControls.Middle = function CatalogControlsMiddle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "sim-filter-groups",
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 w-full box-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
};

CatalogControls.Left = function CatalogControlsLeft({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "sim-filter-groups__left",
        "flex flex-wrap items-center gap-x-3.5 gap-y-2 flex-1 min-w-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
};

CatalogControls.Right = function CatalogControlsRight({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "sim-sort-box",
        "flex items-center gap-1.5 relative z-20 shrink-0 self-center",
        "ml-auto max-sm:w-full max-sm:ml-0 max-sm:self-stretch max-sm:justify-between max-sm:mt-1.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
};

CatalogControls.Bottom = function CatalogControlsBottom({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "sim-status-bar",
        "flex items-center justify-between w-full pt-1.5 mt-0 border-t border-[rgba(255,255,255,0.08)] text-[0.8rem] text-[#9ca3af] box-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
};

CatalogControls.Search = CatalogSearch;
CatalogControls.ModeSwitcher = ServerModeSwitcher;
CatalogControls.Group = FilterGroup;
CatalogControls.Chip = FilterChip;
CatalogControls.Sort = CatalogSort;
CatalogControls.Counter = CatalogCounter;
CatalogControls.Reset = ResetFiltersButton;
