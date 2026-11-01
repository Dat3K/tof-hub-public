'use client';

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, type Locale } from '@tof-hub/i18n';
import { I18nContext } from './context';
import type { I18nContextValue } from './types';

/**
 * Accesses the full i18n context (current locale, setter, i18next instance, t helper).
 * Safe against usage outside I18nProvider.
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      source: 'fallback',
      setLocale: () => {},
      t: (((key: string) => key) as unknown) as I18nContextValue['t'],
      i18n: (null as unknown) as I18nContextValue['i18n'],
    };
  }

  return context;
}

/**
 * Lightweight hook returning only the active locale and its setter.
 */
export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const { locale, setLocale } = useI18n();
  return { locale, setLocale };
}

export { useTranslation };
