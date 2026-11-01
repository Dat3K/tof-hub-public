const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// MMO Build card and Handbook expansion catalogs (docs/imports.md and mmo/README.md).
// Raw MMO tables are read directly (paths in docs/imports.md); MMO weapons, food and Brainfield come from
// their already generated datasets. Player values (equipped items, rolls, totals) are never derived here.
// `--check` fails when the committed file differs from a fresh run.
const sitePaths = require('../lib/site-paths.cjs');
const {createDiskCase} = require('../lib/disk-case.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const RAW = sitePaths.rawDir;
const PUBLIC = sitePaths.publicDir;
const GAME_DATA = path.join(PUBLIC, 'game-data');
const OUT = path.join(GAME_DATA, 'build-mmo-page.json');
const EXPANSION_OUT = path.join(GAME_DATA, 'handbook/mmo-expansion.json');
const check = process.argv.includes('--check');
const expansionOnly = process.argv.includes('--expansion-only');
const LOCALES = ['en', 'ru'];
const ALL_LOCALES = ['en', 'ru', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'];
const GENERATOR_DATA = process.env.TOF_GENERATOR_DATA_DIR || path.join(sitePaths.repoRoot, 'scripts/data');
const {withThresholdReferences} = require('../lib/mmo-threshold-references.cjs');
// Refresh only the historical threshold projection after a catalog update, without replacing any active raw data.
if (process.argv.includes('--refresh-threshold-references')) {
  const catalog = withThresholdReferences(JSON.parse(fs.readFileSync(OUT, 'utf8')), GENERATOR_DATA);
  const text = JSON.stringify(catalog) + '\n';
  for (const target of [OUT, path.join(GAME_DATA, 'runtime/build-mmo-page.json')]) {
    if (check) assert.equal(fs.readFileSync(target, 'utf8'), text, `stale threshold references: ${target}`);
    else {fs.mkdirSync(path.dirname(target), {recursive: true});fs.writeFileSync(target, text);}
  }
  console.log(`MMO threshold references: ${catalog.thresholds.length} exact property tracks`);
  process.exit(0);
}

const CB = 'Hotta/Content/Resources/CoreBlueprints/';
const FILES = {
  equipment: CB + 'DataTable_MMO/EquipmentDataTable_MMO.json',
  modify: CB + 'DataTable_MMO/ModifyDataTable_MMO.json',
  randomProps: CB + 'DataTable_MMO/RandomPropDataTable_MMO.json',
  randomPools: CB + 'DataTable_MMO/RandomModifyDataTable_MMO.json',
  attributes: CB + 'DataTable_MMO/AttributeStaticDataTable_MMO.json',
  strengthenEffects: CB + 'DataTable_MMO/EquipStrengthenEffectPackDataTable_MMO.json',
  extraGain: CB + 'DataTable_MMO/DT_EquipRandomModifyExtraGain_MMO.json',
  serverSeasons: CB + 'DataTable_MMO/DT_MMOServerSeason.json',
  equipmentAsset: CB + 'DataTable_MMO/DA_Equipment_MMO.json',
  equipmentSeasons: CB + 'DataTable/EquipDataTables/DT_MMOEquipmentSeason.json',
  slots: CB + 'DataTable/EquipDataTables/EquipmentSlot/DT_MMOEquipmentSlotConfig.json',
  cards: CB + 'DataTable/EquipDataTables/EquipmentSlot/DT_MMOEquipmentSlotSkillConfig.json',
  cardAttributes: CB + 'DataTable/EquipDataTables/EquipmentSlot/DT_MMOEquipmentSlotSkillAttribute.json',
  cardCoefficients: CB + 'DataTable/EquipDataTables/EquipmentSlot/DT_MMOEquipmentSlotSkillCoefficient.json',
  pets: CB + 'DataTable/Pet/PetDataTable_MMO.json',
  petModify: CB + 'DataTable/Pet/PetModifyDataTable_MMO.json',
  petAdvance: CB + 'DataTable/Pet/PetAdvanceDataTable_MMO.json',
  petModules: CB + 'DataTable/Pet/DT_FightPetSkillModule_MMO.json',
  avatars: CB + 'DataTable/AvatarConfigDataTable.json',
  avatarFrames: CB + 'DataTable/AvatarFrameConfigDataTable.json',
  itemConfigs: CB + 'DataTable/Item/ItemConfigs.json',
  localization: locale => `Hotta/Content/Localization/Game/${locale}/Game.json`,
};

const sources = {};
const rawCache = new Map();
function readRaw(file) {
  if (!rawCache.has(file)) {
    const bytes = readGameSourceFileSync(path.join(RAW, file));
    rawCache.set(file, JSON.parse(bytes));
    sources[file] = {sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  }
  return rawCache.get(file);
}
const rows = file => readRaw(file).find(object => object.Rows).Rows;
function readGenerated(name) {
  const bytes = readGameSourceFileSync(path.join(GAME_DATA, name));
  sources['game-data/' + name] = {sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  return JSON.parse(bytes);
}

// The text's TableId names its string table; the MMO override (<table>_MMO) wins over the shared table. A string
// table asset may declare another localization namespace (StringTable.TableNamespace), which is then used.
// Patch exports can be intentionally partial (for example, an EN/RU-only fixture or a regional update). Load only
// cultures actually present; absent optional locale overlays must not prevent the verified base data from building.
const AVAILABLE_LOCALES = ALL_LOCALES.filter(locale => fs.existsSync(path.join(RAW, FILES.localization(locale))));
const tables = Object.fromEntries(AVAILABLE_LOCALES.map(locale => [locale, readRaw(FILES.localization(locale))]));
const tableNamespaces = new Map();
function tableNamespace(tableId) {
  if (!tableNamespaces.has(tableId)) {
    const file = 'Hotta/Content/' + tableId.replace(/^\/Game\//, '').replace(/\.[^./]+$/, '') + '.json';
    tableNamespaces.set(tableId, fs.existsSync(path.join(RAW, file)) ? readRaw(file).find(object => object.StringTable)?.StringTable.TableNamespace ?? null : null);
  }
  return tableNamespaces.get(tableId);
}
function resolveLocales(text, locales) {
  if (!text?.Key) return null;
  const table = text.TableId ? text.TableId.split('.').at(-1) : (text.Namespace ?? '');
  const declared = text.TableId ? tableNamespace(text.TableId) : null;
  const order = [table + '_MMO', table, ...(declared && declared !== table ? [declared] : [])];
  const names = Object.fromEntries(locales.map(locale => [locale, order.map(ns => tables[locale][ns]?.[text.Key]).find(value => typeof value === 'string') ?? null]));
  return Object.values(names).some(value => typeof value === 'string' && value.trim()) ? names : null;
}
function loc(text) { return resolveLocales(text, LOCALES); }
function locAll(text) { return resolveLocales(text, AVAILABLE_LOCALES); }
const locKey = (namespace, key) => loc({Namespace: namespace, Key: key});

// "/Game/Resources/X/T.T" → the published /game-assets/webp/… texture; a texture missing from both the public tree
// and the raw export stays null instead of being substituted. Game references differ in letter case from the
// exported files (S2t020_4exoskeletons vs S2t020_4Exoskeletons.png), so URLs use the on-disk spelling.
const diskCase = createDiskCase();
const pendingMedia = new Map();
function icon(ref) {
  const value = typeof ref === 'string' ? ref : ref?.AssetPathName;
  if (!value || value === 'None') return null;
  const relative = 'Hotta/Content/' + value.replace(/^\/Game\//, '').replace(/\.[^./]+$/, '');
  const publishedFile = diskCase(PUBLIC, `game-assets/webp/${relative}.webp`);
  if (publishedFile) return '/' + publishedFile;
  const rawFile = diskCase(RAW, relative + '.png');
  if (!rawFile) return null;
  const url = `/game-assets/webp/${rawFile.replace(/\.png$/i, '')}.webp`;
  pendingMedia.set(url, rawFile);
  return url;
}

// Generated datasets keep legacy media URLs; resolve them to the published texture as build-page-catalog.cjs does.
function published(url) {
  if (!url) return null;
  const file = [url, url.replace('/datamine/shared/media/', '/game-assets/webp/')]
    .map(candidate => diskCase(PUBLIC, candidate)).find(Boolean);
  return file ? '/' + file : null;
}

// Keep MMO module rows separate: their ids overlap Global modules but their effects and load differ.
function projectPetModules() {
  const advances = rows(FILES.petAdvance);
  const petModuleLimits = Object.fromEntries(Object.entries(rows(FILES.pets)).map(([id, pet]) => [id,
    Array.from({length: pet.MaxPetAdvanceLevel + 1}, (_, stars) => {
      const row = advances[`${pet.PetAdvancePack}_${stars}`];
      return row ? {stars, slots: row.SkillModuleNumber, load: row.SkillModuleLoad} : null;
    })]));
  const petModules = Object.entries(rows(FILES.petModules)).map(([id, row]) => ({
    id, typeId: row.SkillModuleTypeName, level: row.SkillModuleLevel, load: row.NeedLoadValue,
    name: loc(row.ItemName), description: loc(row.Description), icon: icon(row.ItemIcon),
    exclusivePets: row.ExclusivePet ?? [], elements: row.SkillModuleElementType ?? [],
  }));
  return {petModules, petModuleLimits};
}

function capturePetModuleRows() {
  return Object.fromEntries(Object.entries(rows(FILES.petModules)).map(([id, row]) => [id.toLowerCase(), {
    row: id, level: row.SkillModuleLevel, load: row.NeedLoadValue, typeName: row.SkillModuleTypeName,
    itemNameKey: row.ItemName?.Key ?? null, icon: row.ItemIcon?.AssetPathName ?? null,
    buffPath: row.SkillModuleBuff?.AssetPathName ?? null, availableServerMode: row.AvailableServerMode,
    exclusivePets: row.ExclusivePet ?? [],
    provenance: {relativePath: FILES.petModules, table: 'DT_FightPetSkillModule_MMO', row: id,
      fields: ['SkillModuleLevel', 'NeedLoadValue', 'SkillModuleTypeName', 'ItemName.Key', 'ItemIcon.AssetPathName', 'SkillModuleBuff.AssetPathName', 'AvailableServerMode', 'ExclusivePet'],
      regionVersion: 'MMO definitions; client region/export version unknown'},
  }]));
}

// Reproject this subsystem without rebuilding an unrelated newer equipment export.
if (process.argv.includes('--pet-modules-only')) {
  const current = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  for (const file of [FILES.pets, FILES.petAdvance]) {
    readRaw(file);
    assert.equal(sources[file].sha256, current.sources[file]?.sha256, `pet module input differs from active catalog: ${file}`);
  }
  const projection = projectPetModules();
  const captureModules = capturePetModuleRows();
  const text = JSON.stringify({...current, ...projection, petModuleSources: sources}) + '\n';
  void (async () => {
    if (!check) await publishMedia();
    for (const target of [OUT, path.join(GAME_DATA, 'runtime/build-mmo-page.json')]) {
      if (check) assert.equal(fs.readFileSync(target, 'utf8'), text, `stale MMO pet modules: ${target}`);
      else fs.writeFileSync(target, text);
    }
    if (sitePaths.writesRepoFixtures) {
      const target = path.join(PUBLIC, 'game-data/import-pets-mmo.json');
      const capture = JSON.parse(fs.readFileSync(target, 'utf8'));
      const captureText = JSON.stringify({...capture, modules: captureModules}, null, 1) + '\n';
      if (check) assert.equal(fs.readFileSync(target, 'utf8'), captureText, 'stale capture MMO modules');
      else fs.writeFileSync(target, captureText);
    }
    console.log(`MMO pet modules: ${projection.petModules.length} distinct MMO rows`);
  })().catch(error => {console.error(error);process.exitCode = 1;});
  return;
}

const SLOT_ENUM = value => value.replace('EQUIPMENT_SLOT_', '');
const QUALITY = value => value.replace('ITEM_ATTRIBUTE_QUALITY_', '').toLowerCase();
const round = (value, digits = 6) => Number(value.toFixed(digits));

// Follow the same explicit MMO equipment bindings as build-mmo-build.ts.
const equipmentBindings = readRaw(FILES.equipmentAsset).find(object => object.Properties?.MMOEquipSlotDataTable)?.Properties;
assert.ok(equipmentBindings, 'MMO equipment asset bindings');
for (const [key, field] of Object.entries({slots: 'MMOEquipSlotDataTable', cards: 'MMOEquipSlotSkillDataTable',
  cardAttributes: 'MMOEquipSlotSkillAttributeDataTable', cardCoefficients: 'MMOEquipSlotSkillCoefficientDataTable',
  equipmentSeasons: 'MMOEquipSeasonDataTable'})) {
  const ref = equipmentBindings[field]?.AssetPathName;
  assert.ok(ref && ref !== 'None', `MMO equipment binding ${field}`);
  FILES[key] = 'Hotta/Content/' + ref.replace(/^\/Game\//, '').replace(/\.[^./]+$/, '.json');
}
if (!expansionOnly) {
  const ref = equipmentBindings.RandomModifyExtraGainDataTable?.AssetPathName;
  assert.ok(ref && ref !== 'None', 'MMO equipment binding RandomModifyExtraGainDataTable');
  FILES.extraGain = 'Hotta/Content/' + ref.replace(/^\/Game\//, '').replace(/\.[^./]+$/, '.json');
}
const curveTables = new Map();
// Capture a reproducible, provenance-bearing reference using this generator's existing localization/curve readers.
const referenceIndex = process.argv.indexOf('--capture-threshold-reference');
if (referenceIndex >= 0) {
  const id = process.argv[referenceIndex + 1];
  assert.match(id || '', /^[a-z0-9-]+$/);
  const thresholds = projectThresholds(prop => prop.replace(/_\d+$/, ''));
  const target = path.join(GENERATOR_DATA, 'mmo-threshold-references', `${id}.json`);
  const text = JSON.stringify({schemaVersion: 1, id, region: null, version: null, sources, thresholds}) + '\n';
  if (check) assert.equal(fs.readFileSync(target, 'utf8'), text, `stale threshold reference ${id}`);
  else {fs.mkdirSync(path.dirname(target), {recursive: true});fs.writeFileSync(target, text);}
  console.log(`MMO threshold reference ${id}: ${thresholds.length} tracks`);
  process.exit(0);
}
// The same generated gear names and normal-gear art as Gacha Handbook. Slot enums establish
// the presentation join; there is no manually maintained MMO → Gacha id map.
const sharedGearIcons = fs.existsSync(path.join(GAME_DATA, 'build-gear-icons.json'))
  ? readGenerated('build-gear-icons.json').gear : {};
const sharedGearNames = fs.existsSync(path.join(GAME_DATA, 'build-page.json'))
  ? Object.fromEntries(readGenerated('build-page.json').gear.map(entry => [entry.id, entry.name])) : {};
const expansion = require('../lib/mmo-expansion.cjs')({files: FILES, rows, loc, locAll, locKey, icon, curve, sources,
  sharedGearIcons, sharedGearNames, published});
const expansionText = JSON.stringify(expansion) + '\n';
async function publishMedia() {
  const sharp = pendingMedia.size ? sitePaths.sharp() : null;
  for (const [url, rawPath] of pendingMedia) {
    const output = path.join(PUBLIC, url);
    fs.mkdirSync(path.dirname(output), {recursive: true});
    await sharp(path.join(RAW, rawPath)).webp({lossless: true}).toFile(output);
  }
}
function writeExpansion() {
  if (check) assert.ok(fs.existsSync(EXPANSION_OUT) && readGameSourceFileSync(EXPANSION_OUT, 'utf8') === expansionText,
    'mmo-expansion.json is stale; run pnpm generate:mmo-card');
  else {
    fs.mkdirSync(path.dirname(EXPANSION_OUT), {recursive: true});
    fs.writeFileSync(EXPANSION_OUT, expansionText);
  }
}
if (expansionOnly) {
  (async () => {
    if (check) assert.equal(pendingMedia.size, 0, 'missing expansion media; regenerate first');
    else await publishMedia();
    writeExpansion();
    console.log(`MMO expansion: ${expansion.cards.length} cards, ${expansion.slots.length} slots`);
  })().catch(error => {console.error(error); process.exitCode = 1;});
} else {

const attributeRows = rows(FILES.attributes);
const usedAttributes = new Set();
const attributeOf = prop => {
  const id = prop.replace(/_\d+$/, '');
  assert.ok(attributeRows[id], `attribute ${id}`);
  usedAttributes.add(id);
  return id;
};

// ---------------------------------------------------------------- equipment
const slotRows = rows(FILES.slots);
const slotByEnum = {};
const slots = expansion.slots;
for (const [id, row] of Object.entries(slotRows)) {
  slotByEnum[SLOT_ENUM(row.Slot)] = id;
}

const modify = rows(FILES.modify);
const effectPacks = rows(FILES.strengthenEffects);
const randomPools = rows(FILES.randomPools);
const pools = {};
const gear = [];
for (const [id, row] of Object.entries(rows(FILES.equipment))) {
  const slot = slotByEnum[SLOT_ENUM(row.EquipmentSlotType)];
  // Unidentified copies share their identified item's stats; FATE rows have no card slot.
  if (!slot || id.startsWith('unid_')) continue;
  const base = modify[row.ModifyData]?.ModifyData ?? [];
  // Per-level enhancement increments, aligned with the base modifier order (the pack row repeats every level).
  const perLevel = effectPacks[`${row.StrengthenEffectPackID}_1`]?.AddAttrValues ?? [];
  const pool = row.RandomModifyData && row.RandomModifyData !== 'None' ? row.RandomModifyData : null;
  if (pool && !pools[pool]) pools[pool] = randomPools[pool].ModifyData.map(entry => entry.PropName);
  gear.push({id, slot, name: loc(row.ItemName), icon: icon(row.ItemIcon), quality: QUALITY(row.RandomAttributeQuality),
    season: row.MMOSeasonIndex, grade: row.EquipGrade, tier: row.OrderLevel, maxEnhancement: row.MaxStrengthenLevel,
    base: base.map((entry, index) => ({prop: entry.PropName, value: entry.PropValue, perLevel: perLevel.length === base.length ? perLevel[index] : null})),
    pool});
}
gear.sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id));
// Variant items (guaranteed pools baodipool{atk,def,heal,common}) carry the weapon resonance their name suffix spells
// out (Attack / Fortitude / Benediction / Balanced; ids of build-page roleResonances). `baseName` drops that suffix:
// EN “Name - Variant”, RU “Name — Variant” or “Name (variant)”.
const POOL_ROLES = {atk: 'dps', def: 'tank', heal: 'healer', common: 'balance'};
for (const item of gear) {
  const kind = item.pool?.match(/^baodipool(atk|def|heal|common)_/)?.[1];
  if (!kind) continue;
  item.role = POOL_ROLES[kind];
  item.baseName = Object.fromEntries(LOCALES.map(locale => {
    const value = item.name?.[locale];
    // The role suffix follows " - " (Latin, Cyrillic, Thai) a colon (Indonesian, Thai) or the CJK middle dot "·" / "・" without spaces.
    const stripped = value?.replace(/(?:\s+[-–—]\s+|:\s+|\s*[·・]\s*)[^-–—·・:]+$/u, '').replace(/\s*\([^()]+\)$/u, '');
    return [locale, stripped && stripped !== value ? stripped : null];
  }));
}
for (const item of gear) for (const stat of item.base) attributeOf(stat.prop);

const randomStats = {};
for (const [prop, row] of Object.entries(rows(FILES.randomProps))) {
  randomStats[prop] = {attribute: attributeOf(prop), maxPerItem: row.MaxNum,
    ranges: Object.fromEntries(row.PropRangeData.map(range => [QUALITY(range.Quality), {base: round(range.PropInitValue), min: round(range.PropMinValue), max: round(range.PropMaxValue)}]))};
}
for (const props of Object.values(pools)) for (const prop of props) assert.ok(randomStats[prop], `random stat ${prop}`);

// ---------------------------------------------------------------- expansion cards
// Base stats of a card: DT_MMOEquipmentSlotSkillAttribute row `<SkillBaseAttributeID>_<stars>` (one row per star level,
// 0…MaxStarLevel) gives a per-level factor; DT_MMOEquipmentSlotSkillCoefficient.<prop>.LevelCoefficient (Value × a
// CommonLevel_MMO curve) scales it by level. Which level feeds the curve is not stated by the tables (see the docs).
const cardCoefficients = expansion.coefficients;
for (const prop of Object.keys(cardCoefficients)) attributeOf(prop);
// SkillStarsParam {n} = Value × curve(Time); Time is the number of equipped cards of that pack (verified against the
// in-game Charge / Stable DMG pack texts at 4 cards). Star levels do not select a curve row in the config.
const cards = expansion.cards.map(card => ({id: card.id, name: card.name, icon: card.icon, quality: card.quality,
  season: card.season, exclusive: card.exclusive, maxStars: card.maxStars, maxSuit: card.maxSuit,
  // Keep the existing Build equipment editor's configuration-only eligibility.
  slots: card.slotEvidence.configured, description: card.description, params: card.params, stats: card.stats}));

// ---------------------------------------------------------------- random-stat thresholds
const thresholds = projectThresholds(attributeOf);

// ---------------------------------------------------------------- stat panels
// The two character attribute panels (Special / Basic) as the in-game screens list them; names, icons and percent
// display come from AttributeStaticDataTable_MMO.
// Element rows pair the panel's ATK and RES attributes under the site's element ids (Altered = Superpower).
const panels = {
  special: ['MaxHP', 'MaxEnergy', 'Crit', 'FinalCrit', 'CritDam'],
  elements: [['Physical', 'PhysicalAttack', 'PhysicalDef'], ['Flame', 'FireAtk', 'FireDefense'], ['Frost', 'IceAtk', 'IceDefense'], ['Volt', 'ThunderAtk', 'ThunderDefense'], ['Altered', 'SuperpowerAtk', 'SuperpowerDefense']]
    .map(([element, attack, resistance]) => ({element, attack, resistance})),
  basic: ['ApproachingSpeedMMO', 'DefenseIntensityMMO', 'AttackPowerMMO', 'ElementDefAddedPVP', 'EquipAttrHealAtk', 'CommonAtkAddedPVP', 'EquipAttrSuperArmor'],
};
for (const prop of [...panels.special, ...panels.basic, ...panels.elements.flatMap(row => [row.attack, row.resistance])]) attributeOf(prop);
const attributes = Object.fromEntries([...usedAttributes].sort().map(id => {
  const row = attributeRows[id];
  // `description`: the game's hover text (AttributeDescription); {0}/{1} are filled by the client's AttributeDescFunction.
  return [id, {name: loc(row.AttributeText), icon: icon(row.AttributeIcon), percent: Boolean(row.bShowPercent), description: loc(row.AttributeDescription)}];
}));

// ---------------------------------------------------------------- weapons, pets, seasons, food, Brainfield
const PLACEHOLDER = /^Advancement \d+★ upgrade effect\.$/;
const simulacra = Object.fromEntries(LOCALES.map(locale => [locale, readGenerated(`${locale}/simulacra.json`).mmo]));
const weapons = simulacra.en.map(item => {
  const ru = simulacra.ru.find(entry => entry.id === item.id);
  return {id: item.id, weaponId: item.weapon_id, name: {en: item.name_en, ru: item.name_ru || item.name_en},
    weapon: {en: item.weapon_name_en, ru: item.weapon_name_ru || item.weapon_name_en},
    elements: [item.element, item.element_secondary].filter(Boolean), role: item.role, roleIcon: published(item.role_icon), icon: published(item.icon),
    rarity: item.rarity, season: item.season ?? null,
    // Simulacra's own fallback text for an advancement without a game description is not a game fact.
    advancements: item.advancements.map(advancement => {
      const ruText = ru?.advancements.find(entry => entry.star === advancement.star)?.description;
      // Stat-only steps read “Increases Combat Strength by N.”; their sum is the weapon's in-game Combat Strength.
      const combatStrength = Number(advancement.description.match(/^Increases Combat Strength by (\d+)\.?$/)?.[1] ?? 0);
      return {star: advancement.star, combatStrength, description: PLACEHOLDER.test(advancement.description) ? null : {en: advancement.description, ru: ruText || advancement.description}};
    })};
});

const petModify = rows(FILES.petModify);
// Pet artwork (UI/PetFight/icon/LH_FightPet_*) from the generated Info pets catalog, which maps MMO_<row id>.
const petPhotos = Object.fromEntries(readGenerated('en/pets.json').items.filter(item => item.source_edition === 'mmo').map(item => [item.id.replace(/^MMO_/, ''), published(item.photo || item.icon)]));
// Inherited ATK: `<PetAdvancePack>_<advance>`.PlayerModifyCoefficient × the owner's average Fire/Ice/Volt/Physical
// *AtkDisplayBase (devscan20–22: (34082.39 + 3 × 33182.39) / 4 × 1 = 33407.39, in game "+33407").
const petAdvance = rows(FILES.petAdvance);
const advanceRows = row => Array.from({length: row.MaxPetAdvanceLevel + 1}, (_, advance) => petAdvance[`${row.PetAdvancePack}_${advance}`] ?? null);
const pets = Object.entries(rows(FILES.pets)).map(([id, row]) => {
  const levels = [];
  for (let level = 1; petModify[`${row.PetUpgradeModifyPack}_${level}`]; level++) {
    const stats = petModify[`${row.PetUpgradeModifyPack}_${level}`];
    levels.push([level, stats.CommonAtkBase, stats.Crit]);
  }
  return {id, name: loc(row.ItemName), icon: icon(row.ItemIcon), portrait: petPhotos[id] ?? null, element: row.PetElementType.split('::').at(-1),
    maxLevel: row.MaxPetLevel, maxAdvance: row.MaxPetAdvanceLevel, levels,
    inheritance: advanceRows(row).map(advance => typeof advance?.PlayerModifyCoefficient === 'number' ? advance.PlayerModifyCoefficient : null)};
});
const petModuleProjection = projectPetModules();

// The capture app's own-pet catalog for MMO Smart Servants (merged with the Global capture-pets.json; key = lower-case row).
// devscan20/21: FightPet_14 is selected but absent from the Global table, so its record was refused (docs/imports.md).
const CAPTURE_PETS_OUT = path.join(PUBLIC, 'game-data/import-pets-mmo.json');
const petTable = rows(FILES.pets);
const capturePets = Object.fromEntries(Object.entries(petTable).map(([id, row]) => {
  const levels = {};
  for (let level = 1; petModify[`${row.PetUpgradeModifyPack}_${level}`]; level++) {
    const stats = petModify[`${row.PetUpgradeModifyPack}_${level}`];
    levels[level] = {nextLevelExp: null, baseAttributes: Object.fromEntries(Object.entries(stats).filter(([, value]) => typeof value === 'number')),
      provenance: {attributes: {relativePath: FILES.petModify, row: `${row.PetUpgradeModifyPack}_${level}`}}};
  }
  return [id.toLowerCase(), {row: id, itemNameKey: row.ItemName?.Key ?? null, icon: row.PetIcon?.AssetPathName ?? null, element: row.PetElementType,
    property: row.PetPropertyType, maxLevel: row.MaxPetLevel, maxStars: row.MaxPetAdvanceLevel,
    // Advancement rows: SkillModuleNumber / SkillModuleLoad / PlayerModifyCoefficient.
    maxModuleSlots: Math.max(0, ...advanceRows(row).map(advance => advance?.SkillModuleNumber ?? 0)), levels,
    stars: Object.fromEntries(advanceRows(row).flatMap((advance, stars) => advance ? [[stars, {moduleSlots: advance.SkillModuleNumber,
      moduleLoadCapacity: advance.SkillModuleLoad, playerModifyCoefficient: advance.PlayerModifyCoefficient,
      provenance: {relativePath: FILES.petAdvance, row: `${row.PetAdvancePack}_${stars}`}}]] : [])),
    provenance: {relativePath: FILES.pets, row: id}}];
}));
const capturePetsText = JSON.stringify({schemaVersion: 1, generatedBy: 'scripts/generators/build-mmo-card.cjs', pets: capturePets, modules: capturePetModuleRows()}, null, 1) + '\n';

// Avatars and frames of the MMO client that the site's cosmetics catalog (build-page.json, Global export) lacks, e.g. an
// own MMO character's newer avatar. Same rule as build-cosmetics: the same-id item's ItemIcon, else the config Icon.
const siteCosmetics = readGenerated('build-page.json');
const {avatarAnimationSource} = require('../game-processors/processors/cosmetic-sources.ts');
const itemConfigs = rows(FILES.itemConfigs);
const mmoCosmetics = (file, known) => Object.entries(rows(file))
  .filter(([id]) => !known.has(id) && !id.startsWith('Default_') && !id.includes('Placeholder'))
  .flatMap(([id, row]) => {
    const url = icon(itemConfigs[id]?.ItemIcon ?? row.Icon);
    const name = loc(row.Name);
    return url ? [{id, name: {en: name?.en || name?.ru || id, ru: name?.ru || name?.en || id}, icon: url, animation: avatarAnimationSource(row)}] : [];
  });
const avatars = mmoCosmetics(FILES.avatars, new Set(siteCosmetics.avatars.map(item => item.id)));
const avatarFrames = mmoCosmetics(FILES.avatarFrames, new Set(siteCosmetics.avatarFrames.map(item => item.id)));

// DT_MMOServerSeason lists seasons 1 and 2 only. Season 3 is added by the owner (2026-10-23) before it is in the raw export:
// an editorial entry, flagged so the card never picks it by default; replace it with the exported row when it appears.
const EDITORIAL_SEASONS = [{index: 3, name: {en: 'Season 3', ru: 'Сезон 3'}, editorial: true}];
const exportedSeasons = Object.values(rows(FILES.serverSeasons)).map(row => ({index: row.SeasonIndex, name: loc(row.SeasonName)}));
const seasons = [...exportedSeasons, ...EDITORIAL_SEASONS.filter(season => !exportedSeasons.some(item => item.index === season.index))].sort((a, b) => a.index - b.index);

const food = Object.fromEntries(LOCALES.map(locale => [locale, readGenerated(`${locale}/food-mmo.json`).items]));
const foods = food.en.map(item => ({id: item.id, name: {en: item.name, ru: food.ru.find(entry => entry.id === item.id)?.name || item.name}, icon: published(item.icon), rarity: item.rarity}));
// The second consumable slot: Vera dishes with an MMO-server ATK% buff (food-mmo `potions`, e.g. +1%).
const potionRows = Object.fromEntries(LOCALES.map(locale => [locale, readGenerated(`${locale}/food-mmo.json`).potions]));
const potions = potionRows.en.map(item => ({id: item.id, name: {en: item.name_en || item.name, ru: item.name_ru || item.name_en || item.name}, icon: published(item.icon), rarity: item.rarity,
  atkPercent: typeof item.atk_percent === 'number' ? item.atk_percent : null}));

const handbook = readGenerated('handbook/mmo-brainfield.json');
const brainfield = handbook.groups.map(group => ({name: group.name, maximum: group.maximumLevelTotal,
  nodes: group.nodes.map(node => ({id: node.id, kind: node.kind, name: node.name, maxLevel: node.maxLevel, icon: published(node.icons?.activated)}))}));

// ---------------------------------------------------------------- labels and write
const labels = {
  fixedMode: locKey('', '62A95D124F7C251A1A4FC9896A6B5F05'),
  regularMode: locKey('', '4B6C434447E247542990FBB98FAC638F'),
  // The in-game Fire Mode tooltips of the two modes (one text per mode; line breaks are joined by the card).
  fixedModeDescription: locKey('', '0688FE0F45BB77228829F48A6FA1AC01'),
  regularModeDescription: locKey('', '12FAE7454EB568F82147E7B809E1F491'),
  equipmentTier: locKey('', '466B7C9942DEF22F11E0A191B57FF310'),
  expansionStats: locKey('', 'E736035E4860235BECF33884D65ECB41'),
  randomStats: locKey('QRSLCommon_ST', 'RandomProp'),
  baseStats: locKey('UI', 'UI_Tips_2'),
};
for (const [key, value] of Object.entries(labels)) assert.ok(value?.en && value.ru, `label ${key}`);

// Crit rating → chance: the shared ability curve CritFormula.json (a·L²+b·L+c), as generated for the Global card. The MMO
// level it is read at is the character's own (the in-game text: \"when attacking a same-level opponent\"); model, not verified for MMO.
const critFormula = JSON.parse(readGameSourceFileSync(path.join(PUBLIC, 'game-data/build-reference.json'), 'utf8')).critFormula;
// Resistance → damage reduction RES/(RES+K). The only MMO reading we have: RES 6420 shows "reduce volt damage taken by 36.074%"
// (owner screenshot 2026-10-23, same-level text). The shared DefenceFormula.json at the character level does not give it
// (Lv. 85: K 10621, Lv. 88: 11385), so K is calibrated on this one reading; the level it belongs to is unresolved (docs/imports.md).
const RESISTANCE_READING = {resistance: 6420, reduction: 0.36074};
const resistanceFormula = {expression: 'RES / (RES + K)', k: RESISTANCE_READING.resistance * (1 - RESISTANCE_READING.reduction) / RESISTANCE_READING.reduction, observed: RESISTANCE_READING};
const catalog = withThresholdReferences({schemaVersion: 1, sources, labels, panels, critFormula, resistanceFormula, attributes, slots, gear, pools, randomStats, cards, cardCoefficients, thresholds, weapons, pets, ...petModuleProjection, seasons, foods, potions, brainfield, avatars, avatarFrames}, GENERATOR_DATA);
// The avatar canvas is measured from the published texture, so the text is built after the textures exist.
const catalogText = async () => {
  await require('./build-cosmetic-layout.cjs')([...avatars, ...avatarFrames], PUBLIC);
  return JSON.stringify(catalog) + '\n';
};

(async () => {
  if (check) {
    for (const url of pendingMedia.keys()) assert.fail(`missing ${url}; run pnpm generate:mmo-card`);
    const text = await catalogText();
    assert.ok(fs.existsSync(OUT) && readGameSourceFileSync(OUT, 'utf8') === text, 'build-mmo-page.json is stale; run pnpm generate:mmo-card');
    if (sitePaths.writesRepoFixtures) assert.ok(fs.existsSync(CAPTURE_PETS_OUT) && readGameSourceFileSync(CAPTURE_PETS_OUT, 'utf8') === capturePetsText, 'import-pets-mmo.json is stale; run pnpm generate:mmo-card');
    writeExpansion();
    console.log('MMO card catalog is up to date');
    return;
  }
  await publishMedia();
  fs.writeFileSync(OUT, await catalogText());
  if (sitePaths.writesRepoFixtures) fs.writeFileSync(CAPTURE_PETS_OUT, capturePetsText);
  writeExpansion();
  console.log(`MMO card catalog: ${gear.length} gear, ${cards.length} cards, ${weapons.length} weapons, ${pets.length} pets, ${avatars.length}+${avatarFrames.length} MMO-only avatars/frames, ${pendingMedia.size} new textures → ${path.relative(sitePaths.repoRoot, OUT)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
}

function curve(param) {
  const objectPath = param.Curve?.CurveTable?.ObjectPath;
  if (!objectPath || !param.Curve.RowName || param.Curve.RowName === 'None') return null;
  const file = objectPath.replace(/\.\d+$/, '.json');
  if (!curveTables.has(file)) curveTables.set(file, rows(file));
  const row = curveTables.get(file)[param.Curve.RowName];
  assert.ok(row, `curve ${file}:${param.Curve.RowName}`);
  assert.equal(row.InterpMode, 'RCIM_Linear', `unsupported MMO curve interpolation ${file}:${param.Curve.RowName}`);
  return row.Keys.map(key => [key.Time, round(key.Value, 8)]);
}

function projectThresholds(attributeOf) {
  return Object.entries(rows(FILES.extraGain)).map(([prop, row]) => ({prop, attribute: attributeOf(prop),
    levels: row.AllLevelGains.map(level => ({level: level.GainLevel, value: round(level.RandomModifyValue), description: fillParams(loc(level.GainDetail), level.GainDetailParams)})),
  }));
}

function fillParams(text, params) {
  if (!text) return null;
  const values = params.map(param => {
    const keys = curve(param);
    return keys ? round(param.Value * keys[0][1], 4) : null;
  });
  return Object.fromEntries(LOCALES.map(locale => [locale, text[locale]?.replace(/\{(\d+)\}/g, (match, index) => values[index] === null || values[index] === undefined ? match : String(values[index])) ?? null]));
}
