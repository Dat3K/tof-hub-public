import {
  COOKIE_MAX_AGE,
  DEFAULT_LOCALE,
  LEGACY_COOKIE_NAME,
  LEGACY_STORAGE_KEYS,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  type Locale,
} from '@tof-hub/i18n';

/**
 * Reads a cookie by name in browser environments.
 */
export function readCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined' || typeof document.cookie !== 'string') {
      return null;
    }
    const prefix = encodeURIComponent(name) + '=';
    const entry = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

/**
 * Writes the canonical tof_locale cookie at Path=/ with 1-year expiration, SameSite=Lax,
 * and Secure when running over HTTPS. Also clears legacy subpath cookies if present.
 */
export function writeLocaleCookie(locale: Locale): void {
  try {
    if (typeof document === 'undefined') return;

    const isSecure = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const secureFlag = isSecure ? '; Secure' : '';

    // Set canonical root cookie
    document.cookie = `${encodeURIComponent(LOCALE_COOKIE_NAME)}=${encodeURIComponent(
      locale
    )}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secureFlag}`;

    // Clean up legacy scoped cookies at /datamine/ and /datamine if they exist
    document.cookie = `${encodeURIComponent(LEGACY_COOKIE_NAME)}=; Max-Age=0; Path=/datamine/; SameSite=Lax${secureFlag}`;
    document.cookie = `${encodeURIComponent(LEGACY_COOKIE_NAME)}=; Max-Age=0; Path=/datamine; SameSite=Lax${secureFlag}`;
  } catch {
    // Storage / cookie access may throw in restricted sandboxes
  }
}

/**
 * Reads the client locale from browser cookies following the exact precedence:
 * 1. valid tof_locale cookie
 * 2. legacy tof-datamine-language cookie
 */
export function readClientCookieLocale(): { locale: Locale; source: 'tof_locale' | 'legacy_cookie' } | null {
  const newCookie = readCookie(LOCALE_COOKIE_NAME);
  if (isValidLocale(newCookie)) {
    return { locale: newCookie, source: 'tof_locale' };
  }

  const legacyCookie = readCookie(LEGACY_COOKIE_NAME);
  if (isValidLocale(legacyCookie)) {
    return { locale: legacyCookie, source: 'legacy_cookie' };
  }

  return null;
}

/**
 * Performs a one-time migration from legacy or stored localStorage keys to the canonical tof_locale cookie.
 * Priority:
 * 1. tof_locale (canonical storage)
 * 2. tof-datamine-language (primary legacy key)
 * 3. legacy section keys: fce-language, seq-language, items-language
 *
 * Catches all storage exceptions so restricted browser contexts (e.g. privacy mode) never break.
 * Returns the recovered locale if found, or null if no storage exists.
 */
export function migrateLegacyStorage(): Locale | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      return null;
    }

    if (!storage) {
      return null;
    }

    // 1. Canonical key in storage
    const canonicalStored = storage.getItem(LOCALE_COOKIE_NAME);
    if (isValidLocale(canonicalStored)) {
      writeLocaleCookie(canonicalStored);
      return canonicalStored;
    }

    // 2. Primary legacy key
    const primaryStored = storage.getItem(LEGACY_COOKIE_NAME);
    if (isValidLocale(primaryStored)) {
      writeLocaleCookie(primaryStored);
      try {
        storage.setItem(LOCALE_COOKIE_NAME, primaryStored);
      } catch {
        // Silently ignore storage errors in restricted contexts
      }
      return primaryStored;
    }

    // 3. Fragmented legacy section keys
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacyValue = storage.getItem(key);
      if (isValidLocale(legacyValue)) {
        writeLocaleCookie(legacyValue);
        try {
          storage.setItem(LOCALE_COOKIE_NAME, legacyValue);
          storage.setItem(LEGACY_COOKIE_NAME, legacyValue);
        } catch {
          // Silently ignore storage errors in restricted contexts
        }
        return legacyValue;
      }
    }
  } catch (error) {
    // Storage access may throw in private browsing / sandboxed contexts. Never break the application.
    console.warn('[i18n] Failed to access localStorage during migration:', error);
  }

  return null;
}

/**
 * Persists locale to browser localStorage (safe against storage errors).
 */
export function writeLocaleStorage(locale: Locale): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      return;
    }

    if (!storage) {
      return;
    }

    storage.setItem(LOCALE_COOKIE_NAME, locale);
    storage.setItem(LEGACY_COOKIE_NAME, locale);
  } catch {
    // Silently ignore storage errors in restricted contexts
  }
}
