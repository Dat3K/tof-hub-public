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
    console.error(`[build-pets] Error reading JSON at ${filePath}:`, e.message);
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

function extractPetElementLeaf(rawElem) {
  if (!rawElem) return null;
  return String(rawElem).replace(/^.*::/, '').trim() || null;
}

function normalizePetElement(rawElem) {
  const leaf = extractPetElementLeaf(rawElem);
  if (!leaf) return null;
  const map = {
    Physics: 'phys',
    Physical: 'phys',
    Phys: 'phys',
    Flame: 'fire',
    Fire: 'fire',
    Ice: 'frost',
    Frost: 'frost',
    Thunder: 'volt',
    Volt: 'volt',
    Superpower: 'altered',
    Altered: 'altered'
  };
  return map[leaf] || null;
}

function extractPetRoleLeaf(rawRole) {
  if (!rawRole) return null;
  return String(rawRole).replace(/^.*::/, '').trim() || null;
}

function normalizePetRole(rawRole) {
  const leaf = extractPetRoleLeaf(rawRole);
  if (!leaf) return null;
  const map = {
    Attack: 'dps',
    Dps: 'dps',
    DPS: 'dps',
    Defense: 'tank',
    Tank: 'tank',
    Fortitude: 'tank',
    Support: 'support',
    Heal: 'support',
    Benediction: 'support'
  };
  return map[leaf] || null;
}

function parseModuleBaseNameAndOwner(fullNameEn, fullNameRu) {
  let ownerEn = undefined;
  let ownerRu = undefined;
  let cleanEn = String(fullNameEn || '').replace(/[\s\u00a0]+[IVX]+$/i, '').trim();
  let cleanRu = String(fullNameRu || '').replace(/[\s\u00a0]+[IVX]+$/i, '').trim();

  const parenMatchEn = cleanEn.match(/^(.*?)[\s\u00a0]*\(([^)]+)\)$/i);
  const parenMatchRu = cleanRu.match(/^(.*?)[\s\u00a0]*\(([^)]+)\)$/i);
  if (parenMatchEn) {
    cleanEn = parenMatchEn[1].trim();
    ownerEn = parenMatchEn[2].trim();
  }
  if (parenMatchRu) {
    cleanRu = parenMatchRu[1].trim();
    ownerRu = parenMatchRu[2].trim();
  }

  const prefixMatchEn = cleanEn.match(/^([^:]+):\s*(.+)$/);
  const prefixMatchRu = cleanRu.match(/^([^:]+):\s*(.+)$/);
  if (!ownerEn && prefixMatchEn) {
    ownerEn = prefixMatchEn[1].trim();
    cleanEn = prefixMatchEn[2].trim();
  }
  if (!ownerRu && prefixMatchRu) {
    ownerRu = prefixMatchRu[1].trim();
    cleanRu = prefixMatchRu[2].trim();
  }

  cleanEn = cleanEn.replace(/[\s\u00a0]+[IVX]+$/i, '').trim();
  cleanRu = cleanRu.replace(/[\s\u00a0]+[IVX]+$/i, '').trim();

  return {
    name_en: cleanEn,
    name_ru: cleanRu,
    baseNameEn: cleanEn,
    baseNameRu: cleanRu,
    owner_en: ownerEn,
    owner_ru: ownerRu,
    ownerEn,
    ownerRu
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

function formatVal(v) {
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v)) return v.toString();
  return (Math.round(v * 100) / 100).toString();
}

function normalizeSkillFormulaSpacing(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text;
  // 1. Missing space before percentage or placeholder if glued to a word (e.g. "dealing4404%" -> "dealing 4404%")
  s = s.replace(/([a-zA-Z\u0400-\u04FF])(\d+(?:\.\d+)?%|\{\d+\}%)/g, '$1 $2');
  // 2. Normalize formula spacing around +
  s = s.replace(/(of\s+ATK|от\s+АТК|от\s+ATK|%)\s*\+\s*(\d+(?:\.\d+)?|\{\d+\})/gi, '$1 + $2');
  // 3. Spacing around + for ATK
  s = s.replace(/(ATK|АТК)\s*\+\s*(\d+(?:\.\d+)?|\{\d+\})/gi, '$1 + $2');
  return s;
}

function findCurveValue(curveTableMap, curveTableStr, rowName) {
  if (!curveTableMap || !curveTableStr || !rowName || rowName === 'None') return null;
  const m = curveTableStr.match(/([A-Za-z0-9_]+)(?:'|\.|$)/);
  const rawName = m ? m[1].toLowerCase() : '';
  const clean = rawName.replace(/curve$/i, '').replace(/^(?:curvetable')/i, '');

  let table = curveTableMap.get(rawName) || curveTableMap.get(clean) || curveTableMap.get('pet_skill_mult');
  if (!table) {
    for (const [k, v] of curveTableMap.entries()) {
      if (k.includes(clean) || clean.includes(k)) {
        table = v;
        break;
      }
    }
  }

  if (table) {
    const row = table[rowName] || Object.entries(table).find(([k]) => k.toLowerCase() === rowName.toLowerCase())?.[1];
    if (row) {
      if (Array.isArray(row.Keys) && row.Keys.length > 0) {
        // Base level corresponds to Time 1, or the first key in curve
        const key1 = row.Keys.find(k => k.Time === 1) || row.Keys[0];
        return key1.Value;
      }
      if (typeof row.DefaultValue === 'number' && row.DefaultValue < 1e30) {
        return row.DefaultValue;
      }
    }
  }

  return null;
}

function formatPetSkillDescription(desc, skillStarsParam, curveTableMap, diagnostics = null) {
  if (!desc || typeof desc !== 'string') return '';
  const params = Array.isArray(skillStarsParam) ? skillStarsParam : [];

  let formatted = desc.replace(/\{(\d+)\}/g, (match, p1) => {
    const idx = parseInt(p1, 10);
    const param = params[idx];
    if (!param) {
      if (diagnostics && Array.isArray(diagnostics.missingParams)) diagnostics.missingParams.push(idx);
      return match;
    }

    const mult = typeof param.Value === 'number' ? param.Value : 1;
    const curveObj = param.Curve;
    const curveTableStr = curveObj?.CurveTable?.ObjectName || curveObj?.CurveTable?.ObjectPath || '';
    const rowName = curveObj?.RowName;

    const rawVal = findCurveValue(curveTableMap, curveTableStr, rowName);
    if (typeof rawVal === 'number') {
      const finalVal = rawVal * mult;
      return formatVal(finalVal);
    }

    if (typeof param.Value === 'number' && (!rowName || rowName === 'None')) {
      return formatVal(param.Value);
    }

    if (diagnostics && Array.isArray(diagnostics.unresolvedCurveRows)) {
      diagnostics.unresolvedCurveRows.push({ idx, curveTableStr, rowName });
    }
    return match;
  });

  // Where none exists or cannot be filled, cleanly replace with "—" so literal {n} is never printed
  formatted = formatted.replace(/\{[0-9]+\}%?/g, '—').replace(/\{[^{}]*\}/g, '—');
  return normalizeSkillFormulaSpacing(formatted);
}

function buildPetsDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'info', 'pets', 'data');
  const targetDirs = [outDir];
  const imageCopier = new ImageCopier(rawDir, projectRoot);

  console.log(`[build-pets] Project root: ${projectRoot}`);
  console.log(`[build-pets] Raw data dir: ${rawDir}`);

  // Locate source tables
  const cuteTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/CutePetDataTable.json',
    'CutePetDataTable.json'
  ]);

  const petTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetDataTable.json',
    'PetDataTable.json'
  ]);

  const petMmoTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetDataTable_MMO.json',
    'PetDataTable_MMO.json'
  ]);

  const advanceTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetAdvanceDataTable.json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/PetAdvanceDataTable_Overseas.json',
    'PetAdvanceDataTable.json'
  ]);

  const advanceMmoTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetAdvanceDataTable_MMO.json',
    'PetAdvanceDataTable_MMO.json'
  ]);

  const petModifyTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetModifyDataTable.json',
    'PetModifyDataTable.json'
  ]);

  const petModifyMmoTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetModifyDataTable_MMO.json',
    'PetModifyDataTable_MMO.json'
  ]);

  const petUpgradeTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetUpgradeDataTable.json',
    'PetUpgradeDataTable.json'
  ]);

  const petUpgradeMmoTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/PetUpgradeDataTable_MMO.json',
    'PetUpgradeDataTable_MMO.json'
  ]);

  const skillModuleTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/DT_FightPetSkillModule.json',
    'DT_FightPetSkillModule.json'
  ]);

  const skillModuleMmoTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/DT_FightPetSkillModule_MMO.json',
    'DT_FightPetSkillModule_MMO.json'
  ]);

  const petSkillMultTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/pet_Skill_Mult.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/Pet_Skill_Mult.json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Pet/pet_Skill_Mult_Overseas.json',
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Pet/Pet_Skill_Mult_Overseas.json',
    'pet_Skill_Mult.json',
    'Pet_Skill_Mult.json'
  ]);

  const petSkillCurveTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/Pet_SkillCoefficientMultiCurve.json',
    'Pet_SkillCoefficientMultiCurve.json'
  ]);

  const petMmoEffectTablePath = findFile(rawDir, [
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/EffectFigure/FightPetEffectFigure_MMO.json',
    'FightPetEffectFigure_MMO.json'
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

  if (!cuteTablePath && !petTablePath) {
    console.error('[build-pets] Critical: CutePetDataTable or PetDataTable not found in rawDir');
    return null;
  }

  const rawCute = cuteTablePath ? readJsonFile(cuteTablePath) : null;
  const rawPet = petTablePath ? readJsonFile(petTablePath) : null;
  const rawPetMmo = petMmoTablePath ? readJsonFile(petMmoTablePath) : null;
  const rawAdvance = advanceTablePath ? readJsonFile(advanceTablePath) : null;
  const rawAdvanceMmo = advanceMmoTablePath ? readJsonFile(advanceMmoTablePath) : null;
  const rawPetModify = petModifyTablePath ? readJsonFile(petModifyTablePath) : null;
  const rawPetModifyMmo = petModifyMmoTablePath ? readJsonFile(petModifyMmoTablePath) : null;
  const rawPetUpgrade = petUpgradeTablePath ? readJsonFile(petUpgradeTablePath) : null;
  const rawPetUpgradeMmo = petUpgradeMmoTablePath ? readJsonFile(petUpgradeMmoTablePath) : null;
  const rawSkillModule = skillModuleTablePath ? readJsonFile(skillModuleTablePath) : null;
  const rawSkillModuleMmo = skillModuleMmoTablePath ? readJsonFile(skillModuleMmoTablePath) : null;

  const curveTableMap = new Map<any, any>();
  const registerCurveTable = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;
    const data = readJsonFile(filePath);
    if (!data) return;
    const rows = Array.isArray(data) && data[0]?.Rows ? data[0].Rows : (data.Rows || data || {});
    const baseName = path.basename(filePath, '.json').toLowerCase();
    curveTableMap.set(baseName, rows);
    const clean = baseName.replace(/_(?:overseas?|os)$/i, '').replace(/curve$/i, '');
    curveTableMap.set(clean, rows);
  };

  if (petSkillMultTablePath) registerCurveTable(petSkillMultTablePath);
  if (petSkillCurveTablePath) registerCurveTable(petSkillCurveTablePath);
  if (petMmoEffectTablePath) registerCurveTable(petMmoEffectTablePath);

  const locResolver = createLocalizationResolver();
  if (locEnRaw) locResolver.loadLocale('en', readJsonFile(locEnRaw));
  if (locRuRaw) locResolver.loadLocale('ru', readJsonFile(locRuRaw));

  const cuteRows = Array.isArray(rawCute) && rawCute[0]?.Rows ? rawCute[0].Rows : (rawCute?.Rows || rawCute || {});
  const petRows = Array.isArray(rawPet) && rawPet[0]?.Rows ? rawPet[0].Rows : (rawPet?.Rows || rawPet || {});
  const petMmoRows = Array.isArray(rawPetMmo) && rawPetMmo[0]?.Rows ? rawPetMmo[0].Rows : (rawPetMmo?.Rows || rawPetMmo || {});
  const advanceRows = Array.isArray(rawAdvance) && rawAdvance[0]?.Rows ? rawAdvance[0].Rows : (rawAdvance?.Rows || rawAdvance || {});
  const advanceMmoRows = Array.isArray(rawAdvanceMmo) && rawAdvanceMmo[0]?.Rows ? rawAdvanceMmo[0].Rows : (rawAdvanceMmo?.Rows || rawAdvanceMmo || {});
  const allAdvanceRows = { ...advanceRows, ...advanceMmoRows };

  const modifyRows = {
    ...(Array.isArray(rawPetModify) && rawPetModify[0]?.Rows ? rawPetModify[0].Rows : (rawPetModify?.Rows || rawPetModify || {})),
    ...(Array.isArray(rawPetModifyMmo) && rawPetModifyMmo[0]?.Rows ? rawPetModifyMmo[0].Rows : (rawPetModifyMmo?.Rows || rawPetModifyMmo || {}))
  };
  const upgradeRows = {
    ...(Array.isArray(rawPetUpgrade) && rawPetUpgrade[0]?.Rows ? rawPetUpgrade[0].Rows : (rawPetUpgrade?.Rows || rawPetUpgrade || {})),
    ...(Array.isArray(rawPetUpgradeMmo) && rawPetUpgradeMmo[0]?.Rows ? rawPetUpgradeMmo[0].Rows : (rawPetUpgradeMmo?.Rows || rawPetUpgradeMmo || {}))
  };

  const skillModuleRows = Array.isArray(rawSkillModule) && rawSkillModule[0]?.Rows ? rawSkillModule[0].Rows : (rawSkillModule?.Rows || rawSkillModule || {});
  const skillModuleMmoRows = Array.isArray(rawSkillModuleMmo) && rawSkillModuleMmo[0]?.Rows ? rawSkillModuleMmo[0].Rows : (rawSkillModuleMmo?.Rows || rawSkillModuleMmo || {});

  // Pre-index Pet Advancements (by pet ID, e.g. FightPet_1_adv_0 -> FightPet_1)
  const advancementsByPetId: Record<string, any> = {};
  for (const [rowKey, advRow] of Object.entries(allAdvanceRows)) {
    if (!advRow || typeof advRow !== 'object') continue;
    const match = rowKey.match(/^(FightPet_\d+)/i);
    const petId = match ? match[1] : rowKey;
    if (!advancementsByPetId[petId]) advancementsByPetId[petId] = [];

    const starMatch = rowKey.match(/_adv_(\d+)$/i);
    const starNum = starMatch ? parseInt(starMatch[1], 10) : advancementsByPetId[petId].length;

    const descEn = locResolver.resolve(advRow.AdvanceDetail, { locale: 'en', defaultNamespace: 'Pet' }).text;
    const descRu = locResolver.resolve(advRow.AdvanceDetail, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet' }).text || descEn;

    let atkInheritance = advRow.PlayerModifyCoefficient ? `${Math.round(advRow.PlayerModifyCoefficient * 100)}%` : undefined;

    // For FightPet_12 (and cases where raw coefficient is 1.0 / 100% placeholder), extract actual percentage from description text
    const textInheritMatch = (advRow.AdvanceDetail?.SourceString || '').match(/(?:继承|提升至)[^0-9]*<shuzhi>(\d+)%<\/>/)
      || (descEn || '').match(/(?:Inherits|increases to)\s*(\d+)%/i)
      || (descRu || '').match(/(?:Перенимает|увеличивается до)\s*(\d+)%/i)
      || (descEn || '').match(/(\d+)%/);

    if (textInheritMatch && (atkInheritance === '100%' || petId.toLowerCase() === 'fightpet_12')) {
      atkInheritance = `${textInheritMatch[1]}%`;
    }

    const [shardId, shardCount] = (advRow.NeedItems && advRow.NeedItems !== 'None') ? String(advRow.NeedItems).split(',') : [null, null];

    advancementsByPetId[petId].push({
      star: starNum,
      desc_en: descEn,
      desc_ru: descRu,
      atk_inheritance: atkInheritance,
      module_slots: advRow.SkillModuleNumber ?? undefined,
      module_load: advRow.SkillModuleLoad ?? undefined,
      gold_cost: typeof advRow.NeedGolds === 'number' ? advRow.NeedGolds : 0,
      item_cost: (advRow.NeedItems && advRow.NeedItems !== 'None') ? advRow.NeedItems : undefined,
      item_shard_id: shardId ? shardId.trim() : undefined,
      item_shard_count: shardCount ? parseInt(shardCount.trim(), 10) : undefined,
      pet_level_req: typeof advRow.NeedPetLevel === 'number' ? advRow.NeedPetLevel : undefined
    });
  }

  for (const list of Object.values(advancementsByPetId)) {
    list.sort((a, b) => a.star - b.star);
  }

  const buildPetStatsProgression = (row) => {
    const modPack = row?.PetUpgradeModifyPack;
    const upgPack = row?.PetUpgradePack || 'FightPet1_Upgrade';
    if (!modPack) return undefined;

    const maxLevel = 100;
    const levels: Record<string, any> = {};
    let cumExp = 0;
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const modKey = `${modPack}_${lvl}`;
      const upgKey = `${upgPack}_${lvl}`;
      const mRow = modifyRows[modKey] || {};
      const uRow = upgradeRows[upgKey] || {};
      const exp = typeof uRow.NeedExp === 'number' ? uRow.NeedExp : 0;
      cumExp += exp;
      levels[String(lvl)] = {
        level: lvl,
        atk: typeof mRow.CommonAtkBase === 'number' ? mRow.CommonAtkBase : undefined,
        crit: typeof mRow.Crit === 'number' ? mRow.Crit : undefined,
        crit_dmg: typeof mRow.CritDam === 'number' ? mRow.CritDam : 0.5,
        exp: exp,
        cum_exp: cumExp,
        player_level_req: typeof uRow.NeedPlayerLevel === 'number' ? uRow.NeedPlayerLevel : lvl
      };
    }
    return {
      max_level: maxLevel,
      levels
    };
  };

  let totalEntities = 0;
  let exactFieldMatches = 0;
  let joinMatches = 0;
  let namingMatches = 0;
  let curatedMatches = 0;
  let unresolvedCount = 0;
  const imageManifest: Record<string, any> = {};

  // Process Skill Modules (merge standard + MMO)
  const mergedModules: Record<string, any> = {};
  for (const [id, row] of Object.entries(skillModuleRows)) {
    if (row && typeof row === 'object') mergedModules[id] = { ...row, _edition: 'global' };
  }
  for (const [id, row] of Object.entries(skillModuleMmoRows)) {
    if (row && typeof row === 'object' && !mergedModules[id]) {
      mergedModules[id] = { ...row, _edition: 'mmo' };
    }
  }

  const skillModules = [];
  for (const [id, row] of Object.entries(mergedModules)) {
    if (!row || typeof row !== 'object') continue;

    const nameResEn = locResolver.resolve(row.ItemName, { locale: 'en', defaultNamespace: 'FightPetSkillModule', fallbackCodename: id, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(row.ItemName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'FightPetSkillModule', fallbackCodename: id, fallbackSourceRow: row });
    const nameEn = nameResEn.text || id;
    const nameRu = nameResRu.text || nameEn;
    const descEn = locResolver.resolve(row.Description, { locale: 'en', defaultNamespace: 'FightPetSkillModule', fallbackSourceRow: row }).text;
    const descRu = locResolver.resolve(row.Description, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'FightPetSkillModule', fallbackSourceRow: row }).text || descEn;
    const quality = mapQuality(row.ItemQuality);

    totalEntities++;
    const rawIconRef = row.ItemIcon?.AssetPathName || '';
    const copiedIcon = rawIconRef ? imageCopier.copyAsset('pets', rawIconRef, 'modules', { structured: true }) : null;
    if (copiedIcon) {
      exactFieldMatches++;
      imageManifest[rawIconRef] = { full: copiedIcon.full, thumb: copiedIcon.thumb, strategy: 'exact_config_field' };
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
        role: 'module_icon',
        joinIdentity: id
      },
      source_edition: row._edition || 'standard'
    };

    skillModules.push({
      id,
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      desc_en: descEn,
      desc_ru: descRu,
      quality,
      level: Number(row.SkillModuleLevel ?? 1),
      need_load: Number(row.NeedLoadValue ?? 5),
      icon: copiedIcon?.full || undefined,
      icon_thumb: copiedIcon?.thumb || undefined,
      media
    });
  }

  // Group modules into Lv.1-4 families by pattern ^SkillModule_(.+)_(\d+)$
  const moduleFamiliesMap: Record<string, any> = {};
  for (const m of skillModules) {
    const match = m.id.match(/^SkillModule_(.+)_(\d+)$/i);
    const groupId = match ? match[1] : m.id;
    const levelNum = match ? parseInt(match[2], 10) : (m.level || 1);

    if (!moduleFamiliesMap[groupId]) {
      moduleFamiliesMap[groupId] = {
        group_id: groupId,
        quality: m.quality,
        need_load: m.need_load,
        icon: m.icon,
        icon_thumb: m.icon_thumb,
        levels: []
      };
    }

    moduleFamiliesMap[groupId].levels.push({
      level: levelNum,
      id: m.id,
      name_en: m.name_en,
      name_ru: m.name_ru,
      desc_en: m.desc_en,
      desc_ru: m.desc_ru,
      need_load: m.need_load,
      icon: m.icon || null,
      icon_thumb: m.icon_thumb || null
    });
  }

  const moduleFamilies = Object.values(moduleFamiliesMap).map((fam) => {
    fam.levels.sort((a, b) => a.level - b.level);
    const baseLevel = fam.levels[0] || {};
    const parsed = parseModuleBaseNameAndOwner(baseLevel.name_en, baseLevel.name_ru);

    return {
      group_id: fam.group_id,
      family_id: fam.group_id,
      id: fam.group_id,
      name_en: parsed.name_en,
      name_ru: parsed.name_ru,
      owner: parsed.owner_en || null,
      owner_en: parsed.owner_en || null,
      owner_ru: parsed.owner_ru || null,
      quality: fam.quality,
      need_load: fam.need_load,
      icon: baseLevel.icon || fam.icon || null,
      icon_thumb: baseLevel.icon_thumb || fam.icon_thumb || null,
      levels: fam.levels
    };
  });

  moduleFamilies.sort((a, b) => {
    const numA = parseInt((a.group_id.match(/\d+/) || [0])[0], 10);
    const numB = parseInt((b.group_id.match(/\d+/) || [0])[0], 10);
    return numA - numB;
  });

  const items = [];

  // 1. Process Combat Pets (Smart Servants)
  for (const [id, row] of Object.entries(petRows)) {
    if (!row || typeof row !== 'object') continue;

    const nameResEn = locResolver.resolve(row.ItemName, { locale: 'en', defaultNamespace: 'Pet', fallbackCodename: id, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(row.ItemName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet', fallbackCodename: id, fallbackSourceRow: row });
    const nameEn = nameResEn.text || id;
    const nameRu = nameResRu.text || nameEn;

    const descEn = locResolver.resolve(row.Description, { locale: 'en', defaultNamespace: 'Pet', fallbackSourceRow: row }).text;
    const descRu = locResolver.resolve(row.Description, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet', fallbackSourceRow: row }).text || descEn;
    const quality = mapQuality(row.ItemQuality);

    const element = extractPetElementLeaf(row.PetElementType);
    const elementNorm = normalizePetElement(row.PetElementType);
    const roleLeaf = extractPetRoleLeaf(row.PetPropertyType);
    const roleNorm = normalizePetRole(row.PetPropertyType);

    totalEntities += 2; // photo, token
    const rawPhotoRef = row.PetActivatedIcon?.AssetPathName || row.PetPhoto?.AssetPathName || '';
    const rawIconRef = row.ItemIcon?.AssetPathName || '';

    const copiedPhoto = (rawPhotoRef && rawPhotoRef !== 'None') ? imageCopier.copyAsset('pets', rawPhotoRef, 'photos', { structured: true }) : null;
    if (copiedPhoto) {
      exactFieldMatches++;
      imageManifest[rawPhotoRef] = { full: copiedPhoto.full, thumb: copiedPhoto.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedToken = (rawIconRef && rawIconRef !== 'None') ? imageCopier.copyAsset('pets', rawIconRef, 'tokens', { structured: true }) : null;
    if (copiedToken) {
      exactFieldMatches++;
      imageManifest[rawIconRef] = { full: copiedToken.full, thumb: copiedToken.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    // Process Combat Pet Skills
    const rawSkills = Array.isArray(row.PetSkillDetail) ? row.PetSkillDetail : [];
    const skills = [];
    for (const s of rawSkills) {
      if (!s || typeof s !== 'object') continue;
      const sNameEn = locResolver.resolve(s.SkillName, { locale: 'en', defaultNamespace: 'Pet' }).text || '';
      const sNameRu = locResolver.resolve(s.SkillName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet' }).text || sNameEn;
      const sDescEn = locResolver.resolve(s.SkillDetail, { locale: 'en', defaultNamespace: 'Pet' }).text;
      const sDescRu = locResolver.resolve(s.SkillDetail, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet' }).text || sDescEn;
      const rawSkillIconRef = s.SkillIcon?.AssetPathName || '';

      totalEntities++;
      const copiedSkillIcon = (rawSkillIconRef && rawSkillIconRef !== 'None') ? imageCopier.copyAsset('pets', rawSkillIconRef, 'skills', { structured: true }) : null;
      if (copiedSkillIcon) {
        exactFieldMatches++;
        imageManifest[rawSkillIconRef] = { full: copiedSkillIcon.full, thumb: copiedSkillIcon.thumb, strategy: 'exact_config_field' };
      } else {
        unresolvedCount++;
      }

      const rawParams = Array.isArray(s.SkillStarsParam) ? s.SkillStarsParam : [];
      const resolvedDescEn = formatPetSkillDescription(sDescEn, rawParams, curveTableMap);
      const resolvedDescRu = formatPetSkillDescription(sDescRu, rawParams, curveTableMap);

      skills.push({
        name_en: sNameEn,
        name_ru: sNameRu,
        desc_en: resolvedDescEn,
        desc_ru: resolvedDescRu,
        icon: copiedSkillIcon?.full || undefined,
        icon_thumb: copiedSkillIcon?.thumb || undefined,
        media: {
          icon: {
            assetRef: rawSkillIconRef || 'None',
            rawExportPath: copiedSkillIcon?.sourcePng || '',
            fullUrl: copiedSkillIcon?.full || null,
            thumbUrl: copiedSkillIcon?.thumb || null,
            strategy: copiedSkillIcon ? 'exact_config_field' : (rawSkillIconRef && rawSkillIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
            diagnosticStatus: copiedSkillIcon ? 'resolved' : (rawSkillIconRef && rawSkillIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
            role: 'skill_icon',
            joinIdentity: `${id}_skill`
          }
        }
      });
    }

    const advPackKey = (row.PetAdvancePack || '').replace(/_adv$/i, '');
    const stars = advancementsByPetId[id] || (advPackKey.toLowerCase() === id.toLowerCase() ? advancementsByPetId[advPackKey] : []) || [];
    const statsProgression = buildPetStatsProgression(row);

    const media = {
      photo: {
        assetRef: rawPhotoRef || 'None',
        rawExportPath: copiedPhoto?.sourcePng || '',
        fullUrl: copiedPhoto?.full || null,
        thumbUrl: copiedPhoto?.thumb || null,
        strategy: copiedPhoto ? 'exact_config_field' : (rawPhotoRef && rawPhotoRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedPhoto ? 'resolved' : (rawPhotoRef && rawPhotoRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        role: 'photo',
        joinIdentity: id
      },
      token_icon: {
        assetRef: rawIconRef || 'None',
        rawExportPath: copiedToken?.sourcePng || '',
        fullUrl: copiedToken?.full || null,
        thumbUrl: copiedToken?.thumb || null,
        strategy: copiedToken ? 'exact_config_field' : (rawIconRef && rawIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedToken ? 'resolved' : (rawIconRef && rawIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        role: 'token_icon',
        joinIdentity: id
      },
      source_edition: 'standard'
    };

    const primaryUrl = copiedPhoto?.full || copiedToken?.full || undefined;
    const primaryThumb = copiedPhoto?.thumb || copiedToken?.thumb || undefined;

    items.push({
      id,
      category: 'combat',
      source_edition: 'standard',
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      desc_en: descEn,
      desc_ru: descRu,
      quality,
      element: element || null,
      element_norm: elementNorm || null,
      property: roleLeaf || null,
      role: roleLeaf || null,
      role_norm: roleNorm || null,
      icon: primaryUrl,
      icon_thumb: primaryThumb,
      photo: copiedPhoto?.full || undefined,
      photo_thumb: copiedPhoto?.thumb || undefined,
      token_icon: copiedToken?.full || undefined,
      token_icon_thumb: copiedToken?.thumb || undefined,
      stars: stars.length > 0 ? stars : undefined,
      stats_progression: statsProgression || undefined,
      skills: skills.length > 0 ? skills : undefined,
      media
    });
  }

  // 2. Process MMO Combat Pets
  for (const [id, row] of Object.entries(petMmoRows)) {
    if (!row || typeof row !== 'object') continue;
    const mmoId = `MMO_${id}`;

    const nameResEn = locResolver.resolve(row.ItemName, { locale: 'en', defaultNamespace: 'Pet', fallbackCodename: mmoId, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(row.ItemName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet', fallbackCodename: mmoId, fallbackSourceRow: row });
    const nameEn = nameResEn.text || id;
    const nameRu = nameResRu.text || nameEn;

    const descEn = locResolver.resolve(row.Description, { locale: 'en', defaultNamespace: 'Pet', fallbackSourceRow: row }).text;
    const descRu = locResolver.resolve(row.Description, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet', fallbackSourceRow: row }).text || descEn;
    const quality = mapQuality(row.ItemQuality);

    const element = extractPetElementLeaf(row.PetElementType);
    const elementNorm = normalizePetElement(row.PetElementType);
    const roleLeaf = extractPetRoleLeaf(row.PetPropertyType);
    const roleNorm = normalizePetRole(row.PetPropertyType);

    totalEntities += 2; // photo, token
    const rawPhotoRef = row.PetActivatedIcon?.AssetPathName || row.PetPhoto?.AssetPathName || '';
    const rawIconRef = row.ItemIcon?.AssetPathName || '';

    const copiedPhoto = (rawPhotoRef && rawPhotoRef !== 'None') ? imageCopier.copyAsset('pets', rawPhotoRef, 'photos', { structured: true }) : null;
    if (copiedPhoto) {
      exactFieldMatches++;
      imageManifest[rawPhotoRef] = { full: copiedPhoto.full, thumb: copiedPhoto.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedToken = (rawIconRef && rawIconRef !== 'None') ? imageCopier.copyAsset('pets', rawIconRef, 'tokens', { structured: true }) : null;
    if (copiedToken) {
      exactFieldMatches++;
      imageManifest[rawIconRef] = { full: copiedToken.full, thumb: copiedToken.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    // Process MMO Pet Skills
    const rawSkills = Array.isArray(row.PetSkillDetail) ? row.PetSkillDetail : [];
    const skills = [];
    for (const s of rawSkills) {
      if (!s || typeof s !== 'object') continue;
      const sNameEn = locResolver.resolve(s.SkillName, { locale: 'en', defaultNamespace: 'Pet' }).text || '';
      const sNameRu = locResolver.resolve(s.SkillName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet' }).text || sNameEn;
      const sDescEn = locResolver.resolve(s.SkillDetail, { locale: 'en', defaultNamespace: 'Pet' }).text;
      const sDescRu = locResolver.resolve(s.SkillDetail, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Pet' }).text || sDescEn;
      const rawSkillIconRef = s.SkillIcon?.AssetPathName || '';

      totalEntities++;
      const copiedSkillIcon = (rawSkillIconRef && rawSkillIconRef !== 'None') ? imageCopier.copyAsset('pets', rawSkillIconRef, 'skills', { structured: true }) : null;
      if (copiedSkillIcon) {
        exactFieldMatches++;
        imageManifest[rawSkillIconRef] = { full: copiedSkillIcon.full, thumb: copiedSkillIcon.thumb, strategy: 'exact_config_field' };
      } else {
        unresolvedCount++;
      }

      const rawParams = Array.isArray(s.SkillStarsParam) ? s.SkillStarsParam : [];
      const resolvedDescEn = formatPetSkillDescription(sDescEn, rawParams, curveTableMap);
      const resolvedDescRu = formatPetSkillDescription(sDescRu, rawParams, curveTableMap);

      skills.push({
        name_en: sNameEn,
        name_ru: sNameRu,
        desc_en: resolvedDescEn,
        desc_ru: resolvedDescRu,
        icon: copiedSkillIcon?.full || undefined,
        icon_thumb: copiedSkillIcon?.thumb || undefined,
        media: {
          icon: {
            assetRef: rawSkillIconRef || 'None',
            rawExportPath: copiedSkillIcon?.sourcePng || '',
            fullUrl: copiedSkillIcon?.full || null,
            thumbUrl: copiedSkillIcon?.thumb || null,
            strategy: copiedSkillIcon ? 'exact_config_field' : (rawSkillIconRef && rawSkillIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
            diagnosticStatus: copiedSkillIcon ? 'resolved' : (rawSkillIconRef && rawSkillIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
            role: 'skill_icon',
            joinIdentity: mmoId
          }
        }
      });
    }

    const media = {
      photo: {
        assetRef: rawPhotoRef || 'None',
        rawExportPath: copiedPhoto?.sourcePng || '',
        fullUrl: copiedPhoto?.full || null,
        thumbUrl: copiedPhoto?.thumb || null,
        strategy: copiedPhoto ? 'exact_config_field' : (rawPhotoRef && rawPhotoRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedPhoto ? 'resolved' : (rawPhotoRef && rawPhotoRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        role: 'photo',
        joinIdentity: mmoId
      },
      token_icon: {
        assetRef: rawIconRef || 'None',
        rawExportPath: copiedToken?.sourcePng || '',
        fullUrl: copiedToken?.full || null,
        thumbUrl: copiedToken?.thumb || null,
        strategy: copiedToken ? 'exact_config_field' : (rawIconRef && rawIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedToken ? 'resolved' : (rawIconRef && rawIconRef !== 'None' ? 'missing_exported_png' : 'no_source_ref'),
        role: 'token_icon',
        joinIdentity: mmoId
      },
      source_edition: 'mmo'
    };

    const primaryUrl = copiedPhoto?.full || copiedToken?.full || undefined;
    const primaryThumb = copiedPhoto?.thumb || copiedToken?.thumb || undefined;

    const advPackKey = (row.PetAdvancePack || '').replace(/_adv$/i, '');
    // MMO combat pets do not use star advancements; ensure dummy/placeholder advancements copied from standard pets are not assigned
    const stars = undefined;
    const statsProgression = buildPetStatsProgression(row);

    items.push({
      id: mmoId,
      category: 'combat',
      source_edition: 'mmo',
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      desc_en: descEn,
      desc_ru: descRu,
      quality,
      element: element || null,
      element_norm: elementNorm || null,
      property: roleLeaf || null,
      role: roleLeaf || null,
      role_norm: roleNorm || null,
      icon: primaryUrl,
      icon_thumb: primaryThumb,
      photo: copiedPhoto?.full || undefined,
      photo_thumb: copiedPhoto?.thumb || undefined,
      token_icon: copiedToken?.full || undefined,
      token_icon_thumb: copiedToken?.thumb || undefined,
      stars: Array.isArray(stars) && stars.length > 0 ? stars : undefined,
      stats_progression: statsProgression || undefined,
      skills: skills.length > 0 ? skills : undefined,
      media
    });
  }

  // 3. Process Cute Pets (Decorative)
  for (const [id, row] of Object.entries(cuteRows)) {
    if (!row || typeof row !== 'object') continue;

    const nameResEn = locResolver.resolve(row.PetName, { locale: 'en', defaultNamespace: 'CutePet', fallbackCodename: id, fallbackSourceRow: row });
    const nameResRu = locResolver.resolve(row.PetName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'CutePet', fallbackCodename: id, fallbackSourceRow: row });
    const nameEn = nameResEn.text || id;
    const nameRu = nameResRu.text || nameEn;
    const descEn = locResolver.resolve(row.PetDesc, { locale: 'en', defaultNamespace: 'CutePet', fallbackSourceRow: row }).text;
    const descRu = locResolver.resolve(row.PetDesc, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'CutePet', fallbackSourceRow: row }).text || descEn;

    const petType = String(row.PetType || 'Common').replace(/^ECutePetType::/i, '');

    totalEntities++; // photo
    const rawPhotoRef = row.PetPhoto?.AssetPathName || '';
    const hasPhoto = rawPhotoRef && rawPhotoRef !== 'None';
    const copiedPhoto = hasPhoto ? imageCopier.copyAsset('pets', rawPhotoRef, 'photos', { structured: true }) : null;
    if (copiedPhoto) {
      exactFieldMatches++;
      imageManifest[rawPhotoRef] = { full: copiedPhoto.full, thumb: copiedPhoto.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const media = {
      photo: {
        assetRef: rawPhotoRef || 'None',
        rawExportPath: copiedPhoto?.sourcePng || '',
        fullUrl: copiedPhoto?.full || null,
        thumbUrl: copiedPhoto?.thumb || null,
        strategy: copiedPhoto ? 'exact_config_field' : (hasPhoto ? 'missing_exported_png' : 'no_source_ref'),
        diagnosticStatus: copiedPhoto ? 'resolved' : (hasPhoto ? 'missing_exported_png' : 'no_source_ref'),
        role: 'photo',
        joinIdentity: id
      },
      source_edition: 'standard'
    };

    items.push({
      id,
      category: 'cute',
      source_edition: 'standard',
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      desc_en: descEn || undefined,
      desc_ru: descRu || undefined,
      quality: 'SR',
      pet_type: petType,
      icon: copiedPhoto?.full || undefined,
      icon_thumb: copiedPhoto?.thumb || undefined,
      photo: copiedPhoto?.full || undefined,
      photo_thumb: copiedPhoto?.thumb || undefined,
      media
    });
  }

  const combinedModules = [
    ...moduleFamilies.map((f) => ({ ...f, level: 4 })),
    ...skillModules
  ];

  const outputData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: items.length,
    counts: {
      total: items.length,
      combat: items.filter((i) => i.category === 'combat').length,
      cute: items.filter((i) => i.category === 'cute').length,
      modules: skillModules.length,
      moduleFamilies: moduleFamilies.length,
      moduleLevels: skillModules.length
    },
    items,
    pets: items,
    modules: combinedModules,
    module_families: moduleFamilies
  };

  for (const dir of targetDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pets.json'), JSON.stringify(outputData, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'pets-image-manifest.json'), JSON.stringify(imageManifest, null, 2), 'utf8');
  }

  imageCopier.saveSharedManifest();
  const statsCount = imageCopier.getStats()['pets'] || 0;
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
    fs.writeFileSync(path.join(dir, 'pets-image-report.json'), JSON.stringify(imageReport, null, 2), 'utf8');
  }

  console.log(`[build-pets] Successfully generated ${items.length} pets (${outputData.counts.combat} combat, ${outputData.counts.cute} cute, ${moduleFamilies.length} module families [${outputData.counts.moduleLevels} levels]) to ${path.join(outDir, 'pets.json')}`);
  console.log('[build-pets] Image resolution report:', imageReport);
  return outputData;
}

if (require.main === module) {
  try {
    buildPetsDataset();
  } catch (err) {
    console.error('[build-pets] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildPetsDataset,
  cleanHtmlTags,
  mapQuality,
  normalizePetElement,
  extractPetElementLeaf,
  normalizePetRole,
  extractPetRoleLeaf,
  parseModuleBaseNameAndOwner,
  formatVal,
  normalizeSkillFormulaSpacing,
  findCurveValue,
  formatPetSkillDescription,
};
