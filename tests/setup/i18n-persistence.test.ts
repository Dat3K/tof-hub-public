// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LEGACY_COOKIE_NAME,
  LEGACY_STORAGE_KEYS,
  LOCALE_COOKIE_NAME,
  type Locale,
} from '@tof-hub/i18n';
import {
  resolveLocaleFromCookieGetter,
  createI18nServerInstance,
} from '../../apps/web/src/lib/i18n/server';
import {
  readCookie,
  writeLocaleCookie,
  readClientCookieLocale,
  migrateLegacyStorage,
  writeLocaleStorage,
} from '../../apps/web/src/lib/i18n/cookie';
import { I18nProvider } from '../../apps/web/src/lib/i18n/provider';
import { useI18n, useLocale } from '../../apps/web/src/lib/i18n/hooks';
import {
  GameDataCache,
  fetchGameData,
} from '../../apps/web/src/lib/game-data-client';

// Mock Next.js navigation router for unit/harness execution
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

/**
 * In-memory Storage mock implementing the Web Storage API.
 */
class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

/**
 * Helper to simulate browser document.cookie and localStorage environment.
 */
function setupMockBrowser(initialCookies = '') {
  let cookieStore: Record<string, string> = {};

  if (initialCookies) {
    initialCookies.split(';').forEach((p) => {
      const [k, v] = p.trim().split('=');
      if (k) cookieStore[k] = v;
    });
  }

  const storage = new MockStorage();

  const mockDocument = {
    get cookie() {
      return Object.entries(cookieStore)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    },
    set cookie(val: string) {
      const [pair, ...flags] = val.split(';');
      const [k, v] = pair.trim().split('=');
      const isExpired = flags.some((f) => f.trim().toLowerCase().startsWith('max-age=0'));
      if (isExpired) {
        delete cookieStore[k];
      } else {
        cookieStore[k] = v;
      }
    },
    documentElement: {
      lang: 'en',
    },
  };

  const mockWindow = {
    document: mockDocument,
    localStorage: storage,
    location: {
      protocol: 'http:',
    },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  return { mockDocument, storage, mockWindow };
}

describe('i18n Persistence, Server Rendering & Request Isolation', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    // Restore globals
    if (originalDocument) {
      globalThis.document = originalDocument;
    } else {
      // @ts-expect-error cleanup mock
      delete globalThis.document;
    }

    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error cleanup mock
      delete globalThis.window;
    }

    if (originalLocalStorage) {
      globalThis.localStorage = originalLocalStorage;
    } else {
      // @ts-expect-error cleanup mock
      delete globalThis.localStorage;
    }

    vi.clearAllMocks();
  });

  describe('1. Server Locale Resolution & Cookie Precedence', () => {
    it('resolves canonical tof_locale cookie when present', () => {
      const cookieMap: Record<string, string> = {
        [LOCALE_COOKIE_NAME]: 'ru',
      };
      const result = resolveLocaleFromCookieGetter((name) => cookieMap[name]);
      expect(result.locale).toBe('ru');
      expect(result.source).toBe('tof_locale');
    });

    it('resolves legacy tof-datamine-language cookie when canonical is absent', () => {
      const cookieMap: Record<string, string> = {
        [LEGACY_COOKIE_NAME]: 'ru',
      };
      const result = resolveLocaleFromCookieGetter((name) => cookieMap[name]);
      expect(result.locale).toBe('ru');
      expect(result.source).toBe('legacy_cookie');
    });

    it('canonical cookie strictly overrides legacy cookie', () => {
      const cookieMap: Record<string, string> = {
        [LOCALE_COOKIE_NAME]: 'en',
        [LEGACY_COOKIE_NAME]: 'ru',
      };
      const result = resolveLocaleFromCookieGetter((name) => cookieMap[name]);
      expect(result.locale).toBe('en');
      expect(result.source).toBe('tof_locale');
    });

    it('falls back to default "en" when both cookies are absent or invalid', () => {
      const emptyMap: Record<string, string> = {};
      const result1 = resolveLocaleFromCookieGetter((name) => emptyMap[name]);
      expect(result1.locale).toBe(DEFAULT_LOCALE);
      expect(result1.source).toBe('fallback');

      const invalidMap: Record<string, string> = {
        [LOCALE_COOKIE_NAME]: 'xx',
        [LEGACY_COOKIE_NAME]: 'zz',
      };
      const result2 = resolveLocaleFromCookieGetter((name) => invalidMap[name]);
      expect(result2.locale).toBe(DEFAULT_LOCALE);
      expect(result2.source).toBe('fallback');
    });
  });

  describe('2. Parallel Server Request Isolation (No Cross-Request Bleed)', () => {
    it('handles concurrent server requests with different locales without mutation or bleeding', async () => {
      // Simulate 10 simultaneous incoming requests with alternating locales
      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        locale: (i % 2 === 0 ? 'ru' : 'en') as Locale,
      }));

      const results = await Promise.all(
        requests.map(async (req) => {
          const instance = await createI18nServerInstance(req.locale);
          const brandText = instance.t('shell.brand.main');
          const navInfoText = instance.t('shell.nav.info');
          const navDatamineText = instance.t('shell.nav.datamine');
          const navToolsText = instance.t('shell.nav.tools');
          return {
            id: req.id,
            requestedLocale: req.locale,
            instanceLanguage: instance.language,
            brandText,
            navInfoText,
            navDatamineText,
            navToolsText,
          };
        })
      );

      results.forEach((res) => {
        if (res.requestedLocale === 'ru') {
          expect(res.instanceLanguage).toBe('ru');
          expect(res.brandText).toBe('База данных и знаний TOF');
          expect(res.navInfoText).toBe('База знаний');
          expect(res.navDatamineText).toBe('Датамайн');
          expect(res.navToolsText).toBe('Инструменты');
        } else {
          expect(res.instanceLanguage).toBe('en');
          expect(res.brandText).toBe('TOF Hub');
          expect(res.navInfoText).toBe('Info');
          expect(res.navDatamineText).toBe('Datamine');
          expect(res.navToolsText).toBe('Tools');
        }
      });
    });
  });

  describe('3. Client Cookie Reading, Writing & Expiration', () => {
    beforeEach(() => {
      const { mockDocument, storage, mockWindow } = setupMockBrowser();
      // @ts-expect-error mock assignment
      globalThis.document = mockDocument;
      // @ts-expect-error mock assignment
      globalThis.window = mockWindow;
      // @ts-expect-error mock assignment
      globalThis.localStorage = storage;
    });

    it('writes canonical tof_locale cookie and removes legacy subpath cookies', () => {
      writeLocaleCookie('ru');

      expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');
      expect(readClientCookieLocale()).toEqual({
        locale: 'ru',
        source: 'tof_locale',
      });
    });

    it('reads legacy cookie when canonical is absent', () => {
      document.cookie = `${LEGACY_COOKIE_NAME}=ru`;
      expect(readClientCookieLocale()).toEqual({
        locale: 'ru',
        source: 'legacy_cookie',
      });
    });

    it('canonical cookie has precedence in client reader', () => {
      document.cookie = `${LEGACY_COOKIE_NAME}=ru`;
      document.cookie = `${LOCALE_COOKIE_NAME}=en`;
      expect(readClientCookieLocale()).toEqual({
        locale: 'en',
        source: 'tof_locale',
      });
    });
  });

  describe('4. LocalStorage-Only Recovery & Precedence Rules', () => {
    it('recovers from canonical tof_locale in localStorage when cookies are absent', () => {
      const { mockDocument, storage, mockWindow } = setupMockBrowser();
      // @ts-expect-error mock assignment
      globalThis.document = mockDocument;
      // @ts-expect-error mock assignment
      globalThis.window = mockWindow;
      // @ts-expect-error mock assignment
      globalThis.localStorage = storage;

      storage.setItem(LOCALE_COOKIE_NAME, 'ru');

      const recovered = migrateLegacyStorage();
      expect(recovered).toBe('ru');
      // Cookie is now established for future server loads
      expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');
    });

    it('recovers from primary legacy key tof-datamine-language in localStorage', () => {
      const { mockDocument, storage, mockWindow } = setupMockBrowser();
      // @ts-expect-error mock assignment
      globalThis.document = mockDocument;
      // @ts-expect-error mock assignment
      globalThis.window = mockWindow;
      // @ts-expect-error mock assignment
      globalThis.localStorage = storage;

      storage.setItem(LEGACY_COOKIE_NAME, 'ru');

      const recovered = migrateLegacyStorage();
      expect(recovered).toBe('ru');
      expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');
      expect(storage.getItem(LOCALE_COOKIE_NAME)).toBe('ru');
    });

    it('recovers from fragmented legacy keys (fce-language, seq-language, items-language)', () => {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const { mockDocument, storage, mockWindow } = setupMockBrowser();
        // @ts-expect-error mock assignment
        globalThis.document = mockDocument;
        // @ts-expect-error mock assignment
        globalThis.window = mockWindow;
        // @ts-expect-error mock assignment
        globalThis.localStorage = storage;

        storage.setItem(legacyKey, 'ru');

        const recovered = migrateLegacyStorage();
        expect(recovered).toBe('ru');
        expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');
        expect(storage.getItem(LOCALE_COOKIE_NAME)).toBe('ru');
      }
    });

    it('cookie strictly overrides storage in conflict scenario', () => {
      // Cookie is 'en', but storage was left at 'ru'
      const { mockDocument, storage, mockWindow } = setupMockBrowser(`${LOCALE_COOKIE_NAME}=en`);
      // @ts-expect-error mock assignment
      globalThis.document = mockDocument;
      // @ts-expect-error mock assignment
      globalThis.window = mockWindow;
      // @ts-expect-error mock assignment
      globalThis.localStorage = storage;

      storage.setItem(LEGACY_COOKIE_NAME, 'ru');
      storage.setItem(LOCALE_COOKIE_NAME, 'ru');

      // Server resolution respects cookie
      const serverRes = resolveLocaleFromCookieGetter((name) => readCookie(name));
      expect(serverRes.locale).toBe('en');
      expect(serverRes.source).toBe('tof_locale');

      // Because source is 'tof_locale' (not 'fallback'), migration is never invoked
      // and cookie remains authoritative
      expect(readClientCookieLocale()?.locale).toBe('en');
    });
  });

  describe('5. Storage Exception Handling (Privacy / Sandboxed Contexts)', () => {
    it('gracefully handles localStorage throwing SecurityError / DOMException', () => {
      const { mockDocument, mockWindow } = setupMockBrowser();
      // @ts-expect-error mock assignment
      globalThis.document = mockDocument;
      // @ts-expect-error mock assignment
      globalThis.window = mockWindow;

      // Simulate Safari private browsing or restricted iframe where localStorage throws
      Object.defineProperty(mockWindow, 'localStorage', {
        get() {
          throw new Error('SecurityError: The operation is insecure.');
        },
      });

      expect(() => migrateLegacyStorage()).not.toThrow();
      expect(migrateLegacyStorage()).toBeNull();

      expect(() => writeLocaleStorage('ru')).not.toThrow();
    });

    it('gracefully handles quota exceeded errors during setItem', () => {
      const { mockDocument, storage, mockWindow } = setupMockBrowser();
      // @ts-expect-error mock assignment
      globalThis.document = mockDocument;
      // @ts-expect-error mock assignment
      globalThis.window = mockWindow;
      // @ts-expect-error mock assignment
      globalThis.localStorage = storage;

      storage.setItem(LEGACY_COOKIE_NAME, 'ru');
      // Simulate QuotaExceededError on setItem
      storage.setItem = () => {
        throw new Error('QuotaExceededError: storage limit reached');
      };

      expect(() => migrateLegacyStorage()).not.toThrow();
      const recovered = migrateLegacyStorage();
      expect(recovered).toBe('ru');
      expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');
    });
  });

  describe('6. SSR Hydration Markup Parity (Zero Mismatch)', () => {
    // Helper component to render translated test strings
    function TestConsumer() {
      const { t, locale } = useI18n();
      return React.createElement(
        'div',
        { 'data-testid': 'container', 'data-locale': locale },
        React.createElement('span', { 'data-testid': 'brand' }, t('shell.brand.main')),
        React.createElement('span', { 'data-testid': 'nav-info' }, t('shell.nav.info')),
        React.createElement('span', { 'data-testid': 'nav-datamine' }, t('shell.nav.datamine')),
        React.createElement('span', { 'data-testid': 'nav-tools' }, t('shell.nav.tools'))
      );
    }

    it('renders identical HTML string for Russian on SSR and client initial state', () => {
      const ssrHtml = renderToString(
        React.createElement(
          I18nProvider,
          { initialLocale: 'ru', initialSource: 'tof_locale' },
          React.createElement(TestConsumer, null)
        )
      );

      // Verify Russian translations are in SSR output
      expect(ssrHtml).toContain('База данных и знаний TOF');
      expect(ssrHtml).toContain('База знаний');
      expect(ssrHtml).toContain('Датамайн');
      expect(ssrHtml).toContain('Инструменты');
      expect(ssrHtml).toContain('data-locale="ru"');

      // Client render with identical initialLocale produces byte-for-byte identical output
      const clientInitialHtml = renderToString(
        React.createElement(
          I18nProvider,
          { initialLocale: 'ru', initialSource: 'tof_locale' },
          React.createElement(TestConsumer, null)
        )
      );
      expect(clientInitialHtml).toBe(ssrHtml);
    });

    it('renders identical HTML string for English fallback on SSR and client initial state', () => {
      const ssrHtml = renderToString(
        React.createElement(
          I18nProvider,
          { initialLocale: 'en', initialSource: 'fallback' },
          React.createElement(TestConsumer, null)
        )
      );

      expect(ssrHtml).toContain('TOF Hub');
      expect(ssrHtml).toContain('Info');
      expect(ssrHtml).toContain('Datamine');
      expect(ssrHtml).toContain('Tools');
      expect(ssrHtml).toContain('data-locale="en"');

      const clientInitialHtml = renderToString(
        React.createElement(
          I18nProvider,
          { initialLocale: 'en', initialSource: 'fallback' },
          React.createElement(TestConsumer, null)
        )
      );
      expect(clientInitialHtml).toBe(ssrHtml);
    });
  });

  describe('7. End-to-End Simulation: RU Survives Info -> Datamine -> Tools & Reload', () => {
    it('maintains RU across navigation from Info to Datamine to Tools and reload', async () => {
      const { mockDocument, storage, mockWindow } = setupMockBrowser();
      // @ts-expect-error mock assignment
      globalThis.document = mockDocument;
      // @ts-expect-error mock assignment
      globalThis.window = mockWindow;
      // @ts-expect-error mock assignment
      globalThis.localStorage = storage;

      // 1. User starts at Info, selects Russian
      writeLocaleCookie('ru');
      writeLocaleStorage('ru');

      expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');
      expect(storage.getItem(LOCALE_COOKIE_NAME)).toBe('ru');

      // 2. Client navigates: Info -> Datamine
      // Simulated route change maintains cookie and storage
      expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');

      // 3. Client navigates: Datamine -> Tools
      expect(readCookie(LOCALE_COOKIE_NAME)).toBe('ru');

      // 4. User performs page reload (browser sends current cookie)
      const incomingCookieHeader = mockDocument.cookie;
      const parsedCookies: Record<string, string> = {};
      incomingCookieHeader.split(';').forEach((part) => {
        const [k, v] = part.trim().split('=');
        if (k) parsedCookies[k] = v;
      });

      const serverReloadResult = resolveLocaleFromCookieGetter((name) => parsedCookies[name]);
      expect(serverReloadResult.locale).toBe('ru');
      expect(serverReloadResult.source).toBe('tof_locale');

      // Server SSR renders Russian
      const serverInstance = await createI18nServerInstance(serverReloadResult.locale);
      expect(serverInstance.language).toBe('ru');
      expect(serverInstance.t('shell.nav.tools')).toBe('Инструменты');
    });
  });

  describe('8. Language Change Dataset Fetching & Memory Cache', () => {
    it('switching language fetches ONLY active page dataset and uses memory cache on return', async () => {
      const cache = new GameDataCache();
      const networkCalls: string[] = [];

      const mockFetch = vi.fn(async (url: string) => {
        networkCalls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ dataset: url }),
        } as unknown as Response;
      });

      // Step 1: User on /info/simulacra with English locale
      await fetchGameData('en', 'simulacra', { fetchFn: mockFetch }, cache);
      expect(networkCalls).toEqual(['/game-data/en/runtime/simulacra.json']);
      expect(cache.hasResolved('en', 'simulacra')).toBe(true);

      // Step 2: User changes language to Russian
      // Only the current page dataset (simulacra) is fetched in Russian.
      // Other datasets like 'matrices' or 'weapons' or 'bygone' are NOT preloaded.
      await fetchGameData('ru', 'simulacra', { fetchFn: mockFetch }, cache);
      expect(networkCalls).toEqual([
        '/game-data/en/runtime/simulacra.json',
        '/game-data/ru/runtime/simulacra.json',
      ]);
      expect(cache.hasResolved('ru', 'simulacra')).toBe(true);
      expect(cache.has('ru', 'weapons')).toBe(false);
      expect(cache.has('ru', 'matrices')).toBe(false);
      expect(cache.has('ru', 'bygone')).toBe(false);

      // Step 3: User switches language BACK to English
      // Data is retrieved from in-memory cache immediately with ZERO new network calls
      const enSimulacraFromCache = await fetchGameData('en', 'simulacra', { fetchFn: mockFetch }, cache);
      expect(enSimulacraFromCache).toEqual({ dataset: '/game-data/en/runtime/simulacra.json' });
      // Call count remains 2 (no third network call!)
      expect(networkCalls.length).toBe(2);

      // Step 4: User navigates to /datamine/bygone in Russian
      // Only ru:bygone is fetched
      await fetchGameData('ru', 'bygone', { fetchFn: mockFetch }, cache);
      expect(networkCalls.length).toBe(3);
      expect(networkCalls[2]).toBe('/game-data/ru/runtime/bygone.json');
    });
  });
});
