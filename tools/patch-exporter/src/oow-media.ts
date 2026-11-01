import fs from 'node:fs';
import { SUPPORTED_LOCALES } from '../../../packages/i18n/src/constants';
import path from 'node:path';
import { MediaManifestSchema } from '../schemas/media-manifest.schema';
import { computeSha256, getPngDimensions } from './media-converter';
import {
  findReferencedAssetAliases,
  findReferencedPngFiles,
  normalizeReferencedAssetPath,
  normalizeRelativeAssetPath,
} from './media-exporter';

interface EnemyPngEntry {
  reference: string;
  expectedRawPath: string;
  status: 'raw_png' | 'preserved_png' | 'missing_png';
  pngUrl: string | null;
  sourcePath: string | null;
  sha256: string | null;
  consumers: string[];
}

/** A complete catalog must never be packaged with declared icons absent from the update. */
export function validateOowEffectCatalogMedia(publicDir: string): void {
  const missing = new Set<string>();
  for (const locale of SUPPORTED_LOCALES) {
    const file = path.join(publicDir, 'game-data', locale, 'oow/effects.json');
    if (!fs.existsSync(file)) continue;
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const mode of ['standard', 'mmo']) for (const effect of catalog.modes?.[mode] || []) {
      if (!effect.icon) continue;
      const reference = normalizeReferencedAssetPath(effect.icon);
      if (!reference) throw new Error(`Invalid OoW catalog icon URL for ${mode}/${effect.id}: ${effect.icon}`);
      const target = path.join(publicDir, 'game-assets', 'webp', `${reference}.webp`);
      if (!fs.existsSync(target) || fs.statSync(target).size === 0) missing.add(`${reference}.webp`);
    }
  }
  if (missing.size) throw new Error(`OoW effect catalog: ${missing.size} referenced icon(s) were not exported. Update package was not produced. Re-export the PNG textures: ${[...missing].sort().join(', ')}`);
}

/** Verify originals after media export, then publish only downloads that exist. */
export function reconcileOowEnemyPngDownloads(options: {
  publicDir: string;
  rawDir: string;
  preservedDir: string;
  reportsDir: string;
}): { originals: number; preserved: number; missing: number } {
  const { publicDir, rawDir, preservedDir, reportsDir } = options;
  const gameData = path.join(publicDir, 'game-data');
  const manifestPath = path.join(publicDir, 'game-assets', 'media-manifest.json');
  const assets = fs.existsSync(manifestPath)
    ? MediaManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).assets
    : [];
  const byReference = new Map(assets.map((asset) => [
    asset.relativePath.replace(/\.png$/i, '').toLowerCase(), asset,
  ]));
  const rawSources = new Map<string, string>();
  for (const file of findReferencedPngFiles(rawDir, gameData)) {
    rawSources.set(normalizeRelativeAssetPath(file, rawDir).replace(/\.png$/i, '').toLowerCase(), file);
  }
  for (const alias of findReferencedAssetAliases(rawDir, gameData)) {
    rawSources.set(alias.relativePath.replace(/\.webp$/i, '').toLowerCase(), alias.sourceFile);
  }

  const within = (file: string, root: string): boolean => {
    const relative = path.relative(path.resolve(root), path.resolve(file));
    return Boolean(relative) && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
  };
  const entries = new Map<string, EnemyPngEntry>();
  const resolve = (value: unknown): EnemyPngEntry | null => {
    const reference = typeof value === 'string' ? normalizeReferencedAssetPath(value) : null;
    if (!reference) return null;
    const key = reference.toLowerCase();
    const existing = entries.get(key);
    if (existing) return existing;

    const record = byReference.get(key);
    const rawSource = rawSources.get(key);
    const preservedSource = record && within(record.rawPath, preservedDir) && fs.existsSync(record.rawPath)
      && getPngDimensions(record.rawPath).isValidPng ? record.rawPath : null;
    const source = rawSource || preservedSource;
    const entry: EnemyPngEntry = {
      reference, expectedRawPath: `${reference}.png`, status: 'missing_png',
      pngUrl: null, sourcePath: null, sha256: null, consumers: [],
    };
    if (source) {
      const pngPath = record && path.join(publicDir, 'game-assets', 'png', record.relativePath);
      if (!getPngDimensions(source).isValidPng) {
        throw new Error(`OOW original is not a PNG: ${normalizeRelativeAssetPath(source, rawDir)}`);
      }
      const hash = computeSha256(source);
      if (!record || record.status === 'error' || path.resolve(record.rawPath) !== path.resolve(source)
        || !pngPath || !within(pngPath, path.join(publicDir, 'game-assets', 'png'))
        || !fs.existsSync(pngPath) || !getPngDimensions(pngPath).isValidPng
        || record.sha256Png !== hash || computeSha256(pngPath) !== hash) {
        throw new Error(`OOW original PNG was not preserved byte-for-byte: ${reference}`);
      }
      entry.status = rawSource ? 'raw_png' : 'preserved_png';
      entry.pngUrl = `/game-assets/png/${record.relativePath}`;
      entry.sourcePath = normalizeRelativeAssetPath(source, rawSource ? rawDir : preservedDir);
      entry.sha256 = hash;
    }
    entries.set(key, entry);
    return entry;
  };

  // Runtime shards and the tracked locale mirrors share the same download contract.
  for (const base of [gameData, publicDir]) {
    for (const locale of SUPPORTED_LOCALES) {
      const directory = path.join(base, locale, 'oow', 'seasons');
      if (!fs.existsSync(directory)) continue;
      for (const file of fs.readdirSync(directory).filter((name) => /^(?:mmo_)?s\d+\.json$/i.test(name))) {
        const filePath = path.join(directory, file);
        const season = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let changed = false;
        for (const floor of season.floors || []) {
          for (const enemy of floor.enemies || []) {
            const consumer = `${file}:F${floor.floor}:${enemy.monsterClass || enemy.codeName || enemy.key}:${enemy.key}`;
            for (const [field, image] of [
              ['imagePng', enemy.image],
              ['detailImagePng', enemy.detailImageFull || enemy.image],
            ] as const) {
              const entry = resolve(image);
              const png = entry?.pngUrl ?? null;
              if (enemy[field] !== png) { enemy[field] = png; changed = true; }
              if (entry && !entry.consumers.includes(consumer)) entry.consumers.push(consumer);
            }
          }
        }
        if (changed) fs.writeFileSync(filePath, `${JSON.stringify(season, null, 2)}\n`);
      }
    }
  }

  const portraits = [...entries.values()].sort((a, b) => a.reference.localeCompare(b.reference));
  const counts = {
    originals: portraits.filter((entry) => entry.status === 'raw_png').length,
    preserved: portraits.filter((entry) => entry.status === 'preserved_png').length,
    missing: portraits.filter((entry) => entry.status === 'missing_png').length,
  };
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'oow-enemy-png.json'), `${JSON.stringify({
    checked: true, ...counts, portraits,
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(reportsDir, 'oow-enemy-png.md'), [
    '# OOW enemy PNG originals', '',
    `${counts.originals} from this raw export; ${counts.preserved} preserved PNGs; ${counts.missing} unavailable originals.`, '',
    'Paths below are relative to the raw-export root. A missing path is an extraction target, not proof that the texture exists in this client.', '',
    '| Expected raw PNG | Status | Actual source | Enemy locations |',
    '| --- | --- | --- | --- |',
    ...portraits.map((entry) => `| ${entry.expectedRawPath} | ${entry.status} | ${entry.sourcePath || 'unknown'} | ${entry.consumers.join('<br>')} |`), '',
  ].join('\n'));
  return counts;
}
