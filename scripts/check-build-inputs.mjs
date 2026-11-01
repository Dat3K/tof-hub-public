import fs from 'node:fs';
const webRoot=fs.existsSync('apps/web/package.json')?'apps/web':'.';
for (const file of ['postcss.config.js','tailwind.config.js']) {
  if(!fs.existsSync(webRoot+'/'+file))throw new Error('Missing web build configuration: '+file);
}
for (const file of ['relic-resistance-icons.json','wish-demo-banners.json','wish-demo-profile.json']) {
  const path='apps/web/public/game-data/'+file;
  const relative=fs.existsSync(path)?path:'public/game-data/'+file;
  if(!fs.existsSync(relative))throw new Error('Missing '+file+'. Restore the matching bootstrap artifact or generate game data; see README.md.');
  JSON.parse(fs.readFileSync(relative,'utf8'));
}
console.log('Build-time manifests are available. Game-data generation remains a separate pipeline step.');
