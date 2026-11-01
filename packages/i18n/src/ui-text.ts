import { SUPPORTED_LOCALES, isValidLocale, type Locale } from './constants';
import { uiTranslations } from './locales/ui-translations';

/** Source-keyed UI copy, with an explicit English fallback for untranslated prose. */
export function translateUiText(text: string, locale: Locale | string): string {
  if (locale === 'en') return text;
  const dictionary = isValidLocale(locale) ? uiTranslations[locale] : undefined;
  if (!dictionary) return text;
  const exact = dictionary[text];
  if (exact !== undefined) return exact;
  const match = /^(\s*)(.*?)([:…]|\.\.\.)?(\s*)$/s.exec(text);
  if (!match) return text;
  const translated = dictionary[match[2]] ?? dictionary[match[2].toLowerCase()];
  return translated === undefined ? text : `${match[1]}${translated}${match[3] ?? ''}${match[4]}`;
}

const copies = new WeakMap<object, Map<Locale, unknown>>();

/** Keep existing typed feature dictionaries; translate immutable copy once per locale. */
export function localizeUiCopy<T>(copy: T, requestedLocale: Locale | string): T {
  const locale = isValidLocale(requestedLocale) ? requestedLocale : 'en';
  if (typeof copy === 'string') return translateUiText(copy, locale) as T;
  if (!copy || typeof copy !== 'object' || locale === 'en') return copy;
  // JSX is owned by React, not a translation dictionary.
  if ('$$typeof' in copy) return copy;
  const cached = copies.get(copy)?.get(locale);
  if (cached) return cached as T;
  const result = (Array.isArray(copy) ? copy.map(value => localizeUiCopy(value, locale))
    : Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, localizeUiCopy(value, locale)]))) as T;
  const locales = copies.get(copy) ?? new Map<Locale, unknown>();
  locales.set(locale, result);
  copies.set(copy, locales);
  return result;
}

type CopySchema<T> = T extends string ? string : T extends (...args: any[]) => any ? T : T extends object ? { [K in keyof T]: CopySchema<T[K]> } : T;

/** Complete locale lookup tables at their definition, so callers never index missing copy. */
export function createLocaleCopies<T extends { en: unknown; ru: unknown }>(source: T): Record<Locale, CopySchema<T['en']>> {
  const result = {} as Record<Locale, CopySchema<T['en']>>;
  for (const locale of SUPPORTED_LOCALES) {
    Object.defineProperty(result, locale, {
      enumerable: true,
      get: () => (source as Partial<Record<Locale, unknown>>)[locale] ?? localizeUiCopy(source.en, locale),
    });
  }
  return result;
}

/**
 * `localized` for site-authored copy: an explicit culture entry wins, otherwise the English source runs
 * through the shared UI phrase table. Never use it for game data (names, descriptions), which must keep
 * the honest English fallback of `localized`.
 */
export function localizedUi<T>(values: { en: T } & Partial<Record<Locale, T>>, locale: Locale | string): T;
export function localizedUi<T>(values: ({ en: T } & Partial<Record<Locale, T>>) | null | undefined, locale: Locale | string): T | undefined;
export function localizedUi<T>(values: Partial<Record<Locale, T>> | null | undefined, locale: Locale | string): T | undefined {
  const own = isValidLocale(locale) ? values?.[locale] : undefined;
  const source = values?.en;
  // A culture value identical to the English source is the pipeline's untranslated copy, not a translation.
  if (own !== undefined && own !== null && (locale === 'en' || locale === 'ru' || own !== source)) return own;
  return source === undefined ? undefined : localizeUiCopy(source, locale);
}
