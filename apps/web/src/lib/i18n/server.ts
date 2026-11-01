import { cookies, headers } from 'next/headers';
import { createInstance, type i18n as I18nInstance } from 'i18next';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LEGACY_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  negotiateLocale,
  resources,
  SUPPORTED_LOCALES,
  type Locale,
} from '@tof-hub/i18n';
import type { ServerLocaleResult } from './types';

/**
 * Resolves the active locale from a cookie getter following the exact precedence:
 * 1. Valid tof_locale cookie
 * 2. Valid legacy tof-datamine-language cookie
 * 3. The browser's Accept-Language, then the default fallback ('en')
 */
export function resolveLocaleFromCookieGetter(
  getCookie: (name: string) => string | undefined | null,
  acceptLanguage?: string | null
): ServerLocaleResult {
  const primaryCookie = getCookie(LOCALE_COOKIE_NAME);
  if (isValidLocale(primaryCookie)) {
    return {
      locale: primaryCookie,
      source: 'tof_locale',
    };
  }

  const legacyCookie = getCookie(LEGACY_COOKIE_NAME);
  if (isValidLocale(legacyCookie)) {
    return {
      locale: legacyCookie,
      source: 'legacy_cookie',
    };
  }

  // Nothing stored yet: follow the browser's language, otherwise English. Stays 'fallback' so a legacy stored choice can still win.
  return {
    locale: negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE,
    source: 'fallback',
  };
}

/**
 * Resolves the active locale on the Next.js server for the current incoming request.
 * Follows the exact precedence:
 * 1. Valid tof_locale cookie
 * 2. Valid legacy tof-datamine-language cookie
 * 3. The browser's Accept-Language, then the default fallback ('en')
 */
export async function resolveServerLocale(): Promise<ServerLocaleResult> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  return resolveLocaleFromCookieGetter((name) => cookieStore.get(name)?.value, requestHeaders.get('accept-language'));
}

/**
 * Creates a fresh, request-scoped i18next instance for SSR.
 * CRITICAL FOR NEXT SSR: Never reuse a global mutable i18next instance across concurrent requests
 * to eliminate cross-request locale bleed and hydration mismatches.
 */
export async function createI18nServerInstance(locale: Locale): Promise<I18nInstance> {
  const instance = createInstance();
  await instance.init({
    lng: locale,
    fallbackLng: FALLBACK_LOCALE,
    resources,
    supportedLngs: [...SUPPORTED_LOCALES],
    load: 'currentOnly',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false, // React already escapes string interpolations
    },
  });
  return instance;
}

/**
 * Convenience helper for Server Components needing localized translations.
 * Returns the resolved request-scoped locale, instance, and translation function.
 */
export async function getServerI18n() {
  const { locale, source } = await resolveServerLocale();
  const i18n = await createI18nServerInstance(locale);
  return {
    locale,
    source,
    i18n,
    t: i18n.t.bind(i18n),
  };
}
