import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from './tooltip';

afterEach(() => vi.restoreAllMocks());

describe('Tooltip portal', () => {
  it('places the portalled popup above the containing dialog and its custom overlay',()=>{
    render(<div style={{position:'fixed',zIndex:2500}}><div role="dialog" style={{position:'relative',zIndex:80}}>
      <Tooltip portal content="Above the dialog"><button type="button">Explain</button></Tooltip>
    </div></div>);
    fireEvent.focus(screen.getByRole('button',{name:'Explain'}));
    expect(Number(screen.getByRole('tooltip').style.zIndex)).toBeGreaterThan(2500);
  });
  it('escapes clipped ancestors and keeps a left-edge popup in the viewport', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const isPopup = this.getAttribute('role') === 'tooltip';
      return {
        x: isPopup ? 0 : 2, y: isPopup ? 0 : 150,
        left: isPopup ? 0 : 2, top: isPopup ? 0 : 150,
        right: isPopup ? 256 : 30, bottom: isPopup ? 100 : 170,
        width: isPopup ? 256 : 28, height: isPopup ? 100 : 20,
        toJSON: () => ({}),
      };
    });

    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <Tooltip portal content="Full pull details"><button type="button">Drop</button></Tooltip>
      </div>
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Drop' }));
    const popup = screen.getByRole('tooltip');
    expect(document.body.contains(popup)).toBe(true);
    expect(container.contains(popup)).toBe(false);
    expect(popup.style.left).toBe('8px');
    expect(popup.style.visibility).toBe('visible');
  });

  it('flips below the trigger when a portal popup would overlap the reserved header', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const isPopup = this.getAttribute('role') === 'tooltip';
      return {x:100,y:isPopup?0:150,left:100,top:isPopup?0:150,right:300,bottom:isPopup?100:170,width:200,height:isPopup?100:20,toJSON:()=>({})};
    });
    render(<Tooltip portal viewportTopInset={60} content="RV summary"><button type="button">RV</button></Tooltip>);
    fireEvent.focus(screen.getByRole('button', {name:'RV'}));
    expect(screen.getByRole('tooltip').style.top).toBe('178px');
  });

  it('keeps a controlled interactive tooltip open after the trigger is left', () => {
    const { rerender } = render(
      <Tooltip open interactive content={<span>Pull details</span>}>
        <button type="button">Drop</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole('button', { name: 'Drop' });
    fireEvent.mouseLeave(trigger);
    const popup = screen.getByRole('tooltip');
    expect(popup.textContent).toBe('Pull details');
    expect(popup.className).toContain('pointer-events-auto');

    rerender(
      <Tooltip open={false} interactive content={<span>Pull details</span>}>
        <button type="button">Drop</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
