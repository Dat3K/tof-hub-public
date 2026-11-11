import { useEffect } from 'react';

interface UseAnimatedDetailsOptions {
  containerSelector: string;
  dependencyKey: string;
  detailsSelector?: string;
  onSummaryClick?: (details: HTMLDetailsElement) => void;
}

/**
 * Keeps native details semantics with exactly one animation per panel. Where the stylesheet animates
 * details::details-content, toggling `open` is enough; running both left a pause and a stale height.
 * Browsers without interpolate-size (Firefox, Safari) use the measured-height animation below.
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

    const styleAnimatesContent = (details: HTMLDetailsElement) =>
      CSS.supports('interpolate-size', 'allow-keywords') &&
      getComputedStyle(details, '::details-content').transitionDuration
        .split(',')
        .some((duration) => parseFloat(duration) > 0);

    const boxKeyframe = (style: CSSStyleDeclaration): Keyframe => ({
      height: style.height,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      borderTopWidth: style.borderTopWidth,
      borderBottomWidth: style.borderBottomWidth,
    });
    const collapsedKeyframe: Keyframe = {
      height: '0px',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
    };

    const animateDetails = (details: HTMLDetailsElement, opening: boolean) => {
      const content = getContent(details);
      if (!content || styleAnimatesContent(details) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        activeAnimations.get(details)?.cancel();
        activeAnimations.delete(details);
        details.open = opening;
        if (content) {
          content.style.overflow = '';
          content.style.boxSizing = '';
        }
        return;
      }

      // Read a running animation's box first, so a reversed click continues from what is on screen.
      const running = activeAnimations.get(details);
      content.style.boxSizing = 'border-box';
      const from = running ? boxKeyframe(getComputedStyle(content)) : opening ? collapsedKeyframe : null;
      running?.cancel();
      details.open = true;
      const natural = boxKeyframe(getComputedStyle(content));

      content.style.overflow = 'hidden';
      const animation = content.animate(
        [from ?? natural, opening ? natural : collapsedKeyframe],
        { duration: 340, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
      activeAnimations.set(details, animation);
      animation.onfinish = () => {
        if (activeAnimations.get(details) !== animation) return;
        activeAnimations.delete(details);
        if (!opening) details.open = false;
        content.style.overflow = '';
        content.style.boxSizing = '';
      };
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
