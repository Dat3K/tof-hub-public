import { readGameSourceFileSync, projectsCjkCulture } from './game-source-reader';
/**
 * build-food.js
 *
 * Dedicated pipeline processor for Tower of Fantasy Cooking Recipes & Food Catalog:
 * - Reads raw food data tables and recipe tables
 * - Joins buffs with GameplayEffectTipsDataTable
 * - Joins recipe ingredients with ItemConfigs
 * - Extracts satiety values from row.StaticToolName and FakeDiamondValue
 * - Resolves {0} and buff ModifyData calculations
 * - Strictly resolves English and Russian localization
 * - Deploys authentic in-game AttributeIcon assets
 * - Classifies dish type (Snack vs Entrée)
 * - Populates complete effect categories matching towerofantasy.info
 * - Guarantees zero Cyrillic characters in all English fields
 * - Directly delivers food.json to info/food/data/
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';
import { normalizeUnrealSoftReference, toCanonicalMediaUrl } from './canonical-media-library';

const AUTHENTIC_ATTRIBUTE_ICONS = [
  'icon_Item_full.webp',
  'icon_Item_hp.webp',
  'icon_Item_bing.webp',
  'icon_Item_wu.webp',
  'icon_Item_def_huo.webp',
  'icon_Item_def_lei.webp',
  'icon_Item_def.webp',
  'icon_Item_lei.webp',
  'icon_Item_huo.webp',
  'icon_Item_energy.webp',
  'icon_Item_def_bing.webp',
  'icon_item_DiveSpeed.webp',
  'icon_item_RecoveryHp.webp',
  'icon_item_CleanBuff.webp',
  'icon_item_EnergyConsumeDown.webp'
];

function hasCjk(text) {
  if (!text || typeof text !== 'string' || projectsCjkCulture()) return false;
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function hasCyrillic(str) {
  return /[\u0400-\u04FF]/.test(str || '');
}

function cleanName(name) {
  if (!name || typeof name !== 'string') return '';
  return cleanHtmlTags(name).replace(/^["'“‘《「『]\s*/, '').replace(/\s*["'”’》」』]$/, '').trim();
}

function formatNumber(n, locale = 'en') {
  if (typeof n !== 'number' || isNaN(n)) return String(n || 0);
  if (locale === 'ru') {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  return n.toLocaleString('en-US');
}

function resolveBuffEffect(buffLeaf, modifyData, tipDescEn, tipDescRu) {
  const mod = modifyData || {};
  const mult = typeof mod.fStrengthMult === 'number' ? mod.fStrengthMult : 0;
  const add = typeof mod.fStrengthAdd === 'number' ? mod.fStrengthAdd : 0;
  const duration = typeof mod.fDuration === 'number' ? mod.fDuration : 0;
  const period = typeof mod.fPeriod === 'number' ? mod.fPeriod : 0;

  const pct = Math.round(mult * 100);
  const addEn = formatNumber(add, 'en');
  const addRu = formatNumber(add, 'ru');

  let descEn = tipDescEn || '';
  let descRu = tipDescRu || '';
  let conciseEn = '';
  let conciseRu = '';

  if (buffLeaf === 'buff_AddHealthFoodBase') {
    descEn = descEn.replace(/\{0\}/g, String(pct)).replace(/\{1\}/g, addEn);
    descRu = descRu.replace(/\{0\}/g, String(pct)).replace(/\{1\}/g, addRu);
    conciseEn = `Recovers ${pct}% + ${addEn} HP`;
    conciseRu = `Восстанавливает ${pct}% + ${addRu} ОЗ`;
  } else if (buffLeaf === 'buff_Food_AddRecoveryHp') {
    const valEn = `${pct}% + ${addEn}`;
    const valRu = `${pct}% + ${addRu}`;
    descEn = descEn.replace(/\{0\}/g, String(period)).replace(/\{1\}/g, valEn).replace(/\{3\}/g, String(duration));
    descRu = descRu.replace(/\{0\}/g, String(period)).replace(/\{1\}/g, valRu).replace(/\{3\}/g, String(duration));
    conciseEn = `Recovers ${valEn} HP every ${period}s for ${duration}s`;
    conciseRu = `Восстанавливает ${valRu} ОЗ каждые ${period} сек. в течение ${duration} сек.`;
  } else if (buffLeaf === 'buff_Food_JiantingDiveSpeed') {
    descEn = descEn.replace(/\{3\}/g, String(duration));
    descRu = descRu.replace(/\{3\}/g, String(duration));
    conciseEn = `Diving speed +30% for ${duration}s`;
    conciseRu = `Скорость плавания +30% на ${duration} сек.`;
  } else if (buffLeaf === 'buff_Food_JiantingEnergyConsumeDown') {
    descEn = descEn.replace(/\{3\}/g, String(duration));
    descRu = descRu.replace(/\{3\}/g, String(duration));
    conciseEn = `Diving endurance consumption -33% for ${duration}s`;
    conciseRu = `Расход выносливости при плавании -33% на ${duration} сек.`;
  } else if (buffLeaf === 'buff_Food_CleanBuff') {
    conciseEn = 'Removes Poison';
    conciseRu = 'Снимает отравление';
  } else if (buffLeaf.includes('Atk') || buffLeaf.includes('Def') || buffLeaf.includes('EnergyRecover')) {
    let statEn = '';
    let statRu = '';
    let statRuNom = '';

    if (buffLeaf.includes('IceAtk')) {
      statEn = 'Frost Attack'; statRu = 'ледяную атаку'; statRuNom = 'Ледяная атака';
    } else if (buffLeaf.includes('FireAtk')) {
      statEn = 'Flame Attack'; statRu = 'огненную атаку'; statRuNom = 'Огненная атака';
    } else if (buffLeaf.includes('ThunderAtk')) {
      statEn = 'Volt Attack'; statRu = 'электрическую атаку'; statRuNom = 'Электрическая атака';
    } else if (buffLeaf.includes('PhyAtk') || buffLeaf.includes('CommonAtk')) {
      statEn = 'Physical Attack'; statRu = 'физическую атаку'; statRuNom = 'Физическая атака';
    } else if (buffLeaf.includes('IceDef')) {
      statEn = 'Frost Resistance'; statRu = 'сопротивление холоду'; statRuNom = 'Сопротивление холоду';
    } else if (buffLeaf.includes('FireDef')) {
      statEn = 'Flame Resistance'; statRu = 'сопротивление огню'; statRuNom = 'Сопротивление огню';
    } else if (buffLeaf.includes('ThunderDef')) {
      statEn = 'Volt Resistance'; statRu = 'сопротивление электричеству'; statRuNom = 'Сопротивление электричеству';
    } else if (buffLeaf.includes('PhyDef')) {
      statEn = 'Physical Resistance'; statRu = 'сопротивление физическому урону'; statRuNom = 'Физическое сопротивление';
    } else if (buffLeaf.includes('EnergyRecover')) {
      statEn = 'Endurance Regeneration'; statRu = 'восстановление выносливости'; statRuNom = 'Восстановление выносливости';
    }

    let valEn = '';
    let valRu = '';
    if (mult > 0 && add > 0) {
      valEn = `${pct}% + ${addEn}`;
      valRu = `${pct}% + ${addRu}`;
    } else if (mult > 0) {
      valEn = `${pct}%`;
      valRu = `${pct}%`;
    } else {
      valEn = addEn;
      valRu = addRu;
    }

    descEn = descEn.replace(/\{1\}/g, `${statEn} by ${valEn}`).replace(/\{3\}/g, String(duration));
    descRu = descRu.replace(/\{1\}/g, `${statRu} на ${valRu}`).replace(/\{3\}/g, String(duration));
    conciseEn = `${statEn} +${valEn} for ${duration}s`;
    conciseRu = `${statRuNom} +${valRu} на ${duration} сек.`;
  }

  // Fallback cleanup if any unresolved placeholders remain
  descEn = descEn.replace(/\{0\}/g, String(pct)).replace(/\{1\}/g, addEn).replace(/\{3\}/g, String(duration));
  descRu = descRu.replace(/\{0\}/g, String(pct)).replace(/\{1\}/g, addRu).replace(/\{3\}/g, String(duration));

  return { descEn, descRu, conciseEn, conciseRu };
}

function deployAttributeIcons(projectRoot, rawDir) {
  const targetDirs = [
    path.join(projectRoot, 'datamine', 'shared', 'media', 'Hotta', 'Content', 'Resources', 'UI', 'AttributeIcon'),
  ];

  for (const d of targetDirs) {
    fs.mkdirSync(d, { recursive: true });
  }

  const searchDirs = [
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports', 'Hotta', 'Content', 'Resources', 'UI', 'AttributeIcon'),
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports', 'raw_exports', 'Hotta', 'Content', 'Resources', 'UI', 'AttributeIcon'),
    path.join(rawDir, 'Hotta', 'Content', 'Resources', 'UI', 'AttributeIcon'),
    path.join(projectRoot, 'datamine', 'shared', 'media', 'Hotta', 'Content', 'Resources', 'UI', 'AttributeIcon')
  ];

  for (const icon of AUTHENTIC_ATTRIBUTE_ICONS) {
    let src = null;
    for (const sDir of searchDirs) {
      const candidate = path.join(sDir, icon);
      if (fs.existsSync(candidate)) {
        src = candidate;
        break;
      }
    }
    if (src) {
      for (const tDir of targetDirs) {
        const dest = path.join(tDir, icon);
        if (dest !== src && (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs)) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  }
}

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-food] Error reading JSON at ${filePath}:`, e.message);
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
    if (dir && fs.existsSync(dir)) return dir;
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

function mapQuality(rawQuality, foodStar?) {
  if (!rawQuality) return 'N';
  const q = String(rawQuality).toUpperCase();
  if (q.includes('LEGENDRY') || q.includes('LEGENDARY') || q.includes('SSR') || q.includes('GOLD')) return 'SSR';
  if (q.includes('SUPERRARE') || q.includes('EPIC') || q.includes('PURPLE')) return 'SSR';
  if (q.includes('SENIOR') || q.includes('RARE') || q.includes('BLUE')) return 'SR';
  if (q.includes('COMMON') || q.includes('GREEN')) return 'R';
  if (q.includes('POOR') || q.includes('WHITE') || q === 'N') return 'N';
  return 'N';
}

function resolveEntityBilingual(locResolver, ftext, id) {
  let b = locResolver.resolveBilingual(ftext, { fallbackId: id });
  if (!b.name_en || hasCjk(b.name_en) || hasCyrillic(b.name_en)) {
    const k = ftext?.Key || '';
    const cleanId = id.replace(/^(test_|bag_|Recipe_|Item_)/i, '');
    const candidates = [
      k + '_name',
      k + '_des',
      id + '_name',
      id.toLowerCase() + '_name',
      cleanId,
      cleanId + '_name',
      id.replace(/^bag_/i, ''),
      id.replace(/^bag_/i, '') + '_name',
      id.replace(/_/g, '-'),
      'item_' + cleanId + '_name',
      'recipe_' + cleanId.toLowerCase(),
      'recipe_' + cleanId.toLowerCase() + '_name'
    ];
    for (const cand of candidates) {
      const alt = locResolver.resolveBilingual({ TableId: '/Game/Resources/Text/ST_item.ST_Item', Key: cand }, { fallbackId: id });
      if (alt.name_en && !hasCjk(alt.name_en) && !hasCyrillic(alt.name_en)) {
        b.name_en = alt.name_en;
        if (!b.name_ru || hasCjk(b.name_ru)) {
          b.name_ru = alt.name_ru || alt.name_en;
        }
        break;
      }
    }
  }

  // Strict English guarantee: if name_en is Cyrillic or missing, generate clean Latin fallback from id
  if (!b.name_en || hasCyrillic(b.name_en) || hasCjk(b.name_en)) {
    b.name_en = id.replace(/^(item_|recipe_)/i, '').replace(/_/g, ' ');
  }

  return b;
}

function resolveMedia(rawPath) {
  if (!rawPath || typeof rawPath !== 'string' || rawPath.toLowerCase() === 'none') {
    return null;
  }
  try {
    const canonicalRef = normalizeUnrealSoftReference(rawPath);
    const publicUrl = toCanonicalMediaUrl(canonicalRef);
    return {
      assetRef: rawPath,
      url: publicUrl,
      thumbUrl: publicUrl,
      format: 'webp',
      matchStrategy: 'exact_game_path'
    };
  } catch (_) {
    const cleanRef = rawPath.replace(/^(\/Game\/|Game\/)/, '').replace(/\.[^/.]+$/, '');
    return {
      assetRef: rawPath,
      url: `/datamine/shared/media/${cleanRef}.webp`,
      thumbUrl: `/datamine/shared/media/${cleanRef}.webp`,
      format: 'webp',
      matchStrategy: 'exact_game_path'
    };
  }
}

function buildFoodDataset(options: Record<string, any> = {}) {
  const projectRoot = options.projectRoot || resolveProjectRoot();
  const rawDir = options.rawDir || resolveRawDir(projectRoot);

  console.log(`[build-food] Project root: ${projectRoot}`);
  console.log(`[build-food] Raw data dir: ${rawDir}`);

  // Deploy authentic attribute icons
  deployAttributeIcons(projectRoot, rawDir);

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

  // Load OutputSource Data Tables (Standard + MMO)
  const outputSourceStdPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Item/DT_ItemOutputSource.json',
    'DT_ItemOutputSource.json'
  ]);
  const outputSourceMmoPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_ItemOutputSource_MMO.json',
    'DT_ItemOutputSource_MMO.json'
  ]);
  const rawStdOutputSource = outputSourceStdPath ? readJsonFile(outputSourceStdPath) : null;
  const rawMmoOutputSource = outputSourceMmoPath ? readJsonFile(outputSourceMmoPath) : null;
  const stdOutputSourceRows = rawStdOutputSource?.[0]?.Rows || rawStdOutputSource?.Rows || rawStdOutputSource || {};
  const mmoOutputSourceRows = rawMmoOutputSource?.[0]?.Rows || rawMmoOutputSource?.Rows || rawMmoOutputSource || {};
  const outputSourceRows = { ...stdOutputSourceRows, ...mmoOutputSourceRows };

  // Load Recipe Data Tables (CookRecipesDataTable)
  const recipesPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/cooking/CookRecipesDataTable.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/cooking/CookRecipesDataTable_MMO.json',
    'CookRecipesDataTable.json'
  ]);
  const rawRecipes = recipesPath ? readJsonFile(recipesPath) : null;
  const recipeRows = rawRecipes?.[0]?.Rows || rawRecipes?.Rows || rawRecipes || {};

  // Load Food Data Tables
  const foodOverseasPath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/CookingFoodDataTable_Overseas.json',
    'CookingFoodDataTable_Overseas.json'
  ]);
  const foodStdPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/cooking/CookingFoodDataTable.json',
    'CookingFoodDataTable.json'
  ]);
  const rawFoodOs = foodOverseasPath ? readJsonFile(foodOverseasPath) : null;
  const rawFoodStd = foodStdPath ? readJsonFile(foodStdPath) : null;
  const foodRowsOs = rawFoodOs?.[0]?.Rows || rawFoodOs?.Rows || rawFoodOs || {};
  const foodRowsStd = rawFoodStd?.[0]?.Rows || rawFoodStd?.Rows || rawFoodStd || {};
  const foodRows = { ...foodRowsStd, ...foodRowsOs };

  // Load GameplayEffectTips tables for buff effect details (Standard + Overseas)
  const effectTipsOsPath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/GameplayEffectTipsDataTable_Overseas.json',
    'GameplayEffectTipsDataTable_Overseas.json'
  ]);
  const effectTipsStdPath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable.json',
    'GameplayEffectTipsDataTable.json'
  ]);
  const rawEffOs = effectTipsOsPath ? readJsonFile(effectTipsOsPath) : null;
  const rawEffStd = effectTipsStdPath ? readJsonFile(effectTipsStdPath) : null;
  const effRowsOs = rawEffOs?.[0]?.Rows || rawEffOs?.Rows || rawEffOs || {};
  const effRowsStd = rawEffStd?.[0]?.Rows || rawEffStd?.Rows || rawEffStd || {};
  const effectTipsRows = { ...effRowsStd, ...effRowsOs };

  const foodList: any = [];
  const qualityRank = { SSR: 1, SR: 2, R: 3, N: 4 };

  if (Object.keys(foodRows).length > 0) {
    console.log(`[build-food] Processing ${Object.keys(foodRows).length} raw food rows...`);

    // Index recipes by FoodItemID
    const recipesByFoodId = new Map<any, any>();
    for (const [recId, recRow] of Object.entries(recipeRows)) {
      const foodId = recRow.FoodItemID;
      if (foodId && !recipesByFoodId.has(foodId)) {
        recipesByFoodId.set(foodId, { recId, ...recRow });
      }
    }

    // Index recipe manual items from ItemConfigs (Recipe_Cooking_*)
    const recipeManualByFoodId = new Map<any, any>();
    for (const [id, r] of Object.entries(itemRows)) {
      if (id.startsWith('Recipe_Cooking_')) {
        const num = id.replace('Recipe_Cooking_', '');
        recipeManualByFoodId.set(`Item_Cooking_${num}`, id);
        recipeManualByFoodId.set(`Cooking_${num}`, id);
      }
    }

    for (const [id, row] of Object.entries(foodRows)) {
      const b = resolveEntityBilingual(locResolver, row.ItemName, id);
      let name_en = cleanName(b.name_en);
      if (hasCyrillic(name_en)) {
        name_en = cleanName(id.replace(/^(Item_|Recipe_)/i, ''));
      }
      const name_ru = cleanName(b.name_ru || b.name_en);

      const foodStar = typeof row.FoodStar === 'number' ? row.FoodStar : 0;
      const rarity = mapQuality(row.ItemQuality, foodStar);

      const rawIcon = row.ItemIcon?.AssetPathName || (typeof row.ItemIcon === 'string' ? row.ItemIcon : null);
      const media = resolveMedia(rawIcon);

      // Dish type extraction (Snack vs Entrée)
      let type = 'Entrée';
      let type_ru = 'Основное блюдо';
      const briefKey = row.ItemBrief?.Key || '';
      const briefStr = row.ItemBrief?.LocalizedString || row.ItemBrief?.SourceString || '';
      if (briefKey === 'brief_veracooking' || briefStr.includes('小吃') || briefStr.toLowerCase().includes('snack')) {
        type = 'Snack';
        type_ru = 'Закуска';
      } else if (briefKey === 'brief_Cooking' || briefStr.includes('菜肴') || briefStr.toLowerCase().includes('entrée') || briefStr.toLowerCase().includes('entree')) {
        type = 'Entrée';
        type_ru = 'Основное блюдо';
      }

      // Satiety extraction: food_satiety_(\d+) with fallback to FakeDiamondValue
      let satiety = 0;
      const satietyMatch = String(row.StaticToolName || '').match(/food_satiety_(\d+)/i);
      if (satietyMatch) {
        satiety = parseInt(satietyMatch[1], 10);
      } else if (typeof row.FakeDiamondValue === 'number' && row.FakeDiamondValue > 0) {
        satiety = row.FakeDiamondValue;
      }

      // Buff / effect text from UseDescription
      const rawUseDescEn = locResolver.resolve(row.UseDescription, { locale: 'en' }).text || '';
      let useDescEn = cleanHtmlTags(rawUseDescEn);
      if (hasCyrillic(useDescEn)) {
        useDescEn = '';
      }

      const rawUseDescRu = locResolver.resolve(row.UseDescription, { locale: 'ru', fallbackLocale: 'en' }).text || useDescEn;
      let useDescRu = cleanHtmlTags(rawUseDescRu);

      // Resolve {0} in effect text with resolved satiety value
      if (useDescEn.includes('{0}')) {
        useDescEn = useDescEn.replace(/\{0\}/g, String(satiety));
      }
      if (useDescRu.includes('{0}')) {
        useDescRu = useDescRu.replace(/\{0\}/g, String(satiety));
      }

      const formatted_effects_en = [];
      const formatted_effects_ru = [];
      const isEndurance = row.UseDescription?.Key === 'item_food_usedesc_2';
      if (satiety > 0) {
        if (isEndurance) {
          formatted_effects_en.push(`Recovers ${satiety} endurance`);
          formatted_effects_ru.push(`Восстанавливает ${satiety} ед. выносливости`);
        } else {
          formatted_effects_en.push(`Recovers ${satiety} satiety`);
          formatted_effects_ru.push(`Восстанавливает ${satiety} ед. сытости`);
        }
      }

      // Detailed Buffs join with GameplayEffectTipsDataTable
      const buffs = [];
      if (Array.isArray(row.Buffs)) {
        for (const buffEntry of row.Buffs) {
          const buffPath = buffEntry.BuffClass?.AssetPathName || '';
          const buffLeaf = path.basename(buffPath).split('.')[0];
          if (buffLeaf && buffLeaf !== 'None' && buffLeaf !== 'GE_UseCoolDown') {
            const tip = effectTipsRows[buffLeaf];
            if (tip) {
              const bName = locResolver.resolveBilingual(tip.Name, { fallbackId: buffLeaf });
              const bDesc = locResolver.resolveBilingual(tip.Desc, { fallbackId: buffLeaf });

              let buffNameEn = cleanName(bName.name_en);
              if (hasCyrillic(buffNameEn)) buffNameEn = cleanName(buffLeaf);

              let rawBuffDescEn = cleanHtmlTags(bDesc.name_en);
              if (hasCyrillic(rawBuffDescEn)) rawBuffDescEn = '';
              let rawBuffDescRu = cleanHtmlTags(bDesc.name_ru || bDesc.name_en);

              const resolvedBuff = resolveBuffEffect(
                buffLeaf,
                buffEntry.ModifyData,
                rawBuffDescEn,
                rawBuffDescRu
              );

              if (resolvedBuff.conciseEn) formatted_effects_en.push(resolvedBuff.conciseEn);
              if (resolvedBuff.conciseRu) formatted_effects_ru.push(resolvedBuff.conciseRu);

              const tipIconRef = tip.Icon?.AssetPathName || tip.AttrIcon?.AssetPathName || '';
              const tipMedia = resolveMedia(tipIconRef);

              buffs.push({
                buff_id: buffLeaf,
                name_en: buffNameEn,
                name_ru: cleanName(bName.name_ru || bName.name_en),
                description_en: resolvedBuff.descEn,
                description_ru: resolvedBuff.descRu,
                icon: tipMedia?.url || undefined
              });
            }
          }
        }
      }

      // Healing detection
      const has_heal = Boolean(
        (row.Categories || []).some((c) => c === 'AddHealth' || c === 'RecoverHp' || c === 'FoodRecoverHp') ||
        buffs.some((b) => b.buff_id === 'buff_AddHealthFoodBase' || b.buff_id === 'buff_Food_AddRecoveryHp')
      );

      // Complete categories population across all 15 authentic in-game effect categories
      const categoriesSet = new Set<any>(Array.isArray(row.Categories) ? row.Categories : []);
      if (satiety > 0) {
        if (isEndurance) {
          categoriesSet.add('AddEnergyRecover');
        } else {
          categoriesSet.add('AddSatiety');
        }
      }
      if (has_heal || buffs.some((b) => b.buff_id === 'buff_AddHealthFoodBase') || categoriesSet.has('AddHealth')) {
        categoriesSet.add('AddHealth');
      }
      if (buffs.some((b) => b.buff_id === 'buff_Food_AddRecoveryHp') || categoriesSet.has('RecoverHp') || categoriesSet.has('FoodRecoverHp')) {
        categoriesSet.add('RecoverHp');
        categoriesSet.delete('FoodRecoverHp');
      }
      if (buffs.some((b) => b.buff_id === 'buff_Food_JiantingDiveSpeed') || categoriesSet.has('DiveSpeed')) {
        categoriesSet.add('DiveSpeed');
      }
      if (buffs.some((b) => b.buff_id === 'buff_Food_JiantingEnergyConsumeDown') || categoriesSet.has('EnergyConsumeDown')) {
        categoriesSet.add('EnergyConsumeDown');
      }
      if (buffs.some((b) => b.buff_id === 'buff_Food_CleanBuff') || categoriesSet.has('CleanBuff')) {
        categoriesSet.add('CleanBuff');
      }
      if (Array.isArray(row.Buffs)) {
        for (const buffEntry of row.Buffs) {
          const buffPath = buffEntry.BuffClass?.AssetPathName || '';
          const buffLeaf = path.basename(buffPath).split('.')[0];
          if (buffLeaf) {
            if (buffLeaf.includes('IceAtk')) categoriesSet.add('IceAtk');
            else if (buffLeaf.includes('FireAtk')) categoriesSet.add('FireAtk');
            else if (buffLeaf.includes('ThunderAtk')) categoriesSet.add('ThunderAtk');
            else if (buffLeaf.includes('PhyAtk') || buffLeaf.includes('CommonAtk')) categoriesSet.add('PhyAtk');
            else if (buffLeaf.includes('IceDef')) categoriesSet.add('IceDef');
            else if (buffLeaf.includes('FireDef')) categoriesSet.add('FireDef');
            else if (buffLeaf.includes('ThunderDef')) categoriesSet.add('ThunderDef');
            else if (buffLeaf.includes('PhyDef')) categoriesSet.add('PhyDef');
            else if (buffLeaf.includes('EnergyRecover')) categoriesSet.add('AddEnergyRecover');
          }
        }
      }
      for (const b of buffs) {
        const buffLeaf = b.buff_id || '';
        if (buffLeaf.includes('IceAtk')) categoriesSet.add('IceAtk');
        else if (buffLeaf.includes('FireAtk')) categoriesSet.add('FireAtk');
        else if (buffLeaf.includes('ThunderAtk')) categoriesSet.add('ThunderAtk');
        else if (buffLeaf.includes('PhyAtk') || buffLeaf.includes('CommonAtk')) categoriesSet.add('PhyAtk');
        else if (buffLeaf.includes('IceDef')) categoriesSet.add('IceDef');
        else if (buffLeaf.includes('FireDef')) categoriesSet.add('FireDef');
        else if (buffLeaf.includes('ThunderDef')) categoriesSet.add('ThunderDef');
        else if (buffLeaf.includes('PhyDef')) categoriesSet.add('PhyDef');
        else if (buffLeaf.includes('EnergyRecover')) categoriesSet.add('AddEnergyRecover');
      }
      const categories = Array.from(categoriesSet);

      // Recipe & ingredients join
      const rec = recipesByFoodId.get(id);
      let recipe = null;
      if (rec && Array.isArray(rec.Ingredients) && rec.Ingredients.length > 0) {
        const ingredients = [];
        for (const ing of rec.Ingredients) {
          const ingId = ing.DesignedItemsID?.[0] || '';
          if (ingId) {
            const ingItem = itemRows[ingId];
            const ingName = ingItem ? resolveEntityBilingual(locResolver, ingItem.ItemName, ingId) : null;

            let ingNameEn = cleanName(ingName?.name_en || ingId);
            if (hasCyrillic(ingNameEn)) ingNameEn = ingId;

            const ingIconRef = ingItem?.ItemIcon?.AssetPathName || '';
            const ingMedia = resolveMedia(ingIconRef);
            const ingRarity = mapQuality(ingItem?.ItemQuality);

            // Resolve gathering sources from OutputSource tables
            const sourceId = ingItem?.OutputSourceID;
            const sourceRow = sourceId ? outputSourceRows[sourceId] : null;
            const sources_en = [];
            const sources_ru = [];
            if (sourceRow?.SourceArray) {
              for (const s of sourceRow.SourceArray) {
                if (s.PostfixName?.Key) {
                  const b = locResolver.resolveBilingual(s.PostfixName);
                  const sEn = cleanName(b.name_en);
                  const sRu = cleanName(b.name_ru || b.name_en);
                  if (sEn && !hasCyrillic(sEn) && !sources_en.includes(sEn)) {
                    sources_en.push(sEn);
                    sources_ru.push(sRu);
                  }
                }
              }
            }

            ingredients.push({
              id: ingId,
              name_en: ingNameEn,
              name_ru: cleanName(ingName?.name_ru || ingName?.name_en || ingId),
              count: Number(ing.MinNeedIngredientAmount || ing.PrefectIngredientAmount || 1),
              is_core: Boolean(ing.bIsCore),
              rarity: ingRarity,
              icon: ingMedia?.url || undefined,
              sources_en: sources_en.length > 0 ? sources_en : undefined,
              sources_ru: sources_ru.length > 0 ? sources_ru : undefined
            });
          }
        }
        const manualItemId = recipeManualByFoodId.get(id);
        recipe = {
          recipe_id: rec.recId,
          ingredients,
          manual_item_id: manualItemId || undefined
        };
      }

      foodList.push({
        id,
        name_en: name_en || id,
        name_ru: name_ru || name_en || id,
        star: foodStar,
        rarity,
        quality: row.ItemQuality || 'ITEM_QUALITY_POOR',
        type,
        type_ru,
        categories,
        satiety,
        has_heal,
        formatted_effects_en,
        formatted_effects_ru,
        effect_text_en: useDescEn || undefined,
        effect_text_ru: useDescRu || undefined,
        buffs: buffs.length > 0 ? buffs : undefined,
        recipe: recipe || undefined,
        icon: media?.url || undefined,
        icon_thumb: media?.thumbUrl || undefined,
        media: media || undefined
      });
    }

    // Sort by natural cooking recipe progression: N (Common) -> R (Uncommon) -> SR (Rare) -> SSR (Gourmet)
    const qualityProgression = { N: 1, R: 2, SR: 3, SSR: 4 };
    foodList.sort((a, b) => {
      const qA = qualityProgression[a.rarity] || 99;
      const qB = qualityProgression[b.rarity] || 99;
      if (qA !== qB) return qA - qB;
      const sA = (a.star || 0) === 0 ? 99 : a.star;
      const sB = (b.star || 0) === 0 ? 99 : b.star;
      if (sA !== sB) return sA - sB;
      return a.name_en.localeCompare(b.name_en);
    });
  } else {
    // Fallback if raw exports are not found on disk: load baseline food.json
    const fallbackPath = path.join(projectRoot, 'info', 'food', 'data', 'food.json');
    if (fs.existsSync(fallbackPath)) {
      console.log(`[build-food] Raw exports not found, preserving existing food dataset from ${fallbackPath}`);
      const existing = readJsonFile(fallbackPath);
      if (Array.isArray(existing)) {
        for (const item of existing) {
          if (!item.type) item.type = 'Entrée';
          if (!item.type_ru) item.type_ru = 'Основное блюдо';
          if (!Array.isArray(item.categories)) item.categories = [];
          foodList.push(item);
        }
      }
    }
  }

  // Build unified cooking ingredients catalog
  const ingredientsMap = new Map<any, any>();
  for (const dish of foodList) {
    if (dish.recipe && Array.isArray(dish.recipe.ingredients)) {
      for (const ing of dish.recipe.ingredients) {
        if (!ingredientsMap.has(ing.id)) {
          const ingItem = itemRows[ing.id];
          const descB = ingItem?.Description ? locResolver.resolveBilingual(ingItem.Description) : null;
          let descEn = cleanName(descB?.name_en || '');
          if (hasCyrillic(descEn)) descEn = '';
          const descRu = cleanName(descB?.name_ru || descB?.name_en || '');

          ingredientsMap.set(ing.id, {
            id: ing.id,
            name_en: ing.name_en,
            name_ru: ing.name_ru,
            rarity: ing.rarity || 'N',
            icon: ing.icon,
            description_en: descEn || undefined,
            description_ru: descRu || undefined,
            sources_en: ing.sources_en || [],
            sources_ru: ing.sources_ru || [],
            used_in: []
          });
        }
        const entry = ingredientsMap.get(ing.id);
        if (!entry.used_in.some((u) => u.id === dish.id)) {
          entry.used_in.push({
            id: dish.id,
            name_en: dish.name_en,
            name_ru: dish.name_ru,
            icon: dish.icon,
            rarity: dish.rarity
          });
        }
      }
    }
  }

  const ingredientsList = Array.from(ingredientsMap.values());
  const qualityProgression = { N: 1, R: 2, SR: 3, SSR: 4 };
  ingredientsList.sort((a, b) => {
    const qA = qualityProgression[a.rarity] || 99;
    const qB = qualityProgression[b.rarity] || 99;
    if (qA !== qB) return qA - qB;
    return a.name_en.localeCompare(b.name_en);
  });

  // Strict invariant: verify zero Cyrillic characters in any English field
  for (const item of foodList) {
    if (hasCyrillic(item.name_en)) {
      throw new Error(`[build-food] Invariant violation: item ${item.id} has Cyrillic in name_en: "${item.name_en}"`);
    }
    if (hasCyrillic(item.effect_text_en)) {
      throw new Error(`[build-food] Invariant violation: item ${item.id} has Cyrillic in effect_text_en`);
    }
    for (const eff of (item.formatted_effects_en || [])) {
      if (hasCyrillic(eff)) {
        throw new Error(`[build-food] Invariant violation: item ${item.id} has Cyrillic in formatted_effects_en: "${eff}"`);
      }
    }
    for (const b of (item.buffs || [])) {
      if (hasCyrillic(b.name_en)) {
        throw new Error(`[build-food] Invariant violation: item ${item.id} buff ${b.buff_id} has Cyrillic in name_en: "${b.name_en}"`);
      }
      if (hasCyrillic(b.description_en)) {
        throw new Error(`[build-food] Invariant violation: item ${item.id} buff ${b.buff_id} has Cyrillic in description_en`);
      }
    }
    for (const ing of (item.recipe?.ingredients || [])) {
      if (hasCyrillic(ing.name_en)) {
        throw new Error(`[build-food] Invariant violation: item ${item.id} ingredient ${ing.id} has Cyrillic in name_en: "${ing.name_en}"`);
      }
      for (const s of (ing.sources_en || [])) {
        if (hasCyrillic(s)) {
          throw new Error(`[build-food] Invariant violation: item ${item.id} ingredient ${ing.id} source has Cyrillic: "${s}"`);
        }
      }
    }
  }

  // Extract potions dataset
  const potionsList = extractPotions(itemRows, effectTipsRows, locResolver, projectRoot, foodList);

  // Invariant verification on potions
  for (const item of potionsList) {
    if (!item.name_en || hasCyrillic(item.name_en)) {
      throw new Error(`[build-food] Invariant violation: potion ${item.id} has invalid or Cyrillic name_en: "${item.name_en}"`);
    }
    for (const eff of (item.formatted_effects_en || [])) {
      if (hasCyrillic(eff)) {
        throw new Error(`[build-food] Invariant violation: potion ${item.id} has Cyrillic in formatted_effects_en: "${eff}"`);
      }
    }
  }

  // Directly deliver to target directories
  const targetDirs = [path.join(projectRoot, 'info', 'food', 'data')];

  const jsonContent = JSON.stringify(foodList, null, 2);
  const ingredientsJson = JSON.stringify(ingredientsList, null, 2);
  const potionsJson = JSON.stringify(potionsList, null, 2);

  for (const dir of targetDirs) {
    fs.mkdirSync(dir, { recursive: true });
    const targetFoodFile = path.join(dir, 'food.json');
    const targetIngFile = path.join(dir, 'ingredients.json');
    const targetPotionFile = path.join(dir, 'potions.json');
    fs.writeFileSync(targetFoodFile, jsonContent, 'utf8');
    fs.writeFileSync(targetIngFile, ingredientsJson, 'utf8');
    fs.writeFileSync(targetPotionFile, potionsJson, 'utf8');
    console.log(`[build-food] Delivered food.json (${foodList.length}), ingredients.json (${ingredientsList.length}), potions.json (${potionsList.length}) -> ${dir}`);
  }

  foodList.food = foodList;
  foodList.ingredients = ingredientsList;
  foodList.potions = potionsList;
  return foodList;
}

function extractPotions(itemRows, effectTipsRows, locResolver, projectRoot, foodList = []) {
  const existingDishIds = new Set<any>((foodList || []).map(f => f.id));

  // Shared buffs index
  const sharedBuffsCandidate = path.join(projectRoot, 'datamine', 'shared-data', 'buffs.json');
  const sharedBuffs = fs.existsSync(sharedBuffsCandidate) ? readJsonFile(sharedBuffsCandidate) || {} : {};

  // Endurance mapping table from FoodRecoverEng code
  const enduranceMap = {
    FoodRecoverEng_2_4_1: 800,
    FoodRecoverEng_2_3_1: 600,
    FoodRecoverEng_1_3_1: 500,
    FoodRecoverEng_1_2_1: 400,
    FoodRecoverEng_1_1_1: 300,
    FoodRecoverEng_2_2_1: 400
  };

  const potions = [];

  for (const [id, row] of Object.entries(itemRows)) {
    if (existingDishIds.has(id)) continue;
    if (id.endsWith('_bar')) continue; // Exclude duplicate bar drink variants

    // Exclude non-consumable meta/system items
    if (
      id.startsWith('TrialCard_') ||
      id.startsWith('SpringFestival') ||
      id.startsWith('Title_') ||
      id.startsWith('frag_') ||
      id.startsWith('poorlimit_') ||
      id.startsWith('fragment_') ||
      id.startsWith('Hotta_Ornament') ||
      id.startsWith('Hacker_Norn') ||
      id.startsWith('mmo_addin_') ||
      id.startsWith('item_profession') ||
      id.startsWith('Item_Gift_')
    ) {
      continue;
    }

    const nameEn = locResolver.resolve(row.ItemName, { locale: 'en' }).text || '';
    const nameRu = locResolver.resolve(row.ItemName, { locale: 'ru' }).text || '';
    const briefEn = locResolver.resolve(row.ItemBrief, { locale: 'en' }).text || '';
    const dtEn = locResolver.resolve(row.DisplayTypeText, { locale: 'en' }).text || '';
    const iconPath = row.ItemIcon?.AssetPathName || '';
    const buffs = Array.isArray(row.Buffs) ? row.Buffs : [];

    let subcategory = null;

    // 1. Shots & Syringes
    if (
      id.startsWith('Item_Jiuyu_Cooking34') ||
      id.startsWith('Item_Jiuyu_Cooking35') ||
      id.startsWith('Item_Jiuyu_Cooking36') ||
      id.startsWith('Item_Jiuyu_Cooking37') ||
      id.startsWith('Item_Jiuyu_Cooking38') ||
      id.startsWith('Item_PermanentCommonAtk') ||
      id.startsWith('Item_PermanentHealth') ||
      (iconPath.includes('Permanent_') && (briefEn === 'Medicine' || briefEn === 'Stat Booster' || nameEn.includes('Shot')))
    ) {
      subcategory = 'shots';
    }
    // 2. Guildhub Elemental Attack Mushrooms
    else if (id.startsWith('Item_Guidhub_Food_')) {
      subcategory = 'mushrooms';
    }
    // 3. Nutripastes & Combat Chews
    else if (
      id.startsWith('Item_Kailo_Cooking') &&
      (nameEn.includes('Nutripaste') || nameEn.includes('Tab') || nameEn.includes('Candy') || briefEn === 'Medicine')
    ) {
      subcategory = 'nutripastes';
    }
    // 4. Speed & Utility Potions/Dishes
    else if (
      id === 'Item_norn_ranquest_005' ||
      id === 'Item_Kailo_Cooking6' ||
      id === 'Item_Jiuyu_Cooking40' ||
      nameEn.toLowerCase().includes('parfait') ||
      buffs.some(b => b.BuffClass?.AssetPathName?.includes('Norn_Ranquest_005') || b.BuffClass?.AssetPathName?.includes('DiveSpeed'))
    ) {
      subcategory = 'utility';
    }
    // 5. Vendor Booze & Bar Drinks
    else if (
      briefEn === 'Booze' ||
      dtEn === 'Booze' ||
      id.startsWith('Item_Vera_Drinking') ||
      briefEn === 'Hangover Relief' ||
      id === 'Item_norn_ranquest_008'
    ) {
      subcategory = 'drinks';
    }
    // 6. Traditional Herbal Medicine & Pills
    else if (
      briefEn === 'Medicine' ||
      id.startsWith('Item_Jiuyu_Cooking29') ||
      id.startsWith('Item_Jiuyu_Cooking30') ||
      id.startsWith('Item_Jiuyu_Cooking31') ||
      id.startsWith('Item_Jiuyu_Cooking32') ||
      id.startsWith('Item_Jiuyu_Cooking33') ||
      id.startsWith('Item_PermanentEnergy')
    ) {
      subcategory = 'pills';
    }
    // 7. Specialty Combat Snacks (Kailo elemental patties & ganache chocolates)
    else if (id.startsWith('Item_Kailo_Cooking') && buffs.some(b => b.BuffClass?.AssetPathName?.includes('AtkFoodBase'))) {
      subcategory = 'combat_food';
    }

    if (!subcategory) continue;

    // Resolve description (Lore / background)
    let descEn = locResolver.resolve(row.Description, { locale: 'en' }).text || '';
    let descRu = locResolver.resolve(row.Description, { locale: 'ru' }).text || '';
    descEn = cleanHtmlTags(descEn);
    descRu = cleanHtmlTags(descRu);

    // Resolve use description (e.g. Restore endurance/satiety)
    let useDescEn = locResolver.resolve(row.UseDescription, { locale: 'en' }).text || '';
    let useDescRu = locResolver.resolve(row.UseDescription, { locale: 'ru' }).text || '';
    useDescEn = cleanHtmlTags(useDescEn);
    useDescRu = cleanHtmlTags(useDescRu);

    // Categories and effects resolution
    const categories = new Set<any>();
    const formattedEffectsEn = [];
    const formattedEffectsRu = [];
    const detailedBuffs = [];
    let duration = null;
    let satiety = null;
    let endurance = null;
    let speedPercent = null;
    let atkPercent = null;
    let atkFlat = null;

    // Satiety
    if (row.FakeDiamondValue) {
      const val = parseInt(row.FakeDiamondValue, 10);
      if (val > 0) satiety = val;
    }
    if (descEn.match(/restores?\s+(\d+)\s+satiety/i)) {
      satiety = parseInt(descEn.match(/restores?\s+(\d+)\s+satiety/i)[1], 10);
    }

    // Endurance from StaticToolName mapping
    if (row.StaticToolName && enduranceMap[row.StaticToolName]) {
      endurance = enduranceMap[row.StaticToolName];
    } else if (row.StaticToolName && row.StaticToolName.match(/(\d+)/) && useDescEn.match(/\{0\}/)) {
      const val = parseInt(row.StaticToolName.match(/(\d+)/)[1], 10);
      if (useDescEn.toLowerCase().includes('endurance')) endurance = val;
      if (useDescEn.toLowerCase().includes('satiety')) satiety = val;
    }

    // Speed percent from description
    if (descEn.match(/speed\s+by\s+(\d+)%/i)) {
      speedPercent = parseInt(descEn.match(/speed\s+by\s+(\d+)%/i)[1], 10);
    }

    // Resolve Buffs
    for (const b of buffs) {
      const buffRef = b.BuffClass?.AssetPathName || '';
      const leaf = buffRef.split('.').pop().replace(/_C$/, '');
      const mod = b.ModifyData || {};
      const mult = typeof mod.fStrengthMult === 'number' ? mod.fStrengthMult : 0;
      const add = typeof mod.fStrengthAdd === 'number' ? mod.fStrengthAdd : 0;
      const dur = typeof mod.fDuration === 'number' ? mod.fDuration : 0;

      if (dur > 0 && (!duration || dur > duration)) duration = dur;
      if (mult > 0 && !atkPercent && (leaf.includes('Atk') || leaf.includes('FoodBase'))) atkPercent = Math.round(mult * 100);
      if (add > 0 && !atkFlat && (leaf.includes('Atk') || leaf.includes('FoodBase'))) atkFlat = add;

      // Element Categories
      if (leaf.includes('ThunderAtk')) categories.add('ThunderAtk');
      if (leaf.includes('IceAtk')) categories.add('IceAtk');
      if (leaf.includes('FireAtk')) categories.add('FireAtk');
      if (leaf.includes('PhyAtk') || leaf.includes('CommonAtk')) categories.add('PhyAtk');
      if (leaf.includes('ThunderDef')) categories.add('ThunderDef');
      if (leaf.includes('IceDef')) categories.add('IceDef');
      if (leaf.includes('FireDef')) categories.add('FireDef');
      if (leaf.includes('PhyDef')) categories.add('PhyDef');
      if (leaf.includes('AddHealth') || leaf.includes('RecoveryHp')) categories.add('AddHealth');
      if (leaf.includes('EnergyRecover')) categories.add('AddEnergyRecover');
      if (leaf.includes('EnergyConsumeDown')) categories.add('EnergyConsumeDown');
      if (leaf.includes('DiveSpeed')) categories.add('DiveSpeed');
      if (leaf.includes('CleanBuff')) categories.add('CleanBuff');

      let bDescEn = '';
      let bDescRu = '';
      let bNameEn = '';
      let bNameRu = '';
      let bIcon = null;

      // 1. Direct resolution for elemental combat food buffs (mushrooms & nutripastes)
      if (leaf.includes('AtkFoodBase') || leaf.includes('DefFoodBase')) {
        let statEn = 'Attack';
        let statRu = 'атаку';
        if (leaf.includes('IceAtk')) { statEn = 'Frost Attack'; statRu = 'ледяную атаку'; }
        else if (leaf.includes('FireAtk')) { statEn = 'Flame Attack'; statRu = 'огненную атаку'; }
        else if (leaf.includes('ThunderAtk')) { statEn = 'Volt Attack'; statRu = 'электрическую атаку'; }
        else if (leaf.includes('PhyAtk') || leaf.includes('CommonAtk')) { statEn = 'Physical Attack'; statRu = 'физическую атаку'; }
        else if (leaf.includes('IceDef')) { statEn = 'Frost Resistance'; statRu = 'сопротивление холоду'; }
        else if (leaf.includes('FireDef')) { statEn = 'Flame Resistance'; statRu = 'сопротивление огню'; }
        else if (leaf.includes('ThunderDef')) { statEn = 'Volt Resistance'; statRu = 'сопротивление электричеству'; }
        else if (leaf.includes('PhyDef')) { statEn = 'Physical Resistance'; statRu = 'физическое сопротивление'; }

        const pct = Math.round(mult * 100);
        const durationSec = dur || duration || 900;

        if (mult > 0 && add > 0) {
          bDescEn = `Increase ${statEn} ${pct}%, ${statEn} ${add} for ${durationSec} seconds.`;
          bDescRu = `Увеличивает ${statRu} на ${pct}%, ${statRu} на ${add} на ${durationSec} сек.`;
        } else if (mult > 0) {
          bDescEn = `Increase ${statEn} ${pct}% for ${durationSec} seconds.`;
          bDescRu = `Увеличивает ${statRu} на ${pct}% на ${durationSec} сек.`;
        } else if (add > 0) {
          bDescEn = `Increase ${statEn} ${add} for ${durationSec} seconds.`;
          bDescRu = `Увеличивает ${statRu} на ${add} на ${durationSec} сек.`;
        }
      }

      // 2. Try sharedBuffs lookup (curated index) if not elemental base
      if (!bDescEn) {
        const sb = sharedBuffs[leaf] || sharedBuffs[leaf.toLowerCase()];
        if (sb && sb.desc_en && !sb.desc_en.includes('{1}')) {
          bDescEn = sb.desc_en;
          bDescRu = sb.desc_ru || sb.desc_en;
          bNameEn = sb.name_en || bNameEn;
          bNameRu = sb.name_ru || bNameRu;
          bIcon = sb.icon || bIcon;
        }
      }

      // 3. Try GameplayEffectTipsDataTable or BuffDes if still empty
      if (!bDescEn) {
        const effRow = effectTipsRows[leaf] || effectTipsRows[leaf.replace(/^buff_/i, '')];
        const effEn = effRow ? locResolver.resolve(effRow.Desc || effRow.EffectTipsDes, { locale: 'en' }).text : '';
        const effRu = effRow ? locResolver.resolve(effRow.Desc || effRow.EffectTipsDes, { locale: 'ru' }).text : '';
        const custom = resolveBuffEffect(leaf, mod, effEn, effRu);
        if (custom && custom.descEn && !custom.descEn.includes('{1}')) {
          bDescEn = custom.descEn;
          bDescRu = custom.descRu || custom.descEn;
        }
      }

      if (!bDescEn) {
        const buffDesEn = locResolver.resolve({ TableId: '/Game/Resources/Text/BuffDes.BuffDes', Key: leaf + '_des' }, { locale: 'en' }).text;
        const buffDesRu = locResolver.resolve({ TableId: '/Game/Resources/Text/BuffDes.BuffDes', Key: leaf + '_des' }, { locale: 'ru' }).text;
        if (buffDesEn && !buffDesEn.includes('{1}')) {
          bDescEn = buffDesEn;
          bDescRu = buffDesRu || buffDesEn;
        }
      }

      if (bDescEn) {
        detailedBuffs.push({
          buff_id: leaf,
          name_en: bNameEn || nameEn,
          name_ru: bNameRu || nameRu || bNameEn || nameEn,
          description_en: bDescEn,
          description_ru: bDescRu || bDescEn,
          icon: bIcon
        });

        // Infer duration if not already set
        if (!duration) {
          const mSec = bDescEn.match(/for\s+(\d+)\s+seconds/i);
          if (mSec) duration = parseInt(mSec[1], 10);
          const mDays = bDescEn.match(/for\s+(\d+)\s+days/i);
          if (mDays) duration = parseInt(mDays[1], 10) * 86400;
        }
        if (bDescEn.includes('speed by')) {
          categories.add('DiveSpeed');
          const mSpeed = bDescEn.match(/speed\s+by\s+(\d+)%/i);
          if (mSpeed && !speedPercent) speedPercent = parseInt(mSpeed[1], 10);
        }
        if (bDescEn.toLowerCase().includes('frost atk') || bDescEn.toLowerCase().includes('ice atk')) categories.add('IceAtk');
        if (bDescEn.toLowerCase().includes('volt atk') || bDescEn.toLowerCase().includes('thunder atk')) categories.add('ThunderAtk');
        if (bDescEn.toLowerCase().includes('flame atk') || bDescEn.toLowerCase().includes('fire atk')) categories.add('FireAtk');
        if (bDescEn.toLowerCase().includes('physical atk')) categories.add('PhyAtk');

        if (leaf.includes('Atk') || bDescEn.toLowerCase().includes('atk') || bDescEn.toLowerCase().includes('attack')) {
          const mAtk = bDescEn.match(/(?:atk|attack)\s*(?:by\s*)?(\d+)%/i) || bDescEn.match(/(\d+)%\s*(?:atk|attack)/i);
          if (mAtk && !atkPercent) atkPercent = parseInt(mAtk[1], 10);
        }
      }
    }

    if (satiety) {
      formattedEffectsEn.push(`Restores ${satiety} Satiety.`);
      formattedEffectsRu.push(`Восстанавливает ${satiety} сытости.`);
      categories.add('AddSatiety');
    }
    if (endurance) {
      formattedEffectsEn.push(`Restores ${endurance} Endurance.`);
      formattedEffectsRu.push(`Восстанавливает ${endurance} выносливости.`);
      categories.add('AddEnergyRecover');
    }

    // Add detailed buffs to formatted effects
    for (const db of detailedBuffs) {
      if (!formattedEffectsEn.includes(db.description_en)) {
        formattedEffectsEn.push(db.description_en);
        formattedEffectsRu.push(db.description_ru);
      }
    }

    // Duration text
    let durationTextEn = '';
    let durationTextRu = '';
    if (duration) {
      if (duration >= 86400) {
        const days = Math.round(duration / 86400);
        durationTextEn = `${days} days`;
        durationTextRu = `${days} дн.`;
      } else if (duration >= 60) {
        const mins = Math.round(duration / 60);
        durationTextEn = `${duration}s (${mins}m)`;
        durationTextRu = `${duration} сек. (${mins} мин.)`;
      } else {
        durationTextEn = `${duration}s`;
        durationTextRu = `${duration} сек.`;
      }
    }

    const rarity = mapQuality(row.ItemQuality || row.Quality || 1);

    // Guaranteed clean Latin name
    let cleanNameEn = nameEn;
    if (!cleanNameEn || hasCyrillic(cleanNameEn) || hasCjk(cleanNameEn)) {
      cleanNameEn = id.replace(/^(Item_|Item_Kailo_|Item_Jiuyu_)/i, '').replace(/_/g, ' ');
    }

    potions.push({
      id,
      name_en: cleanNameEn,
      name_ru: nameRu || cleanNameEn,
      rarity,
      quality: rarity === 'SSR' ? 5 : rarity === 'SR' ? 4 : rarity === 'R' ? 3 : 2,
      subcategory,
      icon: resolveMedia(iconPath)?.url || '/datamine/favicon.svg',
      duration,
      duration_text_en: durationTextEn,
      duration_text_ru: durationTextRu,
      categories: Array.from(categories),
      satiety,
      endurance,
      speed_percent: speedPercent,
      atk_percent: atkPercent,
      atk_flat: atkFlat,
      formatted_effects_en: formattedEffectsEn,
      formatted_effects_ru: formattedEffectsRu,
      description_en: descEn,
      description_ru: descRu || descEn,
      buffs: detailedBuffs
    });
  }

  return potions;
}

if (require.main === module) {
  try {
    const result = buildFoodDataset();
    console.log(`[build-food] Successfully generated food (${result.food.length}), ingredients (${result.ingredients.length}), potions (${result.potions.length})`);
  } catch (err) {
    console.error('[build-food] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildFoodDataset,
  extractPotions,
  mapQuality,
  cleanName,
  hasCyrillic,
  AUTHENTIC_ATTRIBUTE_ICONS,
  deployAttributeIcons,
};
