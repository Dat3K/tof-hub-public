import React, {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {Lightbox} from './lightbox';
import {Modal} from './modal';

beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()}))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const props = {onClose: () => {}, src: '/poster.png', animation: {src: '/motion.webp', gifSrc: '/motion.gif'}, alt: 'Sticker'};
describe('full animation viewer', () => {
  it('loads no images while closed; plays only in the open viewer and pauses on the static poster', () => {
    const {rerender} = render(<Lightbox {...props} isOpen={false}/>);
    expect(screen.queryByRole('img')).toBeNull();
    rerender(<Lightbox {...props} isOpen/>);
    expect(screen.getByAltText('Sticker').getAttribute('src')).toBe('/motion.webp');
    fireEvent.click(screen.getByRole('button', {name: 'Pause animation'}));
    expect(screen.getByAltText('Sticker').getAttribute('src')).toBe('/poster.png');
    expect(screen.getByRole('button', {name: 'Download GIF'})).toBeTruthy();
  });
  it('plays on open even with a reduced-motion preference and falls back to the poster on an animation error', () => {
    vi.mocked(window.matchMedia).mockReturnValue({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()} as unknown as MediaQueryList);
    render(<Lightbox {...props} isOpen zoomable={false} locale="ru"/>);
    expect(screen.getByAltText('Sticker').getAttribute('src')).toBe('/motion.webp');
    fireEvent.error(screen.getByAltText('Sticker'));
    expect(screen.getByAltText('Sticker').getAttribute('src')).toBe('/poster.png');
    expect(screen.queryByRole('button', {name: 'Включить анимацию'})).toBeNull();
  });
  it('Escape closes only the nested viewer and restores its opener in the parent dialog', () => {
    const parentClose = vi.fn();
    function Example() {
      const [open, setOpen] = useState(false);
      return <Modal isOpen onClose={parentClose} ariaLabel="Account">
        <button onClick={() => setOpen(true)}>Preview avatar</button>
        {open && <Lightbox {...props} isOpen onClose={() => setOpen(false)} zoomable={false}/>}
      </Modal>;
    }
    render(<Example/>);
    const opener = screen.getByRole('button', {name: 'Preview avatar'});
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('button', {name: 'Close'}), {key: 'Escape'});
    expect(parentClose).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(document.activeElement).toBe(opener);
  });
});
