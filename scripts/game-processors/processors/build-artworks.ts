
/**
 * build-artworks.js — /info/arts catalog (replaces the legacy scripts/build-artworks.py).
 *
 * Editorial input: <project-root>/info/arts/artworks-catalog.json (which textures appear and
 * their EN/RU titles). Game input: the raw export. For every catalog entry the PNG dimensions and
 * size are read from the raw texture; entries whose texture is gone are dropped and reported.
 * The legacy discovery rules are re-applied to the raw tree so new gashapon wallpapers, loading
 * screens, gashapon splash arts and season backgrounds appear without a code change; they get a
 * generic title and are listed in info/arts/data/artworks-new.json for an editor to rename.
 *
 * Output: <project-root>/info/arts/data/artworks.json (legacy shape read by the hub normalizer).
 */

import fs from 'node:fs';
import path from 'node:path';

function option(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? path.resolve(hit.slice(name.length + 3)) : null;
}

/** Width/height from the PNG IHDR chunk. */
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(24);
    fs.readSync(fd, header, 0, 24, 0);
    if (header.readUInt32BE(12) !== 0x49484452) return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

function normalizeSourcePath(value) {
  const clean = String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return /^Content\//i.test(clean) ? `Hotta/${clean}` : clean;
}

const cleanSlug = (s) => s.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
const listPngs = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort() : []);

function aspect(width, height, wide) {
  const ratio = height ? width / height : 0;
  return {
    aspectRatio: height ? `${ratio.toFixed(2)}:1` : '16:9',
    aspectLabel: Math.abs(ratio - 1.777) < 0.1 ? '16:9' : wide && ratio > 2.1 ? '21:9' : `${width}:${height}`,
  };
}

/** Candidates found with the legacy build-artworks.py discovery rules. */
function discover(raw) {
  const found = [];
  const ui = path.join(raw, 'Hotta/Content/Resources/UI');
  const gashapon = path.join(ui, 'AdvancedGashapon');
  const icons = path.join(gashapon, 'ActivityGroup', 'icon');
  const walk = (dir) => {
    if (!fs.existsSync(dir) || dir.startsWith(icons)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
    }
    const rel = path.relative(gashapon, dir);
    const top = rel ? rel.split(path.sep)[0] : '';
    for (const file of listPngs(dir)) {
      const size = pngSize(path.join(dir, file));
      if (!size || file.toLowerCase().includes('button')) continue;
      const ratio = size.width / size.height;
      if (size.width < 1280 || size.height < 600 || ratio < 1.4 || ratio > 2.8) continue;
      found.push({ dir, file, id: cleanSlug(`gashapon_${top}_${path.parse(file).name}`), category: 'wallpapers', subCategory: 'gashapon', themeTag: top || 'general', wide: true,
        title: top ? { en: `${top} Wallpaper`, ru: `Фон ${top}` } : { en: 'Gashapon Wallpaper', ru: 'Фон гасяпона' } });
    }
  };
  walk(gashapon);
  for (const [dir, subCategory, tag] of [[path.join(ui, 'login', 'loading'), 'loading', 'global'], [path.join(raw, 'Hotta/Content/L10N/zh-Hans/Resources/UI/login/loading'), 'loading_zh', 'original']]) {
    for (const file of listPngs(dir)) {
      const number = (file.match(/\d+/) || [''])[0];
      const suffix = number ? ` #${number}` : ` (${path.parse(file).name})`;
      found.push({ dir, file, id: cleanSlug(`${subCategory}_${path.parse(file).name}`), category: 'wallpapers', subCategory, themeTag: `loading_${tag}`,
        title: { en: `Loading Screen${suffix}${tag === 'original' ? ' (Original)' : ''}`, ru: `Экран загрузки${suffix}${tag === 'original' ? ' (Оригинал)' : ''}` } });
    }
  }
  for (const dir of [icons, path.join(ui, 'shizhuang', 'nitai')]) {
    for (const file of listPngs(dir)) {
      if (!/^niudan_jh_/i.test(file) || /ui_nt_sz_/i.test(file)) continue;
      const base = path.parse(file).name;
      const characterKey = base.replace(/^niudan_JH_(?:LH_)?/i, '').replace('_LH', '').toLowerCase();
      found.push({ dir, file, id: cleanSlug(`char_art_${base}`), category: 'characters', subCategory: 'gashapon_character', themeTag: 'character_splash', characterKey, aspectLabel: 'Splash Art',
        title: { en: `${characterKey} — Gashapon Splash Art`, ru: `${characterKey} — Арт гасяпона` } });
    }
  }
  const saiji = path.join(ui, 'Activity', 'huodong', 'NewGgy', 'SaiJi');
  if (fs.existsSync(saiji)) {
    for (const season of fs.readdirSync(saiji).filter((name) => /^\d+$/.test(name))) {
      for (const file of listPngs(path.join(saiji, season))) {
        if (!/^huodongZH2_.*bg/i.test(file)) continue;
        found.push({ dir: path.join(saiji, season), file, id: cleanSlug(`season_${season}_${path.parse(file).name}`), category: 'character_bg', subCategory: 'season_bg', themeTag: `season_${season}`, season: Number(season), aspectLabel: '16:9',
          title: { en: `Season ${season} Background`, ru: `Фон сезона ${season}` } });
      }
    }
  }
  return found.map((item) => ({ ...item, sourcePath: path.relative(raw, path.join(item.dir, path.parse(item.file).name)).split(path.sep).join('/') }));
}

function run() {
  const projectRoot = option('project-root');
  const raw = option('raw-dir');
  if (!projectRoot || !raw) throw new Error('Usage: build-artworks.js --project-root=<stage> --raw-dir=<raw>');
  const catalogFile = path.join(projectRoot, 'info', 'arts', 'artworks-catalog.json');
  const catalog = fs.existsSync(catalogFile) ? JSON.parse(fs.readFileSync(catalogFile, 'utf8')).items : [];
  const items = [];
  const missing = [];
  const preserved = [];
  const known = new Set<any>();

  const materialize = (entry, extra: Record<string, any> = {}) => {
    const sourcePath = normalizeSourcePath(entry.sourcePath);
    const rawPng = path.join(raw, `${sourcePath}.png`);
    const preservedPng = path.join(projectRoot, 'datamine', 'shared', 'media', `${sourcePath}.png`);
    const png = fs.existsSync(rawPng) ? rawPng : fs.existsSync(preservedPng) ? preservedPng : null;
    known.add(sourcePath.toLowerCase());
    known.add(entry.id);
    if (!png) return missing.push({ id: entry.id, sourcePath }), null;
    if (png === preservedPng) preserved.push({ id: entry.id, sourcePath, bytes: fs.statSync(png).size });
    const size = pngSize(png) || { width: 0, height: 0 };
    const bytes = fs.statSync(png).size;
    const ratio = aspect(size.width, size.height, entry.subCategory === 'gashapon');
    const flat = `/datamine/shared/media/artworks/${entry.id}`;
    return {
      ...entry,
      sourcePath,
      width: size.width,
      height: size.height,
      aspectRatio: ratio.aspectRatio,
      aspectLabel: entry.aspectLabel || ratio.aspectLabel,
      url: `${flat}.webp`,
      webpUrl: `${flat}.webp`,
      pngUrl: `/datamine/shared/media/artworks/png/${entry.id}.png`,
      thumbUrl: `/datamine/shared/media/artworks/thumbs/${entry.id}.webp`,
      originalFileName: entry.originalFileName || `${path.basename(sourcePath)}.png`,
      sizeBytes: bytes,
      pngSizeBytes: bytes,
      ...extra,
    };
  };

  for (const entry of catalog) {
    const item = materialize(entry);
    if (item) items.push(item);
  }
  const discovered = [];
  for (const candidate of discover(raw)) {
    if (known.has(candidate.sourcePath.toLowerCase()) || known.has(candidate.id)) continue;
    const { dir, file, wide, ...entry } = candidate;
    const item = materialize(entry, { autoDiscovered: true });
    if (item) {
      items.push(item);
      discovered.push({ id: item.id, sourcePath: item.sourcePath, category: item.category, title: item.title });
    }
  }

  const count = (predicate) => items.filter(predicate).length;
  const categories: Record<string, any> = {};
  for (const item of items) categories[item.category] = (categories[item.category] || 0) + 1;
  categories.loading = count((i) => String(i.subCategory || '').includes('loading'));
  categories.gashapon_bg = count((i) => i.subCategory === 'gashapon');
  const output = { total: items.length, categories, items };
  const outDir = path.join(projectRoot, 'info', 'arts', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'artworks.json'), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(outDir, 'artworks-new.json'), JSON.stringify({ discovered, missing, preserved }, null, 2));
  console.log(`[build-artworks] ${items.length} artworks (${discovered.length} new from the export, ${preserved.length} preserved catalog textures, ${missing.length} catalog entries without an available texture).`);
}

run();
