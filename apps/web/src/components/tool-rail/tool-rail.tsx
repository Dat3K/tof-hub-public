'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Fixed tool navigation rail: right edge on desktop, bottom centre on phones.
 * Used by Wish Tracker and Build card; items are links, page tabs or dialog triggers.
 */
export type ToolRailTone = 'accent' | 'gold' | 'sky' | 'neutral';
export interface ToolRailItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  /** The current page or tab. */
  active?: boolean;
  /** `accent` marks the primary action (import/download) even when inactive. */
  tone?: ToolRailTone;
  /** Temporarily unavailable button action. Links retain their navigation behavior. */
  disabled?: boolean;
}

const ACTIVE: Record<ToolRailTone, string> = {
  accent: 'border-sky-300/40 bg-sky-300/15 text-sky-100',
  gold: 'border-amber-400/40 bg-amber-400/15 text-amber-200 shadow-sm',
  sky: 'border-sky-400/50 bg-sky-400/15 text-sky-300 shadow-sm',
  neutral: 'border-white/20 bg-white/10 text-white',
};
// Square buttons with the same 5px corners as the tool toolbar; never stretched to the rail width.
const BASE = 'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 disabled:pointer-events-none disabled:opacity-40';
const IDLE = 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white';
const PRIMARY = 'border-white/10 bg-white/[0.04] text-sky-300 hover:border-sky-300/40 hover:bg-sky-300/10 hover:text-sky-100';

// Shown on hover and on keyboard focus only: a clicked button keeps focus (e.g. after its dialog closes) without
// keeping its label open.
function RailTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/nav-item relative inline-flex">
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-full top-1/2 z-[80] mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md border border-white/[0.12] [background:var(--tool-table-surface)] px-2.5 py-2 text-xs font-semibold text-slate-100 opacity-0 shadow-xl transition-all duration-150 lg:group-hover/nav-item:translate-x-0 lg:group-hover/nav-item:opacity-100 lg:group-has-[:focus-visible]/nav-item:translate-x-0 lg:group-has-[:focus-visible]/nav-item:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/** `side` keeps the rail on the right edge on phones too, for pages with their own bottom toolbar. */
export function ToolRail({ label, items, title, placement = 'responsive' }: { label: string; items: ToolRailItem[]; title?: string; placement?: 'responsive' | 'side' }) {
  const position = placement === 'side'
    ? 'fixed right-3 top-1/2 z-[60] -translate-y-1/2 max-sm:right-1.5'
    : 'fixed right-3 top-1/2 z-[60] -translate-y-1/2 max-lg:bottom-3 max-lg:left-1/2 max-lg:right-auto max-lg:top-auto max-lg:-translate-x-1/2 max-lg:translate-y-0';
  return (
    <header className={position}>
      {title && <h1 className="sr-only">{title}</h1>}
      <nav aria-label={label} className={`group/rail flex justify-center gap-2 rounded-[5px] border border-white/[0.12] [background:var(--tool-table-surface)] p-2 shadow-lg ${placement === 'side' ? 'flex-col max-sm:p-1.5' : 'flex-row flex-wrap lg:flex-col'}`}>
        {items.map((item) => {
          const className = `${BASE} ${item.active ? ACTIVE[item.tone ?? 'gold'] : item.tone === 'accent' ? PRIMARY : IDLE}`;
          const common = { 'aria-label': item.label, className };
          return (
            <RailTooltip key={item.id} label={item.label}>
              {item.href ? (
                <Link href={item.href} aria-current={item.active ? 'page' : undefined} {...common}>{item.icon}</Link>
              ) : (
                <button type="button" onClick={item.onClick} disabled={item.disabled} aria-current={item.active ? 'page' : undefined} {...common}>{item.icon}</button>
              )}
            </RailTooltip>
          );
        })}
      </nav>
    </header>
  );
}

/** Line icons for rail items, 19px, stroke = currentColor. */
export type RailGlyphName = 'import' | 'history' | 'simulation' | 'rules' | 'download' | 'edit' | 'formula' | 'equipment' | 'clear' | 'add' | 'help' | 'profiles' | 'user';
export function RailGlyph({ name }: { name: RailGlyphName }) {
  const common = {
    className: 'h-[19px] w-[19px]', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const,
  };
  switch (name) {
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>;
    case 'profiles':
      return <svg {...common}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'help':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.7-2.5 2-2.5 3.7M12 17h.01"/></svg>;
    case 'add':
      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'clear':
      return <svg {...common}><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg>;
    case 'equipment':
      return <svg {...common}><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><rect x="14" y="14" width="6.5" height="6.5" rx="1"/></svg>;
    case 'import':
      return <svg {...common}><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>;
    case 'download':
      return <svg {...common}><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>;
    case 'history':
      return <svg {...common}><path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z" /><path d="M14 3.5V8h4M9 12h6m-6 3.5h6" /></svg>;
    case 'simulation':
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" /></svg>;
    case 'rules':
      return <svg {...common}><path d="M12 4v16m-6 0h12M8 7h8m-8 0-4 7h8L8 7Zm8 0-4 7h8l-4-7Z" /></svg>;
    case 'edit':
      return <svg {...common}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
    case 'formula':
      return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8 8h8M8.5 13l2 2m0-2-2 2M14 14h3M15.5 12.5v3" /></svg>;
  }
}
