'use client';

import { useEffect, useRef, type RefObject } from 'react';

export type DismissReason = 'outside' | 'escape';

export interface UseDismissOptions {
  /** Elements that count as "inside": a press on them keeps the popup open. */
  refs: ReadonlyArray<RefObject<Element | null>>;
  /** Called on a press outside every ref, or on Escape. Needs no memoization. */
  onDismiss: (reason: DismissReason) => void;
  /** Listen only while the popup is open. Default true. */
  enabled?: boolean;
  /** CSS selector of other elements that also count as inside (for example a portal tooltip). */
  ignore?: string;
  /** Also dismiss on Escape. Default true; a listbox that handles its own keys passes false. */
  escape?: boolean;
  /** Listen in the capture phase, before the page's own handlers stop the press. Default false. */
  capture?: boolean;
}

/**
 * Closes a popover, menu, pinned tooltip or custom listbox on a pointer press outside it and on Escape
 * (2026-10-08). The one implementation for Tools popups; `Modal` and `Tooltip` keep their own focus handling.
 */
export function useDismiss({ refs, onDismiss, enabled = true, ignore, escape = true, capture = false }: UseDismissOptions): void {
  const latest = useRef({ refs, onDismiss, ignore });
  latest.current = { refs, onDismiss, ignore };

  useEffect(() => {
    if (!enabled) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const { refs: current, ignore: selector, onDismiss: dismiss } = latest.current;
      if (current.some((ref) => ref.current?.contains(target))) return;
      if (selector && target instanceof Element && target.closest(selector)) return;
      dismiss('outside');
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current.onDismiss('escape');
    };
    document.addEventListener('pointerdown', handlePointerDown, capture);
    if (escape) document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, capture);
      if (escape) document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, escape, capture]);
}
