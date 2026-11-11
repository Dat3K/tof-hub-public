import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterEach, expect, it} from 'vitest';

const repo = path.resolve(import.meta.dirname, '../../../../../..');
const scratch = path.join(repo, 'ignore', 'bygone-hp', 'pipeline-tests');
const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0)) {
    if (!path.resolve(dir).startsWith(scratch + path.sep)) throw Error('Fixture outside task scratch');
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

function fixture() {
  fs.mkdirSync(scratch, {recursive: true});
  const dir = fs.mkdtempSync(path.join(scratch, 'case-'));
  roots.push(dir);
  const raw = path.join(dir, 'raw'), publicDir = path.join(dir, 'public');
  const file = path.join(publicDir, 'game-data/handbook/mmo-bygone.json');
  const write = (relative: string, data: unknown) => {
    const target = path.join(raw, relative);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, JSON.stringify(data));
  };
  const ref = (name: string) => ({AssetPathName: `/Game/Test/${name}.${name}`});
  const table = (name: string, rows: unknown) => write(`Hotta/Content/Test/${name}.json`, [{Rows: rows}]);
  write('Hotta/Content/Resources/CoreBlueprints/GameMode/MMO/BP_GameData_MMO_Base.json', [{Name: 'Default__BP_GameData_MMO_Base_C', Properties: {
    BigSecretSeasonRoundDataTable: ref('Seasons'), BigSecretMonsterPoolDataTable: ref('Pools'),
    BigSecretBaseDataTable: ref('Base'), BigSecretRoundPassRewardDataTable: ref('Rewards'),
    BigSecretServerMonsterRoundBufferDataTable: ref('Buffers'), MonsterDataTable: ref('Static'),
  }}]);
  write('Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/BigSecret/BigSecretDataAsset_MMO.json', [{Name: 'BigSecretDataAsset_MMO', Properties: {
    BigSecretBalanceRoundDataTable: ref('Rounds'), BigSecretCommonRoundDataTable: ref('Common'),
  }}]);
  for (const locale of ['en', 'ru']) write(`Hotta/Content/Localization/Game/${locale}/Game.json`, {});
  table('Seasons', {fixture: {OneSeasonRounds: Array.from({length: 200}, (_, index) => ({RoundIndex: index + 1}))}});
  const range = (floor: number) => ({LowerBound: {Type: 'ERangeBoundTypes::Inclusive', Value: floor}, UpperBound: {Type: 'ERangeBoundTypes::Inclusive', Value: floor}});
  table('Pools', Object.fromEntries(Array.from({length: 200}, (_, index) => [index + 1, {
    PoolID: index + 1, RoundRange: range(index + 1), RoundMonsters: [
      {MonsterClass: {AssetPathName: '/Game/Test/Boss.Boss_C'}, MonsterCount: index % 2 + 1},
      {MonsterClass: {AssetPathName: 'None'}, MonsterCount: 2},
      ...(index === 7 ? [{MonsterClass: {AssetPathName: '/Game/Test/MissingStats.MissingStats_C'}, MonsterCount: 1}] : []),
    ],
  }])));
  write('Hotta/Content/Test/Boss.json', [{Type: 'BlueprintGeneratedClass', Super: {ObjectPath: 'Hotta/Content/Test/Parent.0'}}, {Name: 'Default__Boss_C', Properties: {}}]);
  write('Hotta/Content/Test/Parent.json', [{Name: 'Default__Parent_C', Properties: {AttributeID: 'fixture_boss'}}]);
  write('Hotta/Content/Test/MissingStats.json', [{Name: 'Default__MissingStats_C', Properties: {AttributeID: 'missing'}}]);
  table('Static', {fixture_boss: {MaxHealth: 321101.8, CommonAtkBase: 12}});
  table('Base', {'1': {}});
  for (const name of ['Rewards', 'Rounds', 'Common']) table(name, {});
  const curve = (keys: [number, number][]) => ({InterpMode: 'RCIM_Linear', Keys: keys.map(([Time, Value]) => ({Time, Value}))});
  // The bound HP curve is intentionally separate from the level table's decoy row.
  table('Curves', {MonsterLevel: curve([[1, 20], [200, 85]]), HpBuffCount: curve([[1, 9999], [200, 9999]])});
  table('HpCurves', {HpBuffCount: curve([[1, 0], [2, 1.7309821], [7, 4.2275], [200, 4688.853]])});
  const hpBuff = {Key: '4', Value: {BuffRoudValue: {CurveTable: {ObjectPath: 'Hotta/Content/Test/HpCurves.0'}, RowName: 'HpBuffCount'},
    BuffID: {AssetPathName: '/Game/Resources/Abilities/Buff/MonsterWeaknessBuff/BigSecret/Buff_BigSecret_AddHp001.Buff_BigSecret_AddHp001_C'},
    BuffCount: 1, bBuffLevelUseSceneLevel: false}};
  const buffers = {NewRow: {MonsterLevelValue: {CurveTable: {ObjectPath: 'Hotta/Content/Test/Curves.0'}}, RoundBuffs: [hpBuff]}};
  table('Buffers', buffers);
  const run = (args = ['--mmo-bygone-only'], rawDir = raw) => execFileSync(process.execPath, [path.join(repo, 'scripts/generators/build-handbook.cjs'), ...args], {
    cwd: repo, env: {...process.env, TOF_PUBLIC_DIR: publicDir, TOF_RAW_GAME_DIR: rawDir}, stdio: 'pipe',
  });
  return {raw, file, table, buffers, run, read: () => JSON.parse(fs.readFileSync(file, 'utf8'))};
}

it('materializes a tagged defense estimate only for consistent bound defense curves', () => {
  const f = fixture();
  f.table('Static', {fixture_boss: {MaxHealth: 321101.8, CommonAtkBase: 12, PhyDefBase: 1, FireDefBase: 1,
    IceDefBase: 1, ThunderDefBase: 1, SuperpowerDefBase: 1}});
  f.table('Curves', {MonsterLevel: {InterpMode: 'RCIM_Linear', Keys: [{Time: 1, Value: 85}]},
    DefBuffCount: {InterpMode: 'RCIM_Linear', Keys: [{Time: 1, Value: 11376.15}]}});
  const defense = {Key: '5', Value: {BuffRoudValue: {CurveTable: {ObjectPath: 'Hotta/Content/Test/Curves.0'}, RowName: 'DefBuffCount'},
    BuffID: {AssetPathName: '/Game/Resources/Abilities_Balance/Buff/MonsterWeaknessBuff/BigSecret/Buff_BigSecret_AddCommonDef_Balance.Buff_BigSecret_AddCommonDef_Balance_C'},
    BuffCount: 1, bBuffLevelUseSceneLevel: false}};
  f.table('Buffers', {NewRow: {...f.buffers.NewRow, RoundBuffs: [...f.buffers.NewRow.RoundBuffs, defense]}});
  f.run();
  const monsters = f.read().rounds[0].rounds[199].pool.monsters;
  expect(monsters[0].defenseEstimate).toMatchObject({verified: false, model: 'base-plus-whole-defense-stacks', stacks: 11376,
    values: {physical: 11377, flame: 11377, frost: 11377, volt: 11377, altered: 11377}});
  expect(monsters[0].stats.physical).toBe(1);
  expect(monsters[1].defenseEstimate).toBeNull();
  f.table('Buffers', {NewRow: {...f.buffers.NewRow, RoundBuffs: [...f.buffers.NewRow.RoundBuffs, {...defense, Value: {...defense.Value, BuffCount: 2}}]}});
  f.run();
  expect(f.read().rounds[0].rounds[199].pool.monsters[0].defenseEstimate).toBeNull();
});

it('generates all 200 floors from bound raw curves and inherited stat rows, preserving bases and unknowns', () => {
  const f = fixture(); f.run(); f.run(['--mmo-bygone-only', '--check']);
  const data = f.read(), rounds = data.rounds[0].rounds;
  expect(rounds).toHaveLength(200);
  expect(rounds[6].hpScaling).toEqual({curveValue: 4.2275, stacks: 4, multiplier: 5});
  expect(rounds[6].pool.monsters[0].hp).toBe(1605509);
  expect(rounds[6].pool.monsters[0].stats.maxHealth).toBe(321101.8);
  expect(rounds[6].pool.monsters[0].stats.attack).toBe(12);
  expect(rounds[0].pool.monsters[0].hp).toBe(321101.8);
  expect(rounds[199].hpScaling.stacks).toBe(4688);
  expect(rounds[7].pool.monsters[2].hp).toBeNull();
  expect(rounds.every((r: any) => r.pool.monsters[1].hp === null)).toBe(true);
  expect(data.sources['Hotta/Content/Test/HpCurves.json'].sha256).toHaveLength(64);
  expect(data.sources['Hotta/Content/Test/Parent.json'].sha256).toHaveLength(64);
  expect(rounds[6].pool.monsters[0].source.attributeRow).toBe('fixture_boss');
  const before = fs.readFileSync(f.file, 'utf8');
  f.run(['--mmo-bygone-hp-only'], path.join(f.raw, 'unavailable-other-export'));
  expect(fs.readFileSync(f.file, 'utf8')).toBe(before);
  f.run(['--mmo-bygone-hp-only', '--check'], path.join(f.raw, 'unavailable-other-export'));
  fs.unlinkSync(path.join(f.raw, 'Hotta/Content/Test/Boss.json'));
  expect(() => f.run()).toThrow();
  expect(fs.readFileSync(f.file, 'utf8')).toBe(before);
}, 30_000);

it('does not publish baseline HP as calculated HP when the curve or server-group application is unsupported', () => {
  const f = fixture();
  f.table('HpCurves', {HpBuffCount: {InterpMode: 'RCIM_Cubic', Keys: [{Time: 1, Value: 4}]}});
  f.run();
  expect(f.read().rounds[0].rounds[6].hpScaling).toBeNull();
  expect(f.read().rounds[0].rounds[6].pool.monsters[0].hp).toBeNull();
  f.table('HpCurves', {HpBuffCount: {InterpMode: 'RCIM_Linear', Keys: [{Time: 1, Value: 4.2275}]}});
  f.table('Buffers', {...f.buffers, OtherGroup: {RoundBuffs: [{...f.buffers.NewRow.RoundBuffs[0], Value: {...f.buffers.NewRow.RoundBuffs[0].Value, BuffCount: 2}}]}});
  f.run();
  expect(f.read().rounds[0].rounds[6].hpScaling).toBeNull();
  expect(f.read().rounds[0].rounds[6].pool.monsters[0].hp).toBeNull();
});
