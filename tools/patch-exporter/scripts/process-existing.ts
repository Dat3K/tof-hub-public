import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertSafeInputOutputPaths, resolveRawExportTree, type ResolvedExportTree } from '../src/path-guards';
import { validateExportRequirements, type ExportValidationReport } from '../src/selective-list';
import {
  exportMediaAssets,
  findReferencedWebpAliases,
  findReferencedAssetAliases,
  findReferencedPreparedWebpFiles,
  findReferencedPngFiles,
  type MediaExportSummary,
} from '../src/media-exporter';
import { copyLegacySiteAssets, copyReferencedSimulacraArtwork } from '../src/materializer-adapter';

export { resolveRawExportTree, type ResolvedExportTree } from '../src/path-guards';

// Dynamically resolve shared pipeline modules to enable seamless esbuild bundling
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
 * Recursively copies directory contents with overwrite.
 */
function copyDirRecursiveSync(srcDir: string, destDir: string): number {
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let count = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
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

export interface ProcessExistingOptions {
  inputDir: string;
  outputDir: string;
  legacySourceDir?: string;
  copyRaw?: boolean;
  processData?: boolean;
  processMedia?: boolean;
  maxMedia?: number;
  validate?: boolean;
  strict?: boolean;
  verbose?: boolean;
}

export interface ProcessExistingResult {
  success: boolean;
  canonicalInput: string;
  canonicalOutput: string;
  tree: ResolvedExportTree;
  entitiesMaterialized: number;
  datasetsCount: number;
  mediaAssetsCount: number;
  durationMs: number;
}

/**
 * Worker-safe prepared-files entrypoint.
 * Strictly offline: zero game discovery, zero UnrealExporter execution.
 * Builds deploy-ready output structure:
 *  - game-assets/{png,webp}/ (preserving in-game relative paths)
 *  - game-data/{en,ru,changelog}/
 *  - release-manifest.json
 *  - validation/ (validation-report.txt, validation-report.json, export-validation.json)
 */
export async function runProcessExisting(options: ProcessExistingOptions): Promise<ProcessExistingResult> {
  const startTime = Date.now();

  // 1. Mandatory arguments check
  if (!options || typeof options !== 'object') {
    throw new Error('Missing options: options object with inputDir and outputDir is required.');
  }
  if (!options.inputDir || typeof options.inputDir !== 'string' || options.inputDir.trim() === '') {
    throw new Error('Missing mandatory argument: prepared input directory (--input) is required.');
  }
  if (!options.outputDir || typeof options.outputDir !== 'string' || options.outputDir.trim() === '') {
    throw new Error('Missing mandatory argument: output directory (--output) is required.');
  }

  // 2. Enforce canonical input/output guard ("outputs outside source")
  const { canonicalInput, canonicalOutput } = assertSafeInputOutputPaths(options.inputDir, options.outputDir);

  if (options.verbose) {
    console.log(`[PROCESS-EXISTING] Canonical Input:  ${canonicalInput}`);
    console.log(`[PROCESS-EXISTING] Canonical Output: ${canonicalOutput}`);
  }

  // 3. Resolve directory tree (handling single or double-nesting)
  const tree = resolveRawExportTree(canonicalInput);

  if (!fs.existsSync(canonicalOutput)) {
    fs.mkdirSync(canonicalOutput, { recursive: true });
  }

  // 4. Copy raw input files if explicitly requested
  if (options.copyRaw) {
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Staging raw export files from ${tree.unpackedRoot}...`);
    }
    copyDirRecursiveSync(tree.unpackedRoot, canonicalOutput);
  }

  const { normalizeGameData, buildDataManifest, validateGeneratedData } = getSharedPipelineModules();

  const publicDataDir = path.join(canonicalOutput, 'game-data');
  const normalizedOutputDir = path.join(canonicalOutput, 'pipeline', 'normalized');
  const reportsDir = path.join(canonicalOutput, 'validation');
  const gameAssetsDir = path.join(canonicalOutput, 'game-assets');

  const legacySourceDir = options.legacySourceDir || tree.unpackedRoot;

  let totalEntities = 0;
  let datasetsCount = 0;

  // 5. Materialize localized game data
  if (options.processData !== false) {
    console.log(`[PROCESS-EXISTING] Materializing localized EN/RU datasets...`);
    const normSummary = await normalizeGameData({
      legacySourceDir,
      rawSourceDir: tree.unpackedRoot,
      publicOutputDir: publicDataDir,
      normalizedOutputDir,
      stagingDir: path.join(canonicalOutput, 'staging'),
      emitCoreAndOverlays: true,
      emitMaterialized: true,
      emitChangelogBaselines: true,
    });

    totalEntities = normSummary.totalEntities;
    datasetsCount = normSummary.datasets.length;

    // Build release manifest
    console.log(`[PROCESS-EXISTING] Building release manifest...`);
    await buildDataManifest({
      legacySourceDir,
      publicDataDir,
      manifestOutput: path.join(publicDataDir, 'release-manifest.json'),
    });

    // Mirror release manifest to deploy root
    fs.copyFileSync(
      path.join(publicDataDir, 'release-manifest.json'),
      path.join(canonicalOutput, 'release-manifest.json')
    );
  }

  // 6. Export media assets
  let mediaCount = 0;
  if (options.processMedia !== false) {
    console.log(`[PROCESS-EXISTING] Staging and converting game assets (PNG + WebP)...`);
    const pngDir = path.join(gameAssetsDir, 'png');
    const webpDir = path.join(gameAssetsDir, 'webp');
    fs.mkdirSync(pngDir, { recursive: true });
    fs.mkdirSync(webpDir, { recursive: true });

    // Copy prepared representative assets if available
    const projectRoot = path.resolve(__dirname, '../../..');
    const candidateAssetSources = [
      path.join(projectRoot, 'apps/web/public/game-assets'),
      path.join(projectRoot, 'pipeline/staging/proof/game-assets'),
    ];

    for (const src of candidateAssetSources) {
      if (fs.existsSync(src)) {
        copyDirRecursiveSync(path.join(src, 'png'), pngDir);
        copyDirRecursiveSync(path.join(src, 'webp'), webpDir);
        break;
      }
    }

    // Convert only images referenced by the generated datasets. This is both
    // complete for the web app and dramatically smaller than converting every
    // PNG in a full raw game dump.
    // The local staging directory is intentionally one level below the web
    // workspace root. Supplying source paths captures UI-owned game assets
    // that are referenced directly in TS/TSX instead of generated datasets.
    const workspaceSourceDir = path.join(path.dirname(canonicalOutput), 'apps', 'web', 'src');
    const candidateMediaRoots = [
      tree.unpackedRoot,
      path.join(legacySourceDir, 'tof-fast-datamine', 'raw_exports', 'raw_exports'),
      path.join(legacySourceDir, 'tof-fast-datamine', 'raw_exports'),
      path.join(legacySourceDir, 'raw_exports', 'raw_exports'),
      path.join(legacySourceDir, 'raw_exports'),
    ].filter((root, index, roots) =>
      fs.existsSync(root) && roots.indexOf(root) === index
    );
    const referencedPngs = [
      ...new Set(
        candidateMediaRoots.flatMap((root) =>
          findReferencedPngFiles(root, publicDataDir, [workspaceSourceDir])
        )
      ),
    ];
    const referencedWebpAliases = [
      ...new Map(
        candidateMediaRoots
          .flatMap((root) => findReferencedWebpAliases(root, publicDataDir, [workspaceSourceDir]))
          .map((alias) => [alias.relativePath.toLowerCase(), alias] as const)
      ).values(),
    ];
    const referencedAssetAliases = [
      ...new Map(
        candidateMediaRoots
          .flatMap((root) => findReferencedAssetAliases(root, publicDataDir, [workspaceSourceDir]))
          .map((alias) => [alias.relativePath.toLowerCase(), alias] as const)
      ).values(),
    ];
    const preparedWebpAliases = [
      ...new Map(
        candidateMediaRoots
          .flatMap((root) => findReferencedPreparedWebpFiles(root, publicDataDir, [workspaceSourceDir]))
          .map((alias) => [alias.relativePath.toLowerCase(), alias] as const)
      ).values(),
    ];
    const aliasSourceFiles = referencedAssetAliases.map((alias) => alias.sourceFile);
    const allReferencedPngs = [...new Set([...referencedPngs, ...aliasSourceFiles])];
    const selectedPngs = options.maxMedia === undefined
      ? allReferencedPngs
      : allReferencedPngs.slice(0, Math.max(0, options.maxMedia));

    if (options.verbose) {
      console.log(
        `[PROCESS-EXISTING] Referenced media: ${allReferencedPngs.length} PNG(s); ` +
        `selected for conversion: ${selectedPngs.length}.`
      );
    }

    if (selectedPngs.length > 0 && fs.existsSync(tree.unpackedRoot)) {
      try {
        const progressStep = Math.max(1, Math.ceil(selectedPngs.length / 100));
        let lastProgress = 0;
        const logicalCpus = typeof os.availableParallelism === 'function'
          ? os.availableParallelism()
          : os.cpus().length;
        const mediaJobs = Math.max(1, logicalCpus);
        console.log(`[PROCESS-EXISTING] Media workers: ${mediaJobs} parallel conversions.`);
        console.log(`[PROCESS-EXISTING] Media conversion: 0% (0/${selectedPngs.length}).`);
          await exportMediaAssets({
          inputDir: tree.unpackedRoot,
          outputDir: canonicalOutput,
          specificFiles: selectedPngs,
          webpAliases: [...referencedWebpAliases, ...referencedAssetAliases],
          preparedWebpAliases,
          jobs: mediaJobs,
          verbose: options.verbose,
          onProgress: (completed, total) => {
            if (completed !== total && completed % progressStep !== 0) return;
            const percent = Math.floor((completed / total) * 100);
            if (percent === lastProgress) return;
            lastProgress = percent;
            console.log(`[PROCESS-EXISTING] Media conversion: ${percent}% (${completed}/${total}).`);
          },
        });
      } catch (err: any) {
        if (options.verbose) {
          console.warn(`[PROCESS-EXISTING] Media export warning: ${err?.message || err}`);
        }
      }
    }

    const curatedMediaCount = await copyReferencedSimulacraArtwork(
      legacySourceDir,
      publicDataDir,
      canonicalOutput
    );
    const siteAssetCount = copyLegacySiteAssets(legacySourceDir, canonicalOutput);
    if (options.verbose) {
      console.log(`[PROCESS-EXISTING] Legacy site assets copied: ${siteAssetCount}.`);
    }
    // Count exported PNGs
    if (fs.existsSync(pngDir)) {
      mediaCount = fs.readdirSync(pngDir, { recursive: true }).length;
    }
    mediaCount += curatedMediaCount + siteAssetCount;
  }

  // 7. Validation & Reports
  let validationPassed = true;
  if (options.validate !== false) {
    console.log(`[PROCESS-EXISTING] Running validation checks and generating reports...`);
    fs.mkdirSync(reportsDir, { recursive: true });

    // Validate generated datasets
    if (fs.existsSync(publicDataDir)) {
      const valReport = await validateGeneratedData({
        publicDataDir,
        reportsDir,
        strict: options.strict ?? false,
      });
      validationPassed = valReport.valid;
    }

    // Validate selective extraction requirements against input
    try {
      const reqReport = validateExportRequirements(tree.unpackedRoot, 'Full');
      fs.writeFileSync(
        path.join(reportsDir, 'export-validation.json'),
        JSON.stringify(reqReport, null, 2),
        'utf8'
      );
    } catch {
      // Non-fatal if raw input does not match all 165 requirements
    }
  }

  // 8. Processing record
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
        entitiesMaterialized: totalEntities,
        datasetsCount,
        mediaAssetsCount: mediaCount,
        validationPassed,
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
    entitiesMaterialized: totalEntities,
    datasetsCount,
    mediaAssetsCount: mediaCount,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Main CLI runner for process-existing and validate-only.
 */
export async function runProcessExistingCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  let inputDir = '';
  let outputDir = '';
  let legacySource = '';
  let copyRaw = false;
  let processData = true;
  let processMedia = true;
  let validate = true;
  let validateOnly = false;
  let strict = false;
  let verbose = false;
  let maxMedia: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      inputDir = argv[++i];
    } else if (arg === '--output' && argv[i + 1]) {
      outputDir = argv[++i];
    } else if (arg === '--legacy-source' && argv[i + 1]) {
      legacySource = argv[++i];
    } else if (arg === '--copy-raw') {
      copyRaw = true;
    } else if (arg === '--skip-data') {
      processData = false;
    } else if (arg === '--skip-media') {
      processMedia = false;
    } else if (arg === '--max-media' && argv[i + 1]) {
      const parsed = parseInt(argv[++i], 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('--max-media must be a non-negative integer.');
      }
      maxMedia = parsed;
    } else if (arg === '--no-validate') {
      validate = false;
    } else if (arg === '--validate') {
      validate = true;
    } else if (arg === '--validate-only' || arg === '--verify-only') {
      validateOnly = true;
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage:
  process-existing.bat --input <raw_dir> --output <deploy_dir> [options]
  validate.bat --input <target_dir> [--strict]

Options:
  --input <dir>          Mandatory: directory containing prepared raw export data
  --output <dir>         Mandatory: target directory for deployable output
  --legacy-source <dir>  Optional: legacy source data directory for localization
  --copy-raw             Stage all raw uasset files into output (disabled by default for clean deploy)
  --skip-data            Skip game data normalization/materialization
  --skip-media           Skip PNG copy and WebP conversion
  --max-media <count>    Limit the number of referenced images to convert to WebP
  --validate             Run full requirement and schema validation (default: true)
  --validate-only        Only validate existing data without processing
  --strict               Fail on warnings during validation
  --verbose              Show verbose progress details
`);
      return;
    }
  }

  // Handle validate-only mode
  if (validateOnly) {
    const target = inputDir || outputDir || './deploy';
    console.log(`[VALIDATE] Running dataset validation on: ${path.resolve(target)}`);
    const { validateGeneratedData } = getSharedPipelineModules();
    const gameDataDir = fs.existsSync(path.join(target, 'game-data'))
      ? path.join(target, 'game-data')
      : target;

    const report = await validateGeneratedData({
      publicDataDir: gameDataDir,
      strict,
    });

    console.log(`\n=== Dataset Validation Report ===`);
    console.log(`  Overall Result: ${report.valid ? '[PASS]' : '[FAIL]'}`);
    console.log(`  Total Checks: ${report.totalChecks} (${report.passedChecks} passed, ${report.failedChecks} failed)`);
    console.log(`  Manifest Validated: ${report.manifestValidated ? 'YES' : 'NO'}`);
    console.log(`  Changelog Validated: ${report.changelogValidated ? 'YES' : 'NO'}`);

    if (report.errors.length > 0) {
      console.error(`\n[ERRORS]`);
      for (const err of report.errors) {
        console.error(`  - ${err}`);
      }
    }
    if (report.warnings.length > 0) {
      console.warn(`\n[WARNINGS]`);
      for (const warn of report.warnings) {
        console.warn(`  - ${warn}`);
      }
    }

    if (!report.valid) {
      console.error(`\n[FAILED] Validation checks failed.`);
      process.exit(1);
    }
    console.log(`\n[SUCCESS] All validation checks passed.`);
    return;
  }

  // Mandatory arguments check for process-existing
  if (!inputDir) {
    console.error(`[FATAL ERROR] Missing mandatory argument: prepared input directory (--input) is required.`);
    console.error(`Run with --help for usage instructions.`);
    process.exit(1);
  }
  if (!outputDir) {
    console.error(`[FATAL ERROR] Missing mandatory argument: output directory (--output) is required.`);
    console.error(`Run with --help for usage instructions.`);
    process.exit(1);
  }

  console.log(`[PROCESS-EXISTING] Starting prepared-file processing workflow...`);
  console.log(`  Input:  ${path.resolve(inputDir)}`);
  console.log(`  Output: ${path.resolve(outputDir)}`);

  const result = await runProcessExisting({
    inputDir,
    outputDir,
    legacySourceDir: legacySource || undefined,
    copyRaw,
    processData,
    processMedia,
    maxMedia,
    validate,
    strict,
    verbose,
  });

  console.log(`\n[SUCCESS] Prepared files processed successfully in ${result.durationMs}ms:`);
  console.log(`  Deploy output: ${result.canonicalOutput}`);
  console.log(`  Entities Materialized: ${result.entitiesMaterialized} across ${result.datasetsCount} datasets.`);
  console.log(`  Game Assets Staged: ${result.mediaAssetsCount}`);
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].endsWith('process-existing.ts'))
) {
  runProcessExistingCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[FATAL ERROR] ${err.message}`);
      process.exit(1);
    });
}
