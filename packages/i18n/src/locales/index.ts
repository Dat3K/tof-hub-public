import { en, type TranslationSchema } from './en';
import { ru } from './ru';
import { SUPPORTED_LOCALES, type Locale } from '../constants';
import { localizeUiCopy } from '../ui-text';

export { en, ru };
export type { TranslationSchema };

export const resources: Record<Locale, { translation: TranslationSchema }> = Object.fromEntries(
  SUPPORTED_LOCALES.map(locale => [locale, { translation: locale === 'ru' ? ru : localizeUiCopy(en, locale) }]),
) as Record<Locale, { translation: TranslationSchema }>;

export type TranslationResources = typeof resources;
