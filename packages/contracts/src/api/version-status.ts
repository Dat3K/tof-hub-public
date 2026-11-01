import { z } from 'zod';

export const VersionStatusSchema = z.object({
  gameVersion: z.string(),
  datasetReleaseId: z.string(),
  generatedAt: z.string(),
  supportedLocales: z.array(z.string()),
  activeEditions: z.array(z.enum(['gacha', 'mmo'])),
  manifestUrl: z.string().optional(),
});

export type VersionStatus = z.infer<typeof VersionStatusSchema>;

/**
 * Lifecycle states for Site Version Status:
 * - 'loading': actively resolving or fetching version data
 * - 'current': dataset version is up-to-date with (or newer than) live Global version
 * - 'outdated': live Global version is strictly newer than active dataset version
 * - 'unavailable': dataset or Global version could not be resolved or parsed
 */
export const VersionStatusStateSchema = z.enum([
  'loading',
  'current',
  'outdated',
  'unavailable',
]);
export type VersionStatusState = z.infer<typeof VersionStatusStateSchema>;

export const LiveGlobalVersionSchema = z.object({
  version: z.string(),
  checkedAt: z.string().optional(),
  source: z.string().optional(),
});
export type LiveGlobalVersion = z.infer<typeof LiveGlobalVersionSchema>;

export const VersionSourceSchema = z.object({
  client: z.string(),
  branch: z.string(),
  clientRu: z.string().optional(),
  appVersion: z.string().optional(),
  hash: z.string().optional(),
});
export type VersionSource = z.infer<typeof VersionSourceSchema>;

export const SiteVersionStatusSchema = z.object({
  state: VersionStatusStateSchema,
  datasetVersion: z.string().nullable(),
  globalVersion: z.string().nullable(),
  isCurrent: z.boolean().nullable(),
  updateAvailable: z.boolean(),
  exportedAt: z.string().nullable(),
  formattedExportDate: z.object({
    en: z.string(),
    ru: z.string(),
  }),
  sources: z.array(VersionSourceSchema),
  sourceBranch: z.object({
    en: z.string(),
    ru: z.string(),
  }),
  checkedAt: z.string().nullable(),
});
export type SiteVersionStatus = z.infer<typeof SiteVersionStatusSchema>;

// Month dictionaries for UTC snapshot date formatting matching legacy data-meta.js
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RU_MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/**
 * Formats an ISO 8601 timestamp into human-readable date (UTC)
 * matching legacy DatamineMeta.formatSnapshotDate:
 * - 'en': '5 Sep 2026'
 * - 'ru': '5 сентября 2026'
 */
export function formatSnapshotDate(
  isoString: string | null | undefined,
  locale: 'en' | 'ru' = 'en'
): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  const day = d.getUTCDate();
  const monthIdx = d.getUTCMonth();
  const year = d.getUTCFullYear();
  if (locale === 'ru') {
    return `${day} ${RU_MONTHS[monthIdx] || ''} ${year}`.trim();
  }
  return `${day} ${EN_MONTHS[monthIdx] || ''} ${year}`.trim();
}

/**
 * Parse a version string (e.g. "6.3.0", "v5.7.0 KR Dev client", " 6.4\n")
 * into an array of numeric components [6, 3, 0].
 * Returns null if unparseable.
 */
export function parseVersion(str: string | null | undefined): number[] | null {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:v|V)?\s*(\d+(?:\.\d+)+)/);
  if (!match || !match[1]) return null;

  const parts = match[1].split('.').map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });

  return parts.length > 0 ? parts : null;
}

/**
 * Compare two semantic versions.
 * Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if a == b
 *  null if either version is invalid
 */
export function compareVersions(
  a: string | null | undefined,
  b: string | null | undefined
): number | null {
  const partsA = parseVersion(a);
  const partsB = parseVersion(b);

  if (!partsA || !partsB) return null;

  const maxLength = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLength; i++) {
    const valA = i < partsA.length ? partsA[i] : 0;
    const valB = i < partsB.length ? partsB[i] : 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }

  return 0;
}

/**
 * Determine the version comparison outcome between active dataset and live Global version.
 */
export function determineVersionStatus(
  datasetVersion: string | null | undefined,
  globalVersion: string | null | undefined
): {
  state: VersionStatusState;
  updateAvailable: boolean;
  isCurrent: boolean | null;
} {
  if (!datasetVersion || !globalVersion) {
    return {
      state: 'unavailable',
      updateAvailable: false,
      isCurrent: null,
    };
  }

  const cmp = compareVersions(globalVersion, datasetVersion);
  if (cmp === null) {
    return {
      state: 'unavailable',
      updateAvailable: false,
      isCurrent: null,
    };
  }

  const updateAvailable = cmp > 0;
  const isCurrent = cmp <= 0;

  return {
    state: updateAvailable ? 'outdated' : 'current',
    updateAvailable,
    isCurrent,
  };
}

/**
 * Extracts <ResVersion> (or <Version>) from the official launcher config.xml text.
 */
export function parseResVersion(xmlText: string): string {
  if (typeof xmlText !== 'string' || !xmlText.trim()) {
    throw new Error('Global config.xml is empty.');
  }

  const resVersionMatch = xmlText.match(/<ResVersion>([\d.]+)<\/ResVersion>/i);
  const versionMatch = xmlText.match(/<Version>([\d.]+)<\/Version>/i);
  const version = resVersionMatch?.[1]?.trim() || versionMatch?.[1]?.trim() || '';

  if (!/^\d+(?:\.\d+)+$/.test(version)) {
    throw new Error('Global config.xml does not contain a valid ResVersion.');
  }

  return version;
}
