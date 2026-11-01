import fs from "node:fs";
import path from "node:path";
import type { DatasetNormalizationResult } from "../types";
import { sortById, deepClone, extractLocalizedStrings } from "../split-merge";
import { correctKnownCarrierElements } from "../known-data-corrections";

export function normalizeMatricesDataset(legacySourceDir: string): DatasetNormalizationResult {
  const filePath = path.join(legacySourceDir, "info", "matrices", "data", "matrices.json");
  let rawData: any = { items: [] };

  if (fs.existsSync(filePath)) {
    try {
      rawData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      rawData = { items: [] };
    }
  }

  const rawItems: any[] = Array.isArray(rawData.items)
    ? rawData.items
    : Array.isArray(rawData)
      ? rawData
      : [];

  const coreItems: any[] = [];
  const overlayEnItems: any[] = [];
  const overlayRuItems: any[] = [];
  const materializedEnItems: any[] = [];
  const materializedRuItems: any[] = [];

  for (const raw of rawItems) {
    const id = String(raw.id || "");
    const names = extractLocalizedStrings(raw, "name");

    // 1. Language-independent Core
    const core: Record<string, any> = {
      id,
      quality: raw.quality || "SSR",
      icon: raw.icon || raw.piece_icon || "",
      icon_thumb: raw.icon_thumb || raw.icon || "",
      piece_icon: raw.piece_icon || raw.icon || "",
      piece_icon_thumb: raw.piece_icon_thumb || raw.icon || "",
      suit_portrait: raw.suit_portrait || raw.icon || "",
      suit_portrait_thumb: raw.suit_portrait_thumb || raw.suit_portrait || raw.icon || "",
      remould_icon: raw.remould_icon || null,
      remould_icon_thumb: raw.remould_icon_thumb || null,
      is_opened: Boolean(raw.is_opened),
      playable_carrier: Boolean(raw.playable_carrier),
      has_carrier: Boolean(raw.has_carrier),
    };

    // Pieces core & overlay
    const piecesCore: any[] = [];
    const piecesEn: any[] = [];
    const piecesRu: any[] = [];
    if (Array.isArray(raw.pieces)) {
      for (const p of raw.pieces) {
        piecesCore.push({
          id: String(p.id || ""),
          slot: Number(p.slot ?? 1),
          icon: p.icon || "",
          icon_thumb: p.icon_thumb || p.icon || "",
          stats: Array.isArray(p.stats) ? p.stats : [],
        });

        const pNames = extractLocalizedStrings(p, "name");
        const pSlotNames = extractLocalizedStrings(p, "slot_name");
        const pDescs = extractLocalizedStrings(p, "description");

        piecesEn.push({
          id: String(p.id || ""),
          slot: Number(p.slot ?? 1),
          slot_name: pSlotNames.en,
          name: pNames.en,
          description: pDescs.en,
        });

        piecesRu.push({
          id: String(p.id || ""),
          slot: Number(p.slot ?? 1),
          slot_name: pSlotNames.ru,
          name: pNames.ru,
          description: pDescs.ru,
        });
      }
    }
    core.pieces = piecesCore;

    // Effects core & overlay
    const effectsCore: any[] = [];
    const effectsEn: any[] = [];
    const effectsRu: any[] = [];
    if (Array.isArray(raw.effects)) {
      for (const eff of raw.effects) {
        const starsCore: any[] = [];
        const starsEn: any[] = [];
        const starsRu: any[] = [];

        if (Array.isArray(eff.stars)) {
          for (const st of eff.stars) {
            starsCore.push({
              star: Number(st.star ?? 0),
              cs_score: st.cs_score,
              buff_id: st.buff_id,
              is_global: Boolean(st.is_global),
            });
            const stTexts = extractLocalizedStrings(st, "text");
            starsEn.push({
              star: Number(st.star ?? 0),
              text: stTexts.en,
              html: st.html_en || stTexts.en,
            });
            starsRu.push({
              star: Number(st.star ?? 0),
              text: stTexts.ru,
              html: st.html_ru || stTexts.ru,
            });
          }
        }

        effectsCore.push({
          piece_count: Number(eff.piece_count || eff.pieces || 2),
          buff_id: eff.buff_id || null,
          stars: starsCore,
        });

        const effNames = extractLocalizedStrings(eff, "name");
        const effDescs = extractLocalizedStrings(eff, "desc");

        effectsEn.push({
          piece_count: Number(eff.piece_count || eff.pieces || 2),
          name: effNames.en,
          description: effDescs.en,
          stars: starsEn,
        });

        effectsRu.push({
          piece_count: Number(eff.piece_count || eff.pieces || 2),
          name: effNames.ru,
          description: effDescs.ru,
          stars: starsRu,
        });
      }
    }
    core.effects = effectsCore;

    // Carriers core & overlay
    const carriersCore: any[] = [];
    const carriersEn: any[] = [];
    const carriersRu: any[] = [];
    if (Array.isArray(raw.carriers)) {
      for (const c of raw.carriers) {
        const knownElementCorrection = correctKnownCarrierElements(c);
        const carrierElement = knownElementCorrection?.element || c.element || null;
        const carrierSecondaryElement =
          knownElementCorrection?.element_secondary || c.element_secondary || null;
        carriersCore.push({
          id: String(c.id || ""),
          char_id: c.char_id || null,
          weapon_id: c.weapon_id || null,
          char_name_en: c.char_name_en || null,
          char_name_ru: c.char_name_ru || null,
          weapon_name_en: c.weapon_name_en || null,
          weapon_name_ru: c.weapon_name_ru || null,
          element: carrierElement,
          element_secondary: carrierSecondaryElement,
          element_combo_icon: c.element_combo_icon || null,
          role: c.role || null,
          role_icon: c.role_icon || null,
          icon: c.icon || c.weapon_icon?.fullUrl || c.weapon_icon?.url || null,
          icon_thumb: c.icon_thumb || c.weapon_icon?.thumbUrl || c.weapon_icon?.fullUrl || null,
          avatar: c.avatar || null,
          avatar_thumb: c.avatar_thumb || null,
        });
        const cNames = extractLocalizedStrings(c, "char_name");
        const cWeaponNames = extractLocalizedStrings(c, "weapon_name");

        carriersEn.push({
          id: String(c.id || ""),
          char_id: c.char_id || null,
          weapon_id: c.weapon_id || null,
          char_name: cNames.en || c.name_en || "",
          char_name_en: c.char_name_en || c.name_en || cNames.en || "",
          char_name_ru: c.char_name_ru || c.name_ru || cNames.ru || "",
          weapon_name: cWeaponNames.en || c.weapon_name_en || "",
          weapon_name_en: c.weapon_name_en || cWeaponNames.en || "",
          element: carrierElement,
          element_secondary: carrierSecondaryElement,
          element_combo_icon: c.element_combo_icon || null,
          role: c.role || null,
          role_icon: c.role_icon || null,
          icon: c.icon || c.weapon_icon?.fullUrl || c.weapon_icon?.url || null,
          icon_thumb: c.icon_thumb || c.weapon_icon?.thumbUrl || c.weapon_icon?.fullUrl || null,
        });
        carriersRu.push({
          id: String(c.id || ""),
          char_id: c.char_id || null,
          weapon_id: c.weapon_id || null,
          char_name: cNames.ru || c.name_ru || "",
          char_name_en: c.char_name_en || c.name_en || cNames.en || "",
          char_name_ru: c.char_name_ru || c.name_ru || cNames.ru || "",
          weapon_name: cWeaponNames.ru || c.weapon_name_ru || "",
          weapon_name_en: c.weapon_name_en || cWeaponNames.en || "",
          weapon_name_ru: c.weapon_name_ru || cWeaponNames.ru || "",
          element: carrierElement,
          element_secondary: carrierSecondaryElement,
          element_combo_icon: c.element_combo_icon || null,
          role: c.role || null,
          role_icon: c.role_icon || null,
          icon: c.icon || c.weapon_icon?.fullUrl || c.weapon_icon?.url || null,
          icon_thumb: c.icon_thumb || c.weapon_icon?.thumbUrl || c.weapon_icon?.fullUrl || null,
        });
      }
    }
    core.carriers = carriersCore;

    // Overlays
    const overlayEn = {
      id,
      name: names.en,
      name_en: names.en,
      name_ru: names.ru,
      original_name: raw.original_name || names.en,
      pieces: piecesEn,
      effects: effectsEn,
      carriers: carriersEn,
    };

    const overlayRu = {
      id,
      name: names.ru,
      name_en: names.en,
      name_ru: names.ru,
      original_name: raw.original_name || names.en,
      pieces: piecesRu,
      effects: effectsRu,
      carriers: carriersRu,
    };

    // Materialized items
    const materializedEn = {
      ...deepClone(core),
      ...overlayEn,
      pieces: piecesCore.map((pc, idx) => ({ ...pc, ...(piecesEn[idx] || {}) })),
      effects: effectsCore.map((ec, idx) => ({
        ...ec,
        ...(effectsEn[idx] || {}),
        stars: ec.stars.map((sc: any, sIdx: number) => ({
          ...sc,
          ...(effectsEn[idx]?.stars?.[sIdx] || {}),
        })),
      })),
      carriers: carriersCore.map((cc, idx) => ({ ...cc, ...(carriersEn[idx] || {}) })),
    };

    const materializedRu = {
      ...deepClone(core),
      ...overlayRu,
      pieces: piecesCore.map((pc, idx) => ({ ...pc, ...(piecesRu[idx] || {}) })),
      effects: effectsCore.map((ec, idx) => ({
        ...ec,
        ...(effectsRu[idx] || {}),
        stars: ec.stars.map((sc: any, sIdx: number) => ({
          ...sc,
          ...(effectsRu[idx]?.stars?.[sIdx] || {}),
        })),
      })),
      carriers: carriersCore.map((cc, idx) => ({ ...cc, ...(carriersRu[idx] || {}) })),
    };

    coreItems.push(core);
    overlayEnItems.push(overlayEn);
    overlayRuItems.push(overlayRu);
    materializedEnItems.push(materializedEn);
    materializedRuItems.push(materializedRu);
  }

  const sortedCore = sortById(coreItems);
  const sortedOverlayEn = sortById(overlayEnItems);
  const sortedOverlayRu = sortById(overlayRuItems);
  const sortedMatEn = sortById(materializedEnItems);
  const sortedMatRu = sortById(materializedRuItems);

  const matEn = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedMatEn.length,
    counts: rawData.counts || { total: sortedMatEn.length },
    items: sortedMatEn,
    suits: sortedMatEn,
  };

  const matRu = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedMatRu.length,
    counts: rawData.counts || { total: sortedMatRu.length },
    items: sortedMatRu,
    suits: sortedMatRu,
  };

  return {
    datasetName: "matrices",
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
      total: sortedMatEn.length,
    },
  };
}
