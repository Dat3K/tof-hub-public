import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-gear-enhance] Error reading JSON at ${filePath}:`, e.message);
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

const FAMILY_DEFINITIONS = {
  Equip_strengthen_cost: {
    id: 'Equip_strengthen_cost',
    name_en: 'Standard Gear (8 Slots)',
    name_ru: 'Стандартное снаряжение (8 слотов)',
    category: 'standard',
    slots_count: 8,
    slots: ['helmet', 'cloth', 'belt', 'armband', 'glove', 'pants', 'shawl', 'shoes'],
    default_icon: 'StrengthenStone_01'
  },
  Visor_strengthen_cost: {
    id: 'Visor_strengthen_cost',
    name_en: 'Eyepiece (Visor)',
    name_ru: 'Окуляр',
    category: 'special',
    slots_count: 1,
    slots: ['visor1', 'visor'],
    default_icon: 'StrengthenStone_03'
  },
  Reactor_strengthen_cost: {
    id: 'Reactor_strengthen_cost',
    name_en: 'Microreactor',
    name_ru: 'Микрореактор',
    category: 'special',
    slots_count: 1,
    slots: ['reactor1', 'reactor'],
    default_icon: 'StrengthenStone_03'
  },
  Core_strengthen_cost: {
    id: 'Core_strengthen_cost',
    name_en: 'Combat Engine (Core)',
    name_ru: 'Боевой двигатель',
    category: 'special',
    slots_count: 1,
    slots: ['core1', 'core'],
    default_icon: 'StrengthenStone_03'
  },
  Exoskeleton_strengthen_cost: {
    id: 'Exoskeleton_strengthen_cost',
    name_en: 'Exoskeleton',
    name_ru: 'Экзоскелет',
    category: 'special',
    slots_count: 1,
    slots: ['exoskeleton1', 'exoskeleton'],
    default_icon: 'StrengthenStone_03'
  }
};

const SLOT_DEFINITIONS = [
  { id: 'helmet', name_en: 'Helmet', name_ru: 'Шлем', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['HP', 'Resistance'] },
  { id: 'cloth', name_en: 'Armor', name_ru: 'Броня', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['HP', 'Resistance'] },
  { id: 'belt', name_en: 'Belt', name_ru: 'Пояс', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['HP', 'Resistance'] },
  { id: 'armband', name_en: 'Bracers', name_ru: 'Наручи', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['ATK', 'HP'] },
  { id: 'glove', name_en: 'Gloves', name_ru: 'Перчатки', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['ATK', 'Crit'] },
  { id: 'pants', name_en: 'Leggings', name_ru: 'Поножи', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['HP', 'Resistance'] },
  { id: 'shawl', name_en: 'Spaulders', name_ru: 'Наплечники', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['HP', 'Resistance'] },
  { id: 'shoes', name_en: 'Boots', name_ru: 'Сапоги', category: 'standard', family_id: 'Equip_strengthen_cost', main_stats: ['ATK', 'HP'] },
  { id: 'visor1', name_en: 'Eyepiece', name_ru: 'Окуляр', category: 'special', family_id: 'Visor_strengthen_cost', main_stats: ['ATK', 'HP'] },
  { id: 'reactor1', name_en: 'Microreactor', name_ru: 'Микрореактор', category: 'special', family_id: 'Reactor_strengthen_cost', main_stats: ['ATK', 'HP'] },
  { id: 'core1', name_en: 'Combat Engine', name_ru: 'Боевой двигатель', category: 'special', family_id: 'Core_strengthen_cost', main_stats: ['ATK', 'HP'] },
  { id: 'exoskeleton1', name_en: 'Exoskeleton', name_ru: 'Экзоскелет', category: 'special', family_id: 'Exoskeleton_strengthen_cost', main_stats: ['ATK', 'HP'] }
];

const KNOWN_MATERIAL_NAMES = {
  StrengthenStone_01: { en: 'Booster Module I', ru: 'Модуль усиления I' },
  StrengthenStone_02: { en: 'Advancement Module I', ru: 'Модуль продвижения I' },
  StrengthenStone_03: { en: 'Booster Module II', ru: 'Модуль усиления II' },
  StrengthenStone_04: { en: 'Advancement Module II', ru: 'Модуль продвижения II' },
  StrengthenStone_05: { en: 'Booster Module III', ru: 'Модуль усиления III' },
  StrengthenStone_06: { en: 'Advancement Module III', ru: 'Модуль продвижения III' }
};

function buildGearEnhancementDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'datamine2', 'gear', 'data');
  const imageCopier = new ImageCopier(rawDir, projectRoot);

  console.log(`[build-gear-enhance] Project root: ${projectRoot}`);
  console.log(`[build-gear-enhance] Raw data dir: ${rawDir}`);

  const enhancePath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipStrengthenDataTable_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/EquipStrengthenDataTable.json',
    'EquipStrengthenDataTable_Overseas.json',
    'EquipStrengthenDataTable.json'
  ]);

  const osItemPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs_OS.json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Item/ItemConfigs_OS.json',
    'ItemConfigs_OS.json'
  ]);

  const stdItemPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json',
    'ItemConfigs.json'
  ]);

  if (!enhancePath) {
    console.error('[build-gear-enhance] Critical: EquipStrengthenDataTable not found in rawDir');
    return null;
  }

  const rawEnhance = readJsonFile(enhancePath);
  const enhanceRows = Array.isArray(rawEnhance) && rawEnhance[0]?.Rows ? rawEnhance[0].Rows : (rawEnhance?.Rows || rawEnhance || {});

  const rawOs = osItemPath ? readJsonFile(osItemPath) : null;
  const rawStd = stdItemPath ? readJsonFile(stdItemPath) : null;
  const osRows = (Array.isArray(rawOs) && rawOs[0]?.Rows ? rawOs[0].Rows : rawOs?.Rows) || rawOs || {};
  const stdRows = (Array.isArray(rawStd) && rawStd[0]?.Rows ? rawStd[0].Rows : rawStd?.Rows) || rawStd || {};
  const itemConfigRows = { ...stdRows, ...osRows };

  const itemsMeta: Record<string, any> = {};

  function resolveItemMeta(cleanId) {
    if (itemsMeta[cleanId]) return itemsMeta[cleanId];

    const itemRow = itemConfigRows[cleanId] || itemConfigRows[cleanId.toLowerCase()] || Object.entries(itemConfigRows).find(([k]) => k.toLowerCase() === cleanId.toLowerCase())?.[1];
    const rawIconRef = itemRow?.ItemIcon?.AssetPathName || '';
    const copied = rawIconRef
      ? imageCopier.copyAsset('gear', rawIconRef, 'items', { structured: true, entityId: cleanId })
      : imageCopier.copyAsset('gear', cleanId, 'items', { structured: true, entityId: cleanId });

    const knownName = KNOWN_MATERIAL_NAMES[cleanId];
    const nameEn = knownName?.en || itemRow?.ItemName?.SourceString || itemRow?.ItemName?.LocalizedString || cleanId;
    const nameRu = knownName?.ru || nameEn;

    itemsMeta[cleanId] = {
      id: cleanId,
      name_en: nameEn,
      name_ru: nameRu,
      icon: copied?.full || undefined,
      icon_thumb: copied?.thumb || undefined,
      media: {
        icon: {
          assetRef: rawIconRef || cleanId,
          rawExportPath: copied?.sourcePng || '',
          fullUrl: copied?.full || null,
          thumbUrl: copied?.thumb || null,
          strategy: copied ? (rawIconRef ? 'exact_config_field' : 'item_id_join') : (rawIconRef ? 'missing_exported_png' : 'no_source_ref'),
          diagnosticStatus: copied ? 'resolved' : 'missing_exported_png',
          joinIdentity: cleanId
        }
      }
    };
    return itemsMeta[cleanId];
  }

  // Pre-seed known items
  for (let i = 1; i <= 6; i++) {
    resolveItemMeta(`StrengthenStone_0${i}`);
  }

  // Dynamic Family Discovery
  const rawFamilyMap: Record<string, any> = {};
  for (const [rowKey, rowData] of Object.entries(enhanceRows)) {
    if (!rowData || typeof rowData !== 'object') continue;

    const match = rowKey.match(/^(.*)_(\d+)$/);
    if (match) {
      const prefix = match[1];
      const lvl = parseInt(match[2], 10);
      if (!rawFamilyMap[prefix]) rawFamilyMap[prefix] = {};
      rawFamilyMap[prefix][lvl] = { rowKey, rowData };
    } else {
      // Fallback numeric index
      const num = parseInt(rowKey, 10);
      if (!isNaN(num)) {
        if (!rawFamilyMap['Equip_strengthen_cost']) rawFamilyMap['Equip_strengthen_cost'] = {};
        rawFamilyMap['Equip_strengthen_cost'][num] = { rowKey, rowData };
      }
    }
  }

  const familiesOutput: Record<string, any> = {};
  let overallMaxLevel = 0;

  for (const [familyPrefix, levelRows] of Object.entries(rawFamilyMap)) {
    const familyDef = FAMILY_DEFINITIONS[familyPrefix] || {
      id: familyPrefix,
      name_en: familyPrefix.replace(/_/g, ' '),
      name_ru: familyPrefix.replace(/_/g, ' '),
      category: familyPrefix.startsWith('Equip') ? 'standard' : 'special',
      slots_count: familyPrefix.startsWith('Equip') ? 8 : 1,
      slots: []
    };

    const levels = [];
    const levelNums = Object.keys(levelRows).map((n) => parseInt(n, 10)).sort((a, b) => a - b);
    const maxFamilyLevel = levelNums.length > 0 ? levelNums[levelNums.length - 1] : 0;
    if (maxFamilyLevel > overallMaxLevel) overallMaxLevel = maxFamilyLevel;

    let cumGold = 0;
    const cumItems: Record<string, any> = {};

    for (const lvl of levelNums) {
      const { rowKey, rowData } = levelRows[lvl];
      const gold = Number(rowData.NeedGolds ?? 0);
      const needPlayerLevel = Number(rowData.NeedPlayerLevel ?? 1);
      const needShenGeLevel = rowData.NeedShenGeLevel || '';
      cumGold += gold;

      const items = (rowData.NeedItems || '')
        .split(';')
        .filter(Boolean)
        .map((s) => {
          const [id, countStr] = s.split(',');
          const cleanId = id.trim();
          const count = parseInt(countStr, 10) || 0;
          const meta = resolveItemMeta(cleanId);

          return {
            id: cleanId,
            name_en: meta.name_en,
            name_ru: meta.name_ru,
            count,
            icon: meta.icon,
            icon_thumb: meta.icon_thumb
          };
        });

      for (const it of items) {
        cumItems[it.id] = (cumItems[it.id] || 0) + it.count;
      }

      const levelObj: Record<string, any> = {
        level: lvl,
        need_player_level: needPlayerLevel,
        need_shen_ge_level: needShenGeLevel,
        gold,
        cum_gold: cumGold,
        items,
        cum_items: { ...cumItems },
        source_row: rowKey
      };

      if (familyDef.slots_count > 1) {
        const fullCircleGold = cumGold * familyDef.slots_count;
        const fullCircleItems: Record<string, any> = {};
        for (const [k, v] of Object.entries(cumItems)) {
          fullCircleItems[k] = v * familyDef.slots_count;
        }
        levelObj.full_circle_8_gold = fullCircleGold;
        levelObj.full_circle_8_items = fullCircleItems;
      }

      levels.push(levelObj);
    }

    const milestones = levels
      .filter((l) => l.level % 5 === 0)
      .map((l) => ({
        level: l.level,
        need_player_level: l.need_player_level,
        cum_gold_per_slot: l.cum_gold,
        full_circle_8_gold: l.full_circle_8_gold || (l.cum_gold * familyDef.slots_count),
        cum_items_per_slot: l.cum_items,
        full_circle_8_items: l.full_circle_8_items || l.cum_items
      }));

    familiesOutput[familyPrefix] = {
      id: familyDef.id,
      name_en: familyDef.name_en,
      name_ru: familyDef.name_ru,
      category: familyDef.category,
      slots_count: familyDef.slots_count,
      slots: familyDef.slots,
      maxLevel: maxFamilyLevel,
      totalLevels: levels.length,
      levels,
      milestones
    };
  }

  const defaultFamilyKey = familiesOutput['Equip_strengthen_cost'] ? 'Equip_strengthen_cost' : Object.keys(familiesOutput)[0];
  const defaultFamily = familiesOutput[defaultFamilyKey] || { levels: [], milestones: [], maxLevel: 0, totalLevels: 0 };

  const outputData = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    maxLevel: overallMaxLevel,
    totalFamilies: Object.keys(familiesOutput).length,
    defaultFamily: defaultFamilyKey,
    slots: SLOT_DEFINITIONS,
    items_meta: itemsMeta,
    families: familiesOutput,
    levels: defaultFamily.levels,
    milestones: defaultFamily.milestones
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outFilePath = path.join(outDir, 'enhancement.json');
  fs.writeFileSync(outFilePath, JSON.stringify(outputData, null, 2), 'utf8');

  // Write Manifest and Report
  const imageManifest: Record<string, any> = {};
  for (const meta of Object.values(itemsMeta)) {
    if (meta.icon) {
      imageManifest[meta.media?.icon?.assetRef || meta.id] = {
        full: meta.icon,
        thumb: meta.icon_thumb,
        strategy: meta.media?.icon?.strategy || 'exact_config_field'
      };
    }
  }
  const manifestPath = path.join(outDir, 'gear-enhance-image-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(imageManifest, null, 2), 'utf8');

  imageCopier.saveSharedManifest();
  const statsCount = imageCopier.getStats()['gear'] || Object.keys(itemsMeta).length;

  const imageReport = {
    totalEntities: Object.keys(itemsMeta).length,
    exactFieldMatches: Object.values(itemsMeta).filter((m) => m.icon).length,
    joinMatches: 0,
    namingMatches: 0,
    curatedMatches: 0,
    unresolvedCount: Object.values(itemsMeta).filter((m) => !m.icon).length,
    copiedFullImages: statsCount,
    generatedThumbnails: statsCount,
    duplicateCollisions: 0,
    brokenUrls: 0
  };

  const reportPath = path.join(outDir, 'gear-enhance-image-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(imageReport, null, 2), 'utf8');

  console.log(`[build-gear-enhance] Successfully generated enhancement data (${Object.keys(familiesOutput).length} families, max lvl ${overallMaxLevel}) to ${outFilePath}`);
  return outputData;
}

if (require.main === module) {
  try {
    buildGearEnhancementDataset();
  } catch (err) {
    console.error('[build-gear-enhance] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildGearEnhancementDataset,
  FAMILY_DEFINITIONS,
  SLOT_DEFINITIONS,
};
