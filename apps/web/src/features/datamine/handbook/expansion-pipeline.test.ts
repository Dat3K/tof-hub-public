// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {afterEach, expect, it} from 'vitest';

const repo = path.resolve(import.meta.dirname, '../../../../../..');
const scratch = path.join(repo, 'ignore/mmo-expansion/pipeline-tests');
const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0)) {
    if (!path.resolve(dir).startsWith(scratch + path.sep)) throw Error('Fixture outside task scratch');
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

async function fixture() {
  fs.mkdirSync(scratch, {recursive: true});
  const dir = fs.mkdtempSync(path.join(scratch, 'case-'));
  roots.push(dir);
  const raw = path.join(dir, 'raw'), publicDir = path.join(dir, 'public');
  const cb = 'Hotta/Content/Resources/CoreBlueprints/';
  const write = (relative: string, data: unknown) => {
    const file = path.join(raw, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(data));
  };
  const table = (relative: string, rows: unknown) => write(cb + relative + '.json', [{Rows: rows}]);
  const ref = (name: string) => ({AssetPathName: `/Game/Resources/CoreBlueprints/Fixture/${name}.${name}`});
  const text = (key: string, source = key) => ({Namespace: 'Fixture', Key: key, SourceString: source});
  const none = {AssetPathName: 'None'};
  const curve = {Value: 100, Curve: {CurveTable: {ObjectPath: cb + 'Fixture/FutureCurves.0'}, RowName: 'future'}};
  write(cb + 'DataTable_MMO/DA_Equipment_MMO.json', [{Properties: {
    MMOEquipSlotDataTable: ref('Slots'), MMOEquipSlotSkillDataTable: ref('Cards'),
    MMOEquipSlotSkillAttributeDataTable: ref('Stars'), MMOEquipSlotSkillCoefficientDataTable: ref('Coefficients'),
    MMOEquipSeasonDataTable: ref('Seasons'),
  }}]);
  const slot = {Slot: 'EQUIPMENT_SLOT_FIXTURE', SlotIcon: none, WidgetSlotIcon: none,
    SlotName: text('slot', '测试附魔卡1'), SkillBankNumber: 4, SeasonSkillBankNumber: 2};
  table('Fixture/Slots', {fixtureSlot: slot});
  const card = {SkillName: text('card'), SkillIcon: {AssetPathName: '/Game/Resources/Icon/chajian/FutureSeason/new_card.new_card'},
    SkillQuality: 'ITEM_QUALITY_RARE', SeasonIndex: 19, bSeasonExclusiveSkill: true,
    OwnSlotDatas: ['EQUIPMENT_SLOT_NONE'], ValidSeasonData: [19], SkillBaseAttributeID: 'futureStats',
    SkillDetail: text('effect'), SkillStarsParam: [curve], MaxStarLevel: 1, BuffMaxSuitAmount: 2,
    SkillBookItemID: 'futureItem', StarLevelUpgradeAmount: [7], BuffObjectArray: []};
  table('Fixture/Cards', {futureCard: card});
  table('Fixture/Stars', {futureStats_0: {ModifyData: [{PropName: 'FixtureStat', PropValue: 2}]},
    futureStats_1: {ModifyData: [{PropName: 'FixtureStat', PropValue: 3}]}});
  table('Fixture/Coefficients', {FixtureStat: {LevelCoefficient: {...curve, Value: 1}}});
  const keys = {InterpMode: 'RCIM_Linear', Keys: [{Time: 1, Value: 1}, {Time: 2, Value: 2}]};
  table('Fixture/FutureCurves', {future: keys});
  table('Fixture/Seasons', {'19': {SeasonIndex: 19, SeasonName: text('season')}});
  table('DataTable_MMO/DT_MMOServerSeason', {});
  table('DataTable_MMO/AttributeStaticDataTable_MMO', {FixtureStat: {AttributeText: text('stat'), AttributeIcon: none, bShowPercent: false}});
  const item = {ItemName: text('card'), ItemIcon: none, Description: text('item'),
    UseDescription: text('use', '拓展包(可在<Blue>测试</>部位镶嵌)：')};
  table('DataTable/Item/ItemConfigs', {futureItem: item});
  for (const locale of ['en', 'ru']) write(`Hotta/Content/Localization/Game/${locale}/Game.json`, {
    Fixture: {card: 'Future pack', effect: '<shuzhi>{0}%</>', stat: 'Fixture stat', season: 'Future season',
      use: 'Pack (installation: <Blue>Fixture slot</>)'},
    QRSLCommon_ST: {EQUIPMENT_SLOT_FIXTURE: 'Fixture slot'},
  });
  const pngPath = 'Hotta/Content/Resources/Icon/chajian/FutureSeason/new_card.png';
  fs.mkdirSync(path.dirname(path.join(raw, pngPath)), {recursive: true});
  const requireWeb = createRequire(path.join(repo, 'apps/web/package.json'));
  await requireWeb('sharp')({create: {width: 1, height: 1, channels: 4, background: '#ffffff'}}).png().toFile(path.join(raw, pngPath));
  const file = path.join(publicDir, 'game-data/handbook/mmo-expansion.json');
  const env = {...process.env, TOF_RAW_GAME_DIR: raw, TOF_PUBLIC_DIR: publicDir, TOF_WEB_DIR: path.join(repo, 'apps/web')};
  const run = (args: string[] = [], script = path.join(repo, 'scripts/generators/build-mmo-card.cjs')) =>
    execFileSync(process.execPath, [script, '--expansion-only', ...args], {cwd: repo, env, stdio: 'pipe'});
  return {dir, raw, publicDir, file, card, slot, table, run, read: () => JSON.parse(fs.readFileSync(file, 'utf8'))};
}

it('generates a future season, bound table paths, text-derived slots and new media in an empty output tree', async () => {
  const f = await fixture();
  f.run();
  f.run(['--check']);
  const data = f.read();
  expect(data.seasons).toEqual([{index: 19, name: {en: 'Future season', ru: 'Future season'}}]);
  expect(data.cards[0]).toMatchObject({id: 'futureCard', season: 19, slots: ['fixtureSlot'], maxStars: 1,
    slotEvidence: {kind: 'item-description', rawSlots: ['EQUIPMENT_SLOT_NONE']},
    stats: [{prop: 'FixtureStat', values: [2, 3]}], validSeasons: [19], upgradeAmounts: [7]});
  expect(data.sources['Hotta/Content/Resources/CoreBlueprints/Fixture/FutureCurves.json'].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(fs.existsSync(path.join(f.publicDir, data.cards[0].icon))).toBe(true);
  expect(fs.existsSync(path.join(f.publicDir, 'game-data/build-mmo-page.json'))).toBe(false);
  // Portable packaging bundles the same entry point, including its shared CJS projection.
  const require = createRequire(path.join(repo, 'tools/patch-exporter/package.json'));
  const bundle = path.join(f.dir, 'generators/build-mmo-card.cjs');
  require('esbuild').buildSync({entryPoints: [path.join(repo, 'scripts/generators/build-mmo-card.cjs')], outfile: bundle,
    bundle: true, platform: 'node', format: 'cjs', external: ['sharp', 'next']});
  f.run(['--check'], bundle);
  // The real second-pass reference scanner and update packager must see both
  // the generated dataset and the new-season image, without a warm public tree.
  execFileSync(process.execPath, ['--import', 'tsx', '-e', `
    const assert = require('node:assert/strict'), path = require('node:path');
    const {findReferencedPngFiles} = require('./tools/patch-exporter/src/media-exporter.ts');
    const {buildReleasePackage} = require('./tools/patch-exporter/src/release-package.ts');
    const [raw, publicDir, out] = process.argv.slice(1);
    assert.equal(findReferencedPngFiles(raw, path.join(publicDir, 'game-data')).length, 1);
    buildReleasePackage({publicDir, outFile: out, jobs: 1}).then(({manifest}) => {
      assert.ok(manifest.files['game-data/handbook/mmo-expansion.json']);
      assert.ok(manifest.files['game-assets/webp/Hotta/Content/Resources/Icon/chajian/FutureSeason/new_card.webp']);
    }).catch(error => {console.error(error); process.exitCode = 1;});
  `, f.raw, f.publicDir, path.join(f.dir, 'release/update.zip')], {cwd: repo, stdio: 'pipe'});
}, 30000);

it('retains unknown slots and unnamed season indexes, and reports ambiguous text instead of guessing', async () => {
  const f = await fixture();
  f.table('Fixture/Seasons', {});
  f.table('Fixture/Cards', {futureCard: {...f.card, OwnSlotDatas: ['EQUIPMENT_SLOT_FUTURE_UNKNOWN']}});
  f.run();
  expect(f.read().cards[0].slots).toEqual([]);
  expect(f.read().coverage).toMatchObject({cards: 1, missingSlots: ['futureCard'],
    unknownSlotEnums: [{card: 'futureCard', values: ['EQUIPMENT_SLOT_FUTURE_UNKNOWN']}]});
  expect(f.read().seasons).toEqual([{index: 19, name: null}]);
  f.table('Fixture/Cards', {futureCard: f.card});
  f.table('Fixture/Slots', {fixtureSlot: f.slot, other: {...f.slot, Slot: 'EQUIPMENT_SLOT_OTHER'}});
  f.run();
  expect(f.read().cards[0].slotEvidence.kind).toBe('unresolved');
}, 30000);

it('fails on an unsupported curve without overwriting the last valid output', async () => {
  const f = await fixture(); f.run();
  const before = fs.readFileSync(f.file, 'utf8');
  f.table('Fixture/FutureCurves', {future: {InterpMode: 'RCIM_Cubic', Keys: [{Time: 1, Value: 2}]}});
  expect(() => f.run()).toThrow();
  expect(fs.readFileSync(f.file, 'utf8')).toBe(before);
}, 30000);

it('uses Gacha gear names and normal icons by raw slot enum instead of matching project slot ids', async () => {
  const f = await fixture();
  const url = '/game-assets/webp/Hotta/Content/Fixture/shared-gear.webp';
  const target = path.join(f.publicDir, url);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  const requireWeb = createRequire(path.join(repo, 'apps/web/package.json'));
  await requireWeb('sharp')({create: {width: 1, height: 1, channels: 4, background: '#ffffff'}}).webp().toFile(target);
  fs.mkdirSync(path.join(f.publicDir, 'game-data'), {recursive: true});
  fs.writeFileSync(path.join(f.publicDir, 'game-data/build-gear-icons.json'), JSON.stringify({gear: {
    differentProjectSlotId: {slot: f.slot.Slot, icons: {normal: url}},
  }}));
  const name = {en: 'Shared slot', ru: 'Общий слот'};
  fs.writeFileSync(path.join(f.publicDir, 'game-data/build-page.json'), JSON.stringify({gear: [
    {id: 'differentProjectSlotId', name},
  ]}));
  f.run(); f.run(['--check']);
  expect(f.read().slots[0]).toMatchObject({id: 'fixtureSlot', icon: url, name,
    nameSources: {en: {path: 'game-data/build-page.json', row: 'differentProjectSlotId', field: 'gear[].name.en'}},
    iconSource: {kind: 'shared-gear', row: 'differentProjectSlotId', field: 'icons.normal'}});
  expect(f.read().sources['game-data/build-gear-icons.json'].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(f.read().sources['game-data/build-page.json'].sha256).toMatch(/^[a-f0-9]{64}$/);
}, 30000);
