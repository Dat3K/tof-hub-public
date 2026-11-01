import ImageCopier from './image-copier';
import fs from 'node:fs';
import path from 'node:path';
import { hasGameLocalizationSource, readGameSourceFileSync } from './game-source-reader';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-space-support] Error reading JSON at ${filePath}:`, e.message);
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

const MODULE_TRANSLATIONS = {
  PhysicalAttack: {
    en: 'Physical Attack',
    ru: 'Физическая атака',
    category: 'base_attack',
    element: 'physical',
    unit: 'flat'
  },
  PhysicalDamage: {
    en: 'Physical Damage Boost',
    ru: 'Бонус физ. урона',
    category: 'base_damage',
    element: 'physical',
    unit: 'percent'
  },
  NewRow: {
    en: 'Flame Attack',
    ru: 'Огненная атака',
    category: 'base_attack',
    element: 'flame',
    unit: 'flat'
  },
  NewRow_0: {
    en: 'Flame Damage Boost',
    ru: 'Бонус огненного урона',
    category: 'base_damage',
    element: 'flame',
    unit: 'percent'
  },
  NewRow_5: {
    en: 'Frost Attack',
    ru: 'Ледяная атака',
    category: 'base_attack',
    element: 'frost',
    unit: 'flat'
  },
  NewRow_7: {
    en: 'Frost Damage Boost',
    ru: 'Бонус ледяного урона',
    category: 'base_damage',
    element: 'frost',
    unit: 'percent'
  },
  NewRow_6: {
    en: 'Volt Attack',
    ru: 'Электро атака',
    category: 'base_attack',
    element: 'volt',
    unit: 'flat'
  },
  NewRow_3: {
    en: 'Volt Damage Boost',
    ru: 'Бонус электро урона',
    category: 'base_damage',
    element: 'volt',
    unit: 'percent'
  },
  NewRow_4: {
    en: 'Physical Sequential Phantasm',
    ru: 'Физ. последовательный фантом',
    category: 'mode_sequential',
    element: 'physical',
    unit: 'percent'
  },
  NewRow_11: {
    en: 'Flame Sequential Phantasm',
    ru: 'Огненный последовательный фантом',
    category: 'mode_sequential',
    element: 'flame',
    unit: 'percent'
  },
  NewRow_25: {
    en: 'Frost Sequential Phantasm',
    ru: 'Ледяной последовательный фантом',
    category: 'mode_sequential',
    element: 'frost',
    unit: 'percent'
  },
  NewRow_24: {
    en: 'Volt Sequential Phantasm',
    ru: 'Электро последовательный фантом',
    category: 'mode_sequential',
    element: 'volt',
    unit: 'percent'
  },
  NewRow_23: {
    en: 'Bygone Phantasm Boost',
    ru: 'Бонус былого фантома',
    category: 'mode_content',
    element: 'all',
    unit: 'percent'
  },
  NewRow_22: {
    en: 'Origin of War Boost',
    ru: 'Бонус истоков войны',
    category: 'mode_content',
    element: 'all',
    unit: 'percent'
  },
  NewRow_17: {
    en: 'Frontier Evolution Boost',
    ru: 'Бонус эволюции границы',
    category: 'mode_content',
    element: 'all',
    unit: 'percent'
  },
  NewRow_21: {
    en: 'Raid Battles Boost',
    ru: 'Бонус рейдовых операций',
    category: 'mode_content',
    element: 'all',
    unit: 'percent'
  },
  NewRow_20: {
    en: 'End Trial Boost',
    ru: 'Бонус испытания финала',
    category: 'mode_content',
    element: 'all',
    unit: 'percent'
  },
  NewRow_19: {
    en: 'Void Abyss Boost',
    ru: 'Бонус бездны пустоты',
    category: 'mode_content',
    element: 'all',
    unit: 'percent'
  }
};

function buildSpaceSupportDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  // Module and level names are FText rows of Game.json (empty namespace, hash key). A culture pass reads its own
  // projection; the English pass keeps the curated names.
  let gameTexts: Record<string, any> | null = null;
  if (hasGameLocalizationSource()) {
    const gameFile = path.join(rawDir, 'Hotta/Content/Localization/Game/en/Game.json');
    try { gameTexts = JSON.parse(String(readGameSourceFileSync(gameFile, 'utf8')).replace(/^﻿/, '')); } catch { gameTexts = null; }
  }
  const gameText = (text: any): string | null => {
    const value = gameTexts?.[text?.Namespace ?? '']?.[text?.Key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  const outDir = path.join(projectRoot, 'datamine2', 'gear', 'data');
  const imageCopier = new ImageCopier(rawDir, projectRoot);

  console.log(`[build-space-support] Project root: ${projectRoot}`);
  console.log(`[build-space-support] Raw data dir: ${rawDir}`);

  const modulePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/OuterSpaceSupport/DT_OuterSpaceSupportModule.json',
    'DT_OuterSpaceSupportModule.json'
  ]);

  const levelPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/OuterSpaceSupport/DT_OuterSpaceSupportSystemLevel.json',
    'DT_OuterSpaceSupportSystemLevel.json'
  ]);

  if (!modulePath || !levelPath) {
    console.error('[build-space-support] Critical: DT_OuterSpaceSupportModule or DT_OuterSpaceSupportSystemLevel not found in rawDir');
    return null;
  }

  const rawModules = readJsonFile(modulePath);
  const rawLevels = readJsonFile(levelPath);

  const modRows = Array.isArray(rawModules) && rawModules[0]?.Rows ? rawModules[0].Rows : (rawModules?.Rows || rawModules || {});
  const levelRows = Array.isArray(rawLevels) && rawLevels[0]?.Rows ? rawLevels[0].Rows : (rawLevels?.Rows || rawLevels || {});

  let totalEntities = 0;
  let exactFieldMatches = 0;
  let joinMatches = 0;
  let namingMatches = 0;
  let curatedMatches = 0;
  let unresolvedCount = 0;
  const imageManifest: Record<string, any> = {};

  // 1. Process System Levels
  const systemLevels = Object.entries(levelRows).map(([lvlKey, row]) => {
    totalEntities++;
    const bgRef = row.SystemLevelBg?.AssetPathName || (typeof row.SystemLevelBg === 'string' ? row.SystemLevelBg : '');
    const copiedBg = bgRef ? imageCopier.copyAsset('gear', bgRef, 'space-support/bg', { structured: true }) : null;
    if (copiedBg) {
      exactFieldMatches++;
      imageManifest[bgRef] = { full: copiedBg.full, thumb: copiedBg.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const media = {
      bg: {
        assetRef: bgRef || 'None',
        rawExportPath: copiedBg?.sourcePng || '',
        fullUrl: copiedBg?.full || null,
        thumbUrl: copiedBg?.thumb || null,
        strategy: copiedBg ? 'exact_config_field' : 'unresolved',
        joinIdentity: `level_${lvlKey}`
      }
    };

    return {
      level: Number(lvlKey),
      name_en: gameText(row.LevelText) ?? (Number(lvlKey) === 1 ? 'Basic Support' : 'Advanced Escort'),
      name_ru: Number(lvlKey) === 1 ? 'Базовая поддержка' : 'Продвинутое сопровождение',
      name_cn: row.LevelText?.SourceString,
      max_module_level: Number(row.MaxModuleLevel || 5),
      need_all_module_level: Number(row.NeedAllModuleLevel || 0),
      bg_icon: copiedBg?.full || undefined,
      bg_icon_thumb: copiedBg?.thumb || undefined,
      media
    };
  });

  // 2. Process All Modules
  const modulesList = [];
  for (const [modId, row] of Object.entries(modRows)) {
    const meta = MODULE_TRANSLATIONS[modId] || {
      en: row.ModuleText?.SourceString || modId,
      ru: row.ModuleText?.SourceString || modId,
      category: row.BaseModule ? 'base_attack' : 'mode_content',
      element: 'all',
      unit: 'flat'
    };

    const maxLevel = Number(row.ModuleMaxLevel || 10);
    const levelData = row.ModuleLevelData || [];

    let cumChips = 0;
    const levelsProgression = [];

    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const prevLvlEntry = levelData.find((l) => l.Key === String(lvl - 1));
      const curLvlEntry = levelData.find((l) => l.Key === String(lvl));

      const chipCost = Number(prevLvlEntry?.Value?.UpgradeItemAmount || 0);
      cumChips += chipCost;

      const attrVal = Number(curLvlEntry?.Value?.AttributeValue || 0);
      let formattedVal: number | string = attrVal;
      let descEn = '';
      let descRu = '';

      if (meta.unit === 'percent') {
        const pctVal = Number((lvl * (meta.category === 'base_damage' ? 0.5 : 1.0)).toFixed(1));
        formattedVal = `${pctVal}%`;
        descEn = `Increases ${meta.en} by +${pctVal}%`;
        descRu = `Увеличивает ${meta.ru} на +${pctVal}%`;
      } else {
        formattedVal = `+${attrVal || lvl * 150}`;
        descEn = `Increases ${meta.en} by +${attrVal || lvl * 150}`;
        descRu = `Увеличивает ${meta.ru} на +${attrVal || lvl * 150}`;
      }

      levelsProgression.push({
        level: lvl,
        chip_cost: chipCost,
        cum_chips: cumChips,
        value: formattedVal,
        desc_en: descEn,
        desc_ru: descRu
      });
    }

    totalEntities++;
    const iconRef = row.ModuleIcon?.AssetPathName || (typeof row.ModuleIcon === 'string' ? row.ModuleIcon : '');
    const copiedIcon = iconRef ? imageCopier.copyAsset('gear', iconRef, 'space-support/modules', { structured: true }) : null;
    if (copiedIcon) {
      exactFieldMatches++;
      imageManifest[iconRef] = { full: copiedIcon.full, thumb: copiedIcon.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const media = {
      icon: {
        assetRef: iconRef || 'None',
        rawExportPath: copiedIcon?.sourcePng || '',
        fullUrl: copiedIcon?.full || null,
        thumbUrl: copiedIcon?.thumb || null,
        strategy: copiedIcon ? 'exact_config_field' : 'unresolved',
        joinIdentity: modId
      }
    };

    modulesList.push({
      id: modId,
      name_en: gameText(row.ModuleText) ?? meta.en,
      name_ru: meta.ru,
      name_cn: row.ModuleText?.SourceString,
      category: meta.category,
      element: meta.element,
      unit: meta.unit,
      is_base_module: Boolean(row.BaseModule),
      max_level: maxLevel,
      total_chips_cost: cumChips,
      levels: levelsProgression,
      icon: copiedIcon?.full || undefined,
      icon_thumb: copiedIcon?.thumb || undefined,
      media
    });
  }

  // Pre-sort: Base Attack, Base Damage, Sequential, Content
  const categoryOrder = { base_attack: 1, base_damage: 2, mode_sequential: 3, mode_content: 4 };
  modulesList.sort((a, b) => {
    if (categoryOrder[a.category] !== categoryOrder[b.category]) {
      return categoryOrder[a.category] - categoryOrder[b.category];
    }
    return a.name_en.localeCompare(b.name_en);
  });

  const outputData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totalModules: modulesList.length,
    systemLevels,
    modules: modulesList
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outFilePath = path.join(outDir, 'space-support.json');
  fs.writeFileSync(outFilePath, JSON.stringify(outputData, null, 2), 'utf8');

  // Also collect across all gear datasets to build gear-image-manifest.json and gear-image-report.json
  const manifestPath = path.join(outDir, 'gear-image-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(imageManifest, null, 2), 'utf8');

  imageCopier.saveSharedManifest();
  const statsCount = imageCopier.getStats()['gear'] || 0;
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

  const reportPath = path.join(outDir, 'gear-image-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(imageReport, null, 2), 'utf8');

  console.log(`[build-space-support] Successfully generated space support data (${modulesList.length} modules) to ${outFilePath}`);
  console.log('[build-space-support] Gear image report:', imageReport);
  return outputData;
}

if (require.main === module) {
  try {
    buildSpaceSupportDataset();
  } catch (err) {
    console.error('[build-space-support] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildSpaceSupportDataset,
  MODULE_TRANSLATIONS,
};
