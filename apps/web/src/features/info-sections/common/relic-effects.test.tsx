import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {RelicEffects} from './relic-effects';

it('shows the base effect and all unlocked advancements in the chosen language',()=>{
  const item={description:{en:'Base description',ru:'Описание эффекта'},effects:[1,2,3,4,5].map(level=>({level,description:{en:`Rank ${level} effect`,ru:`Эффект ${level}`}}))};
  const {rerender}=render(<RelicEffects item={item} stars={3} locale="en"/>);
  expect(screen.getByText('Base effect')).toBeTruthy();
  for(const level of [1,2,3])expect(screen.getByText(`★${level}`).parentElement?.textContent).toMatch(new RegExp(`Rank\\s*${level}\\s*effect`));
  expect(screen.queryByText('★4')).toBeNull();
  rerender(<RelicEffects item={item} stars={0} locale="en"/>);
  expect(screen.queryByText('★1')).toBeNull();
  rerender(<RelicEffects item={item} stars={5} locale="ru"/>);
  expect(screen.getByText('Основной эффект')).toBeTruthy();
  for(const level of [1,2,3,4,5])expect(screen.getByText(`★${level}`).parentElement?.textContent).toMatch(new RegExp(`Эффект\\s*${level}`));
});
