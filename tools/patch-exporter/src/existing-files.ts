import fs from 'node:fs';
import path from 'node:path';
import {
  assertSafeInputOutputPaths,
  resolveRawExportTree,
  type ResolvedExportTree,
} from './path-guards';
import {
  validateExportRequirements,
  type ExportValidationReport,
} from './selective-list';
import {
  materializeGameData,
  type MaterializerSummary,
} from './materializer-adapter';
import {
  exportMediaAssets,
  findReferencedWebpAliases,
  findReferencedAssetAliases,
  findReferencedPreparedWebpFiles,
  findReferencedPngFiles,
  findMissingReferencedAssetPaths,
  type MediaExportSummary,
} from './media-exporter';
import type { ConvertWebpOptions } from './media-converter';
import type { ProcessRunner } from './process-runner';
import {
  downloadBaseline,
  freezeBaselineToDeploy,
  prepareBaselineComparison,
  type BaselineDownloadResult,
  type BaselineFreezeResult,
  type ChangelogBaselinePayload,
} from './baseline';
import {
  compareSimulacraChangelogs,
  applyChangelogsToCharacters,
  saveChangelogArtifacts,
  type ChangelogComparisonResult,
} from './changelog';

import {
  validateDeployDirectory,
  type ValidationReport,
} from './validate';

export interface ProcessExistingOptions {
  inputDir: string;
  outputDir: string;
  copyFiles?: boolean;
  processData?: boolean;
  processMedia?: boolean;
  verbose?: boolean;
  validate?: boolean;
  strict?: boolean;
  requireChangelog?: boolean;
  legacySourceDir?: string;
  mockConverter?: ConvertWebpOptions['mockConverter'];
  mediaMaxFiles?: number;
  processRunner?: ProcessRunner;
  attemptExtraction?: boolean;
  extract?: boolean;
  baselineUrl?: string;
  baselineCacheDir?: string;
  localBaselineDir?: string;
  skipBaselineDownload?: boolean;
  patch?: string;
  changelogDate?: string;
  client?: string;
  clientRu?: string;
  skipChangelogCompare?: boolean;
}

export interface ProcessExistingResult {
  success: boolean;
  canonicalInput: string;
  canonicalOutput: string;
  tree: ResolvedExportTree;
  stagedFilesCount: number;
  dataSummary?: MaterializerSummary;
  mediaSummary?: MediaExportSummary;
  baselineResult?: BaselineDownloadResult;
  freezeResult?: BaselineFreezeResult;
  changelogResult?: ChangelogComparisonResult;
  durationMs: number;
  validationReport?: ExportValidationReport;
  deployValidationReport?: ValidationReport;
}

/**
 * Copies directory contents recursively with path safety checks.
 */
function copyDirRecursiveSync(srcDir: string, destDir: string): number {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursiveSync(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }

  return count;
}

/**
 * Worker-safe prepared-file processing entrypoint.
 *
 * Strict invariants:
 *  1. Mandatory inputDir and outputDir. Missing options throw clear errors.
 *  2. Canonical input/output guards enforced before write ("outputs outside source").
 *  3. Strictly NEVER invokes game discovery.
 *  4. Strictly NEVER invokes UnrealExporter or live extraction.
 *  5. Strictly NEVER falls back to extraction if prepared input is missing or invalid.
 *  6. Produces deploy-ready structure:
 *     - game-data/{en,ru}/*.json + release-manifest.json
 *     - game-assets/png/... + game-assets/webp/...
 *     - validation reports + Zod verification
 */
export async function processExistingFiles(
  options: ProcessExistingOptions
): Promise<ProcessExistingResult> {
  const startTime = Date.now();

  // 1. Mandatory arguments check
  if (!options || typeof options !== 'object') {
    throw new Error('Missing options: options object with inputDir and outputDir is required.');
  }

  if (!options.inputDir || typeof options.inputDir !== 'string' || options.inputDir.trim() === '') {
    throw new Error(
      'Missing mandatory argument: prepared input directory (--input) is required.'
    );
  }

  if (!options.outputDir || typeof options.outputDir !== 'string' || options.outputDir.trim() === '') {
    throw new Error(
      'Missing mandatory argument: output directory (--output) is required.'
    );
  }

  // Strictly prohibit extraction in existing-files mode
  if (
    options.attemptExtraction ||
    options.extract ||
    (options as any).gamePath ||
    options.processRunner
  ) {
    throw new Error(
      'Extraction is strictly forbidden in existing-files mode. UnrealExporter, game discovery, and live extraction fallback are disabled.'
    );
  }

  // 2. Canonical input/output guard (enforces "outputs outside source")
  const { canonicalInput, canonicalOutput } = assertSafeInputOutputPaths(
    options.inputDir,
    options.outputDir
  );

  if (options.verbose) {
    console.log(`[PROCESS-EXISTING] Canonical Input:  ${canonicalInput}`);
    console.log(`[PROCESS-EXISTING] Canonical Output: ${canonicalOutput}`);
  }

  // 3. Resolve directory nesting (raw_exports/raw_exports)
  const tree = resolveRawExportTree(canonicalInput);

  // 4. Validate prepared inputs exist without fallback to extraction
  const contents = fs.readdirSync(tree.unpackedRoot);
  if (contents.length === 0) {
    throw new Error(
      `Prepared input directory "${tree.unpackedRoot}" is empty. Extraction fallback is disabled; valid prepared fixtures must be provided.`
    );
  }

  const hasRecognizableData =
    tree.hasHottaContent ||
    tree.hasManifest ||
    contents.some(
      (f) =>
        f.startsWith('MappingItemId') ||
        f === 'export-version.json' ||
        f === 'config.xml' ||
        f === 'info' ||
        f === 'datamine'
    );

  if (!hasRecognizableData) {
    throw new Error(
      `Prepared input directory "${canonicalInput}" does not contain expected Tower of Fantasy raw export data (e.g. Hotta/, full-manifest.json, or MappingItemId*.json). Extraction fallback is disabled.`
    );
  }

  // 5. Ensure output directory exists
  if (!fs.existsSync(canonicalOutput)) {
    fs.mkdirSync(canonicalOutput, { recursive: true });
  }

  // 6. Stage prepared raw files if requested
  let stagedFilesCount = 0;
  if (options.copyFiles !== false) {
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Staging prepared files from ${tree.unpackedRoot} to ${canonicalOutput}...`);
    }
    stagedFilesCount = copyDirRecursiveSync(tree.unpackedRoot, canonicalOutput);
  }

  // 6.5 Resolve published baseline with HTTP revalidation
  let baselineResult: BaselineDownloadResult | undefined;
  if (!options.skipBaselineDownload) {
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Resolving published baseline with HTTP revalidation...`);
    }
    const candidateLocal = options.localBaselineDir || path.join(canonicalOutput, 'game-data', 'changelog');
    baselineResult = await downloadBaseline({
      baseUrl: options.baselineUrl,
      cacheDir: options.baselineCacheDir || path.join(canonicalOutput, 'staging', 'baseline-cache'),
      localBaselineDir: fs.existsSync(candidateLocal) ? candidateLocal : undefined,
      verbose: options.verbose,
    });
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Baseline download status: ${baselineResult.status} (source: ${baselineResult.source})`);
    }
  }

  // 7. Materialize localized game data (Phase 5 Normalizer + Manifest Builder + Zod Validation)
  let dataSummary: MaterializerSummary | undefined;
  if (options.processData !== false) {
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Materializing EN/RU localized game data...`);
    }
    dataSummary = await materializeGameData({
      inputDir: tree.unpackedRoot,
      outputDir: canonicalOutput,
      legacySourceDir: options.legacySourceDir,
      validate: options.validate !== false,
      verbose: options.verbose,
    });
  }

  // 7.5 Freeze complete fresh baselines into deploy archive
  let freezeResult: BaselineFreezeResult | undefined;
  const changelogDir = path.join(canonicalOutput, 'game-data', 'changelog');
  const gachaFile = path.join(changelogDir, 'simulacra.json');
  const mmoFile = path.join(changelogDir, 'simulacra-mmo.json');

  if (fs.existsSync(gachaFile) && fs.existsSync(mmoFile)) {
    try {
      const freshGacha = JSON.parse(fs.readFileSync(gachaFile, 'utf8')) as ChangelogBaselinePayload;
      const freshMmo = JSON.parse(fs.readFileSync(mmoFile, 'utf8')) as ChangelogBaselinePayload;

      freezeResult = freezeBaselineToDeploy({
        gachaBaseline: freshGacha,
        mmoBaseline: freshMmo,
        deployDir: canonicalOutput,
        oldGachaBaseline: baselineResult?.gachaBaseline,
        oldMmoBaseline: baselineResult?.mmoBaseline,
      });

      if (options.verbose) {
        console.log(`[PROCESS-EXISTING] Froze fresh baselines into deploy archive:`);
        console.log(`  Gacha total: ${freezeResult.gachaCount} (new characters: ${freezeResult.newIdsCount.gacha})`);
        console.log(`  MMO total:   ${freezeResult.mmoCount} (new characters: ${freezeResult.newIdsCount.mmo})`);
      }
    } catch (err: any) {
      if (options.verbose) {
        console.warn(`[PROCESS-EXISTING] Warning freezing baseline to deploy: ${err.message}`);
      }
    }
  }

  // 7.6 Compare fresh export against baseline
  let changelogResult: ChangelogComparisonResult | undefined;
  if (options.skipChangelogCompare !== true && fs.existsSync(gachaFile) && fs.existsSync(mmoFile)) {
    try {
      const freshGacha = JSON.parse(fs.readFileSync(gachaFile, 'utf8')) as ChangelogBaselinePayload;
      const freshMmo = JSON.parse(fs.readFileSync(mmoFile, 'utf8')) as ChangelogBaselinePayload;

      changelogResult = compareSimulacraChangelogs(
        baselineResult
          ? {
              gacha: baselineResult.gachaBaseline,
              mmo: baselineResult.mmoBaseline,
            }
          : null,
        {
          gacha: freshGacha,
          mmo: freshMmo,
        },
        {
          patch: options.patch,
          date: options.changelogDate,
          client: options.client,
          clientRu: options.clientRu,
          verbose: options.verbose,
        }
      );

      saveChangelogArtifacts(canonicalOutput, changelogResult);

      if (options.verbose) {
        console.log(`[PROCESS-EXISTING] Simulacra changelog comparison (status: ${changelogResult.status}):`);
        console.log(`  Gacha: ${changelogResult.gacha.charactersWithChangesCount} characters changed (${changelogResult.gacha.totalValueChangesCount} value diffs)`);
        console.log(`  MMO:   ${changelogResult.mmo.charactersWithChangesCount} characters changed (${changelogResult.mmo.totalValueChangesCount} value diffs)`);
        console.log(`  New characters (excluded from value changes): ${changelogResult.summary.totalNewCharacters}`);
        console.log(`  Removed characters (separate category):       ${changelogResult.summary.totalRemovedCharacters}`);
      }
    } catch (err: any) {
      if (options.verbose) {
        console.warn(`[PROCESS-EXISTING] Warning during changelog comparison: ${err.message}`);
      }
    }
  }

  // 8. Export media assets: preserve in-game relative path + WebP generation
  let mediaSummary: MediaExportSummary | undefined;
  if (options.processMedia !== false) {
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Exporting media assets (PNG + WebP)...`);
    }
    // Game media must come exclusively from the prepared raw export. Legacy is
    // allowed as a migration/data reference, never as an asset source or
    // fallback. This also prevents accidentally indexing/copying the legacy
    // raw_exports tree during materialization.
    const publicDataDir = path.join(canonicalOutput, 'game-data');
    const sourceDirs = [path.resolve(process.cwd(), 'apps', 'web', 'src')];
    const referencedPngs = findReferencedPngFiles(
      tree.unpackedRoot,
      publicDataDir,
      sourceDirs,
    );
    const missingReferencedAssets = findMissingReferencedAssetPaths(
      tree.unpackedRoot,
      publicDataDir,
      sourceDirs,
    );
    if (missingReferencedAssets.length > 0) {
      const missingReportDir = path.join(canonicalOutput, 'validation');
      fs.mkdirSync(missingReportDir, { recursive: true });
      fs.writeFileSync(
        path.join(missingReportDir, 'missing-media-assets.json'),
        JSON.stringify(
          {
            status: 'needs-owner-review',
            source: 'prepared-raw-export-only',
            count: missingReferencedAssets.length,
            paths: missingReferencedAssets,
          },
          null,
          2,
        ),
        'utf8',
      );
      if (options.verbose) {
        console.warn(
          `[PROCESS-EXISTING] ${missingReferencedAssets.length} referenced media asset(s) are absent from the prepared raw export. See validation/missing-media-assets.json.`,
        );
      }
      if (options.strict) {
        throw new Error(
          `[STRICT MEDIA VALIDATION FAILURE] ${missingReferencedAssets.length} referenced media asset(s) are absent from the prepared raw export. See validation/missing-media-assets.json.`,
        );
      }
    }
    const referencedWebpAliases = findReferencedWebpAliases(
      tree.unpackedRoot,
      publicDataDir,
      sourceDirs,
    );
    const referencedAssetAliases = findReferencedAssetAliases(
      tree.unpackedRoot,
      publicDataDir,
      sourceDirs,
    );
    const preparedWebpAliases = findReferencedPreparedWebpFiles(
      tree.unpackedRoot,
      publicDataDir,
      sourceDirs,
    );

    mediaSummary = await exportMediaAssets({
      inputDir: tree.unpackedRoot,
      specificFiles: [
        ...referencedPngs,
        ...referencedAssetAliases.map((alias) => alias.sourceFile),
      ],
      webpAliases: [...referencedWebpAliases, ...referencedAssetAliases],
      preparedWebpAliases,
      outputDir: canonicalOutput,
      mockConverter: options.mockConverter,
      maxFiles: options.mediaMaxFiles,
      verbose: options.verbose,
    });
  }

  // 9. Validate staged output if requested
  let validationReport: ExportValidationReport | undefined;
  let deployValidationReport: ValidationReport | undefined;

  if (options.validate) {
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Validating staged export against requirements...`);
    }
    validationReport = validateExportRequirements(canonicalOutput, 'Full');
    const valDir = path.join(canonicalOutput, 'validation');
    if (!fs.existsSync(valDir)) {
      fs.mkdirSync(valDir, { recursive: true });
    }
    const valReportJson = JSON.stringify(validationReport, null, 2);
    fs.writeFileSync(path.join(valDir, 'export-validation.json'), valReportJson, 'utf8');
    fs.writeFileSync(path.join(canonicalOutput, 'export-validation.json'), valReportJson, 'utf8');

    // Run comprehensive export validation engine with fatal and warning severities
    deployValidationReport = await validateDeployDirectory({
      targetDir: canonicalOutput,
      inputDir: canonicalInput,
      strict: options.strict,
      requireChangelog: options.requireChangelog,
      verbose: options.verbose,
      writeReports: true,
    });

    if (options.strict && !deployValidationReport.valid) {
      throw new Error(
        `[STRICT VALIDATION FAILURE] Export validation failed with ${deployValidationReport.fatalCount} fatal error(s) and ${deployValidationReport.warningCount} warning(s).`
      );
    }

    if (options.requireChangelog && deployValidationReport.changelogStatus === 'baseline_unavailable') {
      throw new Error(`[FATAL] Baseline unavailable in require-changelog mode.`);
    }
  }

  // 10. Write processing record
  const recordFile = path.join(canonicalOutput, 'prepared-processing-record.json');
  fs.writeFileSync(
    recordFile,
    JSON.stringify(
      {
        status: 'SUCCESS',
        mode: 'prepared_files_only',
        timestamp: new Date().toISOString(),
        sourceInput: canonicalInput,
        unpackedRoot: tree.unpackedRoot,
        isDoubleNested: tree.isDoubleNested,
        hasHottaContent: tree.hasHottaContent,
        stagedFilesCount,
        dataMaterialized: Boolean(dataSummary && dataSummary.success),
        mediaExported: Boolean(mediaSummary && mediaSummary.convertedWebpCount >= 0),
        baselineStatus: baselineResult ? baselineResult.status : 'skipped',
        baselineSource: baselineResult ? baselineResult.source : 'none',
        baselineGachaTotal: freezeResult ? freezeResult.gachaCount : null,
        baselineMmoTotal: freezeResult ? freezeResult.mmoCount : null,
        newCharactersIncluded: freezeResult ? freezeResult.newIdsCount : null,
        changelogStatus: changelogResult ? changelogResult.status : (baselineResult?.status === 'unavailable' ? 'baseline_unavailable' : 'skipped'),
        changelogValueChangesCount: changelogResult ? changelogResult.summary.totalValueChanges : null,
        changelogCharactersWithChangesCount: changelogResult ? changelogResult.summary.totalCharactersWithChanges : null,
        newCharactersExcludedFromChangelog: changelogResult ? changelogResult.summary.totalNewCharacters : null,
        removedCharactersCategoryCount: changelogResult ? changelogResult.summary.totalRemovedCharacters : null,
        validated: Boolean(options.validate),
        validationPassed: deployValidationReport ? deployValidationReport.valid : (validationReport ? validationReport.valid : (dataSummary ? dataSummary.zodValidationPassed : null)),
        validationFatalCount: deployValidationReport ? deployValidationReport.fatalCount : 0,
        validationWarningCount: deployValidationReport ? deployValidationReport.warningCount : 0,
        durationMs: Date.now() - startTime,
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    success: true,
    canonicalInput,
    canonicalOutput,
    tree,
    stagedFilesCount,
    dataSummary,
    mediaSummary,
    baselineResult,
    freezeResult,
    changelogResult,
    durationMs: Date.now() - startTime,
    validationReport,
    deployValidationReport,
  };
}

/**
 * CLI runner for existing-files entrypoint.
 * Used for standalone CLI invocations of processExistingFiles.
 */
export async function runExistingFilesCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  let inputDir = '';
  let outputDir = '';
  let verbose = false;
  let copyFiles = true;
  let processData = true;
  let processMedia = true;
  let validate = false;
  let baselineUrl = '';
  let baselineDir = '';
  let skipBaseline = false;
  let skipChangelog = false;
  let patch = '';
  let changelogDate = '';
  let client = '';
  let clientRu = '';

  let strict = false;
  let requireChangelog = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      inputDir = argv[++i];
    } else if (arg === '--output' && argv[i + 1]) {
      outputDir = argv[++i];
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (arg === '--no-copy') {
      copyFiles = false;
    } else if (arg === '--skip-data') {
      processData = false;
    } else if (arg === '--skip-media') {
      processMedia = false;
    } else if (arg === '--validate') {
      validate = true;
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--require-changelog') {
      requireChangelog = true;
    } else if (arg === '--baseline-url' && argv[i + 1]) {
      baselineUrl = argv[++i];
    } else if (arg === '--baseline-dir' && argv[i + 1]) {
      baselineDir = argv[++i];
    } else if (arg === '--skip-baseline') {
      skipBaseline = true;
    } else if (arg === '--skip-changelog') {
      skipChangelog = true;
    } else if (arg === '--patch' && argv[i + 1]) {
      patch = argv[++i];
    } else if (arg === '--changelog-date' && argv[i + 1]) {
      changelogDate = argv[++i];
    } else if (arg === '--client' && argv[i + 1]) {
      client = argv[++i];
    } else if (arg === '--client-ru' && argv[i + 1]) {
      clientRu = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: process-existing --input <prepared-input-dir> --output <output-dir> [options]

Invariants:
  - Requires valid pre-extracted game data in --input.
  - Output directory must reside outside the source input directory.
  - Strictly offline; never performs game discovery or live extraction.

Options:
  --input <dir>          Mandatory: prepared raw game data directory
  --output <dir>         Mandatory: target directory to stage output
  --no-copy              Verify directory structure without copying files
  --skip-data            Skip game data normalization/materialization
  --skip-media           Skip media export and WebP generation
  --baseline-url <url>   Custom website origin to fetch published baseline for revalidation
  --baseline-dir <dir>   Offline fallback directory containing baseline fixtures
  --skip-baseline        Skip baseline download / freeze
  --skip-changelog       Skip changelog comparison against baseline
  --patch <name>         Release patch label for changelog (e.g. "Update 2026-09-18")
  --changelog-date <fmt> ISO date string (YYYY-MM-DD) for changelog records
  --validate             Validate staged files against domain requirements and Zod schemas
  --strict               Fail on warnings during validation
  --require-changelog    Require valid changelog baseline (fatal if missing)
  --verbose              Enable detailed logging
`);
      return;
    }
  }

  const result = await processExistingFiles({
    inputDir,
    outputDir,
    copyFiles,
    processData,
    processMedia,
    verbose,
    validate,
    strict,
    requireChangelog,
    baselineUrl: baselineUrl || undefined,
    localBaselineDir: baselineDir || undefined,
    skipBaselineDownload: skipBaseline,
    skipChangelogCompare: skipChangelog,
    patch: patch || undefined,
    changelogDate: changelogDate || undefined,
    client: client || undefined,
    clientRu: clientRu || undefined,
  });

  console.log(`[SUCCESS] Processed existing files in ${result.durationMs}ms:`);
  console.log(`  Source: ${result.canonicalInput}`);
  console.log(`  Target: ${result.canonicalOutput}`);
  console.log(`  Staged files: ${result.stagedFilesCount}`);
  if (result.dataSummary) {
    console.log(`  Data Materialized: ${result.dataSummary.totalEntities} entities across ${result.dataSummary.datasetsMaterialized.length} datasets.`);
    console.log(`  Zod Validation: ${result.dataSummary.zodValidationPassed ? 'PASSED' : 'FAILED'}`);
  }
  if (result.mediaSummary) {
    console.log(`  Media Exported: ${result.mediaSummary.copiedPngCount} PNGs, ${result.mediaSummary.convertedWebpCount} WebPs generated.`);
  }
  if (result.changelogResult) {
    console.log(`  Changelog: status ${result.changelogResult.status}, ${result.changelogResult.summary.totalCharactersWithChanges} characters modified (${result.changelogResult.summary.totalValueChanges} values).`);
    console.log(`  New IDs excluded from value diffs: ${result.changelogResult.summary.totalNewCharacters}`);
  }
  if (result.deployValidationReport) {
    console.log(
      `  Validation: ${result.deployValidationReport.valid ? 'PASSED' : 'FAILED'} (${result.deployValidationReport.fatalCount} fatal, ${result.deployValidationReport.warningCount} warnings, status: ${result.deployValidationReport.changelogStatus})`
    );
  } else if (result.validationReport) {
    console.log(
      `  Requirements: ${result.validationReport.passedChecks}/${result.validationReport.totalChecks} checks passed (${result.validationReport.valid ? 'PASSED' : 'FAILED'}).`
    );
  }
}

const isDirectExistingFilesExecution = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith('existing-files.ts') ||
      process.argv[1].endsWith('process-existing.js') ||
      process.argv[1].endsWith('process-existing.ts') ||
      process.argv[1].endsWith('process-existing'))
);

if (require.main === module && isDirectExistingFilesExecution) {
  runExistingFilesCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[FATAL ERROR] ${err.message}`);
      process.exit(1);
    });
}
