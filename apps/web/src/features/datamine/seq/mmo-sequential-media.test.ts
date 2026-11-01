import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterEach, expect, it} from 'vitest';

const repo = path.resolve(import.meta.dirname, '../../../../../..');
const scratch = path.join(repo, 'ignore', 'sequential-media-tests');
const roots: string[] = [];
const actor = (key = 'alpha', table = 'Actor') => ({TableId: `/Game/Text/${table}.${table}`, Key: key});
const monster = (className = 'Main', name = actor()) => ({MonsterName: name, MonsterClass: {AssetPathName: `/Game/Test/${className}.${className}_C`}});
const level = (image?: string) => ({
  BossName: actor(), BossIcon: {AssetPathName: image ? `/Game/Test/${image}.${image}` : 'None'},
  PoolMonstersByWave: [{PoolMonsters: [monster()]}],
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

afterEach(() => {
  for (const directory of roots.splice(0)) {
    if (!path.resolve(directory).startsWith(scratch + path.sep)) throw new Error('Fixture outside task scratch');
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

function generate(levels: Record<string, unknown>, images: string[], names = [{en: 'Alpha', ru: 'Альфа'}]) {
  fs.mkdirSync(scratch, {recursive: true});
  const directory = fs.mkdtempSync(path.join(scratch, 'case-'));
  roots.push(directory);
  const publicDir = path.join(directory, 'public'), rawDir = path.join(directory, 'raw');
  const write = (file: string, content: unknown) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, Buffer.isBuffer(content) ? content : JSON.stringify(content));
  };
  const snapshot = {seasons: [{levels: [{id: 'Target', featuredName: names[0], waves: [{index: 1, enemies: names.map(name => ({name}))}]}]}]};
  const snapshotFile = path.join(publicDir, 'game-data/handbook/biochemical-collapse.json');
  write(snapshotFile, snapshot);
  write(path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OptionalBossDataAsset_MMO.json'), [{
    Name: 'OptionalBossDataAsset_MMO', Properties: {LevelConfigDataTable_BalanceServer: {AssetPathName: '/Game/Test/Levels.Levels'}},
  }]);
  write(path.join(rawDir, 'Hotta/Content/Test/Levels.json'), [{Rows: levels}]);
  for (const [locale, alpha] of [['en', 'Alpha'], ['ru', 'Альфа']]) {
    write(path.join(rawDir, `Hotta/Content/Localization/Game/${locale}/Game.json`), {Actor: {alpha}, OtherActor: {alpha}});
  }
  for (const image of images) write(path.join(rawDir, `Hotta/Content/Test/${image}.png`), png);
  const run = (check = false) => execFileSync(process.execPath, [path.join(repo, 'scripts/generators/build-handbook.cjs'), '--biochemical-media-only', ...(check ? ['--check'] : [])], {
    cwd: repo, env: {...process.env, TOF_PUBLIC_DIR: publicDir, TOF_RAW_GAME_DIR: rawDir}, stdio: 'pipe',
  });
  run();
  run(true);
  expect(JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))).toEqual(snapshot);
  const result = JSON.parse(fs.readFileSync(path.join(publicDir, 'game-data/handbook/biochemical-collapse-media.json'), 'utf8'));
  for (const enemy of Object.values(result.pods.Target.enemies) as {portrait: string}[]) {
    expect(fs.existsSync(path.join(publicDir, enemy.portrait))).toBe(true);
  }
  return result;
}

it('converts cross-season full artwork only for the exact actor table/key and full class', () => {
  const target = {PoolMonstersByWave: [{PoolMonsters: [monster(), monster('Variant'), monster('Main', actor('alpha', 'OtherActor'))]}]};
  const names = Array.from({length: 3}, () => ({en: 'Alpha', ru: 'Альфа'}));
  const {pods, sources} = generate({Target: target, Donor: level('Full')}, ['Full'], names);
  expect(Object.keys(pods.Target.enemies)).toEqual(['1:0']);
  expect(pods.Target.portrait).toBe('/game-assets/webp/Hotta/Content/Test/Full.webp');
  expect(pods.Target.enemies['1:0'].portraitFit).toBe('contain');
  expect(pods.Target.enemies['1:0'].source.artworkSource).toEqual({file: 'Hotta/Content/Test/Levels.json', row: 'Donor', field: 'BossIcon'});
  expect(sources['Hotta/Content/Test/Full.png'].sha256).toMatch(/^[a-f0-9]{64}$/);
});

it('keeps the local full artwork when other seasons offer different artwork', () => {
  const {pods} = generate({Target: level('Local'), Donor: level('Full')}, ['Local', 'Full']);
  expect(pods.Target.portrait).toBe('/game-assets/webp/Hotta/Content/Test/Local.webp');
  expect(pods.Target.enemies['1:0'].source.artworkSource).toBeUndefined();
});

it('leaves conflicting cross-season associations unresolved', () => {
  const {pods} = generate({Target: level(), First: level('One'), Second: level('Two')}, ['One', 'Two']);
  expect(pods.Target.portrait).toBeNull();
  expect(pods.Target.enemies).toEqual({});
});

it('does not attach another snapshot identity to an otherwise matching raw slot', () => {
  const {pods} = generate({Target: level(), Donor: level('Full')}, ['Full'], [{en: 'Different enemy', ru: 'Другой противник'}]);
  expect(pods.Target.portrait).toBeNull();
  expect(pods.Target.enemies).toEqual({});
});
