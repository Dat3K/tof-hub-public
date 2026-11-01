import { readGameSourceFileSync } from './game-source-reader';
/**
 * Builds the static MMO gear and expansion-card catalog from the MMO data
 * bindings. Player-specific rolls, equipped card banks, CS and live stats are
 * intentionally left to a future capture source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLocalizationResolver } from './localization-resolver';

function option(name: string): string | null {
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return hit ? path.resolve(hit.slice(name.length + 3)) : null;
}

function readJson(filePath: string): any {
  return JSON.parse(readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function properties(rawDir: string, relative: string): Record<string, any> {
  const file = path.join(rawDir, relative);
  if (!fs.existsSync(file)) throw new Error(`[required] MMO Build binding missing: ${file}`);
  const data = readJson(file);
  const object = Array.isArray(data) ? data.find((entry) => entry?.Properties) : data;
  if (!object?.Properties) throw new Error(`[required] MMO Build properties missing: ${file}`);
  return object.Properties;
}

function rawPathFromAssetRef(ref: any): string | null {
  const objectPath = typeof ref?.ObjectPath === 'string' ? ref.ObjectPath : '';
  const assetPath = typeof ref?.AssetPathName === 'string' ? ref.AssetPathName : '';
  let value = objectPath || assetPath;
  if (!value || value === 'None') return null;
  if (value.startsWith('/Game/')) value = `Hotta/Content/${value.slice('/Game/'.length)}`;
  if (!value.startsWith('Hotta/Content/')) return null;
  value = value.replace(/\.(?:\d+|[^./]+)$/u, '');
  return `${value}.json`;
}

function readRows(rawDir: string, relative: string): Record<string, any> {
  const file = path.join(rawDir, relative);
  if (!fs.existsSync(file)) throw new Error(`[required] MMO Build table missing: ${file}`);
  const data = readJson(file);
  const rows = Array.isArray(data) ? data.find((entry) => entry?.Rows)?.Rows : data.Rows;
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) {
    throw new Error(`[required] MMO Build rows missing: ${file}`);
  }
  return rows;
}

function tableReference(props: Record<string, any>, field: string, bindingFile: string) {
  const ref = props[field];
  const rawExportPath = rawPathFromAssetRef(ref);
  if (!rawExportPath) throw new Error(`[required] MMO Build binding ${field} missing in ${bindingFile}`);
  return { rawExportPath, reference: ref };
}

function valuesCount(rows: Record<string, any>, field: string) {
  const counts: Record<string, number> = {};
  for (const row of Object.values(rows)) {
    const value = String((row as any)?.[field] ?? 'Unknown');
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function uniqueNumberValues(rows: Record<string, any>, field: string): number[] {
  return [...new Set(Object.values(rows)
    .map((row: any) => row?.[field])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))].sort((a, b) => a - b);
}

function walk(value: any, visit: (value: any, fieldPath: string) => void, fieldPath = ''): void {
  if (!value || typeof value !== 'object') return;
  visit(value, fieldPath);
  for (const [key, child] of Object.entries(value)) {
    walk(child, visit, fieldPath ? `${fieldPath}.${key}` : key);
  }
}

function main() {
  const rawDir = option('raw-dir');
  const projectRoot = option('project-root');
  if (!rawDir || !projectRoot) throw new Error('Usage: build-mmo-build.js --raw-dir=<raw> --project-root=<stage>');

  const bindingPaths = {
    gameData: 'Hotta/Content/Resources/CoreBlueprints/GameMode/MMO/BP_GameData_MMO_Base.json',
    equipment: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DA_Equipment_MMO.json',
  };
  const gameData = properties(rawDir, bindingPaths.gameData);
  const equipmentData = properties(rawDir, bindingPaths.equipment);

  const specs = [
    { id: 'equipment', owner: 'gameData', field: 'EquipmentDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'baseModifiers', owner: 'gameData', field: 'ModifyDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'randomPools', owner: 'gameData', field: 'RandomModifyDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'randomStatRanges', owner: 'gameData', field: 'RandomPropDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'advancedRandomStats', owner: 'gameData', field: 'AdvanceRandomPropDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'attributeDefinitions', owner: 'gameData', field: 'AttributeStaticDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'enhancementCosts', owner: 'gameData', field: 'EquipStrengthenDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'enhancementEffects', owner: 'gameData', field: 'EquipStrengthenEffectPackDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'meltReturns', owner: 'gameData', field: 'EquipMeltPackDataTable', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'weaponTupo', owner: 'gameData', field: 'DT_WeaponTupo', props: gameData, bindingFile: bindingPaths.gameData },
    { id: 'equipmentSeasons', owner: 'equipment', field: 'MMOEquipSeasonDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
    { id: 'cardSlots', owner: 'equipment', field: 'MMOEquipSlotDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
    { id: 'modCards', owner: 'equipment', field: 'MMOEquipSlotSkillDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
    { id: 'modCardAttributes', owner: 'equipment', field: 'MMOEquipSlotSkillAttributeDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
    { id: 'modCardCoefficients', owner: 'equipment', field: 'MMOEquipSlotSkillCoefficientDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
    { id: 'seasonalStatThresholds', owner: 'equipment', field: 'RandomModifyExtraGainDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
    { id: 'enhancementSuccessRates', owner: 'equipment', field: 'EquipStrengthenSuccessRateDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
    { id: 'equipmentUpgrades', owner: 'equipment', field: 'EquipUpgradeConfigDataTable', props: equipmentData, bindingFile: bindingPaths.equipment },
  ];

  const tables: any[] = specs.map((spec) => {
    const { rawExportPath, reference } = tableReference(spec.props, spec.field, spec.bindingFile);
    const rows = readRows(rawDir, rawExportPath);
    return {
      id: spec.id,
      rawExportPath,
      binding: { rawExportPath: spec.bindingFile, object: spec.owner === 'gameData' ? 'Default__BP_GameData_MMO_Base_C' : 'Default__DA_Equipment_MMO_C', field: spec.field, reference },
      rowCount: Object.keys(rows).length,
      rows: Object.entries(rows).map(([id, raw]) => ({ id, raw })),
    };
  });
  const byId = new Map(tables.map((table) => [table.id, table]));

  // Curves are discovered by following CurveTable references embedded in the
  // stat/card rows, then materialized from the exact referenced raw exports.
  const curveRefs = new Map<string, Set<string>>();
  for (const table of tables) {
    for (const entry of table.rows) {
      walk(entry.raw, (value, fieldPath) => {
        if (fieldPath.endsWith('.Curve') && value?.CurveTable) {
          const rawExportPath = rawPathFromAssetRef(value.CurveTable);
          if (rawExportPath) {
            if (!curveRefs.has(rawExportPath)) curveRefs.set(rawExportPath, new Set());
            if (typeof value.RowName === 'string' && value.RowName) curveRefs.get(rawExportPath)!.add(value.RowName);
          }
        }
      });
    }
  }
  for (const [rawExportPath, referencedRows] of curveRefs) {
    const rows = readRows(rawDir, rawExportPath);
    const id = `curve:${path.basename(rawExportPath, '.json')}`;
    tables.push({
      id,
      rawExportPath,
      binding: { discoveredFrom: [...byId.values()].map((table: any) => table.id) },
      rowCount: Object.keys(rows).length,
      referencedRowCount: referencedRows.size,
      referencedRows: [...referencedRows].sort(),
      rows: Object.entries(rows).map(([rowId, raw]) => ({ id: rowId, raw })),
    });
  }

  const resolver = createLocalizationResolver();
  const localizationPaths: Record<string, string | null> = {};
  for (const locale of ['en', 'ru'] as const) {
    const relative = `Hotta/Content/Localization/Game/${locale}/Game.json`;
    const file = path.join(rawDir, relative);
    localizationPaths[locale] = fs.existsSync(file) ? relative : null;
    if (fs.existsSync(file)) resolver.loadLocale(locale, readJson(file));
  }

  const localizedTexts: any[] = [];
  const mediaAssets = new Map<string, any>();
  for (const table of tables) {
    for (const entry of table.rows) {
      walk(entry.raw, (value, fieldPath) => {
        const ref = value?.AssetPathName;
        if (typeof ref === 'string' && ref !== 'None' && (/^\/Game\/Resources\/(?:Icon|UI)\//u).test(ref)) {
          const imagePath = rawPathFromAssetRef(value);
          const rawImagePath = imagePath ? imagePath.replace(/\.json$/u, '.png') : null;
          if (rawImagePath) mediaAssets.set(rawImagePath, { assetRef: ref, rawExportPath: rawImagePath, source: { table: table.id, row: entry.id, field: fieldPath } });
        }
        const textKey = value?.Key;
        const namespace = value?.TableId || value?.Namespace;
        if (typeof textKey !== 'string' || !textKey || typeof namespace !== 'string' || !namespace) return;
        const result = resolver.resolveBilingual(value);
        const loc = (locale: 'en' | 'ru') => {
          const provenance: any = result.provenance?.[locale] || {};
          const resolved = provenance.status === 'resolved';
          return {
            text: resolved ? (locale === 'ru' ? result.name_ru : result.name_en) : '',
            status: provenance.status || 'unresolved',
            resolvedLocale: provenance.resolvedLocale || null,
          };
        };
        localizedTexts.push({
          table: table.id,
          row: entry.id,
          field: fieldPath,
          reference: { namespace, key: textKey, sourceString: value.SourceString ?? null },
          en: loc('en'),
          ru: loc('ru'),
        });
      });
    }
  }

  const equipmentRows = Object.fromEntries((byId.get('equipment') as any).rows.map((entry: any) => [entry.id, entry.raw]));
  const cardRows = Object.fromEntries((byId.get('modCards') as any).rows.map((entry: any) => [entry.id, entry.raw]));
  const cardSlotRows = Object.fromEntries((byId.get('cardSlots') as any).rows.map((entry: any) => [entry.id, entry.raw]));
  const output = {
    schemaVersion: 1,
    summary: {
      equipmentItems: (byId.get('equipment') as any).rowCount,
      equipmentSlots: valuesCount(equipmentRows, 'EquipmentSlotType'),
      equipmentSeasons: valuesCount(equipmentRows, 'MMOSeasonIndex'),
      modCardSlotConfigs: (byId.get('cardSlots') as any).rowCount,
      regularCardBanksPerSlot: uniqueNumberValues(cardSlotRows, 'SkillBankNumber'),
      seasonCardBanksPerSlot: uniqueNumberValues(cardSlotRows, 'SeasonSkillBankNumber'),
      modCards: (byId.get('modCards') as any).rowCount,
      cardQualities: valuesCount(cardRows, 'SkillQuality'),
      cardSeasons: valuesCount(cardRows, 'SeasonIndex'),
      modCardAttributeRows: (byId.get('modCardAttributes') as any).rowCount,
      statThresholdTracks: (byId.get('seasonalStatThresholds') as any).rowCount,
      curveTables: curveRefs.size,
    },
    tables,
    localizedTexts,
    mediaAssets: [...mediaAssets.values()],
    source: {
      rawRootManifest: null,
      bindings: bindingPaths,
      localization: localizationPaths,
      versionRegion: 'Unknown: no build/region manifest was present in the inspected raw export.',
    },
    unresolved: {
      playerLoadoutAndRolls: 'Static game tables do not contain a user’s equipped items, rolled random-stat values, selected Mod Card bank/stars, or current character attributes. A verified client profile/capture source is still required.',
      combatStrength: 'Current CS and Total Combat Strength are screenshot observations; this static table graph does not provide a verified player-level formula or capture.',
      titan: 'The MMO equipment binding graph does not connect gear rows to DT_WeaponTupo_MMO. Keep weapon Tupo separate; a gear Titan system is not established by these sources.',
      activeSeason: 'Equipment row MMOSeasonIndex, card SeasonIndex/ValidSeasonData and the two-row equipment season table are preserved as stored; their active-season mapping is not inferred.',
      matrices: 'Omitted from this MMO catalog as requested.',
      randomRollAndCardRuntime: 'Raw weights, curves, buff-class references, and attribute rows are retained; runtime probability, formula order, rounding, and effect application are not inferred.',
    },
  };

  const outDir = path.join(projectRoot, 'datamine', 'mmo-build', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mmo-build.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[build-mmo-build] ${output.summary.equipmentItems} equipment rows, ${output.summary.modCards} cards, ${output.summary.curveTables} discovered curve tables, ${output.mediaAssets.length} media refs.`);
}

main();
