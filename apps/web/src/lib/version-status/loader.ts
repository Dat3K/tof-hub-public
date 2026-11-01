import { localized } from '@tof-hub/i18n';
import {
  determineVersionStatus,
  formatSnapshotDate,
  versionTrackerSchema,
  type ReleaseManifest,
  type VersionSource,
} from '@tof-hub/contracts';
import type { SiteVersionStatusData } from './types';
import { VERSION_STATUS_STRINGS } from './strings';
import { createLocaleCopies, LANGUAGES, SUPPORTED_LOCALES, type Locale } from '@tof-hub/i18n';

let cachedStatusPromise: Promise<SiteVersionStatusData> | null = null;
let cachedStatus: SiteVersionStatusData | null = null;
const VERSION_STATUS_REQUEST_TIMEOUT_MS = 5000;

async function fetchVersionStatusResource(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    VERSION_STATUS_REQUEST_TIMEOUT_MS
  );

  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches release-manifest.json from the public static assets route (/game-data/release-manifest.json).
 */
export async function fetchReleaseManifest(
  baseUrl = '/game-data'
): Promise<ReleaseManifest | null> {
  try {
    const res = await fetchVersionStatusResource(`${baseUrl}/release-manifest.json`);
    if (!res.ok) return null;
    return (await res.json()) as ReleaseManifest;
  } catch {
    return null;
  }
}

/**
 * Reads Global Live from the same persistent version tracker used by the main hub.
 * Falls back to the generated tracker snapshot when the database API is unavailable.
 */
export async function fetchLiveGlobalVersion(baseUrl = '/game-data'): Promise<string | null> {
  try {
    const res = await fetchVersionStatusResource('/api/v1/version-status/tracker');
    if (res.ok) {
      const tracker = versionTrackerSchema.parse(await res.json());
      const version = tracker.branches.find((branch) => branch.id === 'live-global')?.version;
      if (version?.trim()) return version.trim();
    }
  } catch {
    // Use the same generated snapshot that seeds the main hub tracker.
  }

  try {
    const res = await fetchVersionStatusResource(`${baseUrl}/version-tracker.json`);
    if (!res.ok) return null;
    const tracker = versionTrackerSchema.parse(await res.json());
    const version = tracker.branches.find((branch) => branch.id === 'live-global')?.version;
    return version?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Formats source branches for human readability (EN/RU).
 */
export function formatSourceBranch(sources: VersionSource[]): Record<Locale, string> {
  if (!sources || sources.length === 0) {
    return createLocaleCopies({ en: '—', ru: '—' });
  }

  const en = sources.map((s) => `${s.client} — ${s.branch}`).join(', ');
  const ru = sources.map((s) => `${s.clientRu || s.client} — ${s.branch}`).join(', ');

  return createLocaleCopies({ en, ru });
}

export interface LoadVersionStatusOptions {
  manifest?: ReleaseManifest | null;
  liveGlobalVersion?: string | null;
  baseUrl?: string;
}

/**
 * Evaluates full SiteVersionStatusData from static manifest provenance and live Global version.
 */
export async function loadSiteVersionStatus(
  options: LoadVersionStatusOptions = {}
): Promise<SiteVersionStatusData> {
  const manifest =
    options.manifest !== undefined
      ? options.manifest
      : await fetchReleaseManifest(options.baseUrl);

  const datasetVersion = manifest?.snapshot?.version || manifest?.gameVersion || null;

  let liveGlobal = options.liveGlobalVersion;
  if (liveGlobal === undefined) {
    // Use the persistent tracker first, then its generated seed snapshot as an offline fallback.
    const serverGlobal = await fetchLiveGlobalVersion(options.baseUrl);
    liveGlobal = serverGlobal;
  }

  const { state, updateAvailable, isCurrent } = determineVersionStatus(
    datasetVersion,
    liveGlobal
  );

  const exportedAt = manifest?.snapshot?.exportedAt || null;
  const sources: VersionSource[] = manifest?.snapshot?.sources || [];

  return {
    state,
    datasetVersion,
    globalVersion: liveGlobal,
    isCurrent,
    updateAvailable,
    exportedAt,
    formattedExportDate: Object.fromEntries(SUPPORTED_LOCALES.map(locale => [locale,
      locale === 'en' || locale === 'ru' ? formatSnapshotDate(exportedAt, locale)
        : exportedAt && Number.isFinite(Date.parse(exportedAt))
          ? new Intl.DateTimeFormat(localized(LANGUAGES, locale).intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(exportedAt)) : '—',
    ])) as Record<Locale, string>,
    sources,
    sourceBranch: formatSourceBranch(sources),
    checkedAt: manifest?.clientVersions?.global?.lastChanged || new Date().toISOString(),
    labels: VERSION_STATUS_STRINGS,
  };
}

/**
 * Returns cached SiteVersionStatusData for the page lifecycle to prevent redundant HTTP queries.
 */
export async function getVersionStatusCached(
  options?: LoadVersionStatusOptions
): Promise<SiteVersionStatusData> {
  if (cachedStatus !== null) {
    return cachedStatus;
  }

  if (cachedStatusPromise) {
    return cachedStatusPromise;
  }

  cachedStatusPromise = (async () => {
    try {
      const data = await loadSiteVersionStatus(options);
      cachedStatus = data;
      return data;
    } catch {
      // Return safe fallback unavailable state on critical error
      return {
        state: 'unavailable',
        datasetVersion: null,
        globalVersion: null,
        isCurrent: null,
        updateAvailable: false,
        exportedAt: null,
        formattedExportDate: createLocaleCopies({ en: '—', ru: '—' }),
        sources: [],
        sourceBranch: createLocaleCopies({ en: '—', ru: '—' }),
        checkedAt: null,
        labels: VERSION_STATUS_STRINGS,
      };
    } finally {
      cachedStatusPromise = null;
    }
  })();

  return cachedStatusPromise;
}

/**
 * Reset the memory cache (used primarily in test suites or on full page refresh).
 */
export function _resetVersionStatusCache(): void {
  cachedStatus = null;
  cachedStatusPromise = null;
}
