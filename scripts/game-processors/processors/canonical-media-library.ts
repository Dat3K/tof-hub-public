/**
 * canonical-media-library.js
 *
 * Authoritative Canonical Media Resolution & Manifest Library (Global Rules R3, R4, R5, R6).
 *
 * Implements:
 * 1. Exact Unreal Engine soft reference normalization to canonical game package paths.
 * 2. Strict path traversal rejection and security validation.
 * 3. Exact casing preservation and object suffix stripping.
 * 4. Zero hashing / ca_* ID prefixing in canonical URLs.
 * 5. Full provenance tracking, collision detection, and deterministic manifest serialization.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PUBLIC_MEDIA_ROOT = '/datamine/shared/media';

/**
 * Validates that an asset path does not contain malicious traversal, drive letters,
 * control characters, or query/hash injections.
 */
function assertSafeAssetPath(rawPath) {
  if (typeof rawPath !== 'string') {
    throw new Error(`Invalid asset path type: expected string, got ${typeof rawPath}`);
  }
  const str = rawPath.trim();
  if (!str) {
    throw new Error('Empty asset path');
  }

  // Reject control characters (0x00 - 0x1F, 0x7F)
  if (/[\x00-\x1F\x7F]/.test(str)) {
    throw new Error(`Asset path contains invalid control characters: ${JSON.stringify(str)}`);
  }

  // Reject URL query parameters or fragments
  if (str.includes('?') || str.includes('#')) {
    throw new Error(`Asset path contains URL query or fragment injection: ${str}`);
  }

  // Reject Windows drive letters (e.g. C:, D:)
  if (/^[a-zA-Z]:/.test(str)) {
    throw new Error(`Asset path contains forbidden filesystem drive letter: ${str}`);
  }

  // Normalize separators to forward slash for inspection
  const normalized = str.replace(/\\/g, '/');

  // Reject path traversal (.. segments)
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '..') {
      throw new Error(`Path traversal (..) rejected in asset path: ${str}`);
    }
  }

  // Reject null bytes
  if (str.includes('\0')) {
    throw new Error(`Null byte rejected in asset path: ${JSON.stringify(str)}`);
  }

  return true;
}

/**
 * Safely extracts the string AssetPathName from string, object, or stringified dict.
 */
function extractAssetPathName(rawInput) {
  if (rawInput === null || rawInput === undefined) return null;

  if (typeof rawInput === 'object') {
    const p = rawInput.AssetPathName || rawInput.asset_path_name || rawInput.path || rawInput.filePath;
    if (typeof p === 'string') {
      const trimmed = p.trim();
      return (trimmed && trimmed !== 'None' && trimmed !== 'null') ? trimmed : null;
    }
    return null;
  }

  let str = String(rawInput).trim();
  if (!str || str === 'None' || str === 'null' || str === '""' || str === "''") {
    return null;
  }

  // Handle stringified Python / JSON dictionaries e.g. "{'AssetPathName': '...', 'SubPathString': ''}"
  if (str.startsWith('{') && str.endsWith('}')) {
    const matchAssetPath = str.match(/['"]AssetPathName['"]\s*:\s*['"]([^'"]+)['"]/i) ||
                           str.match(/['"]path['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (matchAssetPath && matchAssetPath[1]) {
      const extracted = matchAssetPath[1].trim();
      if (extracted && extracted !== 'None' && extracted !== 'null') {
        return extracted;
      }
      return null;
    }
    return null;
  }

  return str;
}

/**
 * Normalizes an Unreal Engine soft reference to an exact package path under Hotta/Content/.
 * Example:
 *   /Game/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip4.BluePrint_T1_Equip4
 *   -> Hotta/Content/Resources/Icon/weapon/Equip_MMO/MMOBluePrint/BluePrint_T1_Equip4
 *
 * Rules:
 * - Validates path safety.
 * - Strips only the trailing Unreal object suffix (e.g. .Foo).
 * - Maps /Game/ to Hotta/Content/.
 * - Preserves directory and filename casing verbatim.
 */
function normalizeUnrealSoftReference(rawRef, options: Record<string, any> = {}) {
  const extracted = extractAssetPathName(rawRef);
  if (!extracted) return null;

  assertSafeAssetPath(extracted);

  let clean = extracted.replace(/\\/g, '/');

  // Strip Unreal object suffix e.g. /Game/X/Y/Foo.Foo -> /Game/X/Y/Foo
  // In Unreal, the soft reference format is /Path/To/PackageName.ObjectName
  const lastSlash = clean.lastIndexOf('/');
  const prefix = lastSlash >= 0 ? clean.substring(0, lastSlash + 1) : '';
  const fileAndObject = lastSlash >= 0 ? clean.substring(lastSlash + 1) : clean;

  let packageLeaf = fileAndObject;
  const firstDot = fileAndObject.indexOf('.');
  const lastDot = fileAndObject.lastIndexOf('.');

  if (firstDot > 0) {
    const ext = fileAndObject.substring(lastDot).toLowerCase();
    const isImageExt = ext === '.png' || ext === '.webp' || ext === '.jpg' || ext === '.jpeg' || ext === '.svg';

    if (isImageExt) {
      packageLeaf = fileAndObject.substring(0, lastDot);
    } else {
      // If there are multiple dots, check if object suffix is appended:
      // e.g. "Item_v2.1.Item_v2.1" -> split at the matching boundary
      const halfLen = Math.floor(fileAndObject.length / 2);
      let matchedSplit = false;

      // Check if string is "A.A"
      for (let dotPos = 1; dotPos < fileAndObject.length; dotPos++) {
        if (fileAndObject[dotPos] === '.') {
          const left = fileAndObject.substring(0, dotPos);
          const right = fileAndObject.substring(dotPos + 1);
          if (left === right || right.startsWith(left)) {
            packageLeaf = left;
            matchedSplit = true;
            break;
          }
        }
      }

      if (!matchedSplit) {
        // Fallback: strip at last dot
        packageLeaf = fileAndObject.substring(0, lastDot);
      }
    }
  }

  clean = prefix + packageLeaf;

  let packagePath = clean;
  if (packagePath.startsWith('/Game/')) packagePath = 'Hotta/Content/' + packagePath.substring(6);
  else if (packagePath.startsWith('Game/')) packagePath = 'Hotta/Content/' + packagePath.substring(5);
  else if (packagePath.startsWith('/game/')) packagePath = 'Hotta/Content/' + packagePath.substring(6);
  else if (packagePath.startsWith('game/')) packagePath = 'Hotta/Content/' + packagePath.substring(5);
  else if (packagePath.startsWith('Hotta/Content/')) packagePath = packagePath;
  else if (packagePath.startsWith('hotta/content/')) packagePath = 'Hotta/Content/' + packagePath.substring('hotta/content/'.length);
  else if (packagePath.startsWith('/')) packagePath = packagePath.substring(1);

  // Final validation
  assertSafeAssetPath(packagePath);

  return packagePath;
}

/**
 * Converts a package path to a root-relative public canonical site URL.
 * Example:
 *   Hotta/Content/Resources/Icon/item -> /datamine/shared/media/Hotta/Content/Resources/Icon/item.webp
 */
function toCanonicalMediaUrl(packagePath, format = 'webp') {
  if (!packagePath) return '';
  const normalized = normalizeUnrealSoftReference(packagePath) || packagePath;
  assertSafeAssetPath(normalized);
  const clean = normalized.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(png|webp|jpg|jpeg|svg)$/i, '');
  return `${PUBLIC_MEDIA_ROOT}/${clean}.${format}`;
}

/**
 * Converts a package path to a relative public path within the datamine bundle.
 * Example:
 *   Hotta/Content/Resources/Icon/item -> shared/media/Hotta/Content/Resources/Icon/item.webp
 */
function toCanonicalPublicRelativePath(packagePath, format = 'webp') {
  if (!packagePath) return '';
  const normalized = normalizeUnrealSoftReference(packagePath) || packagePath;
  assertSafeAssetPath(normalized);
  const clean = normalized.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(png|webp|jpg|jpeg|svg)$/i, '');
  return `shared/media/${clean}.${format}`;
}

/**
 * Returns the absolute or relative disk path under target root for saving media.
 */
function toCanonicalDiskPath(targetRootDir, packagePath, format = 'webp') {
  if (!packagePath) return '';
  const normalized = normalizeUnrealSoftReference(packagePath) || packagePath;
  assertSafeAssetPath(normalized);
  const clean = normalized.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(png|webp|jpg|jpeg|svg)$/i, '');
  return path.join(targetRootDir, 'datamine', 'shared', 'media', ...clean.split('/')) + `.${format}`;
}

/**
 * Computes SHA-256 of a buffer or file path for metadata integrity.
 */
function sha256Hex(input) {
  if (Buffer.isBuffer(input)) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
  if (typeof input === 'string' && fs.existsSync(input)) {
    return crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');
  }
  return '';
}

function isLegacyContentAddressedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /ca_[0-9a-f]{8}_/i.test(url);
}

function isCanonicalMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/datamine/shared/media/Hotta/Content/') && !isLegacyContentAddressedUrl(url);
}

/**
 * CanonicalMediaManifest
 *
 * Collects, validates, deduplicates by exact package path, tracks collisions,
 * and serializes deterministic, versioned media manifests.
 */
class CanonicalMediaManifest {
  declare schemaVersion: any;
  declare clientVersion: any;
  declare generationId: any;
  declare entries: Map<string, any>;
  declare collisionReports: any;

  constructor(options: Record<string, any> = {}) {
    this.schemaVersion = options.schemaVersion || '1.0.0';
    this.clientVersion = options.clientVersion || '6.3.0';
    this.generationId = options.generationId || `gen_${Date.now()}`;
    this.entries = new Map<any, any>(); // exact normalizedPackagePath -> ManifestEntry
    this.collisionReports = [];
  }

  /**
   * Adds or enriches an asset entry in the manifest.
   * Enforces Global Rule R4:
   * - Distinct original paths always produce distinct entries.
   * - Same package path with different source bytes/hash throws a fatal collision error.
   */
  addEntry(record) {
    if (!record || !record.normalizedPackagePath) {
      throw new Error('Cannot add entry to manifest without normalizedPackagePath');
    }

    const pkgPath = record.normalizedPackagePath;
    assertSafeAssetPath(pkgPath);

    const publicUrl = record.publicUrl || toCanonicalMediaUrl(pkgPath, 'webp');
    const publicRelativePath = record.publicRelativePath || toCanonicalPublicRelativePath(pkgPath, 'webp');

    const provenanceRef = {
      sourceFile: record.sourceFile || '',
      rowId: record.rowId || '',
      property: record.property || '',
      edition: record.edition || 'base',
      entityKind: record.entityKind || '',
      entityId: record.entityId || '',
      mediaRole: record.mediaRole || '',
      consumer: record.consumer || '',
      resolutionStatus: record.resolutionStatus || 'RESOLVED'
    };

    if (this.entries.has(pkgPath)) {
      const existing = this.entries.get(pkgPath);

      // Check for byte / hash collision on identical canonical path
      if (
        record.sourcePngHash &&
        existing.sourcePngHash &&
        record.sourcePngHash !== existing.sourcePngHash
      ) {
        const collisionErr = {
          type: 'FATAL_CANONICAL_PATH_CONTENT_COLLISION',
          packagePath: pkgPath,
          existingHash: existing.sourcePngHash,
          incomingHash: record.sourcePngHash,
          existingProvenance: existing.provenanceReferences,
          incomingProvenance: provenanceRef
        };
        this.collisionReports.push(collisionErr);
        throw new Error(
          `Fatal canonical path collision with conflicting bytes for '${pkgPath}': ` +
          `existing (${existing.sourcePngHash}) vs incoming (${record.sourcePngHash})`
        );
      }

      // Merge provenance references
      const provExists = existing.provenanceReferences.some(
        p => p.sourceFile === provenanceRef.sourceFile &&
             p.rowId === provenanceRef.rowId &&
             p.property === provenanceRef.property
      );
      if (!provExists) {
        existing.provenanceReferences.push(provenanceRef);
      }

      // Merge consumers
      if (record.consumer && !existing.consumers.includes(record.consumer)) {
        existing.consumers.push(record.consumer);
      }

      return existing;
    }

    const isFceBoss = isFceBossDownloadAsset(pkgPath) || record.mediaRole === 'fce_boss_download';
    const displayWebpUrl = record.displayWebpUrl || toCanonicalMediaUrl(pkgPath, 'webp');
    const downloadPngUrl = isFceBoss ? (record.downloadPngUrl || toCanonicalMediaUrl(pkgPath, 'png')) : null;
    const downloadPngPath = isFceBoss ? (record.downloadPngPath || toCanonicalPublicRelativePath(pkgPath, 'png')) : null;

    const entry = {
      sourceAssetRef: record.sourceAssetRef || '',
      normalizedPackagePath: pkgPath,
      publicUrl,
      publicRelativePath,
      displayWebpUrl,
      downloadPngUrl,
      downloadPngPath,
      rawExportPath: record.rawExportPath || `${pkgPath}.png`,
      fcePngDownloadUrl: downloadPngUrl || record.fcePngDownloadUrl || null,
      fcePngDownloadPath: downloadPngPath || record.fcePngDownloadPath || null,
      entityKind: record.entityKind || '',
      entityId: record.entityId || '',
      mediaRole: record.mediaRole || '',
      resolutionStrategy: record.resolutionStrategy || 'exact_game_path',
      resolutionStatus: record.resolutionStatus || 'RESOLVED',
      width: record.width || null,
      height: record.height || null,
      sourcePngBytes: record.sourcePngBytes || null,
      sourcePngHash: record.sourcePngHash || '',
      webpBytes: record.webpBytes || null,
      webpHash: record.webpHash || '',
      conversionSettings: record.conversionSettings || { mode: 'lossless', quality: 100 },
      isGenerated: record.isGenerated !== undefined ? record.isGenerated : true,
      isCurated: record.isCurated !== undefined ? record.isCurated : false,
      consumers: record.consumer ? [record.consumer] : [],
      provenanceReferences: [provenanceRef]
    };

    this.entries.set(pkgPath, entry);
    return entry;
  }

  getEntry(packagePath) {
    return this.entries.get(packagePath) || null;
  }

  hasEntry(packagePath) {
    return this.entries.has(packagePath);
  }

  get size() {
    return this.entries.size;
  }

  /**
   * Deterministically serializes manifest to JSON with sorted keys and entries.
   */
  toJSON() {
    const sortedKeys = Array.from(this.entries.keys()).sort();
    const assets: Record<string, any> = {};
    for (const key of sortedKeys) {
      assets[key] = this.entries.get(key);
    }

    return {
      schemaVersion: this.schemaVersion,
      clientVersion: this.clientVersion,
      generationId: this.generationId,
      generatedAt: new Date().toISOString(),
      totalMediaAssets: this.entries.size,
      totalCollisions: this.collisionReports.length,
      collisionReports: this.collisionReports,
      assets
    };
  }

  saveToFile(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const content = JSON.stringify(this.toJSON(), null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }
}

function isFceBossDownloadAsset(relPackagePath) {
  if (!relPackagePath || typeof relPackagePath !== 'string') return false;
  const lower = relPackagePath.replace(/\\/g, '/').toLowerCase();
  const leaf = lower.split('/').pop().replace(/\.(png|webp)$/i, '');
  return (lower.includes('/void/boss/') && leaf.startsWith('bigboss')) ||
    lower.includes('/fb/bigmon/') ||
    lower.includes('/worldbosslist/boss/');
}

export {
  PUBLIC_MEDIA_ROOT,
  assertSafeAssetPath,
  extractAssetPathName,
  normalizeUnrealSoftReference,
  toCanonicalMediaUrl,
  toCanonicalPublicRelativePath,
  toCanonicalDiskPath,
  sha256Hex,
  isLegacyContentAddressedUrl,
  isCanonicalMediaUrl,
  isFceBossDownloadAsset,
  CanonicalMediaManifest,
};

