const { traceEnemyClass } = require('../game-processors/processors/enemy-class-chain.cjs');
const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// Datamine Handbook (docs/game-data/README.md): one slim JSON per page section under
// apps/web/public/game-data/handbook/. Raw tables are resolved through the game's own bindings
// (BP_OverseaGameData_Base for Global, BP_GameData_MMO_Base for MMO); progression costs, formulas,
// Titan rare data and CS rules are sliced from existing generated outputs instead of re-derived.
// `--check` fails when a committed file differs from a fresh run.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const weightedStatInclusion = require('../lib/weighted-stat-inclusion.cjs');
const {getMmoBygoneHpScaling, getMmoBygoneHp, estimateMmoBygoneDefense} = require('../../packages/game-domain/src/encounters/mmo-bygone.ts');
const root = path.resolve(__dirname, '../..');
// The portable package bundles this file into <package>/generators and ships repo-relative sources in <package>/scripts.
const sourceRoot = fs.existsSync(path.join(__dirname, '../scripts/game-processors')) ? path.dirname(__dirname) : root;
const rawRoot = sitePaths.rawDir;
const gameData = path.join(sitePaths.publicDir, 'game-data');
const outDir = path.join(gameData, 'handbook');
const check = process.argv.includes('--check');

function raidRankings() {
  const {RaidRankingDatasetSchema}=require('../../packages/contracts/src/raid-rankings.ts');
  const input=process.env.TOF_RAID_RANKINGS_FILE || path.join(sitePaths.legacyDir,'datamine/raids/raid-rankings.json');
  const dataset=fs.existsSync(input)?RaidRankingDatasetSchema.parse(JSON.parse(fs.readFileSync(input,'utf8')))
    :{schemaVersion:1,sources:[],seasons:[],boards:[]};
  write('raid-rankings',dataset);
  require('./build-runtime-data.cjs').buildRaidRankingRuntime(gameData,{check});
}

const rawCache = new Map();
function readRaw(file, sources) {
  if (!rawCache.has(file)) {
    const bytes = readGameSourceFileSync(path.join(rawRoot, file));
    rawCache.set(file, {sha256: crypto.createHash('sha256').update(bytes).digest('hex'), json: JSON.parse(bytes)});
  }
  const entry = rawCache.get(file);
  sources[file] = {sha256: entry.sha256};
  return entry.json;
}
const rows = (file, sources) => readRaw(file, sources).find(o => o.Rows).Rows;
function readGenerated(name, sources) {
  const file = path.join(gameData, name);
  const bytes = readGameSourceFileSync(file);
  sources['game-data/' + name] = {sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  return JSON.parse(bytes);
}

// "/Game/Resources/X/T.T" or "Hotta/Content/Resources/X/T.0" → "Hotta/Content/Resources/X/T.json".
const assetFile = ref => {
  const value = ref.AssetPathName || ref.ObjectPath;
  return (value.startsWith('/Game/') ? 'Hotta/Content/' + value.slice(6) : value).replace(/\.[^./]+$/, '.json');
};
const BINDINGS = {
  global: 'Hotta/Content/ResourcesOverSea/GameData/BP_OverseaGameData_Base.json',
  mmo: 'Hotta/Content/Resources/CoreBlueprints/GameMode/MMO/BP_GameData_MMO_Base.json',
};
function binding(mode, key, sources) {
  const properties = readRaw(BINDINGS[mode], sources).find(o => o.Name.startsWith('Default__')).Properties;
  assert.ok(properties[key], `${mode}: ${key} is not bound`);
  return assetFile(properties[key]);
}

// Resolve acquisition links through the mode's bound drop tables, keeping named containers
// separate from generic item-source hints. Unidentified equipment is an intermediate item.
function variantPresentation(name, elementIcons) {
  const elements = {Overload: 'Physical', Glaze: 'Frost', Burst: 'Flame', Arc: 'Volt', Altered: 'Altered'};
  const match = name?.en?.match(/^(.*?)\s*(?:\((Overload|Glaze|Burst|Arc|Altered)\)|:\s*(Overload|Glaze|Burst|Arc|Altered))$/);
  if (!match) return null;
  const variant = match[2] ?? match[3];
  const ru = name.ru?.match(/^(.*?)\s*(?:\(([^()]+)\)|:\s*([^:]+))$/);
  return {name: {en: match[1].trim(), ru: ru?.[1].trim() ?? name.ru},
    variant: {en: variant, ru: ru?.[2] ?? ru?.[3] ?? null}, element: elements[variant], icon: elementIcons[elements[variant]]?.icon ?? null};
}

function statPoolOrigins(mode, equipment, loc, sources, elementIcons) {
  function inherited(file, seen = new Set()) {
    if (seen.has(file)) return {};
    seen.add(file);
    const objects = readRaw(file, sources);
    const parent = objects.find(o => o.SuperStruct)?.SuperStruct;
    const parentFile = parent?.ObjectPath?.startsWith('Hotta/') ? assetFile(parent) : null;
    return {...(parentFile ? inherited(parentFile, seen) : {}),
      ...objects.find(o => o.Name.startsWith('Default__'))?.Properties};
  }
  const bindings = inherited(BINDINGS[mode]);
  const itemFile = assetFile(bindings.ItemDataTable);
  const items = {...rows(itemFile, sources), ...equipment};
  const reverse = new Map();
  const add = (key, value) => {
    if (!reverse.has(key)) reverse.set(key, new Set());
    reverse.get(key).add(value);
  };
  const sequences = new Map();
  for (const entry of bindings.DropSequenceDataTables ?? []) {
    for (const [key, row] of Object.entries(rows(assetFile(entry.Value), sources))) {
      if (!row.ItemID || row.ItemID === 'None') continue;
      const sequence = key.replace(/_\d+$/, '');
      if (!sequences.has(sequence)) sequences.set(sequence, new Set());
      sequences.get(sequence).add(row.ItemID);
    }
  }
  const groups = new Map();
  for (const entry of bindings.DropGroupDataTables ?? []) {
    for (const [key, row] of Object.entries(rows(assetFile(entry.Value), sources))) {
      const group = key.replace(/_\d+$/, '');
      if (!groups.has(group)) groups.set(group, new Set());
      for (const item of sequences.get(row.SequenceID) ?? []) groups.get(group).add(item);
    }
  }
  for (const [id, item] of Object.entries(items)) {
    for (const target of groups.get(item.DropGroupID) ?? []) add(target, id);
  }
  const outputSources = bindings.ItemOutputSourceTable ? rows(assetFile(bindings.ItemOutputSourceTable), sources) : {};
  const cache = new Map();
  return itemIds => {
    const found = new Map();
    for (const id of itemIds) {
      if (!cache.has(id)) {
        const containers = new Map();
        const queue = [id], visited = new Set(queue);
        for (let index = 0; index < queue.length; index++) {
          for (const sourceId of reverse.get(queue[index]) ?? []) {
            if (visited.has(sourceId)) continue;
            visited.add(sourceId);
            const source = items[sourceId];
            if (source.ItemType === 'ITEM_TYPE_UNIDENTIFIED_EQUIP') queue.push(sourceId);
            else {
              const name = loc(source.ItemName, mode);
              if (name) containers.set(sourceId, {id: sourceId, name, kind: 'container', presentation: variantPresentation(name, elementIcons)});
            }
          }
        }
        if (!containers.size) {
          const sourceId = equipment[id]?.OutputSourceID;
          for (const [index, source] of (outputSources[sourceId]?.SourceArray ?? []).entries()) {
            const name = loc(source.PostfixName, mode);
            if (name) containers.set(`${sourceId}:${index}`, {id: `${sourceId}:${index}`, name, kind: 'hint', presentation: variantPresentation(name, elementIcons)});
          }
        }
        cache.set(id, [...containers.values()]);
      }
      for (const source of cache.get(id)) found.set(source.id, source);
    }
    return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
  };
}

// Localization: the text's TableId names the string table; Global prefers its _Oversea override, MMO its _MMO one.
const LOCALES = ['en', 'ru'];
function localizer(sources) {
  const tables = Object.fromEntries(LOCALES.map(l => [l, readRaw(`Hotta/Content/Localization/Game/${l}/Game.json`, sources)]));
  const folded = new Map();
  return (text, mode = 'global', caseInsensitive = false) => {
    if (!text || !text.Key) return null;
    const table = text.TableId ? text.TableId.split('.').at(-1) : (text.Namespace ?? '');
    const order = [table + (mode === 'mmo' ? '_MMO' : '_Oversea'), table];
    const lookup = (locale, namespace) => {
      const entries = tables[locale][namespace] ?? {};
      if (typeof entries[text.Key] === 'string' || !caseInsensitive) return entries[text.Key];
      const id = locale + ':' + namespace;
      if (!folded.has(id)) {
        const index = new Map();
        for (const [key, value] of Object.entries(entries)) {
          const lower = key.toLowerCase();
          // Ambiguous case variants must not silently choose a different name.
          index.set(lower, index.has(lower) && index.get(lower) !== value ? null : value);
        }
        folded.set(id, index);
      }
      return folded.get(id).get(text.Key.toLowerCase());
    };
    const names = Object.fromEntries(LOCALES.map(l => [l, order.map(ns => lookup(l, ns)).find(v => typeof v === 'string') ?? null]));
    return names.en || names.ru ? names : null;
  };
}

function write(name, data) {
  const file = path.join(outDir, name + '.json');
  const text = JSON.stringify({schemaVersion: 1, ...data}) + '\n';
  if (check) {
    assert.ok(fs.existsSync(file) && readGameSourceFileSync(file, 'utf8') === text, `${path.relative(root, file)} is stale; run pnpm generate:handbook`);
    return;
  }
  fs.mkdirSync(outDir, {recursive: true});
  fs.writeFileSync(file, text);
}

// Icons: raw PNGs referenced by the tables, converted to lossless WebP under /game-assets/webp (same layout as
// build-supercomputing.cjs). Missing raw images give null, never a substitute.
const media = new Map();
function icon(ref, role) {
  const value = typeof ref === 'string' ? ref : ref?.AssetPathName;
  if (!value || value === 'None') return null;
  const relative = assetFile({AssetPathName: value}).replace(/\.json$/, '');
  if (!fs.existsSync(path.join(rawRoot, relative + '.png'))) return null;
  const url = `/game-assets/webp/${relative}.webp`;
  if (!media.has(url)) media.set(url, {rawPath: relative + '.png', url, role});
  return url;
}

const QUALITY = q => q.replace('ITEM_ATTRIBUTE_QUALITY_', '').toLowerCase();
const SLOT = s => s.replace('EQUIPMENT_SLOT_', '');
const round = (value, digits = 6) => Number(value.toFixed(digits));

// Project slot ids (helmet … reactor) keyed by the raw slot enum, through the Titan pool rows of build-reference.
function slotCatalog(reference, buildPage, sources) {
  const items = rows(binding('global', 'EquipmentDataTable', sources), sources);
  const names = Object.fromEntries(buildPage.gear.map(g => [g.id, g.name]));
  const slots = {};
  for (const [id, row] of Object.entries(reference.titanRare.poolRows)) {
    const item = items[row.baseId];
    assert.ok(item && names[id], `slot ${id}`);
    slots[SLOT(item.EquipmentSlotType)] = {id, name: names[id], baseItem: row.baseId, titanItem: row.titanId, titanPack: row.packId};
  }
  assert.equal(Object.keys(slots).length, 12);
  return slots;
}

// ---------------------------------------------------------------- random stats
function randomStats(ctx) {
  const sources = {};
  sources['game-data/build-page.json'] = ctx.sources['game-data/build-page.json'];
  function poolPresentation(itemIds) {
    for (const id of itemIds) {
      const presentation = variantPresentation(equipmentNames[id], ctx.buildPage.elementIcons);
      if (presentation) return presentation;
    }
    return null;
  }
  const {loc, csRules, limits, slots} = ctx;
  const typeOf = Object.fromEntries(Object.entries(csRules.attributes).map(([type, prop]) => [prop, type]));
  const equipmentNames = {};
  const commonAttributes = rows('Hotta/Content/Resources/CoreBlueprints/DataTable/AttributeStaticDataTable.json', sources);
  const modes = {};
  for (const mode of ['global', 'mmo']) {
    // Global has no Overseas attribute override; MMO binds its own table.
    const attributes = mode === 'mmo' ? rows(binding('mmo', 'AttributeStaticDataTable', sources), sources) : commonAttributes;
    const props = rows(binding(mode, 'RandomPropDataTable', sources), sources);
    const pools = rows(binding(mode, 'RandomModifyDataTable', sources), sources);
    const items = rows(binding(mode, 'EquipmentDataTable', sources), sources);
    const origins = statPoolOrigins(mode, items, loc, sources, ctx.buildPage.elementIcons);
    for (const [id, item] of Object.entries(items)) equipmentNames[id] ??= loc(item.ItemName, mode);
    const rolls = mode === 'global' ? limits.maxNumOfRandomStatRolls : null;
    const stats = {};
    const qualities = new Set();
    for (const [prop, row] of Object.entries(props)) {
      const attribute = attributes[prop.replace(/_\d+$/, '')];
      const ranges = {};
      for (const range of row.PropRangeData) {
        const quality = QUALITY(range.Quality);
        qualities.add(quality);
        const base = range.PropInitValue, min = range.PropMinValue, max = range.PropMaxValue;
        ranges[quality] = {base: round(base), min: round(min), max: round(max),
          ...(rolls ? {average: round(base + rolls * (min + max) / 2), maximum: round(base + rolls * max)} : {})};
      }
      stats[prop] = {type: typeOf[prop] ?? null, name: attribute ? loc(attribute.AttributeText, mode) : null, icon: icon(attribute?.AttributeIcon, 'handbook-stat'),
        ...(mode === 'mmo' ? {description: attribute?.AttributeDescription ? loc(attribute.AttributeDescription, mode) : null} : {}),
        percent: attribute ? Boolean(attribute.bShowPercent) : null, maxPerItem: row.MaxNum, advanceWeight: row.AdvanceWeightValue, ranges};
    }
    // Pools by slot and quality; the primary pool is the one most items of that slot and quality use.
    const bySlot = {};
    for (const [itemId, item] of Object.entries(items)) {
      if (!item.RandomModifyData || item.RandomModifyData === 'None') continue;
      assert.ok(pools[item.RandomModifyData], `${mode}: pool ${item.RandomModifyData}`);
      const slot = SLOT(item.EquipmentSlotType), quality = QUALITY(item.RandomAttributeQuality);
      ((bySlot[slot] ??= {})[quality] ??= {})[item.RandomModifyData] ??= [];
      bySlot[slot][quality][item.RandomModifyData].push(itemId);
    }
    // Some lower-quality items omit the elemental suffix from their localized name.
    // Reuse the named variant of the same raw pool family across qualities.
    const familyKey = (pool, quality) => pool.replace(`_${quality}`, '_quality');
    const familyVariants = new Map();
    for (const byQuality of Object.values(bySlot)) for (const [quality, used] of Object.entries(byQuality)) {
      for (const [pool, ids] of Object.entries(used)) {
        const presentation = poolPresentation(ids);
        if (presentation) familyVariants.set(familyKey(pool, quality), presentation);
      }
    }
    const slotPools = {};
    for (const [slot, byQuality] of Object.entries(bySlot)) {
      assert.ok(slots[slot], `${mode}: unknown slot ${slot}`);
      slotPools[slots[slot].id] = Object.fromEntries(Object.entries(byQuality).map(([quality, used]) => {
        const list = Object.entries(used).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
        return [quality, list.map(([pool, itemIds], index) => {
          const total = pools[pool].ModifyData.reduce((n, e) => n + Math.max(0, e.WeightValue), 0);
          for (const entry of pools[pool].ModifyData) assert.ok(stats[entry.PropName], `${mode}: ${pool} uses unknown ${entry.PropName}`);
          const weights = pools[pool].ModifyData.map(e => ({stat: e.PropName, weight: e.WeightValue,
            chance: e.WeightValue === -1 ? 1 : total > 0 ? round(Math.max(0, e.WeightValue) / total) : 0}));
          const inclusion = weights.every(w => stats[w.stat].maxPerItem === 1)
            ? weightedStatInclusion(weights.map(w => w.weight), limits.maxNumOfRandomStats) : null;
          weights.forEach((entry, i) => {
            entry.onItemChance = inclusion ? round(inclusion[i]) : null;
            entry.withoutStatChance = inclusion ? round(1 - inclusion[i]) : null;
          });
          const sourceOrigins = origins(itemIds), presentation = poolPresentation(itemIds);
          const guaranteedStats = weights.filter(w => w.weight === -1).map(w => w.stat);
          const variant = presentation ?? familyVariants.get(familyKey(pool, quality)) ?? sourceOrigins.find(source => source.presentation)?.presentation ?? null;
          // User-authored navigation categories; "$50" is editorial copy, not a verified store price.
          const category = guaranteedStats.length ? 'premium' : presentation || familyVariants.has(familyKey(pool, quality)) ? 'promo' : 'standard';
          const order = {Overload: 0, Glaze: 1, Burst: 2, Arc: 3, Altered: 4}[variant?.variant.en] ?? 5;
          return {pool, primary: index === 0, items: itemIds.sort(), origins: sourceOrigins, presentation, weights,
            selection: {category, variant, order, guaranteedStats}};
        })];
      }));
    }
    // Global: a stat that no gear pool can roll exists in the files but is not released on gear (CritDam).
    // MMO is not flagged: its gear also gains stats outside the pools (tiered copies, DT_EquipRandomModifyExtraGain).
    if (mode === 'global') {
      const pooled = new Set(Object.values(slotPools).flatMap(q => Object.values(q).flat().flatMap(p => p.weights.map(w => w.stat))));
      for (const [prop, stat] of Object.entries(stats)) if (!pooled.has(prop)) stat.unreleased = true;
    }
    modes[mode] = {rollsForTotals: rolls, qualities: [...qualities], stats, slots: slotPools,
      itemChanceModel: {statCount: limits.maxNumOfRandomStats, method: 'weighted-without-replacement'}};
  }
  // Gold (orange) Global ranges must reproduce the user's Stat ranges table (scripts/data/build-stat-ranges-reference.json;
  // percentages there are fractions rounded to the displayed precision).
  const expected = require('../data/build-stat-ranges-reference.json').stats;
  const byType = Object.fromEntries(Object.values(modes.global.stats).filter(s => s.type).map(s => [s.type, s.ranges.orange]));
  for (const [type, want] of Object.entries(expected)) {
    const actual = byType[type];
    assert.ok(actual, `stat range ${type} is missing from the raw table`);
    const tolerance = type.endsWith('%') ? 0.00006 : 0.51;
    for (const [field, key] of [['base', 'base'], ['min', 'minRoll'], ['max', 'maxRoll'], ['average', 'average5'], ['maximum', 'maximum5']])
      assert.ok(Math.abs(actual[field] - want[key]) <= tolerance, `${type} ${field}: ${actual[field]} ≠ ${want[key]}`);
  }
  const poolItems = [...new Set(Object.values(modes).flatMap(m => Object.values(m.slots).flatMap(q => Object.values(q).flat().flatMap(p => p.items))))];
  write('random-stats', {sources, modes, slotNames: Object.fromEntries(Object.values(slots).map(s => [s.id, s.name])), slotIcons: ctx.slotIcons,
    itemNames: Object.fromEntries(poolItems.sort().map(id => [id, equipmentNames[id] ?? null])), unresolved: {
    advanceWeight: 'RandomPropDataTable.AdvanceWeightValue is kept as a raw field; its use in choosing the upgraded stat is not confirmed.',
  }});
}

// ---------------------------------------------------------------- Titan
function titan(ctx) {
  const sources = {};
  const {loc, reference, slots} = ctx;
  const uncommon = rows(binding('global', 'EquipUncommonModifyData', sources), sources);
  const rates = rows(binding('global', 'EquipUncommonRateData', sources), sources);
  const growth = rows(binding('global', 'EquipRandomModifyData', sources), sources);
  // Match Gear stats, whose row order comes from the random-property table.
  const statOrder = new Map(Object.keys(rows(binding('global', 'RandomPropDataTable', sources), sources)).map((id, index) => [id, index]));
  const rareNames = Object.fromEntries(reference.titanRare.items.map(i => [i.id, {en: i.nameEn, ru: i.nameRu}]));
  const rareIcons = rareIconMap(uncommon);
  const pools = Object.values(slots).map(slot => {
    const list = uncommon[slot.titanPack].UncommonModifyInfoList;
    const thresholds = [...new Set(list.filter(e => e.Weight > 0).map(e => e.TupoCountLimited))].sort((a, b) => a - b);
    const properties = [...new Set(list.map(e => e.ModifyID))].map(id => ({id, name: rareNames[id] ?? loc(list.find(e => e.ModifyID === id).ModifyName), icon: rareIcons[id] ?? null,
      levels: list.filter(e => e.ModifyID === id).map(e => ({level: e.PropLevel, fromCount: e.TupoCountLimited, weight: e.Weight}))}));
    // An entry is eligible once the Titan count reaches its TupoCountLimited.
    const brackets = thresholds.map((from, i) => {
      const eligible = list.filter(e => e.Weight > 0 && e.TupoCountLimited <= from);
      const total = eligible.reduce((n, e) => n + e.Weight, 0);
      return {fromCount: from, toCount: thresholds[i + 1] ? thresholds[i + 1] - 1 : null, totalWeight: total,
        chances: eligible.map(e => ({id: e.ModifyID, level: e.PropLevel, chance: round(e.Weight / total)}))};
    });
    return {slot: slot.id, titanItem: slot.titanItem, pack: slot.titanPack, properties, brackets};
  });
  const rareDescriptions = Object.fromEntries(Object.values(uncommon).flatMap(pack => pack.UncommonModifyInfoList.map(entry => {
    const description = entry.ModifyDesc;
    // The game has paired templates: *_des contains {0}, while *_des2 omits the value.
    const template = description?.Key?.endsWith('_des2') ? loc({...description, Key: description.Key.slice(0, -1)}) : null;
    return [entry.ModifyID, template ?? loc(description)];
  })));
  const rareValues = reference.titanRare.items.map(i => ({id: i.id, name: rareNames[i.id], description: rareDescriptions[i.id] ?? null, icon: rareIcons[i.id] ?? null, values: i.effectCurve}));
  const triggerRates = Object.entries(rates).filter(([, r]) => r.UncommonRate !== undefined)
    .map(([count, r]) => ({count: Number(count), rate: r.UncommonRate})).sort((a, b) => a.count - b.count);
  const typeOf = Object.fromEntries(Object.entries(ctx.csRules.attributes).map(([type, prop]) => [prop, type]));
  const attributes = rows('Hotta/Content/Resources/CoreBlueprints/DataTable/AttributeStaticDataTable.json', sources);
  const mainGrowth = Object.entries(growth).map(([prop, row]) => ({stat: prop, type: typeOf[prop] ?? null,
    name: attributes[prop] ? ctx.loc(attributes[prop].AttributeText) : null, icon: icon(attributes[prop]?.AttributeIcon, 'handbook-stat'), percent: attributes[prop] ? Boolean(attributes[prop].bShowPercent) : null, algorithm: row.AlgorithmicType.split('::').at(-1).replace('EQUIP_ALGORITHMIC_', ''),
    coefficient: row.ModifyCoefficient,
    levels: row.TupoAddABSValueMap.map(({Key, Value}) => ({count: Number(Key),
      bands: Value.TupoAddABSValue.map(b => [round(b.TupoABSRange.LowerBound.Value), round(b.TupoABSRange.UpperBound.Value), b.Weight])})).sort((a, b) => a.count - b.count)}));
  mainGrowth.sort((a, b) => (statOrder.get(a.stat) ?? Infinity) - (statOrder.get(b.stat) ?? Infinity));
  const g = reference.titanGrowth;
  write('titan', {sources: {...sources, ...Object.fromEntries(Object.entries(ctx.sources).filter(([file]) => file.startsWith('Hotta/Content/Localization/Game/'))), 'game-data/build-page.json': ctx.sources['game-data/build-page.json'], 'game-data/build-reference.json': ctx.sources['game-data/build-reference.json']},
    // User-confirmed gameplay limit; raw property curves continue beyond this level.
    rareValueLevelLimit: 18,
    pools, rareValues, triggerRates, mainGrowth, slotNames: ctx.slotNames, slotIcons: ctx.slotIcons,
    slotStats: Object.fromEntries(ctx.buildPage.gear.map(gear => [gear.id, gear.allowedStats])),
    addedStats: {maxAddedStats: g.maxAddedStats, addedStatShare: g.addedStatShare, priorities: g.priorities, fallbacks: g.fallbacks, source: g.corrections}});
}

// Rare property → its UncommonModifyImage (the same icon on every level and pool).
function rareIconMap(uncommon) {
  const icons = {};
  for (const pack of Object.values(uncommon)) for (const entry of pack.UncommonModifyInfoList) icons[entry.ModifyID] ??= icon(entry.UncommonModifyImage, 'handbook-titan-rare');
  return icons;
}

// ---------------------------------------------------------------- enhancement
function enhancement(ctx) {
  const sources = {};
  const {costs, buildPage, items} = ctx;
  const global = {families: Object.fromEntries(Object.entries(costs.equipment.families).map(([id, f]) => [id, {slots: f.slots, slotCount: f.slotCount,
    levels: f.progression.map(p => ({level: p.targetLevel, gold: p.gold, items: p.items, needPlayerLevel: p.needPlayerLevel, needSuppressorLevel: p.needSuppressorLevel || null, cumulative: p.cumulative}))}])),
  allSlotsMaxTotal: costs.equipment.allSlotsMaxTotal, stars: costs.equipment.starAdvancement,
  stats: buildPage.gear.map(g => ({slot: g.id, stages: Object.fromEntries(Object.entries(g.baseStats).map(([stage, levels]) => [stage, levels.map(l => ({level: l.level, stats: l.stats.map(s => ({type: s.label, value: s.value}))}))]))}))};
  const families = Object.values(global.families);
  const normal = families.find(f => f.slotCount > 1);
  const vera = families.filter(f => f.slotCount === 1);
  if (normal && vera.length) {
    assert.ok(vera.every(f => JSON.stringify(f.levels) === JSON.stringify(vera[0].levels)), 'Vera enhancement curves must match');
    const group = (id, entries) => ({id, slotCount: entries.reduce((sum, entry) => sum + entry.count, 0), levels: entries[0].family.levels.map(base => {
      const total = {items: {}, cumulative: {}, gold: 0};
      const steps = entries.map(entry => ({step: entry.family.levels.find(l => l.level === base.level), count: entry.count}));
      assert.ok(steps.every(entry => entry.step), 'Enhancement groups must share level milestones');
      for (const {step, count} of steps) {
        total.gold += step.gold * count;
        for (const field of ['items', 'cumulative']) for (const [item, value] of Object.entries(step[field])) total[field][item] = (total[field][item] || 0) + value * count;
      }
      return {...base, ...total, needPlayerLevel: Math.max(...steps.map(({step}) => step.needPlayerLevel))};
    })});
    const allNormal = {family: normal, count: normal.slotCount};
    const allVera = vera.map(family => ({family, count: family.slotCount}));
    global.costGroups = [group('normal-one', [{family: normal, count: 1}]), group('vera-one', [{family: vera[0], count: 1}]),
      group('normal-all', [allNormal]), group('vera-all', allVera), group('all', [allNormal, ...allVera])];
  }
  const mmoRows = rows(binding('mmo', 'EquipStrengthenDataTable', sources), sources);
  const parse = text => Object.fromEntries((text || '').split(';').filter(Boolean).map(pair => { const [id, n] = pair.split(','); assert.ok(Number.isFinite(+n)); return [id, +n]; }));
  const mmoFamilies = {};
  for (const [row, value] of Object.entries(mmoRows)) {
    const [, family, level] = row.match(/^(.*)_(\d+)$/);
    (mmoFamilies[family] ??= []).push({level: +level, gold: value.NeedGolds, items: parse(value.NeedItems), needPlayerLevel: value.NeedPlayerLevel, needSuppressorLevel: value.NeedShenGeLevel || null});
  }
  for (const levels of Object.values(mmoFamilies)) {
    levels.sort((a, b) => a.level - b.level);
    const total = {};
    for (const l of levels) {
      for (const [id, n] of Object.entries({...l.items, Gold: l.gold})) total[id] = (total[id] || 0) + n;
      l.cumulative = {...total};
    }
  }
  const used = new Set([...Object.values(global.families), ...Object.values(mmoFamilies).map(levels => ({levels}))].flatMap(f => f.levels.flatMap(l => Object.keys(l.items))));
  write('enhancement', {sources: {...sources, 'game-data/build-progression-costs.json': ctx.sources['game-data/build-progression-costs.json'], 'game-data/build-page.json': ctx.sources['game-data/build-page.json']},
    items: items([...used]), slotNames: ctx.slotNames, slotIcons: ctx.slotIcons, ...enhancementStatNames(ctx, sources), modes: {global, mmo: {families: Object.fromEntries(Object.entries(mmoFamilies).map(([id, levels]) => [id, {levels}]))}},
    successRate: {table: 'Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/DT_EquipStrengthenSuccessRate.json', rows: 0, note: 'Bound only by DA_Equipment_MMO; the table has no rows in this export.'}});
}

// Labels of build-gear-base-stats.cjs → localized attribute names.
function enhancementStatNames(ctx, sources) {
  const attributes = rows('Hotta/Content/Resources/CoreBlueprints/DataTable/AttributeStaticDataTable.json', sources);
  const ids = Object.entries({Attack: 'CommonAtkAdded', HP: 'MaxHealthAdded', Crit: 'CritAdded', Resistance: 'ElementDef'});
  return {statNames: Object.fromEntries(ids.map(([label, id]) => [label, ctx.loc(attributes[id].AttributeText)])),
    statIcons: Object.fromEntries(ids.map(([label, id]) => [label, icon(attributes[id].AttributeIcon, 'handbook-stat')]))};
}

// ---------------------------------------------------------------- supercomputer, suppressor, Space Support
function supercomputer(ctx) {
  const s = ctx.costs.supercomputing;
  write('supercomputer', {sources: {'game-data/build-progression-costs.json': ctx.sources['game-data/build-progression-costs.json'], 'game-data/build-page.json': ctx.sources['game-data/build-page.json']},
    items: ctx.items(['StrengthenStone_07']), slotNames: ctx.slotNames, slotIcons: ctx.slotIcons,
    nodes: ctx.buildPage.computing.flatMap(computing => s.nodes.filter(n => n.slot === computing.slot).map(n => {
      const slot = ctx.slots[SLOT(n.slot)]?.id ?? SLOT(n.slot);
      return {slot, icon: computing.icon ?? null, maxLevel: n.maxLevel,
        allowedStats: ctx.buildPage.gear.find(gear => gear.id === slot)?.allowedStats ?? [], effects: computing.effects ?? []};
    })),
    levels: s.progression.map(p => ({level: p.targetLevel, requiredExp: p.requiredExp, cumulativeExp: p.cumulativeExp, itemsPerClick: p.itemsPerClick,
      outcomes: p.outcomes.map(o => ({kind: o.operator, exp: o.exp, chance: round(o.probabilityWhenAllEligible)})),
      segments: p.segments.map(seg => ({fromExp: seg.expFromInclusive, toExp: seg.expToExclusive, chances: seg.chances.map(c => ({kind: c.operator, exp: c.exp, chance: round(c.probability)}))})),
      expectedClicks: round(p.expectedClicksModel, 3), cumulativeExpectedClicks: round(p.cumulativeExpectedClicksModel, 3), maxClicks: p.maxClicksNoBonusModel})),
    model: s.expectedModel});
}

// Refresh the localized presentation inherited from Build without requiring a new raw export.
// The Handbook owns its existing slot, progression and equipment fields; Build owns the
// canonical localized effect rows. Their generated icon is the shared source identity.
function supercomputerFromBuild() {
  const sources = {};
  const buildPage = readGenerated('build-page.json', sources);
  readGenerated('build-progression-costs.json', sources);
  const current = readGenerated('handbook/supercomputer.json', {});
  const previousByIcon = new Map((current.nodes ?? []).map(node => [node.icon, node]));
  const nodes = buildPage.computing.map(computing => {
    const previous = previousByIcon.get(computing.icon);
    assert.ok(previous, `Handbook supercomputer node for Build icon ${computing.icon}`);
    return {...previous, icon: computing.icon ?? null, maxLevel: computing.maxLevel, effects: computing.effects ?? []};
  });
  assert.equal(nodes.length, current.nodes?.length, 'Handbook and Build supercomputer node counts');
  write('supercomputer', {sources: {
    'game-data/build-progression-costs.json': sources['game-data/build-progression-costs.json'],
    'game-data/build-page.json': sources['game-data/build-page.json'],
  }, items: current.items, slotNames: current.slotNames, slotIcons: current.slotIcons,
  nodes, levels: current.levels, model: current.model});
}

function suppressor(ctx) {
  const sources = {};
  const globalRows = rows(binding('global', 'ShenGeTable', sources), sources);
  // Rows without version text (the free base row 01_0) are named from the row key: 01_0 → V1.0.
  const versionOf = (row, text) => /^V/.test(text ?? '') ? text : `V${Number(row.split('_')[0])}.${row.split('_')[1]}`;
  const global = ctx.costs.suppressor.progression.map(p => {
    const stats = ctx.buildPage.suppressors.find(entry => entry.id === p.row)?.stats;
    return {row: p.row, version: versionOf(p.row, p.version), icon: icon(globalRows[p.row]?.SignIcon, 'handbook-suppressor'), items: p.items, cumulative: p.cumulative, needPlayerLevel: p.needPlayerLevel, needScore: p.needScore,
      stats: stats ? Object.entries({atk: 'Attack', hp: 'HP', crit: 'Crit', res: 'Resistance'}).map(([key, type]) => ({type, value: stats[key]})) : []};
  });
  const mmoRows = rows(binding('mmo', 'ShenGeTable', sources), sources);
  // The MMO suppressor row's SuppressorEffect field points to this companion table by row ID.
  // The key join is explicit in the row data, although the effect table itself is not a BP property binding.
  const mmoEffectPath = 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_SuppressorEffect_MMO.json';
  const mmoEffects = rows(mmoEffectPath, sources);
  const total = {};
  const mmo = Object.entries(mmoRows).sort(([a], [b]) => a.localeCompare(b)).map(([row, r]) => {
    const list = r.CostItemArr?.length ? r.CostItemArr : (r.CostItem && r.CostItem !== 'None' ? [{ItemId: r.CostItem, ItemCount: r.ItemCostAmount}] : []);
    const items = Object.fromEntries(list.map(i => [i.ItemId, i.ItemCount]));
    for (const [id, n] of Object.entries(items)) total[id] = (total[id] || 0) + n;
    const effectKey = r.SuppressorEffect && r.SuppressorEffect !== 'None' ? r.SuppressorEffect : null;
    const effectRows = effectKey ? mmoEffects[effectKey]?.SuppressorEffect : [];
    const effects = (Array.isArray(effectRows) ? effectRows : []).map((effect, sourceIndex) => ({
      sourceIndex,
      minLevel: effect.MinLevel,
      maxLevel: effect.MaxLevel,
      attackDamageMulti: effect.AttackDamageMulti,
      beAttackedDamageReduceMulti: effect.BeAttackedDamageReduceMulti,
    })).sort((a, b) => a.minLevel - b.minLevel || a.maxLevel - b.maxLevel);
    return {row, version: r.SuppressorVersion?.LocalizedString ?? row, icon: icon(r.SignIcon, 'handbook-suppressor'), items, cumulative: {...total}, needPlayerLevel: r.NeedPlayerLevel, needScore: r.NeedScore,
      effectKey, effects};
  });
  const effectReferences = mmo.filter(level => level.effectKey);
  assert.ok(effectReferences.length > 0, 'MMO suppressor effect references are present');
  assert.ok(effectReferences.every(level => level.effects.length > 0), 'MMO suppressor effect rows resolve');
  const ids = [...new Set([...global, ...mmo].flatMap(p => Object.keys(p.items)))];
  const statPresentation = enhancementStatNames(ctx, sources);
  write('suppressor', {sources: {...sources, 'game-data/build-progression-costs.json': ctx.sources['game-data/build-progression-costs.json'], 'game-data/build-page.json': ctx.sources['game-data/build-page.json']}, ...statPresentation,
    items: ctx.items(ids), modes: {global: {levels: global, total: ctx.costs.suppressor.total}, mmo: {levels: mmo, total}}});
}

function spaceSupport(ctx) {
  const sources = {};
  const support = readGenerated('space-support.json', sources);
  const costs = Object.fromEntries(ctx.costs.spaceSupport.modules.map(m => [m.id, m]));
  write('space-support', {sources: {...sources, 'game-data/build-progression-costs.json': ctx.sources['game-data/build-progression-costs.json']},
    item: ctx.items([ctx.costs.spaceSupport.upgradeItemId]),
    systemLevels: Object.entries(ctx.costs.spaceSupport.systemLevels).map(([level, s]) => ({level: +level, name: ctx.loc(s.LevelText), icon: support.systemLevels?.find(entry => Number(entry.id) === Number(level))?.icon ?? null, maxModuleLevel: s.MaxModuleLevel, needAllModuleLevel: s.NeedAllModuleLevel, resetCooldownDays: s.RollBackCD})),
    modules: support.modules.map(m => {
      const cost = costs[m.id];
      assert.ok(cost, `Space Support cost ${m.id}`);
      return {id: m.id, name: {en: m.name_en, ru: m.name_ru}, icon: m.icon ?? null, base: m.base, maxLevel: m.maxLevel,
        levels: m.levels.filter(l => l.level > 0).map(l => {
          const step = cost.progression.find(p => p.targetLevel === l.level);
          assert.ok(step, `Space Support ${m.id} ${l.level}`);
          return {level: l.level, cost: step.amount, cumulative: step.cumulative, effect: ctx.loc(l.Description) ?? {en: null, ru: null}, attribute: l.AttributeID === 'None' ? null : l.AttributeID, value: l.AttributeValue};
        })};
    }),
    totalAllModules: ctx.costs.spaceSupport.totalAllModules});
}

// ---------------------------------------------------------------- CS and combat formulas
function systemsCs(ctx, systemCs, csRules, research) {
  assert.ok(systemCs?.computing && systemCs.support && systemCs.suppressor, 'build-page.json systemCs systems');
  const labels = Object.fromEntries(Object.entries(csRules.attributes).map(([label, raw]) => [raw, label]));
  const score = pairs => pairs.reduce((sum, [attribute, value]) => {
    const own = labels[attribute], label = own ?? systemCs.derivedWeights?.[attribute], base = label && csRules.bases[label];
    if (!label || csRules.weights[label] === undefined || (base && base !== 'fixedPercent') || !(value > 0)) return sum;
    return {cs: sum.cs + value * csRules.weights[label], estimate: sum.estimate || !own};
  }, {cs: 0, estimate: false});
  const round = value => Number(value.toFixed(6));
  return {
    supercomputer: Object.entries(systemCs.computing).map(([slot, levels]) => ({slot: ctx.slots[SLOT(slot)]?.id ?? SLOT(slot), levels: levels.flatMap((pairs, level) => level ? [{level, cs: round(score(pairs).cs)}] : [])})),
    spaceSupport: research.support.map(m => ({id: m.row, levels: (systemCs.support[m.row] ?? []).flatMap((pairs, level) => {
      const result = score(pairs);
      return level ? [{level, cs: round(result.cs), estimate: result.estimate}] : [];
    })})),
    suppressor: research.suppressor.map(s => ({row: s.row, cs: round(score(systemCs.suppressor[s.row] ?? []).cs)})),
  };
}

function cs(ctx) {
  const sources = {};
  const research = readGenerated('build-cs-research.json', sources);
  const support = readGenerated('space-support.json', sources);
  const rareNames = Object.fromEntries(ctx.reference.titanRare.items.map(i => [i.id, {en: i.nameEn, ru: i.nameRu}]));
  const {csRules} = ctx;
  const attributes = rows('Hotta/Content/Resources/CoreBlueprints/DataTable/AttributeStaticDataTable.json', sources);
  const statOrder = new Map(Object.keys(rows(binding('global', 'RandomPropDataTable', sources), sources)).map((id, index) => [id, index]));
  const rareIcons = rareIconMap(rows(binding('global', 'EquipUncommonModifyData', sources), sources));
  write('cs', {sources: {...sources, 'game-data/build-page.json': ctx.sources['game-data/build-page.json'], 'game-data/build-reference.json': ctx.sources['game-data/build-reference.json']},
    attributes: Object.entries(csRules.attributes).filter(([, prop]) => statOrder.has(prop)).map(([type, prop]) => ({type, stat: prop, weight: csRules.weights[type], base: csRules.bases[type] ?? null,
      name: research.rawAttributes[prop] ? ctx.loc({TableId: 'QRSLCommon_ST', Key: prop}) : null, icon: icon(attributes[prop]?.AttributeIcon, 'handbook-stat')})).sort((a, b) => (statOrder.get(a.stat) ?? Infinity) - (statOrder.get(b.stat) ?? Infinity)),
    titanRare: Object.entries(csRules.titan).map(([id, t]) => ({id, weight: t.weight, name: rareNames[id] ?? null, icon: rareIcons[id] ?? null,
      values: ctx.reference.titanRare.items.find(item => item.id === id)?.displayCurve ?? []})),
    slotNames: ctx.slotNames, slotIcons: ctx.slotIcons, spaceSupportIcons: Object.fromEntries(support.modules.map(m => [m.id, m.icon ?? null])), spaceSupportNames: Object.fromEntries(support.modules.map(m => [m.id, {en: m.name_en, ru: m.name_ru}])),
    rounding: csRules.rounding, scope: csRules.scope,
    // Same model as Tools Build (apps/web/src/features/build/system-cs.ts):
    // flat attribute × weight + fixed-base DMG% × weight; pool-dependent ATK% / RES% are not scored.
    // Content modules borrow the DMG% weight through systemCs.derivedWeights (model hypothesis → estimate).
    systems: systemsCs(ctx, ctx.buildPage.systemCs, csRules, research),
    limitations: research.limitations});
}

function combatFormulas(ctx) {
  const {reference} = ctx;
  write('combat-formulas', {sources: {'game-data/build-reference.json': ctx.sources['game-data/build-reference.json']},
    crit: reference.critFormula, resistance: reference.resistanceFormula});
}

function biochemicalActivityDates(activity) {
  const date = value => value ? {
    year: value.Year, month: value.Month, day: value.Day,
    hour: value.Hour, minute: value.Minute, second: value.Second,
  } : null;
  const starts = new Map((activity.StartDateTime_Region ?? []).map(entry => [entry.Key, entry.Value]));
  const ends = new Map((activity.EndDateTime_Region ?? []).map(entry => [entry.Key, entry.Value]));
  return {
    start: date(activity.StartDateTime), end: date(activity.EndDateTime),
    regionalPeriods: [...new Set([...starts.keys(), ...ends.keys()])].sort().map(region => ({
      region, start: date(starts.get(region)), end: date(ends.get(region)),
    })),
  };
}

/** Refresh date metadata independently of combat extraction from a matching saved snapshot. */
function biochemicalScheduleOnly() {
  const sources = {};
  const assetPath = 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OptionalBossDataAsset_MMO.json';
  const asset = readRaw(assetPath, sources).find(object => object.Name === 'OptionalBossDataAsset_MMO');
  assert.ok(asset?.Properties?.ActivityConfigDataTable_BalanceServer, 'MMO biochemical activity binding');
  const activityRows = rows(assetFile(asset.Properties.ActivityConfigDataTable_BalanceServer), sources);
  const data = JSON.parse(readGameSourceFileSync(path.join(outDir, 'biochemical-collapse.json'), 'utf8'));
  const missingActivities = [];
  const seasons = data.seasons.map(season => {
    const activity = activityRows[season.id];
    if (!activity) {missingActivities.push(season.id); return season;}
    assert.deepEqual(activity.OpenLevels.filter(id => !season.unresolvedLevelIds?.includes(id)), season.levels.map(level => level.id), `${season.id}: calendar snapshot level IDs`);
    // This calendar export may be newer than the saved combat export. Preserve its
    // original base dates, values and hashes; only attach exact regional overrides.
    return {...season, regionalPeriods: biochemicalActivityDates(activity).regionalPeriods};
  });
  write('biochemical-collapse', {...data, calendarSources: sources, calendarCoverage: {missingActivities}, seasons});
}

// MMO Biochemical Collapse: the MMO data asset explicitly selects the BalanceServer tables.
// Keep dates/values as stored; the final in-combat scaling and activity timezone are not established.
function biochemicalCollapse(ctx) {
  const {sources, loc} = ctx;
  const assetPath = 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OptionalBossDataAsset_MMO.json';
  const asset = readRaw(assetPath, sources).find(object => object.Name === 'OptionalBossDataAsset_MMO');
  assert.ok(asset?.Properties, 'OptionalBossDataAsset_MMO properties');
  const activityFile = assetFile(asset.Properties.ActivityConfigDataTable_BalanceServer);
  const levelFile = assetFile(asset.Properties.LevelConfigDataTable_BalanceServer);
  const entryFile = assetFile(asset.Properties.EntryConfigDataTable_BalanceServer);
  const monsterFile = binding('mmo', 'MonsterDataTable', sources);
  const activityRows = rows(activityFile, sources);
  const levelRows = rows(levelFile, sources);
  const entryRows = rows(entryFile, sources);
  const monsterRows = rows(monsterFile, sources);
  // Below 1000, EntryDescriptionMap repeats a text under consecutive keys (4/5, 9/10, 12/13) and the
  // entry rows' DescID counts distinct texts in key order; every row whose own `<id>_des` text is in
  // the map agrees with this ordinal. Keys from 1000 are unique and used directly.
  const descriptionEntries = [...(asset.Properties.EntryDescriptionMap ?? [])].sort((a, b) => a.Key - b.Key);
  const distinctTexts = descriptionEntries.filter((entry, index, all) => entry.Key < 1000
    && all.findIndex(other => other.Key < 1000 && other.Value?.Key === entry.Value?.Key && other.Value?.TableId === entry.Value?.TableId) === index);
  const descriptions = new Map([
    ...distinctTexts.map((entry, index) => [String(index + 1), entry.Value]),
    ...descriptionEntries.filter(entry => entry.Key >= 1000).map(entry => [String(entry.Key), entry.Value]),
  ]);
  const formatDescription = (text, args) => {
    if (!text) return {en: null, ru: null};
    return Object.fromEntries(['en', 'ru'].map(locale => [locale, text[locale]?.replace(/\{(\d+)\}/g, (match, index) =>
      args[index] === undefined ? match : String(args[index])) ?? null]));
  };
  const dateKey = value => value
    ? `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}T${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}:${String(value.second).padStart(2, '0')}`
    : '';
  const grades = value => loc(value, 'mmo');
  const resistanceFields = {
    physical: 'PhyDefBase', flame: 'FireDefBase', volt: 'ThunderDefBase',
    frost: 'IceDefBase', altered: 'SuperpowerDefBase',
  };
  const biochemicalBuff = id => {
    const entry = entryRows[id];
    if (!entry) return {id, name: null, description: {en: null, ru: null}, descriptionId: null, descriptionArgs: [],
      icon: null, isDisadvantage: null, targetsSelf: null, score: null, assessment: null, classPath: null};
    const description = descriptions.get(String(entry.DescID));
    return {
      id,
      name: loc(entry.BuffName, 'mmo'),
      description: formatDescription(loc(description, 'mmo'), entry.DescArgsArray ?? []),
      descriptionId: entry.DescID ?? null,
      descriptionArgs: entry.DescArgsArray ?? [],
      icon: icon(entry.EntryIcon, 'MMO Biochemical Collapse buff icon'),
      isDisadvantage: typeof entry.bDebuff === 'boolean' ? entry.bDebuff : null,
      targetsSelf: typeof entry.bTargetIsSelf === 'boolean' ? entry.bTargetIsSelf : null,
      score: entry.Score ?? null,
      assessment: entry.AssessStr ?? null,
      classPath: entry.BuffClass?.AssetPathName ?? null,
    };
  };
  const level = (id, levelRow) => ({
    id,
    name: loc(levelRow.LevelName, 'mmo'),
    featuredName: loc(levelRow.SlotName, 'mmo') ?? loc(levelRow.BossName, 'mmo'),
    bossName: loc(levelRow.BossName, 'mmo'),
    slotIcon: icon(levelRow.SlotIcon, 'MMO Biochemical Collapse pod icon'),
    bossIcon: icon(levelRow.BossIcon, 'MMO Biochemical Collapse boss icon'),
    enemyGrades: grades(levelRow.MonsterAttribute),
    waves: (levelRow.PoolMonstersByWave ?? []).map((wave, waveIndex) => ({
      index: waveIndex + 1,
      enemies: (wave.PoolMonsters ?? []).map(monster => {
        const stats = monsterRows[monster.AttributeID];
        const localizedName = loc(monster.MonsterName, 'mmo');
        const sourceName = monster.MonsterName?.SourceString;
        return {
          name: localizedName ?? (sourceName ? {en: sourceName, ru: sourceName} : null),
          level: monster.MonsterLevel ?? null,
          type: monster.MonsterType ?? null,
          count: monster.MonsterCount ?? null,
          attributeId: monster.AttributeID ?? null,
          buffIds: monster.MonsterBuffID ?? [],
          stats: stats ? {
            maxHealth: stats.MaxHealth ?? null,
            attack: stats.CommonAtkBase ?? null,
            resistances: Object.fromEntries(Object.entries(resistanceFields).map(([key, field]) => [key, stats[field] ?? null])),
            armor: stats.ArmorBase ?? null,
            critDefense: stats.FinalCritDef ?? null,
            modifyMaxHpOffsetLevel: stats.ModifyMaxHpOffsetLevel ?? null,
            modifyAttackOffsetLevel: stats.ModifyAttackOffsetLevel ?? null,
          } : null,
        };
      }),
    })),
    buffs: (levelRow.MonsterEntryArray ?? []).map(biochemicalBuff),
    timeLimitSeconds: levelRow.LimitChallengeTime ?? null,
    baseScore: levelRow.BaseScore ?? null,
    bonusObjectives: (levelRow.ExtraConditionList ?? []).map(condition => ({
      description: loc(condition.Desc, 'mmo'),
      type: condition.Type ?? null,
      target: condition.TargetValue ?? null,
      score: condition.Score ?? null,
      hiddenProgress: condition.bHiddenProgress ?? null,
    })),
  });
  const seasons = Object.entries(activityRows).map(([id, activity]) => {
    const rawName = activity.ActivitySeasonName?.SourceString ?? '';
    const localizedName = loc(activity.ActivitySeasonName, 'mmo');
    const seasonNumber = Number(/第\s*(\d+)\s*赛季/.exec(rawName)?.[1] ?? /Season\s*(\d+)/i.exec(localizedName?.en ?? '')?.[1]);
    return {
      id,
      seasonNumber: Number.isFinite(seasonNumber) ? seasonNumber : null,
      name: localizedName,
      ...biochemicalActivityDates(activity),
      weaponLimit: activity.WeaponLimitAmount ?? null,
      joinsGroupRank: activity.JoinGroupRank ?? null,
      // A client can schedule a season before shipping its level rows; keep the IDs instead of inventing pods.
      levels: (activity.OpenLevels ?? []).filter(levelId => levelRows[levelId]).map(levelId => level(levelId, levelRows[levelId])),
      unresolvedLevelIds: (activity.OpenLevels ?? []).filter(levelId => !levelRows[levelId]),
      awardTiers: (activity.AwardConfigs ?? []).map(award => ({targetScore: award.TargetScore ?? null, dropId: award.DropID ?? null})),
    };
  }).sort((a, b) => dateKey(a.start).localeCompare(dateKey(b.start)) || a.id.localeCompare(b.id));
  const buffCatalog = Object.keys(entryRows).sort().map(biochemicalBuff);
  const sourcePaths = new Set([assetPath, activityFile, levelFile, entryFile, monsterFile,
    'Hotta/Content/Localization/Game/en/Game.json', 'Hotta/Content/Localization/Game/ru/Game.json']);
  write('biochemical-collapse', {sources: Object.fromEntries([...sourcePaths].filter(file => sources[file]).map(file => [file, sources[file]])), seasons, buffCatalog});
}

// MMO Bygone uses the BigSecret family bound by BP_GameData_MMO_Base, independently
// from the Overseas/global Bygone output. Raw bases remain separate from calculated HP.
// Follow exported Blueprint inheritance, never infer a parent by trimming a variant name.
function enemyClassChain(classPath, sources) {
  return traceEnemyClass(rawRoot, classPath, file => fs.existsSync(path.join(rawRoot, file)) ? readRaw(file, sources) : null);
}

// Both a full raw export and a saved projection use this same calculation. Never read
// another export's curves/stats to refresh a saved encounter snapshot.
function mmoBygoneHp(data) {
  const hpBindings = (data.roundBuffers ?? []).map(group =>
    group.buffs?.filter(buff => buff.curve === 'HpBuffCount') ?? []);
  const signatures = new Set(hpBindings.flatMap(buffs => buffs.map(buff =>
    JSON.stringify([buff.curve, buff.curveTable ?? null, buff.abilityClass, buff.count, buff.useSceneLevel]))));
  const hpBinding = hpBindings[0]?.[0];
  const supported = hpBindings.length > 0 && hpBindings.every(buffs => buffs.length === 1)
    && signatures.size === 1 && hpBinding?.count === 1 && hpBinding.useSceneLevel === false
    && data.curves?.[hpBinding.curve]?.interpolation === 'RCIM_Linear'
    && hpBinding.abilityClass?.endsWith('/Buff_BigSecret_AddHp001.Buff_BigSecret_AddHp001_C');
  const defenseBindings = (data.roundBuffers ?? []).map(group => group.buffs?.filter(buff => buff.curve === 'DefBuffCount') ?? []);
  const defenseBinding = defenseBindings[0]?.[0];
  const defenseSignatures = new Set(defenseBindings.flatMap(buffs => buffs.map(buff =>
    JSON.stringify([buff.curve, buff.curveTable ?? null, buff.abilityClass, buff.count, buff.useSceneLevel]))));
  const defenseSupported = defenseBindings.length > 0 && defenseBindings.every(buffs => buffs.length === 1)
    && defenseSignatures.size === 1 && defenseBinding?.count === 1 && defenseBinding.useSceneLevel === false
    && data.curves?.DefBuffCount?.interpolation === 'RCIM_Linear'
    && defenseBinding.abilityClass?.endsWith('/Buff_BigSecret_AddCommonDef_Balance.Buff_BigSecret_AddCommonDef_Balance_C');
  return {...data, hpModel: 'base-plus-whole-hp-stacks', rounds: data.rounds.map(season => ({
    ...season, rounds: season.rounds.map(round => {
      const hpScaling = supported ? getMmoBygoneHpScaling(round.curveValues?.[hpBinding.curve]) : null;
      return {...round, hpScaling, pool: round.pool ? {...round.pool, monsters: round.pool.monsters.map(enemy => ({
        ...enemy, hp: enemy.classPath ? getMmoBygoneHp(enemy.stats?.maxHealth, hpScaling) : null,
        defenseEstimate: enemy.classPath && defenseSupported ? estimateMmoBygoneDefense(enemy.stats, round.curveValues?.DefBuffCount) : null,
      }))} : null};
    }),
  }))};
}

function mmoBygone(ctx) {
  const {sources, loc} = ctx;
  const baseAssetPath = 'Hotta/Content/Resources/CoreBlueprints/GameMode/MMO/BP_GameData_MMO_Base.json';
  const baseAsset = readRaw(baseAssetPath, sources).find(object => object.Name === 'Default__BP_GameData_MMO_Base_C');
  assert.ok(baseAsset?.Properties, 'BP_GameData_MMO_Base bindings');
  const bindings = baseAsset.Properties;
  const seasonFile = assetFile(bindings.BigSecretSeasonRoundDataTable);
  const poolFile = assetFile(bindings.BigSecretMonsterPoolDataTable);
  const baseFile = assetFile(bindings.BigSecretBaseDataTable);
  const rewardFile = assetFile(bindings.BigSecretRoundPassRewardDataTable);
  const bufferFile = assetFile(bindings.BigSecretServerMonsterRoundBufferDataTable);
  const dataAssetPath = 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/BigSecret/BigSecretDataAsset_MMO.json';
  const dataAsset = readRaw(dataAssetPath, sources).find(object => object.Name === 'BigSecretDataAsset_MMO');
  assert.ok(dataAsset?.Properties, 'BigSecretDataAsset_MMO round table bindings');
  const roundFile = assetFile(dataAsset.Properties.BigSecretBalanceRoundDataTable);
  const commonFile = assetFile(dataAsset.Properties.BigSecretCommonRoundDataTable);
  const monsterFile = binding('mmo', 'MonsterDataTable', sources);
  const seasonRows = rows(seasonFile, sources);
  const poolRows = rows(poolFile, sources);
  const baseRows = rows(baseFile, sources);
  const rewardRows = rows(rewardFile, sources);
  const bufferRows = rows(bufferFile, sources);
  const roundRows = rows(roundFile, sources);
  const commonRows = rows(commonFile, sources);
  const monsterRows = rows(monsterFile, sources);
  const curveFile = assetFile(bufferRows.NewRow?.MonsterLevelValue?.CurveTable);
  assert.ok(curveFile, 'MMO BigSecret level curve binding');
  const curveRows = rows(curveFile, sources);
  // HP may be bound to another CurveTable. Resolve that reference, not a same-name
  // row in the level table; distinct server-group bindings remain unavailable.
  const hpCurveTables = new Map();
  const hpCurves = Object.values(bufferRows).flatMap(group => (group.RoundBuffs ?? [])
    .filter(buff => buff.Value?.BuffRoudValue?.RowName === 'HpBuffCount')
    .map(buff => {
      const reference = buff.Value.BuffRoudValue;
      if (!reference.CurveTable) return null;
      const file = assetFile(reference.CurveTable);
      if (!hpCurveTables.has(file)) hpCurveTables.set(file, rows(file, sources));
      return {file, row: reference.RowName};
    }));
  const hpCurve = hpCurves.length && hpCurves.every(reference => reference
    && reference.file === hpCurves[0]?.file && reference.row === hpCurves[0]?.row)
    ? hpCurveTables.get(hpCurves[0].file)?.[hpCurves[0].row] : null;

  const curveValueAt = (curve, time) => {
    if (!curve?.Keys?.length || curve.InterpMode !== 'RCIM_Linear') return null;
    const keys = curve.Keys;
    if (time <= keys[0].Time) return keys[0].Value;
    if (time >= keys.at(-1).Time) return keys.at(-1).Value;
    for (let index = 0; index < keys.length - 1; index++) {
      const left = keys[index], right = keys[index + 1];
      if (time === left.Time) return left.Value;
      if (time > left.Time && time < right.Time) {
        const alpha = (time - left.Time) / (right.Time - left.Time);
        return left.Value + alpha * (right.Value - left.Value);
      }
    }
    return null;
  };
  const numberValue = value => value == null || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const range = value => ({min: numberValue(value?.LowerBound?.Value), max: numberValue(value?.UpperBound?.Value),
    minInclusive: value?.LowerBound?.Type === 'ERangeBoundTypes::Inclusive',
    maxInclusive: value?.UpperBound?.Type === 'ERangeBoundTypes::Inclusive'});
  const statFields = {
    maxHealth: 'MaxHealth', attack: 'CommonAtkBase', physical: 'PhyDefBase', flame: 'FireDefBase',
    volt: 'ThunderDefBase', frost: 'IceDefBase', altered: 'SuperpowerDefBase', armor: 'ArmorBase',
    crit: 'Crit', critDefense: 'CritDef', critDamage: 'CritDam', finalCritDefense: 'FinalCritDef',
  };
  const classCache = new Map();
  const classSourcePaths = new Set();
  function classInfo(reference) {
    const rawRef = reference?.AssetPathName;
    if (!rawRef || rawRef === 'None') return null;
    if (classCache.has(rawRef)) return classCache.get(rawRef);
    const file = assetFile({AssetPathName: rawRef});
    const objects = readRaw(file, sources);
    const chain = enemyClassChain(rawRef, sources);
    for (const ancestor of chain) classSourcePaths.add(ancestor.file);
    const generatedClass = objects.find(object => object.Type === 'BlueprintGeneratedClass');
    const attributeId = chain.find(ancestor => ancestor.properties.AttributeID)?.properties.AttributeID ?? null;
    const static = attributeId ? monsterRows[attributeId] : null;
    const parentPath = generatedClass?.Super?.ObjectPath ?? generatedClass?.SuperStruct?.ObjectPath ?? '';
    const localizedNameKey = path.posix.basename(parentPath).split('.')[0].replace(/_C$/, '').toLowerCase() || null;
    const result = {
      classPath: rawRef,
      attributeId,
      localizedNameKey,
      name: localizedNameKey ? loc({Namespace: 'ST_actorname', Key: localizedNameKey}, 'mmo', true) : null,
      stats: static ? Object.fromEntries(Object.entries(statFields).map(([key, field]) => [key, numberValue(static[field])])) : null,
      source: {classFile: file, attributeTable: monsterFile, attributeRow: attributeId},
    };
    classCache.set(rawRef, result);
    return result;
  }
  const groupFiles = (bindings.DropGroupDataTables ?? []).map(entry => ({id: entry.Key, file: assetFile(entry.Value)}));
  const sequenceFiles = (bindings.DropSequenceDataTables ?? []).map(entry => ({id: entry.Key, file: assetFile(entry.Value)}));
  const groupsByAward = new Map();
  for (const table of groupFiles) {
    for (const [id, row] of Object.entries(rows(table.file, sources))) {
      const awardId = id.replace(/_\d+$/, '');
      if (!awardId.startsWith('drop_bigsecret_f')) continue;
      if (!groupsByAward.has(awardId)) groupsByAward.set(awardId, []);
      groupsByAward.get(awardId).push({table: table.id, rowId: id, sequenceId: row.SequenceID ?? null,
        sequence: null, serverLevelRange: range({LowerBound: {Value: row.MinLevel, Type: 'ERangeBoundTypes::Inclusive'}, UpperBound: {Value: row.MaxLevel, Type: 'ERangeBoundTypes::Inclusive'}}),
        sequenceWeight: numberValue(row.SequenceWeight), modifyCount: numberValue(row.ModifyCount), modifyNum: numberValue(row.ModifyNum)});
    }
  }
  const sequenceRows = new Map();
  for (const table of sequenceFiles) {
    for (const [id, row] of Object.entries(rows(table.file, sources))) {
      const sequenceId = id.replace(/_\d+$/, '');
      if (!sequenceRows.has(sequenceId)) sequenceRows.set(sequenceId, []);
      sequenceRows.get(sequenceId).push({table: table.id, rowId: id, row});
    }
  }
  for (const entries of groupsByAward.values()) {
    for (const entry of entries) {
      const match = sequenceRows.get(entry.sequenceId);
      if (match) entry.sequence = match.map(({table, rowId, row}) => ({table, rowId,
        itemId: row.ItemID ?? null, sequenceNumberType: row.SequenceNumType ?? null,
        count: numberValue(row.Num), minCount: numberValue(row.MinNum), maxCount: numberValue(row.MaxNum)}));
    }
  }

  const rounds = Object.entries(seasonRows).map(([seasonId, season]) => ({
    id: seasonId,
    start: season.SeasonBeginTime ?? null,
    end: season.SeasonEndTime ?? null,
    balanceMaxRound: numberValue(season.BalanceMaxRound),
    rounds: (season.OneSeasonRounds ?? []).map(round => {
      const index = numberValue(round.RoundIndex);
      const roundId = `Round_${index}`;
      const roundConfig = roundRows[roundId] ?? null;
      const common = commonRows[roundId] ?? null;
      const poolMatches = Object.entries(poolRows).filter(([, pool]) => {
        const bounds = range(pool.RoundRange);
        return index != null && bounds.min != null && bounds.max != null && index >= bounds.min && index <= bounds.max;
      });
      const pool = poolMatches.length === 1 ? poolMatches[0][1] : null;
      return {
        index,
        isBossRound: Boolean(round.IsBossRound),
        isSaveRound: Boolean(round.IsSaveRound),
        subSceneType: numberValue(round.SubSceneType),
        subLevelIds: round.SubLevelIDs ?? [],
        monsterLevelCurveValue: index == null ? null : curveValueAt(curveRows.MonsterLevel, index),
        curveValues: {...Object.fromEntries(Object.keys(curveRows).map(curveId => [curveId,
          index == null ? null : curveValueAt(curveRows[curveId], index)])),
          HpBuffCount: index == null ? null : curveValueAt(hpCurve, index)},
        configuredRound: roundConfig ? {
          time: numberValue(roundConfig.RoundTime),
          playerBuffs: roundConfig.PlayerBuffArrays ?? [],
          monsterBuffs: roundConfig.MonsterBuffArrays ?? [],
          playerDefaultBuffs: roundConfig.PlayerBuffArraysDefault ?? [],
          monsterDefaultBuffs: roundConfig.MonsterBuffArraysDefault ?? [],
          recommendedWeapons: loc(roundConfig.RecommendWeapons, 'mmo'),
          monsterFeatures: roundConfig.MonsterFeature ?? [],
        } : null,
        common: common ? {
          serverMode: common.ServerModeType ?? null,
          recommendedCombatScore: numberValue(common.RecommendGS),
          aiCombatIntensity: numberValue(common.AICombatIntensity),
          aiCombatIntensityGroup: common.AICombatIntensityGroupName ?? null,
          checkCombatScore: numberValue(common.CheckGs),
          checkWeaponStars: numberValue(common.CheckWeaponStars),
          checkMatrixStars: numberValue(common.CheckMatrixStars),
        } : null,
        pool: pool ? {
          id: pool.PoolID ?? null,
          rawMonsterLevel: numberValue(pool.MonsterLevel),
          type: pool.MonsterPoolType ?? null,
          descriptionTitle: loc(pool.MonsteDescTitle, 'mmo'),
          description: loc(pool.MonsteDesc, 'mmo'),
          effectiveStart: pool.TakeEffectTime ?? null,
          effectiveEnd: pool.LoseEffectTime ?? null,
          monsters: (pool.RoundMonsters ?? []).map(monster => {
            const classData = classInfo(monster.MonsterClass);
            return {
              type: monster.MonsterType ?? null,
              count: numberValue(monster.MonsterCount),
              classPath: classData?.classPath ?? null,
              name: classData?.name ?? null,
              localizedNameKey: classData?.localizedNameKey ?? null,
              attributeId: classData?.attributeId ?? null,
              stats: classData?.stats ?? null,
              source: classData?.source ?? null,
            };
          }),
        } : null,
        poolMatchCount: poolMatches.length,
      };
    }),
  }));

  const rewards = Object.entries(rewardRows).map(([id, row]) => {
    const awardId = row.RankAwardId ?? null;
    return {id, round: numberValue(row.RoundIndex), serverLevelRange: range(row.ServerLevelRange),
      awardId, rewardBegin: row.RewardBeginTime ?? null, rewardEnd: row.RewardEndTime ?? null,
      groups: awardId ? groupsByAward.get(awardId) ?? [] : []};
  }).sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const roundBuffers = Object.entries(bufferRows).map(([id, row]) => ({
    id,
    groupType: row.BigSecretGroupType ?? null,
    serverLevelRange: range(row.ServerLevelRange),
    monsterLevelCurve: row.MonsterLevelValue?.RowName ?? null,
    buffs: (row.RoundBuffs ?? []).map(buff => ({
      key: buff.Key ?? null,
      curve: buff.Value?.BuffRoudValue?.RowName ?? null,
      curveTable: buff.Value?.BuffRoudValue?.CurveTable ? assetFile(buff.Value.BuffRoudValue.CurveTable) : null,
      abilityClass: buff.Value?.BuffID?.AssetPathName ?? null,
      useSceneLevel: buff.Value?.bBuffLevelUseSceneLevel ?? null,
      count: numberValue(buff.Value?.BuffCount),
    })),
  }));
  const curves = Object.fromEntries(Object.entries({...curveRows, HpBuffCount: hpCurve}).map(([id, curve]) => [id, {
    interpolation: curve?.InterpMode ?? null,
    defaultValue: numberValue(curve?.DefaultValue),
    keys: (curve?.Keys ?? []).map(key => ({time: numberValue(key.Time), value: numberValue(key.Value)})),
  }]));
  const base = baseRows['1'] ?? null;
  const sourcePaths = new Set([baseAssetPath, dataAssetPath, seasonFile, poolFile, baseFile, rewardFile, bufferFile,
    roundFile, commonFile, monsterFile, curveFile, ...hpCurveTables.keys(), ...classSourcePaths,
    ...LOCALES.map(locale => `Hotta/Content/Localization/Game/${locale}/Game.json`),
    ...groupFiles.map(table => table.file), ...sequenceFiles.map(table => table.file)]);
  write('mmo-bygone', mmoBygoneHp({
    sources: Object.fromEntries([...sourcePaths].filter(file => sources[file]).map(file => [file, sources[file]])),
    config: base ? {playerLevelLimit: numberValue(base.PlayerLevelLimit), revives: numberValue(base.ReliveCount),
      roundLimitSeconds: numberValue(base.RoundLimitSeconds), maxRoundCount: numberValue(base.MaxRoundCount),
      bossRound: numberValue(base.BossRound), jumpRound: numberValue(base.JumpRound)} : null,
    rounds: rounds.map(season => ({...season, configuredRoundCount: season.rounds.length})),
    rewards,
    roundBuffers,
    curves,
  }));
}

// Presentation-only projection: exact class references from the generated MMO lineup
// join existing OoW mappings and OptionalBoss primary-enemy image references.
function mmoBygoneMedia() {
  const sources = {};
  const data = readGenerated('handbook/mmo-bygone.json', sources);
  const mappingFile = 'scripts/game-processors/processors/monster-image-mapping.json';
  const mappingBytes = readGameSourceFileSync(path.join(sourceRoot, mappingFile));
  sources[mappingFile] = {sha256: crypto.createHash('sha256').update(mappingBytes).digest('hex')};
  const mapping = JSON.parse(mappingBytes);
  const foldedMappings = new Map();
  for (const [key, record] of Object.entries(mapping)) {
    if (record.resolutionStatus !== 'confirmed') continue;
    const lower = key.toLowerCase(), previous = foldedMappings.get(lower);
    const images = entry => JSON.stringify([entry.lineupPortrait ?? entry.image, entry.detailImage ?? entry.image]);
    foldedMappings.set(lower, previous === null || (previous && images(mapping[previous]) !== images(record)) ? null : key);
  }
  const levelFile = 'Hotta/Content/Resources/CoreBlueprints/DataTable/OptionalBoss/DT_OptionalBossLevelConfig_BalanceServer.json';
  const levels = fs.existsSync(path.join(rawRoot, levelFile)) ? rows(levelFile, sources) : {};
  const primary = new Map();
  const primaryByActor = new Map();
  const configuredNames = new Map();
  const oow = new Map();
  const localizationFiles = LOCALES.map(locale => `Hotta/Content/Localization/Game/${locale}/Game.json`);
  const loc = localizationFiles.every(file => fs.existsSync(path.join(rawRoot, file))) ? localizer(sources) : () => null;
  // Reuse canonical OOW identity only for the identical full class path. Combat
  // values and OOW floor buffs are deliberately absent from this projection.
  const oowDirectory = path.join(gameData, 'en/oow/seasons');
  if (fs.existsSync(oowDirectory)) for (const file of fs.readdirSync(oowDirectory).filter(file => /^mmo_s\d+\.json$/.test(file)).sort()) {
    const season = readGenerated('en/oow/seasons/' + file, sources);
    for (const floor of season.floors ?? []) for (const enemy of floor.enemies ?? []) {
      if (!enemy.monsterClass || oow.has(enemy.monsterClass.toLowerCase())) continue;
      oow.set(enemy.monsterClass.toLowerCase(), {enemy, source: {file: 'game-data/en/oow/seasons/' + file, floor: floor.floor, key: enemy.key, field: 'monsterClass'}});
    }
  }
  const actorImages = new Map();
  const published = url => {
    if (!url || typeof url !== 'string' || url.includes('placeholder')) return null;
    const candidates = [url];
    const legacyPrefix = '/datamine/shared/media/';
    if (url.startsWith(legacyPrefix)) candidates.push('/game-assets/webp/' + url.slice(legacyPrefix.length));
    for (const candidate of candidates) {
      if (!candidate.startsWith('/game-assets/webp/Hotta/Content/')) continue;
      const relative = candidate.slice('/game-assets/webp/'.length).replace(/\.webp$/, '.png');
      if (fs.existsSync(path.join(rawRoot, relative))) {
        return icon('/Game/' + relative.slice('Hotta/Content/'.length).replace(/\.png$/, ''), 'MMO Bygone enemy portrait');
      }
    }
    return candidates.find(candidate => candidate.startsWith('/') && fs.existsSync(path.join(sitePaths.publicDir, candidate))) ?? null;
  };
  // Reuse the existing enemy processor's exact actor-key/asset-basename join.
  // Never strip numeric/variant suffixes to borrow a different enemy's image.
  for (const folder of ['UI/void/boss', 'UI/Scenery/monster', 'UI/SHTT/guaiwu/Btn']) {
    const relative = 'game-assets/webp/Hotta/Content/Resources/' + folder;
    const directory = path.join(sitePaths.publicDir, relative);
    for (const file of fs.existsSync(directory) ? fs.readdirSync(directory) : []) {
      if (!file.endsWith('.webp') || file.endsWith('.thumb.webp')) continue;
      const key = path.basename(file, '.webp').toLowerCase();
      if (!actorImages.has(key)) actorImages.set(key, '/' + relative + '/' + file);
    }
    const rawDirectory = path.join(rawRoot, 'Hotta/Content/Resources', folder);
    for (const file of fs.existsSync(rawDirectory) ? fs.readdirSync(rawDirectory) : []) {
      if (!file.endsWith('.png')) continue;
      const key = path.basename(file, '.png').toLowerCase();
      if (!actorImages.has(key)) actorImages.set(key, '/' + relative + '/' + file.replace(/\.png$/, '.webp'));
    }
  }
  for (const [id, level] of Object.entries(levels)) {
    for (const wave of level.PoolMonstersByWave ?? []) for (const enemy of wave.PoolMonsters ?? []) {
      const classPath = enemy.MonsterClass?.AssetPathName;
      const name = loc(enemy.MonsterName, 'mmo', true);
      if (classPath && classPath !== 'None' && name) configuredNames.set(classPath.toLowerCase(), {
        name, actorKey: enemy.MonsterName.Key,
        source: {file: levelFile, row: id, field: 'PoolMonstersByWave[].PoolMonsters[].MonsterName', classPath},
      });
    }
    if (!level.BossIcon?.AssetPathName || !level.BossName?.Key) continue;
    const url = published('/game-assets/webp/' + assetFile(level.BossIcon).replace(/\.json$/, '.webp'));
    if (!url) continue;
    // Actor names are explicit exported identities, not similar display names or
    // inferred variant suffixes. Prefer the full portrait over older banner art.
    const actor = level.BossName.Key.toLowerCase();
    const candidate = {thumbnail: url, full: url,
      source: {file: levelFile, row: id, field: 'BossIcon', actorKey: level.BossName.Key, join: 'exact actor key'}};
    const prior = primaryByActor.get(actor);
    if (!prior || (url.includes('/plugin/FB/bigmon/') && !prior.full.includes('/plugin/FB/bigmon/'))) primaryByActor.set(actor, candidate);
    for (const wave of level.PoolMonstersByWave ?? []) for (const enemy of wave.PoolMonsters ?? []) {
      const classPath = enemy.MonsterClass?.AssetPathName;
      // The pod's primary image must never be assigned to an unrelated add.
      if (!classPath || classPath === 'None' || enemy.MonsterName?.Key !== level.BossName.Key) continue;
      primary.set(classPath.toLowerCase(), {thumbnail: url, full: url,
        source: {file: levelFile, row: id, field: 'BossIcon', actorKey: level.BossName.Key, classField: 'PoolMonstersByWave[].PoolMonsters[].MonsterClass'}});
    }
  }
  const portraits = {}, identities = {};
  for (const season of data.rounds) for (const round of season.rounds) for (const enemy of round.pool?.monsters ?? []) {
    const classPath = enemy.classPath;
    if (!classPath || !enemy.count || identities[classPath]) continue;
    const chain = enemyClassChain(classPath, sources);
    const codeName = path.posix.basename(classPath).split('.')[0].replace(/_C$/, '');
    let identity = configuredNames.get(classPath.toLowerCase());
    for (const entry of chain) {
      if (identity) break;
      const actorKey = path.posix.basename(entry.reference).split('.')[0].replace(/_C$/, '');
      const name = loc({Namespace: 'ST_actorname', Key: actorKey}, 'mmo', true);
      if (name) identity = {name, actorKey, source: {file: entry.file, field: 'Blueprint package basename → ST_actorname key', chain: chain.map(entry => entry.file)}};
    }
    const existing = oow.get(classPath.toLowerCase());
    const localized = enemy.localizedNameKey ? loc({Namespace: 'ST_actorname', Key: enemy.localizedNameKey}, 'mmo', true) : null;
    identities[classPath] = {codeName, actorKey: identity?.actorKey ?? enemy.localizedNameKey ?? null,
      name: identity?.name ?? (existing?.enemy.nameEn ? {en: existing.enemy.nameEn, ru: existing.enemy.nameRu ?? null} : null) ?? localized ?? enemy.name ?? null,
      source: identity?.source ?? existing?.source ?? {file: 'game-data/handbook/mmo-bygone.json', field: 'localizedNameKey → ST_actorname (case-insensitive, no suffix removal)'},
      classChain: chain.map(entry => entry.file)};
    const exact = primary.get(classPath.toLowerCase());
    if (exact) {portraits[classPath] = exact; continue;}
    if (existing?.enemy.imageMatchStatus === 'confirmed') {
      const thumbnail = published(existing.enemy.lineupPortraitThumb ?? existing.enemy.imageThumb) ?? published(existing.enemy.image);
      const full = published(existing.enemy.detailImageFull ?? existing.enemy.image);
      if (thumbnail && full) {portraits[classPath] = {thumbnail, full, source: existing.source}; continue;}
    }
    const base = path.posix.basename(classPath).split('.')[0].replace(/_C$/, '');
    // The encounter snapshot already records its immediate Blueprint parent's
    // exact basename in localizedNameKey, even when that raw export is offline.
    const keys = [classPath, base, base.toLowerCase(), enemy.localizedNameKey, ...chain.flatMap(entry => {
      const leaf = path.posix.basename(entry.reference).split('.')[0].replace(/_C$/, '');
      return [entry.reference, leaf, leaf.toLowerCase()];
    })];
    const key = keys.filter(Boolean).map(key => mapping[key]?.resolutionStatus === 'confirmed' ? key : foldedMappings.get(key.toLowerCase()))
      .find(key => key && mapping[key]?.resolutionStatus === 'confirmed');
    if (key) {
      const record = mapping[key];
      const thumbnail = published(record.lineupPortrait ?? record.image);
      const full = published(record.detailImage ?? record.image);
      if (thumbnail && full) {
        portraits[classPath] = {thumbnail, full,
          source: {file: mappingFile, row: key, field: 'lineupPortrait', assetRef: record.sourceAssetRef ?? null,
            snapshotParentKey: enemy.localizedNameKey ?? null, classChain: chain.map(entry => entry.file)}};
        continue;
      }
    }
    const actorPrimary = primaryByActor.get(identities[classPath].actorKey?.toLowerCase());
    if (actorPrimary) {
      portraits[classPath] = {...actorPrimary, source: {...actorPrimary.source,
        identitySource: identities[classPath].source, classPath}};
      continue;
    }
    const actorKey = [identity?.actorKey, enemy.localizedNameKey, ...chain.map(entry => path.posix.basename(entry.reference).split('.')[0].replace(/_C$/, ''))]
      .find(key => key && actorImages.has(key.toLowerCase()));
    const actorImage = published(actorImages.get(actorKey?.toLowerCase()));
    if (actorImage) {
      const rawPath = media.get(actorImage)?.rawPath;
      const sourcePath = rawPath ?? actorImage.slice(1);
      const bytes = readGameSourceFileSync(rawPath ? path.join(rawRoot, rawPath) : path.join(sitePaths.publicDir, actorImage));
      sources[sourcePath] = {sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
      portraits[classPath] = {thumbnail: actorImage, full: actorImage,
        source: {file: sourcePath, field: 'asset basename = verified actor key / Blueprint ancestor', actorKey, classChain: chain.map(entry => entry.file)}};
    }
  }
  const coverage = {classes: Object.keys(identities).length, names: Object.values(identities).filter(entry => entry.name).length,
    portraits: Object.keys(portraits).length, missing: Object.entries(identities).filter(([key, entry]) => !entry.name || !portraits[key]).map(([classPath, entry]) => ({classPath, nameMissing: !entry.name, portraitMissing: !portraits[classPath]}))};
  write('mmo-bygone-media', {sources, identities, portraits, coverage});
  console.log(`MMO Bygone: ${coverage.names}/${coverage.classes} names, ${coverage.portraits}/${coverage.classes} portraits`);
}

// Presentation-only projection: full boss/elite artwork from the level's own
// FText associations. It can refresh media without replacing encounter stats.
function biochemicalCollapseMedia() {
  const sources = {};
  const data = readGenerated('handbook/biochemical-collapse.json', sources);
  const assetPath = 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OptionalBossDataAsset_MMO.json';
  const asset = readRaw(assetPath, sources).find(object => object.Name === 'OptionalBossDataAsset_MMO');
  assert.ok(asset?.Properties?.LevelConfigDataTable_BalanceServer, 'MMO biochemical level binding');
  const levelFile = assetFile(asset.Properties.LevelConfigDataTable_BalanceServer);
  const levels = rows(levelFile, sources), loc = localizer(sources);
  const mappingFile = 'scripts/game-processors/processors/monster-image-mapping.json';
  const mappingBytes = readGameSourceFileSync(path.join(sourceRoot, mappingFile));
  sources[mappingFile] = {sha256: crypto.createHash('sha256').update(mappingBytes).digest('hex')};
  const mapping = JSON.parse(mappingBytes);
  const textKey = text => text?.Key && text?.TableId ? `${text.TableId}:${text.Key}` : null;
  const sameName = (a, b) => ['en', 'ru'].some(locale => a?.[locale] && a[locale] === b?.[locale]) &&
    ['en', 'ru'].every(locale => !a?.[locale] || !b?.[locale] || a[locale] === b[locale]);
  const published = (ref, field) => {
    if (!ref?.AssetPathName || ref.AssetPathName === 'None') return null;
    const relative = assetFile(ref).replace(/\.json$/, '');
    const url = icon(ref, 'MMO Biochemical Collapse full enemy artwork') ?? `/game-assets/webp/${relative}.webp`;
    if (!media.has(url) && !fs.existsSync(path.join(sitePaths.publicDir, url))) return null;
    const output = path.join(sitePaths.publicDir, url);
    const rawPng = path.join(rawRoot, relative + '.png');
    const source = fs.existsSync(rawPng) ? rawPng : output;
    sources[fs.existsSync(rawPng) ? relative + '.png' : url.slice(1)] = {sha256: crypto.createHash('sha256').update(readGameSourceFileSync(source)).digest('hex')};
    return {portrait: url, field, assetRef: ref.AssetPathName};
  };
  const artByLevel = new Map();
  for (const [id, level] of Object.entries(levels)) {
    const art = new Map();
    const add = (text, ref, field) => {
      const key = textKey(text), entry = published(ref, field);
      if (!key || !entry) return;
      const previous = art.get(key);
      art.set(key, previous === null || (previous && previous.portrait !== entry.portrait) ? null : entry);
    };
    add(level.BossName, level.BossIcon, 'BossIcon');
    for (const [index, elite] of (level.EliteArray ?? []).entries()) add(elite.EliteName, elite.EliteIcon, `EliteArray[${index}].EliteIcon`);
    artByLevel.set(id, art);
  }
  // A season may reference an absent old texture while another level explicitly
  // binds available full art to the identical actor FText AND full monster class.
  // Keep variant classes and string-table namespaces distinct; conflicts stay unknown.
  const sharedArt = new Map();
  const identity = raw => raw?.MonsterClass?.AssetPathName && raw.MonsterClass.AssetPathName !== 'None' && textKey(raw.MonsterName)
    ? JSON.stringify([raw.MonsterClass.AssetPathName, textKey(raw.MonsterName)]) : null;
  for (const [id, level] of Object.entries(levels)) {
    for (const wave of level.PoolMonstersByWave ?? []) for (const raw of wave.PoolMonsters ?? []) {
      const key = identity(raw), entry = artByLevel.get(id).get(textKey(raw.MonsterName));
      if (!key || !entry) continue;
      const previous = sharedArt.get(key);
      sharedArt.set(key, previous === null || (previous && previous.entry.portrait !== entry.portrait) ? null : previous ?? {
        entry, source: {file: levelFile, row: id, field: entry.field},
      });
    }
  }
  const pods = {};
  for (const season of data.seasons) for (const pod of season.levels) {
    if (pods[pod.id]) continue;
    const level = levels[pod.id];
    if (!level) continue;
    const art = artByLevel.get(pod.id);
    const enemies = {};
    for (const wave of pod.waves) for (const [index, enemy] of wave.enemies.entries()) {
      const raw = level.PoolMonstersByWave?.[wave.index - 1]?.PoolMonsters?.[index];
      const key = textKey(raw?.MonsterName);
      let entry = art.get(key);
      let artworkSource;
      if (!entry) {
        const shared = sharedArt.get(identity(raw));
        entry = shared?.entry;
        artworkSource = shared?.source;
      }
      const classPath = raw?.MonsterClass?.AssetPathName;
      const confirmed = classPath ? mapping[classPath] : null;
      if (!entry && confirmed?.resolutionStatus === 'confirmed' && confirmed.sourceAssetRef) {
        const fallback = published({AssetPathName: confirmed.sourceAssetRef}, 'confirmed full-class portrait mapping');
        if (fallback) entry = {...fallback, mappingKey: classPath};
      }
      const localized = loc(raw?.MonsterName, 'mmo');
      const rawName = localized ?? (raw?.MonsterName?.SourceString ? {en: raw.MonsterName.SourceString, ru: raw.MonsterName.SourceString} : null);
      if (!entry || !sameName(enemy.name, rawName)) continue;
      enemies[`${wave.index}:${index}`] = {name: enemy.name, ...entry, portraitFit: entry.mappingKey ? 'cover' : 'contain',
        source: {file: levelFile, row: pod.id, field: artworkSource ? `PoolMonstersByWave[${wave.index - 1}].PoolMonsters[${index}]` : entry.field, actorKey: raw.MonsterName.Key,
          classPath: classPath ?? null, ...(artworkSource ? {artworkSource} : {}), ...(entry.mappingKey ? {mappingFile, mappingKey: entry.mappingKey} : {})}};
    }
    const lead = Object.values(enemies).find(enemy => sameName(enemy.name, pod.bossName ?? pod.featuredName));
    pods[pod.id] = {portrait: lead?.portrait ?? null, portraitFit: lead?.portraitFit ?? 'contain', enemies};
  }
  write('biochemical-collapse-media', {sources, pods});
  console.log(`MMO Biochemical artwork: ${Object.values(pods).reduce((sum, pod) => sum + Object.keys(pod.enemies).length, 0)} enemy slots`);
}

// MMO Brainfield (PlayerTalent) is joined from its MMO data-asset bindings and static UMG graph.
// Direct attributes, localized copy, upgrade materials, and skill-buff references remain separate:
// this export does not infer player ownership or compute custom runtime buff behavior.
function mmoBrainfield(ctx) {
  const {sources, loc} = ctx;
  const root = 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/PlayerTalent/';
  const dataAssetPath = root + 'DA_PlayerTalent.json';
  const dataAsset = readRaw(dataAssetPath, sources).find(object => object.Name === 'DA_PlayerTalent');
  assert.ok(dataAsset?.Properties?.DataTables, 'DA_PlayerTalent table bindings');
  const bindings = Object.fromEntries(dataAsset.Properties.DataTables.map(entry => [entry.Key, assetFile(entry.Value)]));
  assert.ok(bindings.PlayerTalentConfig && bindings.PlayerTalentGroupConfig, 'Brainfield config and group table bindings');
  const configRows = rows(bindings.PlayerTalentConfig, sources);
  const groupRows = rows(bindings.PlayerTalentGroupConfig, sources);
  const treePath = 'Hotta/Content/SevenForest/Blueprint/UI/PlayerTalent/UI_PlayerTalentTree.json';
  const tree = readRaw(treePath, sources);
  const itemPath = 'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json';
  const itemRows = rows(itemPath, sources);
  const widgetPosition = ref => {
    const index = Number(ref?.ObjectPath?.split('.').at(-1));
    const slot = Number.isInteger(index) ? tree[index] : null;
    const layout = slot?.Type === 'CanvasPanelSlot' ? slot.Properties?.LayoutData : null;
    return layout ? {panel: slot.Outer ?? null, offsets: layout.Offsets ?? null,
      anchors: layout.Anchors ?? null, alignment: layout.Alignment ?? null} : null;
  };
  const widgetNodes = new Map(tree.filter(object => object.Type === 'UI_PlayerTalentNode_C')
    .map(object => [object.Properties?.TalentID, widgetPosition(object.Properties?.Slot)]));
  const connections = tree.filter(object => object.Type === 'UI_PlayerTalentConnection_C').map(object => ({
    from: object.Properties?.StartTalentID ?? null,
    to: object.Properties?.EndTalentID ?? null,
    layout: widgetPosition(object.Properties?.Slot),
  }));
  const nodeToGroup = new Map();
  const groups = Object.entries(groupRows).map(([rowKey, group]) => {
    const index = Number(group.GroupIndex);
    const members = (group.TalentMaxLevel ?? []).map(member => ({id: member.ID, maxLevel: Number(member.Level)}));
    for (const member of members) {
      assert.ok(!nodeToGroup.has(member.id), `Brainfield member belongs to multiple groups: ${member.id}`);
      nodeToGroup.set(member.id, index);
    }
    return {rowKey, index, name: loc(group.DisplayName, 'mmo'), resettable: group.bCanReset ?? null,
      unlockConditions: group.UnlockConditions ?? [], maximumLevelTotal: members.reduce((sum, member) => sum + member.maxLevel, 0), members};
  }).sort((a, b) => a.index - b.index);
  assert.equal(widgetNodes.size, 55, 'Brainfield static graph node coverage');
  assert.equal(connections.length, 45, 'Brainfield static graph connection coverage');

  const nodeData = (member, groupIndex) => {
    const levels = [];
    for (let level = 1; level <= member.maxLevel; level++) {
      const rowKey = `${member.id}_${level}`;
      const row = configRows[rowKey];
      assert.ok(row, `Missing Brainfield level row ${rowKey}`);
      const attribute = row.AttrModifyData ?? {};
      const rawBuff = row.BuffObject?.AssetPathName;
      const materials = (row.UpgradeMaterials ?? []).map(material => {
        const item = itemRows[material.ItemId];
        assert.ok(item, `Missing Brainfield material item ${material.ItemId}`);
        return {id: material.ItemId, count: Number.isFinite(Number(material.ItemCount)) ? Number(material.ItemCount) : null,
          name: loc(item.ItemName, 'mmo'), icon: icon(item.ItemIcon, 'MMO Brainfield upgrade material')};
      });
      levels.push({level, rowKey,
        unlockConditions: row.UnlockConditions ?? [],
        attribute: {isTag: attribute.IsTag ?? null, propName: attribute.PropName && attribute.PropName !== 'None' ? attribute.PropName : null,
          propValue: attribute.PropValue == null || !Number.isFinite(Number(attribute.PropValue)) ? null : Number(attribute.PropValue),
          modifierOp: attribute.ModifierOp ?? null},
        buffClass: rawBuff && rawBuff !== 'None' ? rawBuff : null,
        buffDescription: loc(row.BuffDescription, 'mmo'),
        descriptionParams: row.DescParam ?? [],
        materials,
        bannedLevels: row.BannedLevelArray ?? [],
      });
    }
    const baseRow = configRows[`${member.id}_1`];
    const images = baseRow ? {
      activated: icon(baseRow.ActivatedImage, 'MMO Brainfield active node icon'),
      unactivated: icon(baseRow.UnactivatedImage, 'MMO Brainfield inactive node icon'),
      blink: icon(baseRow.BlinkImage, 'MMO Brainfield node animation icon'),
    } : {activated: null, unactivated: null, blink: null};
    return {id: member.id, kind: member.id.startsWith('skill') ? 'skill' : 'attribute', groupIndex,
      maxLevel: member.maxLevel, name: loc(baseRow?.DisplayName, 'mmo'), description: loc(baseRow?.FuncDescription, 'mmo'),
      icons: images, layout: widgetNodes.get(member.id) ?? null, levels};
  };
  const resultGroups = groups.map(group => ({...group,
    nodes: group.members.map(member => nodeData(member, group.index)),
    connections: connections.filter(edge => nodeToGroup.get(edge.from) === group.index),
  }));
  const representedRows = new Set(groups.flatMap(group => group.members.flatMap(member =>
    Array.from({length: member.maxLevel}, (_, index) => `${member.id}_${index + 1}`))));
  const unlistedRows = Object.keys(configRows).filter(key => !representedRows.has(key));
  assert.equal(unlistedRows.length, 0, `Unlisted Brainfield rows: ${unlistedRows.slice(0, 10).join(', ')}`);
  assert.ok(connections.every(edge => nodeToGroup.has(edge.from) && nodeToGroup.has(edge.to)), 'Brainfield graph endpoints resolve');
  const sourcePaths = new Set([dataAssetPath, bindings.PlayerTalentConfig, bindings.PlayerTalentGroupConfig, treePath, itemPath,
    'Hotta/Content/Localization/Game/en/Game.json', 'Hotta/Content/Localization/Game/ru/Game.json']);
  write('mmo-brainfield', {
    sources: Object.fromEntries([...sourcePaths].filter(file => sources[file]).map(file => [file, sources[file]])),
    groups: resultGroups,
    totals: {configRows: Object.keys(configRows).length, nodes: nodeToGroup.size,
      skills: [...nodeToGroup.keys()].filter(id => id.startsWith('skill')).length, graphNodes: widgetNodes.size, graphConnections: connections.length,
      unlistedConfigRows: unlistedRows.length},
  });
}

// MMO Raid uses the existing MMO LevyClone processor + EN/RU normalizer outputs.
// This consumer only shapes that generated catalog for the Handbook; it does not
// re-extract stage, schedule, reward, or localization rows from raw tables.
function mmoRaids(ctx) {
  const en = readGenerated('en/mmo-team-raids.json', ctx.sources);
  const ru = readGenerated('ru/mmo-team-raids.json', ctx.sources);
  const itemsEn = Object.values(readGenerated('en/datamine/items-mmo.json', ctx.sources));
  const itemsRu = Object.values(readGenerated('ru/datamine/items-mmo.json', ctx.sources));
  const itemEnById = new Map(itemsEn.filter(item => item?.id).map(item => [item.id, item]));
  const itemRuById = new Map(itemsRu.filter(item => item?.id).map(item => [item.id, item]));
  const sourcePaths = [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_LevyClone_MMO.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/LevyClone/LevyCloneStage/DT_LevyCloneStage.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/TeamCloneConfig.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/TeamConfigDataTable.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/Drop/DropGroupDataTable_MMOServer.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/Drop/DropSequenceDataTable_MMO.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/Drop/DropModifySequenceDataTable_MMO.json',
    'Hotta/Content/Localization/Game/en/Game.json',
    'Hotta/Content/Localization/Game/ru/Game.json',
  ];
  for (const file of sourcePaths) readRaw(file, ctx.sources);
  const numberValue = value => value == null || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const assetFromMediaPath = (value, role) => {
    if (!value || typeof value !== 'string') return null;
    const marker = '/media/';
    const markerIndex = value.lastIndexOf(marker);
    const relative = (markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value)
      .replace(/^\/+/, '').replace(/\.(?:webp|png)$/i, '');
    const rawPath = `${relative}.png`;
    if (!fs.existsSync(path.join(rawRoot, rawPath))) return null;
    const url = `/game-assets/webp/${relative}.webp`;
    if (!media.has(url)) media.set(url, {rawPath, url, role});
    return url;
  };
  const localized = (enValue, ruValue) => ({en: enValue || null, ru: ruValue || null});
  const ruStages = new Map((ru.stages ?? []).map(stage => [stage.id, stage]));
  const stageRows = (en.stages ?? []).map(stage => {
    const localizedStage = ruStages.get(stage.id);
    assert.ok(localizedStage, `Missing RU MMO Raid stage ${stage.id}`);
    const ruBosses = new Map((localizedStage.bosses ?? []).map(boss => [boss.id, boss]));
    const ruMechanics = new Map((localizedStage.mechanics ?? []).map(mechanic => [mechanic.index, mechanic]));
    const rewards = Object.fromEntries(['normal', 'poor', 'display'].map(kind => [kind, (stage.rewards?.[kind] ?? []).map(group => {
      const rewardItems = (group.entries ?? []).filter(entry => entry.itemId).map(entry => {
        const itemEn = itemEnById.get(entry.itemId);
        const itemRu = itemRuById.get(entry.itemId);
        return {
          id: entry.itemId,
          name: localized(itemEn?.name, itemRu?.name),
          icon: assetFromMediaPath(itemEn?.icon ?? itemRu?.icon, 'MMO Raid reward icon'),
          count: numberValue(entry.num),
          minCount: numberValue(entry.minNum),
          maxCount: numberValue(entry.maxNum),
          weight: numberValue(entry.weight),
        };
      });
      return {
        id: group.id,
        modifyNum: numberValue(group.modifyNum),
        modifyCount: numberValue(group.modifyCount),
        minLevel: numberValue(group.minLevel),
        maxLevel: numberValue(group.maxLevel),
        levelType: group.levelType ?? null,
        items: rewardItems,
      };
    })]));
    return {
      id: stage.id,
      stageNumber: numberValue(stage.stageNumber),
      floorEnum: stage.floorEnum ?? null,
      difficultyEnum: stage.difficultyEnum ?? null,
      titleKey: stage.titleKey ?? null,
      name: localized(stage.name, localizedStage.name),
      nameLocalization: stage.nameLocalization ?? null,
      bosses: (stage.bosses ?? []).map(boss => ({
        id: boss.id,
        actorKey: boss.actorKey ?? null,
        name: localized(boss.name, ruBosses.get(boss.id)?.name),
        localization: boss.localization ?? null,
      })),
      recommendedScore: stage.recommendedScore ?? null,
      requiredLevel: stage.requiredLevel ?? null,
      team: stage.team ?? null,
      challengeTimeRaw: stage.challengeTimeRaw ?? null,
      mechanics: (stage.mechanics ?? []).map(mechanic => ({
        index: mechanic.index,
        text: localized(mechanic.text, ruMechanics.get(mechanic.index)?.text),
        localization: mechanic.localization ?? null,
        icon: assetFromMediaPath(mechanic.image?.rawExportPath, 'MMO Raid mechanic icon'),
      })),
      stageImages: {
        small: assetFromMediaPath(stage.stageImages?.small?.rawExportPath, 'MMO Raid stage thumbnail'),
        title: assetFromMediaPath(stage.stageImages?.title?.rawExportPath, 'MMO Raid title art'),
      },
      dropRefs: stage.dropRefs ?? null,
      rewards,
      scheduleRows: stage.scheduleRows ?? [],
    };
  });
  const ruSchedules = new Map((ru.schedules ?? []).map(schedule => [schedule.id, schedule]));
  const schedules = (en.schedules ?? []).map(schedule => {
    const localizedSchedule = ruSchedules.get(schedule.id);
    const ruLinks = new Map((localizedSchedule?.linkedLevels ?? []).map(link => [`${link.variantId}|${link.serverLevel ?? ''}`, link]));
    const descriptionEn = schedule.bossDebuffUI?.description?.text;
    const descriptionRu = localizedSchedule?.bossDebuffUI?.description?.text;
    return {
      id: schedule.id,
      beginRaw: schedule.beginRaw ?? null,
      endRaw: schedule.endRaw ?? null,
      timeLimited: schedule.timeLimited ?? null,
      shownInClient: schedule.shownInClient ?? null,
      jointOperationLevelType: schedule.jointOperationLevelType ?? null,
      bossBuffIds: schedule.bossBuffIds ?? [],
      playerBuffIds: schedule.playerBuffIds ?? [],
      extraDropId: schedule.extraDropId ?? null,
      balanceBossBuffId: schedule.balanceBossBuffId ?? null,
      bossDebuff: schedule.bossDebuffUI ? {
        description: localized(descriptionEn, descriptionRu),
        icon: assetFromMediaPath(schedule.bossDebuffUI.image?.rawExportPath, 'MMO Raid boss debuff icon'),
      } : null,
      linkedLevels: (schedule.linkedLevels ?? []).map(link => {
        const ruLink = ruLinks.get(`${link.variantId}|${link.serverLevel ?? ''}`);
        return {
          serverLevel: link.serverLevel ?? null,
          variantId: link.variantId,
          stageRowPresent: link.stageRowPresent,
          name: localized(link.name, ruLink?.name),
        };
      }),
    };
  });
  assert.equal(stageRows.length, en.totalStages, 'MMO Raid stage count matches normalized dataset');
  assert.equal(schedules.length, en.totalScheduleRows, 'MMO Raid schedule count matches normalized dataset');
  write('mmo-raids', {
    sources: Object.fromEntries(sourcePaths.map(file => [file, ctx.sources[file]])),
    totalStages: en.totalStages,
    totalScheduleRows: en.totalScheduleRows,
    totalScheduleLinks: en.totalScheduleLinks,
    stageMatchedScheduleLinks: en.stageMatchedScheduleLinks,
    scheduleVariantIdsWithoutStageRows: en.scheduleVariantIdsWithoutStageRows ?? [],
    stages: stageRows,
    schedules,
    unresolved: en.unresolved ?? {},
  });
}

// Original-server 8-player raids consume the normalized TeamCloneConfig catalog.
// Keep the per-variant source decisions and raw text refs visible to the Handbook.
// Original raid art is keyed by the exact level row, independently of MMO stages.
// Keep verified references even when this export has no texture pixels yet.
const RAID_CARD_BACKGROUND = '/Game/Resources/UI/AdvancedGashapon/ALS/ui_bkhd_bg.ui_bkhd_bg';
function teamRaidMedia(data) {
  const sources = {...data.sources};
  const sharedFile = 'Hotta/Content/Resources/CoreBlueprints/DataTable/LevelConfigDataTable.json';
  const overseasFile = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/LevelConfigDataTable_Overseas.json';
  const tables = new Map([sharedFile, overseasFile].map(file => [file,
    fs.existsSync(path.join(rawRoot, file)) ? rows(file, sources) : {}]));
  const resolve = (reference, role) => {
    if (!reference || reference === 'None' || !reference.startsWith('/Game/')) return {assetRef: null, expected: null, url: null};
    const relative = assetFile({AssetPathName: reference}).replace(/\.json$/, '');
    const expected = '/game-assets/webp/' + relative + '.webp';
    const rawPath = relative + '.png';
    if (fs.existsSync(path.join(rawRoot, rawPath))) return {assetRef: reference, expected, url: icon(reference, role)};
    const directory = path.join(sitePaths.publicDir, path.posix.dirname(expected));
    const leaf = fs.existsSync(directory) ? fs.readdirSync(directory).find(file => file.toLowerCase() === path.posix.basename(expected).toLowerCase()) : null;
    return {assetRef: reference, expected, url: leaf ? path.posix.dirname(expected) + '/' + leaf : null};
  };
  // Editorial card backdrop chosen for the Raids page (not a raid-row fact): the
  // Gashapon ALS panel background, exported by the existing AdvancedGashapon rule.
  const cardBackground = resolve(RAID_CARD_BACKGROUND, 'Raid card background');
  return {...data, sources, presentation: {cardBackground: {url: cardBackground.url, reference: cardBackground.assetRef, expected: cardBackground.expected}},
    raids: data.raids.map(raid => ({...raid, variants: raid.variants.map(variant => {
    // An existing Overseas row is authoritative even if one of its fields is None.
    const file = tables.get(overseasFile)[variant.id] ? overseasFile : sharedFile;
    const level = tables.get(file)[variant.id];
    const thumbnail = resolve(level?.LevyCloneLevelIcon?.AssetPathName, 'Original Raid selection icon');
    const title = resolve(level?.JointOperationLevelIcon?.AssetPathName, 'Original Raid title art');
    return {...variant, artwork: {thumbnail: thumbnail.url, title: title.url,
      references: {thumbnail: thumbnail.assetRef, title: title.assetRef},
      expected: {thumbnail: thumbnail.expected, title: title.expected},
      source: level ? {file, row: variant.id, thumbnailField: 'LevyCloneLevelIcon', titleField: 'JointOperationLevelIcon'} : null}};
  })}))};
}

function teamRaidTitles(catalog) {
  const sources = {...catalog.sources};
  const en = readGenerated('en/cosmetics.json', sources);
  const ru = readGenerated('ru/cosmetics.json', sources);
  const stylesFile = 'build-title-styles.json';
  const styles = fs.existsSync(path.join(gameData, stylesFile)) ? readGenerated(stylesFile, sources).titles : {};
  return {...catalog, sources, rankingTitles: require('../lib/raid-rankings.cjs').raidTitleRewards(en, ru, styles)};
}

function teamRaids(ctx) {
  const en = readGenerated('en/datamine/team-raids.json', ctx.sources);
  const ru = readGenerated('ru/datamine/team-raids.json', ctx.sources);
  const itemsEn = Object.values(readGenerated('en/items.json', ctx.sources));
  const itemsRu = Object.values(readGenerated('ru/items.json', ctx.sources));
  const itemEnById = new Map(itemsEn.filter(item => item?.id).map(item => [item.id, item]));
  const itemRuById = new Map(itemsRu.filter(item => item?.id).map(item => [item.id, item]));
  const sourcePaths = [...new Set([
    ...Object.values(en.source ?? {}).flatMap(value => Array.isArray(value) ? value : [value])
      .filter(value => typeof value === 'string'),
    'Hotta/Content/Localization/Game/en/Game.json',
    'Hotta/Content/Localization/Game/ru/Game.json',
  ])].filter(file => file && !file.startsWith('game-data/'));
  for (const file of sourcePaths) readRaw(file, ctx.sources);
  const localized = (enValue, ruValue) => ({en: enValue || null, ru: ruValue || null});
  const assetFromRawPath = (value, role) => {
    if (!value || typeof value !== 'string') return null;
    const rawPath = value.replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.(?:webp|png)$/i, '.png');
    if (!fs.existsSync(path.join(rawRoot, rawPath))) return null;
    const url = `/game-assets/webp/${rawPath.replace(/\.png$/i, '.webp')}`;
    if (!media.has(url)) media.set(url, {rawPath, url, role});
    return url;
  };
  const assetFromMediaPath = (value, role) => {
    if (!value || typeof value !== 'string') return null;
    const markerIndex = value.lastIndexOf('/media/');
    const relative = (markerIndex >= 0 ? value.slice(markerIndex + '/media/'.length) : value)
      .replace(/^\/+/, '').replace(/\.(?:webp|png)$/i, '');
    return assetFromRawPath(`${relative}.png`, role);
  };
  const ruByRaid = new Map((ru.raids ?? []).map(raid => [raid.id, raid]));
  const raids = (en.raids ?? []).map(raid => {
    const localizedRaid = ruByRaid.get(raid.id);
    assert.ok(localizedRaid, `Missing RU Original raid ${raid.id}`);
    const ruBosses = new Map((localizedRaid.bosses ?? []).map(boss => [boss.id, boss]));
    const ruTips = new Map((localizedRaid.bossTips ?? []).map(tip => [tip.key, tip]));
    const ruGuides = new Map((localizedRaid.guides ?? []).map(guide => [guide.id, guide]));
    const ruVariants = new Map((localizedRaid.variants ?? []).map(variant => [variant.id, variant]));
    return {
      id: raid.id,
      index: raid.index,
      bosses: (raid.bosses ?? []).map(boss => ({
        id: boss.id,
        sourceIds: boss.sourceIds ?? [],
        localizationKey: boss.localizationKey ?? null,
        nameJoinMethod: boss.nameJoinMethod ?? 'unresolved',
        stats: boss.stats ?? [],
        name: localized(boss.name, ruBosses.get(boss.id)?.name),
      })),
      bossTips: (raid.bossTips ?? []).map(tip => ({
        key: tip.key,
        bossId: tip.bossId,
        joinMethod: tip.joinMethod,
        text: localized(tip.text, ruTips.get(tip.key)?.text),
      })),
      guides: (raid.guides ?? []).map(guide => {
        const ruGuide = ruGuides.get(guide.id);
        assert.ok(ruGuide, `Missing RU Original raid guide ${raid.id}/${guide.id}`);
        return {
          ...guide,
          baseText: localized(guide.baseText, ruGuide.baseText),
          text: localized(guide.text, ruGuide.text),
        };
      }),
      variants: (raid.variants ?? []).map(variant => {
        const localizedVariant = ruVariants.get(variant.id);
        assert.ok(localizedVariant, `Missing RU Original raid variant ${variant.id}`);
        const ruMechanics = new Map((localizedVariant.mechanics ?? []).map(mechanic => [mechanic.index, mechanic]));
        return {
          id: variant.id,
          targetName: variant.targetName,
          name: localized(variant.name, localizedVariant.name),
          nameLocalization: variant.nameLocalization ?? null,
          cloneIndex: variant.cloneIndex ?? null,
          bossIds: variant.bossIds ?? [],
          recommendedScore: variant.recommendedScore ?? null,
          challengeTimeRaw: variant.challengeTimeRaw ?? null,
          requiredLevel: variant.requiredLevel ?? null,
          team: variant.team ?? null,
          rewardPackIds: variant.rewardPackIds ?? null,
          rewardDetails: (variant.rewardDetails ?? []).map(pack => ({
            ...pack,
            groups: (pack.groups ?? []).map(group => ({
              ...group,
              entries: (group.entries ?? []).map(entry => {
                const itemEn = itemEnById.get(entry.itemId);
                const itemRu = itemRuById.get(entry.itemId);
                return {
                  ...entry,
                  itemName: localized(itemEn?.name, itemRu?.name),
                  itemIcon: assetFromMediaPath(itemEn?.icon ?? itemRu?.icon, 'Original Raid reward icon'),
                };
              }),
            })),
          })),
          availability: variant.availability ?? null,
          mechanics: (variant.mechanics ?? []).map(mechanic => {
            const ruMechanic = ruMechanics.get(mechanic.index);
            return {
              index: mechanic.index,
              key: mechanic.key,
              text: localized(mechanic.text, ruMechanic?.text),
              localization: mechanic.localization ?? null,
              localizationRef: mechanic.localizationRef ?? null,
              source: mechanic.source ?? null,
              icon: assetFromRawPath(mechanic.image?.rawExportPath, 'Original Raid mechanic icon'),
              assetRef: mechanic.image?.assetRef ?? null,
            };
          }),
          source: variant.source ?? null,
        };
      }),
    };
  });
  assert.equal(raids.length, en.total, 'Original Raid count matches normalized dataset');
  assert.equal(raids.reduce((total, raid) => total + raid.variants.length, 0), en.variantsTotal, 'Original Raid variant count matches normalized dataset');
  const ruPoolEntries = new Map((ru.guide?.poolEntries ?? []).map(entry => [entry.index, entry]));
  const guidePoolEntries = (en.guide?.poolEntries ?? []).map(entry => {
    const ruEntry = ruPoolEntries.get(entry.index);
    assert.ok(ruEntry, `Missing RU Original raid-pool guide entry ${entry.index}`);
    assert.equal(ruEntry.matchedRaidId, entry.matchedRaidId, `EN/RU Original raid-pool mapping differs at entry ${entry.index}`);
    return {...entry, name: localized(entry.name, ruEntry.name)};
  });
  assert.equal(guidePoolEntries.length, ruPoolEntries.size, 'EN/RU Original raid-pool guide entry counts match');
  write('team-raids', teamRaidTitles(teamRaidMedia({
    sources: Object.fromEntries(sourcePaths.map(file => [file, ctx.sources[file]])),
    total: en.total,
    variantsTotal: en.variantsTotal,
    mechanicsTotal: en.mechanicsTotal,
    guide: en.guide ? {key: en.guide.key, namespace: en.guide.namespace, text: localized(en.guide.text, ru.guide?.text), localization: en.guide.localization, poolEntries: guidePoolEntries} : null,
    catalogCoverage: en.catalogCoverage ?? {candidateRowsTotal: en.variantsTotal, unsupportedTeam8pIds: [], unsupportedLevyCloneIds: []},
    raids,
  })));
}

// ---------------------------------------------------------------- run
async function convertHandbookMedia() {
  const assets = [...media.values()].sort((a, b) => a.url.localeCompare(b.url));
  if (check) for (const asset of assets) assert.ok(fs.existsSync(path.join(sitePaths.publicDir, asset.url)), `missing ${asset.url}; run pnpm generate:handbook`);
  else if (assets.length) {
    const sharp = sitePaths.sharp();
    for (const asset of assets) {
      const output = path.join(sitePaths.publicDir, asset.url);
      if (fs.existsSync(output)) continue;
      fs.mkdirSync(path.dirname(output), {recursive: true});
      await sharp(path.join(rawRoot, asset.rawPath)).webp({lossless: true}).toFile(output);
      const metadata = await sharp(output).metadata();
      assert.ok(metadata.format === 'webp' && metadata.width && metadata.height, `invalid converted asset ${asset.url}`);
    }
  }
  return assets;
}
if (process.argv.includes('--raid-rankings-only')) {
  raidRankings();
} else if (process.argv.includes('--team-raids-titles-only')) {
  // Enrich the imported raid snapshot without replacing it with a different local raw export.
  write('team-raids', teamRaidTitles(readGenerated('handbook/team-raids.json', {})));
} else if (process.argv.includes('--supercomputer-from-build')) {
  supercomputerFromBuild();
} else if (process.argv.includes('--team-raids-media-only')) {
  write('team-raids', teamRaidMedia(readGenerated('handbook/team-raids.json', {})));
  convertHandbookMedia().catch(error => {console.error(error); process.exitCode = 1;});
} else if (process.argv.includes('--team-raids-only')) {
  // Original raid catalog only (needs the normalized team-raids datasets, not the other Handbook sources).
  teamRaids({sources: {}});
  convertHandbookMedia().catch(error => {console.error(error); process.exitCode = 1;});
} else if (process.argv.includes('--biochemical-schedule-only')) {
  biochemicalScheduleOnly();
} else if (process.argv.includes('--biochemical-media-only')) {
  biochemicalCollapseMedia();
  convertHandbookMedia().catch(error => {console.error(error); process.exitCode = 1;});
} else if (process.argv.includes('--mmo-bygone-hp-only') || process.argv.includes('--mmo-bygone-stats-only')) {
  // Recalculate only from this saved export's bases and evaluated curves. Class,
  // lineup and source hashes are retained; missing raw classes are never guessed.
  const data = readGenerated('handbook/mmo-bygone.json', {});
  write('mmo-bygone', mmoBygoneHp(data));
} else if (process.argv.includes('--mmo-bygone-only')) {
  const sources = {};
  mmoBygone({sources, loc: localizer(sources)});
} else if (process.argv.includes('--mmo-bygone-media-only')) {
  mmoBygoneMedia();
  convertHandbookMedia().catch(error => {console.error(error); process.exitCode = 1;});
} else {
const sources = {};
const reference = readGenerated('build-reference.json', sources);
const buildPage = readGenerated('build-page.json', sources);
const costs = readGenerated('build-progression-costs.json', sources);
// Item names: ItemConfigs (Overseas rows override) → ItemName text → localization; icons from the generated item list.
const loc = localizer(sources);
const itemRows = {...rows('Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json', sources), ...rows('Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs_OS.json', sources)};
const itemIcons = Object.fromEntries(Object.values(readGenerated('en/items.json', sources)).map(i => [i.id, i.icon || null]));
const ctx = {
  sources, reference, buildPage, costs, csRules: buildPage.csRules, limits: reference.limits, loc,
  items: ids => Object.fromEntries(ids.filter(id => id !== 'Gold').sort().map(id => {
    assert.ok(itemRows[id], `item ${id}`);
    return [id, {name: loc(itemRows[id].ItemName) ?? {en: null, ru: null}, icon: itemIcons[id] ?? null}];
  })),
};
ctx.slots = slotCatalog(reference, buildPage, {});
ctx.slotNames = Object.fromEntries(Object.values(ctx.slots).map(s => [s.id, s.name]));
// Slot art already produced by build-gear-media.cjs (normal / augmented / Titan).
ctx.slotIcons = Object.fromEntries(buildPage.gear.map(g => [g.id, g.icons]));
randomStats(ctx);
titan(ctx);
enhancement(ctx);
supercomputer(ctx);
suppressor(ctx);
spaceSupport(ctx);
cs(ctx);
combatFormulas(ctx);
biochemicalCollapse(ctx);
mmoBygone(ctx);
mmoBrainfield(ctx);
mmoRaids(ctx);
teamRaids(ctx);
raidRankings();

(async () => {
  biochemicalCollapseMedia();
  mmoBygoneMedia();
  const assets = await convertHandbookMedia();
  write('media', {source: 'scripts/generators/build-handbook.cjs', assets: assets.map(a => ({...a, processing: 'webp-lossless'}))});
  console.log(check ? 'handbook data is up to date' : `handbook data written to ${path.relative(root, outDir)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
}
