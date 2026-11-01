'use client';

import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TooltipProps, TooltipPlacement } from '../primitives/types';

function getPlacementClasses(placement: TooltipPlacement): string {
  switch (placement) {
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-2';
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 mr-2';
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 ml-2';
    case 'top':
    default:
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
  }
}

type PortalPosition = { top: number; left: number; zIndex: number };

/** Viewport-clamped fixed position for a portalled popup; shared by `Tooltip` and `HintLayer`. */
function placePortalTooltip(
  triggerElement: HTMLElement,
  tooltip: DOMRect,
  { placement, align, viewportTopInset }: { placement: TooltipPlacement; align: 'center' | 'end'; viewportTopInset: number },
): PortalPosition {
  const trigger = triggerElement.getBoundingClientRect();
  const gap = 8;
  const edge = 8;
  const topEdge = edge + Math.max(0, viewportTopInset);
  const maxLeft = Math.max(edge, window.innerWidth - tooltip.width - edge);
  const maxTop = Math.max(topEdge, window.innerHeight - tooltip.height - edge);
  let left = align === 'end' ? trigger.right - tooltip.width : trigger.left + (trigger.width - tooltip.width) / 2;
  let top = trigger.top - tooltip.height - gap;

  if (placement === 'bottom') top = trigger.bottom + gap;
  if (placement === 'left') {
    left = trigger.left - tooltip.width - gap;
    top = trigger.top + (trigger.height - tooltip.height) / 2;
    if (left < edge) left = trigger.right + gap;
  }
  if (placement === 'right') {
    left = trigger.right + gap;
    top = trigger.top + (trigger.height - tooltip.height) / 2;
    if (left + tooltip.width > window.innerWidth - edge) left = trigger.left - tooltip.width - gap;
  }
  if (placement === 'top' && top < topEdge) top = trigger.bottom + gap;
  if (placement === 'bottom' && top + tooltip.height > window.innerHeight - edge) {
    top = trigger.top - tooltip.height - gap;
  }

  // Portals leave their dialog's stacking context. Stay above its overlay, including custom Tools/Info layers.
  let zIndex=100;
  let dialogLayer:HTMLElement|null=triggerElement.closest<HTMLElement>('[role="dialog"]');
  while(dialogLayer&&dialogLayer!==document.body){
    const layer=Number.parseInt(window.getComputedStyle(dialogLayer).zIndex,10);
    if(Number.isFinite(layer))zIndex=Math.max(zIndex,layer+1);
    dialogLayer=dialogLayer.parentElement;
  }
  return { left: Math.min(maxLeft, Math.max(edge, left)), top: Math.min(maxTop, Math.max(topEdge, top)), zIndex };
}

const TOOLTIP_SURFACE = 'rounded-md bg-[rgba(14,18,28,0.96)] border border-[rgba(120,160,255,0.35)] px-2.5 py-1 text-xs text-[#f3f4f6] shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_12px_rgba(59,130,246,0.2)] backdrop-blur-md transition-opacity duration-150 animate-fade-in';

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  delayMs = 200,
  className = '',
  disabled = false,
  portal = false,
  viewportTopInset = 0,
  open,
  onOpenChange,
  interactive = false,
  align = 'center',
  dismissOnAction = false,
}) => {
  const [uncontrolledVisible, setUncontrolledVisible] = useState(false);
  const [actionDismissed, setActionDismissed] = useState(false);
  const actionDismissedRef = useRef(false);
  const pointerHoveredRef = useRef(false);
  const isVisible = !actionDismissed && (open ?? uncontrolledVisible);
  const updateVisibility = (next: boolean) => {
    setUncontrolledVisible(next);
    onOpenChange?.(next);
  };
  const [portalPosition, setPortalPosition] = useState<PortalPosition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const dismissForAction = () => {
    if (!dismissOnAction) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    actionDismissedRef.current = true;
    setActionDismissed(true);
    updateVisibility(false);
    setPortalPosition(null);
  };
  const resetActionDismissal = () => {
    actionDismissedRef.current = false;
    setActionDismissed(false);
  };
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const handleMouseEnter = () => {
    pointerHoveredRef.current = true;
    if (disabled || !content || open === false || actionDismissedRef.current) return;
    timeoutRef.current = setTimeout(() => {
      updateVisibility(true);
    }, delayMs);
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    // An opened dialog can cover the trigger without the pointer moving away.
    const stillOverTrigger = !!bounds && event.clientX >= bounds.left && event.clientX < bounds.right
      && event.clientY >= bounds.top && event.clientY < bounds.bottom;
    pointerHoveredRef.current = stillOverTrigger;
    if (!stillOverTrigger) resetActionDismissal();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (open === true) {
      setUncontrolledVisible(false);
      return;
    }
    updateVisibility(false);
    setPortalPosition(null);
  };

  const handleFocus = () => {
    if (disabled || !content || open === false || actionDismissedRef.current) return;
    updateVisibility(true);
  };

  const handleBlur = () => {
    if (!pointerHoveredRef.current) resetActionDismissal();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (open === true) {
      setUncontrolledVisible(false);
      return;
    }
    updateVisibility(false);
    setPortalPosition(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUncontrolledVisible(false);
        onOpenChange?.(false);
        setPortalPosition(null);
      }
    };

    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onOpenChange, open]);

  useLayoutEffect(() => {
    if (!isVisible || !portal) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;
      setPortalPosition(placePortalTooltip(trigger, tooltip, { placement, align, viewportTopInset }));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isVisible, portal, placement, viewportTopInset, align]);

  const placementClasses = getPlacementClasses(placement);
  const popup = isVisible && (
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      style={portal ? {
        position: 'fixed',
        top: portalPosition?.top ?? 0,
        left: portalPosition?.left ?? 0,
        visibility: portalPosition ? 'visible' : 'hidden',
        zIndex:portalPosition?.zIndex??100,
      } : undefined}
      className={`${portal ? 'z-[100]' : 'z-50'} ${interactive ? 'pointer-events-auto select-text' : 'pointer-events-none'} whitespace-nowrap ${TOOLTIP_SURFACE} ${portal ? 'max-w-[calc(100vw-16px)]' : `absolute ${placementClasses}`} ${className}`.trim()}
    >
      {content}
    </div>
  );

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPointerDownCapture={dismissForAction}
      onClickCapture={dismissForAction}
    >
      {React.cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      })}

      {portal && popup ? createPortal(popup, document.body) : popup}
    </div>
  );
};

Tooltip.displayName = 'Tooltip';

const HINT_SELECTOR = '[data-hint],[data-hint-overflow]';

/** Text clipped by `text-overflow`, a line clamp or a fixed box. */
function isClipped(element: HTMLElement) {
  return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
}

function hintText(element: HTMLElement) {
  const text = (element.dataset.hint || element.textContent || '').trim();
  if (!text || (element.hasAttribute('data-hint-overflow') && !isClipped(element))) return null;
  return text;
}

/**
 * Plain-text hints for any element without wrapping it, styled like `Tooltip`. Mount once per page.
 * `data-hint="…"` always shows its text; `data-hint-overflow` shows the element's own text (or `data-hint`)
 * only while it is clipped. Pointer hover and keyboard focus open it; touch, press, Escape and scroll close it.
 */
export function HintLayer({ viewportTopInset = 0, delayMs = 250 }: { viewportTopInset?: number; delayMs?: number }) {
  const [hint, setHint] = useState<{ target: HTMLElement; text: string } | null>(null);
  const [position, setPosition] = useState<PortalPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const insetRef = useRef(viewportTopInset);
  insetRef.current = viewportTopInset;
  const hintId = useId();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setHint(null);
      setPosition(null);
    };
    const open = (target: HTMLElement, wait: number) => {
      clearTimeout(timer);
      current = target;
      const text = hintText(target);
      if (!text) { setHint(null); setPosition(null); return; }
      if (wait <= 0) setHint({ target, text });
      else timer = setTimeout(() => { if (current === target) setHint({ target, text }); }, wait);
    };
    const find = (node: EventTarget | null) => node instanceof Element ? node.closest<HTMLElement>(HINT_SELECTOR) : null;
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const target = find(event.target);
      if (target === current) return;
      if (target) open(target, delayMs); else hide();
    };
    const onPointerOut = (event: PointerEvent) => {
      if (current && !(event.relatedTarget instanceof Node && current.contains(event.relatedTarget))) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = find(event.target);
      if (target) open(target, 0); else if (current) hide();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && current) hide(); };
    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [delayMs]);

  useLayoutEffect(() => {
    if (!hint) return;
    const { target } = hint;
    const describes = target.hasAttribute('data-hint') && !target.hasAttribute('aria-describedby') && target.getAttribute('aria-label') !== hint.text;
    if (describes) target.setAttribute('aria-describedby', hintId);
    const update = () => {
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!target.isConnected) { setHint(null); setPosition(null); return; }
      if (tooltip) setPosition(placePortalTooltip(target, tooltip, { placement: 'top', align: 'center', viewportTopInset: insetRef.current }));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      if (describes) target.removeAttribute('aria-describedby');
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [hint, hintId]);

  if (!hint) return null;
  return createPortal(
    <div
      ref={tooltipRef}
      id={hintId}
      role="tooltip"
      data-hint-popup
      style={{ position: 'fixed', top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden', zIndex: position?.zIndex ?? 100 }}
      className={`pointer-events-none w-max max-w-[min(360px,calc(100vw-16px))] whitespace-normal break-words leading-normal ${TOOLTIP_SURFACE}`}
    >
      {hint.text}
    </div>,
    document.body,
  );
}
