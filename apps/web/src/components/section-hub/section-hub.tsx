import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { gameAsset } from '@tof-hub/game-assets';
import styles from './section-hub.module.css';

export interface SectionHubLayoutProps {
  /** Visually hidden page heading. */
  title: string;
  /** Accessible name of the card grid. */
  gridLabel: string;
  children: ReactNode;
}

export function SectionHubLayout({ title, gridLabel, children }: SectionHubLayoutProps) {
  return (
    <div className={styles.layout} data-section-hub="">
      <h1 className="sr-only">{title}</h1>
      <section className={styles.grid} aria-label={gridLabel}>
        {children}
      </section>
    </div>
  );
}

export interface SectionHubCardProps {
  id: string;
  href: string;
  title: string;
  description?: string;
  /** Formatted count and its unit for the top-right corner. */
  count?: { value: string; label: string };
  actionLabel: string;
  /** Spans the whole row with `aside` in the right column. */
  featured?: boolean;
  /** Half a row (two cards per row) instead of a third. */
  span?: 'third' | 'half';
  aside?: ReactNode;
  /** Decorative art URL behind a featured card (already resolved, e.g. with gameAsset). */
  backgroundArt?: string | null;
  /**
   * `aside` (default): faint art behind the aside. `feature`: a featured card gets an art column between the text
   * and the aside, so the art (character, season boss) never sits under text or aside tiles.
   */
  backgroundArtPlacement?: 'aside' | 'feature';
  /** Live preview: facts, media strip, chart or a feature widget. */
  children?: ReactNode;
}

/**
 * Hub card. The title link covers the whole card; links and buttons inside the preview
 * or aside stay separately clickable above it.
 */
export function SectionHubCard({
  id,
  href,
  title,
  description,
  count,
  actionLabel,
  featured = false,
  span = 'third',
  aside,
  backgroundArt,
  backgroundArtPlacement = 'aside',
  children,
}: SectionHubCardProps) {
  return (
    <article
      className={`${styles.card} ${featured ? styles.featured : span === 'half' ? styles.half : ''} ${featured && backgroundArtPlacement === 'feature' ? styles.artColumn : ''}`}
      data-hub-card={id}
    >
      {backgroundArt ? (
        <div className={`${styles.bgArt} ${backgroundArtPlacement === 'feature' ? styles.bgArtFeature : ''}`} aria-hidden="true">
          {/* Keyed by URL: a new picture fades in instead of swapping abruptly. */}
          <img key={backgroundArt} src={backgroundArt} alt="" loading="lazy" decoding="async" />
        </div>
      ) : null}
      <div className={styles.headingRow}>
        <h2 className={styles.title}>
          <Link className={styles.titleLink} href={href}>{title}</Link>
        </h2>
        {count ? (
          <span className={styles.count} data-hub-count={id}>
            <strong>{count.value}</strong> {count.label}
          </span>
        ) : null}
      </div>
      {description ? <p className={styles.body}>{description}</p> : null}
      {children ? <div className={styles.preview}>{children}</div> : null}
      {featured && aside ? <div className={styles.aside}>{aside}</div> : null}
      <span className={styles.action} aria-hidden="true">{actionLabel}</span>
    </article>
  );
}

/** Vertical stack of preview blocks (strip above facts). */
export function HubStack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

export function HubFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.frame} ${className ?? ''}`}>{children}</div>;
}

export interface HubFact {
  key: string;
  value: string;
  label: string;
}

export function HubFacts({ facts }: { facts: readonly HubFact[] }) {
  if (facts.length === 0) return null;
  return (
    <ul className={styles.facts}>
      {facts.map((fact) => (
        <li key={fact.key} className={styles.fact}>
          <strong>{fact.value}</strong>
          <span>{fact.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface HubChipLink {
  id: string;
  href: string;
  label: string;
  /** Game asset id or path (resolved with gameAsset). */
  icon?: string | null;
  /** Element colour of the chip; neutral without it. */
  tone?: 'phys' | 'flame' | 'frost' | 'volt' | 'altered';
}

/** Pill links into a filtered section page (element boards, element filters). */
export function HubChipLinks({ items, label }: { items: readonly HubChipLink[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.chipLinks} aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href} className={styles.chipLink} data-tone={item.tone}>
            {item.icon ? <img src={gameAsset(item.icon)} alt="" /> : null}
            <span>{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface HubStripItem {
  id: string;
  name: string;
  image: string;
}

/**
 * Row of real game icons. `variant`: `wide` 16:9 artwork thumbnails, `round` circular portraits (as Comp),
 * `glyph` single-colour attribute icons drawn light on the dark card.
 */
export function HubMediaStrip({
  items,
  variant,
}: {
  items: readonly HubStripItem[];
  variant?: 'wide' | 'round' | 'glyph';
}) {
  if (items.length === 0) return null;
  const variantClass = variant === 'wide' ? styles.stripWide : variant === 'round' ? styles.stripRound : variant === 'glyph' ? styles.stripGlyph : '';
  return (
    <ul className={`${styles.strip} ${variantClass}`}>
      {items.map((item) => (
        <li key={item.id} className={styles.stripItem}>
          <img src={gameAsset(item.image)} alt={item.name} title={item.name} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

export interface HubSparklineProps {
  /** `[x, y]` pairs in ascending x. */
  points: readonly (readonly [number, number])[];
  /** Plot y on a log scale (exponential growth). */
  logScale?: boolean;
  color: string;
  /** Text under the chart, spread from left to right. */
  labels: readonly string[];
  /** Accessible summary of the curve. */
  label: string;
}

const SPARK_WIDTH = 200;
const SPARK_HEIGHT = 46;

export function sparklinePath(points: HubSparklineProps['points'], logScale: boolean): string {
  if (points.length < 2) return '';
  const value = (y: number) => (logScale ? Math.log10(Math.max(y, 1)) : y);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => value(y));
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => ((x - minX) / (maxX - minX || 1)) * SPARK_WIDTH;
  const sy = (y: number) => SPARK_HEIGHT - 2 - ((y - minY) / (maxY - minY || 1)) * (SPARK_HEIGHT - 4);
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(value(y)).toFixed(1)}`).join(' ');
}

export function HubSparkline({ points, logScale = false, color, labels, label }: HubSparklineProps) {
  const line = sparklinePath(points, logScale);
  if (!line) return null;
  return (
    <figure className={`${styles.frame} ${styles.sparkFrame}`} style={{ '--spark-color': color, margin: 0 } as CSSProperties}>
      <svg className={styles.sparkline} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <path d={`${line} L${SPARK_WIDTH},${SPARK_HEIGHT} L0,${SPARK_HEIGHT} Z`} fill={color} opacity="0.12" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className={styles.sparkLabels} aria-hidden="true">
        {labels.map((text) => <span key={text}>{text}</span>)}
      </figcaption>
    </figure>
  );
}
