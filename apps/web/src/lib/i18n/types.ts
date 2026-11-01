import type { i18n as I18nInstance, TFunction } from 'i18next';
import type { Locale } from '@tof-hub/i18n';

export type LocaleSource = 'tof_locale' | 'legacy_cookie' | 'fallback';

export interface ServerLocaleResult {
  locale: Locale;
  source: LocaleSource;
}

export interface I18nContextValue {
  locale: Locale;
  source: LocaleSource;
  setLocale: (nextLocale: Locale) => void;
  t: TFunction;
  i18n: I18nInstance;
}
