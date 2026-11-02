import {describe,it,expect} from 'vitest';
import {carryOverInheritedCustomProperties} from './dom-snapshot';

describe('snapshot theme inheritance',()=>{
  it('keeps live relative tokens by default',()=>{
    const source=document.createElement('div'),clone=document.createElement('div');
    source.style.setProperty('--spacing','.25rem');
    carryOverInheritedCustomProperties(source,clone);
    expect(clone.style.getPropertyValue('--spacing')).toBe('.25rem');
  });
  it('freezes fixed-canvas tokens without changing asset URLs or quoted labels',()=>{
    const source=document.createElement('div'),clone=document.createElement('div');
    source.style.setProperty('--spacing','.25rem');
    source.style.setProperty('--text-xs','.75rem');
    source.style.setProperty('--art','url("/art/2rem.webp")');
    source.style.setProperty('--caption','"2rem"');
    carryOverInheritedCustomProperties(source,clone,{remSize:16});
    expect(clone.style.getPropertyValue('--spacing')).toBe('4px');
    expect(clone.style.getPropertyValue('--text-xs')).toBe('12px');
    expect(clone.style.getPropertyValue('--art')).toBe('url("/art/2rem.webp")');
    expect(clone.style.getPropertyValue('--caption')).toBe('"2rem"');
  });
});
