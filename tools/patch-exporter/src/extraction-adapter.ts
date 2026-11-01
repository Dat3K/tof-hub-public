import fs from 'node:fs';
import path from 'node:path';
import {
  type ExportMode,
  generateUnrealExporterConfig,
  loadExportRules,
  validateExportRequirements,
  type ExportValidationReport,
} from './selective-list';
import { type GameDiscoveryResult, detectGameRegion } from './discovery';
import { type ProcessRunner, DefaultProcessRunner } from './process-runner';
import { assertSafeInputOutputPaths } from './path-guards';

export interface ExtractionAdapterOptions {
  discovery: GameDiscoveryResult;
  outputDir: string;
  mode: ExportMode;
  aesKey?: string;
  unrealExporterExePath?: string;
  processRunner?: ProcessRunner;
  imageIgnoreList?: string[];
  customRulesPath?: string;
  timeoutMs?: number;
  skipSnapshotCheck?: boolean;
}

export interface ExtractionAdapterResult {
  success: boolean;
  outputDir: string;
  mode: ExportMode;
  configFilePath: string;
  copiedMappingFiles: string[];
  versionFile: string;
  validationReport: ExportValidationReport;
  durationMs: number;
}

/**
 * Finds UnrealExporter.exe binary.
 */
export function findUnrealExporterExecutable(candidateRoot?: string): string {
  const roots = [
    candidateRoot,
    path.resolve(__dirname, '../bin'),
    path.resolve(__dirname, '../../bin'),
    path.resolve(process.cwd(), 'tools/patch-exporter/bin'),
    path.resolve(process.cwd(), 'bin'),
  ].filter(Boolean) as string[];

  for (const root of roots) {
    const directExe = path.join(root, 'UnrealExporter.exe');
    if (fs.existsSync(directExe)) {
      return directExe;
    }
  }

  // Fallback to tools/patch-exporter/bin/UnrealExporter.exe
  return path.resolve(process.cwd(), 'tools/patch-exporter/bin/UnrealExporter.exe');
}

/**
 * Orchestrates game data extraction via UnrealExporter.
 * NOTE: Never executed against a live game during migration; used for future manual owner extraction.
 */
export async function runExtractionAdapter(
  options: ExtractionAdapterOptions
): Promise<ExtractionAdapterResult> {
  const startTime = Date.now();
  const runner = options.processRunner ?? new DefaultProcessRunner();
  const { canonicalOutput } = assertSafeInputOutputPaths(
    options.discovery.gamePath,
    options.outputDir
  );

  if (!fs.existsSync(canonicalOutput)) {
    fs.mkdirSync(canonicalOutput, { recursive: true });
  }

  // 1. Snapshot check for Pic mode (legacy parity: RUN_EXPORT_PIC requires previous text snapshot)
  if (options.mode === 'Pic' && !options.skipSnapshotCheck) {
    const hasPriorText =
      fs.existsSync(path.join(canonicalOutput, 'export-version.json')) ||
      fs.existsSync(path.join(canonicalOutput, 'text-manifest.json')) ||
      fs.existsSync(path.join(canonicalOutput, 'Hotta/Content/Localization/Game/en/Game.json')) ||
      fs.existsSync(path.join(canonicalOutput, 'MappingItemId.json'));
    if (!hasPriorText) {
      console.warn(
        `[WARNING] Pic mode requested but no prior text snapshot found in "${canonicalOutput}". For complete datamine generation, Text mode should be exported first.`
      );
    }
  }

  // 2. Copy Mapping JSON Files
  const copiedMappingFiles: string[] = [];
  if (options.discovery.configDir && options.discovery.mappingFiles.length > 0) {
    for (const mappingFile of options.discovery.mappingFiles) {
      const src = path.join(options.discovery.configDir, mappingFile);
      const dst = path.join(canonicalOutput, mappingFile);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        copiedMappingFiles.push(mappingFile);
      }
    }
  }

  // 3. Extract Client Version & Metadata
  const versionFile = path.join(canonicalOutput, 'export-version.json');
  fs.writeFileSync(
    versionFile,
    JSON.stringify(options.discovery.versionInfo, null, 2),
    'utf8'
  );

  if (options.discovery.versionInfo.sourceFile && fs.existsSync(options.discovery.versionInfo.sourceFile)) {
    const dstXml = path.join(canonicalOutput, 'config.xml');
    fs.copyFileSync(options.discovery.versionInfo.sourceFile, dstXml);
  }

  // 4. Generate UnrealExporter Configuration
  const rulesConfig = loadExportRules(options.customRulesPath);
  const region = detectGameRegion(options.discovery.versionInfo, options.discovery.gamePath);
  const aesKey = options.aesKey || rulesConfig.regionAesKeys?.[region] || rulesConfig.defaultAesKey;
  console.log(`[EXTRACT] Client region: ${region} (${options.discovery.versionInfo.branch}).`);
  const exporterConfig = generateUnrealExporterConfig({
    gamePaksPath: options.discovery.paksDir,
    outputPath: canonicalOutput,
    mode: options.mode,
    aesKey,
    rulesConfig,
    ignoredImagePaths: options.imageIgnoreList,
  });

  const configDir = path.join(canonicalOutput, '.config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configFilePath = path.join(configDir, 'current-export-run.json');
  fs.writeFileSync(configFilePath, JSON.stringify(exporterConfig, null, 2), 'utf8');

  // 5. Resolve UnrealExporter executable
  const exporterExe = options.unrealExporterExePath || findUnrealExporterExecutable();

  // 6. Run UnrealExporter via ProcessRunner
  const processResult = await runner.run(exporterExe, [configFilePath], {
    cwd: path.dirname(exporterExe),
    timeoutMs: options.timeoutMs,
    // UnrealExporter v2.0.0 accesses Windows console handles. Pipes cause
    // "Invalid handle" and exit 0 without exporting anything. Keep its native
    // console output instead of capturing/decoding it as UTF-8.
    ...(process.platform === 'win32' ? { stdio: 'inherit' as const, windowsHide: false } : {}),
  });

  if (processResult.exitCode !== 0 || /^\s*Error:/im.test(`${processResult.stdout}\n${processResult.stderr}`)) {
    throw new Error(
      `UnrealExporter failed with exit code ${processResult.exitCode}: ${processResult.stderr || processResult.stdout}`
    );
  }

  // 7. Validate Requirements
  const validationReport = validateExportRequirements(canonicalOutput, options.mode, rulesConfig);

  const reportTextLines = [
    `Tower of Fantasy Datamine Export Validation (${options.mode} Mode)`,
    `Timestamp: ${validationReport.timestamp}`,
    `Target Directory: ${canonicalOutput}`,
    `Status: ${validationReport.valid ? 'PASSED' : 'FAILED'} (${validationReport.passedChecks}/${validationReport.totalChecks} checks passed)`,
    '',
    ...validationReport.results.map((r) => `[${r.found ? 'OK' : 'MISSING'}] ${r.label}: ${r.detail}`),
  ];

  fs.writeFileSync(
    path.join(canonicalOutput, 'export-validation.txt'),
    reportTextLines.join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(canonicalOutput, 'export-validation.json'),
    JSON.stringify(validationReport, null, 2),
    'utf8'
  );

  // 8. Write Export Run Summary
  const runSummary = {
    timestamp: validationReport.timestamp,
    mode: options.mode,
    gamePath: options.discovery.gamePath,
    discoverySource: options.discovery.sourceType,
    clientVersion: options.discovery.versionInfo.version,
    clientBranch: options.discovery.versionInfo.branch,
    clientName: options.discovery.versionInfo.clientName,
    outputDir: canonicalOutput,
    copiedMappingFiles,
    validationPassed: validationReport.valid,
    durationMs: Date.now() - startTime,
  };
  fs.writeFileSync(
    path.join(canonicalOutput, 'export-run-summary.json'),
    JSON.stringify(runSummary, null, 2),
    'utf8'
  );

  return {
    success: validationReport.valid,
    outputDir: canonicalOutput,
    mode: options.mode,
    configFilePath,
    copiedMappingFiles,
    versionFile,
    validationReport,
    durationMs: Date.now() - startTime,
  };
}
