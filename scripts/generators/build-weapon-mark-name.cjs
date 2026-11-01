const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// In-game name of the Nan Yin weapon mark (EN "Inhabit", RU "Касание Тьмы") from the game's localization.
// Key: the global (non-MMO) Nan Yin namespace; `NanyinDes_MMO` carries the MMO wording (RU "Вселение").
// Standalone: `node scripts/generators/build-weapon-mark-name.cjs` patches generated build-page.json and the test fixture.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const DEFAULT_RAW=require('node:path').resolve('pipeline/raw');
const NAMESPACE='NanyinDes',KEY='Buff_NanYinSuperPower_SSR_Level0_JiSu_name';
function generate({raw=sitePaths.rawDir}={}) {
  const text=locale=>{
    const value=JSON.parse(readGameSourceFileSync(path.join(raw,`Hotta/Content/Localization/Game/${locale}/Game.json`),'utf8'))[NAMESPACE]?.[KEY];
    if(typeof value!=='string'||!value.trim())throw new Error(`Missing weapon mark name: ${NAMESPACE}/${KEY} (${locale})`);
    return value.trim();
  };
  return {en:text('en'),ru:text('ru'),source:`Hotta/Content/Localization/Game/{en,ru}/Game.json#${NAMESPACE}/${KEY}`};
}
module.exports=generate;
if(require.main===module) {
  const web=sitePaths.webDir;
  const name=generate();
  for(const file of [path.join(sitePaths.publicDir,'game-data/build-page.json'),...(sitePaths.writesRepoFixtures?[path.join(web,'src/features/build/__fixtures__/catalog.json')]:[])]) {
    if(!fs.existsSync(file))continue;
    const text=readGameSourceFileSync(file,'utf8'),catalog=JSON.parse(text);
    catalog.weaponMark.name=name;
    fs.writeFileSync(file,JSON.stringify(catalog,null,file.includes('__fixtures__')?2:0)+'\n');
  }
  console.log('Weapon mark name:',name.en,'/',name.ru);
}
