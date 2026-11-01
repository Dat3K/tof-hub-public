import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {render,fireEvent,screen} from '@testing-library/react';
import {vi} from 'vitest';
import { ModeSwitcher, getNextModeIndex } from './mode-switcher';

describe('ModeSwitcher', () => {
  const options = [
    { value: 'gear', label: 'Gear', tone: 'gold' },
    { value: 'players', label: 'Players', tone: 'sky' },
  ] as const;

  it('renders a radiogroup with custom options, data attribute and roving tabIndex', () => {
    const html = renderToStaticMarkup(
      <ModeSwitcher value="players" onChange={() => {}} options={options} dataAttribute="data-board" ariaLabel="Board" />
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Board"');
    expect(html).toContain('data-active-mode="players"');
    expect(html).toContain('data-board="gear"');
    expect(html).toContain('data-board="players"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('border-[#38bdf8]');
    expect(html).toContain('sim-mode-indicator');
  });

  it('shows option icons and the role tones of the role filter chips', () => {
    const html = renderToStaticMarkup(
      <ModeSwitcher value="tank" onChange={() => {}} ariaLabel="Role"
        options={[{ value: 'dps', label: 'DPS', tone: 'dps', icon: '/dps.webp' }, { value: 'tank', label: 'Tank', tone: 'tank', icon: '/tank.webp' }]} />
    );
    expect(html).toContain('src="/dps.webp"');
    expect(html).toContain('src="/tank.webp"');
    expect(html).toContain('border-[#3b82f6]');
  });

  it('moves cyclically with arrow keys and ignores other keys', () => {
    expect(getNextModeIndex('ArrowRight', 0, 2)).toBe(1);
    expect(getNextModeIndex('ArrowDown', 1, 2)).toBe(0);
    expect(getNextModeIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(getNextModeIndex('ArrowUp', 2, 3)).toBe(1);
    expect(getNextModeIndex('Enter', 0, 2)).toBeNull();
    expect(getNextModeIndex('ArrowRight', 0, 0)).toBeNull();
  });
  it.each(['embedded','standalone'] as const)('preserves keyboard selection and focus in %s presentation',presentation=>{
    const onChange=vi.fn();
    render(<ModeSwitcher presentation={presentation} value="gear" onChange={onChange} options={options} ariaLabel="Comparison scenario"/>);
    const gear=screen.getByRole('radio',{name:'Gear'}),players=screen.getByRole('radio',{name:'Players'});
    gear.focus();fireEvent.keyDown(gear,{key:'ArrowRight'});
    expect(onChange).toHaveBeenCalledWith('players');expect(document.activeElement).toBe(players);
  });
});
