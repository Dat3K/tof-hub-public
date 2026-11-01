import {cleanup,render} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {LoadoutBadges} from './loadout-filters';

afterEach(cleanup);
describe('loadout element badges',()=>{
  it.each([
    ['Physical','Flame','wuhuo'],['Flame','Physical','huowu'],
    ['Frost','Volt','binglei'],['Volt','Frost','leibing'],
  ])('renders the ordered %s / %s game duo icon', (primary,secondary,icon)=>{
    const {container}=render(<LoadoutBadges elements={[primary,secondary]} role="" locale="en"/>);
    expect(container.querySelectorAll('[data-presentation="icon"]')).toHaveLength(1);
    expect(container.querySelector('img')?.getAttribute('src')).toContain(`icon_element_${icon}`);
    expect(container.textContent).toContain(`${primary} / ${secondary}`);
  });
  it.each(['Physical','Flame','Frost','Volt','Altered'])('preserves single %s badges', element=>{
    const {container}=render(<LoadoutBadges elements={[element]} role="" locale="en"/>);
    expect(container.querySelectorAll('[data-presentation="icon"]')).toHaveLength(1);
    expect(container.querySelector('img')?.getAttribute('src')).not.toMatch(/wuhuo|huowu|binglei|leibing/);
    expect(container.textContent).toBe(element);
  });
  it('names both elements in Russian and leaves unknown elements empty',()=>{
    const {container,rerender}=render(<LoadoutBadges elements={['Frost','Volt']} role="" locale="ru"/>);
    expect(container.textContent).toBe('Лед / Электро');
    rerender(<LoadoutBadges elements={[]} role="" locale="ru"/>);
    expect(container.querySelector('img')).toBeNull();
  });
});
