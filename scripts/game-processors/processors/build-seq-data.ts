import { readGameSourceFileSync } from './game-source-reader';
import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';

const CN_JUMP_THRESHOLD = 3.0; // Ratio threshold between consecutive stages to detect unscaled CN data
const BASE_EFFECTIVE_HP_MULTIPLIER = 1.3471; // Base sequential resist factor (7500 resist -> 34.71% reduction)

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readGameSourceFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
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
    path.join(projectRoot, "..", "raw_exports"),
    path.join(projectRoot, "datamine-pipeline", "raw_exports")
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return path.join(projectRoot, "raw_exports");
}

function findMonsterDataFile(rawDir, projectRoot) {
  const candidates = [
    path.join(
      projectRoot,
      "datamine",
      "seq",
      "data",
      "DT_MonsterStaticData_Overseas.json"
    ),
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "ResourcesOverSea",
      "CoreBlueprints",
      "DataTable",
      "Dungeon",
      "DT_MonsterStaticData_Overseas.json"
    ),
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "ResourcesOverSea",
      "CoreBlueprints",
      "DataTable",
      "DT_MonsterStaticData_Overseas.json"
    ),
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable",
      "DT_MonsterStaticData_Overseas.json"
    ),
    path.join(rawDir, "DT_MonsterStaticData_Overseas.json"),
    path.join(
      rawDir,
      "Hotta",
      "Content",
      "Resources",
      "CoreBlueprints",
      "DataTable",
      "DT_MonsterStaticData.json"
    ),
    path.join(rawDir, "DT_MonsterStaticData.json")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';

function findLocFile(rawDir, relPaths) {
  for (const rel of relPaths) {
    const full = path.join(rawDir, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

// Join by AttributeID, never by stage number or a shortened class-name suffix.
export function createSeqIdentityResolver(rawDir, locResolver) {
  const file = "Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/EndlessNewLandMonsterPoolDataTable_Overseas.json";
  const payload = readJsonFile(path.join(rawDir, file));
  const pools = payload?.[0]?.Rows || payload?.Rows || {};
  const bindings = new Map<string, any[]>();
  for (const [key, row] of Object.entries<any>(pools)) {
    for (const monster of row.PoolMonsters || []) {
      if (!monster.AttributeID?.startsWith("endless_special_boss_")) continue;
      const entries = bindings.get(monster.AttributeID) || [];
      entries.push({ key, monster });
      bindings.set(monster.AttributeID, entries);
    }
  }
  return (attributeId: string) => {
    const entries = bindings.get(attributeId) || [];
    const classes = new Set(entries.map(entry => entry.monster.MonsterClass?.AssetPathName));
    if (!entries.length || classes.size !== 1 || ![...classes][0]?.startsWith('/Game/')) return null;
    const classPath = [...classes][0];
    const chain: string[] = [], seen = new Set<string>();
    const candidates = entries.map(entry => ({ text: entry.monster.MonsterName, source: `${file}#${entry.key}.PoolMonsters[].MonsterName` }));
    let reference = classPath;
    while (reference?.startsWith('/Game/') && !seen.has(reference) && seen.size < 64) {
      seen.add(reference);
      const packagePath = reference.slice('/Game/'.length).split('.')[0];
      if (packagePath.split('/').some(part => part === '..')) break;
      const source = `Hotta/Content/${packagePath}.json`;
      // An exact class basename can itself be an actor localization key.
      candidates.push({ text: { Namespace: 'ST_actorname', Key: path.posix.basename(packagePath) }, source });
      const objects = readJsonFile(path.join(rawDir, source));
      if (!Array.isArray(objects)) break;
      chain.push(source);
      const properties = objects.find(object => object.Name?.startsWith('Default__'))?.Properties || {};
      for (const field of ['MonsterName', 'CharacterName']) {
        if (properties[field]) candidates.push({ text: properties[field], source: `${source}#Default__.${field}` });
      }
      const generated = objects.find(object => object.Type === 'BlueprintGeneratedClass');
      reference = generated?.Super?.ObjectPath || generated?.SuperStruct?.ObjectPath;
    }
    const provenance = { file, rows: entries.map(entry => entry.key), attributeId, classPath, chain };
    for (const candidate of candidates) {
      const en = locResolver.resolve(candidate.text, { locale: 'en', defaultNamespace: 'ST_actorname' });
      if (en.provenance.status !== 'resolved' || !en.text) continue;
      const ru = locResolver.resolve(candidate.text, { locale: 'ru', fallbackLocale: 'en', defaultNamespace: 'ST_actorname' });
      return { enemyCode: path.posix.basename(classPath).split('.')[0], enemyNameEn: cleanHtmlTags(en.text), enemyNameRu: cleanHtmlTags(ru.text || en.text), nameStatus: 'confirmed', nameSource: 'raw_monster_pool_blueprint', identitySource: { ...provenance, nameField: candidate.source, localization: en.provenance } };
    }
    return { enemyCode: path.posix.basename(classPath).split('.')[0], identitySource: provenance };
  };
}

function processSequentialData(rawDir, projectRoot) {
  console.log(`\n[seq-data] Processing Sequential boss data from: ${rawDir}`);

  const sourceFile = findMonsterDataFile(rawDir, projectRoot);
  if (!sourceFile) {
    throw new Error(
      `[required] Could not find a fresh DT_MonsterStaticData table in ${rawDir}.`
    );
  }

  console.log(`[seq-data] Reading source file: ${sourceFile}`);
  const payload = readJsonFile(sourceFile);
  const rows = (Array.isArray(payload) ? payload[0]?.Rows : payload?.Rows) || payload?.Rows || payload;

  if (!rows || typeof rows !== "object") {
    throw new Error(`Invalid format in ${sourceFile}: Rows object not found.`);
  }

  // Load localization and string tables
  const locEnFile = findLocFile(rawDir, [
    "Hotta/Content/Localization/Game/en/Game.json",
    "Game/en/Game.json"
  ]);
  const locRuFile = findLocFile(rawDir, [
    "Hotta/Content/Localization/Game/ru/Game.json",
    "Game/ru/Game.json"
  ]);

  const actorEnFile = findLocFile(rawDir, [
    "Hotta/Content/Resources/Text/Oversea/ST_actorname_Oversea.json",
    "Hotta/Content/Resources/Text/ST_actorname.json"
  ]);
  const actorRuFile = findLocFile(rawDir, [
    "Hotta/Content/Resources/Text/Oversea/ST_actorname_Oversea_ru.json",
    "Hotta/Content/Resources/Text/ST_actorname_ru.json"
  ]);

  const locResolver = createLocalizationResolver();
  if (locEnFile) locResolver.loadLocale("en", readJsonFile(locEnFile));
  if (locRuFile) locResolver.loadLocale("ru", readJsonFile(locRuFile));
  if (actorEnFile) locResolver.loadLocale("en", readJsonFile(actorEnFile));
  if (actorRuFile) locResolver.loadLocale("ru", readJsonFile(actorRuFile));
  const resolveIdentity = createSeqIdentityResolver(rawDir, locResolver);

  // Resolve room names from localization
  const roomNameEn = locResolver.resolve("bigsecret2_unlock_funceditortip", { locale: "en" }).text || "Sequential Phantasm";
  const roomNameRu = locResolver.resolve("bigsecret2_unlock_funceditortip", { locale: "ru", fallbackLocale: "en" }).text || "Последовательный фантазм";
  const roomId = "sequential_phantasm";

  // Load shared enemies layer
  const sharedEnemiesFile = path.join(projectRoot, "datamine", "shared-data", "enemies.json");
  const sharedEnemies = readJsonFile(sharedEnemiesFile) || {};

  // Load curated mechanics overrides (curated-preserve)
  const overridesFile = path.join(projectRoot, "datamine", "seq", "data", "seq-mechanics-overrides.json");
  const overrides = readJsonFile(overridesFile) || { stages: {} };

  const cachedRows: Record<string, any> = {};
  const stageEntries = [];
  let detectedCutoffStage = 0;
  let cutoffReason = "";
  let cutoffType = "scan-limit";
  let prevHp = null;

  let resolvedEnemyCount = 0;
  let resolvedRoomCount = 0;
  const unresolvedIds = [];
  const monsterImageMappingFile = path.join(projectRoot, "scripts", "monster-image-mapping.json");
  const monsterImageMapping = readJsonFile(monsterImageMappingFile) || {};

  const fceIndexFile = path.join(projectRoot, "datamine", "fce", "data", "fce-index.json");
  const fceIndex = readJsonFile(fceIndexFile) || { bosses: [] };
  const imageCopier = new ImageCopier(rawDir, projectRoot);

  function isCanonicalPortrait(value) {
    return typeof value === "string" &&
      /^\/datamine\/shared\/media\/Hotta\/Content\/.+\.webp$/i.test(value);
  }

  function materializeSeqPortrait(value, stage) {
    if (!isCanonicalPortrait(value) || /placeholder[-_]boss\.webp$/i.test(value)) return value;
    const packagePath = value
      .replace(/^\/datamine\/shared\/media\/Hotta\/Content\//i, "")
      .replace(/\.webp$/i, "");
    const leaf = path.posix.basename(packagePath);
    const copied = imageCopier.copyAsset(
      "seq",
      `/Game/${packagePath}.${leaf}`,
      "seq_enemy_portrait",
      { structured: true, entityId: `stage-${stage}`, preservePng: false }
    );
    if (!copied) {
      console.warn(`[seq-data] Exact portrait source is not present in this export for stage ${stage}: ${value}`);
      return value;
    }
    return copied.preferredFull || copied.publicUrl || value;
  }

  function resolveSeqBossPortrait(enemyCode, explicitPortrait = null) {
    // Curated stage bindings are the authoritative visual contract. They are
    // intentionally checked before every generated/data-driven fallback.
    if (isCanonicalPortrait(explicitPortrait)) {
      return explicitPortrait;
    }

    const code = String(enemyCode || "").trim();
    if (!code || code.toLowerCase().startsWith("endless_special_boss")) {
      return "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp";
    }

    const cLower = code.toLowerCase();

    // 1. Check FCE index
    if (Array.isArray(fceIndex.bosses)) {
      const fceHit = fceIndex.bosses.find((b) => {
        if (!b) return false;
        const bId = String(b.boss_id || "").toLowerCase();
        const bSlug = String(b.slug || "").toLowerCase();
        return bId === cLower || bSlug === cLower || (b.name && b.name.toLowerCase() === cLower);
      });
      if (fceHit) {
        const exactFcePortrait = fceHit.lineupPortrait || fceHit.displayWebpUrl || fceHit.art;
        if (isCanonicalPortrait(exactFcePortrait)) return exactFcePortrait;
      }
    }

    // 2. Check authoritative monster image mapping
    if (monsterImageMapping[code] || monsterImageMapping[cLower]) {
      const mapped = monsterImageMapping[code] || monsterImageMapping[cLower];
      const res = typeof mapped === "object" ? (mapped.lineupPortrait || mapped.image) : mapped;
      if (isCanonicalPortrait(res)) {
        return res;
      }
    }

    // 3. Check shared enemies layer
    if (sharedEnemies[code] || sharedEnemies[cLower]) {
      const se = sharedEnemies[code] || sharedEnemies[cLower];
      if (isCanonicalPortrait(se.portrait)) {
        return se.portrait;
      }
    }

    // 4. Exact disk lookup for the exact code (e.g. boss005.webp, boss_hum_035.webp)
    const bossDir = path.join(projectRoot, "datamine", "shared", "media", "Hotta", "Content", "Resources", "UI", "void", "boss");
    if (fs.existsSync(bossDir)) {
      // Only the exact entity code is allowed. Never synthesize a boss_ prefix
      // or a numeric filename: those guesses silently bind the wrong enemy.
      const candidates = [`${code}.webp`, `${cLower}.webp`];
      const diskEntries = fs.readdirSync(bossDir);
      for (const cand of candidates) {
        const matched = diskEntries.find((e) => e.toLowerCase() === cand.toLowerCase());
        if (matched) {
          return `/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/${matched}`;
        }
      }
    }

    return "/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp";
  }

  // Traverse stages sequentially
  for (let stage = 1; stage <= 100; stage += 1) {
    const rowId = `endless_special_boss_${stage}`;
    const row = rows[rowId] || rows[rowId.toLowerCase()];

    if (!row || typeof row.MaxHealth !== "number" || !Number.isFinite(row.MaxHealth) || row.MaxHealth <= 0) {
      cutoffType = stage === 1 ? "missing-source-stage" : "missing-next-stage";
      cutoffReason = stage === 1
        ? `Stage 1 is missing or has invalid HP.`
        : `Stage ${stage} is absent, so contiguous Global data ends at stage ${stage - 1}.`;
      break;
    }

    const currentHp = row.MaxHealth;

    if (prevHp !== null && prevHp > 0) {
      const ratio = currentHp / prevHp;
      if (ratio > CN_JUMP_THRESHOLD) {
        detectedCutoffStage = stage - 1;
        cutoffType = "anomalous-cn-jump";
        cutoffReason = `Stage ${stage} HP (${currentHp.toLocaleString("en-US")}) is ${ratio.toFixed(2)}x stage ${stage - 1} (${prevHp.toLocaleString("en-US")}), exceeding Global scaling threshold (${CN_JUMP_THRESHOLD}x).`;
        console.log(`[seq-data] Detected CN cutoff at stage ${stage - 1}: ${cutoffReason}`);
        break;
      }
    }

    cachedRows[rowId] = currentHp;
    detectedCutoffStage = stage;
    prevHp = currentHp;

    // Resolve via shared enemies and overrides
    const sharedEnemy = sharedEnemies[rowId] || sharedEnemies[rowId.toLowerCase()] || {};
    const override = overrides.stages?.[String(stage)];

    const maxHealth = currentHp;
    const effectiveHp = override?.effectiveHp
      ? override.effectiveHp
      : Math.round(maxHealth * BASE_EFFECTIVE_HP_MULTIPLIER);
    const isMechanicsAdjusted = Boolean(override?.effectiveHp || override?.note || override?.mechanics);
    const mechanicsNote = override?.note || override?.mechanics || (isMechanicsAdjusted ? "Includes mechanics-adjusted HP formula." : null);

    const atkVal = (sharedEnemy.stats && Number.isFinite(sharedEnemy.stats.atk) && sharedEnemy.stats.atk > 0)
      ? sharedEnemy.stats.atk
      : (typeof row.CommonAtkBase === "number" && Number.isFinite(row.CommonAtkBase) ? row.CommonAtkBase : 0);
    const defVal = (sharedEnemy.stats && Number.isFinite(sharedEnemy.stats.def) && sharedEnemy.stats.def > 0)
      ? sharedEnemy.stats.def
      : (typeof row.PhyDefBase === "number" && Number.isFinite(row.PhyDefBase) ? row.PhyDefBase : 0);
    const critVal = (sharedEnemy.stats && Number.isFinite(sharedEnemy.stats.crit) && sharedEnemy.stats.crit > 0)
      ? sharedEnemy.stats.crit
      : (typeof row.CritBase === "number" && Number.isFinite(row.CritBase) ? row.CritBase : 0);
    // The table stores crit resistance in FinalCritDef. CritDef is a separate
    // base/evasion field and CritDefBase is not present on Sequential rows.
    const critDefVal = (typeof row.FinalCritDef === "number" && Number.isFinite(row.FinalCritDef))
      ? row.FinalCritDef
      : ((sharedEnemy.stats && Number.isFinite(sharedEnemy.stats.finalCritDef))
        ? sharedEnemy.stats.finalCritDef
        : null);

    const identity = resolveIdentity(rowId);
    const enemyCode = override?.enemyCode || override?.enemyId || identity?.enemyCode || sharedEnemy.enemy_id || sharedEnemy.boss_id || row.MonsterClass || null;

    let enemyNameEn = null;
    let enemyNameRu = null;
    let nameStatus = "unresolved";
    let nameSource = "unresolved";

    const lowerId = rowId.toLowerCase();

    // 1. Explicit curated mapping in overrides
    if (override && (override.enemyNameEn || override.name_en || override.boss_name_en)) {
      enemyNameEn = override.enemyNameEn || override.name_en || override.boss_name_en;
      enemyNameRu = override.enemyNameRu || override.name_ru || override.boss_name_ru || enemyNameEn;
      nameStatus = "confirmed";
      nameSource = "seq_mechanics_overrides";
    }
    // 2. Direct resolver join (must be a genuine non-generic localization string)
    else if (identity?.enemyNameEn) {
      enemyNameEn = identity.enemyNameEn;
      enemyNameRu = identity.enemyNameRu;
      nameStatus = identity.nameStatus;
      nameSource = identity.nameSource;
    }
    else {
      const candidates = [
        enemyCode,
        rowId,
        lowerId,
        `actorname_${lowerId}`,
        `monster_${lowerId}`,
        `boss_${lowerId}`
      ].filter(Boolean);
      let foundEn = null;
      let foundRu = null;
      for (const c of candidates) {
        const resEn = locResolver.resolve(c, { locale: "en", defaultNamespace: "actorname" });
        if (resEn.provenance.status === "resolved" && resEn.text && !resEn.text.toLowerCase().includes("endless_special_boss") && !resEn.text.toLowerCase().startsWith("endless special boss")) {
          foundEn = resEn.text;
          const resRu = locResolver.resolve(c, { locale: "ru", fallbackLocale: "en", defaultNamespace: "actorname" });
          foundRu = resRu.text || foundEn;
          break;
        }
      }

      if (foundEn) {
        enemyNameEn = foundEn;
        enemyNameRu = foundRu;
        nameStatus = "confirmed";
        nameSource = "locres_direct";
      }
      // 3. Shared enemies layer
      else if (sharedEnemy.name_en && !sharedEnemy.name_en.toLowerCase().includes("endless_special_boss") && !sharedEnemy.name_en.toLowerCase().startsWith("endless special boss")) {
        enemyNameEn = sharedEnemy.name_en;
        enemyNameRu = sharedEnemy.name_ru || sharedEnemy.name_en;
        nameStatus = "confirmed";
        nameSource = "shared_enemies";
      }
    }

    if (enemyNameEn && nameStatus !== "unresolved") {
      resolvedEnemyCount++;
    } else {
      enemyNameEn = null;
      enemyNameRu = null;
      unresolvedIds.push(rowId);
    }

    if (roomNameEn) {
      resolvedRoomCount++;
    }

    const effectiveCode = enemyCode || rowId;
    const explicitPortrait = materializeSeqPortrait(
      override?.portrait || override?.lineupPortrait || override?.image || null,
      stage
    );
    const resolvedPortrait = resolveSeqBossPortrait(effectiveCode, explicitPortrait);

    stageEntries.push({
      stage,
      codename: rowId,
      enemyCode: effectiveCode,
      enemyNameEn,
      enemyNameRu,
      name_en: enemyNameEn,
      name_ru: enemyNameRu,
      nameStatus,
      nameSource,
      identitySource: identity?.identitySource || null,
      roomId,
      roomNameEn,
      roomNameRu,
      maxHealth,
      effectiveHp,
      atk: atkVal,
      def: defVal,
      crit: critVal,
      critResist: critDefVal,
      element: override?.element || (nameStatus !== "unresolved" ? sharedEnemy.element : "Physical") || "Physical",
      portrait: resolvedPortrait,
      isMechanicsAdjusted,
      mechanics: mechanicsNote
    });
  }

  console.log(`\n[seq-data] --- Sequential Resolve Report ---`);
  console.log(`[seq-data] Total stages: ${stageEntries.length}`);
  console.log(`[seq-data] Enemy names resolved: ${resolvedEnemyCount}/${stageEntries.length}`);
  console.log(`[seq-data] Room names resolved: ${resolvedRoomCount}/${stageEntries.length}`);
  console.log(`[seq-data] Unresolved IDs: ${unresolvedIds.length > 0 ? unresolvedIds.join(", ") : "none"}\n`);

  if (detectedCutoffStage === 0) {
    throw new Error(cutoffReason || "No contiguous Sequential stages were found.");
  }

  const seqDir = path.join(projectRoot, "datamine", "seq");
  const seqDataDir = path.join(seqDir, "data");
  fs.mkdirSync(seqDataDir, { recursive: true });

  const cachePayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceFile: path.basename(sourceFile),
      cachedUpToStage: detectedCutoffStage,
      effectiveHpMultiplier: BASE_EFFECTIVE_HP_MULTIPLIER,
      detectedCutoffType: cutoffType,
      detectedCutoffReason: cutoffReason || "Contiguous Global stages parsed smoothly.",
      rowCount: Object.keys(cachedRows).length,
      resolveReport: {
        totalStages: stageEntries.length,
        enemyNamesResolved: resolvedEnemyCount,
        enemyNamesUnresolved: unresolvedIds.length,
        roomNamesResolved: resolvedRoomCount,
        unresolvedIds,
        missingCandidateExportPaths: [
          "Hotta/Content/Resources/CoreBlueprints/Dungeon/Sequential/.*\\.uasset",
          "Hotta/Content/Resources/CoreBlueprints/DataTable/Sequential/.*\\.uasset",
          "Hotta/Content/Resources/CoreBlueprints/DataTable/DT_SequentialStageData.*\\.uasset"
        ]
      }
    },
    rows: cachedRows,
    stages: stageEntries
  };

  const cacheFile = path.join(seqDataDir, "seq-boss-cache.json");
  const stageLimitFile = path.join(seqDataDir, "seq-stage-limit.txt");
  const targetSourceCopy = path.join(seqDataDir, "DT_MonsterStaticData_Overseas.json");

  fs.writeFileSync(cacheFile, JSON.stringify(cachePayload, null, 2) + "\n", "utf8");
  fs.writeFileSync(stageLimitFile, String(detectedCutoffStage), "utf8");

  if (path.resolve(sourceFile) !== path.resolve(targetSourceCopy)) {
    fs.copyFileSync(sourceFile, targetSourceCopy);
    console.log(`[seq-data] Copied source data to ${targetSourceCopy}`);
  }

  console.log(
    `[seq-data] Built cache with ${stageEntries.length} Global stages (limit: ${detectedCutoffStage}) in ${cacheFile}`
  );

  return {
    cachedStages: detectedCutoffStage,
    cacheFile,
    stageLimitFile,
    stages: stageEntries
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
  processSequentialData(rawDir, projectRoot);
}

if (require.main === module) {
  main();
}

export {
  processSequentialData,
};

