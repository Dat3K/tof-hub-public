import React, { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useDismiss, type UseDismissOptions } from './use-dismiss';

afterEach(cleanup);

function Popup({ onDismiss, ...options }: Omit<UseDismissOptions, 'refs'>) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss({ refs: [ref], onDismiss, ...options });
  return (
    <div>
      <div ref={ref}><button type="button">inside</button></div>
      <button type="button">outside</button>
      <span role="tooltip">tip</span>
    </div>
  );
}

describe('useDismiss', () => {
  it('dismisses on an outside press and on Escape, not on an inside press', () => {
    const onDismiss = vi.fn();
    render(<Popup onDismiss={onDismiss} />);
    fireEvent.pointerDown(screen.getByText('inside'));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('outside'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss.mock.calls).toEqual([['outside'], ['escape']]);
  });
  it('honours the ignore selector, escape: false and enabled: false', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Popup onDismiss={onDismiss} ignore='[role="tooltip"]' escape={false} />);
    fireEvent.pointerDown(screen.getByText('tip'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
    rerender(<Popup onDismiss={onDismiss} enabled={false} />);
    fireEvent.pointerDown(screen.getByText('outside'));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
