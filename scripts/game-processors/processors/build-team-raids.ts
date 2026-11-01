import { readGameSourceFileSync } from './game-source-reader';
/**
 * Materializes the game's 8-player Team8P raid catalog for the game-data pipeline.
 *
 * Sources:
 * - TeamCloneConfig.json: raid variants, recommended score, team size/roles, boss IDs,
 *   reward pack IDs, mechanic descriptions and mechanic icons.
 * - TeamConfigDataTable.json: level limits.
 * - DT_MonsterStaticData_Overseas.json (shared DT_MonsterStaticData.json as fallback): boss base stats,
 *   joined by the boss number plus "8P" appearing in the same row key.
 * - TimeLimitedPropDataTable.json: raw activation windows.
 * - DescriptionDataTable.json: server-specific raid guide text and localization links.
 * - drop/DropGroupDataTable_activity.json and drop sequence tables: reward item IDs and raw counts.
 * - Localization/Game/{en,ru}/Game.json: raid names, boss names, and bilingual text.
 *
 * Output: <project-root>/datamine/team-raids/data/team-raids.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { createLocalizationResolver } from './localization-resolver';
const { loadMonsterTables, statRow } = require('./shared/boss-monster-stats.js');

function option(name) {
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return hit ? path.resolve(hit.slice(name.length + 3)) : null;
}

function readJson(filePath) {
  return JSON.parse(readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readRows(filePath) {
  const data = readJson(filePath);
  return (Array.isArray(data) ? data[0]?.Rows : data.Rows) || {};
}

function resolvedText(result, locale) {
  const provenance = result.provenance?.[locale];
  const status = provenance?.status || 'unresolved';
  const value = locale === 'ru' ? result.name_ru : result.name_en;
  return {
    text: status === 'resolved' ? value : '',
    status,
    resolvedLocale: provenance?.resolvedLocale || null,
  };
}

function resolveBilingual(resolver, ftext, options = {}) {
  const result = resolver.resolveBilingual(ftext, options);
  const en = resolvedText(result, 'en');
  const ru = resolvedText(result, 'ru');
  return {
    en: en.text,
    ru: ru.text,
    localization: {
      en: { status: en.status, resolvedLocale: en.resolvedLocale },
      ru: { status: ru.status, resolvedLocale: ru.resolvedLocale },
    },
  };
}

function enumLeaf(value) {
  return typeof value === 'string' ? value.split('::').at(-1) : '';
}

function toNullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function flattenNumericOverrides(regions) {
  if (!Array.isArray(regions)) return [];
  return regions.flatMap((region) => {
    const values = region?.Value?.IntDatas;
    if (!Array.isArray(values)) return [];
    return values.map((entry) => ({
      region: enumLeaf(region.Key),
      serverMode: enumLeaf(entry?.Key),
      value: toNullableNumber(entry?.Value),
    }));
  });
}

function toRange(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    lower: toNullableNumber(value.LowerValue),
    upper: toNullableNumber(value.UpperValue),
  };
}

function flattenRangeOverrides(regions) {
  if (!Array.isArray(regions)) return [];
  return regions.flatMap((region) => {
    const values = region?.Value?.IntDatas;
    if (!Array.isArray(values)) return [];
    return values.map((entry) => ({
      region: enumLeaf(region.Key),
      serverMode: enumLeaf(entry?.Key),
      range: toRange(entry?.Value),
    }));
  });
}

function assetToMedia(assetPathName) {
  if (!assetPathName || assetPathName === 'None') return null;
  const packagePath = String(assetPathName).split('.')[0].replace(/^\/Game\//, 'Hotta/Content/');
  return {
    assetRef: assetPathName,
    rawExportPath: `${packagePath}.png`,
    url: `/game-assets/webp/${packagePath}.webp`,
  };
}

function bossIdPrefixKey(bossId) {
  return String(bossId || '').match(/^(?:Boss|boss)_hum_\d+/i)?.[0] || '';
}

function bossLocalizationCandidates(bossId) {
  const value = String(bossId || '');
  const prefix = bossIdPrefixKey(value);
  const number = prefix.match(/_hum_(\d+)$/i)?.[1];
  const padded = number ? `${prefix.slice(0, prefix.lastIndexOf(number))}${number.padStart(3, '0')}` : '';
  return [...new Set([value, prefix, padded].filter(Boolean))];
}

function resolveBossName(resolver, bossId) {
  const candidates = bossLocalizationCandidates(bossId);
  for (const [index, key] of candidates.entries()) {
    const localized = resolveBilingual(resolver, { TableId: 'ST_actorname', Key: key });
    const found = ['en', 'ru'].some((locale) => localized.localization[locale]?.status === 'resolved');
    if (found) {
      return {
        ...localized,
        key,
        joinMethod: index === 0 ? 'exact-boss-id' : 'boss-id-prefix-fallback',
      };
    }
  }
  const key = candidates[0] || '';
  return {
    en: '',
    ru: '',
    key,
    joinMethod: 'unresolved',
    localization: { en: { status: 'unresolved' }, ru: { status: 'unresolved' } },
  };
}

/** Boss number from `Boss_hum_089_Team8P_II` -> 89; null when the ID carries no number. */
function bossNumber(bossId) {
  const digits = bossIdPrefixKey(bossId).match(/_hum_(\d+)$/i)?.[1];
  return digits ? Number(digits) : null;
}

/**
 * Monster rows whose key starts with "boss", contains an "8P" marker and a numeric token equal to the
 * boss number (leading zeros ignored): `Boss_089_T8P`, `Boss_089_T8P_II`, `boss_hum_074_Team8P`...
 * Overseas rows win; shared rows only fill in when the Overseas table has no match.
 */
function matchBossStatRows(bossId, tables) {
  const number = bossNumber(bossId);
  if (number === null) return [];
  const matches = (rowId) => /^boss/i.test(rowId) && /8P/i.test(rowId)
    && rowId.split(/[^A-Za-z0-9]+/).some((token) => /^\d+$/.test(token) && Number(token) === number);
  for (const table of tables) {
    const rows = Object.entries(table.rows)
      .filter(([rowId, row]) => matches(rowId) && row && typeof row === 'object')
      .map(([rowId, fields]) => statRow(rowId, fields, table));
    if (rows.length) return rows;
  }
  return [];
}

function bossIdList(row) {
  return [...new Set([
    ...(Array.isArray(row?.SettleBossId) ? row.SettleBossId : []),
    ...(Array.isArray(row?.AllBossId) ? row.AllBossId : []),
  ].filter((id) => typeof id === 'string' && id && id !== 'None'))];
}

function rewardDetails(packIds, dropGroupRows, sequenceRowsById, sourcePaths) {
  const uniquePacks = new Map();
  for (const { role, id } of packIds) {
    if (!id || id === 'None') continue;
    if (!uniquePacks.has(id)) uniquePacks.set(id, new Set());
    uniquePacks.get(id).add(role);
  }

  return [...uniquePacks.entries()].map(([packId, roles]) => {
    const escapedPackId = packId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const groupPattern = new RegExp(`^${escapedPackId}_(\\d+)$`);
    const groups = Object.entries(dropGroupRows)
      .filter(([groupId]) => groupPattern.test(groupId))
      .sort(([a], [b]) => Number(a.match(/_(\d+)$/)?.[1] || 0) - Number(b.match(/_(\d+)$/)?.[1] || 0))
      .map(([groupId, group]) => {
        const sequenceId = group.SequenceID && group.SequenceID !== 'None' ? group.SequenceID : '';
        const entries = sequenceId ? sequenceRowsById[sequenceId] || [] : [];
        return {
          id: groupId,
          sequenceId: sequenceId || null,
          level: {
            min: toNullableNumber(group.MinLevel),
            max: toNullableNumber(group.MaxLevel),
            type: enumLeaf(group.DropGroupLevelType),
          },
          modifyNumRaw: toNullableNumber(group.ModifyNum),
          modifyCountRaw: toNullableNumber(group.ModifyCount),
          entries,
          source: {
            groupPath: sourcePaths.group,
            groupRow: groupId,
            sequencePaths: sequenceId ? sourcePaths.sequences.filter((source) => entries.some((entry) => entry.sourcePath === source)) : [],
          },
        };
      });
    return { packId, roles: [...roles], groups };
  });
}

function loadRewardSources(rawDir) {
  const groupRelative = 'Hotta/Content/Resources/CoreBlueprints/DataTable/drop/DropGroupDataTable_activity.json';
  const sequenceRelatives = [
    'Hotta/Content/Resources/CoreBlueprints/DataTable/drop/DropSequenceDataTable_activity.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/drop/DropSequenceDataTable_common.json',
  ];
  const groupPath = path.join(rawDir, groupRelative);
  const sequencePaths = sequenceRelatives.map((relative) => path.join(rawDir, relative));
  for (const requiredPath of [groupPath, ...sequencePaths]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`[required] Raid reward table missing: ${requiredPath}`);
  }

  const dropGroupRows = readRows(groupPath);
  const sequenceRowsById = {};
  for (let index = 0; index < sequencePaths.length; index++) {
    const filePath = sequencePaths[index];
    const relativePath = sequenceRelatives[index];
    const rows = readRows(filePath);
    for (const [rowId, row] of Object.entries(rows)) {
      if (!row || typeof row !== 'object' || typeof rowId !== 'string') continue;
      const match = rowId.match(/^(.*)_\d+$/);
      if (!match) continue;
      const sequenceId = match[1];
      if (!sequenceRowsById[sequenceId]) sequenceRowsById[sequenceId] = [];
      sequenceRowsById[sequenceId].push({
        rowId,
        itemId: row.ItemID || '',
        numberType: enumLeaf(row.SequenceNumType),
        num: toNullableNumber(row.Num),
        minNum: toNullableNumber(row.MinNum),
        maxNum: toNullableNumber(row.MaxNum),
        weight: toNullableNumber(row.Weight),
        limitLevel: row.LimitLevel || '',
        notBindPercent: toNullableNumber(row.NotBindPercent),
        sourcePath: relativePath,
      });
    }
  }
  for (const entries of Object.values(sequenceRowsById)) {
    entries.sort((a, b) => Number(a.rowId.match(/_(\d+)$/)?.[1] || 0) - Number(b.rowId.match(/_(\d+)$/)?.[1] || 0));
  }

  return {
    dropGroupRows,
    sequenceRowsById,
    sourcePaths: { group: groupRelative, sequences: sequenceRelatives },
  };
}

function sortRaidIds(a, b) {
  const numberA = Number(a.match(/^Team8P_(\d+)_/)?.[1] || 0);
  const numberB = Number(b.match(/^Team8P_(\d+)_/)?.[1] || 0);
  if (numberA !== numberB) return numberA - numberB;
  return a.localeCompare(b, 'en');
}

function raidStemFromVariantId(id) {
  if (id.endsWith('_D_II')) return id.slice(0, -5);
  if (id.endsWith('_D')) return id.slice(0, -2);
  return null;
}

function isLevyCloneRow(row) {
  return row?.TargetType === 'ETeamTargetType::TeamTarget_LevyClone';
}

function normalizeMatchText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function buildRaidDescriptionCandidates(rows, resolver) {
  return Object.entries(rows).flatMap(([rowId, row]) => {
    const baseRef = row?.Description;
    const regionalRows = Array.isArray(row?.OverseaDescription) ? row.OverseaDescription : [];
    const references = regionalRows.flatMap((region) => (Array.isArray(region?.Value?.TextDatas) ? region.Value.TextDatas : [])
      .map((entry) => ({
        region: enumLeaf(region.Key),
        regionKey: region.Key || '',
        serverMode: enumLeaf(entry?.Key),
        serverModeKey: entry?.Key || '',
        tableId: entry?.Value?.TableId || null,
        key: entry?.Value?.Key || '',
      })));
    const matchesRaidGuide = /^levy[_-]/i.test(String(rowId));
    if (!matchesRaidGuide) return [];
    const base = baseRef ? resolveBilingual(resolver, baseRef, { clean: false }) : { en: '', ru: '', localization: {} };
    const overrides = references.map((reference, index) => {
      const region = regionalRows.find((candidate) => enumLeaf(candidate.Key) === reference.region);
      const entry = region?.Value?.TextDatas?.find((candidate) => candidate.Key === reference.serverModeKey);
      const text = entry?.Value ? resolveBilingual(resolver, entry.Value, { clean: false }) : { en: '', ru: '', localization: {} };
      return { ...reference, text_en: text.en, text_ru: text.ru, localization: text.localization, sourceIndex: index };
    });
    const selected = overrides.find((entry) => entry.serverMode === 'NormalServer' && entry.text_en) || null;
    return [{
      id: String(rowId),
      namespace: baseRef?.TableId || null,
      key: baseRef?.Key || '',
      baseText_en: base.en,
      baseText_ru: base.ru,
      baseLocalization: base.localization,
      selectedOverride: selected ? {
        region: selected.region,
        regionKey: selected.regionKey,
        serverMode: selected.serverMode,
        serverModeKey: selected.serverModeKey,
        tableId: selected.tableId,
        key: selected.key,
      } : null,
      selectedText_en: selected?.text_en || base.en,
      selectedText_ru: selected?.text_ru || base.ru,
      selectedLocalization: selected?.localization || base.localization,
      regionalReferences: overrides.map(({ text_en, text_ru, localization, sourceIndex, ...reference }) => reference),
      source: { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/DescriptionDataTable.json', row: String(rowId), field: 'Description', overridesField: 'OverseaDescription[].Value.TextDatas[].Value' },
    }];
  });
}

function guidesForRaid(raid, candidates) {
  return candidates.flatMap((guide) => {
    const guideText = normalizeMatchText(guide.selectedText_en || guide.baseText_en);
    const relatedBossIds = raid.bosses
      .filter((boss) => {
        const bossName = normalizeMatchText(boss.name_en);
        return bossName.length >= 5 && guideText.includes(bossName);
      })
      .map((boss) => boss.id);
    if (!relatedBossIds.length) return [];
    return [{
      ...guide,
      relatedBossIds,
      associationMethod: 'localized-boss-name-in-guide-text',
    }];
  });
}

function buildBossTips(bosses, localeData, resolver) {
  const keys = new Set<string>();
  for (const boss of bosses) {
    const prefix = bossIdPrefixKey(boss.id);
    if (!prefix) continue;
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedPrefix}_Team8P_tip\\d+$`, 'i');
    for (const locale of ['en', 'ru']) {
      const namespace = localeData[locale]?.QRSLCommon_ST;
      if (!namespace || typeof namespace !== 'object') continue;
      for (const key of Object.keys(namespace)) {
        if (regex.test(key)) keys.add(key);
      }
    }
  }

  return [...keys].sort((a, b) => {
    const bossOrder = a.localeCompare(b, 'en');
    if (bossOrder !== 0) return bossOrder;
    return Number(a.match(/tip(\d+)$/i)?.[1] || 0) - Number(b.match(/tip(\d+)$/i)?.[1] || 0);
  }).map((key) => {
    const localized = resolveBilingual(resolver, { TableId: 'QRSLCommon_ST', Key: key }, { clean: false });
    const sourceBossPrefix = key.match(/^(?:Boss|boss)_hum_\d+/i)?.[0] || '';
    return {
      key,
      bossId: sourceBossPrefix,
      text_en: localized.en,
      text_ru: localized.ru,
      localization: localized.localization,
      joinMethod: 'boss-id-prefix',
    };
  });
}

function extractGuidePoolNames(text, locale) {
  const sourceText = String(text || '');
  const heading = locale === 'ru' ? '<blue>Путь подземелий</>' : '<blue>Instance Pool</>';
  const phrase = locale === 'ru'
    ? 'Выбирается случайным образом каждую неделю из следующих подземелий:'
    : 'Selected randomly per week from';
  const headingIndex = sourceText.indexOf(heading);
  if (headingIndex < 0) return [];
  const sectionStart = headingIndex + heading.length;
  const nextHeading = sourceText.indexOf('<blue>', sectionStart);
  const section = sourceText.slice(sectionStart, nextHeading < 0 ? undefined : nextHeading);
  const phraseIndex = section.indexOf(phrase);
  if (phraseIndex < 0) return [];
  const list = section.slice(phraseIndex + phrase.length).trim().replace(/[.\s]+$/, '');
  const conjunction = locale === 'ru' ? /\s+и\s+/gi : /\s+and\s+/gi;
  const conjunctionMatch = [...list.matchAll(conjunction)].at(-1);
  if (!conjunctionMatch || typeof conjunctionMatch.index !== 'number') {
    return list.split(/,\s*/).map((entry) => entry.trim()).filter(Boolean);
  }
  const left = list.slice(0, conjunctionMatch.index).replace(/,\s*$/, '');
  const right = list.slice(conjunctionMatch.index + conjunctionMatch[0].length);
  return [...left.split(/,\s*/), right].map((entry) => entry.trim()).filter(Boolean);
}

function buildGuidePoolEntries(guide, raids) {
  const namesEn = extractGuidePoolNames(guide.en, 'en');
  const namesRu = extractGuidePoolNames(guide.ru, 'ru');
  const localeListsAlign = namesEn.length === namesRu.length;
  return namesEn.map((name_en, index) => {
    const normalizedName = normalizeMatchText(name_en);
    const matchedRaid = raids.find((raid) => raid.variants.some((variant) => {
      const normalizedVariantName = normalizeMatchText(variant.name_en);
      return normalizedVariantName === normalizedName || normalizedVariantName.startsWith(`${normalizedName} `);
    }));
    return {
      index: index + 1,
      name_en,
      name_ru: localeListsAlign ? namesRu[index] : '',
      localizationJoinMethod: localeListsAlign ? 'parallel-localized-guide-list-order' : 'english-guide-only',
      matchedRaidId: matchedRaid?.id || null,
      associationMethod: matchedRaid ? 'localized-variant-title-prefix' : 'unmatched-guide-pool-name',
      source: {namespace: 'UI_Oversea', key: 'Levi_OS', section: 'Instance Pool'},
    };
  });
}

function run() {
  const projectRoot = option('project-root');
  const rawDir = option('raw-dir');
  if (!projectRoot || !rawDir) {
    throw new Error('Usage: build-team-raids.js --project-root=<stage> --raw-dir=<raw>');
  }

  const configRelative = 'Hotta/Content/Resources/CoreBlueprints/DataTable/TeamCloneConfig.json';
  const configOverseasRelative = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/TeamCloneConfig_Overseas.json';
  const teamRelative = 'Hotta/Content/Resources/CoreBlueprints/DataTable/TeamConfigDataTable.json';
  const teamOverseasRelative = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/TeamConfigDataTable_Overseas.json';
  const timeLimitRelative = 'Hotta/Content/Resources/CoreBlueprints/DataTable/TimeLimitedPropDataTable.json';
  const timeLimitOverseasRelative = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/TimeLimitedPropDataTable_Overseas.json';
  const descriptionRelative = 'Hotta/Content/Resources/CoreBlueprints/DataTable/DescriptionDataTable.json';
  const configPath = path.join(rawDir, configRelative);
  const configOverseasPath = path.join(rawDir, configOverseasRelative);
  const teamPath = path.join(rawDir, teamRelative);
  const teamOverseasPath = path.join(rawDir, teamOverseasRelative);
  const timeLimitPath = path.join(rawDir, timeLimitRelative);
  const timeLimitOverseasPath = path.join(rawDir, timeLimitOverseasRelative);
  const descriptionPath = path.join(rawDir, descriptionRelative);
  for (const requiredPath of [configPath, configOverseasPath, teamPath, teamOverseasPath, timeLimitPath, timeLimitOverseasPath, descriptionPath]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`[required] Raid table missing: ${requiredPath}`);
  }
  const rewards = loadRewardSources(rawDir);
  const monsterTables = loadMonsterTables(rawDir);

  const locales = {};
  const resolver = createLocalizationResolver();
  for (const locale of ['en', 'ru']) {
    const relativePath = `Hotta/Content/Localization/Game/${locale}/Game.json`;
    const file = path.join(rawDir, relativePath);
    if (!fs.existsSync(file)) {
      if (locale === 'en') throw new Error(`[required] Raid localization missing: ${file}`);
      continue;
    }
    locales[locale] = readJson(file);
    resolver.loadLocale(locale, locales[locale]);
  }

  const configRows = readRows(configPath);
  const configOverseasRows = readRows(configOverseasPath);
  const teamRows = readRows(teamPath);
  const teamOverseasRows = readRows(teamOverseasPath);
  const timeLimitRows = readRows(timeLimitPath);
  const timeLimitOverseasRows = readRows(timeLimitOverseasPath);
  const descriptionRows = readRows(descriptionPath);
  const raidDescriptionCandidates = buildRaidDescriptionCandidates(descriptionRows, resolver);
  const configCandidateIds = [...new Set([...Object.keys(configRows), ...Object.keys(configOverseasRows)])];
  const rowForCandidateId = (id) => configOverseasRows[id] || configRows[id];
  const levyCloneCandidateIds = configCandidateIds.filter((id) => isLevyCloneRow(rowForCandidateId(id)));
  const variantIds = levyCloneCandidateIds
    .filter((id) => raidStemFromVariantId(id))
    .sort(sortRaidIds);
  const unsupportedLevyCloneIds = levyCloneCandidateIds
    .filter((id) => !raidStemFromVariantId(id))
    .sort((a, b) => a.localeCompare(b, 'en'));
  const unsupportedTeam8pIds = configCandidateIds
    .filter((id) => id.startsWith('Team8P_') && !raidStemFromVariantId(id))
    .sort((a, b) => a.localeCompare(b, 'en'));
  const raidStems = [...new Set(variantIds.map(raidStemFromVariantId).filter((id): id is string => id !== null))];
  const highestNumberedRaid = Math.max(0, ...raidStems.map((id) => Number(id.match(/^Team8P_(\d+)$/)?.[1] || 0)));
  const fallbackIndexByRaidId = new Map(
    raidStems
      .filter((id) => !/^Team8P_\d+$/.test(id))
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map((id, offset) => [id, highestNumberedRaid + offset + 1]),
  );
  const grouped = new Map();

  for (const variantId of variantIds) {
    const useOverseasConfig = Boolean(configOverseasRows[variantId]);
    const row = useOverseasConfig ? configOverseasRows[variantId] : configRows[variantId];
    const raidId = raidStemFromVariantId(variantId);
    const numericId = Number(raidId.match(/^Team8P_(\d+)$/)?.[1] || 0);
    const index = numericId || fallbackIndexByRaidId.get(raidId) || grouped.size + 1;
    const titleKey = row.TargetName || variantId;
    const title = resolveBilingual(resolver, { TableId: 'QRSLCommon_ST', Key: titleKey });
    const configBossIds = bossIdList(row);
    const localizedBosses = configBossIds.map((id) => {
      const names = resolveBossName(resolver, id);
      return {
        id,
        sourceIds: [id],
        name_en: names.en,
        name_ru: names.ru,
        localizationKey: names.key,
        nameJoinMethod: names.joinMethod,
        localization: names.localization,
        stats: matchBossStatRows(id, monsterTables),
      };
    });

    const useOverseasTeam = Boolean(teamOverseasRows[variantId]);
    const teamRow = useOverseasTeam ? teamOverseasRows[variantId] : (teamRows[variantId] || {});
    const useOverseasTimeLimit = Boolean(timeLimitOverseasRows[variantId]);
    const timeLimitRow = useOverseasTimeLimit ? timeLimitOverseasRows[variantId] : (timeLimitRows[variantId] || {});
    const packIds = [
      { role: 'showPass', id: row.ShowPassRewardPackId },
      { role: 'pass', id: row.PassRewardPackId },
    ];
    const mechanics = (Array.isArray(row.MonsterInfoList) ? row.MonsterInfoList : []).map((entry, indexInRow) => {
      const description = entry?.WeakDesc;
      const localized = description
        ? resolveBilingual(resolver, description, { clean: false })
        : { en: '', ru: '', localization: { en: { status: 'unresolved' }, ru: { status: 'unresolved' } } };
      return {
        index: indexInRow + 1,
        key: description?.Key || '',
        text_en: localized.en,
        text_ru: localized.ru,
        localization: localized.localization,
        localizationRef: {
          tableId: description?.TableId || null,
          namespace: description?.Namespace || null,
          key: description?.Key || '',
        },
        source: {
          field: `MonsterInfoList[${indexInRow}].WeakDesc`,
          imageField: `MonsterInfoList[${indexInRow}].WeakImage`,
        },
        image: assetToMedia(entry?.WeakImage?.AssetPathName || entry?.WeakImage?.ObjectPath),
      };
    });

    const selectedConfigPath = useOverseasConfig ? configOverseasRelative : configRelative;
    const selectedTeamPath = useOverseasTeam ? teamOverseasRelative : teamRelative;
    const selectedTimePath = useOverseasTimeLimit ? timeLimitOverseasRelative : (timeLimitRows[variantId] ? timeLimitRelative : null);

    const variant = {
      id: variantId,
      targetName: titleKey,
      name_en: title.en,
      name_ru: title.ru,
      nameLocalization: title.localization,
      cloneIndex: toNullableNumber(row.CloneIndex),
      bossIds: configBossIds,
      bosses: localizedBosses,
      recommendedScore: {
        baseValue: toNullableNumber(row.ProposedScore),
        regionalOverrides: flattenNumericOverrides(row.ProposedScore_Region),
        mmoOverridesRaw: Array.isArray(row.ProposedScore_RegionNew) ? row.ProposedScore_RegionNew : [],
      },
      challengeTimeRaw: {
        value: toNullableNumber(row.ChallengeTime),
        regionalOverrides: flattenNumericOverrides(row.ChallengeTime_Region),
      },
      requiredLevel: {
        baseRange: toRange(teamRow.CharacterLevelLimit),
        regionalOverrides: flattenRangeOverrides(teamRow.CharacterLevelLimit_Region),
      },
      team: {
        minPlayers: toNullableNumber(row.MinTeammateNum),
        maxPlayers: toNullableNumber(row.MaxTeammateNum),
        roleCounts: {
          attack: toNullableNumber(row.AtkNum),
          defense: toNullableNumber(row.DefNum),
          assist: toNullableNumber(row.AssistNum),
        },
      },
      rewardPackIds: {
        showPass: row.ShowPassRewardPackId || null,
        pass: row.PassRewardPackId || null,
        showPassByRegion: Array.isArray(row.ShowPassRewardPackId_RegionNew) ? row.ShowPassRewardPackId_RegionNew : [],
        passByRegion: Array.isArray(row.PassRewardPackId_RegionNew) ? row.PassRewardPackId_RegionNew : [],
      },
      rewardDetails: rewardDetails(packIds, rewards.dropGroupRows, rewards.sequenceRowsById, rewards.sourcePaths),
      availability: {
        activityType: row.ActivityType || null,
        openWeekDays: Array.isArray(row.OpenWeekDay) ? row.OpenWeekDay : [],
        openAfterUtcTimes: Array.isArray(row.OpenAfterUtcTime) ? row.OpenAfterUtcTime : [],
        timeWindowsRaw: (Array.isArray(timeLimitRow.LimitedTimeInfo) ? timeLimitRow.LimitedTimeInfo : []).map((timeInfo) => ({
          begin: timeInfo.PropBeginTime || null,
          beginRegionOverrides: Array.isArray(timeInfo.PropBeginTime_Region) ? timeInfo.PropBeginTime_Region : [],
          end: timeInfo.PropEndTime || null,
          endRegionOverrides: Array.isArray(timeInfo.PropEndTime_Region) ? timeInfo.PropEndTime_Region : [],
          initValueRaw: timeInfo.InitValue ?? null,
        })),
      },
      mechanics,
      source: {
        configPath: selectedConfigPath,
        configRow: variantId,
        configSelection: useOverseasConfig ? 'overseas-row' : 'shared-base-fallback',
        configCandidatePath: useOverseasConfig ? configRelative : configOverseasRelative,
        teamConfigPath: selectedTeamPath,
        teamConfigRow: variantId,
        teamConfigSelection: useOverseasTeam ? 'overseas-row' : 'shared-base-fallback',
        teamConfigCandidatePath: useOverseasTeam ? teamRelative : teamOverseasRelative,
        timeLimitPath: selectedTimePath,
        timeLimitRow: timeLimitRow.LimitedTimeInfo ? variantId : null,
        timeLimitSelection: useOverseasTimeLimit ? 'bound-overseas-row' : (timeLimitRows[variantId] ? 'shared-base-fallback' : 'no-row'),
        timeLimitCandidatePath: timeLimitRelative,
      },
    };

    if (!grouped.has(raidId)) {
      grouped.set(raidId, { id: raidId, index, variants: [], bossesById: new Map() });
    }
    const raid = grouped.get(raidId);
    raid.variants.push(variant);
    for (const boss of localizedBosses) {
      const existing = raid.bossesById.get(boss.id);
      if (existing) existing.sourceIds = [...new Set([...existing.sourceIds, ...boss.sourceIds])];
      else raid.bossesById.set(boss.id, { ...boss, sourceIds: [...boss.sourceIds] });
    }
  }

  const raids = [...grouped.values()].sort((a, b) => a.index - b.index).map((raid) => {
    const bosses = [...raid.bossesById.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
    return {
      id: raid.id,
      index: raid.index,
      bosses,
      bossTips: buildBossTips(bosses, locales, resolver),
      guides: guidesForRaid({ bosses }, raidDescriptionCandidates),
      variants: raid.variants.sort((a, b) => a.id.localeCompare(b.id, 'en')),
    };
  });

  const guide = resolveBilingual(resolver, { TableId: 'UI_Oversea', Key: 'Levy_OS' }, { clean: false });
  const guidePoolEntries = buildGuidePoolEntries(guide, raids);
  const output = {
    schemaVersion: 1,
    total: raids.length,
    variantsTotal: raids.reduce((total, raid) => total + raid.variants.length, 0),
    mechanicsTotal: raids.reduce((total, raid) => total + raid.variants.reduce((n, variant) => n + variant.mechanics.length, 0), 0),
    guide: {
      key: 'Levy_OS',
      namespace: 'UI_Oversea',
      text_en: guide.en,
      text_ru: guide.ru,
      localization: guide.localization,
      poolEntries: guidePoolEntries,
    },
    catalogCoverage: {
      candidateRowsTotal: variantIds.length,
      unsupportedTeam8pIds,
      unsupportedLevyCloneIds,
    },
    raids,
    source: {
      teamCloneConfig: configRelative,
      teamCloneConfigOverseas: configOverseasRelative,
      teamConfig: teamRelative,
      teamConfigOverseas: teamOverseasRelative,
      timeLimit: timeLimitRelative,
      timeLimitOverseas: timeLimitOverseasRelative,
      descriptionDataTable: descriptionRelative,
      monsterStaticData: monsterTables.map((table) => table.path),
      rewardGroups: rewards.sourcePaths.group,
      rewardSequences: rewards.sourcePaths.sequences,
      localizationEn: 'Hotta/Content/Localization/Game/en/Game.json',
      localizationRu: fs.existsSync(path.join(rawDir, 'Hotta/Content/Localization/Game/ru/Game.json'))
        ? 'Hotta/Content/Localization/Game/ru/Game.json'
        : null,
    },
  };

  const outDir = path.join(projectRoot, 'datamine', 'team-raids', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'team-raids.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[build-team-raids] ${output.total} raid IDs, ${output.variantsTotal} variants, ${output.mechanicsTotal} mechanic entries.`);
}

run();
