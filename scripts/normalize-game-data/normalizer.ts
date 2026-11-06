import fs from 'node:fs';
import path from 'node:path';
import {buildRuntimeData} from '../generators/build-runtime-data.cjs';
import {
  findProjectRoot,
  createPathGuard,
  loadPipelineEnv,
  tryGetRawGameSourceDir,
} from '../_shared';
import type { NormalizerOptions, NormalizationSummary, DatasetNormalizationResult } from './types';
import {
  normalizeSimulacraDataset,
  normalizeMatricesDataset,
  normalizeRelicsDataset,
  normalizePetsDataset,
  normalizeFoodDataset,
  normalizeCosmeticsDataset,
  normalizeArtsDataset,
  normalizeFceDataset,
  normalizeOowDataset,
  normalizeBygoneDataset,
  normalizeSeqDataset,
  normalizeMultypeDataset,
  normalizeItemsDataset,
  normalizeCompDataset,
  normalizeWishBannersDataset,
  normalizeTeamRaidsDataset,
  normalizeMmoTeamRaidsDataset,
  normalizeMmoBuildDataset,
  materializeWishTitleArt,
} from './adapters';
import { buildChangelogBaselines } from './changelog-baselines';
import { generateOowStatMedia } from './oow-stat-media';

export async function normalizeGameData(
  options: NormalizerOptions = {}
): Promise<NormalizationSummary> {
  const projectRoot = findProjectRoot();
  loadPipelineEnv(projectRoot);

  // Resolve legacy source: options -> rawSource -> staging -> env -> standard machine path -> projectRoot
  const defaultLegacyDir =
    process.env.TOF_LEGACY_DIR ||
    (fs.existsSync(require('node:path').resolve('pipeline/staging')) ? require('node:path').resolve('pipeline/staging') : null);

  const legacySourceDir =
    options.legacySourceDir ||
    options.rawSourceDir ||
    options.stagingDir ||
    defaultLegacyDir ||
    projectRoot;

  const publicOutputDir = options.publicOutputDir || path.join(projectRoot, 'apps', 'web', 'public', 'game-data');

  // Prevent accidental truncation of public game-data if legacy source is absent
  const isTargetingPublic = path.resolve(publicOutputDir) === path.resolve(projectRoot, 'apps', 'web', 'public', 'game-data');
  const hasRealLegacy = fs.existsSync(path.join(legacySourceDir, 'datamine', 'bygone', 'data', 'bygone.json'));
  if (isTargetingPublic && !hasRealLegacy && !options.allowFallbacks && !options.dryRun) {
    throw new Error(
      `Safety guard: legacy source directory '${legacySourceDir}' does not contain real game data (datamine/bygone/data/bygone.json missing). Refusing to overwrite public dataset '${publicOutputDir}' with fallback stubs. Pass --legacy-source or set TOF_LEGACY_DIR.`
    );
  }
  const normalizedOutputDir = options.normalizedOutputDir || path.join(projectRoot, 'pipeline', 'normalized');
  const stagingDir = options.stagingDir || path.join(projectRoot, 'pipeline', 'staging');

  const emitCoreAndOverlays = options.emitCoreAndOverlays !== false;
  const emitMaterialized = options.emitMaterialized !== false;
  const emitChangelogBaselines = options.emitChangelogBaselines !== false;
  const dryRun = options.dryRun === true;

  // Initialize PathGuard for safe output asserts
  const rawDir = options.rawSourceDir || tryGetRawGameSourceDir({ projectRoot }) || undefined;
  if (rawDir && emitMaterialized && !dryRun) {
    await generateOowStatMedia(rawDir, path.dirname(publicOutputDir));
  }
  const pathGuard = rawDir
    ? createPathGuard(rawDir, [publicOutputDir, normalizedOutputDir, stagingDir])
    : null;

  const safeWriteJson = (filePath: string, data: unknown) => {
    if (dryRun) return;
    if (pathGuard) {
      pathGuard.assertSafeOutput(filePath);
    }
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  };

  const results: DatasetNormalizationResult[] = [];
  const countsByDataset: Record<string, number> = {};
  let totalEntities = 0;
  let unmappedWishPools: Awaited<ReturnType<typeof normalizeWishBannersDataset>>['unmappedLotteryCodes'] = [];

  // 1. Simulacra
  const simulacraRes = normalizeSimulacraDataset(legacySourceDir,rawDir);
  results.push(simulacraRes);
  countsByDataset.simulacra = simulacraRes.counts.total || 0;
  totalEntities += countsByDataset.simulacra;

  // 2. Matrices
  const matricesRes = normalizeMatricesDataset(legacySourceDir);
  results.push(matricesRes);
  countsByDataset.matrices = matricesRes.counts.total || 0;
  totalEntities += countsByDataset.matrices;

  // 3. Relics
  const relicsRes = normalizeRelicsDataset(legacySourceDir);
  results.push(relicsRes);
  countsByDataset.relics = relicsRes.counts.total || 0;
  totalEntities += countsByDataset.relics;

  // 4. Pets
  const petsRes = normalizePetsDataset(legacySourceDir);
  results.push(petsRes);
  countsByDataset.pets = petsRes.counts.total || 0;
  totalEntities += countsByDataset.pets;

  // 5. Food
  const foodRes = normalizeFoodDataset(legacySourceDir);
  results.push(foodRes);
  countsByDataset.food = foodRes.counts.total || 0;
  totalEntities += countsByDataset.food;

  // 6. Cosmetics (enemy portraits come from the raw boss textures when a raw
  // export is supplied, else from the already-published public mirror)
  const cosmeticsRes = normalizeCosmeticsDataset(legacySourceDir, {
    publicDir: path.join(projectRoot, 'apps', 'web', 'public'),
    rawSourceDir: rawDir,
    preservedMediaDir: path.join(legacySourceDir, 'datamine', 'shared', 'media'),
  });
  results.push(cosmeticsRes);
  countsByDataset.cosmetics = cosmeticsRes.counts.total || 0;
  totalEntities += countsByDataset.cosmetics;

  // 7. Arts
  const artsRes = normalizeArtsDataset(legacySourceDir, path.join(publicOutputDir, 'en/arts.json'));
  results.push(artsRes);
  countsByDataset.arts = artsRes.counts.total || 0;
  totalEntities += countsByDataset.arts;

  // 8. FCE (Boss Mechanics)
  const fceRes = normalizeFceDataset(legacySourceDir);
  results.push(fceRes);
  countsByDataset.fce = fceRes.counts.total || 0;
  totalEntities += countsByDataset.fce;

  // 9. OoW (Origin of War)
  const oowRes = normalizeOowDataset(legacySourceDir, rawDir);
  results.push(oowRes);
  countsByDataset.oow = oowRes.counts.total || 0;
  totalEntities += countsByDataset.oow;

  // 10. Bygone Phantasm
  const bygoneRes = normalizeBygoneDataset(legacySourceDir);
  results.push(bygoneRes);
  countsByDataset.bygone = bygoneRes.counts.total || 0;
  totalEntities += countsByDataset.bygone;

  // 11. Sequential Phantasm
  const seqRes = normalizeSeqDataset(legacySourceDir);
  results.push(seqRes);
  countsByDataset.seq = seqRes.counts.total || 0;
  totalEntities += countsByDataset.seq;

  // 12. Multype Multipliers
  const multypeRes = normalizeMultypeDataset(legacySourceDir);
  results.push(multypeRes);
  countsByDataset.multype = multypeRes.counts.total || 0;
  totalEntities += countsByDataset.multype;

  // 13. Items Datamine
  const itemsRes = normalizeItemsDataset(legacySourceDir);
  results.push(itemsRes);
  countsByDataset.items = itemsRes.counts.total || 0;
  totalEntities += countsByDataset.items;

  // 14. Comp Catalog (Squad & Raid Builder)
  const compRes = normalizeCompDataset(
    legacySourceDir,
    (simulacraRes.materialized.en as {mmo?:any[]}).mmo,
    path.join(path.dirname(publicOutputDir), 'game-assets', 'media-manifest.json')
  );
  results.push(compRes);
  countsByDataset.comp = compRes.counts.total || 0;
  totalEntities += countsByDataset.comp;

  // Historical banner schedule is curated in the legacy wish registry and
  // materialized with the other public game-data pipeline outputs.
  const normalizedSimulacra = simulacraRes.materialized.en as { items?: unknown[] };
  // Title emblems are written next to game-data (the public root this run produces).
  const wishBannersRes = normalizeWishBannersDataset(
    legacySourceDir,
    path.dirname(publicOutputDir),
    (normalizedSimulacra.items ?? []) as Parameters<typeof normalizeWishBannersDataset>[2],
    dryRun ? undefined : rawDir,
  );
  unmappedWishPools = wishBannersRes.unmappedLotteryCodes;
  if (wishBannersRes.unmappedLotteryCodes.length > 0) {
    console.warn(`[wish-banners] ${wishBannersRes.unmappedLotteryCodes.length} raw limited-order pool(s) have no explicitly scheduled banner mapping: ${wishBannersRes.unmappedLotteryCodes
      .map(({ recordName, featuredItem, maxUnluckyCount, voucherItem, awardPool, widgetPath, sourcePath, mappingIssue }) =>
        `${recordName} (${featuredItem}; pity=${maxUnluckyCount ?? 'unknown'}; voucher=${voucherItem ?? 'unknown'}; pool=${awardPool ?? 'unknown'}; widget=${widgetPath ?? 'unknown'}${mappingIssue ? `; mapping=${mappingIssue}` : ''}) [${sourcePath}]`)
      .join('; ')}`);
  }
  // Title emblems are encoded to WebP before the dataset that references them is written.
  if (!dryRun) await materializeWishTitleArt(wishBannersRes.titleArtJobs);
  results.push(wishBannersRes);
  countsByDataset['wish-banners'] = wishBannersRes.counts.total || 0;
  totalEntities += countsByDataset['wish-banners'];

  // Team8P raids are extracted by the game processor and then split into
  // language-independent configuration plus locale overlays here.
  const teamRaidsRes = normalizeTeamRaidsDataset(legacySourceDir);
  results.push(teamRaidsRes);
  countsByDataset['team-raids'] = teamRaidsRes.counts.total || 0;
  totalEntities += countsByDataset['team-raids'];

  // MMO LevyClone has an independent stage/schedule graph. Keep it out of the
  // Global Team8P catalog and materialize its own locale-aware dataset.
  const mmoTeamRaidsRes = normalizeMmoTeamRaidsDataset(legacySourceDir);
  results.push(mmoTeamRaidsRes);
  countsByDataset['mmo-team-raids'] = mmoTeamRaidsRes.counts.total || 0;
  totalEntities += countsByDataset['mmo-team-raids'];

  // MMO Build gets a static equipment/card catalog from its explicit game
  // bindings; live player loadouts remain unknown until a capture source exists.
  const mmoBuildRes = normalizeMmoBuildDataset(legacySourceDir);
  results.push(mmoBuildRes);
  countsByDataset['mmo-build'] = mmoBuildRes.counts.total || 0;
  totalEntities += countsByDataset['mmo-build'];

  // Write files
  for (const res of results) {
    const dsName = res.datasetName;

    // A. Intermediate language-independent core & overlays
    if (emitCoreAndOverlays && !dryRun) {
      safeWriteJson(path.join(normalizedOutputDir, 'core', `${dsName}.json`), res.core);
      safeWriteJson(path.join(normalizedOutputDir, 'locales', 'en', `${dsName}.json`), res.overlays.en);
      safeWriteJson(path.join(normalizedOutputDir, 'locales', 'ru', `${dsName}.json`), res.overlays.ru);
    }

    // B. Final materialized game data for Next.js and Nginx
    if (emitMaterialized && !dryRun) {
      safeWriteJson(path.join(publicOutputDir, 'en', `${dsName}.json`), res.materialized.en);
      safeWriteJson(path.join(publicOutputDir, 'ru', `${dsName}.json`), res.materialized.ru);

      for (const locale of ['en', 'ru'] as const) {
        const files = res.materializedFiles?.[locale];
        if (!files) continue;
        for (const [relativePath, payload] of Object.entries(files)) {
          safeWriteJson(path.join(publicOutputDir, locale, relativePath), payload);
        }
      }

      // Mirror datamine datasets under {en,ru}/datamine/ for section loaders
      if (['fce', 'oow', 'bygone', 'seq', 'multype', 'items', 'team-raids', 'mmo-team-raids', 'mmo-build'].includes(dsName)) {
        safeWriteJson(path.join(publicOutputDir, 'en', 'datamine', `${dsName}.json`), res.materialized.en);
        safeWriteJson(path.join(publicOutputDir, 'ru', 'datamine', `${dsName}.json`), res.materialized.ru);
      }

      // Mirror comp catalog to legacy route locations for backwards compatibility
      if (dsName === 'comp') {
        safeWriteJson(path.join(publicOutputDir, 'comp.json'), res.materialized.en);
        safeWriteJson(path.join(publicOutputDir, 'tools', 'data', 'catalog.json'), res.materialized.en);
      }

      if (dsName === 'wish-banners') {
        safeWriteJson(path.join(publicOutputDir, 'wish-banners.json'), res.materialized.en);
      }
    }
  }

  // C. Changelog baselines
  if (emitChangelogBaselines && !dryRun) {
    const { gachaBaseline, mmoBaseline } = buildChangelogBaselines(simulacraRes);
    const changelogDir = path.join(publicOutputDir, 'changelog');
    safeWriteJson(path.join(changelogDir, 'simulacra.json'), gachaBaseline);
    safeWriteJson(path.join(changelogDir, 'simulacra-mmo.json'), mmoBaseline);
  }

  if (emitMaterialized && !dryRun) buildRuntimeData(publicOutputDir);

  return {
    timestamp: new Date().toISOString(),
    datasets: results.map((r) => r.datasetName),
    totalEntities,
    countsByDataset,
    outputPath: publicOutputDir,
    normalizedPath: normalizedOutputDir,
    unmappedWishPools,
  };
}
