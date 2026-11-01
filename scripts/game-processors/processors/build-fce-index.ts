import { readGameSourceFileSync } from './game-source-reader';
/**
 * build-fce-index.js
 *
 * 1. Scans the curated boss cards in datamine/fce/data/bosses/*.json to produce
 *    datamine/fce/data/fce-index.json.
 * 2. Processes BorderWarSeasonDataTable (and BaseDataTable) from the raw export
 *    to produce the authoritative ordered level->boss ladder in datamine/fce/data/fce-ladder.json.
 *
 * Output schema for fce-ladder.json:
 * [
 *   {
 *     "level": 90,
 *     "boss_key": "BorderWar_D",
 *     "name_en": "Chaos Armor",
 *     "name_ru": "Хаос Армор",
 *     "attribute_ids": ["Boss_hum_046_1", ...],
 *     "waves": [
 *       {
 *         "attribute_id": "Boss_hum_046_1",
 *         "boss_id": "HLJJ1",
 *         "boss_level": 90,
 *         "weak_buff_count": 0,
 *         "mode_name_en": "Phase 1",
 *         "mode_name_ru": "Фаза 1",
 *         "mode_desc_en": "...",
 *         "mode_desc_ru": "...",
 *         "stats": { "hp": 800000000, "atk": 120000, "def": 14600, "element": "Physical" }
 *       }
 *     ]
 *   }
 * ]
 */
import fs from 'node:fs';
import path from 'node:path';
import ImageCopier from './image-copier';

const formulaCandidates = [
  path.join(__dirname, "shared", "tof-formulas.js"),
  path.join(__dirname, "../../datamine/shared/tof-formulas.js")
];
const formulaModule = formulaCandidates.find((candidate) => fs.existsSync(candidate));
if (!formulaModule) throw new Error("Required shared/tof-formulas.js module is missing.");
const TofFormulas = require(formulaModule);

function resolveProjectRoot() {
  const customArg = process.argv.find((a) => a.startsWith("--project-root="));
  if (customArg) return path.resolve(customArg.slice("--project-root=".length));
  let cur = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, "package.json"))) return cur;
    cur = path.resolve(cur, "..");
  }
  return path.resolve(__dirname, "../..");
}

function resolveRawDir(projectRoot) {
  const customArg = process.argv.find((a) => a.startsWith("--raw-dir="));
  if (customArg) return path.resolve(customArg.split("=")[1]);

  const candidateDirs = [
    path.join(projectRoot, "raw_exports"),
    path.join(projectRoot, "temperary"),
    path.join(projectRoot, "..", "temperary"),
    path.join(projectRoot, "..", "raw_exports"),
    path.join(projectRoot, "datamine-pipeline", "raw_exports")
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(projectRoot, "raw_exports");
}

function resolveFceDir(projectRoot) {
  const argHit = process.argv.find((a) => a.startsWith("--fce-dir="));
  if (argHit) return path.resolve(argHit.slice("--fce-dir=".length));

  const candidates = [
    path.join(projectRoot, "datamine", "fce"),
    path.join(__dirname, "..", "..", "datamine", "fce"),
    path.join(__dirname, "..", "..", "..", "datamine", "fce")
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "data"))) return c;
  }
  return candidates[0];
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = readGameSourceFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return JSON.parse(raw);
}

function findFile(rawDir, relCandidates) {
  if (!rawDir || !fs.existsSync(rawDir)) return null;
  for (const rel of relCandidates) {
    const full = path.join(rawDir, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';

const FCE_BOSS_CANONICAL_MEDIA = {
  'chaos-armor': { photo: 'boss_SY_08', card: 'bigboss_SY_08' },
  'frigg': { photo: 'boss012', card: 'bigboss012' },
  'valkyrie': { photo: 'bigboss016', card: 'bigboss016' },
  'culton': { photo: 'boss_hum_036', card: 'bigboss036' },
  'iron-tomb': { photo: 'boss_SY_11', card: 'bigboss_SY_11' },
  'gaia': { photo: 'boss_SY_02', card: 'bigboss_SY_02' },
  'sweetie': { photo: 'boss_hum_020', card: 'bigboss020' },
  'merbelle': { photo: 'boss_hum_065', card: 'bigboss065' },
  'frost-bot': { photo: 'boss008', card: 'bigboss008' },
  'apophis': { photo: 'boss015', card: 'bigboss015' },
  'minotaur': { photo: 'boss003', card: 'bigboss003' },
  'rudolph': { photo: 'boss_SY_01', card: 'bigboss_SY_01' },
  'seraph': { photo: 'boss_SY_06', card: 'bigboss_SY_06' },
  'sobek': {
    photo: '/datamine/shared/media/Hotta/Content/Resources/UI/WorldBossList/BOSS/World_Boss_4.webp',
    card: '/datamine/shared/media/Hotta/Content/Resources/UI/WorldBossList/BOSS/World_Boss_4.webp'
  },
  'singer': { photo: 'boss_SY_05', card: 'bigboss_SY_05' },
  'jormungand': { photo: 'boss_SY_09', card: 'bigboss_SY_09' },
  'hyena-mech': { photo: 'boss002', card: 'bigboss002' },
  'nan-yin': { photo: 'boss_hum_062', card: 'bigboss_SY_062' },
  'asurada': { photo: 'boss_hum_073', card: 'bigboss073' },
  'hive-mother': { photo: 'bigboss_SY_064', card: 'bigboss_SY_064' },
  'gu-chen': { photo: 'Boss_hum_060', card: 'bigboss060' },
  'xing-tian': { photo: 'boss025', card: 'bigboss025' },
  'ying-zhao': { photo: 'Boss_hum_061', card: 'bigboss061' },
  'sphere': { photo: 'boss_hum_075', card: 'bigboss075' },
  'franken': { photo: 'boss005', card: 'bigboss005' },
  'barbarossa': { photo: 'boss_SY_03', card: 'bigboss_SY_03' },
  'zhuyan': { photo: 'boss_SY_10', card: 'bigboss_SY_10' },
  'habaka': { photo: 'boss_hum_018', card: 'bigboss018' },
  'fei-lian': { photo: 'BOSS_FL', card: 'bigboss_FL' },
  'nanto': { photo: 'BOSS_ND', card: 'bigboss_ND' },
  'chiron': { photo: 'boss004', card: 'bigboss004' },
  'eva': { photo: 'Boss_hum_069', card: 'bigboss069' },
  'phantasmic-scorpion': { photo: 'Boss_hum_074', card: 'bigboss074' },
  'defender': { photo: 'boss_hum_079', card: 'bigboss079' },
  'black-crow': { photo: 'boss_hum_059', card: 'bigboss059' },
  'robarg': { photo: 'boss001', card: 'bigboss001' },
  'ground-controller': { photo: 'Boss_hum_078', card: 'bigboss078' }
};

function extractBossNumber(str) {
  if (!str) return null;
  const match = String(str).match(/boss(?:_hum)?_?#?0*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function getMechanicsCount(d) {
  if (!d) return 0;
  if (Array.isArray(d.en && d.en.mechanics)) return d.en.mechanics.length;
  if (Array.isArray(d.ru && d.ru.mechanics)) return d.ru.mechanics.length;
  if (Array.isArray(d.mechanics)) return d.mechanics.length;
  return 0;
}

const FCE_MEDIA_PREFIX = "/datamine/shared/media/Hotta/Content/";
const FCE_PLACEHOLDER = `${FCE_MEDIA_PREFIX}Resources/UI/void/boss/placeholder-boss.webp`;

function normalizeCuratedMediaUrl(value) {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\\/g, "/");
  return clean.startsWith(FCE_MEDIA_PREFIX) && clean.toLowerCase().endsWith(".webp")
    ? clean
    : null;
}

function canonicalUrlToAssetRef(publicUrl) {
  const canonical = normalizeCuratedMediaUrl(publicUrl);
  if (!canonical) return null;
  const packagePath = canonical.slice(FCE_MEDIA_PREFIX.length).replace(/\.webp$/i, "");
  const leaf = path.posix.basename(packagePath);
  return `/Game/${packagePath}.${leaf}`;
}

function copyFceMedia(imageCopier, publicUrl, role, slug, options: Record<string, any> = {}) {
  if (!imageCopier) {
    const thumb = options.thumbnail
      ? publicUrl.replace(/\.webp$/i, ".thumb.webp")
      : publicUrl;
    return {
      publicUrl,
      preferredFull: publicUrl,
      preferredThumb: thumb,
      fcePngDownloadUrl: options.preservePng === false ? null : publicUrl.replace(/\.webp$/i, ".png")
    };
  }

  const assetRef = canonicalUrlToAssetRef(publicUrl);
  if (!assetRef) throw new Error(`[fce-index] Non-canonical curated ${role} for ${slug}: ${publicUrl}`);
  const copied = imageCopier.copyAsset("fce", assetRef, role, {
    structured: true,
    entityId: slug,
    preservePng: options.preservePng === true,
    thumbnail: options.thumbnail || null,
    forceThumbnail: options.forceThumbnail === true
  });
  if (!copied) throw new Error(`[fce-index] Missing exact ${role} source for ${slug}: ${assetRef}`);
  return copied;
}

/**
 * Builds datamine/fce/data/fce-ladder.json from BorderWarSeasonDataTable
 */
function buildLadder(rawDir, fceDir, projectRoot) {
  const fceDataDir = path.join(fceDir, "data");
  const bossesDir = path.join(fceDataDir, "bosses");
  const ladderPath = path.join(fceDataDir, "fce-ladder.json");

  // Check required table
  const bwSeasonFile = findFile(rawDir, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable/BorderWarSeasonDataTable.json",
    "BorderWarSeasonDataTable.json"
  ]);

  if (!bwSeasonFile) {
    throw new Error(
      "[required] BorderWarSeasonDataTable is missing. STOP and tell the user to add ExportPath: Hotta/Content/Resources/CoreBlueprints/DataTable/BorderWarSeasonDataTable.uasset:json and run export."
    );
  }

  // Load curated boss cards
  const curatedBosses = [];
  if (fs.existsSync(bossesDir)) {
    const files = fs.readdirSync(bossesDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const card = readJsonFile(path.join(bossesDir, file));
      if (card) curatedBosses.push(card);
    }
  }

  // Load shared enemies
  const enemiesFile = path.join(projectRoot, "datamine", "shared-data", "enemies.json");
  const sharedEnemies = readJsonFile(enemiesFile) || {};

  // Load DT_MonsterStaticData
  const monsterStaticFile = findFile(rawDir, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable/DT_MonsterStaticData.json",
    "DT_MonsterStaticData.json"
  ]);
  const monsterRows = monsterStaticFile ? (readJsonFile(monsterStaticFile)?.[0]?.Rows || {}) : {};

  // Load Localization
  const locEnFile = findFile(rawDir, ["Hotta/Content/Localization/Game/en/Game.json", "Game/en/Game.json"]);
  const locRuFile = findFile(rawDir, ["Hotta/Content/Localization/Game/ru/Game.json", "Game/ru/Game.json"]);
  const locResolver = createLocalizationResolver();
  if (locEnFile) locResolver.loadLocale("en", readJsonFile(locEnFile));
  if (locRuFile) locResolver.loadLocale("ru", readJsonFile(locRuFile));

  const bwSeasonData = readJsonFile(bwSeasonFile);
  const seasonRows = bwSeasonData ? (bwSeasonData[0]?.Rows || bwSeasonData.Rows || {}) : {};

  // Extract unique stages
  const uniqueStages = new Map<any, any>();
  for (const [seasonKey, seasonData] of Object.entries(seasonRows)) {
    const bossList = seasonData.BorderWarAllBossList || [];
    bossList.forEach((b, index) => {
      const mapName = b.BorderWarMapName || `BorderWar_Stage_${index}`;
      if (!uniqueStages.has(mapName)) {
        uniqueStages.set(mapName, {
          seasonFirstSeen: parseInt(seasonKey, 10) || 1,
          seasonIndex: index,
          rawBoss: b
        });
      }
    });
  }

  const stageEntries = Array.from(uniqueStages.entries()).map(([mapName, info]) => {
    const b = info.rawBoss;
    const waves = b.AllChallengeWaves || [];
    const level = waves.length ? (waves[0].BossLevel || 90) : 90;
    return {
      mapName,
      level,
      seasonFirstSeen: info.seasonFirstSeen,
      seasonIndex: info.seasonIndex,
      rawBoss: b,
      waves
    };
  });

  // Sort: by level ascending, then by order of appearance across seasons
  stageEntries.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    if (a.seasonFirstSeen !== b.seasonFirstSeen) return a.seasonFirstSeen - b.seasonFirstSeen;
    return a.seasonIndex - b.seasonIndex;
  });

  const ladder = stageEntries.map((entry) => {
    const b = entry.rawBoss;
    const waves = entry.waves;
    const attributeIds = waves.map((w) => w.AttributeID);

    // Match curated boss card
    let matchedCurated = null;
    for (const attrId of attributeIds) {
      const bossNum = extractBossNumber(attrId);
      matchedCurated = curatedBosses.find((c) => {
        const cNum = extractBossNumber(c.boss_id || c.slug);
        return (
          (cNum !== null && bossNum !== null && cNum === bossNum) ||
          (c.boss_id && attrId.toLowerCase().startsWith(c.boss_id.toLowerCase()))
        );
      });
      if (matchedCurated) break;
    }

    if (!matchedCurated && attributeIds.some((id) => id.toLowerCase().startsWith("bjzq"))) {
      matchedCurated = curatedBosses.find((c) => c.slug === "valkyrie");
    }

    const nameEn = matchedCurated
      ? (matchedCurated.en?.name || matchedCurated.name)
      : (b.BossName?.SourceString || entry.mapName);
    const nameRu = matchedCurated
      ? (matchedCurated.ru?.name || matchedCurated.name_ru || nameEn)
      : nameEn;

    const waveEntries = waves.map((w, waveIdx) => {
      const attrId = w.AttributeID;
      const mon =
        sharedEnemies[attrId] ||
        Object.entries(sharedEnemies).find(([k]) => k.toLowerCase() === attrId.toLowerCase())?.[1] ||
        {};
      const monRow = monsterRows[attrId] || {};

      const curatedMechEn =
        matchedCurated?.en?.mechanics?.[waveIdx]?.html ||
        matchedCurated?.en?.mechanics?.[waveIdx]?.text ||
        "";
      const curatedMechRu =
        matchedCurated?.ru?.mechanics?.[waveIdx]?.html ||
        matchedCurated?.ru?.mechanics?.[waveIdx]?.text ||
        curatedMechEn;

      const modeNameEn = locResolver.resolve(w.ModeName, { locale: "en", defaultNamespace: "BorderWar", fallbackCodename: `Phase ${waveIdx + 1}`, fallbackSourceRow: w }).text || `Phase ${waveIdx + 1}`;
      const modeNameRu = locResolver.resolve(w.ModeName, { locale: "ru", fallbackLocale: "en", defaultNamespace: "BorderWar", fallbackCodename: `Фаза ${waveIdx + 1}`, fallbackSourceRow: w }).text || `Фаза ${waveIdx + 1}`;

      const modeDescEn =
        curatedMechEn ||
        cleanHtmlTags(locResolver.resolve(w.ModeDesc, { locale: "en", defaultNamespace: "BorderWar", fallbackSourceRow: w }).text || "");
      const modeDescRu =
        curatedMechRu ||
        cleanHtmlTags(locResolver.resolve(w.ModeDesc, { locale: "ru", fallbackLocale: "en", defaultNamespace: "BorderWar", fallbackSourceRow: w }).text || modeDescEn);

      const rawHp = mon.stats?.hp || Number(monRow.MaxHealth) || null;
      const rawAtk = mon.stats?.atk || Number(monRow.CommonAtkBase) || null;
      const rawDef = mon.stats?.def || Number(monRow.PhyDefBase) || null;
      const bLvl = w.BossLevel || entry.level || 90;
      const strengthX = rawDef || 1500;
      const res = TofFormulas.calcResist(strengthX, bLvl);
      const effHp = TofFormulas.calcEffectiveHp(rawHp, strengthX, bLvl);

      return {
        attribute_id: attrId,
        boss_id: w.BossID || "",
        boss_level: bLvl,
        weak_buff_count: w.WeakBuffCount || 0,
        mode_name_en: modeNameEn,
        mode_name_ru: modeNameRu,
        mode_desc_en: modeDescEn,
        mode_desc_ru: modeDescRu,
        stats: {
          hp: rawHp,
          hpFormatted: rawHp ? rawHp.toLocaleString("en-US") : null,
          effectiveHp: effHp.effectiveHp || null,
          effectiveHpFormatted: effHp.effectiveHpFormatted || null,
          atk: rawAtk,
          atkFormatted: rawAtk ? rawAtk.toLocaleString("en-US") : null,
          def: rawDef,
          defFormatted: rawDef ? rawDef.toLocaleString("en-US") : null,
          X: strengthX,
          resistK: res.K,
          resistPct: res.resistPct,
          resistPercent: Number((res.resistPct * 100).toFixed(1)),
          element: mon.element || null
        }
      };
    });

    return {
      level: entry.level,
      boss_key: entry.mapName,
      name_en: nameEn,
      name_ru: nameRu,
      attribute_ids: attributeIds,
      waves: waveEntries
    };
  });

  fs.writeFileSync(ladderPath, JSON.stringify(ladder, null, 2) + "\n", "utf8");
  console.log(`[fce-ladder] Wrote ${ladder.length} ladder bosses -> ${path.relative(process.cwd(), ladderPath)}`);

  const fce2DataDir = path.join(projectRoot, "datamine", "fce2", "data");
  if (fs.existsSync(fce2DataDir)) {
    const fce2LadderPath = path.join(fce2DataDir, "fce-ladder.json");
    fs.writeFileSync(fce2LadderPath, JSON.stringify(ladder, null, 2) + "\n", "utf8");
    console.log(`[fce-ladder] Wrote ${ladder.length} ladder bosses -> ${path.relative(process.cwd(), fce2LadderPath)}`);
  }
  return ladder;
}

/**
 * Extracts ladder stages for MMO BorderWar from BorderWarSeasonDataTable_MMO.json.
 */
function extractMmoLadder(rawDir) {
  const bwMmoFile = findFile(rawDir, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/BorderWarSeasonDataTable_MMO.json",
    "DataTable_MMO/BorderWarSeasonDataTable_MMO.json",
    "BorderWarSeasonDataTable_MMO.json"
  ]);
  if (!bwMmoFile) return [];
  const mmoData = readJsonFile(bwMmoFile);
  const rows = mmoData ? (mmoData[0]?.Rows || mmoData.Rows || {}) : {};
  const stages = [];
  const seasonKeys = Object.keys(rows).sort((a, b) => Number(a) - Number(b));
  for (const sKey of seasonKeys) {
    if (Number(sKey) < 2) continue;
    for (const b of rows[sKey]?.BorderWarAllBossList || []) {
      const existing = stages.find((s) => s.boss_key === b.BorderWarMapName);
      if (!existing) {
        stages.push({
          level: b.AllChallengeWaves?.[0]?.BossLevel || 29,
          boss_key: b.BorderWarMapName,
          attribute_ids: (b.AllChallengeWaves || []).map((w) => w.AttributeID)
        });
      }
    }
  }
  return stages;
}

/**
 * Release order from BorderWarSeasonDataTable (rows = seasons, BorderWarAllBossList =
 * maps of that season). A map present in every season is a permanent boss; any other
 * boss is dated by the first season that lists it, then by its slot in that season.
 */
function readSeasonRelease(rawDir) {
  const file = findFile(rawDir, [
    "Hotta/Content/Resources/CoreBlueprints/DataTable/BorderWarSeasonDataTable.json",
    "BorderWarSeasonDataTable.json"
  ]);
  const data = file ? readJsonFile(file) : null;
  const rows = data ? (data[0]?.Rows || data.Rows || {}) : {};
  const seasons = Object.entries(rows).sort(([a], [b]) => Number(a) - Number(b));
  const maps = new Map<any, any>();
  seasons.forEach(([, season], seasonIndex) => {
    (season.BorderWarAllBossList || []).forEach((boss, slot) => {
      const mapName = boss.BorderWarMapName;
      if (!mapName) return;
      const entry = maps.get(mapName) || { mapName, firstSeason: seasonIndex, slot, seasons: 0, attributeIds: [] };
      entry.seasons++;
      for (const wave of boss.AllChallengeWaves || []) if (wave.AttributeID) entry.attributeIds.push(wave.AttributeID);
      maps.set(mapName, entry);
    });
  });
  return [...maps.values()].map((entry) => ({ ...entry, permanent: seasons.length > 1 && entry.seasons === seasons.length }));
}

function releaseEntryFor(release, card, slug) {
  const bossNum = extractBossNumber(card.boss_id || slug);
  return release.find((entry) => entry.attributeIds.some((attr) =>
    (card.boss_id && attr.toLowerCase().startsWith(card.boss_id.toLowerCase())) ||
    (bossNum !== null && extractBossNumber(attr) === bossNum) ||
    (slug === "valkyrie" && attr.toLowerCase().startsWith("bjzq"))
  )) || null;
}

/**
 * Builds datamine/fce/data/fce-index.json or fce-index-mmo.json from curated boss cards
 */
function buildIndex(fceDir, ladder = [], imageCopier = null, options: Record<string, any> = {}) {
  const fceDataDir = path.join(fceDir, "data");
  const isMmo = options.mode === "mmo" || options.bossesDirName === "bosses-mmo";
  const bossesDirName = options.bossesDirName || (isMmo ? "bosses-mmo" : "bosses");
  const indexFileName = options.indexFileName || (isMmo ? "fce-index-mmo.json" : "fce-index.json");
  const bossesDir = path.join(fceDataDir, bossesDirName);
  const indexPath = path.join(fceDataDir, indexFileName);

  if (!fs.existsSync(bossesDir)) {
    throw new Error(`Per-boss directory not found: ${bossesDir}`);
  }

  const files = fs
    .readdirSync(bossesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error(`[required] FCE boss-card directory is empty: ${bossesDir}`);

  const bossBySlug = new Map<any, any>();
  for (const file of files) {
    const data = readJsonFile(path.join(bossesDir, file));
    const slug = data.slug || path.basename(file, ".json");
    bossBySlug.set(slug, data);
  }

  const slugs = [...bossBySlug.keys()];
  const curatedOrder = (slug) => (Number.isFinite(Number(bossBySlug.get(slug).order))
    ? Number(bossBySlug.get(slug).order)
    : Number.POSITIVE_INFINITY);
  // Game release order: permanent maps, then bosses the season table no longer lists
  // (kept in their curated order), then rotating bosses by first season and slot.
  const release = options.release || [];
  const releaseKey = (slug) => {
    const entry = releaseEntryFor(release, bossBySlug.get(slug), slug);
    if (!entry) return [1, curatedOrder(slug), 0];
    return entry.permanent ? [0, entry.slot, 0] : [2, entry.firstSeason, entry.slot];
  };
  slugs.sort((a, b) => {
    if (release.length > 0) {
      const ka = releaseKey(a);
      const kb = releaseKey(b);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    const oa = curatedOrder(a);
    const ob = curatedOrder(b);
    if (oa !== ob) return oa - ob;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const activeLadder = (isMmo && options.mmoLadder && options.mmoLadder.length > 0)
    ? options.mmoLadder
    : ladder;

  const bosses = slugs.map((slug, i) => {
    const d = bossBySlug.get(slug);
    const bossNum = extractBossNumber(d.boss_id || slug);
    const mechanicsCount = getMechanicsCount(d);

    // Check if boss matches ladder
    const ladderHit = activeLadder.find((lb) => {
      if (lb.attribute_ids?.some((attr) => d.boss_id && attr.toLowerCase().startsWith(d.boss_id.toLowerCase()))) {
        return true;
      }
      if (bossNum !== null && lb.attribute_ids?.some((attr) => extractBossNumber(attr) === bossNum)) {
        return true;
      }
      if (slug === "valkyrie" && (lb.boss_key === "BorderWar_D92" || lb.attribute_ids?.some((attr) => attr.toLowerCase().startsWith("bjzq")))) {
        return true;
      }
      return false;
    });

    const canonicalMap = FCE_BOSS_CANONICAL_MEDIA[slug] || null;
    const toMappedMediaUrl = (value) => {
      if (!value) return null;
      return String(value).startsWith('/')
        ? normalizeCuratedMediaUrl(value)
        : `${FCE_MEDIA_PREFIX}Resources/UI/void/boss/${value}.webp`;
    };
    const mappedCard = canonicalMap ? toMappedMediaUrl(canonicalMap.card) : null;
    const mappedPhoto = canonicalMap ? toMappedMediaUrl(canonicalMap.photo) : null;

    // The curated card owns the exact visual binding. The fixed catalog is a
    // compatibility fallback for current known cards only; no filename is
    // synthesized from boss IDs for unknown future entries.
    const curatedCard = mappedCard || normalizeCuratedMediaUrl(d.art) || FCE_PLACEHOLDER;
    const curatedPhoto = mappedPhoto || normalizeCuratedMediaUrl(d.preview) || curatedCard;
    const thumbSpec = { maxDimension: 96, quality: 82 };
    const cardMedia = copyFceMedia(imageCopier, curatedCard, "fce_boss_card", slug, {
      preservePng: true,
      thumbnail: thumbSpec
    });

    const displayWebpUrl = cardMedia.preferredFull || cardMedia.publicUrl;
    const cardThumbnail = cardMedia.preferredThumb || displayWebpUrl;
    const downloadPngUrl = cardMedia.fcePngDownloadUrl || null;
    // Every compact FCE/OOW/Sequential portrait must be the same artwork as
    // the boss card.  The old `photo` role frequently points at a scenery or
    // wide encounter texture (boss_hum_*), which is a different visual even
    // when it belongs to the same entity. Keep its provenance in the index,
    // but never select it for a visible portrait.
    const lineupPortrait = displayWebpUrl;
    const lineupPortraitThumb = cardThumbnail;
    const detailImage = displayWebpUrl;

    return {
      slug,
      order: i + 1,
      boss_id: d.boss_id || undefined,
      boss_num: bossNum !== null ? bossNum : undefined,
      name: (d.en && d.en.name) || d.name || slug,
      name_ru: (d.ru && d.ru.name) || undefined,
      name_color: d.name_color || undefined,
      art: displayWebpUrl,
      preview: cardThumbnail,
      displayWebpUrl,
      cardThumbnail,
      downloadPngUrl: downloadPngUrl || undefined,
      lineupPortrait,
      lineupPortraitThumb,
      detailImage,
      sourcePhotoAssetRef: canonicalUrlToAssetRef(curatedPhoto) || undefined,
      sourceAssetRef: canonicalUrlToAssetRef(curatedCard),
      normalizedPackagePath: displayWebpUrl
        .replace(/^\/datamine\/shared\/media\//, "")
        .replace(/\.webp$/i, ""),
      mechanics_count: mechanicsCount,
      ladder_level: ladderHit?.level || undefined,
      ladder_key: ladderHit?.boss_key || undefined
    };
  });

  // Drop undefined keys for clean output.
  const cleaned = bosses.map((b) => {
    const o: Record<string, any> = {};
    for (const [k, v] of Object.entries(b)) if (v !== undefined) o[k] = v;
    return o;
  });
  if (cleaned.length === 0) throw new Error("[required] FCE index produced zero bosses.");

  const outputContent = JSON.stringify({ bosses: cleaned }, null, 2) + "\n";
  const existingContent = fs.existsSync(indexPath) ? readGameSourceFileSync(indexPath, "utf8") : null;
  if (existingContent !== outputContent) {
    fs.writeFileSync(indexPath, outputContent, "utf8");
    console.log(`[fce-index] Wrote ${cleaned.length} bosses -> ${path.relative(process.cwd(), indexPath)}`);
  } else {
    console.log(`[fce-index] Kept unchanged ${cleaned.length} bosses -> ${path.relative(process.cwd(), indexPath)}`);
  }
  return cleaned.length;
}

function buildMmoIndex(fceDir, ladder = [], imageCopier = null, options: Record<string, any> = {}) {
  return buildIndex(fceDir, ladder, imageCopier, { mode: "mmo", ...options });
}

function main() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const fceDir = resolveFceDir(projectRoot);

  const modeArg = process.argv.find((a) => a.startsWith("--mode="));
  const modeVal = modeArg ? modeArg.split("=")[1].toLowerCase() : null;
  const isMmoOnly = process.argv.includes("--mmo") || modeVal === "mmo";
  const isStandardOnly = process.argv.includes("--standard") || modeVal === "standard";

  let ladder = [];
  const ladderPath = path.join(fceDir, "data", "fce-ladder.json");
  if (process.argv.includes("--build-ladder") || !fs.existsSync(ladderPath)) {
    if (!isMmoOnly) {
      try {
        ladder = buildLadder(rawDir, fceDir, projectRoot);
      } catch (err) {
        console.warn(`[fce-ladder] Notice: ${err.message}`);
      }
    }
  } else {
    ladder = readJsonFile(ladderPath) || [];
  }

  const imageCopier = new ImageCopier(rawDir, projectRoot);

  if (!isMmoOnly) {
    buildIndex(fceDir, ladder, imageCopier, { mode: "standard", release: readSeasonRelease(rawDir) });
  }

  const mmoBossesDir = path.join(fceDir, "data", "bosses-mmo");
  if (!isStandardOnly && fs.existsSync(mmoBossesDir)) {
    let mmoLadder = [];
    try {
      mmoLadder = extractMmoLadder(rawDir);
    } catch (err) {
      console.warn(`[fce-mmo-ladder] Notice: ${err.message}`);
    }
    buildIndex(fceDir, mmoLadder.length > 0 ? mmoLadder : ladder, imageCopier, {
      mode: "mmo",
      mmoLadder
    });
  }
}

if (require.main === module) {
  main();
}

export {
  buildLadder,
  buildIndex,
  buildMmoIndex,
  extractMmoLadder,
  FCE_BOSS_CANONICAL_MEDIA,
};

