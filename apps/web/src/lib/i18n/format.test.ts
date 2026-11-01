import { describe, expect, it } from 'vitest';
import { formatDate, formatFixed, formatNumber, intlLocale } from './format';

describe('page-language formatters', () => {
  it('maps the page language to its Intl tags', () => {
    expect(intlLocale('ru')).toBe('ru-RU');
    expect(intlLocale('en')).toBe('en-US');
    expect(intlLocale('en', 'date')).toBe('en-GB');
  });
  it('formats numbers by the page language, not the browser', () => {
    expect(formatNumber(12345, 'en')).toBe('12,345');
    expect(formatNumber(12345, 'ru')).toBe('12 345');
    expect(formatFixed(2, 'en', 1)).toBe('2.0');
    expect(formatFixed(2.25, 'ru', 1)).toMatch(/^2,[23]$/);
  });
  it('keeps a UTC game timestamp on its recorded day and falls back for invalid input', () => {
    const late = '2026-05-03T23:30:00Z';
    expect(formatDate(late, 'en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })).toBe('3 May 2026');
    expect(formatDate('not a date', 'en', { timeZone: 'UTC' })).toBe('not a date');
    expect(formatDate('bad', 'ru', { timeZone: 'UTC' }, '—')).toBe('—');
  });
  it('formats raw 64-bit counters without losing integer precision',()=>{
    expect(formatNumber(9007199254740993n,'en')).toBe('9,007,199,254,740,993');
    expect(formatNumber(0n,'ru')).toBe('0');
  });
});
