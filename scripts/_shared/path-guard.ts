import fs from 'node:fs';
import path from 'node:path';
import { getRawGameSourceDir, normalizePlatformPath } from './env';

/**
 * Error thrown whenever a pipeline script attempts an unauthorized write
 * or output operation targeting or inside the raw game source directory tree.
 */
export class RawSourceViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RawSourceViolationError';
  }
}

/**
 * Normalizes a path into a canonical uniform representation:
 * - Replaces backslashes with forward slashes.
 * - Resolves redundant segments (. / ..).
 * - Capitalizes Windows drive letters (e.g. C:/...).
 * - Removes trailing slash (unless root).
 */
export function normalizePathStandard(p: string): string {
  let normalized = p.replace(/\\/g, '/');
  normalized = path.posix.normalize(normalized);

  if (process.platform === 'win32' || /^[a-zA-Z]:/.test(normalized)) {
    if (/^[a-zA-Z]:/.test(normalized)) {
      normalized = normalized[0].toUpperCase() + normalized.slice(1);
    }
  }

  if (normalized.length > 1 && normalized.endsWith('/') && !normalized.match(/^[a-zA-Z]:\/$/)) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Canonicalizes a target filesystem path:
 * 1. Handles WSL <-> Windows cross-platform translations.
 * 2. Resolves path to absolute.
 * 3. Resolves symlinks and NTFS directory junctions to their real canonical target.
 * 4. For non-existent files/directories, resolves symlinks/junctions of the deepest
 *    existing ancestor directory, then rejoins remaining non-existent segments.
 */
export function canonicalizePath(targetPath: string): string {
  if (!targetPath || !targetPath.trim()) {
    throw new Error('Path cannot be empty');
  }

  const normalized = normalizePlatformPath(targetPath);
  const resolved = path.resolve(normalized);

  // If path exists on disk, resolve realpath directly (resolves symlinks and NTFS junctions)
  if (fs.existsSync(resolved)) {
    try {
      const real = fs.realpathSync.native(resolved);
      return normalizePathStandard(real);
    } catch {
      return normalizePathStandard(fs.realpathSync(resolved));
    }
  }

  // If path does not exist yet, climb up to find deepest existing ancestor to resolve junctions
  let current = resolved;
  const segments: string[] = [];

  while (current && !fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    segments.unshift(path.basename(current));
    current = parent;
  }

  if (fs.existsSync(current)) {
    let realAncestor: string;
    try {
      realAncestor = fs.realpathSync.native(current);
    } catch {
      realAncestor = fs.realpathSync(current);
    }
    const finalPath = segments.length > 0 ? path.join(realAncestor, ...segments) : realAncestor;
    return normalizePathStandard(finalPath);
  }

  return normalizePathStandard(resolved);
}

/**
 * Checks whether `candidatePath` is identical to or contained inside `parentDir`.
 * Resolves both paths canonically and performs case-insensitive comparison on Windows.
 */
export function isPathInside(parentDir: string, candidatePath: string): boolean {
  const canonicalParent = canonicalizePath(parentDir);
  const canonicalCandidate = canonicalizePath(candidatePath);

  const isWindows = process.platform === 'win32';
  const parentToCompare = isWindows ? canonicalParent.toLowerCase() : canonicalParent;
  const candidateToCompare = isWindows ? canonicalCandidate.toLowerCase() : canonicalCandidate;

  if (candidateToCompare === parentToCompare) {
    return true;
  }

  // Cross-drive check on Windows
  if (parentToCompare.length >= 2 && candidateToCompare.length >= 2) {
    if (parentToCompare[1] === ':' && candidateToCompare[1] === ':') {
      if (parentToCompare[0] !== candidateToCompare[0]) {
        return false;
      }
    }
  }

  const rel = path.posix.relative(parentToCompare, candidateToCompare);
  return !rel.startsWith('..') && !path.posix.isAbsolute(rel);
}

/**
 * Asserts that an output root directory is strictly outside the raw game source directory.
 * Throws RawSourceViolationError if output root is inside raw source, identical to raw source,
 * or an ancestor of raw source.
 */
export function assertSafeOutputRoot(outputRoot: string, rawSourceDir?: string): string {
  const source = rawSourceDir || getRawGameSourceDir();
  const canonicalOutput = canonicalizePath(outputRoot);
  const canonicalRaw = canonicalizePath(source);

  if (isPathInside(canonicalRaw, canonicalOutput)) {
    throw new RawSourceViolationError(
      `Safety violation: Output root "${outputRoot}" (canonical: "${canonicalOutput}") is located inside raw game source directory "${source}" (canonical: "${canonicalRaw}"). Output directories must be strictly outside the raw game source tree.`
    );
  }

  if (isPathInside(canonicalOutput, canonicalRaw)) {
    throw new RawSourceViolationError(
      `Safety violation: Output root "${outputRoot}" (canonical: "${canonicalOutput}") is an ancestor of raw game source directory "${source}" (canonical: "${canonicalRaw}"). Raw source directory cannot be contained within an output root.`
    );
  }

  return canonicalOutput;
}

/**
 * Asserts that a target write path is NOT inside or equal to the raw game source directory.
 * Throws RawSourceViolationError before any filesystem write is initiated.
 */
export function assertSafeOutputPath(targetPath: string, rawSourceDir?: string): string {
  const source = rawSourceDir || getRawGameSourceDir();
  const canonicalTarget = canonicalizePath(targetPath);
  const canonicalRaw = canonicalizePath(source);

  if (isPathInside(canonicalRaw, canonicalTarget)) {
    throw new RawSourceViolationError(
      `Safety violation: Attempted write operation to "${targetPath}" (canonical: "${canonicalTarget}"), which is located inside protected raw game source directory "${source}" (canonical: "${canonicalRaw}"). The raw game source is strictly read-only; writes are prohibited.`
    );
  }

  return canonicalTarget;
}

/**
 * Safe Path Guard instance providing guarded write helpers and boundary assertions
 * for pipeline processing scripts.
 */
export class PathGuard {
  readonly rawSourceDir: string;
  readonly canonicalRawSourceDir: string;
  readonly allowedOutputRoots: string[];

  constructor(rawSourceDir?: string, allowedOutputRoots: string[] = []) {
    this.rawSourceDir = rawSourceDir || getRawGameSourceDir();
    this.canonicalRawSourceDir = canonicalizePath(this.rawSourceDir);
    this.allowedOutputRoots = allowedOutputRoots.map((root) =>
      assertSafeOutputRoot(root, this.canonicalRawSourceDir)
    );
  }

  /**
   * Asserts that a candidate output path is outside the raw game source directory.
   */
  assertSafeOutput(targetPath: string): string {
    return assertSafeOutputPath(targetPath, this.canonicalRawSourceDir);
  }

  /**
   * Asserts that an output root is strictly outside the raw game source directory.
   */
  assertSafeOutputRoot(outputRoot: string): string {
    return assertSafeOutputRoot(outputRoot, this.canonicalRawSourceDir);
  }

  /**
   * Checks if candidate path resides within the raw game source directory.
   */
  isInsideRawSource(targetPath: string): boolean {
    return isPathInside(this.canonicalRawSourceDir, targetPath);
  }

  /**
   * Guarded synchronous file write.
   * Validates target path is outside raw game source before writing to disk.
   */
  safeWriteFileSync(
    targetPath: string,
    data: string | NodeJS.ArrayBufferView,
    options?: fs.WriteFileOptions
  ): void {
    this.assertSafeOutput(targetPath);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      this.safeMkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, data, options);
  }

  /**
   * Guarded synchronous JSON write.
   * Validates target path is outside raw game source before serializing and writing.
   */
  safeWriteJsonSync(
    targetPath: string,
    data: unknown,
    options?: { space?: number }
  ): void {
    const space = options?.space ?? 2;
    const json = JSON.stringify(data, null, space) + '\n';
    this.safeWriteFileSync(targetPath, json, 'utf8');
  }

  /**
   * Guarded directory creation.
   * Validates target directory path is outside raw game source before directory creation.
   */
  safeMkdirSync(
    dirPath: string,
    options?: fs.MakeDirectoryOptions
  ): string | undefined {
    this.assertSafeOutput(dirPath);
    return fs.mkdirSync(dirPath, options);
  }

  /**
   * Guarded file copy.
   * Validates destination path is outside raw game source before copying.
   */
  safeCopyFileSync(src: string, dest: string, mode?: number): void {
    this.assertSafeOutput(dest);
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      this.safeMkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest, mode);
  }

  /**
   * Guarded file/directory deletion.
   * Validates target path is outside raw game source before deletion.
   */
  safeRmSync(targetPath: string, options?: fs.RmOptions): void {
    this.assertSafeOutput(targetPath);
    fs.rmSync(targetPath, options);
  }
}

/**
 * Factory creating a PathGuard instance.
 */
export function createPathGuard(
  rawSourceDir?: string,
  allowedOutputRoots: string[] = []
): PathGuard {
  return new PathGuard(rawSourceDir, allowedOutputRoots);
}
