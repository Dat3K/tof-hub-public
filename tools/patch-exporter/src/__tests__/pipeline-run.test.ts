import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPipeline, SITE_GENERATORS, SITE_INPUT_FILES, writeWishPoolDiscoveryReport } from '../pipeline-run';

test('wish pool discovery report preserves raw identity without implying a schedule', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-wish-pools-'));
  try {
    const reportPath = writeWishPoolDiscoveryReport(root, [{
      recordName: 'WeaponLottery_NEW_1', kind: 'weapon', key: 'Wrenna_Thu', featuredItem: 'Wrenna_Thu',
      maxUnluckyCount: 80, voucherItem: 'Item_Gem_Wrenna_Thu', awardPool: 'weapon_UP75_common',
      widgetPath: null, sourcePath: 'Hotta/Content/SevenForest/Blueprint/Lottery/BP_WeaponLottery_NEW_1.json',
    }]);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.count, 1);
    assert.match(report.meaning, /not verified future banners/);
    assert.equal(report.pools[0].sourcePath, 'Hotta/Content/SevenForest/Blueprint/Lottery/BP_WeaponLottery_NEW_1.json');

    writeWishPoolDiscoveryReport(root, []);
    const cleared = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.deepEqual(cleared.pools, []);
    assert.deepEqual(cleared.artworkFolders, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('partial pipeline runs clear stale Wish discovery handoff files when normalization is skipped', async () => {
  const f = fixture();
  const reports = path.join(f.options.outDir, 'pre-release');
  const oldArt = path.join(reports, 'wish-artwork-candidates', 'UP_061_RN', 'Bg_UpRN.png');
  fs.mkdirSync(path.dirname(oldArt), { recursive: true });
  fs.writeFileSync(path.join(reports, 'wish-unmapped-pools.json'), '{"count":1}');
  fs.writeFileSync(oldArt, 'stale');
  try {
    await runPipeline({ ...f.options, steps: ['generators'] as const, jobs: 1 });
    assert.ok(!fs.existsSync(path.join(reports, 'wish-unmapped-pools.json')));
    assert.ok(!fs.existsSync(path.join(reports, 'wish-artwork-candidates')));
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-generator-test-'));
  for (const file of SITE_INPUT_FILES) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '{}');
  }
  for (const { script } of SITE_GENERATORS) {
    fs.writeFileSync(path.join(root, script), `
      const fs = require('node:fs');
      const path = require('node:path');
      const id = path.basename(__filename);
      fs.appendFileSync('events.jsonl', JSON.stringify(['start', id]) + '\\n');
      if (id === 'build-weapon-growth.cjs') {
        setTimeout(() => {
          fs.appendFileSync('events.jsonl', JSON.stringify(['finish', id]) + '\\n');
        }, 300);
      } else {
        fs.appendFileSync('events.jsonl', JSON.stringify(['finish', id]) + '\\n');
        if (id === 'build-progression-costs.cjs' && fs.existsSync('fail')) process.exitCode = 7;
      }
    `);
  }
  return {
    root,
    options: {
      rawDir: root, outDir: path.join(root, 'output'), workDir: root,
      steps: ['generators'] as const,
      locations: { processorsRoot: root, generatorsDir: root, siteInputsDir: root },
    },
    events: (): string[][] => fs.readFileSync(path.join(root, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)),
  };
}

for (const jobs of [1, 2, 16]) {
  test(`generators respect ${jobs} workers and wait for prerequisites`, async () => {
    const f = fixture();
    try {
      const result = await runPipeline({ ...f.options, jobs });
      assert.equal(result.mediaChecked, false);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.reportsDir, 'missing-media.json'), 'utf8')), { checked: false, missing: null });
      let active = 0;
      let peak = 0;
      const parallelStart = SITE_GENERATORS.findIndex(step => step.parallel);
      const firstSequentialAfterBatch = SITE_GENERATORS.findIndex((step, index) => index > parallelStart && !step.parallel);
      const parallelCount = firstSequentialAfterBatch - parallelStart;
      const finished = new Set<string>();
      for (const [event, id] of f.events()) {
        if (event === 'start') {
          active++;
          peak = Math.max(peak, active);
          if (!SITE_GENERATORS.find(step => step.script === id)?.parallel) {
            assert.equal(active, 1);
            const index = SITE_GENERATORS.findIndex(step => step.script === id);
            for (const step of SITE_GENERATORS.slice(0, index)) assert.ok(finished.has(step.script));
          }
        } else {
          active--;
          finished.add(id);
        }
      }
      assert.ok(peak <= Math.min(jobs, parallelCount));
      if (jobs > 1) assert.ok(peak > 1, 'independent generators overlap');
      assert.equal(active, 0);
      assert.deepEqual(f.events().filter(([event]) => event === 'start').slice(firstSequentialAfterBatch).map(([, id]) => id), SITE_GENERATORS.slice(firstSequentialAfterBatch).map(step => step.script));
    } finally {
      fs.rmSync(f.root, { recursive: true, force: true });
    }
  });
}

test('generator failure drains its batch and prevents dependent generators', async () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.root, 'fail'), '');
    await assert.rejects(runPipeline({ ...f.options, jobs: 4 }), /exited with code 7/);
    const events = f.events();
    const started = events.filter(([event]) => event === 'start').map(([, id]) => id);
    const finished = events.filter(([event]) => event === 'finish').map(([, id]) => id);
    assert.deepEqual(new Set(finished), new Set(started), 'every started process drains before failure returns');
    assert.ok(started.includes('build-reference.cjs'));
    assert.ok(started.includes('build-progression-costs.cjs'));
    const downstream = SITE_GENERATORS.findIndex((step, index) => index > 0 && !step.parallel);
    assert.ok(started.every(id => SITE_GENERATORS.slice(0, downstream).some(step => step.script === id)), 'dependent generators never start');
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('invalid worker counts fail before creating output', async () => {
  for (const jobs of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(runPipeline({ rawDir: '', outDir: '', workDir: '', jobs, locations: { processorsRoot: '', generatorsDir: '', siteInputsDir: '' } }), /positive integer/);
  }
});
