const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// In-game title names of every published culture (capture-card-map.json carries only EN/RU): DT_Title.<code>.Name
// (TableId + Key) resolved in Localization/Game/<culture>/Game.json. A title a culture does not translate keeps the
// existing text (the English fallback of docs/architecture/localization.md); nothing is translated by display string.
const sitePaths = require('../lib/site-paths.cjs');
const path = require('node:path');
const CULTURES = ['en', 'ru', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'];
const DT_TITLE = 'Hotta/Content/Resources/CoreBlueprints/DataTable/Title/DT_Title.json';
module.exports = function titleNames({titles, raw = sitePaths.rawDir}) {
  const rows = JSON.parse(readGameSourceFileSync(path.join(raw, DT_TITLE), 'utf8'))[0].Rows;
  const games = Object.fromEntries(CULTURES.map(culture => [culture, JSON.parse(readGameSourceFileSync(path.join(raw, `Hotta/Content/Localization/Game/${culture}/Game.json`), 'utf8'))]));
  const result = {};
  for (const [code, current] of Object.entries(titles)) {
    const name = rows[code]?.Name, namespace = name?.TableId?.split('.').at(-1);
    result[code] = {...current};
    if (!name?.Key || !namespace) continue;
    for (const culture of CULTURES) {
      const text = games[culture][namespace + '_MMO']?.[name.Key] ?? games[culture][namespace]?.[name.Key];
      if (typeof text === 'string' && text.trim()) result[code][culture] = text.trim();
    }
  }
  return result;
};
// Standalone: `node scripts/generators/build-title-names.cjs` patches generated build-page.json (and the test fixture) in place.
if (require.main === module) {
  const fs = require('node:fs');
  for (const file of [path.join(sitePaths.publicDir, 'game-data/build-page.json'), ...(sitePaths.writesRepoFixtures ? [path.join(sitePaths.webDir, 'src/features/build/__fixtures__/catalog.json')] : [])]) {
    if (!fs.existsSync(file)) continue;
    const catalog = JSON.parse(readGameSourceFileSync(file, 'utf8'));
    if (!catalog.titles) continue;
    catalog.titles = module.exports({titles: catalog.titles});
    fs.writeFileSync(file, JSON.stringify(catalog, null, file.includes('__fixtures__') ? 2 : 0) + '\n');
    console.log('Title names:', path.relative(process.cwd(), file));
  }
}
