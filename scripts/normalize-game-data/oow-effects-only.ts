import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, loadPipelineEnv, tryGetRawGameSourceDir, createPathGuard } from '../_shared';
import { buildOowEffectCatalog } from './oow-effects';

// Refresh only the effect catalog; imported combat stats and schedules stay in their own pipeline.
const projectRoot = findProjectRoot();
loadPipelineEnv(projectRoot);
const arg = (flag: string) => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
const rawRoot = arg('--raw-source') || tryGetRawGameSourceDir({ projectRoot });
const legacyRoot = arg('--legacy-source');
const supplementalRawRoot = arg('--raw-supplement');
if (!rawRoot || !legacyRoot) throw new Error('Use --raw-source and --legacy-source for OoW effect provenance.');
const publicRoot = path.join(projectRoot, 'apps/web/public');
const historicalFile = path.join(legacyRoot, 'datamine/oow/data/oow_buffs_catalog.json');
const historical = JSON.parse(fs.readFileSync(historicalFile, 'utf8'));
const directory = path.join(publicRoot, 'game-data/en/oow/seasons');
const seasons: Record<'standard' | 'mmo', Record<string, any>> = { standard: {}, mmo: {} };
for (const name of fs.readdirSync(directory).filter(name => /^(?:mmo_)?s\d+\.json$/.test(name))) {
  seasons[name.startsWith('mmo_') ? 'mmo' : 'standard'][name] = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
}
const catalog = buildOowEffectCatalog(rawRoot, historical, seasons, { supplementalRawRoot });
const guards = [createPathGuard(rawRoot, [publicRoot]), ...(supplementalRawRoot ? [createPathGuard(supplementalRawRoot, [publicRoot])] : [])];
const output = JSON.stringify(catalog, null, 2) + '\n';
for (const locale of ['en', 'ru']) {
  const file = path.join(publicRoot, 'game-data', locale, 'oow/effects.json');
  for (const guard of guards) guard.assertSafeOutput(file);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== output) throw new Error(`Stale ${file}`);
  } else fs.writeFileSync(file, output);
}
console.log(`OoW effects: ${catalog.modes.standard.length} Gacha, ${catalog.modes.mmo.length} MMO; history: ${JSON.stringify(catalog.seasonCoverage)}`);
