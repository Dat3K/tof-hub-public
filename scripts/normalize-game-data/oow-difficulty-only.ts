import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, loadPipelineEnv, tryGetRawGameSourceDir, createPathGuard } from '../_shared';
import { createOowDifficultyRestorer } from './oow-difficulty';

// Refresh schedules without regenerating imported enemy stats, artwork or unrelated datasets.
const projectRoot = findProjectRoot();
loadPipelineEnv(projectRoot);
const argument = process.argv.indexOf('--raw-source');
const rawRoot = argument >= 0 ? process.argv[argument + 1] : tryGetRawGameSourceDir({ projectRoot });
if (!rawRoot) throw new Error('Raw source is required to regenerate OoW difficulty.');
const publicRoot = path.join(projectRoot, 'apps/web/public');
const guard = createPathGuard(rawRoot, [publicRoot]);
const restore = createOowDifficultyRestorer(rawRoot);
const updates = new Map<string, unknown>();
for (const base of [publicRoot, path.join(publicRoot, 'game-data')]) {
  for (const locale of ['en', 'ru']) {
    const directory = path.join(base, locale, 'oow/seasons');
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).filter((name) => /^s\d+\.json$/.test(name))) {
      const file = fs.realpathSync(path.join(directory, name));
      if (updates.has(file)) continue;
      guard.assertSafeOutput(file);
      const season = restore(JSON.parse(fs.readFileSync(file, 'utf8')));
      for (const floor of season.floors) {
        if (floor.difficultySchedule.diagnosticStatus !== 'confirmed') {
          throw new Error(`${name} F${floor.floor}: ${floor.difficultySchedule.diagnosticReason}`);
        }
      }
      updates.set(file, season);
    }
  }
}
if (!updates.size) throw new Error('No materialized OoW seasons found.');
// Resolve and validate every input before writing output.
for (const [file, data] of updates) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Regenerated difficulty in ${updates.size} locale season files.`);
