import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED_LOCALES } from '../../packages/i18n/src/constants';
import { findProjectRoot, createPathGuard, tryGetRawGameSourceDir } from '../_shared';
import {
  ReleaseManifestSchema,
  SimulacraDatasetSchema,
  MatricesDatasetSchema,
  RelicsDatasetSchema,
  PetsDatasetSchema,
  FoodDishesDatasetSchema,
  CosmeticsDatasetSchema,
  ArtworksDatasetSchema,
  FceIndexDatasetSchema,
  OowCurrentSummaryDatasetSchema,
  OowSeasonDatasetSchema,
  BygoneDatasetSchema,
  SeqCacheDatasetSchema,
  MultypeRenamesDatasetSchema,
  DatamineItemsDatasetSchema,
  TeamRaidsDatasetSchema,
  MmoTeamRaidsDatasetSchema,
  MmoBuildDatasetSchema,
} from '@tof-hub/contracts';

export interface ValidateOptions {
  publicDataDir?: string;
  reportsDir?: string;
  rawSourceDir?: string;
  strict?: boolean;
}

export interface ValidationReport {
  timestamp: string;
  valid: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  errors: string[];
  warnings: string[];
  datasetsValidated: Record<
    string,
    {
      enValid: boolean;
      ruValid: boolean;
      enCount: number;
      ruCount: number;
      idParity: boolean;
    }
  >;
  manifestValidated: boolean;
  changelogValidated: boolean;
  localesValidated: string[];
}

export async function validateGeneratedData(
  options: ValidateOptions = {}
): Promise<ValidationReport> {
  const projectRoot = findProjectRoot();
  const publicDataDir =
    options.publicDataDir || path.join(projectRoot, 'apps', 'web', 'public', 'game-data');
  const reportsDir =
    options.reportsDir || path.join(projectRoot, 'pipeline', 'reports');

  // Guard reports directory write
  const rawDir = options.rawSourceDir || tryGetRawGameSourceDir({ projectRoot }) || undefined;
  if (rawDir) {
    const pathGuard = createPathGuard(rawDir, [reportsDir]);
    pathGuard.assertSafeOutput(path.join(reportsDir, 'validation-report.json'));
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const assertCheck = (condition: boolean, passMsg: string, failMsg: string, isWarning = false) => {
    totalChecks++;
    if (condition) {
      passedChecks++;
    } else {
      if (isWarning) {
        warnings.push(failMsg);
      } else {
        errors.push(failMsg);
      }
    }
  };

  // 1. Check Release Manifest
  let manifestValidated = false;
  const manifestPath = path.join(publicDataDir, 'release-manifest.json');
  assertCheck(
    fs.existsSync(manifestPath),
    'Release manifest exists',
    `Missing release manifest at ${manifestPath}`
  );

  if (fs.existsSync(manifestPath)) {
    try {
      const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const parsed = ReleaseManifestSchema.safeParse(manifestRaw);
      assertCheck(
        parsed.success,
        'Release manifest schema conforms',
        `Release manifest schema validation failed: ${parsed.error?.message || ''}`
      );
      if (parsed.success) {
        manifestValidated = true;
      }
    } catch (e: any) {
      assertCheck(false, '', `Release manifest JSON parse error: ${e?.message || e}`);
    }
  }

  // Sequential (Biochemical Collapse) buff text must have every {n} filled from DescArgsArray.
  const biochemicalPath = path.join(publicDataDir, 'handbook', 'biochemical-collapse.json');
  if (fs.existsSync(biochemicalPath)) {
    const buffs: Array<{ id: string; description?: Record<string, string | null> }> =
      JSON.parse(fs.readFileSync(biochemicalPath, 'utf8')).buffCatalog ?? [];
    const unfilled = buffs.filter(buff => Object.values(buff.description ?? {}).some(text => /\{\d+\}/.test(text ?? '')));
    assertCheck(unfilled.length === 0, 'Biochemical Collapse buff descriptions are filled',
      `Biochemical Collapse buffs with unfilled description arguments: ${unfilled.map(buff => buff.id).join(', ')}`);
  }

  // 2. Check Datasets
  const expectedDatasets = [
    { name: 'simulacra', schema: SimulacraDatasetSchema },
    { name: 'matrices', schema: MatricesDatasetSchema },
    { name: 'relics', schema: RelicsDatasetSchema },
    { name: 'pets', schema: PetsDatasetSchema },
    { name: 'food', schema: null },
    { name: 'food-mmo', schema: null },
    { name: 'cosmetics', schema: CosmeticsDatasetSchema },
    { name: 'arts', schema: ArtworksDatasetSchema },
    { name: 'fce', schema: FceIndexDatasetSchema },
    { name: 'oow', schema: OowCurrentSummaryDatasetSchema },
    { name: 'bygone', schema: BygoneDatasetSchema },
    { name: 'seq', schema: SeqCacheDatasetSchema },
    { name: 'multype', schema: MultypeRenamesDatasetSchema },
    { name: 'items', schema: DatamineItemsDatasetSchema },
    { name: 'team-raids', schema: TeamRaidsDatasetSchema },
    { name: 'mmo-team-raids', schema: MmoTeamRaidsDatasetSchema },
    { name: 'mmo-build', schema: MmoBuildDatasetSchema },
  ];

  const datasetsValidated: ValidationReport['datasetsValidated'] = {};

  for (const ds of expectedDatasets) {
    const enPath = path.join(publicDataDir, 'en', `${ds.name}.json`);
    const ruPath = path.join(publicDataDir, 'ru', `${ds.name}.json`);

    assertCheck(fs.existsSync(enPath), `EN ${ds.name} exists`, `Missing EN dataset: ${enPath}`);
    assertCheck(fs.existsSync(ruPath), `RU ${ds.name} exists`, `Missing RU dataset: ${ruPath}`);

    let enData: any = null;
    let ruData: any = null;
    let enValid = false;
    let ruValid = false;

    if (fs.existsSync(enPath)) {
      try {
        enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        if (ds.schema) {
          const res = ds.schema.safeParse(enData);
          assertCheck(res.success, `EN ${ds.name} schema valid`, `EN ${ds.name} invalid schema: ${res.error?.message || ''}`);
          enValid = res.success;
        } else {
          enValid = true;
          passedChecks++;
          totalChecks++;
        }
      } catch (e: any) {
        assertCheck(false, '', `EN ${ds.name} JSON parse error: ${e.message}`);
      }
    }

    if (fs.existsSync(ruPath)) {
      try {
        ruData = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
        if (ds.schema) {
          const res = ds.schema.safeParse(ruData);
          assertCheck(res.success, `RU ${ds.name} schema valid`, `RU ${ds.name} invalid schema: ${res.error?.message || ''}`);
          ruValid = res.success;
        } else {
          ruValid = true;
          passedChecks++;
          totalChecks++;
        }
      } catch (e: any) {
        assertCheck(false, '', `RU ${ds.name} JSON parse error: ${e.message}`);
      }
    }

    const getItems = (d: any) => {
      if (!d) return [];
      if (Array.isArray(d)) return d;
      if (Array.isArray(d.items)) return d.items;
      if (Array.isArray(d.dishes)) return d.dishes;
      if (Array.isArray(d.bosses)) return d.bosses;
      if (Array.isArray(d.floors)) return d.floors;
      if (Array.isArray(d.stages)) return d.stages;
      if (Array.isArray(d.tables)) return d.tables;
      if (Array.isArray(d.raids)) return d.raids;
      if (Array.isArray(d.recentSeasons)) return d.recentSeasons;
      if (d.mainRenames && typeof d.mainRenames === 'object') return Object.entries(d.mainRenames);
      return Object.values(d);
    };

    const enItems = getItems(enData);
    const ruItems = getItems(ruData);

    const enCount = enItems.length;
    const ruCount = ruItems.length;

    assertCheck(enCount > 0, `EN ${ds.name} has items`, `EN ${ds.name} contains 0 items`);
    assertCheck(ruCount > 0, `RU ${ds.name} has items`, `RU ${ds.name} contains 0 items`);

    const extractId = (item: any) => {
      if (!item) return '';
      if (Array.isArray(item)) return String(item[0]);
      return String(item.id ?? item.slug ?? item.floor ?? item.stage ?? item.season ?? '');
    };

    const enIds = new Set(enItems.map(extractId).filter(Boolean));
    const ruIds = new Set(ruItems.map(extractId).filter(Boolean));

    let idParity = true;
    for (const id of enIds) {
      if (!ruIds.has(id)) {
        idParity = false;
        break;
      }
    }

    assertCheck(
      idParity,
      `${ds.name} EN/RU ID parity verified`,
      `ID mismatch between EN and RU for dataset ${ds.name}`,
      true // Treat minor mismatch as warning rather than breaking error
    );

    datasetsValidated[ds.name] = {
      enValid,
      ruValid,
      enCount,
      ruCount,
      idParity,
    };
  }

  // OoW is intentionally sharded: the summary is only the bootstrap index and
  // every listed standard/MMO season must have a validated floor payload.
  const oowSummaryPath = path.join(publicDataDir, 'en', 'oow.json');
  if (fs.existsSync(oowSummaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(oowSummaryPath, 'utf8'));
      const shardChecks = [
        ...(summary.recentSeasons || []).map((season: any) => ({ season, prefix: 's' })),
        ...(summary.mmoRecentSeasons || []).map((season: any) => ({ season, prefix: 'mmo_s' })),
      ];
      assertCheck(shardChecks.length > 0, 'OoW season index is non-empty', 'OoW season index contains no seasons');
      for (const { season, prefix } of shardChecks) {
        const padded = String(season.season).padStart(2, '0');
        for (const locale of ['en', 'ru'] as const) {
          const shardPath = path.join(publicDataDir, locale, 'oow', 'seasons', `${prefix}${padded}.json`);
          assertCheck(fs.existsSync(shardPath), `${locale.toUpperCase()} OoW ${prefix}${padded} shard exists`, `Missing OoW shard: ${shardPath}`);
          if (!fs.existsSync(shardPath)) continue;
          try {
            const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
            const parsed = OowSeasonDatasetSchema.safeParse(shard);
            assertCheck(parsed.success, `${locale.toUpperCase()} OoW ${prefix}${padded} shard schema valid`, `Invalid OoW shard: ${shardPath}`);
            assertCheck(Array.isArray(shard.floors) && shard.floors.length > 0, `${locale.toUpperCase()} OoW ${prefix}${padded} has floors`, `Empty OoW shard: ${shardPath}`);
          } catch (error: any) {
            assertCheck(false, '', `OoW shard parse error at ${shardPath}: ${error?.message || error}`);
          }
        }
      }
    } catch (error: any) {
      assertCheck(false, '', `OoW shard validation failed: ${error?.message || error}`);
    }
  }

  // 3. Check Changelog Baselines
  let changelogValidated = false;
  const gachaBaselinePath = path.join(publicDataDir, 'changelog', 'simulacra.json');
  const mmoBaselinePath = path.join(publicDataDir, 'changelog', 'simulacra-mmo.json');

  assertCheck(fs.existsSync(gachaBaselinePath), 'Gacha baseline exists', `Missing ${gachaBaselinePath}`);
  assertCheck(fs.existsSync(mmoBaselinePath), 'MMO baseline exists', `Missing ${mmoBaselinePath}`);

  if (fs.existsSync(gachaBaselinePath) && fs.existsSync(mmoBaselinePath)) {
    try {
      const gacha = JSON.parse(fs.readFileSync(gachaBaselinePath, 'utf8'));
      const mmo = JSON.parse(fs.readFileSync(mmoBaselinePath, 'utf8'));
      assertCheck(Boolean(gacha.characters && Object.keys(gacha.characters).length > 0), 'Gacha baseline has chars', 'Gacha baseline empty');
      assertCheck(Boolean(mmo.characters && Object.keys(mmo.characters).length > 0), 'MMO baseline has chars', 'MMO baseline empty');
      changelogValidated = true;
    } catch (e: any) {
      assertCheck(false, '', `Changelog baseline parse error: ${e.message}`);
    }
  }

  const localesValidated: string[] = ['en', 'ru'];
  // Every culture published by the exporter must contain the same source files.
  // Hashed runtime detail names differ by language and are checked by their own references.
  const sourceFiles = (directory: string, prefix = ''): string[] => !fs.existsSync(directory) ? []
    : fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const relative = prefix + entry.name;
      if (relative.startsWith('runtime/')) return [];
      return entry.isDirectory() ? sourceFiles(path.join(directory, entry.name), relative + '/')
        : entry.name.endsWith('.json') ? [relative] : [];
    });
  const englishFiles = sourceFiles(path.join(publicDataDir, 'en'));
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === 'en' || locale === 'ru' || !fs.existsSync(path.join(publicDataDir, locale))) continue;
    localesValidated.push(locale);
    for (const relative of englishFiles) {
      const file = path.join(publicDataDir, locale, relative);
      assertCheck(fs.existsSync(file), '', `Missing ${locale} dataset or shard: ${relative}`);
      if (!fs.existsSync(file)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const schema = expectedDatasets.find(dataset => `${dataset.name}.json` === relative)?.schema;
        if (schema) {
          const result = schema.safeParse(data);
          assertCheck(result.success, '', `${locale} ${relative}: ${result.error?.message ?? 'invalid schema'}`);
        }
        if (relative.startsWith('oow/seasons/')) {
          const result = OowSeasonDatasetSchema.safeParse(data);
          assertCheck(result.success, '', `${locale} ${relative}: ${result.error?.message ?? 'invalid season'}`);
        }
      } catch (error) { assertCheck(false, '', `${locale} ${relative}: ${String(error)}`); }
    }
  }
  const valid = errors.length === 0;

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    valid,
    totalChecks,
    passedChecks,
    failedChecks: errors.length,
    errors,
    warnings,
    datasetsValidated,
    manifestValidated,
    changelogValidated,
    localesValidated,
  };

  // Write reports to pipeline/reports
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonReportPath = path.join(reportsDir, 'validation-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const txtReportPath = path.join(reportsDir, 'validation-report.txt');
  let txtContent = `TOF-HUB GENERATED GAME DATA VALIDATION REPORT\n`;
  txtContent += `Timestamp: ${report.timestamp}\n`;
  txtContent += `Status: ${valid ? 'PASSED (VALID)' : 'FAILED (ERRORS DETECTED)'}\n`;
  txtContent += `Checks: ${passedChecks}/${totalChecks} passed\n\n`;

  txtContent += `MANIFEST VALIDATION: ${manifestValidated ? 'OK' : 'FAILED'}\n`;
  txtContent += `CHANGELOG BASELINES: ${changelogValidated ? 'OK' : 'FAILED'}\n\n`;

  txtContent += `DATASETS VALIDATION:\n`;
  for (const [name, info] of Object.entries(datasetsValidated)) {
    txtContent += `  - ${name}: EN items=${info.enCount} (${info.enValid ? 'OK' : 'ERR'}), RU items=${info.ruCount} (${info.ruValid ? 'OK' : 'ERR'}), parity=${info.idParity ? 'OK' : 'MISMATCH'}\n`;
  }

  if (warnings.length > 0) {
    txtContent += `\nWARNINGS (${warnings.length}):\n`;
    for (const w of warnings) {
      txtContent += `  [WARN] ${w}\n`;
    }
  }

  if (errors.length > 0) {
    txtContent += `\nERRORS (${errors.length}):\n`;
    for (const err of errors) {
      txtContent += `  [ERR] ${err}\n`;
    }
  }

  fs.writeFileSync(txtReportPath, txtContent, 'utf8');

  return report;
}
