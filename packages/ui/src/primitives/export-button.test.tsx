import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {ExportButton} from './export-button';

describe('ExportButton',()=>{
  it('disables repeated downloads while busy and keeps its accessible label',()=>{
    const click=vi.fn();
    const {rerender}=render(<ExportButton onClick={click}>Export PNG</ExportButton>);
    fireEvent.click(screen.getByRole('button',{name:'Export PNG'}));
    expect(click).toHaveBeenCalledTimes(1);
    rerender(<ExportButton busy onClick={click}>Exporting…</ExportButton>);
    const button=screen.getByRole('button',{name:'Exporting…'});
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('takes a sky tone and its own icon for a sibling action',()=>{
    render(<ExportButton tone="sky" icon={<svg data-testid="save-icon"/>}>Save build</ExportButton>);
    const button=screen.getByRole('button',{name:'Save build'});
    expect(button.getAttribute('data-tone')).toBe('sky');
    expect(screen.getByTestId('save-icon')).toBeTruthy();
  });
});
