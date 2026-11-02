'use client';

import React from 'react';
import type { FilterGroupProps } from './types';
import {revealHorizontalFocus} from '../utils/reveal-horizontal-focus';

/**
 * FilterGroup — Logical grouping container for filter chips (.sim-filter-group).
 * Renders uppercase bold group label and supports row, balanced two-rows, or tab layouts.
 * Supports standard filters with All and fundamental category switchers without All.
 */
export function FilterGroup({
  label,
  children,
  id,
  filterGroup,
  layout = 'row',
  className = '',
  labelClassName = '',
  role = 'group',
  ariaLabel,
}: FilterGroupProps) {
  const isTablist = role === 'tablist' || layout === 'tabs';

  return (
    <div
      id={id}
      data-filter-group={filterGroup}
      role={role}
      aria-label={ariaLabel}
      onFocusCapture={revealHorizontalFocus}
      className={[
        'sim-filter-group',
        layout === 'flow' ? 'sim-filter-group--flow' : '',
        'flex items-center gap-1.5 flex-wrap max-sm:w-full max-sm:gap-1.5',
        layout === 'two-rows' ? 'items-start gap-2' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'sim-filter-label',
          'text-[0.6875rem] font-bold uppercase tracking-[0.03em] leading-none text-[#9ca3af] shrink-0 select-none [[data-text-selectable]_&]:select-text mr-1 inline-flex items-center h-[1.625rem] max-sm:w-full max-sm:mr-0 max-sm:mb-0.5 max-sm:h-auto',
          labelClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </span>

      {layout === 'two-rows' ? (
        <div className="outfits-filter-chips outfits-filter-chips--two-rows flex flex-col gap-1 w-full sm:w-auto">
          {children}
        </div>
      ) : isTablist ? (
        <div className="pets-tab-bar flex items-center gap-1.5 flex-wrap" role="tablist">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
