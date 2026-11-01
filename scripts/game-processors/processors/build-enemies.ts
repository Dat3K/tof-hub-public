import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-enemies] Error reading JSON at ${filePath}:`, e.message);
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

import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';

function normalizeElement(row) {
  if (!row) return '';
  const phy = Number(row.PhyDefBase) || Number(row.PhyDef) || 0;
  const fire = Number(row.FireDefBase) || Number(row.FireDef) || 0;
  const ice = Number(row.IceDefBase) || Number(row.IceDef) || 0;
  const thunder = Number(row.ThunderDefBase) || Number(row.ThunderDef) || 0;
  const superP = Number(row.SuperpowerDefBase) || Number(row.SuperpowerDef) || 0;

  if (fire > phy && fire >= ice && fire >= thunder) return 'Fire';
  if (ice > phy && ice >= fire && ice >= thunder) return 'Ice';
  if (thunder > phy && thunder >= fire && thunder >= ice) return 'Thunder';
  if (superP > phy) return 'SuperPower';
  if (phy > 0 || row.PhyDefBase !== undefined || row.PhyDef !== undefined) return 'Physical';
  return '';
}

function extractNumber(str) {
  if (!str) return null;
  const match = String(str).match(/(\d+)/);
  return match ? match[1] : null;
}

function normalizeEnemyImageRef(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    for (const key of [
      'AssetPathName',
      'sourceAssetRef',
      'lineupPortrait',
      'detailImage',
      'image',
      'publicUrl',
      'fullUrl',
      'full',
      'normalizedPackagePath'
    ]) {
      const normalized = normalizeEnemyImageRef(value[key]);
      if (normalized) return normalized;
    }
    return '';
  }

  let normalized = String(value).trim().replace(/\\/g, '/');
  if (!normalized || normalized === 'None') return '';
  if (/^\/?Game\//i.test(normalized)) {
    normalized = `/datamine/shared/media/Hotta/Content/${normalized.replace(/^\/?Game\//i, '')}`;
    normalized = normalized.replace(/\.[^/.]+$/i, '');
  } else if (/^Hotta\/Content\//i.test(normalized)) {
    normalized = `/datamine/shared/media/${normalized}`;
  }
  if (/^\/datamine\/shared\/media\//i.test(normalized) && !/\.(?:png|webp)$/i.test(normalized)) {
    normalized += '.webp';
  }
  return normalized.replace(/\.png$/i, '.webp');
}

function resolveEnemyImages(codename, curatedMap, availableFiles, row: Record<string, any> = {}) {
  const clean = codename.replace(/^OriginWar_/i, '').replace(/_C$/i, '').replace(/^BP_/i, '');
  const cleanLower = clean.toLowerCase();
  const rawNum = extractNumber(clean);
  const num3 = rawNum ? rawNum.padStart(3, '0') : null;
  const num2 = rawNum ? rawNum.padStart(2, '0') : null;
  const isBoss = /boss/i.test(clean);

  const images = {
    portrait: '',
    big: '',
    photo: '',
    icon: ''
  };

  // 1. Check direct config *Image fields in the row if present
  if (row.BossImage) images.portrait = normalizeEnemyImageRef(row.BossImage);
  if (row.boss_image) images.portrait = normalizeEnemyImageRef(row.boss_image);
  if (row.PortraitImage) images.portrait = normalizeEnemyImageRef(row.PortraitImage);
  if (row.IconImage) images.icon = normalizeEnemyImageRef(row.IconImage);

  // 2. Check curated mapping
  if (curatedMap) {
    if (curatedMap[codename]) images.portrait = normalizeEnemyImageRef(curatedMap[codename]);
    else if (curatedMap[clean]) images.portrait = normalizeEnemyImageRef(curatedMap[clean]);
    else if (curatedMap[cleanLower]) images.portrait = normalizeEnemyImageRef(curatedMap[cleanLower]);
    else if (rawNum && curatedMap[rawNum]) images.portrait = normalizeEnemyImageRef(curatedMap[rawNum]);
    else if (num3 && curatedMap[num3]) images.portrait = normalizeEnemyImageRef(curatedMap[num3]);
  }

  // 3. Scan available image assets across exported UI folders
  for (const file of availableFiles) {
    const fileLower = file.toLowerCase();
    const leaf = path.basename(fileLower, path.extname(fileLower));
    const assetRel = `/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/${path.basename(file, path.extname(file))}.webp`;

    // Exact or direct match
    if (leaf === cleanLower || leaf === `tx_${cleanLower}` || leaf === `boss_${cleanLower}` || (rawNum && leaf === rawNum)) {
      if (!images.portrait) images.portrait = assetRel;
    }

    // Number-based pattern matching
    if (rawNum) {
      if (isBoss) {
        if (
          leaf === `boss_hum_${num3}` ||
          leaf === `boss_hum_${rawNum}` ||
          leaf === `tx_boss_hum_${num3}` ||
          leaf === `boss_${num3}` ||
          leaf === `boss_${rawNum}` ||
          leaf === `boss0${num2}` ||
          leaf === `bigboss_${rawNum}` ||
          leaf === `bigboss${num3}` ||
          leaf === `bigboss0${num2}` ||
          leaf === `gve_bigboss_${rawNum}` ||
          leaf === rawNum
        ) {
          if (!images.portrait) images.portrait = assetRel;
        }
        if (
          leaf === `boss_hum_${num3}_dt` ||
          leaf === `boss_hum_${num3}_shtt_dt` ||
          leaf === `bigboss_${num3}` ||
          leaf === `bigboss_${rawNum}` ||
          leaf === `bigboss${num3}` ||
          leaf === `boss_hum_${rawNum}_dt`
        ) {
          if (!images.big) images.big = assetRel;
        }
        if (
          leaf === `boss_gve_touxiang_${num3}` ||
          leaf === `boss_gve_touxiang_${num2}` ||
          leaf === `boss_gve_touxiang_${rawNum}` ||
          leaf === `monsterphoto_${num3}` ||
          leaf === `monsterphoto_${rawNum}`
        ) {
          if (!images.photo) images.photo = assetRel;
        }
        if (
          leaf === `boss_${rawNum}_yuan` ||
          leaf === `boss_${num3}_yuan` ||
          leaf === `ui_boss_${rawNum}` ||
          leaf === `ui_boss_${num3}`
        ) {
          if (!images.icon) images.icon = assetRel;
        }
      } else {
        if (leaf === `mon_hum_${num3}` || leaf === `mon_hum_${rawNum}` || leaf === `tx_mon_hum_${num3}` || leaf === rawNum) {
          if (!images.portrait) images.portrait = assetRel;
        }
        if (leaf === `mon_hum_${num3}_shtt_dt` || leaf === `mon_hum_${num3}_xg_shtt_dt` || leaf === `mon_hum_${rawNum}_shtt_dt`) {
          if (!images.big) images.big = assetRel;
        }
      }
    }
  }

  // Cross-variant fallbacks so that if any image is found, portrait/big/photo/icon are filled
  if (!images.portrait && images.big) images.portrait = images.big;
  if (!images.portrait && images.photo) images.portrait = images.photo;
  if (!images.portrait && images.icon) images.portrait = images.icon;
  if (!images.big && images.portrait) images.big = images.portrait;
  if (!images.photo && images.portrait) images.photo = images.portrait;
  if (!images.icon && images.portrait) images.icon = images.portrait;

  return images;
}

function resolveEnemyName(codename, row, locResolver) {
  const clean = codename.replace(/^OriginWar_/i, '').replace(/_C$/i, '').replace(/^BP_/i, '');
  const candidates = [
    codename,
    clean,
    `actorname_${clean.toLowerCase()}`,
    `monster_${clean.toLowerCase()}`,
    `boss_${clean.toLowerCase()}`,
    `npc_${clean.toLowerCase()}`
  ];

  let nameResEn = null;
  let nameResRu = null;

  for (const c of candidates) {
    const resEn = locResolver.resolve(c, { locale: 'en', defaultNamespace: 'actorname' });
    if (resEn.status === 'resolved' || resEn.status === 'case_insensitive_match') {
      nameResEn = resEn;
      break;
    }
  }
  for (const c of candidates) {
    const resRu = locResolver.resolve(c, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'actorname' });
    if (resRu.status === 'resolved' || resRu.status === 'case_insensitive_match') {
      nameResRu = resRu;
      break;
    }
  }

  if (!nameResEn) {
    nameResEn = locResolver.resolve(row.ActorName || codename, { locale: 'en', defaultNamespace: 'actorname', fallbackCodename: codename, fallbackSourceRow: row });
  }
  if (!nameResRu) {
    nameResRu = locResolver.resolve(row.ActorName || codename, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'actorname', fallbackCodename: codename, fallbackSourceRow: row });
  }

  const nameEn = nameResEn.text || codename;
  const nameRu = nameResRu.text || nameEn;

  return { nameEn, nameRu, originalName: nameResEn.originalGameName };
}

function buildEnemiesDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const stageDatamineDir = path.join(projectRoot, 'datamine');

  const standardPath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/DT_MonsterStaticData_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/DT_MonsterStaticData_Overseas.json',
    'DT_MonsterStaticData_Overseas.json'
  ]) || path.join(projectRoot, 'datamine/seq/data/DT_MonsterStaticData_Overseas.json');

  const mmoPath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/DT_MonsterStaticData_MMO.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_MonsterStaticData_MMO.json',
    'DT_MonsterStaticData_MMO.json'
  ]);

  const locEnRaw = findFile(rawDir, ['Hotta/Content/Localization/Game/en/Game.json', 'Game/en/Game.json']);
  const locRuRaw = findFile(rawDir, ['Hotta/Content/Localization/Game/ru/Game.json', 'Game/ru/Game.json']);

  const actorEnRaw = findFile(rawDir, [
    'Hotta/Content/Resources/Text/Oversea/ST_actorname_Oversea.json',
    'Hotta/Content/Resources/Text/ST_actorname.json'
  ]);
  const actorRuRaw = findFile(rawDir, [
    'Hotta/Content/Resources/Text/Oversea/ST_actorname_Oversea_ru.json',
    'Hotta/Content/Resources/Text/ST_actorname_ru.json'
  ]);

  const locResolver = createLocalizationResolver();
  if (locEnRaw) locResolver.loadLocale('en', readJsonFile(locEnRaw));
  if (locRuRaw) locResolver.loadLocale('ru', readJsonFile(locRuRaw));
  if (actorEnRaw) locResolver.loadLocale('en', readJsonFile(actorEnRaw));
  if (actorRuRaw) locResolver.loadLocale('ru', readJsonFile(actorRuRaw));

  const candidateCuratedPaths = [
    path.join(projectRoot, 'scripts/monster-image-mapping.json'),
    path.join(projectRoot, 'tof-fast-datamine/core/monster-image-mapping.json'),
    path.join(__dirname, 'monster-image-mapping.json'),
    path.join(__dirname, '../../scripts/monster-image-mapping.json')
  ];

  let curatedMap: Record<string, any> = {};
  for (const cPath of candidateCuratedPaths) {
    if (fs.existsSync(cPath)) {
      curatedMap = readJsonFile(cPath) || {};
      break;
    }
  }

  // Find available monster images
  const monsterAssetsDir = path.join(stageDatamineDir, 'shared/media/Hotta/Content/Resources/UI/void/boss');
  const availableFiles = fs.existsSync(monsterAssetsDir)
    ? fs.readdirSync(monsterAssetsDir).filter((f) => f.endsWith('.webp') && !f.endsWith('.thumb.webp'))
    : [];

  const standardData = standardPath ? readJsonFile(standardPath) : null;
  const mmoData = mmoPath ? readJsonFile(mmoPath) : null;

  const result: Record<string, any> = {};

  function processRows(monsterData, server) {
    if (!monsterData) return;
    const rows = Array.isArray(monsterData) && monsterData[0] && monsterData[0].Rows
      ? monsterData[0].Rows
      : (monsterData.Rows || monsterData);

    if (!rows || typeof rows !== 'object') return;

    for (const [codename, row] of Object.entries(rows)) {
      if (!row || typeof row !== 'object') continue;

      const cleanKey = server === 'mmo' && result[codename] ? `${codename}_mmo` : codename;
      const { nameEn, nameRu, originalName } = resolveEnemyName(codename, row, locResolver);

      const hp = Number(row.MaxHealth) || 0;
      const atk = Number(row.CommonAtkBase) || Number(row.CommonATK) || 0;
      const crit = Number(row.Crit) || 0;
      const def = Number(row.PhyDefBase) || Number(row.PhyDef) || Number(row.Def) || 0;

      const buffs = [];
      if (row.MonsterBuffID) buffs.push(String(row.MonsterBuffID));

      const element = normalizeElement(row);
      const images = resolveEnemyImages(codename, curatedMap, availableFiles, row);

      result[cleanKey] = {
        codename,
        server,
        name_en: nameEn,
        name_ru: nameRu,
        original_name: originalName,
        element,
        stats: { hp, atk, crit, def },
        buffs,
        images
      };
    }
  }

  processRows(standardData, 'standard');
  processRows(mmoData, 'mmo');

  const outDir = path.join(stageDatamineDir, 'shared-data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'enemies.json');
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');

  console.log(`[build-enemies] Built ${Object.keys(result).length} enemies into ${outFile}`);
  return result;
}

if (require.main === module) {
  try {
    buildEnemiesDataset();
  } catch (err) {
    console.error('[build-enemies] Failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildEnemiesDataset,
  resolveEnemyImages,
  normalizeEnemyImageRef,
  resolveEnemyName,
  normalizeElement,
};

