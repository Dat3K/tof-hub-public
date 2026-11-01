'use strict';

// Literal lazy requires are bundled into the portable exporter. Keep this JS
// boundary separate from the legacy processors' own TypeScript configuration.
exports.normalizeGameData = options => require('../normalize-game-data/index.ts').normalizeGameData(options);
exports.buildDataManifest = options => require('../build-data-manifest/index.ts').buildDataManifest(options);
exports.validateGeneratedData = options => require('../validate-generated/index.ts').validateGeneratedData(options);
exports.buildRuntimeData = root => require('../generators/build-runtime-data.cjs').buildRuntimeData(root);
