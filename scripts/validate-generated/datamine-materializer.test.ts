import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeFceDataset,
  normalizeOowDataset,
  normalizeBygoneDataset,
  normalizeSeqDataset,
  normalizeMultypeDataset,
  normalizeItemsDataset,
  normalizeGameData,
  normalizeTeamRaidsDataset,
  normalizeMmoTeamRaidsDataset,
} from '../normalize-game-data';
import {
  FceIndexDatasetSchema,
  OowCurrentSummaryDatasetSchema,
  BygoneDatasetSchema,
  SeqCacheDatasetSchema,
  MultypeRenamesDatasetSchema,
  DatamineItemsDatasetSchema,
  TeamRaidsDatasetSchema,
  MmoTeamRaidsDatasetSchema,
} from '@tof-hub/contracts';
import { resolveGameAsset, gameAssetSources } from '@tof-hub/game-assets';

// A prepared legacy stage (e.g. <pipeline work>/stage), the same TOF_LEGACY_DIR the generators use.
const legacyDir = process.env.TOF_LEGACY_DIR ?? '';
const legacySkip = legacyDir && fs.existsSync(legacyDir) ? false : 'set TOF_LEGACY_DIR to a prepared legacy stage';

describe('Datamine Materializer & Runtime Loaders', {skip: legacySkip}, () => {

  it('normalizes and validates FCE Boss Mechanics dataset', () => {
    const res = normalizeFceDataset(legacyDir);
    assert.strictEqual(res.datasetName, 'fce');
    assert.ok(res.counts.total >= 1);

    const enParsed = FceIndexDatasetSchema.safeParse(res.materialized.en);
    assert.strictEqual(enParsed.success, true);

    const ruParsed = FceIndexDatasetSchema.safeParse(res.materialized.ru);
    assert.strictEqual(ruParsed.success, true);

    if (enParsed.success && ruParsed.success) {
      assert.strictEqual(enParsed.data.bosses.length, ruParsed.data.bosses.length);
      const firstBoss = enParsed.data.bosses[0];
      assert.ok(firstBoss.slug);
      assert.ok(firstBoss.art);
    }
  });

  it('normalizes and validates Origin of War dataset', () => {
    const res = normalizeOowDataset(legacyDir);
    assert.strictEqual(res.datasetName, 'oow');
    assert.ok(res.counts.total >= 1);

    const enParsed = OowCurrentSummaryDatasetSchema.safeParse(res.materialized.en);
    assert.strictEqual(enParsed.success, true);

    const ruParsed = OowCurrentSummaryDatasetSchema.safeParse(res.materialized.ru);
    assert.strictEqual(ruParsed.success, true);

    if (enParsed.success && ruParsed.success) {
      assert.strictEqual(enParsed.data.schemaVersion, 2);
      assert.ok(enParsed.data.recentSeasons);
    }

    // Game patches add seasons; fewer than the last verified export means lost data.
    assert.ok(res.counts.standardSeasons >= 23);
    assert.ok(res.counts.mmoSeasons >= 3); // mmo_s01, mmo_s03, mmo_s04: the export has no MMO season 2
    assert.ok(Object.keys(res.materializedFiles?.en || {}).length >= 27);
    assert.equal(
      (res.materializedFiles?.en?.['oow/seasons/s23.json'] as { floors?: unknown[] })?.floors?.length,
      28
    );
  });

  it('normalizes and validates Bygone Phantasm dataset', () => {
    const res = normalizeBygoneDataset(legacyDir);
    assert.strictEqual(res.datasetName, 'bygone');
    assert.ok(res.counts.total >= 1);

    const enParsed = BygoneDatasetSchema.safeParse(res.materialized.en);
    assert.strictEqual(enParsed.success, true);

    const ruParsed = BygoneDatasetSchema.safeParse(res.materialized.ru);
    assert.strictEqual(ruParsed.success, true);

    if (enParsed.success && ruParsed.success) {
      assert.ok(enParsed.data.totalFloors > 0);
      assert.strictEqual(enParsed.data.floors.length, ruParsed.data.floors.length);
    }
  });

  it('normalizes and validates Sequential Phantasm dataset', () => {
    const res = normalizeSeqDataset(legacyDir);
    assert.strictEqual(res.datasetName, 'seq');
    assert.ok(res.counts.total >= 1);

    const enParsed = SeqCacheDatasetSchema.safeParse(res.materialized.en);
    assert.strictEqual(enParsed.success, true);

    const ruParsed = SeqCacheDatasetSchema.safeParse(res.materialized.ru);
    assert.strictEqual(ruParsed.success, true);

    if (enParsed.success && ruParsed.success) {
      assert.strictEqual(enParsed.data.stages.length, ruParsed.data.stages.length);
      assert.strictEqual(enParsed.data.stages[0].stage, 1);
    }
  });

  it('normalizes and validates Multi-type Multipliers dataset', () => {
    const res = normalizeMultypeDataset(legacyDir);
    assert.strictEqual(res.datasetName, 'multype');
    assert.ok(res.counts.total >= 1);

    const enParsed = MultypeRenamesDatasetSchema.safeParse(res.materialized.en);
    assert.strictEqual(enParsed.success, true);

    const ruParsed = MultypeRenamesDatasetSchema.safeParse(res.materialized.ru);
    assert.strictEqual(ruParsed.success, true);
  });

  it('normalizes and validates Items Datamine dataset', () => {
    const res = normalizeItemsDataset(legacyDir);
    assert.strictEqual(res.datasetName, 'items');
    assert.ok(res.counts.total >= 1);

    const enParsed = DatamineItemsDatasetSchema.safeParse(res.materialized.en);
    assert.strictEqual(enParsed.success, true);

    const ruParsed = DatamineItemsDatasetSchema.safeParse(res.materialized.ru);
    assert.strictEqual(ruParsed.success, true);

    const mmoEn = res.materializedFiles?.en?.['datamine/items-mmo.json'] as
      | Record<string, { id?: string }>
      | undefined;
    assert.ok(mmoEn);
    assert.ok(Object.keys(mmoEn).length > 2000, 'MMO output must retain the full legacy catalog');
    assert.strictEqual(mmoEn['1']?.id, 'BluePrint_T0.2_Equip1');
    assert.strictEqual(res.counts.mmoTotal, Object.keys(mmoEn).length);
  });

  it('verifies representative asset resolution across all 6 datamine sections', () => {
    const representativeDatamineAssets = [
      {
        section: 'fce',
        sourcePath: 'Hotta/Content/Resources/UI/void/boss/bigboss_SY_08',
        expectedWebp: '/game-assets/webp/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.webp',
        expectedPng: '/game-assets/png/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.png',
      },
      {
        section: 'oow',
        sourcePath: 'Hotta/Content/Resources/UI/void/boss/bigboss065',
        expectedWebp: '/game-assets/webp/Hotta/Content/Resources/UI/void/boss/bigboss065.webp',
        expectedPng: '/game-assets/png/Hotta/Content/Resources/UI/void/boss/bigboss065.png',
      },
      {
        section: 'bygone',
        sourcePath: 'Hotta/Content/Resources/UI/void/boss/bigboss005',
        expectedWebp: '/game-assets/webp/Hotta/Content/Resources/UI/void/boss/bigboss005.webp',
        expectedPng: '/game-assets/png/Hotta/Content/Resources/UI/void/boss/bigboss005.png',
      },
      {
        section: 'seq',
        sourcePath: 'Hotta/Content/Resources/UI/void/boss/bigboss005',
        expectedWebp: '/game-assets/webp/Hotta/Content/Resources/UI/void/boss/bigboss005.webp',
        expectedPng: '/game-assets/png/Hotta/Content/Resources/UI/void/boss/bigboss005.png',
      },
      {
        section: 'multype',
        sourcePath: 'Hotta/Content/Resources/Icon/buff/buff_artifact_sr008',
        expectedWebp: '/game-assets/webp/Hotta/Content/Resources/Icon/buff/buff_artifact_sr008.webp',
        expectedPng: '/game-assets/png/Hotta/Content/Resources/Icon/buff/buff_artifact_sr008.png',
      },
      {
        section: 'items',
        sourcePath: 'Hotta/Content/Resources/Icon/item/item_weapon_upstar_',
        expectedWebp: '/game-assets/webp/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp',
        expectedPng: '/game-assets/png/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.png',
      },
    ];

    for (const item of representativeDatamineAssets) {
      const webp = resolveGameAsset(item.sourcePath, 'webp');
      const png = resolveGameAsset(item.sourcePath, 'png');
      const sources = gameAssetSources(item.sourcePath);

      assert.strictEqual(webp.url, item.expectedWebp);
      assert.strictEqual(png.url, item.expectedPng);
      assert.strictEqual(sources.webp, item.expectedWebp);
      assert.strictEqual(sources.png, item.expectedPng);
    }
  });

  it('materializes localized Team8P raid data and validates both locale schemas', () => {
    const scratchRoot = path.resolve('ignore');
    fs.mkdirSync(scratchRoot, { recursive: true });
    const scratchDir = fs.mkdtempSync(path.join(scratchRoot, 'team-raids-test-'));
    const resolved = (locale: string) => ({ status: 'resolved', resolvedLocale: locale });
    const mechanic = {
      index: 1,
      key: 'mechanic-key',
      text_en: 'A verified English mechanic.',
      text_ru: 'Проверенная механика.',
      localization: { en: resolved('en'), ru: resolved('ru') },
      image: null,
    };
    const fixture = {
      schemaVersion: 1,
      total: 1,
      variantsTotal: 1,
      mechanicsTotal: 1,
      raids: [{
        id: 'Team8P_22',
        index: 22,
        bosses: [{
          id: 'Boss_hum_089',
          sourceIds: ['Boss_hum_089_Team8P'],
          name_en: 'Favored Ironclad',
          name_ru: 'Предпочитаемый броненосец',
          localization: { en: resolved('en'), ru: resolved('ru') },
        }],
        bossTips: [],
        variants: [{
          id: 'Team8P_22_D',
          targetName: 'Team8P_22_D',
          name_en: 'Astral Favor - Heroic',
          name_ru: 'Астральная благосклонность - Героический',
          nameLocalization: { en: resolved('en'), ru: resolved('ru') },
          cloneIndex: 1,
          bossIds: ['Boss_hum_089_Team8P'],
          recommendedScore: { baseValue: 116000, regionalOverrides: [], mmoOverridesRaw: [] },
          challengeTimeRaw: { value: 900, regionalOverrides: [] },
          requiredLevel: { baseRange: { lower: 65, upper: 100 }, regionalOverrides: [] },
          team: { minPlayers: 2, maxPlayers: 8, roleCounts: { attack: 4, defense: 2, assist: 2 } },
          rewardPackIds: { showPass: null, pass: null },
          rewardDetails: [],
          availability: { timeWindowsRaw: [] },
          mechanics: [mechanic],
          source: {
            configPath: 'TeamCloneConfig.json',
            configRow: 'Team8P_22_D',
            teamConfigPath: 'TeamConfigDataTable.json',
            teamConfigRow: 'Team8P_22_D',
            timeLimitPath: 'TimeLimitedPropDataTable.json',
            timeLimitRow: null,
          },
        }],
      }],
    };

    try {
      const inputDir = path.join(scratchDir, 'datamine', 'team-raids', 'data');
      fs.mkdirSync(inputDir, { recursive: true });
      fs.writeFileSync(path.join(inputDir, 'team-raids.json'), JSON.stringify(fixture), 'utf8');
      const result = normalizeTeamRaidsDataset(scratchDir);
      const en = TeamRaidsDatasetSchema.parse(result.materialized.en);
      const ru = TeamRaidsDatasetSchema.parse(result.materialized.ru);
      assert.equal(result.datasetName, 'team-raids');
      assert.equal(result.counts.total, 1);
      assert.equal(en.raids[0].variants[0].name, 'Astral Favor - Heroic');
      assert.equal(ru.raids[0].variants[0].name, 'Астральная благосклонность - Героический');
      assert.equal(en.raids[0].variants[0].mechanics[0].text, mechanic.text_en);
      assert.equal(ru.raids[0].variants[0].mechanics[0].text, mechanic.text_ru);
    } finally {
      const resolvedScratch = path.resolve(scratchDir);
      assert.ok(resolvedScratch.startsWith(`${scratchRoot}${path.sep}`), 'test scratch must stay under ignore/');
      fs.rmSync(resolvedScratch, { recursive: true, force: true });
    }
  });

  it('keeps MMO LevyClone stages and schedule in a separate localized dataset', () => {
    const scratchRoot = path.resolve('ignore');
    fs.mkdirSync(scratchRoot, { recursive: true });
    const scratchDir = fs.mkdtempSync(path.join(scratchRoot, 'mmo-team-raids-test-'));
    const resolved = (locale: string) => ({ status: 'resolved', resolvedLocale: locale });
    const fixture = {
      schemaVersion: 1,
      totalStages: 1,
      totalScheduleRows: 1,
      totalScheduleLinks: 1,
      stageMatchedScheduleLinks: 1,
      scheduleVariantIdsWithoutStageRows: [],
      stages: [{
        id: 'Team8P_06_D', stageNumber: 1, floorEnum: 'ELCSF_0', difficultyEnum: 'CLONE_EXTRA_DIFFICULTY_Multi',
        name_en: 'Black Jade Warrior - Heroic', name_ru: 'Героический Чёрный нефритовый воин',
        nameLocalization: { en: resolved('en'), ru: resolved('ru') },
        bosses: [{ id: 'Boss_hum_057_8_Easy', actorKey: 'boss_hum_057', name_en: 'Zhuyan', name_ru: 'Чжуянь', localization: { en: resolved('en'), ru: resolved('ru') } }],
        bossIds: ['Boss_hum_057_8_Easy'],
        requiredLevel: { baseRange: { lower: 65, upper: 100 }, regionalOverrides: [{ region: 'Region_Oversea', serverMode: 'MMOServer', range: { lower: 39, upper: 100 } }] },
        mechanics: [{ index: 1, textRef: { Key: 'mechanic' }, text_en: 'Share damage.', text_ru: 'Разделяйте урон.', localization: { en: resolved('en'), ru: resolved('ru') }, image: null }],
        stageImages: { small: null, title: null }, dropRefs: { normal: 'drop', poor: null, display: null },
        rewards: { normal: [{ id: 'drop_0', entries: [{ itemId: 'mmo_reward' }] }], poor: [], display: [] },
        scheduleRows: ['42'],
        source: { stagePath: 'DT_LevyCloneStage.json', stageRow: 'Team8P_06_D' },
      }],
      schedules: [{
        id: '42', beginRaw: '2026.09.16-5.00.00', endRaw: '2026.09.23-5.00.00',
        linkedLevels: [{ serverLevel: '1', variantId: 'Team8P_06_D', stageRowPresent: true, name_en: 'Black Jade Warrior - Heroic', name_ru: 'Героический Чёрный нефритовый воин' }],
        bossDebuffUI: null, source: { path: 'DT_LevyClone_MMO.json', row: '42' },
      }],
      source: { schedule: 'DT_LevyClone_MMO.json', stages: 'DT_LevyCloneStage.json' },
      unresolved: { instanceDifficultyPercent: 'unresolved' },
    };

    try {
      const inputDir = path.join(scratchDir, 'datamine', 'mmo-team-raids', 'data');
      fs.mkdirSync(inputDir, { recursive: true });
      fs.writeFileSync(path.join(inputDir, 'mmo-team-raids.json'), JSON.stringify(fixture), 'utf8');
      const result = normalizeMmoTeamRaidsDataset(scratchDir);
      const en = MmoTeamRaidsDatasetSchema.parse(result.materialized.en);
      const ru = MmoTeamRaidsDatasetSchema.parse(result.materialized.ru);
      assert.equal(result.datasetName, 'mmo-team-raids');
      assert.equal(result.counts.total, 1);
      assert.equal(en.stages[0].name, 'Black Jade Warrior - Heroic');
      assert.equal(ru.stages[0].name, 'Героический Чёрный нефритовый воин');
      assert.equal(en.stages[0].mechanics[0].text, 'Share damage.');
      assert.equal(ru.stages[0].mechanics[0].text, 'Разделяйте урон.');
      assert.equal(en.schedules[0].linkedLevels[0].stageRowPresent, true);
      assert.equal(en.stages[0].requiredLevel.regionalOverrides[0].range.lower, 39);
    } finally {
      const resolvedScratch = path.resolve(scratchDir);
      assert.ok(resolvedScratch.startsWith(`${scratchRoot}${path.sep}`), 'test scratch must stay under ignore/');
      fs.rmSync(resolvedScratch, { recursive: true, force: true });
    }
  });

  it('runs full normalizer in dry-run mode producing every datamine dataset', async () => {
    const summary = await normalizeGameData({
      legacySourceDir: legacyDir,
      dryRun: true,
    });

    assert.ok(summary.datasets.includes('fce'));
    assert.ok(summary.datasets.includes('oow'));
    assert.ok(summary.datasets.includes('bygone'));
    assert.ok(summary.datasets.includes('seq'));
    assert.ok(summary.datasets.includes('multype'));
    assert.ok(summary.datasets.includes('items'));
    assert.ok(summary.datasets.includes('team-raids'));
    assert.ok(summary.datasets.includes('mmo-team-raids'));
    assert.ok(summary.totalEntities > 0);
  });
});

// Standalone runner for direct CLI verification via tsx
async function runStandaloneChecks() {
  if (legacySkip) { console.log(`Skipped: ${legacySkip}`); return; }
  console.log('--- Running Datamine Normalizer Verification ---');

  // 1. FCE
  const fce = normalizeFceDataset(legacyDir);
  FceIndexDatasetSchema.parse(fce.materialized.en);
  FceIndexDatasetSchema.parse(fce.materialized.ru);
  console.log(`✅ FCE normalized: ${fce.counts.total} bosses verified`);

  // 2. OoW
  const oow = normalizeOowDataset(legacyDir);
  OowCurrentSummaryDatasetSchema.parse(oow.materialized.en);
  OowCurrentSummaryDatasetSchema.parse(oow.materialized.ru);
  console.log(`✅ OoW normalized: ${oow.counts.total} seasons, ${oow.counts.buffs} buffs verified`);

  // 3. Bygone
  const bygone = normalizeBygoneDataset(legacyDir);
  BygoneDatasetSchema.parse(bygone.materialized.en);
  BygoneDatasetSchema.parse(bygone.materialized.ru);
  console.log(`✅ Bygone normalized: ${bygone.counts.total} floors verified`);

  // 4. Seq
  const seq = normalizeSeqDataset(legacyDir);
  SeqCacheDatasetSchema.parse(seq.materialized.en);
  SeqCacheDatasetSchema.parse(seq.materialized.ru);
  console.log(`✅ Seq normalized: ${seq.counts.total} stages verified`);

  // 5. Multype
  const multype = normalizeMultypeDataset(legacyDir);
  MultypeRenamesDatasetSchema.parse(multype.materialized.en);
  MultypeRenamesDatasetSchema.parse(multype.materialized.ru);
  console.log(`✅ Multype normalized: ${multype.counts.total} categories verified`);

  // 6. Items
  const items = normalizeItemsDataset(legacyDir);
  DatamineItemsDatasetSchema.parse(items.materialized.en);
  DatamineItemsDatasetSchema.parse(items.materialized.ru);
  const mmoItems = items.materializedFiles?.en?.['datamine/items-mmo.json'] as
    | Record<string, { id?: string }>
    | undefined;
  if (!mmoItems || Object.keys(mmoItems).length <= 2000 || mmoItems['1']?.id !== 'BluePrint_T0.2_Equip1') {
    throw new Error('MMO items output is missing the complete legacy catalog.');
  }
  console.log(`✅ Items normalized: ${items.counts.total} Gacha + ${items.counts.mmoTotal} MMO items verified`);

  // 7. Full Normalizer dry-run
  const summary = await normalizeGameData({ legacySourceDir: legacyDir, dryRun: true });
  const missing = ['fce', 'oow', 'bygone', 'seq', 'multype', 'items', 'team-raids', 'mmo-team-raids'].filter(name => !summary.datasets.includes(name));
  if (missing.length) throw new Error(`Normalizer dry-run is missing datasets: ${missing.join(', ')}`);
  console.log(`✅ Full normalizer dry-run verified: ${summary.datasets.length} datasets, ${summary.totalEntities} entities`);
}

if (process.argv[1] && process.argv[1].includes('datamine-materializer.test')) {
  runStandaloneChecks()
    .then(() => console.log('🎉 All datamine materializer checks PASSED.'))
    .catch((err) => {
      console.error('❌ Datamine materializer checks FAILED:', err);
      process.exit(1);
    });
}
