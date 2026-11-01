import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadExportRules,
  filterRulesByMode,
  getExportPathsForMode,
  getExcludePathsForMode,
  generateUnrealExporterConfig,
  validateExportRequirements,
  type SelectiveRule,
} from '../selective-list';
import { declaredTablePaths, referencedSiteTextures } from '../../scripts/generate-export-rules';
import { SITE_GENERATORS } from '../pipeline-run';

test('Selective List: loads authoritative rules from config', () => {
  const config = loadExportRules();
  assert.equal(config.name, 'tof-exporter-rules');
  assert.equal(config.defaultEngineVersion, 'TowerOfFantasy');
  assert.equal(typeof config.defaultAesKey, 'string'); // Supplied separately by bootstrap or --aes-key.
  assert.ok(config.rules.length >= 160, `Expected at least 160 selective rules, got ${config.rules.length}`);
  assert.ok(config.requirements.length >= 10, 'Expected at least 10 core requirements');
  assert.ok(config.imageRequirementGroups.length >= 3, 'Expected at least 3 image requirement groups');
});

test('Selective List: keeps both OOW enemy image sources in Small exports', () => {
  const config = loadExportRules();
  const smallPaths = getExportPathsForMode(config.rules, 'Small');

  assert.ok(smallPaths.includes('Hotta/Content/Resources/UI/void/boss/.*\\.uasset:png'));
  assert.ok(smallPaths.includes('Hotta/Content/Resources/UI/SHTT/guaiwu/.*\\.uasset:png'));
});

test('MMO expansion extraction includes future card, effect-curve and artwork subfolders', () => {
  const config = loadExportRules();
  const files = [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/EquipmentSlot/S99/SkillConfig.uasset:json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/EffectFigure/S99/CardCurve.uasset:json',
    'Hotta/Content/Resources/Icon/chajian/S99/new_card.uasset:png',
    'Hotta/Content/Resources/UI/qianghua/TuoZhan_MMO/S99/new_frame.uasset:png',
  ];
  const full = getExportPathsForMode(config.rules, 'Full').map(pattern => new RegExp(pattern, 'i'));
  for (const file of files) assert.ok(full.some(pattern => pattern.test(file)), file);
});

test('selective game extraction covers every declared enemy portrait PNG package', () => {
  const config = loadExportRules();
  const mappings = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../../../../scripts/game-processors/processors/monster-image-mapping.json'), 'utf8'));
  const packages = new Set((Object.values(mappings) as Array<{ normalizedPackagePath?: string }>)
    .map((entry) => entry.normalizedPackagePath).filter(Boolean));
  assert.ok(packages.size > 0);
  for (const mode of ['Full', 'Pic'] as const) {
    const patterns = getExportPathsForMode(config.rules, mode).filter((rule) => rule.endsWith(':png'))
      .map((rule) => new RegExp(rule, 'i'));
    for (const packagePath of packages) {
      assert.ok(patterns.some((pattern) => pattern.test(`${packagePath}.uasset:png`)), `${mode} misses ${packagePath}`);
    }
  }
});

test('selective extraction covers every occupied MMO Bygone class and its parent families', () => {
  const config = loadExportRules();
  const patterns = getExportPathsForMode(config.rules, 'Full').filter(rule => rule.endsWith(':json')).map(rule => new RegExp(rule, 'i'));
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../../../../apps/web/public/game-data/handbook/mmo-bygone.json'), 'utf8'));
  const classes = new Set<string>();
  for (const season of data.rounds) for (const round of season.rounds) for (const enemy of round.pool?.monsters ?? []) {
    if (enemy.classPath && enemy.count > 0) classes.add(enemy.classPath);
  }
  assert.ok(classes.size > 0);
  for (const classPath of classes) {
    const candidate = classPath.replace(/^\/Game\//, 'Hotta/Content/').replace(/\.[^/.]+$/, '.uasset:json');
    assert.ok(patterns.some(pattern => pattern.test(candidate)), `Full export misses Bygone class ${classPath}`);
  }
  for (const family of ['BigSecretMonster', 'Monster', 'OriginWarMonster']) {
    assert.ok(patterns.some(pattern => pattern.test(`Hotta/Content/Resources/CoreBlueprints/Character/${family}/Nested/Parent.uasset:json`)), `Missing recursive ${family} inheritance coverage`);
  }
  assert.ok(patterns.some(pattern => pattern.test('Hotta/Content/Resources/FB/SHTT/Monster/Nested/Parent.uasset:json')), 'Missing recursive SHTT inheritance coverage');
});

test('Selective List: MMO OOW exports its pools, stats, curves, and buff icons', () => {
  const config = loadExportRules();
  const fullPaths = getExportPathsForMode(config.rules, 'Full');
  const candidatePaths = [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarRoundConfigDataTable_MMO.uasset:json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarMonsterPoolDataTable_MMO.uasset:json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_MonsterStaticData_MMO.uasset:json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/DT_MonsterStaticData_MMO.uasset:json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure/OriginWarMonster_Balance.uasset:json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/GameplayEffectTipsDataTable_Balance.uasset:json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_Balance/GameplayEffectTipsDataTable_Balance.uasset:json',
      'Hotta/Content/Resources/Icon/buff_balance/balance_humbuff_30.uasset:png',
      'Hotta/Content/Resources/UI/PetFight/skill/btn_xinzeng_FHQ.uasset:png',
  ];

  for (const candidate of candidatePaths) {
    assert.ok(
      fullPaths.some((pattern) => new RegExp(pattern).test(candidate)),
      'Expected MMO OOW export rule to match ' + candidate,
    );
  }

  for (const label of [
    'MMO OOW: season config',
    'MMO OOW: floor config',
    'MMO OOW: enemy pools',
    'MMO OOW: buff pools',
    'MMO OOW: enemy static stats',
    'MMO OOW: balance curves',
    'MMO OOW: buff effect tips/icons',
  ]) {
    assert.ok(config.requirements.some((requirement) => requirement.label === label), 'Missing requirement ' + label);
  }
});

test('Selective List: filters rules correctly by mode', () => {
  const sampleRules: SelectiveRule[] = [
    { category: 'core', pattern: 'table1.uasset:json', type: 'json' },
    { category: 'core', pattern: 'table2.uasset:json', type: 'json' },
    { category: 'images', pattern: 'img1.uasset:png', type: 'png' },
    { category: 'images', pattern: 'img2_small.uasset:png', type: 'png', smallMode: true },
  ];

  // Text mode
  const textFiltered = filterRulesByMode(sampleRules, 'Text');
  assert.equal(textFiltered.length, 2);
  assert.ok(textFiltered.every((r) => r.type === 'json'));

  // Pic mode
  const picFiltered = filterRulesByMode(sampleRules, 'Pic');
  assert.equal(picFiltered.length, 2);
  assert.ok(picFiltered.every((r) => r.type === 'png'));

  // Small mode: all JSON + only smallMode PNGs
  const smallFiltered = filterRulesByMode(sampleRules, 'Small');
  assert.equal(smallFiltered.length, 3);
  assert.ok(smallFiltered.some((r) => r.pattern === 'img2_small.uasset:png'));
  assert.ok(!smallFiltered.some((r) => r.pattern === 'img1.uasset:png'));

  // Full mode: all rules
  const fullFiltered = filterRulesByMode(sampleRules, 'Full');
  assert.equal(fullFiltered.length, 4);
});

test('Selective List: generates correct CUE4Parse config object', () => {
  const config = generateUnrealExporterConfig({
    gamePaksPath: 'D:\\Games\\TowerOfFantasy\\Hotta\\Content\\Paks',
    outputPath: 'C:\\ExportTarget',
    mode: 'Text',
    aesKey: '0xCUSTOM_KEY',
  });

  assert.equal(config.ConfigTitle, 'Tower of Fantasy Datamine (Text Mode)');
  assert.equal(config.GamePath, 'D:\\Games\\TowerOfFantasy\\Hotta\\Content\\Paks');
  assert.equal(config.OutputPath, 'C:\\ExportTarget');
  assert.equal(config.EngineVersion, 'TowerOfFantasy');
  assert.deepEqual(config.AesKeys, ['0xCUSTOM_KEY']);
  assert.ok(config.ExportPaths.length > 0);
  assert.ok(config.ExportPaths.every((p) => p.endsWith(':json')));
});

test('Selective List: validateExportRequirements correctly evaluates target directory', () => {
  const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'val-target-'));

  try {
    // 1. In empty dir, all checks should fail
    const reportEmpty = validateExportRequirements(tempTarget, 'Text');
    assert.equal(reportEmpty.valid, false);
    assert.ok(reportEmpty.missingChecks > 0);
    assert.equal(reportEmpty.passedChecks, 0);

    // 2. Populate some requirements
    fs.writeFileSync(path.join(tempTarget, 'MappingItemId.json'), '{}');
    fs.writeFileSync(path.join(tempTarget, 'MappingItemIdAndName.json'), '{}');
    fs.writeFileSync(path.join(tempTarget, 'MappingItemIdAndColor.json'), '{}');
    fs.writeFileSync(path.join(tempTarget, 'export-version.json'), '{}');

    const reportPartial = validateExportRequirements(tempTarget, 'Text');
    assert.ok(reportPartial.passedChecks >= 4, `Expected at least 4 passed checks, got ${reportPartial.passedChecks}`);
  } finally {
    fs.rmSync(tempTarget, { recursive: true, force: true });
  }
});


test('Full extraction covers every raw table path the pipeline code names', () => {
  const tables = getExportPathsForMode(loadExportRules().rules, 'Full').filter(rule => rule.endsWith(':json')).map(rule => new RegExp(`^${rule}$`, 'i'));
  const missing = declaredTablePaths(path.resolve(__dirname, '../../../../scripts'))
    .filter(file => !tables.some(pattern => pattern.test(file.replace(/\.json$/, '.uasset:json'))));
  assert.deepEqual(missing, []);
});

test('The raw table scan covers every generator the pipeline runs', () => {
  // Generators outside the scanned folders would lose their tables from the export rules without failing above.
  const scriptsDir = path.resolve(__dirname, '../../../../scripts');
  const copies = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-generators-'));
  try {
    for (const script of new Set(SITE_GENERATORS.map((step) => step.script))) fs.copyFileSync(path.join(scriptsDir, 'generators', script), path.join(copies, script));
    const scanned = new Set(declaredTablePaths(scriptsDir));
    assert.deepEqual(declaredTablePaths(copies).filter((table) => !scanned.has(table)), []);
  } finally {
    fs.rmSync(copies, { recursive: true, force: true });
  }
});

test('Full extraction covers every texture the generated site data references', (t) => {
  const textures = referencedSiteTextures(path.resolve(__dirname, '../../../../apps/web/public'));
  if (textures.length === 0) return t.skip('no generated game-data in this checkout');
  const images = getExportPathsForMode(loadExportRules().rules, 'Full').filter(rule => rule.endsWith(':png')).map(rule => new RegExp(`^${rule}$`, 'i'));
  // Class references that only look like texture paths are not media (raid boss debuff GameplayEffect).
  const missing = textures.filter(file => !file.includes('/Abilities_Balance/Buff/'))
    .filter(file => !images.some(pattern => pattern.test(file.replace(/\.png$/, '.uasset:png'))));
  assert.deepEqual(missing.slice(0, 20), [], `${missing.length} referenced textures are not extracted`);
});

test('raid selection and title art are extracted recursively, including Small mode', () => {
  const config = loadExportRules();
  for (const mode of ['Full', 'Pic', 'Small'] as const) {
    const patterns = getExportPathsForMode(config.rules, mode).filter(rule => rule.endsWith(':png')).map(rule => new RegExp(rule, 'i'));
    for (const image of ['UI_NEWTFZZ_P1_BOSS3', 'UI_NEWTFZZ_P2_boss3', 'new-season/new-raid']) {
      assert.ok(patterns.some(pattern => pattern.test(`Hotta/Content/Resources/UI/fuben/taofazuozhan/${image}.uasset:png`)), `${mode} misses ${image}`);
    }
  }
});
