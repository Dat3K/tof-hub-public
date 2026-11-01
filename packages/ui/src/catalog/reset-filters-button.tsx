'use client';

import React from 'react';
import type { ResetFiltersButtonProps } from './types';

/**
 * ResetFiltersButton — Dynamic reset button (.sim-reset-filters-btn).
 * Displayed on the right edge of the bottom status bar only when filters,
 * search query, or non-default sort are active.
 */
export function ResetFiltersButton({
  id,
  onClick,
  visible = true,
  label = 'Reset Filters',
  className = '',
  title = 'Reset all filters',
  ariaLabel,
}: ResetFiltersButtonProps) {
  if (!visible) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <button
      id={id}
      type="button"
      className={[
        'sim-reset-filters-btn',
        'h-[26px] px-2.5 rounded-md text-[12px] font-semibold ml-auto',
        'inline-flex items-center gap-1.5 border border-[rgba(255,255,255,0.12)]',
        'bg-[rgba(255,255,255,0.05)] text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[rgba(255,255,255,0.1)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0d13]',
        'transition-colors duration-150 cursor-pointer select-none [[data-text-selectable]_&]:select-text font-sans',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      title={title}
      aria-label={ariaLabel || (typeof label === 'string' ? label : title)}
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
