import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionSwitcher } from './section-switcher';

const ITEMS = [
  { id: 'main', href: '/', label: 'Main hub' },
  { id: 'info', href: '/info', label: 'Info' },
  { id: 'datamine', href: '/datamine', label: 'Datamine' },
  { id: 'tools', href: '/tools', label: 'Tools' },
];

function renderSwitcher() {
  return render(<SectionSwitcher title="Info" items={ITEMS} currentId="info" menuLabel="Site sections" />);
}

describe('SectionSwitcher', () => {
  it('opens a menu of the main hub and the three section hubs from the brand', () => {
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Info' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const links = screen.getAllByRole('menuitem');
    expect(links.map((link) => link.textContent)).toEqual(['Main hub', 'Info', 'Datamine', 'Tools']);
    expect(links.find((link) => link.getAttribute('aria-current') === 'page')?.textContent).toBe('Info');
  });

  it('closes on Escape and returns focus to the brand', () => {
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Info' });
    fireEvent.click(trigger);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps closed menu links out of the tab order', () => {
    renderSwitcher();
    for (const link of screen.getAllByRole('menuitem', { hidden: true })) {
      expect(link.getAttribute('tabindex')).toBe('-1');
    }
  });
});
