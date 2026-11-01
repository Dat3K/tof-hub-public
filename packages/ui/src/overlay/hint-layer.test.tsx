import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HintLayer } from './tooltip';

afterEach(() => vi.restoreAllMocks());

function clip(element: HTMLElement, clipped: boolean) {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: 80 });
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: clipped ? 140 : 80 });
}

describe('HintLayer', () => {
  it('shows an explanatory hint on focus and links it to the trigger', () => {
    render(<><HintLayer/><button type="button" data-hint="Undo · Ctrl/Cmd+Z">↶</button></>);
    const trigger = screen.getByRole('button');
    fireEvent.focusIn(trigger);
    const hint = screen.getByRole('tooltip');
    expect(hint.textContent).toBe('Undo · Ctrl/Cmd+Z');
    expect(trigger.getAttribute('aria-describedby')).toBe(hint.id);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows overflow text only while it is clipped', () => {
    vi.useFakeTimers();
    render(<><HintLayer delayMs={10}/><b data-hint-overflow>Claudia Storm Eye</b><i data-hint-overflow>Twin Stars</i></>);
    const clipped = screen.getByText('Claudia Storm Eye'), whole = screen.getByText('Twin Stars');
    clip(clipped, true); clip(whole, false);
    fireEvent.pointerOver(whole, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(20); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerOver(clipped, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(20); });
    expect(screen.getByRole('tooltip').textContent).toBe('Claudia Storm Eye');
    fireEvent.pointerDown(clipped);
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('ignores touch hovers', () => {
    vi.useFakeTimers();
    render(<><HintLayer delayMs={0}/><span data-hint="Enhancement Level">+20</span></>);
    fireEvent.pointerOver(screen.getByText('+20'), { pointerType: 'touch' });
    act(() => { vi.advanceTimersByTime(10); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });
});
