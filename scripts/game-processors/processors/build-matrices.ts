import { readGameSourceFileSync, projectsCjkCulture } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';
import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';
import { CANONICAL_SLUG_MAP, resolveElements, resolveWeaponRole } from './build-simulacra';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-matrices] Error reading JSON at ${filePath}:`, e.message);
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

function loadAllCurveTables(rawDir) {
  const curveTables: Record<string, any> = {};
  if (!rawDir || !fs.existsSync(rawDir)) return curveTables;

  const skipDirs = new Set<any>(['node_modules', '.git', 'temperary', 'export-scan', 'media', '.system_generated', 'dist', 'item', 'character', 'quest', 'dialogue', 'map', 'sound', 'ui', 'animation', 'effect', 'particle', 'localization', 'text', 'buff']);

  function walk(dir, depth = 0) {
    if (depth > 6) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const n = entry.name.toLowerCase();
          if (skipDirs.has(n)) continue;
          walk(full, depth + 1);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          if (/EffectFigure|Formula|ThunderDataTable|Matrix.*Curve|CurveTable|Suit.*Curve/i.test(entry.name)) {
            try {
              const data = readJsonFile(full);
              if (!data) continue;
              const rows = Array.isArray(data) && data[0]?.Rows ? data[0].Rows : (data.Rows || null);
              if (rows && typeof rows === 'object') {
                const baseName = path.basename(entry.name, '.json').toLowerCase();
                curveTables[baseName] = rows;
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  walk(rawDir);
  return curveTables;
}

function evaluateCurveValue(curveTables, curveObj, paramMultiplier = 100, outMeta = null) {
  if (!curveObj) return paramMultiplier;
  const rawTableName = curveObj.CurveTable?.ObjectName
    ? String(curveObj.CurveTable.ObjectName).replace(/^CurveTable'|'$/g, '')
    : (curveObj.CurveTable?.ObjectPath ? String(curveObj.CurveTable.ObjectPath) : (typeof curveObj.CurveTable === 'string' ? curveObj.CurveTable : ''));
  const rowName = curveObj.RowName ? String(curveObj.RowName) : '';

  if (!rawTableName || !rowName) return paramMultiplier;

  const stripped = rawTableName.includes('.') ? rawTableName.split('.')[0] : rawTableName;
  const leafName = path.basename(stripped.replace(/\\/g, '/')).toLowerCase();
  const keyLower = leafName;
  const withoutOverseas = keyLower.replace(/_overseas?$/i, '').replace(/_os$/i, '');
  const withOverseas = withoutOverseas + '_overseas';
  const withOversea = withoutOverseas + '_oversea';
  const withOs = withoutOverseas + '_os';
  let isOverseas = false;
  let table = null;

  if (curveTables[withOverseas]) {
    table = curveTables[withOverseas];
    isOverseas = true;
  } else if (curveTables[withOversea]) {
    table = curveTables[withOversea];
    isOverseas = true;
  } else if (curveTables[withOs]) {
    table = curveTables[withOs];
    isOverseas = true;
  } else if (curveTables[keyLower]) {
    table = curveTables[keyLower];
    isOverseas = /_overseas?$/i.test(keyLower) || /_os$/i.test(keyLower);
  } else if (curveTables[withoutOverseas]) {
    table = curveTables[withoutOverseas];
    isOverseas = false;
  }

  if (outMeta && typeof outMeta === 'object') {
    outMeta.isOverseas = isOverseas;
    outMeta.tableName = rawTableName;
  }

  if (table) {
    const row = table[rowName] || Object.entries(table).find(([k]) => k.toLowerCase() === rowName.toLowerCase())?.[1];
    if (row && Array.isArray(row.Keys) && row.Keys.length > 0) {
      const rawVal = Number(row.Keys[0].Value ?? 0);
      const mult = typeof paramMultiplier === 'number' && paramMultiplier !== 0 ? paramMultiplier : 1;
      const computed = rawVal * mult;
      return Math.round(computed * 100) / 100;
    }
  }

  return null;
}

function formatEffectTextWithValues(template, values) {
  if (!template) return '';
  let res = template;
  for (let i = 0; i < values.length; i++) {
    const placeholder = new RegExp(`\\{${i}\\}`, 'g');
    res = res.replace(placeholder, values[i]);
  }
  return res;
}

function parseRichTextSegments(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const rawClean = rawText.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  const tagRegex = /<([a-zA-Z0-9_-]+)[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+)?>/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  const isNumericContent = (str) => {
    const s = str.trim();
    return /^[\s\d+\-.,/%{}()sсекx×]+$/i.test(s) && (/\d/.test(s) || /\{\d+\}/.test(s));
  };

  const splitTextAndNumbers = (plainSlice) => {
    if (!plainSlice) return [];
    const numRegex = /(\+?\d+(?:[.,]\d+)?(?:%|\/\d+(?:[.,]\d+)?%*)*|\{\d+\}(?:%|\/\{\d+\}%*)*)/g;
    const result = [];
    let curIdx = 0;
    let numMatch;
    while ((numMatch = numRegex.exec(plainSlice)) !== null) {
      if (numMatch.index > curIdx) {
        result.push({ t: 'text', s: plainSlice.slice(curIdx, numMatch.index) });
      }
      result.push({ t: 'num', s: numMatch[0] });
      curIdx = numMatch.index + numMatch[0].length;
    }
    if (curIdx < plainSlice.length) {
      result.push({ t: 'text', s: plainSlice.slice(curIdx) });
    }
    return result;
  };

  while ((match = tagRegex.exec(rawClean)) !== null) {
    if (match.index > lastIndex) {
      const before = rawClean.slice(lastIndex, match.index);
      segments.push(...splitTextAndNumbers(before));
    }

    const tagName = match[1].toLowerCase();
    const tagContent = match[2];

    if (tagName === 'shuzhi') {
      if (isNumericContent(tagContent)) {
        segments.push({ t: 'num', s: tagContent });
      } else {
        segments.push({ t: 'keyword', s: tagContent });
      }
    } else if (tagName === 'blue') {
      segments.push({ t: 'keyword', s: tagContent });
    } else if (['orange', 'purple', 'red', 'green'].includes(tagName)) {
      if (isNumericContent(tagContent)) {
        segments.push({ t: 'num', s: tagContent });
      } else {
        segments.push({ t: 'keyword', s: tagContent });
      }
    } else {
      if (isNumericContent(tagContent)) {
        segments.push({ t: 'num', s: tagContent });
      } else {
        segments.push({ t: 'text', s: tagContent });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < rawClean.length) {
    segments.push(...splitTextAndNumbers(rawClean.slice(lastIndex)));
  }

  const merged = [];
  for (const seg of segments) {
    if (!seg.s) continue;
    if (merged.length > 0 && merged[merged.length - 1].t === seg.t) {
      merged[merged.length - 1].s += seg.s;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

function interpolateSegments(segments, values) {
  const cloned = segments.map((seg) => {
    let s = seg.s;
    for (let i = 0; i < values.length; i++) {
      s = s.replace(new RegExp(`\\{${i}\\}`, 'g'), values[i]);
    }
    s = s.replace(/\{[0-9]+\}%?/g, '—').replace(/\{[^{}]*\}/g, '—');
    return { t: seg.t, s };
  });

  const finalSegs = [];
  for (const seg of cloned) {
    if (seg.t === 'text') {
      const numRegex = /(\+?\d+(?:[.,]\d+)?(?:%|\/\d+(?:[.,]\d+)?%*)*)/g;
      let cur = 0;
      let m;
      while ((m = numRegex.exec(seg.s)) !== null) {
        if (m.index > cur) {
          finalSegs.push({ t: 'text', s: seg.s.slice(cur, m.index) });
        }
        finalSegs.push({ t: 'num', s: m[0] });
        cur = m.index + m[0].length;
      }
      if (cur < seg.s.length) {
        finalSegs.push({ t: 'text', s: seg.s.slice(cur) });
      }
    } else {
      finalSegs.push(seg);
    }
  }

  const merged = [];
  for (const seg of finalSegs) {
    if (!seg.s) continue;
    if (merged.length > 0 && merged[merged.length - 1].t === seg.t) {
      merged[merged.length - 1].s += seg.s;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

function segmentsToPlainText(segments) {
  return segments.map((s) => s.s).join('');
}

function segmentsToHtml(segments) {
  return segments.map((seg) => {
    const safeStr = seg.s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    if (seg.t === 'num') {
      return `<span class="mx-num">${safeStr}</span>`;
    }
    if (seg.t === 'keyword') {
      return `<span class="mx-kw">${safeStr}</span>`;
    }
    return safeStr;
  }).join('');
}

function mergeTableWithOverseas(rawDir, baseCandidates, overseasCandidates, tableName) {
  const basePath = findFile(rawDir, baseCandidates);
  const osPath = findFile(rawDir, overseasCandidates);

  const rawBase = basePath ? readJsonFile(basePath) : null;
  const rawOs = osPath ? readJsonFile(osPath) : null;

  const baseRows = Array.isArray(rawBase) && rawBase[0]?.Rows ? rawBase[0].Rows : (rawBase?.Rows || rawBase || {});
  const osRows = Array.isArray(rawOs) && rawOs[0]?.Rows ? rawOs[0].Rows : (rawOs?.Rows || rawOs || {});

  let replacedCount = 0;
  let keptBaseCount = 0;
  let osOnlyCount = 0;

  const merged = { ...baseRows };
  const osKeySet = new Set<any>(Object.keys(osRows));

  for (const [key, val] of Object.entries(osRows)) {
    if (merged.hasOwnProperty(key)) {
      replacedCount++;
    } else {
      osOnlyCount++;
    }
    merged[key] = val;
  }
  for (const key of Object.keys(baseRows)) {
    if (!osKeySet.has(key)) {
      keptBaseCount++;
    }
  }

  const stat = {
    tableName: tableName || 'table',
    baseCount: Object.keys(baseRows).length,
    overseasCount: Object.keys(osRows).length,
    replacedCount,
    keptBaseCount,
    osOnlyCount,
    totalMerged: Object.keys(merged).length,
    baseSource: basePath ? path.basename(basePath) : null,
    overseasSource: osPath ? path.basename(osPath) : null
  };

  console.log(`[build-matrices] Merged ${stat.tableName}: ${stat.totalMerged} rows (${stat.replacedCount} replaced by OS, ${stat.keptBaseCount} kept base, ${stat.osOnlyCount} OS-only)`);

  return {
    rows: merged,
    stat,
    isOverseas: (key) => osKeySet.has(key)
  };
}

function buildMatricesDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'info', 'matrices', 'data');
  const imageCopier = new ImageCopier(rawDir, projectRoot);

  console.log(`[build-matrices] Project root: ${projectRoot}`);
  console.log(`[build-matrices] Raw data dir: ${rawDir}`);

  // Locate source tables with base ∪ overseas row MERGE (overseas values win on collision)
  const suitMerge = mergeTableWithOverseas(
    rawDir,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/WeaponMatrix/StaticMatrixSuitDataTable.json',
      'StaticMatrixSuitDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticMatrixSuitDataTable_Overseas.json',
      'StaticMatrixSuitDataTable_Overseas.json'
    ],
    'StaticMatrixSuitDataTable'
  );

  const pieceMerge = mergeTableWithOverseas(
    rawDir,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/WeaponMatrix/StaticMatrixData.json',
      'StaticMatrixData.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticMatrixData_Overseas.json',
      'StaticMatrixData_Overseas.json'
    ],
    'StaticMatrixData'
  );

  const suitDataMerge = mergeTableWithOverseas(
    rawDir,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/WeaponMatrix/MatrixSuitData.json',
      'MatrixSuitData.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/MatrixSuitData_Overseas.json',
      'MatrixSuitData_Overseas.json'
    ],
    'MatrixSuitData'
  );

  const weaponMerge = mergeTableWithOverseas(
    rawDir,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/StaticWeaponDataTable.json',
      'StaticWeaponDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticWeaponDataTable_Overseas.json',
      'StaticWeaponDataTable_Overseas.json'
    ],
    'StaticWeaponDataTable'
  );

  const geTipsMerge = mergeTableWithOverseas(
    rawDir,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/GameplayEffectTipsDataTable.json',
      'GameplayEffectTipsDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/GameplayEffectTipsDataTable_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Skill/GameplayEffectTipsDataTable_Overseas.json',
      'GameplayEffectTipsDataTable_Overseas.json'
    ],
    'GameplayEffectTipsDataTable'
  );
  const geTipsRows = geTipsMerge.rows;

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

  // Load canonical simulacra media registry for character cross-links
  const simulacraRegistryCandidates = [
    path.join(projectRoot, 'info', 'simulacra', 'data', 'simulacra-media-registry.json')
  ];
  let simulacraRegistry: Record<string, any> = {};
  for (const cand of simulacraRegistryCandidates) {
    if (fs.existsSync(cand)) {
      simulacraRegistry = readJsonFile(cand) || {};
      break;
    }
  }

  // Also augment from simulacra-index.json if present
  const simulacraIndexCandidates = [
    path.join(projectRoot, 'info', 'simulacra', 'data', 'simulacra-index.json')
  ];
  let simIndexFile = null;
  for (const cand of simulacraIndexCandidates) {
    if (fs.existsSync(cand)) {
      simIndexFile = cand;
      break;
    }
  }
  if (simIndexFile) {
    try {
      const simItems = readJsonFile(simIndexFile);
      const itemsList = Array.isArray(simItems) ? simItems : (simItems?.items || []);
      for (const item of itemsList) {
        if (!item) continue;
        const entry = {
          id: item.id,
          name_en: item.name_en,
          name_ru: item.name_ru,
          avatar: item.avatar,
          avatar_thumb: item.avatar_thumb,
          portrait: item.portrait,
          portrait_thumb: item.portrait_thumb,
          weapon_id: item.weapon_id
        };
        if (item.weapon_id) {
          const wk = item.weapon_id.toLowerCase();
          if (!simulacraRegistry[wk]) simulacraRegistry[wk] = entry;
          if (!simulacraRegistry[item.weapon_id]) simulacraRegistry[item.weapon_id] = entry;
        }
        if (item.id && !simulacraRegistry[item.id.toLowerCase()]) {
          simulacraRegistry[item.id.toLowerCase()] = entry;
        }
        if (item.imitation_id && !simulacraRegistry[item.imitation_id.toLowerCase()]) {
          simulacraRegistry[item.imitation_id.toLowerCase()] = entry;
        }
      }
    } catch (e) {}
  }

  if (suitMerge.stat.totalMerged === 0) {
    console.error('[build-matrices] Critical: StaticMatrixSuitDataTable not found in rawDir');
    return null;
  }

  const locResolver = createLocalizationResolver();
  if (locEnRaw) locResolver.loadLocale('en', readJsonFile(locEnRaw));
  if (locRuRaw) locResolver.loadLocale('ru', readJsonFile(locRuRaw));

  const curveTables = loadAllCurveTables(rawDir);

  const suitRows = suitMerge.rows;
  const pieceRows = pieceMerge.rows;
  const suitDataRows = suitDataMerge.rows;
  const weaponRows = weaponMerge.rows;

  const tableMergeStats = {
    StaticMatrixSuitDataTable: suitMerge.stat,
    StaticMatrixData: pieceMerge.stat,
    MatrixSuitData: suitDataMerge.stat,
    StaticWeaponDataTable: weaponMerge.stat,
    GameplayEffectTipsDataTable: geTipsMerge.stat
  };

  let totalEntities = 0;
  let exactFieldMatches = 0;
  let joinMatches = 0;
  let namingMatches = 0;
  let curatedMatches = 0;
  let unresolvedCount = 0;
  const imageManifest: Record<string, any> = {};

  // 1. Process individual piece items from StaticMatrixData strictly grouped by SuitID
  const piecesBySuit: Record<string, any> = {};
  for (const [pieceKey, pRow] of Object.entries(pieceRows)) {
    if (!pRow || typeof pRow !== 'object') continue;
    const suitIdRef = String(pRow.SuitID || '').trim();
    if (!suitIdRef || suitIdRef === 'None') continue;

    const sKey = suitIdRef.toLowerCase();
    if (!piecesBySuit[sKey]) piecesBySuit[sKey] = [];

    // Slot mapping
    let slotNum = 1;
    let slotNameEn = 'Mind';
    let slotNameRu = 'Разум';
    const slotStr = String(pRow.SlotIndex || '');
    if (slotStr.includes('FIRST') || slotStr === '1') {
      slotNum = 1; slotNameEn = 'Mind'; slotNameRu = 'Разум';
    } else if (slotStr.includes('SECOND') || slotStr === '2') {
      slotNum = 2; slotNameEn = 'Memory'; slotNameRu = 'Память';
    } else if (slotStr.includes('THIRD') || slotStr === '3') {
      slotNum = 3; slotNameEn = 'Belief'; slotNameRu = 'Вера';
    } else if (slotStr.includes('FOURTH') || slotStr === '4') {
      slotNum = 4; slotNameEn = 'Emotion'; slotNameRu = 'Эмоция';
    }

    const pieceNameEn = locResolver.resolve(pRow.ItemName, { locale: 'en', defaultNamespace: 'StaticMatrixData', fallbackCodename: pieceKey }).text || pieceKey;
    const pieceNameRu = locResolver.resolve(pRow.ItemName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'StaticMatrixData', fallbackCodename: pieceKey }).text || pieceNameEn;
    const rawPieceDescEn = locResolver.resolve(pRow.Description || pRow.LotteryDescription, { locale: 'en', defaultNamespace: 'StaticMatrixData', clean: false }).text || '';
    const rawPieceDescRu = locResolver.resolve(pRow.Description || pRow.LotteryDescription, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'StaticMatrixData', clean: false }).text || rawPieceDescEn;
    const pieceSegsEn = parseRichTextSegments(rawPieceDescEn);
    const pieceSegsRu = parseRichTextSegments(rawPieceDescRu);
    const pieceDescEn = segmentsToPlainText(pieceSegsEn);
    const pieceDescRu = segmentsToPlainText(pieceSegsRu);
    const pieceHtmlEn = segmentsToHtml(pieceSegsEn);
    const pieceHtmlRu = segmentsToHtml(pieceSegsRu);

    // Piece media resolution (ItemLargeIcon -> ItemIcon -> LotteryCardImage)
    totalEntities++;
    const rawPieceIconRef = (pRow.ItemLargeIcon?.AssetPathName && pRow.ItemLargeIcon.AssetPathName !== 'None')
      ? pRow.ItemLargeIcon.AssetPathName
      : ((pRow.ItemIcon?.AssetPathName && pRow.ItemIcon.AssetPathName !== 'None')
        ? pRow.ItemIcon.AssetPathName
        : (pRow.LotteryCardImage?.AssetPathName || ''));

    const copiedPieceIcon = rawPieceIconRef && rawPieceIconRef !== 'None'
      ? imageCopier.copyAsset('matrices', rawPieceIconRef, 'pieces', { structured: true })
      : null;

    if (copiedPieceIcon) {
      exactFieldMatches++;
      imageManifest[rawPieceIconRef] = { full: copiedPieceIcon.full, thumb: copiedPieceIcon.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const pieceProvenance = {
      assetRef: rawPieceIconRef || 'None',
      rawExportPath: copiedPieceIcon?.sourcePng || '',
      fullUrl: copiedPieceIcon?.full || null,
      thumbUrl: copiedPieceIcon?.thumb || null,
      strategy: copiedPieceIcon ? 'exact_config_field' : 'unresolved',
      joinIdentity: `${suitIdRef}_slot_${slotNum}`
    };

    piecesBySuit[sKey].push({
      id: pieceKey,
      suit_id: suitIdRef,
      slot: slotNum,
      slot_name_en: slotNameEn,
      slot_name_ru: slotNameRu,
      name_en: pieceNameEn,
      name_ru: pieceNameRu,
      description_en: pieceDescEn,
      description_ru: pieceDescRu,
      segments_en: pieceSegsEn,
      segments_ru: pieceSegsRu,
      html_en: pieceHtmlEn,
      html_ru: pieceHtmlRu,
      icon: copiedPieceIcon?.full || '',
      icon_thumb: copiedPieceIcon?.thumb || '',
      piece_media: pieceProvenance
    });
  }

  // Sort pieces within each suit by slot (1..4)
  for (const sKey of Object.keys(piecesBySuit)) {
    piecesBySuit[sKey].sort((a, b) => a.slot - b.slot);
  }

  // 2. Pre-process weapon carriers strictly by 1-to-1 signature weapon join
  const BOSS_AND_GENERIC_SUITS = new Set<any>([
    'suit_ssr25', 'suit_ssr26',
    'suit_sr1', 'suit_sr2', 'suit_sr3', 'suit_sr4', 'suit_sr5',
    'suit_r1', 'suit_r2', 'suit_r3', 'suit_r4', 'suit_r6', 'suit_r7',
    'suit_n1', 'suit_n2'
  ]);

  const SIGNATURE_OVERRIDES = {
    'suit_ssr3': 'stave_ice',        // Cocoritter (Absolute Zero)
    'suit_ssr4': 'sickle_fire',      // KING (Scythe of the Crow)
    'suit_ssr8': 'cube_fire',        // Zero (Negating Cube)
    'suit_ssr9': 'dgun_thunder',     // Samir (Dual EM Stars)
    'suit_ssr11': 'digger_thunder',  // Crow (Thunderblades)
    'suit_sr6': 'stave_thunder',     // Pepper (Staff of Scars)
    'suit_sr7': 'cannon_ice',        // Hilda (The Terminator)
    'suit_sr8': 'hammer_ice',        // Ene (Pummeler)
    'suit_sr9': 'bow_physic',        // Bai Ling (Nightingale's Feather)
    'suit_sr12': 'spear_thunder'     // Echo (Thunderous Halberd)
  };

  const CANONICAL_CARRIER_OVERRIDES = {
    'mark_physic': { id: 'make', name_en: 'Marc', name_ru: 'Марк' },
    'mark': { id: 'make', name_en: 'Marc', name_ru: 'Марк' },
    'immortal_thunder': { id: 'baiyuekui', name_en: 'Bai Yuekui', name_ru: 'Бай Юкеи' },
    'immortal': { id: 'baiyuekui', name_en: 'Bai Yuekui', name_ru: 'Бай Юкеи' },
    'violin_thunder': { id: 'violin', name_en: 'Harmopheus', name_ru: 'Harmopheus' },
    'violin': { id: 'violin', name_en: 'Harmopheus', name_ru: 'Harmopheus' },
    'skull_fire': { id: 'skull', name_en: 'Bonecrush', name_ru: 'Костяная дробь' },
    'skull': { id: 'skull', name_en: 'Bonecrush', name_ru: 'Костяная дробь' },
    'zoey_phy': { id: 'zoey', name_en: 'Zoey', name_ru: 'Зои' },
    'zoey': { id: 'zoey', name_en: 'Zoey', name_ru: 'Зои' },
    'gefion_ice': { id: 'gefion', name_en: 'Gefion', name_ru: 'Гефион' },
    'gefion': { id: 'gefion', name_en: 'Gefion', name_ru: 'Гефион' },
    'bigsword_ice': { id: 'meryl', name_en: 'Meryl', name_ru: 'Мэрил' },
    'bigsword': { id: 'meryl', name_en: 'Meryl', name_ru: 'Мэрил' },
    'antoria_thunder': { id: 'antoria', name_en: 'Antoria', name_ru: 'Антория' },
    'antoria': { id: 'antoria', name_en: 'Antoria', name_ru: 'Антория' }
  };

  const baseWeapons: Record<string, any> = {};
  for (const [wKey, wRow] of Object.entries(weaponRows)) {
    if (!wRow || typeof wRow !== 'object') continue;

    const wKeyLower = wKey.toLowerCase();
    if (
      wKeyLower.includes('fashion') ||
      wKeyLower.includes('level') ||
      wKeyLower.match(/_?lv\d+$/i) ||
      wKeyLower.includes('test') ||
      wKeyLower.includes('show') ||
      wKeyLower.includes('breakfate') ||
      wKeyLower.includes('imitation') ||
      wKeyLower.includes('outbreak') ||
      wKeyLower.startsWith('weapon_exp') ||
      wKeyLower.startsWith('exp_') ||
      wKeyLower.startsWith('dwsk_') ||
      wKeyLower === 'weapon_handbp'
    ) {
      continue;
    }

    if (wRow.ItemRarity !== 'EItemRarity::ITEM_RARITY_SSR' && wRow.ItemRarity !== 'EItemRarity::ITEM_RARITY_SR') {
      continue;
    }

    baseWeapons[wKeyLower] = { key: wKey, row: wRow };
  }

  // Build authoritative 1-to-1 suit -> weapon mapping
  const suitToWeaponKey: Record<string, any> = {};
  for (const [wKeyLower, { key: wKey, row: wRow }] of Object.entries(baseWeapons)) {
    if (Array.isArray(wRow.MatrixSuitArray) && wRow.MatrixSuitArray.length > 0) {
      const firstSuit = String(wRow.MatrixSuitArray[0].MatrixSuitName || '').toLowerCase();
      if (wKeyLower === 'digger_thunder') {
        suitToWeaponKey['suit_ssr11'] = wKey;
      } else if (firstSuit && !suitToWeaponKey[firstSuit] && !BOSS_AND_GENERIC_SUITS.has(firstSuit)) {
        suitToWeaponKey[firstSuit] = wKey;
      }
    }
  }
  for (const [sKey, wKey] of Object.entries(SIGNATURE_OVERRIDES)) {
    suitToWeaponKey[sKey.toLowerCase()] = wKey;
  }

  const carriersBySuit: Record<string, any> = {};
  for (const [sKey, wKey] of Object.entries(suitToWeaponKey)) {
    if (BOSS_AND_GENERIC_SUITS.has(sKey)) {
      carriersBySuit[sKey] = [];
      continue;
    }

    const baseObj = baseWeapons[wKey.toLowerCase()];
    if (!baseObj) continue;
    const { key: actualWKey, row: wRow } = baseObj;
    const wKeyLower = actualWKey.toLowerCase();

    const wNameEn = locResolver.resolve(wRow.ItemName, { locale: 'en', defaultNamespace: 'Weapon', fallbackCodename: actualWKey }).text || actualWKey;
    const wNameRu = locResolver.resolve(wRow.ItemName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'Weapon', fallbackCodename: actualWKey }).text || wNameEn;

    // Resolve authoritative elements (primary + secondary) and role
    const { primary: rawPrimary, secondary: elementSecondary } = resolveElements(actualWKey, wRow, geTipsRows);
    const element = rawPrimary === 'Frost' ? 'Ice' : rawPrimary;
    const role = resolveWeaponRole(wRow);

    const weaponIconRef = wRow.ItemLargeIcon?.AssetPathName || wRow.WeaponIconForMatrix?.AssetPathName || '';
    const avatarRef = wRow.LotteryDrawing?.AssetPathName || wRow.LotteryCardImage?.AssetPathName || '';

    // Lookup canonical character info
    const charBase = actualWKey.split('_')[0];
    const fashionId = wRow.WeaponFashionID ? String(wRow.WeaponFashionID).toLowerCase() : '';
    const canonicalEntry =
      simulacraRegistry[actualWKey] ||
      simulacraRegistry[wKeyLower] ||
      (fashionId && (simulacraRegistry[fashionId] || simulacraRegistry[wRow.WeaponFashionID])) ||
      simulacraRegistry[charBase.toLowerCase()] ||
      simulacraRegistry[charBase] ||
      null;

    const fallbackCarrier = CANONICAL_CARRIER_OVERRIDES[actualWKey.toLowerCase()] ||
      CANONICAL_CARRIER_OVERRIDES[charBase.toLowerCase()] ||
      (fashionId && CANONICAL_CARRIER_OVERRIDES[fashionId]) ||
      null;

    const charId = canonicalEntry?.id || fallbackCarrier?.id || CANONICAL_SLUG_MAP[charBase.toLowerCase()] || CANONICAL_SLUG_MAP[wKeyLower] || charBase.toLowerCase();
    const charNameEn = canonicalEntry?.name_en || fallbackCarrier?.name_en || wNameEn || '';
    const charNameRu = canonicalEntry?.name_ru || fallbackCarrier?.name_ru || wNameRu || charNameEn;

    totalEntities += 2; // weapon icon + avatar

    const copiedWeaponIcon = weaponIconRef ? imageCopier.copyAsset('matrices', weaponIconRef, 'weapons', { structured: true }) : null;
    if (copiedWeaponIcon) {
      exactFieldMatches++;
      imageManifest[weaponIconRef] = { full: copiedWeaponIcon.full, thumb: copiedWeaponIcon.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const copiedAvatar = avatarRef ? imageCopier.copyAsset('matrices', avatarRef, 'avatars', { structured: true }) : null;
    if (copiedAvatar) {
      exactFieldMatches++;
      imageManifest[avatarRef] = { full: copiedAvatar.full, thumb: copiedAvatar.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const weaponProvenance = {
      assetRef: weaponIconRef || 'None',
      rawExportPath: copiedWeaponIcon?.sourcePng || '',
      fullUrl: copiedWeaponIcon?.full || null,
      thumbUrl: copiedWeaponIcon?.thumb || null,
      strategy: copiedWeaponIcon ? 'exact_config_field' : 'unresolved',
      joinIdentity: actualWKey
    };

    const avatarProvenance = {
      assetRef: avatarRef || 'None',
      rawExportPath: copiedAvatar?.sourcePng || '',
      fullUrl: copiedAvatar?.full || null,
      thumbUrl: copiedAvatar?.thumb || null,
      strategy: copiedAvatar ? 'exact_config_field' : 'unresolved',
      joinIdentity: actualWKey
    };

    let recEn = '';
    let recRu = '';
    if (Array.isArray(wRow.MatrixSuitArray)) {
      const matchRec = wRow.MatrixSuitArray.find((e) => String(e.MatrixSuitName || '').toLowerCase() === sKey);
      if (matchRec && matchRec.MatrixSuitDes) {
        recEn = locResolver.resolve(matchRec.MatrixSuitDes, { locale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable' }).text || '';
        recRu = locResolver.resolve(matchRec.MatrixSuitDes, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable' }).text || '';
      }
    }

    carriersBySuit[sKey] = [{
      weapon_id: actualWKey,
      char_id: charId,
      char_name_en: charNameEn,
      char_name_ru: charNameRu,
      weapon_name_en: wNameEn,
      weapon_name_ru: wNameRu,
      element,
      element_secondary: elementSecondary || null,
      role,
      icon: copiedWeaponIcon?.full || '',
      icon_thumb: copiedWeaponIcon?.thumb || '',
      avatar: copiedAvatar?.full || '',
      avatar_thumb: copiedAvatar?.thumb || '',
      weapon_icon_media: weaponProvenance,
      avatar_media: avatarProvenance,
      recommendation_en: recEn,
      recommendation_ru: recRu
    }];
  }

    // 3. Pre-index MatrixSuitData rows by base suit id
  const matrixSuitDataByBase: Record<string, any> = {};
  for (const [sKey, sRow] of Object.entries(suitDataRows)) {
    if (!sRow || typeof sRow !== 'object') continue;
    const parts = sKey.split('_');
    const starIdx = parts.length > 2 ? Number(parts[parts.length - 1]) : 0;
    const baseId = parts.slice(0, parts.length - 1).join('_').toLowerCase();

    if (!matrixSuitDataByBase[baseId]) matrixSuitDataByBase[baseId] = {};
    matrixSuitDataByBase[baseId][starIdx] = sRow;
  }

  const items = [];

  for (const [suitId, suit] of Object.entries(suitRows)) {
    if (!suit || typeof suit !== 'object') continue;

    const suitIdLower = suitId.toLowerCase();
    const quality = mapQuality(suit.MatrixSuitQuality);
    const nameResEn = locResolver.resolve(suit.SuitName, { locale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable', fallbackCodename: suitId });
    const nameResRu = locResolver.resolve(suit.SuitName, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable', fallbackCodename: suitId });
    let nameEn = nameResEn.text || suitId;
    let nameRu = nameResRu.text || nameEn;

    const hasCjk = (str) => !projectsCjkCulture() && /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(str || '');
    if (hasCjk(nameEn)) {
      console.warn(`[build-matrices] Warning: CJK detected in name_en for ${suitId} ("${nameEn}"). Falling back to codename.`);
      nameEn = suitId;
    }
    if (hasCjk(nameRu) && !hasCjk(nameEn)) {
      nameRu = nameEn;
    }

    // Exact suit icons:
    // Priority 1: SuitIcon (e.g. avatar_yizhitips_Lechesis_big or avatar_matrix_SSR61_256)
    // Priority 2: SuitIconTemp (e.g. tips_icon_SSR70)
    // Never fall back to SuitRemouldIcon for suit.icon (that is carrier portrait)
    totalEntities += 2; // suit icon + remould icon

    const rawSuitIconRef = (suit.SuitIcon?.AssetPathName && suit.SuitIcon.AssetPathName !== 'None')
      ? suit.SuitIcon.AssetPathName
      : ((suit.SuitIconTemp?.AssetPathName && suit.SuitIconTemp.AssetPathName !== 'None')
        ? suit.SuitIconTemp.AssetPathName
        : '');

    const rawRemouldRef = (suit.SuitRemouldIcon?.AssetPathName && suit.SuitRemouldIcon.AssetPathName !== 'None')
      ? suit.SuitRemouldIcon.AssetPathName
      : '';

    const copiedSuitIcon = rawSuitIconRef
      ? imageCopier.copyAsset('matrices', rawSuitIconRef, 'suits', { structured: true, entityId: suitId })
      : null;

    if (copiedSuitIcon) {
      exactFieldMatches++;
      imageManifest[rawSuitIconRef] = { full: copiedSuitIcon.full, thumb: copiedSuitIcon.thumb, strategy: 'exact_config_field' };
    } else if (rawSuitIconRef) {
      unresolvedCount++;
    }

    const copiedRemould = rawRemouldRef
      ? imageCopier.copyAsset('matrices', rawRemouldRef, 'remoulds', { structured: true, entityId: suitId })
      : null;

    if (copiedRemould) {
      exactFieldMatches++;
      imageManifest[rawRemouldRef] = { full: copiedRemould.full, thumb: copiedRemould.thumb, strategy: 'exact_config_field' };
    } else if (rawRemouldRef) {
      unresolvedCount++;
    }

    const suitIconProvenance = {
      assetRef: rawSuitIconRef || 'None',
      rawExportPath: copiedSuitIcon?.sourcePng || '',
      fullUrl: copiedSuitIcon?.full || null,
      thumbUrl: copiedSuitIcon?.thumb || null,
      strategy: copiedSuitIcon ? 'exact_config_field' : (rawSuitIconRef ? 'missing_exported_png' : 'no_source_ref'),
      diagnosticStatus: copiedSuitIcon ? 'resolved' : (rawSuitIconRef ? 'missing_exported_png' : 'no_source_ref'),
      joinIdentity: suitId
    };

    const remouldProvenance = {
      assetRef: rawRemouldRef || 'None',
      rawExportPath: copiedRemould?.sourcePng || '',
      fullUrl: copiedRemould?.full || null,
      thumbUrl: copiedRemould?.thumb || null,
      strategy: copiedRemould ? 'exact_config_field' : (rawRemouldRef ? 'missing_exported_png' : 'no_source_ref'),
      diagnosticStatus: copiedRemould ? 'resolved' : (rawRemouldRef ? 'missing_exported_png' : 'no_source_ref'),
      joinIdentity: suitId
    };

    const detailList = Array.isArray(suit.SuitUnactivateDetailList) ? suit.SuitUnactivateDetailList : [];
    const paramList = Array.isArray(suit.SuitUnactivateDetailParams) ? suit.SuitUnactivateDetailParams : [];

    const effects = [];

    for (let i = 0; i < detailList.length; i++) {
      const detailFText = detailList[i];
      const resTemplateEn = locResolver.resolve(detailFText, { locale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable', clean: false });
      const rawTemplateEn = resTemplateEn.text;
      const resTemplateRu = locResolver.resolve(detailFText, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable', clean: false });
      const rawTemplateRu = resTemplateRu.text || rawTemplateEn;

      const templateEn = segmentsToPlainText(parseRichTextSegments(rawTemplateEn));
      const templateRu = segmentsToPlainText(parseRichTextSegments(rawTemplateRu));

      const scalableParams = Array.isArray(paramList[i]?.ScalableFloatParams)
        ? paramList[i].ScalableFloatParams
        : [];

      const resolvedValues = [];
      const curveMetas = [];
      for (const p of scalableParams) {
        const meta = { isOverseas: false, tableName: '' };
        const val = evaluateCurveValue(curveTables, p.Curve, Number(p.Value ?? 100), meta);
        resolvedValues.push(val !== null ? val : Number(p.Value ?? 0));
        curveMetas.push(meta);
      }

      const count = (detailList.length === 1 && quality !== 'SSR') ? 3 : (i === 0 ? 2 : 4);

      // Interpolate values into EN and RU templates with typed segments
      const segsEn = interpolateSegments(parseRichTextSegments(rawTemplateEn), resolvedValues);
      const segsRu = interpolateSegments(parseRichTextSegments(rawTemplateRu), resolvedValues);
      const formattedEn = segmentsToPlainText(segsEn);
      const formattedRu = segmentsToPlainText(segsRu);
      const htmlEn = segmentsToHtml(segsEn);
      const htmlRu = segmentsToHtml(segsRu);

      // Star-by-star breakdown if available
      const starBreakdown = [];
      const starSuits = matrixSuitDataByBase[suitIdLower] || {};
      for (let star = 0; star <= 3; star++) {
        const starRow = starSuits[star];
        if (starRow && Array.isArray(starRow.Buffs)) {
          const matchingBuff = starRow.Buffs.find((b) => Number(b.SuitCount) === count);
          if (matchingBuff) {
            const starDetailFText = matchingBuff.SuitDetail;
            const starParams = Array.isArray(matchingBuff.SuitDetailParams) ? matchingBuff.SuitDetailParams : [];
            const starVals = [];
            for (const sp of starParams) {
              const meta = { isOverseas: false, tableName: '' };
              const sval = evaluateCurveValue(curveTables, sp.Curve, Number(sp.Value ?? 100), meta);
              starVals.push(sval !== null ? sval : Number(sp.Value ?? 0));
              if (meta.isOverseas) curveMetas.push(meta);
            }

            const starResEn = locResolver.resolve(starDetailFText, { locale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable', clean: false });
            const starRawEn = starResEn.text;
            const starResRu = locResolver.resolve(starDetailFText, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'StaticMatrixSuitDataTable', clean: false });
            const starRawRu = starResRu.text || starRawEn;
            const starSegsEn = interpolateSegments(parseRichTextSegments(starRawEn), starVals);
            const starSegsRu = interpolateSegments(parseRichTextSegments(starRawRu), starVals);
            const starEn = segmentsToPlainText(starSegsEn);
            const starRu = segmentsToPlainText(starSegsRu);
            const starHtmlEn = segmentsToHtml(starSegsEn);
            const starHtmlRu = segmentsToHtml(starSegsRu);

            const buffObjRef = matchingBuff.BuffObject?.AssetPathName || '';
            const buffId = buffObjRef ? path.basename(buffObjRef.split('.')[0]) : '';

            starBreakdown.push({
              star,
              text_en: starEn || formattedEn,
              text_ru: starRu || formattedRu,
              segments_en: starSegsEn.length > 0 ? starSegsEn : segsEn,
              segments_ru: starSegsRu.length > 0 ? starSegsRu : segsRu,
              html_en: starHtmlEn || htmlEn,
              html_ru: starHtmlRu || htmlRu,
              cs_score: Number(matchingBuff.AddScore ?? 0),
              buff_id: buffId,
              is_global: Boolean(matchingBuff.IsGlobal),
              provenance: {
                source: (suitMerge.isOverseas(suitId) || starResEn?.isOverseasWon || curveMetas.some(m => m.isOverseas)) ? 'overseas' : 'base',
                overseasWon: Boolean(suitMerge.isOverseas(suitId) || starResEn?.isOverseasWon || curveMetas.some(m => m.isOverseas))
              }
            });
          }
        }
      }

      const isOverseasWon = Boolean(
        suitMerge.isOverseas(suitId) ||
        resTemplateEn?.isOverseasWon ||
        curveMetas.some(m => m.isOverseas)
      );

      effects.push({
        count,
        template_en: templateEn,
        template_ru: templateRu,
        text_en: formattedEn,
        text_ru: formattedRu,
        segments_en: segsEn,
        segments_ru: segsRu,
        html_en: htmlEn,
        html_ru: htmlRu,
        values: resolvedValues,
        stars: starBreakdown.length > 0 ? starBreakdown : undefined,
        provenance: {
          source: isOverseasWon ? 'overseas' : 'base',
          overseasWon: isOverseasWon
        }
      });
    }

    // Carriers mapped to this suit
    const carriers = carriersBySuit[suitIdLower] || [];
    const pieces = piecesBySuit[suitIdLower] || [];

    const primaryPieceIcon = (pieces.length > 0 && pieces[0].icon) ? pieces[0].icon : (copiedSuitIcon?.full || '');
    const primaryPieceIconThumb = (pieces.length > 0 && pieces[0].icon_thumb) ? pieces[0].icon_thumb : (copiedSuitIcon?.thumb || '');
    const primaryPieceProvenance = (pieces.length > 0 && pieces[0].piece_media) ? pieces[0].piece_media : {
      assetRef: 'None',
      rawExportPath: '',
      fullUrl: null,
      thumbUrl: null,
      strategy: 'no_source_ref',
      diagnosticStatus: 'no_source_ref',
      joinIdentity: `${suitId}_chip`
    };

    const media = {
      primary_piece_icon: primaryPieceProvenance,
      suit_portrait: suitIconProvenance,
      suit_icon: suitIconProvenance,
      remould_art: remouldProvenance,
      remould_icon: remouldProvenance,
      pieces: pieces.map((p) => p.piece_media),
      carriers: carriers.map((c) => ({
        weapon_id: c.weapon_id,
        char_id: c.char_id,
        char_name_en: c.char_name_en,
        char_name_ru: c.char_name_ru,
        weapon_name_en: c.weapon_name_en,
        weapon_name_ru: c.weapon_name_ru,
        element: c.element,
        element_secondary: c.element_secondary || null,
        role: c.role || null,
        weapon_icon: c.weapon_icon_media,
        avatar: c.avatar_media
      }))
    };

    const isLifeFugue = suitIdLower === 'suit_ssr59' || nameEn.toLowerCase().includes('life fugue');
    const externalValidation = isLifeFugue ? {
      clueSource: 'https://tof.gg/matrices',
      investigatedEntity: 'Life Fugue',
      investigatedRole: 'matrix_set_and_pieces',
      provenLocalSetId: suitId,
      provenWeaponCarrier: 'Lechesis',
      provenAssetRef: (pieces[0]?.piece_media?.assetRef || '') || rawSuitIconRef,
      note: 'Validated local set ID Suit_SSR59, pieces matrix_SSR59_1..4, exact piece artwork icon_matrix_SSR59_512.png (primary chip hero) and suit texture avatar_yizhitips_Lechesis_big vs carrier portrait tips_avatar_ssr_Lechesis.'
    } : undefined;

    items.push({
      id: suitId,
      name_en: nameEn,
      name_ru: nameRu,
      original_name: nameResEn.originalGameName,
      quality,
      icon: primaryPieceIcon,
      icon_thumb: primaryPieceIconThumb,
      piece_icon: primaryPieceIcon,
      piece_icon_thumb: primaryPieceIconThumb,
      suit_portrait: copiedSuitIcon?.full || undefined,
      suit_portrait_thumb: copiedSuitIcon?.thumb || undefined,
      remould_icon: copiedRemould?.full || undefined,
      remould_icon_thumb: copiedRemould?.thumb || undefined,
      is_opened: suit.IsOpened !== false,
      playable_carrier: carriers.length > 0,
      has_carrier: carriers.length > 0,
      pieces,
      effects,
      carriers,
      media,
      externalValidation
    });
  }

  // Sort order: SSR (high to low numeric or ID) -> SR -> R -> N
  const qualityOrder = { SSR: 1, SR: 2, R: 3, N: 4 };
  items.sort((a, b) => {
    const qA = qualityOrder[a.quality] || 99;
    const qB = qualityOrder[b.quality] || 99;
    if (qA !== qB) return qA - qB;

    // Numerical sort within SSR (e.g. Suit_SSR69 -> 69)
    const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    if (numA !== numB) return numB - numA;

    return a.id.localeCompare(b.id);
  });

  const cjkLeaking = items.filter((item) => !projectsCjkCulture() && /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(item.name_en || ''));
  if (cjkLeaking.length > 0) {
    const leakedList = cjkLeaking.map((i) => `${i.id}: "${i.name_en}"`).join(', ');
    throw new Error(`[build-matrices] Build-time CJK guard failed: ${cjkLeaking.length} matrices leaked CJK name_en: ${leakedList}`);
  }

  const outputData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: items.length,
    counts: {
      ssr: items.filter((i) => i.quality === 'SSR').length,
      sr: items.filter((i) => i.quality === 'SR').length,
      r: items.filter((i) => i.quality === 'R').length,
      n: items.filter((i) => i.quality === 'N').length
    },
    diagnostics: {
      localization: locResolver.getStats(),
      tableMerges: tableMergeStats
    },
    items,
    suits: items
  };

  imageCopier.saveSharedManifest();
  const statsCount = imageCopier.getStats()['matrices'] || 0;
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

  const targetDirs = [outDir];

  for (const dir of targetDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'matrices.json'), JSON.stringify(outputData, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'matrices-image-manifest.json'), JSON.stringify(imageManifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'matrices-image-report.json'), JSON.stringify(imageReport, null, 2), 'utf8');
  }

  console.log(`[build-matrices] Successfully generated ${items.length} matrices to ${path.join(outDir, 'matrices.json')}`);
  console.log('[build-matrices] Image resolution report:', imageReport);
  return outputData;
}

if (require.main === module) {
  try {
    buildMatricesDataset();
  } catch (err) {
    console.error('[build-matrices] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildMatricesDataset,
  cleanHtmlTags,
  mapQuality,
  parseRichTextSegments,
  interpolateSegments,
  segmentsToPlainText,
  segmentsToHtml,
  evaluateCurveValue,
  mergeTableWithOverseas,
};
