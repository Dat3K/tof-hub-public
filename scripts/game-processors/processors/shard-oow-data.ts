import fs from 'node:fs';
import path from 'node:path';

const rootArg = process.argv.find((arg) => arg.startsWith('--project-root='));
const projectRoot = rootArg
  ? path.resolve(rootArg.slice('--project-root='.length))
  : path.resolve(__dirname, '..', '..');
const OOW_DIR = path.join(projectRoot, 'datamine', 'oow', 'data');
const SEASONS_DIR = path.join(OOW_DIR, 'seasons');
const CURRENT_DIR = path.join(OOW_DIR, 'current');

function createLightweightFloor(fl) {
  return {
    floor: fl.floor,
    unlockDay: fl.unlockDay,
    mobCount: fl.mobCount !== undefined ? fl.mobCount : (fl.enemies ? fl.enemies.length : null),
    totalHp: fl.totalHp ?? null,
    totalHpBillions: fl.totalHpBillions ?? null,
    maxHp: fl.maxHp ?? null,
    maxHpBillions: fl.maxHpBillions ?? null,
    X: fl.X ?? fl.resistanceInfo?.X ?? null,
    resistK: fl.resistK ?? fl.resistanceInfo?.resistK ?? null,
    resistPct: fl.resistPct ?? fl.resistanceInfo?.resistPct ?? null,
    resistPercent: fl.resistPercent ?? fl.resistanceInfo?.resistPercent ?? null,
    effectiveHp: fl.effectiveHp ?? fl.resistanceInfo?.effectiveHp ?? null,
    effHp: fl.effHp ?? fl.resistanceInfo?.effectiveHp ?? null,
    effectiveHpFormatted: fl.effectiveHpFormatted ?? fl.resistanceInfo?.effectiveHpFormatted ?? null,
    effectiveHpBillions: fl.effectiveHpBillions ?? null,
    maxMobEffectiveHp: fl.maxMobEffectiveHp ?? null,
    maxMobEffectiveHpFormatted: fl.maxMobEffectiveHpFormatted ?? null,
    rewardDropId: fl.rewardDropId,
    helpPoints: fl.helpPoints,
    difficultySchedule: fl.difficultySchedule || null,
    resistanceInfo: fl.resistanceInfo || null,
    mutatorCount: (fl.stageMutators || []).length,
    dropBuffCount: (fl.dropBuffs || []).length,
    waveCount: (fl.enemies && fl.enemies.length) ? Math.max(1, ...fl.enemies.map(e => e.wave || 1)) : 1
  };
}

function getStrongestEnemyOnFloor(floor) {
  if (!floor || !Array.isArray(floor.enemies) || floor.enemies.length === 0) return null;
  const enemies = [...floor.enemies];
  enemies.sort((a, b) => {
    const ehpA = Number(a.effectiveHp ?? a.effHp ?? (a.hp ? a.hp * (floor.resistanceInfo?.ehpMultiplier || 1) : (a.stats?.MaxHealth || 0)));
    const ehpB = Number(b.effectiveHp ?? b.effHp ?? (b.hp ? b.hp * (floor.resistanceInfo?.ehpMultiplier || 1) : (b.stats?.MaxHealth || 0)));
    if (ehpB !== ehpA) return ehpB - ehpA;
    const hpA = Number(a.singleHp ?? a.maxHp ?? a.hp ?? a.stats?.MaxHealth ?? 0);
    const hpB = Number(b.singleHp ?? b.maxHp ?? b.hp ?? b.stats?.MaxHealth ?? 0);
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

  const top = enemies[0];
  const topEhp = Number(top.effectiveHp ?? top.effHp ?? (top.hp ? top.hp * (floor.resistanceInfo?.ehpMultiplier || 1) : 0));
  const tied = enemies.filter((e) => {
    const ehp = Number(e.effectiveHp ?? e.effHp ?? (e.hp ? e.hp * (floor.resistanceInfo?.ehpMultiplier || 1) : 0));
    return Math.abs(ehp - topEhp) < 1;
  });

  return {
    ...top,
    effectiveHp: top.effectiveHp || floor.maxMobEffectiveHp || topEhp,
    tiedCandidates: tied.length > 1 ? tied.map(t => String(t.normalizedMonsterClass || t.monsterClass || t.blueprint || t.nameEn || '')) : undefined
  };
}

function createLightweightSeason(s) {
  const lastFl = (s.floors && s.floors.length) ? s.floors[s.floors.length - 1] : null;
  const strongestEnemy = getStrongestEnemyOnFloor(lastFl) || s.strongestEnemy || null;

  const strongestEnemyObj = strongestEnemy ? {
    normalizedMonsterClass: strongestEnemy.normalizedMonsterClass || null,
    monsterClass: strongestEnemy.monsterClass || strongestEnemy.blueprint || null,
    nameEn: strongestEnemy.nameEn || null,
    nameRu: strongestEnemy.nameRu || null,
    rawHp: strongestEnemy.rawHp ?? strongestEnemy.hp ?? null,
    rawHpFormatted: strongestEnemy.rawHpFormatted ?? strongestEnemy.hpFormatted ?? null,
    effectiveHp: strongestEnemy.effectiveHp ?? strongestEnemy.effHp ?? lastFl?.maxMobEffectiveHp ?? null,
    effectiveHpFormatted: strongestEnemy.effectiveHpFormatted ?? strongestEnemy.effHpFormatted ?? lastFl?.maxMobEffectiveHpFormatted ?? null,
    imageAssetPath: strongestEnemy.imageAssetPath || strongestEnemy.image || null,
    image: strongestEnemy.image || null,
    imageThumb: strongestEnemy.imageThumb || null,
    fullUrl: strongestEnemy.fullUrl || strongestEnemy.detailImageFull || strongestEnemy.lineupPortraitFull || strongestEnemy.image || null,
    thumbUrl: strongestEnemy.thumbUrl || strongestEnemy.detailImageThumb || strongestEnemy.lineupPortraitThumb || strongestEnemy.imageThumb || null,
    imageMatchStatus: strongestEnemy.imageMatchStatus || null,
    imageSource: strongestEnemy.imageSource || null,
    tiedCandidates: strongestEnemy.tiedCandidates || undefined
  } : null;

  const bossImage = strongestEnemyObj?.image || (s.bossImage && !s.bossImage.includes('touxiang') && !s.bossImage.includes('yuan.png') ? s.bossImage : null) || (s.finalBossImage && !s.finalBossImage.includes('touxiang') && !s.finalBossImage.includes('yuan.png') ? s.finalBossImage : null) || null;
  const bossImageThumb = strongestEnemyObj?.thumbUrl || strongestEnemyObj?.imageThumb || bossImage || null;
  const bossImageDT = strongestEnemy?.imageDT || s.bossImageDT || s.finalBossImageDT || null;
  const bossPortraitRound = null;
  const bossName = strongestEnemyObj?.nameEn || s.bossName || s.finalBossName || null;
  const bossNameRu = strongestEnemyObj?.nameRu || s.bossNameRu || s.finalBossNameRu || null;

  const pad = String(s.season).padStart(2, '0');
  const filename = s.seasonType === 'MMO' ? `mmo_s${pad}.json` : `s${pad}.json`;

  return {
    season: s.season,
    title: s.title,
    startDate: s.startDate,
    endDate: s.endDate,
    floorCount: s.floorCount || (s.floors ? s.floors.length : 0),
    minFloor: s.minFloor || 1,
    maxFloor: s.maxFloor || (s.floors ? s.floors.length : 28),
    totalSeasonHp: s.totalSeasonHp,
    totalSeasonHpBillions: s.totalSeasonHpBillions,
    totalSeasonEffectiveHp: s.totalSeasonEffectiveHp ?? null,
    totalSeasonEffectiveHpBillions: s.totalSeasonEffectiveHpBillions ?? null,
    finalBossHp: strongestEnemyObj?.rawHp || s.finalBossHp || null,
    finalBossEffectiveHp: strongestEnemyObj?.effectiveHp || s.finalBossEffectiveHp || null,
    strongestEnemy: strongestEnemyObj,
    bossImage,
    bossImageThumb,
    bossImageDT,
    bossPortraitRound,
    bossName,
    bossNameRu,
    finalBossImage: bossImage,
    finalBossImageThumb: bossImageThumb,
    finalBossImageDT: bossImageDT,
    finalBossPortraitRound: bossPortraitRound,
    finalBossName: bossName,
    finalBossNameRu: bossNameRu,
    maxDifficulty: s.maxDifficulty,
    curveProfile: s.curveProfile,
    resistanceInfo: s.resistanceInfo || null,
    shardPath: `seasons/${filename}`,
    cacheScope: 'season-index'
  };
}

function createSeasonMetadata(s) {
  const lastFl = (s.floors && s.floors.length) ? s.floors[s.floors.length - 1] : null;
  const strongestEnemy = getStrongestEnemyOnFloor(lastFl) || s.strongestEnemy || null;

  const strongestEnemyObj = strongestEnemy ? {
    normalizedMonsterClass: strongestEnemy.normalizedMonsterClass || null,
    monsterClass: strongestEnemy.monsterClass || strongestEnemy.blueprint || null,
    nameEn: strongestEnemy.nameEn || null,
    nameRu: strongestEnemy.nameRu || null,
    rawHp: strongestEnemy.rawHp ?? strongestEnemy.hp ?? null,
    rawHpFormatted: strongestEnemy.rawHpFormatted ?? strongestEnemy.hpFormatted ?? null,
    effectiveHp: strongestEnemy.effectiveHp ?? strongestEnemy.effHp ?? lastFl?.maxMobEffectiveHp ?? null,
    effectiveHpFormatted: strongestEnemy.effectiveHpFormatted ?? strongestEnemy.effHpFormatted ?? lastFl?.maxMobEffectiveHpFormatted ?? null,
    imageAssetPath: strongestEnemy.imageAssetPath || strongestEnemy.image || null,
    image: strongestEnemy.image || null,
    imageThumb: strongestEnemy.imageThumb || null,
    fullUrl: strongestEnemy.fullUrl || strongestEnemy.detailImageFull || strongestEnemy.lineupPortraitFull || strongestEnemy.image || null,
    thumbUrl: strongestEnemy.thumbUrl || strongestEnemy.detailImageThumb || strongestEnemy.lineupPortraitThumb || strongestEnemy.imageThumb || null,
    imageMatchStatus: strongestEnemy.imageMatchStatus || null,
    imageSource: strongestEnemy.imageSource || null,
    tiedCandidates: strongestEnemy.tiedCandidates || undefined
  } : null;

  const bossImage = strongestEnemyObj?.image || (s.bossImage && !s.bossImage.includes('touxiang') && !s.bossImage.includes('yuan.png') ? s.bossImage : null) || (s.finalBossImage && !s.finalBossImage.includes('touxiang') && !s.finalBossImage.includes('yuan.png') ? s.finalBossImage : null) || null;
  const bossImageThumb = strongestEnemyObj?.thumbUrl || strongestEnemyObj?.imageThumb || bossImage || null;
  const bossImageDT = strongestEnemy?.imageDT || s.bossImageDT || s.finalBossImageDT || null;
  const bossPortraitRound = null;
  const bossName = strongestEnemyObj?.nameEn || s.bossName || s.finalBossName || null;
  const bossNameRu = strongestEnemyObj?.nameRu || s.bossNameRu || s.finalBossNameRu || null;

  return {
    season: s.season,
    title: s.title,
    startDate: s.startDate,
    endDate: s.endDate,
    floorCount: s.floorCount || (s.floors ? s.floors.length : 0),
    minFloor: s.minFloor || 1,
    maxFloor: s.maxFloor || (s.floors ? s.floors.length : 28),
    strongestEnemy: strongestEnemyObj,
    bossImage,
    bossImageThumb,
    bossImageDT,
    bossPortraitRound,
    bossName,
    bossNameRu,
    finalBossImage: bossImage,
    finalBossImageThumb: bossImageThumb,
    finalBossName: bossName
  };
}

function parseSeasonDate(value, endOfDay = false) {
  if (!value) return null;
  const normalized = String(value).replace(/-/g, '/');
  const parsed = new Date(normalized + (endOfDay ? ' 23:59:59' : ''));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function selectCurrentSeason(seasons, now = new Date()) {
  if (!Array.isArray(seasons) || !seasons.length) return null;
  const active = seasons.find((season) => {
    const start = parseSeasonDate(season.startDate);
    const end = parseSeasonDate(season.endDate, true);
    return start && end && now >= start && now <= end;
  });
  if (active) return active;
  const started = seasons.filter((season) => {
    const start = parseSeasonDate(season.startDate);
    return start && now >= start;
  });
  return started[started.length - 1] || seasons[seasons.length - 1];
}

function shardOowData() {
  const standardStatsPath = path.join(OOW_DIR, 'oow_stats.json');
  const mmoStatsPath = path.join(OOW_DIR, 'oow_mmo_stats.json');
  const datesPath = path.join(OOW_DIR, 'season_dates.json');
  const buffsPath = path.join(OOW_DIR, 'oow_buffs_catalog.json');

  if (!fs.existsSync(standardStatsPath)) {
    throw new Error(`[required] Missing ${standardStatsPath}; refusing to write an empty index.`);
  }
  const standardData = JSON.parse(fs.readFileSync(standardStatsPath, 'utf8'));
  const mmoData = fs.existsSync(mmoStatsPath) ? JSON.parse(fs.readFileSync(mmoStatsPath, 'utf8')) : { seasons: [] };
  const datesData = fs.existsSync(datesPath) ? JSON.parse(fs.readFileSync(datesPath, 'utf8')) : {};
  const buffsData = fs.existsSync(buffsPath) ? JSON.parse(fs.readFileSync(buffsPath, 'utf8')) : {};

  // 1. Write individual season deep files
  const standardSeasons = standardData.seasons || [];
  if (!Array.isArray(standardSeasons) || standardSeasons.length === 0) {
    throw new Error('[required] oow_stats.json contains zero seasons; existing shards were left untouched.');
  }
  if (!fs.existsSync(mmoStatsPath)) throw new Error(`[required] Missing ${mmoStatsPath}; refusing to retain stale MMO shards.`);
  if (!Array.isArray(mmoData.seasons) || mmoData.seasons.length === 0) throw new Error('[required] oow_mmo_stats.json contains zero seasons.');
  const token = `.stage3-${process.pid}-${Date.now()}`;
  const tempRoot = path.join(OOW_DIR, token);
  const tempSeasons = path.join(tempRoot, 'seasons');
  const tempCurrent = path.join(tempRoot, 'current');
  fs.mkdirSync(tempSeasons, { recursive: true });
  fs.mkdirSync(tempCurrent, { recursive: true });
  standardSeasons.forEach((s) => {
    const pad = String(s.season).padStart(2, '0');
    const filename = `s${pad}.json`;
    const filePath = path.join(tempSeasons, filename);
    fs.writeFileSync(filePath, JSON.stringify(s, null, 2), 'utf8');
  });

  const mmoSeasons = mmoData.seasons || [];
  mmoSeasons.forEach((s) => {
    const pad = String(s.season).padStart(2, '0');
    const filename = `mmo_s${pad}.json`;
    const filePath = path.join(tempSeasons, filename);
    fs.writeFileSync(filePath, JSON.stringify(s, null, 2), 'utf8');
  });

  // 2. Write optional lightweight bootstrap metadata. Full season payloads
  // always come from shards, including the default/current season.
  const currentStandard = selectCurrentSeason(standardSeasons);
  const currentMmo = selectCurrentSeason(mmoSeasons);
  const recentStandard = standardSeasons.slice(-3).map(createSeasonMetadata);
  const recentMmo = mmoSeasons.slice(-2).map(createSeasonMetadata);
  const currentSummary = {
    schemaVersion: 2,
    meta: {
      generatedAt: new Date().toISOString(),
      standardActiveSeason: currentStandard ? currentStandard.season : null,
      mmoActiveSeason: currentMmo ? currentMmo.season : null
    },
    recentSeasons: recentStandard,
    mmoRecentSeasons: recentMmo,
    currentSeason: currentStandard ? createSeasonMetadata(currentStandard) : null,
    mmoCurrentSeason: currentMmo ? createSeasonMetadata(currentMmo) : null
  };
  fs.writeFileSync(path.join(tempCurrent, 'summary.json'), JSON.stringify(currentSummary, null, 2), 'utf8');

  // 3. Write lightweight index.json (no embedded 2.8MB buff catalog or heavy floor arrays)
  const indexData = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalStandardSeasons: standardSeasons.length,
      totalMmoSeasons: mmoSeasons.length,
      standardActiveSeason: currentStandard ? currentStandard.season : null,
      mmoActiveSeason: currentMmo ? currentMmo.season : null,
      budget: 'slim-bootstrap'
    },
    standard: {
      seasons: standardSeasons.map(createLightweightSeason)
    },
    mmo: {
      seasons: mmoSeasons.map(createLightweightSeason)
    },
    dates: datesData
  };
  const tempIndex = path.join(tempRoot, 'index.json');
  fs.writeFileSync(tempIndex, JSON.stringify(indexData), 'utf8');

  const swaps = [
    [tempSeasons, SEASONS_DIR],
    [tempCurrent, CURRENT_DIR],
    [tempIndex, path.join(OOW_DIR, 'index.json')]
  ];
  const done = [];
  try {
    for (const [source, target] of swaps) {
      const backup = `${target}${token}-backup`;
      if (fs.existsSync(target)) fs.renameSync(target, backup);
      try { fs.renameSync(source, target); } catch (error) { if (fs.existsSync(backup)) fs.renameSync(backup, target); throw error; }
      done.push({ target, backup });
    }
  } catch (error) {
    for (const x of done.reverse()) {
      fs.rmSync(x.target, { recursive: true, force: true });
      if (fs.existsSync(x.backup)) fs.renameSync(x.backup, x.target);
    }
    throw error;
  }
  for (const x of done) {
    try { fs.rmSync(x.backup, { recursive: true, force: true }); }
    catch (error) { console.warn(`[oow-shards] Backup cleanup failed after successful swap: ${error.message}`); }
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (_) { /* non-public scratch */ }

  // Clean up intermediate monolithic build artifacts from public data directory
  for (const intermediate of ['oow_stats.json', 'oow_mmo_stats.json', 'oow_deep_intel.json', 'oow_current_seasons.json']) {
    const p = path.join(OOW_DIR, intermediate);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  }

  const indexSizeBytes = fs.statSync(path.join(OOW_DIR, 'index.json')).size;
  const currentSizeBytes = fs.statSync(path.join(CURRENT_DIR, 'summary.json')).size;

  return {
    standardCount: standardSeasons.length,
    mmoCount: mmoSeasons.length,
    indexSizeBytes,
    currentSizeBytes
  };
}

if (require.main === module) {
  console.log('--- Sharding OOW Datasets ---');
  const res = shardOowData();
  console.log(`✓ Generated ${res.standardCount} standard seasons + ${res.mmoCount} MMO seasons`);
  console.log(`✓ Generated index.json (${(res.indexSizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`✓ Generated current/summary.json (${(res.currentSizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`✓ Startup bundle size reduced to ~${((res.indexSizeBytes + res.currentSizeBytes) / 1024).toFixed(1)} KB!`);
}

export {
  shardOowData,
  createLightweightFloor,
  createLightweightSeason,
  createSeasonMetadata,
  selectCurrentSeason,
};
