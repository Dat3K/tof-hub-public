import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GameDataCache,
  buildCacheKey,
  normalizeDatasetName,
  buildDatasetUrl,
  fetchGameData,
} from '../../apps/web/src/lib/game-data-client';

describe('GameDataCache & Loader', () => {
  let cache: GameDataCache;

  beforeEach(() => {
    cache = new GameDataCache();
  });

  describe('buildCacheKey and normalizeDatasetName', () => {
    it('constructs standard <locale>:<dataset> cache keys', () => {
      expect(buildCacheKey('en', 'simulacra')).toBe('en:simulacra');
      expect(buildCacheKey('ru', 'simulacra')).toBe('ru:simulacra');
      expect(buildCacheKey('ru', 'matrices')).toBe('ru:matrices');
      expect(buildCacheKey('en', 'weapons')).toBe('en:weapons');
    });

    it('normalizes dataset names by stripping .json extensions and leading slashes', () => {
      expect(normalizeDatasetName('simulacra.json')).toBe('simulacra');
      expect(normalizeDatasetName('/simulacra.json')).toBe('simulacra');
      expect(normalizeDatasetName('///info/simulacra.json')).toBe('info/simulacra');

      expect(buildCacheKey('en', 'simulacra.json')).toBe('en:simulacra');
      expect(buildCacheKey('ru', '/simulacra.json')).toBe('ru:simulacra');
      expect(buildCacheKey('en', '/info/weapons.json')).toBe('en:info/weapons');
    });
  });

  describe('buildDatasetUrl', () => {
    it('constructs default static JSON URLs', () => {
      expect(buildDatasetUrl('en', 'simulacra')).toBe('/game-data/en/runtime/simulacra.json');
      expect(buildDatasetUrl('ru', 'simulacra.json')).toBe('/game-data/ru/runtime/simulacra.json');
      expect(buildDatasetUrl('ru', 'info/relics')).toBe('/game-data/ru/info/relics.json');
    });

    it('respects custom baseUrl and normalizes slashes', () => {
      expect(buildDatasetUrl('en', 'simulacra', '/static/data')).toBe('/static/data/en/runtime/simulacra.json');
      expect(buildDatasetUrl('ru', '/simulacra/', '/custom-data/')).toBe('/custom-data/ru/runtime/simulacra.json');
    });
  });

  describe('Promise-aware deduplication (concurrent requests)', () => {
    it('deduplicates simultaneous fetch requests into a single network call', async () => {
      const mockPayload = { id: 'nemesis', name: 'Nemesis' };
      let fetchCallCount = 0;

      const mockFetch = vi.fn(async () => {
        fetchCallCount++;
        // Small artificial delay to ensure concurrent window
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
        } as unknown as Response;
      });

      // Launch two concurrent requests for the exact same locale and dataset
      const [result1, result2] = await Promise.all([
        fetchGameData('en', 'simulacra', { fetchFn: mockFetch }, cache),
        fetchGameData('en', 'simulacra', { fetchFn: mockFetch }, cache),
      ]);

      // Assertions
      expect(fetchCallCount).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockPayload);
      expect(result2).toEqual(mockPayload);
      expect(result1).toBe(result2);
    });

    it('returns the same pending Promise instance to multiple concurrent callers', async () => {
      let callCount = 0;
      const delayedFetcher = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { version: '1.0' };
      };

      const p1 = cache.getOrFetch('ru', 'version', delayedFetcher);
      const p2 = cache.getOrFetch('ru', 'version', delayedFetcher);
      const p3 = cache.getOrFetch('ru', 'version', delayedFetcher);

      expect(p1).toBe(p2);
      expect(p2).toBe(p3);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(callCount).toBe(1);
      expect(r1).toEqual({ version: '1.0' });
      expect(r2).toEqual({ version: '1.0' });
      expect(r3).toEqual({ version: '1.0' });
    });
  });

  describe('In-memory cache reuse (lazy fetch & back navigation)', () => {
    it('serves sequential requests from in-memory cache without repeating fetch', async () => {
      const mockPayload = [{ id: 'lin', name: 'Lin' }];
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      } as unknown as Response));

      // Initial fetch
      const first = await fetchGameData('ru', 'simulacra', { fetchFn: mockFetch }, cache);
      expect(first).toEqual(mockPayload);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Subsequent fetch for same locale and dataset
      const second = await fetchGameData('ru', 'simulacra', { fetchFn: mockFetch }, cache);
      expect(second).toEqual(mockPayload);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Synchronous cache checks
      expect(cache.hasResolved('ru', 'simulacra')).toBe(true);
      expect(cache.getResolved('ru', 'simulacra')).toEqual(mockPayload);
    });
  });

  describe('Isolation of datasets and locales (no preloading)', () => {
    it('isolates different locales for the same dataset', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        const isEn = url.includes('/en/');
        return {
          ok: true,
          status: 200,
          json: async () => ({ locale: isEn ? 'en' : 'ru' }),
        } as unknown as Response;
      });

      const enData = await fetchGameData('en', 'simulacra', { fetchFn: mockFetch }, cache);
      const ruData = await fetchGameData('ru', 'simulacra', { fetchFn: mockFetch }, cache);

      expect(enData).toEqual({ locale: 'en' });
      expect(ruData).toEqual({ locale: 'ru' });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      expect(cache.size()).toBe(2);
      expect(cache.keys()).toContain('en:simulacra');
      expect(cache.keys()).toContain('ru:simulacra');
    });

    it('isolates different datasets within the same locale', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        const dataset = url.includes('weapons') ? 'weapons' : 'simulacra';
        return {
          ok: true,
          status: 200,
          json: async () => ({ dataset }),
        } as unknown as Response;
      });

      await fetchGameData('en', 'simulacra', { fetchFn: mockFetch }, cache);
      await fetchGameData('en', 'weapons', { fetchFn: mockFetch }, cache);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(cache.size()).toBe(2);
      expect(cache.keys()).toContain('en:simulacra');
      expect(cache.keys()).toContain('en:weapons');
    });
  });

  describe('Retry on failure (rejected Promise eviction)', () => {
    it('evicts failed entry from cache on rejection, allowing subsequent retry', async () => {
      let attempts = 0;
      const failingThenSucceedingFetch = vi.fn(async () => {
        attempts++;
        if (attempts === 1) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal Server Error' }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as unknown as Response;
      });

      // Attempt 1: Should fail
      await expect(
        fetchGameData('en', 'failing-dataset', { fetchFn: failingThenSucceedingFetch }, cache)
      ).rejects.toThrow(/Failed to load game data \[en:failing-dataset\]/);

      // Verify failed entry was evicted
      expect(cache.has('en', 'failing-dataset')).toBe(false);
      expect(cache.hasResolved('en', 'failing-dataset')).toBe(false);

      // Attempt 2: Should retry and succeed
      const retryResult = await fetchGameData(
        'en',
        'failing-dataset',
        { fetchFn: failingThenSucceedingFetch },
        cache
      );

      expect(retryResult).toEqual({ success: true });
      expect(failingThenSucceedingFetch).toHaveBeenCalledTimes(2);
      expect(cache.has('en', 'failing-dataset')).toBe(true);
      expect(cache.hasResolved('en', 'failing-dataset')).toBe(true);
    });

    it('evicts rejected entry in getOrFetch directly', async () => {
      let callCount = 0;
      const flakyFetcher = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network timeout');
        }
        return 'recovered';
      };

      await expect(cache.getOrFetch('ru', 'flaky', flakyFetcher)).rejects.toThrow('Network timeout');
      expect(cache.has('ru', 'flaky')).toBe(false);

      const recovered = await cache.getOrFetch('ru', 'flaky', flakyFetcher);
      expect(recovered).toBe('recovered');
      expect(callCount).toBe(2);
      expect(cache.has('ru', 'flaky')).toBe(true);
    });
  });

  describe('Race condition and stale response protection', () => {
    it('prevents delayed responses from an old locale from overriding current locale state', async () => {
      // Setup: RU fetch takes 50ms, EN fetch takes 10ms
      const ruFetch = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({ text: 'Оружие (RU)' }),
        } as unknown as Response;
      });

      const enFetch = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return {
          ok: true,
          status: 200,
          json: async () => ({ text: 'Weapons (EN)' }),
        } as unknown as Response;
      });

      // Client state representation
      let activeLocale = 'ru';
      let displayedData: { text: string } | null = null;

      // 1. User starts on RU
      const ruPromise = fetchGameData<{ text: string }>('ru', 'weapons', { fetchFn: ruFetch }, cache);
      const targetLocaleRu = activeLocale;
      ruPromise.then((data) => {
        // Guard: discard if user switched away
        if (activeLocale === targetLocaleRu) {
          displayedData = data;
        }
      });

      // 2. User quickly switches to EN before RU completes
      activeLocale = 'en';
      const targetLocaleEn = activeLocale;
      const enPromise = fetchGameData<{ text: string }>('en', 'weapons', { fetchFn: enFetch }, cache);
      enPromise.then((data) => {
        if (activeLocale === targetLocaleEn) {
          displayedData = data;
        }
      });

      // 3. Await both to finish
      await Promise.all([ruPromise, enPromise]);

      // Active view MUST show EN data (not overwritten by delayed RU)
      expect(displayedData).toEqual({ text: 'Weapons (EN)' });

      // But RU data is safely cached in memory for when user returns to RU
      expect(cache.hasResolved('ru', 'weapons')).toBe(true);
      expect(cache.getResolved('ru', 'weapons')).toEqual({ text: 'Оружие (RU)' });

      // 4. Switching back to RU immediately retrieves from memory cache
      activeLocale = 'ru';
      const cachedRu = cache.getResolved<{ text: string }>('ru', 'weapons');
      displayedData = cachedRu ?? null;
      expect(displayedData).toEqual({ text: 'Оружие (RU)' });
      expect(ruFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache management API', () => {
    it('supports seed, delete, clear, and size operations', () => {
      // Seed pre-loaded SSR data
      cache.seed('en', 'matrices', { seeded: true });
      expect(cache.has('en', 'matrices')).toBe(true);
      expect(cache.hasResolved('en', 'matrices')).toBe(true);
      expect(cache.getResolved('en', 'matrices')).toEqual({ seeded: true });

      // Delete
      const deleted = cache.delete('en', 'matrices');
      expect(deleted).toBe(true);
      expect(cache.has('en', 'matrices')).toBe(false);

      // Seed multiple and clear
      cache.seed('en', 'item1', 1);
      cache.seed('ru', 'item2', 2);
      expect(cache.size()).toBe(2);
      expect(cache.keys()).toEqual(['en:item1', 'ru:item2']);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.keys()).toEqual([]);
    });
  });
});
