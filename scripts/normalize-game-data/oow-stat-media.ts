import fs from 'node:fs';
import path from 'node:path';
import { loadSharp } from '../_shared/sharp';

// UI selections approved by the user; paths identify original game textures.
const sources = {
  hp: 'Hotta/Content/Resources/UI/AttributeIcon/icon_hp.png',
  atk: 'Hotta/Content/Resources/UI/AttributeIcon/icon_atk.png',
  armor: 'Hotta/Content/Resources/Icon/buff/buff_AddPowerImm.png',
  crit: 'Hotta/Content/Resources/Icon/new_debuff/debuff_dizzy.png',
};
export const oowStatIcons = Object.fromEntries(Object.entries(sources).map(([id, source]) =>
  [id, `/game-assets/webp/${source.replace(/\.png$/, '.webp')}`],
));

export async function generateOowStatMedia(raw: string, publicRoot: string) {
  const sharp = loadSharp();
  const assets = Object.entries(sources).map(([id, source]) => ({ id, source, url: oowStatIcons[id], processing: 'webp-lossless' }));
  // Validate the entire input manifest before writing any output.
  for (const asset of assets) {
    if (!fs.existsSync(path.join(raw, asset.source))) throw new Error(`Missing OoW stat texture: ${asset.source}`);
    const relative = path.relative(path.resolve(raw), path.resolve(publicRoot, `.${asset.url}`));
    if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error('OoW media output must stay outside raw exports');
  }
  for (const asset of assets) {
    const target = path.join(publicRoot, asset.url);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(path.join(raw, asset.source)).webp({ lossless: true }).toFile(target);
  }
  const manifest = path.join(publicRoot, 'game-data/oow-stat-media.json');
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, JSON.stringify({ schemaVersion: 1, assets }, null, 2) + '\n');
}
