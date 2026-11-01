import { describe, it, expect } from 'vitest';
import {
  parseVersion,
  compareVersions,
  determineVersionStatus,
  formatSnapshotDate,
  parseResVersion,
  SiteVersionStatusSchema,
  LiveGlobalVersionSchema,
  type SiteVersionStatus,
} from './api/version-status';

describe('Version Status Algorithms & Contracts (Legacy Parity)', () => {
  describe('parseVersion', () => {
    it('parses standard semantic versions into integer arrays', () => {
      expect(parseVersion('6.3.0')).toEqual([6, 3, 0]);
      expect(parseVersion(' 6.3.0\n')).toEqual([6, 3, 0]);
      expect(parseVersion('v6.4')).toEqual([6, 4]);
      expect(parseVersion('v5.7.0 KR Dev client')).toEqual([5, 7, 0]);
    });

    it('returns null for empty, invalid, or non-version strings', () => {
      expect(parseVersion('invalid')).toBeNull();
      expect(parseVersion('')).toBeNull();
      expect(parseVersion(null)).toBeNull();
      expect(parseVersion(undefined)).toBeNull();
    });
  });

  describe('compareVersions', () => {
    it('returns 0 for identical and equivalent versions', () => {
      expect(compareVersions('6.3.0', '6.3.0')).toBe(0);
      expect(compareVersions('6.3', '6.3.0')).toBe(0);
      expect(compareVersions(' 6.3.0\n', '6.3.0')).toBe(0);
    });

    it('returns 1 when a > b (newer)', () => {
      expect(compareVersions('6.4.0', '6.3.0')).toBe(1);
      expect(compareVersions('6.3.1', '6.3.0')).toBe(1);
      expect(compareVersions('6.10.0', '6.9.0')).toBe(1);
      expect(compareVersions('7.0.0', '6.99.99')).toBe(1);
    });

    it('returns -1 when a < b (older)', () => {
      expect(compareVersions('6.3.0', '6.4.0')).toBe(-1);
      expect(compareVersions('6.3.0', '6.3.1')).toBe(-1);
      expect(compareVersions('6.9.0', '6.10.0')).toBe(-1);
    });

    it('returns null when either version cannot be parsed', () => {
      expect(compareVersions('invalid', '6.3.0')).toBeNull();
      expect(compareVersions('6.3.0', 'unknown')).toBeNull();
      expect(compareVersions(null, '6.3.0')).toBeNull();
      expect(compareVersions('6.3.0', undefined)).toBeNull();
    });
  });

  describe('determineVersionStatus (equal / outdated / unavailable states)', () => {
    it('returns "current" when datasetVersion and globalVersion are equal', () => {
      const status = determineVersionStatus('6.3.0', '6.3.0');
      expect(status.state).toBe('current');
      expect(status.isCurrent).toBe(true);
      expect(status.updateAvailable).toBe(false);
    });

    it('returns "current" when datasetVersion is newer than globalVersion', () => {
      const status = determineVersionStatus('6.3.14', '6.2.0');
      expect(status.state).toBe('current');
      expect(status.isCurrent).toBe(true);
      expect(status.updateAvailable).toBe(false);
    });

    it('returns "outdated" when globalVersion is strictly newer than datasetVersion', () => {
      const status = determineVersionStatus('6.3.0', '6.4.0');
      expect(status.state).toBe('outdated');
      expect(status.isCurrent).toBe(false);
      expect(status.updateAvailable).toBe(true);
    });

    it('returns "outdated" on patch update (6.3.0 dataset vs 6.3.1 global)', () => {
      const status = determineVersionStatus('6.3.0', '6.3.1');
      expect(status.state).toBe('outdated');
      expect(status.isCurrent).toBe(false);
      expect(status.updateAvailable).toBe(true);
    });

    it('returns "unavailable" when datasetVersion is missing, empty, or null', () => {
      const status = determineVersionStatus(null, '6.2.0');
      expect(status.state).toBe('unavailable');
      expect(status.isCurrent).toBeNull();
      expect(status.updateAvailable).toBe(false);
    });

    it('returns "unavailable" when globalVersion is missing, empty, or null', () => {
      const status = determineVersionStatus('6.3.14', null);
      expect(status.state).toBe('unavailable');
      expect(status.isCurrent).toBeNull();
      expect(status.updateAvailable).toBe(false);
    });

    it('returns "unavailable" when either version is unparseable', () => {
      const status1 = determineVersionStatus('unknown', '6.2.0');
      expect(status1.state).toBe('unavailable');
      expect(status1.isCurrent).toBeNull();
      expect(status1.updateAvailable).toBe(false);

      const status2 = determineVersionStatus('6.3.14', 'malformed');
      expect(status2.state).toBe('unavailable');
      expect(status2.isCurrent).toBeNull();
      expect(status2.updateAvailable).toBe(false);
    });
  });

  describe('formatSnapshotDate (EN / RU)', () => {
    it('formats ISO timestamps in English (UTC)', () => {
      expect(formatSnapshotDate('2026-09-05T08:02:13.567Z', 'en')).toBe('5 Sep 2026');
      expect(formatSnapshotDate('2026-08-24T16:58:14.846Z', 'en')).toBe('24 Aug 2026');
    });

    it('formats ISO timestamps in Russian (UTC)', () => {
      expect(formatSnapshotDate('2026-09-05T08:02:13.567Z', 'ru')).toBe('5 сентября 2026');
      expect(formatSnapshotDate('2026-08-24T16:58:14.846Z', 'ru')).toBe('24 августа 2026');
    });

    it('handles null, undefined, or empty values', () => {
      expect(formatSnapshotDate(null, 'en')).toBe('—');
      expect(formatSnapshotDate(undefined, 'ru')).toBe('—');
      expect(formatSnapshotDate('', 'en')).toBe('—');
    });
  });

  describe('parseResVersion (Launcher XML)', () => {
    it('extracts ResVersion correctly', () => {
      const xml = '<Config><ResVersion>6.2.0</ResVersion></Config>';
      expect(parseResVersion(xml)).toBe('6.2.0');
    });

    it('extracts fallback Version tag', () => {
      const xml = '<Config><Version>6.3.6</Version></Config>';
      expect(parseResVersion(xml)).toBe('6.3.6');
    });

    it('throws error for malformed or empty XML', () => {
      expect(() => parseResVersion('')).toThrow(/empty/);
      expect(() => parseResVersion('<Config><NoVersion>abc</NoVersion></Config>')).toThrow(
        /valid ResVersion/
      );
    });
  });

  describe('Zod Schema Validation', () => {
    it('validates SiteVersionStatusSchema for current state', () => {
      const data: SiteVersionStatus = {
        state: 'current',
        datasetVersion: '6.3.14',
        globalVersion: '6.2.0',
        isCurrent: true,
        updateAvailable: false,
        exportedAt: '2026-09-05T08:02:13.567Z',
        formattedExportDate: { en: '5 Sep 2026', ru: '5 сентября 2026' },
        sources: [
          {
            client: 'Korea Dev 1',
            branch: 'TestPC_KR2New',
            clientRu: 'Корея Dev 1',
          },
        ],
        sourceBranch: {
          en: 'Korea Dev 1 — TestPC_KR2New',
          ru: 'Корея Dev 1 — TestPC_KR2New',
        },
        checkedAt: '2026-09-18T12:00:00.000Z',
      };

      const result = SiteVersionStatusSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('validates LiveGlobalVersionSchema', () => {
      const data = {
        version: '6.2.0',
        checkedAt: '2026-09-18T12:00:00.000Z',
        source: 'Tower of Fantasy Global launcher',
      };
      const result = LiveGlobalVersionSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
