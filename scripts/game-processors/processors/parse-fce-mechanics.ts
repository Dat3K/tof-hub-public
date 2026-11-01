import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = readGameSourceFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return JSON.parse(raw);
}

function resolveRawDir(projectRoot) {
  const customArg = process.argv.find((arg) => arg.startsWith("--raw-dir="));
  if (customArg) {
    return path.resolve(customArg.split("=")[1]);
  }

  const candidateDirs = [
    path.join(projectRoot, "raw_exports"),
    path.join(projectRoot, "datamine-pipeline", "raw_exports"),
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

function isNonCombatKey(key) {
  const lower = key.toLowerCase();
  return (
    lower.startsWith("awardshop_") ||
    lower.startsWith("item_") ||
    lower.startsWith("mail_") ||
    lower.includes("activity_award") ||
    lower.includes("activity_time") ||
    lower.includes("bosscoin")
  );
}

function extractMatchingBossEntries(data) {
  const results: Record<string, any> = {};
  const bossPattern = /boss.*des/i;
  const numberPattern = /_[0-5]_|_0[0-5]_|_[0-5]_des$|_\d+_[0-5]_/i;

  function recursiveScan(obj) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        recursiveScan(item);
      }
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          if (bossPattern.test(key) && numberPattern.test(key)) {
            if (!isNonCombatKey(key)) {
              const cleanText = value.replace(/\r\n/g, "\n").trim();
              if (cleanText) {
                results[key] = cleanText;
              }
            }
          }
        } else if (typeof value === "object") {
          recursiveScan(value);
        }
      }
    }
  }

  recursiveScan(data);
  return results;
}

function extractBossNumber(str) {
  if (!str) return null;
  const match = str.match(/boss(?:_hum)?_?0*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseBossKeyFamily(key) {
  const num = extractBossNumber(key);
  const bossId = num !== null ? `boss_${String(num).padStart(3, "0")}` : "other_boss";

  const numMatch = key.match(/_0?([1-5])_/);
  const phaseIndex = numMatch ? String(parseInt(numMatch[1], 10)) : "1";

  return {
    bossNum: num,
    bossId,
    phaseIndex
  };
}

function keyPriority(key) {
  const k = key.toLowerCase();
  if (k.startsWith("boss_hum_") || k.startsWith("boss_")) return 1;
  if (k.startsWith("buff_boss_")) return 2;
  if (k.startsWith("ge_")) return 3;
  if (k.startsWith("breakfate_boss_")) return 4;
  return 5;
}

function groupMechanicsByBoss(entries) {
  const grouped: Record<string, any> = {};

  for (const [key, text] of Object.entries(entries)) {
    const { bossNum, bossId, phaseIndex } = parseBossKeyFamily(key);

    if (!grouped[bossId]) {
      grouped[bossId] = {
        bossId,
        bossNum,
        keys: [],
        mechanics: {}
      };
    }

    grouped[bossId].keys.push(key);

    if (!grouped[bossId].mechanics[phaseIndex]) {
      grouped[bossId].mechanics[phaseIndex] = [];
    }
    grouped[bossId].mechanics[phaseIndex].push({
      key,
      text
    });
  }

  // Prioritize primary combat mechanic keys within each phase
  for (const group of Object.values(grouped)) {
    for (const phaseIndex of Object.keys(group.mechanics)) {
      group.mechanics[phaseIndex].sort((a, b) => keyPriority(a.key) - keyPriority(b.key));
    }
  }

  return grouped;
}

function findFirstFile(rawDir, relativePaths) {
  return relativePaths
    .map((relativePath) => path.join(rawDir, relativePath))
    .find((filePath) => fs.existsSync(filePath));
}

function readRows(filePath) {
  const data = filePath ? readJsonFile(filePath) : null;
  if (!data) return {};
  return (Array.isArray(data) ? data[0]?.Rows : data.Rows) || data.Rows || {};
}

function assetPathToExportedPng(assetPath) {
  if (!assetPath || assetPath === "None") return "";
  const packagePath = assetPath.split(".")[0].replace(/^\/Game\//, "Hotta/Content/");
  return `${packagePath}.png`;
}

function loadFceBossCatalog(rawDir) {
  const sourceFile = findFirstFile(rawDir, [
    "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/VoidCloneBossConfigDataTable_Overseas.json",
    "Hotta/Content/Resources/CoreBlueprints/DataTable/VoidClone/VoidCloneBossConfigDataTable.json",
    "VoidCloneBossConfigDataTable_Overseas.json",
    "VoidCloneBossConfigDataTable.json"
  ]);
  const rows = readRows(sourceFile);

  const bosses = Object.entries(rows).map(([configId, row], index) => {
    const nameKey = row?.BossNameText?.Key || "";
    return {
      order: index + 1,
      configId,
      bossId: nameKey,
      bossNum: extractBossNumber(nameKey),
      sourceName: row?.BossNameText?.LocalizedString || row?.BossNameText?.SourceString || "",
      image: assetPathToExportedPng(row?.BossImage?.AssetPathName),
      imageMain: assetPathToExportedPng(row?.BossImageMain?.AssetPathName)
    };
  });

  return {
    sourceFile: sourceFile ? path.relative(rawDir, sourceFile).replace(/\\/g, "/") : "",
    bosses
  };
}

function formatMechanics(group, localizedGroup) {
  if (!group || !group.mechanics) return [];
  return Object.keys(group.mechanics)
    .sort((a, b) => Number(a) - Number(b))
    .map((index) => {
      const primaryEntry = group.mechanics[index][0];
      const localizedEntry = localizedGroup?.mechanics?.[index]?.[0];
      return {
        index,
        key: primaryEntry.key,
        en: primaryEntry.text,
        ru: localizedEntry ? localizedEntry.text : ""
      };
    });
}

function sortBossesDeterministically(list) {
  return list.slice().sort((a, b) => {
    if (a.bossNum !== null && b.bossNum !== null) {
      if (a.bossNum !== b.bossNum) return a.bossNum - b.bossNum;
    } else if (a.bossNum !== null) {
      return -1;
    } else if (b.bossNum !== null) {
      return 1;
    }
    const idComp = String(a.bossId || "").localeCompare(String(b.bossId || ""), "en");
    if (idComp !== 0) return idComp;
    return String(a.sourceName || "").localeCompare(String(b.sourceName || ""), "en");
  });
}

function buildAllBossesCatalog(enGrouped, ruGrouped, catalogBosses) {
  const catalogList = Array.isArray(catalogBosses)
    ? catalogBosses
    : (catalogBosses && Array.isArray(catalogBosses.bosses))
      ? catalogBosses.bosses
      : [];

  const catalogByNumber = new Map<any, any>();
  const catalogById = new Map<any, any>();
  for (const cat of catalogList) {
    const num = cat.bossNum !== undefined ? cat.bossNum : extractBossNumber(cat.bossId || cat.key);
    const id = num !== null ? `boss_${String(num).padStart(3, "0")}` : (cat.bossId || cat.key || cat.configId);
    const normalizedCat = {
      ...cat,
      bossNum: num,
      bossId: id
    };
    if (num !== null && !catalogByNumber.has(num)) catalogByNumber.set(num, normalizedCat);
    if (id && !catalogById.has(id)) catalogById.set(id, normalizedCat);
  }

  const bossMap = new Map<any, any>();

  // 1. Add all bosses from catalog
  for (const [id, cat] of catalogById.entries()) {
    const group = enGrouped ? enGrouped[id] : null;
    const ruG = ruGrouped ? ruGrouped[id] : null;
    const mechanics = formatMechanics(group, ruG);
    bossMap.set(id, {
      bossId: id,
      bossNum: cat.bossNum,
      configId: cat.configId || "",
      sourceName: cat.sourceName || "",
      mechanics,
      phaseCount: mechanics.length,
      keys: group ? group.keys : []
    });
  }

  // 2. Add all bosses discovered in localization
  if (enGrouped) {
    for (const [id, group] of Object.entries(enGrouped)) {
      if (!bossMap.has(id)) {
        const cat = group.bossNum !== null ? catalogByNumber.get(group.bossNum) : null;
        const mechanics = formatMechanics(group, ruGrouped ? ruGrouped[id] : null);
        bossMap.set(id, {
          bossId: id,
          bossNum: group.bossNum,
          configId: cat ? cat.configId : "",
          sourceName: cat ? cat.sourceName : "",
          mechanics,
          phaseCount: mechanics.length,
          keys: group.keys || []
        });
      }
    }
  }

  const allBosses = Array.from(bossMap.values());
  const fourPlusMechanicsBosses = sortBossesDeterministically(allBosses.filter((b) => b.phaseCount >= 4));
  // Kept as an API alias for existing consumers; eligibility is now explicitly 4+.
  const fourPhaseBosses = fourPlusMechanicsBosses;
  const otherBosses = sortBossesDeterministically(allBosses.filter((b) => b.phaseCount < 4));

  return {
    allBosses,
    fourPhaseBosses,
    fourPlusMechanicsBosses,
    otherBosses
  };
}

function formatMechanicsCount(count) {
  return `${count} ${count === 1 ? "mechanic" : "mechanics"}`;
}

function appendBossMarkdown(lines, bosses, startIndex = 1) {
  let entryIndex = startIndex;
  for (const boss of bosses) {
    const nameSuffix = boss.sourceName ? ` — ${boss.sourceName}` : "";
    lines.push(`### ${entryIndex}. Boss: \`${boss.bossId}\` (${formatMechanicsCount(boss.phaseCount)})${nameSuffix}`);
    lines.push("");
    if (boss.mechanics.length === 0) {
      lines.push("*(No combat mechanic text was found in the English localization export.)*");
      lines.push("");
    } else {
      for (const mechanic of boss.mechanics) {
        lines.push(`* **Mechanic ${mechanic.index}** (\`${mechanic.key}\`): ${mechanic.en || "*(text missing)*"}`);
        lines.push("");
      }
    }
    lines.push("---");
    lines.push("");
    entryIndex++;
  }
  return entryIndex;
}

function generateBossReportMarkdown(catalogResult) {
  const { allBosses, fourPlusMechanicsBosses, otherBosses } = catalogResult;
  const lines = [
    "# FCE boss mechanic texts (full export catalog)",
    "",
    `Total bosses: **${allBosses.length}** (with at least 4 mechanics: **${fourPlusMechanicsBosses.length}**, others: **${otherBosses.length}**).`,
    "This report contains English boss mechanic text from the current game-data export.",
    "",
    "---",
    "",
    `## Bosses with at least 4 mechanics (${fourPlusMechanicsBosses.length})`,
    ""
  ];

  const entryIndex = appendBossMarkdown(lines, fourPlusMechanicsBosses);
  lines.push(`## Other bosses (${otherBosses.length})`);
  lines.push("");
  appendBossMarkdown(lines, otherBosses, entryIndex);

  return lines.join("\n");
}

function readKnownBossTextState(filePath) {
  const state = readJsonFile(filePath);
  return {
    initialized: state?.initialized === true,
    textIds: new Set<any>(Array.isArray(state?.textIds) ? state.textIds.filter((id) => typeof id === "string") : [])
  };
}

function collectBossTextIds(bosses) {
  return Array.from(new Set<string>(
    bosses.flatMap((boss) => boss.mechanics.map((mechanic) => mechanic.key).filter(Boolean))
  )).sort((a, b) => a.localeCompare(b, "en"));
}

function findNewBosses(catalogResult, knownState) {
  if (!knownState.initialized) return [];
  return catalogResult.fourPlusMechanicsBosses.filter((boss) =>
    boss.mechanics.length >= 4 && boss.mechanics.every((mechanic) => !knownState.textIds.has(mechanic.key))
  );
}

function generateNewBossReportMarkdown(newBosses, baselineInitialized) {
  const lines = [
    "# New FCE boss mechanic texts",
    "",
    "This report contains only bosses first seen after the previous snapshot and only when at least 4 English mechanics are available.",
    "",
    `New bosses: **${newBosses.length}**.`,
    ""
  ];

  if (!baselineInitialized) {
    lines.push("The baseline was initialized during this run. Existing bosses are not reported as new.");
    lines.push("");
  } else if (newBosses.length === 0) {
    lines.push("No new bosses with at least 4 mechanics were found.");
    lines.push("");
  } else {
    lines.push("---");
    lines.push("");
    appendBossMarkdown(lines, newBosses);
  }

  return lines.join("\n");
}

/**
 * Ready-to-edit cards for bosses that have 4+ mechanics in the game but no curated card.
 * Names come from ST_actorname (the key in VoidCloneBossConfig.BossNameText), art and
 * preview from the same row's BossImageMain/BossImage; an editor checks the art, sets
 * name_color, drops the `_draft` block and copies the file to curated .../fce/data/bosses/.
 */
function writeBossCardDrafts({ fceDir, docsDir, completeCatalog, catalogByNumber, registeredNumbers, enData, ruData }) {
  const draftsDir = path.join(fceDir, "boss-drafts");
  fs.rmSync(draftsDir, { recursive: true, force: true });
  fs.mkdirSync(draftsDir, { recursive: true });
  const actorName = (data, key) => (data && data.ST_actorname && data.ST_actorname[key]) || "";
  const webp = (png) => (png ? `/datamine/shared/media/${png.replace(/\.png$/i, ".webp")}` : "");
  const drafts = [];
  for (const boss of completeCatalog.fourPlusMechanicsBosses) {
    if (boss.bossNum !== null && registeredNumbers.has(boss.bossNum)) continue;
    const cat = boss.bossNum !== null ? catalogByNumber.get(boss.bossNum) : null;
    const nameKey = (cat && cat.bossId) || "";
    const en = actorName(enData, nameKey) || boss.sourceName || boss.bossId;
    const ru = actorName(ruData, nameKey) || en;
    const slug = en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || boss.bossId;
    const card = {
      slug,
      order: cat ? cat.order : null,
      boss_id: boss.bossId,
      name_color: "#ffffff",
      art: webp(cat && cat.imageMain),
      art_object_position: "center center",
      preview: webp(cat && cat.image),
      en: { name: en, mechanics: boss.mechanics.map((m) => ({ index: m.index, html: m.en })) },
      ru: { name: ru, mechanics: boss.mechanics.map((m) => ({ index: m.index, html: m.ru || m.en })) },
      _draft: {
        todo: "Check art/preview, set name_color, remove _draft, copy to curated datamine/fce/data/bosses/",
        nameKey,
        configId: cat ? cat.configId : "",
        sourceName: boss.sourceName || "",
        textKeys: boss.mechanics.map((m) => m.key)
      }
    };
    fs.writeFileSync(path.join(draftsDir, `${slug}.json`), `${JSON.stringify(card, null, 2)}\n`, "utf8");
    drafts.push(card);
  }
  const lines = [
    "# FCE boss card drafts",
    "",
    "Bosses with at least 4 mechanics in the current export and no curated card. Each has a",
    "ready card in `datamine/fce/data/boss-drafts/<slug>.json` (names: ST_actorname; art: VoidCloneBossConfig).",
    "",
    `Drafts: **${drafts.length}**.`,
    ""
  ];
  for (const card of drafts) {
    lines.push(`## ${card.en.name} / ${card.ru.name} — \`${card.boss_id}\` (${card.slug}.json)`, "");
    lines.push(`- Art: \`${card.art || "—"}\``, `- Preview: \`${card.preview || "—"}\``, "");
    for (const m of card.en.mechanics) lines.push(`${m.index}. ${m.html}`);
    lines.push("");
  }
  fs.writeFileSync(path.join(docsDir, "BOSS_CARD_DRAFTS.md"), lines.join("\n"), "utf8");
  return drafts;
}

function processFceMechanics(rawDir, projectRoot) {
  if (!projectRoot || !fs.existsSync(path.join(projectRoot, "datamine"))) {
    projectRoot = resolveProjectRoot();
  }
  console.log(`\n[fce-mechanics] Scanning FCE boss mechanics from: ${rawDir}`);

  const gameEnFile = [
    path.join(rawDir, "Hotta", "Content", "Localization", "Game", "en", "Game.json"),
    path.join(rawDir, "Game.json")
  ].find((p) => fs.existsSync(p));

  const gameRuFile = [
    path.join(rawDir, "Hotta", "Content", "Localization", "Game", "ru", "Game.json"),
    path.join(rawDir, "Game_ru.json")
  ].find((p) => fs.existsSync(p));

  if (!gameEnFile) {
    throw new Error(`[required] Game/en/Game.json not found in ${rawDir}; FCE output was not published.`);
  }

  console.log(`[fce-mechanics] Reading EN strings from: ${gameEnFile}`);
  const enData = readJsonFile(gameEnFile);
  const enEntries = extractMatchingBossEntries(enData);
  if (Object.keys(enEntries).length === 0) {
    throw new Error("[required] FCE localization contained zero expected boss mechanic entries.");
  }
  const enGrouped = groupMechanicsByBoss(enEntries);

  let ruEntries: Record<string, any> = {};
  let ruGrouped: Record<string, any> = {};
  let ruData = null;
  if (gameRuFile) {
    console.log(`[fce-mechanics] Reading RU strings from: ${gameRuFile}`);
    ruData = readJsonFile(gameRuFile);
    ruEntries = extractMatchingBossEntries(ruData);
    ruGrouped = groupMechanicsByBoss(ruEntries);
  }

  const bossCatalog = loadFceBossCatalog(rawDir);
  if (!bossCatalog.sourceFile || !Array.isArray(bossCatalog.bosses) || bossCatalog.bosses.length === 0) {
    throw new Error("[required] FCE game boss catalog is missing or contains zero usable bosses; no output was changed.");
  }
  const catalogOrder = new Map<any, any>();
  const catalogByNumber = new Map<any, any>();
  for (const boss of bossCatalog.bosses) {
    if (boss.bossNum !== null && !catalogOrder.has(boss.bossNum)) {
      catalogOrder.set(boss.bossNum, boss.order);
      catalogByNumber.set(boss.bossNum, boss);
    }
  }

  // 1. Load registered boss numbers and curated mechanics directly from curated boss cards.
  const fceDir = path.join(projectRoot, "datamine", "fce", "data");
  fs.mkdirSync(fceDir, { recursive: true });

  const registeredNumbers = new Set<any>();
  const curatedBossDir = path.join(fceDir, "bosses");
  if (!fs.existsSync(curatedBossDir)) throw new Error(`[required] Curated FCE boss directory missing: ${curatedBossDir}`);
  const curatedBossFiles = fs.readdirSync(curatedBossDir).filter((name) => name.endsWith(".json"));
  if (curatedBossFiles.length === 0) throw new Error(`[required] Curated FCE boss directory is empty: ${curatedBossDir}`);
  for (const file of curatedBossFiles) {
    const boss = readJsonFile(path.join(curatedBossDir, file));
    const num = extractBossNumber(boss && boss.boss_id);
    if (num !== null) registeredNumbers.add(num);
    if (boss && boss.en && Array.isArray(boss.en.mechanics)) {
      for (const m of boss.en.mechanics) {
        if (m.key && m.html && !enEntries[m.key]) {
          enEntries[m.key] = m.html;
        }
      }
    }
    if (boss && boss.ru && Array.isArray(boss.ru.mechanics)) {
      for (const m of boss.ru.mechanics) {
        if (m.key && m.html && !ruEntries[m.key]) {
          ruEntries[m.key] = m.html;
        }
      }
    }
  }

  const filteredGameEnPath = path.join(fceDir, "Filtered_Game.json");
  const filteredGameRuPath = path.join(fceDir, "Filtered_Game_ru.json");

  fs.writeFileSync(filteredGameEnPath, JSON.stringify(enEntries, null, 4), "utf8");
  if (Object.keys(ruEntries).length > 0) {
    fs.writeFileSync(filteredGameRuPath, JSON.stringify(ruEntries, null, 4), "utf8");
  }

  // Sort by the in-game boss catalog, then append localization-only entries.
  const sortedBossGroups = Object.entries(enGrouped)
    .filter(([bossId, group]) => group.bossNum === null || !registeredNumbers.has(group.bossNum))
    .sort((a, b) => {
      const orderA = catalogOrder.get(a[1].bossNum) ?? 10000 + (a[1].bossNum ?? 9999);
      const orderB = catalogOrder.get(b[1].bossNum) ?? 10000 + (b[1].bossNum ?? 9999);
      return orderA - orderB;
    });

  const unregisteredFlatEn: Record<string, any> = {};
  const unregisteredFlatRu: Record<string, any> = {};
  const unregisteredByBossEn: Record<string, any> = {};
  const unregisteredByBossRu: Record<string, any> = {};
  const unregisteredBosses = [];

  const bossNameHints = {
    3: "Hyena Mech (Break Fate)",
    6: "Robarg",
    18: "Habaka",
    59: "Boss 059",
    66: "Ying Zhao Shield Buff",
    79: "Defender"
  };

  for (const [bossId, group] of sortedBossGroups) {
    const hint = bossNameHints[group.bossNum] || bossId;
    const groupTitle = group.bossNum !== null ? `Boss_#${String(group.bossNum).padStart(3, "0")} (${hint})` : bossId;

    unregisteredByBossEn[groupTitle] = {};
    if (Object.keys(ruEntries).length > 0) {
      unregisteredByBossRu[groupTitle] = {};
    }

    // Sort keys within boss (e.g. _1_des, _2_des, _3_des, _4_des, _5_des)
    const sortedKeys = group.keys.slice().sort((ka, kb) => {
      const numA = ka.match(/_0?([1-5])_/) ? parseInt(ka.match(/_0?([1-5])_/)[1], 10) : 99;
      const numB = kb.match(/_0?([1-5])_/) ? parseInt(kb.match(/_0?([1-5])_/)[1], 10) : 99;
      return numA - numB;
    });

    for (const key of sortedKeys) {
      unregisteredFlatEn[key] = enEntries[key];
      unregisteredByBossEn[groupTitle][key] = enEntries[key];

      if (ruEntries[key]) {
        unregisteredFlatRu[key] = ruEntries[key];
        unregisteredByBossRu[groupTitle][key] = ruEntries[key];
      }
    }

    const formattedMechanics = formatMechanics(group, ruGrouped[bossId]);
    const catalogEntry = catalogByNumber.get(group.bossNum);

    unregisteredBosses.push({
      bossId,
      bossNum: group.bossNum,
      catalogOrder: catalogEntry?.order || null,
      catalogConfigId: catalogEntry?.configId || "",
      sourceName: catalogEntry?.sourceName || "",
      image: catalogEntry?.image || "",
      imageMain: catalogEntry?.imageMain || "",
      nameHint: hint,
      keys: sortedKeys,
      mechanicsCount: formattedMechanics.length,
      mechanics: formattedMechanics
    });
  }

  // 3. Save Unregistered Bosses Flat & Grouped JSON files
  const unregEnFlatFile = path.join(fceDir, "Filtered_Game_Unregistered.json");
  const unregRuFlatFile = path.join(fceDir, "Filtered_Game_Unregistered_ru.json");
  const unregEnByBossFile = path.join(fceDir, "Filtered_Game_Unregistered_By_Boss.json");
  const unregRuByBossFile = path.join(fceDir, "Filtered_Game_Unregistered_By_Boss_ru.json");

  fs.writeFileSync(unregEnFlatFile, JSON.stringify(unregisteredFlatEn, null, 4), "utf8");
  fs.writeFileSync(unregEnByBossFile, JSON.stringify(unregisteredByBossEn, null, 4), "utf8");

  if (Object.keys(unregisteredFlatRu).length > 0) {
    fs.writeFileSync(unregRuFlatFile, JSON.stringify(unregisteredFlatRu, null, 4), "utf8");
    fs.writeFileSync(unregRuByBossFile, JSON.stringify(unregisteredByBossRu, null, 4), "utf8");
  }

  // 4. Save structured JSON
  const unregisteredJsonFile = path.join(fceDir, "fce-unregistered-bosses.json");
  fs.writeFileSync(unregisteredJsonFile, JSON.stringify({ unregisteredBosses }, null, 2), "utf8");

  const seenMissingBosses = new Set<any>();
  const missingBosses = bossCatalog.bosses
    .filter((boss) => {
      if (boss.bossNum !== null && registeredNumbers.has(boss.bossNum)) return false;
      const identity = boss.bossNum !== null ? `number:${boss.bossNum}` : `id:${boss.bossId || boss.configId}`;
      if (seenMissingBosses.has(identity)) return false;
      seenMissingBosses.add(identity);
      return true;
    })
    .map((boss) => {
      const normalizedBossId = boss.bossNum !== null
        ? `boss_${String(boss.bossNum).padStart(3, "0")}`
        : "";
      const mechanics = formatMechanics(enGrouped[normalizedBossId], ruGrouped[normalizedBossId]);
      return {
        ...boss,
        mechanicsCount: mechanics.length,
        mechanics
      };
    });
  const missingFile = path.join(fceDir, "fce-missing-boss-texts.json");
  fs.writeFileSync(
    missingFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        catalogSource: bossCatalog.sourceFile,
        description: "Bosses missing from the curated FCE list, ordered by the in-game boss catalog.",
        bosses: missingBosses
      },
      null,
      2
    ),
    "utf8"
  );

  const catalogFile = path.join(fceDir, "fce-game-boss-catalog.json");
  fs.writeFileSync(
    catalogFile,
    JSON.stringify({ source: bossCatalog.sourceFile, bosses: bossCatalog.bosses }, null, 2),
    "utf8"
  );

  // 5. Generate the full English report, the incremental new-boss report,
  // and a compact cumulative snapshot of localization text IDs.
  const completeCatalog = buildAllBossesCatalog(enGrouped, ruGrouped, bossCatalog.bosses);
  const knownTextStatePath = path.join(fceDir, "fce-known-boss-text-ids.json");
  const knownTextState = readKnownBossTextState(knownTextStatePath);
  const newBosses = findNewBosses(completeCatalog, knownTextState);
  const allTextIds = Array.from(new Set<any>([
    ...knownTextState.textIds,
    ...collectBossTextIds(completeCatalog.allBosses)
  ])).sort((a, b) => a.localeCompare(b, "en"));

  const docsDir = path.join(projectRoot, "datamine", "fce", "docs");
  fs.mkdirSync(docsDir, { recursive: true });
  const allReportPath = path.join(docsDir, "ALL_BOSSES_TEXTS.md");
  const newReportPath = path.join(docsDir, "NEW_BOSSES_TEXTS.md");
  fs.writeFileSync(allReportPath, generateBossReportMarkdown(completeCatalog), "utf8");
  fs.writeFileSync(newReportPath, generateNewBossReportMarkdown(newBosses, knownTextState.initialized), "utf8");
  fs.writeFileSync(
    knownTextStatePath,
    `${JSON.stringify({ schemaVersion: 1, initialized: true, textIds: allTextIds }, null, 2)}\n`,
    "utf8"
  );

  const drafts = writeBossCardDrafts({ fceDir, docsDir, completeCatalog, catalogByNumber, registeredNumbers, enData, ruData });

  console.log(`[fce-mechanics] Saved Filtered_Game.json (${Object.keys(enEntries).length} combat boss keys)`);
  console.log(`[fce-mechanics] Saved ${drafts.length} boss card draft(s) to datamine/fce/data/boss-drafts`);
  console.log(`[fce-mechanics] Saved Filtered_Game_Unregistered.json (${Object.keys(unregisteredFlatEn).length} keys across ${unregisteredBosses.length} bosses sorted by the in-game catalog)`);
  console.log(`[fce-mechanics] Saved fce-missing-boss-texts.json (${missingBosses.length} catalog bosses missing from the curated page)`);
  console.log(`[fce-mechanics] Saved ALL_BOSSES_TEXTS.md (${completeCatalog.allBosses.length} total bosses)`);
  console.log(`[fce-mechanics] Saved NEW_BOSSES_TEXTS.md (${newBosses.length} new bosses with at least 4 mechanics${knownTextState.initialized ? "" : "; baseline initialized"})`);

  return {
    totalKeys: Object.keys(enEntries).length,
    unregisteredBosses: unregisteredBosses.length,
    totalBosses: completeCatalog.allBosses.length,
    fourPhaseBosses: completeCatalog.fourPhaseBosses.length,
    otherBosses: completeCatalog.otherBosses.length,
    newBosses: newBosses.length
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
  processFceMechanics(rawDir, projectRoot);
}

if (require.main === module) {
  main();
}

export {
  processFceMechanics,
  extractMatchingBossEntries,
  extractBossNumber,
  parseBossKeyFamily,
  groupMechanicsByBoss,
  formatMechanics,
  buildAllBossesCatalog,
  generateBossReportMarkdown,
  readKnownBossTextState,
  collectBossTextIds,
  findNewBosses,
  generateNewBossReportMarkdown,
};
