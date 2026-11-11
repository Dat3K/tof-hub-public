"use client";

import React, { useReducer, useRef, useEffect, useLayoutEffect, useId, useCallback } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { CatalogSortProps, SortOption } from "./catalog/types";

export interface SortListboxProps extends CatalogSortProps {
  /** Optional icon or indicator displayed inside trigger */
  icon?: ReactNode;
  /** Rich option content; string labels still drive typeahead and accessible names. */
  renderOption?: (option: SortOption) => ReactNode;
  /** Full-width form field rather than a compact catalog sort control. */
  presentation?: 'catalog' | 'field' | 'inline';
  /** Space reserved at the top of the viewport for fixed chrome in field presentation. */
  viewportTopInset?: number;
}

export interface SortListboxState {
  isOpen: boolean;
  focusedIndex: number;
}

export type SortListboxAction =
  | { type: "OPEN"; focusTarget?: "first" | "last" | "selected" }
  | { type: "CLOSE" }
  | { type: "TOGGLE"; focusTarget?: "first" | "last" | "selected" }
  | { type: "MOVE_FOCUS"; delta: number }
  | { type: "SET_FOCUS_INDEX"; index: number }
  | { type: "TYPEAHEAD"; char: string };

/**
 * Helper to find the first enabled option index.
 */
export function getFirstEnabledOptionIndex(options: SortOption[]): number {
  return options.findIndex((opt) => !opt.disabled);
}

/**
 * Helper to find the last enabled option index.
 */
export function getLastEnabledOptionIndex(options: SortOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) {
    if (!options[i]?.disabled) return i;
  }
  return -1;
}

/**
 * Helper to calculate the next enabled index with cyclic wrapping, skipping disabled options.
 */
export function getNextEnabledOptionIndex(
  options: SortOption[],
  startIndex: number,
  delta: number,
): number {
  const total = options.length;
  if (total === 0) return -1;
  let idx = startIndex >= 0 ? startIndex : 0;
  for (let i = 0; i < total; i++) {
    idx = (idx + delta + total) % total;
    if (!options[idx]?.disabled) {
      return idx;
    }
  }
  return startIndex;
}

/**
 * Pure state reducer governing SortListbox keyboard and focus transitions.
 */
export function sortListboxReducer(
  state: SortListboxState,
  action: SortListboxAction,
  options: SortOption[],
  selectedValue: string,
): SortListboxState {
  const selectedIndex = options.findIndex((opt) => opt.value === selectedValue);

  switch (action.type) {
    case "OPEN": {
      let targetIndex = -1;
      if (action.focusTarget === "first") {
        targetIndex = getFirstEnabledOptionIndex(options);
      } else if (action.focusTarget === "last") {
        targetIndex = getLastEnabledOptionIndex(options);
      } else {
        targetIndex =
          selectedIndex >= 0 && !options[selectedIndex]?.disabled
            ? selectedIndex
            : getFirstEnabledOptionIndex(options);
      }
      return {
        isOpen: true,
        focusedIndex: targetIndex,
      };
    }

    case "CLOSE":
      return {
        isOpen: false,
        focusedIndex: -1,
      };

    case "TOGGLE": {
      if (state.isOpen) {
        return {
          isOpen: false,
          focusedIndex: -1,
        };
      }
      return sortListboxReducer(
        state,
        { type: "OPEN", focusTarget: action.focusTarget ?? "selected" },
        options,
        selectedValue,
      );
    }

    case "MOVE_FOCUS": {
      const current =
        state.focusedIndex >= 0 ? state.focusedIndex : selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex = getNextEnabledOptionIndex(options, current, action.delta);
      return {
        ...state,
        isOpen: true,
        focusedIndex: nextIndex,
      };
    }

    case "SET_FOCUS_INDEX": {
      if (action.index < 0 || action.index >= options.length || options[action.index]?.disabled) {
        return state;
      }
      return {
        ...state,
        isOpen: true,
        focusedIndex: action.index,
      };
    }

    case "TYPEAHEAD": {
      const char = action.char.toLowerCase();
      const matchIndex = options.findIndex(
        (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(char),
      );
      if (matchIndex >= 0) {
        return {
          ...state,
          isOpen: true,
          focusedIndex: matchIndex,
        };
      }
      return state;
    }

    default:
      return state;
  }
}

export interface UseSortListboxOptions {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  disabled?: boolean;
}

/**
 * useSortListbox — Custom hook providing state and keyboard flow handlers for WAI-ARIA listboxes.
 */
export function useSortListbox({
  value,
  onChange,
  options,
  disabled = false,
}: UseSortListboxOptions) {
  const [state, dispatch] = useReducer(
    (s: SortListboxState, a: SortListboxAction) => sortListboxReducer(s, a, options, value),
    { isOpen: false, focusedIndex: -1 },
  );

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const currentOption = options[selectedIndex >= 0 ? selectedIndex : 0];

  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setOpen = useCallback(
    (next: boolean, focusTarget?: "first" | "last" | "selected") => {
      if (disabled && next) return;
      if (next) {
        dispatch({ type: "OPEN", focusTarget });
      } else {
        dispatch({ type: "CLOSE" });
      }
    },
    [disabled],
  );

  const commitOption = useCallback(
    (option: SortOption) => {
      if (option.disabled || disabled) return;
      onChange(option.value);
      dispatch({ type: "CLOSE" });
    },
    [disabled, onChange],
  );

  const moveFocus = useCallback((delta: number) => {
    dispatch({ type: "MOVE_FOCUS", delta });
  }, []);

  const handleTypeahead = useCallback(
    (char: string) => {
      if (typeaheadTimerRef.current) {
        clearTimeout(typeaheadTimerRef.current);
      }
      typeaheadRef.current += char.toLowerCase();

      const matchIndex = options.findIndex(
        (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(typeaheadRef.current),
      );
      if (matchIndex >= 0) {
        dispatch({ type: "SET_FOCUS_INDEX", index: matchIndex });
      }

      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = "";
      }, 600);
    },
    [options],
  );

  const handleTriggerKeyDown = useCallback(
    (event: { key: string; preventDefault?: () => void }) => {
      if (disabled) return;
      if (event.key === "ArrowDown") {
        event.preventDefault?.();
        if (!state.isOpen) {
          dispatch({ type: "OPEN", focusTarget: "selected" });
        } else {
          dispatch({ type: "MOVE_FOCUS", delta: 1 });
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault?.();
        if (!state.isOpen) {
          dispatch({ type: "OPEN", focusTarget: "last" });
        } else {
          dispatch({ type: "MOVE_FOCUS", delta: -1 });
        }
      } else if (event.key === "Home") {
        event.preventDefault?.();
        dispatch({ type: "OPEN", focusTarget: "first" });
      } else if (event.key === "End") {
        event.preventDefault?.();
        dispatch({ type: "OPEN", focusTarget: "last" });
      } else if (event.key === "PageUp") {
        event.preventDefault?.();
        dispatch({ type: "OPEN", focusTarget: "first" });
      } else if (event.key === "PageDown") {
        event.preventDefault?.();
        dispatch({ type: "OPEN", focusTarget: "last" });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault?.();
        dispatch({ type: "TOGGLE", focusTarget: "selected" });
      } else if (event.key === "Escape" && state.isOpen) {
        event.preventDefault?.();
        dispatch({ type: "CLOSE" });
      } else if (event.key === "Tab" && state.isOpen) {
        dispatch({ type: "CLOSE" });
      }
    },
    [disabled, state.isOpen],
  );

  const handleMenuKeyDown = useCallback(
    (event: {
      key: string;
      preventDefault?: () => void;
      altKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
    }) => {
      if (disabled) return;
      if (event.key === "ArrowDown") {
        event.preventDefault?.();
        dispatch({ type: "MOVE_FOCUS", delta: 1 });
      } else if (event.key === "ArrowUp") {
        event.preventDefault?.();
        dispatch({ type: "MOVE_FOCUS", delta: -1 });
      } else if (event.key === "Home" || event.key === "PageUp") {
        event.preventDefault?.();
        const first = getFirstEnabledOptionIndex(options);
        if (first >= 0) dispatch({ type: "SET_FOCUS_INDEX", index: first });
      } else if (event.key === "End" || event.key === "PageDown") {
        event.preventDefault?.();
        const last = getLastEnabledOptionIndex(options);
        if (last >= 0) dispatch({ type: "SET_FOCUS_INDEX", index: last });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault?.();
        if (state.focusedIndex >= 0 && options[state.focusedIndex]) {
          commitOption(options[state.focusedIndex]);
        }
      } else if (event.key === "Escape") {
        event.preventDefault?.();
        dispatch({ type: "CLOSE" });
      } else if (event.key === "Tab") {
        dispatch({ type: "CLOSE" });
      } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
        handleTypeahead(event.key);
      }
    },
    [commitOption, disabled, handleTypeahead, options, state.focusedIndex],
  );

  return {
    isOpen: state.isOpen,
    focusedIndex: state.focusedIndex,
    selectedIndex,
    currentOption,
    setOpen,
    commitOption,
    moveFocus,
    handleTriggerKeyDown,
    handleMenuKeyDown,
    handleTypeahead,
    dispatch,
  };
}

/**
 * SortListbox — Custom accessible WAI-ARIA Sort Listbox (.sim-sort-box, .sim-sort-control).
 * Strictly pinned to the right edge with single-line invariant, keyboard navigation,
 * cyclic arrow keys, Home/End, Escape restore, typeahead, click-outside dismissal,
 * visible focus ring, non-color-only selected checkmark state, and synchronized native select fallback.
 */
export function SortListbox({
  value,
  onChange,
  options,
  label = "Sort by:",
  id,
  className = "",
  name = "sort",
  ariaLabel = "Sort options",
  disabled = false,
  renderOption,
  presentation = 'catalog',
  viewportTopInset = 0,
}: SortListboxProps) {
  const generatedId = useId();
  const baseId = id ?? `sim-sort-${generatedId}`;
  const triggerId = `${baseId}-trigger`;
  const menuId = `${baseId}-menu`;
  const labelId = `${baseId}-label`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = useCallback((next: string) => {
    onChange(next);
    triggerRef.current?.focus();
  }, [onChange]);

  const {
    isOpen,
    setOpen,
    focusedIndex,
    currentOption,
    commitOption,
    handleTriggerKeyDown,
    handleMenuKeyDown,
  } = useSortListbox({
    value,
    onChange: select,
    options,
    disabled,
  });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!isOpen || presentation !== 'field' || !menu || !trigger) return;

    const viewport = window.visualViewport;
    const fitMenu = () => {
      const anchor = trigger.getBoundingClientRect();
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const margin = 16;
      const below = viewportBottom - anchor.bottom - margin;
      const above = anchor.top - Math.max(viewportTop, viewportTopInset) - margin;
      const openAbove = below < 128 && above > below;

      menu.dataset.side = openAbove ? 'above' : 'below';
      menu.style.setProperty('--sort-menu-viewport-height', `${Math.max(0, openAbove ? above : below)}px`);
    };

    fitMenu();
    window.addEventListener('resize', fitMenu);
    window.addEventListener('scroll', fitMenu, {passive: true});
    viewport?.addEventListener('resize', fitMenu);
    return () => {
      window.removeEventListener('resize', fitMenu);
      window.removeEventListener('scroll', fitMenu);
      viewport?.removeEventListener('resize', fitMenu);
      delete menu.dataset.side;
      menu.style.removeProperty('--sort-menu-viewport-height');
    };
  }, [isOpen, presentation, viewportTopInset]);

  // Focus the option element when focusedIndex changes while open
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  // Click outside / pointerdown dismissal & ancestor bar state toggle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bar = container.closest('.sim-controls-bar, [class*="controls-bar"]');
    if (bar) bar.classList.toggle("has-open-sort", isOpen);
    const section = container.closest('[class*="controls-section"], section');
    if (section && section !== bar) section.classList.toggle("has-open-sort", isOpen);

    if (!isOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
      if (container && !container.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      if (bar) bar.classList.remove("has-open-sort");
      if (section && section !== bar) section.classList.remove("has-open-sort");
    };
  }, [isOpen, setOpen]);

  const focusedOptionId = isOpen && focusedIndex >= 0 ? `${menuId}-opt-${focusedIndex}` : undefined;

  return (
    <div
      ref={containerRef}
      className={[
        "sim-sort-box",
        "flex gap-1.5 relative z-20 shrink-0",
        // Pin to right edge on desktop, stretch on mobile
        presentation === 'field' ? "w-full min-w-0 self-stretch flex-col items-stretch" : presentation === 'inline' ? "items-center self-center min-w-0" : "items-center self-center ml-auto max-sm:w-full max-sm:ml-0 max-sm:self-stretch max-sm:justify-between max-sm:mt-1.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <span
          id={labelId}
          className={`sim-filter-label text-[0.6875rem] font-bold uppercase tracking-[0.03em] leading-none text-[#9ca3af] shrink-0 select-none mr-0.5 inline-flex items-center h-7 ${presentation==='inline'?'max-sm:hidden':''}`}
        >
          {label}
        </span>
      )}

      <div
        data-sort-listbox
        className={[
          "sim-sort-control",
          presentation === 'field' ? "relative w-full min-w-0" : presentation === 'inline' ? "relative w-[min(13.75rem,46vw)] max-sm:w-[min(9.375rem,38vw)] min-w-0" : "relative min-w-[min(16.5rem,78vw)] max-sm:flex-1 max-sm:min-w-0",
          isOpen ? "is-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-labelledby={label ? `${labelId} ${triggerId}` : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-activedescendant={focusedOptionId}
          disabled={disabled}
          onClick={() => setOpen(!isOpen, "selected")}
          onKeyDown={(e) => {
            handleTriggerKeyDown(e);
            if (e.key === "Escape" && isOpen) {
              triggerRef.current?.focus();
            }
          }}
          className={[
            "sim-sort-trigger",
            "min-h-7 px-3 py-[0.1875rem] rounded-lg border border-[var(--surface-border-strong)]",
            "bg-[var(--surface-panel)] text-[0.75rem] font-[650] tracking-[0.01em] text-[#f4f8ff]",
            "flex items-center justify-between gap-2 w-full cursor-pointer select-none",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
            "hover:border-[rgba(255,255,255,0.24)]",
            "transition-[border-color,background-color,box-shadow] duration-150",
            isOpen
              ? "border-[#38bdf8] shadow-[0_0_0_0.125rem_rgba(56,189,248,0.12)]"
              : "",
            // Visible focus indicator
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ba6df] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d13] focus-visible:border-[#2ba6df]",
            disabled ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {/* Single-line invariant strictly enforced */}
          <span
            data-sort-value
            className="sim-sort-trigger__value truncate whitespace-nowrap overflow-hidden text-ellipsis flex-1 text-left"
          >
            {currentOption ? renderOption?.(currentOption) ?? currentOption.label : value}
          </span>

          <svg
            className={[
              "sim-sort-trigger__chevron",
              "w-[0.875rem] h-[0.875rem] shrink-0 transition-transform duration-200",
              "text-[#9ca3af]",
              isOpen ? "rotate-180" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 7 5 5 5-5" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-orientation="vertical"
          aria-labelledby={label ? labelId : triggerId}
          aria-activedescendant={focusedOptionId}
          hidden={!isOpen}
          onKeyDown={(e) => {
            handleMenuKeyDown(e);
            if (e.key === "Escape") {
              triggerRef.current?.focus();
            }
          }}
          className={[
            "sim-sort-menu",
            "absolute left-0 right-0 top-[calc(100%+0.4375rem)] z-[120]",
            presentation === 'field' ? "w-full min-w-full max-w-full sim-sort-menu--field" : presentation === 'inline' ? "w-max min-w-full max-w-[min(21.25rem,calc(100vw-2rem))]" : "w-full min-w-full max-w-[min(21.25rem,92vw)]",
            presentation === 'inline' ? "left-0 right-auto" : "max-sm:left-0 max-sm:right-0 max-sm:w-full",
            "bg-[var(--surface-panel)] border border-[var(--surface-border-strong)]",
            "rounded-[0.8125rem] p-1.5 shadow-[0_0.75rem_1.875rem_rgba(0,0,0,0.32)] flex flex-col gap-[0.1875rem] outline-none",
            !isOpen ? "hidden" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isFocused = index === focusedIndex;
            const optId = `${menuId}-opt-${index}`;

            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                id={optId}
                type="button"
                role="option"
                data-sort-option
                data-value={option.value}
                aria-selected={isSelected}
                aria-label={option.label}
                aria-disabled={option.disabled ? "true" : undefined}
                disabled={option.disabled}
                tabIndex={isFocused ? 0 : -1}
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  commitOption(option);
                }}
                className={[
                  "sim-sort-option",
                  presentation === 'field' ? "shrink-0" : "",
                  "min-h-[1.75rem] max-sm:min-h-[2.25rem] px-2.5 py-1 max-sm:py-2 rounded-md text-[0.75rem] font-[560] leading-[1.25]",
                  "text-left w-full cursor-pointer flex items-center justify-between gap-2 border border-transparent transition-[color,background-color,border-color] outline-none font-sans",
                  // Visible focus indicator
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2ba6df] focus-visible:ring-inset",
                  // Single-line invariant
                  "whitespace-nowrap overflow-hidden text-ellipsis",
                  option.dividerBefore
                    ? "sim-sort-option--divider mt-[0.5rem] pt-[0.25rem] border-t border-[var(--surface-border)]"
                    : "",
                  isSelected
                    ? "is-selected bg-[rgba(43,166,223,0.16)] text-[#78d5f8] border-[rgba(43,166,223,0.28)] font-bold"
                    : isFocused
                      ? "bg-[var(--surface-hover)] border-[var(--surface-border-strong)] text-white"
                      : "bg-transparent text-[#cbd6e7] hover:bg-[var(--surface-hover)] hover:text-white hover:border-[var(--surface-border-strong)]",
                  option.disabled ? "opacity-40 cursor-not-allowed" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                  {renderOption?.(option) ?? option.label}
                </span>

                {/* Non-color-only state indicator: checkmark icon on selected option */}
                {isSelected && (
                  <svg
                    aria-hidden="true"
                    className="sim-sort-check w-[1.0625rem] h-[1.0625rem] text-current shrink-0"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m4 10.5 4.2 3.5L16 6" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Hidden Fallback Native Select for Form & Automated Sync */}
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="sim-sort-select sim-sort-native sr-only"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Canonical alias
export const CatalogSort = SortListbox;
