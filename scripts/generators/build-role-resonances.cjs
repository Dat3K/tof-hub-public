const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// Weapon-role resonances (Attack / Fortitude / Benediction / Balance): names and effect text from the game's localization.
// Standalone: `node scripts/generators/build-role-resonances.cjs` patches generated build-page.json and the test fixture without a full catalog rebuild.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');
const DEFAULT_RAW=require('node:path').resolve('pipeline/raw');
// UI/weaponoccupation{N}: 1 Balance, 2 Fortitude (defense), 3 Attack (DPS), 4 Benediction (support).
const ROLES=[{id:'balance',n:1},{id:'tank',n:2},{id:'dps',n:3},{id:'healer',n:4}];
const ICONS={tank:'Hotta/Content/Resources/UI/wuqi/icon_fangyu',healer:'Hotta/Content/Resources/UI/wuqi/icon_zengyi',dps:'Hotta/Content/Resources/UI/wuqi/icon_qianggong',balance:'Hotta/Content/Resources/UI/AutoChess/buff_junheng'};
const clean=text=>text.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
function table(file) {
  const out=new Map();
  const walk=(node,prefix)=>{
    if(typeof node==='string')out.set(prefix,node);
    else if(node&&typeof node==='object')for(const [key,value] of Object.entries(node))walk(value,prefix+'/'+key);
  };
  walk(JSON.parse(readGameSourceFileSync(file,'utf8')),'');
  return out;
}
function generate({raw=sitePaths.rawDir}={}) {
  const source='Hotta/Content/Localization/Game/{en,ru}/Game.json';
  const tables={en:table(path.join(raw,'Hotta/Content/Localization/Game/en/Game.json')),ru:table(path.join(raw,'Hotta/Content/Localization/Game/ru/Game.json'))};
  const text=(locale,key)=>{
    const value=tables[locale].get('/UI/'+key);
    if(value===undefined)throw new Error('Missing role resonance text: '+key+' ('+locale+')');
    return clean(value);
  };
  const both=key=>({en:text('en',key),ru:text('ru',key)});
  const items=ROLES.map(({id,n})=>({id,gameKey:'weaponoccupation'+n,icon:'/game-assets/webp/'+ICONS[id]+'.webp',name:both(`weaponoccupation${n}_name`),
    description:both(`weaponoccupation${n}_tips`),teamDescription:both(`weaponoccupation${n}_balance_tips`)}));
  return {source,items};
}
module.exports=generate;
if(require.main===module) {
  const web=sitePaths.webDir;
  const result=generate();
  for(const file of [path.join(sitePaths.publicDir,'game-data/build-page.json'),...(sitePaths.writesRepoFixtures?[path.join(web,'src/features/build/__fixtures__/catalog.json')]:[])]) {
    if(!fs.existsSync(file))continue;
    const catalog=JSON.parse(readGameSourceFileSync(file,'utf8'));
    catalog.roleResonances=result;
    fs.writeFileSync(file,JSON.stringify(catalog,null,file.endsWith('catalog.json')&&file.includes('__fixtures__')?2:0)+'\n');
    console.log('Patched',path.relative(process.cwd(),file));
  }
}
