import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const config = JSON.parse(fs.readFileSync('config/bootstrap.json', 'utf8'));
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const archive = path.resolve(option('--archive') ?? `ignore/downloads/${config.file}`);
if (!fs.existsSync(archive)) {
  const url = option('--url') ?? process.env.TOF_BOOTSTRAP_URL;
  if (!url) throw new Error(`Download the companion ${config.file} release artifact to ${archive}, or set TOF_BOOTSTRAP_URL. See README.md.`);
  if (!/^https:\/\//.test(url)) throw new Error('Bootstrap downloads require HTTPS');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Bootstrap download returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  fs.writeFileSync(archive, bytes, { flag: 'wx' });
}
const bytes = fs.readFileSync(archive);
if (bytes.length !== config.bytes || createHash('sha256').update(bytes).digest('hex') !== config.sha256) throw new Error('Bootstrap size/SHA-256 mismatch; nothing was extracted');
const windows = process.platform === 'win32';
const names = execFileSync(windows ? 'tar' : 'unzip', windows ? ['-tf', archive] : ['-Z1', archive], { encoding: 'utf8' }).trim().split(/\r?\n/);
for (const entry of names) {
  const name = entry.replaceAll('\\', '/');
  if (name.startsWith('/') || name.includes(':') || name.split('/').includes('..') || !(name==='tools/patch-exporter/config/export-keys.json'||[
    'apps/web/public/game-data/', 'apps/web/public/datamine/shared/assets/', 'apps/web/public/info/',
    'scripts/game-processors/curated/', 'scripts/data/media/', 'tests/fixtures/snapshots/',
  ].some(prefix => name.startsWith(prefix)))) throw new Error(`Unexpected bootstrap entry: ${name}`);
}
execFileSync(windows ? 'tar' : 'unzip', windows ? ['-xf', archive, '-C', process.cwd()] : ['-oq', archive, '-d', process.cwd()], { stdio: 'inherit' });
console.log(`Restored ${config.version}; ${names.length} files verified against ${config.sha256}.`);
