'use client';

import React, { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useDismiss } from '@tof-hub/ui';
import styles from '../comp.module.css';

interface CompPopoverProps {
  anchorRect: DOMRect;
  /** Width used to keep the popover inside the viewport horizontally. */
  width: number;
  ariaLabel: string;
  title: ReactNode;
  subtitle: ReactNode;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

const EDGE = 10;
const GAP = 6;

/**
 * Quick popover of a squad slot (rank, role, stars): placed under its anchor, or above it when that has more room, kept
 * inside the viewport with a scrollable height; closes on an outside press and Escape.
 */
export function CompPopover({ anchorRect, width, ariaLabel, title, subtitle, className = '', onClose, children }: CompPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  useDismiss({ refs: [popoverRef], onDismiss: onClose });

  const left = typeof window === 'undefined' ? EDGE : Math.max(EDGE, Math.min(window.innerWidth - width - EDGE, anchorRect.left));

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const updatePosition = () => {
      const height = popover.getBoundingClientRect().height;
      const belowTop = anchorRect.bottom + GAP;
      const spaceBelow = Math.max(0, window.innerHeight - EDGE - belowTop);
      const spaceAbove = Math.max(0, anchorRect.top - GAP - EDGE);
      const openAbove = height > spaceBelow && (height <= spaceAbove || spaceAbove > spaceBelow);
      const maxHeight = openAbove ? spaceAbove : spaceBelow;
      const next = { top: openAbove ? Math.max(EDGE, anchorRect.top - GAP - Math.min(height, maxHeight)) : belowTop, left, maxHeight };
      setPosition((current) =>
        current && current.top === next.top && current.left === next.left && current.maxHeight === next.maxHeight ? current : next,
      );
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null;
    observer?.observe(popover);
    return () => {
      window.removeEventListener('resize', updatePosition);
      observer?.disconnect();
    };
  }, [anchorRect, left]);

  return (
    <div
      ref={popoverRef}
      className={`${styles.pop} ${className}`.trim()}
      style={{
        top: position?.top ?? anchorRect.bottom + GAP,
        left: position?.left ?? left,
        maxHeight: position?.maxHeight,
        overflowY: position ? 'auto' : undefined,
        visibility: position ? 'visible' : 'hidden',
      }}
      role="dialog"
      aria-label={ariaLabel}
    >
      <p className={styles.popTitle}>
        <span>{title}</span>
        <span className={styles.popSubtitle}>{subtitle}</span>
      </p>
      {children}
    </div>
  );
}
