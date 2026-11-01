import { useEffect, type RefObject } from 'react';
import styles from './ranking.module.css';

/** Keep the approved animation on screen; one observer pauses all offscreen pieces without React rerenders. */
export function useVisibleTitanFrames(root: RefObject<HTMLElement | null>, revision: string, enabled = true) {
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const visibility = () => container.toggleAttribute('data-animation-active', enabled && !document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    if (!enabled) return () => {
      document.removeEventListener('visibilitychange', visibility);
      container.removeAttribute('data-animation-active');
    };
    const frames = container.querySelectorAll<HTMLElement>(`.${styles.slotChip}[data-grade="titan"]`);
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === 'undefined') {
      frames.forEach(frame => frame.setAttribute('data-titan-visible', ''));
    } else {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) entry.target.toggleAttribute('data-titan-visible', entry.isIntersecting);
      });
      frames.forEach(frame => observer!.observe(frame));
    }
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      container.removeAttribute('data-animation-active');
    };
  }, [root, revision, enabled]);
}
