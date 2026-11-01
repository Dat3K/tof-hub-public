'use client';

import React, { useEffect } from 'react';
import styles from './detail-navigation.module.css';

export interface DetailNavigationItem {
  id: string;
}

export interface DetailNavigationLabels {
  navigation: string;
  pager: string;
  back: string;
  previous: string;
  next: string;
}

export interface DetailNavigationProps<T extends DetailNavigationItem> {
  currentId: string;
  items: readonly T[];
  getItemName: (item: T) => string;
  labels: DetailNavigationLabels;
  onBack: () => void;
  onSelect?: (id: string) => void;
  ids?: {
    back?: string;
    previous?: string;
    next?: string;
  };
}

export function DetailNavigation<T extends DetailNavigationItem>({
  currentId,
  items,
  getItemName,
  labels,
  onBack,
  onSelect,
  ids,
}: DetailNavigationProps<T>) {
  const currentIndex = items.findIndex((item) => item.id === currentId);
  const total = items.length;
  const hasPager = currentIndex !== -1 && total > 1 && Boolean(onSelect);
  const previousItem = hasPager ? items[(currentIndex - 1 + total) % total] : undefined;
  const nextItem = hasPager ? items[(currentIndex + 1) % total] : undefined;
  const previousName = previousItem ? getItemName(previousItem) : '';
  const nextName = nextItem ? getItemName(nextItem) : '';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]'))
      ) {
        return;
      }

      if (event.key === 'ArrowLeft' && previousItem) {
        event.preventDefault();
        onSelect?.(previousItem.id);
      } else if (event.key === 'ArrowRight' && nextItem) {
        event.preventDefault();
        onSelect?.(nextItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextItem, onSelect, previousItem]);

  return (
    <nav className={styles.detailNav} aria-label={labels.navigation}>
      <button
        type="button"
        id={ids?.back}
        className={styles.backButton}
        onClick={onBack}
        aria-label={labels.back}
      >
        <span>{labels.back}</span>
      </button>

      {hasPager && previousItem && nextItem ? (
        <div className={styles.pager} role="navigation" aria-label={labels.pager}>
          <button
            type="button"
            id={ids?.previous}
            className={`${styles.pagerButton} ${styles.pagerButtonPrev}`}
            onClick={() => onSelect?.(previousItem.id)}
            aria-label={`${labels.previous}: ${previousName}`}
            title={previousName}
          >
            <span className={styles.pagerArrow} aria-hidden="true">
              ◀
            </span>
            <span className={styles.pagerLabel}>{previousName}</span>
          </button>

          <span className={styles.pagerCounter} aria-live="polite">
            {currentIndex + 1} / {total}
          </span>

          <button
            type="button"
            id={ids?.next}
            className={`${styles.pagerButton} ${styles.pagerButtonNext}`}
            onClick={() => onSelect?.(nextItem.id)}
            aria-label={`${labels.next}: ${nextName}`}
            title={nextName}
          >
            <span className={styles.pagerLabel}>{nextName}</span>
            <span className={styles.pagerArrow} aria-hidden="true">
              ▶
            </span>
          </button>
        </div>
      ) : null}
    </nav>
  );
}

DetailNavigation.displayName = 'DetailNavigation';
