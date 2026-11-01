// Raw-only progression extraction. Expected random costs are an explicit model,
// not a claim about server RNG, overflow carry or undocumented guarantees.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const rawRoot = sitePaths.rawDir;
const common = 'Hotta/Content/Resources/CoreBlueprints/';
const overseas = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/';
const sources = {};
function read(file) {
  const bytes = fs.readFileSync(path.join(rawRoot, file));
  sources[file] = {sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  return JSON.parse(bytes);
}
const rows = file => read(file).find(o => o.Rows).Rows;
const properties = file => read(file).find(o => o.Name.startsWith('Default__') || o.Properties)?.Properties;
function parseItems(text) {
  return Object.fromEntries((text || '').split(';').filter(Boolean).map(pair => {
    const [id, quantity] = pair.split(',');
    assert.ok(id && Number.isFinite(Number(quantity)) && Number(quantity) >= 0, pair);
    return [id, Number(quantity)];
  }));
}
function add(total, items, multiplier = 1) {
  for (const [id, n] of Object.entries(items)) total[id] = (total[id] || 0) + n * multiplier;
}
function curveAt(curve, level) {
  assert.equal(curve.InterpMode, 'RCIM_Linear');
  const left = curve.Keys.filter(k => k.Time <= level).at(-1);
  const right = curve.Keys.find(k => k.Time >= level);
  assert.ok(left && right);
  return left.Time === right.Time ? left.Value : left.Value + (right.Value - left.Value) * (level - left.Time) / (right.Time - left.Time);
}
const computingAssetPath = overseas + 'EquipSlotEvolutionDataAsset_Overseas.json';
const computingAsset = properties(computingAssetPath);
const bindingPath = key => computingAsset[key].ObjectPath.replace(/\.\d+$/, '.json');
const nodes = rows(bindingPath('EquipSlotEvolutionDataTable'));
const conditions = rows(bindingPath('EquipSlotEvolutionConditionDataTable'));
const expRows = rows(bindingPath('EquipSlotEvolutionExpDataTable'));
const computingCurvePath = Object.values(nodes)[0].EquipSlotEvolutionMaxExpValue.CurveTable.ObjectPath.replace(/\.\d+$/, '.json');
const computingCurves = rows(computingCurvePath);
const computing = [];
let cumulativeExp = 0, cumulativeExpected = 0;
for (let level = 1; level <= Math.max(...Object.values(nodes).map(n => n.EquipSlotEvolutionMaxLevel)); level++) {
  const node = Object.values(nodes)[0];
  assert.ok(Object.values(nodes).every(n => n.EquipSlotEvolutionExpPackID === node.EquipSlotEvolutionExpPackID && n.EquipSlotEvolutionMaxLevel >= level));
  const threshold = curveAt(computingCurves[node.EquipSlotEvolutionMaxExpValue.RowName], level);
  const outcomes = Object.entries(expRows).filter(([, r]) => r.EquipSlotEvolutionExpID === `${node.EquipSlotEvolutionExpPackID}_${level}`);
  const weightTotal = outcomes.reduce((sum, [, r]) => sum + r.EvolutionWeight, 0);
  assert.ok(weightTotal > 0 && Number.isInteger(threshold));
  const probabilities = outcomes.map(([row, r]) => ({row, operator: r.EvolutionOperatorType, exp: r.EvolutionAddExpValue, weight: r.EvolutionWeight, probabilityWhenAllEligible: r.EvolutionWeight / weightTotal, eligibleRange: r.EvolutionExpValueRange}));
  const eligibleAt = exp => probabilities.filter(r => exp >= r.eligibleRange.MinValue.RangeValue && exp < r.eligibleRange.MaxValue.RangeValue);
  const segmentBounds = [...new Set([0, threshold, ...probabilities.flatMap(r => [r.eligibleRange.MinValue.RangeValue, r.eligibleRange.MaxValue.RangeValue]).filter(v => v > 0 && v < threshold)])].sort((a,b) => a-b);
  const segments = segmentBounds.slice(0,-1).map((start,i) => {
    const pool = eligibleAt(start), total = pool.reduce((n,r) => n+r.weight,0);
    return {expFromInclusive:start, expToExclusive:segmentBounds[i+1], totalWeight:total, chances:pool.map(r => ({row:r.row, operator:r.operator, exp:r.exp, probability:r.weight/total}))};
  });
  // Absorbing-state expectation: each click costs one item, excess discarded,
  // UpgradeToNextLevel absorbs immediately. Raw weights normalized among rows.
  const expected = Array(threshold + 1).fill(0);
  for (let exp = threshold - 1; exp >= 0; exp--) {
    const eligible = eligibleAt(exp), total = eligible.reduce((n,r) => n+r.weight,0);
    assert.ok(total > 0);
    expected[exp] = 1 + eligible.reduce((sum, outcome) => {
      const range = outcome.eligibleRange;
      assert.equal(range.MinValue.RangeOp, 'BoundInclusive');
      assert.equal(range.MaxValue.RangeOp, 'BoundExclusive');
      assert.ok(exp >= range.MinValue.RangeValue && exp < range.MaxValue.RangeValue);
      return sum + (outcome.operator === 'UpgradeToNextLevel' ? 0 : outcome.weight / total * expected[Math.min(threshold, exp + outcome.exp)]);
    }, 0);
  }
  const itemsPerClick = parseItems(conditions[`${node.EquipSlotEvolutionConditionPackID}_${level}`].ConsumedItems);
  cumulativeExp += threshold; cumulativeExpected += expected[0];
  computing.push({targetLevel: level, requiredExp: threshold, cumulativeExp, weightTotal, outcomes: probabilities, segments, itemsPerClick, expectedClicksModel: expected[0], cumulativeExpectedClicksModel: cumulativeExpected, maxClicksNoBonusModel: threshold});
}
const supportAssetPath = common + 'DataAsset/DA_OuterSpaceSupport.json';
const supportAsset = properties(supportAssetPath);
const supportModulesPath = common + 'DataTable/OuterSpaceSupport/DT_OuterSpaceSupportModule.json';
const supportModules = Object.entries(rows(supportModulesPath)).map(([id, r]) => {
  let cumulative = 0;
  const progression = [];
  for (let level = 1; level <= r.ModuleMaxLevel; level++) {
    const source = r.ModuleLevelData.find(v => Number(v.Key) === level - 1);
    assert.ok(source);
    const amount = source.Value.UpgradeItemAmount;
    assert.ok(Number.isInteger(amount) && amount > 0);
    cumulative += amount;
    progression.push({targetLevel: level, sourceLevelKey: source.Key, amount, cumulative});
  }
  return {id, nameRaw: r.ModuleText.SourceString, base: r.BaseModule, maxLevel: r.ModuleMaxLevel, progression};
});
const support = {upgradeItemId: supportAsset.UpgradeItemID, modules: supportModules, systemLevels: rows(common + 'DataTable/OuterSpaceSupport/DT_OuterSpaceSupportSystemLevel.json'), totalAllModules: supportModules.reduce((n, m) => n + m.progression.at(-1).cumulative, 0)};
const equipmentPath = overseas + 'Equipment/EquipmentDataTable_Overseas.json';
const equipmentRows = rows(equipmentPath);
const enhancePath = overseas + 'Equipment/EquipStrengthenDataTable_Overseas.json';
const families = {};
const legacyRoot = sitePaths.legacyDir;
const legacyCompositionSource = 'datamine2/gear/data/enhancement.json';
const legacyBytes = fs.readFileSync(path.join(legacyRoot, legacyCompositionSource));
const legacyComposition = JSON.parse(legacyBytes).families;
sources[`legacy:${legacyCompositionSource}`] = {sha256:crypto.createHash('sha256').update(legacyBytes).digest('hex'), usage:'Roster composition only; all costs re-extracted from raw.'};
for (const [row, r] of Object.entries(rows(enhancePath))) {
  const match = row.match(/^(.*)_(\d+)$/); assert.ok(match);
  (families[match[1]] ||= []).push({row, targetLevel: Number(match[2]), gold: r.NeedGolds, items: parseItems(r.NeedItems), needPlayerLevel: r.NeedPlayerLevel, needSuppressorLevel: r.NeedShenGeLevel});
}
const allGearTotal = {};
for (const [family, levels] of Object.entries(families)) {
  levels.sort((a, b) => a.targetLevel - b.targetLevel);
  const cumulative = {};
  levels.forEach((r, i) => {assert.equal(r.targetLevel, i + 1); add(cumulative, r.items); add(cumulative, {Gold: r.gold}); r.cumulative = {...cumulative};});
  const bindings = Object.entries(equipmentRows).filter(([, r]) => r.StrengthenPackID === family);
  const slots = [...new Set(bindings.map(([, r]) => r.EquipmentSlotType))];
  assert.ok(slots.length > 0);
  const composition = legacyComposition[family];
  assert.ok(composition && Number.isInteger(composition.slots_count));
  families[family] = {rawSlotEnums:slots, compositionSource:`legacy:${legacyCompositionSource}`, slots:composition.slots, slotCount:composition.slots_count, sourceRows: bindings.map(([id]) => id), progression: levels};
  add(allGearTotal, cumulative, composition.slots_count);
}
const starPath = overseas + 'Equipment/DT_EquipAdvance_Overseas.json';
const advancement = {};
for (const [row, r] of Object.entries(rows(starPath))) {
  const match = row.match(/^(.*)_(\d+)$/); assert.ok(match);
  (advancement[match[1]] ||= []).push({row, targetStar: Number(match[2]), requiredExp: r.NeedExp, needWorldLevel: r.NeedBigWorldLevel});
}
for (const list of Object.values(advancement)) {
  list.sort((a, b) => a.targetStar - b.targetStar); let sum = 0;
  for (const r of list) {sum += r.requiredExp; r.cumulativeExp = sum;}
}
const titanPath = common + 'DataTable/EquipDataTables/EquipTupoCostData.json';
const titanCosts = Object.fromEntries(Object.entries(rows(titanPath)).map(([pack, r]) => [pack, r.TupoCostMap.map(v => ({rule: v.Key, items: parseItems(v.Value.NeedItems), currencyType: v.Value.CostType, currency: v.Value.NeedGolds}))]));
const suppressorPath = overseas + 'Equipment/DT_Suppressor_Overseas.json';
const suppressorRows = rows(suppressorPath);
const suppressorTotal = {};
const suppressor = Object.entries(suppressorRows).sort(([a], [b]) => Number(a.replace('_', '.')) - Number(b.replace('_', '.'))).map(([row, r]) => {
  const items = {};
  for (const item of r.CostItemArr) add(items, {[item.ItemId]: item.ItemCount});
  if (r.CostItem && r.CostItem !== 'None' && r.ItemCostAmount) add(items, {[r.CostItem]: r.ItemCostAmount});
  add(suppressorTotal, items);
  return {row, version: r.SuppressorVersion.SourceString || row.replace('_', '.'), items, cumulative: {...suppressorTotal}, needPlayerLevel: r.NeedPlayerLevel, needScore: r.NeedScore, quest: r.CompleteQuest};
});
const itemPath = common + 'DataTable/Item/ItemConfigs.json';
const itemRows = rows(itemPath);
const itemIds = new Set([support.upgradeItemId, ...Object.keys(allGearTotal), ...Object.keys(suppressorTotal), ...computing.flatMap(r => Object.keys(r.itemsPerClick)), ...Object.values(titanCosts).flatMap(a => a.flatMap(r => Object.keys(r.items)))]);
const items = Object.fromEntries([...itemIds].filter(id => id !== 'Gold').map(id => {assert.ok(itemRows[id], id); return [id, {nameRaw: itemRows[id].ItemName.SourceString, sourceRow: id}];}));
const result = {schemaVersion: 1, auditedAt: '2026-10-03', rawClientVersion: null, sources, items, supercomputing: {bindingSource: computingAssetPath, nodeCount: Object.keys(nodes).length, nodes: Object.entries(nodes).map(([row, r]) => ({row, slot: r.EquipSlotType, maxLevel: r.EquipSlotEvolutionMaxLevel})), progression: computing, expectedModel: 'Normalize eligible raw weights; no carry across levels; instant upgrade absorbs. Native selection and carry unverified.'}, spaceSupport: support, equipment: {families, allSlotsMaxTotal: allGearTotal, starAdvancement: advancement, titanCosts}, suppressor: {progression: suppressor, total: suppressorTotal}};
const output = path.join(sitePaths.publicDir, 'game-data/build-progression-costs.json');
const text = JSON.stringify(result, null, 2) + '\n';
const marker = '<!-- generated-progression:start -->';
const table = (headers, values) => '| ' + headers.join(' | ') + ' |\n| ' + headers.map(() => '---').join(' | ') + ' |\n' + values.map(row => '| ' + row.join(' | ') + ' |').join('\n') + '\n';
const formatItems = values => Object.entries(values).map(([id, n]) => `${id}: ${n}`).join('; ') || '—';
const docs = {};
docs['supercomputing-progression.md'] = '\n## Table by level\n\n' + table(['Lv.', 'EXP', 'Σ EXP', 'E attempts¹', 'Σ E attempts¹'], computing.map(r => [r.targetLevel, r.requiredExp, r.cumulativeExp, r.expectedClicksModel.toFixed(3), r.cumulativeExpectedClicksModel.toFixed(3)])) + '\n¹ Calculated model without carrying over excess EXP.\n\n## All chance segments\n\n' + table(['Lv.', 'Current EXP', 'Chances from normalized weights'], computing.flatMap(r => r.segments.map(s => [r.targetLevel, `[${s.expFromInclusive},${s.expToExclusive})`, s.chances.map(c => `${c.operator === 'UpgradeToNextLevel' ? 'next level immediately' : '+' + c.exp}: ${(100*c.probability).toFixed(4)}%`).join('; ')])));
docs['space-support-costs.md'] = '\n## Cost of one module\n\n' + table(['Target Lv.', 'Cost', 'Σ'], supportModules[0].progression.map(r => [r.targetLevel, r.amount, r.cumulative])) + '\n## Modules in the export\n\n' + table(['Row ID', 'Raw name', 'BaseModule', 'Max Lv.', 'Σ cost'], supportModules.map(r => [r.id, r.nameRaw, String(r.base), r.maxLevel, r.progression.at(-1).cumulative]));
docs['suppressor-costs.md'] = '\n## All stages\n\n' + table(['Version / row', 'Cost', 'Σ', 'Player Lv.', 'CS', 'Quest'], suppressor.map(r => [r.version + ' / ' + r.row, formatItems(r.items), formatItems(r.cumulative), r.needPlayerLevel, r.needScore, r.quest]));
docs['gear-upgrade-costs.md'] = Object.entries(families).map(([id, family]) => '\n## ' + id + '\n\n' + table(['Target +Lv.', 'Materials', 'Gold', 'Σ materials and gold', 'Player Lv.', 'Suppressor'], family.progression.map(r => [r.targetLevel, formatItems(r.items), r.gold, formatItems(r.cumulative), r.needPlayerLevel, r.needSuppressorLevel || '—']))).join('') + '\n## Stars: EXP\n\n' + table(['Family', 'Target star', 'EXP', 'Σ EXP', 'World Lv.'], Object.entries(advancement).flatMap(([id, list]) => list.map(r => [id, r.targetStar, r.requiredExp, r.cumulativeExp, r.needWorldLevel]))) + '\n## Titan: cost per attempt by mode\n\n' + table(['Slot pack', 'Operation', 'Materials', 'Currency', 'Currency total'], Object.entries(titanCosts).flatMap(([id, list]) => list.map(r => [id, r.rule, formatItems(r.items), r.currencyType, r.currency])));
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(output, 'utf8'), text, 'Generated progression data is stale');
} else {
  fs.writeFileSync(output, text);
}
// The research tables in docs/tools/build are refreshed only from this repository.
for (const [name, generated] of Object.entries(sitePaths.writesRepoFixtures ? docs : {})) {
  const file = path.join(root, 'docs/tools/build', name);
  const original = fs.readFileSync(file, 'utf8');
  assert.equal(original.split(marker).length, 2);
  const updated = original.split(marker)[0] + marker + '\n' + generated;
  if (process.argv.includes('--check')) assert.equal(original, updated, `Stale documentation: ${name}`);
  else fs.writeFileSync(file, updated);
}
console.log(`Progression costs: ${computing.length} supercomputing levels, ${supportModules.length} support modules, ${Object.keys(families).length} gear families, ${suppressor.length} suppressor stages`);
