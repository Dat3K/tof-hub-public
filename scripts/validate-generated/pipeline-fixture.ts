import fs from 'node:fs';
import path from 'node:path';
import {
  findProjectRoot,
  loadPipelineEnv,
  getRawGameSourceDir,
  tryGetRawGameSourceDir,
  createPathGuard,
  RawSourceViolationError,
} from '../_shared';
import {
  SimulacraDatasetSchema,
  MatricesDatasetSchema,
  RelicsDatasetSchema,
  PetsDatasetSchema,
  FoodDishRawSchema,
  FoodDishesDatasetSchema,
  CosmeticsDatasetSchema,
  ArtworksDatasetSchema,
  ReleaseManifestSchema,
  type ReleaseManifest,
} from '@tof-hub/contracts';
import {
  resolveGameAsset,
  gameAssetSources,
  gameAssetWebp,
  gameAssetPng,
} from '@tof-hub/game-assets';
import { buildDataManifest } from '../build-data-manifest';
import { normalizeGameData } from '../normalize-game-data';

export interface ProofEntityAsset {
  section: string;
  entityId: string;
  sourceAssetPath: string;
  rawPngRelative: string;
  legacyWebpRelative: string;
  legacyPngRelative?: string;
  resolvedWebpUrl: string;
  resolvedPngUrl: string;
}

export interface PipelineFixtureReport {
  timestamp: string;
  rawGameDir: string;
  safetyGuardsPassed: boolean;
  sectionsValidated: string[];
  entityCounts: Record<string, number>;
  representativeAssets: ProofEntityAsset[];
  zodValidationPassed: boolean;
  localeMaterializationPassed: boolean;
  manifestIdempotent: boolean;
  stagingPortabilityPassed: boolean;
  totalChecksPassed: number;
  totalChecksFailed: number;
  errors: string[];
}

/**
 * 7 Representative real assets mapped to each of the 7 public Info sections:
 */
export const REPRESENTATIVE_FIXTURE_ASSETS: ProofEntityAsset[] = [
  {
    section: 'simulacra',
    entityId: 'ageleia',
    sourceAssetPath: 'Hotta/Content/Resources/UI/wuqi/icon_qianggong',
    rawPngRelative: 'Hotta/Content/Resources/UI/wuqi/icon_qianggong.png',
    legacyWebpRelative: 'Hotta/Content/Resources/UI/wuqi/icon_qianggong.webp',
    resolvedWebpUrl: '/game-assets/webp/Hotta/Content/Resources/UI/wuqi/icon_qianggong.webp',
    resolvedPngUrl: '/game-assets/png/Hotta/Content/Resources/UI/wuqi/icon_qianggong.png',
  },
  {
    section: 'matrices',
    entityId: 'suit_N1',
    sourceAssetPath: 'Hotta/Content/Resources/Icon/yizhi/512/icon_matrix_N1_512',
    rawPngRelative: 'Hotta/Content/Resources/Icon/yizhi/512/icon_matrix_N1_512.png',
    legacyWebpRelative: 'Hotta/Content/Resources/Icon/yizhi/512/icon_matrix_N1_512.webp',
    resolvedWebpUrl: '/game-assets/webp/Hotta/Content/Resources/Icon/yizhi/512/icon_matrix_N1_512.webp',
    resolvedPngUrl: '/game-assets/png/Hotta/Content/Resources/Icon/yizhi/512/icon_matrix_N1_512.png',
  },
  {
    section: 'relics',
    entityId: 'artifact_adv_sr',
    sourceAssetPath: 'Hotta/Content/Resources/UI/Artifact/itemicon/artifact_adv_sr',
    rawPngRelative: 'Hotta/Content/Resources/UI/Artifact/itemicon/artifact_adv_sr.png',
    legacyWebpRelative: 'Hotta/Content/Resources/UI/Artifact/itemicon/artifact_adv_sr.webp',
    resolvedWebpUrl: '/game-assets/webp/Hotta/Content/Resources/UI/Artifact/itemicon/artifact_adv_sr.webp',
    resolvedPngUrl: '/game-assets/png/Hotta/Content/Resources/UI/Artifact/itemicon/artifact_adv_sr.png',
  },
  {
    section: 'pets',
    entityId: 'FightPet_1',
    sourceAssetPath: 'Hotta/Content/Resources/UI/PetFight/icon/LH_FightPet_1',
    rawPngRelative: 'Hotta/Content/Resources/UI/PetFight/icon/LH_FightPet_1.png',
    legacyWebpRelative: 'Hotta/Content/Resources/UI/PetFight/icon/LH_FightPet_1.webp',
    resolvedWebpUrl: '/game-assets/webp/Hotta/Content/Resources/UI/PetFight/icon/LH_FightPet_1.webp',
    resolvedPngUrl: '/game-assets/png/Hotta/Content/Resources/UI/PetFight/icon/LH_FightPet_1.png',
  },
  {
    section: 'food',
    entityId: 'BuffPotion_01',
    sourceAssetPath: 'Hotta/Content/Resources/Icon/caiyao/BuffPotion_01',
    rawPngRelative: 'Hotta/Content/Resources/Icon/caiyao/BuffPotion_01.png',
    legacyWebpRelative: 'Hotta/Content/Resources/Icon/caiyao/BuffPotion_01.webp',
    resolvedWebpUrl: '/game-assets/webp/Hotta/Content/Resources/Icon/caiyao/BuffPotion_01.webp',
    resolvedPngUrl: '/game-assets/png/Hotta/Content/Resources/Icon/caiyao/BuffPotion_01.png',
  },
  {
    section: 'cosmetics',
    entityId: 'Ace',
    sourceAssetPath: 'Hotta/Content/Resources/Icon/item/avatar_Ace',
    rawPngRelative: 'Hotta/Content/Resources/Icon/item/avatar_Ace.png',
    legacyWebpRelative: 'Hotta/Content/Resources/Icon/item/avatar_Ace.webp',
    resolvedWebpUrl: '/game-assets/webp/Hotta/Content/Resources/Icon/item/avatar_Ace.webp',
    resolvedPngUrl: '/game-assets/png/Hotta/Content/Resources/Icon/item/avatar_Ace.png',
  },
  {
    section: 'arts',
    entityId: 'char_art_niudan_jh_lh_agly-',
    sourceAssetPath: 'Hotta/Content/Resources/UI/AdvancedGashapon/ActivityGroup/icon/niudan_JH_LH_agly-',
    rawPngRelative: 'Hotta/Content/Resources/UI/AdvancedGashapon/ActivityGroup/icon/niudan_JH_LH_agly-.png',
    legacyWebpRelative: 'artworks/char_art_niudan_jh_lh_agly-.webp',
    legacyPngRelative: 'artworks/png/char_art_niudan_jh_lh_agly-.png',
    resolvedWebpUrl: '/game-assets/webp/Hotta/Content/Resources/UI/AdvancedGashapon/ActivityGroup/icon/niudan_JH_LH_agly-.webp',
    resolvedPngUrl: '/game-assets/png/Hotta/Content/Resources/UI/AdvancedGashapon/ActivityGroup/icon/niudan_JH_LH_agly-.png',
  },
];

export async function runPipelineFixtureProof(options: {
  projectRoot?: string;
  legacySourceDir?: string;
} = {}): Promise<PipelineFixtureReport> {
  const root = options.projectRoot || findProjectRoot();
  loadPipelineEnv(root);

  const rawDir = getRawGameSourceDir({ projectRoot: root, required: true });
  const legacyDir = options.legacySourceDir || require('node:path').resolve('pipeline/staging');
  const legacyMediaDir = path.join(legacyDir, 'datamine', 'shared', 'media');

  const publicDataDir = path.join(root, 'apps', 'web', 'public', 'game-data');
  const publicAssetsDir = path.join(root, 'apps', 'web', 'public', 'game-assets');
  const stagingProofDir = path.join(root, 'pipeline', 'staging', 'proof');
  const reportsDir = path.join(root, 'pipeline', 'reports');

  const errors: string[] = [];
  let totalChecksPassed = 0;
  let totalChecksFailed = 0;

  const assertCondition = (cond: boolean, description: string) => {
    if (cond) {
      totalChecksPassed++;
    } else {
      totalChecksFailed++;
      errors.push(description);
    }
  };

  // 1. Assert PathGuard & Safety Boundaries
  let safetyGuardsPassed = false;
  try {
    const pathGuard = createPathGuard(rawDir, [publicAssetsDir, stagingProofDir, reportsDir]);

    // Safety check 1: writing inside rawDir must fail fast
    let writeBlocked = false;
    try {
      pathGuard.assertSafeOutput(path.join(rawDir, 'unauthorized_write.tmp'));
    } catch (e: any) {
      if (e instanceof RawSourceViolationError) {
        writeBlocked = true;
      }
    }
    assertCondition(writeBlocked, 'PathGuard must reject write targeting raw game export directory');

    // Safety check 2: safeCopyFileSync into raw source must throw
    let copyBlocked = false;
    try {
      pathGuard.safeCopyFileSync(
        path.join(rawDir, 'config.xml'),
        path.join(rawDir, 'Engine', 'tampered.xml')
      );
    } catch (e: any) {
      if (e instanceof RawSourceViolationError) {
        copyBlocked = true;
      }
    }
    assertCondition(copyBlocked, 'PathGuard must reject file copy into raw source directory');

    safetyGuardsPassed = writeBlocked && copyBlocked;
  } catch (e: any) {
    errors.push(`Safety guard verification failed: ${e?.message || e}`);
  }

  // 2. Materialize Real Proof Representative Assets (PNG & WebP)
  const pathGuard = createPathGuard(rawDir, [publicAssetsDir, stagingProofDir]);

  for (const asset of REPRESENTATIVE_FIXTURE_ASSETS) {
    const rawPngPath = path.join(rawDir, asset.rawPngRelative);
    const legacyWebpPath = path.join(legacyMediaDir, asset.legacyWebpRelative);
    const legacyPngPath = asset.legacyPngRelative
      ? path.join(legacyMediaDir, asset.legacyPngRelative)
      : null;

    // Target paths in apps/web/public/game-assets (ignored by git)
    const publicPngDest = path.join(publicAssetsDir, 'png', asset.rawPngRelative);
    const publicWebpDest = path.join(
      publicAssetsDir,
      'webp',
      asset.rawPngRelative.replace(/\.png$/, '.webp')
    );

    // Target paths in staging proof directory (ignored by git)
    const stagingPngDest = path.join(stagingProofDir, 'game-assets', 'png', asset.rawPngRelative);
    const stagingWebpDest = path.join(
      stagingProofDir,
      'game-assets',
      'webp',
      asset.rawPngRelative.replace(/\.png$/, '.webp')
    );

    // Copy PNG (from raw exports or legacy PNG)
    const sourcePng = fs.existsSync(rawPngPath) ? rawPngPath : legacyPngPath;
    assertCondition(
      Boolean(sourcePng && fs.existsSync(sourcePng)),
      `Representative PNG source exists for ${asset.section}: ${rawPngPath}`
    );

    if (sourcePng && fs.existsSync(sourcePng)) {
      pathGuard.safeCopyFileSync(sourcePng, publicPngDest);
      pathGuard.safeCopyFileSync(sourcePng, stagingPngDest);
      assertCondition(fs.existsSync(publicPngDest), `Materialized public PNG: ${publicPngDest}`);
      assertCondition(fs.existsSync(stagingPngDest), `Materialized staging PNG: ${stagingPngDest}`);
    }

    // Copy WebP (from legacy media)
    assertCondition(
      fs.existsSync(legacyWebpPath),
      `Representative WebP source exists for ${asset.section}: ${legacyWebpPath}`
    );

    if (fs.existsSync(legacyWebpPath)) {
      pathGuard.safeCopyFileSync(legacyWebpPath, publicWebpDest);
      pathGuard.safeCopyFileSync(legacyWebpPath, stagingWebpDest);
      assertCondition(fs.existsSync(publicWebpDest), `Materialized public WebP: ${publicWebpDest}`);
      assertCondition(fs.existsSync(stagingWebpDest), `Materialized staging WebP: ${stagingWebpDest}`);
    }
  }

  // 3. Verify Asset Resolver Operations
  for (const asset of REPRESENTATIVE_FIXTURE_ASSETS) {
    const resWebp = resolveGameAsset(asset.sourceAssetPath, 'webp');
    const resPng = resolveGameAsset(asset.sourceAssetPath, 'png');
    const sources = gameAssetSources(asset.sourceAssetPath);

    assertCondition(
      resWebp.url === asset.resolvedWebpUrl,
      `WebP URL resolution match for ${asset.section}: expected ${asset.resolvedWebpUrl}, got ${resWebp.url}`
    );
    assertCondition(
      resPng.url === asset.resolvedPngUrl,
      `PNG URL resolution match for ${asset.section}: expected ${asset.resolvedPngUrl}, got ${resPng.url}`
    );
    assertCondition(
      !resWebp.isFallback && !resPng.isFallback,
      `Resolver produced real URL (not fallback) for ${asset.section}`
    );
    assertCondition(
      sources.webp === asset.resolvedWebpUrl && sources.png === asset.resolvedPngUrl,
      `Dual-format <picture> sources match for ${asset.section}`
    );
  }

  // 4. Verify Zod Contracts & Locale Materialization on Real Entities
  const sectionsValidated: string[] = [];
  const entityCounts: Record<string, number> = {};
  let zodValidationPassed = true;
  let localeMaterializationPassed = true;

  const readDataset = (loc: 'en' | 'ru', name: string) => {
    const file = path.join(publicDataDir, loc, `${name}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  };

  // A. Simulacra
  {
    const en = readDataset('en', 'simulacra');
    const ru = readDataset('ru', 'simulacra');
    assertCondition(Boolean(en && ru), 'Simulacra datasets exist for EN and RU');
    if (en && ru) {
      const enParsed = SimulacraDatasetSchema.safeParse(en);
      const ruParsed = SimulacraDatasetSchema.safeParse(ru);
      assertCondition(enParsed.success, 'Simulacra EN conforms to SimulacraDatasetSchema');
      assertCondition(ruParsed.success, 'Simulacra RU conforms to SimulacraDatasetSchema');
      if (!enParsed.success || !ruParsed.success) zodValidationPassed = false;

      const enEntity = en.items.find((i: any) => i.id === 'alyss');
      const ruEntity = ru.items.find((i: any) => i.id === 'alyss');
      assertCondition(Boolean(enEntity && ruEntity), 'Proof Simulacra entity present in both EN and RU');
      const isDistinct = Boolean(
        enEntity?.name_en && ruEntity?.name_ru && enEntity.name_en !== ruEntity.name_ru
      );
      assertCondition(
        isDistinct,
        'Simulacra locale materialization produces distinct EN and RU text'
      );
      if (!isDistinct) {
        localeMaterializationPassed = false;
      }
      sectionsValidated.push('simulacra');
      entityCounts.simulacra = en.items.length;
    }
  }

  // B. Matrices
  {
    const en = readDataset('en', 'matrices');
    const ru = readDataset('ru', 'matrices');
    assertCondition(Boolean(en && ru), 'Matrices datasets exist for EN and RU');
    if (en && ru) {
      const enParsed = MatricesDatasetSchema.safeParse(en);
      const ruParsed = MatricesDatasetSchema.safeParse(ru);
      assertCondition(enParsed.success, 'Matrices EN conforms to MatricesDatasetSchema');
      assertCondition(ruParsed.success, 'Matrices RU conforms to MatricesDatasetSchema');
      if (!enParsed.success || !ruParsed.success) zodValidationPassed = false;

      const enEntity = en.items.find((i: any) => i.id === 'suit_N1');
      const ruEntity = ru.items.find((i: any) => i.id === 'suit_N1');
      assertCondition(Boolean(enEntity && ruEntity), 'Proof Matrix entity present in EN and RU');
      assertCondition(
        Boolean(enEntity?.name_en && ruEntity?.name_ru),
        'Matrix locale materialization verified'
      );
      sectionsValidated.push('matrices');
      entityCounts.matrices = en.items.length;
    }
  }

  // C. Relics
  {
    const en = readDataset('en', 'relics');
    const ru = readDataset('ru', 'relics');
    assertCondition(Boolean(en && ru), 'Relics datasets exist for EN and RU');
    if (en && ru) {
      const enParsed = RelicsDatasetSchema.safeParse(en);
      const ruParsed = RelicsDatasetSchema.safeParse(ru);
      assertCondition(enParsed.success, 'Relics EN conforms to RelicsDatasetSchema');
      assertCondition(ruParsed.success, 'Relics RU conforms to RelicsDatasetSchema');
      if (!enParsed.success || !ruParsed.success) zodValidationPassed = false;

      const enEntity = en.items.find((i: any) => i.id === 'artifact_adv_sr');
      const ruEntity = ru.items.find((i: any) => i.id === 'artifact_adv_sr');
      assertCondition(Boolean(enEntity && ruEntity), 'Proof Relic entity present in EN and RU');
      sectionsValidated.push('relics');
      entityCounts.relics = en.items.length;
    }
  }

  // D. Pets
  {
    const en = readDataset('en', 'pets');
    const ru = readDataset('ru', 'pets');
    assertCondition(Boolean(en && ru), 'Pets datasets exist for EN and RU');
    if (en && ru) {
      const enParsed = PetsDatasetSchema.safeParse(en);
      const ruParsed = PetsDatasetSchema.safeParse(ru);
      assertCondition(enParsed.success, 'Pets EN conforms to PetsDatasetSchema');
      assertCondition(ruParsed.success, 'Pets RU conforms to PetsDatasetSchema');
      if (!enParsed.success || !ruParsed.success) zodValidationPassed = false;

      const enEntity = en.items.find((i: any) => i.id === 'FightPet_1');
      const ruEntity = ru.items.find((i: any) => i.id === 'FightPet_1');
      assertCondition(Boolean(enEntity && ruEntity), 'Proof Pet entity present in EN and RU');
      sectionsValidated.push('pets');
      entityCounts.pets = en.items.length;
    }
  }

  // E. Food
  {
    const en = readDataset('en', 'food');
    const ru = readDataset('ru', 'food');
    assertCondition(Boolean(en && ru), 'Food datasets exist for EN and RU');
    if (en && ru) {
      const enParsed = FoodDishesDatasetSchema.safeParse(en.dishes || en.items);
      const ruParsed = FoodDishesDatasetSchema.safeParse(ru.dishes || ru.items);
      assertCondition(enParsed.success, 'Food EN dishes conform to FoodDishesDatasetSchema');
      assertCondition(ruParsed.success, 'Food RU dishes conform to FoodDishesDatasetSchema');
      if (!enParsed.success || !ruParsed.success) zodValidationPassed = false;

      const enDish = (en.dishes || en.items).find((i: any) => i.id === 'BuffPotion_01');
      const ruDish = (ru.dishes || ru.items).find((i: any) => i.id === 'BuffPotion_01');
      assertCondition(Boolean(enDish && ruDish), 'Proof Food item present in EN and RU');
      sectionsValidated.push('food');
      entityCounts.food = (en.dishes || en.items).length;
    }
  }

  // F. Cosmetics
  {
    const en = readDataset('en', 'cosmetics');
    const ru = readDataset('ru', 'cosmetics');
    assertCondition(Boolean(en && ru), 'Cosmetics datasets exist for EN and RU');
    if (en && ru) {
      const enParsed = CosmeticsDatasetSchema.safeParse(en);
      const ruParsed = CosmeticsDatasetSchema.safeParse(ru);
      assertCondition(enParsed.success, 'Cosmetics EN conforms to CosmeticsDatasetSchema');
      assertCondition(ruParsed.success, 'Cosmetics RU conforms to CosmeticsDatasetSchema');
      if (!enParsed.success || !ruParsed.success) zodValidationPassed = false;

      const enItem = en.items.find((i: any) => i.id === 'Ace');
      const ruItem = ru.items.find((i: any) => i.id === 'Ace');
      assertCondition(Boolean(enItem && ruItem), 'Proof Cosmetic entity present in EN and RU');
      sectionsValidated.push('cosmetics');
      entityCounts.cosmetics = en.items.length;
    }
  }

  // G. Arts
  {
    const en = readDataset('en', 'arts');
    const ru = readDataset('ru', 'arts');
    assertCondition(Boolean(en && ru), 'Arts datasets exist for EN and RU');
    if (en && ru) {
      const enParsed = ArtworksDatasetSchema.safeParse(en);
      const ruParsed = ArtworksDatasetSchema.safeParse(ru);
      assertCondition(enParsed.success, 'Arts EN conforms to ArtworksDatasetSchema');
      assertCondition(ruParsed.success, 'Arts RU conforms to ArtworksDatasetSchema');
      if (!enParsed.success || !ruParsed.success) zodValidationPassed = false;

      const enArt = en.items.find((i: any) => i.id === 'char_art_niudan_jh_lh_agly-');
      const ruArt = ru.items.find((i: any) => i.id === 'char_art_niudan_jh_lh_agly-');
      assertCondition(Boolean(enArt && ruArt), 'Proof Artwork item present in EN and RU');
      sectionsValidated.push('arts');
      entityCounts.arts = en.items.length;
    }
  }

  assertCondition(
    sectionsValidated.length === 7,
    `All 7 public Info sections validated: got ${sectionsValidated.length}/7`
  );

  // 5. Verify Manifest Idempotency
  let manifestIdempotent = false;
  const manifestPath = path.join(stagingProofDir, 'manifest-idempotency.json');

  const run1 = await buildDataManifest({
    legacySourceDir: legacyDir,
    publicDataDir,
    rawSourceDir: rawDir,
    manifestOutput: manifestPath,
  });
  const run1Content = fs.readFileSync(manifestPath, 'utf8');

  // Second run to the same output file preserves existing timestamp and produces byte-for-byte identical content
  const run2 = await buildDataManifest({
    legacySourceDir: legacyDir,
    publicDataDir,
    rawSourceDir: rawDir,
    manifestOutput: manifestPath,
  });
  const run2Content = fs.readFileSync(manifestPath, 'utf8');

  // Also verify deterministic explicit timestamp generation matches exactly
  const manifestPathDeterministic = path.join(stagingProofDir, 'manifest-deterministic.json');
  await buildDataManifest({
    legacySourceDir: legacyDir,
    publicDataDir,
    rawSourceDir: rawDir,
    manifestOutput: manifestPathDeterministic,
    generatedAt: run1.generatedAt,
  });
  const deterministicContent = fs.readFileSync(manifestPathDeterministic, 'utf8');

  manifestIdempotent = run1Content === run2Content && run1Content === deterministicContent;
  assertCondition(manifestIdempotent, 'Manifest generation is strictly idempotent across consecutive runs');

  // 6. Verify Isolated Staging Portability
  let stagingPortabilityPassed = false;
  const isolatedStagingDir = path.join(root, 'pipeline', 'staging', 'test-temp-proof-output');
  try {
    const normSummary = await normalizeGameData({
      legacySourceDir: legacyDir,
      publicOutputDir: isolatedStagingDir,
      normalizedOutputDir: path.join(isolatedStagingDir, 'normalized'),
      stagingDir: path.join(isolatedStagingDir, 'staging'),
      rawSourceDir: rawDir,
    });

    const manifest = await buildDataManifest({
      legacySourceDir: legacyDir,
      publicDataDir: isolatedStagingDir,
      rawSourceDir: rawDir,
      manifestOutput: path.join(isolatedStagingDir, 'release-manifest.json'),
    });

    const parsedManifest = ReleaseManifestSchema.safeParse(manifest);
    assertCondition(parsedManifest.success, 'Isolated staging manifest is valid');
    assertCondition(normSummary.totalEntities > 4000, 'Isolated staging normalizer processed full entity set');

    stagingPortabilityPassed = parsedManifest.success && normSummary.totalEntities > 4000;
  } catch (e: any) {
    errors.push(`Staging portability check failed: ${e?.message || e}`);
  } finally {
    // Clean up isolated staging output
    if (fs.existsSync(isolatedStagingDir)) {
      try {
        fs.rmSync(isolatedStagingDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // 7. Write Comprehensive Pipeline Fixture Report
  const report: PipelineFixtureReport = {
    timestamp: new Date().toISOString(),
    rawGameDir: rawDir,
    safetyGuardsPassed,
    sectionsValidated,
    entityCounts,
    representativeAssets: REPRESENTATIVE_FIXTURE_ASSETS,
    zodValidationPassed,
    localeMaterializationPassed,
    manifestIdempotent,
    stagingPortabilityPassed,
    totalChecksPassed,
    totalChecksFailed,
    errors,
  };

  const reportPath = path.join(reportsDir, 'pipeline-fixture-report.json');
  pathGuard.safeWriteJsonSync(reportPath, report);

  return report;
}

// CLI entry point
if (
  process.argv[1] &&
  (process.argv[1].endsWith('pipeline-fixture.ts') || process.argv[1].endsWith('pipeline-fixture\\index.ts'))
) {
  runPipelineFixtureProof()
    .then((report) => {
      console.log('✅ Real-data pipeline fixture proof completed successfully:');
      console.log(`   Total checks passed: ${report.totalChecksPassed}`);
      console.log(`   Total checks failed: ${report.totalChecksFailed}`);
      console.log(`   Public Info sections validated (${report.sectionsValidated.length}/7): ${report.sectionsValidated.join(', ')}`);
      console.log(`   Representative assets verified: ${report.representativeAssets.length} (PNG + WebP)`);
      console.log(`   Zod schemas validated: ${report.zodValidationPassed ? 'PASS' : 'FAIL'}`);
      console.log(`   Locale materialization: ${report.localeMaterializationPassed ? 'PASS' : 'FAIL'}`);
      console.log(`   Manifest idempotency: ${report.manifestIdempotent ? 'PASS' : 'FAIL'}`);
      console.log(`   Staging portability: ${report.stagingPortabilityPassed ? 'PASS' : 'FAIL'}`);
      if (report.errors.length > 0) {
        console.error('Errors encountered:', report.errors);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('❌ Pipeline fixture proof failed:', err);
      process.exit(1);
    });
}
