import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {GameStatGrade} from './game-stat-grade';

afterEach(cleanup);

it('exposes the game letter as accessible image text and preserves caller styling', () => {
  render(<GameStatGrade grade="SS" className="existing-grade" title="Grade SS" />);
  const image = screen.getByRole('img', {name: 'SS'});
  expect(image.getAttribute('src')).toMatch(/\/equiptips\/tips_icon_SS\.webp$/);
  expect(image.classList.contains('existing-grade')).toBe(true);
  expect(image.getAttribute('title')).toBe('Grade SS');
});

it('shows unavailable grades as literal text without requesting a nonexistent texture', () => {
  const {rerender} = render(<GameStatGrade grade="E" />);
  expect(screen.getByText('E')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  rerender(<GameStatGrade grade="constructor" />);
  expect(screen.getByText('constructor')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
});
