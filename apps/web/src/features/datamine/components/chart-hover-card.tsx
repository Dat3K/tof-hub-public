import type { ReactNode } from 'react';
import styles from './chart-hover-card.module.css';

export interface ChartHoverCardProps {
  /** Viewport coordinates of the pointer; the card sits above it (position: fixed). */
  x: number;
  y: number;
  /** Small gold heading, e.g. "Stage 31" or "Floor 579". */
  eyebrow: ReactNode;
  /** Enemy portrait, cropped like the table avatars. */
  portrait?: string | null;
  name?: ReactNode;
  /** Main value of the hovered chart. */
  value: ReactNode;
  /** Secondary values under the main one (powercreep, HP…). */
  meta?: ReactNode;
  /** Separated block under the enemy row (mechanics note, weaknesses…). */
  footer?: ReactNode;
}

/** Hover card shared by the datamine charts (Sequential, Bygone). */
export function ChartHoverCard({ x, y, eyebrow, portrait, name, value, meta, footer }: ChartHoverCardProps) {
  return (
    <div className={styles.card} role="status" style={{ left: x, top: y }}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <div className={styles.enemy}>
        {portrait && <img src={portrait} alt="" className={styles.portrait} />}
        <div className={styles.body}>
          {name && <strong className={styles.name}>{name}</strong>}
          <div className={styles.value}>{value}</div>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
