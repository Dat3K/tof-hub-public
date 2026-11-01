import { useEffect } from 'react';

interface UseAnimatedDetailsOptions {
  containerSelector: string;
  dependencyKey: string;
  detailsSelector?: string;
  onSummaryClick?: (details: HTMLDetailsElement) => void;
}

/**
 * Keeps native details semantics while supplying the same measured-height
 * animation used by the Simulacra detail view in browsers without
 * details::details-content support.
 */
export function useAnimatedDetails({
  containerSelector,
  dependencyKey,
  detailsSelector = 'details',
  onSummaryClick,
}: UseAnimatedDetailsOptions) {
  useEffect(() => {
    const article = document.querySelector<HTMLElement>(containerSelector);
    if (!article) return;

    const activeAnimations = new WeakMap<HTMLDetailsElement, Animation>();
    const getContent = (details: HTMLDetailsElement): HTMLElement | null => {
      for (const child of Array.from(details.children)) {
        if (child.tagName !== 'SUMMARY' && child instanceof HTMLElement) return child;
      }
      return null;
    };

    const finishImmediately = (details: HTMLDetailsElement, content: HTMLElement) => {
      activeAnimations.get(details)?.cancel();
      activeAnimations.delete(details);
      details.open = !details.open;
      content.style.height = '';
      content.style.overflow = '';
      content.style.boxSizing = '';
    };

    const animateDetails = (details: HTMLDetailsElement, opening: boolean) => {
      const content = getContent(details);
      if (!content) {
        details.open = opening;
        return;
      }

      activeAnimations.get(details)?.cancel();
      activeAnimations.delete(details);

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finishImmediately(details, content);
        return;
      }

      const currentHeight = content.getBoundingClientRect().height;
      if (opening) details.open = true;

      content.style.overflow = 'hidden';
      content.style.boxSizing = 'border-box';
      content.style.height = `${currentHeight}px`;

      window.requestAnimationFrame(() => {
        const targetHeight = opening ? content.scrollHeight : 0;
        const animation = content.animate(
          [{ height: `${currentHeight}px` }, { height: `${targetHeight}px` }],
          {
            duration: 340,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards',
          },
        );
        activeAnimations.set(details, animation);

        animation.onfinish = () => {
          if (activeAnimations.get(details) !== animation) return;
          activeAnimations.delete(details);
          if (!opening) details.open = false;
          content.style.height = '';
          content.style.overflow = '';
          content.style.boxSizing = '';
        };
      });
    };

    const handleDetailsClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, a, input, select, textarea')) return;

      const summary = target.closest('summary');
      if (!(summary instanceof HTMLElement)) return;
      const details = summary.parentElement;
      if (!(details instanceof HTMLDetailsElement) || !article.contains(details)) return;
      if (!details.matches(detailsSelector)) return;

      // Clicking a summary should toggle the panel, not leave the heading
      // or its content painted with the browser's text-selection highlight.
      window.getSelection()?.removeAllRanges();

      event.preventDefault();
      onSummaryClick?.(details);
      animateDetails(details, !details.open);
    };

    article.addEventListener('click', handleDetailsClick, true);
    return () => article.removeEventListener('click', handleDetailsClick, true);
  }, [containerSelector, dependencyKey, detailsSelector, onSummaryClick]);
}
