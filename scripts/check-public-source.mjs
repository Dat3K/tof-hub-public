// Fails when a tracked or about-to-be-tracked file would not belong in the public repository:
// local configuration, credentials, binaries, game media, generated output or unexpected routes.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const MAX_SCANNED_BYTES = 4 * 1024 * 1024;
const PUBLIC_ROUTES = new Set(['about', 'api', 'changelog', 'contribute', 'datamine', 'feedback', 'info', 'privacy', 'projects', 'story', 'tools', 'og']);
const SCRIPT_ENTRIES = new Set(['bootstrap.mjs','check-build-inputs.mjs','check-public-source.mjs','generate-import-examples.ts','import-json.mjs','install-public-data.mjs','README.md','setup.mjs','validate-import-examples.ts']);
const BINARY_OR_MEDIA = /\.(?:pem|key|pfx|p12|exe|dll|zip|7z|svg|png|webp|jpe?g|gif|mp4|webm|woff2?|ttf|dump)$/i;
// Reviewed editorial illustrations for the public case study, not exported game catalogs.
const ALLOWED_MEDIA = /^docs\/(?:screenshots\/[a-z0-9-]+\.webp|stickers\/[a-z0-9-]+\.gif)$/;
const TOKEN = /\b[0-9]{8,12}:[A-Za-z0-9_-]{35}\b|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/;
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\\nr]+[A-Za-z0-9+/]{40}/;
const PRIVATE_REPOSITORY_LINK = /github\.com[/:]smilekritik\/tof-hub(?![A-Za-z0-9_-])/i;

const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding: 'utf8'})
  .split('\0')
  .filter(file => file && fs.existsSync(file)))];

const problems = [];
const report = (file, reason) => problems.push(`${file}: ${reason}`);

for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') report(file, 'local configuration');
  if (BINARY_OR_MEDIA.test(file) && !ALLOWED_MEDIA.test(file)) report(file, 'binary, media or credential artifact');
  if (file.startsWith('apps/web/public/') && file !== 'apps/web/public/.gitkeep') report(file, 'generated public output');
  if (file.startsWith('tools/') && !/^tools\/(?:patch-exporter|tof-client-patcher)\//.test(file)) report(file, 'unexpected tool');
  if (/^(?:deploy-live|notes|local-deploy|ignore|\.data|\.claude|\.codebase-memory)\//.test(file)) report(file, 'private working files');
  if (/^pipeline\/(?:raw|staging|normalized|reports)\/(?!\.gitkeep$)/.test(file)) report(file, 'pipeline working output');
  if (/^scripts\/[^/]+$/.test(file) && !SCRIPT_ENTRIES.has(file.slice('scripts/'.length))) report(file, 'unexpected top-level script; use the current scripts directory layout');

  const route = /^apps\/web\/src\/app\/([^/]+)\//.exec(file)?.[1];
  if (route && !PUBLIC_ROUTES.has(route)) report(file, 'unexpected top-level route');

  if (!fs.existsSync(file) || fs.statSync(file).size > MAX_SCANNED_BYTES || ALLOWED_MEDIA.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (file === 'pnpm-lock.yaml') {
    const importers = text.split(/^packages:/m)[0];
    for (const match of importers.matchAll(/^  ((?:apps|packages|tools)\/[^:]+):$/gm)) {
      if (!fs.existsSync(`${match[1]}/package.json`)) report(file, `workspace importer has no public package: ${match[1]}`);
    }
  }
  if (file === 'tools/patch-exporter/config/export-rules.json') {
    const rules = JSON.parse(text);
    if (rules.defaultAesKey || Object.values(rules.regionAesKeys ?? {}).some(Boolean)) report(file, 'archive keys belong in the separate bootstrap configuration');
  }
  if (/^(?:<<<<<<< |>>>>>>> )/m.test(text)) report(file, 'unresolved merge conflict');
  if (/\/(?:dev1|leaks)\b|live-capture\/(?:src|core|backend|driver|src-tauri)\//.test(text)) report(file, 'private route or collector source');
  if (TOKEN.test(text)) report(file, 'credential-shaped token');
  if (PRIVATE_KEY.test(text)) report(file, 'embedded private key');
  if (PRIVATE_REPOSITORY_LINK.test(text)) report(file, 'private repository URL; public links must target tof-hub-public');
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Public source policy passed for ${files.length} files.`);
}
