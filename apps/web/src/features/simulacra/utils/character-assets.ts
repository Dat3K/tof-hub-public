import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { gameAsset } from "@tof-hub/game-assets";
import type { SimulacraAssetItem } from "../types";

function resolveCharacterAssetUrl(rawPath: unknown, format: "png" | "webp"): string {
  if (typeof rawPath !== "string" || !rawPath.trim()) return "";
  // Curated artwork is copied by the prepared-files builder to a public
  // non-game path. It must not be sent through the game-asset resolver.
  if (/^\/(?:datamine\/shared\/media\/artworks|info\/simulacra\/assets)\//i.test(rawPath)) {
    return rawPath;
  }
  return gameAsset(rawPath, format);
}

function normalizeAssetReference(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\\/g, "/")
    .replace(/\.[a-z0-9_-]+$/i, "")
    .toLowerCase();
}

/**
 * Resolves a weapon-skill icon using the same two-stage lookup as legacy:
 * first the raw game reference, then the prepared character-linked asset.
 */
export function resolveSkillIconUrl(data: SimulacraDatasetItemRaw, skill: any): string {
  if (!data || !skill) return "";

  const rawIcon =
    skill.icon_thumb ||
    (typeof skill.icon === "object" ? skill.icon.thumb || skill.icon.full : skill.icon) ||
    "";
  const skillId = normalizeAssetReference(skill.id || skill.action_id);
  const assetRef = normalizeAssetReference(skill.icon?.assetRef);
  const charAssets = Array.isArray((data as any).assets)
    ? ((data as any).assets as SimulacraAssetItem[])
    : getCharacterAssets(data);

  const foundAsset = charAssets.find((asset) => {
    if (!asset) return false;
    const assetId = normalizeAssetReference(asset.id);
    const assetFile = normalizeAssetReference(asset.file);
    const assetUnreal = normalizeAssetReference(asset.unrealPath);
    const sameSkillId = skillId && (assetId === skillId || assetFile === skillId);
    const sameSourceRef = assetRef && assetUnreal === assetRef;
    return Boolean(sameSkillId || sameSourceRef);
  });

  if (foundAsset?.webpUrl || foundAsset?.pngUrl) {
    return foundAsset.webpUrl || foundAsset.pngUrl;
  }

  return typeof rawIcon === "string" ? resolveCharacterAssetUrl(rawIcon, "webp") : "";
}
import { getCleanSkills } from "./skill-scaling";

export function getCharacterAssets(
  data: SimulacraDatasetItemRaw,
  lang: string = "en",
): SimulacraAssetItem[] {
  if (!data) return [];

  const isRu = lang === "ru";
  const charName = isRu
    ? data.name_ru || data.name || data.name_en || data.id
    : data.name_en || data.name || data.id;
  const weaponName = isRu
    ? data.weapon_name_ru || data.weapon_name || data.weapon_name_en || ""
    : data.weapon_name_en || data.weapon_name || "";

  // If character object has explicit assets array, map and return it
  if (Array.isArray((data as any).assets) && (data as any).assets.length > 0) {
    const mapped = (data as any).assets.map((a: any) => ({
      id: a.id || String(Math.random()),
      file: a.file || `${a.id}.png`,
      name_en: a.name_en || a.id,
      name_ru: a.name_ru || a.name_en || a.id,
      category: a.category || "art",
      badge_en: a.badge_en || "Asset",
      badge_ru: a.badge_ru || "Ассет",
      width: a.width,
      height: a.height,
      resolution: a.resolution || (a.width && a.height ? `${a.width}×${a.height}` : undefined),
      pngUrl: resolveCharacterAssetUrl(a.pngUrl, "png"),
      webpUrl: a.webpUrl ? resolveCharacterAssetUrl(a.webpUrl, "webp") : undefined,
      unrealPath: a.unrealPath || a.file || "",
      sizeBytes: a.sizeBytes || a.pngSizeBytes,
    }));

    // Ensure Zoey's localized Special Order banner title is available
    if (
      (data.id === "zoey" || (data as any).character_id === "zoey") &&
      !mapped.some((a: any) => a.id === "UI_UP_asilada_Title")
    ) {
      mapped.unshift({
        id: "UI_UP_asilada_Title",
        file: isRu ? "UI_UP_asilada_Title_L10N_ru.png" : "UI_UP_asilada_Title_L10N_en.png",
        name_en: "Zoey Special Order Banner Title (Vigilance Codex)",
        name_ru: "Логотип спецзаказа Зои (Кодекс бдительности)",
        category: "art",
        badge_en: "Banner Title Logo",
        badge_ru: "Логотип баннера",
        width: 900,
        height: 250,
        resolution: "900×250",
        pngUrl: isRu
          ? "/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_ru.png"
          : "/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_en.png",
        webpUrl: isRu
          ? "/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_ru.png"
          : "/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_en.png",
        unrealPath: isRu
          ? "/Game/Resources/UI/chouka/Newchouka/UP_060_ZY/L10N/ru/UI_UP_asilada_Title"
          : "/Game/Resources/UI/chouka/Newchouka/UP_060_ZY/L10N/en/UI_UP_asilada_Title",
        sizeBytes: isRu ? 265826 : 270291,
      });
    }

    return mapped;
  }

  const list: SimulacraAssetItem[] = [];
  const seenUrls = new Set<string>();

  const pushAsset = (
    id: string,
    nameEn: string,
    nameRu: string,
    category: SimulacraAssetItem["category"],
    badgeEn: string,
    badgeRu: string,
    rawPath: string | null | undefined,
    resolution?: string,
  ) => {
    if (!rawPath || seenUrls.has(rawPath)) return;
    seenUrls.add(rawPath);

    const assetUrl = gameAsset(rawPath);
    list.push({
      id,
      file: `${id}.png`,
      name_en: nameEn,
      name_ru: nameRu,
      category,
      badge_en: badgeEn,
      badge_ru: badgeRu,
      resolution,
      pngUrl: assetUrl,
      webpUrl: assetUrl,
      unrealPath: rawPath.startsWith("/") ? rawPath : `/Game/${rawPath}`,
    });
  };

  // 1. Art & Splash
  if (data.detail_art || data.portrait) {
    pushAsset(
      "detail_art",
      `${data.name_en || charName} Detail Art`,
      `Основной арт: ${charName}`,
      "art",
      "Detail Art",
      "Основной арт",
      data.detail_art || data.portrait,
      "1024×1024",
    );
  }

  if (data.card) {
    pushAsset(
      "card",
      `${data.name_en || charName} Awakening Splash`,
      `Арт пробуждения: ${charName}`,
      "art",
      "Awakening Splash",
      "Арт пробуждения",
      data.card,
      "1024×1024",
    );
  }

  // 2. Avatar
  if (data.avatar && data.avatar !== data.detail_art && data.avatar !== data.portrait) {
    pushAsset(
      "avatar",
      `${data.name_en || charName} Avatar`,
      `Аватар: ${charName}`,
      "avatar",
      "Avatar",
      "Аватар",
      data.avatar,
      "256×256",
    );
  }

  // 3. Weapon
  const weaponIcon = typeof data.weapon?.icon === "string" ? data.weapon.icon : data.icon;
  if (weaponIcon) {
    pushAsset(
      "weapon_icon",
      `${weaponName || charName} Weapon Icon`,
      `Иконка оружия: ${weaponName || charName}`,
      "weapon",
      "Weapon",
      "Оружие",
      weaponIcon,
      "512×512",
    );
  }

  // 4. Role Icon
  if (data.role_icon) {
    pushAsset(
      "role_icon",
      `${data.role || "DPS"} Role Icon`,
      `Иконка роли: ${data.role || "ДПС"}`,
      "skill",
      "Role Icon",
      "Иконка роли",
      data.role_icon,
      "128×128",
    );
  }

  // 5. Skills & Buffs
  const allSkills = getCleanSkills(data);
  allSkills.forEach((s, idx) => {
    const sIcon = s.icon_thumb || s.icon;
    if (sIcon && typeof sIcon === "string" && !sIcon.includes("placeholder")) {
      const sNameEn = s.name_en || `Skill ${idx + 1}`;
      const sNameRu = s.name_ru || sNameEn;
      const isBuff = s.group === "buff" || (s.id && s.id.startsWith("Buff_"));
      const isReaction = s.isReaction || (s.id && s.id.startsWith("reaction_"));
      const badgeEn = isReaction ? "Elemental Reaction" : isBuff ? "Buff" : "Skill";
      const badgeRu = isReaction ? "Реакция стихий" : isBuff ? "Бафф" : "Навык";

      pushAsset(
        s.id || `skill_${idx}`,
        sNameEn,
        sNameRu,
        "skill",
        badgeEn,
        badgeRu,
        sIcon,
        "128×128",
      );
    }
  });

  // 6. Matrix Pieces
  const matrixObj = (data.matrix || {}) as any;
  if (Array.isArray(matrixObj.pieces)) {
    matrixObj.pieces.forEach((p: any, idx: number) => {
      if (p && p.icon) {
        const slot = p.slot || idx + 1;
        pushAsset(
          `matrix_slot_${slot}`,
          `${data.name_en || charName} Matrix Piece ${slot}`,
          `Матрица: ${charName} (Слот ${slot})`,
          "matrix",
          `Matrix Slot ${slot}`,
          `Чип матрицы ${slot}`,
          p.icon,
          "512×512",
        );
      }
    });
  }

  return list;
}
