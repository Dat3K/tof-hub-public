'use client';

import type { ReactNode } from 'react';
import styles from './enemy-lineup-card.module.css';

/** The enemy presentation used by OOW; each encounter supplies its own verified stats. */
export function EnemyLineupCard({
  name, portrait, portraitFit = 'cover', imageLoading, quantity, kind, kindLabel,
  badges, children, aside, nameColor, onInspect, hint, role, codeName, portraitFallback,
}: {
  name: string;
  portrait?: string | null;
  portraitFallback?: ReactNode;
  codeName?: string;
  /** Auto crops landscape thumbnails like Gacha Sequential, containing other artwork. */
  portraitFit?: 'cover' | 'contain' | 'auto';
  imageLoading?: 'lazy' | 'eager';
  quantity?: string;
  kind: 'boss' | 'elite' | 'normal';
  kindLabel: string;
  badges?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  nameColor?: string;
  onInspect?: () => void;
  hint?: string;
  role?: 'listitem';
}) {
  const fitLoadedPortrait = portraitFit === 'auto' ? (image: HTMLImageElement | null) => {
    if (image?.naturalWidth && image.naturalHeight) image.dataset.wide = String(image.naturalWidth > image.naturalHeight);
  } : undefined;
  return <div className={styles.card} data-enemy-kind={kind} data-interactive={Boolean(onInspect)} data-has-aside={Boolean(aside)}
    role={onInspect ? 'button' : role} tabIndex={onInspect ? 0 : undefined} title={hint}
    onClick={onInspect ? event => {event.stopPropagation(); onInspect();} : undefined}
    onKeyDown={onInspect ? event => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault(); event.stopPropagation(); onInspect();
    } : undefined}>
    {portraitFallback ? <span className={styles.portrait}>
      {portraitFallback}
      {portrait && <img ref={fitLoadedPortrait} onLoad={fitLoadedPortrait ? event => fitLoadedPortrait(event.currentTarget) : undefined} className={styles.avatar} src={portrait} alt="" loading={imageLoading}
        data-fit={portraitFit} onError={event => {event.currentTarget.style.display = 'none';}} />}
    </span> : portrait && <img ref={fitLoadedPortrait} onLoad={fitLoadedPortrait ? event => fitLoadedPortrait(event.currentTarget) : undefined} className={styles.avatar} src={portrait} alt="" loading={imageLoading}
      data-fit={portraitFit} onError={event => {event.currentTarget.style.display = 'none';}} />}
    <div className={styles.info}>
      <div className={styles.heading}>
        <span className={styles.name} style={nameColor ? {color: nameColor} : undefined}>{name}</span>
        {quantity && <span className={styles.quantity}>×{quantity}</span>}
        <span className={styles.kind}>{kindLabel}</span>
        {badges}
      </div>
      {codeName && <code className={styles.codeName}>{codeName}</code>}
      {children}
    </div>
    {aside && <div className={styles.aside}>{aside}</div>}
  </div>;
}
