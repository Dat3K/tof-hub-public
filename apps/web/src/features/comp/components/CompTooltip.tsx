'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {GameRichText} from '@tof-hub/ui';
import styles from '../comp.module.css';

interface CompTipPayload {
  title?: string;
  subtitle?: string;
  desc?: string;
  extra?: string;
  rank?: number;
  sections?: CompTipPayload[];
}

function position(box: HTMLDivElement, x: number, y: number) {
  const gap = 14;
  const rect = box.getBoundingClientRect();
  let left = x + gap;
  let top = y + gap;
  if (left + rect.width > window.innerWidth - 12) {
    left = x - rect.width - gap;
  }
  if (top + rect.height > window.innerHeight - 12) {
    top = y - rect.height - gap;
  }
  if (left < 10) left = 10;
  if (top < 10) top = 10;
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

interface CompTooltipProps {
  /** Hide and suppress the tooltip while a modal or quick popover is open. */
  suppressed: boolean;
}

/**
 * Floating slot tooltip (parity with legacy #comp-tooltip).
 * Follows the mouse over any [data-comp-tip] element carrying a JSON payload
 * { title, subtitle, desc, extra }. Suppressed on touch devices and while
 * the picker modal or a quick popover is open. The text is rendered by React (no HTML strings).
 */
export const CompTooltip: React.FC<CompTooltipProps> = ({ suppressed }) => {
  const ref = useRef<HTMLDivElement>(null);
  const suppressedRef = useRef(suppressed);
  suppressedRef.current = suppressed;
  const [tip, setTip] = useState<CompTipPayload | null>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof document === 'undefined') return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      (window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches)
    ) {
      return;
    }

    const hide = () => setTip(null);

    let isTouchActive = false;
    const onTouchStart = () => {
      isTouchActive = true;
      hide();
    };
    const onTouchEnd = () => {
      window.setTimeout(() => {
        isTouchActive = false;
      }, 500);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        isTouchActive = true;
        hide();
      }
    };
    const onMouseOver = (e: MouseEvent) => {
      if (isTouchActive) return;
      if ((e as PointerEvent).pointerType === 'touch') return;
      if (suppressedRef.current) return;
      const target = (e.target as Element | null)?.closest?.('[data-comp-tip]');
      if (target) {
        show(target, e.clientX, e.clientY);
      }
    };
    const onMouseOut = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest?.('[data-comp-tip]');
      if (target) hide();
    };
    const onMouseMove = (e: MouseEvent) => {
      const box = ref.current;
      pointer.current = { x: e.clientX, y: e.clientY };
      if (box && box.classList.contains(styles.tipVisible)) {
        position(box, e.clientX, e.clientY);
      }
    };

    function show(element: Element, x: number, y: number) {
      if (suppressedRef.current) return;
      const json = element.getAttribute('data-comp-tip');
      if (!json) return;
      try {
        const data = JSON.parse(json) as CompTipPayload;
        if (!data.title && !data.subtitle && !data.desc && !data.extra && !data.sections?.length) return;
        pointer.current = { x, y };
        setTip(data);
      } catch {
        /* A malformed payload shows no tooltip. */
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      document.removeEventListener('touchstart', onTouchStart, { capture: true } as EventListenerOptions);
      document.removeEventListener('touchend', onTouchEnd, { capture: true } as EventListenerOptions);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  // A modal or quick popover opening over the slot hides the tooltip.
  useEffect(() => {
    if (suppressed) setTip(null);
  }, [suppressed]);

  // Place the box once its new text is laid out.
  useLayoutEffect(() => {
    if (tip && ref.current) position(ref.current, pointer.current.x, pointer.current.y);
  }, [tip]);

  return (
    <div ref={ref} className={`${styles.compTooltip} ${tip ? styles.tipVisible : ''}`.trim()} role={tip ? 'tooltip' : undefined} aria-hidden={!tip}>
      {tip?.title && <div className={styles.tipTitle}>{tip.title}</div>}
      {tip?.subtitle && <div className={styles.tipSubtitle}>{tip.subtitle}</div>}
      {tip?.desc && <GameRichText className={styles.tipDesc} density="compact" text={tip.desc} rank={tip.rank}/>}
      {tip?.extra && <GameRichText className={`${styles.tipDesc} ${styles.tipHighlight}`} density="compact" text={tip.extra} rank={tip.rank}/>}
      {tip?.sections?.map((section,index)=><div key={index}>
        <div className={styles.tipTitle}>{section.title}</div>
        <div className={styles.tipSubtitle}>{section.subtitle}</div>
        <GameRichText className={styles.tipDesc} density="compact" text={section.desc} rank={section.rank}/>
      </div>)}
    </div>
  );
};
