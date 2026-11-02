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
for (const file of ['runtime/ranking-page.json','handbook/runtime/raid-rankings.json']) {
  const full=`${webRoot}/public/game-data/${file}`;
  if(!fs.existsSync(full))throw new Error(`Missing ${file}. Run pnpm generate:runtime-data against the installed bootstrap before building; see docs/architecture/runtime-data.md.`);
  JSON.parse(fs.readFileSync(full,'utf8'));
}
console.log('Build-time manifests and runtime catalogs are available. Game-data generation remains a separate pipeline step.');
