import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface ChangelogBaselineCharacter {
  id: string;
  avatar_id?: string;
  weapon_id?: string;
  name_en?: string;
  name_ru?: string;
  element?: string;
  role?: string;
  rarity?: string;
  base_stats?: Record<string, any>;
  max_stats?: Record<string, any>;
  advancements?: any[];
  traits?: any[];
  weapon?: Record<string, any>;
  [key: string]: any;
}

export interface ChangelogBaselinePayload {
  schemaVersion: number;
  edition: 'gacha' | 'mmo';
  generatedAt: string;
  total: number;
  characters: Record<string, ChangelogBaselineCharacter>;
}

export interface BaselineCacheMetadata {
  etag?: string | null;
  lastModified?: string | null;
  downloadedAt: string;
  url: string;
  sha256?: string;
  total: number;
}

export interface BaselineDownloadOptions {
  baseUrl?: string;
  cacheDir?: string;
  localBaselineDir?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  verbose?: boolean;
}

export interface BaselineDownloadResult {
  status: 'ok' | 'not_modified' | 'not_found' | 'unavailable';
  gachaBaseline: ChangelogBaselinePayload | null;
  mmoBaseline: ChangelogBaselinePayload | null;
  source: 'network' | 'cache' | 'local_fallback' | 'none';
  metadata?: {
    gacha?: BaselineCacheMetadata;
    mmo?: BaselineCacheMetadata;
  };
  warnings?: string[];
  error?: string;
}

export interface BaselineBootstrapOptions {
  inputDir: string;
  outputDir: string;
  verbose?: boolean;
}

export interface BaselineBootstrapResult {
  success: boolean;
  gachaTotal: number;
  mmoTotal: number;
  gachaPath: string;
  mmoPath: string;
  durationMs: number;
}

export interface BaselineIdPartition {
  commonIds: string[];
  newIds: string[];
  removedIds: string[];
}

export interface BaselineComparisonPreparation {
  hasOldBaseline: boolean;
  status: 'ready' | 'baseline_unavailable';
  gacha: BaselineIdPartition;
  mmo: BaselineIdPartition;
  oldBaselines: {
    gacha: ChangelogBaselinePayload | null;
    mmo: ChangelogBaselinePayload | null;
  };
  freshBaselines: {
    gacha: ChangelogBaselinePayload;
    mmo: ChangelogBaselinePayload;
  };
}

export interface BaselineFreezeOptions {
  gachaBaseline: ChangelogBaselinePayload;
  mmoBaseline: ChangelogBaselinePayload;
  deployDir: string;
  oldGachaBaseline?: ChangelogBaselinePayload | null;
  oldMmoBaseline?: ChangelogBaselinePayload | null;
}

export interface BaselineFreezeResult {
  success: boolean;
  gachaPath: string;
  mmoPath: string;
  freezeRecordPath: string;
  gachaCount: number;
  mmoCount: number;
  newIdsCount: {
    gacha: number;
    mmo: number;
  };
  newIds: {
    gacha: string[];
    mmo: string[];
  };
  allCurrentIdsIncluded: boolean;
}

export const DEFAULT_BASELINE_ORIGIN = 'https://tof.smilekritik.beer';

export const BASELINE_RELATIVE_PATHS = {
  gacha: '/game-data/changelog/simulacra.json',
  mmo: '/game-data/changelog/simulacra-mmo.json',
} as const;

export const LEGACY_BASELINE_FALLBACK_PATHS = {
  gacha: '/info/simulacra/data/simulacra.json',
  mmo: '/info/simulacra/data/simulacra-mmo.json',
} as const;

/**
 * Deep clones any plain object or array.
 */
function deepClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Computes SHA-256 hex digest for a string buffer.
 */
function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Extracts standard tracked baseline character fields for value changelog comparison.
 */
export function extractBaselineCharacter(item: any): ChangelogBaselineCharacter {
  const id = String(item.id || item.slug || '').trim();
  return {
    id,
    avatar_id: item.avatar_id ? String(item.avatar_id) : undefined,
    weapon_id: item.weapon_id ? String(item.weapon_id) : undefined,
    name_en: item.name_en || item.name || '',
    name_ru: item.name_ru || item.name || '',
    element: item.element || '',
    role: item.role || '',
    rarity: item.rarity || '',
    base_stats: deepClone(item.base_stats || {}),
    max_stats: deepClone(item.max_stats || {}),
    advancements: deepClone(item.advancements || []),
    traits: deepClone(item.traits || item.awakening || []),
    weapon: deepClone(item.weapon || {}),
  };
}

/**
 * Creates a normalized ChangelogBaselinePayload from an array of characters.
 * Deterministically sorts characters by ID.
 */
export function createBaselinePayload(
  edition: 'gacha' | 'mmo',
  items: any[]
): ChangelogBaselinePayload {
  const characters: Record<string, ChangelogBaselineCharacter> = {};
  const sorted = [...items].sort((a, b) => {
    const idA = String(a.id || a.slug || '');
    const idB = String(b.id || b.slug || '');
    return idA.localeCompare(idB);
  });

  for (const item of sorted) {
    const id = String(item.id || item.slug || '').trim();
    if (id) {
      characters[id] = extractBaselineCharacter(item);
    }
  }

  return {
    schemaVersion: 1,
    edition,
    generatedAt: new Date().toISOString(),
    total: Object.keys(characters).length,
    characters,
  };
}

/**
 * Partitions entity IDs into common, new, and removed categories.
 * Invariant: New IDs never produce value-change entries.
 */
export function partitionBaselineIds(
  oldBaseline: ChangelogBaselinePayload | null,
  newBaseline: ChangelogBaselinePayload
): BaselineIdPartition {
  const newIdsSet = new Set(Object.keys(newBaseline.characters));
  if (!oldBaseline || !oldBaseline.characters) {
    return {
      commonIds: [],
      newIds: Array.from(newIdsSet).sort(),
      removedIds: [],
    };
  }

  const oldIdsSet = new Set(Object.keys(oldBaseline.characters));
  const commonIds: string[] = [];
  const newIds: string[] = [];
  const removedIds: string[] = [];

  for (const id of newIdsSet) {
    if (oldIdsSet.has(id)) {
      commonIds.push(id);
    } else {
      newIds.push(id);
    }
  }

  for (const id of oldIdsSet) {
    if (!newIdsSet.has(id)) {
      removedIds.push(id);
    }
  }

  return {
    commonIds: commonIds.sort(),
    newIds: newIds.sort(),
    removedIds: removedIds.sort(),
  };
}

/**
 * Single file download helper with HTTP revalidation (ETag, Last-Modified, Cache-Control: no-cache).
 */
async function fetchSingleBaseline(
  url: string,
  cacheFilePath: string,
  metaFilePath: string,
  options: {
    timeoutMs: number;
    fetchFn: typeof fetch;
    verbose?: boolean;
  }
): Promise<{
  status: 'ok' | 'not_modified' | 'not_found' | 'unavailable';
  payload: ChangelogBaselinePayload | null;
  metadata?: BaselineCacheMetadata;
  source: 'network' | 'cache' | 'none';
  error?: string;
}> {
  let existingMeta: BaselineCacheMetadata | null = null;
  if (fs.existsSync(metaFilePath)) {
    try {
      existingMeta = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
    } catch {
      existingMeta = null;
    }
  }

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache', // The baseline is mutable; always revalidate
  };

  if (existingMeta?.etag) {
    requestHeaders['If-None-Match'] = existingMeta.etag;
  }
  if (existingMeta?.lastModified) {
    requestHeaders['If-Modified-Since'] = existingMeta.lastModified;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    timeout.unref?.();

    const response = await options.fetchFn(url, {
      method: 'GET',
      headers: requestHeaders,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (response.status === 304 && fs.existsSync(cacheFilePath)) {
      if (options.verbose) {
        console.log(`[BASELINE] HTTP 304 Not Modified for ${url}. Reusing cached baseline.`);
      }
      const raw = fs.readFileSync(cacheFilePath, 'utf8');
      const payload = JSON.parse(raw) as ChangelogBaselinePayload;
      return {
        status: 'not_modified',
        payload,
        metadata: existingMeta || undefined,
        source: 'cache',
      };
    }

    if (response.status === 200) {
      const text = await response.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (err: any) {
        return {
          status: 'unavailable',
          payload: null,
          source: 'none',
          error: `Malformed JSON received from ${url}: ${err.message}`,
        };
      }

      // If array format or items format was received (e.g. from legacy path fallback)
      let payload: ChangelogBaselinePayload;
      if (parsed.characters && typeof parsed.characters === 'object') {
        payload = parsed as ChangelogBaselinePayload;
      } else {
        const items = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.items)
            ? parsed.items
            : Array.isArray(parsed.simulacra)
              ? parsed.simulacra
              : [];
        const edition = url.includes('mmo') ? 'mmo' : 'gacha';
        payload = createBaselinePayload(edition, items);
      }

      // Persist to local cache
      const cacheDir = path.dirname(cacheFilePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFilePath, JSON.stringify(payload, null, 2), 'utf8');

      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      const metadata: BaselineCacheMetadata = {
        etag: etag || null,
        lastModified: lastModified || null,
        downloadedAt: new Date().toISOString(),
        url,
        sha256: computeSha256(text),
        total: payload.total || Object.keys(payload.characters || {}).length,
      };
      fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2), 'utf8');

      if (options.verbose) {
        console.log(`[BASELINE] Downloaded fresh baseline from ${url} (${metadata.total} entities).`);
      }

      return {
        status: 'ok',
        payload,
        metadata,
        source: 'network',
      };
    }

    if (response.status === 404) {
      return {
        status: 'not_found',
        payload: null,
        source: 'none',
        error: `Remote baseline not found (HTTP 404) at ${url}. Initial bootstrap required.`,
      };
    }

    return {
      status: 'unavailable',
      payload: null,
      source: 'none',
      error: `Remote baseline returned unexpected status ${response.status} for ${url}`,
    };
  } catch (err: any) {
    // Check if we can fallback to cached file
    if (fs.existsSync(cacheFilePath)) {
      try {
        const payload = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        return {
          status: 'ok',
          payload,
          metadata: existingMeta || undefined,
          source: 'cache',
          error: `Network error (${err.message}), fell back to cached baseline.`,
        };
      } catch {
        // Cached file corrupt
      }
    }

    return {
      status: 'unavailable',
      payload: null,
      source: 'none',
      error: `Failed to fetch baseline from ${url}: ${err.message}`,
    };
  }
}

/**
 * Downloads the current published website baseline with conditional HTTP revalidation.
 * If remote server is unreachable, falls back to local cached copy or documented local baseline fixtures.
 */
export async function downloadBaseline(
  options: BaselineDownloadOptions = {}
): Promise<BaselineDownloadResult> {
  const baseUrl = (options.baseUrl || process.env.TOF_BASELINE_URL || DEFAULT_BASELINE_ORIGIN).replace(/\/+$/, '');
  const cacheDir = options.cacheDir || path.resolve(process.cwd(), 'pipeline/staging/baseline-cache');
  const timeoutMs = options.timeoutMs || 8000;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const warnings: string[] = [];

  const gachaUrl = `${baseUrl}${BASELINE_RELATIVE_PATHS.gacha}`;
  const mmoUrl = `${baseUrl}${BASELINE_RELATIVE_PATHS.mmo}`;

  const gachaCacheFile = path.join(cacheDir, 'simulacra.json');
  const gachaMetaFile = path.join(cacheDir, 'simulacra.meta.json');
  const mmoCacheFile = path.join(cacheDir, 'simulacra-mmo.json');
  const mmoMetaFile = path.join(cacheDir, 'simulacra-mmo.meta.json');

  const [gachaRes, mmoRes] = await Promise.all([
    fetchSingleBaseline(gachaUrl, gachaCacheFile, gachaMetaFile, { timeoutMs, fetchFn, verbose: options.verbose }),
    fetchSingleBaseline(mmoUrl, mmoCacheFile, mmoMetaFile, { timeoutMs, fetchFn, verbose: options.verbose }),
  ]);

  if (gachaRes.error) warnings.push(`Gacha baseline: ${gachaRes.error}`);
  if (mmoRes.error) warnings.push(`MMO baseline: ${mmoRes.error}`);

  // Check if both succeeded or if we need local fallback
  let gachaPayload = gachaRes.payload;
  let mmoPayload = mmoRes.payload;
  let source: BaselineDownloadResult['source'] = gachaRes.source === 'network' || mmoRes.source === 'network'
    ? 'network'
    : (gachaRes.source === 'cache' || mmoRes.source === 'cache' ? 'cache' : 'none');

  // If remote was not available or not found, try local fallback directory if provided or standard project paths
  if ((!gachaPayload || !mmoPayload) && options.localBaselineDir) {
    const localGacha = path.join(options.localBaselineDir, 'simulacra.json');
    const localMmo = path.join(options.localBaselineDir, 'simulacra-mmo.json');

    if (!gachaPayload && fs.existsSync(localGacha)) {
      try {
        gachaPayload = JSON.parse(fs.readFileSync(localGacha, 'utf8'));
        source = 'local_fallback';
        warnings.push(`Loaded local fallback Gacha baseline from ${localGacha}`);
      } catch (e: any) {
        warnings.push(`Failed to parse local Gacha baseline ${localGacha}: ${e.message}`);
      }
    }

    if (!mmoPayload && fs.existsSync(localMmo)) {
      try {
        mmoPayload = JSON.parse(fs.readFileSync(localMmo, 'utf8'));
        source = 'local_fallback';
        warnings.push(`Loaded local fallback MMO baseline from ${localMmo}`);
      } catch (e: any) {
        warnings.push(`Failed to parse local MMO baseline ${localMmo}: ${e.message}`);
      }
    }
  }

  // Determine overall status
  let status: BaselineDownloadResult['status'] = 'ok';
  if (!gachaPayload && !mmoPayload) {
    if (gachaRes.status === 'not_found' && mmoRes.status === 'not_found') {
      status = 'not_found';
    } else {
      status = 'unavailable';
    }
  } else if (!gachaPayload || !mmoPayload) {
    // Partial baseline available
    status = 'ok';
    warnings.push(`Partial baseline loaded (Gacha: ${Boolean(gachaPayload)}, MMO: ${Boolean(mmoPayload)})`);
  } else if (gachaRes.status === 'not_modified' && mmoRes.status === 'not_modified') {
    status = 'not_modified';
  }

  return {
    status,
    gachaBaseline: gachaPayload,
    mmoBaseline: mmoPayload,
    source,
    metadata: {
      gacha: gachaRes.metadata,
      mmo: mmoRes.metadata,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    error: status === 'unavailable' ? 'Baseline unavailable: remote site unreachable and no local baseline found.' : undefined,
  };
}

/**
 * First bootstrap command logic.
 * Builds initial baseline files from existing published per-entity Simulacra data without fabricating fake changelogs.
 */
export async function bootstrapBaseline(
  options: BaselineBootstrapOptions
): Promise<BaselineBootstrapResult> {
  const startTime = Date.now();
  const inputDir = path.resolve(options.inputDir);
  const outputDir = path.resolve(options.outputDir);

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Bootstrap input directory does not exist: ${inputDir}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const gachaItems: any[] = [];
  const mmoItems: any[] = [];

  // Check layout 1: Unified materialized simulacra dataset (e.g. apps/web/public/game-data/en/simulacra.json or inputDir/simulacra.json)
  const candidateUnified = [
    path.join(inputDir, 'simulacra.json'),
    path.join(inputDir, 'en', 'simulacra.json'),
    path.join(inputDir, 'game-data', 'en', 'simulacra.json'),
  ];

  let unifiedFound = false;
  for (const unifiedPath of candidateUnified) {
    if (fs.existsSync(unifiedPath)) {
      if (options.verbose) {
        console.log(`[BOOTSTRAP] Found unified simulacra dataset at ${unifiedPath}`);
      }
      try {
        const raw = JSON.parse(fs.readFileSync(unifiedPath, 'utf8'));
        const gachaList = Array.isArray(raw.gacha)
          ? raw.gacha
          : (Array.isArray(raw.items) ? raw.items : (Array.isArray(raw) ? raw : []));
        const mmoList = Array.isArray(raw.mmo) ? raw.mmo : [];

        for (const item of gachaList) {
          if (item && (item.id || item.slug)) {
            gachaItems.push(item);
          }
        }
        for (const item of mmoList) {
          if (item && (item.id || item.slug)) {
            mmoItems.push(item);
          }
        }
        unifiedFound = true;
        break;
      } catch (err: any) {
        if (options.verbose) {
          console.warn(`[BOOTSTRAP] Could not parse unified file ${unifiedPath}: ${err.message}`);
        }
      }
    }
  }

  // Check layout 2: Per-entity files (e.g. legacy info/simulacra/data/*.json or raw exports)
  if (!unifiedFound || (gachaItems.length === 0 && mmoItems.length === 0)) {
    const searchDirs = [
      inputDir,
      path.join(inputDir, 'info', 'simulacra', 'data'),
      path.join(inputDir, 'data', 'gacha'),
    ];

    for (const sDir of searchDirs) {
      if (fs.existsSync(sDir)) {
        const entries = fs.readdirSync(sDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
          if (
            entry.name.includes('-assets') ||
            entry.name.includes('-manifest') ||
            entry.name.includes('-report') ||
            entry.name.includes('-index') ||
            entry.name.startsWith('.')
          ) {
            continue;
          }

          const filePath = path.join(sDir, entry.name);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!data || typeof data !== 'object') continue;

            const isMmo = entry.name.endsWith('-mmo.json') || data.edition === 'mmo' || data.server_mode === 'mmo';
            if (isMmo) {
              if (data.id || data.slug) mmoItems.push(data);
            } else {
              if (data.id || data.slug) gachaItems.push(data);
            }
          } catch {
            // Non-fatal parse failure
          }
        }
      }
    }
  }

  if (gachaItems.length === 0 && mmoItems.length === 0) {
    throw new Error(
      `No valid Simulacra entities found in input directory "${inputDir}". Cannot bootstrap baseline.`
    );
  }

  // Build clean baselines without fake changelogs
  const gachaBaseline = createBaselinePayload('gacha', gachaItems);
  const mmoBaseline = createBaselinePayload('mmo', mmoItems);

  const gachaPath = path.join(outputDir, 'simulacra.json');
  const mmoPath = path.join(outputDir, 'simulacra-mmo.json');

  fs.writeFileSync(gachaPath, JSON.stringify(gachaBaseline, null, 2), 'utf8');
  fs.writeFileSync(mmoPath, JSON.stringify(mmoBaseline, null, 2), 'utf8');

  // Write bootstrap manifest
  const manifestPath = path.join(outputDir, 'baseline-bootstrap-manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        status: 'BOOTSTRAPPED',
        timestamp: new Date().toISOString(),
        sourceDir: inputDir,
        gachaTotal: gachaBaseline.total,
        mmoTotal: mmoBaseline.total,
        gachaFile: 'simulacra.json',
        mmoFile: 'simulacra-mmo.json',
        note: 'First baseline bootstrap created from published per-entity data. Contains zero synthetic diff records.',
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    success: true,
    gachaTotal: gachaBaseline.total,
    mmoTotal: mmoBaseline.total,
    gachaPath,
    mmoPath,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Prepares baseline comparison between old live baseline and new fresh export.
 */
export function prepareBaselineComparison(
  oldBaselines: { gacha: ChangelogBaselinePayload | null; mmo: ChangelogBaselinePayload | null },
  freshBaselines: { gacha: ChangelogBaselinePayload; mmo: ChangelogBaselinePayload }
): BaselineComparisonPreparation {
  const hasOldBaseline = Boolean(oldBaselines.gacha || oldBaselines.mmo);
  const gachaPartition = partitionBaselineIds(oldBaselines.gacha, freshBaselines.gacha);
  const mmoPartition = partitionBaselineIds(oldBaselines.mmo, freshBaselines.mmo);

  return {
    hasOldBaseline,
    status: hasOldBaseline ? 'ready' : 'baseline_unavailable',
    gacha: gachaPartition,
    mmo: mmoPartition,
    oldBaselines,
    freshBaselines,
  };
}

/**
 * Freezes the new complete baseline files into the deploy archive.
 * Guarantees that ALL current IDs (including new characters) are present in the new baseline.
 */
export function freezeBaselineToDeploy(
  options: BaselineFreezeOptions
): BaselineFreezeResult {
  const deployDir = path.resolve(options.deployDir);
  const changelogDir = path.join(deployDir, 'game-data', 'changelog');

  if (!fs.existsSync(changelogDir)) {
    fs.mkdirSync(changelogDir, { recursive: true });
  }

  const gachaPath = path.join(changelogDir, 'simulacra.json');
  const mmoPath = path.join(changelogDir, 'simulacra-mmo.json');
  const freezeRecordPath = path.join(changelogDir, 'baseline-freeze.json');

  // Write new complete baseline files
  fs.writeFileSync(gachaPath, JSON.stringify(options.gachaBaseline, null, 2), 'utf8');
  fs.writeFileSync(mmoPath, JSON.stringify(options.mmoBaseline, null, 2), 'utf8');

  // Compute new character additions if old baseline was supplied
  const gachaPartition = partitionBaselineIds(options.oldGachaBaseline || null, options.gachaBaseline);
  const mmoPartition = partitionBaselineIds(options.oldMmoBaseline || null, options.mmoBaseline);

  const freezeRecord = {
    schemaVersion: 1,
    frozenAt: new Date().toISOString(),
    gacha: {
      total: options.gachaBaseline.total,
      ids: Object.keys(options.gachaBaseline.characters).sort(),
      newCharacterIds: gachaPartition.newIds,
    },
    mmo: {
      total: options.mmoBaseline.total,
      ids: Object.keys(options.mmoBaseline.characters).sort(),
      newCharacterIds: mmoPartition.newIds,
    },
    allCurrentIdsIncluded: true,
    lifecycle: {
      phase1_revalidation: 'Downloader queries live baseline via ETag/Last-Modified headers; avoids unconditional immutable caching.',
      phase2_diffing: 'Changelog diffing evaluates only IDs present in both old baseline and fresh export. New IDs are excluded from value-change entries.',
      phase3_freeze: 'Deploy archive contains 100% of current IDs in new baseline files.',
      phase4_promotion: 'Upon owner deployment (copy/replace), the fresh baseline becomes the authoritative live baseline for subsequent updates.',
    },
    rollbackCaveat:
      'CRITICAL ROLLBACK NOTICE: Baseline files in /game-data/changelog/ define the diff reference for future exports. If an owner rolls back website game data, they MUST also roll back /game-data/changelog/ to match. Failing to do so will cause future exports to produce inverted or spurious value diffs.',
  };

  fs.writeFileSync(freezeRecordPath, JSON.stringify(freezeRecord, null, 2), 'utf8');

  return {
    success: true,
    gachaPath,
    mmoPath,
    freezeRecordPath,
    gachaCount: options.gachaBaseline.total,
    mmoCount: options.mmoBaseline.total,
    newIdsCount: {
      gacha: gachaPartition.newIds.length,
      mmo: mmoPartition.newIds.length,
    },
    newIds: {
      gacha: gachaPartition.newIds,
      mmo: mmoPartition.newIds,
    },
    allCurrentIdsIncluded: true,
  };
}
