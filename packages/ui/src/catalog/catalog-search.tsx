'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useId } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import type { CatalogSearchProps } from './types';

/**
 * Pure keyboard handler for CatalogSearch input Escape and Enter shortcuts.
 */
export function handleSearchInputKeyDown(
  event: { key: string; preventDefault?: () => void },
  query: string,
  onClear: () => void,
  onFlush: (query: string) => void
): void {
  if (event.key === 'Escape' && query.length > 0) {
    event.preventDefault?.();
    onClear();
  } else if (event.key === 'Enter') {
    event.preventDefault?.();
    onFlush(query);
  }
}

/**
 * CatalogSearch — Full-width search bar (.sim-search-box) with instant local input,
 * debounced callback dispatch, clear (×) button, and optional right-embedded Gacha/MMO switcher.
 */
export function CatalogSearch({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 250,
  serverModeSlot,
  serverModeSizing = 'fixed',
  responsiveSlot = false,
  hasServerMode = Boolean(serverModeSlot),
  id,
  clearAriaLabel = 'Clear search',
  className = '',
  autoFocus = false,
  disabled = false,
}: CatalogSearchProps) {
  const generatedId = useId();
  const inputId = id ?? `sim-search-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const [modeWidth, setModeWidth] = useState(124);
  useLayoutEffect(() => {
    const mode = modeRef.current;
    if (serverModeSizing !== 'content' || !mode) return;
    const measure = () => setModeWidth(Math.ceil(mode.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(mode);
    return () => observer.disconnect();
  }, [serverModeSizing, hasServerMode]);

  // Local state for immediate typing responsiveness
  const [query, setQuery] = useState(value);
  const isFirstRender = useRef(true);

  // Synchronize local input state with external value changes (e.g. filter resets)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced callback emission
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      if (query !== value) {
        onChange(query);
      }
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [query, debounceMs, onChange, value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setQuery('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    handleSearchInputKeyDown(
      event,
      query,
      () => {
        setQuery('');
        onChange('');
      },
      (q) => {
        onChange(q);
      }
    );
  };

  const hasContent = query.length > 0;

  return (
    <div
      data-responsive-slot={responsiveSlot || undefined}
      className={[
        'sim-search-box',
        'relative w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="relative w-full">
        {/* Search Icon */}
        <svg
          className="sim-search-icon pointer-events-none absolute left-2.5 top-1/2 h-[.875rem] w-[.875rem] -translate-y-1/2 text-[#9ca3af] shrink-0"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        {/* Full-width Search Input */}
        <input
          ref={inputRef}
          type="text"
          id={inputId}
          aria-label={placeholder}
          name="catalog-search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          style={hasServerMode && serverModeSizing === 'content' ? {paddingRight: responsiveSlot ? `var(--catalog-slot-padding, min(calc(${modeWidth}px + 2.25rem), calc(100% - 2.5rem)))` : `min(calc(${modeWidth}px + 2.25rem), calc(100% - 2.5rem))`} : undefined}
          className={[
            'sim-search-input',
            'w-full h-8 rounded-md border',
            'text-[0.8125rem] font-normal leading-[1.3] text-[#f3f4f6] placeholder-[#6b7280]',
            'pl-8 transition-colors duration-150 font-sans',
            'focus:outline-none',
            disabled ? 'opacity-40 cursor-not-allowed' : '',
            // Adjust right padding when Gacha/MMO switcher is embedded
            hasServerMode ? 'pr-[10rem]' : 'pr-8',
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {/* Clear Button (×) */}
        {hasContent && (
          <button
            type="button"
            className={[
              'sim-search-clear',
              'absolute top-1/2 -translate-y-1/2 z-[2] w-5 h-5 rounded',
              'flex items-center justify-center text-[#9ca3af] hover:text-[#f3f4f6]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0d13]',
              'text-[1.125rem] leading-none transition-colors cursor-pointer',
              hasServerMode ? 'right-[8.5rem]' : 'right-2',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={handleClear}
            style={hasServerMode && serverModeSizing === 'content' ? {right: responsiveSlot ? `var(--catalog-slot-clear-right, calc(${modeWidth}px + .75rem))` : `calc(${modeWidth}px + .75rem)`} : undefined}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                handleClear(e as unknown as MouseEvent<HTMLButtonElement>);
              }
            }}
            aria-label={clearAriaLabel}
            title={clearAriaLabel}
          >
            &times;
          </button>
        )}

        {/* Embedded Server Mode Switcher */}
        {serverModeSlot && (
          <div ref={modeRef} className={`sim-search-accessory inline-flex absolute right-1 top-1/2 z-[2] ${responsiveSlot ? 'sm:-translate-y-1/2' : '-translate-y-1/2'}`}>
            {serverModeSlot}
          </div>
        )}
      </div>
    </div>
  );
}
