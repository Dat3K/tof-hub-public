// Character-title presentation for the /tools/build/ and /tools/build/mmo/ profile header: the
// game text colour of every title (DT_Title.Color) and, for titles the game draws as a decorated
// widget (DT_Title.WidgetTitleClass), the plate art of the matching Info cosmetic item.
// Provenance: docs/game-data/cosmetics.md.
const sitePaths=require('../lib/site-paths.cjs');
const fs=require('node:fs');
const path=require('node:path');

const RAW=sitePaths.rawDir;
const PUBLIC=sitePaths.publicDir;
const TABLES=['DT_Title','DT_Title_Balance'].map(name=>`Hotta/Content/Resources/CoreBlueprints/DataTable/Title/${name}.json`);

const media=url=>{
  if(!url)return null;
  return [url,url.replace('/datamine/shared/media/','/game-assets/webp/')].find(u=>fs.existsSync(path.join(PUBLIC,u)))||null;
};

function rowsOf(relative) {
  const file=path.join(RAW,relative);
  if(!fs.existsSync(file))return null;
  const object=JSON.parse(fs.readFileSync(file,'utf8')).find(entry=>entry.Rows);
  if(!object)throw new Error(`Missing rows in ${relative}`);
  return object.Rows;
}

const tables=TABLES.map(relative=>({relative,rows:rowsOf(relative)})).filter(table=>table.rows);
if(!tables.length)console.warn('[build-title-styles] DT_Title is missing from the raw export; titles keep the plain text style');
// The balance table repeats DT_Title and adds rows; its values win where both define a title.
const rows=Object.assign({},...tables.map(table=>table.rows));
const cosmetics=JSON.parse(fs.readFileSync(path.join(PUBLIC,'en/cosmetics.json'),'utf8')).titles;
const icons=new Map(cosmetics.map(item=>[item.id,item.icon]));

// The most common colour is the table default: plain titles in it keep the card's white text, only plates keep it.
const counts=new Map();
for(const row of Object.values(rows)){const hex=row.Color?.SpecifiedColor?.Hex;if(hex)counts.set(hex,(counts.get(hex)??0)+1);}
const defaultHex=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
const titles={};
for(const [id,row] of Object.entries(rows)) {
  const widget=row.WidgetTitleClass?.AssetPathName;
  const icon=icons.get(`Title_${id}`);
  const plate=widget&&widget!=='None'&&/chenghao/i.test(icon||'')?media(icon):null;
  const hex=row.Color?.SpecifiedColor?.Hex===defaultHex&&!plate?null:row.Color?.SpecifiedColor?.Hex;
  if(!hex&&!plate)continue;
  titles[id]={...(hex?{color:`#${hex}`}:{}),...(plate?{plate}:{})};
}

const output={schemaVersion:1,sources:tables.map(table=>table.relative),titles};
const target=path.join(PUBLIC,'game-data/build-title-styles.json');
fs.writeFileSync(target+'.tmp',JSON.stringify(output)+'\n');
fs.renameSync(target+'.tmp',target);
console.log(`Generated build-title-styles.json (${Object.keys(titles).length} titles, ${Object.values(titles).filter(t=>t.plate).length} plates)`);
