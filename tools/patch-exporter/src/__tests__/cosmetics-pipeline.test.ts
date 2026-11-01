import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {compileProcessors} from '../../scripts/compile-processors';
import {exportMediaAssets, findReferencedPngFiles} from '../media-exporter';
import {buildReleasePackage} from '../release-package';
import {runPipeline} from '../pipeline-run';
import {preReleaseReportEntries} from '../run-command';

test('future cosmetics survive the compiled processor, EN/RU runtime, media and update ZIP without seeded catalog rows', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-cosmetic-pipeline-'));
  const require = createRequire(__filename);
  const sharp = require(require.resolve('sharp', {paths: [path.dirname(require.resolve('next', {paths: [path.resolve('apps/web')]}))]}));
  sharp.cache(false);
  const raw = path.join(root, 'raw');
  const work = path.join(root, 'work');
  const stage = path.join(work, 'stage');
  const out = path.join(root, 'out');
  const pub = path.join(out, 'public');
  const compiled = path.join(root, 'compiled');
  const write = (file: string, data: unknown) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(data));
  };
  const table = (relative: string, rows: unknown) => write(path.join(raw, 'Hotta/Content/Resources/CoreBlueprints/DataTable', relative), [{Rows: rows}]);
  const text = (value: string) => ({CultureInvariantString: value});
  const ref = (value: string) => ({AssetPathName: value});
  try {
    for (const [name, width, height, background] of [['Poster', 16, 16, '#ff0000'], ['BadgeIcon', 8, 8, '#0000ff'], ['BadgeFull', 32, 16, '#00ff00']] as const) {
      const file = path.join(raw, `Hotta/Content/Fixture/${name}.png`);
      fs.mkdirSync(path.dirname(file), {recursive: true});
      await sharp({create: {width, height, channels: 4, background}}).png().toFile(file);
    }
    table('Item/ItemConfigs.json', {
      future_static: {ItemName: text('Future sticker'), ItemIcon: ref('/Game/Fixture/Poster.Poster'), StaticToolName: 'unlock_static'},
      future_dynamic: {ItemName: text('Future animation'), ItemIcon: ref('/Game/Fixture/Poster.Poster'), StaticToolName: 'unlock_dynamic'},
    });
    const emojiTable = (name: string, rows: unknown) => write(path.join(raw, 'Hotta/Content/SevenForest/Data', name), [{Rows: rows}]);
    emojiTable('DT_Emoji.json', {
      'fixture-static': {EmojiTexture: ref('/Game/Fixture/Poster.Poster'), IsLock: true, ItemId: 'future_static'},
      'fixture-free': {EmojiTexture: ref('/Game/Different/Poster.Poster'), IsLock: false, ItemId: 'None'},
    });
    emojiTable('DT_BigEmoji.json', {'fixture-motion': {EmojiBrush: ref('/Game/Fixture/Motion.Motion'), IsLock: true, ItemId: 'future_dynamic'}});
    table('ToolStaticDataTable.json', {
      unlock_static: {StaticToolType: 'STATIC_TOOL_TYPE_UNLOCK_EMOJI', ToolValue: 'fixture-static'},
      unlock_dynamic: {StaticToolType: 'STATIC_TOOL_TYPE_UNLOCK_DYNAMIC_EMOJI', ToolValue: 'fixture-motion'},
    });
    table('EmblemConfigDataTable.json', {future_badge: {EmblemName: text('Future badge'),
      EmblemItemIcon: ref('/Game/Fixture/BadgeIcon.BadgeIcon'), EmblemIcon: ref('/Game/Fixture/BadgeFull.BadgeFull')}});
    table('AvatarConfigDataTable.json', {future_avatar: {Name: text('Future avatar'), Icon: ref('/Game/Fixture/Poster.Poster'), Material: ref('/Game/Fixture/Unexported.Unexported')}});
    table('AvatarFrameConfigDataTable.json', {});
    table('MountConfigDataTable.json', {});
    table('MountSkinConfigDataTable.json', {});
    await compileProcessors(compiled);
    const runProcessor = () => {
      const run = spawnSync(process.execPath, [path.join(compiled, 'processors/build-cosmetics.js'), `--raw-dir=${raw}`, `--project-root=${stage}`], {encoding: 'utf8', timeout: 30000});
      assert.equal(run.status, 0, run.stderr || run.stdout);
    };
    runProcessor();
    // A changed raw effect must also replace an existing stage projection on the next scan.
    table('AvatarConfigDataTable.json', {
      future_avatar: {Name: text('Future avatar'), Icon: ref('/Game/Fixture/Poster.Poster'), Material: ref('/Game/Fixture/NewParent.NewParent')},
      newly_added_avatar: {Name: text('Added after the first scan'), Icon: ref('/Game/Fixture/Poster.Poster')},
    });
    runProcessor();
    const stageAvatar = JSON.parse(fs.readFileSync(path.join(stage, 'info/cosmetics/data/avatars.json'), 'utf8'))[0];
    assert.equal(stageAvatar.animation.references[0].asset, '/Game/Fixture/NewParent.NewParent');
    assert.equal(JSON.parse(fs.readFileSync(path.join(stage, 'info/cosmetics/data/cosmetics.json'), 'utf8')).counts.avatars, 2);
    const {normalizeCosmeticsDataset} = require('../../../../scripts/normalize-game-data/adapters/cosmetics.ts');
    const normalized = normalizeCosmeticsDataset(stage, {rawSourceDir: raw, publicDir: pub});
    for (const locale of ['en', 'ru']) write(path.join(pub, `game-data/${locale}/cosmetics.json`), normalized.materialized[locale]);
    require('../../../../scripts/generators/build-runtime-data.cjs').buildRuntimeData(path.join(pub, 'game-data'));
    const runtime = JSON.parse(fs.readFileSync(path.join(pub, 'game-data/en/runtime/cosmetics.json'), 'utf8'));
    assert.equal(runtime.items.find((row: {id: string}) => row.id === 'future_dynamic').animation.status, 'unresolved');
    assert.equal(runtime.items.find((row: {id: string}) => row.id === 'future_badge').quality, undefined);
    assert.ok(!('chatStickers' in runtime), 'runtime keeps a single canonical items array');
    const media = await exportMediaAssets({inputDir: raw, outputDir: pub,
      specificFiles: findReferencedPngFiles(raw, path.join(pub, 'game-data')),
      mockConverter: async (source, target) => { await sharp(source).webp({lossless: true}).toFile(target); return true; }});
    assert.equal(media.failedCount, 0);
    assert.equal(media.totalAssets, 3);
    for (const locale of ['en', 'ru']) {
      const catalog = normalized.materialized[locale];
      const badge = catalog.items.find((row: {id: string}) => row.id === 'future_badge');
      assert.notEqual(badge.icon, badge.photo);
      const full = path.join(pub, badge.photo.replace('/datamine/shared/media/', '/game-assets/webp/'));
      assert.equal((await sharp(full).metadata()).width, 32);
    }
    const result = await runPipeline({rawDir: raw, outDir: out, workDir: work, steps: [],
      locations: {processorsRoot: compiled, generatorsDir: root, siteInputsDir: root}});
    const reports = preReleaseReportEntries(result.reportsDir);
    assert.ok(reports.some(entry => entry.name.endsWith('/cosmetics-source-report.json')));
    const audit = JSON.parse(fs.readFileSync(path.join(result.reportsDir, 'cosmetics-source-report.json'), 'utf8'));
    assert.ok(audit.missingStickerImages.includes('emoji_fixture-free'), 'a same-named texture in another folder is not an exact source');
    assert.deepEqual(audit.stickerJoinIssues, []);
    assert.ok(audit.animationDependencies.nodes.some((node: {packagePath: string; missing: boolean}) => node.packagePath.endsWith('NewParent') && node.missing));
    const release = await buildReleasePackage({publicDir: pub, outFile: path.join(root, 'update.zip'), additionalEntries: reports});
    assert.equal(fs.readFileSync(release.archive).subarray(0, 2).toString(), 'PK');
    assert.ok(release.manifest.files['game-data/en/runtime/cosmetics.json']);
    assert.ok(Object.keys(release.manifest.files).some(file => file.endsWith('/BadgeFull.webp')));
  } finally { fs.rmSync(root, {recursive: true, force: true, maxRetries: 8, retryDelay: 100}); }
});
