import { createCharacterMediaBindings } from './character-media-bindings';
import { SUPPORTED_LOCALES } from './locale-codes';

/**
 * build-simulacra-assets.js
 *
 * Automated extraction and PNG generation for Tower of Fantasy character assets.
 * Integrates into tof-fast-datamine RUN_PROCESS.bat pipeline.
 * Extracts:
 *  1. Art & Splash (Detail art, Awakening lihui, Silhouette, Gacha cards, Names, Scenery L10N)
 *  2. Avatars & Emotes (A0, A3, Headshots, Chat action emotes)
 *  3. Weapon (Weapon icon, fusion upgrade material, fashion skins, HUD underbuff slots)
 *  4. Skills & Buffs (Normal attacks, skills, discharge, switch, resonance & effect buffs, defensive buffs)
 *  5. Matrix (Piece slot 1-4 chips, suit art, 256/512 icons, choice boxes, remould art, suit badge)
 *  6. Currencies & Special Orders (Red Nucleus gems, Special Voucher tickets, stamps, outfits)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function resolveReportsDir(projectRoot) {
  const candidates = [
    path.join(projectRoot, '..', 'export-scan', 'reports'),
    path.join(projectRoot, 'export-scan', 'reports'),
    'C:\\2026\\tof\\export-scan\\reports'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function resolveRawDir(projectRoot, optionsRawDir) {
  const candidates = [
    optionsRawDir,
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports', 'raw_exports'),
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports'),
    path.join(projectRoot, 'raw_exports'),
    path.join(projectRoot, '..', 'temperary'),
    path.join(projectRoot, 'temperary'),
    path.resolve(__dirname, '../raw_exports')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return optionsRawDir || path.resolve(__dirname, '../raw_exports');
}

function loadReports(reportsDir) {
  if (!reportsDir) return { media: [], items: [], matrices: [], outfits: [], paths: [] };
  let media = [];
  let items = [];
  let matrices = [];
  let outfits = [];
  let paths = [];

  const mediaPath = path.join(reportsDir, 'media_asset_references.json');
  if (fs.existsSync(mediaPath)) {
    try { media = JSON.parse(fs.readFileSync(mediaPath, 'utf8')); } catch (_) {}
  }
  const itemsPath = path.join(reportsDir, 'item_configs_catalog.json');
  if (fs.existsSync(itemsPath)) {
    try { items = JSON.parse(fs.readFileSync(itemsPath, 'utf8')); } catch (_) {}
  }
  const matricesPath = path.join(reportsDir, 'matrix_media_links.json');
  if (fs.existsSync(matricesPath)) {
    try { matrices = JSON.parse(fs.readFileSync(matricesPath, 'utf8')); } catch (_) {}
  }
  const outfitsPath = path.join(reportsDir, 'outfit_media_links.json');
  if (fs.existsSync(outfitsPath)) {
    try { outfits = JSON.parse(fs.readFileSync(outfitsPath, 'utf8')); } catch (_) {}
  }
  const pathsFile = path.join(reportsDir, 'unreal_export_paths_recommended.txt');
  if (fs.existsSync(pathsFile)) {
    try {
      paths = fs.readFileSync(pathsFile, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    } catch (_) {}
  }
  return { media, items, matrices, outfits, paths };
}

function convertToPng(srcPath, dstPath) {
  if (!fs.existsSync(srcPath)) return false;
  if (fs.existsSync(dstPath)) {
    const sStat = fs.statSync(srcPath);
    const dStat = fs.statSync(dstPath);
    if (dStat.size > 0 && dStat.mtime >= sStat.mtime) {
      return true; // Up to date
    }
  }

  const dir = path.dirname(dstPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // If already PNG and source is valid PNG, copy directly
  if (srcPath.toLowerCase().endsWith('.png')) {
    try {
      fs.copyFileSync(srcPath, dstPath);
      return true;
    } catch (_) {}
  }

  // Assets are PNG downloads: only PNG sources are staged (the raw export provides them; decoding a WebP
  // needed ffmpeg on PATH, which the portable package does not have).
  return false;
}

function findSourceDiskFile(projectRoot, rawDir, mediaRelPath, charId) {
  if (!mediaRelPath) return null;
  let clean = String(mediaRelPath).trim().replace(/\\/g, '/');

  if (/^[a-zA-Z]:\//.test(clean)) {
    if (fs.existsSync(clean) && !fs.statSync(clean).isDirectory()) return clean;
    if (fs.existsSync(clean + '.webp')) return clean + '.webp';
    if (fs.existsSync(clean + '.png')) return clean + '.png';
  }

  clean = clean.replace(/:.*$/, '');
  clean = clean.replace(/\.[^/.]+$/, ''); // strip object subpath e.g. .avatar_zuoyi or .uasset
  clean = clean.replace(/^\/+/, '').replace(/^datamine\//, '');
  if (/^Game\//i.test(clean)) {
    clean = 'Hotta/Content/' + clean.replace(/^Game\//i, '');
  }

  const stripped = clean.replace(/^(shared\/media\/|media\/)?(Hotta\/Content\/)?/i, '');

  // The raw export comes first: the staging media tree is written concurrently by other
  // processors, so preferring it made the pick (and the content-hash dedupe below) depend on
  // job timing. Staging still serves textures only the preserved media archive holds.
  const candidates = [
    path.join(rawDir || '', clean),
    path.join(rawDir || '', 'Hotta', 'Content', stripped),
    path.join(rawDir || '', stripped),
    path.join(projectRoot, 'datamine', 'shared', 'media', clean),
    path.join(projectRoot, 'datamine', 'shared', 'media', 'Hotta', 'Content', stripped),
    path.join(projectRoot, 'datamine', 'shared', 'media', stripped),
    path.join(projectRoot, 'datamine', clean),
    path.join(projectRoot, 'datamine', stripped),
    path.join(projectRoot, clean)
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) return c;
    if (fs.existsSync(c + '.webp')) return c + '.webp';
    if (fs.existsSync(c + '.png')) return c + '.png';
  }

  // Basename search across media directories (never search output asset directories!)
  const baseName = path.basename(stripped).toLowerCase();
  const searchDirs = [
    rawDir ? path.join(rawDir, 'Hotta', 'Content') : null,
    path.join(projectRoot, 'datamine', 'shared', 'media', 'Hotta', 'Content'),
    path.join(projectRoot, 'datamine', 'shared', 'media')
  ].filter(Boolean);

  for (const sDir of searchDirs) {
    const res = mediaBasenameIndex(sDir).get(baseName);
    if (res) return res;
  }

  return null;
}

// Basename -> first matching texture in depth-first readdir order, built once per directory.
// Rewalking the raw tree for every unresolved asset dominated this processor's runtime.
const mediaIndexes = new Map<string, Map<string, string>>();
function mediaBasenameIndex(root) {
  let index = mediaIndexes.get(root);
  if (index) return index;
  index = new Map();
  mediaIndexes.set(root, index);
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === '.pipeline-work' || e.name === 'node_modules' || e.name === 'dist_datamine_bundle' || e.name === 'assets') continue;
        walk(full);
      } else {
        const l = e.name.toLowerCase();
        if (l.includes('.thumb.') || !(l.endsWith('.webp') || l.endsWith('.png'))) continue;
        const base = path.basename(l, path.extname(l));
        if (!index.has(base)) index.set(base, full);
      }
    }
  };
  walk(root);
  return index;
}

function normalizeUnrealPath(p) {
  if (!p) return '';
  let clean = String(p).trim().replace(/\\/g, '/');

  // Strip Unreal object wrappers e.g. Texture2D'...'
  clean = clean.replace(/^[a-zA-Z0-9_]+'([^']+)'$/, '$1');

  // Strip L10N localized folder e.g. .../L10N/en/Resources/... -> .../Resources/...
  clean = clean.replace(/\/L10N\/[a-zA-Z0-9_-]+\/Resources\//i, '/Resources/');

  // Extract from Hotta/Content/ or Content/ or datamine/shared/media/
  if (clean.includes('/Hotta/Content/')) {
    clean = clean.substring(clean.indexOf('/Hotta/Content/') + '/Hotta/Content/'.length);
    clean = '/Game/' + clean;
  } else if (/^Hotta\/Content\//i.test(clean)) {
    clean = '/Game/' + clean.substring('Hotta/Content/'.length);
  } else if (clean.includes('/datamine/shared/media/')) {
    clean = clean.substring(clean.indexOf('/datamine/shared/media/') + '/datamine/shared/media/'.length);
    clean = clean.replace(/^Hotta\/Content\//i, '');
    clean = '/Game/' + clean;
  } else if (clean.includes('/Content/Resources/')) {
    clean = clean.substring(clean.indexOf('/Content/Resources/') + '/Content/'.length);
    clean = '/Game/' + clean;
  }

  // Strip sub-object colon (after /Game/) e.g. /Game/.../MyAsset:SubObject
  const colonIdx = clean.indexOf(':');
  if (colonIdx !== -1 && clean.substring(0, colonIdx).includes('/Game/')) {
    clean = clean.substring(0, colonIdx);
  }

  // Strip file extensions
  clean = clean.replace(/\.(webp|png|jpg|jpeg|uasset|json)$/i, '');

  // Strip duplicate object name suffix /Foo.Foo -> /Foo
  const lastSlash = clean.lastIndexOf('/');
  if (lastSlash !== -1) {
    const dir = clean.substring(0, lastSlash);
    const base = clean.substring(lastSlash + 1);
    const dotIdx = base.indexOf('.');
    if (dotIdx !== -1) {
      const name = base.substring(0, dotIdx);
      const sub = base.substring(dotIdx + 1);
      if (name.toLowerCase() === sub.toLowerCase()) {
        clean = dir + '/' + name;
      }
    }
  }

  if (/^\/?Game\//i.test(clean)) {
    clean = '/Game/' + clean.replace(/^\/?Game\//i, '');
  }

  return clean;
}

function processCharacterAssets(characterData, projectRoot, rawDir, reportsCache) {
  const charId = (characterData.id || '').toLowerCase();
  const avatarId = (characterData.avatar_id || '').toLowerCase();
  const imitId = (characterData.imitation_id || '').toLowerCase();
  const wId = (characterData.weapon?.id || characterData.weapon_id || '').toLowerCase();
  const suitId = (characterData.matrix?.suit_id || characterData.matrix_suit_id || '').toLowerCase();
  const suitSuffix = suitId ? suitId.replace(/^suit_/i, '').toLowerCase() : '';
  const wIcon = characterData.weapon?.icon || characterData.icon || '';
  const wIconBase = wIcon ? path.basename(wIcon, path.extname(wIcon)).toLowerCase() : '';
  const wIconClean = wIconBase.replace(/^item_weapon_(ssr_|sr_|r_)?/i, '');

  const pluginAliases = [wIconClean, wIconBase].filter(Boolean);

  const charWeaponTokens = [
    wIconClean,
    wIconBase,
    wId,
    charId,
    avatarId,
    ...pluginAliases
  ].filter(s => s && s.length >= 3);

  const searchKeys = [charId, avatarId, imitId].filter(Boolean);
  if (wId && wId !== charId) searchKeys.push(wId);
  if (suitId && suitId !== charId) searchKeys.push(suitId);
  if (suitSuffix && !searchKeys.includes(suitSuffix)) searchKeys.push(suitSuffix);
  if (charId === 'zoey' || charId === 'zuoyi') {
    if (!searchKeys.includes('zuoyi')) searchKeys.push('zuoyi');
    if (!searchKeys.includes('zoey')) searchKeys.push('zoey');
    if (!searchKeys.includes('ssr70')) searchKeys.push('ssr70');
  }

  const boundMedia = reportsCache._characterBindings?.get(characterData.id) ?? [];
  const boundRefs = new Set(boundMedia.map(binding => normalizeUnrealPath(binding.ref).toLowerCase()));

  const targetDirs = [path.join(projectRoot, 'info', 'simulacra', 'assets', charId)];

  targetDirs.forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    } else {
      try {
        const existing = fs.readdirSync(d);
        existing.forEach(f => {
          try { fs.unlinkSync(path.join(d, f)); } catch (_) {}
        });
      } catch (_) {}
    }
  });

  const discovered = [];
  const seenCanonicalUnreal = new Set<any>();
  const seenIds = new Set<any>();
  const seenRealFiles = new Set<any>();
  const seenFileHashes = new Set<any>();

  function registerAsset(id, nameEn, nameRu, category, badgeEn, badgeRu, webpOrRelUrl, unrealPath, provenance = null) {
    if (!webpOrRelUrl && !unrealPath) return;

    const canonicalUnreal = normalizeUnrealPath(unrealPath || webpOrRelUrl);
    if (!canonicalUnreal) return;
    const unrealKey = canonicalUnreal.toLowerCase();

    // Global filter: Exclude monster scenery, fish, fishking, secret action chips, and genes
    const isComboGuidePath = unrealKey.includes('ui_operate_') || (unrealKey.includes('ui_nitai_') && unrealKey.includes('l10n'));
    if ((unrealKey.includes('/scenery/monster/') && !isComboGuidePath) || unrealKey.includes('/plugin/fb/bigmon/')) {
      return;
    }
    if (unrealKey.includes('fishking') || unrealKey.includes('avatar_jiuyu_fishking') || unrealKey.includes('/touxiang_fishking_')) {
      return;
    }
    if (unrealKey.includes('/secretaction/') || unrealKey.includes('icon_chip223') || unrealKey.includes('icon_chip224')) {
      return;
    }

    // Strict isolation: Never allow Berry (UP_056_Mei) assets to leak into non-Berry characters
    if (charId !== 'berry' && charId !== 'bupoxiao' && unrealKey.includes('up_056_mei')) {
      return;
    }

    // Strict isolation: Never allow Zoey / Zuoyi / SSR70 assets to leak into non-Zoey characters!
    if (charId !== 'zoey' && charId !== 'zuoyi') {
      const checkStr = `${unrealKey} ${id.toLowerCase()} ${webpOrRelUrl ? String(webpOrRelUrl).toLowerCase() : ''}`;
      if (checkStr.includes('ssr70') || checkStr.includes('zuoyi') || checkStr.includes('zoey')) {
        return;
      }
    }

    // Deduplicate strictly by canonical Unreal path
    const dedupeKey = isComboGuidePath ? `${unrealKey}:${id.toLowerCase()}` : unrealKey;
    if (seenCanonicalUnreal.has(dedupeKey)) {
      return;
    }

    const srcFile = findSourceDiskFile(projectRoot, rawDir, webpOrRelUrl || unrealPath, charId);
    // MUST be a real, existing file on disk! Never register phantoms without real images!
    if (!srcFile || !fs.existsSync(srcFile) || fs.statSync(srcFile).size === 0) {
      return;
    }

    // Strict isolation on disk source path as well
    if (charId !== 'zoey' && charId !== 'zuoyi') {
      const srcLower = srcFile.toLowerCase();
      if (srcLower.includes('ssr70') || srcLower.includes('zuoyi') || srcLower.includes('zoey')) {
        return;
      }
    }

    const realDisk = path.resolve(srcFile).toLowerCase();
    if (seenRealFiles.has(realDisk)) {
      return;
    }

    // Content MD5 hash deduplication: never export identical image bytes under multiple cards
    try {
      const fileBuffer = fs.readFileSync(srcFile);
      const contentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      if (seenFileHashes.has(contentHash)) {
        return;
      }
      seenFileHashes.add(contentHash);
    } catch (_) {}

    let cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (seenIds.has(cleanId.toLowerCase())) {
      cleanId = `${cleanId}_${discovered.length}`;
    }

    const pngFileName = `${cleanId}.png`;
    let convertedOk = false;

    targetDirs.forEach(d => {
      const dstFile = path.join(d, pngFileName);
      const ok = convertToPng(srcFile, dstFile);
      if (ok) convertedOk = true;
    });

    if (!convertedOk) return;

    // Check if converted image is a dummy placeholder (184x184 mannequin)
    let isDummy = false;
    let imgWidth = 0;
    let imgHeight = 0;
    for (const d of targetDirs) {
      const dstFile = path.join(d, pngFileName);
      if (fs.existsSync(dstFile)) {
        try {
          const buf = fs.readFileSync(dstFile);
          if (buf.length >= 24 && buf.slice(0, 4).toString('hex') === '89504e47') {
            const w = buf.readUInt32BE(16);
            const h = buf.readUInt32BE(20);
            if (w === 184 && h === 184) {
              isDummy = true;
              break;
            }
            imgWidth = w;
            imgHeight = h;
          }
        } catch (_) {}
      }
    }
    if (isDummy) {
      targetDirs.forEach(d => {
        try { fs.unlinkSync(path.join(d, pngFileName)); } catch (_) {}
      });
      return;
    }

    seenIds.add(cleanId.toLowerCase());
    seenCanonicalUnreal.add(dedupeKey);
    seenRealFiles.add(realDisk);

    discovered.push({
      id: cleanId,
      file: pngFileName,
      name_en: nameEn,
      name_ru: nameRu || nameEn,
      category: category,
      badge_en: badgeEn,
      badge_ru: badgeRu || badgeEn,
      width: imgWidth || undefined,
      height: imgHeight || undefined,
      resolution: (imgWidth && imgHeight) ? `${imgWidth}×${imgHeight}` : undefined,
      pngUrl: `/info/simulacra/assets/${charId}/${pngFileName}`,
      webpUrl: `/info/simulacra/assets/${charId}/${pngFileName.replace(/\.png$/i, '.webp')}`,
      webpFile: pngFileName.replace(/\.png$/i, '.webp'),
      unrealPath: canonicalUnreal,
      sourceOnDisk: srcFile,
      converted: true,
      ...(provenance ? {provenance} : {}),
    });
  }

  const charNameEn = characterData.name_en || charId;
  const charNameRu = characterData.name_ru || charNameEn;
  const wNameEn = characterData.weapon?.name_en || characterData.weapon_name_en || 'Weapon';
  const wNameRu = characterData.weapon?.name_ru || characterData.weapon_name_ru || wNameEn;

  // 1. Art & Splash
  if (characterData.detail_art || characterData.portrait) {
    const artUrl = characterData.detail_art || characterData.portrait;
    registerAsset('imitation_art', `${charNameEn} Detail Art`, `${charNameRu}: Основной арт`, 'art', 'Detail Art', 'Основной арт', artUrl, `/Game/Resources/UI/shizhuang/nitai/xiangqing/${imitId || charId}`);
  }
  if (characterData.card && characterData.card !== characterData.detail_art) {
    registerAsset('card_lihui', `${charNameEn} Awakening Splash`, `${charNameRu}: Арт пробуждения (Лихуэй)`, 'art', 'Awakening Splash', 'Арт пробуждения', characterData.card, `/Game/Resources/UI/huanxing/lihui/${avatarId || charId}`);
  }
  if (characterData.avatar && characterData.avatar !== characterData.detail_art && characterData.avatar !== characterData.card) {
    registerAsset('showcase_silhouette', `${charNameEn} Simulacrum Silhouette`, `${charNameRu}: Силуэт симулякра`, 'art', 'Silhouette', 'Силуэт', characterData.avatar, `/Game/Resources/UI/shizhuang/nitai/${imitId || charId}`);
  }

  // 2. Weapon & Role
  if (wIcon) {
    registerAsset('weapon_icon', `${wNameEn} Weapon Icon`, `${wNameRu}: Иконка оружия`, 'weapon', 'Weapon Icon', 'Иконка оружия', wIcon, `/Game/Resources/Icon/weapon/Icon/item_Weapon_SSR_${avatarId || charId}`);
  }
  registerAsset('weapon_upstar', `${wNameEn} Fusion Core`, `${wNameRu}: Ядро возвышения`, 'weapon', 'Upgrade Material', 'Материал возвышения', '/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp', '/Game/Resources/Icon/item/item_weapon_upstar_');

  // Role Icon (DPS / Fortitude / Benediction)
  const rawRole = characterData.role || characterData.weapon?.role || characterData.resonance || '';
  const roleLower = rawRole.toLowerCase();
  const roleIcon = characterData.role_icon || characterData.weapon?.role_icon || (
    roleLower.includes('dps') || roleLower.includes('attack') ? '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_qianggong.webp' :
    roleLower.includes('tank') || roleLower.includes('fortitude') || roleLower.includes('defense') ? '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp' :
    roleLower.includes('benediction') || roleLower.includes('support') || roleLower.includes('heal') ? '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_zengyi.webp' : null
  );
  if (roleIcon) {
    const roleEn = rawRole ? rawRole.toUpperCase() : 'Role';
    const roleRuMap = {
      'DPS': 'DPS',
      'ATTACK': 'DPS',
      'TANK': 'Защита',
      'FORTITUDE': 'Защита',
      'DEFENSE': 'Защита',
      'BENEDICTION': 'Поддержка',
      'SUPPORT': 'Поддержка',
      'HEAL': 'Поддержка',
      'BALANCE': 'Баланс'
    };
    const roleRu = roleRuMap[roleEn] || roleEn;
    const roleBase = path.basename(roleIcon, path.extname(roleIcon));
    registerAsset('role_icon', `${roleEn === 'DPS' ? 'DPS' : roleEn} Role Icon`, `${roleRu}: Иконка роли`, 'skill', 'Role Icon', 'Иконка роли', roleIcon, `/Game/Resources/UI/wuqi/${roleBase}`);
  }

  // 3. Skills & Buffs
  if (Array.isArray(characterData.weapon?.skills)) {
    characterData.weapon.skills.forEach((s, idx) => {
      let iconUrl = null;
      let uPath = null;
      if (typeof s.icon === 'string') {
        iconUrl = s.icon;
        uPath = s.icon;
      } else if (s.icon && s.icon.full) {
        iconUrl = s.icon.full;
        uPath = s.icon.assetRef || s.icon.full;
      }
      if (iconUrl && !iconUrl.includes('placeholder')) {
        const sName = s.name_en || `Skill ${idx + 1}`;
        const sNameRu = s.name_ru || sName;
        const sId = s.id || `skill_${idx}`;
        const isBuff = s.group === 'buff' || sId.startsWith('Buff_');
        const isReaction = s.isReaction || sId.startsWith('reaction_') || s.category === 'Reaction' || (s.provenance && s.provenance.source === 'QRSLCommon_ST');
        const isPassive = s.category === 'Passive' || s.type === 'Passive';
        const badge = isReaction ? 'Elemental Reaction' : (s.type_name_en || (isBuff ? 'Buff' : (isPassive ? 'Passive' : 'Weapon Skill')));
        const badgeRu = isReaction ? 'Реакция стихий' : (s.type_name_ru || (isBuff ? 'Бафф' : (isPassive ? 'Пассивный навык' : 'Навык')));
        registerAsset(sId, sName, sNameRu, 'skill', badge, badgeRu, iconUrl, uPath);
      }
    });
  }

  // 4. Matrix (Pieces & Suit)
  if (Array.isArray(characterData.matrix?.pieces)) {
    const pieces = characterData.matrix.pieces.filter(p => p && p.icon);
    const uniqueIcons = new Set<any>(pieces.map(p => normalizeUnrealPath(p.icon).toLowerCase()));

    if (uniqueIcons.size === 1) {
      // All slots share identical chip artwork (common for newer matrices)
      const p = pieces[0];
      const chipId = suitSuffix ? `icon_matrix_${suitSuffix}_512` : 'matrix_chip_512';
      registerAsset(
        chipId,
        `${charNameEn} Matrix Chip (512px)`,
        `${charNameRu}: Чип матрицы 512px`,
        'matrix',
        'Matrix Chip 512',
        'Чип 512px',
        p.icon,
        p.icon
      );
    } else {
      const slotNames = ['Mind', 'Memory', 'Belief', 'Emotion'];
      const slotNamesRu = ['Разум', 'Память', 'Вера', 'Эмоция'];
      pieces.forEach((p, idx) => {
        const sSlot = p.slot || (idx + 1);
        const pName = p.name_en || `${charNameEn}: ${slotNames[sSlot - 1] || 'Chip'}`;
        const pNameRu = p.name_ru || `${charNameRu}: ${slotNamesRu[sSlot - 1] || 'Чип'}`;
        registerAsset(`matrix_piece_${sSlot}`, pName, pNameRu, 'matrix', `Matrix Slot ${sSlot}`, `Чип матрицы ${sSlot}`, p.icon, p.icon);
      });
    }
  }

  // 5. Query from reports (Items, currencies, gacha cards, matrix boxes, stamps, outfits, scans)
  if (reportsCache) {
    const { items, media, matrices, outfits, paths } = reportsCache;

    // Helper for bounded token matching to prevent substring leakage
    function hasTokenMatch(str, token) {
      if (!str || !token) return false;
      const s = String(str).toLowerCase();
      const t = String(token).toLowerCase().trim();
      if (!t) return false;
      if (s === t) return true;
      const regex = new RegExp(`(^|[^a-z0-9])${t}(?:\\d+)?([^a-z0-9]|$)`, 'i');
      return regex.test(s);
    }

    // A. Items from item_configs_catalog
    const candidateKeys = [charId, avatarId, wId, suitId].filter(Boolean);

    const matchedItems = (items || []).filter(i => {
      const lower = JSON.stringify(i).toLowerCase();
      // Skip fish genes and SecretAction
      if (lower.includes('secretaction') || lower.includes('_gene') || lower.includes('gene_') || / gene$/i.test(i.name_en || i.ItemName || '')) return false;
      // Skip player titles, recipes, and fish
      if (lower.includes('/shipu/') || lower.includes('recipe_') || lower.includes('title_') || lower.includes('titlestick_')) return false;
      if (lower.includes('fishking') || lower.includes('avatar_jiuyu_fishking')) return false;
      if (lower.includes('/scenery/monster/')) return false;

      const rowId = (i.row_id || i.id || i.item_id || '').toLowerCase();
      const name = (i.name_en || i.ItemName || '').toLowerCase();
      const icon = (i.icon || i.ItemIcon || '').toLowerCase();

      for (const k of candidateKeys) {
        if (hasTokenMatch(rowId, k) || hasTokenMatch(icon, k)) return true;
        // Natural language name matching: only for keys >= 3 chars
        if (k.length >= 3 && hasTokenMatch(name, k)) {
          // Avoid generic titles for King (e.g. dragon king, king of, photo king)
          if (k === 'king' && (name.includes('dragon king') || name.includes('king of') || name.includes('photo king') || name.includes('dance king') || name.includes('crab'))) {
            continue;
          }
          return true;
        }
      }
      return false;
    });

    matchedItems.forEach(item => {
      const rawIcon = item.icon || item.ItemIcon;
      if (!rawIcon) return;
      const itemNameEn = item.name_en || item.ItemName || '';
      const itemNameRu = item.name_ru || itemNameEn;
      const lower = JSON.stringify(item).toLowerCase();

      // Skip player fashion icon / item fashion
      if (lower.includes('item_fashion_icon') || lower.includes('fashion_f') || lower.includes('fashion_m')) return;
      // Skip generic numeric avatar/frame/chat cosmetics
      if (/avatarframe_(s_)?\d+/i.test(lower) || /item_avatar_\d+/i.test(lower) || /qipao_\d+/i.test(lower)) return;
      // Skip emoji and biaoqing
      if (lower.includes('emoji') || lower.includes('biaoqing')) return;
      // Skip fish genes and SecretAction
      if (lower.includes('secretaction') || lower.includes('_gene') || lower.includes('gene_') || / gene$/i.test(itemNameEn)) return;
      // Skip player titles, recipes, and fish
      if (lower.includes('/shipu/') || lower.includes('recipe_') || lower.includes('title_') || lower.includes('titlestick_')) return;
      if (lower.includes('fishking') || lower.includes('avatar_jiuyu_fishking')) return;

      // Categorize
      if (lower.includes('ticket') || lower.includes('huobi') || lower.includes('voucher')) {
        registerAsset(`ticket_${avatarId || charId}`, itemNameEn || 'Special Order Voucher', itemNameRu || 'Ваучер спецзаказа', 'item', 'Special Voucher', 'Ваучер заказа', rawIcon, rawIcon);
      } else if (lower.includes('gem_') || lower.includes('nucleus')) {
        registerAsset(`gem_${avatarId || charId}`, itemNameEn || 'Special Order Red Nucleus', itemNameRu || 'Красное ядро спецзаказа', 'item', 'Gacha Currency', 'Валюта гачи', rawIcon, rawIcon);
      } else if (lower.includes('stamps') || lower.includes('memory') || lower.includes('gilded')) {
        registerAsset(`stamp_${avatarId || charId}`, itemNameEn || 'Character Memory Stamp', itemNameRu || 'Памятный штамп', 'item', 'Memory Stamp', 'Памятный штамп', rawIcon, rawIcon);
      } else if (lower.includes('fashion') && (hasTokenMatch(lower, charId) || (avatarId && hasTokenMatch(lower, avatarId)))) {
        registerAsset(`fashion_${avatarId || charId}`, itemNameEn || 'Haute Couture Outfit', itemNameRu || 'Кутюр-костюм', 'item', 'Haute Couture', 'Кутюр-облик', rawIcon, rawIcon);
      } else if (lower.includes('weapon_paradox') || (lower.includes('weapon_') && lower.includes('skin'))) {
        registerAsset(`weapon_skin_${avatarId || charId}`, itemNameEn || 'Weapon Haute Couture', itemNameRu || 'Кутюр-облик оружия', 'weapon', 'Weapon Skin', 'Облик оружия', rawIcon, rawIcon);
      } else if (lower.includes('treasure_matrix') || lower.includes('choose_matrix') || lower.includes('plugin box')) {
        registerAsset(`matrix_box_${suitId || avatarId || charId}`, itemNameEn || 'Matrix Selection Box', itemNameRu || 'Коробка выбора матрицы', 'matrix', 'Matrix Box', 'Коробка матрицы', rawIcon, rawIcon);
      } else if (lower.includes('avatar') && !lower.includes('overseas') && !/avatar_\d+/i.test(lower)) {
        const isA3 = lower.includes('lv2') || lower.includes('awakened');
        registerAsset(isA3 ? `avatar_${avatarId || charId}_a3` : `avatar_${avatarId || charId}_a0`, itemNameEn || 'Character Avatar', itemNameRu || 'Аватар симулякра', 'avatar', isA3 ? 'Avatar A3' : 'Avatar A0', isA3 ? 'Аватар A3' : 'Аватар A0', rawIcon, rawIcon);
      } else if (lower.includes('chat_action') || lower.includes('dongzuo') || (lower.includes('action_') && !lower.includes('secretaction'))) {
        registerAsset(`action_${avatarId || charId}`, itemNameEn || 'Chat Action Emote', itemNameRu || 'Эмоция чата: Поклон', 'avatar', 'Chat Emote', 'Эмоция чата', rawIcon, rawIcon);
      }
    });

    // B. Media references (SSR_lh, name banners, etc.)
    const matchedMedia = (media || []).filter(m => {
      const s = (m.asset_path_verbatim || m.asset_path_normalized || '').toLowerCase();
      if (s.includes('/scenery/monster/') || s.includes('secretaction') || s.includes('fishking')) return false;
      return searchKeys.some(k => k && hasTokenMatch(s, k));
    });

    matchedMedia.forEach(m => {
      const pStr = m.asset_path_verbatim || m.asset_path_normalized || '';
      const pLower = pStr.toLowerCase();
      if (pLower.includes('ssr_lh_')) {
        registerAsset(`ssr_lh_${avatarId || charId}`, `${charNameEn} Gacha Splash Card`, `${charNameRu}: Сплэш-карта гачи`, 'art', 'Gacha Card', 'Карта гачи', pStr, pStr);
      } else if (pLower.includes('name_') && (pLower.includes('/card') || pLower.includes('/drawcard'))) {
        registerAsset(`name_${avatarId || charId}`, `${charNameEn} Stylized Name`, `${charNameRu}: Стилизованное имя`, 'art', 'Name Graphic', 'Логотип имени', pStr, pStr);
      }
    });

    // C. Matrices (Primary: exact characterData.matrix join, Secondary: exact suit match in reports)
    if (characterData.matrix?.suit_icon || characterData.matrix?.suit_icon_asset) {
      const sUrl = characterData.matrix.suit_icon || characterData.matrix.suit_icon_asset;
      const sRef = characterData.matrix.suit_icon_asset || characterData.matrix.suit_icon;
      registerAsset(`avatar_yizhitips_${avatarId || charId}_big`, `${charNameEn} Matrix Suit Showcase`, `${charNameRu}: Витрина набора матрицы`, 'matrix', 'Matrix Showcase', 'Витрина набора', sUrl, sRef);
    }
    if (characterData.matrix?.remould_icon || characterData.matrix?.remould_icon_asset) {
      const rUrl = characterData.matrix.remould_icon || characterData.matrix.remould_icon_asset;
      const rRef = characterData.matrix.remould_icon_asset || characterData.matrix.remould_icon;
      registerAsset(`tips_avatar_ssr_${avatarId || charId}`, `${charNameEn} Matrix Remould Art`, `${charNameRu}: Арт ремоделинга матрицы`, 'matrix', 'Matrix Remould', 'Ремоделинг', rUrl, rRef);
    }

    const matchedMatrices = (matrices || []).filter(m => {
      const mSuitId = (m.suit_id || '').toLowerCase();
      if (suitId && mSuitId === suitId) return true;
      if (suitSuffix && (mSuitId === ('suit_' + suitSuffix) || mSuitId === suitSuffix)) return true;
      if ((charId === 'zoey' || charId === 'zuoyi') && (mSuitId === 'suit_ssr70' || mSuitId.includes('zuoyi'))) return true;
      return false;
    });

    matchedMatrices.forEach(m => {
      if (m.suit_icon) {
        registerAsset(`avatar_yizhitips_${avatarId || charId}_big`, `${charNameEn} Matrix Suit Showcase`, `${charNameRu}: Витрина набора матрицы`, 'matrix', 'Matrix Showcase', 'Витрина набора', m.suit_icon, m.suit_icon);
      }
      if (m.set_art_path && m.set_art_path !== m.suit_icon) {
        registerAsset(`matrix_set_art_${avatarId || charId}`, `${charNameEn} Matrix Set Art`, `${charNameRu}: Арт набора матрицы`, 'matrix', 'Matrix Art', 'Арт матрицы', m.set_art_path, m.set_art_path);
      }
    });

    // D. Outfits & Headwear (genuine simulacrum outfits only)
    const matchedOutfits = (outfits || []).filter(o => {
      if (o.imitation_id && o.imitation_id.toLowerCase() === imitId) return true;
      const nameLower = (o.name_en || o.Name || '').toLowerCase();
      const idLower = (o.fashion_id || o.id || '').toLowerCase();
      return (nameLower.includes(charId) || idLower.includes(charId) || (charId === 'zoey' && idLower.includes('zuoyi')));
    });

    matchedOutfits.forEach(o => {
      if (o.inventory_icon) {
        const isHead = (o.fashion_type || '').toLowerCase().includes('head');
        const oId = o.fashion_id || `fashion_${discovered.length}`;
        const nameEn = o.name_en || (isHead ? 'Character Headwear' : 'Haute Couture Outfit');
        const nameRu = o.name_ru || (isHead ? 'Головной убор симулякра' : 'Кутюр-облик симулякра');
        registerAsset(oId, nameEn, nameRu, 'item', isHead ? 'Headwear' : 'Haute Couture', isHead ? 'Головной убор' : 'Кутюр-облик', o.inventory_icon, o.inventory_icon);
      }
    });

    // E. Scanned Unreal Paths (headshots, chip variants, buffs, HUD slots, scenery)
    const matchedPaths = (paths || []).filter(p => {
      const s = p.toLowerCase();
      if (s.includes('/scenery/monster/') || s.includes('secretaction') || s.includes('fishking')) return false;
      const isImageRoot = s.startsWith('hotta/content/resources/icon/') ||
                          s.startsWith('hotta/content/resources/ui/') ||
                          s.startsWith('hotta/content/sevenforest/blueprint/ui/');
      return isImageRoot && searchKeys.some(k => k && hasTokenMatch(s, k));
    });

    matchedPaths.forEach(rawP => {
      const p = rawP.replace(/\:.*$/, '').trim();
      const base = path.basename(p, path.extname(p));
      const baseLower = base.toLowerCase();

      if (avatarId && baseLower === 'touxiang_' + avatarId) {
        registerAsset('touxiang_' + avatarId, `${charNameEn} Profile Headshot`, `${charNameRu}: Иконка профиля (голова)`, 'avatar', 'Profile Headshot', 'Иконка профиля', p, p);
      } else if (avatarId && baseLower === 'touxiang_' + avatarId + '_s') {
        registerAsset('touxiang_' + avatarId + '_s', `${charNameEn} Micro Headshot`, `${charNameRu}: Мини-иконка профиля`, 'avatar', 'Micro Headshot', 'Мини-аватар', p, p);
      } else if (avatarId && baseLower === 'tips_avatar_ssr_' + avatarId) {
        registerAsset('tips_avatar_ssr_' + avatarId, `${charNameEn} Matrix Remould Art`, `${charNameRu}: Арт ремоделинга матрицы`, 'matrix', 'Matrix Remould', 'Ремоделинг', p, p);
      } else if (suitSuffix && baseLower === 'tips_icon_' + suitSuffix) {
        registerAsset('tips_icon_' + suitSuffix, `${charNameEn} Matrix Suit Badge`, `${charNameRu}: Бейдж набора матрицы`, 'matrix', 'Matrix Badge', 'Бейдж матрицы', p, p);
      } else if (suitSuffix && (baseLower === 'buff_matrix_' + suitSuffix + '_level1_dmgup' || (baseLower.includes('buff_matrix_' + suitSuffix) && baseLower.includes('dmgup')))) {
        registerAsset('buff_matrix_' + suitSuffix + '_dmgup', `${charNameEn} Matrix Set Damage Buff`, `${charNameRu}: Бафф урона набора матрицы`, 'matrix', 'Matrix Buff', 'Бафф матрицы', p, p);
      } else if (suitSuffix && baseLower === 'icon_matrix_' + suitSuffix + '_256') {
        registerAsset('icon_matrix_' + suitSuffix + '_256', `${charNameEn} Matrix Chip (256px)`, `${charNameRu}: Чип матрицы 256px`, 'matrix', 'Matrix Chip 256', 'Чип 256px', p, p);
      } else if (suitSuffix && baseLower === 'icon_matrix_' + suitSuffix + '_512') {
        registerAsset('icon_matrix_' + suitSuffix + '_512', `${charNameEn} Matrix Chip (512px)`, `${charNameRu}: Чип матрицы 512px`, 'matrix', 'Matrix Chip 512', 'Чип 512px', p, p);
      } else if (avatarId && baseLower === avatarId) {
        registerAsset('chip_' + avatarId, `${charNameEn} Matrix Chip Icon`, `${charNameRu}: Иконка чипа матрицы`, 'matrix', 'Matrix Chip', 'Чип матрицы', p, p);
      } else if (avatarId && baseLower === avatarId + '_2x') {
        registerAsset('chip_' + avatarId + '_2x', `${charNameEn} Matrix Chip (2X)`, `${charNameRu}: Иконка чипа матрицы (2X)`, 'matrix', 'Matrix Chip 2X', 'Чип матрицы 2X', p, p);
      } else if (baseLower.startsWith('ui_nitai_') && !p.toLowerCase().includes('/scenery/monster/') && (hasTokenMatch(baseLower, charId) || (avatarId && hasTokenMatch(baseLower, avatarId)))) {
        registerAsset('ui_nitai_' + charId, `${charNameEn} Simulacrum Scenery Art`, `${charNameRu}: Демонстрационный арт симулякра`, 'art', 'Scenery Showcase', 'Сценический арт', p, p);
      } else if (charId === 'zoey' && baseLower === 'buff_zoey_fir') {
        registerAsset('buff_zoey_fir', `${charNameEn} Flame Resonance Buff`, `${charNameRu}: Резонанс огня (бафф)`, 'skill', 'Resonance Buff', 'Бафф резонанса', p, p);
      } else if (charId === 'zoey' && baseLower === 'buff_zoey_phy') {
        registerAsset('buff_zoey_phy', `${charNameEn} Physical Resonance Buff`, `${charNameRu}: Физический резонанс (бафф)`, 'skill', 'Resonance Buff', 'Бафф резонанса', p, p);
      } else if (charId === 'zoey' && baseLower === 'zoey_bedmgdown') {
        registerAsset('zoey_bedmgdown', `${charNameEn} Damage Reduction Buff`, `${charNameRu}: Защитный бафф снижения урона`, 'skill', 'Defensive Buff', 'Защитный бафф', p, p);
      }
    });
  }

  for (const binding of boundMedia) {
    const source = binding.ref.toLowerCase();
    const badge = source.includes('/leisureroom/') ? ['Dorm Art', 'Арт общежития']
      : source.includes('/chouka/') ? ['Special Order Art', 'Арт спецзаказа']
      : source.includes('gashapon') || source.includes('/niudan') ? ['Gashapon Art', 'Арт гасяпона'] : ['Artwork', 'Арт'];
    const leaf = path.basename(binding.ref).split('.')[0];
    registerAsset(`linked_${leaf}`, `${charNameEn} ${badge[0]}`, `${charNameRu}: ${badge[1]}`, 'art', badge[0], badge[1], binding.ref, binding.ref, binding.source);
  }

  // F. Raw Export & Disk Assets Discovery (HUD gauges, Gacha banners, Outfits, Minimap icons, Chat stickers)
  const charRegex = charId === 'zoey'
    ? /zoey|zuoyi|ssr70|imitation_78|zuoyi_jdt|icon_imitation_fashion_78|meiguihualei/i
    : new RegExp(`(^|[^a-zA-Z0-9])(${searchKeys.filter(k => k.length > 2).join('|')})([^a-zA-Z0-9]|$)`, 'i');

  if (!reportsCache._diskFilesAll) {
    const targetSubdirs = [
      ['Hotta', 'Content', 'Resources', 'UI'],
      ['Hotta', 'Content', 'Resources', 'Icon'],
      ['Hotta', 'Content', 'ResourcesOverSea', 'UI'],
      ['Hotta', 'Content', 'ResourcesOverSea', 'Icon'],
      ['Hotta', 'Content', 'SevenForest', 'Blueprint', 'UI'],
      ...SUPPORTED_LOCALES.map(locale => ['Hotta', 'Content', 'L10N', locale, 'Resources', 'UI'])
    ];
    const rootsToScan = [];
    const baseCandidates = [
      path.join(projectRoot, 'tof-fast-datamine', 'raw_exports', 'raw_exports'),
      path.join(projectRoot, 'tof-fast-datamine', 'raw_exports'),
      path.join(projectRoot, 'raw_exports'),
      path.join(projectRoot, '..', 'temperary'),
      path.join(projectRoot, 'temperary'),
      rawDir,
      rawDir ? path.join(rawDir, 'raw_exports') : null,
      path.join(projectRoot, 'datamine', 'shared', 'media')
    ].filter(Boolean);

    baseCandidates.forEach(b => {
      targetSubdirs.forEach(parts => {
        const p = path.join(b, ...parts);
        if (fs.existsSync(p) && !rootsToScan.includes(p)) rootsToScan.push(p);
      });
    });

    const allFiles = [];
    function walkDir(dir) {
      if (!dir || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === '.pipeline-work' || entry.name === 'node_modules' || entry.name === 'dist_datamine_bundle' || entry.name === 'assets') continue;
            walkDir(full);
          } else if (entry.name.endsWith('.png') || entry.name.endsWith('.webp')) {
            allFiles.push(full);
          }
        }
      } catch (_) {}
    }

    rootsToScan.forEach(d => walkDir(d));
    reportsCache._diskFilesAll = allFiles;
  }

  const diskFiles = (reportsCache._diskFilesAll || []).filter(full => {
    const lower = full.toLowerCase().replace(/\\/g, '/');
    const baseNameOnly = path.basename(lower, path.extname(lower));

    // 0. General 3D / mesh masks / thumbnails
    if (lower.includes('/ter/') || lower.includes('/ter_') || lower.includes('builtdata') || lower.includes('/textures/masks/')) return false;
    if (lower.includes('.thumb.')) return false;
    if (lower.includes('fashion_icon_shipin')) return false;
    if (lower.includes('fashion_decoration_')) return false;
    if (lower.includes('/secretaction/') || lower.includes('fishking') || lower.includes('_gene.') || lower.includes('gene_')) return false;

    // 1. Exclude MC Player Outfits
    if (lower.includes('/item_fashion_icon/') || lower.includes('/fashion_icon/item_fashion_icon/')) return false;
    if (/^fashion_[fm]\d+/i.test(baseNameOnly)) return false;

    // 2. Exclude Story Bosses & Monster encounters (preserving combo operation guides)
    if ((lower.includes('/scenery/monster/') && !baseNameOnly.startsWith('ui_operate_') && !baseNameOnly.startsWith('ui_nitai_')) || lower.includes('/plugin/fb/bigmon/')) return false;
    if (/^(tx_)?boss_/i.test(baseNameOnly) || /^(tx_)?mon_/i.test(baseNameOnly) || /^boss_hum_/i.test(baseNameOnly)) return false;

    // 3. Exclude Minimap Icons
    if (lower.includes('/minimap/')) return false;
    if (/^map(jiuyu)?_/i.test(baseNameOnly)) return false;

    // 4. Exclude Cinematic Photos
    if (lower.includes('/cinematicphoto/') || /^cinematicphoto/i.test(baseNameOnly)) return false;

    // 5. Exclude Chat Emojis & Stickers
    if (lower.includes('/liaotian/biaoqing/')) return false;
    if (/^emoji_\d+/i.test(baseNameOnly)) return false;
    if (/^\d+$/.test(baseNameOnly) && lower.includes('/liaotian/')) return false;

    // 6. Exclude Facial Expressions
    if (lower.includes('/scenery/minigame/') || lower.includes('facialmovements')) return false;

    // 7. Exclude Generic Numeric Player Cosmetics (Avatars, Frames, Bubbles)
    if (/^avatar_s?_\d+$/i.test(baseNameOnly)) return false;
    if (/^avatarframe_(s_)?\d+$/i.test(baseNameOnly)) return false;
    if (/^icon_avatarframe_\d+$/i.test(baseNameOnly)) return false;
    if (/^item_avatar_\d+$/i.test(baseNameOnly)) return false;
    if (/^qipao_\d+$/i.test(baseNameOnly)) return false;
    if (/^icon_qipao_\d+$/i.test(baseNameOnly)) return false;

    // Exclude foreign character names in UP folder (e.g. fenlier or asilada inside Zoey's folder)
    if (charId === 'zoey' && (baseNameOnly.includes('fenlier') || baseNameOnly.includes('asilada'))) return false;

    // Bound assets have an exact exported identity path. Generic icon discovery
    // keeps the established character/weapon token matching outside these families.
    const isBoundMatch = boundRefs.has(normalizeUnrealPath(full).toLowerCase());
    const isPluginMatch = lower.includes('/plugin/icon/') && pluginAliases.some(alias => baseNameOnly.includes(alias));
    return isBoundMatch || isPluginMatch || charRegex.test(lower);
  });

  diskFiles.forEach(srcPath => {
    const p = srcPath.replace(/\\/g, '/');
    const base = path.basename(p, path.extname(p));
    const baseLower = base.toLowerCase();
    const pLower = p.toLowerCase();

    let id = base;
    let nameEn = `${charNameEn} ${base}`;
    let nameRu = `${charNameRu}: ${base}`;
    let cat = 'art';
    let badgeEn = 'Asset';
    let badgeRu = 'Медиа';

    if (baseLower.startsWith('ui_operate_') || (baseLower.startsWith('ui_nitai_') && baseLower.includes('l10n'))) {
      const culture = p.match(/\/L10N\/([^/]+)\//i)?.[1] ?? 'en';
      const tag = culture.toUpperCase();
      id = `${base}_${culture}`;
      cat = 'art';
      badgeEn = `Combo Guide (${tag})`;
      badgeRu = `Схема комбо (${tag})`;
      nameEn = `${charNameEn} Weapon Combo Guide (${tag})`;
      nameRu = `${charNameRu}: Схема комбо оружия (${tag})`;
    } else if (baseLower.startsWith('niudan_jh_')) {
      cat = 'art';
      badgeEn = 'Gashapon Art';
      badgeRu = 'Арт гасяпона';
      nameEn = `${charNameEn} Gashapon Splash Art`;
      nameRu = `${charNameRu}: Арт гасяпона`;
    } else if (pLower.includes('/leisureroom/content/')) {
      cat = 'dorm';
      const cleanBase = base.replace(/^(icon_)?sushe_jiaju_(xq_)?/i, '')
                            .replace(/^sc_dz_/i, '')
                            .replace(/^room_([a-z0-9]+_)?sw_/i, '')
                            .replace(/^(btn|img|icon)_([a-z0-9]+_)?/i, '')
                            .replace(/_/g, ' ')
                            .trim();

      if (pLower.includes('/jiaju/') || pLower.includes('/jj/') || baseLower.includes('sushe_jiaju')) {
        if (baseLower.startsWith('icon_') || pLower.includes('/icon/')) {
          badgeEn = 'Dorm Furniture Icon'; badgeRu = 'Иконка мебели';
          nameEn = `${charNameEn} Dorm Furniture Icon: ${cleanBase || base}`;
          nameRu = `Иконка мебели общежития ${charNameRu}: ${cleanBase || base}`;
        } else {
          badgeEn = 'Dorm Furniture'; badgeRu = 'Мебель общежития';
          nameEn = `${charNameEn} Dorm Furniture: ${cleanBase || base}`;
          nameRu = `Мебель общежития ${charNameRu}: ${cleanBase || base}`;
        }
      } else if (pLower.includes('/jh/') || pLower.includes('/qj/') || baseLower.startsWith('sc_dz_')) {
        badgeEn = 'Dorm Interaction'; badgeRu = 'Взаимодействие';
        nameEn = `${charNameEn} Dorm Interaction: ${cleanBase || base}`;
        nameRu = `Взаимодействие в общежитии ${charNameRu}: ${cleanBase || base}`;
      } else if (pLower.includes('/sw/') || baseLower.includes('_sw_')) {
        badgeEn = 'Dorm Souvenir'; badgeRu = 'Сувенир общежития';
        nameEn = `${charNameEn} Dorm Souvenir: ${cleanBase || base}`;
        nameRu = `Сувенир общежития ${charNameRu}: ${cleanBase || base}`;
      } else if (pLower.includes('/xz/')) {
        badgeEn = 'Dorm Portrait'; badgeRu = 'Портрет общежития';
        nameEn = `${charNameEn} Dorm Portrait: ${cleanBase || base}`;
        nameRu = `Портрет общежития ${charNameRu}: ${cleanBase || base}`;
      } else if (pLower.includes('/yz/') || pLower.includes('/bg/')) {
        badgeEn = 'Dorm Scene'; badgeRu = 'Сцена общежития';
        nameEn = `${charNameEn} Dorm Scene: ${cleanBase || base}`;
        nameRu = `Сцена общежития ${charNameRu}: ${cleanBase || base}`;
      } else if (baseLower.includes('zhaopian')) {
        badgeEn = 'Dorm Photo'; badgeRu = 'Фото общежития';
        nameEn = `${charNameEn} Dorm Photo`;
        nameRu = `Фото общежития ${charNameRu}`;
      } else {
        badgeEn = 'Dorm Asset'; badgeRu = 'Общежитие';
        nameEn = `${charNameEn} Dorm: ${cleanBase || base}`;
        nameRu = `Общежитие ${charNameRu}: ${cleanBase || base}`;
      }
    } else if (baseLower.startsWith('zuoyi_jdt')) {
      cat = 'weapon';
      if (baseLower === 'zuoyi_jdt1_1') {
        nameEn = `${charNameEn} Weapon HUD Gauge Base`;
        nameRu = `Слот шкалы оружия ${charNameRu}: База`;
        badgeEn = 'HUD Gauge'; badgeRu = 'Шкала HUD';
      } else if (baseLower === 'zuoyi_jdt1_3') {
        nameEn = `${charNameEn} Weapon HUD Gauge Fill`;
        nameRu = `Шкала оружия ${charNameRu}: Заполнение`;
        badgeEn = 'HUD Gauge'; badgeRu = 'Шкала HUD';
      } else if (baseLower === 'zuoyi_jdt1_book2') {
        nameEn = `${charNameEn} Weapon HUD Tome Icon`;
        nameRu = `Иконка книги HUD ${charNameRu}`;
        badgeEn = 'HUD Icon'; badgeRu = 'Иконка HUD';
      } else if (baseLower === 'zuoyi_jdt2_2') {
        nameEn = `${charNameEn} Weapon HUD Charge Pointer`;
        nameRu = `Маркер шкалы оружия ${charNameRu}`;
        badgeEn = 'HUD Element'; badgeRu = 'Элемент HUD';
      } else if (baseLower === 'zuoyi_jdt2_3') {
        nameEn = `${charNameEn} Weapon HUD Glow Indicator`;
        nameRu = `Индикатор свечения шкалы ${charNameRu}`;
        badgeEn = 'HUD Glow'; badgeRu = 'Свечение HUD';
      }
    } else if (pLower.includes('/chouka/') || baseLower.startsWith('ui_up') || baseLower.startsWith('bg_up') || baseLower.startsWith('btn_card')) {
      if (baseLower.startsWith('img_') || (baseLower.includes('lihui') && (baseLower.includes('_01') || baseLower.includes('_02') || baseLower.endsWith('01') || baseLower.endsWith('02')))) {
        cat = 'art';
        badgeEn = 'Special Order Photo';
        badgeRu = 'Фото спецзаказа';
        const photoNum = base.match(/\d+$/) ? base.match(/\d+$/)[0].replace(/^0+/, '') : '';
        nameEn = `${charNameEn} Special Order Photo ${photoNum || base}`;
        nameRu = `Фото спецзаказа ${charNameRu} ${photoNum || base}`;
      } else if (baseLower.startsWith('bg_up') || baseLower.endsWith('_bkg') || baseLower.endsWith('_bg')) {
        cat = 'art';
        badgeEn = 'Banner Background';
        badgeRu = 'Фон баннера';
        nameEn = `${charNameEn} Special Order Banner Background`;
        nameRu = `Фон баннера спецзаказа ${charNameRu}`;
      } else if (baseLower.startsWith('btn_card')) {
        cat = 'art';
        badgeEn = 'Gacha Card';
        badgeRu = 'Карточка заказа';
        const isSelected = baseLower.includes('selected');
        nameEn = `${charNameEn} Special Order Card${isSelected ? ' (Selected)' : ''}`;
        nameRu = `Карточка спецзаказа ${charNameRu}${isSelected ? ' (Выбрано)' : ''}`;
      } else if (baseLower.includes('wq_icon') || baseLower.includes('_wq') || baseLower.includes('wuqi')) {
        cat = 'weapon';
        nameEn = `${charNameEn} Special Order Weapon Icon`;
        nameRu = `Иконка оружия спецзаказа ${charNameRu}`;
        badgeEn = 'Weapon Icon';
        badgeRu = 'Иконка оружия';
      } else if (baseLower.includes('yz_icon') || baseLower.includes('_yz') || baseLower.includes('yizhi')) {
        cat = 'matrix';
        nameEn = `${charNameEn} Special Order Matrix Icon`;
        nameRu = `Иконка матрицы спецзаказа ${charNameRu}`;
        badgeEn = 'Matrix Icon';
        badgeRu = 'Иконка матрицы';
      } else if (baseLower.includes('ttile') || baseLower.includes('title')) {
        cat = 'art';
        nameEn = `${charNameEn} Special Order Event Banner`;
        nameRu = `Баннер события спецзаказа ${charNameRu}`;
        badgeEn = 'Event Banner';
        badgeRu = 'Баннер события';
      } else if (baseLower.includes('lihui')) {
        cat = 'art';
        nameEn = `${charNameEn} Special Order Character Splash`;
        nameRu = `Сплэш-арт персонажа спецзаказа ${charNameRu}`;
        badgeEn = 'Special Order';
        badgeRu = 'Спецзаказ';
      }
    } else if (baseLower === 'zoey' && pLower.includes('huanxing/beiying')) {
      cat = 'art'; nameEn = `${charNameEn} Awakening Silhouette`; nameRu = `Силуэт пробуждения ${charNameRu}`; badgeEn = 'Awakening Silhouette'; badgeRu = 'Силуэт пробуждения';
    } else if (baseLower === 'zuoyi2' && pLower.includes('huanxing/lihui')) {
      cat = 'art'; nameEn = `${charNameEn} Awakening Splash Art (Lihui)`; nameRu = `Арт пробуждения ${charNameRu} (Лихуэй)`; badgeEn = 'Awakening Splash'; badgeRu = 'Арт пробуждения';
    } else if (baseLower.includes('ssr_lh_')) {
      cat = 'art'; nameEn = `${charNameEn} Gacha Splash Card Art`; nameRu = `Карточка заказа ${charNameRu} (Сплэш)`; badgeEn = 'Gacha Card'; badgeRu = 'Карта гачи';
    } else if (baseLower === 'action_zuoyi') {
      cat = 'avatar'; nameEn = `${charNameEn} Bow Emote (Chat Action)`; nameRu = `Эмоция чата: Поклон ${charNameRu}`; badgeEn = 'Chat Emote'; badgeRu = 'Эмоция чата';
    } else if (baseLower.startsWith('touxiang_')) {
      cat = 'avatar'; nameEn = `${charNameEn} Headshot ${base.replace('touxiang_', '')}`; nameRu = `Иконка головы ${charNameRu}`; badgeEn = 'Profile Headshot'; badgeRu = 'Иконка профиля';
    } else if (baseLower === 'ui_imitation_78') {
      cat = 'art'; nameEn = `${charNameEn} Simulacrum Selection A0`; nameRu = `Выбор симулякра ${charNameRu}: A0`; badgeEn = 'Showcase Silhouette'; badgeRu = 'Силуэт симулякра';
    } else if (baseLower === 'ui_imitation_78_2') {
      cat = 'art'; nameEn = `${charNameEn} Simulacrum Selection A3`; nameRu = `Выбор симулякра ${charNameRu}: A3`; badgeEn = 'Showcase Silhouette'; badgeRu = 'Силуэт симулякра';
    } else if (baseLower === 'imitation_78') {
      cat = 'art'; nameEn = `${charNameEn} Detail Art`; nameRu = `Основной арт симулякра ${charNameRu}`; badgeEn = 'Detail Art'; badgeRu = 'Основной арт';
    } else if (baseLower === 'imitation_78_xiangqing') {
      cat = 'art'; nameEn = `${charNameEn} Detail Background Art`; nameRu = `Фоновый арт симулякра ${charNameRu}`; badgeEn = 'Background Art'; badgeRu = 'Фоновый арт';
    } else if (baseLower.startsWith('fashion_icon_ornament_')) {
      cat = 'item'; nameEn = `${charNameEn} Haute Couture Ornament`; nameRu = `Кутюр-украшение ${charNameRu}`; badgeEn = 'Haute Couture'; badgeRu = 'Кутюр-облик';
    } else if (baseLower.startsWith('fashion_icon_shipin_')) {
      cat = 'item'; nameEn = `${charNameEn} Fashion Accessory ${base.replace('fashion_icon_shipin_', '')}`; nameRu = `Аксессуар костюма ${charNameRu}`; badgeEn = 'Accessory'; badgeRu = 'Аксессуар';
    } else if (baseLower === 'icon_imitation_fashion_78') {
      cat = 'item'; nameEn = `${charNameEn} Haute Couture Token`; nameRu = `Жетон кутюр-облика ${charNameRu}`; badgeEn = 'Haute Couture'; badgeRu = 'Кутюр-облик';
    } else if (baseLower === 'icon_imitation_fashion_78_w') {
      cat = 'item'; nameEn = `${charNameEn} Weapon Haute Couture Token`; nameRu = `Жетон кутюр-оружия ${charNameRu}`; badgeEn = 'Haute Couture'; badgeRu = 'Кутюр-облик';
    } else if (baseLower === 'manyou_imitation_78') {
      cat = 'avatar'; nameEn = `${charNameEn} Wanderer Roaming Avatar`; nameRu = `Аватар странствий ${charNameRu}`; badgeEn = 'Wanderer Avatar'; badgeRu = 'Аватар странствий';
    } else if (/^weapon_.*_512$/i.test(baseLower) || (baseLower.startsWith('weapon_') && baseLower.endsWith('_512')) || pLower.includes('/plugin/icon/bigsize/')) {
      cat = 'weapon';
      badgeEn = 'Weapon 512px';
      badgeRu = 'Оружие 512px';
      nameEn = (wNameEn && wNameEn !== 'Weapon') ? `${wNameEn} (512px)` : `${charNameEn} Weapon (512px)`;
      nameRu = (wNameRu && wNameRu !== 'Weapon' && wNameRu !== 'Оружие') ? `${wNameRu}: Оружие (512px)` : `${charNameRu}: Оружие (512px)`;
    } else if (/^(ca|cha)jian_item_weapon_/i.test(baseLower) || (pLower.includes('/plugin/icon/') && !pLower.includes('/512/'))) {
      cat = 'weapon';
      badgeEn = 'Weapon Showcase';
      badgeRu = 'Витрина оружия';
      if (baseLower === 'cajian_item_weapon_r_spear_ice01') {
        nameEn = 'Ice Spear Showcase Card';
        nameRu = 'Ледяное копьё: Витрина оружия';
      } else if (baseLower === 'chajian_item_weapon_r_ds_phy01') {
        nameEn = 'Dual Blades Showcase Card';
        nameRu = 'Парные клинки: Витрина оружия';
      } else if (baseLower === 'chajian_item_weapon_r_sword_thunder01') {
        nameEn = 'Thunder Sword Showcase Card';
        nameRu = 'Громовой меч: Витрина оружия';
      } else {
        nameEn = (wNameEn && wNameEn !== 'Weapon') ? `${wNameEn} Showcase Card` : `${charNameEn} Weapon Showcase Card`;
        nameRu = (wNameRu && wNameRu !== 'Weapon' && wNameRu !== 'Оружие') ? `${wNameRu}: Витрина оружия` : `${charNameRu}: Витрина оружия`;
      }
    } else if (baseLower.startsWith('icon_cj_512_') || pLower.includes('/plugin/icon/512/')) {
      cat = 'matrix';
      const slotMatch = baseLower.match(/0([1-4])$/);
      const slotNum = slotMatch ? slotMatch[1] : '';
      badgeEn = slotNum ? `Matrix Slot ${slotNum}` : 'Matrix Chip';
      badgeRu = slotNum ? `Чип матрицы ${slotNum}` : 'Чип матрицы';
      nameEn = slotNum ? `${charNameEn} Matrix Chip Slot ${slotNum}` : `${charNameEn} Matrix Chip`;
      nameRu = slotNum ? `${charNameRu}: Чип матрицы ${slotNum}` : `${charNameRu}: Чип матрицы`;
    } else if (baseLower.includes('matrix') || baseLower.includes('yizhi') || pLower.includes('/yizhi/') || pLower.includes('/matrix/') || (suitSuffix && baseLower.includes(suitSuffix))) {
      if (pLower.includes('/skill/')) {
        cat = 'skill'; badgeEn = 'Buff'; badgeRu = 'Бафф';
        nameEn = `${charNameEn} Matrix Skill Buff`; nameRu = `${charNameRu}: Бафф матрицы`;
      } else if (baseLower.includes('buff') || pLower.includes('/buff/')) {
        cat = 'matrix'; badgeEn = 'Matrix Buff'; badgeRu = 'Бафф матрицы';
        nameEn = `${charNameEn} Matrix Set Buff`; nameRu = `${charNameRu}: Бафф набора матрицы`;
      } else {
        cat = 'matrix'; badgeEn = 'Matrix Icon'; badgeRu = 'Иконка матрицы';
        nameEn = `${charNameEn} Matrix Icon`; nameRu = `${charNameRu}: Иконка матрицы`;
      }
    } else if (pLower.includes('/icon/skill/') || pLower.includes('/weaponskill/') || baseLower.includes('bedmgdown') || baseLower.includes('skill') || (baseLower.startsWith('buff_') && !baseLower.includes('matrix'))) {
      cat = 'skill';
      if (baseLower.includes('bedmgdown')) {
        badgeEn = 'Defensive Buff'; badgeRu = 'Защитный бафф';
        nameEn = `${charNameEn} Damage Reduction Buff`; nameRu = `${charNameRu}: Защитный бафф снижения урона`;
      } else if (baseLower.startsWith('buff_')) {
        badgeEn = 'Buff'; badgeRu = 'Бафф';
        nameEn = `${charNameEn} Buff: ${base.replace(/^buff_/i, '')}`; nameRu = `${charNameRu}: Бафф ${base.replace(/^buff_/i, '')}`;
      } else {
        badgeEn = 'Weapon Skill'; badgeRu = 'Навык';
        nameEn = `${charNameEn} Skill: ${base}`; nameRu = `${charNameRu}: Навык ${base}`;
      }
    } else if (pLower.includes('/icon/weapon/icon/') || baseLower.startsWith('item_weapon_') || baseLower.includes('_wq_icon')) {
      cat = 'weapon';
      badgeEn = 'Weapon Icon'; badgeRu = 'Иконка оружия';
      nameEn = `${charNameEn} Weapon Icon`; nameRu = `${charNameRu}: Иконка оружия`;
    } else if (pLower.includes('/icon/weapon/icon_yizhi/') || pLower.includes('/icon/yizhi/') || pLower.includes('/icon/matrix/') || baseLower.startsWith('yizhi_') || baseLower.includes('_yz_icon')) {
      cat = 'matrix';
      badgeEn = 'Matrix Icon'; badgeRu = 'Иконка матрицы';
      nameEn = `${charNameEn} Matrix Icon`; nameRu = `${charNameRu}: Иконка матрицы`;
    } else if (baseLower.startsWith('buff_matrix_') || pLower.includes('/buff_matrix_')) {
      cat = 'matrix';
      badgeEn = 'Matrix Buff'; badgeRu = 'Бафф матрицы';
      nameEn = `${charNameEn} Matrix Set Buff`; nameRu = `${charNameRu}: Бафф матрицы`;
    } else if (pLower.includes('/icon/weapon/name/') || pLower.includes('/cards/name_') || baseLower.startsWith('name_') || baseLower.startsWith('nitai_name_')) {
      cat = 'art';
      badgeEn = 'Name Graphic'; badgeRu = 'Логотип имени';
      nameEn = `${charNameEn} Name Logo`; nameRu = `${charNameRu}: Логотип имени`;
    }

    registerAsset(id, nameEn, nameRu, cat, badgeEn, badgeRu, p, p);
  });

  // Portable records: dimensions come from the copied PNG and the source path is
  // reported relative to the staging/raw tree, never as a machine-local path.
  const assetDir = path.join(projectRoot, 'info', 'simulacra', 'assets', charId);
  for (const asset of discovered) {
    if (!asset.width) {
      try {
        const head = Buffer.alloc(30);
        const fd = fs.openSync(path.join(assetDir, asset.file), 'r');
        fs.readSync(fd, head, 0, 30, 0);
        fs.closeSync(fd);
        let size = null;
        if (head.slice(0, 4).toString('hex') === '89504e47') {
          size = [head.readUInt32BE(16), head.readUInt32BE(20)];
        } else if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
          // Older exports stored some textures as WebP under a .png name.
          const chunk = head.toString('ascii', 12, 16);
          if (chunk === 'VP8L') size = [1 + (((head[22] & 0x3f) << 8) | head[21]), 1 + (((head[24] & 0x0f) << 10) | (head[23] << 2) | ((head[22] & 0xc0) >> 6))];
          else if (chunk === 'VP8X') size = [1 + head.readUIntLE(24, 3), 1 + head.readUIntLE(27, 3)];
          else if (chunk === 'VP8 ') size = [head.readUInt16LE(26) & 0x3fff, head.readUInt16LE(28) & 0x3fff];
        }
        if (size) {
          asset.width = size[0];
          asset.height = size[1];
          asset.resolution = `${asset.width}×${asset.height}`;
        }
      } catch (_) {}
    }
    if (asset.sourceOnDisk) {
      const absolute = path.resolve(asset.sourceOnDisk);
      const base = [rawDir, path.join(projectRoot, 'datamine', 'shared', 'media'), projectRoot]
        .filter(Boolean)
        .map((dir) => path.resolve(dir))
        .find((dir) => absolute.toLowerCase().startsWith(dir.toLowerCase() + path.sep));
      asset.sourceOnDisk = (base ? path.relative(base, absolute) : path.basename(absolute)).split(path.sep).join('/');
    }
  }

  // Save standalone manifest
  const manifestPath = path.join(projectRoot, 'info', 'simulacra', 'data', `${charId}-assets.json`);
  if (fs.existsSync(path.dirname(manifestPath))) {
    fs.writeFileSync(manifestPath, JSON.stringify(discovered, null, 2), 'utf8');
  }

  return discovered;
}

function run(options: Record<string, any> = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '../..');
  const rawDir = resolveRawDir(projectRoot, options.rawDir);
  const targetChar = options.char ? options.char.toLowerCase() : null;

  console.log(`[build-simulacra-assets] Running asset builder...`);
  console.log(`[build-simulacra-assets] Project root: ${projectRoot}`);
  console.log(`[build-simulacra-assets] Raw dir: ${rawDir}`);

  const reportsDir = resolveReportsDir(projectRoot);
  console.log(`[build-simulacra-assets] Reports dir: ${reportsDir || 'None (using direct extraction)'}`);
  const reportsCache = { ...loadReports(reportsDir), _characterBindings: null as ReturnType<typeof createCharacterMediaBindings> | null };

  const indexPath = path.join(projectRoot, 'info', 'simulacra', 'data', 'simulacra-index.json');
  if (!fs.existsSync(indexPath)) {
    console.error(`[build-simulacra-assets] Missing simulacra-index.json`);
    return;
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const roster = index.map(summary => {
    const file = path.join(projectRoot, 'info', 'simulacra', 'data', `${summary.id}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : summary;
  });
  reportsCache._characterBindings = createCharacterMediaBindings(rawDir, roster);
  fs.writeFileSync(path.join(projectRoot, 'info', 'simulacra', 'data', 'asset-binding-coverage.json'), JSON.stringify({
    ambiguous: reportsCache._characterBindings.ambiguous, missing: reportsCache._characterBindings.missing,
  }, null, 2));
  const charsToProcess = targetChar ? index.filter(c => c.id === targetChar) : index;

  console.log(`[build-simulacra-assets] Processing ${charsToProcess.length} character(s)...`);

  let totalAssets = 0;
  for (const charSummary of charsToProcess) {
    const charFile = path.join(projectRoot, 'info', 'simulacra', 'data', `${charSummary.id}.json`);
    if (!fs.existsSync(charFile)) continue;
    const charData = JSON.parse(fs.readFileSync(charFile, 'utf8'));

    const assets = processCharacterAssets(charData, projectRoot, rawDir, reportsCache);
    totalAssets += assets.length;
    console.log(`[build-simulacra-assets] Character ${charSummary.id} (${charSummary.name_en}): ${assets.length} assets processed.`);

    // Inject into character json
    charData.assets = assets;
    const dirsToUpdate = [path.join(projectRoot, 'info', 'simulacra', 'data')];
    dirsToUpdate.forEach(d => {
      const f = path.join(d, `${charSummary.id}.json`);
      if (fs.existsSync(d)) {
        fs.writeFileSync(f, JSON.stringify(charData, null, 2), 'utf8');
      }
    });
  }

  // Sync assets into unified simulacra.json datasets for both gacha and MMO profiles
  const simPaths = [path.join(projectRoot, 'info', 'simulacra', 'data', 'simulacra.json')];
  for (const sPath of simPaths) {
    if (fs.existsSync(sPath)) {
      try {
        const simData = JSON.parse(fs.readFileSync(sPath, 'utf8'));
        const updateList = (list) => {
          if (!Array.isArray(list)) return;
          for (const item of list) {
            const baseSlug = (item.canonical_id || item.slug || item.id.replace(/-mmo$/, '')).toLowerCase();
            const manifestF = path.join(projectRoot, 'info', 'simulacra', 'data', `${baseSlug}-assets.json`);
            if (fs.existsSync(manifestF)) {
              try {
                item.assets = JSON.parse(fs.readFileSync(manifestF, 'utf8'));
              } catch (_) {}
            }
          }
        };
        updateList(simData.items);
        updateList(simData.simulacra);
        if (simData.modes) {
          updateList(simData.modes.gacha);
          updateList(simData.modes.mmo);
        }
        fs.writeFileSync(sPath, JSON.stringify(simData, null, 2), 'utf8');
      } catch (_) {}
    }
  }

  console.log(`[build-simulacra-assets] Complete! Total assets generated: ${totalAssets}`);
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  let char = null;
  const charEq = args.find(a => a.startsWith('--char='));
  if (charEq) {
    char = charEq.split('=')[1];
  } else {
    const charIdx = args.indexOf('--char');
    if (charIdx !== -1 && args[charIdx + 1]) char = args[charIdx + 1];
  }
  const option = (name) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? path.resolve(hit.slice(name.length + 3)) : undefined;
  };
  run({ char, projectRoot: option('project-root'), rawDir: option('raw-dir') });
}

export {
  run,
  processCharacterAssets,
  resolveReportsDir,
  resolveRawDir,
  loadReports,
};
