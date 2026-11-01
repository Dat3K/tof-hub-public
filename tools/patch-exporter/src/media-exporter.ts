import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  convertPngToWebp,
  resolveNativeMediaTool,
  type ConvertWebpOptions,
  type ResolvedMediaTool,
} from './media-converter';
import {
  MediaManifestSchema,
  type MediaAssetRecord,
  type MediaManifest,
} from '../schemas/media-manifest.schema';

export interface MediaExportOptions {
  inputDir: string;
  outputDir: string;
  tool?: ResolvedMediaTool;
  mockConverter?: ConvertWebpOptions['mockConverter'];
  lossless?: boolean;
  quality?: number;
  verbose?: boolean;
  maxFiles?: number;
  filterPrefix?: string;
  specificFiles?: string[];
  webpAliases?: Array<{ sourceFile: string; relativePath: string }>;
  preparedWebpAliases?: Array<{ sourceFile: string; relativePath: string }>;
  jobs?: number;
  onProgress?: (completed: number, total: number) => void;
}

export interface ReferencedAssetAlias {
  sourceFile: string;
  /** Requested public WebP path, including the .webp suffix. */
  relativePath: string;
}

export interface MediaExportSummary {
  manifestVersion: '1.0.0';
  generatedAt: string;
  outputDir: string;
  publicPngDir: string;
  publicWebpDir: string;
  manifestPath: string;
  totalAssets: number;
  convertedWebpCount: number;
  copiedPngCount: number;
  failedCount: number;
  manifest: MediaManifest;
  durationMs: number;
}

/**
 * Normalizes relative asset path ensuring forward slashes and valid in-game root.
 * e.g., 'Hotta\Content\Resources\UI\icon.png' -> 'Hotta/Content/Resources/UI/icon.png'
 */
export function normalizeRelativeAssetPath(fullPath: string, rootDir: string): string {
  let relative = path.relative(rootDir, fullPath).replace(/\\/g, '/');

  // Strip leading ./ or /
  relative = relative.replace(/^\.?\/+/, '');

  // If the path was nested inside raw_exports or similar, clean to Hotta/ or Engine/ if present
  const hottaIdx = relative.indexOf('Hotta/');
  if (hottaIdx !== -1) {
    return relative.slice(hottaIdx);
  }
  const engineIdx = relative.indexOf('Engine/');
  if (engineIdx !== -1) {
    return relative.slice(engineIdx);
  }

  return relative;
}

/**
 * Recursively scans a directory for PNG files.
 */
// The raw export is read-only during a pipeline run, yet several reference
// resolvers each walk it. With TOF_MEDIA_INDEX_CACHE=1 every tree is listed once.
const fileIndexCache = new Map<string, string[]>();

function cachedListing(key: string, list: () => string[]): string[] {
  if (process.env.TOF_MEDIA_INDEX_CACHE !== '1') return list();
  const cached = fileIndexCache.get(key);
  if (cached) return cached;
  const value = list();
  fileIndexCache.set(key, value);
  return value;
}

export function findPngFiles(dir: string, maxFiles?: number): string[] {
  if (maxFiles === undefined) return findFilesWithExtension(dir, '.png');
  const results: string[] = [];

  function walk(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (maxFiles && results.length >= maxFiles) return;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

function findFilesWithExtension(dir: string, extension: string): string[] {
  return cachedListing(`${extension.toLowerCase()}\0${path.resolve(dir)}`, () => listFilesWithExtension(dir, extension));
}

function listFilesWithExtension(dir: string, extension: string): string[] {
  const results: string[] = [];
  const normalizedExtension = extension.toLowerCase();

  function walk(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return;
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(normalizedExtension)) results.push(fullPath);
    }
  }

  walk(dir);
  return results;
}

const referenceCache = new Map<string, Set<string>>();

/** Generated data changes between media passes; the raw file index does not. */
export function clearMediaReferenceCache(): void {
  referenceCache.clear();
}

function collectReferencedAssetPaths(gameDataDir: string, sourceDirs: string[] = []): Set<string> {
  if (process.env.TOF_MEDIA_INDEX_CACHE !== '1') return scanReferencedAssetPaths(gameDataDir, sourceDirs);
  const key = [gameDataDir, ...sourceDirs].map((dir) => path.resolve(dir)).join('\0');
  let cached = referenceCache.get(key);
  if (!cached) {
    cached = scanReferencedAssetPaths(gameDataDir, sourceDirs);
    referenceCache.set(key, cached);
  }
  return cached;
}

export function normalizeReferencedAssetPath(value: string): string | null {
  const normalized = value
      .split(/[?#]/, 1)[0]
      .replace(/\\/g, '/')
      .replace(/^\/datamine\/shared\/media\//i, '')
      .replace(/^\/game-assets\/(?:png|webp)\//i, '')
      .replace(/^\/+/, '')
      .replace(/\.(?:webp|png)$/i, '');

  return /^(?:Hotta|Engine)\/Content\//i.test(normalized) && !normalized.split('/').includes('..')
    ? normalized
    : null;
}

function scanReferencedAssetPaths(gameDataDir: string, sourceDirs: string[] = []): Set<string> {
  const referencedPaths = new Set<string>();

  const addReference = (value: string): void => {
    const normalized = normalizeReferencedAssetPath(value);
    if (normalized) referencedPaths.add(normalized);
  };

  const visitValue = (value: unknown): void => {
    if (typeof value === 'string') {
      addReference(value);
    } else if (Array.isArray(value)) {
      value.forEach(visitValue);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(visitValue);
    }
  };

  const visitDirectory = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        try {
          visitValue(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
        } catch {
          // A malformed optional JSON file must not block unrelated assets.
        }
      }
    }
  };

  visitDirectory(gameDataDir);

  const sourceAssetPath = /(?:Hotta|Engine)[\\/][A-Za-z0-9_./\\-]+/g;
  const visitSourceDirectory = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visitSourceDirectory(fullPath);
      } else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|css|html)$/i.test(entry.name)) {
        const source = fs.readFileSync(fullPath, 'utf8');
        for (const match of source.matchAll(sourceAssetPath)) {
          addReference(match[0]);
        }
      }
    }
  };

  sourceDirs.forEach(visitSourceDirectory);
  return referencedPaths;
}

function referencedAssetAliases(reference: string): string[] {
  const fileName = reference.split('/').pop() || '';
  const stem = fileName.replace(/\.webp$/i, '');
  const aliases = new Set<string>([stem]);

  const knownOoWAliases: Record<string, string[]> = {
    Boss_hum_026: ['bigboss026'],
    mon_hum_057: ['Boss_hum_057_SHTT_DT'],
    mon_hum_022_SHTT_DT: ['mon_hum_022_SHTT_DT'],
  };
  for (const alias of knownOoWAliases[stem] || []) aliases.add(alias);

  // OoW curated mappings historically point to the canonical void/boss name,
  // while the prepared raw export may contain the same portrait in SHTT/guaiwu
  // or under the FCE boss package name. These are deterministic identity
  // aliases, not fuzzy matching.
  const numbered = stem.match(/^(?:mon_hum|Boss_hum)_(\d+)([a-z])?(?:_SHTT_DT)?$/i);
  if (numbered) {
    const number = String(Number(numbered[1])).padStart(3, '0');
    const suffix = (numbered[2] || '').toLowerCase();
    aliases.add(`Boss_hum_${number}${suffix}_SHTT_DT`);
    aliases.add(`Boss_hum_${number}${suffix}`);
    aliases.add(`mon_hum_${number}${suffix}_SHTT_DT`);
    aliases.add(`mon_hum_${number}${suffix}`);
    aliases.add(`bigboss${number}`);
  }

  return [...aliases];
}

/**
 * Resolve legacy/curated OoW image URLs to an identically named raw portrait
 * stored in another game UI directory. Only unique, deterministic aliases are
 * accepted; ambiguous or fuzzy matches remain missing and are reported.
 */
export function findReferencedAssetAliases(
  inputDir: string,
  gameDataDir: string,
  sourceDirs: string[] = []
): ReferencedAssetAlias[] {
  const referencedPaths = collectReferencedAssetPaths(gameDataDir, sourceDirs);
  const rawByStem = new Map<string, string[]>();

  for (const rawPng of findPngFiles(inputDir)) {
    const stem = path.basename(rawPng, path.extname(rawPng)).toLowerCase();
    const matches = rawByStem.get(stem) || [];
    const normalizedPath = normalizeRelativeAssetPath(rawPng, inputDir).toLowerCase();
    if (!matches.some((candidate) => normalizeRelativeAssetPath(candidate, inputDir).toLowerCase() === normalizedPath)) {
      matches.push(rawPng);
    }
    rawByStem.set(stem, matches);
  }

  const aliases: ReferencedAssetAlias[] = [];
  for (const reference of referencedPaths) {
    const exactRawPath = path.join(inputDir, `${reference}.png`);
    if (fs.existsSync(exactRawPath)) continue;

    const candidates = referencedAssetAliases(reference)
      .flatMap((candidate) => rawByStem.get(candidate.toLowerCase()) || []);
    const uniqueCandidates = [...new Set(candidates)];
    if (uniqueCandidates.length !== 1) continue;

    aliases.push({
      sourceFile: uniqueCandidates[0],
      relativePath: `${reference}.webp`,
    });
  }

  return aliases;
}

/**
 * Return the raw PNG paths required by the materialized datasets.
 *
 * Public datasets keep game-media references as WebP URLs, while the raw export
 * contains the source PNG at the same in-game path. Resolving this list before
 * conversion prevents a prepared-files export from converting an entire game
 * image dump just because it happens to be available locally.
 */
export function findReferencedPngFiles(
  inputDir: string,
  gameDataDir: string,
  sourceDirs: string[] = []
): string[] {
  const referencedPaths = collectReferencedAssetPaths(gameDataDir, sourceDirs);

  const rawByGamePath = new Map<string, string>();
  for (const rawPng of findPngFiles(inputDir)) {
    rawByGamePath.set(normalizeRelativeAssetPath(rawPng, inputDir).toLowerCase(), rawPng);
  }

  return [...referencedPaths]
    .map((reference) => rawByGamePath.get(`${reference}.png`.toLowerCase()))
    .filter((file): file is string => Boolean(file));
}

/**
 * Returns canonical game paths referenced by materialized data but absent from
 * the prepared raw export. No fallback or guessing is performed. Callers can
 * persist this report and ask for an explicit mapping when the game stores an
 * image under a different asset path.
 */
export function findMissingReferencedAssetPaths(
  inputDir: string,
  gameDataDir: string,
  sourceDirs: string[] = []
): string[] {
  const referencedPaths = collectReferencedAssetPaths(gameDataDir, sourceDirs);
  const rawByGamePath = new Set<string>();

  for (const rawPng of findPngFiles(inputDir)) {
    rawByGamePath.add(normalizeRelativeAssetPath(rawPng, inputDir).toLowerCase());
  }

  const resolvedAliases = new Set(
    [
      ...findReferencedAssetAliases(inputDir, gameDataDir, sourceDirs),
      ...findReferencedPreparedWebpFiles(inputDir, gameDataDir, sourceDirs),
      ...findReferencedWebpAliases(inputDir, gameDataDir, sourceDirs),
    ].map((alias) => alias.relativePath.replace(/\.webp$/i, '').toLowerCase()),
  );

  return [...referencedPaths]
    // Provenance strings (table paths, globs, field notes) are not texture references.
    .filter((reference) => !/[{}*:\s]|\.json$|\/$/i.test(reference))
    .filter((reference) => !/^Hotta\/Content\/(?:Localization\/|Resources(?:OverSea)?\/(?:CoreBlueprints|Abilities)\/)/i.test(reference))
    .filter((reference) =>
      !rawByGamePath.has(`${reference}.png`.toLowerCase()) &&
      !resolvedAliases.has(reference.toLowerCase()),
    )
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve generated `.thumb.webp` references to the base PNG when the raw
 * dump contains only the game asset's source image. The exporter keeps the
 * original requested URL and materializes the alias after conversion.
 */
export function findReferencedWebpAliases(
  inputDir: string,
  gameDataDir: string,
  sourceDirs: string[] = []
): Array<{ sourceFile: string; relativePath: string }> {
  const referencedPaths = collectReferencedAssetPaths(gameDataDir, sourceDirs);
  const rawByGamePath = new Map<string, string>();
  for (const rawPng of findPngFiles(inputDir)) {
    rawByGamePath.set(normalizeRelativeAssetPath(rawPng, inputDir).toLowerCase(), rawPng);
  }

  const aliases: Array<{ sourceFile: string; relativePath: string }> = [];
  for (const reference of referencedPaths) {
    if (!reference.endsWith('.thumb')) continue;
    const requestedPath = `${reference}.webp`;
    if (rawByGamePath.has(`${reference}.png`.toLowerCase())) continue;
    const sourceFile = rawByGamePath.get(`${reference.slice(0, -'.thumb'.length)}.png`.toLowerCase());
    if (sourceFile) aliases.push({ sourceFile, relativePath: requestedPath });
  }
  return aliases;
}

/**
 * Finds already-prepared WebP files in curated/raw input trees. These files
 * must be staged verbatim; converting them as if they were PNGs loses the
 * source and was the reason some legacy OoW portraits were absent.
 */
export function findReferencedPreparedWebpFiles(
  inputDir: string,
  gameDataDir: string,
  sourceDirs: string[] = []
): Array<{ sourceFile: string; relativePath: string }> {
  const referencedPaths = collectReferencedAssetPaths(gameDataDir, sourceDirs);
  const rawByGamePath = new Map<string, string>();

  for (const rawWebp of findFilesWithExtension(inputDir, '.webp')) {
    rawByGamePath.set(normalizeRelativeAssetPath(rawWebp, inputDir).toLowerCase(), rawWebp);
  }

  return [...referencedPaths]
    .map((reference) => {
      const sourceFile = rawByGamePath.get(`${reference}.webp`.toLowerCase());
      return sourceFile ? { sourceFile, relativePath: `${reference}.webp` } : null;
    })
    .filter((alias): alias is { sourceFile: string; relativePath: string } => Boolean(alias));
}

/**
 * Exports media assets: preserves in-game relative path for PNG and converts each to WebP.
 * Output keeps game-relative paths: game-assets/{png,webp}/Hotta/Content/...
 */
export async function exportMediaAssets(
  options: MediaExportOptions
): Promise<MediaExportSummary> {
  const startTime = Date.now();

  const canonicalInput = path.resolve(options.inputDir);
  const canonicalOutput = path.resolve(options.outputDir);

  const pngBaseDir = path.join(canonicalOutput, 'game-assets', 'png');
  const webpBaseDir = path.join(canonicalOutput, 'game-assets', 'webp');

  if (!fs.existsSync(pngBaseDir)) {
    fs.mkdirSync(pngBaseDir, { recursive: true });
  }
  if (!fs.existsSync(webpBaseDir)) {
    fs.mkdirSync(webpBaseDir, { recursive: true });
  }

  // 1. Discover PNG files to export
  let targetPngFiles: string[] = [];
  if (options.specificFiles !== undefined) {
    targetPngFiles = options.specificFiles.map((f) =>
      path.isAbsolute(f) ? f : path.join(canonicalInput, f)
    );
  } else {
    targetPngFiles = findPngFiles(canonicalInput, options.maxFiles);
  }

  if (options.filterPrefix) {
    const prefix = options.filterPrefix.toLowerCase();
    targetPngFiles = targetPngFiles.filter((p) => p.toLowerCase().includes(prefix));
  }

  // 2. Resolve native conversion tool once
  const tool = options.tool || resolveNativeMediaTool();

  const assetRecords: MediaAssetRecord[] = [];
  let copiedPngCount = 0;
  let convertedWebpCount = 0;
  let failedCount = 0;

  const processOne = async (index: number): Promise<void> => {
    const srcPng = targetPngFiles[index];
    if (!fs.existsSync(srcPng)) {
      failedCount++;
      return;
    }

    const relativePath = normalizeRelativeAssetPath(srcPng, canonicalInput);
    const relativeWebp = relativePath.replace(/\.png$/i, '.webp');

    const destPng = path.join(pngBaseDir, relativePath);
    const destWebp = path.join(webpBaseDir, relativeWebp);

    // Ensure target subdirectories exist
    const destPngDir = path.dirname(destPng);
    if (!fs.existsSync(destPngDir)) {
      fs.mkdirSync(destPngDir, { recursive: true });
    }

    // Step A: Preserve in-game relative path PNG
    try {
      await fs.promises.copyFile(srcPng, destPng);
      copiedPngCount++;
    } catch (err: any) {
      failedCount++;
      assetRecords.push({
        rawPath: srcPng,
        relativePath,
        pngPath: destPng,
        webpPath: destWebp,
        pngSizeBytes: 0,
        webpSizeBytes: 0,
        sha256Png: '',
        sha256Webp: '',
        status: 'error',
      });
      return;
    }

    // Step B: Generate WebP with preserved in-game relative path
    const convertResult = await convertPngToWebp(destPng, destWebp, {
      tool: tool || undefined,
      mockConverter: options.mockConverter,
      lossless: options.lossless === true,
      quality: options.quality,
    });

    if (convertResult.success) {
      convertedWebpCount++;
      assetRecords.push({
        rawPath: srcPng,
        relativePath,
        pngPath: destPng,
        webpPath: destWebp,
        pngSizeBytes: convertResult.pngSizeBytes,
        webpSizeBytes: convertResult.webpSizeBytes,
        sha256Png: convertResult.sha256Png,
        sha256Webp: convertResult.sha256Webp,
        width: convertResult.width,
        height: convertResult.height,
        status: 'converted',
      });
    } else {
      failedCount++;
      assetRecords.push({
        rawPath: srcPng,
        relativePath,
        pngPath: destPng,
        webpPath: destWebp,
        pngSizeBytes: convertResult.pngSizeBytes,
        webpSizeBytes: 0,
        sha256Png: convertResult.sha256Png,
        sha256Webp: '',
        width: convertResult.width,
        height: convertResult.height,
        status: 'error',
      });
    }

  };

  // cwebp is a separate CPU-bound process. Run one worker per available
  // logical CPU by default; each worker handles a different image and reports completion in
  // completion order, rather than source-list order.
  const availableJobs = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  const workerCount = Math.min(
    targetPngFiles.length,
    Math.max(1, Math.floor(options.jobs ?? availableJobs))
  );
  let nextIndex = 0;
  let completedCount = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= targetPngFiles.length) return;
      try {
        await processOne(index);
      } finally {
        completedCount++;
        options.onProgress?.(completedCount, targetPngFiles.length);
      }
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));

  // Some legacy datasets expose a `.thumb.webp` URL while the raw export only
  // contains the source PNG. Materialize that exact requested path from the
  // same PNG so the site keeps legacy URLs without using a PNG fallback.
  for (const alias of options.webpAliases || []) {
    const sourceRelativePath = normalizeRelativeAssetPath(alias.sourceFile, canonicalInput);
    const sourcePng = path.join(pngBaseDir, sourceRelativePath);
    const aliasWebp = path.join(webpBaseDir, alias.relativePath);
    const aliasPng = path.join(pngBaseDir, alias.relativePath.replace(/\.webp$/i, '.png'));
    if (!fs.existsSync(sourcePng)) continue;

    try {
      fs.mkdirSync(path.dirname(aliasPng), { recursive: true });
      fs.mkdirSync(path.dirname(aliasWebp), { recursive: true });
      fs.copyFileSync(sourcePng, aliasPng);
      copiedPngCount++;
      const convertResult = await convertPngToWebp(aliasPng, aliasWebp, {
        tool: tool || undefined,
        mockConverter: options.mockConverter,
        lossless: options.lossless === true,
        quality: options.quality,
      });
      const relativePath = alias.relativePath.replace(/\.webp$/i, '.png');
      if (convertResult.success) {
        convertedWebpCount++;
        assetRecords.push({
          rawPath: alias.sourceFile,
          relativePath,
          pngPath: aliasPng,
          webpPath: aliasWebp,
          pngSizeBytes: convertResult.pngSizeBytes,
          webpSizeBytes: convertResult.webpSizeBytes,
          sha256Png: convertResult.sha256Png,
          sha256Webp: convertResult.sha256Webp,
          width: convertResult.width,
          height: convertResult.height,
          status: 'converted',
        });
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  // Curated inputs may already contain the exact requested WebP. Preserve it
  // verbatim and stage it beside converted game assets.
  const generatedWebpPaths = new Set(assetRecords
    .filter((asset) => asset.status === 'converted')
    .map((asset) => asset.relativePath.replace(/\.png$/i, '.webp').toLowerCase()));
  for (const alias of options.preparedWebpAliases || []) {
    if (generatedWebpPaths.has(alias.relativePath.toLowerCase())) continue;
    const destWebp = path.join(webpBaseDir, alias.relativePath);
    if (!fs.existsSync(alias.sourceFile)) continue;
    try {
      fs.mkdirSync(path.dirname(destWebp), { recursive: true });
      fs.copyFileSync(alias.sourceFile, destWebp);
    } catch {
      failedCount++;
    }
  }

  assetRecords.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  // 3. Construct and validate media manifest using Zod schema
  const previousManifestPath = path.join(canonicalOutput, 'game-assets', 'media-manifest.json');
  let previousAssets: MediaAssetRecord[] = [];
  if (fs.existsSync(previousManifestPath)) {
    try {
      const previous = MediaManifestSchema.parse(JSON.parse(fs.readFileSync(previousManifestPath, 'utf8')));
      previousAssets = previous.assets;
    } catch {
      // A stale or partial manifest must not prevent the current export.
    }
  }

  const mergedAssets = new Map<string, MediaAssetRecord>();
  for (const asset of previousAssets) mergedAssets.set(asset.relativePath.toLowerCase(), asset);
  for (const asset of assetRecords) mergedAssets.set(asset.relativePath.toLowerCase(), asset);
  const allAssets = [...mergedAssets.values()].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );

  const manifestData: MediaManifest = {
    manifestVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    counts: {
      total: allAssets.length,
      png: allAssets.filter((asset) => asset.status === 'converted').length,
      webp: allAssets.filter((asset) => asset.status === 'converted').length,
      errors: allAssets.filter((asset) => asset.status === 'error').length,
    },
    assets: allAssets,
  };

  const parsedManifest = MediaManifestSchema.parse(manifestData);

  const manifestPath = path.join(canonicalOutput, 'game-assets', 'media-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(parsedManifest, null, 2) + '\n', 'utf8');

  // Also write sibling copy at output root for convenience
  const rootManifestPath = path.join(canonicalOutput, 'media-manifest.json');
  fs.writeFileSync(rootManifestPath, JSON.stringify(parsedManifest, null, 2) + '\n', 'utf8');

  return {
    manifestVersion: '1.0.0',
    generatedAt: parsedManifest.generatedAt,
    outputDir: canonicalOutput,
    publicPngDir: pngBaseDir,
    publicWebpDir: webpBaseDir,
    manifestPath,
    totalAssets: assetRecords.length,
    convertedWebpCount,
    copiedPngCount,
    failedCount,
    manifest: parsedManifest,
    durationMs: Date.now() - startTime,
  };
}
