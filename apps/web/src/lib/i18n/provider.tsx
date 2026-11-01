'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { I18nextProvider } from 'react-i18next';
import { createInstance, type i18n as I18nInstance } from 'i18next';
import {
  FALLBACK_LOCALE,
  isValidLocale,
  resources,
  SUPPORTED_LOCALES,
  type Locale,
} from '@tof-hub/i18n';
import { I18nContext } from './context';
import {
  migrateLegacyStorage,
  writeLocaleCookie,
  writeLocaleStorage,
} from './cookie';
import type { I18nContextValue, LocaleSource } from './types';

export interface I18nProviderProps {
  initialLocale: Locale;
  initialSource: LocaleSource;
  children: ReactNode;
}

export function I18nProvider({
  initialLocale,
  initialSource,
  children,
}: I18nProviderProps) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [source, setSourceState] = useState<LocaleSource>(initialSource);

  // Maintain client-side i18next instance initialized with the exact server locale
  const i18nRef = useRef<I18nInstance | null>(null);
  if (!i18nRef.current) {
    const instance = createInstance();
    instance.init({
      lng: initialLocale,
      fallbackLng: FALLBACK_LOCALE,
      resources,
      supportedLngs: [...SUPPORTED_LOCALES],
      load: 'currentOnly',
      defaultNS: 'translation',
      interpolation: {
        escapeValue: false,
      },
    });
    i18nRef.current = instance;
  }

  const i18n = i18nRef.current;

  // Active setter for language switching
  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (!isValidLocale(nextLocale)) return;

      // Update i18next instance language
      i18n.changeLanguage(nextLocale);
      setLocaleState(nextLocale);
      setSourceState('tof_locale');

      // Persist to cookie (canonical tof_locale at Path=/, 1yr, Lax, Secure under HTTPS)
      writeLocaleCookie(nextLocale);
      writeLocaleStorage(nextLocale);

      if (typeof document !== 'undefined') {
        document.documentElement.lang = nextLocale;
      }

      // Dispatch cross-framework events for legacy compatibility
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tof:language-change', { detail: nextLocale })
        );
        window.dispatchEvent(
          new CustomEvent('datamine:language-change', {
            detail: { language: nextLocale },
          })
        );
        window.dispatchEvent(
          new CustomEvent('datamine:languagechange', {
            detail: { language: nextLocale },
          })
        );
        window.dispatchEvent(
          new CustomEvent('info:language-change', {
            detail: { language: nextLocale },
          })
        );
      }

      // Revalidate server components with the updated cookie
      router?.refresh();
    },
    [i18n, router]
  );

  // Post-hydration one-time migration and event synchronization
  useEffect(() => {
    // Sync <html lang> with initial resolved locale
    if (document.documentElement.lang !== initialLocale) {
      document.documentElement.lang = initialLocale;
    }

    // 1. If server resolved via legacy cookie, migrate immediately to tof_locale cookie
    if (initialSource === 'legacy_cookie') {
      writeLocaleCookie(initialLocale);
      writeLocaleStorage(initialLocale);
      setSourceState('tof_locale');
    }

    // 2. Only if BOTH cookies were absent on the server:
    // Recover legacy localStorage once post-hydration, migrate to tof_locale cookie, and sync UI
    if (initialSource === 'fallback') {
      const recovered = migrateLegacyStorage();
      if (recovered && isValidLocale(recovered)) {
        if (recovered !== initialLocale) {
          i18n.changeLanguage(recovered);
          setLocaleState(recovered);
          setSourceState('tof_locale');
          document.documentElement.lang = recovered;

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('tof:language-change', { detail: recovered })
            );
            window.dispatchEvent(
              new CustomEvent('datamine:language-change', {
                detail: { language: recovered },
              })
            );
          }

          router?.refresh();
        }
      }
    }

    // 3. Listen for external legacy script language change events
    const handleLegacyEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const targetLang = typeof detail === 'string' ? detail : detail?.language;
      if (isValidLocale(targetLang) && targetLang !== i18n.language) {
        setLocale(targetLang);
      }
    };

    window.addEventListener('tof:language-change', handleLegacyEvent);
    window.addEventListener('datamine:language-change', handleLegacyEvent);
    window.addEventListener('info:language-change', handleLegacyEvent);

    return () => {
      window.removeEventListener('tof:language-change', handleLegacyEvent);
      window.removeEventListener('datamine:language-change', handleLegacyEvent);
      window.removeEventListener('info:language-change', handleLegacyEvent);
    };
  }, [initialLocale, initialSource, i18n, setLocale, router]);

  const contextValue: I18nContextValue = useMemo(
    () => ({
      locale,
      source,
      setLocale,
      t: i18n.t.bind(i18n),
      i18n,
    }),
    [locale, source, setLocale, i18n]
  );

  return (
    <I18nextProvider i18n={i18n}>
      <I18nContext.Provider value={contextValue}>
        {children}
      </I18nContext.Provider>
    </I18nextProvider>
  );
}
