const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Compare native coefficients/curves with the supplied calculation, without
// treating either candidate as proof of the client's CS evaluation function.
const raw = process.argv[2];
if (!raw) throw new Error('Usage: node scripts/checks/audit-titan-cs.cjs <raw-export-root>');
const sources = [];
function rows(relativePath) {
  const bytes = fs.readFileSync(path.join(raw, relativePath));
  sources.push({ path: relativePath, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  return JSON.parse(bytes.toString('utf8'))[0].Rows;
}
const weights = rows('Hotta/Content/Resources/CoreBlueprints/DataTable/AttributeStaticDataTable.json');
const effects = rows('Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/RedEquipmentAttrDataTable_Overseas.json');
const displays = rows('Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/RedEquipmentAttrShowDataTable_Overseas.json');
const observations = require('../data/build-titan-observations.json');
function evaluate(row, level) {
  if (row.InterpMode !== 'RCIM_Linear') throw new Error('Unsupported curve interpolation');
  const keys = row.Keys;
  const right = keys.findIndex(key => key.Time >= level);
  if (right < 0) return keys.at(-1).Value;
  if (right === 0) return keys[0].Value;
  const a = keys[right - 1], b = keys[right];
  return a.Value + (b.Value - a.Value) * (level - a.Time) / (b.Time - a.Time);
}
const items = observations.items.map(item => {
  const rawWeight = weights[item.id].Value;
  const levels = Array.from({ length: 18 }, (_, index) => {
    const level = index + 1;
    const internalValue = evaluate(effects[item.id], level);
    const displayPercent = evaluate(displays[item.id], level);
    return { level, internalValue, displayPercent,
      nativeCandidateCS: internalValue * rawWeight,
      currentModelCS: displayPercent / 100 * item.calculatedCSWeightPerFraction,
      suppliedCalculatedCS: item.calculatedCS[index] };
  });
  return { id: item.id, rawWeight, uncommon: weights[item.id].IsUncommon,
    currentWeight: item.calculatedCSWeightPerFraction,
    maxAbsoluteModelDifference: Math.max(...levels.map(value => Math.abs(value.nativeCandidateCS - value.currentModelCS))),
    levels };
});
console.log(JSON.stringify({ status: 'Candidate comparison; native CS call site and rounding unverified', sources, items }, null, 2));
