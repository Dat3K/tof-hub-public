import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult, SupportedLocale } from '../types';

type RaidLocale = 'en' | 'ru';

function localized(localization: any) {
  return Object.fromEntries((['en', 'ru'] as const).map((locale) => {
    const value = localization?.[locale];
    return [locale, {
      status: value?.status || 'unresolved',
      resolvedLocale: value?.resolvedLocale ?? null,
    }];
  }));
}

function emptyDataset() {
  return {
    schemaVersion: 1,
    total: 0,
    variantsTotal: 0,
    mechanicsTotal: 0,
    guide: null,
    catalogCoverage: { candidateRowsTotal: 0, unsupportedTeam8pIds: [], unsupportedLevyCloneIds: [] },
    raids: [],
  };
}

export function normalizeTeamRaidsDataset(legacySourceDir: string): DatasetNormalizationResult {
  const filePath = path.join(legacySourceDir, 'datamine', 'team-raids', 'data', 'team-raids.json');
  const raw = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : emptyDataset();

  const coreRaids = (Array.isArray(raw.raids) ? raw.raids : []).map((raid: any) => ({
    id: String(raid.id || ''),
    index: Number(raid.index || 0),
    bosses: (Array.isArray(raid.bosses) ? raid.bosses : []).map((boss: any) => ({
      id: String(boss.id || ''),
      sourceIds: Array.isArray(boss.sourceIds) ? boss.sourceIds : [],
      localizationKey: boss.localizationKey || '',
      nameJoinMethod: boss.nameJoinMethod || 'unresolved',
      stats: Array.isArray(boss.stats) ? boss.stats : [],
    })),
    bossTips: (Array.isArray(raid.bossTips) ? raid.bossTips : []).map((tip: any) => ({
      key: String(tip.key || ''),
      bossId: String(tip.bossId || ''),
      joinMethod: tip.joinMethod || 'boss-id-prefix',
    })),
    guides: (Array.isArray(raid.guides) ? raid.guides : []).map((guide: any) => ({
      id: String(guide.id || ''),
      namespace: guide.namespace || null,
      key: String(guide.key || ''),
      baseLocalization: localized(guide.baseLocalization),
      selectedOverride: guide.selectedOverride ?? null,
      selectedLocalization: localized(guide.selectedLocalization),
      regionalReferences: Array.isArray(guide.regionalReferences) ? guide.regionalReferences : [],
      relatedBossIds: Array.isArray(guide.relatedBossIds) ? guide.relatedBossIds : [],
      associationMethod: guide.associationMethod || 'unresolved',
      source: guide.source ?? null,
    })),
    variants: (Array.isArray(raid.variants) ? raid.variants : []).map((variant: any) => ({
      id: String(variant.id || ''),
      targetName: String(variant.targetName || ''),
      cloneIndex: variant.cloneIndex ?? null,
      bossIds: Array.isArray(variant.bossIds) ? variant.bossIds : [],
      recommendedScore: variant.recommendedScore,
      challengeTimeRaw: variant.challengeTimeRaw,
      requiredLevel: variant.requiredLevel,
      team: variant.team,
      rewardPackIds: variant.rewardPackIds,
      rewardDetails: Array.isArray(variant.rewardDetails) ? variant.rewardDetails : [],
      availability: variant.availability,
      mechanics: (Array.isArray(variant.mechanics) ? variant.mechanics : []).map((mechanic: any) => ({
        index: mechanic.index,
        key: mechanic.key,
        // The contract makes these optional (absent), not nullable.
        localizationRef: mechanic.localizationRef ?? undefined,
        source: mechanic.source ?? undefined,
        image: mechanic.image ?? null,
      })),
      source: variant.source,
    })),
  }));

  const overlays = Object.fromEntries((['en', 'ru'] as const).map((locale) => [locale, {
    guide: raw.guide ? {
      key: String(raw.guide.key || ''),
      namespace: String(raw.guide.namespace || ''),
      text: locale === 'ru' ? raw.guide.text_ru || '' : raw.guide.text_en || '',
      localization: localized(raw.guide.localization),
      poolEntries: (Array.isArray(raw.guide.poolEntries) ? raw.guide.poolEntries : []).map((entry: any) => ({
        index: Number(entry.index || 0),
        name: locale === 'ru' ? entry.name_ru || '' : entry.name_en || '',
        matchedRaidId: entry.matchedRaidId || null,
        localizationJoinMethod: entry.localizationJoinMethod || 'unresolved',
        associationMethod: entry.associationMethod || 'unresolved',
        source: entry.source ?? null,
      })),
    } : null,
    raids: (Array.isArray(raw.raids) ? raw.raids : []).map((raid: any) => ({
      id: String(raid.id || ''),
      bosses: (Array.isArray(raid.bosses) ? raid.bosses : []).map((boss: any) => ({
        id: String(boss.id || ''),
        name: locale === 'ru' ? boss.name_ru || '' : boss.name_en || '',
        localizationKey: boss.localizationKey || '',
        nameJoinMethod: boss.nameJoinMethod || 'unresolved',
        localization: localized(boss.localization),
      })),
      bossTips: (Array.isArray(raid.bossTips) ? raid.bossTips : []).map((tip: any) => ({
        key: String(tip.key || ''),
        bossId: String(tip.bossId || ''),
        text: locale === 'ru' ? tip.text_ru || '' : tip.text_en || '',
        localization: localized(tip.localization),
        joinMethod: tip.joinMethod || 'boss-id-prefix',
      })),
      guides: (Array.isArray(raid.guides) ? raid.guides : []).map((guide: any) => ({
        id: String(guide.id || ''),
        baseText: locale === 'ru' ? guide.baseText_ru || '' : guide.baseText_en || '',
        text: locale === 'ru' ? guide.selectedText_ru || '' : guide.selectedText_en || '',
        baseLocalization: localized(guide.baseLocalization),
        localization: localized(guide.selectedLocalization),
      })),
      variants: (Array.isArray(raid.variants) ? raid.variants : []).map((variant: any) => ({
        id: String(variant.id || ''),
        name: locale === 'ru' ? variant.name_ru || '' : variant.name_en || '',
        nameLocalization: localized(variant.nameLocalization),
        mechanics: (Array.isArray(variant.mechanics) ? variant.mechanics : []).map((mechanic: any) => ({
          index: mechanic.index,
          key: mechanic.key,
          text: locale === 'ru' ? mechanic.text_ru || '' : mechanic.text_en || '',
          localization: localized(mechanic.localization),
        })),
      })),
    })),
  }])) as Record<SupportedLocale, any>;

  const materialize = (locale: RaidLocale) => {
    const overlayByRaidId = new Map(overlays[locale].raids.map((raid: any) => [raid.id, raid]));
    const localizedGuide = overlays[locale].guide;
    const raids = coreRaids.map((raid: any) => {
      const overlay = overlayByRaidId.get(raid.id) || { bosses: [], bossTips: [], guides: [], variants: [] };
      const localizedBosses = new Map(overlay.bosses.map((boss: any) => [boss.id, boss]));
      const localizedTips = new Map(overlay.bossTips.map((tip: any) => [tip.key, tip]));
      const localizedGuides = new Map(overlay.guides.map((guide: any) => [guide.id, guide]));
      const localizedVariants = new Map(overlay.variants.map((variant: any) => [variant.id, variant]));
      return {
        id: raid.id,
        index: raid.index,
        bosses: raid.bosses.map((boss: any) => ({
          ...boss,
          ...(localizedBosses.get(boss.id) || { name: '', localization: localized({}) }),
        })),
        bossTips: raid.bossTips.map((tip: any) => ({
          ...tip,
          ...(localizedTips.get(tip.key) || { text: '', localization: localized({}) }),
        })),
        guides: raid.guides.map((guide: any) => ({
          ...guide,
          ...(localizedGuides.get(guide.id) || { baseText: '', text: '', baseLocalization: localized({}), localization: localized({}) }),
        })),
        variants: raid.variants.map((variant: any) => {
          const localizedVariant = localizedVariants.get(variant.id) || { name: '', nameLocalization: localized({}), mechanics: [] };
          const mechanicsByIndex = new Map(localizedVariant.mechanics.map((mechanic: any) => [mechanic.index, mechanic]));
          return {
            ...variant,
            name: localizedVariant.name,
            nameLocalization: localizedVariant.nameLocalization,
            mechanics: variant.mechanics.map((mechanic: any) => ({
              ...mechanic,
              ...(mechanicsByIndex.get(mechanic.index) || { text: '', localization: localized({}) }),
            })),
          };
        }),
      };
    });
    const dataset = {
      schemaVersion: Number(raw.schemaVersion || 1),
      total: raids.length,
      variantsTotal: raids.reduce((total: number, raid: any) => total + raid.variants.length, 0),
      mechanicsTotal: raids.reduce((total: number, raid: any) => total + raid.variants.reduce((n: number, variant: any) => n + variant.mechanics.length, 0), 0),
      guide: localizedGuide ? { ...localizedGuide } : null,
      catalogCoverage: raw.catalogCoverage || emptyDataset().catalogCoverage,
      raids,
      ...(raw.source ? { source: raw.source } : {}),
    };
    return dataset;
  };

  return {
    datasetName: 'team-raids',
    core: {
      schemaVersion: Number(raw.schemaVersion || 1),
      total: coreRaids.length,
      variantsTotal: coreRaids.reduce((total: number, raid: any) => total + raid.variants.length, 0),
      catalogCoverage: raw.catalogCoverage || emptyDataset().catalogCoverage,
      raids: coreRaids,
      ...(raw.source ? { source: raw.source } : {}),
    },
    overlays,
    materialized: {
      en: materialize('en'),
      ru: materialize('ru'),
    },
    counts: {
      total: coreRaids.length,
      variants: coreRaids.reduce((total: number, raid: any) => total + raid.variants.length, 0),
    },
  };
}
