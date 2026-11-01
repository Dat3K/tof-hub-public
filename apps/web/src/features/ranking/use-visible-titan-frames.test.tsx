import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { useVisibleTitanFrames } from './use-visible-titan-frames';
import styles from './ranking.module.css';

afterEach(() => vi.unstubAllGlobals());
describe('Titan frame animation visibility', () => {
  it('keeps motion on screen, pauses it off screen/hidden, and removes observers on replacement', () => {
    const observers: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn(); observe = vi.fn();
      constructor(callback: IntersectionObserverCallback) { observers.push({ callback, disconnect: this.disconnect }); }
    });
    let hidden = false;
    const visibility = vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    function Board({ revision }: { revision: string }) {
      const root = useRef<HTMLDivElement>(null);
      useVisibleTitanFrames(root, revision);
      return <div ref={root}><span className={styles.slotChip} data-grade="titan"/></div>;
    }
    const view = render(<Board revision="one"/>);
    const root = view.container.firstElementChild!, frame = root.firstElementChild!;
    expect(root.hasAttribute('data-animation-active')).toBe(true);
    const intersect = (isIntersecting: boolean) => act(() => observers[0]!.callback([{ target: frame, isIntersecting }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    intersect(true); expect(frame.hasAttribute('data-titan-visible')).toBe(true);
    intersect(false); expect(frame.hasAttribute('data-titan-visible')).toBe(false);
    hidden = true; act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(root.hasAttribute('data-animation-active')).toBe(false);
    view.rerender(<Board revision="two"/>);
    expect(observers[0]!.disconnect).toHaveBeenCalledOnce();
    view.unmount(); expect(observers[1]!.disconnect).toHaveBeenCalledOnce();
    visibility.mockRestore();
  });
});
