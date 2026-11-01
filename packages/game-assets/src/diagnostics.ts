import type { AssetDiagnostic, AssetDiagnosticCode, AssetDiagnosticListener } from './types';
import { getGameAssetConfig } from './config';

/**
 * Error thrown when an asset path is invalid/missing and throwOnError is enabled.
 */
export class AssetResolutionError extends Error {
  readonly code: AssetDiagnosticCode;
  readonly inputPath?: unknown;

  constructor(message: string, code: AssetDiagnosticCode, inputPath?: unknown) {
    super(message);
    this.name = 'AssetResolutionError';
    this.code = code;
    this.inputPath = inputPath;
  }
}

const MAX_RECENT_DIAGNOSTICS = 200;
const recentDiagnostics: AssetDiagnostic[] = [];
const listeners: Set<AssetDiagnosticListener> = new Set();

/**
 * Creates an AssetDiagnostic record.
 */
export function createDiagnostic(
  code: AssetDiagnosticCode,
  message: string,
  extra: {
    inputPath?: unknown;
    format?: string;
    resolvedUrl?: string;
    fallbackUrl?: string | null;
  } = {}
): AssetDiagnostic {
  return {
    code,
    message,
    inputPath: extra.inputPath,
    format: extra.format,
    resolvedUrl: extra.resolvedUrl,
    fallbackUrl: extra.fallbackUrl,
    timestamp: Date.now(),
  };
}

/**
 * Emits an asset diagnostic event, recording it in history, alerting listeners,
 * and logging dev warnings when appropriate.
 */
export function emitDiagnostic(diagnostic: AssetDiagnostic, silent = false): void {
  recentDiagnostics.push(diagnostic);
  if (recentDiagnostics.length > MAX_RECENT_DIAGNOSTICS) {
    recentDiagnostics.shift();
  }

  for (const listener of listeners) {
    try {
      listener(diagnostic);
    } catch {
      // Diagnostic listeners must not disrupt execution
    }
  }

  const config = getGameAssetConfig();
  if (!silent && config.devDiagnostics) {
    const prefix = `[game-assets] [${diagnostic.code}]`;
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`${prefix} ${diagnostic.message}`);
    }
  }
}

/**
 * Subscribes a listener to asset resolution diagnostics.
 * Returns an unsubscribe callback.
 */
export function addDiagnosticListener(listener: AssetDiagnosticListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns recent diagnostic records.
 */
export function getRecentDiagnostics(): AssetDiagnostic[] {
  return [...recentDiagnostics];
}

/**
 * Clears the in-memory diagnostic history.
 */
export function clearRecentDiagnostics(): void {
  recentDiagnostics.length = 0;
}

// ---------------------------------------------------------------------------
// Manifest validation registry
// ---------------------------------------------------------------------------

const knownAssetPaths: Set<string> = new Set();
let manifestRegistered = false;

function normalizeKnownAssetKey(key: string): string {
  let k = key.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const lastDot = k.lastIndexOf('.');
  if (lastDot !== -1) {
    k = k.slice(0, lastDot);
  }
  return k.toLowerCase();
}

/**
 * Registers a known asset manifest (e.g. from shared-media-manifest.json or master-image-audit.json)
 * to enable dev-time detection of missing assets.
 */
export function registerAssetManifest(manifest: Record<string, unknown> | Iterable<string>): void {
  knownAssetPaths.clear();
  manifestRegistered = true;

  if (manifest && typeof manifest === 'object') {
    if (Symbol.iterator in manifest) {
      for (const item of manifest as Iterable<string>) {
        if (typeof item === 'string') {
          knownAssetPaths.add(normalizeKnownAssetKey(item));
        }
      }
    } else {
      const obj = manifest as Record<string, unknown>;
      const dict = (obj.assets && typeof obj.assets === 'object' ? obj.assets : obj) as Record<string, unknown>;
      for (const key of Object.keys(dict)) {
        knownAssetPaths.add(normalizeKnownAssetKey(key));
      }
    }
  }
}

/**
 * Unregisters the currently active asset manifest.
 */
export function unregisterAssetManifest(): void {
  knownAssetPaths.clear();
  manifestRegistered = false;
}

/**
 * Checks if an asset manifest is currently registered.
 */
export function hasRegisteredAssetManifest(): boolean {
  return manifestRegistered;
}

/**
 * Checks whether a normalized relative path exists in the registered manifest.
 * Always returns true if no manifest is registered.
 */
export function isAssetInManifest(normalizedPath: string): boolean {
  if (!manifestRegistered) return true;
  return knownAssetPaths.has(normalizeKnownAssetKey(normalizedPath));
}
