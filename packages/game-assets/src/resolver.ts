import type {
  GameAssetFormat,
  GameAssetOptions,
  ResolvedGameAsset,
  GameAssetSources,
  AssetDiagnostic,
} from './types';
import { getGameAssetConfig } from './config';
import { normalizeAssetPath } from './normalize';
import {
  AssetResolutionError,
  createDiagnostic,
  emitDiagnostic,
  hasRegisteredAssetManifest,
  isAssetInManifest,
} from './diagnostics';

function parseInput(
  input: GameAssetOptions | string,
  formatOverride?: GameAssetFormat
): GameAssetOptions {
  if (typeof input === 'string') {
    return {
      path: input,
      format: formatOverride,
    };
  }
  if (formatOverride && !input.format) {
    return {
      ...input,
      format: formatOverride,
    };
  }
  return input;
}

/**
 * Resolves a game asset with full inspection details, controlled fallbacks, and dev diagnostics.
 */
export function resolveGameAsset(
  input: GameAssetOptions | string,
  formatOverride?: GameAssetFormat
): ResolvedGameAsset {
  const options = parseInput(input, formatOverride);
  const config = getGameAssetConfig();
  const format: GameAssetFormat = options.format || config.defaultFormat;
  const baseUrl = (options.baseUrl !== undefined ? options.baseUrl : config.baseUrl).replace(/\/+$/, '');
  const silent = Boolean(options.silent);
  const diagnostics: AssetDiagnostic[] = [];

  // Validate format
  if (format !== 'webp' && format !== 'png') {
    const diag = createDiagnostic(
      'UNSUPPORTED_FORMAT',
      `Unsupported format '${format}' requested; falling back to '${config.defaultFormat}'.`,
      { inputPath: options.path, format }
    );
    diagnostics.push(diag);
    emitDiagnostic(diag, silent);
  }

  const effectiveFormat: GameAssetFormat = format === 'png' ? 'png' : 'webp';

  // Normalize path
  const norm = normalizeAssetPath(options.path);

  if (norm.error || !norm.normalizedPath) {
    const isMissing = !options.path || typeof options.path !== 'string' || !options.path.trim();
    const code = isMissing ? 'MISSING_PATH' : 'INVALID_PATH';
    const message = norm.error || 'Invalid asset path';

    if (options.throwOnError) {
      throw new AssetResolutionError(message, code, options.path);
    }

    // Determine fallback URL
    const fallbackUrl =
      options.fallback !== undefined
        ? options.fallback === null
          ? ''
          : options.fallback
        : config.placeholderUrl;

    const errorDiag = createDiagnostic(code, message, {
      inputPath: options.path,
      format: effectiveFormat,
      fallbackUrl,
    });
    diagnostics.push(errorDiag);
    emitDiagnostic(errorDiag, silent);

    const fallbackDiag = createDiagnostic(
      'FALLBACK_USED',
      `Controlled fallback applied for ${code.toLowerCase()} asset path. Returning: '${fallbackUrl}'`,
      {
        inputPath: options.path,
        format: effectiveFormat,
        fallbackUrl,
        resolvedUrl: fallbackUrl,
      }
    );
    diagnostics.push(fallbackDiag);
    emitDiagnostic(fallbackDiag, silent);

    return {
      url: fallbackUrl,
      normalizedPath: '',
      fileRelativePath: '',
      format: effectiveFormat,
      isFallback: true,
      diagnostics,
    };
  }

  // Path is valid
  const normalizedPath = norm.normalizedPath;
  const fileRelativePath = `${normalizedPath}.${effectiveFormat}`;
  const url = `${baseUrl}/${effectiveFormat}/${fileRelativePath}`;

  if (norm.isLegacyMigrated) {
    const legacyDiag = createDiagnostic(
      'LEGACY_PATH_MIGRATED',
      `Migrated legacy asset path '${options.path}' -> '${normalizedPath}' (${norm.legacyType})`,
      {
        inputPath: options.path,
        format: effectiveFormat,
        resolvedUrl: url,
      }
    );
    diagnostics.push(legacyDiag);
    // Legacy paths are expected in exported game data and are normalized
    // successfully. Keep this diagnostic available to callers, but avoid
    // synchronous console output for every rendered asset in development.
    emitDiagnostic(legacyDiag, true);
  }

  // Check against registered manifest if present
  if (hasRegisteredAssetManifest() && !isAssetInManifest(normalizedPath)) {
    const missingDiag = createDiagnostic(
      'ASSET_NOT_FOUND',
      `Asset path '${normalizedPath}' was not found in the registered asset manifest.`,
      {
        inputPath: options.path,
        format: effectiveFormat,
        resolvedUrl: url,
      }
    );
    diagnostics.push(missingDiag);
    emitDiagnostic(missingDiag, silent);
  }

  return {
    url,
    normalizedPath,
    fileRelativePath,
    format: effectiveFormat,
    isFallback: false,
    diagnostics,
  };
}

/**
 * Resolves a game asset URL string.
 *
 * Usage examples:
 * ```ts
 * gameAsset({ path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo', format: 'webp' })
 * // -> '/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp'
 *
 * gameAsset({ path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo', format: 'png' })
 * // -> '/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_element_huo.png'
 *
 * gameAsset('Hotta/Content/Resources/UI/wuqi/icon_element_huo')
 * // -> '/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp'
 * ```
 */
export function gameAsset(
  input: GameAssetOptions | string,
  format?: GameAssetFormat
): string {
  return resolveGameAsset(input, format).url;
}

/**
 * Resolves both WebP and PNG URLs for an asset, suitable for `<picture>` sources.
 */
export function gameAssetSources(
  input: GameAssetOptions | string
): GameAssetSources {
  const options = parseInput(input);
  const webpRes = resolveGameAsset({ ...options, format: 'webp' });
  const pngRes = resolveGameAsset({ ...options, format: 'png' });

  return {
    webp: webpRes.url,
    png: pngRes.url,
    defaultUrl: webpRes.url,
    isFallback: webpRes.isFallback,
  };
}

/**
 * Convenience helper to resolve an asset specifically as PNG (lossless fallback).
 */
export function gameAssetPng(
  input: GameAssetOptions | string
): string {
  return gameAsset(input, 'png');
}

/**
 * Convenience helper to resolve an asset specifically as WebP (delivery default).
 */
export function gameAssetWebp(
  input: GameAssetOptions | string
): string {
  return gameAsset(input, 'webp');
}

/**
 * Checks if a string looks like an asset URL or valid asset path.
 */
export function isGameAsset(pathOrUrl: string): boolean {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;
  const norm = normalizeAssetPath(pathOrUrl);
  return Boolean(!norm.error && norm.normalizedPath);
}

/**
 * Strips the public prefix and format extension from an asset path or URL,
 * returning the canonical in-game relative path.
 */
export function stripAssetFormat(pathOrUrl: string): string {
  const norm = normalizeAssetPath(pathOrUrl);
  return norm.normalizedPath;
}
