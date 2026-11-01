import fs from "node:fs";
import path from "node:path";
import type { DatasetNormalizationResult, SupportedLocale } from "../types";
import { sortById, deepClone, extractLocalizedStrings } from "../split-merge";
import { buildZoeyChangelogFixtures } from "../simulacra-changelog-fixtures";
import { correctKnownSimulacraElements } from "../known-data-corrections";
import {loadSkillTipCurves,restoreSkillCurveTimes} from '../skill-parameter-curves';

type SkillBucket = "normals" | "dodges" | "skills" | "discharges" | "passives" | "other";

const SKILL_BUCKETS: SkillBucket[] = [
  "normals",
  "dodges",
  "skills",
  "discharges",
  "passives",
  "other",
];

function skillBucketForCategory(category: unknown): SkillBucket {
  const normalized = String(category || "").toLowerCase();
  if (normalized.includes("dodge")) return "dodges";
  if (normalized.includes("discharge")) return "discharges";
  if (normalized.includes("passive")) return "passives";
  if (normalized.includes("skill") || normalized.includes("ability")) return "skills";
  if (normalized.includes("normal") || normalized.includes("attack")) return "normals";
  return "other";
}

function collectRawSkills(weapon: any): Array<{ value: any; fallbackCategory: string }> {
  if (Array.isArray(weapon?.skills)) {
    return weapon.skills.map((value: any) => ({ value, fallbackCategory: "Other" }));
  }

  const result: Array<{ value: any; fallbackCategory: string }> = [];
  const source =
    weapon?.skills && typeof weapon.skills === "object" ? weapon.skills : weapon?.skillsByCategory;
  if (!source || typeof source !== "object") return result;

  const aliases: Record<string, string> = {
    normals: "Normal",
    normal: "Normal",
    dodges: "Dodge",
    dodge: "Dodge",
    skills: "Skill",
    skill: "Skill",
    discharges: "Discharge",
    discharge: "Discharge",
    passives: "Passive",
    passive: "Passive",
    other: "Other",
  };

  for (const [key, values] of Object.entries(source)) {
    if (!Array.isArray(values)) continue;
    const fallbackCategory = aliases[key.toLowerCase()] || key;
    for (const value of values) result.push({ value, fallbackCategory });
  }
  return result;
}

function localizeSkill(raw: any, fallbackCategory: string, locale: "en" | "ru"): any {
  const value = deepClone(raw || {});
  const names = extractLocalizedStrings(value, "name");
  const descriptions = extractLocalizedStrings(value, "desc");
  const category = value.category || fallbackCategory;

  return {
    ...value,
    category,
    name: locale === "ru" ? names.ru : names.en,
    name_en: names.en,
    name_ru: names.ru,
    description: locale === "ru" ? descriptions.ru : descriptions.en,
    description_en: descriptions.en,
    description_ru: descriptions.ru,
    desc_en: descriptions.en,
    desc_ru: descriptions.ru,
  };
}

function buildSkillBuckets(weapon: any, locale: "en" | "ru"): Record<SkillBucket, any[]> {
  const buckets = Object.fromEntries(SKILL_BUCKETS.map((bucket) => [bucket, []])) as Record<
    SkillBucket,
    any[]
  >;
  for (const { value, fallbackCategory } of collectRawSkills(weapon)) {
    const localized = localizeSkill(value, fallbackCategory, locale);
    buckets[skillBucketForCategory(localized.category)].push(localized);
  }
  return buckets;
}

function mapCuratedAssetUrl(value: unknown, slug: string): unknown {
  if (typeof value !== "string") return value;
  const match = value.match(/^\/info\/simulacra\/assets\/[^/]+\/(.+)$/i);
  return match ? `/datamine/shared/media/artworks/${slug}/${match[1]}` : value;
}

function characterSlugs(summary: any, detail: any, id: string): string[] {
  const candidates = [
    detail?.canonical_id,
    detail?.slug,
    summary?.canonical_id,
    summary?.slug,
    id,
    id.replace(/-mmo$/i, ""),
  ];

  return [
    ...new Set(
      candidates
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim().toLowerCase()),
    ),
  ];
}

function loadCharacterAssets(
  simulacraDataDir: string,
  detail: any,
  summary: any,
  id: string,
): any[] {
  const baseSlug =
    characterSlugs(summary, detail, id).find((value) => !value.endsWith("-mmo")) ||
    id.replace(/-mmo$/i, "");
  if (Array.isArray(detail?.assets) && detail.assets.length > 0) {
    return detail.assets.map((asset: any) => ({
      ...deepClone(asset),
      pngUrl: mapCuratedAssetUrl(asset?.pngUrl, baseSlug),
      webpUrl: mapCuratedAssetUrl(asset?.webpUrl, baseSlug),
    }));
  }

  for (const slug of characterSlugs(summary, detail, id)) {
    const assetsPath = path.join(simulacraDataDir, `${slug.replace(/-mmo$/i, "")}-assets.json`);
    if (!fs.existsSync(assetsPath)) continue;

    try {
      const rawAssets = JSON.parse(fs.readFileSync(assetsPath, "utf8"));
      if (!Array.isArray(rawAssets)) continue;
      return rawAssets.map((asset: any) => ({
        ...deepClone(asset),
        pngUrl: mapCuratedAssetUrl(asset?.pngUrl, baseSlug),
        webpUrl: mapCuratedAssetUrl(asset?.webpUrl, baseSlug),
      }));
    } catch {
      // Probe the next canonical/alias candidate.
    }
  }

  return [];
}

export function normalizeSimulacraDataset(legacySourceDir: string, rawSourceDir?:string): DatasetNormalizationResult {
  const skillCurves=loadSkillTipCurves(rawSourceDir);
  const simulacraDataDir = path.join(legacySourceDir, "info", "simulacra", "data");
  const indexPath = path.join(simulacraDataDir, "simulacra-index.json");
  const mmoIndexPath = path.join(simulacraDataDir, "simulacra-mmo-index.json");

  let rawGachaSummaries: any[] = [];
  if (fs.existsSync(indexPath)) {
    try {
      rawGachaSummaries = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    } catch {
      rawGachaSummaries = [];
    }
  }

  let rawMmoSummaries: any[] = [];
  if (fs.existsSync(mmoIndexPath)) {
    try {
      rawMmoSummaries = JSON.parse(fs.readFileSync(mmoIndexPath, "utf8"));
    } catch {
      rawMmoSummaries = [];
    }
  }

  // Combine unique entries with gacha priority
  const combinedRawSummaries = [...rawGachaSummaries];
  const gachaIds = new Set(rawGachaSummaries.map((s) => s.id));
  for (const mmo of rawMmoSummaries) {
    if (!gachaIds.has(mmo.id)) {
      combinedRawSummaries.push(mmo);
    }
  }

  const coreItems: any[] = [];
  const overlayEnItems: any[] = [];
  const overlayRuItems: any[] = [];

  const gachaMaterializedEn: any[] = [];
  const gachaMaterializedRu: any[] = [];
  const mmoMaterializedEn: any[] = [];
  const mmoMaterializedRu: any[] = [];

  const loadRecordList = (filename: string): any[] => {
    const fullPath = path.join(simulacraDataDir, filename);
    if (!fs.existsSync(fullPath)) return [];
    try {
      const value = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (Array.isArray(value)) return value;
      for (const key of ["items", "simulacra"]) {
        if (Array.isArray(value?.[key])) return value[key];
      }
    } catch {
      // A malformed aggregate must not prevent the per-record export path.
    }
    return [];
  };

  // The legacy site keeps both per-character detail files and aggregate
  // materialized datasets. Aggregate records are a deliberate last-resort
  // fallback for partial exports, never a replacement for detail files.
  const unifiedRecords = [
    ...loadRecordList("simulacra.json"),
    ...loadRecordList("simulacra-mmo.json"),
  ];

  const findUnifiedRecord = (summary: any, isMmo: boolean): any | null => {
    const id = String(summary?.id || summary?.slug || "").toLowerCase();
    const baseId = id.replace(/-mmo$/i, "");
    const matches = unifiedRecords.filter((record) => {
      const recordId = String(record?.id || "").toLowerCase();
      const mode = record?.server_mode || record?.edition;
      if (isMmo && mode !== "mmo") return false;
      if (!isMmo && mode === "mmo") return false;
      return [recordId, record?.slug, record?.canonical_id]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .some((value) => value === id || value === baseId);
    });
    return matches[0] || null;
  };

  // Legacy writes MMO index IDs as `${slug}-mmo`, while the detail file is
  // `${slug}-mmo.json`. Gacha uses `${slug}.json`. Probe both canonical and
  // alias forms so a renamed character cannot silently fall back to its thin
  // index row.
  const loadDetail = (summary: any, isMmo: boolean): any | null => {
    const id = String(summary?.id || summary?.slug || "").trim();
    const baseSlug = id.replace(/-mmo$/i, "");
    const candidates = isMmo
      ? [`${id}.json`, `${baseSlug}-mmo.json`]
      : [`${id}.json`, `${baseSlug}.json`];

    for (const filename of [...new Set(candidates)]) {
      const fullPath = path.join(simulacraDataDir, filename);
      if (!fs.existsSync(fullPath)) continue;
      try {
        return JSON.parse(fs.readFileSync(fullPath, "utf8"));
      } catch {
        // Probe the next legacy-compatible filename.
      }
    }
    return findUnifiedRecord(summary, isMmo);
  };

  const processSummary = (summary: any, isMmo: boolean) => {
    const slug = summary.id || summary.slug || "";
    const detail = loadDetail(summary, isMmo) || summary;
    const knownElementCorrection = correctKnownSimulacraElements(summary, detail, isMmo);
    const assets = loadCharacterAssets(simulacraDataDir, detail, summary, slug);

    const names = extractLocalizedStrings({ ...detail, ...summary }, "name");
    const weaponNames = extractLocalizedStrings({ ...detail, ...summary }, "weapon_name");

    // Preserve fields discovered by the legacy builder instead of silently
    // dropping newly-added datamine/developer fields.
    const normalizedKeys = new Set([
      "id",
      "slug",
      "canonical_id",
      "avatar_id",
      "imitation_id",
      "weapon_id",
      "matrix_suit_id",
      "matrix_suit_num",
      "name",
      "name_en",
      "name_ru",
      "weapon_name",
      "weapon_name_en",
      "weapon_name_ru",
      "element",
      "element_secondary",
      "element_combo_icon",
      "role",
      "role_icon",
      "resonance",
      "rarity",
      "server_mode",
      "edition",
      "season",
      "season_tag",
      "season_badge",
      "season_name_en",
      "season_name_ru",
      "has_matrices",
      "no_matrices",
      "matrices_available",
      "avatar",
      "avatar_thumb",
      "portrait",
      "portrait_thumb",
      "detail_art",
      "detail_art_thumb",
      "card",
      "card_thumb",
      "art_focus",
      "icon",
      "icon_thumb",
      "base_stats",
      "max_stats",
      "advancements",
      "traits",
      "affinity_ladder",
      "matrix",
      "weapon",
      "assets",
      "coefficients",
      "media",
      "sources",
      "provenance",
      "changelogs",
    ]);
    const developerFields = Object.fromEntries(
      Object.entries(detail)
        .filter(([key]) => !normalizedKeys.has(key))
        .map(([key, value]) => [key, deepClone(value)]),
    );

    const scaledWeapon=deepClone(detail.weapon || {});
    if(!isMmo)restoreSkillCurveTimes(scaledWeapon,skillCurves);
    const skillsEn = buildSkillBuckets(scaledWeapon, "en");
    const skillsRu = buildSkillBuckets(scaledWeapon, "ru");
    const skillsCore = buildSkillBuckets(scaledWeapon, "en");
    const serverMode = isMmo ? "mmo" : "gacha";
    const changelogs = [
      ...buildZoeyChangelogFixtures(slug, serverMode),
      ...(Array.isArray(detail.changelogs) ? deepClone(detail.changelogs) : []),
    ];

    // 1. Language-independent Core
    const core: Record<string, any> = {
      ...developerFields,
      id: slug,
      slug: detail.slug || summary.slug || slug,
      canonical_id: detail.canonical_id || summary.canonical_id || slug.replace(/-mmo$/i, ""),
      avatar_id: summary.avatar_id || detail.avatar_id || null,
      imitation_id: summary.imitation_id || detail.imitation_id || null,
      weapon_id: summary.weapon_id || detail.weapon_id || null,
      matrix_suit_id: summary.matrix_suit_id || detail.matrix_suit_id || null,
      matrix_suit_num: summary.matrix_suit_num ?? detail.matrix_suit_num ?? null,
      element: knownElementCorrection?.element || summary.element || detail.element || "Physical",
      element_secondary:
        knownElementCorrection?.element_secondary ||
        summary.element_secondary ||
        detail.element_secondary ||
        null,
      element_combo_icon: summary.element_combo_icon || detail.element_combo_icon || null,
      role: summary.role || summary.resonance || detail.role || "DPS",
      role_icon: summary.role_icon || detail.role_icon || null,
      resonance: summary.resonance || detail.resonance || null,
      rarity: summary.rarity || detail.rarity || "SSR",
      server_mode: serverMode,
      edition: serverMode,
      has_matrices: summary.has_matrices ?? detail.has_matrices ?? false,
      no_matrices: summary.no_matrices ?? detail.no_matrices ?? false,
      season: summary.season || detail.season || null,
      season_tag: summary.season_tag || detail.season_tag || null,
      season_badge: summary.season_badge || detail.season_badge || null,
      season_name_en: detail.season_name_en || summary.season_name_en || null,
      season_name_ru: detail.season_name_ru || summary.season_name_ru || null,
      matrices_available: detail.matrices_available ?? summary.matrices_available ?? null,
      avatar: summary.avatar || detail.avatar || "",
      avatar_thumb: summary.avatar_thumb || detail.avatar_thumb || summary.avatar || "",
      portrait: summary.portrait || detail.portrait || "",
      portrait_thumb: summary.portrait_thumb || detail.portrait_thumb || summary.portrait || "",
      detail_art: summary.detail_art || detail.detail_art || summary.portrait || "",
      detail_art_thumb:
        summary.detail_art_thumb || detail.detail_art_thumb || summary.portrait || "",
      card: summary.card || detail.card || "",
      card_thumb: summary.card_thumb || detail.card_thumb || summary.card || "",
      art_focus: summary.art_focus || detail.art_focus || null,
      icon: summary.icon || detail.icon || "",
      icon_thumb: summary.icon_thumb || detail.icon_thumb || summary.icon || "",
      base_stats: detail.base_stats || {},
      max_stats: detail.max_stats || {},
      matrix: deepClone(detail.matrix || null),
      affinity_ladder: deepClone(detail.affinity_ladder || []),
      coefficients: deepClone(detail.coefficients || {}),
      media: deepClone(detail.media || null),
      sources: deepClone(detail.sources || null),
      assets,
      provenance: detail.provenance || null,
      ...(knownElementCorrection?.warning
        ? { data_warnings: [knownElementCorrection.warning] }
        : {}),
      ...(changelogs.length > 0 ? { changelogs } : {}),
    };

    // Advancements core & overlays
    const advancementsCore: any[] = [];
    const advancementsEn: any[] = [];
    const advancementsRu: any[] = [];
    if (Array.isArray(detail.advancements)) {
      for (const adv of detail.advancements) {
        advancementsCore.push({
          star: adv.star ?? 0,
          multipliers: adv.multipliers || {},
        });
        const advNames = extractLocalizedStrings(adv, "name");
        const advDescs = extractLocalizedStrings(adv, "desc");
        advancementsEn.push({
          star: adv.star ?? 0,
          name: advNames.en,
          description: advDescs.en,
          multipliers: deepClone(adv.multipliers || {}),
        });
        advancementsRu.push({
          star: adv.star ?? 0,
          name: advNames.ru,
          description: advDescs.ru,
          multipliers: deepClone(adv.multipliers || {}),
        });
      }
    }
    core.advancements = advancementsCore;

    // Traits core & overlays
    const traitsCore: any[] = [];
    const traitsEn: any[] = [];
    const traitsRu: any[] = [];
    if (Array.isArray(detail.traits)) {
      for (const t of detail.traits) {
        traitsCore.push({
          affinity: t.affinity ?? 0,
          value: t.value,
          driver_en: t.driver_en || null,
          driver_ru: t.driver_ru || null,
          affinity_ladder: deepClone(t.affinity_ladder || []),
        });
        const tNames = extractLocalizedStrings(t, "name");
        const tDescs = extractLocalizedStrings(t, "desc");
        traitsEn.push({
          affinity: t.affinity ?? 0,
          name: tNames.en,
          description: tDescs.en,
          driver_en: t.driver_en || null,
          driver_ru: t.driver_ru || null,
          affinity_ladder: deepClone(t.affinity_ladder || []),
        });
        traitsRu.push({
          affinity: t.affinity ?? 0,
          name: tNames.ru,
          description: tDescs.ru,
          driver_en: t.driver_en || null,
          driver_ru: t.driver_ru || null,
          affinity_ladder: deepClone(t.affinity_ladder || []),
        });
      }
    }
    core.traits = traitsCore;

    // Weapon core & overlays
    const rawW = scaledWeapon;
    const weaponCore: Record<string, any> = {
      ...deepClone(rawW),
      id: rawW.id || core.weapon_id || "",
      icon: rawW.icon || core.icon,
      element: rawW.element || core.element,
      element_secondary: rawW.element_secondary || core.element_secondary,
      role: rawW.role || core.role,
      rarity: rawW.rarity || core.rarity,
      shatter: rawW.shatter || 0,
      charge: rawW.charge || 0,
      type: rawW.type || null,
      skills: skillsCore,
    };
    const weaponEn: Record<string, any> = {
      ...deepClone(rawW),
      name: weaponNames.en,
      skills: skillsEn,
      skillsByCategory: {
        normal: skillsEn.normals,
        dodge: skillsEn.dodges,
        skill: skillsEn.skills,
        discharge: skillsEn.discharges,
        passive: skillsEn.passives,
        other: skillsEn.other,
      },
    };
    const weaponRu: Record<string, any> = {
      ...deepClone(rawW),
      name: weaponNames.ru,
      skills: skillsRu,
      skillsByCategory: {
        normal: skillsRu.normals,
        dodge: skillsRu.dodges,
        skill: skillsRu.skills,
        discharge: skillsRu.discharges,
        passive: skillsRu.passives,
        other: skillsRu.other,
      },
    };
    core.weapon = weaponCore;

    // Overlays
    const overlayEn = {
      id: slug,
      name: names.en,
      name_en: names.en,
      name_ru: names.ru,
      weapon_name: weaponNames.en,
      weapon_name_en: weaponNames.en,
      weapon_name_ru: weaponNames.ru,
      advancements: advancementsEn,
      traits: traitsEn,
      matrix: deepClone(detail.matrix || null),
      affinity_ladder: deepClone(detail.affinity_ladder || []),
      coefficients: deepClone(detail.coefficients || {}),
      media: deepClone(detail.media || null),
      sources: deepClone(detail.sources || null),
      assets,
      weapon: weaponEn,
    };

    const overlayRu = {
      id: slug,
      name: names.ru,
      name_en: names.en,
      name_ru: names.ru,
      weapon_name: weaponNames.ru,
      weapon_name_en: weaponNames.en,
      weapon_name_ru: weaponNames.ru,
      advancements: advancementsRu,
      traits: traitsRu,
      matrix: deepClone(detail.matrix || null),
      affinity_ladder: deepClone(detail.affinity_ladder || []),
      coefficients: deepClone(detail.coefficients || {}),
      media: deepClone(detail.media || null),
      sources: deepClone(detail.sources || null),
      assets,
      weapon: weaponRu,
    };

    // Materialized item
    const materializedEn = {
      ...deepClone(core),
      ...overlayEn,
      advancements: advancementsEn,
      traits: traitsEn,
      weapon: {
        ...weaponCore,
        name: weaponNames.en,
        skills: weaponEn.skills,
        skillsByCategory: weaponEn.skillsByCategory,
      },
    };

    const materializedRu = {
      ...deepClone(core),
      ...overlayRu,
      advancements: advancementsRu,
      traits: traitsRu,
      weapon: {
        ...weaponCore,
        name: weaponNames.ru,
        skills: weaponRu.skills,
        skillsByCategory: weaponRu.skillsByCategory,
      },
    };

    return {
      core,
      overlayEn,
      overlayRu,
      materializedEn,
      materializedRu,
    };
  };

  // Process gacha
  for (const item of rawGachaSummaries) {
    const res = processSummary(item, false);
    coreItems.push(res.core);
    overlayEnItems.push(res.overlayEn);
    overlayRuItems.push(res.overlayRu);
    gachaMaterializedEn.push(res.materializedEn);
    gachaMaterializedRu.push(res.materializedRu);
  }

  // Process mmo
  for (const item of rawMmoSummaries) {
    const res = processSummary(item, true);
    mmoMaterializedEn.push(res.materializedEn);
    mmoMaterializedRu.push(res.materializedRu);
  }

  const sortedCore = sortById(coreItems);
  const sortedOverlayEn = sortById(overlayEnItems);
  const sortedOverlayRu = sortById(overlayRuItems);

  const sortedGachaEn = sortById(gachaMaterializedEn);
  const sortedGachaRu = sortById(gachaMaterializedRu);
  const sortedMmoEn = sortById(mmoMaterializedEn);
  const sortedMmoRu = sortById(mmoMaterializedRu);

  const matEn = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedGachaEn.length,
    counts: {
      total: sortedGachaEn.length,
      gacha: sortedGachaEn.length,
      mmo: sortedMmoEn.length,
    },
    items: sortedGachaEn,
    gacha: sortedGachaEn,
    mmo: sortedMmoEn,
  };

  const matRu = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedGachaRu.length,
    counts: {
      total: sortedGachaRu.length,
      gacha: sortedGachaRu.length,
      mmo: sortedMmoRu.length,
    },
    items: sortedGachaRu,
    gacha: sortedGachaRu,
    mmo: sortedMmoRu,
  };

  return {
    datasetName: "simulacra",
    core: {
      schemaVersion: 1,
      total: sortedCore.length,
      items: sortedCore,
    },
    overlays: {
      en: {
        total: sortedOverlayEn.length,
        items: sortedOverlayEn,
      },
      ru: {
        total: sortedOverlayRu.length,
        items: sortedOverlayRu,
      },
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts: {
      gacha: sortedGachaEn.length,
      mmo: sortedMmoEn.length,
      total: sortedGachaEn.length,
    },
  };
}
