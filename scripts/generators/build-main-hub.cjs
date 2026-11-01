// Compose homepage art from the existing generated summary; no independent roster or media guesses.
const fs = require('node:fs');
const path = require('node:path');
const {publicDir} = require('../lib/site-paths.cjs');
const {gameAsset} = require('../../packages/game-assets/src/index.ts');
const read = (name) => JSON.parse(fs.readFileSync(path.join(publicDir, 'game-data', name), 'utf8'));
// Docker builds deliberately exclude game datasets; the mounted runtime pipeline supplies art.
const summary = fs.existsSync(path.join(publicDir, 'game-data/hub-summary.json')) ? read('hub-summary.json') : null;
const simulacra = fs.existsSync(path.join(publicDir, 'game-data/en/simulacra.json')) ? read('en/simulacra.json') : null;
const latest = simulacra?.gacha.find((item) => item.slug === summary?.info.simulacra.gacha[0]?.slug);
const boss = summary?.datamine.oow.mmo.seasons.at(-1)?.boss;
const art = {
  info: latest?.card || latest?.detail_art || null,
  tools: summary?.tools.wish?.image ?? null,
  datamine: boss?.image ?? null,
};
for (const key of Object.keys(art)) {
  const image = art[key];
  if (image && !fs.existsSync(path.join(publicDir, image))) art[key] = gameAsset(image);
}
for (const image of Object.values(art)) {
  if (!process.env.TOF_PUBLIC_DIR && image && !fs.existsSync(path.join(publicDir, image))) throw new Error(`Missing main hub image: ${image}`);
}
fs.mkdirSync(path.join(publicDir, 'game-data'), {recursive: true});
const target = path.join(publicDir, 'game-data/main-hub.json');
const contents = JSON.stringify({schemaVersion: 1, art}, null, 2) + '\n';
if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents) {
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, contents);
    try {
      fs.renameSync(temporary, target);
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      // Windows file watchers may briefly hold the destination open.
      fs.copyFileSync(temporary, target);
    }
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
