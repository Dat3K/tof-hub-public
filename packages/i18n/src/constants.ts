/** Exact culture directories shipped under Hotta/Content/Localization/Game. */
export const SUPPORTED_LOCALES = ['en', 'ru', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN', 'zh-Hans', 'zh-Hans-SG'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const FALLBACK_LOCALE: Locale = 'en';

export const LOCALE_COOKIE_NAME = 'tof_locale';
export const LEGACY_COOKIE_NAME = 'tof-datamine-language';

export const LEGACY_STORAGE_KEYS = [
  'tof-datamine-language',
  'fce-language',
  'seq-language',
  'items-language',
] as const;

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

export function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (isValidLocale(value)) {
    return value;
  }
  return fallback;
}

/** Language subtags that map onto a shipped culture (Chinese variants share the Simplified UI). */
const ACCEPT_LANGUAGE_ALIASES: Record<string, Locale> = { in: 'id', zh: 'zh-CN' };

/**
 * Picks the best shipped culture from an `Accept-Language` header (RFC 9110 q-values, highest first);
 * undefined when none of the requested languages is shipped.
 */
export function negotiateLocale(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const requested = header.split(',').map((part, index) => {
    const [tag, ...params] = part.trim().split(';');
    const q = params.map(param => /^\s*q=([\d.]+)/i.exec(param)?.[1]).find(Boolean);
    return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), index };
  }).filter(entry => entry.tag && entry.tag !== '*' && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of requested) {
    const exact = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const primary = tag.toLowerCase().split('-')[0];
    const match = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === primary) ?? ACCEPT_LANGUAGE_ALIASES[primary];
    if (match) return match;
  }
  return undefined;
}

export interface LanguageOption {
  code: Locale;
  label: string;
  short: string;
  intl: string;
}

export const LANGUAGES: Record<Locale, LanguageOption> = {
  en: {
    code: 'en',
    label: 'English',
    short: 'EN',
    intl: 'en-US',
  },
  ru: {
    code: 'ru',
    label: 'Русский',
    short: 'RU',
    intl: 'ru-RU',
  },
  de: { code: 'de', label: 'Deutsch', short: 'DE', intl: 'de-DE' },
  es: { code: 'es', label: 'Español', short: 'ES', intl: 'es-ES' },
  fr: { code: 'fr', label: 'Français', short: 'FR', intl: 'fr-FR' },
  id: { code: 'id', label: 'Bahasa Indonesia', short: 'ID', intl: 'id-ID' },
  ja: { code: 'ja', label: '日本語', short: 'JA', intl: 'ja-JP' },
  ko: { code: 'ko', label: '한국어', short: 'KO', intl: 'ko-KR' },
  pt: { code: 'pt', label: 'Português', short: 'PT', intl: 'pt-BR' },
  th: { code: 'th', label: 'ไทย', short: 'TH', intl: 'th-TH' },
  'zh-CN': { code: 'zh-CN', label: '简体中文', short: 'ZH', intl: 'zh-CN' },
  'zh-Hans': { code: 'zh-Hans', label: '简体中文', short: 'ZH', intl: 'zh-Hans' },
  'zh-Hans-SG': { code: 'zh-Hans-SG', label: '简体中文（新加坡）', short: 'ZH-SG', intl: 'zh-SG' },
};

/** Picker languages; the three raw Simplified Chinese cultures share one option. */
export const LANGUAGE_MENU_LOCALES = SUPPORTED_LOCALES.filter(locale => locale !== 'zh-Hans' && locale !== 'zh-Hans-SG');
export type LanguageMenuLocale = (typeof LANGUAGE_MENU_LOCALES)[number];

export function getLanguageMenuLocale(locale: Locale): LanguageMenuLocale {
  return locale === 'zh-Hans' || locale === 'zh-Hans-SG' ? 'zh-CN' : locale;
}

/** Editorial copy can be incomplete; missing translations always fall back to English. */
export type Localized<T> = { en: T; ru: T } & Partial<Record<Locale, T>>;

export function localized<T>(values: { en: T } & Partial<Record<Locale, T>>, locale: Locale | string): T;
export function localized<T>(values: ({ en: T } & Partial<Record<Locale, T>>) | null | undefined, locale: Locale | string): T | undefined;
export function localized<T>(values: Partial<Record<Locale, T>> | null | undefined, locale: Locale | string): T | undefined;
export function localized<T>(values: Partial<Record<Locale, T>> | null | undefined, locale: Locale | string): T | undefined {
  return (isValidLocale(locale) ? values?.[locale] : undefined) ?? values?.en;
}

export function localeFallbacks(locale: Locale): readonly Locale[] {
  return locale === FALLBACK_LOCALE ? [locale] : [locale, FALLBACK_LOCALE];
}
