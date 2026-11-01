import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {StatHighlight,StatLink} from './stat-highlight';
import {WeaponIdentity} from './weapon-identity';

describe('Build empty fields and resistance inspection',()=>{
  it('keeps an unknown weapon upgrade visible without inventing a zero',()=>{
    render(<WeaponIdentity weapon={{id:'',stars:0,level:0,matrices:[]}} item={undefined} index={0} locale="en"/>);
    expect(screen.getByText('Up. —')).toBeTruthy();
  });
  it('highlights fixed universal resistance for an elemental resistance, but excludes it from roll-only inspection',()=>{
    const view=render(<StatHighlight><div>
      <StatLink types="Frost Resistance"><span>Element resistance</span></StatLink>
      <StatLink contribution="base" types="Resistance"><span>Fixed universal RES</span></StatLink>
      <StatLink contribution="base" types="Attack"><span>Fixed ATK</span></StatLink>
      <div className="gear-stat-totals"><StatLink types="Frost Resistance"><span>Roll total</span></StatLink></div>
    </div></StatHighlight>);
    fireEvent.mouseOver(screen.getByText('Element resistance'));
    expect(screen.getByText('Fixed universal RES').getAttribute('data-stat-match')).toBe('true');
    expect(screen.getByText('Fixed ATK').getAttribute('data-stat-match')).toBe('false');
    fireEvent.mouseOver(screen.getByText('Roll total'));
    expect(screen.getByText('Fixed universal RES').getAttribute('data-stat-match')).toBe('false');
    view.unmount();
  });
});
