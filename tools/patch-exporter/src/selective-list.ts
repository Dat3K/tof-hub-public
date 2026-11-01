import fs from 'node:fs';
import path from 'node:path';
import { resolveRawExportTree } from './path-guards';

export type ExportMode = 'Full' | 'Text' | 'Pic' | 'Small' | 'AdvancedMultype';

export interface SelectiveRule {
  category: string;
  pattern: string;
  type: 'json' | 'png';
  required?: boolean;
  smallMode?: boolean;
}

export interface RequirementItem {
  label: string;
  paths: string[];
}

export interface ImageRequirementGroup {
  label: string;
  relativePath: string;
}

export interface ExportRulesConfig {
  name: string;
  version: string;
  description: string;
  defaultEngineVersion: string;
  defaultAesKey: string;
  /** Pak keys by client region (Global/Taiwan/Korea share one key; China has its own). */
  regionAesKeys?: Partial<Record<'global' | 'cn', string>>;
  categories: Record<string, string>;
  rules: SelectiveRule[];
  requirements: RequirementItem[];
  imageRequirementGroups: ImageRequirementGroup[];
}

export interface RequirementCheckResult {
  label: string;
  found: boolean;
  detail: string;
}

export interface ExportValidationReport {
  timestamp: string;
  mode: ExportMode;
  targetDir: string;
  valid: boolean;
  totalChecks: number;
  passedChecks: number;
  missingChecks: number;
  results: RequirementCheckResult[];
}

export interface UnrealExporterConfig {
  ConfigTitle: string;
  GamePath: string;
  OutputPath: string;
  EngineVersion: string;
  AesKeys: string[];
  ExportPaths: string[];
  ExcludePaths: string[];
  CreateNewCheckpoint?: boolean;
  CheckpointFileName?: string;
  MappingFileName?: string;
}

export interface GenerateConfigOptions {
  gamePaksPath: string;
  outputPath: string;
  mode: ExportMode;
  aesKey?: string;
  engineVersion?: string;
  rulesConfig?: ExportRulesConfig;
  ignoredImagePaths?: string[];
}

/**
 * Resolves default path to config/export-rules.json.
 */
export function getDefaultRulesConfigPath(): string {
  const candidatePaths = [
    path.resolve(__dirname, '../config/export-rules.json'),
    path.resolve(__dirname, '../../config/export-rules.json'),
    path.resolve(process.cwd(), 'tools/patch-exporter/config/export-rules.json'),
    path.resolve(process.cwd(), 'config/export-rules.json'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidatePaths[0];
}

/**
 * Loads selective export rules configuration.
 */
export function loadExportRules(customPath?: string): ExportRulesConfig {
  const configPath = customPath ? path.resolve(customPath) : getDefaultRulesConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(`Selective export rules configuration file not found at: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const config=JSON.parse(raw) as ExportRulesConfig;
  const keyPath=process.env.TOF_EXPORT_KEYS_FILE ?? path.join(path.dirname(configPath),'export-keys.json');
  if(fs.existsSync(keyPath)) {
    const keys=JSON.parse(fs.readFileSync(keyPath,'utf8')) as Pick<ExportRulesConfig,'defaultAesKey'|'regionAesKeys'>;
    if(typeof keys.defaultAesKey==='string')config.defaultAesKey=keys.defaultAesKey;
    if(keys.regionAesKeys)config.regionAesKeys=keys.regionAesKeys;
  }
  return config;
}

/**
 * Filters rules based on requested ExportMode.
 * - Text: only JSON tables and locres (:json).
 * - Pic: only UI textures and icons (:png).
 * - Small: all JSON tables plus only smallMode images.
 * - Full: all JSON tables and all configured images.
 */
export function filterRulesByMode(rules: SelectiveRule[], mode: ExportMode): SelectiveRule[] {
  switch (mode) {
    case 'Text':
      return rules.filter((r) => r.type === 'json');

    case 'Pic':
      return rules.filter((r) => r.type === 'png');

    case 'Small':
      return rules.filter((r) => r.type === 'json' || (r.type === 'png' && r.smallMode === true));

    case 'AdvancedMultype':
      return [{
        category: 'advanced_multype',
        pattern: 'Hotta/Content/.*\\.uasset:json',
        type: 'json',
        required: false,
      }];

    case 'Full':
    default:
      return [...rules];
  }
}

/**
 * Generates an array of pattern strings formatted for UnrealExporter ExportPaths.
 */
export function getExportPathsForMode(rules: SelectiveRule[], mode: ExportMode): string[] {
  const filtered = filterRulesByMode(rules, mode);
  return filtered.map((r) => r.pattern);
}

/**
 * Compiles exclude paths (e.g. for Small mode with image ignores).
 */
export function getExcludePathsForMode(
  _rules: SelectiveRule[],
  mode: ExportMode,
  ignoredImagePaths: string[] = []
): string[] {
  if (mode === 'Small') {
    return [...ignoredImagePaths];
  }
  return [];
}

/**
 * Generates UnrealExporter CUE4Parse config object for execution.
 */
export function generateUnrealExporterConfig(options: GenerateConfigOptions): UnrealExporterConfig {
  const rulesConfig = options.rulesConfig ?? loadExportRules();
  const exportPaths = getExportPathsForMode(rulesConfig.rules, options.mode);
  const excludePaths = getExcludePathsForMode(rulesConfig.rules, options.mode, options.ignoredImagePaths);
  const aesKey=options.aesKey || rulesConfig.defaultAesKey;
  if(!aesKey)throw new Error('Game archive key configuration is missing. Restore the matching bootstrap artifact or pass --aes-key.');

  return {
    ConfigTitle: `Tower of Fantasy Datamine (${options.mode} Mode)`,
    GamePath: options.gamePaksPath,
    OutputPath: options.outputPath,
    EngineVersion: options.engineVersion || rulesConfig.defaultEngineVersion || 'TowerOfFantasy',
    AesKeys: [aesKey],
    ExportPaths: exportPaths,
    ExcludePaths: excludePaths,
    CreateNewCheckpoint: false,
    CheckpointFileName: '',
    MappingFileName: '',
  };
}

/**
 * Validates whether required data tables and images exist in target export directory.
 */
export function validateExportRequirements(
  targetDir: string,
  mode: ExportMode,
  customRules?: ExportRulesConfig
): ExportValidationReport {
  const resolvedTarget = path.resolve(targetDir);
  const config = customRules ?? loadExportRules();
  const results: RequirementCheckResult[] = [];

  let unpackedRoot = resolvedTarget;
  if (fs.existsSync(resolvedTarget)) {
    try {
      const tree = resolveRawExportTree(resolvedTarget);
      unpackedRoot = tree.unpackedRoot;
    } catch {
      // Fallback to resolvedTarget if tree resolution fails
    }
  }

  if (mode === 'AdvancedMultype') {
    return {
      timestamp: new Date().toISOString(),
      mode,
      targetDir: resolvedTarget,
      valid: true,
      totalChecks: 0,
      passedChecks: 0,
      missingChecks: 0,
      results: [],
    };
  }

  // Check structured requirements (tables, string tables, locres, metadata)
  for (const req of config.requirements) {
    let found = false;
    let detail = req.paths.join(' OR ');

    for (const relPath of req.paths) {
      const candidates = [
        path.join(resolvedTarget, relPath),
        path.join(unpackedRoot, relPath),
        path.join(resolvedTarget, path.basename(relPath)),
        path.join(unpackedRoot, path.basename(relPath)),
      ];

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          found = true;
          detail = relPath;
          break;
        }
      }

      if (found) break;
    }

    results.push({ label: req.label, found, detail });
  }

  // Check image requirements (if Pic or Full mode)
  if (mode === 'Full' || mode === 'Pic') {
    for (const imgGroup of config.imageRequirementGroups) {
      const candidateDirs = [
        path.join(resolvedTarget, imgGroup.relativePath),
        path.join(unpackedRoot, imgGroup.relativePath),
      ];

      let imgCount = 0;
      for (const groupDir of candidateDirs) {
        if (fs.existsSync(groupDir)) {
          try {
            const files = fs.readdirSync(groupDir);
            const count = files.filter((f) => {
              const lower = f.toLowerCase();
              return lower.endsWith('.png') || lower.endsWith('.webp');
            }).length;
            if (count > imgCount) {
              imgCount = count;
            }
          } catch {
            // Skip
          }
        }
      }

      const found = imgCount > 0;
      const detail = found ? `${imgCount} image file(s) (PNG/WebP)` : `${imgGroup.relativePath} (missing)`;
      results.push({ label: imgGroup.label, found, detail });
    }
  }

  const passedChecks = results.filter((r) => r.found).length;
  const missingChecks = results.filter((r) => !r.found).length;

  return {
    timestamp: new Date().toISOString(),
    mode,
    targetDir: resolvedTarget,
    valid: missingChecks === 0,
    totalChecks: results.length,
    passedChecks,
    missingChecks,
    results,
  };
}
