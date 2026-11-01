import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validateDeployDirectory,
  validatePackagingStructure,
  formatValidationReportText,
  writeValidationReports,
  type ValidationReport,
} from '../validate';
import {
  createBaselinePayload,
  freezeBaselineToDeploy,
  partitionBaselineIds,
  type ChangelogBaselineCharacter,
  type ChangelogBaselinePayload,
} from '../baseline';
import {
  compareSimulacraChangelogs,
  compareEditionChangelogs,
  compareCharacterValues,
  saveChangelogArtifacts,
} from '../changelog';

function createMockCharacter(
  id: string,
  overrides: Partial<ChangelogBaselineCharacter> = {}
): ChangelogBaselineCharacter {
  return {
    id,
    avatar_id: `Avatar_${id}`,
    weapon_id: `Weapon_${id}`,
    name_en: `Character ${id}`,
    name_ru: `Персонаж ${id}`,
    element: 'Frost',
    role: 'DPS',
    rarity: 'SSR',
    base_stats: {
      attack: 19,
      hp: 1165,
      crit: 15,
      shatter: 16,
      charge: 14,
    },
    max_stats: {
      attack: 1612,
      hp: 79999,
    },
    advancements: [
      {
        star: 1,
        name: '1 Star Advancement',
        description: 'Increases Frost Damage by 9%. Increases damage to 5,400%.',
      },
      {
        star: 2,
        name: '2 Star Advancement',
        description: 'Increases Base ATK growth by 16%.',
      },
    ],
    traits: [
      {
        affinity: 1200,
        name: 'First Trait',
        description: 'Increases Final Damage by 14%.',
      },
      {
        affinity: 4000,
        name: 'Second Trait',
        description: 'Increases Final Damage by 18%.',
      },
    ],
    weapon: {
      id: `Weapon_${id}`,
      name: `Weapon of ${id}`,
      shatter: 16,
      charge: 14,
      skills: [
        {
          id: 'skill_normal_1',
          name: 'Normal Attack',
          category: 'Normal',
          description: 'Deal damage equal to 50.5% of ATK.',
        },
        {
          id: 'skill_discharge_1',
          name: 'Discharge Attack',
          category: 'Discharge',
          description: 'Deal massive damage equal to 850% of ATK.',
        },
      ],
      passives: [
        {
          id: 'passive_1',
          name: 'Frost Resonance',
          description: 'Increase Frost ATK by 15% and Frost Resistance by 25%.',
        },
      ],
    },
    ...overrides,
  };
}

function createMockPayload(
  edition: 'gacha' | 'mmo',
  characters: Record<string, ChangelogBaselineCharacter>
): ChangelogBaselinePayload {
  return {
    schemaVersion: 1,
    edition,
    generatedAt: '2026-09-18T00:00:00.000Z',
    total: Object.keys(characters).length,
    characters,
  };
}

/**
 * Creates a valid mock deploy directory tree.
 */
function createMockDeployTree(
  targetDir: string,
  options: {
    omitReleaseManifest?: boolean;
    omitLocaleDir?: 'en' | 'ru';
    corruptFile?: string;
    omitBaselines?: boolean;
    corruptBaseline?: boolean;
    emptyDataset?: string;
    gachaChars?: Record<string, ChangelogBaselineCharacter>;
    mmoChars?: Record<string, ChangelogBaselineCharacter>;
    withImages?: boolean;
  } = {}
): void {
  const dataDir = path.join(targetDir, 'game-data');
  const enDir = path.join(dataDir, 'en');
  const ruDir = path.join(dataDir, 'ru');
  const changelogDir = path.join(dataDir, 'changelog');
  const assetsDir = path.join(targetDir, 'game-assets');

  fs.mkdirSync(enDir, { recursive: true });
  fs.mkdirSync(ruDir, { recursive: true });
  fs.mkdirSync(changelogDir, { recursive: true });

  if (options.withImages) {
    fs.mkdirSync(path.join(assetsDir, 'png'), { recursive: true });
    fs.mkdirSync(path.join(assetsDir, 'webp'), { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'png', 'sample.png'), 'fake-png');
    fs.writeFileSync(path.join(assetsDir, 'webp', 'sample.webp'), 'fake-webp');
  }

  // 1. Release Manifest
  if (!options.omitReleaseManifest) {
    const manifest = {
      schemaVersion: 1,
      gameVersion: '6.3.14',
      generatedAt: '2026-09-18T00:00:00.000Z',
      exporterVersion: '1.0.0',
      locales: ['en', 'ru'],
      assets: {
        png: true,
        webp: true,
      },
      datasets: {
        simulacra: { total: 1, schemaVersion: 1 },
        matrices: { total: 1, schemaVersion: 1 },
        relics: { total: 1, schemaVersion: 1 },
        pets: { total: 1, schemaVersion: 1 },
        food: { total: 1, schemaVersion: 1 },
        cosmetics: { total: 1, schemaVersion: 1 },
        arts: { total: 1, schemaVersion: 1 },
      },
      snapshot: {
        version: '6.3.14',
        exportedAt: '2026-09-18T00:00:00.000Z',
        source: 'TowerOfFantasy',
        sources: [
          {
            client: 'Korea Dev 1',
            branch: 'TestPC_KR2New',
            clientRu: 'Корея Dev 1',
            appVersion: '3.0.0',
            hash: '100a25',
          },
        ],
      },
      build: {
        builtAt: '2026-09-18T00:00:00.000Z',
        status: 'fresh-success',
      },
    };
    fs.writeFileSync(path.join(dataDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(targetDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
  }

  // 2. Datasets
  const datasets = ['simulacra', 'matrices', 'relics', 'pets', 'food', 'cosmetics', 'arts'];
  for (const ds of datasets) {
    const isEmp = options.emptyDataset === ds;
    let items: any[] = [];
    if (!isEmp) {
      if (ds === 'simulacra') {
        const char = options.gachaChars && Object.values(options.gachaChars)[0]
          ? Object.values(options.gachaChars)[0]
          : createMockCharacter('alyss');
        items = [char];
      } else {
        items = [{ id: `${ds}_1`, name_en: `${ds} 1`, name_ru: `${ds} 1 (RU)` }];
      }
    }
    const content = ds === 'food'
      ? { schemaVersion: 1, generatedAt: '2026-09-18T00:00:00.000Z', total: items.length, dishes: items }
      : { schemaVersion: 1, generatedAt: '2026-09-18T00:00:00.000Z', total: items.length, items };

    fs.writeFileSync(path.join(enDir, `${ds}.json`), JSON.stringify(content));
    fs.writeFileSync(path.join(ruDir, `${ds}.json`), JSON.stringify(content));
  }

  // 3. Baselines
  if (!options.omitBaselines) {
    const gachaPayload = createMockPayload(
      'gacha',
      options.gachaChars || { alyss: createMockCharacter('alyss') }
    );
    const mmoPayload = createMockPayload(
      'mmo',
      options.mmoChars || { alyss_mmo: createMockCharacter('alyss_mmo') }
    );

    if (options.corruptBaseline) {
      fs.writeFileSync(path.join(changelogDir, 'simulacra.json'), '{ invalid json baseline ');
      fs.writeFileSync(path.join(changelogDir, 'simulacra-mmo.json'), '{ invalid json baseline ');
    } else {
      fs.writeFileSync(path.join(changelogDir, 'simulacra.json'), JSON.stringify(gachaPayload, null, 2));
      fs.writeFileSync(path.join(changelogDir, 'simulacra-mmo.json'), JSON.stringify(mmoPayload, null, 2));
    }
  }

  // 4. Corrupt file override
  if (options.corruptFile) {
    const targetFile = path.join(targetDir, options.corruptFile);
    if (fs.existsSync(path.dirname(targetFile))) {
      fs.writeFileSync(targetFile, '{ invalid json syntax !!! ');
    }
  }

  // 5. Omit locale directory
  if (options.omitLocaleDir === 'en') {
    fs.rmSync(enDir, { recursive: true, force: true });
  } else if (options.omitLocaleDir === 'ru') {
    fs.rmSync(ruDir, { recursive: true, force: true });
  }
}

describe('Simulacra Changelog & Export Validation Engine', () => {
  let tmpRoot: string;

  // Use a local scratch directory under OS temp
  const makeTempDir = (prefix: string) => {
    return fs.mkdtempSync(path.join(os.tmpdir(), `tof-val-${prefix}-`));
  };

  describe('fixture scenarios', () => {
    it('1. Fixture: no changes between baseline and fresh export', async () => {
      tmpRoot = makeTempDir('no-changes');
      try {
        const charAlyss = createMockCharacter('alyss');
        const oldBaselines = {
          gacha: createMockPayload('gacha', { alyss: charAlyss }),
          mmo: createMockPayload('mmo', { alyss_mmo: createMockCharacter('alyss_mmo') }),
        };
        const freshBaselines = {
          gacha: createMockPayload('gacha', { alyss: charAlyss }),
          mmo: createMockPayload('mmo', { alyss_mmo: createMockCharacter('alyss_mmo') }),
        };

        const comparison = compareSimulacraChangelogs(oldBaselines, freshBaselines);
        assert.strictEqual(comparison.status, 'no_changes');
        assert.strictEqual(comparison.summary.totalValueChanges, 0);
        assert.strictEqual(comparison.summary.totalCharactersWithChanges, 0);

        createMockDeployTree(tmpRoot, {
          gachaChars: freshBaselines.gacha.characters,
          mmoChars: freshBaselines.mmo.characters,
          withImages: true,
        });
        saveChangelogArtifacts(tmpRoot, comparison);

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        assert.strictEqual(report.valid, true);
        assert.strictEqual(report.fatalCount, 0);
        assert.strictEqual(report.changelogStatus, 'no_changes');
        assert.strictEqual(fs.existsSync(path.join(tmpRoot, 'validation-report.json')), true);
        assert.strictEqual(fs.existsSync(path.join(tmpRoot, 'validation-report.txt')), true);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('2. Fixture: one numeric balance adjustment', async () => {
      tmpRoot = makeTempDir('one-numeric');
      try {
        const oldAlyss = createMockCharacter('alyss');
        const newAlyss = createMockCharacter('alyss', {
          advancements: [
            {
              star: 1,
              name: '1 Star Advancement',
              description: 'Increases Frost Damage by 12%. Increases damage to 5,400%.', // 9% -> 12%
            },
            oldAlyss.advancements![1],
          ],
        });

        const comparison = compareSimulacraChangelogs(
          { gacha: createMockPayload('gacha', { alyss: oldAlyss }), mmo: null },
          { gacha: createMockPayload('gacha', { alyss: newAlyss }), mmo: createMockPayload('mmo', {}) }
        );

        assert.strictEqual(comparison.gacha.charactersWithChangesCount, 1);
        assert.strictEqual(comparison.gacha.totalValueChangesCount, 1);
        assert.strictEqual(comparison.gacha.characterDiffs['alyss'].changes[0].type, 'Advancement');

        createMockDeployTree(tmpRoot, {
          gachaChars: { alyss: newAlyss },
          mmoChars: {},
          withImages: true,
        });
        saveChangelogArtifacts(tmpRoot, comparison);

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        assert.strictEqual(report.valid, true);
        assert.strictEqual(report.fatalCount, 0);
        assert.strictEqual(report.changelogStatus, 'ready');
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('3. Fixture: multiple fields changed across skills, traits, and stats', async () => {
      tmpRoot = makeTempDir('multiple-fields');
      try {
        const oldChar = createMockCharacter('alyss');
        const newChar = createMockCharacter('alyss', {
          base_stats: { ...oldChar.base_stats, attack: 35 },
          traits: [
            { affinity: 1200, name: 'First Trait', description: 'Increases Final Damage by 20%.' },
            oldChar.traits![1],
          ],
          weapon: {
            ...oldChar.weapon,
            skills: [
              {
                id: 'skill_normal_1',
                name: 'Normal Attack',
                category: 'Normal',
                description: 'Deal damage equal to 75.0% of ATK.',
              },
              oldChar.weapon!.skills[1],
            ],
          },
        });

        const diff = compareCharacterValues(oldChar, newChar);
        assert.strictEqual(diff.hasChanges, true);
        assert.strictEqual(diff.changes.length, 3);
        const types = diff.changes.map((c) => c.type).sort();
        assert.deepStrictEqual(types, ['Skill', 'Stat', 'Trait']);

        createMockDeployTree(tmpRoot, {
          gachaChars: { alyss: newChar },
          withImages: true,
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        assert.strictEqual(report.valid, true);
        assert.strictEqual(report.fatalCount, 0);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('4. Fixture: only new character added (strictly zero value diff entries)', async () => {
      tmpRoot = makeTempDir('only-new-char');
      try {
        const oldBaseline = createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
        });
        const newBaseline = createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
          nemesis: createMockCharacter('nemesis'),
        });

        const result = compareEditionChangelogs('gacha', oldBaseline, newBaseline);
        assert.strictEqual(result.charactersWithChangesCount, 0);
        assert.strictEqual(result.totalValueChangesCount, 0);
        assert.deepStrictEqual(result.newIds, ['nemesis']);
        assert.strictEqual(result.addedCharacters.length, 1);
        assert.strictEqual(result.addedCharacters[0].id, 'nemesis');
        assert.strictEqual(Object.keys(result.characterDiffs).length, 0);

        createMockDeployTree(tmpRoot, {
          gachaChars: newBaseline.characters,
          withImages: true,
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        assert.strictEqual(report.valid, true);
        assert.strictEqual(report.fatalCount, 0);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('5. Fixture: character removed category', async () => {
      tmpRoot = makeTempDir('removed-char');
      try {
        const oldBaseline = createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
          retired_char: createMockCharacter('retired_char'),
        });
        const newBaseline = createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
        });

        const result = compareEditionChangelogs('gacha', oldBaseline, newBaseline);
        assert.strictEqual(result.charactersWithChangesCount, 0);
        assert.deepStrictEqual(result.removedIds, ['retired_char']);
        assert.strictEqual(result.removedCharacters.length, 1);
        assert.strictEqual(result.removedCharacters[0].id, 'retired_char');

        createMockDeployTree(tmpRoot, {
          gachaChars: newBaseline.characters,
          withImages: true,
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        assert.strictEqual(report.valid, true);
        assert.strictEqual(report.fatalCount, 0);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('6. Fixture: MMO-only change (strictly isolated from Gacha)', async () => {
      tmpRoot = makeTempDir('mmo-only');
      try {
        const oldBaselines = {
          gacha: createMockPayload('gacha', { alyss: createMockCharacter('alyss') }),
          mmo: createMockPayload('mmo', { alyss_mmo: createMockCharacter('alyss_mmo') }),
        };
        const freshBaselines = {
          gacha: createMockPayload('gacha', { alyss: createMockCharacter('alyss') }), // unchanged
          mmo: createMockPayload('mmo', {
            alyss_mmo: createMockCharacter('alyss_mmo', {
              base_stats: { ...createMockCharacter('alyss_mmo').base_stats, hp: 5000 }, // changed
            }),
          }),
        };

        const comparison = compareSimulacraChangelogs(oldBaselines, freshBaselines);
        assert.strictEqual(comparison.gacha.charactersWithChangesCount, 0);
        assert.strictEqual(comparison.gacha.totalValueChangesCount, 0);
        assert.strictEqual(comparison.mmo.charactersWithChangesCount, 1);
        assert.strictEqual(comparison.mmo.totalValueChangesCount, 1);
        assert.strictEqual(comparison.summary.totalValueChanges, 1);

        createMockDeployTree(tmpRoot, {
          gachaChars: freshBaselines.gacha.characters,
          mmoChars: freshBaselines.mmo.characters,
          withImages: true,
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        assert.strictEqual(report.valid, true);
        assert.strictEqual(report.fatalCount, 0);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('7. Fixture: baseline unavailable (survives by default, fatal in strict/require-changelog)', async () => {
      tmpRoot = makeTempDir('baseline-unavailable');
      try {
        // Create deploy tree WITHOUT changelog baselines
        createMockDeployTree(tmpRoot, {
          omitBaselines: true,
          withImages: true,
        });

        // 7A: Default non-strict mode: generates warning, skips changelog, export survives!
        const reportNonStrict = await validateDeployDirectory({
          targetDir: tmpRoot,
          strict: false,
          requireChangelog: false,
          writeReports: true,
        });

        assert.strictEqual(reportNonStrict.valid, true, 'Non-strict export must survive missing baseline');
        assert.strictEqual(reportNonStrict.fatalCount, 0);
        assert.ok(reportNonStrict.warningCount > 0);
        assert.strictEqual(reportNonStrict.changelogStatus, 'baseline_unavailable');
        assert.ok(reportNonStrict.warnings.some((w) => w.includes('BASELINE_UNAVAILABLE')));

        // 7B: Strict mode / require-changelog: fatal error!
        const reportStrict = await validateDeployDirectory({
          targetDir: tmpRoot,
          strict: true,
          writeReports: false,
        });

        assert.strictEqual(reportStrict.valid, false, 'Strict mode must fail on missing baseline');
        assert.ok(reportStrict.fatalCount > 0);
        assert.ok(reportStrict.errors.some((e) => e.includes('BASELINE_UNAVAILABLE')));

        const reportRequireChangelog = await validateDeployDirectory({
          targetDir: tmpRoot,
          requireChangelog: true,
          writeReports: false,
        });

        assert.strictEqual(reportRequireChangelog.valid, false, 'requireChangelog must fail on missing baseline');
        assert.ok(reportRequireChangelog.fatalCount > 0);
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('8. Fixture: malformed baseline and malformed required JSON', async () => {
      tmpRoot = makeTempDir('malformed');
      try {
        // 8A: Malformed baseline JSON
        createMockDeployTree(tmpRoot, {
          corruptBaseline: true,
          withImages: true,
        });

        // Non-strict: warning and malformed status
        const reportBaselineMalformed = await validateDeployDirectory({
          targetDir: tmpRoot,
          strict: false,
          writeReports: false,
        });
        assert.strictEqual(reportBaselineMalformed.changelogStatus, 'malformed');
        assert.strictEqual(reportBaselineMalformed.valid, true);

        // Strict: fatal error
        const reportBaselineStrict = await validateDeployDirectory({
          targetDir: tmpRoot,
          strict: true,
          writeReports: false,
        });
        assert.strictEqual(reportBaselineStrict.valid, false);
        assert.ok(reportBaselineStrict.fatalCount > 0);

        // 8B: Corrupted required deploy JSON
        createMockDeployTree(tmpRoot, {
          corruptFile: 'game-data/en/simulacra.json',
          withImages: true,
        });

        const reportCorruptJson = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        assert.strictEqual(reportCorruptJson.valid, false);
        assert.ok(reportCorruptJson.fatalCount > 0);
        assert.ok(reportCorruptJson.errors.some((e) => e.includes('UNPARSABLE_JSON')));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('9. Fixture: new baseline includes new ID in deploy freeze', async () => {
      tmpRoot = makeTempDir('new-baseline-freeze');
      try {
        const oldGacha = createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
        });
        const freshGacha = createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
          nemesis: createMockCharacter('nemesis'),
        });
        const freshMmo = createMockPayload('mmo', {
          alyss_mmo: createMockCharacter('alyss_mmo'),
        });

        const freezeResult = freezeBaselineToDeploy({
          gachaBaseline: freshGacha,
          mmoBaseline: freshMmo,
          deployDir: tmpRoot,
          oldGachaBaseline: oldGacha,
        });

        assert.strictEqual(freezeResult.gachaCount, 2);
        assert.strictEqual(freezeResult.newIdsCount.gacha, 1);
        assert.deepStrictEqual(freezeResult.newIds.gacha, ['nemesis']);

        // Verify the frozen baseline on disk includes both alyss and nemesis
        const frozenJson = JSON.parse(
          fs.readFileSync(path.join(tmpRoot, 'game-data', 'changelog', 'simulacra.json'), 'utf8')
        ) as ChangelogBaselinePayload;

        assert.strictEqual(frozenJson.total, 2);
        assert.ok(Boolean(frozenJson.characters['nemesis']));
        assert.ok(Boolean(frozenJson.characters['alyss']));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  });

  describe('Validation Severities System', () => {
    it('FATAL: missing critical deploy structure', async () => {
      tmpRoot = makeTempDir('missing-struct');
      try {
        createMockDeployTree(tmpRoot, {
          omitReleaseManifest: true,
          withImages: true,
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: false,
        });

        assert.strictEqual(report.valid, false);
        assert.ok(report.fatalCount > 0);
        assert.ok(report.errors.some((e) => e.includes('MISSING_RELEASE_MANIFEST')));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('FATAL: missing locale directory', async () => {
      tmpRoot = makeTempDir('missing-locale');
      try {
        createMockDeployTree(tmpRoot, {
          omitLocaleDir: 'ru',
          withImages: true,
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: false,
        });

        assert.strictEqual(report.valid, false);
        assert.ok(report.fatalCount > 0);
        assert.ok(report.errors.some((e) => e.includes('MISSING_RU_DIR')));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('FATAL: unsafe path containment check', async () => {
      tmpRoot = makeTempDir('unsafe-path');
      try {
        const inputDir = path.join(tmpRoot, 'input');
        const outputInsideInput = path.join(inputDir, 'output');
        fs.mkdirSync(inputDir, { recursive: true });
        fs.mkdirSync(outputInsideInput, { recursive: true });

        const report = await validateDeployDirectory({
          targetDir: outputInsideInput,
          inputDir: inputDir,
          writeReports: false,
        });

        assert.strictEqual(report.valid, false);
        assert.ok(report.fatalCount > 0);
        assert.ok(report.errors.some((e) => e.includes('UNSAFE_PATH_CONTAINMENT')));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('FATAL: impossible packaging validation', () => {
      tmpRoot = makeTempDir('impossible-pkg');
      try {
        // Empty directory lacks node.exe, UnrealExporter.exe, etc.
        const pkgResult = validatePackagingStructure(tmpRoot);
        assert.strictEqual(pkgResult.valid, false);
        assert.ok(pkgResult.fatalErrors.length >= 5);
        assert.ok(pkgResult.missingComponents.includes('runtime/node.exe'));
        assert.ok(pkgResult.missingComponents.includes('bin/UnrealExporter.exe'));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('WARNING: optional image missing does not invalidate export', async () => {
      tmpRoot = makeTempDir('optional-img-missing');
      try {
        createMockDeployTree(tmpRoot, {
          withImages: false, // game-assets has 0 images
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: false,
        });

        assert.strictEqual(report.valid, true, 'Missing optional images must not fail the export');
        assert.strictEqual(report.fatalCount, 0);
        assert.ok(report.warningCount > 0);
        assert.ok(report.warnings.some((w) => w.includes('OPTIONAL_GAME_ASSETS_DIR_ABSENT')));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('WARNING: unusual empty dataset count', async () => {
      tmpRoot = makeTempDir('unusual-counts');
      try {
        createMockDeployTree(tmpRoot, {
          emptyDataset: 'matrices',
          withImages: true,
        });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: false,
        });

        assert.strictEqual(report.valid, true, 'Unusual count generates warning, not fatal');
        assert.strictEqual(report.fatalCount, 0);
        assert.ok(report.warnings.some((w) => w.includes('UNUSUAL_EMPTY_COUNT')));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  });

  describe('Report Generation and Formatting', () => {
    it('generates well-formed text and JSON reports', async () => {
      tmpRoot = makeTempDir('report-artifacts');
      try {
        createMockDeployTree(tmpRoot, { withImages: true });

        const report = await validateDeployDirectory({
          targetDir: tmpRoot,
          writeReports: true,
        });

        const jsonFile = path.join(tmpRoot, 'validation-report.json');
        const txtFile = path.join(tmpRoot, 'validation-report.txt');
        const subJsonFile = path.join(tmpRoot, 'validation', 'validation-report.json');
        const subTxtFile = path.join(tmpRoot, 'validation', 'validation-report.txt');

        assert.ok(fs.existsSync(jsonFile));
        assert.ok(fs.existsSync(txtFile));
        assert.ok(fs.existsSync(subJsonFile));
        assert.ok(fs.existsSync(subTxtFile));

        const parsedJson = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        assert.strictEqual(parsedJson.valid, true);
        assert.strictEqual(parsedJson.deployStructure.hasGameData, true);

        const txtContent = fs.readFileSync(txtFile, 'utf8');
        assert.ok(txtContent.includes('Tower of Fantasy Export & Dataset Validation Report'));
        assert.ok(txtContent.includes('PASSED (VALID)'));
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  });
});
