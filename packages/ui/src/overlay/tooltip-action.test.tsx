import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Tooltip} from './tooltip';

afterEach(()=>{cleanup();vi.useRealTimers();});
const advance=(ms:number)=>act(()=>vi.advanceTimersByTime(ms));

describe('Tooltip action dismissal',()=>{
  it('waits one second, cancels a pending hover on action and permits a new hover',()=>{
    vi.useFakeTimers();
    const onClick=vi.fn();
    render(<Tooltip content="Explanation" delayMs={1000} dismissOnAction><button onClick={onClick}>Toggle</button></Tooltip>);
    const button=screen.getByRole('button');
    fireEvent.mouseEnter(button);
    advance(999);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.pointerDown(button);
    fireEvent.focus(button);
    fireEvent.click(button);
    advance(2000);
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseLeave(button);
    fireEvent.mouseEnter(button);
    advance(1000);
    expect(screen.getByRole('tooltip').textContent).toBe('Explanation');
    fireEvent.click(button);
    advance(2000);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('keeps ordinary tooltip click behavior unchanged',()=>{
    vi.useFakeTimers();
    render(<Tooltip content="Explanation" delayMs={1000}><button>Action</button></Tooltip>);
    const button=screen.getByRole('button');
    fireEvent.mouseEnter(button);
    advance(1000);
    fireEvent.click(button);
    expect(screen.getByRole('tooltip').textContent).toBe('Explanation');
  });
  it('dismisses after a keyboard action and restores help on a later focus',()=>{
    render(<Tooltip content="Explanation" dismissOnAction><button>Action</button></Tooltip>);
    const button=screen.getByRole('button');
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.blur(button);
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });
});
