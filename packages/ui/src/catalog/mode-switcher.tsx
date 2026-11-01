'use client';

import React from 'react';
import type { ModeSwitcherProps, ModeSwitcherTone } from './types';

const TONE_CLASSES: Record<ModeSwitcherTone, string> = {
  orange: 'bg-[rgba(249,115,22,0.22)] border-[#fb923c] text-[#fdba74] shadow-[0_0_8px_rgba(249,115,22,0.35)]',
  rose: 'bg-[rgba(225,29,72,0.22)] border-[#f43f5e] text-[#fda4af] shadow-[0_0_8px_rgba(225,29,72,0.35)]',
  gold: 'bg-[rgba(245,217,122,0.2)] border-[#f5d97a] text-[#fde68a] shadow-[0_0_8px_rgba(245,217,122,0.3)]',
  sky: 'bg-[rgba(56,189,248,0.2)] border-[#38bdf8] text-[#bae6fd] shadow-[0_0_8px_rgba(56,189,248,0.3)]',
  dps: 'bg-[rgba(239,68,68,0.22)] border-[#ef4444] text-[#fca5a5] shadow-[0_0_8px_rgba(239,68,68,0.35)]',
  tank: 'bg-[rgba(59,130,246,0.22)] border-[#3b82f6] text-[#93c5fd] shadow-[0_0_8px_rgba(59,130,246,0.35)]',
  benediction: 'bg-[rgba(16,185,129,0.22)] border-[#10b981] text-[#6ee7b7] shadow-[0_0_8px_rgba(16,185,129,0.35)]',
};

/** Index selected by an arrow key (cyclic), or null for any other key. */
export function getNextModeIndex(key: string, current: number, length: number): number | null {
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  return step && length ? (current + step + length) % length : null;
}

/**
 * ModeSwitcher — compact radio toggle (.sim-mode-toggle) that fits the search bar's embedded slot.
 * ServerModeSwitcher (Gacha / MMO) is this control with persistence; other pages pass their own options.
 * Arrow keys move the selection and focus, wrapping at both ends.
 */
export function ModeSwitcher<T extends string>({
  value,
  onChange,
  options,
  dataAttribute = 'data-mode',
  className = '',
  ariaLabel = 'Mode',
  presentation = 'embedded',
}: ModeSwitcherProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((option) => option.value === value));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = getNextModeIndex(event.key, current, options.length);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={[
        presentation === 'standalone' ? 'sim-mode-standalone' : 'sim-mode-toggle',
        'inline-flex items-center bg-[var(--surface-inset)] border border-[var(--surface-border-strong)] rounded-[5px] p-[2px] gap-[2px] select-none [[data-text-selectable]_&]:select-text box-border',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-active-mode={value}
      style={{'--mode-active-index': current, '--mode-option-count': options.length} as React.CSSProperties}
      data-presentation={presentation}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            tabIndex={active ? 0 : -1}
            className={[
              'sim-filter-btn sim-mode-btn',
              `sim-filter-btn--${option.tone ?? 'orange'} sim-mode-btn--${option.tone ?? 'orange'}`,
              'rounded-[3px] border cursor-pointer transition-all duration-200 select-none [[data-text-selectable]_&]:select-text flex items-center justify-center font-sans',
              presentation === 'standalone'
                ? 'min-h-8 px-3 py-2 text-xs leading-tight whitespace-nowrap gap-1.5'
                : 'h-5 max-sm:h-7 min-w-[46px] max-sm:min-w-[56px] px-1.5 max-sm:px-2.5 text-[11px] max-sm:text-xs leading-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0d13]',
              active
                ? `active is-active ${TONE_CLASSES[option.tone ?? 'orange']} font-bold`
                : 'border-transparent bg-transparent text-[#9ca3af] font-semibold hover:text-[#f3f4f6] hover:bg-[rgba(255,255,255,0.08)]',
            ]
              .filter(Boolean)
              .join(' ')}
            {...{ [dataAttribute]: option.value }}
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) onChange(option.value);
            }}
          >
            <span className="sim-mode-indicator" aria-hidden="true" />
            {option.icon && <img src={option.icon} alt="" aria-hidden="true" className="mr-1 h-3.5 w-3.5 object-contain" />}
            {/* The bold state is reserved by an invisible ::after copy, so selecting never changes the button width. */}
            <span
              data-label={typeof option.label === 'string' ? option.label : undefined}
              className={typeof option.label === 'string'
                ? "inline-flex flex-col items-center after:content-[attr(data-label)] after:block after:h-0 after:overflow-hidden after:invisible after:font-bold after:pointer-events-none"
                : undefined}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
