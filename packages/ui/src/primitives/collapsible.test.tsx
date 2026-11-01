import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {expect,it,vi,afterEach,beforeEach} from 'vitest';
import {Collapsible} from './collapsible';

beforeEach(()=>{
  Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,writable:true,value:vi.fn(()=>({cancel:vi.fn(),onfinish:null}))});
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();delete (HTMLElement.prototype as Partial<HTMLElement>).animate;});
it('mounts lazily and keeps closed content inert for closing and reopening',()=>{
  vi.useFakeTimers();
  const {rerender,container}=render(<Collapsible open={false} id="details"><button>Detail action</button></Collapsible>);
  expect(container.firstChild).toBeNull();
  rerender(<Collapsible open id="details"><button>Detail action</button></Collapsible>);
  const panel=container.querySelector('#details')!;
  const action=screen.getByText('Detail action');
  expect(panel.hasAttribute('data-open')).toBe(false);
  act(()=>vi.advanceTimersByTime(40));
  expect(panel.hasAttribute('data-open')).toBe(true);
  rerender(<Collapsible open={false} id="details"><button>Detail action</button></Collapsible>);
  expect(panel.hasAttribute('data-open')).toBe(false);
  expect(panel.hasAttribute('inert')).toBe(true);
  expect(panel.getAttribute('aria-hidden')).toBe('true');
  expect(panel.contains(action)).toBe(true);
  rerender(<Collapsible open id="details"><button>Detail action</button></Collapsible>);
  act(()=>vi.advanceTimersByTime(40));
  expect(panel.hasAttribute('inert')).toBe(false);
  expect(panel.hasAttribute('aria-hidden')).toBe(false);
  expect(panel.contains(action)).toBe(true);
});
it('does not construct unopened contents and cancels opening if closed before the next paint',()=>{
  vi.useFakeTimers();
  const content=vi.fn(()=> <button>Lazy content</button>);
  const {rerender,container}=render(<Collapsible open={false}>{content}</Collapsible>);
  expect(content).not.toHaveBeenCalled();
  rerender(<Collapsible open>{content}</Collapsible>);
  expect(content).toHaveBeenCalled();
  rerender(<Collapsible open={false}>{content}</Collapsible>);
  act(()=>vi.advanceTimersByTime(100));
  expect(container.firstElementChild?.hasAttribute('data-open')).toBe(false);
  expect(container.firstElementChild?.hasAttribute('inert')).toBe(true);
});
it('keeps a short layout animation when Windows requests reduced motion',()=>{
  vi.useFakeTimers();
  vi.spyOn(window,'matchMedia').mockReturnValue({matches:true} as MediaQueryList);
  render(<Collapsible open><div>Details</div></Collapsible>);
  act(()=>vi.advanceTimersByTime(40));
  expect(HTMLElement.prototype.animate).toHaveBeenCalledWith(expect.any(Array),expect.objectContaining({duration:180}));
});
