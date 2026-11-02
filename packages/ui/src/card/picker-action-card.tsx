'use client';

import React from 'react';

export interface PickerActionCardProps {
  /** Glyph in the dashed circle (an emoji, a character or an inline SVG). */
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Dashed action tile placed before the catalog items of a picker grid (custom text, own image upload).
 * Used by the Comp item picker and the Build background picker; it fills its grid cell's height.
 */
export function PickerActionCard({ icon, title, description, onClick, ariaLabel, className = '' }: PickerActionCardProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        'group flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[0.625rem] border border-dashed border-white/25 bg-white/[0.02] px-2.5 py-3.5 text-center text-inherit transition-all duration-200',
        'hover:-translate-y-0.5 hover:scale-[1.02] hover:border-[#38bdf8] hover:bg-[rgba(56,189,248,0.08)] hover:shadow-[0_0.5rem_1.25rem_rgba(0,0,0,0.4),0_0_0.875rem_rgba(56,189,248,0.25)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <span aria-hidden="true" className="flex h-[3.125rem] w-[3.125rem] items-center justify-center rounded-full border border-dashed border-white/30 bg-black/25 text-2xl text-[#38bdf8] transition-all duration-200 group-hover:scale-[1.08] group-hover:border-[#38bdf8] group-hover:bg-[rgba(56,189,248,0.15)]">
        {icon}
      </span>
      <span className="w-full font-sans text-[0.8125rem] font-bold leading-[1.35] text-[#f8fafc]">{title}</span>
      {description && <span className="w-full font-sans text-[0.59375rem] text-[#94a3b8]">{description}</span>}
    </button>
  );
}
