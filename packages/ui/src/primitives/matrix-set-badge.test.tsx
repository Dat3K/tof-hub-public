import React from 'react';
import {render,screen} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {MatrixSetBadge} from './matrix-set-badge';

describe('MatrixSetBadge',()=>{
  it('keeps localized count text and caller accessibility attributes',()=>{
    render(<MatrixSetBadge aria-label="Комплект из 2 предметов" className="layout">✦ 2 предмета</MatrixSetBadge>);
    const badge=screen.getByLabelText('Комплект из 2 предметов');
    expect(badge.textContent).toBe('✦ 2 предмета');
    expect(badge.classList.contains('tof-matrix-set-badge')).toBe(true);
    expect(badge.classList.contains('layout')).toBe(true);
  });
});
