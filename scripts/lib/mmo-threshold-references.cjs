'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

/** Historical raw projections remain separate from the active export; exact property ids are never aliased. */
function withThresholdReferences(catalog, dataDir) {
  const dir = path.join(dataDir, 'mmo-threshold-references');
  const thresholds = catalog.thresholds.filter(track => !track.reference);
  const seen = new Set(thresholds.map(track => track.prop));
  const thresholdReferences = {};
  if (fs.existsSync(dir)) for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.json')).sort()) {
    const reference = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.equal(reference.schemaVersion, 1, `threshold reference ${file}`);
    thresholdReferences[reference.id] = {sources: reference.sources, region: reference.region, version: reference.version};
    for (const track of reference.thresholds) {
      assert.ok(track.prop && track.attribute && track.levels.every(level => Number.isFinite(level.value)), `invalid threshold ${file}`);
      if (seen.has(track.prop)) continue;
      thresholds.push({...track, reference: reference.id});
      seen.add(track.prop);
    }
  }
  return {...catalog, thresholds, thresholdReferences};
}
module.exports = {withThresholdReferences};
