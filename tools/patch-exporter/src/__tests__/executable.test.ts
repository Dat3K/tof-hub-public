import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Explicit opt-in: exercises the actual release, without a game installation or raw game facts.
const builtExe = process.env.TOF_EXPORTER_TEST_EXE;
test('release EXE works alone, preserves arguments/output and removes its temporary runtime', {
  skip: !builtExe || process.platform !== 'win32', timeout: 180_000,
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-exe-test-'));
  const home = path.join(root, 'Экспорт & space');
  const temp = path.join(root, 'temporary');
  const raw = path.join(root, 'raw & выгрузка');
  fs.mkdirSync(home);
  fs.mkdirSync(temp);
  fs.mkdirSync(raw);
  fs.mkdirSync(path.join(raw, 'Hotta/Content/Test'), { recursive: true });
  fs.writeFileSync(path.join(raw, 'Hotta/Content/Test/pixel.png'), Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64',
  ));
  const exe = path.join(home, 'ToF Exporter.exe');
  fs.copyFileSync(builtExe!, exe);
  const run = (args: string[]) => spawnSync(exe, args, {
    cwd: root, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, TEMP: temp, TMP: temp, PATH: '', NODE_OPTIONS: '--invalid-option', NODE_PATH: 'does-not-exist' },
  });
  try {
    const help = run(['--help']);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Game Data Exporter CLI/);
    assert.deepEqual(fs.readdirSync(temp), []);

    // stage,media skips normalization: supply the materialized consumer so the
    // media pass can select this referenced texture instead of copying arbitrary raw PNGs.
    for (const locale of ['en', 'ru']) {
      const directory = path.join(home, 'output/site/public/game-data', locale, 'oow');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'effects.json'), JSON.stringify({ modes: {
        standard: [], mmo: [{ id: 'fixture', icon: '/game-assets/webp/Hotta/Content/Test/pixel.webp' }],
      } }));
    }

    // No explicit 'run': flags must select the one-click workflow.
    const stage = run(['--raw', raw, '--steps', 'stage,media', '--no-archive', '--jobs', '1']);
    assert.equal(stage.status, 0, stage.stderr);
    assert.ok(fs.existsSync(path.join(home, 'output/site/pre-release/pipeline-timings.json')));
    assert.ok(fs.existsSync(path.join(home, 'work/stage')));
    const webp = fs.readFileSync(path.join(home, 'output/site/public/game-assets/webp/Hotta/Content/Test/pixel.webp'));
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF', 'bundled cwebp performs a real image conversion with an empty system PATH');
    assert.ok(!fs.existsSync(path.join(root, 'output')));
    assert.deepEqual(fs.readdirSync(temp), []);

    const invalid = run(['--raw', `${raw}\\`, '--jobs', '0']);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /--jobs must be a positive integer/);
    assert.deepEqual(fs.readdirSync(temp), []);
    assert.ok(fs.existsSync(path.join(home, 'output/site/pre-release/pipeline-timings.json')));

    // Explicit commands pass through; spaces, trailing slash and embedded quotes stay one argument.
    const unknown = run(['unknown "quoted" command\\']);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /Unknown command "unknown "quoted" command\\"/);
    assert.deepEqual(fs.readdirSync(temp), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
