import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-buffs] Error reading JSON at ${filePath}:`, e.message);
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
import { toCanonicalMediaUrl } from './canonical-media-library';

function extractIconPath(assetRef) {
  if (!assetRef) return '';
  const refStr = typeof assetRef === 'object' ? (assetRef.AssetPathName || '') : String(assetRef);
  if (!refStr || refStr === 'None') return '';

  return toCanonicalMediaUrl(refStr);
}

function scanBuffModifiers(rawDir) {
  const modifiersMap: Record<string, any> = {};
  if (!rawDir || !fs.existsSync(rawDir)) return modifiersMap;

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Only scan relevant Ability/Buff folders to stay fast
          if (/buff|ability|gameplayeffect|colosseum/i.test(entry.name) || dir.includes('Buff') || dir.includes('Ability')) {
            walk(full);
          }
        } else if (entry.isFile() && entry.name.startsWith('Buff_') && entry.name.endsWith('.json')) {
          try {
            const data = readJsonFile(full);
            if (!data || !Array.isArray(data)) continue;

            const buffId = path.basename(entry.name, '.json');
            const mods = [];

            for (const item of data) {
              const itemMods = item?.Properties?.Modifiers || item?.Modifiers;
              if (Array.isArray(itemMods)) {
                for (const mod of itemMods) {
                  const attrName = mod.Attribute?.AttributeName || mod.Attribute?.Path?.[0] || '';
                  const op = mod.ModifierOp ? String(mod.ModifierOp).replace(/^EGameplayModOp::/i, '') : 'Additive';
                  const val = Number(mod.ModifierMagnitude?.ScalableFloatMagnitude?.Value ?? mod.Magnitude?.Value ?? 0);
                  const curveRow = mod.Magnitude?.Curve?.RowName;
                  const curve = curveRow && curveRow !== 'None' ? String(curveRow) : '';

                  if (attrName || val !== 0 || curve) {
                    mods.push({ attr: attrName, op, value: val, curve });
                  }
                }
              }
            }

            if (mods.length > 0) {
              modifiersMap[buffId] = mods;
            }
          } catch (e) {
            // Ignore single file parse errors
          }
        }
      }
    } catch (e) {
      // Ignore scan permission or directory read errors
    }
  }

  walk(rawDir);
  return modifiersMap;
}

function buildBuffsDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const stageDatamineDir = path.join(projectRoot, 'datamine');

  const tipsOverseas = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/GameplayEffectTipsDataTable_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable_Overseas.json',
    'GameplayEffectTipsDataTable_Overseas.json'
  ]);

  const tipsMmo = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/GameplayEffectTipsDataTable_MMO.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/GameplayEffectTipsDataTable_MMO.json',
    'GameplayEffectTipsDataTable_MMO.json'
  ]);

  const tipsStandard = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable.json',
    'GameplayEffectTipsDataTable.json'
  ]);

  const locEnRaw = findFile(rawDir, ['Hotta/Content/Localization/Game/en/Game.json', 'Game/en/Game.json']);
  const locRuRaw = findFile(rawDir, ['Hotta/Content/Localization/Game/ru/Game.json', 'Game/ru/Game.json']);

  const locResolver = createLocalizationResolver();
  if (locEnRaw) locResolver.loadLocale('en', readJsonFile(locEnRaw));
  if (locRuRaw) locResolver.loadLocale('ru', readJsonFile(locRuRaw));

  const imageCopier = new ImageCopier(rawDir, projectRoot);
  const modifiersMap = scanBuffModifiers(rawDir);

  const result: Record<string, any> = {};

  function processTipsTable(filePath) {
    if (!filePath) return;
    const data = readJsonFile(filePath);
    if (!data) return;

    const rows = Array.isArray(data) && data[0] && data[0].Rows
      ? data[0].Rows
      : (data.Rows || data);

    if (!rows || typeof rows !== 'object') return;

    for (const [buffId, row] of Object.entries(rows)) {
      if (!row || typeof row !== 'object') continue;

      const nameResEn = locResolver.resolve(row.Name, { locale: 'en', defaultNamespace: 'GameplayEffectTips', fallbackCodename: buffId, fallbackSourceRow: row });
      const nameResRu = locResolver.resolve(row.Name, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'GameplayEffectTips', fallbackCodename: buffId, fallbackSourceRow: row });
      const nameEn = cleanHtmlTags(nameResEn.text || buffId);
      const nameRu = cleanHtmlTags(nameResRu.text || nameEn);

      const descResEn = locResolver.resolve(row.Desc, { locale: 'en', defaultNamespace: 'GameplayEffectTips', fallbackSourceRow: row });
      const descResRu = locResolver.resolve(row.Desc, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'GameplayEffectTips', fallbackSourceRow: row });
      const descEn = cleanHtmlTags(descResEn.text || '');
      const descRu = cleanHtmlTags(descResRu.text || descEn);

      let icon = null;
      if (row.Icon && row.Icon !== 'None') {
        const rawIcon = typeof row.Icon === 'object' ? (row.Icon.AssetPathName || '') : String(row.Icon);
        if (rawIcon && rawIcon !== 'None') {
          const copied = imageCopier.copyAsset('buffs', rawIcon, 'icons');
          if (copied) {
            icon = copied;
          } else {
            const canonicalUrl = toCanonicalMediaUrl(rawIcon);
            const diskRel = canonicalUrl.replace(/^\//, '');
            if (fs.existsSync(path.join(projectRoot, diskRel))) {
              icon = canonicalUrl;
            }
          }
        }
      }
      const modifiers = modifiersMap[buffId] || [];

      result[buffId] = {
        name_en: nameEn,
        name_ru: nameRu,
        original_name: nameResEn.originalGameName,
        desc_en: descEn,
        desc_ru: descRu,
        icon,
        modifiers
      };
    }
  }

  // Process standard first, then overseas and MMO
  processTipsTable(tipsStandard);
  processTipsTable(tipsOverseas);
  processTipsTable(tipsMmo);

  const outDir = path.join(stageDatamineDir, 'shared-data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'buffs.json');
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');

  console.log(`[build-buffs] Built ${Object.keys(result).length} buffs into ${outFile}`);
  return result;
}

if (require.main === module) {
  try {
    buildBuffsDataset();
  } catch (err) {
    console.error('[build-buffs] Failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildBuffsDataset,
  cleanHtmlTags,
  extractIconPath,
};
