import { readGameSourceFileSync } from '../game-processors/processors/game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import { createSeqIdentityResolver } from '../game-processors/processors/build-seq-data';
import { createLocalizationResolver } from '../game-processors/processors/localization-resolver';
import { normalizeSeqDataset } from './adapters/seq';
import { buildRuntimeData } from '../generators/build-runtime-data.cjs';

// Refresh identities without replacing the published HP snapshot from an older export.
const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1];
if (!process.argv.includes('--raw-source')) throw new Error('Use --raw-source <raw export root>.');
const rawRoot = path.resolve(arg('--raw-source'));
const root = path.resolve(import.meta.dirname, '../..');
const publicRoot = path.join(root, 'apps/web/public/game-data');
const read = (file: string) => JSON.parse(readGameSourceFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const resolver = createLocalizationResolver();
for (const locale of ['en', 'ru']) {
  const file = path.join(rawRoot, `Hotta/Content/Localization/Game/${locale}/Game.json`);
  if (fs.existsSync(file)) resolver.loadLocale(locale, read(file));
}
const resolveIdentity = createSeqIdentityResolver(rawRoot, resolver);
const overrides = read(path.join(root, 'scripts/game-processors/curated/datamine/seq/data/seq-mechanics-overrides.json'));
const snapshot = read(path.join(publicRoot, 'en/datamine/seq.json'));
for (const stage of snapshot.stages) {
  const identity = resolveIdentity(stage.codename);
  const override = overrides.stages[String(stage.stage)];
  if (identity) stage.identitySource = identity.identitySource;
  if (override?.enemyNameEn) {
    Object.assign(stage, { enemyCode: override.enemyCode, enemyNameEn: override.enemyNameEn,
      enemyNameRu: override.enemyNameRu || override.enemyNameEn, nameStatus: 'confirmed',
      nameSource: 'seq_mechanics_overrides', portrait: override.portrait || stage.portrait });
    if (override.identitySource) stage.identityOverrideSource = override.identitySource;
  } else if (identity?.enemyNameEn) Object.assign(stage, identity);
  else if (identity) stage.enemyCode = identity.enemyCode;
  stage.name_en = stage.enemyNameEn;
  stage.name_ru = stage.enemyNameRu;
}
if (snapshot.meta?.resolveReport) {
  const report = snapshot.meta.resolveReport;
  report.enemyNamesResolved = snapshot.stages.filter(stage => stage.enemyNameEn).length;
  report.unresolvedIds = snapshot.stages.filter(stage => !stage.enemyNameEn).map(stage => stage.codename);
  report.enemyNamesUnresolved = report.unresolvedIds.length;
}
const scratch = path.join(root, 'ignore/seq-identities/source');
const cache = path.join(scratch, 'datamine/seq/data/seq-boss-cache.json');
fs.mkdirSync(path.dirname(cache), { recursive: true });
fs.writeFileSync(cache, JSON.stringify(snapshot, null, 2) + '\n');
const result = normalizeSeqDataset(scratch);
for (const locale of ['en', 'ru'] as const) {
  for (const relative of ['seq.json', 'datamine/seq.json']) {
    fs.writeFileSync(path.join(publicRoot, locale, relative), JSON.stringify(result.materialized[locale], null, 2) + '\n');
  }
}
buildRuntimeData(publicRoot);
console.log(snapshot.stages.filter(stage => stage.stage >= 35).map(stage => ({ stage: stage.stage, name: stage.enemyNameEn, class: stage.identitySource?.classPath })));
