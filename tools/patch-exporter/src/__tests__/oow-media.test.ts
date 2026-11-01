import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { exportMediaAssets, findReferencedAssetAliases, findReferencedPngFiles } from '../media-exporter';
import { reconcileOowEnemyPngDownloads, validateOowEffectCatalogMedia } from '../oow-media';
import { buildReleasePackage } from '../release-package';
import { preReleaseReportEntries } from '../run-command';

const scratch = path.resolve(__dirname, '../../../../ignore/oow-enemy-png');
const roots: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const reference = 'Hotta/Content/Resources/UI/void/boss/mon_hum_049';

afterEach(() => {
  for (const root of roots.splice(0)) {
    assert.equal(path.dirname(root), scratch);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'run-'));
  roots.push(root);
  const options = {
    publicDir: path.join(root, 'public'), rawDir: path.join(root, 'raw'),
    preservedDir: path.join(root, 'preserved'), reportsDir: path.join(root, 'pre-release'),
  };
  const write = (file: string, contents: string | Buffer) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };
  const shards: string[] = [];
  for (const base of ['game-data/en', 'game-data/ru', 'en', 'ru']) {
    const file = path.join(options.publicDir, base, 'oow/seasons/mmo_s04.json');
    write(file, JSON.stringify({ season: 4, floors: [{ floor: 9, enemies: [{
      key: 'S2_F9_W1_elite', codeName: '049_Balance',
      image: `/datamine/shared/media/${reference}.webp`,
      detailImageFull: `/datamine/shared/media/${reference}.webp`,
    }] }] }));
    shards.push(file);
  }
  const exportRaw = async () => {
    const data = path.join(options.publicDir, 'game-data');
    const aliases = findReferencedAssetAliases(options.rawDir, data);
    return exportMediaAssets({
      inputDir: options.rawDir, outputDir: options.publicDir,
      specificFiles: [...findReferencedPngFiles(options.rawDir, data), ...aliases.map((alias) => alias.sourceFile)],
      webpAliases: aliases, jobs: 1, tool: { toolType: 'cwebp', binaryPath: 'fixture' },
      mockConverter: (_src, dest) => { write(dest, 'generated WebP fixture'); return true; },
    });
  };
  return { root, options, write, shards, exportRaw };
}

test('OoW catalog icons are discovered, exported and packaged; missing images block the update', async () => {
  const f = fixture();
  const icon = 'Hotta/Content/Resources/Icon/buff_balance/fixture_effect';
  for (const locale of ['en', 'ru']) f.write(path.join(f.options.publicDir, 'game-data', locale, 'oow/effects.json'), JSON.stringify({
    modes: { standard: [], mmo: [{ id: 'fixture_effect', icon: `/game-assets/webp/${icon}.webp` }] },
  }));
  assert.throws(() => validateOowEffectCatalogMedia(f.options.publicDir), /referenced icon.*not exported/);
  f.write(path.join(f.options.rawDir, `${icon}.png`), png);
  await f.exportRaw();
  assert.doesNotThrow(() => validateOowEffectCatalogMedia(f.options.publicDir));
  const archive = await buildReleasePackage({ publicDir: f.options.publicDir, outFile: path.join(f.root, 'update.zip'), jobs: 1 });
  assert.ok(archive.manifest.files[`game-assets/webp/${icon}.webp`]);
  assert.ok(archive.manifest.files['game-data/en/oow/effects.json']);
  assert.ok(archive.manifest.files['game-data/ru/oow/effects.json']);
});

test('game PNGs and exact PNG aliases survive export, EN/RU materialization and the update archive', async () => {
  for (const source of [`${reference}.png`, 'Hotta/Content/Resources/UI/SHTT/guaiwu/mon_hum_049_SHTT_DT.png']) {
    const f = fixture();
    f.write(path.join(f.options.rawDir, source), png);
    await f.exportRaw();
    assert.deepEqual(reconcileOowEnemyPngDownloads(f.options), { originals: 1, preserved: 0, missing: 0 });
    const pngUrl = `/game-assets/png/${reference}.png`;
    for (const file of f.shards) {
      const enemy = JSON.parse(fs.readFileSync(file, 'utf8')).floors[0].enemies[0];
      assert.equal(enemy.imagePng, pngUrl);
      assert.equal(enemy.detailImagePng, pngUrl);
    }
    assert.deepEqual(fs.readFileSync(path.join(f.options.publicDir, pngUrl)), png);
    const report = JSON.parse(fs.readFileSync(path.join(f.options.reportsDir, 'oow-enemy-png.json'), 'utf8'));
    assert.equal(report.portraits[0].sourcePath, source);
    assert.equal(report.portraits[0].consumers.length, 1);
    const archive = await buildReleasePackage({
      publicDir: f.options.publicDir, outFile: path.join(f.root, 'update.zip'), jobs: 1,
      additionalEntries: preReleaseReportEntries(f.options.reportsDir),
    });
    assert.ok(archive.manifest.files[pngUrl.slice(1)]);
    assert.ok(preReleaseReportEntries(f.options.reportsDir).some((entry) => entry.name.endsWith('oow-enemy-png.json')));
  }
});

test('archived WebP supplies a preview but never counts as a game PNG original', async () => {
  const f = fixture();
  f.write(path.join(f.options.rawDir, 'Hotta/Content/Unreferenced.png'), png);
  const archived = path.join(f.options.preservedDir, `${reference}.webp`);
  f.write(archived, 'archived WebP fixture');
  const exported = await exportMediaAssets({
    inputDir: f.options.rawDir, outputDir: f.options.publicDir, specificFiles: [],
    preparedWebpAliases: [{ sourceFile: archived, relativePath: `${reference}.webp` }],
    tool: { toolType: 'cwebp', binaryPath: 'fixture' },
  });
  assert.equal(exported.copiedPngCount, 0, 'empty selective lists must not export the entire raw tree');
  assert.deepEqual(reconcileOowEnemyPngDownloads(f.options), { originals: 0, preserved: 0, missing: 1 });
  const enemy = JSON.parse(fs.readFileSync(f.shards[0], 'utf8')).floors[0].enemies[0];
  assert.equal(enemy.detailImagePng, null);
  assert.ok(fs.existsSync(path.join(f.options.publicDir, 'game-assets/webp', `${reference}.webp`)));
});

test('a missing or modified exported PNG stops release preparation when the raw original exists', async () => {
  const f = fixture();
  f.write(path.join(f.options.rawDir, `${reference}.png`), png);
  assert.throws(() => reconcileOowEnemyPngDownloads(f.options), /not preserved byte-for-byte/);
  await f.exportRaw();
  f.write(path.join(f.options.publicDir, 'game-assets/png', `${reference}.png`), Buffer.concat([png, Buffer.from('modified')]));
  assert.throws(() => reconcileOowEnemyPngDownloads(f.options), /not preserved byte-for-byte/);
});

test('a prepared WebP cannot overwrite the derivative generated from a current game PNG', async () => {
  const f = fixture();
  const source = path.join(f.options.rawDir, `${reference}.png`);
  const archived = path.join(f.options.preservedDir, `${reference}.webp`);
  f.write(source, png);
  f.write(archived, 'outdated WebP');
  await exportMediaAssets({
    inputDir: f.options.rawDir, outputDir: f.options.publicDir, specificFiles: [source],
    preparedWebpAliases: [{ sourceFile: archived, relativePath: `${reference}.webp` }],
    tool: { toolType: 'cwebp', binaryPath: 'fixture' },
    mockConverter: (_src, dest) => { f.write(dest, 'fresh WebP'); return true; },
  });
  assert.equal(fs.readFileSync(path.join(f.options.publicDir, 'game-assets/webp', `${reference}.webp`), 'utf8'), 'fresh WebP');
});

test('renaming a WebP to .png cannot qualify it as a game PNG original', () => {
  const f = fixture();
  f.write(path.join(f.options.rawDir, `${reference}.png`), 'RIFFxxxxWEBP');
  assert.throws(() => reconcileOowEnemyPngDownloads(f.options), /original is not a PNG/);
});

test('a true preserved PNG remains downloadable and is distinguished from this game export', async () => {
  const f = fixture();
  const source = path.join(f.options.preservedDir, `${reference}.png`);
  f.write(source, png);
  await exportMediaAssets({
    inputDir: f.options.preservedDir, outputDir: f.options.publicDir, specificFiles: [source],
    tool: { toolType: 'cwebp', binaryPath: 'fixture' },
    mockConverter: (_src, dest) => { f.write(dest, 'preserved PNG derivative'); return true; },
  });
  assert.deepEqual(reconcileOowEnemyPngDownloads(f.options), { originals: 0, preserved: 1, missing: 0 });
});
