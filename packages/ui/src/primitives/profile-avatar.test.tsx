import React from 'react';
import {render,screen} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {ProfileAvatar} from './profile-avatar';
describe('ProfileAvatar',()=>{
  it('aligns the generated oversized canvas and keeps the frame decorative',()=>{
    const {container}=render(<ProfileAvatar size={32} avatarLabel="Игрок" avatar={{icon:'/avatar.webp',canvas:{width:2,height:1,centerX:.4,centerY:.5}}} frame={{icon:'/frame.webp'}}/>);
    const avatar=screen.getByRole('img',{name:'Игрок'});
    expect(avatar.style.width).toBe('calc(64 * var(--ui-unit, .0625rem))');expect(avatar.style.transform).toBe('translate(-40%, -50%)');
    expect(Number(avatar.style.top.match(/ - calc\(([\d.]+) /)?.[1])).toBeCloseTo(32*2/53);
    expect((container.querySelector('.avatar-frame') as HTMLElement).style.top).toBe('50%');
    expect(container.querySelector('.avatar-frame')?.getAttribute('alt')).toBe('');
    expect(container.querySelector('[data-framed=true]')).not.toBeNull();
  });
  it('keeps caller fallback and accessibility when the ID is unavailable',()=>{
    render(<ProfileAvatar aria-label="Unknown avatar">A</ProfileAvatar>);
    expect(screen.getByLabelText('Unknown avatar').textContent).toBe('A');
  });
});
