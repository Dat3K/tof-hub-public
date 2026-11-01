/**
 * Datasets the site reads through pipeline-generated, minified runtime projections
 * (`game-data/[<locale>/]runtime/<name>.json`). scripts/build-runtime-data.cjs writes per-locale
 * projections only for these; other materialized datasets stay generator inputs and are not served.
 */
export const RUNTIME_DATASETS: ReadonlySet<string> = new Set([
  'simulacra', 'matrices', 'relics', 'pets', 'food', 'food-mmo', 'cosmetics', 'arts',
  'fce', 'oow', 'bygone', 'seq', 'multype', 'items', 'items-mmo', 'wish-banners',
  'build-page', 'optimizer-demo', 'hub-summary', 'main-hub', 'version-tracker',
  'fce-cards', 'handbook', 'supercomputing', 'weapon-growth', 'weapon-options',
  'build-reference', 'server-list',
]);
