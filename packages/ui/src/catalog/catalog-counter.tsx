'use client';

import React from 'react';
import type { CatalogCounterProps } from './types';

/**
 * CatalogCounter — Dynamic entity count indicator (.sim-status-count).
 * Conforms strictly to:
 * - `aria-live="polite"` for accessible screen-reader announcement
 * - Exact format: "Showing <strong>X</strong> of <strong>Y</strong> [entities]"
 * - Data attributes data-page-count and data-page-total for automated parity testing
 */
export function CatalogCounter({
  id,
  count,
  total,
  entityLabel = 'entities',
  formatString,
  className = '',
}: CatalogCounterProps) {
  return (
    <span
      id={id}
      className={[
        'sim-status-count',
        'text-[12.8px] text-[#9ca3af] mr-auto inline-flex items-center gap-1 font-sans',
        'select-none [[data-text-selectable]_&]:select-text',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
      aria-atomic="true"
    >
      {formatString ? (
        formatString(count, total, entityLabel)
      ) : (
        <>
          <span>Showing</span>{' '}
          <strong className="font-bold text-[#f4f0f6]" data-page-count>
            {count}
          </strong>{' '}
          <span>of</span>{' '}
          <strong className="font-bold text-[#f4f0f6]" data-page-total>
            {total}
          </strong>{' '}
          <span>{entityLabel}</span>
        </>
      )}
    </span>
  );
}
