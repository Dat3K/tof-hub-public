import fs from 'node:fs';
import path from 'node:path';
import {
  DatasetSchemas,
  ReleaseManifestSchema,
  type DatasetName,
} from '../schemas/materialized-export.schema';
import { assertSafeInputOutputPaths } from './path-guards';
import { loadExportRules, type ExportRulesConfig } from './selective-list';

export type ValidationSeverity = 'fatal' | 'warning' | 'info';

export type ValidationCategory =
  | 'unparsable_json'
  | 'missing_deploy_structure'
  | 'unsafe_path'
  | 'impossible_packaging'
  | 'baseline_unavailable'
  | 'optional_image_missing'
  | 'locale_fallback'
  | 'unusual_counts'
  | 'schema_mismatch';

export interface ValidationIssue {
  severity: ValidationSeverity;
  category: ValidationCategory;
  code: string;
  message: string;
  file?: string;
  details?: Record<string, any>;
}

export interface DatasetValidationDetail {
  enValid: boolean;
  ruValid: boolean;
  enCount: number;
  ruCount: number;
  idParity: boolean;
  missingRuIds?: string[];
  localeFallbacks?: number;
}

export interface ValidationReport {
  timestamp: string;
  targetDir: string;
  valid: boolean;
  strict: boolean;
  requireChangelog: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  fatalCount: number;
  warningCount: number;
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
  manifestValidated: boolean;
  changelogValidated: boolean;
  changelogStatus: 'ready' | 'no_changes' | 'baseline_unavailable' | 'malformed' | 'skipped' | 'failed';
  packagingValidated?: boolean;
  deployStructure: {
    hasGameData: boolean;
    hasEnDatasets: boolean;
    hasRuDatasets: boolean;
    hasReleaseManifest: boolean;
    hasChangelogBaselines: boolean;
    hasGameAssets: boolean;
  };
  datasetsValidated: Record<string, DatasetValidationDetail>;
  summary: {
    fatal: number;
    warnings: number;
    deployStructureValid: boolean;
    jsonIntegrityValid: boolean;
    pathSafetyValid: boolean;
    changelogValid: boolean;
    packagingValid?: boolean;
  };
}

export interface ValidateOptions {
  targetDir: string;
  inputDir?: string;
  reportsDir?: string;
  strict?: boolean;
  requireChangelog?: boolean;
  checkPackaging?: boolean;
  packageDir?: string;
  writeReports?: boolean;
  verbose?: boolean;
}

export interface PackagingValidationReport {
  valid: boolean;
  packageDir: string;
  fatalErrors: string[];
  warnings: string[];
  missingComponents: string[];
  presentComponents: string[];
}

const REQUIRED_DATASET_NAMES: DatasetName[] = [
  'simulacra',
  'matrices',
  'relics',
  'pets',
  'food',
  'cosmetics',
  'arts',
];

/**
 * Validates a portable exporter distribution package directory.
 * Severity: 'impossible_packaging' -> FATAL.
 */
export function validatePackagingStructure(
  packageDir: string,
  options: { verbose?: boolean } = {}
): PackagingValidationReport {
  const resolvedDir = path.resolve(packageDir);
  const fatalErrors: string[] = [];
  const warnings: string[] = [];
  const missingComponents: string[] = [];
  const presentComponents: string[] = [];

  const requiredFiles = [
    'runtime/node.exe',
    'bin/UnrealExporter.exe',
    'scripts/cli.js',
    'scripts/process-existing.js',
    'config/export-rules.json',
    'config/runtime.json',
    'export.bat',
    'process-existing.bat',
    'validate.bat',
    'README.txt',
  ];

  const optionalFiles = [
    'bin/cwebp.exe',
    'bin/libSkiaSharp.dll',
    'bin/blake3_dotnet.dll',
    'runtime/NODE_LICENSE',
    'bin/LICENSE.txt',
  ];

  for (const rel of requiredFiles) {
    const fullPath = path.join(resolvedDir, rel);
    if (fs.existsSync(fullPath)) {
      presentComponents.push(rel);
    } else {
      missingComponents.push(rel);
      fatalErrors.push(`[FATAL] Impossible packaging: missing required component "${rel}" in ${resolvedDir}`);
    }
  }

  for (const rel of optionalFiles) {
    const fullPath = path.join(resolvedDir, rel);
    if (fs.existsSync(fullPath)) {
      presentComponents.push(rel);
    } else {
      warnings.push(`[WARN] Optional package asset missing: "${rel}"`);
    }
  }

  const valid = fatalErrors.length === 0;
  if (options.verbose) {
    console.log(`[VALIDATE-PKG] Portable package validation for ${resolvedDir}: ${valid ? 'PASSED' : 'FAILED'}`);
    if (!valid) {
      for (const err of fatalErrors) console.error(`  ${err}`);
    }
  }

  return {
    valid,
    packageDir: resolvedDir,
    fatalErrors,
    warnings,
    missingComponents,
    presentComponents,
  };
}

/**
 * Main export validation engine.
 *
 * Severity rules:
 *  - FATAL:
 *      * Unparsable required JSON
 *      * Missing critical deploy structure (game-data/{en,ru}/*.json, release-manifest.json)
 *      * Unsafe path / write (output inside source input, illegal traversal)
 *      * Impossible packaging (missing bundled node runtime, missing UnrealExporter, scripts)
 *      * Baseline unavailable ONLY WHEN strict mode or require-changelog is explicitly enabled
 *  - WARNING:
 *      * Baseline unavailable (default non-strict mode skips changelog with explicit status)
 *      * Optional images missing (PNG/WebP assets)
 *      * Locale fallbacks (missing RU translations falling back to EN)
 *      * Unusual dataset entity counts (0 items or large drop)
 *
 * Generates validation-report.json and validation-report.txt.
 */
export async function validateDeployDirectory(
  options: ValidateOptions
): Promise<ValidationReport> {
  const startTime = new Date();
  const targetDir = path.resolve(options.targetDir);
  const strict = Boolean(options.strict);
  const requireChangelog = Boolean(options.requireChangelog);
  const verbose = Boolean(options.verbose);

  const issues: ValidationIssue[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const recordIssue = (
    severity: ValidationSeverity,
    category: ValidationCategory,
    code: string,
    message: string,
    file?: string,
    details?: Record<string, any>
  ) => {
    issues.push({ severity, category, code, message, file, details });
  };

  const checkAssertion = (
    condition: boolean,
    severityOnFail: ValidationSeverity,
    category: ValidationCategory,
    code: string,
    passMessage: string,
    failMessage: string,
    file?: string,
    details?: Record<string, any>
  ): boolean => {
    totalChecks++;
    if (condition) {
      passedChecks++;
      if (verbose) {
        console.log(`  [PASS] ${code}: ${passMessage}`);
      }
      return true;
    } else {
      recordIssue(severityOnFail, category, code, failMessage, file, details);
      if (verbose) {
        const tag = severityOnFail === 'fatal' ? '[FATAL]' : '[WARN]';
        console.warn(`  ${tag} ${code}: ${failMessage}`);
      }
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Unsafe Path / Write Check (FATAL)
  // ---------------------------------------------------------------------------
  let pathSafetyValid = true;
  if (options.inputDir) {
    try {
      assertSafeInputOutputPaths(options.inputDir, targetDir);
      checkAssertion(
        true,
        'fatal',
        'unsafe_path',
        'SAFE_INPUT_OUTPUT_PATHS',
        'Output directory is strictly separate from input source',
        ''
      );
    } catch (err: any) {
      pathSafetyValid = false;
      checkAssertion(
        false,
        'fatal',
        'unsafe_path',
        'UNSAFE_PATH_CONTAINMENT',
        '',
        `Unsafe path containment detected: ${err.message}`,
        targetDir
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Critical Deploy Structure Check (FATAL)
  // ---------------------------------------------------------------------------
  let dataDir = targetDir;
  if (fs.existsSync(path.join(targetDir, 'game-data'))) {
    dataDir = path.join(targetDir, 'game-data');
  }

  const enDir = path.join(dataDir, 'en');
  const ruDir = path.join(dataDir, 'ru');
  const changelogDir = path.join(dataDir, 'changelog');

  const hasGameData = fs.existsSync(dataDir);
  const hasEnDir = fs.existsSync(enDir);
  const hasRuDir = fs.existsSync(ruDir);

  checkAssertion(
    hasGameData,
    'fatal',
    'missing_deploy_structure',
    'MISSING_DATA_DIR',
    'Game data root directory exists',
    `Critical deploy structure missing: game data directory not found at ${dataDir}`,
    dataDir
  );

  checkAssertion(
    hasEnDir,
    'fatal',
    'missing_deploy_structure',
    'MISSING_EN_DIR',
    'English locale directory exists',
    `Critical deploy structure missing: EN directory not found at ${enDir}`,
    enDir
  );

  checkAssertion(
    hasRuDir,
    'fatal',
    'missing_deploy_structure',
    'MISSING_RU_DIR',
    'Russian locale directory exists',
    `Critical deploy structure missing: RU directory not found at ${ruDir}`,
    ruDir
  );

  // Release manifest check
  const candidateManifests = [
    path.join(dataDir, 'release-manifest.json'),
    path.join(targetDir, 'release-manifest.json'),
  ];
  const manifestPath = candidateManifests.find((p) => fs.existsSync(p));
  const hasReleaseManifest = Boolean(manifestPath);

  checkAssertion(
    hasReleaseManifest,
    'fatal',
    'missing_deploy_structure',
    'MISSING_RELEASE_MANIFEST',
    'Release manifest exists in deploy structure',
    `Critical deploy structure missing: release-manifest.json not found in ${dataDir} or ${targetDir}`,
    dataDir
  );

  let manifestValidated = false;
  if (manifestPath) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const json = JSON.parse(raw);
      const parsed = ReleaseManifestSchema.safeParse(json);
      manifestValidated = checkAssertion(
        parsed.success,
        'fatal',
        'schema_mismatch',
        'INVALID_RELEASE_MANIFEST_SCHEMA',
        'Release manifest matches authoritative schema',
        `Release manifest schema invalid: ${parsed.error?.message || 'unknown schema error'}`,
        manifestPath
      );
    } catch (err: any) {
      checkAssertion(
        false,
        'fatal',
        'unparsable_json',
        'UNPARSABLE_RELEASE_MANIFEST',
        '',
        `Release manifest is unparsable JSON: ${err.message}`,
        manifestPath
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Datasets Validation (Syntax, Schema, Entity Counts, Locale Fallbacks)
  // ---------------------------------------------------------------------------
  const datasetsValidated: Record<string, DatasetValidationDetail> = {};
  let jsonIntegrityValid = true;

  for (const dsName of REQUIRED_DATASET_NAMES) {
    const enFile = path.join(enDir, `${dsName}.json`);
    const ruFile = path.join(ruDir, `${dsName}.json`);

    const enExists = fs.existsSync(enFile);
    const ruExists = fs.existsSync(ruFile);

    checkAssertion(
      enExists,
      'fatal',
      'missing_deploy_structure',
      `MISSING_DATASET_EN_${dsName.toUpperCase()}`,
      `EN dataset ${dsName}.json exists`,
      `Missing required EN dataset file: ${enFile}`,
      enFile
    );

    checkAssertion(
      ruExists,
      'fatal',
      'missing_deploy_structure',
      `MISSING_DATASET_RU_${dsName.toUpperCase()}`,
      `RU dataset ${dsName}.json exists`,
      `Missing required RU dataset file: ${ruFile}`,
      ruFile
    );

    let enData: any = null;
    let ruData: any = null;
    let enValid = false;
    let ruValid = false;

    // Parse EN dataset
    if (enExists) {
      try {
        const raw = fs.readFileSync(enFile, 'utf8');
        enData = JSON.parse(raw);
        const schema = DatasetSchemas[dsName];
        if (dsName === 'food') {
          const isValidFood = Boolean(
            Array.isArray(enData) ||
            (enData && typeof enData === 'object' && (Array.isArray(enData.items) || Array.isArray(enData.dishes)))
          );
          enValid = checkAssertion(
            isValidFood,
            'fatal',
            'schema_mismatch',
            'SCHEMA_INVALID_EN_FOOD',
            'EN food conforms to dataset format',
            'EN food is neither an array nor a valid dishes container',
            enFile
          );
        } else if (schema) {
          const parsed = schema.safeParse(enData);
          enValid = checkAssertion(
            parsed.success,
            'fatal',
            'schema_mismatch',
            `SCHEMA_INVALID_EN_${dsName.toUpperCase()}`,
            `EN ${dsName} conforms to dataset schema`,
            `EN ${dsName} failed schema validation: ${parsed.error?.message}`,
            enFile
          );
        } else {
          enValid = true;
          totalChecks++;
          passedChecks++;
        }
      } catch (err: any) {
        jsonIntegrityValid = false;
        checkAssertion(
          false,
          'fatal',
          'unparsable_json',
          `UNPARSABLE_JSON_EN_${dsName.toUpperCase()}`,
          '',
          `EN ${dsName}.json is unparsable JSON: ${err.message}`,
          enFile
        );
      }
    }

    // Parse RU dataset
    if (ruExists) {
      try {
        const raw = fs.readFileSync(ruFile, 'utf8');
        ruData = JSON.parse(raw);
        const schema = DatasetSchemas[dsName];
        if (dsName === 'food') {
          const isValidFood = Boolean(
            Array.isArray(ruData) ||
            (ruData && typeof ruData === 'object' && (Array.isArray(ruData.items) || Array.isArray(ruData.dishes)))
          );
          ruValid = checkAssertion(
            isValidFood,
            'fatal',
            'schema_mismatch',
            'SCHEMA_INVALID_RU_FOOD',
            'RU food conforms to dataset format',
            'RU food is neither an array nor a valid dishes container',
            ruFile
          );
        } else if (schema) {
          const parsed = schema.safeParse(ruData);
          ruValid = checkAssertion(
            parsed.success,
            'fatal',
            'schema_mismatch',
            `SCHEMA_INVALID_RU_${dsName.toUpperCase()}`,
            `RU ${dsName} conforms to dataset schema`,
            `RU ${dsName} failed schema validation: ${parsed.error?.message}`,
            ruFile
          );
        } else {
          ruValid = true;
          totalChecks++;
          passedChecks++;
        }
      } catch (err: any) {
        jsonIntegrityValid = false;
        checkAssertion(
          false,
          'fatal',
          'unparsable_json',
          `UNPARSABLE_JSON_RU_${dsName.toUpperCase()}`,
          '',
          `RU ${dsName}.json is unparsable JSON: ${err.message}`,
          ruFile
        );
      }
    }

    const extractItems = (data: any): any[] => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.dishes)) return data.dishes;
      if (Array.isArray(data.characters)) return data.characters;
      return [];
    };

    const enItems = extractItems(enData);
    const ruItems = extractItems(ruData);

    const enCount = enItems.length;
    const ruCount = ruItems.length;

    // Severity: unusual counts -> WARNING
    checkAssertion(
      enCount > 0,
      'warning',
      'unusual_counts',
      `UNUSUAL_EMPTY_COUNT_EN_${dsName.toUpperCase()}`,
      `EN ${dsName} has non-zero entity count (${enCount})`,
      `EN ${dsName}.json contains unusual count of 0 entities`,
      enFile
    );

    checkAssertion(
      ruCount > 0,
      'warning',
      'unusual_counts',
      `UNUSUAL_EMPTY_COUNT_RU_${dsName.toUpperCase()}`,
      `RU ${dsName} has non-zero entity count (${ruCount})`,
      `RU ${dsName}.json contains unusual count of 0 entities`,
      ruFile
    );

    // ID parity and locale fallback checks (WARNING)
    const enIds = new Set(enItems.map((i) => i.id).filter(Boolean));
    const ruIds = new Set(ruItems.map((i) => i.id).filter(Boolean));

    const missingRu: string[] = [];
    for (const id of enIds) {
      if (!ruIds.has(id)) {
        missingRu.push(id);
      }
    }

    const idParity = missingRu.length === 0;
    checkAssertion(
      idParity,
      'warning',
      'locale_fallback',
      `LOCALE_ID_PARITY_${dsName.toUpperCase()}`,
      `${dsName} verified complete ID parity between EN and RU`,
      `Locale ID mismatch: RU ${dsName} missing ${missingRu.length} ID(s) present in EN: ${missingRu.slice(0, 5).join(', ')}${missingRu.length > 5 ? '...' : ''}`,
      ruFile,
      { missingIds: missingRu }
    );

    // Check for obvious text fallbacks where RU entity lacks Russian text
    let localeFallbacks = 0;
    if (dsName === 'simulacra') {
      for (const item of ruItems) {
        if (!item.name_ru && item.name_en) {
          localeFallbacks++;
        }
      }
      if (localeFallbacks > 0) {
        checkAssertion(
          false,
          'warning',
          'locale_fallback',
          'SIMULACRA_LOCALE_FALLBACK',
          '',
          `${localeFallbacks} Simulacra entity(s) in RU dataset fall back to English name`,
          ruFile,
          { fallbackCount: localeFallbacks }
        );
      }
    }

    datasetsValidated[dsName] = {
      enValid,
      ruValid,
      enCount,
      ruCount,
      idParity,
      missingRuIds: missingRu.length > 0 ? missingRu : undefined,
      localeFallbacks: localeFallbacks > 0 ? localeFallbacks : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Baseline & Changelog Validation
  //    Spec rule: Baseline unavailable by default does NOT destroy the export
  //    (creates warning and skips changelog with explicit status).
  //    Fatal ONLY if user explicitly ran with require-changelog or strict mode.
  // ---------------------------------------------------------------------------
  let changelogValidated = false;
  let changelogStatus: ValidationReport['changelogStatus'] = 'skipped';

  const gachaBaselineFile = path.join(changelogDir, 'simulacra.json');
  const mmoBaselineFile = path.join(changelogDir, 'simulacra-mmo.json');

  const gachaExists = fs.existsSync(gachaBaselineFile);
  const mmoExists = fs.existsSync(mmoBaselineFile);
  const hasChangelogBaselines = gachaExists && mmoExists;

  if (!hasChangelogBaselines) {
    changelogStatus = 'baseline_unavailable';
    const missingBaselines = [
      !gachaExists ? 'simulacra.json' : '',
      !mmoExists ? 'simulacra-mmo.json' : '',
    ].filter(Boolean).join(', ');

    if (strict || requireChangelog) {
      checkAssertion(
        false,
        'fatal',
        'baseline_unavailable',
        'BASELINE_UNAVAILABLE_FATAL',
        '',
        `Changelog baseline unavailable in strict/require-changelog mode: missing ${missingBaselines}`,
        changelogDir
      );
    } else {
      checkAssertion(
        false,
        'warning',
        'baseline_unavailable',
        'BASELINE_UNAVAILABLE_WARNING',
        '',
        `Changelog baseline unavailable (${missingBaselines}); skipping changelog without failing export`,
        changelogDir
      );
    }
  } else {
    // Both baseline files exist: verify parseability and content
    let gachaPayload: any = null;
    let mmoPayload: any = null;
    let baselinesParseable = true;

    try {
      gachaPayload = JSON.parse(fs.readFileSync(gachaBaselineFile, 'utf8'));
    } catch (err: any) {
      baselinesParseable = false;
      const sev = strict || requireChangelog ? 'fatal' : 'warning';
      checkAssertion(
        false,
        sev,
        'unparsable_json',
        'UNPARSABLE_GACHA_BASELINE',
        '',
        `Gacha baseline simulacra.json is unparsable JSON: ${err.message}`,
        gachaBaselineFile
      );
    }

    try {
      mmoPayload = JSON.parse(fs.readFileSync(mmoBaselineFile, 'utf8'));
    } catch (err: any) {
      baselinesParseable = false;
      const sev = strict || requireChangelog ? 'fatal' : 'warning';
      checkAssertion(
        false,
        sev,
        'unparsable_json',
        'UNPARSABLE_MMO_BASELINE',
        '',
        `MMO baseline simulacra-mmo.json is unparsable JSON: ${err.message}`,
        mmoBaselineFile
      );
    }

    if (!baselinesParseable) {
      changelogStatus = 'malformed';
    } else {
      const gachaChars = gachaPayload?.characters && typeof gachaPayload.characters === 'object'
        ? Object.keys(gachaPayload.characters).length
        : 0;
      const mmoChars = mmoPayload?.characters && typeof mmoPayload.characters === 'object'
        ? Object.keys(mmoPayload.characters).length
        : 0;

      const hasCharacters = gachaChars > 0 && mmoChars > 0;
      checkAssertion(
        hasCharacters,
        'warning',
        'unusual_counts',
        'BASELINE_CHARACTERS_PRESENT',
        `Baseline characters verified (Gacha: ${gachaChars}, MMO: ${mmoChars})`,
        `Baseline contains empty character dictionary (Gacha: ${gachaChars}, MMO: ${mmoChars})`,
        changelogDir
      );

      // Check generated changelog artifacts if present
      const candidateDiffs = [
        path.join(changelogDir, 'changelog-diff.json'),
        path.join(targetDir, 'changelog-diff.json'),
        path.join(targetDir, 'validation', 'changelog-diff.json'),
      ];
      const diffFile = candidateDiffs.find((p) => fs.existsSync(p));

      if (diffFile) {
        try {
          const diffData = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
          changelogStatus = diffData.status || (diffData.summary?.totalValueChanges > 0 ? 'ready' : 'no_changes');
          changelogValidated = true;
          totalChecks++;
          passedChecks++;
        } catch {
          changelogStatus = 'malformed';
        }
      } else {
        changelogStatus = 'ready';
        changelogValidated = true;
        totalChecks++;
        passedChecks++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Optional Media Assets Validation (WARNING)
  // ---------------------------------------------------------------------------
  const assetsDir = path.join(targetDir, 'game-assets');
  const pngDir = path.join(assetsDir, 'png');
  const webpDir = path.join(assetsDir, 'webp');
  const hasGameAssets = fs.existsSync(assetsDir);

  if (hasGameAssets) {
    let pngCount = 0;
    let webpCount = 0;
    if (fs.existsSync(pngDir)) {
      pngCount = fs.readdirSync(pngDir, { recursive: true }).filter((f) => String(f).endsWith('.png')).length;
    }
    if (fs.existsSync(webpDir)) {
      webpCount = fs.readdirSync(webpDir, { recursive: true }).filter((f) => String(f).endsWith('.webp')).length;
    }

    checkAssertion(
      pngCount > 0 || webpCount > 0,
      'warning',
      'optional_image_missing',
      'MEDIA_ASSETS_POPULATED',
      `Game assets populated (${pngCount} PNG, ${webpCount} WebP)`,
      `Optional game-assets directory exists but contains 0 image files`,
      assetsDir
    );
  } else {
    // Media directory absence is an optional warning, never fatal
    recordIssue(
      'warning',
      'optional_image_missing',
      'OPTIONAL_GAME_ASSETS_DIR_ABSENT',
      `Optional game-assets directory not found at ${assetsDir}`,
      assetsDir
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Portable Packaging Validation (FATAL if requested)
  // ---------------------------------------------------------------------------
  let packagingValidated: boolean | undefined;
  if (options.checkPackaging || options.packageDir) {
    const pkgDir = options.packageDir || targetDir;
    const pkgResult = validatePackagingStructure(pkgDir, { verbose });
    packagingValidated = pkgResult.valid;
    totalChecks += pkgResult.missingComponents.length + pkgResult.presentComponents.length;
    passedChecks += pkgResult.presentComponents.length;

    for (const missing of pkgResult.missingComponents) {
      recordIssue(
        'fatal',
        'impossible_packaging',
        'MISSING_PACKAGE_COMPONENT',
        `Impossible packaging: missing required component "${missing}" in ${pkgDir}`,
        path.join(pkgDir, missing)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Severity Aggregation & Overall Status
  // ---------------------------------------------------------------------------
  const fatalIssues = issues.filter((i) => i.severity === 'fatal');
  const warningIssues = issues.filter((i) => i.severity === 'warning');

  const fatalCount = fatalIssues.length;
  const warningCount = warningIssues.length;

  const valid = strict
    ? fatalCount === 0 && warningCount === 0
    : fatalCount === 0;

  const errors = fatalIssues.map((i) => `[FATAL] ${i.code}: ${i.message}`);
  const warnings = warningIssues.map((i) => `[WARN] ${i.code}: ${i.message}`);

  const report: ValidationReport = {
    timestamp: startTime.toISOString(),
    targetDir,
    valid,
    strict,
    requireChangelog,
    totalChecks,
    passedChecks,
    failedChecks: fatalCount + warningCount,
    fatalCount,
    warningCount,
    errors,
    warnings,
    issues,
    manifestValidated,
    changelogValidated,
    changelogStatus,
    packagingValidated,
    deployStructure: {
      hasGameData,
      hasEnDatasets: hasEnDir,
      hasRuDatasets: hasRuDir,
      hasReleaseManifest,
      hasChangelogBaselines,
      hasGameAssets,
    },
    datasetsValidated,
    summary: {
      fatal: fatalCount,
      warnings: warningCount,
      deployStructureValid: hasGameData && hasEnDir && hasRuDir && hasReleaseManifest,
      jsonIntegrityValid,
      pathSafetyValid,
      changelogValid: changelogStatus !== 'failed' && (strict ? changelogStatus !== 'baseline_unavailable' : true),
      packagingValid: packagingValidated,
    },
  };

  // Write reports to target directory if requested
  if (options.writeReports !== false) {
    writeValidationReports(targetDir, report, options.reportsDir);
  }

  return report;
}

/**
 * Formats a clean, human-readable validation report text.
 */
export function formatValidationReportText(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push('===============================================================================');
  lines.push('Tower of Fantasy Export & Dataset Validation Report');
  lines.push('===============================================================================');
  lines.push(`Timestamp:          ${report.timestamp}`);
  lines.push(`Target Directory:   ${report.targetDir}`);
  lines.push(`Overall Status:     ${report.valid ? 'PASSED (VALID)' : 'FAILED (INVALID)'}`);
  lines.push(`Strict Mode:        ${report.strict ? 'ENABLED' : 'DISABLED'}`);
  lines.push(`Require Changelog:  ${report.requireChangelog ? 'YES' : 'NO'}`);
  lines.push(`Total Checks:       ${report.totalChecks} (${report.passedChecks} passed, ${report.failedChecks} failed)`);
  lines.push(`Severities:         ${report.fatalCount} fatal error(s), ${report.warningCount} warning(s)`);
  lines.push('');

  lines.push('DEPLOY STRUCTURE & MANIFEST:');
  lines.push(`  Game Data Root:      ${report.deployStructure.hasGameData ? 'OK' : 'MISSING'}`);
  lines.push(`  EN Datasets Dir:     ${report.deployStructure.hasEnDatasets ? 'OK' : 'MISSING'}`);
  lines.push(`  RU Datasets Dir:     ${report.deployStructure.hasRuDatasets ? 'OK' : 'MISSING'}`);
  lines.push(`  Release Manifest:    ${report.manifestValidated ? 'OK (conforms to schema)' : 'MISSING / INVALID'}`);
  lines.push(`  Changelog Baselines: ${report.deployStructure.hasChangelogBaselines ? 'OK' : 'UNAVAILABLE'}`);
  lines.push(`  Changelog Status:    ${report.changelogStatus.toUpperCase()}`);
  if (report.packagingValidated !== undefined) {
    lines.push(`  Packaging Structure: ${report.packagingValidated ? 'OK' : 'FAILED'}`);
  }
  lines.push('');

  lines.push('DATASET INTEGRITY & LOCALIZATION:');
  for (const [name, info] of Object.entries(report.datasetsValidated)) {
    const enStatus = info.enValid ? 'OK' : 'ERR';
    const ruStatus = info.ruValid ? 'OK' : 'ERR';
    const parityStatus = info.idParity ? 'OK' : 'PARITY_MISMATCH';
    lines.push(`  - ${name.padEnd(12)}: EN items=${String(info.enCount).padStart(4)} (${enStatus}), RU items=${String(info.ruCount).padStart(4)} (${ruStatus}), ID Parity=${parityStatus}`);
  }
  lines.push('');

  if (report.fatalCount > 0) {
    lines.push(`FATAL ERRORS (${report.fatalCount}):`);
    for (const issue of report.issues.filter((i) => i.severity === 'fatal')) {
      lines.push(`  [FATAL] [${issue.code}] ${issue.message}`);
      if (issue.file) {
        lines.push(`          File: ${issue.file}`);
      }
    }
    lines.push('');
  }

  if (report.warningCount > 0) {
    lines.push(`WARNINGS (${report.warningCount}):`);
    for (const issue of report.issues.filter((i) => i.severity === 'warning')) {
      lines.push(`  [WARN]  [${issue.code}] ${issue.message}`);
      if (issue.file) {
        lines.push(`          File: ${issue.file}`);
      }
    }
    lines.push('');
  }

  lines.push('===============================================================================');
  return lines.join('\n');
}

/**
 * Saves validation-report.json and validation-report.txt to target directory and validation subfolder.
 */
export function writeValidationReports(
  targetDir: string,
  report: ValidationReport,
  reportsDir?: string
): { jsonPath: string; txtPath: string } {
  const jsonContent = JSON.stringify(report, null, 2) + '\n';
  const txtContent = formatValidationReportText(report) + '\n';

  const locations: string[] = [
    targetDir,
    path.join(targetDir, 'validation'),
  ];

  if (reportsDir) {
    locations.push(reportsDir);
  }

  for (const dir of locations) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'validation-report.json'), jsonContent, 'utf8');
    fs.writeFileSync(path.join(dir, 'validation-report.txt'), txtContent, 'utf8');
  }

  return {
    jsonPath: path.join(targetDir, 'validation-report.json'),
    txtPath: path.join(targetDir, 'validation-report.txt'),
  };
}
