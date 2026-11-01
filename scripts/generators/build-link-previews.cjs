'use strict';
// Only projects the already normalized English datasets. No independent game facts or art paths.
const fs = require('node:fs');
const path = require('node:path');
const {publicDir} = require('../lib/site-paths.cjs');
const root = path.join(publicDir, 'game-data');
const read = file => {
  const target = path.join(root, `${file}.json`);
  return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, '')) : null;
};
const list = value => Array.isArray(value) ? value : [];
// Metadata needs plain text, not an HTML renderer. Preserve the values already localized by the pipeline.
function plain(value, max = 180) {
  if (typeof value !== 'string') return '';
  const named = {amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' '};
  const text = value.replace(/<[^>]*>/g, ' ').replace(/&#x([a-f\d]+);|&#(\d+);|&(amp|quot|apos|lt|gt|nbsp);/gi, (match, hex, dec, key) => {
    if (key) return named[key.toLowerCase()];
    const cp = parseInt(hex || dec, hex ? 16 : 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '';
  }).replace(/<[^>]*>/g, ' ').replace(/\{\d+\}/g, '').replace(/\s+/g, ' ').trim();
  if (!text || /[\u3400-\u9fff\u0400-\u04ff]/u.test(text)) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[ ,;:]+$/, '') + '…';
}
const entities = new Map();
function add(section, param, row, extra = {}, options = {}) {
  const id = String(options.id ?? row.id ?? row.slug ?? '');
  if (!id) return;
  const title = plain(options.title ?? row.name_en ?? row.name ?? row.title, 100);
  if (!title) return;
  const description = plain(options.description ?? row.desc_en ?? row.description_en ?? row.description ?? row.desc ?? row.effect_text) || `${title}. ${section} in Tower of Fantasy.`;
  const image = options.image ?? row.detail_art ?? row.drawing ?? row.photo ?? row.suit_portrait ?? row.webpUrl ?? row.icon ?? row.image;
  const params = new URLSearchParams({...extra, [param]: id});
  const href = `${options.route || `/info/${section.toLowerCase()}/`}?${params}`;
  const aliases = [...new Set([row.slug, row.canonical_id, row.originalFileName, ...list(options.aliases)].filter(v => v != null).map(String))].filter(v => v !== id);
  entities.set(href, {path:href, title, description, ...(typeof image === 'string' && image.startsWith('/') && !image.startsWith('//') ? {image} : {}), section, ...(aliases.length ? {aliases} : {})});
}
const sim = read('en/simulacra');
for (const mode of ['gacha', 'mmo']) for (const r of list(sim?.[mode])) {
  const facts = [r.rarity, [r.element, r.element_secondary].filter(Boolean).join(' / '), r.role, r.weapon_name_en || r.weapon_name].filter(Boolean).join(' · ');
  add('Simulacra', 'char', r, {server:mode}, {description:`${facts}. ${mode === 'mmo' ? 'MMO' : 'Standard'} character profile, skills and advancements.`});
}
for (const r of list(read('en/matrices')?.items)) add('Matrices', 'suit', r, {}, {description:r.effects?.map(e => e.stars?.[0]?.text).filter(Boolean).join(' ')});
const relics = read('en/relics');
for (const mode of ['gacha', 'mmo']) for (const r of list(relics?.[mode])) add('Relics', 'relic', r, {server:mode});
const pets = read('en/pets');
for (const r of list(pets?.items)) add('Pets', 'pet', r, {server:r.source_edition === 'mmo' ? 'mmo' : 'gacha'});
for (const r of list(pets?.module_families)) add('Pets', 'module', r, {category:'modules'}, {id:r.family_id || r.id, description:r.levels?.[0]?.description_en || r.levels?.[0]?.desc_en});
for (const mode of ['gacha', 'mmo']) {
  const food = read(mode === 'mmo' ? 'en/food-mmo' : 'en/food');
  for (const [key, view] of [['items','dishes'], ['ingredients','ingredients'], ['potions','potions']]) {
    for (const r of list(food?.[key])) add('Food', 'item', r, {server:mode, view}, {description:r.effect_text || r.description_en || r.description});
  }
}
for (const r of list(read('en/cosmetics')?.items)) add('Cosmetics', 'outfit', r, {type:r.category});
for (const r of list(read('en/arts')?.items)) add('Arts', 'art', r, {}, {description:[r.aspectLabel, r.characterName].filter(Boolean).join(' · '), image:r.webpUrl || r.url});
for (const mode of ['gacha', 'mmo']) {
  const data = read(mode === 'mmo' ? 'en/datamine/items-mmo' : 'en/datamine/items');
  for (const [key, r] of Object.entries(data || {})) add('Items', 'item', r, {mode}, {route:'/datamine/items/', aliases:[key]});
}
const cards = read('fce-cards');
for (const mode of ['standard', 'mmo']) for (const r of list(cards?.[mode])) {
  add('Bosses', 'boss', r, {mode}, {route:'/datamine/fce/', id:r.slug,
    description:[mode === 'mmo' ? 'MMO' : 'Standard', r.season != null ? `Season ${r.season}` : '', r.encounter === 'oow' ? 'Origin of War' : 'Frontier Clash', r.mechanics?.[0]?.html].filter(Boolean).join(' · '),
    image:r.preview || r.art, aliases:[r.slug?.replace(/^s\d+-/, '')]});
}
const oowDir = path.join(root, 'en/oow/seasons');
if (fs.existsSync(oowDir)) for (const file of fs.readdirSync(oowDir).filter(f => /^(?:mmo_)?s\d+\.json$/.test(f)).sort()) {
  const d = read(`en/oow/seasons/${file.replace(/\.json$/, '')}`);
  const mode = file.startsWith('mmo_') ? 'mmo' : 'standard';
  const season = String(d.season ?? Number(file.match(/s(\d+)/)[1]));
  const info = `${mode === 'mmo' ? 'MMO' : 'Standard'} · Season ${season}`;
  add('Origin of War', 's', {id:season, name:`Origin of War · Season ${season}`}, {mode}, {route:'/datamine/oow/', description:`${info} · ${d.floorCount ?? d.floors?.length ?? ''} floors. Enemies, buffs and difficulty scaling.`, image:d.bossImage || d.strongestEnemy?.image});
  for (const floor of list(d.floors)) {
    const names = [...new Set(list(floor.enemies).map(enemy => enemy.nameEn).filter(Boolean))];
    add('Origin of War', 'floor', {id:floor.floor, name:`Origin of War · Floor ${floor.floor}`}, {mode,s:season}, {route:'/datamine/oow/', description:`${info}. ${names.join(', ') || 'Enemies and floor buffs'}.`, image:floor.enemies?.[0]?.image});
    for (const enemy of list(floor.enemies)) add('Origin of War', 'mob', {id:enemy.key, name:enemy.nameEn}, {mode,s:season,floor:String(floor.floor)}, {route:'/datamine/oow/', description:`${info} · Floor ${floor.floor}${enemy.level ? ` · Level ${enemy.level}` : ''}. Enemy details and attributes.`, image:enemy.detailImageFull || enemy.image});
  }
}
for (const floor of list(read('en/bygone')?.floors)) add('Bygone Phantasm', 'floor', {id:floor.floor, name:`Bygone Phantasm · Floor ${floor.floor}`}, {}, {route:'/datamine/bygone/', description:floor.primary_enemy?.name_en ? `${floor.primary_enemy.name_en}. Enemy attributes and floor scaling.` : 'Enemy attributes and floor scaling.', image:floor.primary_enemy?.image});
const hub = read('main-hub');
const images = {'/':hub?.art?.info, '/info/':hub?.art?.info, '/datamine/':hub?.art?.datamine, '/tools/':hub?.art?.tools};
fs.mkdirSync(root, {recursive:true});
const all = [...entities.values()].sort((a,b) => a.path.localeCompare(b.path, 'en'));
const groups = new Map();
for (const entity of all) {
  const pathname = entity.path.split('?')[0];
  if (!groups.has(pathname)) groups.set(pathname, []);
  groups.get(pathname).push(entity);
}
const datasets = {};
for (const [pathname, entries] of groups) {
  const dataset = `link-previews-${pathname.split('/').filter(Boolean).join('-')}`;
  datasets[pathname] = dataset;
  fs.writeFileSync(path.join(root, `${dataset}.json`), JSON.stringify({schemaVersion:1, entities:entries}) + '\n');
}
fs.writeFileSync(path.join(root, 'link-previews.json'), JSON.stringify({schemaVersion:1, images, datasets, entities:[]}) + '\n');
fs.writeFileSync(path.join(root, 'link-preview-paths.json'), JSON.stringify({schemaVersion:1, paths:all.map(entity => entity.path)}) + '\n');
console.log(`Link previews: ${all.length} English entity links in ${groups.size} route datasets`);
