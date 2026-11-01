import fs from 'node:fs';
import path from 'node:path';

let envLoaded = false;

/**
 * Finds the project root directory by searching upwards for monorepo markers.
 */
export function findProjectRoot(startDir: string = __dirname): string {
  let current = path.resolve(startDir);
  while (current) {
    if (
      fs.existsSync(path.join(current, 'pnpm-workspace.yaml')) ||
      (fs.existsSync(path.join(current, 'package.json')) &&
        !fs.existsSync(path.join(current, '..', 'pnpm-workspace.yaml')))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(__dirname, '../..');
}

/**
 * Parses simple .env file content without external dependencies.
 * Handles comments, empty lines, and single/double quoted strings.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();

    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }

    result[key] = val;
  }

  return result;
}

/**
 * Loads .env and .env.local from the project root into process.env.
 * .env.local takes precedence over .env.
 */
export function loadPipelineEnv(
  projectRoot?: string,
  forceReload = false,
): Record<string, string> {
  if (envLoaded && !forceReload) {
    return process.env as Record<string, string>;
  }

  const root = projectRoot || findProjectRoot();
  const envLocalPath = path.join(root, '.env.local');
  const envPath = path.join(root, '.env');

  const loadedVars: Record<string, string> = {};

  if (fs.existsSync(envPath)) {
    try {
      const baseParsed = parseEnvContent(fs.readFileSync(envPath, 'utf8'));
      Object.assign(loadedVars, baseParsed);
    } catch {
      // Ignore read errors
    }
  }

  if (fs.existsSync(envLocalPath)) {
    try {
      const localParsed = parseEnvContent(fs.readFileSync(envLocalPath, 'utf8'));
      Object.assign(loadedVars, localParsed);
    } catch {
      // Ignore read errors
    }
  }

  for (const [key, val] of Object.entries(loadedVars)) {
    if (process.env[key] === undefined || forceReload) {
      process.env[key] = val;
    }
  }

  envLoaded = true;
  return loadedVars;
}

/**
 * Normalizes cross-platform paths between Windows and WSL environments.
 * - On Windows (win32): Translates WSL paths like `/mnt/c/...` to `C:/...`.
 * - On Linux/WSL: Translates Windows paths like `C:/...` or `C:\...` to `/mnt/c/...`.
 */
export function normalizePlatformPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';

  if (process.platform === 'win32') {
    const wslMatch = trimmed.match(/^\/mnt\/([a-zA-Z])(\/.*)?$/);
    if (wslMatch) {
      const drive = wslMatch[1].toUpperCase();
      const rest = wslMatch[2] || '';
      return `${drive}:${rest}`;
    }
  } else {
    const winMatch = trimmed.match(/^([a-zA-Z]):[/\\](.*)?$/);
    if (winMatch) {
      const drive = winMatch[1].toLowerCase();
      const rest = (winMatch[2] || '').replace(/\\/g, '/');
      return `/mnt/${drive}/${rest}`;
    }
  }

  return trimmed;
}

/**
 * Retrieves the raw game exports directory from TOF_RAW_GAME_DIR environment variable.
 * Normalizes platform-specific WSL/Windows path representations.
 */
export function getRawGameSourceDir(
  options: {
    projectRoot?: string;
    required?: boolean;
    fallback?: string;
  } = {},
): string {
  const { projectRoot, required = true, fallback } = options;
  loadPipelineEnv(projectRoot);

  let rawDir = process.env.TOF_RAW_GAME_DIR;
  if (!rawDir || !rawDir.trim()) {
    rawDir = fallback;
  }

  if (!rawDir || !rawDir.trim()) {
    if (required) {
      throw new Error(
        'TOF_RAW_GAME_DIR is not configured. Set TOF_RAW_GAME_DIR in .env.local pointing to the raw game export directory (see .env.example).',
      );
    }
    return '';
  }

  return normalizePlatformPath(rawDir);
}

/**
 * Safe discovery check: returns normalized directory path if TOF_RAW_GAME_DIR is set and exists,
 * otherwise returns null without throwing.
 */
export function tryGetRawGameSourceDir(
  options: { projectRoot?: string } = {},
): string | null {
  try {
    const dir = getRawGameSourceDir({ ...options, required: false });
    if (dir && fs.existsSync(dir)) {
      return dir;
    }
    return null;
  } catch {
    return null;
  }
}
