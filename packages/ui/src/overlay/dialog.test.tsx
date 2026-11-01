import React, { useCallback, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog';

describe('Dialog confirmation', () => {
  it('focuses Cancel, dismisses without confirming and restores the opener without scrolling', () => {
    const confirm = vi.fn();
    function Example() {
      const [open, setOpen] = useState(false);
      const close = useCallback(() => setOpen(false), []);
      return <><button onClick={() => setOpen(true)}>Open</button>
        <Dialog isOpen={open} onClose={close} onConfirm={confirm} appearance="table"
          title="Clear this build?" description="Saved profiles remain." confirmLabel="Clear" />
      </>;
    }
    render(<Example />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    const focus = vi.spyOn(opener, 'focus');
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Clear this build?' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect(dialog.getAttribute('aria-describedby')).toBe(screen.getByText('Saved profiles remain.').id);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('blocks confirmation and dismissal while the action is loading', () => {
    const close = vi.fn(), confirm = vi.fn();
    render(<Dialog isOpen isLoading onClose={close} onConfirm={confirm} title="Clearing…" />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm$/ }));
    expect(close).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});
