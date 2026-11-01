import { readGameSourceFileSync } from './game-source-reader';
import { createLocalizationResolver } from './localization-resolver';
import { createEnemyIdentityResolver } from './enemy-identity';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import ImageCopier from './image-copier';

// Authoritative in-game weakness element metadata mapping to proven shared media icons
const WEAKNESS_ELEMENT_META = {
  Flame: {
    element: 'Flame',
    element_name_en: 'Flame',
    element_name_ru: 'Огненный',
    name_en: 'Flame Weakness',
    name_ru: 'Огненная слабость',
    icon: '/datamine/shared/assets/icons/elements/elem_fire.webp',
    icon_fallback: '/datamine/shared/assets/icons/elements/elem_fire.webp',
    icon_thumb: '/datamine/shared/assets/icons/elements/elem_fire.thumb.webp'
  },
  Frost: {
    element: 'Frost',
    element_name_en: 'Frost',
    element_name_ru: 'Ледяной',
    name_en: 'Frost Weakness',
    name_ru: 'Ледяная слабость',
    icon: '/datamine/shared/assets/icons/elements/elem_frost.webp',
    icon_fallback: '/datamine/shared/assets/icons/elements/elem_frost.webp',
    icon_thumb: '/datamine/shared/assets/icons/elements/elem_frost.thumb.webp'
  },
  Volt: {
    element: 'Volt',
    element_name_en: 'Volt',
    element_name_ru: 'Электро',
    name_en: 'Volt Weakness',
    name_ru: 'Электро слабость',
    icon: '/datamine/shared/assets/icons/elements/elem_volt.webp',
    icon_fallback: '/datamine/shared/assets/icons/elements/elem_volt.webp',
    icon_thumb: '/datamine/shared/assets/icons/elements/elem_volt.thumb.webp'
  },
  Physical: {
    element: 'Physical',
    element_name_en: 'Physical',
    element_name_ru: 'Физический',
    name_en: 'Physical Weakness',
    name_ru: 'Физическая слабость',
    icon: '/datamine/shared/assets/icons/elements/elem_phys.webp',
    icon_fallback: '/datamine/shared/assets/icons/elements/elem_phys.webp',
    icon_thumb: '/datamine/shared/assets/icons/elements/elem_phys.thumb.webp'
  },
  Altered: {
    element: 'Altered',
    element_name_en: 'Altered',
    element_name_ru: 'Инородный',
    name_en: 'Altered Weakness',
    name_ru: 'Инородная слабость',
    icon: '/datamine/shared/assets/icons/elements/elem_altered.webp',
    icon_fallback: '/datamine/shared/assets/icons/elements/elem_altered.webp',
    icon_thumb: '/datamine/shared/assets/icons/elements/elem_altered.thumb.webp'
  }
};

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-bygone] Error reading JSON at ${filePath}:`, e.message);
    return null;
  }
}

function normalizeMonsterImageRef(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';
  for (const key of [
    'AssetPathName',
    'sourceAssetRef',
    'lineupPortrait',
    'detailImage',
    'image',
    'publicUrl',
    'fullUrl',
    'full',
    'portrait',
    'card'
  ]) {
    const normalized = normalizeMonsterImageRef(value[key]);
    if (normalized) return normalized;
  }
  return '';
}

function resolveProjectRoot() {
  const customArg = process.argv.find((arg) => arg.startsWith('--project-root='));
  if (customArg) return path.resolve(customArg.slice('--project-root='.length));
  let cur = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
    cur = path.resolve(cur, '..');
  }
  return path.resolve(__dirname, '../..');
}

function resolveRawDir(projectRoot) {
  const customArg = process.argv.find((arg) => arg.startsWith('--raw-dir='));
  if (customArg) return path.resolve(customArg.split('=')[1]);

  const candidateDirs = [
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports'),
    path.join(projectRoot, 'raw_exports'),
    path.join(projectRoot, '..', 'temperary'),
    path.join(projectRoot, 'temperary'),
    path.join(projectRoot, '..', 'raw_exports')
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(projectRoot, 'raw_exports');
}

class RawArchiveReader {
  declare projectRoot: any;
  declare rawDir: any;
  declare zipPath: any;
  declare zipBuffer: any;
  declare zipEntries: any;

  constructor(projectRoot, rawDir) {
    this.projectRoot = projectRoot;
    this.rawDir = rawDir;
    this.zipPath = null;
    this.zipBuffer = null;
    this.zipEntries = new Map<any, any>();

    const zipCandidates = [
      path.join(projectRoot, 'tof-fast-datamine', 'raw_exports_full.zip'),
      path.join(projectRoot, 'raw_exports_full.zip'),
      path.join(projectRoot, 'tof-fast-datamine', 'raw_exports_small.zip'),
      path.join(projectRoot, 'raw_exports_small.zip')
    ];

    for (const zc of zipCandidates) {
      if (fs.existsSync(zc)) {
        this.zipPath = zc;
        this.initZip();
        break;
      }
    }
  }

  initZip() {
    try {
      const buf = readGameSourceFileSync(this.zipPath);
      this.zipBuffer = buf;
      let eocdPos = -1;
      for (let i = buf.length - 22; i >= 0; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) {
          eocdPos = i;
          break;
        }
      }
      if (eocdPos === -1) return;

      const cdOffset = buf.readUInt32LE(eocdPos + 16);
      const cdCount = buf.readUInt16LE(eocdPos + 10);

      let pos = cdOffset;
      for (let i = 0; i < cdCount; i++) {
        if (buf.readUInt32LE(pos) !== 0x02014b50) break;
        const method = buf.readUInt16LE(pos + 10);
        const compSize = buf.readUInt32LE(pos + 20);
        const uncompSize = buf.readUInt32LE(pos + 24);
        const nameLen = buf.readUInt16LE(pos + 28);
        const extraLen = buf.readUInt16LE(pos + 30);
        const commentLen = buf.readUInt16LE(pos + 32);
        const localOffset = buf.readUInt32LE(pos + 42);
        const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen).replace(/\\/g, '/');

        this.zipEntries.set(name.toLowerCase(), {
          name,
          method,
          compSize,
          uncompSize,
          localOffset
        });
        pos += 46 + nameLen + extraLen + commentLen;
      }
    } catch (e) {
      console.warn(`[build-bygone] Warning loading ZIP ${this.zipPath}:`, e.message);
    }
  }

  findAndRead(relCandidates) {
    // 1. Prefer reading directly from authoritative fresh ZIP if present
    if (this.zipBuffer && this.zipEntries.size > 0) {
      for (const rel of relCandidates) {
        const norm = rel.replace(/\\/g, '/').toLowerCase();
        const entry = this.zipEntries.get(norm);
        if (entry) {
          try {
            const loc = entry.localOffset;
            const localNameLen = this.zipBuffer.readUInt16LE(loc + 26);
            const localExtraLen = this.zipBuffer.readUInt16LE(loc + 28);
            const dataOffset = loc + 30 + localNameLen + localExtraLen;
            const compData = this.zipBuffer.subarray(dataOffset, dataOffset + entry.compSize);
            const rawText = entry.method === 8 ? zlib.inflateRawSync(compData).toString('utf8') : compData.toString('utf8');
            const cleanText = rawText.replace(/^\uFEFF/, '').trim();
            const sha256 = crypto.createHash('sha256').update(cleanText, 'utf8').digest('hex');
            return {
              data: JSON.parse(cleanText),
              sourcePath: `${path.relative(this.projectRoot, this.zipPath).replace(/\\/g, '/')}!${entry.name}`,
              fileName: path.basename(entry.name),
              sha256,
              fromZip: true
            };
          } catch (err) {
            console.warn(`[build-bygone] Error decompressing ${entry.name}:`, err.message);
          }
        }
      }
    }

    // 2. Fall back to extracted directory on disk
    for (const rel of relCandidates) {
      const full = path.join(this.rawDir, rel);
      if (fs.existsSync(full)) {
        try {
          const raw = readGameSourceFileSync(full, 'utf8').replace(/^\uFEFF/, '').trim();
          const sha256 = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
          return {
            data: JSON.parse(raw),
            sourcePath: path.relative(this.projectRoot, full).replace(/\\/g, '/'),
            fileName: path.basename(full),
            sha256,
            fromZip: false
          };
        } catch (e) {
          console.error(`[build-bygone] Error reading JSON at ${full}:`, e.message);
        }
      }
    }

    return null;
  }
}

function evaluateCurve(curve, time) {
  if (!curve || !curve.Keys || curve.Keys.length === 0) return 0;
  const keys = curve.Keys;
  if (time <= keys[0].Time) return Math.round(keys[0].Value);
  if (time >= keys[keys.length - 1].Time) return Math.round(keys[keys.length - 1].Value);

  const exact = keys.find((k) => k.Time === time);
  if (exact) return Math.round(exact.Value);

  for (let i = 0; i < keys.length - 1; i++) {
    const k1 = keys[i];
    const k2 = keys[i + 1];
    if (time >= k1.Time && time <= k2.Time) {
      const alpha = (time - k1.Time) / (k2.Time - k1.Time);
      return Math.round(k1.Value + alpha * (k2.Value - k1.Value));
    }
  }
  return 0;
}

function buildBygoneDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'datamine', 'bygone', 'data');

  console.log(`[build-bygone] Project root: ${projectRoot}`);
  console.log(`[build-bygone] Raw data dir: ${rawDir}`);

  const imageCopier = new ImageCopier(rawDir, projectRoot);
  const archiveReader = new RawArchiveReader(projectRoot, rawDir);

  const localization = createLocalizationResolver();
  for (const locale of ['en', 'ru']) {
    const file = path.join(rawDir, `Hotta/Content/Localization/Game/${locale}/Game.json`);
    if (fs.existsSync(file)) localization.loadLocale(locale, readJsonFile(file));
  }
  const resolveIdentity = createEnemyIdentityResolver(rawDir, localization);
  const identities = new Map<string, any>();

  // 1. Raw Data Files with Explicit Resolution Tracking
  const buffCountCandidates = [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/BigSecretBuffCount_Overseas.json',
    'Hotta/Content/Resources/Abilities/DataTables/BigSecretBuffCount.json',
    'BigSecretBuffCount_Overseas.json',
    'BigSecretBuffCount.json'
  ];
  const buffCountRes = archiveReader.findAndRead(buffCountCandidates);

  const buffPoolCandidates = [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/BigSecretBuffPoolDataTable_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/BigSecretBuffPoolDataTable.json',
    'BigSecretBuffPoolDataTable_Overseas.json',
    'BigSecretBuffPoolDataTable.json'
  ];
  const buffPoolRes = archiveReader.findAndRead(buffPoolCandidates);

  const seasonRoundCandidates = [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/BigSecretSeasonRoundDataTable_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/BigSecretSeasonRoundDataTable.json',
    'BigSecretSeasonRoundDataTable_Overseas.json',
    'BigSecretSeasonRoundDataTable.json'
  ];
  const seasonRoundRes = archiveReader.findAndRead(seasonRoundCandidates);

  const staticRoundCandidates = [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/BigSecretStaticRoundDataTable_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/BigSecretStaticRoundDataTable.json',
    'BigSecretStaticRoundDataTable_Overseas.json',
    'BigSecretStaticRoundDataTable.json'
  ];
  const staticRoundRes = archiveReader.findAndRead(staticRoundCandidates);

  const monsterPoolCandidates = [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_BigSecretMonsterPoolConfig_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/DT_BigSecretMonsterPoolConfig.json',
    'DT_BigSecretMonsterPoolConfig_Overseas.json',
    'DT_BigSecretMonsterPoolConfig.json'
  ];
  const monsterPoolRes = archiveReader.findAndRead(monsterPoolCandidates);

  const baseConfigCandidates = [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_BigSecretBaseConfig_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/DT_BigSecretBaseConfig.json',
    'DT_BigSecretBaseConfig_Overseas.json',
    'DT_BigSecretBaseConfig.json'
  ];
  const baseConfigRes = archiveReader.findAndRead(baseConfigCandidates);

  const monsterStaticCandidates = [
    'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/DT_MonsterStaticData.json',
    'DT_MonsterStaticData_Overseas.json',
    'DT_MonsterStaticData.json'
  ];
  const monsterStaticRes = archiveReader.findAndRead(monsterStaticCandidates);

  if (!buffCountRes || !buffCountRes.data) {
    console.error('[build-bygone] Critical: Missing required BigSecretBuffCount data table.');
    return null;
  }

  function describeSource(res, tableName) {
    if (!res) return { table: tableName, file: 'Not Found', variant: 'missing', is_overseas: false, sha256: null, path: 'Not Found' };
    const baseName = res.fileName;
    const isOverseas = baseName.includes('Overseas');
    const isMmo = baseName.includes('MMO');
    const variant = isOverseas
      ? 'Overseas / Global'
      : (isMmo ? 'MMO' : 'Base Standard (No _Overseas variant in game data)');
    return {
      table: tableName,
      file: baseName,
      path: res.sourcePath,
      variant,
      is_overseas: isOverseas,
      sha256: res.sha256
    };
  }

  const sources = {
    buffCount: describeSource(buffCountRes, 'BigSecretBuffCount'),
    buffPool: describeSource(buffPoolRes, 'BigSecretBuffPoolDataTable'),
    seasonRound: describeSource(seasonRoundRes, 'BigSecretSeasonRoundDataTable'),
    staticRound: describeSource(staticRoundRes, 'BigSecretStaticRoundDataTable'),
    monsterPool: describeSource(monsterPoolRes, 'DT_BigSecretMonsterPoolConfig'),
    baseConfig: describeSource(baseConfigRes, 'DT_BigSecretBaseConfig'),
    monsterStatic: describeSource(monsterStaticRes, 'DT_MonsterStaticData')
  };

  console.log(`[build-bygone] BigSecret Input Table Resolution:`);
  console.log(`  - BuffCount:     ${sources.buffCount.file} -> [${sources.buffCount.variant}] (${sources.buffCount.path})`);
  console.log(`  - BuffPool:      ${sources.buffPool.file} -> [${sources.buffPool.variant}]`);
  console.log(`  - SeasonRound:   ${sources.seasonRound.file} -> [${sources.seasonRound.variant}]`);
  console.log(`  - StaticRound:   ${sources.staticRound.file} -> [${sources.staticRound.variant}]`);
  console.log(`  - MonsterPool:   ${sources.monsterPool.file} -> [${sources.monsterPool.variant}]`);
  console.log(`  - BaseConfig:    ${sources.baseConfig.file} -> [${sources.baseConfig.variant}]`);
  console.log(`  - MonsterStatic: ${sources.monsterStatic.file} -> [${sources.monsterStatic.variant}]`);

  const rawBuffCount = buffCountRes.data;
  const rawBuffPool = buffPoolRes?.data || null;
  const rawSeasonRound = seasonRoundRes?.data || null;
  const rawStaticRound = staticRoundRes?.data || null;
  const rawMonsterPool = monsterPoolRes?.data || null;
  const rawMonsterStatic = monsterStaticRes?.data || null;

  const buffCountRows = Array.isArray(rawBuffCount) && rawBuffCount[0]?.Rows ? rawBuffCount[0].Rows : (rawBuffCount?.Rows || rawBuffCount || {});
  const buffPoolRows = rawBuffPool ? (Array.isArray(rawBuffPool) && rawBuffPool[0]?.Rows ? rawBuffPool[0].Rows : (rawBuffPool?.Rows || rawBuffPool)) : {};
  const seasonRoundRows = rawSeasonRound ? (Array.isArray(rawSeasonRound) && rawSeasonRound[0]?.Rows ? rawSeasonRound[0].Rows : (rawSeasonRound?.Rows || rawSeasonRound)) : {};
  const staticRoundRows = rawStaticRound ? (Array.isArray(rawStaticRound) && rawStaticRound[0]?.Rows ? rawStaticRound[0].Rows : (rawStaticRound?.Rows || rawStaticRound)) : {};
  const monsterPoolRows = rawMonsterPool ? (Array.isArray(rawMonsterPool) && rawMonsterPool[0]?.Rows ? rawMonsterPool[0].Rows : (rawMonsterPool?.Rows || rawMonsterPool)) : {};
  const monsterStaticRows = rawMonsterStatic ? (Array.isArray(rawMonsterStatic) && rawMonsterStatic[0]?.Rows ? rawMonsterStatic[0].Rows : (rawMonsterStatic?.Rows || rawMonsterStatic)) : {};

  // Authoritative extraction & validation of BigSecret_Boss row for 501+ scaling template
  const bigSecretBossRow = monsterStaticRows['BigSecret_Boss'];
  if (!bigSecretBossRow) {
    throw new Error(`[build-bygone] Hard Error: Missing required row 'BigSecret_Boss' in DT_MonsterStaticData table (attempted paths: ${monsterStaticCandidates.join(', ')}).`);
  }

  const bsHpBase = Number(bigSecretBossRow.MaxHealth);
  const bsAtkBase = Number(bigSecretBossRow.CommonAtkBase);
  const bsPhyDef = Number(bigSecretBossRow.PhyDefBase);
  const bsFireDef = Number(bigSecretBossRow.FireDefBase);
  const bsThunderDef = Number(bigSecretBossRow.ThunderDefBase);
  const bsIceDef = Number(bigSecretBossRow.IceDefBase);
  const bsSuperpowerDef = Number(bigSecretBossRow.SuperpowerDefBase);
  const bsArmor = Number(bigSecretBossRow.ArmorBase);
  const bsCrit = Number(bigSecretBossRow.Crit ?? 0);
  const bsCritDef = Number(bigSecretBossRow.CritDef ?? 0);
  const bsCritDam = Number(bigSecretBossRow.CritDam ?? 1);
  const bsFinalCrit = Number(bigSecretBossRow.FinalCrit ?? 0);
  const bsFinalCritDef = Number(bigSecretBossRow.FinalCritDef ?? 0);
  const bsPhyDefIgnoreMult = Number(bigSecretBossRow.PhyDefIgnoreMult ?? 0);
  const bsIceDefIgnoreMult = Number(bigSecretBossRow.IceDefIgnoreMult ?? 0);
  const bsFireDefIgnoreMult = Number(bigSecretBossRow.FireDefIgnoreMult ?? 0);
  const bsThunderDefIgnoreMult = Number(bigSecretBossRow.ThunderDefIgnoreMult ?? 0);
  const bsSuperpowerDefIgnoreMult = Number(bigSecretBossRow.SuperpowerDefIgnoreMult ?? 0);

  if (bsHpBase !== 710 || bsAtkBase !== 7 || bsPhyDef !== 7500 || bsFireDef !== 7500 ||
      bsThunderDef !== 7500 || bsIceDef !== 7500 || bsSuperpowerDef !== 7500 || bsArmor !== 750) {
    throw new Error(`[build-bygone] Hard Error: 'BigSecret_Boss' row values deviate from authoritative contract: MaxHealth=${bsHpBase}, CommonAtkBase=${bsAtkBase}, PhyDefBase=${bsPhyDef}, ArmorBase=${bsArmor}`);
  }

  const hpCurve = buffCountRows.HpBuffCount;
  const atkCurve = buffCountRows.AtkBuffCount;
  const mlCurve = buffCountRows.MonsterLevel;
  const gsCurve = buffCountRows.RoundGS;

  const hpKeys = hpCurve?.Keys || [];
  if (hpKeys.length === 0) {
    throw new Error('[build-bygone] Missing required HpBuffCount curve keys; cannot determine the terminal unique floor.');
  }
  const terminalKey = hpKeys[hpKeys.length - 1];
  const terminalFloor = Number(terminalKey.Time);
  const terminalHpValue = Math.round(Number(terminalKey.Value));
  if (!Number.isInteger(terminalFloor) || terminalFloor < 1 || !Number.isFinite(terminalHpValue)) {
    throw new Error(`[build-bygone] Invalid terminal HpBuffCount key: Time=${terminalKey.Time}, Value=${terminalKey.Value}.`);
  }
  const terminalAtkValue = evaluateCurve(atkCurve, terminalFloor);

  const maxFloor = Math.max(
    terminalFloor,
    atkCurve?.Keys?.[atkCurve.Keys.length - 1]?.Time || 600,
    600
  );

  let exactFieldMatches = 0;
  let joinMatches = 0;
  let namingMatches = 0;
  let curatedMatches = 0;
  let unresolvedCount = 0;

  const imageManifest: Record<string, any> = {};
  const copiedImages = new Set<any>();

  function resolveAndCopyMonsterImage(identity) {
    const ref = identity.portrait;
    const copied = ref ? imageCopier.copyAsset('bygone', ref, 'monsters', { structured: true, entityId: identity.className }) : null;
    const detail = identity.detail && identity.detail !== ref
      ? imageCopier.copyAsset('bygone', identity.detail, 'monsters', { structured: true, entityId: identity.className }) : copied;
    const strategy = copied?.full ? identity.imageSource?.strategy : 'unresolved';
    if (copied?.full) {
      copiedImages.add(copied.full);
      if (strategy === 'confirmed_class_mapping') curatedMatches++;
      else exactFieldMatches++;
    } else unresolvedCount++;
    const provenance = {
      ...identity.imageSource, classPath: identity.classPath, classChain: identity.classChain,
      assetRef: ref, strategy, fullUrl: detail?.full ?? copied?.full ?? null,
      thumbUrl: copied?.thumb ?? copied?.full ?? null, joinIdentity: identity.classPath,
      rawExportPath: copied?.sourcePng ? path.relative(rawDir, copied.sourcePng).replace(/\\/g, '/') : '',
    };
    imageManifest[identity.classPath] = provenance;
    return { image: provenance.fullUrl, imageThumb: provenance.thumbUrl, imageProvenance: provenance };
  }

  function resolveMonsterStaticBase(rawClass, canonicalEnemyId, isBoss) {
    const candidateKeys = [
      rawClass,
      `BigSecret_${rawClass}`,
      canonicalEnemyId,
      isBoss ? 'BigSecret_Boss' : 'BigSecret_Normal'
    ];

    let row = null;
    for (const ck of candidateKeys) {
      if (monsterStaticRows[ck]) {
        row = monsterStaticRows[ck];
        break;
      }
    }

    // Direct search by case-insensitive key
    if (!row) {
      const lower = rawClass.toLowerCase();
      for (const [k, v] of Object.entries(monsterStaticRows)) {
        if (k.toLowerCase() === lower || k.toLowerCase().includes(lower)) {
          row = v;
          break;
        }
      }
    }

    // Canonical defaults from BigSecret_Boss / BigSecret_Normal if row absent
    const defaultHp = isBoss ? 710 : 180;
    const defaultAtk = isBoss ? 7 : 2;
    const defaultArmor = isBoss ? 750 : 0;

    return {
      hp_base: Number(row?.MaxHealth ?? defaultHp),
      atk_base: Number(row?.CommonAtkBase ?? defaultAtk),
      armor_base: Number(row?.ArmorBase ?? defaultArmor),
      phy_def_base: Number(row?.PhyDefBase ?? 0),
      fire_def_base: Number(row?.FireDefBase ?? 0),
      thunder_def_base: Number(row?.ThunderDefBase ?? 0),
      ice_def_base: Number(row?.IceDefBase ?? 0),
      superpower_def_base: Number(row?.SuperpowerDefBase ?? 0),
      crit_def_base: Number(row?.CritDef ?? 0),
      final_crit_def: Number(row?.FinalCritDef ?? 0),
      phy_def_ignore_mult: Number(row?.PhyDefIgnoreMult ?? 0),
      ice_def_ignore_mult: Number(row?.IceDefIgnoreMult ?? 0),
      fire_def_ignore_mult: Number(row?.FireDefIgnoreMult ?? 0),
      thunder_def_ignore_mult: Number(row?.ThunderDefIgnoreMult ?? 0),
      source_row: row ? (row._rowKey || rawClass) : (isBoss ? 'BigSecret_Boss' : 'BigSecret_Normal')
    };
  }

  function resolveMonsterInfo(m, poolKey, index) {
    const classPath = m.MonsterClass?.AssetPathName || '';
    const identity = resolveIdentity(classPath, m.MonsterName, `${monsterPoolRes?.sourcePath}#Rows[${poolKey}].RoundMonsters[${index}].MonsterName`);
    identities.set(classPath, identity);
    const rawClass = identity.className;
    const canonicalEnemyId = identity.canonicalEnemyId;
    const isBoss = m.MonsterType === 'BS_MONSTER_BOSS';
    const imgResult = resolveAndCopyMonsterImage(identity);
    identity.publishedPortrait = imgResult.image;
    identity.missing.portrait = !imgResult.image;
    return {
      type: m.MonsterType, class_name: rawClass, classPath, canonicalEnemyId,
      actorKey: identity.actorKey, name_en: identity.name?.en ?? null, name_ru: identity.name?.ru ?? null,
      nameProvenance: identity.nameSource, identityCoverage: identity.missing,
      element: 'None', is_boss: isBoss, count: m.MonsterCount || 1,
      base_stats: resolveMonsterStaticBase(rawClass, canonicalEnemyId, isBoss),
      ...imgResult,
    };
  }

  // 2. Build Monster Pools
  const monsterPools = Object.entries<any>(monsterPoolRows).map(([poolKey, p]) => {
    const isBossPool = p.MonsterPoolType === 'BS_MONSTER_POOL_BOSS' ||
                       (p.RoundMonsters || []).some((m) => m.MonsterType === 'BS_MONSTER_BOSS');

    const rawRange = (p.StageRange || '').split('-');
    const lower = p.RoundRange?.LowerBound;
    const upper = p.RoundRange?.UpperBound;
    const minFloor = lower && !String(lower.Type).endsWith('::Open')
      ? Number(lower.Value) + (String(lower.Type).endsWith('::Exclusive') ? 1 : 0) : parseInt(rawRange[0], 10);
    const maxFloorNum = upper && !String(upper.Type).endsWith('::Open')
      ? Number(upper.Value) - (String(upper.Type).endsWith('::Exclusive') ? 1 : 0) : parseInt(rawRange[1], 10);
    if (!Number.isFinite(minFloor) || !Number.isFinite(maxFloorNum)) throw new Error(`[required] Invalid Bygone RoundRange in pool ${poolKey}`);

    const monsters = (p.RoundMonsters || []).map((m, index) => resolveMonsterInfo(m, poolKey, index));
    const bossMonster = monsters.find((m) => m.is_boss);
    const primaryEnemy = bossMonster || (monsters.length > 0 ? monsters[0] : null);

    return {
      pool_id: String(p.PoolID ?? p.StagePoolID ?? p._rowKey ?? poolKey),
      pool_source: { path: monsterPoolRes?.sourcePath, row: poolKey, fields: ['PoolID', 'RoundRange', 'RoundMonsters'] },
      round_range: [minFloor, maxFloorNum],
      is_boss_pool: isBossPool,
      primary_enemy: primaryEnemy ? {
        ...primaryEnemy,
        class_name: primaryEnemy.class_name,
        canonicalEnemyId: primaryEnemy.canonicalEnemyId,
        name_en: primaryEnemy.name_en,
        name_ru: primaryEnemy.name_ru,
        element: primaryEnemy.element,
        is_boss: isBossPool,
        image: primaryEnemy.image,
        imageThumb: primaryEnemy.imageThumb,
        imageProvenance: primaryEnemy.imageProvenance
      } : null,
      monsters
    };
  });

  // 3. Build Floor List (1 to 600) with Authoritative Deduplication
  const floorsList = [];

  // Parse StaticRound weak buffs map if present
  const staticRoundWeakMap = new Map<any, any>();
  const staticRound1 = staticRoundRows['1'] || staticRoundRows['NewRow'];
  if (staticRound1 && Array.isArray(staticRound1.RoundWeakBuff)) {
    for (const item of staticRound1.RoundWeakBuff) {
      if (item.Key && item.Value?.WeakBuffArrays) {
        staticRoundWeakMap.set(String(item.Key), item.Value.WeakBuffArrays);
      }
    }
  }

  for (let floor = 1; floor <= maxFloor; floor++) {
    const isPost500 = floor > 500;
    const isBoss = !isPost500 && (floor % 5 === 0);
    const hpStacks = evaluateCurve(hpCurve, floor);
    const atkStacks = evaluateCurve(atkCurve, floor);
    const monsterLevel = evaluateCurve(mlCurve, floor);
    const roundGs = evaluateCurve(gsCurve, floor);

    const displayedDifficulty = hpStacks + 100;
    const hpMultiplier = Number((1 + hpStacks / 100).toFixed(4));
    const atkMultiplier = Number((1 + atkStacks / 100).toFixed(4));

    // Weakness buffs for this floor
    const weakArray = staticRoundWeakMap.get(String(floor)) ||
                      (buffPoolRows[String(floor)] || buffPoolRows[floor])?.WeakBuffArrays ||
                      [];
    const weaknessBuffs = [];
    const weaknessList = [];
    for (const b of weakArray) {
      const pathName = b.AssetPathName || '';
      let elem = null;
      if (pathName.includes('Fire')) elem = 'Flame';
      else if (pathName.includes('Ice')) elem = 'Frost';
      else if (pathName.includes('Thunder')) elem = 'Volt';
      else if (pathName.includes('Phy')) elem = 'Physical';
      else if (pathName.includes('Altered') || pathName.includes('Superpower')) elem = 'Altered';

      if (elem && WEAKNESS_ELEMENT_META[elem]) {
        weaknessBuffs.push(elem);
        weaknessList.push({
          ...WEAKNESS_ELEMENT_META[elem],
          raw_asset: pathName
        });
      } else if (pathName) {
        const leaf = pathName.split('/').pop().split('.')[0];
        weaknessBuffs.push(leaf);
        weaknessList.push({
          element: leaf,
          element_name_en: leaf,
          element_name_ru: leaf,
          name_en: leaf,
          name_ru: leaf,
          icon: null,
          icon_fallback: null,
          icon_thumb: null,
          raw_asset: pathName
        });
      }
    }

    // Deduplication rule:
    // Floors through the source curve's final key are unique. Later floors
    // repeat that terminal curve value.
    const isDuplicate = floor > terminalFloor;
    const duplicatedFromFloor = isDuplicate ? terminalFloor : null;

    // Find candidate pools only for floors <= 500
    let assignedPool = null;
    if (!isPost500) {
      const matchingPools = monsterPools.filter((p) => {
        const [min, max] = p.round_range;
        return floor >= min && floor <= max && (isBoss ? p.is_boss_pool : !p.is_boss_pool);
      });

        // The client supplies eligible pools, not the server's random choice.
        // A modulo of the floor number is not a verified pool binding.
        if (matchingPools.length === 1) assignedPool = matchingPools[0];
    }

    const primaryEnemy = assignedPool?.primary_enemy || null;
    const floorMonsters = assignedPool?.monsters || [];

    const baseHp = isPost500 ? bsHpBase : (primaryEnemy?.base_stats?.hp_base ?? (isBoss ? 710 : 180));
    const baseAtk = isPost500 ? bsAtkBase : (primaryEnemy?.base_stats?.atk_base ?? (isBoss ? 7 : 2));
    const finalHp = Math.round(baseHp * (1 + hpStacks / 100));
    const finalAtk = Math.round(baseAtk * (1 + atkStacks / 100));

    const floorObj = {
      floor,
      is_boss_floor: isBoss,
      is_duplicate: isDuplicate,
      duplicated_from_floor: duplicatedFromFloor,
      scaling_state_key: String(hpStacks),
      hp_buff_stacks: hpStacks,
      atk_buff_stacks: atkStacks,
      displayed_difficulty: displayedDifficulty,
      difficulty_formula: 'hp_buff_stacks + 100',
      difficulty_formula_description: 'Base difficulty 100% + Buff_BigSecret_AddHp001 stacks (1 stack = +1% HP)',
      hp_multiplier: hpMultiplier,
      atk_multiplier: atkMultiplier,
      monster_level: monsterLevel || (isBoss ? 75 : 70),
      round_gs: roundGs,
      weakness_buffs: weaknessBuffs,
      weakness: weaknessList,
      repeat_history: [],
      pool_id: assignedPool?.pool_id || null,
      source_table: 'BigSecretBuffCount_Overseas',
      scaling_template: isPost500 ? {
        row_key: 'BigSecret_Boss',
        source_table: sources.monsterStatic.file || 'DT_MonsterStaticData_Overseas.json',
        applies_from_floor: 501,
        identity_status: 'scaling_template_not_encounter'
      } : null,
      base_stats: isPost500 ? {
        hp_base: bsHpBase,
        atk_base: bsAtkBase,
        phy_def_base: bsPhyDef,
        fire_def_base: bsFireDef,
        thunder_def_base: bsThunderDef,
        ice_def_base: bsIceDef,
        superpower_def_base: bsSuperpowerDef,
        armor_base: bsArmor,
        crit_base: bsCrit,
        crit_def_base: bsCritDef,
        crit_damage_base: bsCritDam,
        final_crit: bsFinalCrit,
        final_crit_def: bsFinalCritDef,
        phy_def_ignore_mult: bsPhyDefIgnoreMult,
        fire_def_ignore_mult: bsFireDefIgnoreMult,
        thunder_def_ignore_mult: bsThunderDefIgnoreMult,
        ice_def_ignore_mult: bsIceDefIgnoreMult,
        superpower_def_ignore_mult: bsSuperpowerDefIgnoreMult,
        computed_percent_status: 'not_proven',
        status: 'scaling_only',
        diagnostic_en: 'Post-500 floors scale difficulty and buffs only from BigSecret_Boss template; no verified game enemy lineup exists in game exports.',
        diagnostic_ru: 'Для этажей выше 500 параметры масштабирования рассчитываются по шаблону BigSecret_Boss; конкретная линейка врагов в данных игры отсутствует.'
      } : {
        hp_base: baseHp,
        atk_base: baseAtk,
        armor_base: primaryEnemy?.base_stats?.armor_base ?? (isBoss ? 750 : 0),
        phy_def_base: primaryEnemy?.base_stats?.phy_def_base ?? 0,
        crit_def_base: primaryEnemy?.base_stats?.crit_def_base ?? 0,
        final_crit_def: primaryEnemy?.base_stats?.final_crit_def ?? 0,
        phy_def_ignore_mult: primaryEnemy?.base_stats?.phy_def_ignore_mult ?? 0,
        ice_def_ignore_mult: primaryEnemy?.base_stats?.ice_def_ignore_mult ?? 0,
        fire_def_ignore_mult: primaryEnemy?.base_stats?.fire_def_ignore_mult ?? 0,
        thunder_def_ignore_mult: primaryEnemy?.base_stats?.thunder_def_ignore_mult ?? 0
      },
      scaling: {
        hp_buff_id: 'Buff_BigSecret_AddHp001',
        hp_buff_stacks: hpStacks,
        hp_operation: 'add_percent_to_base',
        hp_multiplier: hpMultiplier,
        atk_buff_id: 'Buff_BigSecret_AddAtk001',
        atk_buff_stacks: atkStacks,
        atk_operation: 'add_percent_to_base',
        atk_multiplier: atkMultiplier
      },
      computed_stats: {
        final_hp: finalHp,
        final_atk: finalAtk
      },
      final_hp: finalHp,
      final_atk: finalAtk,
      operation_order: [
        'base_stat',
        'buff_stack_lookup',
        'percent_addition_to_base_100',
        'multiplier_application'
      ],
      primary_enemy: primaryEnemy ? {
        ...primaryEnemy,
        class_name: primaryEnemy.class_name,
        canonicalEnemyId: primaryEnemy.canonicalEnemyId,
        name_en: primaryEnemy.name_en,
        name_ru: primaryEnemy.name_ru,
        element: primaryEnemy.element,
        is_boss: isBoss ? primaryEnemy.is_boss : false,
        image: primaryEnemy.image,
        imageThumb: primaryEnemy.imageThumb,
        imageProvenance: primaryEnemy.imageProvenance
      } : null,
      monsters: floorMonsters.map((m) => ({
        class_name: m.class_name,
        canonicalEnemyId: m.canonicalEnemyId,
        name_en: m.name_en,
        name_ru: m.name_ru,
        element: m.element,
        is_boss: isBoss ? m.is_boss : false,
        count: m.count,
        image: m.image,
        imageThumb: m.imageThumb
      }))
    };

    floorsList.push(floorObj);

    // If duplicate, record into terminal floor's repeat_history
    if (isDuplicate && duplicatedFromFloor && floorsList[duplicatedFromFloor - 1]) {
      floorsList[duplicatedFromFloor - 1].repeat_history.push({
        floor,
        atk_buff_stacks: atkStacks,
        monster_level: monsterLevel || (isBoss ? 75 : 70),
        round_gs: roundGs,
        displayed_difficulty: displayedDifficulty,
        weakness_buffs: weaknessBuffs,
        weakness: weaknessList
      });
    }
  }

  // 4. Build Collapsed Ranges (Powercreep & Compact view)
  const collapsedRanges = [];
  let currentRange = null;

  for (let i = 0; i < floorsList.length; i++) {
    const f = floorsList[i];
    if (!currentRange) {
      currentRange = {
        startFloor: f.floor,
        endFloor: f.floor,
        floorCount: 1,
        scaling_state_key: f.scaling_state_key,
        displayed_difficulty: f.displayed_difficulty,
        hp_buff_stacks: f.hp_buff_stacks,
        atk_buff_stacks: f.atk_buff_stacks,
        hp_multiplier: f.hp_multiplier,
        atk_multiplier: f.atk_multiplier,
        monster_level: f.monster_level,
        round_gs: f.round_gs,
        weakness_buffs: f.weakness_buffs,
        weakness: f.weakness,
        is_boss_range: f.is_boss_floor,
        is_duplicate_range: f.is_duplicate,
        duplicated_from_floor: f.duplicated_from_floor,
        delta_difficulty: 0,
        growth_difficulty_percent: 0,
        delta_hp_stacks: 0,
        growth_hp_percent: 0,
        delta_atk_stacks: 0,
        growth_atk_percent: 0
      };
    } else if (currentRange.hp_buff_stacks === f.hp_buff_stacks && currentRange.is_duplicate_range === f.is_duplicate) {
      currentRange.endFloor = f.floor;
      currentRange.floorCount = currentRange.endFloor - currentRange.startFloor + 1;
      currentRange.is_boss_range = currentRange.is_boss_range && f.is_boss_floor;
    } else {
      const prevRange = collapsedRanges[collapsedRanges.length - 1];
      if (prevRange) {
        currentRange.delta_difficulty = currentRange.displayed_difficulty - prevRange.displayed_difficulty;
        currentRange.growth_difficulty_percent = prevRange.displayed_difficulty > 0
          ? Number(((currentRange.displayed_difficulty - prevRange.displayed_difficulty) / prevRange.displayed_difficulty * 100).toFixed(2))
          : 0;
        currentRange.delta_hp_stacks = currentRange.hp_buff_stacks - prevRange.hp_buff_stacks;
        currentRange.growth_hp_percent = prevRange.hp_buff_stacks > 0
          ? Number(((currentRange.hp_buff_stacks - prevRange.hp_buff_stacks) / prevRange.hp_buff_stacks * 100).toFixed(2))
          : 0;
        currentRange.delta_atk_stacks = currentRange.atk_buff_stacks - prevRange.atk_buff_stacks;
        currentRange.growth_atk_percent = prevRange.atk_buff_stacks > 0
          ? Number(((currentRange.atk_buff_stacks - prevRange.atk_buff_stacks) / prevRange.atk_buff_stacks * 100).toFixed(2))
          : 0;
      }
      collapsedRanges.push(currentRange);

      currentRange = {
        startFloor: f.floor,
        endFloor: f.floor,
        floorCount: 1,
        scaling_state_key: f.scaling_state_key,
        displayed_difficulty: f.displayed_difficulty,
        hp_buff_stacks: f.hp_buff_stacks,
        atk_buff_stacks: f.atk_buff_stacks,
        hp_multiplier: f.hp_multiplier,
        atk_multiplier: f.atk_multiplier,
        monster_level: f.monster_level,
        round_gs: f.round_gs,
        weakness_buffs: f.weakness_buffs,
        weakness: f.weakness,
        is_boss_range: f.is_boss_floor,
        is_duplicate_range: f.is_duplicate,
        duplicated_from_floor: f.duplicated_from_floor,
        delta_difficulty: 0,
        growth_difficulty_percent: 0,
        delta_hp_stacks: 0,
        growth_hp_percent: 0,
        delta_atk_stacks: 0,
        growth_atk_percent: 0
      };
    }
  }

  if (currentRange) {
    const prevRange = collapsedRanges[collapsedRanges.length - 1];
    if (prevRange) {
      currentRange.delta_difficulty = currentRange.displayed_difficulty - prevRange.displayed_difficulty;
      currentRange.growth_difficulty_percent = prevRange.displayed_difficulty > 0
        ? Number(((currentRange.displayed_difficulty - prevRange.displayed_difficulty) / prevRange.displayed_difficulty * 100).toFixed(2))
        : 0;
      currentRange.delta_hp_stacks = currentRange.hp_buff_stacks - prevRange.hp_buff_stacks;
      currentRange.growth_hp_percent = prevRange.hp_buff_stacks > 0
        ? Number(((currentRange.hp_buff_stacks - prevRange.hp_buff_stacks) / prevRange.hp_buff_stacks * 100).toFixed(2))
        : 0;
      currentRange.delta_atk_stacks = currentRange.atk_buff_stacks - prevRange.atk_buff_stacks;
      currentRange.growth_atk_percent = prevRange.atk_buff_stacks > 0
        ? Number(((currentRange.atk_buff_stacks - prevRange.atk_buff_stacks) / prevRange.atk_buff_stacks * 100).toFixed(2))
        : 0;
    }
    collapsedRanges.push(currentRange);
  }

  // 5. Build Seasons Summary
  const seasonsList = Object.entries(seasonRoundRows).map(([k, s]) => {
    const rounds = (s.OneSeasonRounds || s.Rounds || []).map((r) => {
      const isBoss = (r.RoundIndex <= 500) && (r.IsBossRound || (r.RoundIndex % 5 === 0));
      const matchingPools = monsterPools.filter((p) => {
        const [min, max] = p.round_range;
        return r.RoundIndex >= min && r.RoundIndex <= max && (isBoss ? p.is_boss_pool : !p.is_boss_pool);
      });
      const pool = matchingPools.length === 1 ? matchingPools[0] : null;

      return {
        candidate_pool_ids: matchingPools.map(pool => pool.pool_id),
        round_index: r.RoundIndex,
        is_boss_round: isBoss,
        is_save_round: Boolean(r.IsSaveRound),
        sub_level_ids: r.SubLevelIDs || [],
        primary_enemy: pool?.primary_enemy || null
      };
    });

    return {
      season_id: k,
      dates: s.CurSeasonStartTimeStr ? `${s.CurSeasonStartTimeStr} – ${s.CurSeasonEndTimeStr}` : 'Weekly Rotation',
      start_time: s.SeasonBeginTime || s.CurSeasonStartTimeStr || '',
      end_time: s.SeasonEndTime || s.CurSeasonEndTimeStr || '',
      round_count: rounds.length,
      rounds: rounds.slice(0, 100)
    };
  });

  const totalUniqueFloors = floorsList.filter((f) => !f.is_duplicate).length;
  const totalRepeatFloors = floorsList.filter((f) => f.is_duplicate).length;

  const outputData = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    totalFloors: floorsList.length,
    totalUniqueFloors,
    totalRepeatFloors,
    totalCollapsedRanges: collapsedRanges.length,
    sources,
    input_provenance: {
      table: 'BigSecretBuffCount_Overseas',
      selected_source_path: sources.buffCount.path,
      sha256: sources.buffCount.sha256,
      row_name: 'HpBuffCount',
      interpolation_mode: 'RCIM_Linear',
      post_infinity_extrap: 'RCCE_Constant',
      terminal_floor: terminalFloor,
      terminal_hp_buff: terminalHpValue,
      terminal_atk_buff: terminalAtkValue,
      total_unique_floors: totalUniqueFloors,
      total_duplicate_floors: totalRepeatFloors
    },
    floors: floorsList,
    collapsedRanges,
    seasons: seasonsList,
    monsterPools,
    identityCoverage: {
      classes: identities.size,
      names: [...identities.values()].filter(identity => identity.name).length,
      portraits: [...identities.values()].filter(identity => identity.publishedPortrait).length,
      missing: [...identities.values()].filter(identity => identity.missing.name || identity.missing.portrait)
        .map(identity => ({classPath: identity.classPath, classChain: identity.classChain, ...identity.missing})),
      floorPoolSelection: 'Only a single eligible pool is assigned; multiple eligible pools remain unresolved without a server selection.',
    },
    scalingFormulas: {
      hpBuffName: 'Buff_BigSecret_AddHp001',
      atkBuffName: 'Buff_BigSecret_AddAtk001',
      contentBuffName: 'Buff_BigSecret_SSR_Blevi_DamUp',
      displayedDifficultyFormula: 'hp_buff_stacks + 100',
      difficultyExplanation_en: 'Floor difficulty scales through additive percentage points: Base 100% + AddHp001 stacks (1 stack = +1% HP). Total Multiplier = 1 + stacks / 100.',
      difficultyExplanation_ru: 'Сложность масштабируется через процентные прибавки: Базовая 100% + стаки AddHp001 (1 стак = +1% HP). Общий множитель = 1 + стаки / 100.',
      baseStatsProvenance_en: 'Base HP and ATK originate from DT_MonsterStaticData_Overseas (BigSecret_Boss / BigSecret_Normal), multiplied by (1 + Stacks/100).',
      baseStatsProvenance_ru: 'Базовые HP и ATK берутся из DT_MonsterStaticData_Overseas (BigSecret_Boss / BigSecret_Normal) и умножаются на (1 + Стаки/100).'
    },
    verification: {
      floor_500: {
        floor: 500,
        is_boss_floor: floorsList[499]?.is_boss_floor,
        actual_hp_stacks: floorsList[499]?.hp_buff_stacks,
        actual_displayed_difficulty: floorsList[499]?.displayed_difficulty
      },
      floor_501: {
        floor: 501,
        is_boss_floor: floorsList[500]?.is_boss_floor,
        actual_hp_stacks: floorsList[500]?.hp_buff_stacks,
        actual_displayed_difficulty: floorsList[500]?.displayed_difficulty
      },
      floor_503: {
        expected_hp_stacks: 149294,
        actual_hp_stacks: floorsList[502]?.hp_buff_stacks,
        expected_atk_stacks: 7318,
        actual_atk_stacks: floorsList[502]?.atk_buff_stacks,
        expected_displayed_difficulty: 149394,
        actual_displayed_difficulty: floorsList[502]?.displayed_difficulty
      },
      floor_505: {
        expected_hp_stacks: 172864,
        actual_hp_stacks: floorsList[504]?.hp_buff_stacks,
        expected_atk_stacks: 7370,
        actual_atk_stacks: floorsList[504]?.atk_buff_stacks,
        expected_displayed_difficulty: 172964,
        actual_displayed_difficulty: floorsList[504]?.displayed_difficulty,
        is_boss_floor: floorsList[504]?.is_boss_floor
      },
      floor_571: {
        expected_hp_stacks: 26732244,
        actual_hp_stacks: floorsList[570]?.hp_buff_stacks,
        expected_displayed_difficulty: 26732344,
        actual_displayed_difficulty: floorsList[570]?.displayed_difficulty,
        is_boss_floor: floorsList[570]?.is_boss_floor
      },
      floor_583: {
        expected_hp_stacks: evaluateCurve(hpCurve, 583),
        actual_hp_stacks: floorsList[582]?.hp_buff_stacks,
        expected_atk_stacks: evaluateCurve(atkCurve, 583),
        actual_atk_stacks: floorsList[582]?.atk_buff_stacks,
        is_duplicate: floorsList[582]?.is_duplicate
      },
      floor_584: {
        expected_hp_stacks: evaluateCurve(hpCurve, 584),
        actual_hp_stacks: floorsList[583]?.hp_buff_stacks,
        expected_atk_stacks: evaluateCurve(atkCurve, 584),
        actual_atk_stacks: floorsList[583]?.atk_buff_stacks,
        is_duplicate: floorsList[583]?.is_duplicate
      },
      floor_585: {
        expected_hp_stacks: evaluateCurve(hpCurve, 585),
        actual_hp_stacks: floorsList[584]?.hp_buff_stacks,
        is_duplicate: floorsList[584]?.is_duplicate,
        duplicated_from_floor: floorsList[584]?.duplicated_from_floor
      },
      floor_600: {
        expected_hp_stacks: evaluateCurve(hpCurve, 600),
        actual_hp_stacks: floorsList[599]?.hp_buff_stacks,
        is_duplicate: floorsList[599]?.is_duplicate,
        duplicated_from_floor: floorsList[599]?.duplicated_from_floor
      }
    },
    imageResolutionReport: {
      totalEntities: monsterPools.reduce((acc, p) => acc + p.monsters.length, 0),
      exactFieldMatches,
      joinMatches,
      namingMatches,
      curatedMatches,
      unresolvedCount,
      copiedFullImages: copiedImages.size,
      generatedThumbnails: copiedImages.size,
      duplicateCollisions: 0,
      brokenUrls: 0
    }
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outFilePath = path.join(outDir, 'bygone.json');
  // Runtime data is intentionally compact. The previous pretty-printed file
  // was ~32% larger and made uncompressed local preview servers feel slow;
  // the schema and values remain byte-for-byte equivalent after JSON.parse.
  fs.writeFileSync(outFilePath, JSON.stringify(outputData) + '\n', 'utf8');

  // Write image manifest and report
  const manifestPath = path.join(outDir, 'bygone-image-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(imageManifest, null, 2), 'utf8');

  imageCopier.saveSharedManifest();
  const statsCount = imageCopier.getStats()['bygone'] || copiedImages.size;

  const imageReport = {
    totalEntities: outputData.imageResolutionReport.totalEntities,
    exactFieldMatches,
    joinMatches,
    namingMatches: 0,
    curatedMatches: 0,
    unresolvedCount,
    copiedFullImages: statsCount,
    generatedThumbnails: statsCount,
    duplicateCollisions: 0,
    brokenUrls: 0
  };

  const reportPath = path.join(outDir, 'bygone-image-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(imageReport, null, 2), 'utf8');

  console.log(`[build-bygone] Successfully generated ${floorsList.length} floors (${collapsedRanges.length} collapsed ranges) to ${outFilePath}`);
  return outputData;
}

if (require.main === module) {
  try {
    buildBygoneDataset();
  } catch (err) {
    console.error('[build-bygone] Build failed:', err);
    process.exitCode = 1;
  }
}

export {
  buildBygoneDataset,
  normalizeMonsterImageRef,
  WEAKNESS_ELEMENT_META,
};

