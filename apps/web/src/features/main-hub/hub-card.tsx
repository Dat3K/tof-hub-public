'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@tof-hub/ui';
import type { HubCardData } from './types';
import styles from './main-hub.module.css';

export interface HubCardProps {
  card: HubCardData;
  art?: string | null;
  shortcuts?: readonly {href: string; label: string}[];
}

/**
 * The title link covers the card; shortcuts remain independent keyboard-accessible links.
 */
export function HubCard({ card, art, shortcuts }: HubCardProps) {
  return (
    <article className={styles.hubCard} data-main-hub={card.id}>
      {art ? <div className={styles.art} aria-hidden="true"><img src={art} alt="" loading={card.id === 'info' ? 'eager' : 'lazy'} decoding="async" /></div> : null}
      <div className={styles.cardContent}>
        <h2><Link className={styles.cardLink} href={card.href}>{card.title}</Link></h2>
        <p>{card.description}</p>
        <nav className={styles.shortcuts} aria-label={card.title}>{shortcuts?.map((link) => <Button key={link.href} href={link.href} variant="secondary" size="sm">{link.label}</Button>)}</nav>
        <span className={styles.action} aria-hidden="true">{card.actionText}</span>
      </div>
    </article>
  );
}
