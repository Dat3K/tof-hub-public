import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectArchiveEntries, writeZipArchive, type ArchiveEntry } from './archive';

/**
 * Release archive for the web project: entries are named `apps/web/public/...`, so
 * extracting the ZIP into the repository root with "replace" updates the site.
 * `tof-update-manifest.json` (archive root) lists every published file with its
 * SHA-256. Given the manifest of what the project already has, only changed files
 * are packed and removed ones are listed under `deleted`.
 */

export const ARCHIVE_PREFIX = 'apps/web/public/';
export const MANIFEST_NAME = 'tof-update-manifest.json';

export interface FileRecord {
  readonly size: number;
  readonly sha256: string;
}

export interface UpdateManifest {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly gameVersion: string | null;
  readonly kind: 'full' | 'delta';
  /** Every file of the release, relative to apps/web/public. */
  readonly files: Record<string, FileRecord>;
  /** Delta only: files present in the baseline but not in this release. */
  readonly deleted: string[];
  readonly packed: number;
}

export interface ReleasePackageOptions {
  readonly publicDir: string;
  /** ZIP file, or the release folder when `format` is `directory`. */
  readonly outFile: string;
  /** `directory` writes the same entries unpacked, with the manifest at the folder root. */
  readonly format?: 'zip' | 'directory';
  /** Optional maintainer reports included in the ZIP but excluded from the site update manifest. */
  readonly additionalEntries?: readonly ArchiveEntry[];
  /** Manifest of the target project (or a previous release) to build a delta against. */
  readonly baseline?: Pick<UpdateManifest, 'files'> | null;
  readonly gameVersion?: string | null;
  readonly jobs?: number;
  readonly onHashProgress?: (completed: number, total: number) => void;
  readonly onProgress?: (completed: number, total: number) => void;
}

export interface ReleasePackageResult {
  readonly archive: string;
  readonly manifestFile: string;
  readonly manifest: UpdateManifest;
  readonly bytes: number;
  readonly durationMs: number;
}

async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** Hashes a public tree with bounded parallelism. */
export async function hashTree(root: string, jobs = os.availableParallelism?.() ?? os.cpus().length, onProgress?: (completed: number, total: number) => void): Promise<Record<string, FileRecord>> {
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error('--jobs must be a positive integer.');
  const entries = collectArchiveEntries(root);
  const files: Record<string, FileRecord> = {};
  let next = 0;
  let completed = 0;
  onProgress?.(0, entries.length);
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(jobs * 2, entries.length)) }, async () => {
      while (next < entries.length) {
        const entry = entries[next++];
        files[entry.name] = { size: fs.statSync(entry.source).size, sha256: await sha256(entry.source) };
        onProgress?.(++completed, entries.length);
      }
    })
  );
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

export async function buildReleasePackage(options: ReleasePackageOptions): Promise<ReleasePackageResult> {
  const startedAt = Date.now();
  const files = await hashTree(options.publicDir, options.jobs, options.onHashProgress);
  const baseline = options.baseline?.files ?? null;
  const changed = Object.keys(files).filter((name) => !baseline || baseline[name]?.sha256 !== files[name].sha256);
  const deleted = baseline ? Object.keys(baseline).filter((name) => !(name in files)).sort() : [];
  const manifest: UpdateManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gameVersion: options.gameVersion ?? null,
    kind: baseline ? 'delta' : 'full',
    files,
    deleted,
    packed: changed.length,
  };
  const directory = options.format === 'directory';
  if (directory) fs.rmSync(options.outFile, { recursive: true, force: true });
  const manifestFile = path.join(directory ? options.outFile : path.dirname(options.outFile), MANIFEST_NAME);
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  const entries: ArchiveEntry[] = [
    ...(directory ? [] : [{ source: manifestFile, name: MANIFEST_NAME }]),
    ...changed.map((name) => ({ source: path.join(options.publicDir, ...name.split('/')), name: ARCHIVE_PREFIX + name })),
    ...(options.additionalEntries ?? []),
  ];
  const bytes = directory
    ? await writeReleaseDirectory(options.outFile, entries, options.jobs, options.onProgress)
    : (await writeZipArchive(options.outFile, entries, { jobs: options.jobs, onProgress: options.onProgress })).bytesOut;
  return { archive: options.outFile, manifestFile, manifest, bytes: bytes + fs.statSync(manifestFile).size, durationMs: Date.now() - startedAt };
}

/** Copies archive entries into a folder laid out like the extracted ZIP; returns the bytes written. */
async function writeReleaseDirectory(
  outDir: string,
  entries: readonly ArchiveEntry[],
  jobs = os.availableParallelism?.() ?? os.cpus().length,
  onProgress?: (completed: number, total: number) => void,
): Promise<number> {
  const root = path.resolve(outDir);
  let next = 0;
  let completed = 0;
  let bytes = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(jobs * 2, entries.length)) }, async () => {
      while (next < entries.length) {
        const entry = entries[next++];
        const target = path.resolve(root, ...entry.name.split('/'));
        if (!target.startsWith(root + path.sep)) throw new Error(`Release entry escapes the output folder: ${entry.name}`);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        // A real copy: later pipeline runs rewrite public files in place and must not change a written release.
        await fs.promises.copyFile(entry.source, target);
        bytes += (await fs.promises.stat(target)).size;
        onProgress?.(++completed, entries.length);
      }
    })
  );
  return bytes;
}

/** Reads a baseline: a release manifest, or a public directory to hash. */
export async function loadBaseline(source: string | undefined): Promise<Pick<UpdateManifest, 'files'> | null> {
  if (!source) return null;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) return { files: await hashTree(source) };
  const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (!parsed?.files || typeof parsed.files !== 'object') throw new Error(`${source} is not a ${MANIFEST_NAME}.`);
  return { files: parsed.files };
}
