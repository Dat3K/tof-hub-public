import {describe,expect,it} from 'vitest';
import {render,screen} from '@testing-library/react';
import {ComparisonFormula} from './comparison-formula';

describe('replacement formula explanation',()=>{
  it('does not multiply inherited Altered ATK by the native percentage twice',()=>{
    render(<ComparisonFormula locale="en" role="dps" inherited/>);
    const factors=screen.getByRole('group',{name:'Output factors'});
    expect(factors.textContent).toContain('Inherited ATK × 1 × (1 + DMG%)');
    expect(factors.textContent).not.toContain('ATK%');
  });
  it.each(['en','ru'] as const)('shows only the factors used by each role · %s',locale=>{
    for(const role of ['dps','healer','tank'] as const){
      const {container,unmount}=render(<ComparisonFormula locale={locale} role={role}/>);
      expect(container.textContent).toContain(`${locale==='ru'?'прирост':'gain'} = O(candidate) / O(equipped) − 1`);
      const factors=screen.getByRole('group',{name:locale==='ru'?'Множители результата':'Output factors'});
      if(role==='tank'){
        expect(factors.textContent).toContain('HP%');
        expect(factors.textContent).not.toContain('ATK%');
      }else{
        expect(factors.textContent).toContain('ATK%');
        expect(factors.textContent?.includes('DMG%')).toBe(role==='dps');
      }
      expect(container.querySelectorAll('[data-formula-term][tabindex="0"]').length).toBeGreaterThan(4);
      expect(screen.getByRole('region',{name:locale==='ru'?'Точный прирост от замены':'Exact replacement gain'})).toBeDefined();
      unmount();
    }
  });
});
