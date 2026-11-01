import { readGameSourceFileSync, projectsCjkCulture } from './game-source-reader';
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
    console.error(`[build-relics] Error reading JSON at ${filePath}:`, e.message);
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

function extractCanonicalRelicIdentity(artifactId) {
  if (!artifactId) return { canonicalId: '', modeContext: 'base', labelEn: 'Standard', labelRu: 'Стандартный' };
  const id = String(artifactId).trim();

  let baseId = id;
  let modeContext = 'base';
  let labelEn = 'Standard';
  let labelRu = 'Стандартный';

  if (/^wormhole_/i.test(id)) {
    modeContext = 'wormhole';
    labelEn = 'Wormhole';
    labelRu = 'Червоточина';
    baseId = id.replace(/^wormhole_/i, '');
  } else if (/^breakfate_/i.test(id)) {
    modeContext = 'breakfate';
    labelEn = 'Break Fate';
    labelRu = 'Преодоление судьбы';
    baseId = id.replace(/^breakfate_/i, '');
  }

  const suffixMatch = baseId.match(/^(artifact_(?:ssr|sr|n)_\d+)(?:_([A-Za-z0-9_]+)|S_([A-Za-z0-9_]+))$/i);
  if (suffixMatch) {
    const rawSuffix = suffixMatch[2] || suffixMatch[3] || '';
    const cleanSuffix = rawSuffix.toUpperCase();
    if (modeContext === 'base') {
      modeContext = cleanSuffix.toLowerCase();
      labelEn = cleanSuffix;
      labelRu = cleanSuffix;
      if (cleanSuffix === 'DWSK') {
        labelEn = 'Apex / DWSK';
        labelRu = 'Вершина / DWSK';
      } else if (cleanSuffix.includes('WXM')) {
        labelEn = 'Activity / WXM';
        labelRu = 'Активность / WXM';
      }
    }
    baseId = suffixMatch[1];
  }

  return {
    canonicalId: baseId,
    modeContext,
    labelEn,
    labelRu
  };
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

function mapProperty(rawProp) {
  if (!rawProp) return 'Attack';
  const p = String(rawProp).replace(/^EArtifactProperty::/i, '');
  if (/attack/i.test(p)) return 'Attack';
  if (/defen/i.test(p)) return 'Defense';
  if (/survive/i.test(p)) return 'Survive';
  if (/assist/i.test(p)) return 'Assist';
  if (/function/i.test(p)) return 'Function';
  return p || 'Attack';
}

function loadArtifactEffectFigures(rawDir) {
  const map: Record<string, any> = {};
  if (!rawDir || !fs.existsSync(rawDir)) return map;

  const targetDirs = [
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable/EffectFigure'),
    path.join(rawDir, 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/EffectFigure'),
    path.join(rawDir, 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/EffectFigure_Oversea'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure/Artifact'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/Artifact_Balance'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable/Artifact'),
    path.join(rawDir, 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Artifact')
  ];

  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          const lowerName = entry.name.toLowerCase();
          if (lowerName.includes('effectfigure') || lowerName.includes('artifact')) {
            const data = readJsonFile(full);
            if (!data) continue;
            const rows = Array.isArray(data) && data[0]?.Rows ? data[0].Rows : (data.Rows || (typeof data === 'object' ? data : null));
            if (rows && typeof rows === 'object') {
              const baseName = path.basename(entry.name, '.json').toLowerCase();
              const numbers: Record<string, any> = {};
              for (const [rKey, rVal] of Object.entries(rows)) {
                if (Array.isArray(rVal?.Keys) && rVal.Keys.length > 0) {
                  const v = Number(rVal.Keys[0].Value ?? 0);
                  numbers[rKey] = Math.round(v * 10000) / 10000;
                } else if (typeof rVal === 'number') {
                  numbers[rKey] = Math.round(rVal * 10000) / 10000;
                }
              }
              if (Object.keys(numbers).length > 0) {
                map[baseName] = numbers;
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore scan permission errors
    }
  }

  for (const d of targetDirs) {
    scan(d);
  }
  return map;
}

function resolveRelicAbilityDescription(locResolver, row, artifactId, locale, isMmo = false) {
  // 1. For standard/gacha, prioritize UseDescription (active combat ability description)
  if (!isMmo) {
    if (row.UseDescription && (row.UseDescription.Key || row.UseDescription.SourceString)) {
      const res = locResolver.resolve(row.UseDescription, { locale, defaultNamespace: 'SkillDes' });
      if (res.text && (projectsCjkCulture() || !res.text.match(/^[\u4e00-\u9fa5]/))) {
        return res.text;
      }
    }
  }

  // 2. Candidate keys
  const candidates = [];
  const numMatch = artifactId.match(/(\d+)/);
  const numDigits = numMatch ? numMatch[1] : '';
  const isSsr = artifactId.includes('ssr');
  const isSr = artifactId.includes('sr');
  const isR = artifactId.includes('r_') || artifactId.startsWith('artifact_r') || artifactId.startsWith('artifact_n');
  const prefix = isSsr ? 'SSR' : (isSr ? 'SR' : (isR ? 'R' : ''));

  const assetPath = row?.InitialSkill?.SkillTemplate?.AssetPathName || '';
  const match = assetPath.match(/([^\/\.]+)\.[^\/\.]+$/);
  const skillName = match ? match[1] : '';

  if (isMmo) {
    if (skillName) {
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `${skillName}_des_Balance` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `${skillName.replace(/_Balance$/i, '')}_des_Balance` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `${skillName}_des` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: skillName });
      candidates.push({ TableId: 'SkillDes', Key: `${skillName}_des_Balance` });
      candidates.push({ TableId: 'SkillDes', Key: `${skillName.replace(/_Balance$/i, '')}_des_Balance` });
    }

    if (numDigits && prefix) {
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_Artifact_${prefix}_${numDigits}_des_Balance` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_ARTIFACT_${prefix}_${numDigits}_des_Balance` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_Spawn_Artifact_${prefix}_${numDigits}_des_Balance` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_Artifact_${prefix}_${numDigits}_des` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_Artifact_${prefix}${numDigits}_des_Balance` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_Artifact_${prefix}${numDigits}_des` });
      candidates.push({ TableId: 'SkillDes', Key: `GA_Artifact_${prefix}_${numDigits}_des_Balance` });
      candidates.push({ TableId: 'SkillDes', Key: `GA_Spawn_Artifact_${prefix}_${numDigits}_des_Balance` });
    }

    if (row.UseDescription && row.UseDescription.Key) {
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: `${row.UseDescription.Key}_Balance` });
      candidates.push({ TableId: 'ArtifactDes_Balance', Key: row.UseDescription.Key });
      candidates.push({ TableId: 'SkillDes', Key: `${row.UseDescription.Key}_Balance` });
    }

    candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_${artifactId.toUpperCase()}_des_Balance` });
    candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_${artifactId}_des_Balance` });
    candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_${artifactId.toUpperCase()}_des` });
    candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_${artifactId}_des` });
    candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_${artifactId.toUpperCase()}` });
    candidates.push({ TableId: 'ArtifactDes_Balance', Key: `GA_${artifactId}` });
    candidates.push({ TableId: 'GameplayEffectTipsDataTable_Balance', Key: `Buff_${artifactId.toUpperCase()}_des_Balance` });
    candidates.push({ TableId: 'GameplayEffectTipsDataTable_Balance', Key: `Buff_${artifactId}_Balance` });
  }

  if (skillName) {
    candidates.push({ TableId: 'SkillDes', Key: `${skillName}_des` });
    candidates.push({ TableId: 'SkillDes', Key: skillName });
  }

  if (numDigits && prefix) {
    candidates.push({ TableId: 'SkillDes', Key: `GA_Artifact_${prefix}_${numDigits}_des` });
    candidates.push({ TableId: 'SkillDes', Key: `GA_Artifact_${prefix}${numDigits}_des` });
  }

  if (row.UseDescription && row.UseDescription.Key) {
    candidates.push({ TableId: 'SkillDes', Key: row.UseDescription.Key });
  }

  candidates.push({ TableId: isMmo ? 'ArtifactDes_Balance' : 'SkillDes', Key: `GA_${artifactId.toUpperCase()}_des` });
  candidates.push({ TableId: isMmo ? 'ArtifactDes_Balance' : 'SkillDes', Key: `GA_${artifactId.toUpperCase()}` });
  candidates.push({ TableId: isMmo ? 'ArtifactDes_Balance' : 'SkillDes', Key: `GA_${artifactId}_des` });
  candidates.push({ TableId: isMmo ? 'ArtifactDes_Balance' : 'SkillDes', Key: `GA_${artifactId}` });

  for (const c of candidates) {
    const res = locResolver.resolve(c, { locale, defaultNamespace: isMmo ? 'ArtifactDes_Balance' : 'SkillDes' });
    if (res.text && (projectsCjkCulture() || !res.text.match(/^[\u4e00-\u9fa5]/))) {
      return res.text;
    }
  }

  // 3. Fallback to UseDescription
  if (row.UseDescription && (row.UseDescription.Key || row.UseDescription.SourceString)) {
    const res = locResolver.resolve(row.UseDescription, { locale, defaultNamespace: isMmo ? 'ArtifactDes_Balance' : 'SkillDes' });
    if (res.text && (projectsCjkCulture() || !res.text.match(/^[\u4e00-\u9fa5]/))) {
      return res.text;
    }
  }

  // 4. Fallback to Description (lore text) if valid and not Chinese
  if (row.Description && (row.Description.Key || row.Description.SourceString)) {
    const res = locResolver.resolve(row.Description, { locale, defaultNamespace: 'ST_Item' });
    if (res.text && (projectsCjkCulture() || !res.text.match(/^[\u4e00-\u9fa5]/))) {
      return res.text;
    }
  }

  // 5. Fallback to ArtifactPropertyDescText if valid and not Chinese
  if (row.ArtifactPropertyDescText && (row.ArtifactPropertyDescText.Key || row.ArtifactPropertyDescText.SourceString)) {
    const res = locResolver.resolve(row.ArtifactPropertyDescText, { locale, defaultNamespace: 'ST_Item' });
    if (res.text && (projectsCjkCulture() || !res.text.match(/^[\u4e00-\u9fa5]/))) {
      return res.text;
    }
  }

  return '';
}

function resolveRelicFlavorDescription(locResolver, row, locale) {
  if (row.Description && (row.Description.Key || row.Description.SourceString)) {
    const res = locResolver.resolve(row.Description, { locale, defaultNamespace: 'ST_Item' });
    if (res.text && (projectsCjkCulture() || !res.text.match(/^[\u4e00-\u9fa5]/))) {
      return res.text;
    }
  }
  return '';
}

function extractCooldown(id, row, descEn, efNumbers, isMmo = false) {
  if (efNumbers) {
    // 1. Level 0 / Lv0 exact cooldown
    for (const [k, v] of Object.entries(efNumbers)) {
      if (/(?:level0|lv0|l0).*?(?:cd|cooldown)|(?:cd|cooldown).*?(?:level0|lv0|l0)/i.test(k) && typeof v === 'number' && v > 0) {
        return v;
      }
    }
    // 2. Base cooldown without higher levels or other attributes
    for (const [k, v] of Object.entries(efNumbers)) {
      if (/(?:cooldown|maincd)/i.test(k) && !/(?:level[1-9]|lv[1-9]|l[1-9]|sc[1-9]|cutdown|buff|stun)/i.test(k) && typeof v === 'number' && v > 0) {
        return v;
      }
    }
  }

  if (descEn) {
    const m = descEn.match(/Cooldown:\s*(\d+(?:\.\d+)?)\s*s/i) || descEn.match(/(\d+)-second cooldown/i);
    if (m) return parseFloat(m[1]);
  }

  if (row.iShowArtifactCd && Number(row.iShowArtifactCd) > 0) return Number(row.iShowArtifactCd);
  if (row.ColdDown && Number(row.ColdDown) > 0) return Number(row.ColdDown);

  if (row.UseDescription?.SourceString) {
    const m = row.UseDescription.SourceString.match(/冷却(?:时间)?(?:为)?<shuzhi>(\d+)<\/?>秒|冷却(\d+)秒/);
    if (m) return parseInt(m[1] || m[2], 10);
  }

  return undefined;
}

function buildRelicsDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'info', 'relics', 'data');
  const targetDirs = [outDir];
  const imageCopier = new ImageCopier(rawDir, projectRoot);

  console.log(`[build-relics] Project root: ${projectRoot}`);
  console.log(`[build-relics] Raw data dir: ${rawDir}`);

  // Locate source tables
  const overseasTablePath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Artifact/ArtifactDataTable_Overseas.json',
    'ArtifactDataTable_Overseas.json'
  ]);

  const standardTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Artifact/ArtifactDataTable.json',
    'ArtifactDataTable.json'
  ]);

  const newArtifactTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Artifact/NewArtifactDataTable.json',
    'NewArtifactDataTable.json'
  ]);

  const advanceTablePath = findFile(rawDir, [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Artifact/ArtifactAdvanceAttributeDataTable_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Artifact/ArtifactAdvanceAttributeDataTable.json',
    'ArtifactAdvanceAttributeDataTable_Overseas.json',
    'ArtifactAdvanceAttributeDataTable.json'
  ]);

  const balanceTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/Artifact_Balance/ArtifactDataTable_Balance.json',
    'ArtifactDataTable_Balance.json'
  ]);

  const balanceAdvanceTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/Artifact_Balance/ArtifactAdvanceAttributeDataTable_Balance.json',
    'ArtifactAdvanceAttributeDataTable_Balance.json'
  ]);

  const balanceDesTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/Artifact_Balance/ArtifactDes_Balance.json',
    'ArtifactDes_Balance.json'
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

  if (!overseasTablePath && !standardTablePath) {
    console.error('[build-relics] Critical: ArtifactDataTable not found in rawDir');
    return null;
  }

  const rawOverseas = overseasTablePath ? readJsonFile(overseasTablePath) : null;
  const rawStandard = standardTablePath ? readJsonFile(standardTablePath) : null;
  const rawNewArtifact = newArtifactTablePath ? readJsonFile(newArtifactTablePath) : null;
  const rawAdvance = advanceTablePath ? readJsonFile(advanceTablePath) : null;
  const rawBalance = balanceTablePath ? readJsonFile(balanceTablePath) : null;
  const rawBalanceAdvance = balanceAdvanceTablePath ? readJsonFile(balanceAdvanceTablePath) : null;

  const locResolver = createLocalizationResolver();
  if (locEnRaw) locResolver.loadLocale('en', readJsonFile(locEnRaw));
  if (locRuRaw) locResolver.loadLocale('ru', readJsonFile(locRuRaw));

  const effectFigureMap = loadArtifactEffectFigures(rawDir);

  const overseasRows = Array.isArray(rawOverseas) && rawOverseas[0]?.Rows ? rawOverseas[0].Rows : (rawOverseas?.Rows || rawOverseas || {});
  const standardRows = Array.isArray(rawStandard) && rawStandard[0]?.Rows ? rawStandard[0].Rows : (rawStandard?.Rows || rawStandard || {});
  const newArtifactRows = Array.isArray(rawNewArtifact) && rawNewArtifact[0]?.Rows ? rawNewArtifact[0].Rows : (rawNewArtifact?.Rows || rawNewArtifact || {});
  const advanceRows = Array.isArray(rawAdvance) && rawAdvance[0]?.Rows ? rawAdvance[0].Rows : (rawAdvance?.Rows || rawAdvance || {});
  const balanceRows = Array.isArray(rawBalance) && rawBalance[0]?.Rows ? rawBalance[0].Rows : (rawBalance?.Rows || rawBalance || {});
  const balanceAdvanceRows = Array.isArray(rawBalanceAdvance) && rawBalanceAdvance[0]?.Rows ? rawBalanceAdvance[0].Rows : (rawBalanceAdvance?.Rows || rawBalanceAdvance || {});

  // Pre-index Standard Star Advancements by AttributeID
  const advancementsByAttrId: Record<string, any> = {};
  for (const [rowKey, advRow] of Object.entries(advanceRows)) {
    if (!advRow || typeof advRow !== 'object' || !advRow.AttributeID) continue;
    const attrId = String(advRow.AttributeID);
    if (!advancementsByAttrId[attrId]) advancementsByAttrId[attrId] = [];

    const starLevel = Number(advRow.CardStar ?? 0) + 1; // 0..4 -> 1★..5★
    const descEn = locResolver.resolve(advRow.Desc, { locale: 'en', defaultNamespace: 'ArtifactAdvanceAttributeDataTable' }).text || advRow.Desc?.SourceString || '';
    const descRu = locResolver.resolve(advRow.Desc, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'ArtifactAdvanceAttributeDataTable' }).text || descEn;

    advancementsByAttrId[attrId].push({
      star: starLevel,
      desc_en: descEn,
      desc_ru: descRu
    });
  }

  for (const list of Object.values(advancementsByAttrId)) {
    list.sort((a, b) => a.star - b.star);
  }

  // Pre-index Balance / MMO Star Advancements by AttributeID
  const balanceAdvByAttrId: Record<string, any> = {};
  for (const [rowKey, advRow] of Object.entries(balanceAdvanceRows)) {
    if (!advRow || typeof advRow !== 'object' || !advRow.AttributeID) continue;
    const attrId = String(advRow.AttributeID);
    if (!balanceAdvByAttrId[attrId]) balanceAdvByAttrId[attrId] = [];

    const starLevel = Number(advRow.CardStar ?? 0) + 1; // 0..4 -> 1★..5★

    if (starLevel >= 1 && starLevel <= 5 && !balanceAdvByAttrId[attrId].some((s) => s.star === starLevel)) {
      const descEn = locResolver.resolve(advRow.Desc, { locale: 'en', defaultNamespace: 'ArtifactAdvanceAttributeDataTable' }).text || advRow.Desc?.SourceString || '';
      const descRu = locResolver.resolve(advRow.Desc, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'ArtifactAdvanceAttributeDataTable' }).text || descEn;
      balanceAdvByAttrId[attrId].push({
        star: starLevel,
        desc_en: descEn,
        desc_ru: descRu
      });
    }
  }

  for (const list of Object.values(balanceAdvByAttrId)) {
    list.sort((a, b) => a.star - b.star);
  }

  let totalEntities = 0;
  let exactFieldMatches = 0;
  let joinMatches = 0;
  let namingMatches = 0;
  let curatedMatches = 0;
  let unresolvedCount = 0;
  const imageManifest: Record<string, any> = {};

  // Helper to copy and build media records
  function buildMediaBlock(artifactId, row, baseFallbackMedia = null) {
    totalEntities += 4;
    const rawCardRef = row.CardImage?.AssetPathName || baseFallbackMedia?.card_image?.assetRef || '';
    const rawAttackRef = row.AttackIcon?.AssetPathName || baseFallbackMedia?.attack_icon?.assetRef || '';
    const rawItemIconRef = row.ItemIcon?.AssetPathName || row.ArtifactFlagIconTexture?.AssetPathName || baseFallbackMedia?.item_icon?.assetRef || '';
    const rawDrawingRef = row.Drawing?.AssetPathName || row.Photo?.AssetPathName || baseFallbackMedia?.drawing?.assetRef || '';
    const fragmentItemId = row.FragmentItemID || baseFallbackMedia?.upgrade_material?.item_id || `fragment_${artifactId}`;

    const copiedCard = rawCardRef ? imageCopier.copyAsset('relics', rawCardRef, 'cards', { structured: true }) : null;
    if (copiedCard) {
      exactFieldMatches++;
      imageManifest[rawCardRef] = { full: copiedCard.full, thumb: copiedCard.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedAttack = rawAttackRef ? imageCopier.copyAsset('relics', rawAttackRef, 'abilities', { structured: true }) : null;
    if (copiedAttack) {
      exactFieldMatches++;
      imageManifest[rawAttackRef] = { full: copiedAttack.full, thumb: copiedAttack.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedItemIcon = rawItemIconRef ? imageCopier.copyAsset('relics', rawItemIconRef, 'items', { structured: true }) : null;
    if (copiedItemIcon) {
      exactFieldMatches++;
      imageManifest[rawItemIconRef] = { full: copiedItemIcon.full, thumb: copiedItemIcon.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedDrawing = rawDrawingRef ? imageCopier.copyAsset('relics', rawDrawingRef, 'drawings', { structured: true }) : null;
    if (copiedDrawing) {
      exactFieldMatches++;
      imageManifest[rawDrawingRef] = { full: copiedDrawing.full, thumb: copiedDrawing.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const cardProvenance = {
      assetRef: rawCardRef || 'None',
      rawExportPath: copiedCard?.sourcePng || '',
      fullUrl: copiedCard?.full || baseFallbackMedia?.card_image?.fullUrl || null,
      thumbUrl: copiedCard?.thumb || baseFallbackMedia?.card_image?.thumbUrl || null,
      strategy: copiedCard ? 'exact_config_field' : (rawCardRef ? 'missing_exported_png' : 'no_source_ref'),
      diagnosticStatus: copiedCard ? 'resolved' : (rawCardRef ? 'missing_exported_png' : 'no_source_ref'),
      joinIdentity: artifactId
    };

    const attackProvenance = {
      assetRef: rawAttackRef || 'None',
      rawExportPath: copiedAttack?.sourcePng || '',
      fullUrl: copiedAttack?.full || baseFallbackMedia?.attack_icon?.fullUrl || null,
      thumbUrl: copiedAttack?.thumb || baseFallbackMedia?.attack_icon?.thumbUrl || null,
      strategy: copiedAttack ? 'exact_config_field' : (rawAttackRef ? 'missing_exported_png' : 'no_source_ref'),
      diagnosticStatus: copiedAttack ? 'resolved' : (rawAttackRef ? 'missing_exported_png' : 'no_source_ref'),
      joinIdentity: artifactId
    };

    const itemIconProvenance = {
      assetRef: rawItemIconRef || 'None',
      rawExportPath: copiedItemIcon?.sourcePng || '',
      fullUrl: copiedItemIcon?.full || baseFallbackMedia?.item_icon?.fullUrl || null,
      thumbUrl: copiedItemIcon?.thumb || baseFallbackMedia?.item_icon?.thumbUrl || null,
      strategy: copiedItemIcon ? 'exact_config_field' : (rawItemIconRef ? 'missing_exported_png' : 'no_source_ref'),
      diagnosticStatus: copiedItemIcon ? 'resolved' : (rawItemIconRef ? 'missing_exported_png' : 'no_source_ref'),
      joinIdentity: artifactId
    };

    const drawingProvenance = {
      assetRef: rawDrawingRef || 'None',
      rawExportPath: copiedDrawing?.sourcePng || '',
      fullUrl: copiedDrawing?.full || baseFallbackMedia?.drawing?.fullUrl || null,
      thumbUrl: copiedDrawing?.thumb || baseFallbackMedia?.drawing?.thumbUrl || null,
      strategy: copiedDrawing ? 'exact_config_field' : (rawDrawingRef ? 'missing_exported_png' : 'no_source_ref'),
      diagnosticStatus: copiedDrawing ? 'resolved' : (rawDrawingRef ? 'missing_exported_png' : 'no_source_ref'),
      joinIdentity: artifactId
    };

    return {
      card_image: copiedCard?.full || baseFallbackMedia?.card_image?.fullUrl || undefined,
      card_image_thumb: copiedCard?.thumb || baseFallbackMedia?.card_image?.thumbUrl || undefined,
      attack_icon: copiedAttack?.full || baseFallbackMedia?.attack_icon?.fullUrl || undefined,
      attack_icon_thumb: copiedAttack?.thumb || baseFallbackMedia?.attack_icon?.thumbUrl || undefined,
      item_icon: copiedItemIcon?.full || baseFallbackMedia?.item_icon?.fullUrl || undefined,
      item_icon_thumb: copiedItemIcon?.thumb || baseFallbackMedia?.item_icon?.thumbUrl || undefined,
      drawing: copiedDrawing?.full || baseFallbackMedia?.drawing?.fullUrl || undefined,
      drawing_thumb: copiedDrawing?.thumb || baseFallbackMedia?.drawing?.thumbUrl || undefined,
      fragment_item_id: fragmentItemId,
      media: {
        card_image: cardProvenance,
        attack_icon: attackProvenance,
        item_icon: itemIconProvenance,
        drawing: drawingProvenance,
        upgrade_material: {
          item_id: fragmentItemId,
          icon: itemIconProvenance
        }
      }
    };
  }

  // 1. Merge Standard / Gacha Artifact tables
  const mergedGachaRows: Record<string, any> = {};
  for (const [id, row] of Object.entries(standardRows)) {
    if (row && typeof row === 'object') mergedGachaRows[id] = { ...row, _edition: 'standard' };
  }
  for (const [id, row] of Object.entries(overseasRows)) {
    if (row && typeof row === 'object') mergedGachaRows[id] = { ...row, _edition: 'overseas' };
  }
  for (const [id, row] of Object.entries(newArtifactRows)) {
    if (row && typeof row === 'object' && !mergedGachaRows[id]) {
      mergedGachaRows[id] = { ...row, _edition: 'standard' };
    }
  }

  const gachaCanonicalGroups: Record<string, any> = {};

  for (const [artifactId, row] of Object.entries(mergedGachaRows)) {
    if (!row || typeof row !== 'object') continue;

    const { canonicalId, modeContext, labelEn, labelRu } = extractCanonicalRelicIdentity(artifactId);

    const nameResEn = locResolver.resolve(row.ItemName || row.ArtifactName, { locale: 'en', defaultNamespace: 'Artifact', fallbackCodename: artifactId, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(row.ItemName || row.ArtifactName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Artifact', fallbackCodename: artifactId, fallbackSourceRow: row });
    const nameEn = nameResEn.text || artifactId;
    const nameRu = nameResRu.text || nameEn;

    const descEn = resolveRelicAbilityDescription(locResolver, row, artifactId, 'en', false);
    const descRu = resolveRelicAbilityDescription(locResolver, row, artifactId, 'ru', false) || descEn;
    const flavorDescEn = resolveRelicFlavorDescription(locResolver, row, 'en');
    const flavorDescRu = resolveRelicFlavorDescription(locResolver, row, 'ru') || flavorDescEn;

    const quality = mapQuality(row.ItemQuality || row.ArtifactQuality);
    const property = mapProperty(row.ArtifactProperty);
    const type = row.ArtifactType && row.ArtifactType !== 'Invalid' ? String(row.ArtifactType) : '';
    const edition = row._edition || 'overseas';
    const serverMode = 'gacha';

    const mediaRes = buildMediaBlock(artifactId, row);

    const abilityTag = row.AbilitieTag?.TagName ? String(row.AbilitieTag.TagName) : '';
    const cooldown = Number(row.iShowArtifactCd ?? row.ColdDown ?? 0);

    const advanceAttrId = row.AdvanceAttributeID ? String(row.AdvanceAttributeID) : '';
    const stars = advancementsByAttrId[advanceAttrId] || [];

    const numMatch = artifactId.match(/(\d+)/);
    const numDigits = numMatch ? numMatch[1].padStart(3, '0') : '';
    const efKey1 = `artifactssr${numDigits}effectfigure_oversea`;
    const efKey2 = `artifactssr${numDigits}effectfigure`;
    const effectNumbers = effectFigureMap[efKey1] || effectFigureMap[efKey2] || undefined;

    const variantRecord = {
      id: artifactId,
      canonical_id: canonicalId,
      mode: modeContext,
      label_en: labelEn,
      label_ru: labelRu,
      server_mode: serverMode,
      edition,
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      desc_en: descEn,
      desc_ru: descRu,
      flavor_desc_en: flavorDescEn || undefined,
      flavor_desc_ru: flavorDescRu || undefined,
      quality,
      property,
      type: type || undefined,
      card_image: mediaRes.card_image,
      card_image_thumb: mediaRes.card_image_thumb,
      attack_icon: mediaRes.attack_icon,
      attack_icon_thumb: mediaRes.attack_icon_thumb,
      item_icon: mediaRes.item_icon,
      item_icon_thumb: mediaRes.item_icon_thumb,
      drawing: mediaRes.drawing,
      drawing_thumb: mediaRes.drawing_thumb,
      fragment_item_id: mediaRes.fragment_item_id,
      ability_tag: abilityTag || undefined,
      cooldown: cooldown > 0 ? cooldown : undefined,
      advance_attribute_id: advanceAttrId || undefined,
      stars: stars.length > 0 ? stars : undefined,
      effect_numbers: effectNumbers && Object.keys(effectNumbers).length > 0 ? effectNumbers : undefined,
      media: mediaRes.media
    };

    if (!gachaCanonicalGroups[canonicalId]) {
      gachaCanonicalGroups[canonicalId] = {
        canonicalId,
        baseVariant: null,
        variants: []
      };
    }
    gachaCanonicalGroups[canonicalId].variants.push(variantRecord);
    if (artifactId === canonicalId || modeContext === 'base') {
      gachaCanonicalGroups[canonicalId].baseVariant = variantRecord;
    }
  }

  // 2. Process Balance / MMO Artifact tables
  const mmoCanonicalGroups: Record<string, any> = {};

  for (const [artifactId, row] of Object.entries(balanceRows)) {
    if (!row || typeof row !== 'object') continue;

    const { canonicalId, modeContext, labelEn, labelRu } = extractCanonicalRelicIdentity(artifactId);

    const nameResEn = locResolver.resolve(row.ItemName || row.ArtifactName, { locale: 'en', defaultNamespace: 'Artifact', fallbackCodename: artifactId, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(row.ItemName || row.ArtifactName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Artifact', fallbackCodename: artifactId, fallbackSourceRow: row });
    const nameEn = nameResEn.text || artifactId;
    const nameRu = nameResRu.text || nameEn;

    const descEn = resolveRelicAbilityDescription(locResolver, row, artifactId, 'en', true);
    const descRu = resolveRelicAbilityDescription(locResolver, row, artifactId, 'ru', true) || descEn;
    const flavorDescEn = resolveRelicFlavorDescription(locResolver, row, 'en');
    const flavorDescRu = resolveRelicFlavorDescription(locResolver, row, 'ru') || flavorDescEn;

    const quality = mapQuality(row.ItemQuality || row.ArtifactQuality);
    const property = mapProperty(row.ArtifactProperty);
    const type = row.ArtifactType && row.ArtifactType !== 'Invalid' ? String(row.ArtifactType) : '';
    const serverMode = 'mmo';
    const edition = 'mmo';

    const baseGacha = gachaCanonicalGroups[canonicalId]?.baseVariant;
    const mediaRes = buildMediaBlock(artifactId, row, baseGacha?.media);

    const abilityTag = row.AbilitieTag?.TagName ? String(row.AbilitieTag.TagName) : (baseGacha?.ability_tag || '');

    // Effect Numbers for MMO Balance
    const numMatch = artifactId.match(/(\d+)/);
    const numDigits = numMatch ? numMatch[1].padStart(3, '0') : '';
    const isSsr = artifactId.includes('ssr');
    const isSr = artifactId.includes('sr');
    const prefix = isSsr ? 'ssr' : (isSr ? 'sr' : 'r');

    const candidates = [
      `artifact${prefix}${numDigits}effectfigure_balance`,
      `artifact${prefix}${numDigits}effectfigure`,
      `artifact${prefix}${numDigits}effectfigure_oversea`,
      `artifact${numDigits}effectfigure_balance`,
      `artifact${numDigits}effectfigure`
    ];
    if (artifactId === 'artifact_sr_013') candidates.push('artifactr008effectfigure_balance');
    if (artifactId === 'artifact_sr_015') candidates.push('artifactr002effectfigure_balance', 'artifactsr015effectfigure_balance');
    if (artifactId === 'artifact_ssr_013') candidates.push('artifactsr016effectfigure_balance', 'artifactr016effectfigure_balance');

    let effectNumbers = undefined;
    for (const c of candidates) {
      if (effectFigureMap[c]) {
        effectNumbers = effectFigureMap[c];
        break;
      }
    }

    const cooldown = extractCooldown(artifactId, row, descEn, effectNumbers, true);

    // Star advancements for MMO Balance
    const advanceAttrId = row.AdvanceAttributeID ? String(row.AdvanceAttributeID) : (baseGacha?.advance_attribute_id || '');
    const stars = balanceAdvByAttrId[advanceAttrId] || advancementsByAttrId[advanceAttrId] || [];

    const isBaseVariant = artifactId === canonicalId || modeContext === 'base';
    const mmoVariantId = isBaseVariant ? `${canonicalId}-mmo` : `${artifactId}-mmo`;
    const mode = isBaseVariant ? 'mmo' : `${modeContext}_mmo`;
    const labelEnMmo = isBaseVariant ? 'MMO' : `${labelEn} (MMO)`;
    const labelRuMmo = isBaseVariant ? 'MMO' : `${labelRu} (MMO)`;

    const variantRecord = {
      id: mmoVariantId,
      canonical_id: canonicalId,
      mode,
      label_en: labelEnMmo,
      label_ru: labelRuMmo,
      server_mode: serverMode,
      edition,
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      desc_en: descEn,
      desc_ru: descRu,
      flavor_desc_en: flavorDescEn || undefined,
      flavor_desc_ru: flavorDescRu || undefined,
      quality,
      property,
      type: type || undefined,
      card_image: mediaRes.card_image,
      card_image_thumb: mediaRes.card_image_thumb,
      attack_icon: mediaRes.attack_icon,
      attack_icon_thumb: mediaRes.attack_icon_thumb,
      item_icon: mediaRes.item_icon,
      item_icon_thumb: mediaRes.item_icon_thumb,
      drawing: mediaRes.drawing,
      drawing_thumb: mediaRes.drawing_thumb,
      fragment_item_id: mediaRes.fragment_item_id,
      ability_tag: abilityTag || undefined,
      cooldown: cooldown && cooldown > 0 ? cooldown : undefined,
      advance_attribute_id: advanceAttrId || undefined,
      stars: stars.length > 0 ? stars : undefined,
      effect_numbers: effectNumbers && Object.keys(effectNumbers).length > 0 ? effectNumbers : undefined,
      media: mediaRes.media
    };

    if (!mmoCanonicalGroups[canonicalId]) {
      mmoCanonicalGroups[canonicalId] = {
        canonicalId,
        baseVariant: null,
        variants: []
      };
    }
    mmoCanonicalGroups[canonicalId].variants.push(variantRecord);
    if (isBaseVariant) {
      mmoCanonicalGroups[canonicalId].baseVariant = variantRecord;
    }

    // Link MMO variant into canonical Gacha group
    if (!gachaCanonicalGroups[canonicalId]) {
      gachaCanonicalGroups[canonicalId] = {
        canonicalId,
        baseVariant: null,
        variants: []
      };
    }
    gachaCanonicalGroups[canonicalId].variants.push(variantRecord);
  }

  const gachaItems = [];
  for (const group of Object.values(gachaCanonicalGroups)) {
    group.variants.sort((a, b) => {
      if (a.id === group.canonicalId) return -1;
      if (b.id === group.canonicalId) return 1;
      if (a.mode === 'base') return -1;
      if (b.mode === 'base') return 1;
      if (a.server_mode === 'gacha' && b.server_mode === 'mmo') return -1;
      if (a.server_mode === 'mmo' && b.server_mode === 'gacha') return 1;
      return a.id.localeCompare(b.id);
    });

    const primary = group.baseVariant || group.variants[0];

    gachaItems.push({
      id: group.canonicalId,
      canonical_id: group.canonicalId,
      server_mode: 'gacha',
      edition: primary.edition || 'overseas',
      name_en: primary.name_en,
      name_ru: primary.name_ru,
      original_name: primary.original_name,
      desc_en: primary.desc_en,
      desc_ru: primary.desc_ru,
      flavor_desc_en: primary.flavor_desc_en,
      flavor_desc_ru: primary.flavor_desc_ru,
      quality: primary.quality,
      property: primary.property,
      type: primary.type,
      card_image: primary.card_image,
      card_image_thumb: primary.card_image_thumb,
      attack_icon: primary.attack_icon,
      attack_icon_thumb: primary.attack_icon_thumb,
      item_icon: primary.item_icon,
      item_icon_thumb: primary.item_icon_thumb,
      drawing: primary.drawing,
      drawing_thumb: primary.drawing_thumb,
      fragment_item_id: primary.fragment_item_id,
      ability_tag: primary.ability_tag,
      cooldown: primary.cooldown,
      advance_attribute_id: primary.advance_attribute_id,
      stars: primary.stars,
      effect_numbers: primary.effect_numbers,
      media: primary.media,
      variants: group.variants
    });
  }

  const mmoItems = [];
  for (const group of Object.values(mmoCanonicalGroups)) {
    group.variants.sort((a, b) => {
      if (a.id === `${group.canonicalId}-mmo`) return -1;
      if (b.id === `${group.canonicalId}-mmo`) return 1;
      if (a.mode === 'mmo' || a.mode === 'base') return -1;
      if (b.mode === 'mmo' || b.mode === 'base') return 1;
      return a.id.localeCompare(b.id);
    });

    const primary = group.baseVariant || group.variants[0];

    mmoItems.push({
      id: `${group.canonicalId}-mmo`,
      canonical_id: group.canonicalId,
      server_mode: 'mmo',
      edition: 'mmo',
      name_en: primary.name_en,
      name_ru: primary.name_ru,
      original_name: primary.original_name,
      desc_en: primary.desc_en,
      desc_ru: primary.desc_ru,
      flavor_desc_en: primary.flavor_desc_en,
      flavor_desc_ru: primary.flavor_desc_ru,
      quality: primary.quality,
      property: primary.property,
      type: primary.type,
      card_image: primary.card_image,
      card_image_thumb: primary.card_image_thumb,
      attack_icon: primary.attack_icon,
      attack_icon_thumb: primary.attack_icon_thumb,
      item_icon: primary.item_icon,
      item_icon_thumb: primary.item_icon_thumb,
      drawing: primary.drawing,
      drawing_thumb: primary.drawing_thumb,
      fragment_item_id: primary.fragment_item_id,
      ability_tag: primary.ability_tag,
      cooldown: primary.cooldown,
      advance_attribute_id: primary.advance_attribute_id,
      stars: primary.stars,
      effect_numbers: primary.effect_numbers,
      media: primary.media,
      variants: group.variants
    });
  }

  // Sort function: SSR first, then SR -> R -> N; then by ID descending
  const qualityOrder = { SSR: 1, SR: 2, R: 3, N: 4 };
  const sortRelics = (list) => {
    list.sort((a, b) => {
      const qA = qualityOrder[a.quality] || 99;
      const qB = qualityOrder[b.quality] || 99;
      if (qA !== qB) return qA - qB;

      const numA = parseInt(a.canonical_id.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.canonical_id.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numB - numA;

      return a.canonical_id.localeCompare(b.canonical_id);
    });
  };

  sortRelics(gachaItems);
  sortRelics(mmoItems);

  const items = [...gachaItems, ...mmoItems];

  const outputData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: items.length,
    counts: {
      ssr: items.filter((i) => i.quality === 'SSR').length,
      sr: items.filter((i) => i.quality === 'SR').length,
      r: items.filter((i) => i.quality === 'R').length,
      n: items.filter((i) => i.quality === 'N').length,
      gacha: gachaItems.length,
      mmo: mmoItems.length,
      total_gacha: gachaItems.length,
      total_mmo: mmoItems.length
    },
    items,
    relics: items,
    gacha: gachaItems,
    mmo: mmoItems
  };

  for (const dir of targetDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'relics.json'), JSON.stringify(outputData, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'relics-image-manifest.json'), JSON.stringify(imageManifest, null, 2), 'utf8');
  }

  imageCopier.saveSharedManifest();
  const statsCount = imageCopier.getStats()['relics'] || 0;
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
    fs.writeFileSync(path.join(dir, 'relics-image-report.json'), JSON.stringify(imageReport, null, 2), 'utf8');
  }

  console.log(`[build-relics] Successfully generated ${items.length} canonical relics (${gachaItems.length} gacha, ${mmoItems.length} MMO) to ${path.join(outDir, 'relics.json')}`);
  console.log('[build-relics] Image resolution report:', imageReport);
  return outputData;
}

if (require.main === module) {
  try {
    buildRelicsDataset();
  } catch (err) {
    console.error('[build-relics] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildRelicsDataset,
  cleanHtmlTags,
  extractCanonicalRelicIdentity,
  mapQuality,
  mapProperty,
  extractCooldown,
  resolveRelicAbilityDescription,
  resolveRelicFlavorDescription,
};
