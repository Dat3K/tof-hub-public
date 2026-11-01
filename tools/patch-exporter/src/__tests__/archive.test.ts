import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { collectArchiveEntries, writeZipArchive } from '../archive';
import { buildReleasePackage, hashTree, ARCHIVE_PREFIX, MANIFEST_NAME } from '../release-package';

test('hashing reports completed files, including an empty tree', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-hash-progress-'));
  try {
    const progress: number[][] = [];
    assert.deepEqual(await hashTree(root, 2, (done, total) => progress.push([done, total])), {});
    assert.deepEqual(progress, [[0, 0]]);
    fs.writeFileSync(path.join(root, 'a'), 'a');
    fs.writeFileSync(path.join(root, 'b'), 'b');
    progress.length = 0;
    const files = await hashTree(root, 2, (done, total) => progress.push([done, total]));
    assert.equal(Object.keys(files).length, 2);
    assert.deepEqual(progress, [[0, 2], [1, 2], [2, 2]]);
    await assert.rejects(hashTree(root, NaN), /positive integer/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
import { detectGameRegion } from '../discovery';

/** Minimal reader: central directory -> { name: { method, data } }. */
function readZip(file: string): Map<string, { method: number; data: Buffer }> {
  const zip = fs.readFileSync(file);
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  if (count === 0xffff || offset === 0xffffffff) {
    const locator = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
    const record = Number(zip.readBigUInt64LE(locator + 8));
    count = Number(zip.readBigUInt64LE(record + 32));
    offset = Number(zip.readBigUInt64LE(record + 48));
  }
  const entries = new Map<string, { method: number; data: Buffer }>();
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(offset + 10);
    const crc = zip.readUInt32LE(offset + 16);
    const compressed = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localName = zip.readUInt16LE(local + 26);
    const localExtra = zip.readUInt16LE(local + 28);
    const raw = zip.subarray(local + 30 + localName + localExtra, local + 30 + localName + localExtra + compressed);
    const data = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw);
    assert.equal(zlib.crc32(data) >>> 0, crc, `CRC of ${name}`);
    entries.set(name, { method, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function tempTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-archive-'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

test('archive: deflates data, stores images, keeps UTF-8 names and CRCs', async () => {
  const root = tempTree({ 'game-data/en/a.json': '{"x":"'.padEnd(2000, 'a') + '"}', 'game-assets/webp/b.webp': 'RIFFxxxxWEBP', 'en/Апофис.json': '{}' });
  const out = path.join(root, '..', `${path.basename(root)}.zip`);
  const result = await writeZipArchive(out, collectArchiveEntries(root, 'apps/web/public/'));
  const entries = readZip(out);
  assert.equal(result.entries, 3);
  assert.equal(entries.get('apps/web/public/game-data/en/a.json')?.method, 8);
  assert.equal(entries.get('apps/web/public/game-assets/webp/b.webp')?.method, 0);
  assert.equal(entries.get('apps/web/public/en/Апофис.json')?.data.toString(), '{}');
});

test('archive: more than 65535 entries uses ZIP64 end records', async () => {
  // One source file under 65,600 names: exercises the ZIP64 end records without disk churn.
  const root = tempTree({ 'tile.png': 'x' });
  const source = path.join(root, 'tile.png');
  const out = path.join(root, '..', `${path.basename(root)}-64.zip`);
  await writeZipArchive(out, Array.from({ length: 65600 }, (_, i) => ({ source, name: `tiles/${i}.png` })));
  assert.equal(readZip(out).size, 65600);
});

test('release package: delta packs changed files and lists deletions', async () => {
  const root = tempTree({ 'game-data/a.json': '1', 'game-data/b.json': '2' });
  const full = await buildReleasePackage({ publicDir: root, outFile: path.join(root, '..', 'full', 'update.zip') });
  assert.equal(full.manifest.kind, 'full');
  assert.equal(full.manifest.packed, 2);

  fs.writeFileSync(path.join(root, 'game-data/b.json'), '3');
  fs.rmSync(path.join(root, 'game-data/a.json'));
  fs.writeFileSync(path.join(root, 'game-data/c.json'), '4');
  const delta = await buildReleasePackage({ publicDir: root, outFile: path.join(root, '..', 'delta', 'update.zip'), baseline: full.manifest });
  assert.equal(delta.manifest.kind, 'delta');
  assert.deepEqual(delta.manifest.deleted, ['game-data/a.json']);
  const names = [...readZip(delta.archive).keys()].sort();
  assert.deepEqual(names, [`${ARCHIVE_PREFIX}game-data/b.json`, `${ARCHIVE_PREFIX}game-data/c.json`, MANIFEST_NAME].sort());
});

test('release package: directory format matches the extracted ZIP layout and is a real copy', async () => {
  const root = tempTree({ 'game-data/a.json': '1' });
  const report = path.join(root, '..', `${path.basename(root)}-report.md`);
  fs.writeFileSync(report, '# report');
  const outDir = path.join(root, '..', `${path.basename(root)}-release`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'stale.txt'), 'previous run');
  const release = await buildReleasePackage({
    publicDir: root, outFile: outDir, format: 'directory',
    additionalEntries: [{ source: report, name: 'tools/patch-exporter/pre-release/report.md' }],
  });
  assert.equal(release.manifestFile, path.join(outDir, MANIFEST_NAME));
  assert.equal(fs.readFileSync(path.join(outDir, ...`${ARCHIVE_PREFIX}game-data/a.json`.split('/')), 'utf8'), '1');
  assert.equal(fs.readFileSync(path.join(outDir, 'tools/patch-exporter/pre-release/report.md'), 'utf8'), '# report');
  assert.equal(fs.existsSync(path.join(outDir, 'stale.txt')), false);
  fs.writeFileSync(path.join(root, 'game-data/a.json'), '2');
  assert.equal(fs.readFileSync(path.join(outDir, ...`${ARCHIVE_PREFIX}game-data/a.json`.split('/')), 'utf8'), '1');
});

test('release package: includes maintainer reports outside the site manifest', async () => {
  const publicDir = tempTree({ 'game-data/fce.json': '{}' });
  const report = path.join(publicDir, '..', 'fce-report.md');
  fs.writeFileSync(report, '# Boss mechanics');
  const outFile = path.join(publicDir, '..', 'fce-update.zip');

  const result = await buildReleasePackage({
    publicDir,
    outFile,
    additionalEntries: [{ source: report, name: 'tools/patch-exporter/pre-release/fce/ALL_BOSSES_TEXTS.md' }],
  });
  const entries = readZip(outFile);

  assert.equal(entries.get('tools/patch-exporter/pre-release/fce/ALL_BOSSES_TEXTS.md')?.data.toString(), '# Boss mechanics');
  assert.equal(result.manifest.files['tools/patch-exporter/pre-release/fce/ALL_BOSSES_TEXTS.md'], undefined);
  assert.equal(result.manifest.packed, 1);
});

test('discovery: China clients use the CN pak key', () => {
  assert.equal(detectGameRegion({ branch: 'AdvLaunch52', clientName: 'CN Client' }), 'cn');
  assert.equal(detectGameRegion({ branch: 'TestPC_KR2New', clientName: 'Korea Dev 1' }), 'global');
  assert.equal(detectGameRegion({ branch: 'OBPC_Xianqian', clientName: 'Global Pioneer' }, 'D:\\幻塔'), 'cn');
});
