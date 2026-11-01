import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ReleaseManifestSchema,
  DatasetSchemas,
  type DatasetName,
} from '../schemas/materialized-export.schema';
import {
  FceIndexDatasetSchema,
  OowCurrentSummaryDatasetSchema,
  BygoneDatasetSchema,
  SeqCacheDatasetSchema,
  MultypeRenamesDatasetSchema,
  DatamineItemsDatasetSchema,
} from '@tof-hub/contracts';
import { convertPngToWebp, resolveNativeMediaTool } from './media-converter';

export interface MaterializerOptions {
  inputDir?: string;
  outputDir: string;
  legacySourceDir?: string;
  emitCoreAndOverlays?: boolean;
  stagingDir?: string;
  validate?: boolean;
  verbose?: boolean;
}

export interface MaterializerSummary {
  success: boolean;
  generatedAt: string;
  outputDir: string;
  publicDataDir: string;
  manifestPath: string;
  totalEntities: number;
  datasetsMaterialized: string[];
  countsByDataset: Record<string, number>;
  zodValidationPassed: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  durationMs: number;
}

// Dynamically resolve shared normalizer/materializer to prevent TypeScript rootDir TS6059 violations
// while enabling esbuild to bundle shared implementations into the standalone distribution.
function getSharedPipelineModules() {
  const normalizerMod = require('../../../scripts/normalize-game-data');
  const manifestMod = require('../../../scripts/build-data-manifest');
  const validatorMod = require('../../../scripts/validate-generated');

  return {
    normalizeGameData: normalizerMod.normalizeGameData,
    buildDataManifest: manifestMod.buildDataManifest,
    validateGeneratedData: validatorMod.validateGeneratedData,
  };
}

/**
 * Curated simulacra artwork is site media, not game media. Copy only the
 * files declared by the materialized dataset and keep the public URL stable.
 */
export async function copyReferencedSimulacraArtwork(
  legacySourceDir: string,
  publicDataDir: string,
  outputDir: string
): Promise<number> {
  const datasetPath = path.join(publicDataDir, 'en', 'simulacra.json');
  const sourceRoot = path.join(legacySourceDir, 'info', 'simulacra', 'assets');
  if (!fs.existsSync(datasetPath) || !fs.existsSync(sourceRoot)) return 0;

  let dataset: any;
  try {
    dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  } catch {
    return 0;
  }

  const references = new Set<string>();
  const items = [
    ...(Array.isArray(dataset?.items) ? dataset.items : []),
    ...(Array.isArray(dataset?.gacha) ? dataset.gacha : []),
    ...(Array.isArray(dataset?.mmo) ? dataset.mmo : []),
  ];

  for (const item of items) {
    for (const asset of Array.isArray(item?.assets) ? item.assets : []) {
      for (const key of ['pngUrl', 'webpUrl']) {
        const value = typeof asset?.[key] === 'string' ? asset[key] : '';
        const match = value.match(/^\/datamine\/shared\/media\/artworks\/([^/]+)\/(.+)$/i);
        const reference = match
          ? `${match[1]}/${match[2].replace(/\.webp$/i, '.png')}`
          : '';
        if (reference && !reference.split('/').includes('..')) references.add(reference);
      }
    }
  }

  const tool = resolveNativeMediaTool();
  if (!tool && references.size > 0) {
    throw new Error('Cannot generate simulacra WebP assets: cwebp or ffmpeg was not found.');
  }

  const targetReferences = [...references].filter((reference) => {
    const sourcePath = path.join(sourceRoot, reference);
    return fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile();
  });
  let copied = 0;
  let nextIndex = 0;
  const availableJobs = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= targetReferences.length) return;
      const reference = targetReferences[index];
      const sourcePath = path.join(sourceRoot, reference);
      const destinationPngPath = path.join(
      outputDir,
      'datamine',
      'shared',
      'media',
      'artworks',
      reference
      );
      fs.mkdirSync(path.dirname(destinationPngPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPngPath);

      const webpReference = reference.replace(/\.png$/i, '.webp');
      const destinationWebpPath = path.join(
      outputDir,
      'datamine',
      'shared',
      'media',
      'artworks',
      webpReference
      );
      const conversion = await convertPngToWebp(destinationPngPath, destinationWebpPath, {
        tool: tool || undefined,
        lossless: false,
        quality: 85,
      });
      if (!conversion.success) {
        throw new Error(`Failed to generate WebP for ${reference}: ${conversion.error || 'unknown error'}`);
      }
      copied++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(targetReferences.length, Math.max(1, availableJobs)) }, worker));

  return copied;
}

/**
 * Site-owned UI icons are not part of the raw game export. Keep the legacy
 * public URL contract and copy them unchanged into the deploy output.
 */
export function copyLegacySiteAssets(legacySourceDir: string, outputDir: string): number {
  const sourceRoot = path.join(legacySourceDir, 'datamine', 'shared', 'assets');
  const destinationRoot = path.join(outputDir, 'datamine', 'shared', 'assets');
  if (!fs.existsSync(sourceRoot)) return 0;

  const copyDirectory = (sourceDir: string, destinationDir: string): number => {
    let copied = 0;
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      const sourcePath = path.join(sourceDir, entry.name);
      const destinationPath = path.join(destinationDir, entry.name);
      if (entry.isDirectory()) {
        copied += copyDirectory(sourcePath, destinationPath);
      } else if (entry.isFile()) {
        fs.mkdirSync(destinationDir, { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
        copied += 1;
      }
    }
    return copied;
  };

  return copyDirectory(sourceRoot, destinationRoot);
}

/**
 * Validates materialized JSON files on disk against Zod schemas.
 */
export function validateMaterializedOutputs(publicDataDir: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate Release Manifest
  const manifestPath = path.join(publicDataDir, 'release-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push(`Missing release manifest at ${manifestPath}`);
  } else {
    try {
      const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const parsed = ReleaseManifestSchema.safeParse(manifestRaw);
      if (!parsed.success) {
        errors.push(`Release manifest failed Zod validation: ${parsed.error.message}`);
      }
    } catch (e: any) {
      errors.push(`Failed to parse release-manifest.json: ${e?.message || e}`);
    }
  }

  // 2. Validate all 14 datasets in both EN and RU
  const datasets: string[] = [
    'simulacra',
    'matrices',
    'relics',
    'pets',
    'food',
    'cosmetics',
    'arts',
    'fce',
    'oow',
    'bygone',
    'seq',
    'multype',
    'items',
    'comp',
  ];

  const allSchemas: Record<string, any> = {
    ...(DatasetSchemas as Record<string, any>),
    fce: FceIndexDatasetSchema,
    oow: OowCurrentSummaryDatasetSchema,
    bygone: BygoneDatasetSchema,
    seq: SeqCacheDatasetSchema,
    multype: MultypeRenamesDatasetSchema,
    items: DatamineItemsDatasetSchema,
  };

  for (const ds of datasets) {
    const schema = allSchemas[ds];
    for (const locale of ['en', 'ru'] as const) {
      const filePath = path.join(publicDataDir, locale, `${ds}.json`);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing materialized dataset: ${filePath}`);
        continue;
      }

      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (ds === 'comp') {
          if (
            !raw ||
            typeof raw !== 'object' ||
            !Array.isArray(raw.simulacra) ||
            !Array.isArray(raw.matrices) ||
            !Array.isArray(raw.relics) ||
            !Array.isArray(raw.pets)
          ) {
            errors.push(`Dataset comp (${locale}) has invalid catalog structure`);
          }
        } else if (schema) {
          const parsed = schema.safeParse(raw);
          if (!parsed.success) {
            errors.push(`Dataset ${ds} (${locale}) failed Zod validation: ${parsed.error.message}`);
          }
        }
      } catch (e: any) {
        errors.push(`JSON parse error in ${filePath}: ${e?.message || e}`);
      }
    }

    // Check ID parity between EN and RU
    const enFile = path.join(publicDataDir, 'en', `${ds}.json`);
    const ruFile = path.join(publicDataDir, 'ru', `${ds}.json`);
    if (fs.existsSync(enFile) && fs.existsSync(ruFile)) {
      try {
        const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));
        const ruData = JSON.parse(fs.readFileSync(ruFile, 'utf8'));

        const getItems = (d: any) => {
          if (!d) return [];
          if (Array.isArray(d)) return d;
          if (Array.isArray(d.items)) return d.items;
          if (Array.isArray(d.simulacra)) {
            return [
              ...d.simulacra,
              ...(d.matrices || []),
              ...(d.relics || []),
              ...(d.pets || []),
            ];
          }
          if (Array.isArray(d.dishes)) return d.dishes;
          if (Array.isArray(d.bosses)) return d.bosses;
          if (Array.isArray(d.floors)) return d.floors;
          if (Array.isArray(d.stages)) return d.stages;
          if (Array.isArray(d.recentSeasons)) return d.recentSeasons;
          if (d.mainRenames && typeof d.mainRenames === 'object') return Object.entries(d.mainRenames);
          return Object.values(d);
        };

        const enItems = getItems(enData);
        const ruItems = getItems(ruData);

        const extractId = (i: any) => {
          if (!i) return '';
          if (Array.isArray(i)) return String(i[0]);
          return String(i.id ?? i.slug ?? i.floor ?? i.stage ?? i.season ?? '');
        };

        const enIds = new Set(enItems.map(extractId).filter(Boolean));
        const ruIds = new Set(ruItems.map(extractId).filter(Boolean));

        if (enIds.size !== ruIds.size) {
          warnings.push(
            `ID count mismatch in ${ds}: EN has ${enIds.size} items, RU has ${ruIds.size} items`
          );
        }
      } catch {
        // Handled in schema check
      }
    }
  }

  // 3. Validate changelogs
  const changelogDir = path.join(publicDataDir, 'changelog');
  const gachaBaseline = path.join(changelogDir, 'simulacra.json');
  const mmoBaseline = path.join(changelogDir, 'simulacra-mmo.json');

  if (!fs.existsSync(gachaBaseline)) {
    warnings.push(`Missing changelog baseline: ${gachaBaseline}`);
  }
  if (!fs.existsSync(mmoBaseline)) {
    warnings.push(`Missing changelog baseline: ${mmoBaseline}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Materializes localized game data from raw/prepared extraction into deploy-ready public JSON.
 * Reuses the shared Phase 5 normalizer, manifest builder, and validation suite.
 */
export async function materializeGameData(
  options: MaterializerOptions
): Promise<MaterializerSummary> {
  const startTime = Date.now();
  const canonicalOutput = path.resolve(options.outputDir);
  const publicDataDir = path.join(canonicalOutput, 'game-data');
  const normalizedOutputDir = path.join(canonicalOutput, 'pipeline', 'normalized');
  const reportsDir = path.join(canonicalOutput, 'validation');

  const sourceInputDir = options.inputDir ? path.resolve(options.inputDir) : canonicalOutput;
  const legacySourceDir = options.legacySourceDir || sourceInputDir;

  const { normalizeGameData, buildDataManifest, validateGeneratedData } =
    getSharedPipelineModules();

  // 1. Run Shared Normalizer (Core + Overlays -> EN/RU Materialization)
  const normSummary = await normalizeGameData({
    legacySourceDir,
    rawSourceDir: sourceInputDir,
    publicOutputDir: publicDataDir,
    normalizedOutputDir,
    stagingDir: options.stagingDir || path.join(canonicalOutput, 'staging'),
    emitCoreAndOverlays: options.emitCoreAndOverlays ?? true,
    emitMaterialized: true,
    emitChangelogBaselines: true,
  });

  const curatedArtworkCount = await copyReferencedSimulacraArtwork(
    legacySourceDir,
    publicDataDir,
    canonicalOutput
  );
  const siteAssetCount = copyLegacySiteAssets(legacySourceDir, canonicalOutput);
  if (options.verbose) {
    console.log(`[MATERIALIZER] Curated simulacra artwork copied: ${curatedArtworkCount}`);
    console.log(`[MATERIALIZER] Legacy site assets copied: ${siteAssetCount}`);
  }

  // 2. Run Shared Release Manifest Builder
  const manifest = await buildDataManifest({
    legacySourceDir,
    publicDataDir,
    manifestOutput: path.join(publicDataDir, 'release-manifest.json'),
  });

  // Also write manifest copy to output root for convenience
  fs.copyFileSync(
    path.join(publicDataDir, 'release-manifest.json'),
    path.join(canonicalOutput, 'release-manifest.json')
  );

  // 3. Run Validation Suite & Zod Checks
  let zodPassed = true;
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  const directZodCheck = validateMaterializedOutputs(publicDataDir);
  if (!directZodCheck.valid) {
    zodPassed = false;
    validationErrors.push(...directZodCheck.errors);
  }
  validationWarnings.push(...directZodCheck.warnings);

  // Run full validation report generator
  const valReport = await validateGeneratedData({
    publicDataDir,
    reportsDir,
    strict: false,
  });

  if (!valReport.valid) {
    zodPassed = false;
    validationErrors.push(...valReport.errors);
  }
  validationWarnings.push(...valReport.warnings);

  return {
    success: zodPassed,
    generatedAt: manifest.generatedAt,
    outputDir: canonicalOutput,
    publicDataDir,
    manifestPath: path.join(publicDataDir, 'release-manifest.json'),
    totalEntities: normSummary.totalEntities,
    datasetsMaterialized: normSummary.datasets,
    countsByDataset: normSummary.countsByDataset,
    zodValidationPassed: zodPassed,
    validationErrors,
    validationWarnings,
    durationMs: Date.now() - startTime,
  };
}
