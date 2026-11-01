import fs from 'node:fs';
import path from 'node:path';
import { processExistingFiles } from './existing-files';
import { findGameInstallation } from './discovery';
import { runExtractionAdapter } from './extraction-adapter';
import { materializeGameData } from './materializer-adapter';
import { bootstrapBaseline, downloadBaseline, type ChangelogBaselinePayload } from './baseline';
import { compareSimulacraChangelogs, saveChangelogArtifacts, generateChangelogDiffReport } from './changelog';
import {
  validateDeployDirectory,
  formatValidationReportText,
  type ValidationReport,
} from './validate';
import type { ExportMode } from './selective-list';
import { runAdvancedMultype } from './advanced-multype';
import { runOneClick } from './run-command';

function printUsage(): void {
  console.log(`
Tower of Fantasy Game Data Exporter CLI

WORKFLOWS:
  0. One-click site update: game folder -> selective extraction -> processing -> release folder
     ToFExporter.exe [--game-path <dir>] [--raw <existing export>] [--baseline <manifest|public dir>]
                             [--jobs N] [--steps stage,processors,normalize,media,generators,locales,validate] [--zip] [--no-archive]
     Writes output/tof-update-<version>-<date>/ unpacked; --zip packs the same content as a ZIP instead.

  1. Prepared Files Workflow (Offline / Testing / Migration):
     ToFExporter.exe process-existing --input <prepared-input-dir> --output <output-dir> [options]

     Options:
       --input <dir>          Mandatory: directory containing pre-extracted raw game files
       --output <dir>         Mandatory: directory to stage and materialize data (must be outside input)
       --legacy-source <dir>  Optional: path to legacy site source for text and localization
       --skip-data            Skip game data normalization/materialization
       --skip-media           Skip media export and WebP generation
       --no-copy              Skip staging copy (verifies input structure only)
       --baseline-url <url>   Custom website origin to fetch published baseline for revalidation
       --baseline-dir <dir>   Offline fallback directory containing baseline fixtures
       --skip-baseline        Skip baseline download and freeze
       --skip-changelog       Skip changelog comparison against baseline
       --patch <name>         Release patch name for changelog (e.g. "Update 2026-09-18")
       --changelog-date <fmt> ISO date (YYYY-MM-DD) for changelog records
       --validate             Enforce validation reports
       --strict               Fail on warnings during validation
       --require-changelog    Require valid baseline (fatal if missing)
       --verbose              Enable verbose logging

  2. Owner Game Export Workflow (Live extraction by owner only; runs validation automatically):
     ToFExporter.exe export [options]

     Options:
       --game-path <dir>      Game installation directory (auto-discovered if omitted)
       --output <dir>         Output directory (default: ./dist_bundle)
       --mode <mode>          Normal | Short | AdvancedMultype (also Full | Text | Pic | Small)
       --aes-key <key>        Custom Unreal Engine AES decryption key
       --legacy-source <dir>  Legacy site source for text, matrices, and localization
       --strict               Fail on warnings during validation
       --require-changelog    Require valid baseline
       --verbose              Enable verbose logging

  3. First Baseline Bootstrap Workflow (Owner initial baseline generation):
     ToFExporter.exe bootstrap-baseline --input <simulacra-data-dir> --output <target-changelog-dir> [options]

     Options:
       --input <dir>          Mandatory: directory containing published per-entity or unified simulacra JSON
       --output <dir>         Mandatory: target directory for baseline files (e.g. apps/web/public/game-data/changelog)
       --verbose              Enable verbose logging

  4. Baseline Fetch & Revalidate Workflow:
     ToFExporter.exe fetch-baseline [options]

     Options:
       --url <origin>         Custom baseline origin URL (default: https://tof.smilekritik.beer)
       --cache <dir>          Directory to store cached baseline and metadata
       --dir <dir>            Local fallback fixtures directory if remote unavailable
       --verbose              Enable verbose logging

  5. Changelog Comparison Workflow:
     ToFExporter.exe compare-changelog --baseline <dir-or-file> --export <dir-or-file> --output <dir> [options]

     Options:
       --baseline <dir>       Mandatory: directory containing baseline simulacra.json and simulacra-mmo.json
       --export <dir>         Mandatory: directory containing fresh export simulacra.json and simulacra-mmo.json
       --output <dir>         Mandatory: directory to save changelog artifacts
       --patch <name>         Release patch label (e.g. "Update 2026-09-18")
       --changelog-date <fmt> ISO date string (YYYY-MM-DD)
       --verbose              Enable verbose logging

  6. Dataset and Deploy Validation Workflow:
     ToFExporter.exe validate --input <deploy-dir> [options]

     Options:
       --input <dir>          Target deploy or game-data directory to validate
       --strict               Fail on warnings in addition to fatal errors
       --require-changelog    Enforce changelog baseline presence (fatal if missing)
       --package <dir>        Also validate portable package prerequisites / structure
       --verbose              Enable verbose logging

  7. Advanced Multype Workflow (standalone, never called by the website build):
     ToFExporter.exe advanced-multype --input <exported-json-dir> --output <result-dir> [options]

     Options:
       --input <dir>          Full already-exported game JSON tree
       --output <dir>         Separate directory for mapping and AI guess artifacts
       --references <dir>     Optional extra curated JSON for resolving IDs to names
       --jobs <count>         Workers (default: all available logical CPUs)
`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return;
  }

  const command = argv[0].startsWith('--') ? 'process-existing' : argv[0];
  const args = argv[0].startsWith('--') ? argv : argv.slice(1);

  // One-click update used by RUN.bat; the bundle lives in <package>/scripts.
  if (command === 'run') {
    await runOneClick(args, path.resolve(__dirname, '..'));
    return;
  }

  let inputDir = '';
  let outputDir = '';
  let gamePath = '';
  let legacySource = '';
  let mode: ExportMode = 'Full';
  let aesKey = '';
  let verbose = false;
  let copyFiles = true;
  let processData = true;
  let processMedia = true;
  let validate = false;
  let strict = false;
  let requireChangelog = false;
  let packageDir = '';
  let baselineUrl = '';
  let baselineDir = '';
  let skipBaseline = false;
  let skipChangelog = false;
  let patch = '';
  let changelogDate = '';
  let client = '';
  let clientRu = '';
  let cacheDir = '';
  let baselinePath = '';
  let exportPath = '';
  let referencesDir = '';
  let jobs: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' && args[i + 1]) {
      inputDir = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      outputDir = args[++i];
    } else if (arg === '--game-path' && args[i + 1]) {
      gamePath = args[++i];
    } else if (arg === '--legacy-source' && args[i + 1]) {
      legacySource = args[++i];
    } else if (arg === '--mode' && args[i + 1]) {
      const requestedMode = args[++i].toLowerCase().replace(/[-_]/g, '');
      const modeAliases: Record<string, ExportMode> = {
        normal: 'Full',
        short: 'Text',
        advancedmultype: 'AdvancedMultype',
        full: 'Full',
        text: 'Text',
        pic: 'Pic',
        small: 'Small',
      };
      if (!modeAliases[requestedMode]) throw new Error(`Unknown export mode: ${args[i]}`);
      mode = modeAliases[requestedMode];
    } else if (arg === '--aes-key' && args[i + 1]) {
      aesKey = args[++i];
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
    } else if (arg === '--package' && args[i + 1]) {
      packageDir = args[++i];
    } else if ((arg === '--baseline-url' || arg === '--url') && args[i + 1]) {
      baselineUrl = args[++i];
    } else if ((arg === '--baseline-dir' || arg === '--dir') && args[i + 1]) {
      baselineDir = args[++i];
    } else if (arg === '--cache' && args[i + 1]) {
      cacheDir = args[++i];
    } else if (arg === '--skip-baseline') {
      skipBaseline = true;
    } else if (arg === '--skip-changelog') {
      skipChangelog = true;
    } else if (arg === '--patch' && args[i + 1]) {
      patch = args[++i];
    } else if (arg === '--changelog-date' && args[i + 1]) {
      changelogDate = args[++i];
    } else if (arg === '--client' && args[i + 1]) {
      client = args[++i];
    } else if (arg === '--client-ru' && args[i + 1]) {
      clientRu = args[++i];
    } else if (arg === '--baseline' && args[i + 1]) {
      baselinePath = args[++i];
    } else if (arg === '--export' && args[i + 1]) {
      exportPath = args[++i];
    } else if (arg === '--references' && args[i + 1]) {
      referencesDir = args[++i];
    } else if (arg === '--jobs' && args[i + 1]) {
      jobs = Number.parseInt(args[++i], 10);
    }
  }

  if (command === 'advanced-multype') {
    if (!inputDir || !outputDir) throw new Error('advanced-multype requires --input and --output.');
    if (jobs !== undefined && (!Number.isInteger(jobs) || jobs < 1)) throw new Error('--jobs must be a positive integer.');
    console.log('[CLI] Running standalone Advanced Multype scan...');
    const result = await runAdvancedMultype({
      inputDir,
      outputDir,
      referenceDir: referencesDir || undefined,
      jobs,
    });
    console.log(`[SUCCESS] Scanned ${result.filesScanned} JSON files in ${result.durationMs}ms.`);
    console.log(`  Files with attributes: ${result.filesWithAttributes}`);
    console.log(`  Output: ${result.outputDir}`);
    return;
  }

  if (command === 'process-existing') {
    console.log(`[CLI] Running prepared-file processing workflow...`);
    const result = await processExistingFiles({
      inputDir,
      outputDir,
      legacySourceDir: legacySource || undefined,
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
    console.log(`[SUCCESS] Processed existing files successfully in ${result.durationMs}ms.`);
    console.log(`  Source: ${result.canonicalInput}`);
    console.log(`  Target: ${result.canonicalOutput}`);
    console.log(`  Files staged: ${result.stagedFilesCount}`);
    if (result.dataSummary) {
      console.log(`  Data Materialized: ${result.dataSummary.totalEntities} entities across ${result.dataSummary.datasetsMaterialized.length} datasets.`);
      console.log(`  Zod Validation: ${result.dataSummary.zodValidationPassed ? 'PASSED' : 'FAILED'}`);
    }
    if (result.baselineResult) {
      console.log(`  Baseline Resolved: ${result.baselineResult.status} (source: ${result.baselineResult.source})`);
    }
    if (result.freezeResult) {
      console.log(`  Baseline Frozen: Gacha ${result.freezeResult.gachaCount}, MMO ${result.freezeResult.mmoCount} entities`);
      console.log(`  New Characters:  Gacha +${result.freezeResult.newIdsCount.gacha}, MMO +${result.freezeResult.newIdsCount.mmo}`);
    }
    if (result.changelogResult) {
      console.log(`  Changelog: status ${result.changelogResult.status}, ${result.changelogResult.summary.totalCharactersWithChanges} characters modified (${result.changelogResult.summary.totalValueChanges} values)`);
      console.log(`  New IDs excluded from value diffs: ${result.changelogResult.summary.totalNewCharacters}`);
    }
    if (result.mediaSummary) {
      console.log(`  Media Exported: ${result.mediaSummary.copiedPngCount} PNGs, ${result.mediaSummary.convertedWebpCount} WebPs.`);
    }
    if (result.deployValidationReport) {
      console.log(
        `  Validation: ${result.deployValidationReport.valid ? 'PASSED' : 'FAILED'} (${result.deployValidationReport.fatalCount} fatal, ${result.deployValidationReport.warningCount} warnings, status: ${result.deployValidationReport.changelogStatus})`
      );
    } else if (result.validationReport) {
      console.log(`  Validation: ${result.validationReport.passedChecks}/${result.validationReport.totalChecks} checks passed.`);
    }
    return;
  }

  if (command === 'validate') {
    console.log(`[CLI] Running dataset and deploy validation...`);
    let target: string;
    let sourceInput: string | undefined = undefined;
    if (inputDir && outputDir && path.resolve(inputDir) !== path.resolve(outputDir)) {
      sourceInput = inputDir;
      target = outputDir;
    } else {
      target = inputDir || outputDir || args[0] || './deploy';
    }

    const report = await validateDeployDirectory({
      targetDir: target,
      inputDir: sourceInput,
      strict,
      requireChangelog,
      packageDir: packageDir || undefined,
      checkPackaging: Boolean(packageDir),
      verbose,
      writeReports: true,
    });

    console.log('\n' + formatValidationReportText(report));
    if (!report.valid) {
      console.error(`\n[FATAL] Validation failed with ${report.fatalCount} fatal error(s) and ${report.warningCount} warning(s).`);
      process.exit(1);
    }
    console.log(`\n[SUCCESS] All validation checks passed.`);
    return;
  }

  if (command === 'bootstrap-baseline') {
    console.log(`[CLI] Running first baseline bootstrap workflow...`);
    if (!inputDir || !outputDir) {
      throw new Error('Both --input and --output are required for bootstrap-baseline.');
    }
    const result = await bootstrapBaseline({
      inputDir,
      outputDir,
      verbose,
    });
    console.log(`[SUCCESS] Bootstrapped baseline successfully in ${result.durationMs}ms.`);
    console.log(`  Gacha Baseline: ${result.gachaPath} (${result.gachaTotal} entities)`);
    console.log(`  MMO Baseline:   ${result.mmoPath} (${result.mmoTotal} entities)`);
    console.log(`  Notice: Initial baseline contains zero synthetic changelog entries. Ready for owner deployment.`);
    return;
  }

  if (command === 'fetch-baseline') {
    console.log(`[CLI] Running baseline fetch and HTTP revalidation workflow...`);
    const result = await downloadBaseline({
      baseUrl: baselineUrl || undefined,
      cacheDir: cacheDir || undefined,
      localBaselineDir: baselineDir || undefined,
      verbose,
    });
    console.log(`[BASELINE RESULT] Status: ${result.status}, Source: ${result.source}`);
    if (result.gachaBaseline) {
      console.log(`  Gacha Baseline: ${result.gachaBaseline.total} characters`);
    }
    if (result.mmoBaseline) {
      console.log(`  MMO Baseline:   ${result.mmoBaseline.total} characters`);
    }
    if (result.warnings && result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.warn(`  Warning: ${w}`);
      }
    }
    if (result.error) {
      console.warn(`  Notice: ${result.error}`);
    }
    return;
  }

  if (command === 'export') {
    console.log(`[CLI] Running owner game export workflow...`);
    const discovery = findGameInstallation({ customGamePath: gamePath || undefined });
    console.log(`  Found game installation: ${discovery.gamePath}`);
    console.log(`  PAK directory: ${discovery.paksDir}`);
    console.log(`  Client version: ${discovery.versionInfo.version} (${discovery.versionInfo.clientName})`);

    const result = await runExtractionAdapter({
      discovery,
      outputDir: outputDir || './dist_bundle',
      mode,
      aesKey: aesKey || undefined,
    });

    console.log(`[SUCCESS] Extraction adapter completed in ${result.durationMs}ms.`);
    console.log(`  Output: ${result.outputDir}`);
    console.log(`  Requirements: ${result.validationReport.passedChecks}/${result.validationReport.totalChecks} checks passed.`);

    // Advanced mode is a raw-export analyzer. It deliberately bypasses site
    // materialization and deploy validation so it remains portable and never
    // depends on a previously built web application.
    if (mode === 'AdvancedMultype') {
      const scanResult = await runAdvancedMultype({
        inputDir: result.outputDir,
        outputDir: path.join(result.outputDir, 'advanced-multype'),
        referenceDir: referencesDir || undefined,
        jobs,
      });
      console.log(`  Advanced Multype: ${scanResult.filesWithAttributes}/${scanResult.filesScanned} files matched.`);
      console.log(`  Guess artifact: ${path.join(scanResult.outputDir, 'multype_ai_guesses.json')}`);
      return;
    }

    // Extraction produces raw files; the application reads the materialized
    // localized game-data directory. Build it before deploy validation.
    console.log(`[EXPORT] Materializing localized game data...`);
    const dataSummary = await materializeGameData({
      inputDir: result.outputDir,
      outputDir: result.outputDir,
      legacySourceDir: legacySource || undefined,
      validate: true,
      verbose,
    });
    console.log(
      `  Data Materialized: ${dataSummary.totalEntities} entities across ${dataSummary.datasetsMaterialized.length} datasets.`
    );
    console.log(`  Zod Validation: ${dataSummary.zodValidationPassed ? 'PASSED' : 'FAILED'}`);
    if (!dataSummary.success) {
      throw new Error(
        `Game-data materialization failed with ${dataSummary.validationErrors.length} error(s).`
      );
    }

    // Automated post-export validation
    console.log(`[EXPORT] Running automated post-export validation...`);
    const valReport = await validateDeployDirectory({
      targetDir: result.outputDir,
      strict,
      requireChangelog,
      verbose,
      writeReports: true,
    });
    console.log(`  Validation: ${valReport.valid ? 'PASSED' : 'FAILED'} (${valReport.fatalCount} fatal, ${valReport.warningCount} warnings)`);
    console.log(`  Reports: ${path.join(result.outputDir, 'validation-report.json')} & .txt`);
    if (!valReport.valid && strict) {
      throw new Error(`Export validation failed in strict mode with ${valReport.fatalCount} fatal error(s).`);
    }
    return;
  }

  if (command === 'compare-changelog') {
    console.log(`[CLI] Running changelog comparison workflow...`);
    const baseSource = baselinePath || baselineDir || inputDir;
    const expSource = exportPath || outputDir;

    if (!baseSource || !expSource) {
      throw new Error('Both --baseline and --export paths are required for compare-changelog.');
    }

    const loadPayload = (src: string, filePrefix: string): ChangelogBaselinePayload | null => {
      const candidates = [
        path.join(src, `${filePrefix}.json`),
        path.join(src, 'changelog', `${filePrefix}.json`),
        path.join(src, 'game-data', 'changelog', `${filePrefix}.json`),
        src.endsWith('.json') && src.includes(filePrefix) ? src : '',
      ].filter(Boolean);

      for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          try {
            return JSON.parse(fs.readFileSync(cand, 'utf8'));
          } catch {
            // Ignore parse errors on candidate probing
          }
        }
      }
      return null;
    };

    const oldGacha = loadPayload(baseSource, 'simulacra');
    const oldMmo = loadPayload(baseSource, 'simulacra-mmo');
    const freshGacha = loadPayload(expSource, 'simulacra');
    const freshMmo = loadPayload(expSource, 'simulacra-mmo');

    if (!freshGacha || !freshMmo) {
      throw new Error(`Could not locate fresh simulacra.json and simulacra-mmo.json in ${expSource}`);
    }

    const comparison = compareSimulacraChangelogs(
      { gacha: oldGacha, mmo: oldMmo },
      { gacha: freshGacha, mmo: freshMmo },
      {
        patch: patch || undefined,
        date: changelogDate || undefined,
        client: client || undefined,
        clientRu: clientRu || undefined,
        verbose,
      }
    );

    const targetOutput = outputDir || expSource || './changelog-output';
    const artifacts = saveChangelogArtifacts(targetOutput, comparison);

    console.log(`[SUCCESS] Changelog comparison finished (status: ${comparison.status}):`);
    console.log(`  Gacha changes: ${comparison.gacha.charactersWithChangesCount} characters (${comparison.gacha.totalValueChangesCount} values)`);
    console.log(`  MMO changes:   ${comparison.mmo.charactersWithChangesCount} characters (${comparison.mmo.totalValueChangesCount} values)`);
    console.log(`  New IDs (excluded):     ${comparison.summary.totalNewCharacters}`);
    console.log(`  Removed IDs (separate): ${comparison.summary.totalRemovedCharacters}`);
    console.log(`  Artifacts:`);
    console.log(`    JSON:   ${artifacts.diffJsonPath}`);
    console.log(`    Report: ${artifacts.reportTxtPath}`);
    return;
  }

  throw new Error(`Unknown command "${command}". Use --help for usage instructions.`);
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith('cli.ts'))) {
  main().catch((err) => {
    console.error(`[FATAL ERROR] ${err.message}`);
    process.exit(1);
  });
}
