// Audit source observations and raw bindings; does not claim native damage simulation.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const observation = JSON.parse(fs.readFileSync('scripts/data/build-resistance-ignore-observations.json', 'utf8'));
const cells = observation.sheets.Resists;
const value = key => typeof cells[key].value === 'string' ? parseFloat(cells[key].value) / 100 : cells[key].value;
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const k = 14106;
const r0 = k * value('B2') / (1 - value('B2'));
near(r0, value('B3'), 1e-5);
const r1 = Math.ceil(r0 * (1 - value('B5')));
const m1 = r1 / (k + r1);
const r2 = Math.ceil(r1 * (1 - value('B12')));
const m2 = r2 / (k + r2);
near(r1, value('B6')); near(m1, value('B7'));
near(r2, value('B13')); near(m2, value('B14'));
near((1 - m1) / (1 - value('B2')) - 1, value('B9'));
near((1 - m2) / (1 - m1) - 1, value('B16'));
near((1 - m2) / (1 - value('B2')) - 1, value('B19'));
near(value('B2') - m2, value('B18'));
near(m2 + (1 - m2) * value('I3'), value('J3'));
near(value('J3') + (1 - value('J3')) * value('I4'), value('J4'));
const grid = observation.sheets['Resist Ignore dmg impact'];
let checked = 0;
for (let row = 3; row <= 17; row++) {
  const mitigation = grid[`A${row}`]?.value;
  if (typeof mitigation !== 'number') continue;
  for (const col of ['B', 'C', 'D', 'E', 'F']) {
    const expected = grid[`${col}${row}`]?.value;
    if (typeof expected !== 'number') continue;
    const ignore = grid[`${col}2`].value;
    near(mitigation * ignore / (1 - mitigation * ignore), expected);
    checked++;
  }
}
assert.equal(checked, 75);
const rawRoot = sitePaths.rawDir;
const raw = file => JSON.parse(fs.readFileSync(path.join(rawRoot, 'Hotta/Content/Resources', file), 'utf8'));
const attrs = raw('CoreBlueprints/DataTable/AttributeStaticDataTable.json')[0].Rows;
assert.equal(attrs.FireDefIgnore.bShowPercent, false);
assert.equal(attrs.FireDefIgnore.AttributeDescFunction, 'GetActualFireDefIgnore');
assert.equal(attrs.FireDefIgnoreMult.bShowPercent, true);
const nora = raw('Abilities/Buff/Player/WeaponSSR/Nora/Level3/Buff_Nora_SSR_Level3.json')
  .find(o => o.Name === 'Default__Buff_Nora_SSR_Level3_C').Properties.Modifiers;
for (const prefix of ['Thunder', 'Ice', 'Phy', 'Fire', 'Superpower']) {
  const modifier = nora.find(m => m.Attribute.AttributeName === `${prefix}DefIgnoreMult`);
  assert.equal(modifier.ModifierOp, 'EGameplayModOp::Additive');
  assert.equal(modifier.ModifierMagnitude.ScalableFloatMagnitude.Curve.RowName, 'NoraLevel3_IgnoreCommonDefRate');
}
assert.equal(raw('CoreBlueprints/DataTable/EffectFigure/NoraEffectFigure.json')[0].Rows.NoraLevel3_IgnoreCommonDefRate.Keys[0].Value, 0.15);
const shred = raw('Abilities/Buff/Common/Share/Buff_IceDefDown_Infnity.json')
  .find(o => o.Name === 'Default__Buff_IceDefDown_Infnity_C').Properties.Modifiers[0];
assert.equal(shred.Attribute.AttributeName, 'IceDefMult');
assert.equal(shred.ModifierOp, 'EGameplayModOp::Additive');
assert.equal(shred.ModifierMagnitude.ScalableFloatMagnitude.Value, -0.01);
console.log(`PASS: two-stage source calculation, ${checked} grid values, raw ignore/shred attributes and modifiers.`);
