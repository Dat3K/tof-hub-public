/**
 * Supported game asset delivery formats.
 * 'webp' is the default delivery format for website presentation.
 * 'png' is the lossless/original format for transparency or high-fidelity fallback.
 */
export type GameAssetFormat = 'webp' | 'png';

/**
 * Diagnostic codes emitted during asset path normalization and resolution.
 */
export type AssetDiagnosticCode =
  | 'MISSING_PATH'
  | 'INVALID_PATH'
  | 'FALLBACK_USED'
  | 'LEGACY_PATH_MIGRATED'
  | 'UNSUPPORTED_FORMAT'
  | 'ASSET_NOT_FOUND';

/**
 * Diagnostic record capturing non-silent resolution events and issues.
 */
export interface AssetDiagnostic {
  code: AssetDiagnosticCode;
  message: string;
  inputPath?: unknown;
  format?: string;
  resolvedUrl?: string;
  fallbackUrl?: string | null;
  timestamp: number;
}

/**
 * Callback listener for diagnostics.
 */
export type AssetDiagnosticListener = (diagnostic: AssetDiagnostic) => void;

/**
 * Configuration options for asset resolution.
 */
export interface GameAssetOptions {
  /**
   * The asset path or identifier.
   * Accepts:
   * - In-game relative path: 'Hotta/Content/Resources/UI/wuqi/icon_element_huo'
   * - Legacy datamine URL: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp'
   * - Engine asset reference: '/Game/Resources/UI/Artifact/itemicon/artifact_ssr_001.artifact_ssr_001'
   * - Pre-resolved asset URL: '/game-assets/webp/Hotta/Content/...'
   */
  path: string;

  /**
   * Target delivery format. Defaults to 'webp'.
   */
  format?: GameAssetFormat;

  /**
   * Base URL prefix for game assets. Defaults to '/game-assets'
   * (or process.env.GAME_ASSET_BASE_URL if set).
   */
  baseUrl?: string;

  /**
   * Controlled fallback path/URL to use if the asset path is missing or invalid.
   * If not provided and path is missing/invalid, uses the default placeholder URL.
   * If explicitly set to null, suppresses the placeholder and returns empty string.
   */
  fallback?: string | null;

  /**
   * If true, throws an AssetResolutionError instead of returning fallback on error.
   * Defaults to false.
   */
  throwOnError?: boolean;

  /**
   * If true, suppresses emitting diagnostic warnings for this resolution.
   * Defaults to false.
   */
  silent?: boolean;
}

/**
 * Complete resolution result including URLs, paths, and diagnostics.
 */
export interface ResolvedGameAsset {
  /** The final resolved public URL (e.g. '/game-assets/webp/Hotta/Content/...webp') */
  url: string;
  /** Normalized in-game relative path without format extension (e.g. 'Hotta/Content/Resources/UI/wuqi/icon_element_huo') */
  normalizedPath: string;
  /** In-game relative path with format extension (e.g. 'Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp') */
  fileRelativePath: string;
  /** The delivery format used ('webp' | 'png') */
  format: GameAssetFormat;
  /** Whether a fallback URL was used */
  isFallback: boolean;
  /** Diagnostics emitted during this resolution */
  diagnostics: AssetDiagnostic[];
}

/**
 * Sources object for HTML picture elements or dual-format rendering.
 */
export interface GameAssetSources {
  /** WebP delivery URL (default website format) */
  webp: string;
  /** PNG fallback URL (lossless/original format) */
  png: string;
  /** Default delivery URL (equivalent to webp by default) */
  defaultUrl: string;
  /** Whether this asset resolved to fallback */
  isFallback: boolean;
}

/**
 * Global configuration options for @tof-hub/game-assets.
 */
export interface GameAssetConfig {
  baseUrl: string;
  defaultFormat: GameAssetFormat;
  placeholderUrl: string;
  devDiagnostics: boolean;
}
