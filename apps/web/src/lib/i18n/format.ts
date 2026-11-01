import { localized } from '@tof-hub/i18n';
import { LANGUAGES, type Locale } from '@tof-hub/i18n';

/**
 * Numbers and dates in the page language (Tools pages, 2026-10-08). Pass the active `Locale`, never a hand-picked
 * Intl tag: tags come from the shared language registry; English dates retain `en-GB` (day before month).
 * Formatters are cached per tag and options, since tables format thousands of values.
 */
export function intlLocale(locale: Locale, purpose: 'number' | 'date' = 'number'): string {
  return locale === 'en' && purpose === 'date' ? 'en-GB' : localized(LANGUAGES, locale).intl;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function cached<T>(cache: Map<string, T>, key: string, create: () => T): T {
  let format = cache.get(key);
  if (!format) {
    format = create();
    cache.set(key, format);
  }
  return format;
}

export function formatNumber(value: number | bigint, locale: Locale, options?: Intl.NumberFormatOptions): string {
  const tag = intlLocale(locale);
  return cached(numberFormats, `${tag}|${JSON.stringify(options ?? {})}`, () => new Intl.NumberFormat(tag, options)).format(value);
}

/** A number with exactly `digits` decimals (scores, percentages shown with a separate `%`). */
export function formatFixed(value: number, locale: Locale, digits: number): string {
  return formatNumber(value, locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * A date or time in the page language. An unparsable value returns `fallback` (by default the value itself, cut to
 * its date part). Pass `timeZone: 'UTC'` for game timestamps that are shown as recorded.
 */
export function formatDate(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
  fallback?: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback ?? String(value).slice(0, 10);
  const tag = intlLocale(locale, 'date');
  return cached(dateFormats, `${tag}|${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(tag, options)).format(date);
}
