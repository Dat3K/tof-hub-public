'use client';

import { localizedUi, translateUiText, type Locale } from '@tof-hub/i18n';
import React from 'react';
import { FilterChip, FilterGroup } from '@tof-hub/ui';
import type { FilterVariant } from '@tof-hub/ui';
import { InspectableIcon, type IconAction } from '../../components/inspectable-icon';
import { DatamineTabs } from '../../components/datamine-tabs';
import type { HandbookSectionId } from '../../contracts/handbook';
import { handbookHash, parseHandbookHash } from '../handbook-sections';
import { gameAsset } from '@tof-hub/game-assets';
import { useI18n, formatFixed, formatNumber } from '@/lib/i18n';
import type { HandbookItem, ItemCounts, Localized } from '../../contracts/handbook';
import styles from './sections.module.css';
import {useTableHeader} from './use-table-header';

export type HandbookLocale = Locale;

/** Active culture, shared UI copy and generated localized names. */
export function useHandbookText() {
  const { locale: raw } = useI18n();
  const locale: HandbookLocale = raw;
  const t = (en: string, ru: string) => (locale === 'ru' ? ru : translateUiText(en, locale));
  const name = (text: Localized | null | undefined, fallback = '') => localizedUi(text, locale) || text?.en || fallback;
  const num = (value: number, digits?: number) =>
    digits === undefined ? formatNumber(value, locale, { maximumFractionDigits: 2 }) : formatFixed(value, locale, digits);
  /** A fraction as a percentage (`0.0144` → `1.44%`), trailing zeros dropped. */
  const pct = (fraction: number, digits = 2) => `${formatNumber(fraction * 100, locale, { maximumFractionDigits: digits })}%`;
  return { locale, t, name, num, pct };
}

export interface HandbookColumn {
  label: React.ReactNode;
  align?: 'start' | 'end';
  /** Pixel width; specifying every column fixes the layout and its minimum scroll width. */
  width?: number;
  /** Keep the first column visible while the table scrolls horizontally. */
  pinned?: boolean;
  divider?: 'neutral';
}

/** Table on the shared tool-table surface; wide tables scroll inside their own panel. */
export function HandbookTable({ columns, rows, caption, heading, compact = false, highlightColumnHeader = false, highlightRowOnHover = !highlightColumnHeader, stickyHeader = true }: {
  columns: HandbookColumn[];
  rows: { key: string; cells: React.ReactNode[]; highlight?: boolean; separatorBefore?: boolean }[];
  caption?: string;
  /** Visible heading within the shared table panel; caption remains its accessible name. */
  heading?: React.ReactNode;
  compact?: boolean | 'dense';
  highlightColumnHeader?: boolean;
  /** Allow row hover together with the optional column-header highlight. */
  highlightRowOnHover?: boolean;
  /** Keep the header within normal document flow when false. */
  stickyHeader?: boolean;
}) {
  const [hoveredColumn, setHoveredColumn] = React.useState<number | null>(null);
  const {tableRef, headerRef} = useTableHeader(stickyHeader);
  const fixedWidth = columns.length > 0 && columns.every((column) => column.width !== undefined)
    ? columns.reduce((sum, column) => sum + column.width!, 0) : undefined;
  return (
    <div className={styles.tableWrap}>
      {heading}
      <table ref={tableRef} className={`${styles.table} ${compact === 'dense' ? styles.tableDense : compact ? styles.tableCompact : ''}`}
        data-header-hover={highlightColumnHeader || undefined}
        data-row-hover={highlightRowOnHover || undefined}
        style={fixedWidth ? { tableLayout: 'fixed', minWidth: fixedWidth } : undefined}
        onMouseOver={highlightColumnHeader ? (event) => {
          const cell = (event.target as HTMLElement).closest('td, th') as HTMLTableCellElement | null;
          setHoveredColumn(cell && cell.cellIndex > 0 ? cell.cellIndex : null);
        } : undefined}
        onMouseLeave={highlightColumnHeader ? () => setHoveredColumn(null) : undefined}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {fixedWidth && <colgroup>{columns.map((column, index) => <col key={index} style={{ width: `${column.width! / fixedWidth * 100}%` }} />)}</colgroup>}
        <thead ref={headerRef}>
          <tr>
            {columns.map((column, index) => (
                <th key={index} scope="col" data-column-hover={highlightColumnHeader && hoveredColumn === index || undefined} data-divider={column.divider} data-pinned={index === 0 && column.pinned || undefined} data-align={column.align ?? (index === 0 ? 'start' : 'end')}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-highlight={row.highlight || undefined} data-separator-before={row.separatorBefore || undefined}>
              {row.cells.map((cell, index) => (
                  <td key={index} data-divider={columns[index]?.divider} data-pinned={index === 0 && columns[index]?.pinned || undefined} data-align={columns[index]?.align ?? (index === 0 ? 'start' : 'end')}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One labelled row of single-choice chips. */
export function ChoiceChips<T extends string | number>({ label, value, options, onChange, role = 'radio' }: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode; icon?: string | null; variant?: FilterVariant; title?: string }[];
  onChange: (value: T) => void;
  role?: 'radio' | 'button';
}) {
  return (
    <FilterGroup label={label} ariaLabel={label} className="filter-hover-preview">
      {options.map((option) => (
        <FilterChip
          key={String(option.value)}
          value={String(option.value)}
          label={option.label}
          variant={option.variant}
          title={option.title}
          icon={option.icon ? gameAsset(option.icon) : undefined}
          active={option.value === value}
          aria-checked={role === 'radio' ? option.value === value : undefined}
          role={role}
          onClick={() => onChange(option.value)}
        />
      ))}
    </FilterGroup>
  );
}

/**
 * Game icon before a label (stats, slots, Titan properties, versions); the label stays the accessible text.
 * `mono` renders monochrome attribute icons white, as on the Build card.
 */
export function IconLabel({ icon, label, size = 'md', tone = 'color', statType, alert, hint, accent, iconAction }: {
  icon?: string | null; label: React.ReactNode; size?: 'sm' | 'md' | 'lg'; tone?: 'color' | 'mono' | 'stat' | 'red';
  statType?: string | null;
  accent?: 'gold' | 'green' | 'cyan' | 'violet';
  /** Muted text and icon for an unavailable entry; `hint` explains it through the site hint layer. */
  alert?: boolean; hint?: string;
  /** Optional image inspection; a missing thumbnail keeps a blank, noninteractive slot. */
  iconAction?: IconAction;
}) {
  const element = tone === 'stat' ? statType?.match(/^(Physical|Frost|Flame|Volt|Altered)\b/)?.[1] : undefined;
  return (
    <span className={styles.iconLabel} data-size={size} data-tone={tone === 'stat' ? element ? 'color' : 'mono' : tone} data-accent={accent} data-alert={alert || undefined} data-hint={hint} tabIndex={hint ? 0 : undefined}>
      {icon ? iconAction
        ? <InspectableIcon key={icon} src={gameAsset(icon)} action={iconAction} gapClass={styles.iconGap} imageClass={element ? 'resistance-icon' : undefined} element={element} />
        : <img src={gameAsset(icon)} className={element ? 'resistance-icon' : undefined} data-resistance-element={element} alt="" loading="lazy" decoding="async" />
        : <span className={styles.iconGap} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

export interface SubTab {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
  note?: React.ReactNode;
}

/** Switchable parts of one Handbook section (Datamine chip tabs, as on Origin of War); one part is visible at a time. */
/** The section a SubTabs belongs to, so its choice can live in the URL hash (#section/sub). */
const SectionContext = React.createContext<HandbookSectionId | null>(null);
export const HandbookSectionProvider = SectionContext.Provider;

export function SubTabs({ label, tabs }: { label: string; tabs: SubTab[] }) {
  const section = React.useContext(SectionContext);
  // HandbookView mounts sections only after hydration, so read the sub-tab on its first render.
  const [active, setActive] = React.useState(() => {
    const parsed = typeof window === 'undefined' ? null : parseHandbookHash(window.location.hash);
    return parsed?.section.id === section && tabs.some((tab) => tab.id === parsed.sub)
      ? parsed.sub! : tabs[0]?.id ?? '';
  });
  const ids = tabs.map((tab) => tab.id).join(' ');

  // #section/sub selects a sub-tab after hydration and on manual hash edits; unknown ids keep the first tab.
  React.useEffect(() => {
    const read = () => {
      const parsed = parseHandbookHash(window.location.hash);
      setActive(parsed?.section.id === section && parsed.sub && ids.split(' ').includes(parsed.sub)
        ? parsed.sub : ids.split(' ')[0] ?? '');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [section, ids]);

  const select = (id: string) => {
    setActive(id);
    if (section) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${handbookHash(section, id)}`);
  };
  if (tabs.length < 2) return <div className={styles.block}>{tabs[0]?.content}</div>;
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]!;
    // Muted buttons keep sub-navigation visually secondary to the section tab bar.
  return (
    <div className={styles.subTabs}>
      <div className={styles.subTabHeader}>
        <DatamineTabs tone="neutral" ariaLabel={label} activeTab={current.id} onChange={select} className={styles.subTabList}
          tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))} />
        {current.note && <p className={styles.subTabNote}>{current.note}</p>}
      </div>
      <div key={current.id} className={styles.block}>{current.content}</div>
    </div>
  );
}

export function Controls({ children }: { children: React.ReactNode }) {
  return <div className={styles.controls}>{children}</div>;
}

/** Block heading and explanation; inside a sub-tab the tab label is the heading, so only the note is given. */
export function SubHeading({ children, note }: { children?: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className={styles.subHeading}>
      {children && <h3>{children}</h3>}
      {note && <p>{note}</p>}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

/** Item amounts as icon + amount chips; gold is the `Gold` key. */
export function ItemCost({ items, catalog, gold }: { items: ItemCounts; catalog: Record<string, HandbookItem>; gold?: number | null }) {
  const { name, num, t } = useHandbookText();
  const entries = Object.entries(items).filter(([id, count]) => id !== 'Gold' && count > 0);
  const goldAmount = gold ?? items.Gold;
  if (!entries.length && !goldAmount) return <span className={styles.muted}>—</span>;
  return (
    <span className={styles.cost}>
      {entries.map(([id, count]) => {
        const item = catalog[id];
        const label = name(item?.name, id);
        return (
          <span key={id} className={styles.costItem} title={label}>
            {item?.icon ? <img src={gameAsset(item.icon)} alt="" width={18} height={18} loading="lazy" /> : null}
            <span className="sr-only">{label}</span>
            <span>{num(count)}</span>
          </span>
        );
      })}
      {goldAmount ? (
        <span className={styles.costItem} title={t('Gold', 'Золото')}>
          <span className={styles.goldDot} aria-hidden="true" />
          <span className="sr-only">{t('Gold', 'Золото')}</span>
          <span>{num(goldAmount)}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Item legend: icon and name of every item used in a section. */
export function ItemLegend({ ids, catalog }: { ids: string[]; catalog: Record<string, HandbookItem> }) {
  const { name } = useHandbookText();
  return (
    <ul className={styles.legend}>
      {ids.filter((id) => id !== 'Gold').map((id) => (
        <li key={id}>
          {catalog[id]?.icon ? <img src={gameAsset(catalog[id]!.icon!)} alt="" width={18} height={18} loading="lazy" /> : null}
          {name(catalog[id]?.name, id)}
        </li>
      ))}
    </ul>
  );
}

/** Native range input with its value; `aria-valuetext` carries the formatted value. */
export function RangeField({ label, value, min, max, onChange, display, compact = false }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  display?: string;
  compact?: boolean;
}) {
  const id = React.useId();
  const text = display ?? String(value);
  return (
    <div className={`${styles.range} ${compact ? styles.rangeCompact : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={1} value={value} aria-valuetext={text}
        style={compact ? { '--range-fill': `${Math.max(0, Math.min(100, (value - min) / (max - min || 1) * 100))}%` } as React.CSSProperties : undefined}
        onChange={(event) => onChange(Number(event.target.value))} />
      <output htmlFor={id}>{text}</output>
    </div>
  );
}

/** Proportional bar for a chance or share in a table cell. */
export function ShareBar({ value, max = 1, label }: { value: number; max?: number; label: string }) {
  return (
    <span className={styles.share}>
      <span className={styles.shareTrack} aria-hidden="true">
        <span className={styles.shareFill} style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%` }} />
      </span>
      <span>{label}</span>
    </span>
  );
}
