import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';

type Locale = 'en' | 'ru';

function localeText(value: any, locale: Locale) {
  return {
    text: locale === 'ru' ? value?.name_ru || value?.text_ru || '' : value?.name_en || value?.text_en || '',
    localization: value?.localization?.[locale] || { status: 'unresolved', resolvedLocale: null },
  };
}

function readData(sourceDir: string) {
  const filePath = path.join(sourceDir, 'datamine', 'mmo-team-raids', 'data', 'mmo-team-raids.json');
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {
    schemaVersion: 1,
    totalStages: 0,
    totalScheduleRows: 0,
    totalScheduleLinks: 0,
    stageMatchedScheduleLinks: 0,
    scheduleVariantIdsWithoutStageRows: [],
    stages: [],
    schedules: [],
    source: {},
    unresolved: {},
  };
}

export function normalizeMmoTeamRaidsDataset(sourceDir: string): DatasetNormalizationResult {
  const raw = readData(sourceDir);
  const coreStages = (raw.stages || []).map((stage: any) => ({
    ...stage,
    name_en: undefined,
    name_ru: undefined,
    bosses: (stage.bosses || []).map((boss: any) => ({ ...boss, name_en: undefined, name_ru: undefined, localization: undefined })),
    mechanics: (stage.mechanics || []).map((mechanic: any) => ({ ...mechanic, text_en: undefined, text_ru: undefined, localization: undefined })),
  }));
  const coreSchedules = (raw.schedules || []).map((schedule: any) => ({
    ...schedule,
    bossDebuffUI: schedule.bossDebuffUI ? { ...schedule.bossDebuffUI, description: undefined } : null,
    linkedLevels: (schedule.linkedLevels || []).map((link: any) => ({ ...link, name_en: undefined, name_ru: undefined })),
  }));
  const overlays = (['en', 'ru'] as const).reduce((out, locale) => {
    out[locale] = {
      stages: (raw.stages || []).map((stage: any) => ({
        id: String(stage.id || ''),
        name: localeText(stage, locale).text,
        nameLocalization: stage.nameLocalization?.[locale] || { status: 'unresolved', resolvedLocale: null },
        bosses: (stage.bosses || []).map((boss: any) => ({
          id: boss.id,
          actorKey: boss.actorKey,
          name: localeText(boss, locale).text,
          localization: boss.localization?.[locale] || { status: 'unresolved', resolvedLocale: null },
        })),
        mechanics: (stage.mechanics || []).map((mechanic: any) => ({
          index: mechanic.index,
          textRef: mechanic.textRef,
          text: localeText(mechanic, locale).text,
          localization: mechanic.localization?.[locale] || { status: 'unresolved', resolvedLocale: null },
        })),
      })),
      schedules: (raw.schedules || []).map((schedule: any) => ({
        id: String(schedule.id || ''),
        bossDebuffDescription: schedule.bossDebuffUI?.description ? {
          text: locale === 'ru' ? schedule.bossDebuffUI.description.ru || '' : schedule.bossDebuffUI.description.en || '',
          localization: schedule.bossDebuffUI.description.localization?.[locale] || { status: 'unresolved', resolvedLocale: null },
        } : null,
        linkedLevels: (schedule.linkedLevels || []).map((link: any) => ({
          variantId: link.variantId,
          name: locale === 'ru' ? link.name_ru || '' : link.name_en || '',
        })),
      })),
    };
    return out;
  }, {} as Record<Locale, any>);

  const materialize = (locale: Locale) => {
    const overlay = overlays[locale];
    const stageOverlays = new Map(overlay.stages.map((stage: any) => [stage.id, stage]));
    const stages = coreStages.map((stage: any) => {
      const localized: any = stageOverlays.get(stage.id) || { bosses: [], mechanics: [] };
      const bosses = new Map(localized.bosses.map((boss: any) => [boss.id, boss]));
      const mechanics = new Map(localized.mechanics.map((mechanic: any) => [mechanic.index, mechanic]));
      return {
        ...stage,
        name: localized.name || '',
        nameLocalization: localized.nameLocalization || { status: 'unresolved', resolvedLocale: null },
        bosses: (stage.bosses || []).map((boss: any) => ({
          ...boss,
          ...(bosses.get(boss.id) || { name: '', localization: { status: 'unresolved', resolvedLocale: null } }),
        })),
        mechanics: (stage.mechanics || []).map((mechanic: any) => ({
          ...mechanic,
          ...(mechanics.get(mechanic.index) || { text: '', localization: { status: 'unresolved', resolvedLocale: null } }),
        })),
      };
    });
    const scheduleOverlays = new Map(overlay.schedules.map((schedule: any) => [schedule.id, schedule]));
    const schedules = coreSchedules.map((schedule: any) => {
      const localized: any = scheduleOverlays.get(schedule.id) || { linkedLevels: [] };
      const links = new Map(localized.linkedLevels.map((link: any) => [link.variantId, link]));
      return {
        ...schedule,
        bossDebuffUI: schedule.bossDebuffUI ? {
          ...schedule.bossDebuffUI,
          description: localized.bossDebuffDescription || null,
        } : null,
        linkedLevels: (schedule.linkedLevels || []).map((link: any) => ({
          ...link,
          ...(links.get(link.variantId) || { name: '' }),
        })),
      };
    });
    return { ...raw, stages, schedules };
  };

  return {
    datasetName: 'mmo-team-raids',
    core: {
      schemaVersion: raw.schemaVersion || 1,
      totalStages: coreStages.length,
      totalScheduleRows: coreSchedules.length,
      totalScheduleLinks: raw.totalScheduleLinks || 0,
      stageMatchedScheduleLinks: raw.stageMatchedScheduleLinks || 0,
      scheduleVariantIdsWithoutStageRows: raw.scheduleVariantIdsWithoutStageRows || [],
      stages: coreStages,
      schedules: coreSchedules,
      source: raw.source || {},
      unresolved: raw.unresolved || {},
    },
    overlays,
    materialized: { en: materialize('en'), ru: materialize('ru') },
    counts: { total: coreStages.length, schedules: coreSchedules.length },
  };
}

