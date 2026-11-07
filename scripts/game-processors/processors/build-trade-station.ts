/**
 * build-trade-station.js
 *
 * Trade Station listing table -> `datamine/trade-station/data/trade-station.json`.
 *
 * - `TradeLineItemStaticDataTable` has one row per sellable item id: the reference price in
 *   Universal Crystals (`TradeBasePrice`), the player listing band (`PutAwardRange`), the system buy
 *   band (`SysTradePriceRatio`) and the listing flags. Both bands are ratios of the reference price,
 *   so the four published prices are half-up rounded integers derived here.
 * - `DA_TradeLine.TradeLineMenuListArray` is the section/type catalog tree. Its labels are 32-hex
 *   localization keys resolved from the English `Game.json` root namespace; `SourceString` is the
 *   CN text and is never used.
 * - `TradeShopLevelDataTable` is reported for the capacity the curated rules quote.
 * - Item identity comes from the item catalogs, then `ItemConfigs` + the English `Game.json`. An id
 *   that resolves nowhere keeps `name: null` and is listed in the processor report. Catalog icons
 *   keep their file but move to the served WebP root, so the published dataset loads in a checkout
 *   that has no `/datamine/shared/media` tree.
 *
 * The published shape lives in `@tof-hub/contracts` (`trade-station.ts`), shared with the page.
 *
 * Every field stays English, which is why this processor reads `Localization/Game/en/Game.json`
 * directly instead of following the locale projection the other processors share.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  TradePriceBand,
  TradeSection,
  TradeStationDataset,
  TradeStationRow,
  TradeStationRules,
} from '../../../packages/contracts/src/trade-station';

const CONTENT = 'Hotta/Content';
const LISTING_TABLE = `${CONTENT}/Resources/CoreBlueprints/DataTable/TradeLineItemStaticDataTable.json`;
const CATEGORY_TREE = `${CONTENT}/Resources/CoreBlueprints/DataAsset/DA_TradeLine.json`;
const LEVEL_TABLE = `${CONTENT}/Resources/CoreBlueprints/DataTable/TradeShopLevelDataTable.json`;
const ITEM_CONFIGS = `${CONTENT}/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json`;
const COOKING_FOOD = `${CONTENT}/Resources/CoreBlueprints/DataTable/cooking/CookingFoodDataTable.json`;
const COOKING_FOOD_MMO = `${CONTENT}/Resources/CoreBlueprints/DataTable_MMO/cooking/CookingFoodDataTable_MMO.json`;
const ART_PACK = `${CONTENT}/Resources/CoreBlueprints/DataTable/ArtPackDataTable.json`;
const ENGLISH_GAME = `${CONTENT}/Localization/Game/en/Game.json`;
const ITEM_CATALOGS = ['merged_mapping_with_original.json', 'merged_mapping_with_original_mmo.json'];

/** The client encodes the Trade Station currency as `EHottaCurrencyType::TradeDiamond`. */
const CURRENCY_PREFIX = 'EHottaCurrencyType::';
const CURRENCY_NAME = 'Universal Crystal';
/**
 * WebP tree the site serves in development and production alike. The production nginx also serves
 * `/datamine/shared/media`, but a local checkout has no such directory, so every icon is emitted
 * under this root: the catalog's own path is rewritten by `siteIconUrl`.
 */
const MEDIA_ROOT = '/game-assets/webp';

/** Absorbs binary-float drift (e.g. `4 * 0.35 === 1.4000000000000001`) before half-up rounding. */
const ROUNDING_EPSILON = 1e-9;

const OUTPUT = path.join('datamine', 'trade-station', 'data', 'trade-station.json');
const RULES_FILE = 'trade-station-rules.json';

type LocalizationTable = Record<string, Record<string, string>>;

export interface TradeTextContent {
  Key?: string;
  SourceString?: string;
}

export interface TradeTreeCategoryNode {
  TextContent?: TradeTextContent;
  Typeindex?: number;
  TradeQuality?: string;
  ChildrenNode?: TradeTreeCategoryNode[];
}

export interface TradeTableRow {
  TradeBasePrice?: { CurrencyType?: string; Amount?: number };
  PutAwardRange?: { X?: number; Y?: number };
  SysTradePriceRatio?: { X?: number; Y?: number };
  TradePriceMinDif?: number;
  TradeQuality?: string;
  Typeindex?: number;
  SubTypeIndex?: number;
  bCanList?: boolean;
  bCanSysAutoSell?: boolean;
  bForceBind?: boolean;
}

interface IconRef {
  AssetPathName?: string;
}

interface ItemConfigRow {
  ItemIcon?: IconRef;
  ItemName?: { TableId?: string; Key?: string };
  ItemQuality?: string;
  /** Hair and other cosmetics point at an art pack instead of carrying their own icon. */
  ArtPackID?: string;
}

interface CatalogItem {
  id?: string;
  name?: string;
  icon?: string;
  quality?: string;
  /** A hand-written site name. Two rows in the whole catalog carry one; the rest are derived. */
  rename?: string;
}

export interface ItemIdentity {
  name: string | null;
  icon: string;
  quality: string;
}

/**
 * Shard ids carry a `frag_` segment - `frag_imitation_extra_6`, `mmo_frag_Mount_038` - and their
 * reference price is exactly a tenth of the item they combine into, ten at a time.
 */
const SHARD_PREFIXES = ['mmo_frag_', 'frag_'];

function shardParentId(id: string): string | null {
  const prefix = SHARD_PREFIXES.find((candidate) => id.startsWith(candidate));
  return prefix ? id.slice(prefix.length) : null;
}

interface SourceFile {
  data: unknown;
  sha256: string;
}

function option(name: string): string | null {
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return hit ? path.resolve(hit.slice(name.length + 3)) : null;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

/** Raw bytes and their digest, so `sources` hashes the exact file the pipeline consumed. */
function readSource(filePath: string, relative: string): SourceFile {
  if (!fs.existsSync(filePath)) throw new Error(`[required] Trade Station source missing: ${relative}`);
  const bytes = fs.readFileSync(filePath);
  return {
    data: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

/** Client DataTables and DataAssets are saved as a one-entry array. */
function assetObject(source: SourceFile, relative: string): Record<string, unknown> {
  const candidate = Array.isArray(source.data) ? source.data[0] : source.data;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`[required] Trade Station source malformed: ${relative}`);
  }
  // Parsed JSON boundary: the export object is a flat property bag.
  return candidate as Record<string, unknown>;
}

function assetProperties(source: SourceFile, relative: string): Record<string, unknown> {
  const properties = assetObject(source, relative).Properties;
  if (!properties || typeof properties !== 'object') {
    throw new Error(`[required] Trade Station properties missing: ${relative}`);
  }
  // Parsed JSON boundary: the caller reads the fields it declares, each checked on use.
  return properties as Record<string, unknown>;
}

function tableRows<TRow>(source: SourceFile, relative: string): Record<string, TRow> {
  const rows = assetObject(source, relative).Rows;
  if (!rows || typeof rows !== 'object') throw new Error(`[required] Trade Station rows missing: ${relative}`);
  // Parsed JSON boundary: row shapes are declared by the TRow the caller asks for.
  return rows as Record<string, TRow>;
}

/** Half-up rounding; every derived price is a positive integer amount of Universal Crystals. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + ROUNDING_EPSILON);
}

function label(table: Record<string, string>, key: string | undefined): string {
  const value = key ? table[key] : undefined;
  return typeof value === 'string' ? value : '';
}

/**
 * Sections and their types in the tree's declared order. The version axis is deliberately absent:
 * measured on the client table, every listable `TQ_RATE_FASHION` row sits at `SubTypeIndex = 1`.
 */
export function buildSections(tree: TradeTreeCategoryNode[], labels: Record<string, string>): TradeSection[] {
  return tree
    .filter((node) => Boolean(node.TradeQuality))
    .map((node) => ({
      id: String(node.TradeQuality),
      name: label(labels, node.TextContent?.Key),
      types: (node.ChildrenNode ?? [])
        .map((child) => ({ index: Number(child.Typeindex ?? 0), name: label(labels, child.TextContent?.Key) }))
        .sort((a, b) => a.index - b.index),
    }));
}

export function buildRow(
  id: string,
  raw: TradeTableRow,
  item: ItemIdentity,
  override?: TradePriceBand
): TradeStationRow {
  const basePrice = Number(raw.TradeBasePrice?.Amount ?? 0);
  const minRatio = Number(override?.minRatio ?? raw.PutAwardRange?.X ?? 0);
  const maxRatio = Number(override?.maxRatio ?? raw.PutAwardRange?.Y ?? 0);
  const systemMinRatio = Number(raw.SysTradePriceRatio?.X ?? 0);
  const systemMaxRatio = Number(raw.SysTradePriceRatio?.Y ?? 0);
  const shardParent = shardParentId(id);
  return {
    id,
    name: item.name,
    icon: item.icon,
    quality: item.quality,
    section: String(raw.TradeQuality ?? ''),
    type: Number(raw.Typeindex ?? 0),
    basePrice,
    minPrice: roundHalfUp(basePrice * minRatio),
    maxPrice: roundHalfUp(basePrice * maxRatio),
    minRatio,
    maxRatio,
    canList: raw.bCanList === true,
    canSystemBuy: raw.bCanSysAutoSell === true,
    systemMinPrice: roundHalfUp(basePrice * systemMinRatio),
    systemMaxPrice: roundHalfUp(basePrice * systemMaxRatio),
    bindOnPurchase: raw.bForceBind === true,
    priceStep: Number(override?.stepRatio ?? raw.TradePriceMinDif ?? 0),
    ...(override ? { percentRungs: override.percentRungs } : {}),
    bandSource: override ? 'server' : 'client',
    shard: shardParent !== null,
    shardOfId: shardParent,
  };
}

/** `/Game/Resources/Icon/X/Y.Y` -> `/game-assets/webp/Hotta/Content/Resources/Icon/X/Y.webp`. */
function canonicalIconUrl(assetPath: unknown): string {
  if (typeof assetPath !== 'string' || !assetPath.startsWith('/Game/')) return '';
  const packagePath = assetPath
    .slice('/Game/'.length)
    .replace(/\.[^/.]*$/, '')
    .replace(/\.(?:png|webp|jpe?g|svg)$/i, '');
  return `${MEDIA_ROOT}/${CONTENT}/${packagePath}.webp`;
}

/**
 * The item catalogs store either the served WebP URL or the production-only media root; a consumer
 * of the published dataset must not inherit a path that 404s in a local checkout.
 */
export function siteIconUrl(url: string): string {
  const legacyRoot = '/datamine/shared/media/';
  return url.startsWith(legacyRoot) ? `${MEDIA_ROOT}/${url.slice(legacyRoot.length)}` : url;
}

function namespaceOf(tableId: string | undefined): string {
  const parts = String(tableId ?? '').split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function localized(store: LocalizationTable, namespace: string, key: string | undefined): string | null {
  const value = key ? store[namespace]?.[key] : undefined;
  return typeof value === 'string' ? value : null;
}

/** Some ids (`item_Cooking_*`) have no `ItemConfigs` row; only the `<id>_name` key names them. */
function localizedByKey(store: LocalizationTable, key: string): string | null {
  for (const namespace of Object.values(store)) {
    const value = namespace[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

/**
 * Icons the client keeps outside `ItemConfigs`: cooking rows carry their own `ItemIcon`, and a hair
 * item names an `ArtPackID` whose `Icons` array holds the female icon, then the male one.
 */
export function createIconFallback(input: {
  cooking: Record<string, { ItemIcon?: IconRef }>;
  cookingMmo?: Record<string, { ItemIcon?: IconRef }>;
  artPacks?: Record<string, { Icons?: IconRef[] }>;
  itemConfigs: Record<string, ItemConfigRow>;
}): (id: string) => string {
  const cooking = new Map<string, string>();
  for (const table of [input.cooking, input.cookingMmo]) {
    for (const [id, row] of Object.entries(table ?? {})) {
      const url = canonicalIconUrl(row?.ItemIcon?.AssetPathName);
      if (url && !cooking.has(id.toLowerCase())) cooking.set(id.toLowerCase(), url);
    }
  }
  return (id) => {
    const fromCooking = cooking.get(id.toLowerCase());
    if (fromCooking) return fromCooking;
    const artPack = input.artPacks?.[input.itemConfigs[id]?.ArtPackID ?? ''];
    const icons = artPack?.Icons ?? [];
    for (const candidate of [icons[1], icons[2], icons[0]]) {
      const url = canonicalIconUrl(candidate?.AssetPathName);
      if (url) return url;
    }
    return '';
  };
}

/**
 * Item catalogs first (they carry the site icon and quality), then `ItemConfigs` + the locale
 * `Game.json`. A catalog row with no icon is an auto-derived entry whose name is usually a machine
 * translation, so that row defers to the client's own localization and to `fallbackIcon`.
 * An id that resolves nowhere keeps `name: null` so the processor can report it.
 */
export function createItemResolver(
  catalogs: CatalogItem[][],
  itemConfigs: Record<string, ItemConfigRow>,
  localization: LocalizationTable,
  fallbackIcon: (id: string) => string = () => ''
): (id: string) => ItemIdentity {
  const catalogById = new Map<string, CatalogItem>();
  for (const catalog of catalogs) {
    for (const item of catalog) {
      const id = typeof item?.id === 'string' ? item.id : '';
      if (id && !catalogById.has(id)) catalogById.set(id, item);
    }
  }
  return (id) => {
    const catalogItem = catalogById.get(id);
    const catalogIcon = typeof catalogItem?.icon === 'string' ? catalogItem.icon : '';
    const config = itemConfigs[id];
    const configName = config
      ? localized(localization, namespaceOf(config.ItemName?.TableId), config.ItemName?.Key)
      : null;
    const clientName = configName ?? localizedByKey(localization, `${id}_name`);
    const catalogName = typeof catalogItem?.name === 'string' ? catalogItem.name : '';
    const quality =
      typeof catalogItem?.quality === 'string' && catalogItem.quality
        ? catalogItem.quality
        : typeof config?.ItemQuality === 'string'
          ? config.ItemQuality
          : '';

    // The catalog name is derived, and for ~100 ids it is a machine translation ("Blast the
    // peppers.", "Zip fragments."). A hand-written `rename` is the only name it owns.
    const rename = typeof catalogItem?.rename === 'string' ? catalogItem.rename : '';
    const name = rename || clientName || catalogName || null;
    if (catalogIcon) return { name, icon: siteIconUrl(catalogIcon), quality };
    return {
      name,
      icon: fallbackIcon(id) || canonicalIconUrl(config?.ItemIcon?.AssetPathName),
      quality,
    };
  };
}

/** Every row settles in one currency; the code drops the enum prefix the client stores. */
export function tradeCurrencyCode(rows: Record<string, TradeTableRow>): string {
  const codes = new Set(Object.values(rows).map((row) => String(row.TradeBasePrice?.CurrencyType ?? '')));
  if (codes.size !== 1) {
    throw new Error(`[build-trade-station] rows settle in ${codes.size} different currencies`);
  }
  const [code] = [...codes];
  return code.startsWith(CURRENCY_PREFIX) ? code.slice(CURRENCY_PREFIX.length) : code;
}

export function buildTradeStationDataset(input: {
  rows: Record<string, TradeTableRow>;
  sources: Record<string, string>;
  sections: TradeSection[];
  describe: (id: string) => ItemIdentity;
  rules: TradeStationRules | null;
  priceBands?: TradePriceBand[];
}): TradeStationDataset {
  const bands = input.priceBands ?? [];
  const bandFor = (id: string) => bands.find((band) => id.startsWith(band.idPrefix));
  const dataset: TradeStationDataset = {
    currency: { code: tradeCurrencyCode(input.rows), name: CURRENCY_NAME },
    sources: input.sources,
    sections: input.sections,
    rows: Object.entries(input.rows).map(([id, raw]) => buildRow(id, raw, input.describe(id), bandFor(id))),
  };
  // A shard only points at a parent the table also sells; the weapon shards have no such row.
  const ids = new Set(dataset.rows.map((row) => row.id));
  for (const row of dataset.rows) {
    if (row.shardOfId && !ids.has(row.shardOfId)) row.shardOfId = null;
  }
  if (input.rules) dataset.rules = input.rules;
  return dataset;
}

/**
 * Curated rules quote the station capacity. A client patch may vary it per level, so disagreement is
 * reported once instead of failing the dataset over a console line.
 */
export function stationCapacity(levels: Record<string, { TradeCapacity?: number }>): number {
  const capacities = [...new Set(Object.values(levels).map((level) => Number(level.TradeCapacity)))];
  if (capacities.length === 1) return capacities[0];
  console.warn(
    `[build-trade-station] Trade Station capacity differs across ${Object.keys(levels).length} levels ` +
    `(${capacities.join(', ')}); reporting level 1`
  );
  const levelOne = Number(levels['1']?.TradeCapacity);
  return Number.isFinite(levelOne) ? levelOne : capacities[0];
}

/**
 * The curated rules stay authored in `curated/tools`. The pipeline passes
 * `--curated-dir=<curated>/datamine`, so `..` is the curated root; the packaged exporter ships the
 * same folder beside the compiled processors. `--rules-file` overrides both.
 */
function findRulesFile(explicit: string | null): string | null {
  const curatedRoot = process.env.TOF_CURATED_DIR;
  const candidates = [
    explicit,
    curatedRoot ? path.resolve(curatedRoot, '..', 'tools', RULES_FILE) : null,
    path.resolve(__dirname, '..', 'curated', 'tools', RULES_FILE),
    path.resolve(__dirname, 'curated', 'tools', RULES_FILE),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function readRules(filePath: string): TradeStationRules {
  const data = readJson(filePath);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`[build-trade-station] curated rules are not an object: ${filePath}`);
  }
  // Parsed JSON boundary: the curated file is the documented rules contract.
  const rules = data as TradeStationRules;
  if (!Array.isArray(rules.en?.sections)) {
    throw new Error(`[build-trade-station] curated rules are missing en.sections: ${filePath}`);
  }
  for (const band of rules.priceBands ?? []) {
    if (!Array.isArray(band.percentRungs) || band.percentRungs.length < 2) {
      throw new Error(`[build-trade-station] price band ${band.idPrefix} has no percentRungs: ${filePath}`);
    }
  }
  return rules;
}

function readCatalogs(projectRoot: string): CatalogItem[][] {
  const dir = path.join(projectRoot, 'datamine', 'items', 'data');
  return ITEM_CATALOGS.map((name) => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      throw new Error(`[required] item catalog missing (run build-items-json first): ${file}`);
    }
    const catalog = readJson(file);
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
      throw new Error(`[required] item catalog malformed: ${file}`);
    }
    // Parsed JSON boundary: the catalog is a map of insertion index -> item.
    return Object.values(catalog as Record<string, CatalogItem>);
  });
}

function readLocalization(source: SourceFile, relative: string): LocalizationTable {
  if (!source.data || typeof source.data !== 'object' || Array.isArray(source.data)) {
    throw new Error(`[required] localization namespaces missing: ${relative}`);
  }
  return source.data as LocalizationTable;
}

function main(): void {
  const rawDir = option('raw-dir');
  const projectRoot = option('project-root');
  if (!rawDir || !projectRoot) {
    throw new Error('Usage: build-trade-station.js --raw-dir=<raw> --project-root=<stage>');
  }

  const treeSource = readSource(path.join(rawDir, CATEGORY_TREE), CATEGORY_TREE);
  const listingSource = readSource(path.join(rawDir, LISTING_TABLE), LISTING_TABLE);
  const levelSource = readSource(path.join(rawDir, LEVEL_TABLE), LEVEL_TABLE);

  // Parsed JSON boundary: the tree shape was verified against the client export.
  const menu = assetProperties(treeSource, CATEGORY_TREE).TradeLineMenuListArray;
  if (!Array.isArray(menu)) throw new Error(`[required] TradeLineMenuListArray missing: ${CATEGORY_TREE}`);
  const tree = menu as TradeTreeCategoryNode[];

  const rows = tableRows<TradeTableRow>(listingSource, LISTING_TABLE);
  const levels = tableRows<{ TradeCapacity?: number }>(levelSource, LEVEL_TABLE);
  const itemConfigs = tableRows<ItemConfigRow>(readSource(path.join(rawDir, ITEM_CONFIGS), ITEM_CONFIGS), ITEM_CONFIGS);
  // Optional: a client build that drops the cooking or art-pack tables still gets a dataset, just
  // with those icons missing.
  const optionalRows = <TRow>(relative: string): Record<string, TRow> => {
    const file = path.join(rawDir, relative);
    return fs.existsSync(file) ? tableRows<TRow>(readSource(file, relative), relative) : {};
  };
  const localization = readLocalization(readSource(path.join(rawDir, ENGLISH_GAME), ENGLISH_GAME), ENGLISH_GAME);

  const sections = buildSections(tree, localization[''] ?? {});
  const unlabeled = sections.filter((section) => !section.name || section.types.some((type) => !type.name));
  if (unlabeled.length > 0) {
    throw new Error(
      `[build-trade-station] unresolved category labels: ${unlabeled.map((section) => section.id).join(', ')}`
    );
  }

  const rulesFile = findRulesFile(option('rules-file'));
  const rules = rulesFile ? readRules(rulesFile) : null;
  if (!rulesFile) {
    console.warn('[build-trade-station] curated rules not found; emitting the dataset without a rules block');
  }

  const dataset = buildTradeStationDataset({
    rows,
    sources: {
      [path.basename(LISTING_TABLE)]: listingSource.sha256,
      [path.basename(CATEGORY_TREE)]: treeSource.sha256,
      [path.basename(LEVEL_TABLE)]: levelSource.sha256,
    },
    sections,
    describe: createItemResolver(
      readCatalogs(projectRoot),
      itemConfigs,
      localization,
      createIconFallback({
        cooking: optionalRows<{ ItemIcon?: IconRef }>(COOKING_FOOD),
        cookingMmo: optionalRows<{ ItemIcon?: IconRef }>(COOKING_FOOD_MMO),
        artPacks: optionalRows<{ Icons?: IconRef[] }>(ART_PACK),
        itemConfigs,
      })
    ),
    rules,
    priceBands: rules?.priceBands ?? [],
  });

  const unnamed = dataset.rows.filter((row) => row.name === null).map((row) => row.id);
  if (unnamed.length > 0) {
    console.warn(`[build-trade-station] ${unnamed.length} rows without a name: ${unnamed.join(', ')}`);
  }

  const target = path.join(projectRoot, OUTPUT);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  const listable = dataset.rows.filter((row) => row.canList).length;
  const types = dataset.sections.reduce((total, section) => total + section.types.length, 0);
  console.log(
    `[build-trade-station] ${dataset.rows.length} rows (${listable} listable), ${dataset.sections.length} sections, ` +
    `${types} types, capacity ${stationCapacity(levels)} over ${Object.keys(levels).length} levels, ` +
    `${unnamed.length} unnamed, rules ${rulesFile ? path.basename(rulesFile) : 'absent'}.`
  );
}

// `require` exists in the pipeline's CommonJS build but not when `node --test` imports the helpers.
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
