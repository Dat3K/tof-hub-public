import {expect,it} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {StatHighlight,StatLink,statInspectTypes,CRIT_SOURCES} from './stat-highlight';

it('highlights the inspected stat and its sources when its enclosing dialog button receives focus',()=>{
  const {container}=render(<StatHighlight><article>
    <button className="inspect-trigger" aria-label="Crit"><StatLink types="Crit" inspectTypes={statInspectTypes('Crit')}><span tabIndex={-1}>5000</span></StatLink></button>
    <StatLink types={CRIT_SOURCES} inspectTypes={[]}><span data-testid="source">Weapon Crit</span></StatLink>
    <button aria-label="Other action">Other action</button>
  </article></StatHighlight>);
  fireEvent.focus(screen.getByRole('button',{name:'Crit'}));
  expect(container.querySelector('article')?.getAttribute('data-stat-highlight')).toContain('Crit Rate %');
  expect(screen.getByTestId('source').getAttribute('data-stat-match')).toBe('true');
  fireEvent.focus(screen.getByRole('button',{name:'Other action'}));
  expect(container.querySelector('article')?.hasAttribute('data-stat-highlight')).toBe(false);
});
