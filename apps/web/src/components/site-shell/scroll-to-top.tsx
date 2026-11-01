'use client';

import { localeText } from '@/lib/i18n/text';
import { type Locale } from '@tof-hub/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import styles from './scroll-to-top.module.css';

export interface ScrollToTopProps {
  thresholdRatio?: number;
  duration?: number;
  lang?: Locale;
  className?: string;
}

export function ScrollToTop({
  thresholdRatio = 0.5,
  duration = 380,
  lang: langProp,
  className,
}: ScrollToTopProps) {
  const { locale: i18nLocale } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const currentLang = langProp ?? i18nLocale;
  const activeScrollerRef = useRef<Window | HTMLElement>(typeof window !== 'undefined' ? window : (null as unknown as Window));
  const animationFrameRef = useRef<number | null>(null);

  // Language synchronization


  const stopScrollAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Multi-scroller detection and visibility tracking
  useEffect(() => {
    function isDoc(node: EventTarget | null): boolean {
      return (
        node === document ||
        node === document.documentElement ||
        node === document.body ||
        node === window ||
        node === null
      );
    }

    function getOffset(scroller: Window | HTMLElement): number {
      return scroller === window
        ? window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
        : (scroller as HTMLElement).scrollTop;
    }

    function getViewHeight(scroller: Window | HTMLElement): number {
      return scroller === window ? window.innerHeight : (scroller as HTMLElement).clientHeight;
    }

    function update() {
      const scroller = activeScrollerRef.current || window;
      const offset = getOffset(scroller);
      const view = getViewHeight(scroller);
      const show = offset > view * thresholdRatio;
      setIsVisible(show);
    }

    function handleScroll(event: Event) {
      activeScrollerRef.current = isDoc(event.target)
        ? window
        : (event.target as HTMLElement);
      update();
    }

    // Capture phase catches scroll from window and any nested container
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('wheel', stopScrollAnimation, { passive: true });
    window.addEventListener('touchstart', stopScrollAnimation, { passive: true });

    update();

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('wheel', stopScrollAnimation);
      window.removeEventListener('touchstart', stopScrollAnimation);
      stopScrollAnimation();
    };
  }, [thresholdRatio, stopScrollAnimation]);

  const handleScrollToTop = useCallback(() => {
    const scroller = activeScrollerRef.current || window;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || typeof requestAnimationFrame !== 'function') {
      try {
        scroller.scrollTo({ top: 0, behavior: 'auto' });
      } catch {
        if (scroller === window) {
          window.scrollTo(0, 0);
        } else {
          (scroller as HTMLElement).scrollTop = 0;
        }
      }
      setIsVisible(false);
      return;
    }

    const start =
      scroller === window
        ? window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
        : (scroller as HTMLElement).scrollTop;

    if (start <= 0) {
      setIsVisible(false);
      return;
    }

    stopScrollAnimation();

    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(start * (1 - easeOutCubic(progress)));

      if (scroller === window) {
        window.scrollTo(0, current);
        if (document.documentElement && document.documentElement.scrollTop !== undefined) {
          document.documentElement.scrollTop = current;
        }
        if (document.body && document.body.scrollTop !== undefined) {
          document.body.scrollTop = current;
        }
      } else {
        (scroller as HTMLElement).scrollTop = current;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
        setIsVisible(false);
      }
    }

    animationFrameRef.current = requestAnimationFrame(step);
  }, [duration, stopScrollAnimation]);

  const label = localeText(currentLang)('Scroll to top');

  return (
    <button
      type="button"
      className={`${styles.scrollTop} dm-scrolltop ${
        isVisible ? `${styles.isVisible} is-visible` : ''
      } ${className || ''}`}
      aria-label={label}
      title={label}
      onClick={handleScrollToTop}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
