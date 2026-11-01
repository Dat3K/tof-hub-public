import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const buf = readGameSourceFileSync(filePath);
  let str;

  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    str = buf.toString("utf16le");
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    // Node has no "utf16be" decoder: swap to little-endian first.
    str = Buffer.from(buf.subarray(0, buf.length - (buf.length % 2))).swap16().toString("utf16le");
  } else {
    str = buf.toString("utf8");
  }

  str = str.replace(/^\uFEFF/, "").trim();

  // Guard against potential duplicate object prefix in corrupted files
  const firstBrace = str.indexOf("{", 1);
  if (firstBrace !== -1 && str.startsWith('{"stave_thunder_plasm":1,{')) {
    str = str.slice(firstBrace);
  }

  return JSON.parse(str);
}

import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';

function flattenLoc(locJson) {
  const map: Record<string, any> = {};
  if (!locJson || typeof locJson !== "object") return map;
  for (const [ns, entries] of Object.entries(locJson)) {
    if (entries && typeof entries === "object") {
      for (const [k, v] of Object.entries(entries)) {
        if (typeof v === "string") {
          map[k] = v;
        }
      }
    } else if (typeof entries === "string") {
      map[ns] = entries;
    }
  }
  return map;
}

function resolveRawDir(projectRoot) {
  const customArg = process.argv.find((arg) => arg.startsWith("--raw-dir="));
  if (customArg) {
    return path.resolve(customArg.split("=")[1]);
  }

  const candidateDirs = [
    path.join(projectRoot, "tof-fast-datamine", "raw_exports"),
    path.join(projectRoot, "raw_exports"),
    path.join(projectRoot, "temperary"),
    path.join(projectRoot, "..", "temperary"),
    path.join(projectRoot, "..", "raw_exports")
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return path.join(projectRoot, "raw_exports");
}

function extractCuratedRenames(curatedFilePath, targetFilePath, fallbackTargetFile) {
  const renameMap = new Map<any, any>();
  const filesToCheck = [curatedFilePath, fallbackTargetFile, targetFilePath].filter(Boolean);

  for (const fp of filesToCheck) {
    if (!fs.existsSync(fp)) continue;
    const raw = readJsonFile(fp);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;

    for (const item of Object.values(raw)) {
      const id = String(item?.id || "").trim();
      const rename = String(item?.rename || "").trim();
      if (id && rename && !renameMap.has(id)) {
        renameMap.set(id, rename);
      }
    }
  }

  return renameMap;
}

function extractCuratedNames(curatedFilePath) {
  const nameMap = new Map<any, any>();
  if (!fs.existsSync(curatedFilePath)) return nameMap;

  const raw = readJsonFile(curatedFilePath);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`[invalid] Curated item overrides must be a JSON object: ${curatedFilePath}`);
  }

  for (const [key, item] of Object.entries(raw)) {
    const id = String(item?.id || key || "").trim();
    const name = String(item?.name || "").trim();
    if (id && name) nameMap.set(id, name);
  }
  return nameMap;
}

function readTranslationMap(filePath) {
  const translationMap = new Map<any, any>();
  if (!fs.existsSync(filePath)) return translationMap;

  const raw = readJsonFile(filePath);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`[invalid] Item translations must be a JSON object: ${filePath}`);
  }

  for (const [rawId, entry] of Object.entries(raw)) {
    const id = String(rawId).trim();
    const name = String(entry?.name || "").trim();
    if (id && name) translationMap.set(id, name);
  }
  return translationMap;
}

function cleanItemName(name) {
  if (!name || typeof name !== "string") return "";
  let cleaned = name.trim();

  // Strip outer / surrounding quotes: "...", “...”, '...', 「...」, 《...》, 『...』
  cleaned = cleaned.replace(/^["'“‘《「『]\s*/, "").replace(/\s*["'”’》」』]$/, "").trim();
  cleaned = cleaned.replace(/^["'“‘《「『]\s*/, "").replace(/\s*["'”’》」』]$/, "").trim();

  // Strip musical notes, hashtags, hyphens/dashes, tildes, asterisks at start or end
  cleaned = cleaned.replace(/^[♪♫♬♩#\-\–\—\s~*]+\s*/, "");
  cleaned = cleaned.replace(/\s*[♪♫♬♩#\s~*]+$/, "");

  // Strip any inner quotes exposed after removing symbols
  cleaned = cleaned.replace(/^["'“‘《「『]\s*/, "").replace(/\s*["'”’》」』]$/, "").trim();

  // Remove leading hyphens/dashes
  cleaned = cleaned.replace(/^[-–—]+\s*/, "");

  return cleaned.trim();
}

function createNameResolver(authoritativeNameMap, translationMap) {
  const appliedTranslationIds = new Set<any>();
  let authoritativeNamesPreserved = 0;

  return {
    resolve(id, fallbackName = "") {
      const authoritativeName = authoritativeNameMap.get(id) || "";
      if (authoritativeName) {
        authoritativeNamesPreserved += 1;
        return cleanItemName(authoritativeName);
      }
      const translatedName = translationMap.get(id) || "";
      if (translatedName) {
        appliedTranslationIds.add(id);
        return cleanItemName(translatedName);
      }
      if (fallbackName && typeof fallbackName === "string" && !/[一-龥]/.test(fallbackName)) {
        return cleanItemName(fallbackName);
      }
      return "";
    },
    stats() {
      return {
        translationsApplied: appliedTranslationIds.size,
        authoritativeNamesPreserved,
        translationEntriesUnused: translationMap.size - appliedTranslationIds.size
      };
    }
  };
}

function buildItemConfigsLookup(rawDir, copier, enGame, ruGame, locResolver) {
  const lookup = new Map<any, any>();
  const sourceReports = [];

  const candidates = [
    {
      file: path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable", "Item", "ItemConfigs.json"),
      altFile: path.join(rawDir, "ItemConfigs.json"),
      name: "ItemConfigs.json",
      edition: "Standard",
      isSecondary: false
    },
    {
      file: path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable", "Item", "ItemConfigs_OS.json"),
      altFile: path.join(rawDir, "ItemConfigs_OS.json"),
      name: "ItemConfigs_OS.json",
      edition: "Overseas",
      isSecondary: false
    },
    {
      file: path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable", "GuildMaze", "GuildMazeItemConfigs.json"),
      altFile: path.join(rawDir, "GuildMazeItemConfigs.json"),
      name: "GuildMazeItemConfigs.json",
      edition: "GuildMaze",
      isSecondary: true,
      modeScope: "guild_maze"
    },
    {
      file: path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable_MMO", "TamingMonster", "CorralMonsterItemConfigDataTable_MMO.json"),
      altFile: path.join(rawDir, "CorralMonsterItemConfigDataTable_MMO.json"),
      name: "CorralMonsterItemConfigDataTable_MMO.json",
      edition: "CorralMonster_MMO",
      isSecondary: true,
      modeScope: "mmo"
    },
    {
      file: path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable_MMO", "EquipmentDataTable_MMO.json"),
      altFile: path.join(rawDir, "EquipmentDataTable_MMO.json"),
      name: "EquipmentDataTable_MMO.json",
      edition: "Equipment_MMO",
      isSecondary: true,
      modeScope: "mmo"
    },
    {
      file: path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "SteampunkMarket", "Shop", "DT_ArtifactRuneSparItemConfig_MMO.json"),
      altFile: path.join(rawDir, "DT_ArtifactRuneSparItemConfig_MMO.json"),
      name: "DT_ArtifactRuneSparItemConfig_MMO.json",
      edition: "ArtifactRune_MMO",
      isSecondary: true,
      modeScope: "mmo"
    },
    {
      file: path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable_MMO", "cooking", "CookingFoodDataTable_MMO.json"),
      altFile: path.join(rawDir, "CookingFoodDataTable_MMO.json"),
      name: "CookingFoodDataTable_MMO.json",
      edition: "CookingFood_MMO",
      isSecondary: true,
      modeScope: "mmo"
    }
  ];

  const stItemOverseaFile = path.join(rawDir, "Hotta", "Content", "Resources", "Text", "Oversea", "ST_Item_Oversea.json");
  const stItemFile = path.join(rawDir, "Hotta", "Content", "Resources", "Text", "ST_item.json");
  const stItemMmoFile = [
    path.join(rawDir, "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable_MMO", "StringTable", "ST_Item_MMO.json"),
    path.join(rawDir, "ST_Item_MMO.json")
  ].find((p) => fs.existsSync(p));
  const stLockhartFile = [
    path.join(rawDir, "Hotta", "Content", "Resources", "Text", "LockhartRune.json"),
    path.join(rawDir, "LockhartRune.json")
  ].find((p) => fs.existsSync(p));

  const stOversea = fs.existsSync(stItemOverseaFile) ? (readJsonFile(stItemOverseaFile)?.[0]?.StringTable?.KeysToEntries || {}) : {};
  const stItem = fs.existsSync(stItemFile) ? (readJsonFile(stItemFile)?.[0]?.StringTable?.KeysToEntries || {}) : {};
  const stMmo = stItemMmoFile ? (readJsonFile(stItemMmoFile)?.[0]?.StringTable?.KeysToEntries || {}) : {};
  const stLockhart = stLockhartFile ? (readJsonFile(stLockhartFile)?.[0]?.StringTable?.KeysToEntries || {}) : {};

  for (const src of candidates) {
    const filePath = fs.existsSync(src.file) ? src.file : (fs.existsSync(src.altFile) ? src.altFile : null);
    if (!filePath) {
      sourceReports.push({
        source: src.name,
        edition: src.edition,
        status: "missing",
        rowCount: 0,
        uniqueIds: 0,
        collisions: 0,
        iconReferences: 0,
        iconsResolved: 0,
        unresolvedIcons: 0,
        descJoined: 0
      });
      continue;
    }

    const raw = readJsonFile(filePath);
    let rows = raw?.[0]?.Rows || raw?.Rows || raw;
    if (!rows || typeof rows !== "object") {
      sourceReports.push({
        source: src.name,
        edition: src.edition,
        status: "invalid",
        rowCount: 0,
        uniqueIds: 0,
        collisions: 0,
        iconReferences: 0,
        iconsResolved: 0,
        unresolvedIcons: 0,
        descJoined: 0
      });
      continue;
    }

    if (src.name === "DT_ArtifactRuneSparItemConfig_MMO.json") {
      const transformedRows: Record<string, any> = {};
      const slotIconMap = new Map<any, any>();
      const fc = rows["FilterConfig"] || {};
      if (Array.isArray(fc.SlotIconMap)) {
        fc.SlotIconMap.forEach((item) => {
          slotIconMap.set(String(item.Key), item.Value?.AssetPathName || item.Value);
        });
      }

      for (const [k, v] of Object.entries(rows)) {
        if (k !== "FilterConfig") {
          transformedRows[k] = {
            ItemIcon: v.ItemIcon || "/Game/Resources/UI/SteampunkMarket/Shop/ZhuanBei/img/qiege/Icon_CoreRaw_LV0.Icon_CoreRaw_LV0",
            ItemName: {
              TableId: "/Game/Resources/Text/ST_item.ST_Item",
              Key: `${k}_name`,
              SourceString: stItem[`${k}_name`] || "",
              LocalizedString: stItem[`${k}_name`] || ""
            },
            Description: {
              TableId: "/Game/Resources/Text/ST_item.ST_Item",
              Key: `${k}_des`,
              SourceString: stItem[`${k}_des`] || "",
              LocalizedString: stItem[`${k}_des`] || ""
            },
            ItemQuality: v.ItemQuality || "ITEM_QUALITY_RARE"
          };
        }
        if (Array.isArray(v.SparItemIDList)) {
          v.SparItemIDList.forEach((sparItem) => {
            if (!sparItem.RuneItemID || transformedRows[sparItem.RuneItemID]) return;
            const runeId = sparItem.RuneItemID;
            const match = runeId.match(/^(Rune_S\d+_[A-Za-z]+)_\d+$/);
            const prefix = match ? match[1] : runeId;
            const season = runeId.startsWith("Rune_S1") ? "Rune_S1" : "Rune_S2";
            const nameKey = `${prefix}_name`;
            const descKey = `${season}_des`;
            const rawIcon = slotIconMap.get(String(sparItem.SlolCoreIndex));

            transformedRows[runeId] = {
              ItemIcon: rawIcon,
              ItemName: {
                TableId: "/Game/Resources/Text/LockhartRune.LockhartRune",
                Namespace: "LockhartRune",
                Key: nameKey,
                SourceString: stLockhart[nameKey] || "",
                LocalizedString: stLockhart[nameKey] || ""
              },
              Description: {
                TableId: "/Game/Resources/Text/LockhartRune.LockhartRune",
                Namespace: "LockhartRune",
                Key: descKey,
                SourceString: stLockhart[descKey] || "",
                LocalizedString: stLockhart[descKey] || ""
              },
              ItemQuality: sparItem.Quality
            };
          });
        }
      }
      rows = transformedRows;
    }

    const rowCount = Object.keys(rows).length;
    let uniqueIds = 0;
    let collisions = 0;
    let iconReferences = 0;
    let iconsResolved = 0;
    let unresolvedIcons = 0;
    let descJoined = 0;

    for (const [itemId, row] of Object.entries(rows)) {
      const id = itemId.trim();
      if (!id) continue;

      const isExisting = lookup.has(id);
      if (isExisting) {
        collisions++;
      } else {
        uniqueIds++;
      }

      let iconUrl = null;
      const rawIcon = row.ItemIcon?.AssetPathName || (typeof row.ItemIcon === "string" ? row.ItemIcon : null);
      if (rawIcon && rawIcon !== "None") {
        iconReferences++;
        if (copier && typeof copier.copyAsset === "function") {
          iconUrl = copier.copyAsset("items", rawIcon, "icons");
        } else {
          iconUrl = rawIcon;
        }
        if (iconUrl) {
          iconsResolved++;
        } else {
          unresolvedIcons++;
        }
      } else if (rawIcon === "None") {
        iconReferences++;
        unresolvedIcons++;
      }

      let description_en = "";
      let description_ru = "";
      const defaultDescNs = (row.Description?.Namespace || (row.Description?.TableId && row.Description.TableId.includes("LockhartRune")))
        ? "LockhartRune"
        : "Item";

      if (locResolver) {
        description_en = cleanHtmlTags(
          locResolver.resolve(row.Description, {
            locale: "en",
            defaultNamespace: defaultDescNs,
            fallbackSourceRow: row
          }).text || ""
        );
        description_ru = cleanHtmlTags(
          locResolver.resolve(row.Description, {
            locale: "ru",
            fallbackLocale: "en",
            defaultNamespace: defaultDescNs,
            fallbackSourceRow: row
          }).text || description_en
        );
      } else {
        const descKey = row.Description?.Key;
        if (descKey) {
          if (enGame && enGame[descKey]) description_en = cleanHtmlTags(enGame[descKey]);
          else if (stOversea[descKey]) description_en = cleanHtmlTags(stOversea[descKey]);
          else if (stItem[descKey]) description_en = cleanHtmlTags(stItem[descKey]);
          else if (stMmo[descKey]) description_en = cleanHtmlTags(stMmo[descKey]);
          else if (stLockhart[descKey]) description_en = cleanHtmlTags(stLockhart[descKey]);

          if (ruGame && ruGame[descKey]) description_ru = cleanHtmlTags(ruGame[descKey]);
        }
      }

      if (!description_en && stOversea[`${id}_des`]) {
        description_en = cleanHtmlTags(stOversea[`${id}_des`]);
      }
      if (!description_en && stMmo[`${id}_des`]) {
        description_en = cleanHtmlTags(stMmo[`${id}_des`]);
      }
      if (!description_ru && ruGame && ruGame[`${id}_des`]) {
        description_ru = cleanHtmlTags(ruGame[`${id}_des`]);
      }

      if (!description_en && row.Description?.LocalizedString && !/[一-龥]/.test(row.Description.LocalizedString)) {
        description_en = cleanHtmlTags(row.Description.LocalizedString);
      }
      if (!description_en && row.Description?.SourceString && !/[一-龥]/.test(row.Description.SourceString)) {
        description_en = cleanHtmlTags(row.Description.SourceString);
      }

      if (description_en || description_ru) descJoined++;

      let rawName = row.ItemName?.LocalizedString || row.ItemName?.SourceString || "";
      const quality = row.ItemQuality || "";

      let name_en = "";
      let name_ru = "";
      const defaultNameNs = (row.ItemName?.Namespace || (row.ItemName?.TableId && row.ItemName.TableId.includes("LockhartRune")))
        ? "LockhartRune"
        : "Item";

      if (locResolver && row.ItemName) {
        name_en = cleanItemName(
          locResolver.resolve(row.ItemName, {
            locale: "en",
            defaultNamespace: defaultNameNs,
            fallbackSourceRow: row
          }).text || ""
        );
        name_ru = cleanItemName(
          locResolver.resolve(row.ItemName, {
            locale: "ru",
            fallbackLocale: "en",
            defaultNamespace: defaultNameNs,
            fallbackSourceRow: row
          }).text || name_en
        );
      }

      // Edge case: mmo_frag_imitation_fashion_17_2_w
      if (!rawName && id === "mmo_frag_imitation_fashion_17_2_w") {
        rawName = "纯真荡漾·武器";
        name_en = "Pure Ripple Weapon Skin";
        name_ru = "Чистая рябь (Оружие)";
        description_en = description_en || "High-grade Simulacrum Haute Couture Shards";
        description_ru = description_ru || "Осколки высокой моды симулякра";
      }

      const scope = src.modeScope || (src.isSecondary ? "mmo" : "general");

      if (src.isSecondary) {
        if (isExisting) {
          const existing = lookup.get(id);
          lookup.set(id, {
            icon: existing.icon || iconUrl || null,
            description_en: existing.description_en || description_en || "",
            description_ru: existing.description_ru || description_ru || "",
            quality: existing.quality || quality || "",
            rawName: existing.rawName || rawName || "",
            name_en: existing.name_en || name_en || "",
            name_ru: existing.name_ru || name_ru || "",
            mode_scope: existing.mode_scope || scope
          });
        } else {
          lookup.set(id, {
            icon: iconUrl || null,
            description_en: description_en || "",
            description_ru: description_ru || "",
            quality: quality || "",
            rawName: rawName || "",
            name_en: name_en || "",
            name_ru: name_ru || "",
            mode_scope: scope
          });
        }
      } else {
        const existing = lookup.get(id);
        lookup.set(id, {
          icon: iconUrl || existing?.icon || null,
          description_en: description_en || existing?.description_en || "",
          description_ru: description_ru || existing?.description_ru || "",
          quality: quality || existing?.quality || "",
          rawName: rawName || existing?.rawName || "",
          name_en: name_en || existing?.name_en || "",
          name_ru: name_ru || existing?.name_ru || "",
          mode_scope: "general"
        });
      }
    }

    sourceReports.push({
      source: src.name,
      edition: src.edition,
      status: "consumed",
      rowCount,
      uniqueIds,
      collisions,
      iconReferences,
      iconsResolved,
      unresolvedIcons,
      descJoined
    });
  }

  return { lookup, sourceReports };
}

function processGachaItems(rawDir, targetFile, projectRoot, fallbackTargetFile, itemConfigsLookup) {
  console.log(`\n[items-gacha] Processing Gacha items from: ${rawDir}`);

  // 1. Direct Config mapping files (MappingItemId.json, etc.)
  // MappingItemId*.json ship in the client's Hotta/Config, not in .pak files; exporter runs on an
  // unpacked tree pass that folder through TOF_ITEM_MAPPING_DIR.
  const mappingDir = !fs.existsSync(path.join(rawDir, "MappingItemId.json")) && process.env.TOF_ITEM_MAPPING_DIR
    ? process.env.TOF_ITEM_MAPPING_DIR : rawDir;
  const mappingIdFile = path.join(mappingDir, "MappingItemId.json");
  const mappingNameFile = path.join(mappingDir, "MappingItemIdAndName.json");
  const mappingColorFile = path.join(mappingDir, "MappingItemIdAndColor.json");

  // 2. Nested / standalone Oversea string table export
  const stItemOverseaFile = path.join(
    rawDir,
    "Hotta",
    "Content",
    "Resources",
    "Text",
    "Oversea",
    "ST_Item_Oversea.json"
  );
  const stItemOverseaAlt = path.join(rawDir, "ST_Item_Oversea.json");

  // The Oversea string table alone covers only a few hundred rows; publishing it would silently
  // replace the full item catalog with a fragment.
  if (!fs.existsSync(mappingIdFile)) {
    throw new Error(
      `[required] MappingItemId.json not found in ${mappingDir}. Copy it from <game>/Client/WindowsNoEditor/Hotta/Config ` +
      `or pass the game folder (--game-path); no item output was published.`
    );
  }

  // Load curated renames (strictly keyed by string item ID)
  const root = projectRoot || path.resolve(__dirname, "../..");
  const curatedFile = path.join(root, "datamine", "items", "curated", "gacha-overrides.json");
  const renameMap = extractCuratedRenames(curatedFile, targetFile, fallbackTargetFile);
  const authoritativeNameMap = extractCuratedNames(curatedFile);
  const translationFile = path.join(root, "datamine", "items", "curated", "gacha-translations.json");
  const translationMap = readTranslationMap(translationFile);
  const nameResolver = createNameResolver(authoritativeNameMap, translationMap);

  const lookup = itemConfigsLookup instanceof Map
    ? itemConfigsLookup
    : (itemConfigsLookup?.lookup || new Map<any, any>());

  const developerRows = [];
  const seenDevNums = new Set<any>();
  const seenDevIds = new Set<any>();
  let devDuplicates = 0;

  // 1. Primary Developer Mapping from MappingItemId.json (Authoritative first list)
  if (fs.existsSync(mappingIdFile)) {
    console.log(`[items-gacha] Found MappingItemId config files.`);
    const idMap = readJsonFile(mappingIdFile);
    if (!idMap || typeof idMap !== "object" || Array.isArray(idMap)) {
      throw new Error(`[invalid] MappingItemId.json must be a valid JSON object.`);
    }

    const nameMap = readJsonFile(mappingNameFile) || {};
    const colorMap = readJsonFile(mappingColorFile) || {};

    for (const [keyName, rawNumId] of Object.entries(idMap)) {
      const id = String(keyName).trim();
      if (!id) continue;

      const num = Number(rawNumId);
      if (!Number.isInteger(num) || num <= 0) continue;

      if (seenDevNums.has(num)) {
        throw new Error(
          `[invalid] Duplicate developer numeric ID ${num} encountered in MappingItemId.json for item "${id}".`
        );
      }
      if (seenDevIds.has(id)) {
        devDuplicates++;
        throw new Error(
          `[invalid] Duplicate item identifier "${id}" encountered in MappingItemId.json.`
        );
      }

      seenDevNums.add(num);
      seenDevIds.add(id);

      const numStr = String(num);
      const original = String(nameMap[numStr] || "").trim();
      const quality = String(colorMap[numStr] || "").trim();
      const rename = renameMap.get(id) || "";
      const config = lookup.get(id);

      developerRows.push({
        num,
        id,
        name: nameResolver.resolve(id),
        original: original || config?.rawName || "",
        rename,
        ...(quality ? { quality } : (config?.quality ? { quality: config.quality } : {})),
        ...(config?.icon ? { icon: config.icon } : {}),
        ...(config?.description_en ? { description_en: config.description_en } : {}),
        ...(config?.description_ru ? { description_ru: config.description_ru } : {})
      });
    }

    developerRows.sort((a, b) => a.num - b.num);
  }

  // Developer max NUM calculation (deterministic ceiling)
  let maxDeveloperId = developerRows.reduce((m, r) => Math.max(m, r.num), 0);

  // 2. Supplemental Items from ST_Item_Oversea.json
  const overseaFile = fs.existsSync(stItemOverseaFile)
    ? stItemOverseaFile
    : fs.existsSync(stItemOverseaAlt)
    ? stItemOverseaAlt
    : null;

  const supplementalRows = [];

  if (overseaFile) {
    console.log(`[items-gacha] Also checking supplemental string table: ${overseaFile}`);
    const rawOversea = readJsonFile(overseaFile);
    const table = Array.isArray(rawOversea)
      ? rawOversea[0]?.StringTable?.KeysToEntries
      : rawOversea?.StringTable?.KeysToEntries;

    if (table && typeof table === "object") {
      const candidates = [];
      for (const [key, value] of Object.entries(table)) {
        const match = key.match(/^(.*)_name$/);
        if (!match) continue;

        const id = match[1].trim();
        const original = String(value || "").trim();
        if (!id || !original) continue;

        if (seenDevIds.has(id)) {
          const existingDevRow = developerRows.find((r) => r.id === id);
          if (existingDevRow && !existingDevRow.original) {
            existingDevRow.original = original;
          }
          continue;
        }

        seenDevIds.add(id);
        candidates.push({ id, original });
      }

      candidates.sort((a, b) => a.id.localeCompare(b.id, "en"));

      for (const item of candidates) {
        const num = ++maxDeveloperId;
        const config = lookup.get(item.id);
        supplementalRows.push({
          num,
          id: item.id,
          name: nameResolver.resolve(item.id),
          original: item.original,
          rename: renameMap.get(item.id) || "",
          ...(config?.quality ? { quality: config.quality } : {}),
          ...(config?.icon ? { icon: config.icon } : {}),
          ...(config?.description_en ? { description_en: config.description_en } : {}),
          ...(config?.description_ru ? { description_ru: config.description_ru } : {})
        });
      }
    }
  }

  const finalRows = [...developerRows, ...supplementalRows];

  if (finalRows.length === 0) {
    throw new Error(`[required] Gacha item processing produced zero rows from ${rawDir}.`);
  }

  const payload: Record<string, any> = {};
  finalRows.forEach((row) => {
    payload[String(row.num)] = {
      id: row.id,
      name: row.name || "",
      original: row.original || "",
      rename: row.rename || "",
      ...(row.quality ? { quality: row.quality } : {}),
      ...(row.icon ? { icon: row.icon } : {}),
      ...(row.description_en ? { description_en: row.description_en } : {}),
      ...(row.description_ru ? { description_ru: row.description_ru } : {})
    };
  });

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `[items-gacha] Saved ${finalRows.length} items (${developerRows.length} dev + ${supplementalRows.length} oversea) to ${targetFile}`
  );

  const nameStats = nameResolver.stats();
  console.log(
    `[items-gacha] Names: ${nameStats.translationsApplied} translated, ${nameStats.authoritativeNamesPreserved} authoritative, ${nameStats.translationEntriesUnused} translation entries unused`
  );

  return {
    total: finalRows.length,
    developerCount: developerRows.length,
    supplementalCount: supplementalRows.length,
    maxDeveloperId,
    duplicateCount: devDuplicates,
    ...nameStats
  };
}

function processMmoItems(rawDir, targetFile, projectRoot, fallbackTargetFile, itemConfigsLookup) {
  console.log(`\n[items-mmo] Processing MMO items from: ${rawDir}`);

  const stItemMmoFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable_MMO",
      "StringTable",
      "ST_Item_MMO.json"
    ),
    path.join(rawDir, "ST_Item_MMO.json")
  ].find((p) => fs.existsSync(p));

  const cookingFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable_MMO",
      "cooking",
      "CookingFoodDataTable_MMO.json"
    ),
    path.join(rawDir, "CookingFoodDataTable_MMO.json")
  ].find((p) => fs.existsSync(p));

  const lifeJobHarvestFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable_MMO",
      "LifeJob",
      "DT_LifeJob_HarvestableItems.json"
    ),
    path.join(rawDir, "DT_LifeJob_HarvestableItems.json")
  ].find((p) => fs.existsSync(p));

  const lifeJobCraftFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable_MMO",
      "LifeJob",
      "DT_LifeJobCraftingConfig.json"
    ),
    path.join(rawDir, "DT_LifeJobCraftingConfig.json")
  ].find((p) => fs.existsSync(p));

  const runeSparFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "SteampunkMarket",
      "Shop",
      "DT_ArtifactRuneSparItemConfig_MMO.json"
    ),
    path.join(rawDir, "raw_exports", "Hotta", "Content", "Resources", "CoreBlueprints", "SteampunkMarket", "Shop", "DT_ArtifactRuneSparItemConfig_MMO.json"),
    path.join(rawDir, "DT_ArtifactRuneSparItemConfig_MMO.json")
  ].find((p) => fs.existsSync(p));

  const corralFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable_MMO",
      "TamingMonster",
      "CorralMonsterItemConfigDataTable_MMO.json"
    ),
    path.join(rawDir, "raw_exports", "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable_MMO", "TamingMonster", "CorralMonsterItemConfigDataTable_MMO.json"),
    path.join(rawDir, "CorralMonsterItemConfigDataTable_MMO.json")
  ].find((p) => fs.existsSync(p));

  const equipmentFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable_MMO",
      "EquipmentDataTable_MMO.json"
    ),
    path.join(rawDir, "raw_exports", "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable_MMO", "EquipmentDataTable_MMO.json"),
    path.join(rawDir, "EquipmentDataTable_MMO.json")
  ].find((p) => fs.existsSync(p));

  const cookRecipesFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable_MMO",
      "cooking",
      "CookRecipesDataTable_MMO.json"
    ),
    path.join(rawDir, "raw_exports", "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable_MMO", "cooking", "CookRecipesDataTable_MMO.json"),
    path.join(rawDir, "CookRecipesDataTable_MMO.json")
  ].find((p) => fs.existsSync(p));

  const itemConfigsFile = [
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable",
      "Item",
      "ItemConfigs.json"
    ),
    path.join(rawDir, "raw_exports", "Hotta", "Content", "Resources", "CoreBlueprints", "DataTable", "Item", "ItemConfigs.json"),
    path.join(rawDir, "ItemConfigs.json")
  ].find((p) => fs.existsSync(p));

  const hasAnyMmoSource = Boolean(
    stItemMmoFile || cookingFile || cookRecipesFile || runeSparFile || corralFile || equipmentFile || lifeJobHarvestFile || lifeJobCraftFile || itemConfigsFile
  );

  if (!hasAnyMmoSource) {
    const existingFile = [fallbackTargetFile, targetFile].find((p) => p && fs.existsSync(p));
    if (existingFile) {
      console.log(
        `[items-mmo] No MMO source tables found in ${rawDir}; preserved existing ${existingFile}`
      );
      return { total: 0, preserved: true };
    }
    throw new Error(
      `[required] No MMO item source files found in ${rawDir} and no target file exists.`
    );
  }

  const root = projectRoot || path.resolve(__dirname, "../..");
  const curatedFile = path.join(root, "datamine", "items", "curated", "mmo-overrides.json");
  const renameMap = extractCuratedRenames(curatedFile, targetFile, fallbackTargetFile);
  const authoritativeNameMap = extractCuratedNames(curatedFile);
  const translationFile = path.join(root, "datamine", "items", "curated", "mmo-translations.json");
  const translationMap = readTranslationMap(translationFile);
  const nameResolver = createNameResolver(authoritativeNameMap, translationMap);

  const lookup = itemConfigsLookup instanceof Map
    ? itemConfigsLookup
    : (itemConfigsLookup?.lookup || new Map<any, any>());

  const primaryMap = new Map<any, any>();
  const seenIds = new Set<any>();

  // 1. Primary ST_Item_MMO
  if (stItemMmoFile) {
    const raw = readJsonFile(stItemMmoFile);
    const table = Array.isArray(raw)
      ? raw[0]?.StringTable?.KeysToEntries
      : raw?.StringTable?.KeysToEntries;

    if (table && typeof table === "object") {
      for (const [key, value] of Object.entries(table)) {
        const match = key.match(/^(.*)_name$/);
        if (!match) continue;

        const id = match[1].trim();
        const original = String(value || "").trim();
        if (!id || !original) continue;

        const config = lookup.get(id);
        seenIds.add(id);

        const resolvedName = nameResolver.resolve(id, config?.name_en || "");
        primaryMap.set(id, {
          id,
          name: resolvedName || "",
          original: original || config?.rawName || "",
          rename: renameMap.get(id) || "",
          ...(config?.quality ? { quality: config.quality } : {}),
          ...(config?.icon ? { icon: config.icon } : {}),
          ...(config?.description_en ? { description_en: config.description_en } : (table[`${id}_des`] ? { description_en: table[`${id}_des`] } : {})),
          ...(config?.description_ru ? { description_ru: config.description_ru } : {})
        });
      }
    }
  }

  // 2. Secondary items
  const secondaryMap = new Map<any, any>();

  function addSecondaryItem(id, fallbackOriginal = "") {
    if (!id || typeof id !== "string") return;
    const cleanId = id.trim();
    if (!cleanId || seenIds.has(cleanId)) return;
    seenIds.add(cleanId);

    const config = lookup.get(cleanId);
    const resolvedOriginal = config?.rawName || fallbackOriginal || "";
    const resolvedName = nameResolver.resolve(cleanId, config?.name_en || "");

    secondaryMap.set(cleanId, {
      id: cleanId,
      name: resolvedName || "",
      original: resolvedOriginal || "",
      rename: renameMap.get(cleanId) || "",
      ...(config?.quality ? { quality: config.quality } : {}),
      ...(config?.icon ? { icon: config.icon } : {}),
      ...(config?.description_en ? { description_en: config.description_en } : {}),
      ...(config?.description_ru ? { description_ru: config.description_ru } : {})
    });
  }

  // Runes and Spars from DT_ArtifactRuneSparItemConfig_MMO.json
  if (runeSparFile) {
    const raw = readJsonFile(runeSparFile);
    const rows = Array.isArray(raw) ? raw[0]?.Rows : raw?.Rows;
    if (rows && typeof rows === "object") {
      for (const [k, v] of Object.entries(rows)) {
        if (k !== "FilterConfig") {
          addSecondaryItem(k);
        }
        if (Array.isArray(v?.SparItemIDList)) {
          v.SparItemIDList.forEach((sparItem) => {
            if (sparItem?.RuneItemID) {
              addSecondaryItem(sparItem.RuneItemID);
            }
          });
        }
      }
    }
  }

  // Corral Monsters from CorralMonsterItemConfigDataTable_MMO.json
  if (corralFile) {
    const raw = readJsonFile(corralFile);
    const rows = Array.isArray(raw) ? raw[0]?.Rows : raw?.Rows;
    if (rows && typeof rows === "object") {
      for (const [id, row] of Object.entries(rows)) {
        addSecondaryItem(id, row?.ItemName?.SourceString || row?.ItemName?.LocalizedString);
      }
    }
  }

  // Equipment from EquipmentDataTable_MMO.json
  if (equipmentFile) {
    const raw = readJsonFile(equipmentFile);
    const rows = Array.isArray(raw) ? raw[0]?.Rows : raw?.Rows;
    if (rows && typeof rows === "object") {
      for (const [id, row] of Object.entries(rows)) {
        addSecondaryItem(id, row?.ItemName?.SourceString || row?.ItemName?.LocalizedString);
      }
    }
  }

  // Cooking Food from CookingFoodDataTable_MMO.json
  if (cookingFile) {
    const raw = readJsonFile(cookingFile);
    const rows = Array.isArray(raw) ? raw[0]?.Rows : raw?.Rows;
    if (rows && typeof rows === "object") {
      for (const [id, row] of Object.entries(rows)) {
        addSecondaryItem(id, row?.ItemName?.SourceString || row?.ItemName?.LocalizedString);
      }
    }
  }

  // Cooking Recipes from CookRecipesDataTable_MMO.json
  if (cookRecipesFile) {
    const raw = readJsonFile(cookRecipesFile);
    const rows = Array.isArray(raw) ? raw[0]?.Rows : raw?.Rows;
    if (rows && typeof rows === "object") {
      for (const [k, row] of Object.entries(rows)) {
        if (row?.FoodItemID && row.FoodItemID !== "None") {
          addSecondaryItem(row.FoodItemID);
        }
        if (lookup.has(`Recipe_${k}`)) {
          addSecondaryItem(`Recipe_${k}`);
        }
        if (lookup.has(k)) {
          addSecondaryItem(k);
        }
      }
    }
  }

  // LifeJob Harvest & Craft
  for (const filePath of [lifeJobHarvestFile, lifeJobCraftFile].filter(Boolean)) {
    const raw = readJsonFile(filePath);
    const rows = Array.isArray(raw) ? raw[0]?.Rows : raw?.Rows;
    if (rows && typeof rows === "object") {
      for (const [, row] of Object.entries(rows)) {
        const candidateKeys = [row?.ItemName?.Key, row?.HarvestableName?.Key];
        for (const candidate of candidateKeys) {
          const match =
            typeof candidate === "string" ? candidate.match(/^(.*)_name$/) : null;
          if (!match) continue;
          addSecondaryItem(match[1].trim());
          break;
        }
      }
    }
  }

  // ItemConfigs MMO Items
  if (itemConfigsFile) {
    const raw = readJsonFile(itemConfigsFile);
    const rows = Array.isArray(raw) ? raw[0]?.Rows : raw?.Rows;
    if (rows && typeof rows === "object") {
      for (const [id, row] of Object.entries(rows)) {
        const mode = String(row?.AvailableServerMode || "");
        const isMmo =
          mode.includes("MMO") ||
          id.toLowerCase().startsWith("mmo_") ||
          id.toLowerCase().includes("_mmo");
        if (isMmo) {
          addSecondaryItem(id, row?.ItemName?.SourceString || row?.ItemName?.LocalizedString);
        }
      }
    }
  }

  const primaryRows = Array.from(primaryMap.values()).sort((a, b) =>
    a.id.localeCompare(b.id, "en")
  );
  const secondaryRows = Array.from(secondaryMap.values()).sort((a, b) =>
    a.id.localeCompare(b.id, "en")
  );
  const finalRows = [...primaryRows, ...secondaryRows];

  if (finalRows.length === 0) {
    throw new Error(`[required] MMO item processing produced zero rows from ${rawDir}.`);
  }

  const payload: Record<string, any> = {};
  finalRows.forEach((row, index) => {
    payload[String(index + 1)] = {
      id: row.id,
      name: row.name || "",
      original: row.original || "",
      rename: row.rename || "",
      ...(row.quality ? { quality: row.quality } : {}),
      ...(row.icon ? { icon: row.icon } : {}),
      ...(row.description_en ? { description_en: row.description_en } : {}),
      ...(row.description_ru ? { description_ru: row.description_ru } : {})
    };
  });

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `[items-mmo] Saved ${finalRows.length} items (${primaryRows.length} primary + ${secondaryRows.length} secondary) to ${targetFile}`
  );

  const nameStats = nameResolver.stats();
  console.log(
    `[items-mmo] Names: ${nameStats.translationsApplied} translated, ${nameStats.authoritativeNamesPreserved} authoritative, ${nameStats.translationEntriesUnused} translation entries unused`
  );

  return {
    total: finalRows.length,
    primaryCount: primaryRows.length,
    secondaryCount: secondaryRows.length,
    preserved: false,
    ...nameStats
  };
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

function main() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);

  const gachaTarget = path.join(
    projectRoot,
    "datamine",
    "items",
    "data",
    "merged_mapping_with_original.json"
  );
  const mmoTarget = path.join(
    projectRoot,
    "datamine",
    "items",
    "data",
    "merged_mapping_with_original_mmo.json"
  );

  const enGameFile = path.join(rawDir, "Hotta", "Content", "Localization", "Game", "en", "Game.json");
  const ruGameFile = path.join(rawDir, "Hotta", "Content", "Localization", "Game", "ru", "Game.json");
  const enGame = fs.existsSync(enGameFile) ? flattenLoc(readJsonFile(enGameFile)) : {};
  const ruGame = fs.existsSync(ruGameFile) ? flattenLoc(readJsonFile(ruGameFile)) : {};

  const locResolver = createLocalizationResolver();
  if (fs.existsSync(enGameFile)) locResolver.loadLocale("en", readJsonFile(enGameFile));
  if (fs.existsSync(ruGameFile)) locResolver.loadLocale("ru", readJsonFile(ruGameFile));

  const copier = new ImageCopier(rawDir, projectRoot);
  const { lookup, sourceReports } = buildItemConfigsLookup(rawDir, copier, enGame, ruGame, locResolver);

  console.log("\n=================== ITEMS SOURCE BUILD REPORT ===================");
  console.table(sourceReports);

  const isMmoOnly = process.argv.includes("--mmo-only");
  const token = `.stage3-${process.pid}-${Date.now()}`;
  const gachaTemp = `${gachaTarget}${token}`;
  const mmoTemp = `${mmoTarget}${token}`;
  try {
    let gachaResult = null;
    if (!isMmoOnly) {
      gachaResult = processGachaItems(rawDir, gachaTemp, projectRoot, gachaTarget, lookup);
      fs.mkdirSync(path.dirname(gachaTarget), { recursive: true });
      fs.renameSync(gachaTemp, gachaTarget);
    }

    const mmoResult = processMmoItems(rawDir, mmoTemp, projectRoot, mmoTarget, lookup);
    if (!mmoResult.preserved && fs.existsSync(mmoTemp)) {
      fs.renameSync(mmoTemp, mmoTarget);
    }

    console.log("=================================================================\n");
    return { gachaResult, mmoResult, sourceReports };
  } finally {
    fs.rmSync(gachaTemp, { force: true });
    fs.rmSync(mmoTemp, { force: true });
  }
}

if (require.main === module) {
  main();
}

export {
  buildItemConfigsLookup,
  cleanItemName,
  createNameResolver,
  flattenLoc,
  processGachaItems,
  processMmoItems,
  readTranslationMap,
};
