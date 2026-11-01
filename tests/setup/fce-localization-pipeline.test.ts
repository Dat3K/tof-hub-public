// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterEach, expect, it} from 'vitest';

const repo = path.resolve(import.meta.dirname, '../..');
const scratch = path.join(repo, 'ignore/fce-localization/pipeline-tests');
const roots: string[] = [];

afterEach(() => {
  for (const directory of roots.splice(0)) {
    if (!path.resolve(directory).startsWith(scratch + path.sep)) throw Error('Fixture outside task scratch');
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

it('preserves generated locale and phase data when a patch has no raw inputs', () => {
  fs.mkdirSync(scratch, {recursive: true});
  const directory = fs.mkdtempSync(path.join(scratch, 'case-'));
  roots.push(directory);
  const raw = path.join(directory, 'raw');
  const publicDir = path.join(directory, 'public');
  const output = path.join(publicDir, 'game-data/fce-cards.json');
  fs.mkdirSync(raw, {recursive: true});
  fs.mkdirSync(path.dirname(output), {recursive: true});
  const cachedPhase = {phase: 5, rowPhase: 4, sourcePath: 'verified/raw/monster.json'};
  const cachedLocale = {de: {name: 'Zwischengespeicherter Name', mechanics: [{index: '1', html: 'Zwischengespeicherter Text'}]}};
  fs.writeFileSync(output, JSON.stringify({schemaVersion: 1,
    standard: [{slug: 'chaos-armor', l10n: cachedLocale, last_phase: cachedPhase}],
    mmo: [{slug: 'cached-mmo', encounter: 'border-war'}, {slug: 'oow-entry', encounter: 'oow'}],
  }));

  execFileSync(process.execPath, [path.join(repo, 'scripts/generators/build-fce-cards.cjs')], {cwd: repo, stdio: 'pipe', env: {
    ...process.env,
    TOF_RAW_GAME_DIR: raw,
    TOF_PUBLIC_DIR: publicDir,
    TOF_LEGACY_DIR: path.join(directory, 'legacy'),
    TOF_WEB_DIR: path.join(repo, 'apps/web'),
  }});

  const generated = JSON.parse(fs.readFileSync(output, 'utf8'));
  const card = generated.standard.find((entry: {slug: string}) => entry.slug === 'chaos-armor');
  expect(card.l10n).toEqual(cachedLocale);
  expect(card.last_phase).toEqual(cachedPhase);
  expect(generated.mmo).toEqual([{slug: 'cached-mmo', encounter: 'border-war'}]);
});
