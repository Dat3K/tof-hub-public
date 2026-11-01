import {expect, it} from 'vitest';
import {parseEnemyGradeText} from './enemy-grade-text';

it('keeps the recommended-level text and the exact English labels and grades', () => {
  expect(parseEnemyGradeText('Recommended Lv. 47\r\nHP A, Defense B, Shield S, Attack B')).toEqual({
    summary: 'Recommended Lv. 47', ratings: [
      {label: 'HP', grade: 'A'}, {label: 'Defense', grade: 'B'}, {label: 'Shield', grade: 'S'}, {label: 'Attack', grade: 'B'},
    ],
  });
});

it('recognizes Russian labels, non-breaking spaces and the source separators', () => {
  expect(parseEnemyGradeText('Рекомендуется ур. 47\r\nОЗ — A, защита — B, щит — SS, атака — B')?.ratings).toEqual([
    {label: 'ОЗ', grade: 'A'}, {label: 'защита', grade: 'B'}, {label: 'щит', grade: 'SS'}, {label: 'атака', grade: 'B'},
  ]);
});

it('retains grades without an icon and handles a source without a level summary', () => {
  expect(parseEnemyGradeText('HP SS, Defense A, Shield E, Attack D')).toEqual({
    summary: '', ratings: [
      {label: 'HP', grade: 'SS'}, {label: 'Defense', grade: 'A'}, {label: 'Shield', grade: 'E'}, {label: 'Attack', grade: 'D'},
    ],
  });
});

it('leaves unknown or mixed numeric formats intact for the existing rich-text fallback', () => {
  for (const text of ['', 'Recommended Lv. 47', 'HP A, Defense 10', 'HP A, Shield Unknown', '<blue>HP</blue> A']) {
    expect(parseEnemyGradeText(text)).toBeNull();
  }
});
