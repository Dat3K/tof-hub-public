import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {DemoCallToAction} from './demo-call-to-action';

describe('DemoCallToAction',()=>{
  it('supports a link and prevents navigation when disabled',()=>{
    const {rerender}=render(<DemoCallToAction label="Example" importLabel="Upload build" importHref="/tools/build/"/>);
    expect(screen.getByRole('link',{name:'Upload build'}).getAttribute('href')).toBe('/tools/build/');
    rerender(<DemoCallToAction label="Example" importLabel="Upload build" importHref="/tools/build/" disabled/>);
    expect(screen.queryByRole('link')).toBeNull();
    expect((screen.getByRole('button',{name:'Upload build'}) as HTMLButtonElement).disabled).toBe(true);
  });
  it('preserves Build and Optimizer import actions and secondary content',()=>{
    const onImport=vi.fn();
    render(<DemoCallToAction label="Demo profile preview" importLabel="Import your build" onImport={onImport}><span>Secondary action</span></DemoCallToAction>);
    fireEvent.click(screen.getByRole('button',{name:'Import your build'}));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Secondary action')).toBeTruthy();
  });
});
