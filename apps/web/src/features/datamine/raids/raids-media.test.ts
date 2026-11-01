import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterEach, expect, it} from 'vitest';

const repo = path.resolve(import.meta.dirname, '../../../../../..');
const scratch = path.join(repo, 'ignore', 'raid-media-tests');
const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0)) {
    if (!path.resolve(dir).startsWith(scratch + path.sep)) throw new Error('Fixture outside task scratch');
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

it('keeps exact raid asset references and resolves missing pixels on the next export', () => {
  fs.mkdirSync(scratch, {recursive: true});
  const dir = fs.mkdtempSync(path.join(scratch, 'case-'));
  roots.push(dir);
  const raw = path.join(dir, 'raw'), publicDir = path.join(dir, 'public');
  const write = (file: string, value: unknown) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, Buffer.isBuffer(value) ? value : JSON.stringify(value));
  };
  const dataset = path.join(publicDir, 'game-data/handbook/team-raids.json');
  write(dataset, {sources: {}, raids: [{id: 'raid', bosses: [{id: 'known'}], variants: [{id: 'heroic'}, {id: 'challenge'}, {id: 'missing'}]}]});
  const ref = (asset: string) => ({AssetPathName: `/Game/Test/${asset}.${asset}`});
  write(path.join(raw, 'Hotta/Content/Resources/CoreBlueprints/DataTable/LevelConfigDataTable.json'), [{Rows: {
    heroic: {LevyCloneLevelIcon: ref('Wrong'), JointOperationLevelIcon: ref('Wrong')},
    challenge: {LevyCloneLevelIcon: ref('Thumb'), JointOperationLevelIcon: ref('Title')},
  }}]);
  write(path.join(raw, 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/LevelConfigDataTable_Overseas.json'), [{Rows: {
    heroic: {LevyCloneLevelIcon: ref('Thumb'), JointOperationLevelIcon: {AssetPathName: 'None'}},
  }}]);
  const run = (check = false) => execFileSync(process.execPath, [path.join(repo, 'scripts/generators/build-handbook.cjs'), '--team-raids-media-only', ...(check ? ['--check'] : [])], {
    cwd: repo, env: {...process.env, TOF_PUBLIC_DIR: publicDir, TOF_RAW_GAME_DIR: raw}, stdio: 'pipe',
  });
  const read = () => JSON.parse(fs.readFileSync(dataset, 'utf8'));
  run();
  let data = read();
  expect(data.raids[0].variants[0].artwork).toMatchObject({thumbnail: null, title: null,
    expected: {thumbnail: '/game-assets/webp/Hotta/Content/Test/Thumb.webp', title: null},
    source: {row: 'heroic', file: expect.stringContaining('Overseas')}});
  expect(data.raids[0].variants[2].artwork.source).toBeNull();
  expect(data.raids[0].bosses).toEqual([{id: 'known'}]);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  for (const asset of ['Thumb', 'Title']) write(path.join(raw, `Hotta/Content/Test/${asset}.png`), png);
  run(); run(true);
  data = read();
  expect(data.raids[0].variants[0].artwork.thumbnail).toBe('/game-assets/webp/Hotta/Content/Test/Thumb.webp');
  expect(data.raids[0].variants[0].artwork.title).toBeNull();
  expect(data.raids[0].variants[1].artwork.title).toBe('/game-assets/webp/Hotta/Content/Test/Title.webp');
  expect(fs.existsSync(path.join(publicDir, data.raids[0].variants[1].artwork.title))).toBe(true);
});
