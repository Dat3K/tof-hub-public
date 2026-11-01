// Independent migration comparisons and boundary checks, not native RNG tests.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
execFileSync(process.execPath, [path.join(__dirname, '../generators/build-progression-costs.cjs'), '--check'], {cwd:root});
const data = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/public/game-data/build-progression-costs.json')));
const legacyRoot = sitePaths.legacyDir;
const legacy = name => JSON.parse(fs.readFileSync(path.join(legacyRoot, 'datamine2/gear/data', name + '.json')));
const enhancement = legacy('enhancement');
let gearChecks = 0, supportChecks = 0, suppressorChecks = 0;
for (const [id, family] of Object.entries(data.equipment.families)) {
  for (const row of family.progression) {
    const old = enhancement.families[id].levels.find(r => r.level === row.targetLevel);
    assert.equal(row.gold, old.gold);
    assert.deepEqual(row.items, Object.fromEntries(old.items.map(r => [r.id, r.count])));
    assert.deepEqual(Object.fromEntries(Object.entries(row.cumulative).filter(([key]) => key !== 'Gold')), old.cum_items);
    assert.equal(row.cumulative.Gold, old.cum_gold);
    gearChecks++;
  }
}
const support = legacy('space-support');
for (const module of data.spaceSupport.modules) {
  const old = support.modules.find(m => m.id === module.id);
  assert.ok(old);
  for (const row of module.progression) {
    const entry = old.levels.find(r => r.level === row.targetLevel);
    assert.equal(row.amount, entry.chip_cost);
    assert.equal(row.cumulative, entry.cum_chips);
    supportChecks++;
  }
}
const suppressors = legacy('suppressors');
for (const row of data.suppressor.progression) {
  const old = suppressors.tiers.find(r => r.id === row.row);
  assert.ok(old);
  assert.deepEqual(row.items, Object.fromEntries(old.cost_items.map(r => [r.id, r.count])));
  suppressorChecks++;
}
const computing = data.supercomputing.progression;
assert.equal(computing[3].segments.length, 2);
assert.equal(computing[3].segments[1].expFromInclusive, 68);
assert.equal(computing[3].segments[1].totalWeight, 101);
assert.ok(computing[3].segments[0].chances.every(r => r.operator !== 'UpgradeToNextLevel'));
assert.equal(computing[10].segments[0].chances[1].probability, 0.05);
assert.ok(computing.slice(15).every(r => r.segments[0].chances.length === 1 && r.expectedClicksModel === r.requiredExp));
for (const level of computing) for (const segment of level.segments) {
  assert.ok(Math.abs(segment.chances.reduce((sum,r) => sum+r.probability,0)-1) < 1e-12);
  assert.ok(level.expectedClicksModel <= level.maxClicksNoBonusModel);
}
console.log(`PASS: ${gearChecks} gear levels, ${supportChecks} support transitions, ${suppressorChecks} suppressor tiers match legacy costs; computing range/weight boundaries and deterministic late levels verified.`);
