import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';
import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-outfits] Error reading JSON at ${filePath}:`, e.message);
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
  for (const rel of relCandidates) {
    const full = path.join(rawDir, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function mapQuality(rawQuality) {
  if (!rawQuality) return 'SSR';
  const q = String(rawQuality).toUpperCase();
  if (q.includes('LEGENDRY') || q.includes('LEGENDARY') || q.includes('SSR') || q.includes('GOLD')) return 'SSR';
  if (q.includes('EPIC') || q.includes('SR') || q.includes('PURPLE')) return 'SR';
  if (q.includes('SENIOR') || q.includes('RARE') || q.includes('BLUE')) return 'R';
  if (q.includes('POOR') || q.includes('COMMON') || q.includes('WHITE') || q.includes('GREEN') || q === 'N') return 'N';
  return 'SSR';
}

function mapFashionType(rawType) {
  if (!rawType) return 'Dress';
  const t = String(rawType).replace(/^EFashionType::/i, '');
  if (/dress/i.test(t)) return 'Dress';
  if (/headwear/i.test(t)) return 'Headwear';
  if (/weapon/i.test(t)) return 'Weapon';
  if (/glider/i.test(t)) return 'Glider';
  if (/skateboard|suspensionskateboard/i.test(t)) return 'Vehicle';
  if (/guidenpc/i.test(t)) return 'GuideNPC';
  if (/seascooter/i.test(t)) return 'SeaScooter';
  if (/medal/i.test(t)) return 'Medal';
  if (/simulacrum/i.test(t)) return 'SimulacrumHauteCouture';
  return t || 'Dress';
}

function isPlaceholderFashion(id, cnName, originalName, nameEn) {
  if (cnName === '无装饰' || originalName === '无装饰') return true;
  if (nameEn === 'Undecorated') return true;
  if (/^fashion_(decoration|medal)_0$/.test(id)) return true;
  return false;
}

function mapServerMode(row) {
  if (row.bMMOFashion === true || row.ServerMode === 'EHottaServerMode::MMOServer') {
    return 'mmo';
  }
  if (Array.isArray(row.ServerModeNameMap) && row.ServerModeNameMap.some((m) => m.Key === 'EHottaServerMode::MMOServer')) {
    return 'mmo';
  }
  return 'global';
}

function buildOutfitsDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'info', 'cosmetics', 'data');
  const targetDirs = [outDir];
  const imageCopier = new ImageCopier(rawDir, projectRoot);

  console.log(`[build-outfits] Project root: ${projectRoot}`);
  console.log(`[build-outfits] Raw data dir: ${rawDir}`);

  // Locate source tables
  const fashionTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/FashionDataTable.json',
    'FashionDataTable.json'
  ]);

  const fashionOverseasTablePath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Fashion/FashionDataTable_Overseas.json',
    'FashionDataTable_Overseas.json'
  ]);

  const fashionMmoTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/Fashion/FashionDataTable_MMO.json',
    'FashionDataTable_MMO.json'
  ]);

  const imitationFashionTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/DT_ImitationFashion.json',
    'DT_ImitationFashion.json'
  ]);

  const imitationFashionOverseasTablePath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Fashion/DT_ImitationFashion_Overseas.json',
    'DT_ImitationFashion_Overseas.json'
  ]);

  const itemConfigsTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json',
    'ItemConfigs.json'
  ]);

  const itemConfigsOsTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs_OS.json',
    'ItemConfigs_OS.json'
  ]);

  const imitationBaseTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/DT_Imitation.json',
    'DT_Imitation.json'
  ]);

  const locEnRaw = findFile(rawDir, [
    'Hotta/Content/Localization/Game/en/Game.json',
    'Game/en/Game.json',
    'Localization/Game/en/Game.json'
  ]);

  const locRuRaw = findFile(rawDir, [
    'Hotta/Content/Localization/Game/ru/Game.json',
    'Game/ru/Game.json',
    'Localization/Game/ru/Game.json'
  ]);

  if (!fashionTablePath) {
    console.error('[build-outfits] Critical: FashionDataTable not found in rawDir');
    return null;
  }

  const rawFashion = readJsonFile(fashionTablePath);
  const rawFashionOverseas = fashionOverseasTablePath ? readJsonFile(fashionOverseasTablePath) : null;
  const rawFashionMmo = fashionMmoTablePath ? readJsonFile(fashionMmoTablePath) : null;
  const rawImitation = imitationFashionTablePath ? readJsonFile(imitationFashionTablePath) : null;
  const rawImitationOverseas = imitationFashionOverseasTablePath ? readJsonFile(imitationFashionOverseasTablePath) : null;
  const rawItemConfigs = itemConfigsTablePath ? readJsonFile(itemConfigsTablePath) : null;
  const rawItemConfigsOs = itemConfigsOsTablePath ? readJsonFile(itemConfigsOsTablePath) : null;
  const rawImitationBase = imitationBaseTablePath ? readJsonFile(imitationBaseTablePath) : null;

  const locResolver = createLocalizationResolver();
  if (locEnRaw) locResolver.loadLocale('en', readJsonFile(locEnRaw));
  if (locRuRaw) locResolver.loadLocale('ru', readJsonFile(locRuRaw));

  const fashionRows = Array.isArray(rawFashion) && rawFashion[0]?.Rows ? rawFashion[0].Rows : (rawFashion?.Rows || rawFashion || {});
  const fashionOverseasRows = Array.isArray(rawFashionOverseas) && rawFashionOverseas[0]?.Rows ? rawFashionOverseas[0].Rows : (rawFashionOverseas?.Rows || rawFashionOverseas || {});
  const fashionMmoRows = Array.isArray(rawFashionMmo) && rawFashionMmo[0]?.Rows ? rawFashionMmo[0].Rows : (rawFashionMmo?.Rows || rawFashionMmo || {});
  const imitationRows = Array.isArray(rawImitation) && rawImitation[0]?.Rows ? rawImitation[0].Rows : (rawImitation?.Rows || rawImitation || {});
  const imitationOverseasRows = Array.isArray(rawImitationOverseas) && rawImitationOverseas[0]?.Rows ? rawImitationOverseas[0].Rows : (rawImitationOverseas?.Rows || rawImitationOverseas || {});
  const itemConfigsRows = Array.isArray(rawItemConfigs) && rawItemConfigs[0]?.Rows ? rawItemConfigs[0].Rows : (rawItemConfigs?.Rows || rawItemConfigs || {});
  const itemConfigsOsRows = Array.isArray(rawItemConfigsOs) && rawItemConfigsOs[0]?.Rows ? rawItemConfigsOs[0].Rows : (rawItemConfigsOs?.Rows || rawItemConfigsOs || {});
  const imitationBaseRows = Array.isArray(rawImitationBase) && rawImitationBase[0]?.Rows ? rawImitationBase[0].Rows : (rawImitationBase?.Rows || rawImitationBase || {});

  const mergedItemConfigs: Record<string, any> = {};
  for (const [id, row] of Object.entries(itemConfigsRows)) {
    if (row && typeof row === 'object') mergedItemConfigs[id] = row;
  }
  for (const [id, row] of Object.entries(itemConfigsOsRows)) {
    if (row && typeof row === 'object') mergedItemConfigs[id] = row;
  }

  // Merge regular fashion rows without duplication
  const mergedFashion: Record<string, any> = {};
  for (const [id, row] of Object.entries(fashionRows)) {
    if (row && typeof row === 'object') mergedFashion[id] = { ...row, _edition: 'standard' };
  }
  for (const [id, row] of Object.entries(fashionOverseasRows)) {
    if (row && typeof row === 'object') mergedFashion[id] = { ...row, _edition: 'overseas' };
  }
  for (const [id, row] of Object.entries(fashionMmoRows)) {
    if (row && typeof row === 'object' && !mergedFashion[id]) {
      mergedFashion[id] = { ...row, _edition: 'mmo' };
    }
  }

  // Merge imitation fashion rows without duplication
  const mergedImitation: Record<string, any> = {};
  for (const [id, row] of Object.entries(imitationRows)) {
    if (row && typeof row === 'object') mergedImitation[id] = { ...row, _edition: 'standard' };
  }
  for (const [id, row] of Object.entries(imitationOverseasRows)) {
    if (row && typeof row === 'object') mergedImitation[id] = { ...row, _edition: 'overseas' };
  }

  let totalEntities = 0;
  let exactFieldMatches = 0;
  let joinMatches = 0;
  let namingMatches = 0;
  let curatedMatches = 0;
  let unresolvedCount = 0;
  const imageManifest: Record<string, any> = {};

  const items = [];

  // 1. Process regular Fashion
  for (const [id, row] of Object.entries(mergedFashion)) {
    if (!row || typeof row !== 'object') continue;

    // Resolve name: EN -> RU -> Chinese fallback -> ID
    const cnName = row.Name?.SourceString || row.Name?.LocalizedString || '';
    const nameResEn = locResolver.resolve(row.Name || `${id}_name`, { locale: 'en', defaultNamespace: 'Fashion', fallbackCodename: id, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(row.Name || `${id}_name`, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Fashion', fallbackCodename: id, fallbackSourceRow: row });
    const nameEn = nameResEn.text || cnName || id;
    const nameRu = nameResRu.text || nameEn;

    if (isPlaceholderFashion(id, cnName, nameResEn.originalGameName, nameEn)) {
      continue;
    }

    // Resolve description: EN -> RU -> Chinese fallback
    const cnDesc = row.Description?.SourceString || row.Description?.LocalizedString || '';
    const descFText = (row.Description && (row.Description.Key || row.Description.Namespace || row.Description.TableId)) ? row.Description : null;
    const descEn = locResolver.resolve(descFText || { TableId: 'Fashion', Key: `${id}_des` }, { locale: 'en', defaultNamespace: 'Fashion', fallbackSourceRow: row }).text || cnDesc || '';
    const descRu = locResolver.resolve(descFText || { TableId: 'Fashion', Key: `${id}_des` }, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Fashion', fallbackSourceRow: row }).text || descEn;

    const fashionType = mapFashionType(row.FashionType);
    const quality = mapQuality(row.Quality);
    const sortOrder = Number(row.SortOrder ?? row.SortWeight ?? 0);

    totalEntities += 3; // icon, painting, card_image
    const rawIconRef = row.Icon?.AssetPathName || '';
    const rawPaintingRef = row.Painting?.AssetPathName || '';
    const rawCardRef = row.CardImage?.AssetPathName || '';

    const copiedIcon = (rawIconRef && rawIconRef !== 'None') ? imageCopier.copyAsset('outfits', rawIconRef, 'icons', { structured: true }) : null;
    if (copiedIcon) {
      exactFieldMatches++;
      imageManifest[rawIconRef] = { full: copiedIcon.full, thumb: copiedIcon.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedPainting = (rawPaintingRef && rawPaintingRef !== 'None') ? imageCopier.copyAsset('outfits', rawPaintingRef, 'paintings', { structured: true }) : null;
    if (copiedPainting) {
      exactFieldMatches++;
      imageManifest[rawPaintingRef] = { full: copiedPainting.full, thumb: copiedPainting.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedCard = (rawCardRef && rawCardRef !== 'None') ? imageCopier.copyAsset('outfits', rawCardRef, 'cards', { structured: true }) : null;
    if (copiedCard) {
      exactFieldMatches++;
      imageManifest[rawCardRef] = { full: copiedCard.full, thumb: copiedCard.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const media = {
      icon: {
        assetRef: rawIconRef || 'None',
        rawExportPath: copiedIcon?.sourcePng || '',
        fullUrl: copiedIcon?.full || null,
        thumbUrl: copiedIcon?.thumb || null,
        strategy: copiedIcon ? 'exact_config_field' : (rawIconRef && rawIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedIcon ? 'resolved' : (rawIconRef && rawIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        joinIdentity: id
      },
      painting: {
        assetRef: rawPaintingRef || 'None',
        rawExportPath: copiedPainting?.sourcePng || '',
        fullUrl: copiedPainting?.full || null,
        thumbUrl: copiedPainting?.thumb || null,
        strategy: copiedPainting ? 'exact_config_field' : (rawPaintingRef && rawPaintingRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedPainting ? 'resolved' : (rawPaintingRef && rawPaintingRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        joinIdentity: id
      },
      card_image: {
        assetRef: rawCardRef || 'None',
        rawExportPath: copiedCard?.sourcePng || '',
        fullUrl: copiedCard?.full || null,
        thumbUrl: copiedCard?.thumb || null,
        strategy: copiedCard ? 'exact_config_field' : (rawCardRef && rawCardRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedCard ? 'resolved' : (rawCardRef && rawCardRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        joinIdentity: id
      },
      source_edition: row._edition || 'standard'
    };

    const primaryUrl = copiedIcon?.full || copiedPainting?.full || copiedCard?.full || undefined;
    const primaryThumb = copiedIcon?.thumb || copiedPainting?.thumb || copiedCard?.thumb || undefined;
    const activeSource = locResolver.resolve(row.ActiveSource || `${id}_source`, { locale: 'en', defaultNamespace: 'Fashion', fallbackSourceRow: row }).text || '';

    items.push({
      id,
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      name_cn: cnName || undefined,
      desc_en: descEn,
      desc_ru: descRu,
      fashion_type: fashionType,
      quality,
      sort_order: sortOrder,
      icon: primaryUrl,
      icon_thumb: primaryThumb,
      painting: copiedPainting?.full || undefined,
      painting_thumb: copiedPainting?.thumb || undefined,
      card_image: copiedCard?.full || undefined,
      card_image_thumb: copiedCard?.thumb || undefined,
      active_source: activeSource || undefined,
      is_simulacrum: false,
      media
    });
  }

  // 2. Process DT_ImitationFashion (Haute Couture)
  for (const [id, row] of Object.entries(mergedImitation)) {
    if (!row || typeof row !== 'object') continue;

    const cnName = row.Name?.SourceString || row.Name?.LocalizedString || '';
    const nameFText = (row.Name && (row.Name.Key || row.Name.Namespace || row.Name.TableId)) ? row.Name : null;
    const nameResEn = locResolver.resolve(nameFText || { TableId: 'ST_Item', Key: `${id}_name` }, { locale: 'en', defaultNamespace: 'ImitationFashion', fallbackCodename: id, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(nameFText || { TableId: 'ST_Item', Key: `${id}_name` }, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'ImitationFashion', fallbackCodename: id, fallbackSourceRow: row });
    const nameEn = nameResEn.text || cnName || id;
    const nameRu = nameResRu.text || nameEn;

    if (isPlaceholderFashion(id, cnName, nameResEn.originalGameName, nameEn)) {
      continue;
    }

    const cnDesc = row.Description?.SourceString || row.Description?.LocalizedString || '';
    const descFText = (row.Description && (row.Description.Key || row.Description.Namespace || row.Description.TableId)) ? row.Description : null;
    const descEn = locResolver.resolve(descFText || { TableId: 'ST_Item', Key: `${id}_des` }, { locale: 'en', defaultNamespace: 'ImitationFashion', fallbackSourceRow: row }).text || cnDesc || '';
    const descRu = locResolver.resolve(descFText || { TableId: 'ST_Item', Key: `${id}_des` }, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'ImitationFashion', fallbackSourceRow: row }).text || descEn;

    const quality = mapQuality(row.Quality);
    const sortOrder = Number(row.SortOrder ?? 0);
    const ownerId = row.OwnerImitationId ? String(row.OwnerImitationId) : undefined;

    totalEntities += 2; // painting, gray_painting
    const rawPaintingRef = row.Painting?.AssetPathName || '';
    const rawGrayRef = row.GrayPainting?.AssetPathName || '';

    const copiedPainting = (rawPaintingRef && rawPaintingRef !== 'None') ? imageCopier.copyAsset('outfits', rawPaintingRef, 'paintings', { structured: true }) : null;
    if (copiedPainting) {
      exactFieldMatches++;
      imageManifest[rawPaintingRef] = { full: copiedPainting.full, thumb: copiedPainting.thumb, strategy: 'exact_config_field' };
    }

    const copiedGray = (rawGrayRef && rawGrayRef !== 'None') ? imageCopier.copyAsset('outfits', rawGrayRef, 'gray', { structured: true }) : null;
    if (copiedGray) {
      exactFieldMatches++;
      imageManifest[rawGrayRef] = { full: copiedGray.full, thumb: copiedGray.thumb, strategy: 'exact_config_field' };
    }

    // Check weapon haute couture icon in ItemConfigs (e.g. for _w weapon skin variants)
    let copiedIcon = null;
    let rawIconRef = '';
    const icRow = mergedItemConfigs[id];
    if (icRow && icRow.ItemIcon?.AssetPathName && icRow.ItemIcon.AssetPathName !== 'None') {
      rawIconRef = icRow.ItemIcon.AssetPathName;
      copiedIcon = imageCopier.copyAsset('outfits', rawIconRef, 'icons', { structured: true });
      if (copiedIcon) {
        exactFieldMatches++;
        imageManifest[rawIconRef] = { full: copiedIcon.full, thumb: copiedIcon.thumb, strategy: 'exact_config_field' };
      }
    }

    // Fallback: where a couture has no own painting/icon, fall back to owner simulacrum splash
    let copiedOwnerSplash = null;
    let rawOwnerSplashRef = '';
    if (!copiedPainting && !copiedGray && !copiedIcon && ownerId) {
      const ownerRow = imitationBaseRows[ownerId];
      if (ownerRow) {
        rawOwnerSplashRef = ownerRow.Painting?.AssetPathName || ownerRow.CardImage?.AssetPathName || '';
        if (rawOwnerSplashRef && rawOwnerSplashRef !== 'None') {
          copiedOwnerSplash = imageCopier.copyAsset('outfits', rawOwnerSplashRef, 'paintings', { structured: true });
          if (copiedOwnerSplash) {
            joinMatches++;
            imageManifest[rawOwnerSplashRef] = { full: copiedOwnerSplash.full, thumb: copiedOwnerSplash.thumb, strategy: 'owner_imitation_splash_fallback' };
          }
        }
      }
    }

    if (!copiedPainting && !copiedIcon && !copiedOwnerSplash) {
      unresolvedCount++;
    }
    if (!copiedGray && !copiedIcon && !copiedOwnerSplash) {
      unresolvedCount++;
    }

    const resolvedPaintingUrl = copiedPainting?.full || copiedIcon?.full || copiedOwnerSplash?.full || undefined;
    const resolvedPaintingThumb = copiedPainting?.thumb || copiedIcon?.thumb || copiedOwnerSplash?.thumb || undefined;
    const primaryUrl = resolvedPaintingUrl || copiedGray?.full || undefined;
    const primaryThumb = resolvedPaintingThumb || copiedGray?.thumb || undefined;

    const media = {
      painting: {
        assetRef: rawPaintingRef || rawIconRef || rawOwnerSplashRef || 'None',
        rawExportPath: copiedPainting?.sourcePng || copiedIcon?.sourcePng || copiedOwnerSplash?.sourcePng || '',
        fullUrl: resolvedPaintingUrl || null,
        thumbUrl: resolvedPaintingThumb || null,
        strategy: copiedPainting ? 'exact_config_field' : (copiedIcon ? 'exact_config_field' : (copiedOwnerSplash ? 'owner_imitation_splash_fallback' : (rawPaintingRef && rawPaintingRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'))),
        diagnosticStatus: (copiedPainting || copiedIcon || copiedOwnerSplash) ? 'resolved' : (rawPaintingRef && rawPaintingRef !== 'None' ? 'missing_exported_png' : 'no_source_painting'),
        joinIdentity: id
      },
      gray_painting: {
        assetRef: rawGrayRef || 'None',
        rawExportPath: copiedGray?.sourcePng || '',
        fullUrl: copiedGray?.full || null,
        thumbUrl: copiedGray?.thumb || null,
        strategy: copiedGray ? 'exact_config_field' : (rawGrayRef && rawGrayRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedGray ? 'resolved' : (rawGrayRef && rawGrayRef !== 'None' ? 'missing_exported_png' : 'no_source_painting'),
        joinIdentity: id
      },
      source_edition: row._edition || 'standard'
    };

    const activeSource = locResolver.resolve(row.ActiveSource || `${id}_source`, { locale: 'en', defaultNamespace: 'ImitationFashion', fallbackSourceRow: row }).text || '';

    items.push({
      id,
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      name_cn: cnName || undefined,
      desc_en: descEn,
      desc_ru: descRu,
      fashion_type: 'SimulacrumHauteCouture',
      quality,
      sort_order: sortOrder,
      icon: primaryUrl,
      icon_thumb: primaryThumb,
      painting: resolvedPaintingUrl,
      painting_thumb: resolvedPaintingThumb,
      gray_painting: copiedGray?.full || undefined,
      gray_painting_thumb: copiedGray?.thumb || undefined,
      owner_simulacrum_id: ownerId,
      active_source: activeSource || undefined,
      is_simulacrum: true,
      media
    });
  }

  // Emitted default order: trailing integer of id DESCENDING (newest first), tie-broken by id string descending
  const idTail = (it) => {
    const m = String(it.id || '').match(/(\d+)(?!.*\d)/);
    return m ? parseInt(m[1], 10) : -1;
  };
  items.sort((a, b) => idTail(b) - idTail(a) || String(b.id).localeCompare(String(a.id)));

  // Calculate type counts
  const typeCounts: Record<string, any> = {};
  for (const item of items) {
    typeCounts[item.fashion_type] = (typeCounts[item.fashion_type] || 0) + 1;
  }

  const outputData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: items.length,
    counts: {
      total: items.length,
      dresses: typeCounts['Dress'] || 0,
      haute_couture: typeCounts['SimulacrumHauteCouture'] || 0,
      headwear: typeCounts['Headwear'] || 0,
      weapons: typeCounts['Weapon'] || 0,
      gliders: typeCounts['Glider'] || 0,
      vehicles: typeCounts['Vehicle'] || 0,
      servants: typeCounts['GuideNPC'] || 0,
      underwater: typeCounts['SeaScooter'] || 0,
      medals: typeCounts['Medal'] || 0
    },
    items,
    outfits: items
  };

  for (const dir of targetDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'outfits.json'), JSON.stringify(outputData, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'outfits-image-manifest.json'), JSON.stringify(imageManifest, null, 2), 'utf8');
  }

  imageCopier.saveSharedManifest();
  const statsCount = imageCopier.getStats()['outfits'] || 0;
  const copiedFull = statsCount;
  const generatedThumbs = statsCount;

  const imageReport = {
    totalEntities,
    exactFieldMatches,
    joinMatches,
    namingMatches,
    curatedMatches,
    unresolvedCount,
    copiedFullImages: copiedFull,
    generatedThumbnails: generatedThumbs,
    duplicateCollisions: 0,
    brokenUrls: 0
  };

  for (const dir of targetDirs) {
    fs.writeFileSync(path.join(dir, 'outfits-image-report.json'), JSON.stringify(imageReport, null, 2), 'utf8');
  }

  console.log(`[build-outfits] Successfully generated ${items.length} fashion outfits to ${path.join(outDir, 'outfits.json')}`);
  console.log('[build-outfits] Image resolution report:', imageReport);
  return outputData;
}

if (require.main === module) {
  try {
    buildOutfitsDataset();
  } catch (err) {
    console.error('[build-outfits] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildOutfitsDataset,
  cleanHtmlTags,
  mapQuality,
  mapFashionType,
  mapServerMode,
};
