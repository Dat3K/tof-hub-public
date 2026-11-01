const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Independent, transcribed user evidence; production values remain pipeline-generated.
const observations = require('../data/build-titan-observations.json');
const reference = JSON.parse(fs.readFileSync(path.join(__dirname, '../../apps/web/public/game-data/build-reference.json'), 'utf8'));
function interpolate(curve, level) {
  const right = curve.findIndex(point => point.level >= level);
  assert(right >= 0, `Missing curve coverage at level ${level}`);
  if (right === 0) return curve[0].value;
  const a = curve[right - 1], b = curve[right];
  return a.value + (b.value - a.value) * (level - a.level) / (b.level - a.level);
}
let checked = 0;
for (const observation of observations.items) {
  const item = reference.titanRare.items.find(item => item.id === observation.id);
  assert(item, `Missing property ${observation.id}`);
  assert.equal(observation.displayPercent.length, 18);
  assert.equal(observation.calculatedCS.length, 18);
  for (let index = 0; index < 18; index++) {
    const level = index + 1;
    const percent = interpolate(item.displayCurve, level) * 100;
    assert(Math.abs(percent - observation.displayPercent[index]) <= 0.000501,
      `${item.id} level ${level}: display ${percent}, evidence ${observation.displayPercent[index]}`);
    // Check the supplied calculation, not the game's unverified CS rounding.
    const cs = observation.displayPercent[index] / 100 * observation.calculatedCSWeightPerFraction;
    assert(Math.abs(cs - observation.calculatedCS[index]) <= 0.05001,
      `${item.id} level ${level}: calculated CS ${cs}, evidence ${observation.calculatedCS[index]}`);
    checked++;
  }
  const slots = Object.entries(reference.titanRare.pools)
    .filter(([, ids]) => ids.includes(item.id)).map(([slot]) => slot).sort();
  assert.deepEqual(slots, [...observation.slots].sort(), `${item.id}: eligible slots`);
}
console.log(`Verified ${checked} Titan display values, ${checked} supplied CS calculations and 12 slot pools.`);
