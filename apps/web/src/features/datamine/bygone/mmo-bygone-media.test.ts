import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterEach, expect, it} from 'vitest';

const repo = path.resolve(import.meta.dirname, '../../../../../..');
const scratch = path.join(repo, 'ignore', 'handbook-media-tests');
const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0)) {
    if (!path.resolve(dir).startsWith(scratch + path.sep)) throw new Error('Fixture outside task scratch');
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

function generate(monsters: unknown[], rows: Record<string, unknown>, images: string[], files: {raw?: Record<string, unknown>; generated?: Record<string, unknown>} = {}) {
  fs.mkdirSync(scratch, {recursive: true});
  const dir = fs.mkdtempSync(path.join(scratch, 'case-'));
  roots.push(dir);
  const publicDir = path.join(dir, 'public'), rawDir = path.join(dir, 'raw');
  const write = (file: string, content: string | Buffer) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, content);};
  write(path.join(publicDir, 'game-data/handbook/mmo-bygone.json'), JSON.stringify({rounds: [{rounds: [{pool: {monsters}}]}]}));
  write(path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable/OptionalBoss/DT_OptionalBossLevelConfig_BalanceServer.json'), JSON.stringify([{Rows: rows}]));
  for (const image of images) write(path.join(publicDir, 'game-assets/webp/Hotta/Content', image), 'test media fixture');
  for (const [file, value] of Object.entries(files.raw ?? {})) write(path.join(rawDir, file), Buffer.isBuffer(value) ? value : JSON.stringify(value));
  for (const [file, value] of Object.entries(files.generated ?? {})) write(path.join(publicDir, 'game-data', file), JSON.stringify(value));
  execFileSync(process.execPath, [path.join(repo, 'scripts/generators/build-handbook.cjs'), '--mmo-bygone-media-only'], {
    cwd: repo, env: {...process.env, TOF_PUBLIC_DIR: publicDir, TOF_RAW_GAME_DIR: rawDir}, stdio: 'pipe',
  });
  const result = JSON.parse(fs.readFileSync(path.join(publicDir, 'game-data/handbook/mmo-bygone-media.json'), 'utf8'));
  execFileSync(process.execPath, [path.join(repo, 'scripts/generators/build-handbook.cjs'), '--mmo-bygone-media-only', '--check'], {
    cwd: repo, env: {...process.env, TOF_PUBLIC_DIR: publicDir, TOF_RAW_GAME_DIR: rawDir}, stdio: 'pipe',
  });
  for (const portrait of Object.values(result.portraits) as {thumbnail: string; full: string}[]) {
    expect(fs.existsSync(path.join(publicDir, portrait.thumbnail))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, portrait.full))).toBe(true);
  }
  // A media/identity repair must preserve the original combat snapshot.
  expect(JSON.parse(fs.readFileSync(path.join(publicDir, 'game-data/handbook/mmo-bygone.json'), 'utf8'))).toEqual({rounds: [{rounds: [{pool: {monsters}}]}]});
  return result;
}

it('assigns pod artwork only to its exact primary class, without borrowing it for adds or variants', () => {
  const primary = '/Game/Test/Main.Main_C', add = '/Game/Test/Add.Add_C', variant = '/Game/Test/Variant.Variant_C';
  const {portraits} = generate([
    {classPath: primary, count: 1}, {classPath: add, count: 2},
    {classPath: variant, count: 1, localizedNameKey: 'primary_variant'}, {classPath: null, count: 1},
  ], {Pod: {
    BossName: {Key: 'primary'}, BossIcon: {AssetPathName: '/Game/Test/Portrait.Portrait'},
    PoolMonstersByWave: [{PoolMonsters: [
      {MonsterClass: {AssetPathName: primary}, MonsterName: {Key: 'primary'}},
      {MonsterClass: {AssetPathName: add}, MonsterName: {Key: 'add'}},
    ]}],
  }}, ['Test/Portrait.webp']);
  expect(Object.keys(portraits)).toEqual([primary]);
  expect(portraits[primary].thumbnail).toBe('/game-assets/webp/Hotta/Content/Test/Portrait.webp');
  expect(portraits[primary].source.row).toBe('Pod');
});

it('uses only a published exact actor-key image and preserves variant suffixes', () => {
  const {portraits} = generate([
    {classPath: '/Game/Test/Exact.Exact_C', localizedNameKey: 'enemy_exact', count: 1},
    {classPath: '/Game/Test/Variant.Variant_C', localizedNameKey: 'enemy_exact_variant', count: 1},
    {classPath: '/Game/Test/Missing.Missing_C', localizedNameKey: 'missing', count: 1},
  ], {}, ['Resources/UI/void/boss/enemy_exact.webp']);
  expect(Object.keys(portraits)).toEqual(['/Game/Test/Exact.Exact_C']);
  expect(portraits['/Game/Test/Exact.Exact_C'].source.actorKey).toBe('enemy_exact');
});

it('resolves exact localized actor keys without case sensitivity and follows exported ancestors without trimming variants', () => {
  const variant = '/Game/Test/Variant.Variant_C';
  const {identities, portraits} = generate([
    {classPath: variant, count: 1, localizedNameKey: 'technical_variant'},
    {classPath: '/Game/Test/NoParent.NoParent_C', count: 1, localizedNameKey: 'enemy_exact_variant'},
    {classPath: '/Game/Test/Case.Case_C', count: 1, localizedNameKey: 'enemy_captain'},
    {classPath: '/Game/Test/Ambiguous.Ambiguous_C', count: 1, localizedNameKey: 'AMBIGUOUS'},
  ], {}, ['Resources/UI/void/boss/enemy_exact.webp'], {raw: {
    'Hotta/Content/Localization/Game/en/Game.json': {ST_actorname: {Enemy_Exact: 'Exact enemy', Enemy_Captain: 'Captain', Ambiguous: 'Alpha', ambiguous: 'Beta'}},
    'Hotta/Content/Localization/Game/ru/Game.json': {ST_actorname: {Enemy_Exact: 'Точный противник', Enemy_Captain: 'Капитан'}},
    'Hotta/Content/Test/Variant.json': [{Type: 'BlueprintGeneratedClass', Super: {ObjectPath: 'Hotta/Content/Test/Enemy_Exact.0'}}],
    // A cycle must terminate, while preserving the exact exported parent edge.
    'Hotta/Content/Test/Enemy_Exact.json': [{Type: 'BlueprintGeneratedClass', Super: {ObjectPath: 'Hotta/Content/Test/Variant.0'}}],
  }});
  expect(identities[variant].name).toEqual({en: 'Exact enemy', ru: 'Точный противник'});
  expect(portraits[variant].source.actorKey).toBe('Enemy_Exact');
  expect(identities['/Game/Test/Case.Case_C'].name.en).toBe('Captain');
  expect(identities['/Game/Test/NoParent.NoParent_C'].name).toBeNull();
  expect(portraits['/Game/Test/NoParent.NoParent_C']).toBeUndefined();
  expect(identities['/Game/Test/Ambiguous.Ambiguous_C'].name).toBeNull();
});

it('reuses confirmed OOW identity and art only for the identical full class path', () => {
  const exact = '/Game/Test/Exact.Exact_C', other = '/Game/Other/Exact.Exact_C';
  const {identities, portraits} = generate([{classPath: exact, count: 1}, {classPath: other, count: 1}], {}, ['Test/art.webp'], {generated: {
    'en/oow/seasons/mmo_s01.json': {floors: [{floor: 9, enemies: [{monsterClass: exact, key: 'test-key', nameEn: 'Known enemy', nameRu: 'Известный противник', imageMatchStatus: 'confirmed', image: '/game-assets/webp/Hotta/Content/Test/art.webp', hp: 999999999}]}]},
  }});
  expect(identities[exact].name).toEqual({en: 'Known enemy', ru: 'Известный противник'});
  expect(portraits[exact].source.key).toBe('test-key');
  expect(identities[exact].hp).toBeUndefined();
  expect(identities[other].name).toBeNull();
  expect(portraits[other]).toBeUndefined();
});

it('converts newly extracted exact actor PNGs during the same run, before their WebP exists', () => {
  const classPath = '/Game/Test/NewEnemy.NewEnemy_C';
  const {portraits} = generate([{classPath, count: 1, localizedNameKey: 'new_enemy'}], {}, [], {raw: {
    'Hotta/Content/Resources/UI/void/boss/new_enemy.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  }});
  expect(portraits[classPath].full).toBe('/game-assets/webp/Hotta/Content/Resources/UI/void/boss/new_enemy.webp');
  expect(portraits[classPath].source.file).toBe('Hotta/Content/Resources/UI/void/boss/new_enemy.png');
});

it('reuses a confirmed mapping for the exact recorded parent basename, including case variants', () => {
  const {portraits} = generate([
    {classPath: '/Game/Test/Child.Child_C', count: 1, localizedNameKey: 'MON_HUM_101_CAPTAIN_KUANGBAO'},
    {classPath: '/Game/Test/Other.Other_C', count: 1, localizedNameKey: 'mon_hum_101_captain_kuangbao_variant'},
  ], {}, ['Resources/UI/void/boss/mon_hum_101.webp']);
  expect(Object.keys(portraits)).toEqual(['/Game/Test/Child.Child_C']);
  expect(portraits['/Game/Test/Child.Child_C'].source.snapshotParentKey).toBe('MON_HUM_101_CAPTAIN_KUANGBAO');
});

it('joins a Bygone variant to primary artwork through its exact exported actor key', () => {
  const variant = '/Game/Test/Variant.Variant_C';
  const {portraits} = generate([
    {classPath: variant, count: 1, localizedNameKey: 'Primary'},
    {classPath: '/Game/Test/Other.Other_C', count: 1, localizedNameKey: 'Primary_variant'},
  ], {Pod: {
    BossName: {Key: 'primary'}, BossIcon: {AssetPathName: '/Game/Test/Portrait.Portrait'},
    PoolMonstersByWave: [{PoolMonsters: [{MonsterClass: {AssetPathName: '/Game/Test/Main.Main_C'}, MonsterName: {Key: 'primary'}}]}],
  }}, ['Test/Portrait.webp']);
  expect(Object.keys(portraits)).toEqual([variant]);
  expect(portraits[variant].source.join).toBe('exact actor key');
  expect(portraits[variant].source.actorKey).toBe('primary');
});
