import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {CatalogSearch} from './catalog-search';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('CatalogSearch embedded controls',()=>{
  it('reserves measured control width, updates on resize, clears and disconnects on unmount',()=>{
    let width=320,resize:()=>void=()=>{};
    const disconnect=vi.fn();
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({width} as DOMRect));
    vi.stubGlobal('ResizeObserver',class {
      constructor(callback:()=>void){resize=callback;}
      observe=vi.fn();disconnect=disconnect;
    });
    const onChange=vi.fn();
    const view=render(<CatalogSearch value="Alex" onChange={onChange} serverModeSlot={<span>Modes</span>} serverModeSizing="content"/>);
    const input=screen.getByRole('textbox'),clear=screen.getByRole('button',{name:'Clear search'});
    expect(input.style.paddingRight).toContain('356px');expect(input.style.paddingRight).toContain('100% - 40px');expect(clear.style.right).toBe('332px');
    act(()=>{width=120;resize();});
    expect(input.style.paddingRight).toContain('156px');expect(clear.style.right).toBe('132px');
    fireEvent.click(clear);expect(onChange).toHaveBeenCalledWith('');expect(document.activeElement).toBe(input);
    view.unmount();expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it('preserves the standard fixed mode layout by default',()=>{
    render(<CatalogSearch value="Alex" onChange={()=>{}} serverModeSlot={<span>Modes</span>}/>);
    expect(screen.getByRole('textbox').style.paddingRight).toBe('');
    expect(screen.getByRole('button',{name:'Clear search'}).style.right).toBe('');
  });
});
