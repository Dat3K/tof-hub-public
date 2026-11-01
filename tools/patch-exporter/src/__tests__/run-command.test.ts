import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preReleaseReportEntries, runOneClick } from '../run-command';

test('one-click update includes Wish pool discovery report for maintainers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-wish-report-'));
  try {
    const report = path.join(root, 'wish-unmapped-pools.json');
    fs.writeFileSync(report, '{"count":0,"pools":[]}');
    const art = path.join(root, 'wish-artwork-candidates', 'UP_061_RN', 'Bg_UpRN.png');
    fs.mkdirSync(path.dirname(art), { recursive: true });
    fs.writeFileSync(art, 'fixture png');
    assert.deepEqual(preReleaseReportEntries(root).map(({ source, name }) => ({ source, name })), [{
      source: report,
      name: 'tools/patch-exporter/pre-release/wish-unmapped-pools.json',
    }, {
      source: art,
      name: 'tools/patch-exporter/pre-release/wish-artwork-candidates/UP_061_RN/Bg_UpRN.png',
    }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('one-click output and work survive outside the disposable runtime package', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-output-test-'));
  const runtime = path.join(root, 'temporary-runtime');
  const data = path.join(root, 'persistent-data');
  const raw = path.join(root, 'raw');
  fs.mkdirSync(raw);
  fs.mkdirSync(path.join(runtime, 'processors/curated/site'), { recursive: true });
  fs.writeFileSync(path.join(runtime, 'processors/curated/site/fixture.json'), '{"fixture":true}');
  try {
    await runOneClick(['--raw', raw, '--steps', 'stage', '--no-archive'], runtime, data);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data, 'work/stage/fixture.json'), 'utf8')), { fixture: true });
    assert.ok(fs.existsSync(path.join(data, 'output/site/pre-release/pipeline-timings.json')));
    assert.ok(!fs.existsSync(path.join(runtime, 'work')));
    assert.ok(!fs.existsSync(path.join(runtime, 'output')));
    fs.rmSync(runtime, { recursive: true });
    assert.ok(fs.existsSync(path.join(data, 'work/stage/fixture.json')));
    assert.ok(fs.existsSync(path.join(data, 'output/site/pre-release/pipeline-timings.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
