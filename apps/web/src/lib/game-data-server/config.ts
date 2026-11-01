import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves the root directory containing mutable game-data JSON files.
 *
 * Priority:
 * 1. GAME_DATA_ROOT environment variable (production mounted external data-root)
 * 2. DATA_ROOT environment variable (legacy/fallback)
 * 3. Local generated public directory: apps/web/public/game-data or public/game-data
 */
export function getServerGameDataRoot(customRoot?: string): string {
  if (customRoot && customRoot.trim()) {
    return path.resolve(customRoot);
  }

  const envRoot = process.env.GAME_DATA_ROOT || process.env.DATA_ROOT;
  if (envRoot && envRoot.trim()) {
    return path.resolve(envRoot.trim());
  }

  // Fallback for local development inside monorepo
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'apps', 'web', 'public', 'game-data'),
    path.join(cwd, 'public', 'game-data'),
    path.resolve(__dirname, '..', '..', '..', 'public', 'game-data'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }

  // Default to standard local web public path
  return candidates[0];
}

/**
 * Validates that candidate target path does not escape the configured data root (path traversal guard).
 */
export function assertPathWithinRoot(candidatePath: string, rootDir: string): string {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(candidatePath);

  const normalizedRoot = resolvedRoot.replace(/\\/g, '/').toLowerCase();
  const normalizedTarget = resolvedTarget.replace(/\\/g, '/').toLowerCase();

  if (
    normalizedTarget !== normalizedRoot &&
    !normalizedTarget.startsWith(normalizedRoot.endsWith('/') ? normalizedRoot : `${normalizedRoot}/`)
  ) {
    throw new Error(
      `Security violation: Attempted path traversal outside data-root. Target "${candidatePath}" is not inside root "${rootDir}".`
    );
  }

  return resolvedTarget;
}

/**
 * Resolves absolute filesystem path for a localized dataset file.
 * Format: <data-root>/<locale>/<dataset>.json
 */
export function resolveServerDatasetPath(
  locale: string,
  dataset: string,
  customRoot?: string
): string {
  const root = getServerGameDataRoot(customRoot);
  const cleanLocale = locale.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanDataset = dataset.trim().replace(/\.json$/, '');
  if (!cleanDataset.split('/').every(segment => /^[a-zA-Z0-9_-]+$/.test(segment))) {
    throw new Error('Invalid game dataset path');
  }

  const candidate = path.join(root, cleanLocale, `${cleanDataset}.json`);
  return assertPathWithinRoot(candidate, root);
}

/**
 * Resolves absolute filesystem path for the release-manifest.json.
 * Format: <data-root>/release-manifest.json
 */
export function resolveServerManifestPath(customRoot?: string): string {
  const root = getServerGameDataRoot(customRoot);
  const candidate = path.join(root, 'release-manifest.json');
  return assertPathWithinRoot(candidate, root);
}

/**
 * Resolves absolute filesystem path for a changelog baseline file.
 * Format: <data-root>/changelog/<filename>.json
 */
export function resolveServerChangelogPath(
  filename: string,
  customRoot?: string
): string {
  const root = getServerGameDataRoot(customRoot);
  const cleanName = filename.trim().replace(/\.json$/, '').replace(/[^a-zA-Z0-9_-]/g, '');
  const candidate = path.join(root, 'changelog', `${cleanName}.json`);
  return assertPathWithinRoot(candidate, root);
}
