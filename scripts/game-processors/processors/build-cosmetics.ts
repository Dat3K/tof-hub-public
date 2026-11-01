import { readGameSourceFileSync, projectsCjkCulture } from './game-source-reader';
/**
 * build-cosmetics.js
 *
 * Canonical processor for Tower of Fantasy cosmetics:
 * - Avatars
 * - Avatar Frames
 * - Titles
 * - Chat Backgrounds (chat_qipao)
 * - Mounts (zuoqi)
 *
 * Emits datasets to:
 * - info/cosmetics/data/
 */

import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';
import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';
import { assetReference, avatarAnimationSource, avatarFlipbookRecipe, chatStickerCatalog, emojiFlipbookRecipe, mountImageCandidates, COSMETIC_TABLES } from './cosmetic-sources';
import {inspectCosmeticEffects, resolveMaterialParameters} from './cosmetic-source-audit';
import {normalizeUnrealSoftReference} from './canonical-media-library';
import {pngEdgeCoverage} from './png-edges';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-cosmetics] Error reading JSON at ${filePath}:`, e.message);
    return null;
  }
}

function resolveProjectRoot() {
  const customArg = process.argv.find((arg) => arg.startsWith('--project-root='));
  if (customArg) return path.resolve(customArg.slice('--project-root='.length));
  let cur = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
    cur = path.resolve(cur, '..');
  }
  return path.resolve(__dirname, '../..');
}

function resolveRawDir(projectRoot) {
  const customArg = process.argv.find((arg) => arg.startsWith('--raw-dir='));
  if (customArg) return path.resolve(customArg.split('=')[1]);

  const candidateDirs = [
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports'),
    path.join(projectRoot, 'raw_exports'),
    path.join(projectRoot, '..', 'temperary'),
    path.join(projectRoot, 'temperary'),
    path.join(projectRoot, '..', 'raw_exports')
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(projectRoot, 'raw_exports');
}

function findFile(rawDir, relCandidates) {
  const projectRoot = resolveProjectRoot();
  const searchDirs = [
    rawDir,
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports'),
    path.join(projectRoot, 'raw_exports'),
    path.join(projectRoot, '..', 'temperary'),
    path.join(projectRoot, 'temperary')
  ].filter((d, i, arr) => d && fs.existsSync(d) && arr.indexOf(d) === i);

  for (const sDir of searchDirs) {
    for (const rel of relCandidates) {
      const full = path.join(sDir, rel);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

function mapQuality(rawQuality) {
  if (!rawQuality) return 'N';
  const q = String(rawQuality).toUpperCase();
  if (q.includes('LEGENDRY') || q.includes('LEGENDARY') || q.includes('SSR') || q.includes('GOLD')) return 'SSR';
  if (q.includes('SUPERRARE') || q.includes('EPIC') || q.includes('SR') || q.includes('PURPLE')) return 'SR';
  if (q.includes('SENIOR') || q.includes('RARE') || q.includes('BLUE')) return 'R';
  if (q.includes('POOR') || q.includes('COMMON') || q.includes('WHITE') || q.includes('GREEN') || q === 'N') return 'N';
  return 'N';
}

function cleanName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/^Undecorated$/i, '').trim();
}

function hasCjk(str) {
  if (projectsCjkCulture()) return false;
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(str || '');
}

function resolveEntityBilingual(locResolver, nameObj, id) {
  const b = locResolver.resolveBilingual(nameObj, { fallbackId: id });
  if (hasCjk(b.name_en)) {
    const cleanId = id.replace(/^(bag_|Item_)/i, '');
    const candidates = [
      id,
      id + '_name',
      id.replace(/^Item_/i, ''),
      id.replace(/^Item_/i, '') + '_name',
      id.replace(/^bag_/i, ''),
      id.replace(/^bag_/i, '') + '_name',
      id.replace(/_/g, '-'),
      'item_' + cleanId + '_name',
      'recipe_' + cleanId.toLowerCase(),
      'recipe_' + cleanId.toLowerCase() + '_name'
    ];
    for (const cand of candidates) {
      const alt = locResolver.resolveBilingual({ TableId: '/Game/Resources/Text/ST_item.ST_Item', Key: cand }, { fallbackId: id });
      if (alt.name_en && !hasCjk(alt.name_en)) {
        b.name_en = alt.name_en;
        if (!b.name_ru || hasCjk(b.name_ru)) {
          b.name_ru = alt.name_ru || alt.name_en;
        }
        break;
      }
    }
  }
  return b;
}

function buildCosmeticsDatasets() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'info', 'cosmetics', 'data');
  const targetDirs = [outDir];
  // copyImage is attached below for this processor only.
  const imageCopier: ImageCopier & Record<string, any> = new ImageCopier(rawDir, projectRoot);

  console.log(`[build-cosmetics] Project root: ${projectRoot}`);
  console.log(`[build-cosmetics] Raw data dir: ${rawDir}`);

  // Setup LocalizationResolver
  const locResolver = createLocalizationResolver();
  const locEnFile = findFile(rawDir, [
    'Hotta/Content/Localization/Game/en/Game.json',
    'Game/en/Game.json',
    'Localization/Game/en/Game.json'
  ]);
  const locRuFile = findFile(rawDir, [
    'Hotta/Content/Localization/Game/ru/Game.json',
    'Game/ru/Game.json',
    'Localization/Game/ru/Game.json'
  ]);
  if (locEnFile) locResolver.loadLocale('en', readJsonFile(locEnFile));
  if (locRuFile) locResolver.loadLocale('ru', readJsonFile(locRuFile));

  const stItemOverseaFile = findFile(rawDir, [
    'Hotta/Content/Resources/Text/Oversea/ST_Item_Oversea.json',
    'ST_Item_Oversea.json'
  ]);
  if (stItemOverseaFile) locResolver.loadLocale('en', readJsonFile(stItemOverseaFile));

  // Load ItemConfigs (Standard + Overseas)
  const itemConfigsStdPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json',
    'ItemConfigs.json'
  ]);
  const itemConfigsOsPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs_OS.json',
    'ItemConfigs_OS.json'
  ]);
  const rawStdItems = itemConfigsStdPath ? readJsonFile(itemConfigsStdPath) : null;
  const rawOsItems = itemConfigsOsPath ? readJsonFile(itemConfigsOsPath) : null;
  const stdItemRows = rawStdItems?.[0]?.Rows || rawStdItems?.Rows || rawStdItems || {};
  const osItemRows = rawOsItems?.[0]?.Rows || rawOsItems?.Rows || rawOsItems || {};
  const itemRows = { ...stdItemRows, ...osItemRows };
  const readRows = (file: string) => {
    const value = readJsonFile(file);
    return value?.[0]?.Rows || value?.Rows || {};
  };
  const toolsPath = findFile(rawDir, [COSMETIC_TABLES.tools]);
  const emblemsPath = findFile(rawDir, [COSMETIC_TABLES.emblems]);
  const skinsPath = findFile(rawDir, [COSMETIC_TABLES.mountSkins]);
  const toolRows = toolsPath ? readRows(toolsPath) : {};
  const emblemRows = emblemsPath ? readRows(emblemsPath) : {};
  const skinRows = skinsPath ? readRows(skinsPath) : {};
  const relativeSource = (file: string) => path.relative(rawDir, file).replace(/\\/g, '/');
  const itemSource = (id: string) => relativeSource(osItemRows[id] ? itemConfigsOsPath : itemConfigsStdPath);

  // Load Avatar Configs & Frames if available
  const avatarConfigPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/AvatarConfigDataTable.json',
    'AvatarConfigDataTable.json'
  ]);
  const avatarFrameConfigPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/AvatarFrameConfigDataTable.json',
    'AvatarFrameConfigDataTable.json'
  ]);
  const rawAvatarConfig = avatarConfigPath ? readJsonFile(avatarConfigPath) : null;
  const rawAvatarFrameConfig = avatarFrameConfigPath ? readJsonFile(avatarFrameConfigPath) : null;
  const avatarConfigRows = rawAvatarConfig?.[0]?.Rows || rawAvatarConfig?.Rows || rawAvatarConfig || {};
  const avatarFrameConfigRows = rawAvatarFrameConfig?.[0]?.Rows || rawAvatarFrameConfig?.Rows || rawAvatarFrameConfig || {};

  // Load Mount Configs if available
  const mountConfigPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/MountConfigDataTable.json',
    'MountConfigDataTable.json'
  ]);
  const rawMountConfig = mountConfigPath ? readJsonFile(mountConfigPath) : null;
  const mountConfigRows = rawMountConfig?.[0]?.Rows || rawMountConfig?.Rows || rawMountConfig || {};

  // Diagnostics counters
  let totalEntities = 0;
  let exactFieldMatches = 0;
  let joinMatches = 0;
  let namingMatches = 0;
  let curatedMatches = 0;
  let unresolvedCount = 0;

  if (typeof imageCopier.copyImage !== 'function') {
    imageCopier.copyImage = function(ref, category, entityId, exactOnly = false) {
      if (!ref || ref === 'None' || ref === 'null') return null;
      if (exactOnly && this.resolveAsset(ref).matchStrategy !== 'exact_game_path') return null;
      const res = this.copyAsset(category || 'cosmetics', ref, '', { structured: true, entityId });
      if (!res || !res.publicUrl) return null;
      return {
        url: res.publicUrl,
        thumbUrl: res.thumb || res.publicUrl,
        strategy: res.matchStrategy || 'exact_field',
        assetRef: res.sourceAssetRef || ref,
        format: 'webp',
        matchStrategy: res.matchStrategy || 'exact_field'
      };
    };
  }

  const imageManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    images: {}
  };

  function resolveMedia(rawPath, category, entityId, exactOnly = false) {
    if (!rawPath || rawPath === 'None' || rawPath === '') {
      unresolvedCount++;
      return null;
    }
    const cleanRaw = String(rawPath).split('.')[0].trim();
    const leaf = path.basename(cleanRaw);

    const match = imageCopier.copyImage(rawPath, category, entityId, exactOnly) || imageCopier.copyImage(cleanRaw, category, entityId, exactOnly);
    if (match && match.url) {
      exactFieldMatches++;
      imageManifest.images[entityId] = {
        assetRef: match.assetRef || cleanRaw,
        url: match.url,
        thumbUrl: match.thumbUrl,
        strategy: match.strategy || 'exact_field',
        diagnosticStatus: 'resolved'
      };
      return {
        assetRef: match.assetRef || cleanRaw,
        url: match.url,
        thumbUrl: match.thumbUrl,
        format: 'webp',
        matchStrategy: match.matchStrategy || match.strategy || 'exact_field'
      };
    }

    // Try name-based discovery in UI/Item
    const nameMatch = !exactOnly && imageCopier.copyImage(`Hotta/Content/Resources/Icon/item/${leaf}`, category, entityId);
    if (nameMatch && nameMatch.url) {
      namingMatches++;
      imageManifest.images[entityId] = {
        assetRef: cleanRaw,
        url: nameMatch.url,
        thumbUrl: nameMatch.thumbUrl,
        strategy: 'naming_pattern',
        diagnosticStatus: 'resolved'
      };
      return {
        assetRef: cleanRaw,
        url: nameMatch.url,
        thumbUrl: nameMatch.thumbUrl,
        format: 'webp',
        matchStrategy: nameMatch.matchStrategy || nameMatch.strategy || 'naming_pattern'
      };
    }

    unresolvedCount++;
    imageManifest.images[entityId] = {
      assetRef: cleanRaw,
      url: null,
      thumbUrl: null,
      strategy: 'none',
      diagnosticStatus: 'unresolved'
    };
    return null;
  }

  const qualityRank = { SSR: 1, SR: 2, R: 3, N: 4 };

  // Raw input may change while the work tree is reused. Never retain an older avatar/effect projection.
  const shouldProcessAll = !process.argv.includes('--mounts-only') || !fs.existsSync(path.join(outDir, 'avatars.json'));
  let avatarsList = [];
  let avatarFramesList = [];
  let titlesList = [];
  let chatBackgroundsList = [];

  if (shouldProcessAll) {
    // -------------------------------------------------------------
    // 1. AVATARS
    // -------------------------------------------------------------
    console.log('[build-cosmetics] Processing Avatars...');
    const processedAvatarIds = new Set<any>();

  for (const [id, row] of Object.entries(avatarConfigRows)) {
    if (id.startsWith('Default_') || id.includes('Placeholder')) continue;
    totalEntities++;
    processedAvatarIds.add(id);

    // Config rows carry no quality and keep the text in Description; the item with the
    // same id (ItemConfigs) holds the published quality, item icon and description.
    const item = itemRows[id] || null;
    const b = resolveEntityBilingual(locResolver, row.Name, id);
    const name_en = cleanName(b.name_en);
    const name_ru = cleanName(b.name_ru || b.name_en);
    const descField = item?.Description || row.Desc || row.Description;
    const desc_en = cleanHtmlTags(locResolver.resolve(descField, { locale: 'en' }).text || '');
    const desc_ru = cleanHtmlTags(locResolver.resolve(descField, { locale: 'ru', fallbackLocale: 'en' }).text || desc_en);

    const rawIcon = item?.ItemIcon?.AssetPathName || row.Icon?.AssetPathName || (typeof row.Icon === 'string' ? row.Icon : '');
    const media = resolveMedia(rawIcon, 'avatars', id);
    const photoRef = assetReference(row.BigImage);
    const photo = photoRef ? resolveMedia(photoRef, 'avatars', `${id}_full`, true) : null;
    // No item row and no quality in the config (auto-unlock, boss and test entries): the game
    // gives no value, so the row carries none; the site applies its presentation default.
    const quality = item?.ItemQuality || row.Quality || undefined;
    const rarity = quality ? mapQuality(quality) : undefined;

    avatarsList.push({
      id,
      name_en: name_en || id,
      name_ru: name_ru || name_en || id,
      rarity,
      quality,
      description_en: desc_en || undefined,
      description_ru: desc_ru || undefined,
      source_en: cleanHtmlTags(locResolver.resolve(row.GainWay, { locale: 'en' }).text || '') || undefined,
      source_ru: cleanHtmlTags(locResolver.resolve(row.GainWay, { locale: 'ru', fallbackLocale: 'en' }).text || '') || undefined,
      icon: media?.url || undefined,
      icon_thumb: media?.thumbUrl || undefined,
      photo: photo?.url || undefined,
      animation: avatarAnimationSource(row),
      media: media || undefined
    });
  }

  // Scan ItemConfigs for additional avatars (Item_Avatar_*, etc.)
  for (const [id, row] of Object.entries(itemRows)) {
    const briefKey = row.ItemBrief?.Key || '';
    const briefSrc = row.ItemBrief?.SourceString || '';
    const isAvatar = (id.startsWith('Avatar_') || id.startsWith('Item_Avatar_') || briefKey === 'brief_Head' || briefSrc === '头像')
      && !processedAvatarIds.has(id);

    if (!isAvatar) continue;
    totalEntities++;
    processedAvatarIds.add(id);

    const b = resolveEntityBilingual(locResolver, row.ItemName, id);
    const name_en = cleanName(b.name_en);
    const name_ru = cleanName(b.name_ru || b.name_en);
    const desc_en = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'en' }).text || '');
    const desc_ru = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'ru', fallbackLocale: 'en' }).text || desc_en);

    const icon = row.ItemIcon?.AssetPathName || '';
    const media = resolveMedia(icon, 'avatars', id);
    const rarity = mapQuality(row.ItemQuality);

    avatarsList.push({
      id,
      name_en: name_en || id,
      name_ru: name_ru || name_en || id,
      rarity,
      quality: row.ItemQuality || 'ITEM_QUALITY_POOR',
      description_en: desc_en || undefined,
      description_ru: desc_ru || undefined,
      icon: media?.url || undefined,
      icon_thumb: media?.thumbUrl || undefined,
      media: media || undefined
    });
  }

  avatarsList.sort((a, b) => {
    const qA = qualityRank[a.rarity] || 99;
    const qB = qualityRank[b.rarity] || 99;
    if (qA !== qB) return qA - qB;
    return a.name_en.localeCompare(b.name_en);
  });

  // -------------------------------------------------------------
  // 2. AVATAR FRAMES
  // -------------------------------------------------------------
  console.log('[build-cosmetics] Processing Avatar Frames...');
  avatarFramesList = [];
  const processedFrameIds = new Set<any>();

  for (const [id, row] of Object.entries(avatarFrameConfigRows)) {
    if (id.startsWith('Default_')) continue;
    totalEntities++;
    processedFrameIds.add(id);

    // Config rows carry no quality and keep the text in Description; the item with the
    // same id (ItemConfigs) holds the published quality, item icon and description.
    const item = itemRows[id] || null;
    const b = resolveEntityBilingual(locResolver, row.Name, id);
    const name_en = cleanName(b.name_en);
    const name_ru = cleanName(b.name_ru || b.name_en);
    const descField = item?.Description || row.Desc || row.Description;
    const desc_en = cleanHtmlTags(locResolver.resolve(descField, { locale: 'en' }).text || '');
    const desc_ru = cleanHtmlTags(locResolver.resolve(descField, { locale: 'ru', fallbackLocale: 'en' }).text || desc_en);

    const rawIcon = item?.ItemIcon?.AssetPathName || row.Icon?.AssetPathName || (typeof row.Icon === 'string' ? row.Icon : '');
    const media = resolveMedia(rawIcon, 'avatar_frames', id);
    // No item row and no quality in the config (auto-unlock, boss and test entries): the game
    // gives no value, so the row carries none; the site applies its presentation default.
    const quality = item?.ItemQuality || row.Quality || undefined;
    const rarity = quality ? mapQuality(quality) : undefined;

    avatarFramesList.push({
      id,
      name_en: name_en || id,
      name_ru: name_ru || name_en || id,
      rarity,
      quality,
      description_en: desc_en || undefined,
      description_ru: desc_ru || undefined,
      source_en: cleanHtmlTags(locResolver.resolve(row.GainWay, { locale: 'en' }).text || '') || undefined,
      source_ru: cleanHtmlTags(locResolver.resolve(row.GainWay, { locale: 'ru', fallbackLocale: 'en' }).text || '') || undefined,
      icon: media?.url || undefined,
      icon_thumb: media?.thumbUrl || undefined,
      media: media || undefined
    });
  }

  for (const [id, row] of Object.entries(itemRows)) {
    const briefKey = row.ItemBrief?.Key || '';
    const briefSrc = row.ItemBrief?.SourceString || '';
    const isFrame = (id.startsWith('AvatarFrame') || id.startsWith('Item_AvatarFrame') || briefKey === 'brief_HeadFrame' || briefSrc === '头像框')
      && !processedFrameIds.has(id);

    if (!isFrame) continue;
    totalEntities++;
    processedFrameIds.add(id);

    const b = resolveEntityBilingual(locResolver, row.ItemName, id);
    const name_en = cleanName(b.name_en);
    const name_ru = cleanName(b.name_ru || b.name_en);
    const desc_en = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'en' }).text || '');
    const desc_ru = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'ru', fallbackLocale: 'en' }).text || desc_en);

    const icon = row.ItemIcon?.AssetPathName || '';
    const media = resolveMedia(icon, 'avatar_frames', id);
    const rarity = mapQuality(row.ItemQuality);

    avatarFramesList.push({
      id,
      name_en: name_en || id,
      name_ru: name_ru || name_en || id,
      rarity,
      quality: row.ItemQuality || 'ITEM_QUALITY_POOR',
      description_en: desc_en || undefined,
      description_ru: desc_ru || undefined,
      icon: media?.url || undefined,
      icon_thumb: media?.thumbUrl || undefined,
      media: media || undefined
    });
  }

  avatarFramesList.sort((a, b) => {
    const qA = qualityRank[a.rarity] || 99;
    const qB = qualityRank[b.rarity] || 99;
    if (qA !== qB) return qA - qB;
    return a.name_en.localeCompare(b.name_en);
  });

  // -------------------------------------------------------------
  // 3. TITLES
  // -------------------------------------------------------------
  console.log('[build-cosmetics] Processing Titles...');
  titlesList = [];

  for (const [id, row] of Object.entries(itemRows)) {
    const briefKey = row.ItemBrief?.Key || '';
    const briefSrc = row.ItemBrief?.SourceString || '';
    const icon = row.ItemIcon?.AssetPathName || '';
    const isTitle = (briefKey === 'brief_Title' || briefSrc === '称号' || id.startsWith('Title_') || id.startsWith('Titlestick_') || /chenghao/i.test(icon) || /Titlestick/i.test(icon))
      && briefKey !== 'brief_Mount' && briefKey !== 'brief_frag' && row.ItemType !== 'ITEM_TYPE_MOUNT' && row.ItemType !== 'ITEM_TYPE_FRAGMENT';

    if (!isTitle) continue;
    totalEntities++;

    const b = resolveEntityBilingual(locResolver, row.ItemName, id);
    const name_en = cleanName(b.name_en);
    const name_ru = cleanName(b.name_ru || b.name_en);
    const desc_en = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'en' }).text || '');
    const desc_ru = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'ru', fallbackLocale: 'en' }).text || desc_en);

    const media = resolveMedia(icon, 'titles', id);
    const rarity = mapQuality(row.ItemQuality);

    titlesList.push({
      id,
      name_en: name_en || id,
      name_ru: name_ru || name_en || id,
      rarity,
      quality: row.ItemQuality || 'ITEM_QUALITY_EPIC',
      description_en: desc_en || undefined,
      description_ru: desc_ru || undefined,
      icon: media?.url || undefined,
      icon_thumb: media?.thumbUrl || undefined,
      media: media || undefined
    });
  }

  titlesList.sort((a, b) => {
    const qA = qualityRank[a.rarity] || 99;
    const qB = qualityRank[b.rarity] || 99;
    if (qA !== qB) return qA - qB;
    return a.name_en.localeCompare(b.name_en);
  });

  // -------------------------------------------------------------
  // 4. CHAT BACKGROUNDS (chat_qipao)
  // -------------------------------------------------------------
  console.log('[build-cosmetics] Processing Chat Backgrounds...');
  chatBackgroundsList = [];

  for (const [id, row] of Object.entries(itemRows)) {
    const icon = row.ItemIcon?.AssetPathName || '';
    const isChat = (id.startsWith('chat_qipao') || id.startsWith('bag_chat_qipao') || /qipao/i.test(icon) || /chat_qipao/i.test(icon))
      && row.ItemType !== 'ITEM_TYPE_FRAGMENT';

    if (!isChat) continue;
    totalEntities++;

    const b = resolveEntityBilingual(locResolver, row.ItemName, id);
    const name_en = cleanName(b.name_en);
    const name_ru = cleanName(b.name_ru || b.name_en);
    const desc_en = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'en' }).text || '');
    const desc_ru = cleanHtmlTags(locResolver.resolve(row.Description, { locale: 'ru', fallbackLocale: 'en' }).text || desc_en);

    const media = resolveMedia(icon, 'chat', id);
    const rarity = mapQuality(row.ItemQuality);

    chatBackgroundsList.push({
      id,
      name_en: name_en || id,
      name_ru: name_ru || name_en || id,
      rarity,
      quality: row.ItemQuality || 'ITEM_QUALITY_LEGENDRY',
      description_en: desc_en || undefined,
      description_ru: desc_ru || undefined,
      icon: media?.url || undefined,
      icon_thumb: media?.thumbUrl || undefined,
      media: media || undefined
    });
  }

    chatBackgroundsList.sort((a, b) => {
      const qA = qualityRank[a.rarity] || 99;
      const qB = qualityRank[b.rarity] || 99;
      if (qA !== qB) return qA - qB;
      return a.name_en.localeCompare(b.name_en);
    });
  } else {
    avatarsList = readJsonFile(path.join(outDir, 'avatars.json')) || [];
    avatarFramesList = readJsonFile(path.join(outDir, 'avatarFrames.json')) || [];
    titlesList = readJsonFile(path.join(outDir, 'titles.json')) || [];
    chatBackgroundsList = readJsonFile(path.join(outDir, 'chatBackgrounds.json')) || [];
  }

  const emojiPaths = {
    emoji: findFile(rawDir, [COSMETIC_TABLES.emoji]),
    bigEmoji: findFile(rawDir, [COSMETIC_TABLES.bigEmoji]),
    hugeEmoji: findFile(rawDir, [COSMETIC_TABLES.hugeEmoji]),
  };
  const emojiTagsPath = findFile(rawDir, [COSMETIC_TABLES.emojiTags]);
  const emojiTagRows = emojiTagsPath ? readRows(emojiTagsPath) : {};
  const stickerCatalog = chatStickerCatalog({
    emoji: emojiPaths.emoji ? readRows(emojiPaths.emoji) : undefined,
    bigEmoji: emojiPaths.bigEmoji ? readRows(emojiPaths.bigEmoji) : undefined,
    hugeEmoji: emojiPaths.hugeEmoji ? readRows(emojiPaths.hugeEmoji) : undefined,
  }, itemRows, toolRows);
  const emojiTableFields = {emoji: 'EmojiTexture', bigEmoji: 'EmojiBrush', hugeEmoji: 'ImgBrush.ResourceObject'};
  const stickerMaterials = stickerCatalog.stickers.flatMap(sticker => sticker.animation ? [{
    id: sticker.id, material: sticker.animation.references[0].asset,
    ...resolveMaterialParameters(rawDir, sticker.animation.references[0].asset),
  }] : []);
  // Rendered by the exporter media pass (tools/patch-exporter/src/cosmetic-animation.ts) at these paths.
  const avatarMaterials = Object.entries(avatarConfigRows).flatMap(([id, row]: [string, any]) => {
    const material = assetReference(row.Material);
    return material ? [{id, material, ...resolveMaterialParameters(rawDir, material)}] : [];
  });
  const recipesFor = (materials: typeof stickerMaterials, resolve: typeof emojiFlipbookRecipe) => materials.map(material => ({material, ...resolve(material)}));
  const resolvedAnimations = [...recipesFor(stickerMaterials, emojiFlipbookRecipe), ...recipesFor(avatarMaterials, avatarFlipbookRecipe)];
  const animationRecipes = resolvedAnimations.flatMap(({material, recipe}) => recipe && /^[A-Za-z0-9_-]+$/.test(material.id)
    ? [{id: material.id, timing: 'inferred' as const, source: material.material, ...recipe}] : []);
  const animationRejections = resolvedAnimations.flatMap(({material, rejection}) =>
    rejection ? [{id: material.id, material: material.material, reason: rejection}] : []);
  const readyAnimations = new Map(animationRecipes.map(recipe => [recipe.id, {
    status: 'ready' as const, timing: recipe.timing, source: recipe.source,
    posterPng: `/game-assets/png/cosmetic-animations/${recipe.id}.png`,
    posterWebp: `/game-assets/webp/cosmetic-animations/${recipe.id}.webp`,
    gif: `/game-assets/animations/cosmetic/${recipe.id}.gif`,
    webp: `/game-assets/animations/cosmetic/${recipe.id}.webp`,
    frameCount: recipe.frames.length,
    durationMs: Math.round(recipe.frames.reduce((total, frame) => total + frame.delayMs, 0)),
  }]));
  // The game's own round item icon stays the card image; the details/viewer play the reconstruction.
  avatarsList = avatarsList.map(avatar => readyAnimations.has(avatar.id) ? {...avatar, animation: readyAnimations.get(avatar.id)} : avatar);
  const stickersList = stickerCatalog.stickers.map(sticker => {
    const {id, item} = sticker;
    const names = item ? resolveEntityBilingual(locResolver, item.ItemName, id) : {};
    const tag = sticker.tagId ? emojiTagRows[sticker.tagId] : undefined;
    const tagNames = tag ? locResolver.resolveBilingual(tag.TagName, {fallbackId: sticker.tagId}) : undefined;
    const ready = readyAnimations.get(id);
    // A rendered first frame is the sticker itself; a dynamic row's ItemIcon may be a shared static emoji.
    const media = ready ? undefined : resolveMedia(sticker.image, 'chatStickers', id, true);
    return {id, ...names, quality: item?.ItemQuality || undefined,
      description_en: item ? cleanHtmlTags(locResolver.resolve(item.Description, {locale: 'en'}).text || '') : undefined,
      description_ru: item ? cleanHtmlTags(locResolver.resolve(item.Description, {locale: 'ru', fallbackLocale: 'en'}).text || '') : undefined,
      sub_type_en: tagNames?.name_en || undefined, sub_type_ru: tagNames?.name_ru || undefined,
      icon: ready ? `/datamine/shared/media/cosmetic-animations/${id}.webp` : media?.url,
      emoji_id: sticker.row, animation: ready ?? sticker.animation,
      provenance: [
        {file: relativeSource(emojiPaths[sticker.table]), row: sticker.row,
          fields: [emojiTableFields[sticker.table], 'IsLock', ...(sticker.kind === 'huge' ? [] : ['TagId', 'ItemId'])]},
        ...(tag ? [{file: relativeSource(emojiTagsPath), row: sticker.tagId, fields: ['TagName']}] : []),
        ...(item ? [{file: itemSource(id), row: id, fields: ['ItemName', 'ItemIcon', 'StaticToolName']},
          {file: relativeSource(toolsPath), row: sticker.toolId, fields: ['StaticToolType', 'ToolValue']}] : []),
      ]};
  });
  const badgesList = Object.entries(emblemRows).map(([id, row]: [string, any]) => {
    const names = resolveEntityBilingual(locResolver, row.EmblemName, id);
    const icon = resolveMedia(assetReference(row.EmblemItemIcon), 'badges', id, true);
    const photo = resolveMedia(assetReference(row.EmblemIcon), 'badges', `${id}_full`, true);
    return {id, ...names, quality: itemRows[id]?.ItemQuality || undefined,
      description_en: cleanHtmlTags(locResolver.resolve(row.EmblemDescription, {locale: 'en'}).text || ''),
      description_ru: cleanHtmlTags(locResolver.resolve(row.EmblemDescription, {locale: 'ru', fallbackLocale: 'en'}).text || ''),
      icon: icon?.url || photo?.url, photo: photo?.url,
      provenance: [{file: relativeSource(emblemsPath), row: id,
        fields: ['EmblemName', 'EmblemDescription', 'EmblemItemIcon', 'EmblemIcon']}]};
  });

  // -------------------------------------------------------------
  // 5. MOUNTS (zuoqi)
  // -------------------------------------------------------------
  console.log('[build-cosmetics] Processing Mounts...');

  const mountBindings = [];
  const mountsList = [];
  const processedMountIds = new Set<any>();

  for (const [id, row] of Object.entries(mountConfigRows)) {
    if (!row || typeof row !== 'object') continue;
    totalEntities++;
    processedMountIds.add(id);

    const b = resolveEntityBilingual(locResolver, row.Name, id);
    const name_en = cleanName(b.name_en) || id;
    const name_ru = cleanName(b.name_ru || b.name_en) || name_en;

    const desc_en = cleanHtmlTags(locResolver.resolve(row.ShowDescription, { locale: 'en' }).text || '').trim();
    const desc_ru = cleanHtmlTags(locResolver.resolve(row.ShowDescription, { locale: 'ru', fallbackLocale: 'en' }).text || desc_en).trim();

    let unlock_en = cleanHtmlTags(locResolver.resolve(row.UnlockDescription, { locale: 'en' }).text || '').trim();
    let unlock_ru = cleanHtmlTags(locResolver.resolve(row.UnlockDescription, { locale: 'ru', fallbackLocale: 'en' }).text || unlock_en).trim();

    if (!unlock_en || hasCjk(unlock_en)) {
      if (Array.isArray(row.OverSeaUnlockDescription)) {
        for (const entry of row.OverSeaUnlockDescription) {
          const textDatas = entry?.Value?.TextDatas;
          if (Array.isArray(textDatas)) {
            for (const td of textDatas) {
              if (td?.Value) {
                const candEn = cleanHtmlTags(locResolver.resolve(td.Value, { locale: 'en' }).text || '').trim();
                if (candEn && !hasCjk(candEn)) {
                  unlock_en = candEn;
                  unlock_ru = cleanHtmlTags(locResolver.resolve(td.Value, { locale: 'ru', fallbackLocale: 'en' }).text || unlock_en).trim();
                  break;
                }
              }
            }
          }
          if (unlock_en && !hasCjk(unlock_en)) break;
        }
      }
    }

    const rarity = mapQuality(row.QualityType);

    // Movement type: ground vs underwater
    // MOUNT_USETYPE_UNDERWATER, MOUNT_USETYPE_WATER, MOUNT_USETYPE_ONWATER -> underwater; MOUNT_USETYPE_NORMAL -> ground
    const rawUseType = String(row.UseType || '').toUpperCase();
    let movement_type = 'ground';
    if (
      rawUseType === 'MOUNT_USETYPE_UNDERWATER' ||
      rawUseType === 'MOUNT_USETYPE_WATER' ||
      rawUseType === 'MOUNT_USETYPE_ONWATER' ||
      rawUseType.includes('WATER')
    ) {
      movement_type = 'underwater';
    } else if (rawUseType === 'MOUNT_USETYPE_NORMAL') {
      movement_type = 'ground';
    }

    const rawIcon = row.Icon?.AssetPathName || (typeof row.Icon === 'string' ? row.Icon : '');
    const rawShowImage = row.ShowImage?.AssetPathName || (typeof row.ShowImage === 'string' ? row.ShowImage : '');

    // Exact bindings in priority order, then preferring art whose own pixels are not cut off at an edge.
    const candidates = mountImageCandidates(id, row, skinRows, itemRows).map(candidate => {
      const packagePath = normalizeUnrealSoftReference(candidate.asset);
      const file = packagePath && path.join(rawDir, `${packagePath}.png`);
      const coverage = file && fs.existsSync(file) ? pngEdgeCoverage(file) : null;
      return {...candidate, size: coverage ? `${coverage.width}x${coverage.height}` : undefined,
        cropped: coverage ? Math.max(...Object.values(coverage.edges)) > 0.02 : undefined};
    });
    let effectiveMedia = null;
    let binding = null;
    for (const candidate of [...candidates.filter(entry => entry.cropped === false), ...candidates.filter(entry => entry.cropped !== false)]) {
      const media = resolveMedia(candidate.asset, 'mounts', id, true);
      if (media) {
        effectiveMedia = media;
        binding = {...candidate, file: candidate.table === 'ItemConfigs' ? itemSource(candidate.row)
          : candidate.table === 'MountConfigDataTable' ? relativeSource(mountConfigPath) : candidate.table};
        break;
      }
    }
    const effectivePhoto = effectiveMedia?.url;
    const effectivePhotoThumb = effectiveMedia?.thumbUrl;
    const effectiveIcon = effectiveMedia?.url;
    const effectiveIconThumb = effectiveMedia?.thumbUrl;
    mountBindings.push({id, candidates, selected: binding, resolved: Boolean(effectiveMedia)});

    mountsList.push({
      id,
      name_en,
      name_ru,
      desc_en: desc_en || undefined,
      desc_ru: desc_ru || undefined,
      description_en: desc_en || undefined,
      description_ru: desc_ru || undefined,
      unlock_en: unlock_en || undefined,
      unlock_ru: unlock_ru || undefined,
      active_source: unlock_en || undefined,
      source_en: unlock_en || undefined,
      source_ru: unlock_ru || undefined,
      rarity,
      quality: rarity,
      quality_type: row.QualityType || 'ITEM_QUALITY_LEGENDRY',
      fashion_type: 'Mount',
      movement_type,
      movement: movement_type,
      use_type: row.UseType || 'MOUNT_USETYPE_NORMAL',
      mount_type: row.MountType || 'MOUNT_TYPE_NORMAL',
      icon: effectiveIcon,
      icon_thumb: effectiveIconThumb,
      photo: effectivePhoto,
      photo_thumb: effectivePhotoThumb,
      media: effectiveMedia ? {
        assetRef: effectiveMedia.assetRef || rawIcon,
        url: effectiveMedia.url,
        thumbUrl: effectiveMedia.thumbUrl,
        format: 'webp',
        matchStrategy: effectiveMedia.matchStrategy || 'exact_game_path',
        icon: {
          assetRef: effectiveMedia.assetRef || rawIcon,
          fullUrl: effectiveMedia.url,
          thumbUrl: effectiveMedia.thumbUrl
        }
      } : undefined,
      assetRef: effectiveMedia?.assetRef || rawIcon,
      provenance: binding ? [binding] : [],
      default_skin_id: row.DefaultSkinId || undefined,
      max_level: row.MaxLevel ?? undefined,
      max_strengthen_level: row.MaxStrengthenLevel ?? undefined
    });
  }

  mountsList.sort((a, b) => {
    const qA = qualityRank[a.rarity] || 99;
    const qB = qualityRank[b.rarity] || 99;
    if (qA !== qB) return qA - qB;
    return a.name_en.localeCompare(b.name_en);
  });

  // -------------------------------------------------------------
  // EMIT DATASETS WITH DUAL-TREE + BUNDLE PARITY
  // -------------------------------------------------------------
  const cosmeticsJsonPath = path.join(outDir, 'cosmetics.json');

  const summaryManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    counts: {
      avatars: avatarsList.length,
      avatarFrames: avatarFramesList.length,
      titles: titlesList.length,
      chatBackgrounds: chatBackgroundsList.length,
      mounts: mountsList.length,
      chatStickers: stickersList.length,
      badges: badgesList.length
    },
    categories: [
      'avatars',
      'avatarFrames',
      'titles',
      'chatBackgrounds',
      'mounts',
      'chatStickers',
      'badges'
    ]
  };

  const mountOutDirs = [outDir];

  for (const dir of mountOutDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'chat-stickers.json'), JSON.stringify(stickersList, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'badges.json'), JSON.stringify(badgesList, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'cosmetic-animations.json'), JSON.stringify(animationRecipes, null, 2), 'utf8');
    const animatedAvatars = Object.entries(avatarConfigRows).flatMap(([id, row]) => {
      const animation = avatarAnimationSource(row);
      return animation ? [{id, ...animation}] : [];
    });
    fs.writeFileSync(path.join(dir, 'cosmetics-source-report.json'), JSON.stringify({
      schemaVersion: 2,
      stickerScope: emojiPaths.emoji && emojiPaths.bigEmoji ? 'chat-panel master tables (DT_Emoji, DT_BigEmoji, DT_ChatHugeEmoji)'
        : 'incomplete: chat emoji master tables missing',
      missingTables: [!toolsPath && COSMETIC_TABLES.tools, !emblemsPath && COSMETIC_TABLES.emblems,
        !skinsPath && COSMETIC_TABLES.mountSkins, !emojiPaths.emoji && COSMETIC_TABLES.emoji,
        !emojiPaths.bigEmoji && COSMETIC_TABLES.bigEmoji, !emojiPaths.hugeEmoji && COSMETIC_TABLES.hugeEmoji,
        !emojiTagsPath && COSMETIC_TABLES.emojiTags].filter(Boolean),
      counts: {chatStickers: stickersList.length, badges: badgesList.length},
      unresolvedAnimations: [...stickersList.filter(item => item.animation?.status === 'unresolved').map(item => ({id: item.id, ...item.animation})), ...animatedAvatars],
      animationDependencies: inspectCosmeticEffects(rawDir, animatedAvatars),
      stickerMaterials,
      stickerAnimations: {ready: animationRecipes.length, timing: 'inferred', rejected: animationRejections},
      avatarMaterials: avatarMaterials.map(({id, material, chain, scalars, textures}) => ({id, material, chain: chain.map(link => link.name), scalars, textures})),
      stickerJoinIssues: stickerCatalog.issues,
      unlockItemsWithoutEmojiRow: stickerCatalog.unlockItemsWithoutRow,
      missingStickerImages: stickersList.filter(item => !item.icon).map(item => item.id),
      missingBadgeImages: badgesList.filter(item => !item.icon).map(item => item.id),
      mountBindings,
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'mounts.json'), JSON.stringify(mountsList, null, 2), 'utf8');
  }

  // Update summary counts in cosmetics.json
  fs.writeFileSync(cosmeticsJsonPath, JSON.stringify(summaryManifest, null, 2), 'utf8');

  if (shouldProcessAll) {
    const outputFiles = [
      { name: 'avatars.json', data: avatarsList },
      { name: 'avatarFrames.json', data: avatarFramesList },
      { name: 'titles.json', data: titlesList },
      { name: 'chatBackgrounds.json', data: chatBackgroundsList }
    ];

    for (const targetDir of targetDirs) {
      fs.mkdirSync(targetDir, { recursive: true });
      for (const file of outputFiles) {
        const outPath = path.join(targetDir, file.name);
        fs.writeFileSync(outPath, JSON.stringify(file.data, null, 2), 'utf8');
      }
      fs.writeFileSync(path.join(targetDir, 'cosmetics-image-manifest.json'), JSON.stringify(imageManifest, null, 2), 'utf8');
    }

    imageCopier.saveSharedManifest();
    const statsCount = imageCopier.getStats()['cosmetics'] || 0;

    const imageReport = {
      totalEntities,
      exactFieldMatches,
      joinMatches,
      namingMatches,
      curatedMatches,
      unresolvedCount,
      copiedFullImages: statsCount,
      generatedThumbnails: statsCount,
      duplicateCollisions: 0,
      brokenUrls: 0
    };

    for (const targetDir of targetDirs) {
      fs.writeFileSync(path.join(targetDir, 'cosmetics-image-report.json'), JSON.stringify(imageReport, null, 2), 'utf8');
    }
  }

  console.log(`[build-cosmetics] Successfully generated cosmetics datasets to ${targetDirs.join(', ')}`);
  console.log('[build-cosmetics] Summary:', summaryManifest.counts);
  return summaryManifest;
}

if (require.main === module) {
  try {
    buildCosmeticsDatasets();
  } catch (err) {
    console.error('[build-cosmetics] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildCosmeticsDatasets,
  mapQuality,
};
