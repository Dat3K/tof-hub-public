import { readGameSourceFileSync } from './game-source-reader';
/**
 * Materializes the MMO LevyClone raid screen from its MMO schedule and the
 * shared Team8P/stage tables. Global-only Bygone/LevyClone configuration is
 * intentionally not used as an MMO fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLocalizationResolver } from './localization-resolver';

function option(name: string): string | null {
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return hit ? path.resolve(hit.slice(name.length + 3)) : null;
}

function readJson(filePath: string): any {
  return JSON.parse(readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readRows(rawDir: string, relative: string): Record<string, any> {
  const file = path.join(rawDir, relative);
  if (!fs.existsSync(file)) throw new Error(`[required] MMO raid source missing: ${file}`);
  const data = readJson(file);
  return (Array.isArray(data) ? data[0]?.Rows : data.Rows) || {};
}

function readProperties(rawDir: string, relative: string): Record<string, any> {
  const file = path.join(rawDir, relative);
  if (!fs.existsSync(file)) throw new Error(`[required] MMO raid source missing: ${file}`);
  const data = readJson(file);
  return (Array.isArray(data) ? data.find((entry) => entry?.Properties)?.Properties : data.Properties) || {};
}

function enumLeaf(value: unknown): string {
  return typeof value === 'string' ? value.split('::').at(-1) || '' : '';
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function range(value: any) {
  if (!value || typeof value !== 'object') return null;
  return { lower: finite(value.LowerValue), upper: finite(value.UpperValue) };
}

function levelOverrides(regions: any[]) {
  if (!Array.isArray(regions)) return [];
  return regions.flatMap((region) => (region?.Value?.IntDatas || []).map((server: any) => ({
    region: enumLeaf(region.Key),
    serverMode: enumLeaf(server.Key),
    range: range(server.Value),
  })));
}

function numericOverrides(regions: any[]) {
  if (!Array.isArray(regions)) return [];
  return regions.flatMap((region) => (region?.Value?.IntDatas || []).map((server: any) => ({
    region: enumLeaf(region.Key),
    serverMode: enumLeaf(server.Key),
    value: finite(server.Value),
  })));
}

function difficultyOverrides(regions: any[]) {
  if (!Array.isArray(regions)) return [];
  return regions.flatMap((region) => (region?.Value?.ServerMode2DifficultyTMapInt || []).map((server: any) => ({
    region: enumLeaf(region.Key),
    serverMode: enumLeaf(server.Key),
    values: (server?.Value?.Difficulty2Int || []).map((difficulty: any) => ({
      difficulty: enumLeaf(difficulty.Key),
      value: finite(difficulty.Value),
    })),
  })));
}

function assetRef(value: any) {
  const ref = value?.AssetPathName;
  if (!ref || ref === 'None') return null;
  const packagePath = String(ref).split('.')[0].replace(/^\/Game\//, 'Hotta/Content/');
  return { assetRef: ref, rawExportPath: `${packagePath}.png` };
}

function resolveBilingual(resolver: any, ftext: any) {
  if (!ftext) return {
    en: '', ru: '',
    localization: { en: { status: 'unresolved', resolvedLocale: null }, ru: { status: 'unresolved', resolvedLocale: null } },
  };
  const result = resolver.resolveBilingual(ftext);
  const toLocale = (locale: 'en' | 'ru') => ({
    text: result.provenance?.[locale]?.status === 'resolved' ? (locale === 'ru' ? result.name_ru : result.name_en) : '',
    status: result.provenance?.[locale]?.status || 'unresolved',
    resolvedLocale: result.provenance?.[locale]?.resolvedLocale || null,
  });
  const en = toLocale('en');
  const ru = toLocale('ru');
  return {
    en: en.text,
    ru: ru.text,
    localization: {
      en: { status: en.status, resolvedLocale: en.resolvedLocale },
      ru: { status: ru.status, resolvedLocale: ru.resolvedLocale },
    },
  };
}

function resolveActorName(resolver: any, bossId: string) {
  const candidates = [bossId];
  let candidate = bossId;
  for (let pass = 0; pass < 4; pass++) {
    const next = candidate.replace(/_(?:KN|II|8_Easy|8P|Team8P|8)$/i, '');
    if (next === candidate) break;
    candidate = next;
    candidates.push(candidate);
  }
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  for (const actorKey of uniqueCandidates) {
    const names = resolveBilingual(resolver, { TableId: 'ST_actorname', Key: actorKey });
    if (names.localization.en.status === 'resolved' || names.localization.ru.status === 'resolved') {
      return { actorKey, names };
    }
  }
  const actorKey = uniqueCandidates.at(-1) || '';
  return { actorKey, names: resolveBilingual(resolver, actorKey ? { TableId: 'ST_actorname', Key: actorKey } : null) };
}

function readSequenceRows(rawDir: string, paths: string[]) {
  const byId: Record<string, any[]> = {};
  for (const relative of paths) {
    for (const [rowId, row] of Object.entries(readRows(rawDir, relative))) {
      const match = rowId.match(/^(.*)_(\d+)$/);
      if (!match) continue;
      const sequenceId = match[1];
      (byId[sequenceId] ||= []).push({
        rowId,
        itemId: (row as any).ItemID || '',
        numberType: enumLeaf((row as any).SequenceNumType),
        num: finite((row as any).Num),
        minNum: finite((row as any).MinNum),
        maxNum: finite((row as any).MaxNum),
        weight: finite((row as any).Weight),
        limitLevel: (row as any).LimitLevel || '',
        notBindPercent: finite((row as any).NotBindPercent),
        formula: (row as any).Formula || '',
        sourcePath: relative,
      });
    }
  }
  for (const entries of Object.values(byId)) entries.sort((a, b) => a.rowId.localeCompare(b.rowId, 'en', { numeric: true }));
  return byId;
}

function main() {
  const rawDir = option('raw-dir');
  const projectRoot = option('project-root');
  if (!rawDir || !projectRoot) throw new Error('Usage: build-mmo-team-raids.js --raw-dir=<raw> --project-root=<stage>');

  const paths = {
    schedule: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_LevyClone_MMO.json',
    stage: 'Hotta/Content/Resources/CoreBlueprints/DataTable/LevyClone/LevyCloneStage/DT_LevyCloneStage.json',
    team: 'Hotta/Content/Resources/CoreBlueprints/DataTable/TeamCloneConfig.json',
    teamLevel: 'Hotta/Content/Resources/CoreBlueprints/DataTable/TeamConfigDataTable.json',
    dropGroups: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/Drop/DropGroupDataTable_MMOServer.json',
    sequences: [
      'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/Drop/DropSequenceDataTable_MMO.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/Drop/DropModifySequenceDataTable_MMO.json',
    ],
  };
  const scheduleRows = readRows(rawDir, paths.schedule);
  const stageRows = readRows(rawDir, paths.stage);
  const teamRows = readRows(rawDir, paths.team);
  const teamLevelRows = readRows(rawDir, paths.teamLevel);
  const dropGroupRows = readRows(rawDir, paths.dropGroups);
  const sequenceRows = readSequenceRows(rawDir, paths.sequences);

  const resolver = createLocalizationResolver();
  const locales: Record<string, any> = {};
  for (const locale of ['en', 'ru']) {
    const relative = `Hotta/Content/Localization/Game/${locale}/Game.json`;
    const file = path.join(rawDir, relative);
    if (!fs.existsSync(file)) {
      if (locale === 'en') throw new Error(`[required] MMO raid localization missing: ${file}`);
      continue;
    }
    locales[locale] = readJson(file);
    resolver.loadLocale(locale, locales[locale]);
  }

  const stageIds = Object.keys(stageRows)
    .filter((id) => /^Team8P_\d+_D(?:_II)?$/.test(id))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const schedulesByVariant: Record<string, any[]> = {};
  const schedules = Object.entries(scheduleRows).map(([id, row]) => ({
    id,
    beginRaw: row.OpenDateBeginStr || '',
    endRaw: row.OpenDateFinishStr || '',
    linkedLevels: (Array.isArray(row.ServerLevelToLevelId) ? row.ServerLevelToLevelId : []).map((entry: any) => {
      const variantId = String(entry.Value || '');
      if (variantId) (schedulesByVariant[variantId] ||= []).push(id);
      const config = teamRows[variantId] || {};
      const title = config.TargetName
        ? resolveBilingual(resolver, { TableId: 'QRSLCommon_ST', Key: config.TargetName })
        : resolveBilingual(resolver, null);
      return {
        serverLevel: String(entry.Key || ''),
        variantId,
        stageRowPresent: Boolean(stageRows[variantId]),
        titleKey: config.TargetName || '',
        name_en: title.en,
        name_ru: title.ru,
        bossIds: Array.isArray(config.SettleBossId) ? config.SettleBossId : [],
      };
    }),
    jointOperationLevelType: enumLeaf(row.JOLevelType),
    bossBuffId: row.BossBuffId || null,
    bossBuffIds: Array.isArray(row.BossBuffIds) ? row.BossBuffIds : [],
    playerBuffIds: Array.isArray(row.PlayerBuffIds) ? row.PlayerBuffIds : [],
    extraDropId: row.ExtraDropId || null,
    balanceBossBuffId: row.BalanceBossBuffId || null,
    timeLimited: row.bIsTimeLimited ?? null,
    shownInClient: row.bIsShow ?? null,
    bossDebuffClass: assetRef(row.BossDeBuffClass),
    bossDebuffUI: row.BossDeBuffUIInfo ? {
      image: assetRef(row.BossDeBuffUIInfo.WeakImage),
      descriptionRef: row.BossDeBuffUIInfo.WeakDesc || null,
      description: resolveBilingual(resolver, row.BossDeBuffUIInfo.WeakDesc),
    } : null,
    source: { path: paths.schedule, row: id },
  }));

  const resolveDrops = (dropId: string | null) => {
    if (!dropId || dropId === 'None') return [];
    return Object.entries(dropGroupRows)
      .filter(([id]) => id.startsWith(`${dropId}_`) && /^\d+$/.test(id.slice(dropId.length + 1)))
      .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
      .map(([id, group]: [string, any]) => ({
        id,
        minLevel: finite(group.MinLevel),
        maxLevel: finite(group.MaxLevel),
        sequenceId: group.SequenceID && group.SequenceID !== 'None' ? group.SequenceID : null,
        replaceSequenceId: group.ReplaceSequenceID && group.ReplaceSequenceID !== 'None' ? group.ReplaceSequenceID : null,
        sequenceWeight: finite(group.SequenceWeight),
        modifyNum: finite(group.ModifyNum),
        modifyCount: finite(group.ModifyCount),
        levelType: enumLeaf(group.DropGroupLevelType),
        entries: sequenceRows[group.SequenceID] || [],
        source: { path: paths.dropGroups, row: id, sequencePaths: paths.sequences },
      }));
  };

  const stages = stageIds.map((id) => {
    const row = stageRows[id];
    const config = teamRows[id] || {};
    const teamLevel = teamLevelRows[id] || {};
    const title = config.TargetName
      ? resolveBilingual(resolver, { TableId: 'QRSLCommon_ST', Key: config.TargetName })
      : resolveBilingual(resolver, null);
    const bossIds = [...new Set([
      ...(Array.isArray(config.SettleBossId) ? config.SettleBossId : []),
      ...(Array.isArray(config.AllBossId) ? config.AllBossId : []),
    ].filter((value) => typeof value === 'string' && value && value !== 'None'))];
    const bosses = bossIds.map((bossId) => {
      const { actorKey, names } = resolveActorName(resolver, bossId);
      return { id: bossId, actorKey, name_en: names.en, name_ru: names.ru, localization: names.localization };
    });
    const mechanics = (Array.isArray(config.MonsterInfoList) ? config.MonsterInfoList : []).map((entry: any, index: number) => {
      const text = resolveBilingual(resolver, entry.WeakDesc);
      return {
        index: index + 1,
        textRef: entry.WeakDesc || null,
        text_en: text.en,
        text_ru: text.ru,
        localization: text.localization,
        image: assetRef(entry.WeakImage),
      };
    });
    const scoreOverrides = difficultyOverrides(config.ProposedScore_RegionNew);
    const levelOverridesByRegion = levelOverrides(teamLevel.CharacterLevelLimit_Region);
    const dropRefs = {
      normal: row.DropID || null,
      poor: row.PoorDropID || null,
      display: row.DisplayDropID || null,
    };
    return {
      id,
      stageNumber: finite(row.Stage),
      floorEnum: enumLeaf(row.Floor),
      difficultyEnum: enumLeaf(row.Difficulty),
      settlementEnabled: row.bEnableSettle ?? null,
      settlementTicksRaw: row.SettleTime?.Ticks ?? null,
      titleKey: config.TargetName || '',
      name_en: title.en,
      name_ru: title.ru,
      nameLocalization: title.localization,
      bosses,
      bossIds,
      recommendedScore: {
        baseValue: finite(config.ProposedScore),
        regionalOverrides: numericOverrides(config.ProposedScore_Region),
        mmoOverrides: scoreOverrides,
      },
      substituteScore: {
        baseValue: finite(config.SubstituteScore),
        regionalOverrides: numericOverrides(config.SubstituteScore_Region),
      },
      requiredLevel: {
        baseRange: range(teamLevel.CharacterLevelLimit),
        regionalOverrides: levelOverridesByRegion,
      },
      team: {
        minPlayers: finite(config.MinTeammateNum),
        maxPlayers: finite(config.MaxTeammateNum),
        roleCounts: {
          attack: finite(config.AtkNum),
          defense: finite(config.DefNum),
          assist: finite(config.AssistNum),
        },
      },
      challengeTimeRaw: {
        value: finite(config.ChallengeTime),
        regionalOverrides: numericOverrides(config.ChallengeTime_Region),
      },
      mechanics,
      stageImages: {
        small: assetRef(row.StageSmallIcon),
        title: assetRef(row.ShowBigIcon),
      },
      dropRefs,
      rewards: {
        normal: resolveDrops(dropRefs.normal),
        poor: resolveDrops(dropRefs.poor),
        display: resolveDrops(dropRefs.display),
      },
      scheduleRows: schedulesByVariant[id] || [],
      source: {
        stagePath: paths.stage,
        stageRow: id,
        teamConfigPath: paths.team,
        teamConfigRow: id,
        teamLevelPath: paths.teamLevel,
        teamLevelRow: id,
        dropGroupPath: paths.dropGroups,
        sequencePaths: paths.sequences,
      },
    };
  });

  const output = {
    schemaVersion: 1,
    totalStages: stages.length,
    totalScheduleRows: schedules.length,
    totalScheduleLinks: schedules.reduce((sum, entry) => sum + entry.linkedLevels.length, 0),
    stageMatchedScheduleLinks: stageIds.reduce((sum, id) => sum + (schedulesByVariant[id]?.length || 0), 0),
    scheduleVariantIdsWithoutStageRows: [...new Set(schedules.flatMap((entry) => entry.linkedLevels
      .filter((link) => link.variantId && !link.stageRowPresent)
      .map((link) => link.variantId)))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
    stages,
    schedules,
    source: {
      schedule: paths.schedule,
      stages: paths.stage,
      teamConfig: paths.team,
      teamLevel: paths.teamLevel,
      dropGroups: paths.dropGroups,
      dropSequences: paths.sequences,
      localizationEn: 'Hotta/Content/Localization/Game/en/Game.json',
      localizationRu: fs.existsSync(path.join(rawDir, 'Hotta/Content/Localization/Game/ru/Game.json'))
        ? 'Hotta/Content/Localization/Game/ru/Game.json'
        : null,
    },
    unresolved: {
      instanceDifficultyPercent: 'Not found in the linked MMO schedule/stage/config tables; screenshot values are observations only.',
      screenshotCombatStrengthRequirement: 'The MMO ProposedScore_RegionNew values are zero for inspected rows; the screenshot CS thresholds are not mapped.',
      finalBossResistances: 'MMO static monster rows do not directly key-match every LevyClone boss ID; no fuzzy join is applied.',
      scheduleSemantics: 'Raw schedule times and schedule-to-stage links are preserved; timezone, active server season and lower-floor schedule selection are not inferred.',
    },
  };

  const outDir = path.join(projectRoot, 'datamine', 'mmo-team-raids', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mmo-team-raids.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[build-mmo-team-raids] ${output.totalStages} stage variants, ${output.totalScheduleRows} MMO schedule rows, ${output.stageMatchedScheduleLinks} schedule links matched to stage variants.`);
}

main();
