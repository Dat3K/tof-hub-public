const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// Space Support manual reset cooldown, read from the in-game rules text (no numeric DataTable field exists).
// Standalone: `node scripts/generators/build-support-reset.cjs` patches generated build-page.json and the test fixture without a full catalog rebuild.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const DEFAULT_RAW=require('node:path').resolve('pipeline/raw');
const DESCRIPTION='Hotta/Content/Resources/CoreBlueprints/DataTable/DescriptionDataTable.json';
const LOCALIZATION='Hotta/Content/Localization/Game/{en,ru}/Game.json';
// Rule 4 of OSSS_des states the period twice (reset interval and cooldown); every language must agree.
const PATTERNS={
  zh:[/每(\d+)天可进行一次模块等级重置/,/(\d+)天冷却时间内将无法再次重置/],
  en:[/reset every (\d+) days/,/within the (\d+)-day cooldown/],
  ru:[/каждые (\d+) дней/,/в течение (\d+)-дневного периода/],
};
function generate({raw=sitePaths.rawDir}={}) {
  // This rule compares the original English and Russian texts. Locale-projection
  // generator runs must not redirect the English source to their target locale.
  const read=file=>JSON.parse(fs.readFileSync(path.join(raw,file),'utf8'));
  const description=read(DESCRIPTION);
  const row=(Array.isArray(description)?description[0]:description).Rows.OSSS_des;
  if(!row)throw new Error('Missing DescriptionDataTable row OSSS_des');
  const texts={zh:row.Description.SourceString};
  for(const locale of ['en','ru']) {
    const text=read(LOCALIZATION.replace('{en,ru}',locale)).UI?.[row.Description.Key];
    if(typeof text!=='string')throw new Error(`Missing localization UI/${row.Description.Key} (${locale})`);
    texts[locale]=text;
  }
  const days=Object.entries(PATTERNS).flatMap(([locale,patterns])=>patterns.map(pattern=>{
    const match=pattern.exec(texts[locale]);
    if(!match)throw new Error(`Space Support reset period not found in ${locale}: ${pattern}`);
    return Number(match[1]);
  }));
  if(new Set(days).size!==1)throw new Error('Space Support reset periods disagree: '+days.join(', '));
  return {cooldownDays:days[0],source:`${DESCRIPTION} Rows.OSSS_des.Description (${row.Description.Key}), rule 4; ${LOCALIZATION} UI.${row.Description.Key}`};
}
module.exports=generate;
if(require.main===module) {
  const web=sitePaths.webDir;
  const reset=generate();
  for(const file of [path.join(sitePaths.publicDir,'game-data/build-page.json'),...(sitePaths.writesRepoFixtures?[path.join(web,'src/features/build/__fixtures__/catalog.json')]:[])]) {
    if(!fs.existsSync(file))continue;
    const catalog=JSON.parse(readGameSourceFileSync(file,'utf8'));
    catalog.support.reset=reset;
    fs.writeFileSync(file,JSON.stringify(catalog,null,file.includes('__fixtures__')?2:0)+'\n');
    console.log('Patched',path.relative(process.cwd(),file));
  }
}
