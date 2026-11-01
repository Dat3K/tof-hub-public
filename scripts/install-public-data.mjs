import fs from 'node:fs';
import path from 'node:path';
const source=path.resolve(process.argv[2]??'ignore/export/public');
const target=path.resolve('apps/web/public');
if(source===target||source.startsWith(target+path.sep)||target.startsWith(source+path.sep))throw new Error('Source and destination must be independent directories');
for(const name of ['game-data/release-manifest.json','game-data/en/simulacra.json','game-data/ru/simulacra.json']) {
  const file=path.join(source,name);
  if(!fs.existsSync(file))throw new Error('Incomplete pipeline output: '+name);
  JSON.parse(fs.readFileSync(file,'utf8'));
}
fs.mkdirSync(target,{recursive:true});
fs.cpSync(source,target,{recursive:true});
console.log('Installed validated pipeline output. For delta releases use the exporter apply-update command.');
