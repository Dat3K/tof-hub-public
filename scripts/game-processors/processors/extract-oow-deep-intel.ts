import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import { toCanonicalMediaUrl } from './canonical-media-library';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = readGameSourceFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return JSON.parse(raw);
}

function resolveProjectRoot() {
  const customArg = process.argv.find((arg) => arg.startsWith("--project-root="));
  if (customArg) return path.resolve(customArg.slice("--project-root=".length));
  let cur = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, "package.json"))) return cur;
    cur = path.resolve(cur, "..");
  }
  return path.resolve(__dirname, "../..");
}

function resolveRawDir(projectRoot) {
  const customArg = process.argv.find((arg) => arg.startsWith("--raw-dir="));
  if (customArg) return path.resolve(customArg.split("=")[1]);

  const candidateDirs = [
    path.join(projectRoot, "datamine-pipeline", "raw_exports"),
    path.join(projectRoot, "raw_exports"),
    path.join(projectRoot, "..", "temperary"),
    path.join(projectRoot, "temperary"),
    path.join(projectRoot, "..", "raw_exports")
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(projectRoot, "raw_exports");
}

import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';

const COMMON_BUFF_FALLBACKS = {
  War_ImmuneEverything_Level1: {
    en: "Invulnerability Phase",
    ru: "Фаза неуязвимости",
    descEn: "Periodically gains total immunity to all damage.",
    descRu: "Периодически получает полный иммунитет к урону.",
    icon: "buff_cubeshield_001.png"
  },
  War_ResonanceDamBeUp_Level1: {
    en: "Resonance Vulnerability",
    ru: "Уязвимость к резонансу",
    descEn: "Takes significantly increased damage from elemental resonance.",
    descRu: "Получает увеличенный урон от стихийного резонанса.",
    icon: "buff_Blend_001.png"
  },
  War_MonCreateBlackHole_Level1: {
    en: "Black Hole",
    ru: "Черная дыра",
    descEn: "Periodically opens a gravitational black hole pulling nearby players.",
    descRu: "Периодически притягивает игроков в черную дыру.",
    icon: "buff_cubeshield_001.png"
  },
  Buff_War_MonHalo: {
    en: "Combat Halo",
    ru: "Боевой ореол",
    descEn: "Emits a combat halo boosting surrounding monsters.",
    descRu: "Излучает боевой ореол, усиливающий монстров рядом.",
    icon: "buff_chongdong_player_015.png"
  },
  War_MonHalo: {
    en: "Combat Halo",
    ru: "Боевой ореол",
    descEn: "Emits a combat halo boosting surrounding monsters.",
    descRu: "Излучает боевой ореол, усиливающий монстров рядом.",
    icon: "buff_chongdong_player_015.png"
  },
  War_RecoveryHp_Level1: {
    en: "Courageous Heart I",
    ru: "Отважное сердце I",
    descEn: "Recover 1.2% HP every second.",
    descRu: "Восстанавливает 1,2% ОЗ каждую секунду.",
    icon: "buff_assisatnt.png"
  }
};

function extractOowDeepIntel() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const gameResDir = path.join(projectRoot, "datamine-pipeline", "Tower-of-fantasy-game-resources");
  const buffsAssetDir = path.join(projectRoot, "datamine", "oow", "assets", "buffs");

  if (!fs.existsSync(buffsAssetDir)) {
    fs.mkdirSync(buffsAssetDir, { recursive: true });
  }

  console.log(`\n======================================================`);
  console.log(`[oow-deep-intel] Extracting Deep OOW & BigSecret Intel`);
  console.log(`======================================================`);
  console.log(`Using raw directory: ${rawDir}`);

  const roundConfigFile = path.join(rawDir, "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarRoundConfigDataTable_Overseas.json");
  const seasonConfigFile = path.join(rawDir, "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarSeasonConfigDataTable_Overseas.json");
  const monsterPoolFile = path.join(rawDir, "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarMonsterPoolDataTable_Overseas.json");
  const monsterStaticFile = path.join(rawDir, "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json");
  const t1 = path.join(rawDir, "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/GameplayEffectTipsDataTable_Overseas.json");
  const t2 = path.join(rawDir, "Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable.json");
  const enLocFile = path.join(rawDir, "Hotta/Content/Localization/Game/en/Game.json");
  const ruLocFile = path.join(rawDir, "Hotta/Content/Localization/Game/ru/Game.json");
  const fceIndexFile = path.join(projectRoot, "datamine/fce/data/fce-index.json");

  const requiredInputs = [roundConfigFile, seasonConfigFile, monsterPoolFile, monsterStaticFile, enLocFile];
  const missingRequired = requiredInputs.filter((filePath) => !fs.existsSync(filePath));
  const locResolver = createLocalizationResolver();
  if (fs.existsSync(enLocFile)) locResolver.loadLocale("en", readJsonFile(enLocFile));
  if (fs.existsSync(ruLocFile)) locResolver.loadLocale("ru", readJsonFile(ruLocFile));

  const actorEnCandidates = [
    path.join(rawDir, "Hotta/Content/Resources/Text/Oversea/ST_actorname_Oversea.json"),
    path.join(rawDir, "Hotta/Content/Resources/Text/ST_actorname.json"),
    path.join(rawDir, "Text/ST_actorname.json")
  ];
  const actorRuCandidates = [
    path.join(rawDir, "Hotta/Content/Resources/Text/Oversea/ST_actorname_Oversea_ru.json"),
    path.join(rawDir, "Hotta/Content/Resources/Text/ST_actorname_ru.json"),
    path.join(rawDir, "Text/ST_actorname_ru.json")
  ];
  for (const c of actorEnCandidates) {
    if (fs.existsSync(c)) { locResolver.loadLocale("en", readJsonFile(c)); break; }
  }
  for (const c of actorRuCandidates) {
    if (fs.existsSync(c)) { locResolver.loadLocale("ru", readJsonFile(c)); break; }
  }
  // Boss id -> name lookup now comes from the lightweight per-boss manifest.
  const fceIndex = readJsonFile(fceIndexFile) || { bosses: [] };

  const d1 = readJsonFile(t1) || {};
  const d2 = readJsonFile(t2) || {};
  const rows1 = Array.isArray(d1) ? (d1[0]?.Rows) : (d1.Rows || d1);
  const rows2 = Array.isArray(d2) ? (d2[0]?.Rows) : (d2.Rows || d2);
  const effectRows = Object.assign({}, rows2, rows1);

  const fceBossById = new Map<any, any>();
  if (Array.isArray(fceIndex.bosses)) {
    for (const boss of fceIndex.bosses) {
      if (!boss) continue;
      const exactKeys = [boss.boss_id, boss.slug]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      for (const key of exactKeys) fceBossById.set(key, boss);
    }
  }

  const mappingPath = [
    path.join(__dirname, "monster-image-mapping.json"),
    path.join(__dirname, "..", "..", "scripts", "monster-image-mapping.json")
  ].find((candidate) => fs.existsSync(candidate));
  const monsterImageMapping = fs.existsSync(mappingPath) ? JSON.parse(readGameSourceFileSync(mappingPath, "utf8")) : {};

  function extractBossNumber(str) {
    if (!str) return null;
    const match = String(str).match(/boss(?:_hum)?_?#?0*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  function getMonsterLookupKeys(classPath) {
    if (!classPath) return [];
    const rawBase = path.basename(String(classPath)).split(".")[0];
    const base = rawBase.replace(/^OriginWar_/i, "").replace(/_C$/i, "");
    const canonicalBase = base.replace(/_(?:EX|Balance|Execute)$/i, "");
    return [...new Set<any>([
      String(classPath),
      rawBase,
      base,
      canonicalBase,
      rawBase.toLowerCase(),
      base.toLowerCase(),
      canonicalBase.toLowerCase()
    ].filter(Boolean))];
  }

  function findExactFceBoss(classPath) {
    const raw = String(classPath || '').toLowerCase();
    if (raw.includes('061_shtt') || raw.includes('038_balance')) {
      return null;
    }
    return getMonsterLookupKeys(classPath)
      .map((key) => fceBossById.get(String(key).toLowerCase()))
      .find(Boolean) || null;
  }

  function resolveMobImages(classPath) {
    const placeholderRoot = "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/";
    if (!classPath) {
      return {
        image: `${placeholderRoot}placeholder-mob.webp`,
        lineupPortrait: `${placeholderRoot}placeholder-mob.webp`,
        detailImage: `${placeholderRoot}placeholder-mob.webp`,
        sourceAssetRef: null,
        normalizedPackagePath: null,
        resolutionStatus: "unresolved",
        blueprint: null
      };
    }

    const rawBase = path.basename(classPath).split(".")[0];
    const base = rawBase.replace(/^OriginWar_/, "").replace(/_C$/, "");
    const isBoss = /[\\/]Boss[\\/]/i.test(classPath) || /^boss_/i.test(base);
    const isElite = !isBoss && (/[\\/]Elite[\\/]/i.test(classPath) || /^elite_/i.test(base));
    const exactKeys = getMonsterLookupKeys(classPath);

    if (/061_shtt/i.test(classPath)) {
      return {
        image: "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss061.webp",
        lineupPortrait: "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/Boss_hum_061.webp",
        detailImage: "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss061.webp",
        sourceAssetRef: null,
        normalizedPackagePath: null,
        resolutionStatus: "confirmed",
        blueprint: null
      };
    }
    if (/038_balance/i.test(classPath)) {
      return {
        image: "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/mon_hum_038.webp",
        lineupPortrait: "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/mon_hum_038.webp",
        detailImage: "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/mon_hum_038.webp",
        sourceAssetRef: null,
        normalizedPackagePath: null,
        resolutionStatus: "confirmed",
        blueprint: null
      };
    }

    // Known FCE bosses own their visual identity. Prefer their card-derived
    // portrait before the general monster map, whose boss_hum_* entries are
    // often scenery/wide textures and do not match the visible FCE card.
    if (isBoss) {
      const exactFce = findExactFceBoss(classPath);
      if (exactFce) {
        const detailImage = exactFce.detailImage || exactFce.displayWebpUrl || exactFce.art || null;
        const lineupPortrait = exactFce.lineupPortraitThumb || exactFce.cardThumbnail ||
          exactFce.preview || exactFce.lineupPortrait || detailImage;
        if (detailImage && lineupPortrait) {
          return {
            image: detailImage,
            lineupPortrait,
            detailImage,
            sourceAssetRef: exactFce.sourceAssetRef || null,
            normalizedPackagePath: exactFce.normalizedPackagePath || null,
            resolutionStatus: "confirmed",
            blueprint: null
          };
        }
      }
    }

    for (const key of exactKeys) {
      const mapped = monsterImageMapping[key];
      if (!mapped) continue;
      if (typeof mapped === "object") {
        const image = mapped.image || mapped.detailImage || mapped.lineupPortrait;
        const lineupPortrait = mapped.lineupPortrait || mapped.image;
        const detailImage = mapped.detailImage || mapped.image;
        const confirmed = mapped.resolutionStatus === "confirmed" &&
          image && lineupPortrait && detailImage &&
          !image.includes("placeholder") &&
          !lineupPortrait.includes("placeholder") &&
          !detailImage.includes("placeholder");
        if (!confirmed) continue;
        return {
          image,
          lineupPortrait,
          detailImage,
          sourceAssetRef: mapped.sourceAssetRef || null,
          normalizedPackagePath: mapped.normalizedPackagePath || null,
          resolutionStatus: "confirmed",
          blueprint: null
        };
      }
      if (typeof mapped === "string" &&
          mapped.startsWith("/datamine/shared/media/") &&
          !mapped.includes("placeholder")) {
        return {
          image: mapped,
          lineupPortrait: mapped,
          detailImage: mapped,
          sourceAssetRef: null,
          normalizedPackagePath: null,
          resolutionStatus: "confirmed",
          blueprint: null
        };
      }
    }

    const placeholder = isBoss
      ? `${placeholderRoot}placeholder-boss.webp`
      : (isElite ? `${placeholderRoot}placeholder-elite.webp` : `${placeholderRoot}placeholder-mob.webp`);
    return {
      image: placeholder,
      lineupPortrait: placeholder,
      detailImage: placeholder,
      sourceAssetRef: null,
      normalizedPackagePath: null,
      resolutionStatus: "unresolved",
      blueprint: null
    };
  }

  const MMO_BOSS_NAME_OVERRIDES = {
    'boss_hum_061_shtt': { en: 'Zhuge Chen', ru: 'Чжугэ Чэнь', bossId: 'Boss_hum_061_SHTT' },
    '061_shtt': { en: 'Zhuge Chen', ru: 'Чжугэ Чэнь', bossId: 'Boss_hum_061_SHTT' },
    'boss_038_balance': { en: 'Devourer', ru: 'Пожиратель', bossId: 'boss_038_Balance' },
    '038_balance': { en: 'Devourer', ru: 'Пожиратель', bossId: 'boss_038_Balance' },
    'boss_hum_055_shtt': { en: 'Taotie', ru: 'Таоте', bossId: 'Boss_hum_055_SHTT' },
    '055_shtt': { en: 'Taotie', ru: 'Таоте', bossId: 'Boss_hum_055_SHTT' },
    'boss_hum_058_shtt': { en: 'Quasivita', ru: 'Квазивита', bossId: 'Boss_hum_058_SHTT' },
    '058_shtt': { en: 'Quasivita', ru: 'Квазивита', bossId: 'Boss_hum_058_SHTT' }
  };

  const MMO_MOB_NAME_OVERRIDES = {
    'mon_hum_192_shtt': { en: 'WL-6 Security Type', ru: 'Охранник WL-6' },
    '192_shtt': { en: 'WL-6 Security Type', ru: 'Охранник WL-6' },
    'hum_072_balance': { en: 'Weaver', ru: 'Ткач' }
  };

  function resolveMobInfo(classPath) {
    if (!classPath) {
      const imgInfo = resolveMobImages(classPath);
      return {
        nameEn: "Unknown Enemy",
        nameRu: "Неизвестный враг",
        bossId: null,
        ...imgInfo
      };
    }

    const rawBase = path.basename(classPath).split(".")[0];
    const base = rawBase.replace(/^OriginWar_/, "").replace(/_C$/, "");
    const isBoss = /[\\/]Boss[\\/]/i.test(classPath) || /^boss_/i.test(base);
    const imgInfo = resolveMobImages(classPath);

    const lowerBase = base.toLowerCase();
    const lowerRaw = rawBase.toLowerCase();

    // 1. Explicit MMO Boss overrides
    for (const [key, o] of Object.entries(MMO_BOSS_NAME_OVERRIDES)) {
      if (lowerBase.includes(key) || lowerRaw.includes(key)) {
        return {
          nameEn: o.en,
          nameRu: o.ru,
          bossId: o.bossId,
          ...imgInfo
        };
      }
    }

    // 2. Explicit MMO Mob overrides
    for (const [key, o] of Object.entries(MMO_MOB_NAME_OVERRIDES)) {
      if (lowerBase.includes(key) || lowerRaw.includes(key)) {
        return {
          nameEn: o.en,
          nameRu: o.ru,
          bossId: null,
          ...imgInfo
        };
      }
    }

    if (isBoss) {
      const exactFce = findExactFceBoss(classPath);
      if (exactFce) {
        return {
          nameEn: exactFce.name || "Unknown Boss",
          nameRu: exactFce.name_ru || exactFce.name || "Неизвестный босс",
          bossId: exactFce.boss_id || null,
          ...imgInfo
        };
      }
    }

    const cleaned = base.replace(/_(?:Balance|SHTT|EX|Execute)$/i, '');
    const baseNum = cleaned.match(/(\d+)/)?.[1] || '';

    const locCandidates = [
      `${base}_name`,
      `${base.toLowerCase()}_name`,
      `${cleaned}_name`,
      `${cleaned.toLowerCase()}_name`,
      base.replace(/^elite_hum_/i, 'mon_hum_'),
      base,
      base.toLowerCase(),
      cleaned,
      cleaned.toLowerCase(),
      cleaned.replace(/_Big\d?$/i, ''),
      cleaned.replace(/_Bai$/i, ''),
      baseNum ? `mon_hum_${baseNum}` : null,
      baseNum ? `mon_${baseNum}` : null,
      baseNum ? `mon_hum_${baseNum}_name` : null,
      baseNum ? `boss_hum_${baseNum}` : null,
      baseNum ? `boss_${baseNum}` : null,
      cleaned.startsWith('mon_hum_') ? null : `mon_hum_${cleaned}`,
      cleaned.startsWith('mon_') ? null : `mon_${cleaned}`
    ].filter(Boolean);
    const actorNamespaces = ["ST_actorname", "ST_actorname_Oversea", "actorname", "monster"];

    for (const candidate of locCandidates) {
      for (const namespace of actorNamespaces) {
        const resolvedEn = locResolver.resolve(candidate, { locale: "en", defaultNamespace: namespace });
        const exact = resolvedEn.provenance?.status === "resolved" ||
          resolvedEn.strategy === "exact_namespace_key" ||
          resolvedEn.strategy === "case_variant_namespace_key";
        if (!exact || !resolvedEn.text || resolvedEn.text === candidate) continue;
        const resolvedRu = locResolver.resolve(candidate, {
          locale: "ru",
          fallbackLocale: "en",
          defaultNamespace: namespace
        });
        return {
          nameEn: cleanHtmlTags(resolvedEn.text),
          nameRu: cleanHtmlTags(resolvedRu.text || resolvedEn.text),
          bossId: null,
          ...imgInfo
        };
      }
    }

    return {
      nameEn: isBoss ? "Unknown Boss" : "Unknown Enemy",
      nameRu: isBoss ? "Неизвестный босс" : "Неизвестный враг",
      bossId: null,
      ...imgInfo
    };
  }

  function resolveBuffFullIntel(rawBuffName) {
    if (!rawBuffName) return { id: "", nameEn: "", nameRu: "", descEn: "", descRu: "", icon: null };
    const cleanId = rawBuffName.replace(/\.buff_.*_C$/, "").replace(/\.Buff_.*_C$/, "").replace(/\..*$/, "").replace(/_C$/, "");

    let found = effectRows[cleanId] || effectRows[cleanId.replace(/^buff_/, "Buff_")] || effectRows[cleanId.replace(/^Buff_/, "buff_")];
    if (!found) {
      const matchKey = Object.keys(effectRows).find((k) => k.toLowerCase() === cleanId.toLowerCase());
      if (matchKey) found = effectRows[matchKey];
    }

    const KNOWN_BUFF_ICON_PATHS = {
      'buff_Blend_001.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/buff/buff_Blend_001.webp',
      'Buff_WeaponPas_016.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/buff/Buff_WeaponPas_016.webp',
      'Buff_WeaponPas_022.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/buff/Buff_WeaponPas_022.webp',
      'buff_AddElementDefFoodBase.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/buff/buff_AddElementDefFoodBase.webp',
      'weakpoint_fire.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/blood/weakpoint_fire.webp',
      'weakpoint_ice.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/blood/weakpoint_ice.webp',
      'weakpoint_thu.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/blood/weakpoint_thu.webp',
      'weakpoint_physics.webp': '/datamine/shared/media/Hotta/Content/Resources/UI/blood/weakpoint_physics.webp',
      'debuff_speed_down.webp': '/datamine/shared/media/Hotta/Content/Resources/Icon/new_debuff/debuff_speed_down.webp',
      'buff_chongdong_player_015.webp': '/datamine/shared/media/Hotta/Content/Resources/Icon/wormhole/player/buff_chongdong_player_015.webp'
    };

    let iconPath = null;
    const iconAsset = found?.Icon?.AssetPathName || found?.IconPath;
    const cleanIdKey = `${cleanId}.webp`;
    if (KNOWN_BUFF_ICON_PATHS[cleanIdKey]) {
      iconPath = KNOWN_BUFF_ICON_PATHS[cleanIdKey];
    } else if (iconAsset && iconAsset !== "None") {
      const rawBase = path.basename(iconAsset).split(".")[0];
      const webpBase = `${rawBase}.webp`;
      if (KNOWN_BUFF_ICON_PATHS[webpBase]) {
        iconPath = KNOWN_BUFF_ICON_PATHS[webpBase];
      } else {
        try {
          iconPath = toCanonicalMediaUrl(iconAsset);
        } catch (_) {
          iconPath = `/datamine/shared/media/Hotta/Content/Resources/Icon/buff/${webpBase}`;
        }
      }
    }

    const fallback = COMMON_BUFF_FALLBACKS[cleanId] || COMMON_BUFF_FALLBACKS[cleanId.replace(/^buff_/, "Buff_")] || COMMON_BUFF_FALLBACKS[cleanId.replace(/^Buff_/, "buff_")];
    if (!iconPath && fallback && fallback.icon) {
      if (fallback.icon.includes('/')) {
        try {
          iconPath = toCanonicalMediaUrl(fallback.icon);
        } catch (_) {
          const fbRaw = path.basename(fallback.icon).replace(/\.png$/, '.webp');
          iconPath = KNOWN_BUFF_ICON_PATHS[fbRaw] || `/datamine/shared/media/Hotta/Content/Resources/Icon/buff/${fbRaw}`;
        }
      } else {
        const fbRaw = fallback.icon.replace(/\.png$/, '.webp');
        iconPath = KNOWN_BUFF_ICON_PATHS[fbRaw] || `/datamine/shared/media/Hotta/Content/Resources/Icon/buff/${fbRaw}`;
      }
    }

    const namespaces = ["Voidbuffdes", "BuffDes", "Voidbuffdes_balance", "ST_VoidClone", "GameplayEffectTips"];
    let nameEn = "";
    let nameRu = "";
    let descEn = "";
    let descRu = "";

    const nameKeyCandidates = [
      `${cleanId}_name`,
      `${cleanId.replace(/^buff_/, 'Buff_')}_name`,
      `${cleanId.replace(/^Buff_/, 'buff_')}_name`,
      found?.Name?.Key,
      found?.Description?.Key
    ].filter(Boolean);

    const descKeyCandidates = [
      `${cleanId}_des`,
      `${cleanId}_desc`,
      `${cleanId.replace(/^buff_/, 'Buff_')}_des`,
      `${cleanId.replace(/^Buff_/, 'buff_')}_des`,
      found?.Description?.Key
    ].filter(Boolean);

    for (const ns of namespaces) {
      if (!nameEn) {
        for (const nk of nameKeyCandidates) {
          const resEn = locResolver.resolve(nk, { locale: "en", defaultNamespace: ns });
          if (resEn.provenance.status === "resolved") {
            nameEn = cleanHtmlTags(resEn.text);
            const resRu = locResolver.resolve(nk, { locale: "ru", fallbackLocale: "en", defaultNamespace: ns });
            nameRu = cleanHtmlTags(resRu.text || nameEn);
            break;
          }
        }
      }
      if (!descEn) {
        for (const dk of descKeyCandidates) {
          const resEn = locResolver.resolve(dk, { locale: "en", defaultNamespace: ns });
          if (resEn.provenance.status === "resolved") {
            descEn = cleanHtmlTags(resEn.text);
            const resRu = locResolver.resolve(dk, { locale: "ru", fallbackLocale: "en", defaultNamespace: ns });
            descRu = cleanHtmlTags(resRu.text || descEn);
            break;
          }
        }
      }
    }

    if (fallback) {
      if (!nameEn) nameEn = fallback.en;
      if (!nameRu) nameRu = fallback.ru;
      if (!descEn) descEn = fallback.descEn;
      if (!descRu) descRu = fallback.descRu;
    }

    if (!nameEn) {
      const resEn = locResolver.resolve(found?.Name, { locale: "en", defaultNamespace: "GameplayEffectTips", fallbackCodename: cleanId, fallbackSourceRow: found });
      const resRu = locResolver.resolve(found?.Name, { locale: "ru", fallbackLocale: "en", defaultNamespace: "GameplayEffectTips", fallbackCodename: cleanId, fallbackSourceRow: found });
      nameEn = cleanHtmlTags(resEn.text || cleanId.replace(/^buff_/, "").replace(/^Buff_/, ""));
      nameRu = cleanHtmlTags(resRu.text || nameEn);
    }
    if (!descEn && found?.Description) {
      const resEn = locResolver.resolve(found.Description, { locale: "en", defaultNamespace: "GameplayEffectTips", fallbackSourceRow: found });
      const resRu = locResolver.resolve(found.Description, { locale: "ru", fallbackLocale: "en", defaultNamespace: "GameplayEffectTips", fallbackSourceRow: found });
      descEn = cleanHtmlTags(resEn.text || "");
      descRu = cleanHtmlTags(resRu.text || descEn);
    }

    return {
      id: cleanId,
      nameEn: nameEn || cleanId,
      nameRu: nameRu || nameEn || cleanId,
      descEn: descEn || nameEn,
      descRu: descRu || nameRu || descEn,
      icon: iconPath
    };
  }

  const roundData = readJsonFile(roundConfigFile);
  const roundRows = Array.isArray(roundData) ? (roundData[0]?.Rows) : (roundData.Rows || roundData);

  const seasonData = readJsonFile(seasonConfigFile);
  const seasonRows = Array.isArray(seasonData) ? (seasonData[0]?.Rows) : (seasonData.Rows || seasonData);

  const poolData = readJsonFile(monsterPoolFile);
  const poolRows = Array.isArray(poolData) ? (poolData[0]?.Rows) : (poolData.Rows || poolData);

  const monsterData = readJsonFile(monsterStaticFile);
  const monsterRows = Array.isArray(monsterData) ? (monsterData[0]?.Rows) : (monsterData.Rows || monsterData);

  if (!roundRows || !seasonRows) {
    console.error("[oow-deep-intel] Error: Missing required round/season config tables.");
    return null;
  }

  const outputSeasons = [];

  for (const [sKey, sRow] of Object.entries(seasonRows)) {
    const sNum = parseInt(sKey, 10);
    if (isNaN(sNum)) continue;

    const startDate = sRow.SeasonBeginTime ? sRow.SeasonBeginTime.split(" ")[0].replace(/\//g, "-") : "";
    const endDate = sRow.SeasonEndTime ? sRow.SeasonEndTime.split(" ")[0].replace(/\//g, "-") : "";

    const floorList = [];

    for (let round = 1; round <= 30; round++) {
      const rRow = Object.values(roundRows).find(
        (r) => (r.OriginSeasonID == sNum || r.Season == sNum) && (r.OriginRound == round || r.Round == round)
      );
      if (!rRow) continue;

      const stageMutators = (rRow.ShowBuffs || []).map((b) => {
        const rawName = b.AssetPathName?.split(".").pop() || "";
        return resolveBuffFullIntel(rawName);
      });

      const dropBuffs = (rRow.DropBuffs || []).map((d) => {
        const buffIntel = resolveBuffFullIntel(d.BuffPoolID);
        return {
          ...buffIntel,
          weight: d.DropWight
        };
      });

      const waveEnemies = [];
      let floorTotalHp = 0;
      let floorMaxMobHp = 0;

      for (let waveIdx = 0; waveIdx < (rRow.WaveMonsterPool || []).length; waveIdx++) {
        const poolKey = rRow.WaveMonsterPool[waveIdx];
        const pData = poolRows
          ? poolRows[poolKey] ||
            poolRows[poolKey.toLowerCase()] ||
            poolRows[poolKey.toUpperCase()] ||
            poolRows[`S${poolKey.slice(1)}`] ||
            poolRows[`s${poolKey.slice(1)}`]
          : null;

        if (pData && pData.PoolMonsters) {
          pData.PoolMonsters.forEach((m, mobSubIdx) => {
            const mobInfo = resolveMobInfo(m.MonsterClass?.AssetPathName);
            const attr = monsterRows
              ? monsterRows[m.AttributeID] ||
                monsterRows[m.AttributeID?.toLowerCase()] ||
                monsterRows[m.AttributeID?.toUpperCase()] ||
                monsterRows[`S${m.AttributeID?.slice(1)}`] ||
                monsterRows[`s${m.AttributeID?.slice(1)}`] ||
                {}
              : {};
            const singleHp = attr.MaxHealth || 0;
            const combinedHp = singleHp * (m.MonsterCount || 1);

            floorTotalHp += combinedHp;
            if (singleHp > floorMaxMobHp) floorMaxMobHp = singleHp;

            const inherentBuffs = (m.MonsterBuffID || []).map((b) => {
              const rawName = b.AssetPathName?.split(".").pop() || "";
              return resolveBuffFullIntel(rawName);
            });

            waveEnemies.push({
              wave: waveIdx + 1,
              poolKey,
              mobIndex: mobSubIdx + 1,
              attributeId: m.AttributeID,
              nameEn: mobInfo.nameEn,
              nameRu: mobInfo.nameRu,
              bossId: mobInfo.bossId,
              monsterType: m.MonsterType,
              count: m.MonsterCount || 1,
              level: m.MonsterLevel || 100,
              singleHp,
              combinedHp,
              hpFormatted: singleHp.toLocaleString("en-US"),
              atk: attr.CommonAtkBase || 0,
              def: attr.PhyDefBase || 0,
              image: mobInfo.image,
              lineupPortrait: mobInfo.lineupPortrait || mobInfo.image,
              detailImage: mobInfo.detailImage || mobInfo.image,
              sourceAssetRef: mobInfo.sourceAssetRef || null,
              normalizedPackagePath: mobInfo.normalizedPackagePath || null,
              resolutionStatus: mobInfo.resolutionStatus || "confirmed",
              blueprint: mobInfo.blueprint,
              stats: attr,
              inherentBuffs
            });
          });
        }
      }

      if (waveEnemies.length > 0) {
        floorList.push({
          floor: round,
          isFinalFloor: false,
          totalHp: floorTotalHp,
          totalHpBillions: Number((floorTotalHp / 1e9).toFixed(3)),
          totalHpMillions: Number((floorTotalHp / 1e6).toFixed(2)),
          maxMobHp: floorMaxMobHp,
          maxMobHpBillions: Number((floorMaxMobHp / 1e9).toFixed(3)),
          maxMobHpMillions: Number((floorMaxMobHp / 1e6).toFixed(2)),
          rewardDropId: rRow.RoundAwardId?.[0]?.Value || "",
          helpPoints: rRow.RoundHelpPoint || 0,
          stageMutators,
          dropBuffs,
          enemies: waveEnemies
        });
      }
    }

    if (floorList.length > 0) {
      floorList[floorList.length - 1].isFinalFloor = true;
      const totalSeasonHp = floorList.reduce((sum, f) => sum + f.totalHp, 0);

      outputSeasons.push({
        season: sNum,
        startDate,
        endDate,
        floorCount: floorList.length,
        minFloor: floorList[0]?.floor || 1,
        maxFloor: floorList[floorList.length - 1]?.floor || floorList.length,
        totalSeasonHp,
        finalBossHp: floorList[floorList.length - 1]?.maxMobHp || 0,
        floors: floorList
      });
    }
  }

  outputSeasons.sort((a, b) => a.season - b.season);

  if (outputSeasons.length === 0) {
    throw new Error("[required] OOW deep intel produced zero seasons; no output was published.");
  }
  const oowDir = path.join(projectRoot, "datamine", "oow", "data");
  if (!fs.existsSync(oowDir)) fs.mkdirSync(oowDir, { recursive: true });

  const deepIntelPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalSeasons: outputSeasons.length,
      description: "Comprehensive Origin of War (BigSecret) Intel with localized mob names, boss links, mutator descriptions, drop rates, real icons, and stats.",
      floorDefinitionNote: "Scheduled Origin War rounds come from the round configuration. Enemy attribute definitions alone do not imply a playable round; missing rounds are never inferred."
    },
    seasons: outputSeasons
  };

  const outFile = path.join(oowDir, "oow_deep_intel.json");
  fs.writeFileSync(outFile, JSON.stringify(deepIntelPayload, null, 2), "utf8");

  console.log(`[oow-deep-intel] Successfully extracted deep intel across ${outputSeasons.length} seasons.`);
  console.log(`[oow-deep-intel] Saved to: ${outFile}`);

  return deepIntelPayload;
}

if (require.main === module) {
  extractOowDeepIntel();
}

export {
  extractOowDeepIntel,
};

