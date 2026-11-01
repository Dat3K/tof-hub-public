import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import { toCanonicalMediaUrl } from './canonical-media-library';

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  const raw = readGameSourceFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return JSON.parse(raw);
}

function resolveProjectRoot() {
  const customArg = process.argv.find((arg) => arg.startsWith("--project-root="));
  if (customArg) return path.resolve(customArg.slice("--project-root=".length));
  let cur = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, "package.json"))) {
      return cur;
    }
    cur = path.resolve(cur, "..");
  }
  return path.resolve(__dirname, "../..");
}

function resolveRawDir(projectRoot) {
  const customArg = process.argv.find((arg) => arg.startsWith("--raw-dir="));
  if (customArg) {
    return path.resolve(customArg.split("=")[1]);
  }

  const candidateDirs = [
    path.join(projectRoot, "datamine-pipeline", "raw_exports"),
    path.join(projectRoot, "raw_exports"),
    path.join(projectRoot, "..", "temperary"),
    path.join(projectRoot, "temperary"),
    path.join(projectRoot, "..", "raw_exports")
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return path.join(projectRoot, "raw_exports");
}

function findFile(rawDir, projectRoot, relPathCandidates) {
  for (const rel of relPathCandidates) {
    const p1 = path.join(rawDir, rel);
    if (fs.existsSync(p1)) return p1;
    const pFlat = path.join(rawDir, path.basename(rel));
    if (fs.existsSync(pFlat)) return pFlat;
  }
  return null;
}

function cleanHtmlTags(str) {
  if (!str) return "";
  return String(str).replace(/<[^>]*>/g, "").trim();
}

function normalizeIsoDate(value) {
  if (!value) return "";
  const datePart = String(value).split(" ")[0].replace(/\//g, "-");
  const parts = datePart.split("-");
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }
  return datePart;
}

function normalizeBuffSlot(buffType) {
  if (!buffType) return "unknown";
  const match = String(buffType).match(/ORIGINWAR_BUFF_TYPE_(\d+)/i);
  if (match) return `type_${match[1]}`;
  return "unknown";
}

function getSlotLabel(slot, lang = "en") {
  const isRu = lang === "ru";
  if (slot === "type_1") return isRu ? "Тип 1" : "Type 1";
  if (slot === "type_2") return isRu ? "Тип 2" : "Type 2";
  if (slot === "type_3") return isRu ? "Тип 3" : "Type 3";
  if (slot === "type_4") return isRu ? "Тип 4" : "Type 4";
  if (slot === "type_5") return isRu ? "Тип 5" : "Type 5";
  if (slot === "type_6") return isRu ? "Тип 6" : "Type 6";
  return isRu ? "Неизвестно" : "Unknown";
}

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

const MMO_WEAKNESS_DESCS = {
  buff_origin_balance99_1: {
    nameEn: "Flame Weakness",
    nameRu: "Уязвимость к огню",
    descEn: "Monsters take 40% increased Flame damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше урона от огня, а эффективность пробития щитов повышена на 50%."
  },
  buff_origin_balance99_1th: {
    nameEn: "Flame Weakness",
    nameRu: "Уязвимость к огню",
    descEn: "Monsters take 40% increased Flame damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше урона от огня, а эффективность пробития щитов повышена на 50%."
  },
  buff_origin_balance99_2: {
    nameEn: "Frost Weakness",
    nameRu: "Уязвимость к холоду",
    descEn: "Monsters take 40% increased Frost damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше урона от холода, а эффективность пробития щитов повышена на 50%."
  },
  buff_origin_balance99_2th: {
    nameEn: "Frost Weakness",
    nameRu: "Уязвимость к холоду",
    descEn: "Monsters take 40% increased Frost damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше урона от холода, а эффективность пробития щитов повышена на 50%."
  },
  buff_origin_balance99_3: {
    nameEn: "Volt Weakness",
    nameRu: "Уязвимость к электро",
    descEn: "Monsters take 40% increased Volt damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше урона от электро, а эффективность пробития щитов повышена на 50%."
  },
  buff_origin_balance99_3th: {
    nameEn: "Volt Weakness",
    nameRu: "Уязвимость к электро",
    descEn: "Monsters take 40% increased Volt damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше урона от электро, а эффективность пробития щитов повышена на 50%."
  },
  buff_origin_balance99_4: {
    nameEn: "Physical Weakness",
    nameRu: "Уязвимость к физ. урону",
    descEn: "Monsters take 40% increased Physical damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше физического урона, а эффективность пробития щитов повышена на 50%."
  },
  buff_origin_balance99_4th: {
    nameEn: "Physical Weakness",
    nameRu: "Уязвимость к физ. урону",
    descEn: "Monsters take 40% increased Physical damage, and shatter efficiency is increased by 50%.",
    descRu: "Монстры получают на 40% больше физического урона, а эффективность пробития щитов повышена на 50%."
  }
};

const MMO_BUFF_ICONS = {
  buff_origin_balance1_1: "buff_AddFireAtkFoodBase.png",
  buff_origin_balance1_2: "buff_AddFireAtkFoodBase.png",
  buff_origin_balance1_3: "buff_AddFireAtkFoodBase.png",
  buff_origin_balance1_4: "buff_AddIceAtkFoodBase.png",
  buff_origin_balance1_5: "buff_AddIceAtkFoodBase.png",
  buff_origin_balance1_6: "buff_AddIceAtkFoodBase.png",
  buff_origin_balance1_7: "buff_AddThunderAtkFoodBase.png",
  buff_origin_balance1_8: "buff_AddThunderAtkFoodBase.png",
  buff_origin_balance1_9: "buff_AddThunderAtkFoodBase.png",
  buff_origin_balance1_10: "buff_AddPhyAtkFoodBase.png",
  buff_origin_balance1_11: "buff_AddPhyAtkFoodBase.png",
  buff_origin_balance1_12: "buff_AddPhyAtkFoodBase.png",
  buff_origin_balance2_1: "buff_fire_001.png",
  buff_origin_balance2_2: "buff_ice_001.png",
  buff_origin_balance2_3: "buff_bigthu_001.png",
  buff_origin_balance2_4: "buff_normalact_demage_001.png",
  buff_origin_balance2_5: "buff_frigg_damageup.png",
  buff_origin_balance2_6: "buff_WeaponAttack_002.png",
  buff_origin_balance2_7: "buff_bigthu_001.png",
  buff_origin_balance2_8: "buff_fire_001.png",
  buff_origin_balance3_1: "buff_AddMaxHP_FoodBase.png",
  buff_origin_balance3_2: "buff_AddMaxHP_FoodBase.png",
  buff_origin_balance3_3: "buff_AddMaxHP_FoodBase.png",
  buff_origin_balance3_4: "buff_cubeshield_001.png",
  buff_origin_balance3_5: "buff_AddMaxHP_FoodBase.png",
  buff_origin_balance3_6: "buff_assisatnt.png",
  buff_origin_balance4_1: "buff_elehujia_001.png",
  buff_origin_balance4_2: "buff_elehujia_001.png",
  buff_origin_balance4_3: "Buff_EMBY_BrokenWeak.png",
  buff_origin_balance4_4: "Buff_EMBY_BrokenWeak.png",
  buff_origin_balance4_5: "Buff_WeaponPas_016.png",
  buff_origin_balance4_6: "Buff_WeaponPas_016.png",
  buff_origin_balance4_7: "buff_weakness_001.png",
  buff_origin_balance4_8: "buff_weakness_001.png",
  buff_origin_balance4_9: "Buff_Chainsaw_SkillKuangBao.png",
  buff_origin_balance4_10: "Buff_Chainsaw_SkillKuangBao.png",
  buff_origin_balance4_11: "buff_Chainsaw_LifeShield.png",
  buff_origin_balance4_12: "buff_Chainsaw_LifeShield.png",
  buff_origin_balance4_19: "Buff_WeaponPas_022.png",
  buff_origin_balance4_20: "Buff_WeaponPas_022.png",
  buff_origin_balance4_21: "Buff_WeaponPas_004.png",
  buff_origin_balance4_22: "Buff_WeaponPas_004.png",
  buff_origin_balance4_25: "Buff_EMBY_ReplyHP.png",
  buff_origin_balance4_29: "buff_kill_shield_001.png",
  buff_origin_balance5_1: "AddIceImm.png",
  buff_origin_balance5_2: "buff_frigg_icestack.png",
  buff_origin_balance5_3: "debuff_speed_down.png",
  buff_origin_balance5_6: "Buff_FightRob_KeepReduceHP.png",
  buff_origin_balance5_10: "Buff_EMBY_BrokenWeak.png",
  buff_origin_balance6_1: "buff_chongdong_player_015.png",
  buff_origin_balance6_2: "buff_chongdong_player_015.png",
  buff_origin_balance6_3: "buff_soldier.png",
  buff_origin_balance6_4: "buff_soldier.png",
  buff_origin_balance6_5: "Buff_WeaponPas_012.png",
  buff_origin_balance6_7: "arm_atk.png",
  buff_origin_balance6_9: "arm_atk.png",
  buff_origin_balance6_10: "buff_fenrir_critup.png",
  buff_origin_balance6_12: "buff_fenrir_critup.png",
  buff_origin_balance99_9: "buff_ice_001.png",
  buff_origin_balance99_11: "buff_assisatnt.png",
  buff_origin_balance99_17: "buff_damageadd_001.png",
  buff_origin_balance99_1: "weakpoint_fire.png",
  buff_origin_balance99_2: "weakpoint_ice.png",
  buff_origin_balance99_3: "weakpoint_thu.png",
  buff_origin_balance99_4: "weakpoint_physics.png",
  buff_origin_balance99_1th: "weakpoint_fire.png",
  buff_origin_balance99_2th: "weakpoint_ice.png",
  buff_origin_balance99_3th: "weakpoint_thu.png",
  buff_origin_balance99_4th: "weakpoint_physics.png"
};

function buildBuffPoolMap(buffPoolFile) {
  if (!buffPoolFile || !fs.existsSync(buffPoolFile)) return {};
  const raw = readJsonFile(buffPoolFile);
  const rows = Array.isArray(raw) ? (raw[0]?.Rows || {}) : (raw.Rows || raw || {});
  const poolMap: Record<string, any> = {};
  for (const [key, val] of Object.entries(rows)) {
    const rawType = val.BuffType || null;
    const slot = normalizeBuffSlot(rawType);
    const assetPath = val.BuffID?.AssetPathName || null;
    poolMap[key] = {
      rawKey: key,
      buffType: rawType,
      slot,
      slotLabelEn: getSlotLabel(slot, "en"),
      slotLabelRu: getSlotLabel(slot, "ru"),
      assetPath
    };
    const cleanKey = key.replace(/^buff_/, "").replace(/^Buff_/, "");
    if (!poolMap[cleanKey]) {
      poolMap[cleanKey] = poolMap[key];
    }
  }
  return poolMap;
}

function resolveBuffFullIntel(rawBuffName, buffPoolMap: Record<string, any> = {}, effectRows = {}, enLoc: Record<string, any> = {}, ruLoc = {}, gameResDir = "", buffsAssetDir = "", options: { iconPolicy?: "legacy-fallback" | "effect-tips" } = {}) {
  if (!rawBuffName) {
    return {
      id: "",
      buffType: null,
      slot: "unknown",
      slotLabelEn: "Unknown",
      slotLabelRu: "Неизвестно",
      nameEn: "",
      nameRu: "",
      descEn: "",
      descRu: "",
      icon: null,
      modifiers: null,
      source: null
    };
  }

  const cleanId = String(rawBuffName)
    .replace(/\.buff_.*_C$/, "")
    .replace(/\.Buff_.*_C$/, "")
    .replace(/\..*$/, "")
    .replace(/_C$/, "");

  let poolHit = buffPoolMap[cleanId] || buffPoolMap[rawBuffName] || buffPoolMap[cleanId.replace(/^buff_/, "Buff_")] || buffPoolMap[cleanId.replace(/^Buff_/, "buff_")];
  if (!poolHit) {
    const matchKey = Object.keys(buffPoolMap).find((k) => k.toLowerCase() === cleanId.toLowerCase());
    if (matchKey) poolHit = buffPoolMap[matchKey];
  }

  const rawBuffType = poolHit ? poolHit.buffType : null;
  const slot = poolHit ? poolHit.slot : "unknown";
  const slotLabelEn = poolHit ? poolHit.slotLabelEn : getSlotLabel(slot, "en");
  const slotLabelRu = poolHit ? poolHit.slotLabelRu : getSlotLabel(slot, "ru");

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
  const useEffectTipIcon = options.iconPolicy === "effect-tips";
  if (!useEffectTipIcon && KNOWN_BUFF_ICON_PATHS[cleanIdKey]) {
    iconPath = KNOWN_BUFF_ICON_PATHS[cleanIdKey];
  } else if (iconAsset && iconAsset !== "None") {
    const rawBase = path.basename(iconAsset).split(".")[0];
    const webpBase = `${rawBase}.webp`;
    if (!useEffectTipIcon && KNOWN_BUFF_ICON_PATHS[webpBase]) {
      iconPath = KNOWN_BUFF_ICON_PATHS[webpBase];
    } else {
      try {
        iconPath = toCanonicalMediaUrl(iconAsset);
      } catch (_) {
        iconPath = `/datamine/shared/media/Hotta/Content/Resources/Icon/buff/${webpBase}`;
      }
    }
  }

  if (!useEffectTipIcon && !iconPath && MMO_BUFF_ICONS[cleanId]) {
    const mmoRaw = MMO_BUFF_ICONS[cleanId].replace(/\.png$/, '.webp');
    iconPath = KNOWN_BUFF_ICON_PATHS[mmoRaw] || `/datamine/shared/media/Hotta/Content/Resources/Icon/buff/${mmoRaw}`;
  }

  const fallback = COMMON_BUFF_FALLBACKS[cleanId] || COMMON_BUFF_FALLBACKS[cleanId.replace(/^buff_/, "Buff_")] || COMMON_BUFF_FALLBACKS[cleanId.replace(/^Buff_/, "buff_")];
  if (!useEffectTipIcon && !iconPath && fallback && fallback.icon) {
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

  const namespaces = ["Voidbuffdes", "BuffDes", "BuffDes_Balance", "Voidbuffdes_balance", "ST_VoidClone", "QRSLCommon_ST"];
  let nameEn = "";
  let nameRu = "";
  let descEn = "";
  let descRu = "";

  const nameKeyCandidates = [
    `${cleanId}_name`,
    `${cleanId.replace(/^buff_/, "Buff_")}_name`,
    `${cleanId.replace(/^Buff_/, "buff_")}_name`,
    found?.Name?.Key,
    found?.Name?.LocalizedString,
    found?.BuffName
  ].filter(Boolean);

  const descKeyCandidates = [
    `${cleanId}_des`,
    `${cleanId}_desc`,
    `${cleanId.replace(/^buff_/, "Buff_")}_des`,
    `${cleanId.replace(/^Buff_/, "buff_")}_des`,
    found?.Desc?.Key,
    found?.Description?.Key,
    found?.BuffDescribe
  ].filter(Boolean);

  for (const ns of namespaces) {
    if (!nameEn) {
      for (const nk of nameKeyCandidates) {
        if (enLoc[ns] && enLoc[ns][nk]) {
          nameEn = cleanHtmlTags(enLoc[ns][nk]);
          nameRu = cleanHtmlTags(ruLoc[ns]?.[nk] || enLoc[ns][nk]);
          break;
        }
      }
    }
    if (!descEn) {
      for (const dk of descKeyCandidates) {
        if (enLoc[ns] && enLoc[ns][dk]) {
          descEn = cleanHtmlTags(enLoc[ns][dk]);
          descRu = cleanHtmlTags(ruLoc[ns]?.[dk] || enLoc[ns][dk]);
          break;
        }
      }
    }
  }

  if (MMO_WEAKNESS_DESCS[cleanId]) {
    const wData = MMO_WEAKNESS_DESCS[cleanId];
    if (!nameEn) nameEn = wData.nameEn;
    if (!nameRu) nameRu = wData.nameRu;
    if (!descEn) descEn = wData.descEn;
    if (!descRu) descRu = wData.descRu;
  }

  if (fallback) {
    if (!nameEn) nameEn = fallback.en;
    if (!nameRu) nameRu = fallback.ru;
    if (!descEn) descEn = fallback.descEn;
    if (!descRu) descRu = fallback.descRu;
  }

  if (!nameEn && (found?.Name?.LocalizedString || found?.BuffName)) {
    nameEn = cleanHtmlTags(found.Name?.LocalizedString || found.BuffName);
    nameRu = cleanHtmlTags(ruLoc[cleanId] || nameEn);
  }
  if (!descEn && (found?.Desc?.LocalizedString || found?.Description?.LocalizedString || found?.BuffDescribe)) {
    descEn = cleanHtmlTags(found.Desc?.LocalizedString || found.Description?.LocalizedString || found.BuffDescribe);
    descRu = cleanHtmlTags(ruLoc[found.Desc?.Key || found.Description?.Key] || descEn);
  }

  if (!nameEn) {
    if (cleanId.startsWith("buff_origin_balance")) {
      nameEn = cleanId.replace(/^buff_origin_balance/, "Origin Buff ");
      nameRu = cleanId.replace(/^buff_origin_balance/, "Бафф Истока ");
    } else {
      nameEn = cleanId.replace(/^buff_/, "").replace(/^Buff_/, "");
      nameRu = cleanId.replace(/^buff_/, "").replace(/^Buff_/, "");
    }
  }

  let modifiers = null;
  if (found && (found.Scores?.Value > 0 || (found.GEParameNum && found.GEParameNum > 0))) {
    modifiers = {
      score: found.Scores?.Value || 0,
      paramNum: found.GEParameNum || null,
      paramName: found.GEParamName && found.GEParamName !== "None" ? found.GEParamName : null
    };
  }

  return {
    id: cleanId,
    buffType: rawBuffType,
    slot,
    slotLabelEn,
    slotLabelRu,
    nameEn,
    nameRu: nameRu || nameEn,
    descEn: descEn || nameEn,
    descRu: descRu || nameRu || descEn,
    icon: iconPath,
    iconThumb: iconPath,
    modifiers,
    source: poolHit ? {
      buffPoolRow: poolHit.rawKey,
      buffType: poolHit.buffType,
      assetPath: poolHit.assetPath
    } : null
  };
}

function parseCurveSteps(curveObj, unlockDay = 1, curveTableName = "OriginWarMonster", rowName = null) {
  const uDay = typeof unlockDay === "number" && Number.isFinite(unlockDay) ? unlockDay : null;

  if (!curveObj || !Array.isArray(curveObj.Keys) || curveObj.Keys.length === 0) {
    return {
      curveTable: curveTableName || null,
      rowName: rowName || null,
      keys: [],
      steps: [],
      initialPct: null,
      finalPct: null,
      daysToMin: null,
      unlockDay: uDay,
      appliedCoefficient: null,
      diagnosticStatus: !curveObj ? "missing_curve_row" : "invalid_curve_keys",
      diagnosticReason: !curveObj
        ? `Curve row "${rowName}" not found in curve table "${curveTableName}"`
        : `Curve row "${rowName}" in table "${curveTableName}" contains no Keys array`
    };
  }

  const rawKeys = curveObj.Keys.filter(
    (k) => k && typeof k.Time === "number" && Number.isFinite(k.Time) && typeof k.Value === "number" && Number.isFinite(k.Value)
  );

  if (rawKeys.length === 0) {
    return {
      curveTable: curveTableName || null,
      rowName: rowName || null,
      keys: [],
      steps: [],
      initialPct: null,
      finalPct: null,
      daysToMin: null,
      unlockDay: uDay,
      appliedCoefficient: null,
      diagnosticStatus: "invalid_curve_keys",
      diagnosticReason: `Curve row "${rowName}" in table "${curveTableName}" contains no finite {Time, Value} points`
    };
  }

  const initialPct = rawKeys[0].Value;
  const finalPct = rawKeys[rawKeys.length - 1].Value;
  const appliedCoefficient = Number((initialPct / 100).toFixed(4));

  const steps = [];
  for (let i = 0; i < rawKeys.length; i++) {
    const cur = rawKeys[i];
    const startDay = cur.Time;

    let next = rawKeys[i + 1];
    let endDay = next ? next.Time - 1 : 90;
    if (endDay < startDay) endDay = startDay;

    if (next && next.Value === cur.Value) {
      endDay = next.Time;
      const nextNext = rawKeys[i + 2];
      if (nextNext) endDay = nextNext.Time - 1;
      i++;
    }

    const durationDays = Math.max(1, endDay - startDay + 1);
    steps.push({
      startDay,
      endDay,
      durationDays,
      pct: cur.Value,
      multiplier: Number((cur.Value / 100).toFixed(4))
    });
  }

  const minKey = rawKeys.find((k) => k.Value === finalPct);
  const daysToMin = minKey ? minKey.Time : null;

  return {
    curveTable: curveTableName,
    rowName,
    initialPct,
    finalPct,
    daysToMin,
    unlockDay: uDay,
    appliedCoefficient,
    keys: rawKeys.map((k) => ({ Time: k.Time, Value: k.Value })),
    steps,
    diagnosticStatus: "confirmed"
  };
}

function evaluateSimpleCurve(curveRow, time) {
  if (!curveRow || !Array.isArray(curveRow.Keys) || typeof time !== "number" || !Number.isFinite(time)) return null;
  const keys = curveRow.Keys
    .filter((key) => key && typeof key.Time === "number" && Number.isFinite(key.Time) && typeof key.Value === "number" && Number.isFinite(key.Value))
    .slice()
    .sort((a, b) => a.Time - b.Time);
  if (keys.length === 0) return null;
  if (time <= keys[0].Time) return keys[0].Value;
  if (time >= keys[keys.length - 1].Time) return keys[keys.length - 1].Value;

  for (let i = 1; i < keys.length; i++) {
    const right = keys[i];
    if (time > right.Time) continue;
    const left = keys[i - 1];
    if (right.Time === left.Time) return right.Value;
    const progress = (time - left.Time) / (right.Time - left.Time);
    return left.Value + (right.Value - left.Value) * progress;
  }
  return null;
}

function buildCritFormulaResolver(critFormulaFile, divisor = 2) {
  const raw = critFormulaFile && readJsonFile(critFormulaFile);
  const rows = raw && (raw[0]?.Rows || raw.Rows || raw);
  if (!rows || !rows.ax2 || !rows.bx || !rows.c) return null;

  return (level) => {
    const a = evaluateSimpleCurve(rows.ax2, level);
    const b = evaluateSimpleCurve(rows.bx, level);
    const c = evaluateSimpleCurve(rows.c, level);
    if (![a, b, c].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
    const rawDenominator = (a * level * level + b * level + c) / divisor;
    if (!Number.isFinite(rawDenominator) || rawDenominator <= 0) return null;
    return {
      denominator: Math.floor(rawDenominator),
      rawDenominator: Number(rawDenominator.toFixed(4)),
      coefficients: { ax2: a, bx: b, c }
    };
  };
}

function getTofFormulas(projectRoot) {
  try {
    return require(path.join(projectRoot, "datamine", "shared", "tof-formulas.js"));
  } catch (_e) {
    return require("../../datamine/shared/tof-formulas.js");
  }
}

function calculateOowResistance(level, strengthX, baseHp = null, formulas = null, sNum = null, mode = "standard") {
  const TofFormulas = formulas || getTofFormulas(resolveProjectRoot());
  const L = typeof level === "number" && Number.isFinite(level) && level > 0 ? level : 100;
  const X = typeof strengthX === "number" && Number.isFinite(strengthX) && strengthX >= 0 ? strengthX : 0;

  let resistPct;
  let K = 14106;
  let isEmpirical = false;
  let formulaDesc = "X / (X + K)";

  if (mode === "standard" && typeof sNum === "number" && sNum <= 13) {
    isEmpirical = true;
    if (sNum <= 11) {
      resistPct = 0.40 + (sNum - 1) * 0.006;
      formulaDesc = `0.40 + (${sNum} - 1) * 0.006 = ${(resistPct * 100).toFixed(2)}%`;
    } else if (sNum === 12) {
      resistPct = 0.7185;
      formulaDesc = "71.85% (S12 standard backup)";
    } else if (sNum === 13) {
      resistPct = 0.7393;
      formulaDesc = "73.93% (S13 standard backup)";
    }
  } else {
    const audit = TofFormulas.calcResist(X, L);
    K = audit.K;
    resistPct = audit.resistPct;
    formulaDesc = `resist% = X / (X + ${K}) = ${(resistPct * 100).toFixed(2)}%`;
  }

  const effectiveHpMult = 1 / (1 - resistPct);
  const effectiveHp = (typeof baseHp === "number" && Number.isFinite(baseHp) && baseHp > 0)
    ? Math.round(baseHp * effectiveHpMult)
    : null;

  return {
    sourceStatus: "confirmed",
    isEmpirical,
    X,
    level: L,
    K,
    resistK: K,
    rawResistPct: resistPct,
    resistPct,
    resistPercent: Number((resistPct * 100).toFixed(2)),
    resistPercentFormatted: `${(resistPct * 100).toFixed(1)}%`,
    effectiveMultiplier: effectiveHpMult,
    effectiveHpMult: effectiveHpMult,
    ehpMultiplier: effectiveHpMult,
    effectiveHp,
    effHp: effectiveHp,
    effectiveHpFormatted: effectiveHp !== null ? TofFormulas.formatStatNumber(effectiveHp) : null,
    effHpFormatted: effectiveHp !== null ? TofFormulas.formatStatNumber(effectiveHp) : null,
    formula: formulaDesc,
    formulaDescription: formulaDesc,
    diagnosticStatus: "confirmed"
  };
}

function scanRawBossAssets(rawDir, projectRoot) {
  if (!rawDir || !projectRoot) return;
  const targetDir = path.join(projectRoot, 'datamine', 'oow', 'assets', 'monsters');
  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (_) {}
  }

  // 1. Scan UI/ZFTP/mainform and dynamically iterate all subdirectories matching /^BOSS(_S\d+)?$/i
  const zftpDir = path.join(rawDir, 'Hotta', 'Content', 'Resources', 'UI', 'ZFTP', 'mainform');
  if (fs.existsSync(zftpDir)) {
    const subDirs = [zftpDir];
    try {
      const entries = fs.readdirSync(zftpDir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && /^BOSS(_S\d+)?$/i.test(ent.name)) {
          subDirs.push(path.join(zftpDir, ent.name));
        }
      }
    } catch (_) {}

    for (const sDir of subDirs) {
      try {
        const files = fs.readdirSync(sDir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.png')) {
            const srcFile = path.join(sDir, file);
            const dstFile = path.join(targetDir, file);
            if (!fs.existsSync(dstFile)) {
              fs.copyFileSync(srcFile, dstFile);
            }
          }
        }
      } catch (_) {}
    }
  }

  // 2. Scan UI/WorldBossList/BOSS/
  const wbDir = path.join(rawDir, 'Hotta', 'Content', 'Resources', 'UI', 'WorldBossList', 'BOSS');
  if (fs.existsSync(wbDir)) {
    try {
      const files = fs.readdirSync(wbDir);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.png')) {
          const srcFile = path.join(wbDir, file);
          const dstFile = path.join(targetDir, file);
          if (!fs.existsSync(dstFile)) {
            fs.copyFileSync(srcFile, dstFile);
          }
        }
      }
    } catch (_) {}
  }

  // 3. Scan UI/SHTT/guaiwu/
  const shttDir = path.join(rawDir, 'Hotta', 'Content', 'Resources', 'UI', 'SHTT', 'guaiwu');
  if (fs.existsSync(shttDir)) {
    const shttSubDirs = [shttDir];
    const btnDir = path.join(shttDir, 'Btn');
    if (fs.existsSync(btnDir)) shttSubDirs.push(btnDir);
    for (const sDir of shttSubDirs) {
      try {
        const files = fs.readdirSync(sDir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.png')) {
            const srcFile = path.join(sDir, file);
            const dstFile = path.join(targetDir, file);
            if (!fs.existsSync(dstFile)) {
              fs.copyFileSync(srcFile, dstFile);
            }
          }
        }
      } catch (_) {}
    }
  }
}

let _cachedCuratedMapping = null;

function getAvailableMonsterFiles(projectRoot) {
  const localMonsterDir = projectRoot ? path.join(projectRoot, 'datamine', 'oow', 'assets', 'monsters') : '';
  if (!localMonsterDir || !fs.existsSync(localMonsterDir)) return new Set<any>();
  try {
    return new Set<any>(fs.readdirSync(localMonsterDir));
  } catch (_) {
    return new Set<any>();
  }
}

function getCuratedMonsterMapping(projectRoot) {
  if (_cachedCuratedMapping) return _cachedCuratedMapping;
  const mappingCandidates = [
    projectRoot ? path.join(projectRoot, 'scripts', 'monster-image-mapping.json') : '',
    projectRoot ? path.join(projectRoot, 'tof-fast-datamine', 'core', 'monster-image-mapping.json') : '',
    path.join(__dirname, 'monster-image-mapping.json'),
    path.join(__dirname, '..', '..', 'scripts', 'monster-image-mapping.json')
  ];
  _cachedCuratedMapping = {};
  for (const mPath of mappingCandidates) {
    if (mPath && fs.existsSync(mPath)) {
      try {
        _cachedCuratedMapping = JSON.parse(readGameSourceFileSync(mPath, 'utf8'));
        break;
      } catch (_) {}
    }
  }
  return _cachedCuratedMapping;
}

function canonicalFceClassId(value) {
  return String(value || '')
    .replace(/^OriginWar_/i, '')
    .replace(/_C$/i, '')
    .replace(/_(?:EX|Balance|Execute|SHTT)$/i, '')
    .toLowerCase();
}

function findExactFceBoss(value, fceIndex = { bosses: [] }) {
  if (!Array.isArray(fceIndex.bosses)) return null;
  // Guard special MMO bosses from colliding with standard FCE IDs
  if (/061_shtt/i.test(value)) return null;
  if (/038_balance/i.test(value)) return null;

  const exactId = canonicalFceClassId(value);
  if (!exactId) return null;

  const numMatch = exactId.match(/boss(?:_hum)?_?0*(\d+)/i);
  const bossNum = numMatch ? parseInt(numMatch[1], 10) : null;

  return fceIndex.bosses.find((boss) => {
    const bossId = canonicalFceClassId(boss && boss.boss_id);
    const slug = String((boss && boss.slug) || '').toLowerCase();
    if (bossId === exactId || slug === exactId) return true;
    if (bossNum !== null && Number(boss && boss.boss_num) === bossNum) return true;
    return false;
  }) || null;
}

function resolveEnemyImage(classPath, monsterType, fceIndex = { bosses: [] }, projectRoot = '', rawDir = '', seasonNum = null, floorNum = null) {
  if (!classPath) {
    const isBoss = monsterType === 'BS_MONSTER_BOSS';
    const isElite = monsterType === 'BS_MONSTER_ELITE';
    const placeholder = isBoss ? '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp' : (isElite ? '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-elite.webp' : '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-mob.webp');
    return {
      image: placeholder,
      imageThumb: placeholder,
      lineupPortraitFull: placeholder,
      lineupPortraitThumb: placeholder,
      detailImageFull: placeholder,
      detailImageThumb: placeholder,
      imageDT: null,
      portraitRound: null,
      imageSource: 'type_placeholder',
      imageAssetPath: null,
      imageMatchStatus: 'placeholder',
      normalizedMonsterClass: '',
      enemyKind: isBoss ? 'boss' : (isElite ? 'elite' : 'mob')
    };
  }

  const rawBase = path.basename(String(classPath)).split('.')[0];
  const normalizedMonsterClass = rawBase.replace(/^OriginWar_/, '').replace(/_C$/, '');

  // Deterministic Type Classification Precedence:
  // 1. Blueprint path containing /Boss/ or /Elite/
  // 2. Class name starting with boss_ or elite_
  // 3. rawMonsterType from data table (BS_MONSTER_BOSS / BS_MONSTER_ELITE)
  const isBoss = /[\/\\]Boss[\/\\]/i.test(classPath) || /^boss_/i.test(normalizedMonsterClass) || monsterType === 'BS_MONSTER_BOSS';
  const isElite = !isBoss && (/[\/\\]Elite[\/\\]/i.test(classPath) || /^elite_/i.test(normalizedMonsterClass) || monsterType === 'BS_MONSTER_ELITE');
  const enemyKind = isBoss ? 'boss' : (isElite ? 'elite' : 'mob');

  const curatedMapping = getCuratedMonsterMapping(projectRoot);

  function toThumb(imgPath) {
    if (!imgPath) return null;
    return imgPath;
  }

  let lineupPortraitFull = null;
  let detailImageFull = null;
  let lineupPortraitThumb = null;
  let detailImageThumb = null;
  let portraitRound = null;
  let imageDT = null;
  let imageSource = null;
  let imageMatchStatus = 'placeholder';

  if (isBoss) {
    // --- BOSS RESOLUTION ---
    // Precedence 1: exact FCE identity. The visible portrait is derived from
    // the same card art; general boss_hum mappings often point at a different
    // scenery/wide texture for the same actor.
    const exactFceBoss = findExactFceBoss(normalizedMonsterClass, fceIndex);
    if (exactFceBoss) {
      detailImageFull = exactFceBoss.detailImage || exactFceBoss.displayWebpUrl || exactFceBoss.art || null;
      lineupPortraitFull = exactFceBoss.lineupPortrait || detailImageFull;
      detailImageThumb = exactFceBoss.cardThumbnail || exactFceBoss.preview || detailImageFull;
      lineupPortraitThumb = exactFceBoss.lineupPortraitThumb || exactFceBoss.cardThumbnail ||
        exactFceBoss.preview || lineupPortraitFull;
      imageSource = 'confirmed_fce_exact_class_match';
      imageMatchStatus = 'confirmed';
    }

    // Precedence 2: Curated / Authoritative Evidence Mapping (monster-image-mapping.json)
    const aliasKeys = [
      classPath,
      rawBase,
      normalizedMonsterClass,
      normalizedMonsterClass.toLowerCase()
    ].filter(Boolean);

    for (const key of detailImageFull ? [] : aliasKeys) {
      if (curatedMapping[key]) {
        const mapped = curatedMapping[key];
        if (typeof mapped === 'object' && mapped !== null) {
          const mappedDetail = mapped.detailImage || mapped.image;
          const mappedLineup = mapped.lineupPortrait || mapped.image;
          const isConfirmed = mapped.resolutionStatus === 'confirmed' &&
            mappedDetail && mappedLineup &&
            !mappedDetail.includes('placeholder') && !mappedLineup.includes('placeholder');
          if (isConfirmed) {
            detailImageFull = mappedDetail;
            lineupPortraitFull = mappedLineup;
            detailImageThumb = mapped.detailImageThumb || mapped.imageThumb || null;
            lineupPortraitThumb = mapped.lineupPortraitThumb || mapped.imageThumb || null;
            imageSource = 'curated_mapping';
            imageMatchStatus = 'confirmed';
            break;
          }
        }
        const mappedPath = mapped;
        if (typeof mappedPath === 'string' && !mappedPath.includes('placeholder')) {
          detailImageFull = mappedPath;
          lineupPortraitFull = mappedPath;
          imageSource = 'explicit_alias';
          imageMatchStatus = 'confirmed';
          break;
        }
      }
    }

    // Final exact-FCE fallback for older indexes without complete role fields.
    if (!detailImageFull && Array.isArray(fceIndex.bosses)) {
      const fceHit = findExactFceBoss(normalizedMonsterClass, fceIndex);

      if (fceHit) {
        const cardUrl = fceHit.detailImage || fceHit.displayWebpUrl || null;
        const photoUrl = fceHit.lineupPortrait || cardUrl;
        detailImageFull = cardUrl;
        lineupPortraitFull = photoUrl;
        detailImageThumb = fceHit.cardThumbnail || fceHit.preview || null;
        lineupPortraitThumb = fceHit.lineupPortraitThumb || fceHit.preview || null;
        imageSource = 'confirmed_fce_exact_class_match';
        imageMatchStatus = 'confirmed';
      }
    }

    if (!lineupPortraitFull && detailImageFull) {
      lineupPortraitFull = detailImageFull;
    }
    if (!detailImageFull && lineupPortraitFull) {
      detailImageFull = lineupPortraitFull;
    }

    if (!lineupPortraitFull) {
      lineupPortraitFull = '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp';
      detailImageFull = '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp';
      imageSource = 'type_placeholder';
      imageMatchStatus = 'placeholder';
    }
  } else {
    // --- ELITE & MOB RESOLUTION ---
    // Precedence 1: Curated / Authoritative Evidence Mapping from backup & pipeline
    const aliasKeys = [
      classPath,
      rawBase,
      normalizedMonsterClass,
      normalizedMonsterClass.toLowerCase()
    ].filter(Boolean);

    for (const key of aliasKeys) {
      if (curatedMapping[key]) {
        const mapped = curatedMapping[key];
        if (typeof mapped === 'object' && mapped !== null) {
          const mappedLineup = mapped.lineupPortrait || mapped.image;
          const mappedDetail = mapped.detailImage || mapped.image;
          const isConfirmed = mapped.resolutionStatus === 'confirmed' &&
            mappedLineup && mappedDetail &&
            !mappedLineup.includes('placeholder') && !mappedDetail.includes('placeholder');
          if (isConfirmed) {
            lineupPortraitFull = mappedLineup;
            detailImageFull = mappedDetail;
            lineupPortraitThumb = mapped.lineupPortraitThumb || mapped.imageThumb || null;
            detailImageThumb = mapped.detailImageThumb || mapped.imageThumb || null;
            imageSource = 'curated_mapping';
            imageMatchStatus = 'confirmed';
            break;
          }
        }
        const mappedPath = mapped;
        if (typeof mappedPath === 'string' && mappedPath.startsWith('/datamine/shared/media/')) {
          lineupPortraitFull = mappedPath;
          detailImageFull = mappedPath;
          imageSource = 'explicit_alias';
          imageMatchStatus = 'explicit_alias';
          break;
        }
      }
    }

    if (!lineupPortraitFull) {
      const placeholder = isElite ? '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-elite.webp' : '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-mob.webp';
      lineupPortraitFull = placeholder;
      detailImageFull = placeholder;
      imageSource = 'type_placeholder';
      imageMatchStatus = 'placeholder';
    }
  }

  lineupPortraitThumb = lineupPortraitThumb || toThumb(lineupPortraitFull);
  detailImageThumb = detailImageThumb || toThumb(detailImageFull);

  return {
    image: detailImageFull || lineupPortraitFull,
    imageThumb: lineupPortraitThumb || detailImageThumb,
    lineupPortraitFull,
    lineupPortraitThumb,
    detailImageFull,
    detailImageThumb,
    imageDT,
    portraitRound,
    imageSource,
    imageAssetPath: lineupPortraitFull,
    imageMatchStatus,
    normalizedMonsterClass,
    enemyKind
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

function resolveEnemyName(normalizedMonsterClass, isBoss, fceIndex = { bosses: [] }, enLoc: Record<string, any> = {}, ruLoc = {}, classPath = null) {
  if (!normalizedMonsterClass && !classPath) {
    return { nameEn: "Enemy", nameRu: "Враг", bossId: null };
  }

  const rawTarget = String(normalizedMonsterClass || (classPath ? path.basename(classPath).split('.')[0] : '')).trim();
  const lowerTarget = rawTarget.toLowerCase();

  // 1. Explicit MMO Boss overrides
  if (MMO_BOSS_NAME_OVERRIDES[lowerTarget]) {
    const o = MMO_BOSS_NAME_OVERRIDES[lowerTarget];
    return { nameEn: o.en, nameRu: o.ru, bossId: o.bossId };
  }
  for (const [pattern, o] of Object.entries(MMO_BOSS_NAME_OVERRIDES)) {
    if (lowerTarget.includes(pattern)) {
      return { nameEn: o.en, nameRu: o.ru, bossId: o.bossId };
    }
  }

  // 2. Explicit MMO Mob overrides
  if (MMO_MOB_NAME_OVERRIDES[lowerTarget]) {
    const o = MMO_MOB_NAME_OVERRIDES[lowerTarget];
    return { nameEn: o.en, nameRu: o.ru, bossId: null };
  }
  for (const [pattern, o] of Object.entries(MMO_MOB_NAME_OVERRIDES)) {
    if (lowerTarget.includes(pattern)) {
      return { nameEn: o.en, nameRu: o.ru, bossId: null };
    }
  }

  // 3. Exact FCE match
  if (isBoss && Array.isArray(fceIndex.bosses)) {
    const exactHit = findExactFceBoss(rawTarget, fceIndex);
    if (exactHit) {
      return {
        nameEn: exactHit.name || rawTarget,
        nameRu: exactHit.name_ru || exactHit.name || rawTarget,
        bossId: exactHit.boss_id || null
      };
    }
  }

  // Helper to lookup key across namespaces in Game.json localization tables
  const findLoc = (k) => {
    if (!k) return null;
    const preferredNs = ["ST_actorname", "", "ActorName", "MonsterStaticData", "ST_WorldActorName", "ST_actorname_Oversea"];
    for (const ns of preferredNs) {
      if (enLoc[ns] && enLoc[ns][k]) {
        return {
          nameEn: cleanHtmlTags(enLoc[ns][k]),
          nameRu: cleanHtmlTags(ruLoc[ns]?.[k] || enLoc[ns][k])
        };
      }
    }
    if (typeof enLoc[k] === "string") {
      return {
        nameEn: cleanHtmlTags(enLoc[k]),
        nameRu: cleanHtmlTags(ruLoc[k] || enLoc[k])
      };
    }
    for (const ns of Object.keys(enLoc)) {
      if (enLoc[ns] && typeof enLoc[ns] === "object" && enLoc[ns][k]) {
        return {
          nameEn: cleanHtmlTags(enLoc[ns][k]),
          nameRu: cleanHtmlTags(ruLoc[ns]?.[k] || enLoc[ns][k])
        };
      }
    }
    return null;
  };

  // 4. Candidate localization keys with suffix stripping and number normalization
  const cleaned = rawTarget.replace(/_(?:Balance|SHTT|EX|Execute)$/i, '');
  const baseNum = cleaned.match(/(\d+)/)?.[1] || '';

  const candKeys = [
    `${rawTarget}_name`,
    `${rawTarget.toLowerCase()}_name`,
    `${cleaned}_name`,
    `${cleaned.toLowerCase()}_name`,
    rawTarget.replace(/^elite_hum_/i, 'mon_hum_'),
    rawTarget,
    rawTarget.toLowerCase(),
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

  for (const k of candKeys) {
    const hit = findLoc(k);
    if (hit && hit.nameEn) {
      return {
        nameEn: hit.nameEn,
        nameRu: hit.nameRu || hit.nameEn,
        bossId: null
      };
    }
  }

  return {
    nameEn: isBoss ? "Unknown Boss" : "Unknown Enemy",
    nameRu: isBoss ? "Неизвестный босс" : "Неизвестный враг",
    bossId: null
  };
}

function processUserOowStats(rawDir, projectRoot) {
  console.log(`\n[user-oow-stats] Processing Origin of War (OOW) stats from: ${rawDir}`);
  scanRawBossAssets(rawDir, projectRoot);

  const gameResDir = path.join(projectRoot, "datamine-pipeline", "Tower-of-fantasy-game-resources");
  const buffsAssetDir = path.join(projectRoot, "datamine", "oow", "assets", "buffs");

  if (!fs.existsSync(buffsAssetDir)) {
    fs.mkdirSync(buffsAssetDir, { recursive: true });
  }

  const monsterFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json",
    "Hotta/Content/Resources/CoreBlueprints/DataTable/DT_MonsterStaticData.json",
    "DT_MonsterStaticData_Overseas.json",
    "DT_MonsterStaticData.json"
  ]);

  const roundConfigFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarRoundConfigDataTable_Overseas.json",
    "Hotta/Content/Resources/CoreBlueprints/DataTable/Dungeon/OriginWarRoundConfigDataTable.json",
    "OriginWarRoundConfigDataTable_Overseas.json",
    "OriginWarRoundConfigDataTable.json"
  ]);

  const seasonConfigFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarSeasonConfigDataTable_Overseas.json",
    "Hotta/Content/Resources/CoreBlueprints/DataTable/Dungeon/OriginWarSeasonConfigDataTable.json",
    "OriginWarSeasonConfigDataTable_Overseas.json",
    "OriginWarSeasonConfigDataTable.json"
  ]);

  const poolConfigFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarMonsterPoolDataTable_Overseas.json",
    "Hotta/Content/Resources/CoreBlueprints/DataTable/Dungeon/OriginWarMonsterPoolDataTable.json",
    "OriginWarMonsterPoolDataTable_Overseas.json",
    "OriginWarMonsterPoolDataTable.json"
  ]);

  const buffPoolFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarBuffPoolDataTable_Overseas.json",
    "Hotta/Content/Resources/CoreBlueprints/DataTable/OriginWarBuffPoolDataTable.json",
    "OriginWarBuffPoolDataTable_Overseas.json",
    "OriginWarBuffPoolDataTable.json"
  ]);

  const curvesOverseasFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarMonster_Overseas.json",
    "OriginWarMonster_Overseas.json"
  ]);
  const curvesBaseFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/Abilities/DataTables/OriginWarMonster.json",
    "OriginWarMonster.json"
  ]);
  const curvesBalanceFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure/OriginWarMonster_Balance.json",
    "OriginWarMonster_Balance.json"
  ]);
  const curvesCombinedFile = curvesOverseasFile || curvesBaseFile || curvesBalanceFile;

  const defenceFormulaFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/Abilities/DataTables/DefenceFormula.json",
    "DefenceFormula.json"
  ]);
  const critFormulaFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/Abilities/DataTables/CritFormula.json",
    "CritFormula.json"
  ]);

  if (!monsterFile || !seasonConfigFile || !roundConfigFile || !poolConfigFile || !curvesCombinedFile) {
    throw new Error(
      `[required] Standard OOW inputs incomplete (season=${Boolean(seasonConfigFile)}, round=${Boolean(roundConfigFile)}, pool=${Boolean(poolConfigFile)}, monster=${Boolean(monsterFile)}, curves=${Boolean(curvesCombinedFile)}); no output was changed.`
    );
  }

  // DefenceFormula is the authoritative resistance denominator. CritFormula
  // has exactly double coefficients in the current export and is retained as
  // a compatibility fallback for older snapshots only.
  const critFormulaResolver = defenceFormulaFile
    ? buildCritFormulaResolver(defenceFormulaFile, 1)
    : buildCritFormulaResolver(critFormulaFile, 2);

  const standardBuffPoolMap = buildBuffPoolMap(buffPoolFile);

  const t1 = findFile(rawDir, projectRoot, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/GameplayEffectTipsDataTable_Overseas.json",
    "GameplayEffectTipsDataTable_Overseas.json"
  ]);
  const t2 = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable.json",
    "GameplayEffectTipsDataTable.json"
  ]);
  const enLocFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Localization/Game/en/Game.json",
    "Game/en/Game.json",
    "en/Game.json"
  ]);
  const ruLocFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Localization/Game/ru/Game.json",
    "Game/ru/Game.json",
    "ru/Game.json"
  ]);

  const enLoc = (enLocFile && readJsonFile(enLocFile)) || {};
  const ruLoc = (ruLocFile && readJsonFile(ruLocFile)) || {};

  const fceIndex =
    readJsonFile(path.join(projectRoot, "datamine/fce/data/fce-index.json")) ||
    { bosses: [] };

  const d1 = (t1 && readJsonFile(t1)) || {};
  const d2 = (t2 && readJsonFile(t2)) || {};
  const rows1 = Array.isArray(d1) ? (d1[0]?.Rows) : (d1.Rows || d1);
  const rows2 = Array.isArray(d2) ? (d2[0]?.Rows) : (d2.Rows || d2);
  const effectRows = Object.assign({}, rows2, rows1);

  const rawCurvesOver = (curvesOverseasFile && readJsonFile(curvesOverseasFile)) || {};
  const rawCurvesBase = (curvesBaseFile && readJsonFile(curvesBaseFile)) || {};
  const rawCurvesBal = (curvesBalanceFile && readJsonFile(curvesBalanceFile)) || {};

  const curvesOverseas = rawCurvesOver[0]?.Rows || rawCurvesOver.Rows || rawCurvesOver;
  const curvesBase = rawCurvesBase[0]?.Rows || rawCurvesBase.Rows || rawCurvesBase;
  const curvesBalance = rawCurvesBal[0]?.Rows || rawCurvesBal.Rows || rawCurvesBal;

  console.log(`[user-oow-stats] Reading Monster Data from: ${monsterFile}`);
  const mData = readJsonFile(monsterFile);
  const monsterRows = Object.assign(
    {},
    Array.isArray(mData) ? (mData[0]?.Rows) : (mData.Rows || mData)
  );

  const poolRows = (poolConfigFile && readJsonFile(poolConfigFile)) || {};
  const poolData = Array.isArray(poolRows) ? (poolRows[0]?.Rows) : (poolRows.Rows || poolRows);

  const seasonsOutput = [];
  const rawCreepsList = [];
  let seasonDatesMap: Record<string, any> = {};

  if (roundConfigFile && seasonConfigFile) {
    console.log(`[user-oow-stats] Using in-game config tables:`);
    console.log(`  -> Rounds:  ${roundConfigFile}`);
    console.log(`  -> Seasons: ${seasonConfigFile}`);

    const rData = readJsonFile(roundConfigFile);
    const roundRows = Array.isArray(rData) ? (rData[0]?.Rows) : (rData.Rows || rData);

    const sData = readJsonFile(seasonConfigFile);
    const seasonRows = Array.isArray(sData) ? (sData[0]?.Rows) : (sData.Rows || sData);

    for (const [sKey, sRow] of Object.entries(seasonRows)) {
      const sNum = parseInt(sKey, 10);
      if (isNaN(sNum)) continue;

      const startDate = normalizeIsoDate(sRow.SeasonBeginTime);
      const endDate = normalizeIsoDate(sRow.SeasonEndTime);
      seasonDatesMap[String(sNum)] = { startDate, endDate };

      const floorList = [];

      for (let round = 1; round <= 30; round++) {
        const rRow = Object.values(roundRows).find(
          (r) => (r.OriginSeasonID == sNum || r.Season == sNum) && (r.OriginRound == round || r.Round == round)
        );
        if (!rRow) continue;

        const stageMutators = (rRow.ShowBuffs || []).map((b) => {
          const rawName = b.AssetPathName?.split(".").pop() || String(b);
          const intel = resolveBuffFullIntel(rawName, standardBuffPoolMap, effectRows, enLoc, ruLoc, gameResDir, buffsAssetDir);
          return {
            ...intel,
            kind: "mutator"
          };
        });

        const rawDropBuffs = rRow.DropBuffs || [];
        let totalFloorWeight = 0;
        let hasValidWeight = true;

        for (const d of rawDropBuffs) {
          const w = d.DropWight !== undefined ? d.DropWight : d.DropWeight;
          if (typeof w === "number" && Number.isFinite(w) && w >= 0) {
            totalFloorWeight += w;
          } else {
            hasValidWeight = false;
          }
        }

        const dropBuffs = rawDropBuffs.map((d) => {
          const rawWeight = (typeof d.DropWight === "number" || typeof d.DropWeight === "number") ? Number(d.DropWight ?? d.DropWeight) : null;
          const buffIntel = resolveBuffFullIntel(d.BuffPoolID, standardBuffPoolMap, effectRows, enLoc, ruLoc, gameResDir, buffsAssetDir);
          let probability = null;
          let probabilityPercent = null;
          let diagnosticStatus = null;

          if (hasValidWeight && totalFloorWeight > 0 && rawWeight !== null && Number.isFinite(rawWeight) && rawWeight >= 0) {
            probability = Number((rawWeight / totalFloorWeight).toFixed(6));
            probabilityPercent = Number(((rawWeight / totalFloorWeight) * 100).toFixed(2));
            diagnosticStatus = "confirmed";
          } else {
            diagnosticStatus = "zero_or_invalid_weight";
          }

          return {
            buffPoolId: d.BuffPoolID,
            ...buffIntel,
            weight: rawWeight,
            totalFloorWeight: hasValidWeight && totalFloorWeight > 0 ? totalFloorWeight : null,
            probability,
            probabilityPercent,
            diagnosticStatus
          };
        });

        const preferredKey = sNum === 2 ? `2_${round}` : `1_${round}`;
        const exactRowName = (curvesOverseas[preferredKey] || curvesBase[preferredKey] || curvesBalance[preferredKey])
          ? preferredKey
          : (typeof rRow.MonsterStrength === "string"
              ? rRow.MonsterStrength
              : (rRow.MonsterStrength?.RowName || preferredKey));
        const curveTableName = rRow.MonsterStrength?.CurveTable?.ObjectName || (curvesOverseas[exactRowName] ? "OriginWarMonster_Overseas" : (curvesBase[exactRowName] ? "OriginWarMonster" : "OriginWarMonster_Balance"));
        const curveObj = curvesOverseas[exactRowName] || curvesOverseas[preferredKey] || curvesBase[exactRowName] || curvesBase[preferredKey] || curvesBalance[exactRowName] || curvesBalance[preferredKey] || null;

        const unlockDay = sNum >= 21 ? round : 1;
        const seasonNormalization = sNum >= 14 ? 100 : 1;
        const difficultySchedule = parseCurveSteps(curveObj, unlockDay, curveTableName, exactRowName);
        const appliedCoeff = (difficultySchedule && typeof difficultySchedule.appliedCoefficient === "number" && Number.isFinite(difficultySchedule.appliedCoefficient))
          ? difficultySchedule.appliedCoefficient
          : null;

        const enemies = [];
        let totalHp = 0;
        let maxHp = 0;

        for (let waveIdx = 0; waveIdx < (rRow.WaveMonsterPool || []).length; waveIdx++) {
          const poolKey = rRow.WaveMonsterPool[waveIdx];
          const pData = poolData ? (poolData[poolKey] || poolData[poolKey?.toLowerCase()] || poolData[poolKey?.toUpperCase()] || poolData["S" + poolKey?.slice(1)] || poolData["s" + poolKey?.slice(1)]) : null;

          if (pData && Array.isArray(pData.PoolMonsters)) {
            pData.PoolMonsters.forEach((m, mobSubIdx) => {
              const classPath = m.MonsterClass?.AssetPathName || m.MonsterClass || null;
              const imgResult = resolveEnemyImage(classPath, m.MonsterType, fceIndex, projectRoot, rawDir, sNum, round);
              const nameResult = resolveEnemyName(imgResult.normalizedMonsterClass, m.MonsterType === "BS_MONSTER_BOSS" || /^boss_/i.test(imgResult.normalizedMonsterClass), fceIndex, enLoc, ruLoc);

              const attrId = m.AttributeID || null;
              const attr = attrId ? (monsterRows[attrId] || monsterRows[attrId?.toLowerCase()] || monsterRows[attrId?.toUpperCase()] || monsterRows["s" + attrId?.slice(1)] || monsterRows["S" + attrId?.slice(1)]) : null;

              const level = (typeof m.MonsterLevel === "number" && Number.isFinite(m.MonsterLevel)) ? m.MonsterLevel : null;
              const count = (typeof m.MonsterCount === "number" && Number.isFinite(m.MonsterCount)) ? m.MonsterCount : null;
              const baseHp = (attr && typeof attr.MaxHealth === "number" && Number.isFinite(attr.MaxHealth)) ? attr.MaxHealth : null;
              const baseAtk = (attr && typeof attr.CommonAtkBase === "number" && Number.isFinite(attr.CommonAtkBase)) ? attr.CommonAtkBase : null;
              const baseDef = (attr && typeof attr.PhyDefBase === "number" && Number.isFinite(attr.PhyDefBase)) ? attr.PhyDefBase : null;

              const missingFields = [];
              if (level === null) missingFields.push("MonsterLevel");
              if (count === null) missingFields.push("MonsterCount");
              if (!attr) missingFields.push("monster_static_row");
              if (baseHp === null) missingFields.push("MaxHealth");
              if (appliedCoeff === null) missingFields.push("appliedCoefficient");

              const isIncomplete = missingFields.length > 0;

              let singleHp = null;
              let combinedHp = null;
              let singleAtk = null;
              let singleDef = null;

              if (!isIncomplete) {
                // HP = MaxHealth as it is in DT_MonsterStaticData, with the documented
                // Season-14 (patch 3.8/4.0) x100 balance normalization only. NO difficulty
                // multiplier on HP — this reproduces the original site's values. The
                // difficulty coefficient (appliedCoeff) is used ONLY for resist X below.
                const coefficient = seasonNormalization;
                singleHp = Math.round(baseHp * coefficient);
                combinedHp = singleHp * count;
                singleAtk = baseAtk !== null ? Math.round(baseAtk) : null;
                singleDef = baseDef !== null ? Math.round(baseDef * appliedCoeff) : null;
                totalHp += combinedHp;
                if (singleHp > maxHp) maxHp = singleHp;
              }

              // Resistance X straight from the datamine: PhyDefBase (DT_MonsterStaticData) x
              // the floor's applied difficulty coefficient (OriginWarMonster/RoundConfig curve).
              // At 2000% difficulty: 4000 x 20 = 80000 -> resist% = 80000/(80000+14106) = 85.01%.
              const baseDefVal = (attr && typeof attr.PhyDefBase === "number" && Number.isFinite(attr.PhyDefBase)) ? attr.PhyDefBase : 1500;
              const X = appliedCoeff !== null ? Math.round(baseDefVal * appliedCoeff) : 0;

              const inherentBuffs = (m.MonsterBuffID || []).map((b) => {
                const rawName = b.AssetPathName?.split(".").pop() || String(b);
                return resolveBuffFullIntel(rawName, standardBuffPoolMap, effectRows, enLoc, ruLoc, gameResDir, buffsAssetDir);
              }).filter(Boolean);

              const resistanceInfo = calculateOowResistance(100, X, singleHp, null, sNum, "standard");

              const enemyObj = {
                wave: waveIdx + 1,
                mob: mobSubIdx + 1,
                key: attrId || `standard_s${sNum}_f${round}_w${waveIdx + 1}_${mobSubIdx + 1}`,
                nameEn: nameResult.nameEn,
                nameRu: nameResult.nameRu,
                codeName: imgResult.normalizedMonsterClass || null,
                bossId: nameResult.bossId,
                monsterType: m.MonsterType || null,
                monsterClass: classPath,
                attributeId: attrId,
                count,
                level,
                mode: "standard",
                season: sNum,
                floor: round,
                baseHp,
                baseAtk,
                baseDef,
                coefficient: appliedCoeff,
                appliedModifiers: appliedCoeff !== null ? {
                  seasonNormalization,
                  curveCoefficient: appliedCoeff
                } : null,
                hp: singleHp,
                combinedHp,
                hpFormatted: singleHp !== null ? singleHp.toLocaleString("en-US") : null,
                hpBillions: singleHp !== null ? Number((singleHp / 1e9).toFixed(3)) : null,
                hpMillions: singleHp !== null ? Number((singleHp / 1e6).toFixed(2)) : null,
                atk: singleAtk,
                def: singleDef,
                X,
                resistK: resistanceInfo.resistK,
                resistPct: resistanceInfo.resistPct,
                resistPercent: resistanceInfo.resistPercent,
                effectiveHp: resistanceInfo.effectiveHp,
                effHp: resistanceInfo.effectiveHp,
                effHpFormatted: resistanceInfo.effectiveHpFormatted,
                image: imgResult.image,
                imageThumb: imgResult.imageThumb,
                lineupPortraitFull: imgResult.lineupPortraitFull,
                lineupPortraitThumb: imgResult.lineupPortraitThumb,
                detailImageFull: imgResult.detailImageFull,
                detailImageThumb: imgResult.detailImageThumb,
                imageDT: imgResult.imageDT,
                portraitRound: imgResult.portraitRound,
                imageSource: imgResult.imageSource,
                imageAssetPath: imgResult.imageAssetPath,
                imageMatchStatus: imgResult.imageMatchStatus,
                normalizedMonsterClass: imgResult.normalizedMonsterClass,
                enemyKind: imgResult.enemyKind,
                blueprint: classPath,
                stats: attr || null,
                resistanceInfo,
                inherentBuffs,
                incomplete: isIncomplete,
                diagnosticReason: isIncomplete ? `Missing required operands: ${missingFields.join(", ")}` : null,
                diagnostics: isIncomplete ? { missingFields, reason: `Missing required operands: ${missingFields.join(", ")}` } : null
              };

              enemies.push(enemyObj);
              rawCreepsList.push({
                season: sNum,
                floor: round,
                ...enemyObj
              });
            });
          }
        }

        if (enemies.length > 0) {
          const floorLevel = Math.max(...enemies.map((enemy) => enemy.level).filter((lvl) => typeof lvl === "number" && Number.isFinite(lvl)));
          const effFloorLevel = Number.isFinite(floorLevel) ? floorLevel : 100;
          const floorDef = (enemies.find((e) => e.baseDef !== null)?.baseDef) || 1500;
          const floorX = appliedCoeff !== null ? Math.round(floorDef * appliedCoeff) : 0;
          const floorResistanceInfo = calculateOowResistance(100, floorX, totalHp, null, sNum, "standard");
          const maxMobResistanceInfo = calculateOowResistance(100, floorX, maxHp, null, sNum, "standard");

          floorList.push({
            floor: round,
            unlockDay,
            mobCount: enemies.reduce((sum, e) => (e.count !== null ? sum + e.count : sum), 0),
            totalHp: totalHp > 0 ? totalHp : null,
            totalHpBillions: totalHp > 0 ? Number((totalHp / 1e9).toFixed(3)) : null,
            totalHpMillions: totalHp > 0 ? Number((totalHp / 1e6).toFixed(2)) : null,
            maxHp: maxHp > 0 ? maxHp : null,
            maxHpBillions: maxHp > 0 ? Number((maxHp / 1e9).toFixed(3)) : null,
            maxHpMillions: maxHp > 0 ? Number((maxHp / 1e6).toFixed(2)) : null,
            X: floorX,
            resistK: floorResistanceInfo.resistK,
            resistPct: floorResistanceInfo.resistPct,
            resistPercent: floorResistanceInfo.resistPercent,
            effectiveHp: floorResistanceInfo.effectiveHp,
            effHp: floorResistanceInfo.effectiveHp,
            effectiveHpFormatted: floorResistanceInfo.effectiveHpFormatted,
            effectiveHpBillions: floorResistanceInfo.effectiveHp > 0 ? Number((floorResistanceInfo.effectiveHp / 1e9).toFixed(3)) : null,
            effectiveHpMillions: floorResistanceInfo.effectiveHp > 0 ? Number((floorResistanceInfo.effectiveHp / 1e6).toFixed(2)) : null,
            maxMobEffectiveHp: maxMobResistanceInfo.effectiveHp,
            maxMobEffectiveHpFormatted: maxMobResistanceInfo.effectiveHpFormatted,
            rewardDropId: rRow.RoundAwardId?.[0]?.Value || "",
            helpPoints: rRow.RoundHelpPoint || 0,
            stageMutators,
            dropBuffs,
            difficultySchedule,
            resistanceInfo: floorResistanceInfo,
            enemies
          });
        }
      }

      if (floorList.length > 0) {
        const totalSeasonHp = floorList.reduce((sum, f) => (f.totalHp !== null ? sum + f.totalHp : sum), 0);
        const totalSeasonEffectiveHp = floorList.reduce((sum, f) => (f.effectiveHp !== null ? sum + f.effectiveHp : sum), 0);
        const maxSeasonDiff = Math.max(...floorList.map((fl) => fl.difficultySchedule?.initialPct || 100));
        const curveProfile =
          maxSeasonDiff === 1500
            ? "1500% Global Rebalance"
            : maxSeasonDiff === 2100
            ? "2100% S3 Extended"
            : maxSeasonDiff > 2100
            ? `${maxSeasonDiff}% Extreme`
            : "2000% Standard Global";

        const maxFloorObj = floorList[floorList.length - 1];
        const maxFloorEnemies = maxFloorObj?.enemies || [];
        const sortedMaxEnemies = [...maxFloorEnemies].sort((a, b) => {
          const ehpA = Number(a.effectiveHp ?? a.effHp ?? (a.hp ? a.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : (a.stats?.MaxHealth || 0)));
          const ehpB = Number(b.effectiveHp ?? b.effHp ?? (b.hp ? b.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : (b.stats?.MaxHealth || 0)));
          if (ehpB !== ehpA) return ehpB - ehpA;
          const hpA = Number(a.hp || a.singleHp || 0);
          const hpB = Number(b.hp || b.singleHp || 0);
          if (hpB !== hpA) return hpB - hpA;
          const idA = String(a.normalizedMonsterClass || a.monsterClass || a.blueprint || a.nameEn || '');
          const idB = String(b.normalizedMonsterClass || b.monsterClass || b.blueprint || b.nameEn || '');
          return idA.localeCompare(idB);
        });

        const strongestEnemy = sortedMaxEnemies[0] || null;
        const topEhp = strongestEnemy ? Number(strongestEnemy.effectiveHp ?? strongestEnemy.effHp ?? (strongestEnemy.hp ? strongestEnemy.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : 0)) : 0;
        const tied = sortedMaxEnemies.filter((e) => {
          const ehp = Number(e.effectiveHp ?? e.effHp ?? (e.hp ? e.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : 0));
          return Math.abs(ehp - topEhp) < 1;
        });

        const strongestEnemyObj = strongestEnemy ? {
          normalizedMonsterClass: strongestEnemy.normalizedMonsterClass || null,
          monsterClass: strongestEnemy.monsterClass || strongestEnemy.blueprint || null,
          nameEn: strongestEnemy.nameEn || null,
          nameRu: strongestEnemy.nameRu || null,
          rawHp: strongestEnemy.hp || null,
          rawHpFormatted: strongestEnemy.hpFormatted || null,
          effectiveHp: strongestEnemy.effectiveHp || strongestEnemy.effHp || maxFloorObj?.maxMobEffectiveHp || null,
          effectiveHpFormatted: strongestEnemy.effHpFormatted || strongestEnemy.effectiveHpFormatted || maxFloorObj?.maxMobEffectiveHpFormatted || null,
          imageAssetPath: strongestEnemy.imageAssetPath || strongestEnemy.image || null,
          image: strongestEnemy.image || null,
          imageThumb: strongestEnemy.imageThumb || null,
          fullUrl: strongestEnemy.detailImageFull || strongestEnemy.lineupPortraitFull || strongestEnemy.image || null,
          thumbUrl: strongestEnemy.detailImageThumb || strongestEnemy.lineupPortraitThumb || strongestEnemy.imageThumb || null,
          imageMatchStatus: strongestEnemy.imageMatchStatus || null,
          imageSource: strongestEnemy.imageSource || null,
          tiedCandidates: tied.length > 1 ? tied.map(t => String(t.normalizedMonsterClass || t.monsterClass || t.blueprint || t.nameEn || '')) : undefined
        } : null;

        seasonsOutput.push({
          season: sNum,
          title: `Season ${sNum}`,
          startDate,
          endDate,
          floorCount: floorList.length,
          minFloor: floorList[0]?.floor || 1,
          maxFloor: floorList[floorList.length - 1]?.floor || floorList.length,
          totalSeasonHp: totalSeasonHp > 0 ? totalSeasonHp : null,
          totalSeasonHpBillions: totalSeasonHp > 0 ? Number((totalSeasonHp / 1e9).toFixed(2)) : null,
          totalSeasonEffectiveHp: totalSeasonEffectiveHp > 0 ? totalSeasonEffectiveHp : null,
          totalSeasonEffectiveHpBillions: totalSeasonEffectiveHp > 0 ? Number((totalSeasonEffectiveHp / 1e9).toFixed(2)) : null,
          finalBossHp: strongestEnemyObj?.rawHp || maxFloorObj?.maxHp || null,
          finalBossEffectiveHp: strongestEnemyObj?.effectiveHp || maxFloorObj?.maxMobEffectiveHp || null,
          strongestEnemy: strongestEnemyObj,
          finalBossName: strongestEnemyObj?.nameEn || null,
          finalBossNameRu: strongestEnemyObj?.nameRu || null,
          finalBossImage: strongestEnemyObj?.image || null,
          finalBossImageThumb: strongestEnemyObj?.thumbUrl || strongestEnemyObj?.imageThumb || null,
          finalBossImageDT: strongestEnemy?.imageDT || null,
          finalBossPortraitRound: strongestEnemy?.portraitRound || null,
          bossName: strongestEnemyObj?.nameEn || null,
          bossNameRu: strongestEnemyObj?.nameRu || null,
          bossImage: strongestEnemyObj?.image || null,
          bossImageThumb: strongestEnemyObj?.thumbUrl || strongestEnemyObj?.imageThumb || null,
          bossImageDT: strongestEnemy?.imageDT || null,
          bossPortraitRound: strongestEnemy?.portraitRound || null,
          maxDifficulty: maxSeasonDiff,
          curveProfile,
          resistanceInfo: floorList[floorList.length - 1]?.resistanceInfo || null,
          difficultySummary: {
            maxDifficulty: maxSeasonDiff,
            curveProfile,
            floors: floorList.map((fl) => ({
              floor: fl.floor,
              unlockDay: fl.unlockDay || 1,
              initialPct: fl.difficultySchedule?.initialPct || null,
              daysToMin: fl.difficultySchedule?.daysToMin || null,
              stepsCount: fl.difficultySchedule?.steps?.length || 0,
              steps: fl.difficultySchedule?.steps || []
            }))
          },
          floors: floorList
        });
      }
    }
  }

  seasonsOutput.sort((a, b) => a.season - b.season);

  const oowDir = path.join(projectRoot, "datamine", "oow", "data");
  if (!fs.existsSync(oowDir)) fs.mkdirSync(oowDir, { recursive: true });

  const statsPayload = JSON.stringify(
    {
      meta: {
        updatedAt: new Date().toISOString(),
        totalEntries: rawCreepsList.length,
        totalSeasons: seasonsOutput.length,
        sourceMonsterFile: path.basename(monsterFile),
        semanticSlotStatus: "unresolved_in_game_schema",
        hasRoundConfig: Boolean(roundConfigFile),
        hasSeasonConfig: Boolean(seasonConfigFile),
        hasPoolConfig: Boolean(poolConfigFile),
        hasBuffPoolConfig: Boolean(buffPoolFile),
        hasDefenceFormula: Boolean(defenceFormulaFile),
        hasLegacyCritFormulaFallback: !defenceFormulaFile && Boolean(critFormulaFile),
        resistanceStatus: "unavailable_unverified_numerator"
      },
      seasons: seasonsOutput
    },
    null,
    2
  );

  if (seasonsOutput.length === 0) {
    throw new Error("[required] Origin of War produced zero seasons; refusing to overwrite or publish stale output.");
  }

  // 1. Authoritative season dates generated directly from in-game config
  fs.writeFileSync(path.join(oowDir, "season_dates.json"), `${JSON.stringify(seasonDatesMap, null, 2)}\n`, "utf8");

  // 2. Authoritative buff catalog generated directly from game effect tips, buff pool, and floors
  const buffCatalogMap: Record<string, any> = {};
  for (const [poolKey, poolEntry] of Object.entries(standardBuffPoolMap)) {
    if (!buffCatalogMap[poolKey]) {
      const intel = resolveBuffFullIntel(poolKey, standardBuffPoolMap, effectRows, enLoc, ruLoc, gameResDir, buffsAssetDir);
      if (intel && intel.id) {
        buffCatalogMap[intel.id] = intel;
      }
    }
  }
  for (const s of seasonsOutput) {
    for (const fl of s.floors || []) {
      for (const b of fl.stageMutators || []) {
        if (b && b.id && !buffCatalogMap[b.id]) {
          const intel = resolveBuffFullIntel(b.id, standardBuffPoolMap, effectRows, enLoc, ruLoc, gameResDir, buffsAssetDir) || b;
          if (intel && intel.id) buffCatalogMap[intel.id] = intel;
        }
      }
      for (const b of fl.dropBuffs || []) {
        if (b && b.id && !buffCatalogMap[b.id]) {
          const intel = resolveBuffFullIntel(b.id, standardBuffPoolMap, effectRows, enLoc, ruLoc, gameResDir, buffsAssetDir) || b;
          if (intel && intel.id) buffCatalogMap[intel.id] = intel;
        }
      }
      for (const m of fl.enemies || []) {
        for (const b of m.inherentBuffs || []) {
          if (b && b.id && !buffCatalogMap[b.id]) {
            const intel = resolveBuffFullIntel(b.id, standardBuffPoolMap, effectRows, enLoc, ruLoc, gameResDir, buffsAssetDir) || b;
            if (intel && intel.id) buffCatalogMap[intel.id] = intel;
          }
        }
      }
    }
  }

  // Build both required modes before touching published outputs
  const mmoResult = processMmoOowStats(rawDir, projectRoot, oowDir, monsterRows, enLoc, ruLoc, gameResDir, buffsAssetDir, buffCatalogMap, critFormulaResolver);
  fs.writeFileSync(path.join(oowDir, "oow_buffs_catalog.json"), `${JSON.stringify(buffCatalogMap, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(oowDir, "oow_stats.json"), statsPayload, "utf8");
  fs.writeFileSync(path.join(oowDir, "oow_mmo_stats.json"), mmoResult.payload, "utf8");
  console.log(`[user-oow-stats] Successfully built ${seasonsOutput.length} standard and ${mmoResult.seasonsCount} MMO seasons.`);

  return {
    seasonsCount: seasonsOutput.length,
    creepsCount: rawCreepsList.length
  };
}

function getMmoMonsterBuffAssetPath(rawBuff) {
  if (typeof rawBuff === "string") return rawBuff;
  if (rawBuff && typeof rawBuff.AssetPathName === "string") return rawBuff.AssetPathName;
  if (rawBuff && typeof rawBuff.ObjectName === "string") return rawBuff.ObjectName;
  return "";
}

function isMmoGameplayMonsterBuff(rawBuff) {
  const assetPath = getMmoMonsterBuffAssetPath(rawBuff).trim().replace(/\\/g, "/");
  if (!assetPath) return false;

  const pathParts = assetPath.toLowerCase().split("/").filter(Boolean);
  const assetName = (pathParts[pathParts.length - 1] || "").split(".")[0];

  // MMO MonsterBuffID also carries a None slot and a season display component.
  // The latter is a visual environment marker, not an enemy gameplay affix.
  return assetName !== "none" && !pathParts.includes("envirseasondisplayformon");
}

function processMmoOowStats(rawDir, projectRoot, oowDir, standardMonsterRows: Record<string, any> = {}, enLoc = {}, ruLoc: Record<string, any> = {}, gameResDir = "", buffsAssetDir = "", sharedBuffCatalog = null, critFormulaResolver = null) {
  const seasonMmoFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarSeasonConfigDataTable_MMO.json",
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarSeasonConfigDataTable_MMO.json",
    "OriginWarSeasonConfigDataTable_MMO.json"
  ]);
  const roundMmoFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarRoundConfigDataTable_MMO.json",
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarRoundConfigDataTable_MMO.json",
    "OriginWarRoundConfigDataTable_MMO.json"
  ]);
  const poolMmoFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarMonsterPoolDataTable_MMO.json",
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarMonsterPoolDataTable_MMO.json",
    "OriginWarMonsterPoolDataTable_MMO.json"
  ]);
  const monsterMmoFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_MonsterStaticData_MMO.json",
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/DT_MonsterStaticData_MMO.json",
    "DT_MonsterStaticData_MMO.json"
  ]);
  const buffPoolMmoFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarBuffPoolDataTable_MMO.json",
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_MMO/OriginWar/OriginWarBuffPoolDataTable_MMO.json",
    "OriginWarBuffPoolDataTable_MMO.json"
  ]);
  const mmoBuffTipsFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/GameplayEffectTipsDataTable_Balance.json",
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_Balance/GameplayEffectTipsDataTable_Balance.json",
    "GameplayEffectTipsDataTable_Balance.json"
  ]);
  const curvesBalanceFile = findFile(rawDir, projectRoot, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure/OriginWarMonster_Balance.json",
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable_Balance/EffectFigure/OriginWarMonster_Balance.json",
    "OriginWarMonster_Balance.json"
  ]);

  if (!seasonMmoFile || !roundMmoFile || !poolMmoFile || !monsterMmoFile || !buffPoolMmoFile || !curvesBalanceFile) {
    throw new Error(
      `[required] MMO OOW inputs incomplete (season=${Boolean(seasonMmoFile)}, round=${Boolean(roundMmoFile)}, pool=${Boolean(poolMmoFile)}, monster=${Boolean(monsterMmoFile)}, buffPool=${Boolean(buffPoolMmoFile)}, balanceCurve=${Boolean(curvesBalanceFile)}); no output was changed.`
    );
  }
  if (!mmoBuffTipsFile) {
    throw new Error(
      "[required] MMO OOW GameplayEffectTipsDataTable_Balance is missing; exact buff names, descriptions, and icons cannot be verified. Add the table to the raw export before building. No output was changed."
    );
  }

  const mmoBuffPoolMap = buildBuffPoolMap(buffPoolMmoFile);
  const rawMmoBuffTips = readJsonFile(mmoBuffTipsFile) || {};
  const mmoBuffTipRows = Array.isArray(rawMmoBuffTips)
    ? (rawMmoBuffTips[0]?.Rows || {})
    : (rawMmoBuffTips.Rows || rawMmoBuffTips);
  if (Object.keys(mmoBuffTipRows).length === 0) {
    throw new Error(
      `[required] MMO OOW GameplayEffectTipsDataTable_Balance has no rows (${mmoBuffTipsFile}); refusing to publish unverified buff cards. No output was changed.`
    );
  }
  const resolveMmoBuff = (rawBuffName) => resolveBuffFullIntel(
    rawBuffName,
    mmoBuffPoolMap,
    mmoBuffTipRows,
    enLoc,
    ruLoc,
    gameResDir,
    buffsAssetDir,
    { iconPolicy: "effect-tips" }
  );

  const rawSeasons = readJsonFile(seasonMmoFile) || {};
  const rawRounds = readJsonFile(roundMmoFile) || {};
  const rawPools = readJsonFile(poolMmoFile) || {};
  const rawMonstersMmo = monsterMmoFile ? (readJsonFile(monsterMmoFile) || {}) : {};

  const sRows = rawSeasons[0]?.Rows || rawSeasons.Rows || rawSeasons;
  const rRows = rawRounds[0]?.Rows || rawRounds.Rows || rawRounds;
  const pRows = rawPools[0]?.Rows || rawPools.Rows || rawPools;
  const mRows = rawMonstersMmo[0]?.Rows || rawMonstersMmo.Rows || rawMonstersMmo;

  const rawCurvesBal = (curvesBalanceFile && readJsonFile(curvesBalanceFile)) || {};
  const curvesBalance = rawCurvesBal[0]?.Rows || rawCurvesBal.Rows || rawCurvesBal;

  const fceIndex =
    readJsonFile(path.join(projectRoot, "datamine/fce/data/fce-index.json")) ||
    { bosses: [] };

  const seasonsMap: Record<string, any> = {};
  for (const [rKey, r] of Object.entries(rRows)) {
    const sNum = Number(r.OriginSeasonID);
    if (!Number.isSafeInteger(sNum) || sNum < 1) {
      throw new Error(`[required] MMO OOW round row ${rKey} has invalid OriginSeasonID "${r.OriginSeasonID}"; refusing to assign it to another season. No output was changed.`);
    }
    const floorNum = Number(r.OriginRound);
    if (!Number.isSafeInteger(floorNum) || floorNum < 1) {
      throw new Error(`[required] MMO OOW round row ${rKey} has invalid OriginRound "${r.OriginRound}" in season ${sNum}; refusing to assign it to another floor. No output was changed.`);
    }
    if (!seasonsMap[sNum]) {
      seasonsMap[sNum] = {
        season: sNum,
        seasonType: "MMO",
        floorCount: 0,
        resistanceInfo: null,
        floors: []
      };
    }

    const pools = r.WaveMonsterPool || [];
    const enemies = [];
    let floorTotalHp = 0;
    let maxMobHp = 0;

    const exactRowName = typeof r.MonsterStrength === "string"
      ? r.MonsterStrength
      : (r.MonsterStrength?.RowName || `mmo_${floorNum}`);
    const curveTableObjectName = r.MonsterStrength?.CurveTable?.ObjectName || "";
    const curveTableReference = curveTableObjectName.match(/CurveTable'([^']+)'/i)?.[1] || curveTableObjectName;
    const curveTableName = curveTableReference || (curvesBalance[exactRowName] ? "OriginWarMonster_Balance" : "OriginWarMonster");
    if (curveTableReference && curveTableReference !== "OriginWarMonster_Balance") {
      throw new Error(`[required] MMO OOW floor ${floorNum} season ${sNum} references unsupported balance curve table "${curveTableReference}"; no output was changed.`);
    }
    const mmoCurveRow = curvesBalance[exactRowName] || curvesBalance[`mmo_${floorNum}`] || null;
    if (!mmoCurveRow || !Array.isArray(mmoCurveRow.Keys) || mmoCurveRow.Keys.length === 0) {
      throw new Error(`[required] MMO OOW curve row "${exactRowName}" is missing or has no keys for season ${sNum} floor ${floorNum}; refusing to substitute base stats; no output was changed.`);
    }

    const difficultySchedule = parseCurveSteps(mmoCurveRow, 1, curveTableName, exactRowName);
    const appliedCoeff = (difficultySchedule && typeof difficultySchedule.appliedCoefficient === "number" && Number.isFinite(difficultySchedule.appliedCoefficient))
      ? difficultySchedule.appliedCoefficient
      : null;

    pools.forEach((poolId, pIdx) => {
      const poolData = pRows[poolId];
      if (poolData && Array.isArray(poolData.PoolMonsters)) {
        poolData.PoolMonsters.forEach((pm, mIdx) => {
          const classPath = pm.MonsterClass?.AssetPathName || pm.MonsterClass || null;
          const imgResult = resolveEnemyImage(classPath, pm.MonsterType, fceIndex, projectRoot, rawDir, sNum, floorNum);
          const isBoss = imgResult.enemyKind === "boss" || pm.MonsterType === "BS_MONSTER_BOSS" || /^boss_/i.test(imgResult.normalizedMonsterClass);
          const nameResult = resolveEnemyName(imgResult.normalizedMonsterClass, isBoss, fceIndex, enLoc, ruLoc, classPath);

          const attrId = pm.AttributeID || null;
          const statRow = attrId ? (mRows[attrId] || mRows[classPath]) : null;

          const level = (typeof pm.MonsterLevel === "number" && Number.isFinite(pm.MonsterLevel)) ? pm.MonsterLevel : null;
          const count = (typeof pm.MonsterCount === "number" && Number.isFinite(pm.MonsterCount)) ? pm.MonsterCount : null;
          const baseHp = (statRow && typeof statRow.MaxHealth === "number" && Number.isFinite(statRow.MaxHealth)) ? statRow.MaxHealth : null;
          const baseAtk = (statRow && typeof statRow.CommonAtkBase === "number" && Number.isFinite(statRow.CommonAtkBase)) ? statRow.CommonAtkBase : null;
          const baseDef = (statRow && typeof statRow.PhyDefBase === "number" && Number.isFinite(statRow.PhyDefBase)) ? statRow.PhyDefBase : null;

          const missingFields = [];
          if (level === null) missingFields.push("MonsterLevel");
          if (count === null) missingFields.push("MonsterCount");
          if (!statRow) missingFields.push("monster_static_row");
          if (baseHp === null) missingFields.push("MaxHealth");
          if (baseAtk === null) missingFields.push("CommonAtkBase");
          if (baseDef === null) missingFields.push("PhyDefBase");
          if (appliedCoeff === null) missingFields.push("appliedCoefficient");

          const isIncomplete = missingFields.length > 0;

          let scaledHp = null;
          let totalMobHp = null;
          let scaledAtk = null;
          let scaledDef = null;

          if (!isIncomplete) {
            scaledHp = Math.round(baseHp * appliedCoeff);
            totalMobHp = scaledHp * count;
            scaledAtk = baseAtk !== null ? Math.round(baseAtk * appliedCoeff) : null;
            scaledDef = baseDef !== null ? Math.round(baseDef * appliedCoeff) : null;
            floorTotalHp += totalMobHp;
            if (scaledHp > maxMobHp) maxMobHp = scaledHp;
          }

          const mmoX = baseDef !== null && appliedCoeff !== null
            ? Math.round(baseDef * appliedCoeff)
            : null;

          const inherentBuffs = (pm.MonsterBuffID || []).filter(isMmoGameplayMonsterBuff).map((b) => {
            const rawName = getMmoMonsterBuffAssetPath(b).split(".").pop() || String(b);
            return resolveMmoBuff(rawName);
          }).filter(Boolean);

          const resistanceInfo = mmoX !== null
            ? calculateOowResistance(100, mmoX, scaledHp, null, sNum, "mmo")
            : null;

          enemies.push({
            wave: pIdx + 1,
            mob: mIdx + 1,
            key: attrId || `mmo_s${sNum}_f${floorNum}_w${pIdx + 1}_${mIdx + 1}`,
            nameEn: nameResult.nameEn,
            nameRu: nameResult.nameRu,
            codeName: imgResult.normalizedMonsterClass || null,
            bossId: nameResult.bossId,
            monsterType: pm.MonsterType || null,
            monsterClass: classPath,
            attributeId: attrId,
            count,
            level,
            mode: "mmo",
            season: sNum,
            floor: floorNum,
            baseHp,
            baseAtk,
            baseDef,
            coefficient: appliedCoeff,
            appliedModifiers: appliedCoeff !== null ? {
              curveCoefficient: appliedCoeff
            } : null,
            hp: scaledHp,
            combinedHp: totalMobHp,
            hpFormatted: scaledHp !== null ? scaledHp.toLocaleString("en-US") : null,
            atk: scaledAtk,
            def: scaledDef,
            X: mmoX,
            resistK: resistanceInfo?.resistK ?? null,
            resistPct: resistanceInfo?.resistPct ?? null,
            resistPercent: resistanceInfo?.resistPercent ?? null,
            effectiveHp: resistanceInfo?.effectiveHp ?? null,
            effHp: resistanceInfo?.effectiveHp ?? null,
            effHpFormatted: resistanceInfo?.effectiveHpFormatted ?? null,
            image: imgResult.image,
            imageThumb: imgResult.imageThumb,
            lineupPortraitFull: imgResult.lineupPortraitFull,
            lineupPortraitThumb: imgResult.lineupPortraitThumb,
            detailImageFull: imgResult.detailImageFull,
            detailImageThumb: imgResult.detailImageThumb,
            imageDT: imgResult.imageDT,
            portraitRound: imgResult.portraitRound,
            imageSource: imgResult.imageSource,
            imageAssetPath: imgResult.imageAssetPath,
            imageMatchStatus: imgResult.imageMatchStatus,
            normalizedMonsterClass: imgResult.normalizedMonsterClass,
            enemyKind: imgResult.enemyKind,
            blueprint: classPath,
            stats: statRow || null,
            resistanceInfo,
            inherentBuffs,
            source: {
              monsterPoolTable: "DataTable_MMO/OriginWar/OriginWarMonsterPoolDataTable_MMO",
              monsterPoolRow: poolId,
              poolMonsterIndex: mIdx + 1,
              monsterStaticTable: "DataTable_MMO/DT_MonsterStaticData_MMO",
              monsterStaticRow: attrId
            },
            incomplete: isIncomplete,
            diagnosticReason: isIncomplete ? `Missing required operands: ${missingFields.join(", ")}` : null,
            diagnostics: isIncomplete ? { missingFields, reason: `Missing required operands: ${missingFields.join(", ")}` } : null
          });
        });
      }
    });

    const stageMutators = [];
    (r.ShowBuffs || []).forEach((b) => {
      const rawName = b.AssetPathName?.split(".").pop() || String(b);
      const bObj = resolveMmoBuff(rawName);
      if (bObj && bObj.id) {
        stageMutators.push({ ...bObj, kind: "mutator" });
        if (sharedBuffCatalog && !sharedBuffCatalog[bObj.id]) sharedBuffCatalog[bObj.id] = bObj;
      }
    });
    (r.MonsterWeakBuffs || []).forEach((b) => {
      const rawName = b.AssetPathName?.split(".").pop() || String(b);
      const bObj = resolveMmoBuff(rawName);
      if (bObj && bObj.id) {
        stageMutators.push({ ...bObj, kind: "weakness" });
        if (sharedBuffCatalog && !sharedBuffCatalog[bObj.id]) sharedBuffCatalog[bObj.id] = bObj;
      }
    });

    const rawMmoDropBuffs = r.DropBuffs || [];
    let totalMmoDropWeight = 0;
    let hasValidMmoWeight = true;

    for (const d of rawMmoDropBuffs) {
      const w = d.DropWight !== undefined ? d.DropWight : d.DropWeight;
      if (typeof w === "number" && Number.isFinite(w) && w >= 0) {
        totalMmoDropWeight += w;
      } else {
        hasValidMmoWeight = false;
      }
    }

    const dropBuffs = rawMmoDropBuffs.map((d) => {
      const rawWeight = (typeof d.DropWight === "number" || typeof d.DropWeight === "number") ? Number(d.DropWight ?? d.DropWeight) : null;
      const bObj = resolveMmoBuff(d.BuffPoolID);
      let probability = null;
      let probabilityPercent = null;
      let diagnosticStatus = null;

      if (hasValidMmoWeight && totalMmoDropWeight > 0 && rawWeight !== null && Number.isFinite(rawWeight) && rawWeight >= 0) {
        probability = Number((rawWeight / totalMmoDropWeight).toFixed(6));
        probabilityPercent = Number(((rawWeight / totalMmoDropWeight) * 100).toFixed(2));
        diagnosticStatus = "confirmed";
      } else {
        diagnosticStatus = "zero_or_invalid_weight";
      }

      if (sharedBuffCatalog && bObj && bObj.id && !sharedBuffCatalog[bObj.id]) {
        sharedBuffCatalog[bObj.id] = bObj;
      }

      return {
        buffPoolId: d.BuffPoolID,
        ...bObj,
        weight: rawWeight,
        totalFloorWeight: hasValidMmoWeight && totalMmoDropWeight > 0 ? totalMmoDropWeight : null,
        probability,
        probabilityPercent,
        diagnosticStatus
      };
    });

    const floorLevel = Math.max(...enemies.map((enemy) => enemy.level).filter((level) => typeof level === "number" && Number.isFinite(level)));
    const effFloorLevel = Number.isFinite(floorLevel) ? floorLevel : 100;
    const completeEnemyStats = enemies.length > 0 && enemies.every((enemy) => !enemy.incomplete);
    const floorDef = enemies.find((enemy) => enemy.baseDef !== null)?.baseDef ?? null;
    const floorX = completeEnemyStats && floorDef !== null && appliedCoeff !== null
      ? Math.round(floorDef * appliedCoeff)
      : null;
    const floorResistanceInfo = floorX !== null
      ? calculateOowResistance(100, floorX, completeEnemyStats ? floorTotalHp : null, null, sNum, "mmo")
      : null;
    const maxMobResistanceInfo = floorX !== null
      ? calculateOowResistance(100, floorX, completeEnemyStats ? maxMobHp : null, null, sNum, "mmo")
      : null;

    seasonsMap[sNum].floors.push({
      floor: floorNum,
      mobCount: enemies.reduce((sum, e) => (e.count !== null ? sum + e.count : sum), 0),
      totalHp: completeEnemyStats && floorTotalHp > 0 ? floorTotalHp : null,
      totalHpBillions: completeEnemyStats && floorTotalHp > 0 ? Number((floorTotalHp / 1e9).toFixed(3)) : null,
      totalHpMillions: completeEnemyStats && floorTotalHp > 0 ? Number((floorTotalHp / 1e6).toFixed(2)) : null,
      maxHp: completeEnemyStats && maxMobHp > 0 ? maxMobHp : null,
      maxHpBillions: completeEnemyStats && maxMobHp > 0 ? Number((maxMobHp / 1e9).toFixed(3)) : null,
      maxHpMillions: completeEnemyStats && maxMobHp > 0 ? Number((maxMobHp / 1e6).toFixed(2)) : null,
      X: floorX,
      resistK: floorResistanceInfo?.resistK ?? null,
      resistPct: floorResistanceInfo?.resistPct ?? null,
      resistPercent: floorResistanceInfo?.resistPercent ?? null,
      effectiveHp: floorResistanceInfo?.effectiveHp ?? null,
      effHp: floorResistanceInfo?.effectiveHp ?? null,
      effectiveHpFormatted: floorResistanceInfo?.effectiveHpFormatted ?? null,
      effectiveHpBillions: floorResistanceInfo?.effectiveHp > 0 ? Number((floorResistanceInfo.effectiveHp / 1e9).toFixed(3)) : null,
      effectiveHpMillions: floorResistanceInfo?.effectiveHp > 0 ? Number((floorResistanceInfo.effectiveHp / 1e6).toFixed(2)) : null,
      maxMobEffectiveHp: maxMobResistanceInfo?.effectiveHp ?? null,
      maxMobEffectiveHpFormatted: maxMobResistanceInfo?.effectiveHpFormatted ?? null,
      rewardDropId: r.RoundAwardId?.[0]?.Value || r.RoundAwardId || "",
      helpPoints: r.RoundHelpPoint || 0,
      source: {roundTable: 'DataTable_MMO/OriginWar/OriginWarRoundConfigDataTable_MMO', row: rKey, seasonId: r.OriginSeasonID, wavePools: pools, monsterTable: 'DT_MonsterStaticData_MMO'},
      stageMutators,
      dropBuffs,
      difficultySchedule,
      resistanceInfo: floorResistanceInfo,
      enemiesCount: enemies.length,
      enemies
    });
  }

  // A dated season without configured rounds is unavailable. Never clone another
  // season: it silently substitutes its enemies and effects (formerly S1 → S2).
  const finalSeasons = Object.values(seasonsMap).map((s) => {
    s.floors.sort((a, b) => a.floor - b.floor);
    s.floorCount = s.floors.length;
    s.minFloor = s.floors.length > 0 ? s.floors[0].floor : 1;
    s.maxFloor = s.floors.length > 0 ? s.floors[s.floors.length - 1].floor : s.floors.length;
    s.totalSeasonHp = s.floors.reduce((sum, f) => (f.totalHp !== null ? sum + f.totalHp : sum), 0);
    s.totalSeasonHpBillions = s.totalSeasonHp > 0 ? Number((s.totalSeasonHp / 1e9).toFixed(2)) : null;
    const totalSeasonEffectiveHp = s.floors.reduce((sum, f) => (f.effectiveHp !== null ? sum + f.effectiveHp : sum), 0);
    s.totalSeasonEffectiveHp = totalSeasonEffectiveHp > 0 ? totalSeasonEffectiveHp : null;
    s.totalSeasonEffectiveHpBillions = totalSeasonEffectiveHp > 0 ? Number((totalSeasonEffectiveHp / 1e9).toFixed(2)) : null;
    const maxFloorObj = s.floors[s.floors.length - 1];
    const maxFloorEnemies = maxFloorObj?.enemies || [];
    const sortedMaxEnemies = [...maxFloorEnemies].sort((a, b) => {
      const ehpA = Number(a.effectiveHp ?? a.effHp ?? (a.hp ? a.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : (a.stats?.MaxHealth || 0)));
      const ehpB = Number(b.effectiveHp ?? b.effHp ?? (b.hp ? b.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : (b.stats?.MaxHealth || 0)));
      if (ehpB !== ehpA) return ehpB - ehpA;
      const hpA = Number(a.hp || a.singleHp || 0);
      const hpB = Number(b.hp || b.singleHp || 0);
      if (hpB !== hpA) return hpB - hpA;
      const aIsFce = a.imageSource === 'confirmed_fce_exact_class_match' || a.imageSource === 'curated_fce_mapping' || (a.image && a.image.includes('fce'));
      const bIsFce = b.imageSource === 'confirmed_fce_exact_class_match' || b.imageSource === 'curated_fce_mapping' || (b.image && b.image.includes('fce'));
      if (aIsFce && !bIsFce) return -1;
      if (!aIsFce && bIsFce) return 1;
      const aBoss = a.enemyKind === 'boss' || /^boss_/i.test(a.normalizedMonsterClass || '');
      const bBoss = b.enemyKind === 'boss' || /^boss_/i.test(b.normalizedMonsterClass || '');
      if (aBoss && !bBoss) return -1;
      if (!aBoss && bBoss) return 1;
      const idA = String(a.normalizedMonsterClass || a.monsterClass || a.blueprint || a.nameEn || '');
      const idB = String(b.normalizedMonsterClass || b.monsterClass || b.blueprint || b.nameEn || '');
      return idA.localeCompare(idB);
    });

    const mmoBoss = sortedMaxEnemies[0] || null;
    const topEhp = mmoBoss ? Number(mmoBoss.effectiveHp ?? mmoBoss.effHp ?? (mmoBoss.hp ? mmoBoss.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : 0)) : 0;
    const tied = sortedMaxEnemies.filter((e) => {
      const ehp = Number(e.effectiveHp ?? e.effHp ?? (e.hp ? e.hp * (maxFloorObj?.resistanceInfo?.ehpMultiplier || 1) : 0));
      return Math.abs(ehp - topEhp) < 1;
    });

    const strongestEnemyObj = mmoBoss ? {
      normalizedMonsterClass: mmoBoss.normalizedMonsterClass || null,
      monsterClass: mmoBoss.monsterClass || mmoBoss.blueprint || null,
      nameEn: mmoBoss.nameEn || null,
      nameRu: mmoBoss.nameRu || null,
      rawHp: mmoBoss.hp || null,
      rawHpFormatted: mmoBoss.hpFormatted || null,
      effectiveHp: mmoBoss.effectiveHp || mmoBoss.effHp || maxFloorObj?.maxMobEffectiveHp || null,
      effectiveHpFormatted: mmoBoss.effHpFormatted || mmoBoss.effectiveHpFormatted || maxFloorObj?.maxMobEffectiveHpFormatted || null,
      imageAssetPath: mmoBoss.imageAssetPath || mmoBoss.image || null,
      image: mmoBoss.image || null,
      imageThumb: mmoBoss.imageThumb || null,
      fullUrl: mmoBoss.detailImageFull || mmoBoss.lineupPortraitFull || mmoBoss.image || null,
      thumbUrl: mmoBoss.detailImageThumb || mmoBoss.lineupPortraitThumb || mmoBoss.imageThumb || null,
      imageMatchStatus: mmoBoss.imageMatchStatus || null,
      imageSource: mmoBoss.imageSource || null,
      tiedCandidates: tied.length > 1 ? tied.map(t => String(t.normalizedMonsterClass || t.monsterClass || t.blueprint || t.nameEn || '')) : undefined
    } : null;

    s.finalBossHp = strongestEnemyObj?.rawHp || s.floors[s.floors.length - 1]?.maxHp || null;
    s.finalBossEffectiveHp = strongestEnemyObj?.effectiveHp || s.floors[s.floors.length - 1]?.maxMobEffectiveHp || null;
    s.strongestEnemy = strongestEnemyObj;
    s.finalBossName = strongestEnemyObj?.nameEn || null;
    s.finalBossNameRu = strongestEnemyObj?.nameRu || null;
    s.finalBossImage = strongestEnemyObj?.image || null;
    s.finalBossImageThumb = strongestEnemyObj?.thumbUrl || strongestEnemyObj?.imageThumb || null;
    s.finalBossImageDT = mmoBoss?.imageDT || null;
    s.finalBossPortraitRound = mmoBoss?.portraitRound || null;
    s.bossName = strongestEnemyObj?.nameEn || null;
    s.bossNameRu = strongestEnemyObj?.nameRu || null;
    s.bossImage = strongestEnemyObj?.image || null;
    s.bossImageThumb = strongestEnemyObj?.thumbUrl || strongestEnemyObj?.imageThumb || null;
    s.bossImageDT = mmoBoss?.imageDT || null;
    s.bossPortraitRound = mmoBoss?.portraitRound || null;

    const maxMmoDiff = Math.max(...s.floors.map((fl) => fl.difficultySchedule?.initialPct || 100), 100);
    s.maxDifficulty = maxMmoDiff;
    s.curveProfile = `${maxMmoDiff}% MMO Balance`;
    s.resistanceInfo = s.floors[s.floors.length - 1]?.resistanceInfo || null;
    s.difficultySummary = {
      maxDifficulty: maxMmoDiff,
      curveProfile: `${maxMmoDiff}% MMO Balance`,
      floors: s.floors.map((fl) => ({
        floor: fl.floor,
        initialPct: fl.difficultySchedule?.initialPct || null,
        daysToMin: fl.difficultySchedule?.daysToMin || null,
        stepsCount: fl.difficultySchedule?.steps?.length || 0,
        steps: fl.difficultySchedule?.steps || []
      }))
    };

    const floorDefinitionFindingsNote = "MMO enemy attributes are defined separately from the scheduled rounds. A floor is included only when OriginWarRoundConfigDataTable_MMO contains a row for it; a missing season or round is never inferred from static attributes or copied from another season.";

    s.floorDefinitionNote = floorDefinitionFindingsNote;
    s.metadataNote = floorDefinitionFindingsNote;

    const sRow = sRows[String(s.season)] || sRows[s.season];
    if (sRow) {
      const rawStart = sRow.SeasonBeginTime_Region?.find(entry => entry.Key === 'EHottaServiceRegionType::Region_Oversea')?.Value || sRow.SeasonBeginTime;
      const rawEnd = sRow.SeasonEndTime_Region?.find(entry => entry.Key === 'EHottaServiceRegionType::Region_Oversea')?.Value || sRow.SeasonEndTime;
      s.startDate = normalizeIsoDate(rawStart);
      s.endDate = normalizeIsoDate(rawEnd);
    }

    return s;
  }).sort((a, b) => a.season - b.season);

  const mmoStatsPayload = JSON.stringify(
    {
      meta: {
        updatedAt: new Date().toISOString(),
        mode: "MMO",
        totalSeasons: finalSeasons.length,
        maxFloors: Math.max(...finalSeasons.map((s) => s.maxFloor)),
        resistanceStatus: "confirmed",
        floorDefinitionNote: "MMO enemy attributes are defined separately from the scheduled rounds. A floor is included only when OriginWarRoundConfigDataTable_MMO contains a row for it; a missing season or round is never inferred from static attributes or copied from another season.",
        floorDefinitionFindings: {
          staticDataAttributeRows: Object.keys(mRows).length,
          configuredRoundRows: Object.keys(rRows).length,
          description: "These counts are derived from the current raw table rows. Wave rosters and buff rotations follow each configured round's explicit references."
        }
      },
      seasons: finalSeasons
    },
    null,
    2
  );

  if (finalSeasons.length === 0) throw new Error("[required] MMO OOW produced zero seasons; no output was changed.");
  return { payload: mmoStatsPayload, seasonsCount: finalSeasons.length };
}

function main() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  processUserOowStats(rawDir, projectRoot);
}

if (require.main === module) {
  main();
}

export {
  processUserOowStats,
  processMmoOowStats,
  isMmoGameplayMonsterBuff,
  getMmoMonsterBuffAssetPath,
  normalizeBuffSlot,
  getSlotLabel,
  buildBuffPoolMap,
  resolveBuffFullIntel,
  parseCurveSteps,
  evaluateSimpleCurve,
  buildCritFormulaResolver,
  calculateOowResistance,
  resolveEnemyImage,
  resolveEnemyName,
};

