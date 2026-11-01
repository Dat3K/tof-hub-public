import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Applies a tof-update-* release to this repository: a release folder (the exporter's default)
 * or a tof-update-*.zip (`--zip`). Its entries are apps/web/public/... plus maintainer reports at
 * tools/patch-exporter/pre-release/; public files listed under `deleted` are removed.
 *
 *   pnpm --filter @tof-hub/tof-exporter apply-update -- <tof-update-* folder or .zip>
 *
 * Copying the folder (or extracting the ZIP) by hand with "replace" works too; it only leaves deleted files behind.
 */
const repoRoot = path.resolve(__dirname, '../../..');
const release = process.argv[2];
if (!release || !fs.existsSync(release)) {
  console.error('Usage: apply-update <tof-update-* folder or .zip>');
  process.exit(1);
}

const fromFolder = fs.statSync(release).isDirectory();
let manifestPath: string;
if (fromFolder) {
  // The manifest stays in the release folder; everything else is copied over the repository root.
  manifestPath = path.join(path.resolve(release), 'tof-update-manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`${release} has no tof-update-manifest.json.`);
  for (const entry of fs.readdirSync(release, { withFileTypes: true })) {
    if (entry.name === 'tof-update-manifest.json') continue;
    fs.cpSync(path.join(release, entry.name), path.join(repoRoot, entry.name), { recursive: true, force: true });
  }
} else {
  // Windows 10+ ships bsdtar, which reads ZIP (including ZIP64).
  execFileSync('tar', ['-xf', path.resolve(release), '-C', repoRoot], { stdio: 'inherit' });
  manifestPath = path.join(repoRoot, 'tof-update-manifest.json');
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let removed = 0;
for (const name of manifest.deleted ?? []) {
  const file = path.join(repoRoot, 'apps', 'web', 'public', ...String(name).split('/'));
  if (!file.startsWith(path.join(repoRoot, 'apps', 'web', 'public'))) continue;
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    removed++;
  }
}
// Keep generated update metadata with the local deployment output, not in the workspace root.
const localDeploy = path.join(repoRoot, 'local-deploy');
fs.mkdirSync(localDeploy, { recursive: true });
const deployedManifest = path.join(localDeploy, 'tof-update-manifest.json');
if (fromFolder) fs.copyFileSync(manifestPath, deployedManifest);
else fs.renameSync(manifestPath, deployedManifest);
console.log(`Applied ${manifest.kind} update ${manifest.gameVersion ?? ''}: ${manifest.packed} files written, ${removed} removed.`);
