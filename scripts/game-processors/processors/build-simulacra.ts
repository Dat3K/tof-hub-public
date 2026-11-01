import { readGameSourceFileSync, hasGameLocalizationSource } from './game-source-reader';

/**
 * build-simulacra.js
 *
 * Canonical data processor for Tower of Fantasy Simulacra & Weapons database.
 * Adheres strictly to exported game relationships, variable complete skill graphs,
 * authentic localized strings, and multi-tier image asset management.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import ImageCopier from './image-copier';
import { createLocalizationResolver, cleanHtmlTags } from './localization-resolver';

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = readGameSourceFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[build-simulacra] Error reading JSON at ${filePath}:`, e.message);
    return null;
  }
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
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports', 'raw_exports'),
    path.join(projectRoot, 'tof-fast-datamine', 'raw_exports'),
    path.join(projectRoot, 'raw_exports'),
    path.join(projectRoot, '..', 'temperary'),
    path.join(projectRoot, 'temperary'),
    path.join(projectRoot, '..', 'raw_exports')
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'Hotta'))) return dir;
  }
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
      console.warn(`[build-simulacra] Warning loading ZIP ${this.zipPath}:`, e.message);
    }
  }

  findAndRead(relCandidates) {
    if (this.zipBuffer && this.zipEntries.size > 0 && !(hasGameLocalizationSource() && relCandidates.some(rel => /(?:^|\/)en\/Game\.json$/.test(rel)))) {
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
              sourcePath: path.relative(this.projectRoot, this.zipPath).replace(/\\/g, '/') + '!' + entry.name,
              fileName: path.basename(entry.name),
              sha256,
              fromZip: true
            };
          } catch (err) {
            console.warn(`[build-simulacra] Error decompressing ${entry.name}:`, err.message);
          }
        }
      }
    }

    for (const rel of relCandidates) {
      let full = path.join(this.rawDir, rel);
      if (!fs.existsSync(full) && fs.existsSync(path.join(this.rawDir, 'raw_exports', rel))) {
        full = path.join(this.rawDir, 'raw_exports', rel);
      }
      if (!fs.existsSync(full) && fs.existsSync(path.join(this.projectRoot, '..', 'temperary', rel))) {
        full = path.join(this.projectRoot, '..', 'temperary', rel);
      }
      if (fs.existsSync(full)) {
        try {
          const rawText = readGameSourceFileSync(full, 'utf8').replace(/^\uFEFF/, '').trim();
          const sha256 = crypto.createHash('sha256').update(rawText, 'utf8').digest('hex');
          return {
            data: JSON.parse(rawText),
            sourcePath: path.relative(this.projectRoot, full).replace(/\\/g, '/'),
            fileName: path.basename(full),
            sha256,
            fromZip: false
          };
        } catch (err) {
          console.warn(`[build-simulacra] Error reading file ${full}:`, err.message);
        }
      }
    }

    return null;
  }
}

// Canonical slug mapping for URL stability and backwards compatibility
const CANONICAL_SLUG_MAP = {
  liuhuo: 'liu-huo',
  jiyu: 'ji-yu',
  feiouna: 'fiona',
  fiona: 'fiona',
  ace: 'anka',
  anka: 'anka',
  merylx: 'meryl-ironheart',
  meilierx: 'meryl-ironheart',
  'meryl-ironheart': 'meryl-ironheart',
  loslyn: 'roslyn',
  luosilin: 'roslyn',
  roslyn: 'roslyn',
  nanyin: 'nan-yin',
  'nan-yin': 'nan-yin',
  blevi: 'brevey',
  bulewei: 'brevey',
  buleiwei: 'brevey',
  brevey: 'brevey',
  linghan: 'ling-han',
  'ling-han': 'ling-han',
  feise: 'feise',
  mimi: 'huang',
  huang: 'huang',
  zeke: 'zeke',
  yulan: 'yulan',
  rubilia: 'rubilia',
  lubiliya: 'rubilia',
  leibiliya: 'rubilia',
  fenrir: 'fenrir',
  fenliru: 'fenrir',
  fenlier: 'fenrir',
  asuka: 'asuka',
  ayanamirei: 'rei-ayanami',
  'rei-ayanami': 'rei-ayanami',
  blackstar: 'plotti',
  liekong: 'nemesis-voidpiercer',
  plotti: 'plotti',
  paluodi: 'plotti',
  chainsaw: 'gnonno',
  fanna: 'gnonno',
  gnonno: 'gnonno',
  genuonuo: 'gnonno',
  dkatana: 'saki-fuwa',
  buer: 'saki-fuwa',
  bupoxiao: 'saki-fuwa',
  'saki-fuwa': 'saki-fuwa',
  fan: 'lin',
  linye: 'lin',
  lin: 'lin',
  funnel: 'ruby',
  laxi: 'ruby',
  ruby: 'ruby',
  leibei: 'ruby',
  greyfox: 'greyfox',
  huihu: 'greyfox',
  gunbox: 'carrot',
  annabeila: 'annabella',
  annabella: 'annabella',
  iceblade: 'alyss',
  alisa: 'alyss',
  ailisi: 'alyss',
  alyss: 'alyss',
  killknife: 'umi',
  wumi: 'umi',
  umi: 'umi',
  lances: 'icarus',
  yimier: 'icarus',
  yikaluosi: 'icarus',
  icarus: 'icarus',
  paradox: 'paradox',
  snipe: 'tian-lang',
  tianlang: 'tian-lang',
  'tian-lang': 'tian-lang',
  swordx: 'claudia-storm',
  'claudia-storm': 'claudia-storm',
  tkatana: 'zeke',
  mingjing: 'zeke',
  'ming-jing': 'zeke',
  umbrella: 'lan',
  lan: 'lan',
  whip: 'claudia',
  keluodiya: 'claudia',
  kelaodiya: 'claudia',
  claudia: 'claudia',
  yoyo: 'yanuo',
  yanuo: 'yanuo',
  berry: 'berry',
  nora: 'nora',
  antuoliya: 'antoria',
  antoria: 'antoria',
  lana: 'lana',
  lechesis: 'lechesis',
  lyncis: 'lyncis',
  nanto: 'nanto',
  puppeteer: 'puppeteer',
  helene: 'puppeteer',
  salidy: 'salidy',
  shaledi: 'salidy',
  skull: 'skull',
  stabdagger: 'stabdagger',
  aisite: 'stabdagger',
  veronika: 'veronika',
  violin: 'violin',
  zoey: 'zoey',
  zuoyi: 'zoey',
  meilier: 'meryl',
  meryl: 'meryl',
  saiermei: 'samir',
  samir: 'samir',
  xi: 'ene',
  ene: 'ene',
  bailing: 'bai-ling',
  'bai-ling': 'bai-ling',
  hida: 'hilda',
  hilda: 'hilda',
  peipei: 'pepper',
  pepper: 'pepper',
  aikesi: 'echo',
  echo: 'echo',
  chufan: 'tsubasa',
  tsubasa: 'tsubasa',
  babu: 'king',
  king: 'king',
  aiwen: 'zero',
  zero: 'zero',
  wushi: 'crow',
  crow: 'crow',
  kekena: 'cocoritter',
  cocoritter: 'cocoritter',
  danni: 'huma',
  huma: 'huma',
  kaer: 'cobalt-b',
  kelaer: 'cobalt-b',
  'cobalt-b': 'cobalt-b',
  xiluo: 'shiro',
  shiro: 'shiro',
  dgun: 'frigg',
  fulijia: 'frigg',
  frigg: 'frigg',
  naimeixi: 'nemesis',
  nemesis: 'nemesis',
  mark: 'make',
  mark_physic: 'make',
  make: 'make',
  immortal: 'baiyuekui',
  immortal_thunder: 'baiyuekui',
  baiyuekui: 'baiyuekui'
};

// Per-character focal framing map for wide splash art in grid/hero views (seeded with salidy -> left)
const ART_FOCAL_MAP = {
  salidy: 'left'
};


function resolveElements(weaponKey, weaponRowOrItemActor = '', geTipsRows = {}) {
  let pri = 'Physical';
  let weaponRow = null;

  if (weaponRowOrItemActor && typeof weaponRowOrItemActor === 'object') {
    weaponRow = weaponRowOrItemActor;
    const rawElem = weaponRow.WeaponTypeData?.WeaponElementType;
    if (rawElem) {
      if (rawElem.includes('Flame')) pri = 'Flame';
      else if (rawElem.includes('Ice')) pri = 'Frost';
      else if (rawElem.includes('Thunder')) pri = 'Volt';
      else if (rawElem.includes('Physics') || rawElem.includes('OverseasZeke')) pri = 'Physical';
      else if (rawElem.includes('SuperPower') || rawElem.includes('Superpower')) pri = 'Altered';
    }
  }

  // Fallback heuristic if WeaponTypeData or WeaponElementType was missing or a string was passed
  if (!weaponRow || !weaponRow.WeaponTypeData?.WeaponElementType) {
    const itemActor = typeof weaponRowOrItemActor === 'string' ? weaponRowOrItemActor : '';
    const k = `${weaponKey}_${itemActor}`.toLowerCase();
    if (k.includes('fire') || k.includes('flame')) pri = 'Flame';
    else if (k.includes('ice') || k.includes('frost')) return { primary: 'Frost', secondary: null };
    else if (k.includes('thunder') || k.includes('volt') || k.includes('thu')) return { primary: 'Volt', secondary: null };
    else if (k.includes('superpower') || k.includes('altered')) return { primary: 'Altered', secondary: null };
    else if (k.includes('physic') || k.includes('phy')) return { primary: 'Physical', secondary: null };
  }

  if (pri === 'Altered') {
    return { primary: pri, secondary: null };
  }

  // Resolve secondary element from authoritative GameplayEffectTipsDataTable resonance buffs
  let secondary = null;
  if (geTipsRows && typeof geTipsRows === 'object') {
    const fam = extractWeaponFamily(weaponKey, weaponRow);
    const famLower = fam.toLowerCase();
    const prefix = 'buff_' + famLower + '_';

    const elementMatchers = [
      { re: /flame|fire/i, elem: 'Flame' },
      { re: /ice|frost/i, elem: 'Frost' },
      { re: /thunder|thu|volt/i, elem: 'Volt' },
      { re: /physic|phy/i, elem: 'Physical' }
    ];

    const elementsFound = new Set<any>();
    for (const rk of Object.keys(geTipsRows)) {
      if (!/resonance/i.test(rk)) continue;
      const rkLower = rk.toLowerCase();
      if (rkLower.startsWith(prefix)) {
        for (const em of elementMatchers) {
          if (em.re.test(rkLower)) {
            elementsFound.add(em.elem);
          }
        }
      }
    }

    if (elementsFound.size >= 2) {
      for (const e of elementsFound) {
        if (e !== pri) {
          secondary = e;
          break;
        }
      }
    }
  }

  return { primary: pri, secondary };
}

function inferElement(weaponKey, weaponRowOrItemActor = '', geTipsRows = {}) {
  return resolveElements(weaponKey, weaponRowOrItemActor, geTipsRows).primary;
}

function resolveWeaponRole(weaponRow) {
  if (!weaponRow || typeof weaponRow !== 'object') {
    return 'Unknown';
  }

  const categoryEnum = weaponRow.WeaponTypeData?.WeaponCategory;
  if (categoryEnum) {
    switch (categoryEnum) {
      case 'EWeaponCategory::DPS':
        return 'DPS';
      case 'EWeaponCategory::Tank':
        return 'Tank';
      case 'EWeaponCategory::SUP':
        return 'Benediction';
      case 'EWeaponCategory::None':
        return 'Unknown';
      default: {
        const clean = String(categoryEnum).replace(/^.*::/, '').toUpperCase();
        if (clean === 'DPS') return 'DPS';
        if (clean === 'TANK') return 'Tank';
        if (clean === 'SUP' || clean === 'BENEDICTION') return 'Benediction';
        if (clean === 'NONE') return 'Unknown';
      }
    }
  }

  // Fallback heuristic if WeaponTypeData or WeaponCategory is missing
  const briefKey = (weaponRow.ItemBrief?.Key || weaponRow.ItemBrief?.TableId || '').toLowerCase();
  const descKey = (weaponRow.ItemDes?.Key || weaponRow.ItemDes?.TableId || '').toLowerCase();
  if (briefKey.includes('defend') || descKey.includes('defend') || briefKey.includes('tank') || descKey.includes('tank')) return 'Tank';
  if (briefKey.includes('treat') || descKey.includes('treat') || briefKey.includes('assist') || descKey.includes('assist') || briefKey.includes('bene')) return 'Benediction';
  if (briefKey.includes('attack') || descKey.includes('attack') || briefKey.includes('dps')) return 'DPS';

  return 'Unknown';
}

const inferResonance = resolveWeaponRole;

const TRAIT_ALIASES = {
  pepper: 'peppa', peipei: 'peppa',
  echo: 'manaka', aige: 'manaka',
  crow: 'karasuma', wuwan: 'karasuma',
  tsubasa: 'hane', sifengyuanyu: 'hane',
  'cobalt-b': 'cobalt_b', cobalt_b: 'cobalt_b', gulan: 'cobalt_b',
  baiyuekui: 'whitemoon',
  nemesis: 'sally', avatar06: 'sally',
  ruby: 'rabbit', leibei: 'rabbit',
  ene: 'xi',
  roslyn: 'loslyn',
  yanmiao: 'killknife',
  gnonno: 'genuonuo'
};

const REACTION_PASSIVES_DATA = {
  Frost: {
    name_en: "Ice Shell",
    name_ru: "Ледяная оболочка",
    desc_en: "When the weapon is fully charged, the next attack will strongly freeze targets for 2 seconds and leave them frostbitten for 6 seconds. Breaking the ice shell deals damage equal to 151% of ATK. While frostbitten, the target's weapon charge rate is reduced by 50%.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака интенсивно замораживает цели на 2 сек. и оставляет их обмороженными на 6 сек. Если разбить ледяную оболочку, это нанесет урон в размере 151% от АТК. Пока цель обморожена, скорость заряда ее оружия снижается на 50%."
  },
  Flame: {
    name_en: "Flame",
    name_ru: "Огонь",
    desc_en: "When the weapon is fully charged, the next attack will ignite the target for 8 seconds, dealing damage equal to 58% of ATK every second. While ignited, targets' healing effect is reduced by 50%.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака на 8 секунд поджигает цель, нанося урон в размере 58% от АТК каждую секунду. У горящих целей эффективность лечения снижается на 50%."
  },
  Physical: {
    name_en: "Grievous",
    name_ru: "Тяжелое ранение",
    desc_en: "When the weapon is fully charged, the next attack will cause enemies to become grievous for 7 seconds, increasing their damage received by 20% and dealing damage equal to 100% of ATK. When in team play, physical damage dealt to grievous targets is increased by an additional 20%.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака накладывает на врагов эффект тяжелого ранения на 7 секунд, увеличивая получаемый ими урон на 20% и нанося урон в размере 100% от АТК. В командной игре физический урон по тяжелораненым целям увеличивается дополнительно на 20%."
  },
  Volt: {
    name_en: "Volt",
    name_ru: "Электричество",
    desc_en: "When the weapon is fully charged, the next attack will strongly paralyze targets for 1 second and electrify them for 6 seconds, removing all their buffs and dealing damage equal to 106% of ATK. Electrified targets can't receive any buffs for the next 6 seconds.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака интенсивно парализует цели на 1 сек. и электризует их на 6 сек., убирая с целей все баффы и нанося урон в размере 106% от АТК. Наэлектризованные цели не могут получать никаких баффов в течение следующих 6 сек."
  },
  Altered: {
    name_en: "Altered Damage",
    name_ru: "Измененный урон",
    desc_en: "When the weapon is fully charged, the next attack will mark the target, causing an explosion after 5 seconds. Additionally, inflict damage equal to 25% of all damage received by the target during the duration of the mark, up to a total of 560% of the Wanderer's ATK. Only 1 mark can exist on a target at a time.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака ставит на цель метку, которая через 5 сек. вызывает взрыв. В период действия метки цель получает дополнительный урон в размере 25% от всего урона вплоть до 560% от АТК странника. На цель можно поставить только 1 метку за раз."
  },
  Superpower: {
    name_en: "Altered Damage",
    name_ru: "Измененный урон",
    desc_en: "When the weapon is fully charged, the next attack will mark the target, causing an explosion after 5 seconds. Additionally, inflict damage equal to 25% of all damage received by the target during the duration of the mark, up to a total of 560% of the Wanderer's ATK. Only 1 mark can exist on a target at a time.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака ставит на цель метку, которая через 5 сек. вызывает взрыв. В период действия метки цель получает дополнительный урон в размере 25% от всего урона вплоть до 560% от АТК странника. На цель можно поставить только 1 метку за раз."
  },
  "Physical+Flame": {
    name_en: "Armor Dissolve",
    name_ru: "Растворение брони",
    desc_en: "When the weapon is fully charged, the next attack inflicts Armor Dissolve on the target for 45 seconds, increasing their flame and physical damage taken by 10% (and an additional 15% in team play). This effect will replace the grievous status on the target, and targets with this effect cannot become grievous. Physical attacks will stun targets under the dissolve effect for 2 seconds, and flame attacks will decrease the targets' speed by 50% for 5 seconds. This effect can only trigger once every 15 seconds on the same target.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака на 45 сек. накладывает на цель растворение брони, увеличивая получаемый физический урон и урон от огня на 10% (плюс дополнительно 15% в командной игре). Эффект растворения заменяет эффект тяжелого ранения; цели с эффектом растворения не могут получить эффект тяжелого ранения. Физические атаки оглушают цели с эффектом растворения на 2 сек., а атаки огнем снижают их скорость на 50% на 5 сек. Эффект может срабатывать на одной и той же цели не чаще 1 раза каждые 15 сек."
  },
  "Flame+Physical": {
    name_en: "Armor Dissolve",
    name_ru: "Растворение брони",
    desc_en: "When the weapon is fully charged, the next attack inflicts Armor Dissolve on the target for 45 seconds, increasing their flame and physical damage taken by 10% (and an additional 15% in team play). This effect will replace the grievous status on the target, and targets with this effect cannot become grievous. Physical attacks will stun targets under the dissolve effect for 2 seconds, and flame attacks will decrease the targets' speed by 50% for 5 seconds. This effect can only trigger 1 time every 15 seconds on the same target.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака на 45 сек. накладывает на цель растворение брони, увеличивая получаемый физический урон и урон от огня на 10% (плюс дополнительно 15% в командной игре). Эффект растворения заменяет эффект тяжелого ранения; цели с эффектом растворения не могут получить эффект тяжелого ранения. Физические атаки оглушают цели с эффектом растворения на 2 сек., а атаки огнем снижают их скорость на 50% на 5 сек. Эффект может срабатывать на одной и той же цели не чаще 1 раза каждые 15 сек."
  },
  "Volt+Frost": {
    name_en: "Force Impact",
    name_ru: "Силовое воздействие",
    desc_en: "When the weapon is fully charged, the next attack applies Force Impact on the enemy for 45 seconds, increasing their frost and volt damage taken by 10% (and an additional 15% in team play). Force Impact replaces the target's grievous status, and targets with Force Impact cannot become grievous. Frost attacks will freeze targets with Force Impact for 2 seconds, and volt attacks will remove the buffs on targets with Force Impact. This effect can only trigger 1 time every 15 seconds on the same target.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака на 45 сек. накладывает на цель Силовое воздействие, увеличивая получаемый урон от холода и электричества на 10% (плюс дополнительно 15% в командной игре). Силовое воздействие заменяет эффект тяжелого ранения; цели с Силовым воздействием не могут получить эффект тяжелого ранения. Атаки холодом замораживают цели с Силовым воздействием на 2 сек., а атаки электричеством снимают с таких целей баффы. Эффект может срабатывать на одной и той же цели не чаще 1 раза каждые 15 сек."
  },
  "Frost+Volt": {
    name_en: "Force Impact",
    name_ru: "Силовое воздействие",
    desc_en: "When the weapon is fully charged, the next attack applies Force Impact on the enemy for 45 seconds, increasing their frost and volt damage taken by 10% (and an additional 15% in team play). Force Impact replaces the target's grievous status, and targets with Force Impact cannot become grievous. Frost attacks will freeze targets with Force Impact for 2 seconds, and volt attacks will remove the buffs on targets with Force Impact. This effect can only trigger 1 time every 15 seconds on the same target.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака на 45 сек. накладывает на цель Силовое воздействие, увеличивая получаемый урон от холода и электричества на 10% (плюс дополнительно 15% в командной игре). Силовое воздействие заменяет эффект тяжелого ранения; цели с Силовым воздействием не могут получить эффект тяжелого ранения. Атаки холодом замораживают цели с Силовым воздействием на 2 сек., а атаки электричеством снимают с таких целей баффы. Эффект может срабатывать на одной и той же цели не чаще 1 раза каждые 15 сек."
  }
};

const MMO_REACTION_PASSIVES_DATA = {
  Altered: {
    name_en: "Altered Damage",
    name_ru: "Измененный урон",
    desc_en: "When the weapon is fully charged, the next attack will mark the target, causing an explosion after 5 seconds. Additionally, inflict damage equal to 25% of all damage received by the target during the duration of the mark, up to a total of 160% of the Wanderer's ATK. Only 1 mark can exist on a target at a time.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака пометит цель, вызывая взрыв через 5 секунд. Дополнительно наносит урон в размере 25% от получаемого целью урона в течение действия метки, всего до 160% от ATK Странника. Одновременно на цели может находиться только 1 метка."
  },
  Superpower: {
    name_en: "Altered Damage",
    name_ru: "Измененный урон",
    desc_en: "When the weapon is fully charged, the next attack will mark the target, causing an explosion after 5 seconds. Additionally, inflict damage equal to 25% of all damage received by the target during the duration of the mark, up to a total of 160% of the Wanderer's ATK. Only 1 mark can exist on a target at a time.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака пометит цель, вызывая взрыв через 5 секунд. Дополнительно наносит урон в размере 25% от получаемого целью урона в течение действия метки, всего до 160% от ATK Странника. Одновременно на цели может находиться только 1 метка."
  },
  Frost: {
    name_en: "Ice Shell",
    name_ru: "Ледяная оболочка",
    desc_en: "When the weapon is fully charged, the next attack will strongly freeze targets for 1 second and leave them frostbitten for 6 seconds. Breaking the ice shell deals damage equal to 100% of ATK. While frostbitten, the target's speed is reduced by 30%.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака интенсивно замораживает цели на 1 сек. и оставляет их обмороженными на 6 сек. Когда ледяная оболочка разбивается, цель получает урон в размере 100% от АТК. Пока цель обморожена, ее скорость снижается на 30%."
  },
  Volt: {
    name_en: "Volt",
    name_ru: "Электричество",
    desc_en: "When the weapon is fully charged, the next attack will strongly paralyze targets for 1 second, leave them electrified for 5 seconds, and deal damage equal to 100% of ATK. While paralyzed and/or electrified, the target can't receive any buffs.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака интенсивно парализует цели на 1 сек. и электризует их на 5 сек., нанося урон в размере 100% от АТК. Парализованные и/или наэлектризованные цели не могут получать никаких баффов."
  },
  Flame: {
    name_en: "Flame",
    name_ru: "Огонь",
    desc_en: "When the weapon is fully charged, the next attack will ignite the target for 8 seconds, dealing damage equal to 20% of ATK every second.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака на 8 сек. поджигает цель, нанося урон в размере 20% от АТК каждую секунду."
  },
  Physical: {
    name_en: "Grievous",
    name_ru: "Тяжелое ранение",
    desc_en: "When the weapon is fully charged, the next attack will cause enemies to become grievous for 7 seconds, reducing their healing effect by 30% and dealing damage equal to 100% of ATK.",
    desc_ru: "Когда оружие полностью заряжено, следующая атака накладывает на врагов эффект тяжелого ранения на 7 сек., ослабляя их эффекты лечения на 30% и нанося урон в размере 100% от АТК."
  }
};

function resolveElementComboIcon(element, elementSecondary) {
  if (!element || !elementSecondary || element === elementSecondary) return null;
  const pair = `${element}+${elementSecondary}`;
  if (pair === 'Physical+Flame') return '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_wuhuo.webp';
  if (pair === 'Flame+Physical') return '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_huowu.webp';
  if (pair === 'Volt+Frost') return '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_leibing.webp';
  if (pair === 'Frost+Volt') return '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_binglei.webp';
  return null;
}

function resolveRoleIcon(role) {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === 'dps' || r === 'attack') return '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_qianggong.webp';
  if (r === 'benediction' || r === 'sup' || r === 'support' || r === 'heal') return '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_zengyi.webp';
  if (r === 'tank' || r === 'fortitude' || r === 'defense') return '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp';
  return null;
}

function resolveSingleElementIcon(element) {
  if (!element) return null;
  const map = {
    Frost: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_bing.webp',
    Flame: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_huo.webp',
    Volt: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_lei.webp',
    Physical: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_wu.webp',
    Altered: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_powers.webp',
    Superpower: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_powers.webp'
  };
  return map[element] || null;
}

function resolveDualOnFieldPassive(slug, wKey, wNameEn, wNameRu, element, elementSecondary, en, ru, efFileMap) {
  if (!element || !elementSecondary || element === elementSecondary) return null;
  const fam = wKey.split('_')[0];
  const candidates = [];

  for (const [ns, table] of Object.entries(en)) {
    const nsl = ns.toLowerCase();
    if (nsl.includes(fam.toLowerCase()) || nsl.includes(slug.replace(/-/g, ''))) {
      for (const [k, v] of Object.entries(table)) {
        if (typeof v === 'string') {
          const vl = v.toLowerCase();
          if (
            (vl.includes('on-field') || vl.includes('swift cut') || vl.includes('detachment') || vl.includes('detatchment') || vl.includes('unload') || vl.includes('carnival') || vl.includes('release')) ||
            ((vl.includes('landing any hit') || vl.includes('hitting any target') || vl.includes('is equipped') || vl.includes('after using')) && (vl.includes('plus') || vl.includes('sum of') || vl.includes('max hp') || vl.includes('atk')))
          ) {
            candidates.push({ ns, key: k, text: v, isOs: nsl.includes('oversea') || k.toLowerCase().includes('_os') });
          }
        }
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.isOs !== b.isOs) return a.isOs ? -1 : 1;
    const aL0 = /level0|lv0|upgrade_0/i.test(a.key);
    const bL0 = /level0|lv0|upgrade_0/i.test(b.key);
    if (aL0 !== bL0) return aL0 ? -1 : 1;
    return 0;
  });

  if (candidates.length === 0) return null;
  const c = candidates[0];
  const rawEn = c.text;
  const rawRu = ru[c.ns]?.[c.key] || 
                ru[c.ns.replace(/_oversea/i, '')]?.[c.key] || 
                ru[c.ns + '_Oversea']?.[c.key] || 
                ru[c.ns]?.[c.key.replace(/_os$/i, '')] ||
                rawEn;

  function extractBlock(text, isRu = false) {
    const regex = /<shuzhi>([A-Za-z\u0400-\u04FF][^<]*?)<\/>\s*[:.]\s*([\s\S]*?)(?=(?:<shuzhi>[A-Za-z\u0400-\u04FF][^<]*?<\/>\s*[:.]|$))/gi;
    let match;
    const blocks = [];
    while ((match = regex.exec(text)) !== null) {
      blocks.push({ header: match[1].trim(), body: match[2].trim() });
    }
    const found = blocks.find(b => {
      const hl = b.header.toLowerCase();
      const bl = b.body.toLowerCase();
      if (!isRu) {
        return (hl.includes('on-field') || hl.includes('swift cut') || hl.includes('detachment') || hl.includes('detatchment') || hl.includes('unload') || hl.includes('carnival') || hl.includes('release')) ||
               ((bl.includes('landing any hit') || bl.includes('hitting any target') || bl.includes('is equipped') || bl.includes('after using')) && (bl.includes('plus') || bl.includes('sum of')));
      } else {
        return (hl.includes('поле') || hl.includes('удар') || hl.includes('рассечение') || hl.includes('разрез') || hl.includes('высвобождение') || hl.includes('разряд') || hl.includes('разгрузка') || hl.includes('карнавал') || hl.includes('постоянство')) ||
               ((bl.includes('наносит') || bl.includes('попадании') || bl.includes('экипировано') || bl.includes('применения') || bl.includes('использования')) && (bl.includes('плюс') || bl.includes('суммы') || bl.includes('+')));
      }
    });
    return found ? found.body : null;
  }

  const onFieldBodyEn = extractBlock(rawEn, false);
  const onFieldBodyRu = extractBlock(rawRu, true) || onFieldBodyEn;
  if (!onFieldBodyEn) return null;

  // Curves lookup from efFileMap
  const famLower = fam.toLowerCase();
  const slugClean = slug.replace(/-/g, '').toLowerCase();

  function getVal(pattern) {
    if (efFileMap && typeof efFileMap.entries === 'function') {
      for (const [t, rows] of efFileMap.entries()) {
        const tl = t.toLowerCase();
        if (tl.includes(famLower) || tl.includes(slugClean)) {
          for (const [k, v] of Object.entries(rows || {})) {
            if (pattern.test(k)) {
              const val = v?.Keys?.[0]?.Value ?? v?.Keys ?? v;
              if (typeof val === 'number') return val;
            }
          }
        }
      }
    }
    return null;
  }

  let cAtk = getVal(/SpecialATKCoefficient/i) ?? getVal(/SpecialATK/i) ?? 2.56;
  let cHp = getVal(/SpecialMaxHpCoefficient/i) ?? getVal(/SpecialMaxHp/i) ?? 0.036;
  let cDef = getVal(/SpecialDEFCoefficient/i) ?? getVal(/SpecialDEF/i) ?? 1.33;
  let cCrit = getVal(/SpecialCritCoefficient/i) ?? getVal(/SpecialCrit/i) ?? 0.049;
  let cFin = getVal(/SpecialFinCoefficient/i) ?? getVal(/SpecialFin/i) ?? 1.3;
  let cDur = 30;

  function formatBody(body, isRu = false) {
    let s = body;
    const fmt = (v) => isRu ? String(v).replace('.', ',') : String(v);

    const valAtk = Math.round(cAtk * 100 * 10) / 10;
    const valHp = Math.round(cHp * 100 * 10) / 10;
    const valDef = Math.round(cDef * 100 * 10) / 10;
    const valCrit = Math.round(cCrit * 100 * 10) / 10;
    const valFin = cFin;

    if (slug === 'meryl-ironheart') {
      s = s.replace(/\{0\}%?/g, `${fmt(valHp)}%`);
      s = s.replace(/\{1\}%?/g, `${fmt(valAtk)}%`);
      s = s.replace(/\{2\}%?/g, `${fmt(valDef)}%`);
      s = s.replace(/\{3\}%?/g, `${fmt(valCrit)}%`);
    } else if (slug === 'zeke') {
      s = s.replace(/\{0\}/g, `${cDur}`);
      s = s.replace(/\{1\}%?/g, `${fmt(valAtk)}%`);
      s = s.replace(/\{2\}%?/g, `${fmt(valHp)}%`);
      s = s.replace(/\{3\}%?/g, `${fmt(valDef)}%`);
      s = s.replace(/\{4\}%?/g, `${fmt(valCrit)}%`);
      s = s.replace(/\{5\}/g, `${fmt(valFin)}`);
    } else if (slug === 'plotti' || slug === 'greyfox' || slug === 'antoria') {
      s = s.replace(/\{0\}%?/g, `${fmt(valAtk)}%`);
      s = s.replace(/\{1\}%?/g, `${fmt(valHp)}%`);
      s = s.replace(/\{2\}%?/g, `${fmt(valDef)}%`);
      s = s.replace(/\{3\}%?/g, `${fmt(valCrit)}%`);
      s = s.replace(/\{4\}/g, `${cDur}`);
      s = s.replace(/\{5\}/g, `${fmt(valFin)}`);
    } else if (slug === 'skull' || slug === 'salidy') {
      s = s.replace(/\{4\}%?/g, `${fmt(valAtk)}%`);
      s = s.replace(/\{5\}%?/g, `${fmt(valHp)}%`);
      s = s.replace(/\{6\}%?/g, `${fmt(valDef)}%`);
      s = s.replace(/\{7\}%?/g, `${fmt(valCrit)}%`);
      s = s.replace(/\{8\}/g, `${fmt(valFin)}`);
    } else {
      s = s.replace(/\{0\}%?/g, `${fmt(valAtk)}%`);
      s = s.replace(/\{1\}%?/g, `${fmt(valHp)}%`);
      s = s.replace(/\{2\}%?/g, `${fmt(valDef)}%`);
      s = s.replace(/\{3\}%?/g, `${fmt(valCrit)}%`);
      s = s.replace(/\{4\}/g, `${fmt(valFin)}`);
    }

    s = cleanHtmlTags(s).trim();
    if (s.length > 0) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }
    return s;
  }

  const descEn = formatBody(onFieldBodyEn, false);
  const descRu = formatBody(onFieldBodyRu, true);

  return {
    id: `onfield_${slug}`,
    name_en: `${wNameEn}: On-Field`,
    name_ru: `${wNameRu}: На поле боя`,
    desc_en: descEn,
    desc_ru: descRu,
    desc_display_en: descEn,
    desc_display_ru: descRu,
    category: 'Passive',
    type: 'Passive',
    combo: null,
    type_tags: [],
    pct: null,
    icon: {
      resolved: false,
      placeholder: true,
      placeholderType: 'Passive',
      strategy: 'unresolved_typed_placeholder',
      diagnostic: 'Dual-element on-field passive'
    },
    icon_thumb: null,
    parameters: [],
    isOnField: true,
    provenance: { source: 'DualElementOnField', weapon: wKey, table: c.ns, key: c.key }
  };
}

function extractWeaponFamily(weaponKey, weaponRow) {
  const skillsList = weaponRow.WeaponSkillList || [];
  for (const s of skillsList) {
    const m = s.match(/^GA_(?:[FM]Player)?([A-Za-z0-9]+?)(?:Melee|Evade|Skill|ChangeSkill|_|$)/i);
    if (m && m[1] && m[1].toLowerCase() !== 'fplayer' && m[1].toLowerCase() !== 'mplayer') {
      return m[1];
    }
  }
  const parts = weaponKey.split('_');
  return parts[0];
}

function classifySkillCategory(actionKey, actionName, actionDesc) {
  const kLower = actionKey.toLowerCase();
  if (kLower.includes('changeskill') || kLower.includes('discharge')) return 'Discharge';
  if (kLower.includes('evade') || kLower.includes('dodge')) return 'Dodge';
  if (kLower.includes('melee') || kLower.includes('jumpattack') || kLower.includes('airattack') || kLower.includes('powerattack') || kLower.includes('branch')) return 'Normal';
  if (kLower.includes('passivity') || kLower.includes('passive')) return 'Passive';
  if (kLower.startsWith('ga_') && (kLower.includes('realskill') || kLower.includes('skill'))) return 'Skill';
  if (kLower.startsWith('buff_') || kLower.startsWith('ge_') || kLower.includes('level') || kLower.includes('resonance') || kLower.includes('beidong')) return 'Passive';

  const lower = `${actionName} ${actionDesc}`.toLowerCase();
  if (lower.includes('discharge') || lower.includes('разрядка')) return 'Discharge';
  if (lower.includes('dodge') || lower.includes('уклонение')) return 'Dodge';
  if (lower.includes('skill') || lower.includes('навык')) return 'Skill';
  if (lower.includes('normal attack') || lower.includes('обычная атака') || lower.includes('aerial') || lower.includes('jump')) return 'Normal';
  if (lower.includes('passive') || lower.includes('пассив') || lower.includes('resonance') || lower.includes('резонанс')) return 'Passive';
  return 'Other';
}

function toPascalCase(str) {
  return (str || '').split(/[_ -]+/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function resolveAdvancement({
  locResolver,
  fam,
  wKey,
  star,
  rarity = 'SSR',
  efRows = {},
  tipsByDescKey = null,
  efFileMap = null,
  en = {},
  ru = {},
  enNsMap = null,
  weaponUpgradeStarRows = null
}: Record<string, any>) {
  const famClean = (fam || '').replace(/[^A-Za-z0-9_]/g, '');
  const famBase = famClean.replace(/(?:sp|chess|rogue)$/i, '');
  const wKeyClean = (wKey || '').replace(/[^A-Za-z0-9_]/g, '');
  const wKeyBase = wKeyClean.split('_')[0];
  const rarityUpper = (rarity || 'SSR').toUpperCase();
  const rarityLower = rarityUpper.toLowerCase();

  let chosenKey = null;
  let chosenNs = null;
  let rawTextEn = null;
  let rawTextRu = null;
  let starRow = null;

  // 1. Authoritative lookup directly from WeaponUpgradeStarData (e.g. Darts_physic_ssr_star_2)
  if (weaponUpgradeStarRows && typeof weaponUpgradeStarRows === 'object') {
    const starCandidates = [
      `${wKeyClean}_${rarityLower}_star_${star}`,
      `${wKeyClean}_star_${star}`,
      `${wKeyBase}_${rarityLower}_star_${star}`,
      `${wKeyBase}_star_${star}`,
      `${famClean}_${rarityLower}_star_${star}`,
      `${famClean}_star_${star}`,
      `${famBase}_${rarityLower}_star_${star}`,
      `${famBase}_star_${star}`
    ];
    for (const sc of starCandidates) {
      if (weaponUpgradeStarRows[sc]) {
        starRow = weaponUpgradeStarRows[sc];
        break;
      }
    }
    if (!starRow) {
      const starSuffix = `_star_${star}`;
      const bases = [wKeyClean, wKeyBase, famClean, famBase].filter(Boolean).map(b => b.toLowerCase());
      for (const [k, v] of Object.entries(weaponUpgradeStarRows)) {
        const kl = k.toLowerCase();
        if (kl.endsWith(starSuffix) && !kl.startsWith('breakfate_')) {
          let prefix = kl.slice(0, -starSuffix.length).replace(/_(?:ssr|sr|r|n)$/i, '');
          const prefixStripped = prefix.replace(/_(?:physic|phy|fire|ice|thunder|elec|wind|superpower)$/i, '');
          if (bases.includes(prefix) || bases.includes(prefixStripped)) {
            starRow = v;
            break;
          }
        }
      }
    }

    if (starRow?.RemouldDetail?.Key) {
      const rKey = starRow.RemouldDetail.Key;
      const resEn = locResolver.resolve(starRow.RemouldDetail, { locale: 'en' });
      const resRu = locResolver.resolve(starRow.RemouldDetail, { locale: 'ru', fallbackLocale: 'en' });
      const tEn = cleanHtmlTags(resEn?.text);
      const tRu = cleanHtmlTags(resRu?.text || tEn);
      if (tEn && tEn.toLowerCase() !== 'none' && tEn !== '无' && tEn.toLowerCase() !== 'нет') {
        chosenKey = rKey;
        chosenNs = starRow.RemouldDetail.TableId || 'WeaponUpgradeStarData';
        rawTextEn = tEn;
        rawTextRu = tRu;
      }
    }
  }

  // 2. Candidate namespaces lookup (Oversea first, then normal Des, then BuffDes, and lastly BalanceDes)
  if (!rawTextEn || rawTextEn.trim().toLowerCase() === 'none' || rawTextEn.trim() === '无' || rawTextEn.trim().toLowerCase() === 'нет') {
    const candidateNamespaces = [];
    const addNs = (name) => {
      const actual = enNsMap ? enNsMap.get(name.toLowerCase()) : name;
      if (actual && !candidateNamespaces.includes(actual)) {
        candidateNamespaces.push(actual);
      }
    };

    addNs(`${famClean}Des_Oversea`);
    addNs(`${famClean}Des`);
    addNs(`${famBase}Des_Oversea`);
    addNs(`${famBase}Des`);
    addNs(`${wKeyBase}Des_Oversea`);
    addNs(`${wKeyBase}Des`);
    addNs('BuffDes_Oversea');
    addNs('BuffDes');

    const starRegex = new RegExp('(?:level_?|lv_?|leve_?|upgrade_?|_)' + star + '(?:[^0-9]|$)', 'i');

    for (const ns of candidateNamespaces) {
      const tableEn = en[ns];
      if (!tableEn || typeof tableEn !== 'object') continue;

      const isBuffDes = ns.toLowerCase().startsWith('buffdes');
      const matchingKeys = Object.keys(tableEn).filter(k => {
        const kl = k.toLowerCase();
        if (/matrix|suit|imitation|nitai|_name$|_reason_|_recommend_/i.test(kl)) return false;
        const levelMatch = kl.match(/(?:level|lv|leve|upgrade_)([0-9]+)/i);
        if (levelMatch && parseInt(levelMatch[1], 10) !== star) return false;
        if (!starRegex.test(kl)) return false;
        if (isBuffDes && (star === 1 || star === 2) && /_level[12](?:_des)?$/i.test(kl) && !/ssr|sr|weapon/i.test(kl)) return false;
        if (isBuffDes) {
          const famTokens = [famClean.toLowerCase(), famBase.toLowerCase(), wKeyBase.toLowerCase(), wKeyClean.toLowerCase()];
          return famTokens.some(tok => kl.includes(tok));
        }
        return true;
      });

      if (matchingKeys.length === 0) continue;

      const osKey = matchingKeys.find(k => /_(?:des_)?(?:os|overseas?)$/i.test(k));
      const exactLevelKey = matchingKeys.find(k => new RegExp('(?:level|lv|leve|upgrade_)' + star + '(?:_des)?(?:_os|_oversea)?$', 'i').test(k));
      const desKey = matchingKeys.find(k => /_des$/i.test(k));
      const bestKey = osKey || exactLevelKey || desKey || matchingKeys[0];

      const candEn = cleanHtmlTags(tableEn[bestKey]);
      if (candEn && candEn.toLowerCase() !== 'none' && candEn !== '无' && candEn.toLowerCase() !== 'нет') {
        chosenKey = bestKey;
        chosenNs = ns;
        rawTextEn = tableEn[bestKey];
        rawTextRu = ru?.[ns]?.[bestKey] || ru?.[ns.replace(/_oversea$/i, '')]?.[bestKey] || rawTextEn;
        break;
      }
    }
  }

  // 3. Fallback for star 2 & 4 to standard ATK/HP growth
  const isInvalidText = !rawTextEn || rawTextEn.trim().toLowerCase() === 'none' || rawTextEn.trim() === '无' || rawTextEn.trim().toLowerCase() === 'нет';

  if (isInvalidText && (star === 2 || star === 4)) {
    const standardAtkKey = `Weapon_level${star}_atkup_${rarityLower}`;
    const standardHpKey = `Weapon_level${star}_hpup_${rarityLower}`;
    const stdEn = en['BuffDes_Oversea']?.[standardAtkKey] || en['BuffDes']?.[standardAtkKey] ||
                  en['BuffDes_Oversea']?.[standardHpKey] || en['BuffDes']?.[standardHpKey];
    if (stdEn) {
      const usedKey = (en['BuffDes_Oversea']?.[standardAtkKey] || en['BuffDes']?.[standardAtkKey]) ? standardAtkKey : standardHpKey;
      chosenKey = usedKey;
      chosenNs = 'BuffDes_Oversea';
      rawTextEn = stdEn;
      rawTextRu = ru?.['BuffDes_Oversea']?.[usedKey] || ru?.['BuffDes']?.[usedKey] || stdEn;
    }
  }

  if (!rawTextEn || rawTextEn.trim().toLowerCase() === 'none' || rawTextEn.trim() === '无' || rawTextEn.trim().toLowerCase() === 'нет') {
    const isAtk = star === 2;
    const pct = star === 2 ? (rarityLower === 'sr' ? 10 : 16) : (rarityLower === 'sr' ? 20 : 32);
    return {
      star,
      name_en: `${star} Star Advancement`,
      name_ru: `${star}★ Улучшение`,
      desc_en: `Increases the current weapon's Base ${isAtk ? 'ATK' : 'HP'} growth by ${pct}%.`,
      desc_ru: `Увеличивает рост базовой ${isAtk ? 'АТК' : 'ОЗ'} текущего оружия на ${pct}%.`,
      multipliers: {},
      isGeneric: false
    };
  }

  // Curve matching: Level${star}, Lv${star}, Star${star}, L${star}, _${star}
  const starCurveRegex = new RegExp('(?:level_?|lv_?|leve_?|star_?|weaponlevel_?|_l|[a-z]l|_)' + star + '(?:[^0-9]|$)', 'i');
  const matchedCurves = [];
  const multipliers: Record<string, any> = {};

  for (const [cName, cRow] of Object.entries(efRows || {})) {
    const cLower = cName.toLowerCase();
    if (/matrix|suit|imitation/i.test(cLower)) continue;
    if (starCurveRegex.test(cLower)) {
      const val = cRow?.Keys?.[0]?.Value !== undefined ? cRow.Keys[0].Value : (cRow?.DefaultValue !== undefined && cRow.DefaultValue < 1e30 ? cRow.DefaultValue : null);
      if (typeof val === 'number') {
        matchedCurves.push({ name: cName, val });
        multipliers[cName] = val;
      }
    }
  }

  const starRowParams = starRow?.RemouldDetailParams;
  const tipRow = chosenKey && tipsByDescKey ? tipsByDescKey.get(chosenKey.toLowerCase()) : null;
  const descParams = (starRowParams && starRowParams.length > 0) ? starRowParams : (tipRow?.DescParam || []);

  function formatAdvDesc(desc) {
    if (!desc || typeof desc !== 'string') return '';
    let formatted = desc.replace(/\{(\d+)\}(%?)/g, (match, p1, pct) => {
      const idx = parseInt(p1, 10);
      const isPercentPlaceholder = pct === '%' || desc.includes(`<shuzhi>{${p1}}%</>`) || desc.includes(`{${p1}}%`);

      // 1. Check DescParam from tips row first
      const dp = descParams[idx];
      if (dp && typeof dp.Value === 'number' && (!dp.Curve?.RowName || dp.Curve.RowName === 'None')) {
        return formatVal(dp.Value) + pct;
      }
      if (dp && dp.Curve?.RowName && dp.Curve.RowName !== 'None') {
        const rn = dp.Curve.RowName;
        const ct = dp.Curve.CurveTable?.ObjectName || dp.Curve.CurveTable?.ObjectPath || '';
        const mult = typeof dp.Value === 'number' ? dp.Value : 1;

        let rawVal = null;
        if (ct && efFileMap) {
          rawVal = findCurveValue(efFileMap, ct, rn);
        }
        if (rawVal === null || rawVal === undefined) {
          const curveRow = efRows?.[rn] || Object.entries(efRows || {}).find(([k]) => k.toLowerCase() === rn.toLowerCase())?.[1];
          rawVal = curveRow?.Keys?.[0]?.Value !== undefined ? curveRow.Keys[0].Value : (curveRow?.DefaultValue !== undefined && curveRow.DefaultValue < 1e30 ? curveRow.DefaultValue : null);
        }
        if (typeof rawVal === 'number') {
          const finalVal = Math.round(rawVal * mult * 100) / 100;
          return formatVal(finalVal) + pct;
        }
      }

      // 2. Fallback to matchedCurves positional assignment or curve search in efRows
      let curve = matchedCurves[idx];
      if (!curve && efRows) {
        const placeholderContext = desc.slice(Math.max(0, desc.indexOf(match) - 40), desc.indexOf(match) + 40).toLowerCase();
        for (const [cName, cRow] of Object.entries(efRows)) {
          const cLower = cName.toLowerCase();
          if (/matrix|suit|imitation/i.test(cLower)) continue;
          let candidateMatch = false;
          if (placeholderContext.includes('ignore') && /passarmor|ignore/i.test(cLower)) candidateMatch = true;
          else if (placeholderContext.includes('resist') && /defdown|resist/i.test(cLower)) candidateMatch = true;
          if (candidateMatch) {
            const val = cRow?.Keys?.[0]?.Value !== undefined ? cRow.Keys[0].Value : (cRow?.DefaultValue !== undefined && cRow.DefaultValue < 1e30 ? cRow.DefaultValue : null);
            if (typeof val === 'number') {
              curve = { name: cName, val: Math.abs(val) };
              break;
            }
          }
        }
      }
      if (!curve) return match;

      const rawVal = curve.val;
      if (isPercentPlaceholder && Math.abs(rawVal) <= 1 && rawVal !== 0) {
        return formatVal(Math.round(rawVal * 100 * 100) / 100) + pct;
      } else if (isPercentPlaceholder && Math.abs(rawVal) > 1) {
        if (!Number.isInteger(rawVal) && rawVal < 10) {
          return formatVal(Math.round(rawVal * 100 * 100) / 100) + pct;
        }
        if (/skill|extra|atk|dmg|damage/i.test(curve.name) && rawVal >= 20 && rawVal <= 1000) {
          return formatVal(Math.round(rawVal * 100 * 100) / 100) + pct;
        }
        return formatVal(rawVal) + pct;
      } else {
        return formatVal(rawVal) + pct;
      }
    });

    formatted = cleanHtmlTags(formatted).trim();
    formatted = formatted.replace(/\{[0-9]+\}%?/g, '—').replace(/\{[^{}]*\}/g, '—');
    return formatted;
  }

  let descEn = formatAdvDesc(rawTextEn);
  let descRu = formatAdvDesc(rawTextRu);

  if (!descEn || descEn.toLowerCase() === 'none' || descEn === '无' || descEn.toLowerCase() === 'нет') {
    const isAtk = star === 2;
    const pct = star === 2 ? (rarityLower === 'sr' ? 10 : 16) : (rarityLower === 'sr' ? 20 : 32);
    descEn = `Increases the current weapon's Base ${isAtk ? 'ATK' : 'HP'} growth by ${pct}%.`;
    descRu = `Увеличивает рост базовой ${isAtk ? 'АТК' : 'ОЗ'} текущего оружия на ${pct}%.`;
  }

  return {
    star,
    name_en: `${star} Star Advancement`,
    name_ru: `${star}★ Улучшение`,
    desc_en: descEn,
    desc_ru: descRu,
    multipliers,
    key: chosenKey,
    namespace: chosenNs,
    isGeneric: false
  };
}

function resolveAdvancementText(locResolver, effectKey, star, locale, rarity = 'SSR', avatarId = '', wKey = '', slug = '') {
  const adv = resolveAdvancement({
    locResolver,
    fam: effectKey,
    wKey,
    star,
    rarity,
    efRows: {},
    tipsByDescKey: null,
    efFileMap: null,
    en: locResolver?.locales?.en || {},
    ru: locResolver?.locales?.ru || {},
    enNsMap: null
  });
  return locale === 'ru' ? adv.desc_ru : adv.desc_en;
}

function resolveMatrixPiece(locResolver, matrixRow, effectKey, suitId, pieceIndex, locale) {
  const pieceNum = pieceIndex === 0 ? 1 : 2;
  const suitIdBare = suitId ? suitId.replace(/^suit_/i, '') : '';
  const keyCandidates = [
    `MatrixSuit_${suitIdBare}_des${pieceNum}_OS`,
    `MatrixSuit_${suitIdBare}_des${pieceNum}`,
    `Buff_Matrix_${suitIdBare}_level${pieceNum}_des_OS`,
    `Buff_Matrix_${suitIdBare}_level${pieceNum}_des`,
    `MatrixSuit_${suitId}_des${pieceNum}_OS`,
    `MatrixSuit_${suitId}_des${pieceNum}`
  ];

  // 1. Direct FText lookup from matrixRow.SuitUnactivateDetailList if present
  if (matrixRow && matrixRow.SuitUnactivateDetailList && matrixRow.SuitUnactivateDetailList[pieceIndex]) {
    const ftext = matrixRow.SuitUnactivateDetailList[pieceIndex];
    const res = locResolver.resolve(ftext, { locale });
    const status = res?.provenance?.status || res?.strategy;
    const isResolved = status === 'resolved' || status === 'exact_namespace_key' || status === 'case_variant_namespace_key';
    if (isResolved && res?.text && res.text !== ftext.Key && res.text !== `${ftext.TableId}.${ftext.Key}`) {
      return cleanHtmlTags(res.text);
    }
  }

  // 2. Lookup across character's namespaces by suitId
  const namespaces = [
    `${effectKey}Des_Oversea`,
    `${effectKey}Des`,
    `${effectKey}_Oversea`,
    `${effectKey}`
  ];

  for (const ns of namespaces) {
    for (const key of keyCandidates) {
      const res = locResolver.resolve({ TableId: ns, Key: key }, { locale });
      const status = res?.provenance?.status || res?.strategy;
      const isResolved = status === 'resolved' || status === 'exact_namespace_key' || status === 'case_variant_namespace_key';
      if (isResolved && res?.text && res.text !== key && res.text !== `${ns}.${key}`) {
        return cleanHtmlTags(res.text);
      }
    }
  }

  return null;
}

function formatVal(v) {
  if (typeof v !== 'number') return String(v);
  if (Number.isInteger(v)) return v.toString();
  return (Math.round(v * 100) / 100).toString();
}

function findCurveValue(efMap, curveTableStr, rowName, outMeta = null) {
  if (!efMap || !curveTableStr || !rowName) return null;
  const m = curveTableStr.match(/([A-Za-z0-9_]+EffectFigure)/i) || curveTableStr.match(/([A-Za-z0-9_]+)\b/);
  if (!m) return null;
  const rawName = m[1].toLowerCase();
  const cleanRaw = rawName.replace(/_(?:overseas?|os)$/i, '');
  const cleanShort = cleanRaw.replace(/effectfigure$/i, '');

  const candidates = [
    cleanShort + '_overseas',
    cleanShort + '_oversea',
    cleanShort + '_os',
    cleanRaw + '_overseas',
    cleanRaw + '_oversea',
    cleanRaw + '_os',
    cleanShort,
    cleanRaw,
    rawName
  ];

  for (const cand of candidates) {
    const table = efMap.get(cand);
    if (table && table[rowName]) {
      const row = table[rowName];
      if (Array.isArray(row.Keys) && row.Keys.length > 0) {
        if (outMeta && typeof outMeta === 'object') {
          outMeta.isOverseas = /_(?:overseas?|os)$/i.test(cand);
          outMeta.tableKey = cand;
        }
        return row.Keys[row.Keys.length - 1].Value;
      }
    }
  }

  return null;
}

function normalizeSkillFormulaSpacing(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text;
  // 1. Missing space before percentage or placeholder if glued to a word (e.g. "dealing4404%" -> "dealing 4404%")
  s = s.replace(/([a-zA-Z\u0400-\u04FF])(\d+(?:\.\d+)?%|\{\d+\}%)/g, '$1 $2');
  // 2. Normalize formula spacing around +
  // Matches e.g. "% of ATK + 18947", "от АТК + 18947", "500% + 200", "{0}% of ATK + {1}"
  s = s.replace(/(of\s+ATK|от\s+АТК|от\s+ATK|%)\s*\+\s*(\d+(?:\.\d+)?|\{\d+\})/gi, '$1 + $2');
  // 3. Catch any remaining " +  " or "  + " or " + " with multiple spaces or missing space around + between words/tokens
  s = s.replace(/(ATK|АТК)\s*\+\s*(\d+(?:\.\d+)?|\{\d+\})/gi, '$1 + $2');
  return s;
}

function formatSkillDescription(desc, skill, efRows = null, descParams = null) {
  if (!desc || typeof desc !== 'string') return '';
  const sName = skill?.name_en || skill?.name || '';
  // Icebound (desc == name): keep it, show the name without a fake description; no {n}
  if (sName && desc.trim().toLowerCase() === sName.trim().toLowerCase()) {
    return desc.trim();
  }

  const params = skill?.parameters || [];

  const sIdLower = (skill?.id || '').toLowerCase()
    .replace(/^ga_fplayer|^ga_mplayer|^ga_|^buff_/i, '')
    .replace(/_success$/i, '')
    .replace(/powear/i, 'power')
    .replace(/forwardevadeattack/i, 'forwardattack');

  let formatted = desc.replace(/\{(\d+)\}(%?)/g, (match, p1, pct) => {
    const placeholderIdx = parseInt(p1, 10);
    const targetSuffix = `_${placeholderIdx + 1}`;

    let matched = params.find(p => {
      const pLower = (p.key || '').toLowerCase()
        .replace(/^ga_fplayer|^ga_mplayer|^ga_|^buff_/i, '')
        .replace(/_success/i, '')
        .replace(/powear/i, 'power')
        .replace(/forwardevadeattack/i, 'forwardattack');
      return pLower.endsWith(targetSuffix) && pLower.includes(sIdLower);
    });

    if (!matched) {
      matched = params.find(p => (p.key || '').endsWith(targetSuffix));
    }

    if (!matched && params[placeholderIdx]) {
      matched = params[placeholderIdx];
    }

    if (matched && matched.levels) {
      const levelKeys = Object.keys(matched.levels).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (levelKeys.length > 0) {
        const maxLevel = levelKeys[levelKeys.length - 1];
        const val = matched.levels[maxLevel];
        if (typeof val === 'number') {
          return formatVal(val) + pct;
        }
      }
    }

    // Fallback 1: check descParams if available (e.g. from geRow.DescParam)
    if (descParams && descParams[placeholderIdx]) {
      const dp = descParams[placeholderIdx];
      if (typeof dp.Value === 'number' && (!dp.Curve?.RowName || dp.Curve.RowName === 'None')) {
        return formatVal(dp.Value) + pct;
      }
      if (dp.Curve?.RowName && dp.Curve.RowName !== 'None') {
        const rn = dp.Curve.RowName;
        const curveRow = efRows?.[rn] || Object.entries(efRows || {}).find(([k]) => k.toLowerCase() === rn.toLowerCase())?.[1];
        const rawVal = curveRow?.Keys?.[0]?.Value !== undefined ? curveRow.Keys[0].Value : (curveRow?.DefaultValue !== undefined && curveRow.DefaultValue < 1e30 ? curveRow.DefaultValue : null);
        if (typeof rawVal === 'number') {
          const mult = typeof dp.Value === 'number' ? dp.Value : 1;
          const finalVal = Math.round(rawVal * mult * 100) / 100;
          return formatVal(finalVal) + pct;
        }
      }
    }

    // Fallback 2: check efRows for matching curves
    if (efRows && typeof efRows === 'object') {
      const surrounding = desc.slice(Math.max(0, desc.indexOf(match) - 30), desc.indexOf(match) + 40).toLowerCase();
      const isSeconds = /second|sec|сек|время|cd|cooldown|перезарядк/i.test(surrounding);
      const isPercent = pct === '%' || /%|percent|процент/i.test(surrounding);

      for (const [cName, cRow] of Object.entries(efRows)) {
        const cLower = cName.toLowerCase();
        if (/matrix|suit|imitation/i.test(cLower)) continue;

        let candidateMatch = false;
        const tokens = sIdLower.split('_').filter(t => t.length >= 3);
        const hasToken = tokens.some(t => cLower.includes(t));

        if (hasToken) {
          if (isSeconds && /duration|cd|time/i.test(cLower)) candidateMatch = true;
          else if (isPercent && /rate|up|add|coef|dam|percent/i.test(cLower)) candidateMatch = true;
          else if (!isSeconds && !isPercent) candidateMatch = true;
        }

        if (candidateMatch) {
          const val = cRow?.Keys?.[cRow.Keys.length - 1]?.Value !== undefined ? cRow.Keys[cRow.Keys.length - 1].Value : (cRow?.DefaultValue !== undefined && cRow.DefaultValue < 1e30 ? cRow.DefaultValue : null);
          if (typeof val === 'number') {
            const finalVal = (isPercent && val <= 1 && val > 0) ? Math.round(val * 100 * 100) / 100 : Math.round(val * 100) / 100;
            return formatVal(finalVal) + pct;
          }
        }
      }
    }

    return match;
  });

  // Where none exists or cannot be filled, replace the numeric fragment with a neutral display (shown as "—"), so the entry reads clean.
  formatted = formatted.replace(/\{[0-9]+\}%?/g, '—').replace(/\{[^{}]*\}/g, '—');
  return normalizeSkillFormulaSpacing(formatted);
}

function formatTraitDescription(desc, traitRow, efMap) {
  if (!desc || typeof desc !== 'string') return '';
  const descParams = traitRow?.DescParam || [];

  let formatted = desc.replace(/\{(\d+)\}/g, (match, p1) => {
    const idx = parseInt(p1, 10);
    const param = descParams[idx];
    if (!param) return match;

    const mult = typeof param.Value === 'number' ? param.Value : 1;
    const curveObj = param.Curve;
    const curveTableName = curveObj?.CurveTable?.ObjectName || curveObj?.CurveTable?.ObjectPath || '';
    const rowName = curveObj?.RowName;

    let rows = null;
    if (curveTableName && efMap) {
      const rawTable = curveTableName.includes("'") ? (curveTableName.match(/CurveTable'([^']+)'/)?.[1] || curveTableName) : curveTableName;
      const cleanTable = rawTable.split('/').pop().split('.')[0].toLowerCase().replace(/_(?:overseas?|os)$/i, '').replace(/effectfigure$/i, '');
      rows = efMap.get(cleanTable) ||
             efMap.get(cleanTable.replace(/_oversea$/i, '')) ||
             efMap.get(cleanTable.replace(/effectfigure(?:_oversea)?$/i, ''));
    }

    if (rows && rowName && rowName !== 'None') {
      const curveRow = rows[rowName] || Object.entries(rows).find(([k]) => k.toLowerCase() === rowName.toLowerCase())?.[1];
      const rawVal = curveRow?.Keys?.[0]?.Value !== undefined
        ? curveRow.Keys[0].Value
        : (curveRow?.DefaultValue !== undefined && curveRow.DefaultValue < 1e30 ? curveRow.DefaultValue : null);
      if (typeof rawVal === 'number') {
        const finalVal = rawVal * mult;
        return String(Math.round(finalVal * 100) / 100);
      }
    }

    if (typeof param.Value === 'number' && (!rowName || rowName === 'None')) {
      return String(param.Value);
    }

    return match;
  });

  formatted = formatted.replace(/\{[0-9]+\}%?/g, '—').replace(/\{[^{}]*\}/g, '—');
  return formatted;
}

function extractTraitDriver(descEn, descRu, wNameEn, wNameRu) {
  if (!descEn || typeof descEn !== 'string') return null;

  // 1. Explicit star advancement pattern: e.g. 'advanced to 1 star', 'at 1 star', '1 star advancement'
  const starMatch = descEn.match(/(?:advanced to|at|reach(?:es)?)\s*([0-6])\s*star/i) ||
                    descEn.match(/([0-6])\s*star\s*(?:advancement|weapon)?/i);

  const weaponMentionedEn = wNameEn && descEn.toLowerCase().includes(wNameEn.toLowerCase());
  const weaponMentionedRu = wNameRu && descRu && descRu.toLowerCase().includes(wNameRu.toLowerCase());

  if (starMatch && weaponMentionedEn) {
    return {
      driver_en: `${starMatch[1]}★ ${wNameEn}`,
      driver_ru: `${starMatch[1]}★ ${wNameRu || wNameEn}`
    };
  } else if (starMatch) {
    return {
      driver_en: `${starMatch[1]}★ ${wNameEn || 'Advancement'}`,
      driver_ru: `${starMatch[1]}★ ${wNameRu || wNameEn || 'Улучшение'}`
    };
  }

  // 2. Weapon equip or activation requirement:
  if (wNameEn && (
    descEn.toLowerCase().includes('equipping ' + wNameEn.toLowerCase()) ||
    descEn.toLowerCase().includes('equipped with ' + wNameEn.toLowerCase()) ||
    descEn.toLowerCase().includes('with ' + wNameEn.toLowerCase() + ' equipped') ||
    descEn.toLowerCase().includes('using ' + wNameEn.toLowerCase()) ||
    descEn.toLowerCase().includes('when ' + wNameEn.toLowerCase() + ' is')
  )) {
    return {
      driver_en: wNameEn,
      driver_ru: wNameRu || wNameEn
    };
  }

  return null;
}

function resolveExactSkillIcon({ actionBase, category, charKeys = [], geTipsRows = {}, geTipsLower = new Map<any, any>(), gaTipsMap = new Map<any, any>(), gaTipsNormMap = new Map<any, any>(), imageCopier = null }: Record<string, any>) {
  if (!actionBase) {
    return {
      resolved: false,
      placeholder: true,
      placeholderType: category || 'Other',
      strategy: 'unresolved_typed_placeholder',
      diagnostic: 'No action identifier provided'
    };
  }

  const sLower = actionBase.toLowerCase();
  let tipRow = (geTipsRows && geTipsRows[actionBase]) ||
               (geTipsLower && geTipsLower.get(sLower)) ||
               (geTipsLower && geTipsLower.get(sLower.replace(/_level1display$/i, '_level0display'))) ||
               (geTipsLower && geTipsLower.get(sLower.replace(/_level1display$/i, '_level6display'))) ||
               (geTipsLower && geTipsLower.get(sLower.replace(/_level0display$/i, '_level1display'))) ||
               (geTipsLower && geTipsLower.get('buff_' + sLower)) ||
               (sLower.startsWith('buff_') && geTipsLower ? geTipsLower.get(sLower.replace(/^buff_/, '')) : null);

  if (!tipRow && sLower.startsWith('imitation_') && geTipsLower) {
    const imitKey = 'buff_' + sLower;
    tipRow = geTipsLower.get(imitKey) || geTipsLower.get(sLower);
  }

  let assetRef = null;
  let source = null;

  if (tipRow?.Icon?.AssetPathName && tipRow.Icon.AssetPathName !== 'None' && imageCopier?.exactPathIndex) {
    const rawCheck = tipRow.Icon.AssetPathName.split('.')[0].toLowerCase();
    if (imageCopier.exactPathIndex.has(rawCheck) || imageCopier.exactPathIndex.has(tipRow.Icon.AssetPathName.toLowerCase())) {
      assetRef = tipRow.Icon.AssetPathName;
      source = 'gameplay_effect_tips';
    }
  }

  // 1b. Check GameplayAbilityTipsDataTable (Authoritative export for active/branch/weapon abilities)
  if (!assetRef && (gaTipsMap?.size > 0 || gaTipsNormMap?.size > 0) && imageCopier?.exactPathIndex) {
    let gaAsset = gaTipsMap ? gaTipsMap.get(sLower) : null;
    if (!gaAsset && sLower.startsWith('ga_fplayer')) {
      gaAsset = gaTipsMap.get(sLower.replace('ga_fplayer', 'ga_mplayer'));
    } else if (!gaAsset && sLower.startsWith('ga_mplayer')) {
      gaAsset = gaTipsMap.get(sLower.replace('ga_mplayer', 'ga_fplayer'));
    }
    if (!gaAsset && gaTipsNormMap) {
      const norm = sLower.replace(/^ga_(?:[fm]player)?/i, '').replace(/_os$/i, '');
      gaAsset = gaTipsNormMap.get(norm);
    }

    if (gaAsset && gaAsset !== 'None') {
      const rawCheck = gaAsset.split('.')[0].toLowerCase();
      if (imageCopier.exactPathIndex.has(rawCheck) || imageCopier.exactPathIndex.has(gaAsset.toLowerCase())) {
        assetRef = gaAsset;
        source = 'gameplay_ability_tips';
      }
    }
  }

  if (!assetRef && imageCopier?.exactPathIndex) {
    const m = actionBase.match(/^GA_(?:[FM]Player)?([A-Za-z0-9]+?)(?:Melee|Evade|Skill|ChangeSkill|_|$)/i);
    const embeddedKey = m ? m[1] : null;

    const candidateKeys = [];
    if (embeddedKey && !['fplayer', 'mplayer'].includes(embeddedKey.toLowerCase())) {
      candidateKeys.push(embeddedKey);
    }
    for (const k of charKeys) {
      if (k && !candidateKeys.includes(k) && !['fplayer', 'mplayer'].includes(k.toLowerCase())) {
        candidateKeys.push(k);
      }
    }

    const actionLower = actionBase.toLowerCase()
      .replace(/^ga_fplayer|^ga_mplayer|^ga_/i, '')
      .replace(/^name_/i, '')
      .replace(/_success$/i, '');

    const actionTokens = new Set<any>();

    // Evade tokens
    if (actionLower.includes('backattack') || actionLower.includes('bevadeattack') || actionLower.includes('backevade') || actionLower.includes('evadeattack_back') || actionLower.includes('backevadeattack') || actionLower.includes('bevadeatk') || actionLower.includes('bevadea') || actionLower.includes('evade_backattack') || actionLower.includes('evadeattackb') || actionLower.includes('evadeattackback')) {
      actionTokens.add('bevadeattack'); actionTokens.add('backevadeattack'); actionTokens.add('bevadeatk'); actionTokens.add('bevadea'); actionTokens.add('backattack'); actionTokens.add('evadeattackb'); actionTokens.add('evadeattackback'); actionTokens.add('evadeback');
    }
    if (actionLower.includes('forwardattack') || actionLower.includes('fevadeattack') || actionLower.includes('forwardevade') || actionLower.includes('evadeattack_front') || actionLower.includes('frontevadeattack') || actionLower.includes('fevadeatk') || actionLower.includes('fevadea') || actionLower.includes('evadeattack_forward') || actionLower.includes('evade_forwardattack') || actionLower.includes('evadeattackf') || actionLower.includes('evadeattackfront')) {
      actionTokens.add('fevadeattack'); actionTokens.add('frontevadeattack'); actionTokens.add('fevadeatk'); actionTokens.add('fevadea'); actionTokens.add('forwardattack'); actionTokens.add('frontattack'); actionTokens.add('evadeattackf'); actionTokens.add('evadeattackfront'); actionTokens.add('evadefront');
    }
    if (actionLower.includes('holdforward') || actionLower.includes('fevadehold') || actionLower.includes('evade_forward') || actionLower.includes('evade_hold') || actionLower.includes('evadehold')) {
      actionTokens.add('fevadehold'); actionTokens.add('holdfevade'); actionTokens.add('holdforward'); actionTokens.add('evadehold');
    }
    if (actionLower.includes('holdback') || actionLower.includes('bevadehold') || actionLower.includes('evade_back')) {
      actionTokens.add('bevadehold'); actionTokens.add('holdbevade'); actionTokens.add('holdback');
    }
    if (actionLower.includes('evade') || actionLower.includes('dodge')) {
      actionTokens.add('evade'); actionTokens.add('evadeattack'); actionTokens.add('dodge'); actionTokens.add('evadeon');
    }

    // Sneak attack tokens
    if (actionLower.includes('sneak')) {
      actionTokens.add('sneak'); actionTokens.add('sneakattack'); actionTokens.add('melee');
    }

    // Discharge tokens (CHECKED BEFORE GENERIC SKILL)
    if (actionLower.includes('changeskill') || actionLower.includes('discharge')) {
      actionTokens.add('changeskill'); actionTokens.add('discharge');
    }

    // Skill tokens (ONLY IF NOT CHANGESKILL)
    if (!actionLower.includes('changeskill')) {
      if (actionLower.includes('skillbranch')) {
        actionTokens.add('skillbranch');
      }
      if (actionLower.includes('skill4')) {
        actionTokens.add('skill4');
      }
      if (actionLower.includes('skill3') || actionLower.includes('skill03')) {
        actionTokens.add('skill3'); actionTokens.add('skill03');
      }
      if (actionLower.includes('skill2') || actionLower.includes('skill_2') || actionLower.includes('skill02') || actionLower.includes('realskill2') || actionLower.includes('skill_music')) {
        actionTokens.add('skill2'); actionTokens.add('skill02'); actionTokens.add('skill_music'); actionTokens.add('realskill2'); actionTokens.add('skill'); actionTokens.add('realskill');
      }
      if (actionLower.includes('skill1') || actionLower.includes('skill_1') || actionLower.includes('skill01') || actionLower.includes('realskill1') || actionLower.includes('skill_normal')) {
        actionTokens.add('skill1'); actionTokens.add('skill01'); actionTokens.add('skill_normal'); actionTokens.add('realskill1'); actionTokens.add('skill'); actionTokens.add('realskill');
      }
      if (actionLower.includes('skill') || actionLower.includes('realskill')) {
        actionTokens.add('skill'); actionTokens.add('realskill'); actionTokens.add('skill1'); actionTokens.add('skill01');
      }
    }

    // Melee / Normal attack tokens
    if (actionLower.includes('airattack') || actionLower.includes('airmelee')) {
      actionTokens.add('airattack'); actionTokens.add('airmelee'); actionTokens.add('melee1'); actionTokens.add('air'); actionTokens.add('specialairattack');
    }
    if (actionLower.includes('branchmelee') || actionLower.includes('meleebranch') || actionLower.includes('melee_branch')) {
      actionTokens.add('branch'); actionTokens.add('branchmelee'); actionTokens.add('meleebranch'); actionTokens.add('branch1');
    }
    if (actionLower.includes('branch1') || actionLower.includes('branch_1')) {
      actionTokens.add('branch1'); actionTokens.add('branch');
    }
    if (actionLower.includes('branch2') || actionLower.includes('branch_2')) {
      actionTokens.add('branch2'); actionTokens.add('branch');
    }
    if (actionLower.includes('branch3') || actionLower.includes('branch_3')) {
      actionTokens.add('branch3'); actionTokens.add('branch');
    }
    if (actionLower.includes('branch4') || actionLower.includes('branch_4')) {
      actionTokens.add('branch4'); actionTokens.add('branch');
    }
    if (actionLower.includes('branch')) {
      actionTokens.add('branch'); actionTokens.add('meleebranch'); actionTokens.add('branchmelee');
    }
    if (actionLower.includes('jumpattack') || actionLower.includes('fallingatk') || actionLower.includes('fallingattack') || actionLower.includes('falling')) {
      actionTokens.add('jumpattack'); actionTokens.add('fallingatk'); actionTokens.add('fallingattack'); actionTokens.add('falling'); actionTokens.add('airjumpattack');
    }
    if (actionLower.includes('powearattack') || actionLower.includes('powerattack') || actionLower.includes('power')) {
      actionTokens.add('powerattack'); actionTokens.add('power'); actionTokens.add('powearattack');
    }
    if (actionLower.includes('melee') || actionLower.includes('attack')) {
      actionTokens.add('melee'); actionTokens.add('melee1'); actionTokens.add('pugong-melee'); actionTokens.add('pugong_melee'); actionTokens.add('pugong'); actionTokens.add('attack');
    }

    // Mobility / Special tokens
    if (actionLower.includes('glid')) {
      actionTokens.add('glid'); actionTokens.add('glidattack'); actionTokens.add('glide');
    }
    if (actionLower.includes('transform')) {
      actionTokens.add('transform'); actionTokens.add('extratransform');
    }
    if (actionLower.includes('superjump')) {
      actionTokens.add('superjump');
    }
    if (actionLower.includes('fly')) {
      actionTokens.add('fly'); actionTokens.add('flyon');
    }
    if (actionLower.includes('gravitycancel')) {
      actionTokens.add('gravitycancel');
    }
    if (actionLower.includes('modechange')) {
      actionTokens.add('modechange');
    }
    if (actionLower.includes('immunedeath')) {
      actionTokens.add('immunedeath');
    }
    if (actionLower.includes('bed')) {
      actionTokens.add('bed');
    }

    for (const token of actionTokens) {
      for (const k of candidateKeys) {
        const kPascal = toPascalCase(k);
        const kLower = k.toLowerCase();
        const tokPascal = toPascalCase(token);

        const cands = [
          // Subdirectory WeaponSkill/<Family>/...
          `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/${kPascal}_${tokPascal}.${kPascal}_${tokPascal}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${k}/${k}_${token}.${k}_${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/${tokPascal}.${tokPascal}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${k}/${token}.${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/skill_${kPascal}_${tokPascal}.skill_${kPascal}_${tokPascal}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${kLower}/skill_${kLower}_${token}.skill_${kLower}_${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/${kPascal}_pugong-melee.${kPascal}_pugong-melee`,

          // Flat WeaponSkill/...
          `/Game/Resources/Icon/skill/WeaponSkill/skill_${k}_${token}.skill_${k}_${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/skill_${kLower}_${token}.skill_${kLower}_${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/skill_${kPascal}_${tokPascal}.skill_${kPascal}_${tokPascal}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${k}_${token}.${k}_${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${kLower}_${token}.${kLower}_${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}_${tokPascal}.${kPascal}_${tokPascal}`,
          `/Game/Resources/Icon/skill/WeaponSkill/Skill-${k}-${token}.Skill-${k}-${token}`,
          `/Game/Resources/Icon/skill/WeaponSkill/Skill-${kPascal}-${tokPascal}.Skill-${kPascal}-${tokPascal}`,

          // Flat root Icon/skill/... (1.0 legacy paths)
          `/Game/Resources/Icon/skill/${kLower}_${token}.${kLower}_${token}`,
          `/Game/Resources/Icon/skill/${kPascal}_${tokPascal}.${kPascal}_${tokPascal}`,
          `/Game/Resources/Icon/skill/${k}_${token}.${k}_${token}`,
          `/Game/Resources/Icon/skill/skill_${kLower}_${token}.skill_${kLower}_${token}`
        ];

        for (const c of cands) {
          const checkKey = c.split('.')[0].toLowerCase();
          if (imageCopier.exactPathIndex.has(checkKey) || imageCopier.exactPathIndex.has(c.toLowerCase())) {
            assetRef = c;
            source = 'combat_action_canonical_ref';
            break;
          }
        }
        if (assetRef) break;
      }
      if (assetRef) break;
    }

    // Specific melee / evade fallback: ONLY after specific token search produced no hit
    if (!assetRef && (category === 'Normal' || category === 'Dodge' || actionLower.includes('melee') || actionLower.includes('attack') || actionLower.includes('evade') || actionLower.includes('sneak'))) {
      for (const k of candidateKeys) {
        const kPascal = toPascalCase(k);
        const pugongCands = [
          `/Game/Resources/Icon/skill/WeaponSkill/skill_${k}_melee.skill_${k}_melee`,
          `/Game/Resources/Icon/skill/WeaponSkill/skill_${k.toLowerCase()}_melee.skill_${k.toLowerCase()}_melee`,
          `/Game/Resources/Icon/skill/WeaponSkill/pugong-${k}.pugong-${k}`,
          `/Game/Resources/Icon/skill/WeaponSkill/pugong_${k}.pugong_${k}`,
          `/Game/Resources/Icon/skill/WeaponSkill/pugong-${kPascal}.pugong-${kPascal}`,
          `/Game/Resources/Icon/skill/WeaponSkill/pugong_${kPascal}.pugong_${kPascal}`,
          `/Game/Resources/Icon/skill/Melee/pugong-${k}.pugong-${k}`,
          `/Game/Resources/Icon/skill/Melee/pugong_${k}.pugong_${k}`,
          `/Game/Resources/Icon/skill/Melee/pugong-${kPascal}.pugong-${kPascal}`,
          `/Game/Resources/Icon/skill/Melee/pugong_${kPascal}.pugong_${kPascal}`
        ];
        for (const c of pugongCands) {
          const checkKey = c.split('.')[0].toLowerCase();
          if (imageCopier.exactPathIndex.has(checkKey) || imageCopier.exactPathIndex.has(c.toLowerCase())) {
            assetRef = c;
            source = 'combat_action_canonical_ref';
            break;
          }
        }
        if (assetRef) break;
      }
    }
  }

  // Passive WeaponSkill icon resolution: Buff_<Char>_<Elem> family
  if (!assetRef && (category === 'Passive' || actionBase.toLowerCase().startsWith('buff_')) && imageCopier?.exactPathIndex) {
    const candidateKeys = [];
    for (const k of charKeys) {
      if (k && !candidateKeys.includes(k) && !['fplayer', 'mplayer'].includes(k.toLowerCase())) {
        candidateKeys.push(k);
      }
    }

    const elemList = ['Phy', 'Fir', 'Ice', 'Thu', 'Fire', 'Frost', 'Volt', 'Thunder', 'Physics'];
    for (const k of candidateKeys) {
      const kPascal = toPascalCase(k);
      for (const elemTok of elemList) {
        const cands = [
          `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/Buff_${kPascal}_${elemTok}.${kPascal}_${elemTok}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/Buff_${kPascal}_${elemTok}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${k}/Buff_${k}_${elemTok}.${k}_${elemTok}`,
          `/Game/Resources/Icon/skill/WeaponSkill/${k}/Buff_${k}_${elemTok}`
        ];
        for (const c of cands) {
          const checkKey = c.split('.')[0].toLowerCase();
          if (imageCopier.exactPathIndex.has(checkKey) || imageCopier.exactPathIndex.has(c.toLowerCase())) {
            assetRef = c;
            source = 'passive_weaponskill_buff_ref';
            break;
          }
        }
        if (assetRef) break;
      }
      if (assetRef) break;

      const bedmgCands = [
        `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/${kPascal}_BeDmgDown.${kPascal}_BeDmgDown`,
        `/Game/Resources/Icon/skill/WeaponSkill/${kPascal}/${kPascal}_BeDmgDown`,
        `/Game/Resources/Icon/skill/WeaponSkill/${k}/${k}_BeDmgDown.${k}_BeDmgDown`,
        `/Game/Resources/Icon/skill/WeaponSkill/${k}/${k}_BeDmgDown`
      ];
      for (const c of bedmgCands) {
        const checkKey = c.split('.')[0].toLowerCase();
        if (imageCopier.exactPathIndex.has(checkKey) || imageCopier.exactPathIndex.has(c.toLowerCase())) {
          assetRef = c;
          source = 'passive_weaponskill_bedmg_ref';
          break;
        }
      }
      if (assetRef) break;
    }

    if (!assetRef) {
      const directBuffCands = [
        `/Game/Resources/Icon/skill/WeaponSkill/${actionBase}.${actionBase}`,
        `/Game/Resources/Icon/skill/WeaponSkill/${actionBase}`,
        `/Game/Resources/Icon/buff/${actionBase}.${actionBase}`,
        `/Game/Resources/Icon/buff/${actionBase}`
      ];
      for (const c of directBuffCands) {
        const checkKey = c.split('.')[0].toLowerCase();
        if (imageCopier.exactPathIndex.has(checkKey) || imageCopier.exactPathIndex.has(c.toLowerCase())) {
          assetRef = c;
          source = 'passive_direct_buff_ref';
          break;
        }
      }
    }
  }


  if (assetRef && imageCopier) {
    const copied = imageCopier.copyAsset('simulacra', assetRef, 'skills', { structured: true, thumbnail: { maxDimension: 96, quality: 82 } });
    if (copied) {
      return {
        resolved: true,
        assetRef,
        sourcePng: copied.sourcePng,
        full: copied.full,
        thumb: copied.thumb,
        strategy: source
      };
    }
  }

  return {
    resolved: false,
    placeholder: true,
    placeholderType: category || 'Other',
    strategy: 'unresolved_typed_placeholder',
    diagnostic: `No exact icon asset ref found in export for action ${actionBase}`
  };
}

function mergeArchiveTable(archiveReader, baseCandidates, overseasCandidates, tableName) {
  const baseRes = archiveReader.findAndRead(baseCandidates);
  const osRes = archiveReader.findAndRead(overseasCandidates);

  const rawBase = baseRes?.data;
  const rawOs = osRes?.data;

  const baseRows = Array.isArray(rawBase) && rawBase[0]?.Rows ? rawBase[0].Rows : (rawBase?.Rows || rawBase || {});
  const osRows = Array.isArray(rawOs) && rawOs[0]?.Rows ? rawOs[0].Rows : (rawOs?.Rows || rawOs || {});

  let replacedCount = 0;
  let keptBaseCount = 0;
  let osOnlyCount = 0;

  const merged = { ...baseRows };
  const osKeySet = new Set<any>(Object.keys(osRows));

  for (const [key, val] of Object.entries(osRows)) {
    if (merged.hasOwnProperty(key)) {
      replacedCount++;
    } else {
      osOnlyCount++;
    }
    merged[key] = val;
  }
  for (const key of Object.keys(baseRows)) {
    if (!osKeySet.has(key)) {
      keptBaseCount++;
    }
  }

  const stat = {
    tableName: tableName || 'table',
    baseCount: Object.keys(baseRows).length,
    overseasCount: Object.keys(osRows).length,
    replacedCount,
    keptBaseCount,
    osOnlyCount,
    totalMerged: Object.keys(merged).length,
    baseSource: baseRes?.matchedPath ? path.basename(baseRes.matchedPath) : null,
    overseasSource: osRes?.matchedPath ? path.basename(osRes.matchedPath) : null
  };

  console.log(`[build-simulacra] Merged ${stat.tableName}: ${stat.totalMerged} rows (${stat.replacedCount} replaced by OS, ${stat.keptBaseCount} kept base, ${stat.osOnlyCount} OS-only)`);

  return {
    rows: merged,
    stat
  };
}

const ABILITY_HEXAGON_METRICS = {
  'EWeaponHexagonAbilityType::EWHAT_One': { key: 'attack', label_en: 'Attack', label_ru: 'Атака', index: 1 },
  'EWeaponHexagonAbilityType::EWHAT_Two': { key: 'control', label_en: 'Control', label_ru: 'Контроль', index: 2 },
  'EWeaponHexagonAbilityType::EWHAT_Three': { key: 'damage', label_en: 'Damage', label_ru: 'Урон', index: 3 },
  'EWeaponHexagonAbilityType::EWHAT_Four': { key: 'defense', label_en: 'Defense', label_ru: 'Защита', index: 4 },
  'EWeaponHexagonAbilityType::EWHAT_Five': { key: 'support', label_en: 'Support', label_ru: 'Поддержка', index: 5 },
  'EWeaponHexagonAbilityType::EWHAT_Six': { key: 'range', label_en: 'Range', label_ru: 'Дальность', index: 6 },
};

function parseEfficiencyRadar(weaponRow) {
  if (!weaponRow || typeof weaponRow !== 'object') {
    return { max_value: 16, points: [], metrics: {}, raw: [] };
  }
  const maxVal = typeof weaponRow.WeaponAbilityMaxValue === 'number' && weaponRow.WeaponAbilityMaxValue > 0 ? weaponRow.WeaponAbilityMaxValue : 16;
  const rawList = Array.isArray(weaponRow.WeaponAbilityMap) ? weaponRow.WeaponAbilityMap : [];
  const points = [];
  const metrics = { attack: 0, control: 0, damage: 0, defense: 0, support: 0, range: 0 };
  const entriesByKey = new Map<any, any>();
  for (const item of rawList) {
    if (item && item.Key) {
      entriesByKey.set(item.Key, typeof item.Value === 'number' ? item.Value : (parseFloat(item.Value) || 0));
    }
  }
  const standardKeys = [
    'EWeaponHexagonAbilityType::EWHAT_One',
    'EWeaponHexagonAbilityType::EWHAT_Two',
    'EWeaponHexagonAbilityType::EWHAT_Three',
    'EWeaponHexagonAbilityType::EWHAT_Four',
    'EWeaponHexagonAbilityType::EWHAT_Five',
    'EWeaponHexagonAbilityType::EWHAT_Six'
  ];
  for (const sk of standardKeys) {
    const meta = ABILITY_HEXAGON_METRICS[sk];
    const val = entriesByKey.has(sk) ? entriesByKey.get(sk) : 0;
    metrics[meta.key] = val;
    points.push({
      key: meta.key,
      label_en: meta.label_en,
      label_ru: meta.label_ru,
      index: meta.index,
      raw_key: sk,
      value: val,
      max_value: maxVal,
      ratio: Math.round(Math.min(1, Math.max(0, val / maxVal)) * 1000) / 1000
    });
  }
  return { max_value: maxVal, points, metrics, raw: rawList };
}

function resolveMMOAdvancement({ locResolver, starPackId, wKey, fam, star, starLowerMap, efRows, efFileMap }) {
  const wKeyClean = (wKey || '').replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
  const wKeyBase = wKeyClean.split('_')[0];
  const famClean = (fam || '').replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
  const starPackClean = (starPackId || '').toLowerCase();

  const candidates = [
    starPackClean ? starPackClean + '_' + star : null,
    wKeyClean + '_ssr_star_' + star,
    wKeyClean + '_sr_star_' + star,
    wKeyClean + '_star_' + star,
    wKeyBase + '_ssr_star_' + star,
    wKeyBase + '_sr_star_' + star,
    wKeyBase + '_star_' + star,
    famClean + '_ssr_star_' + star,
    famClean + '_sr_star_' + star,
    famClean + '_star_' + star
  ].filter(Boolean);

  let starRow = null;
  for (const c of candidates) {
    if (starLowerMap.has(c)) {
      starRow = starLowerMap.get(c);
      break;
    }
  }

  if (!starRow) {
    const starSuffix1 = '_' + star;
    const starSuffix2 = '_star_' + star;
    for (const [k, v] of starLowerMap.entries()) {
      if (k.startsWith('breakfate_')) continue;
      if (k.includes(wKeyBase) && (k.endsWith(starSuffix1) || k.endsWith(starSuffix2))) {
        starRow = v;
        break;
      }
    }
  }

  const nameEn = `${star} Star Advancement`;
  const nameRu = `${star}★ Улучшение`;
  let descEn = '';
  let descRu = '';
  const multipliers: Record<string, any> = {};

  if (starRow && starRow.RemouldDetail) {
    const resEn = locResolver.resolve(starRow.RemouldDetail, { locale: 'en' });
    const resRu = locResolver.resolve(starRow.RemouldDetail, { locale: 'ru', fallbackLocale: 'en' });
    let textEn = cleanHtmlTags(resEn ? resEn.text : '');
    let textRu = cleanHtmlTags(resRu ? resRu.text : textEn);

    const params = starRow.RemouldDetailParams || [];
    if (params.length > 0) {
      function replacePlaceholders(txt) {
        if (!txt) return '';
        return txt.replace(/\{(\d+)\}(%?)/g, (match, p1, pct) => {
          const idx = parseInt(p1, 10);
          const p = params[idx];
          if (!p) return match;
          const mult = typeof p.Value === 'number' ? p.Value : 1;
          let curveVal = null;
          if (p.Curve && p.Curve.RowName && p.Curve.RowName !== 'None') {
            const rn = p.Curve.RowName;
            let targetEf = efRows;
            if (p.Curve.CurveTable) {
              let tbl = null;
              if (typeof p.Curve.CurveTable.ObjectName === 'string') {
                const m = p.Curve.CurveTable.ObjectName.match(/['"]?([^'"]+)['"]?$/);
                if (m) tbl = m[1].replace(/^CurveTable'/, '').replace(/'$/, '');
              }
              if (!tbl && typeof p.Curve.CurveTable.ObjectPath === 'string') {
                tbl = path.basename(p.Curve.CurveTable.ObjectPath).replace(/\.[^.]+$/, '');
              }
              if (tbl && efFileMap) {
                const tl = tbl.toLowerCase();
                targetEf = efFileMap.get(tl) || efFileMap.get(tl.replace(/_mmo$/i, '')) || efFileMap.get(tl.replace(/effectfigure.*$/i, '')) || efRows;
              }
            }
            let cRow = targetEf ? (targetEf[rn] || Object.entries(targetEf).find(([k]) => k.toLowerCase() === rn.toLowerCase())?.[1]) : null;
            if (!cRow && efFileMap) {
              for (const [_, tRows] of efFileMap.entries()) {
                if (tRows && (tRows[rn] || Object.entries(tRows).find(([k]) => k.toLowerCase() === rn.toLowerCase()))) {
                  cRow = tRows[rn] || Object.entries(tRows).find(([k]) => k.toLowerCase() === rn.toLowerCase())?.[1];
                  break;
                }
              }
            }
            curveVal = cRow && cRow.Keys && cRow.Keys[0] ? cRow.Keys[0].Value : (cRow && cRow.DefaultValue !== undefined && cRow.DefaultValue < 1e30 ? cRow.DefaultValue : null);
            if (typeof curveVal === 'number') {
              multipliers[rn] = curveVal;
              const finalVal = Math.round(curveVal * mult * 100) / 100;
              return finalVal.toString() + pct;
            }
          }
          if (typeof p.Value === 'number' && (!p.Curve || !p.Curve.RowName || p.Curve.RowName === 'None')) {
            return p.Value.toString() + pct;
          }
          return match;
        });
      }
      descEn = replacePlaceholders(textEn);
      descRu = replacePlaceholders(textRu);
    } else {
      descEn = textEn;
      descRu = textRu;
    }
  }

  if (!descEn || descEn.trim() === '' || descEn.toLowerCase() === 'none') {
    descEn = `Advancement ${star}★ upgrade effect.`;
    descRu = `Эффект улучшения ${star}★.`;
  }

  return { star, name_en: nameEn, name_ru: nameRu, desc_en: descEn, desc_ru: descRu, multipliers };
}

function cleanMMOSkillDescription(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text;
  s = s.replace(/([a-zA-Z\u0400-\u04FF])(\d+(?:\.\d+)?%|\{\d+\}%)/g, '$1 $2');
  s = s.replace(/(of\s+ATK|от\s+АТК|от\s+ATK|%)\s*\+\s*(?:0|—)\b/gi, '$1');
  s = s.replace(/(of\s+ATK|от\s+АТК|от\s+ATK|%)\s*\+\s*(\d+(?:\.\d+)?|\{\d+\})/gi, '$1 + $2');
  s = s.replace(/(ATK|АТК)\s*\+\s*(?:0|—)\b/gi, '$1');
  s = s.replace(/(ATK|АТК)\s*\+\s*(\d+(?:\.\d+)?|\{\d+\})/gi, '$1 + $2');
  s = s.replace(/\s*\+\s*0(?!\d|\.)\b/g, '');
  return s.trim();
}

function getCandidateMMONamespaces(famClean, wKeyClean, effectKeyLower, enNsLower) {
  const list = [];
  const addNs = (n) => {
    if (!n) return;
    const nl = n.toLowerCase();
    const entry = enNsLower.get(nl);
    if (entry && !list.includes(entry.ns)) list.push(entry.ns);
  };

  const stems = [famClean, wKeyClean, effectKeyLower].filter(Boolean);
  for (const s of stems) {
    addNs(s + 'Des_MMO');
    addNs(s + 'BalanceDes');
    addNs(s + 'Des_Balance');
    addNs(s + 'Balance');
    addNs(s + 'Des_MMO_Oversea');
  }
  addNs('SkillDes_MMO');
  addNs('Skill_MMO');
  addNs('SkillDes_Balance');
  addNs('Skill_Balance');
  addNs('SkillBalanceDes');

  for (const [lowerNs, entry] of enNsLower.entries()) {
    if (lowerNs.includes('balance') || lowerNs.includes('mmo')) {
      for (const s of stems) {
        if (s.length >= 3 && lowerNs.includes(s.toLowerCase())) {
          if (!list.includes(entry.ns)) list.push(entry.ns);
        }
      }
    }
  }

  for (const s of stems) {
    addNs(s + 'Des_Oversea');
    addNs(s + 'Des');
    addNs(s);
  }
  addNs('Skill_Overseas');
  addNs('Skill');
  addNs('SkillDes_Oversea');
  addNs('SkillDes');

  return list;
}

function matchMMOTips(actionBase, effectKeyLower, baseKeyLower, mmoSkillTips) {
  const actionBaseLower = (actionBase || '').toLowerCase();
  const matchedTips = [];
  
  for (const [tipKey, tipRow] of Object.entries(mmoSkillTips)) {
    const tipLower = tipKey.toLowerCase();
    if (tipLower.startsWith(actionBaseLower + '_') || tipLower === actionBaseLower) {
      const keys = tipRow.Keys || [];
      const levels: Record<string, any> = {};
      keys.forEach((kv, idx) => {
        levels[idx + 1] = kv.Value !== undefined ? kv.Value : kv;
      });
      matchedTips.push({ key: tipKey, levels, interpMode: tipRow.InterpMode || 'RCIM_Linear', defaultValue: tipRow.DefaultValue });
    }
  }

  if (matchedTips.length === 0) {
    for (const [tipKey, tipRow] of Object.entries(mmoSkillTips)) {
      const tipLower = tipKey.toLowerCase();
      if (tipLower.includes(effectKeyLower) || tipLower.includes(baseKeyLower)) {
        let matches = false;
        const actionNorm = actionBaseLower.replace(/^ga_fplayer|^ga_mplayer|^ga_|^buff_/i, '');
        const tipNorm = tipLower.replace(/^ga_fplayer|^ga_mplayer|^ga_|^buff_/i, '');

        if ((actionNorm.includes('melee_air') || actionNorm.includes('airmelee')) && tipNorm.includes('airattack')) matches = true;
        else if (actionNorm.includes('jumpattack') && tipNorm.includes('jumpattack')) matches = true;
        else if (actionNorm.includes('powerattack') && tipNorm.includes('powerattack')) matches = true;
        else if ((actionNorm.includes('evadeattack_front') || actionNorm.includes('evadeattack_forward') || actionNorm.includes('evade_forwardattack')) && tipNorm.includes('forwardattack')) matches = true;
        else if ((actionNorm.includes('evadeattack_back') || actionNorm.includes('evade_backattack')) && tipNorm.includes('backattack')) matches = true;
        else if (actionNorm.includes('realskill2') && (tipNorm.includes('skill2') || tipNorm.includes('skill_2'))) matches = true;
        else if (actionNorm.includes('changeskill') && tipNorm.includes('changeskill')) matches = true;
        else if (actionNorm.endsWith('_melee') && tipNorm.includes('melee_melee')) matches = true;

        if (matches) {
          const keys = tipRow.Keys || [];
          const levels: Record<string, any> = {};
          keys.forEach((kv, idx) => {
            levels[idx + 1] = kv.Value !== undefined ? kv.Value : kv;
          });
          matchedTips.push({ key: tipKey, levels, interpMode: tipRow.InterpMode || 'RCIM_Linear', defaultValue: tipRow.DefaultValue });
        }
      }
    }
  }

  matchedTips.sort((a, b) => {
    const numA = parseInt(a.key.match(/_(\d+)$/)?.[1] || '0', 10);
    const numB = parseInt(b.key.match(/_(\d+)$/)?.[1] || '0', 10);
    return numA - numB;
  });

  return matchedTips;
}

function extractMMOSimulacra({
  projectRoot,
  rawDir,
  archiveReader,
  locResolver,
  efFileMap,
  gachaProfilesMap,
  en = null,
  ru = null,
  enNsLower = null,
  globalLowerEn = null
}) {
  const swRes = archiveReader.findAndRead([
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/StaticWeaponDataTable_MMO.json',
    'DataTable_MMO/StaticWeaponDataTable_MMO.json',
    'StaticWeaponDataTable_MMO.json'
  ]);
  const swRows = Array.isArray(swRes?.data) && swRes.data[0]?.Rows ? swRes.data[0].Rows : (swRes?.data?.Rows || swRes?.data || {});

  const imRes = archiveReader.findAndRead([
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_Imitation_MMO.json',
    'DataTable_MMO/DT_Imitation_MMO.json',
    'DT_Imitation_MMO.json'
  ]);
  const imRows = Array.isArray(imRes?.data) && imRes.data[0]?.Rows ? imRes.data[0].Rows : (imRes?.data?.Rows || imRes?.data || {});

  const seasonRes = archiveReader.findAndRead([
    'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_MMOServerSeason.json',
    'DataTable_MMO/DT_MMOServerSeason.json',
    'DT_MMOServerSeason.json'
  ]);
  const seasonRows = Array.isArray(seasonRes?.data) && seasonRes.data[0]?.Rows ? seasonRes.data[0].Rows : (seasonRes?.data?.Rows || seasonRes?.data || {});

  const starRes = archiveReader.findAndRead([
    'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponUpgradeStarData_MMO.json',
    'WeaponUpgradeStarData_MMO.json'
  ]);
  const starRows = Array.isArray(starRes?.data) && starRes.data[0]?.Rows ? starRes.data[0].Rows : (starRes?.data?.Rows || starRes?.data || {});
  const starLowerMap = new Map<any, any>();
  for (const [k, v] of Object.entries(starRows)) {
    starLowerMap.set(k.toLowerCase(), v);
  }

  // Load SkillUpdateTips_balance if present
  const skillBalRes = archiveReader.findAndRead([
    'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/Skill/SkillUpdateTips_balance.json',
    'DataTable_Balance/Skill/SkillUpdateTips_balance.json',
    'SkillUpdateTips_balance.json',
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips.json',
    'SkillUpdateTips.json'
  ]);
  const skillBalRows = Array.isArray(skillBalRes?.data) && skillBalRes.data[0]?.Rows ? skillBalRes.data[0].Rows : (skillBalRes?.data?.Rows || skillBalRes?.data || {});

  const normSkillRes = archiveReader.findAndRead([
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips.json',
    'DataTable/Skill/SkillUpdateTips.json',
    'SkillUpdateTips.json'
  ]);
  const normSkillRows = Array.isArray(normSkillRes?.data) && normSkillRes.data[0]?.Rows ? normSkillRes.data[0].Rows : (normSkillRes?.data?.Rows || normSkillRes?.data || {});

  const mmoSkillTips = { ...normSkillRows, ...skillBalRows };

  // Ensure localization dictionaries and lookup maps
  const enDict = en || locResolver?.locales?.get('en') || {};
  const ruDict = ru || locResolver?.locales?.get('ru') || {};

  const mmoEnNsLower = enNsLower || new Map<any, any>();
  if (mmoEnNsLower.size === 0) {
    for (const [ns, table] of Object.entries(enDict)) {
      if (!table || typeof table !== 'object') continue;
      const tableLower = new Map<any, any>();
      for (const [k, v] of Object.entries(table)) {
        tableLower.set(k.toLowerCase(), { originalKey: k, value: v });
      }
      mmoEnNsLower.set(ns.toLowerCase(), { ns, table, tableLower });
    }
  }

  const mmoGlobalLowerEn = globalLowerEn || new Map<any, any>();
  if (mmoGlobalLowerEn.size === 0) {
    for (const [ns, table] of Object.entries(enDict)) {
      if (!table || typeof table !== 'object') continue;
      for (const [k, v] of Object.entries(table)) {
        const kl = k.toLowerCase();
        if (!mmoGlobalLowerEn.has(kl)) {
          mmoGlobalLowerEn.set(kl, { ns, key: k, textEn: v });
        }
      }
    }
  }

  // Ensure balance and MMO curves in DataTable_MMO/EffectFigure and DataTable_Balance/EffectFigure are indexed
  const efDirs = [
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/EffectFigure'),
    path.join(rawDir, 'DataTable_MMO/EffectFigure'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure'),
    path.join(rawDir, 'DataTable_Balance/EffectFigure'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable/EffectFigure'),
    path.join(rawDir, 'DataTable/EffectFigure'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable/EffectFigure_Normal'),
    path.join(rawDir, 'DataTable/EffectFigure_Normal'),
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable/EffectFigure_MMO'),
    path.join(rawDir, 'DataTable/EffectFigure_MMO'),
    path.join(rawDir, 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/EffectFigure_Oversea'),
    path.join(rawDir, 'DataTable/EffectFigure_Oversea')
  ];
  for (const bDir of efDirs) {
    if (fs.existsSync(bDir)) {
      try {
        for (const f of fs.readdirSync(bDir)) {
          if (f.endsWith('.json')) {
            try {
              const rawD = JSON.parse(readGameSourceFileSync(path.join(bDir, f), 'utf8'));
              const bRows = Array.isArray(rawD) && rawD[0]?.Rows ? rawD[0].Rows : (rawD?.Rows || rawD || {});
              const baseName = f.replace(/\.json$/i, '').toLowerCase();
              efFileMap.set(baseName, bRows);
              efFileMap.set(baseName.replace(/_mmo$/i, ''), bRows);
              efFileMap.set(baseName.replace(/_oversea$/i, ''), bRows);
              efFileMap.set(baseName.replace(/effectfigure.*$/i, ''), bRows);
              efFileMap.set(baseName.replace(/balanceeffectfigure.*$/i, ''), bRows);
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
  }

  const mmoEffectFigureMap = new Map<any, any>();
  const balanceEffectFigureMap = new Map<any, any>();

  const mmoEfDirCandidates = [
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/EffectFigure'),
    path.join(rawDir, 'DataTable_MMO/EffectFigure')
  ];
  for (const dir of mmoEfDirCandidates) {
    if (fs.existsSync(dir)) {
      try {
        for (const f of fs.readdirSync(dir)) {
          if (f.endsWith('.json')) {
            const base = f.replace(/\.json$/i, '');
            const canonicalPath = `Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/EffectFigure/${base}`;
            mmoEffectFigureMap.set(base.toLowerCase(), { fileName: base, path: canonicalPath });
          }
        }
      } catch (_) {}
    }
  }

  const balEfDirCandidates = [
    path.join(rawDir, 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure'),
    path.join(rawDir, 'DataTable_Balance/EffectFigure')
  ];
  for (const dir of balEfDirCandidates) {
    if (fs.existsSync(dir)) {
      try {
        for (const f of fs.readdirSync(dir)) {
          if (f.endsWith('.json')) {
            const base = f.replace(/\.json$/i, '');
            const canonicalPath = `Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/EffectFigure/${base}`;
            balanceEffectFigureMap.set(base.toLowerCase(), { fileName: base, path: canonicalPath });
          }
        }
      } catch (_) {}
    }
  }

  function resolveMMOCurveInfo(fam, slug) {
    const fl = (fam || '').toLowerCase();
    const sl = (slug || '').toLowerCase();

    // 1. Direct match in DataTable_MMO/EffectFigure
    for (const [key, entry] of mmoEffectFigureMap.entries()) {
      if (key.startsWith(fl) || key.includes(fl + 'effectfigure') || key.includes(fl + '_mmo')) {
        return entry;
      }
    }

    // 2. Direct match in DataTable_Balance/EffectFigure
    for (const [key, entry] of balanceEffectFigureMap.entries()) {
      if (key.startsWith(fl) || key.includes(fl + 'balance') || key.includes(fl + 'effectfigure')) {
        return entry;
      }
    }

    // 3. Slug matches in MMO / Balance
    for (const [key, entry] of mmoEffectFigureMap.entries()) {
      if (key.startsWith(sl) || key.includes(sl)) {
        return entry;
      }
    }
    for (const [key, entry] of balanceEffectFigureMap.entries()) {
      if (key.startsWith(sl) || key.includes(sl)) {
        return entry;
      }
    }

    // 4. Default authentic MMO curve naming
    return {
      fileName: `${fam}EffectFigure_MMO`,
      path: `Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/EffectFigure/${fam}EffectFigure_MMO`
    };
  }

  const imitByWeapon = new Map<any, any>();
  for (const [iKey, iRow] of Object.entries(imRows)) {
    if (!iRow || typeof iRow !== 'object') continue;
    if (iRow.WeaponId) imitByWeapon.set(iRow.WeaponId.toLowerCase(), { iKey, iRow });
    if (iRow.PreviewWeaponId) imitByWeapon.set(iRow.PreviewWeaponId.toLowerCase(), { iKey, iRow });
  }

  const eligibleMmo = [];
  const processedSlugs = new Set<any>();

  for (const [wKey, wRow] of Object.entries(swRows)) {
    if (!wRow || typeof wRow !== 'object') continue;
    const kl = wKey.toLowerCase();
    if (
      kl.includes('fashion') ||
      kl.includes('level') ||
      kl.match(/_?lv\d+$/i) ||
      kl.includes('test') ||
      kl.includes('show') ||
      kl.includes('breakfate') ||
      kl.includes('outbreak') ||
      kl.includes('imitation') ||
      kl.startsWith('weapon_exp') ||
      kl.startsWith('exp_') ||
      kl.startsWith('dwsk_') ||
      kl === 'weapon_handbp' ||
      kl.startsWith('god_')
    ) {
      continue;
    }
    if (!wRow.ItemRarity || (!wRow.ItemRarity.includes('SSR') && !wRow.ItemRarity.includes('SR'))) {
      continue;
    }

    const fId = wRow.WeaponFashionID;
    const im = (fId && imRows[fId]) ? { iKey: fId, iRow: imRows[fId] } : imitByWeapon.get(kl);
    if (!im) continue;

    const avatarId = im.iRow.AvatarId || wKey;
    const avatarKey = avatarId.toLowerCase();
    const slug = CANONICAL_SLUG_MAP[avatarKey] || CANONICAL_SLUG_MAP[kl] || avatarKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (processedSlugs.has(slug)) continue;
    processedSlugs.add(slug);

    eligibleMmo.push({ wKey, wRow, imitId: im.iKey, imitRow: im.iRow, avatarId, slug });
  }

  const mmoProfiles = [];
  for (const item of eligibleMmo) {
    const { wKey, wRow, imitId, imitRow, avatarId, slug } = item;
    const wNameEn = cleanHtmlTags(locResolver.resolve(wRow.ItemName, { locale: 'en' })?.text || wKey);
    const wNameRu = cleanHtmlTags(locResolver.resolve(wRow.ItemName, { locale: 'ru', fallbackLocale: 'en' })?.text || wNameEn);
    const cNameEn = cleanHtmlTags(locResolver.resolve(imitRow.Name, { locale: 'en' })?.text || avatarId);
    const cNameRu = cleanHtmlTags(locResolver.resolve(imitRow.Name, { locale: 'ru', fallbackLocale: 'en' })?.text || cNameEn);

    const seasonIdx = typeof wRow.MMOSeasonIndex === 'number' && wRow.MMOSeasonIndex > 0 ? wRow.MMOSeasonIndex : (parseInt(wRow.MMOSeasonIndex, 10) || 1);
    const seasonTag = `S${seasonIdx}`;
    const seasonTagRu = `S${seasonIdx}`;

    const efficiencyRadar = parseEfficiencyRadar(wRow);

    const fam = wKey.split('_')[0];
    const efRows = efFileMap.get(fam.toLowerCase()) || efFileMap.get(slug.toLowerCase()) || {};
    const mmoCurveInfo = resolveMMOCurveInfo(fam, slug);
    const curveTableName = mmoCurveInfo.fileName;
    const curveTablePath = mmoCurveInfo.path;
    const mmoAdvancements = [];
    for (let s = 1; s <= 15; s++) {
      mmoAdvancements.push(resolveMMOAdvancement({
        locResolver,
        starPackId: wRow.UpgradeStarPackID,
        wKey,
        fam,
        star: s,
        starLowerMap,
        efRows,
        efFileMap
      }));
    }

    const gachaProfile = gachaProfilesMap.get(slug.toLowerCase()) ||
                         gachaProfilesMap.get(avatarId.toLowerCase()) ||
                         gachaProfilesMap.get(wKey.toLowerCase());

    // Derive strictly single element from WeaponTypeData
    let rawElem = wRow.WeaponTypeData?.WeaponElementType || '';
    let element = 'Physical';
    if (rawElem.includes('Ice')) element = 'Frost';
    else if (rawElem.includes('Physics') || rawElem.includes('Physic')) element = 'Physical';
    else if (rawElem.includes('Thunder')) element = 'Volt';
    else if (rawElem.includes('Flame') || rawElem.includes('Fire')) element = 'Flame';
    else if (rawElem.includes('Superpower')) element = 'Altered';
    else if (gachaProfile?.element) element = gachaProfile.element;

    let rawRole = wRow.WeaponTypeData?.WeaponCategory || '';
    let role = 'DPS';
    if (rawRole.includes('SUP') || rawRole.includes('Support') || rawRole.includes('Heal')) role = 'Benediction';
    else if (rawRole.includes('Tank') || rawRole.includes('Defense') || rawRole.includes('Fortitude')) role = 'Tank';
    else if (gachaProfile?.role) role = gachaProfile.role;
    const roleIcon = resolveRoleIcon(role);

    // Filter out gacha-only titan passives, dual-element on-field passives, and remove discharge shield
    const filteredSkills = (gachaProfile?.weapon?.skills || []).filter(sk => {
      if (!sk) return false;
      // Omit titan passives
      if (sk.isTitan || (sk.id && /^titan_/i.test(sk.id)) || (sk.name_en && sk.name_en.toLowerCase().includes('titan compendium'))) {
        return false;
      }
      // Omit dual-element on-field passives
      if (sk.isOnField || (sk.id && /^onfield_/i.test(sk.id)) || sk.provenance?.source === 'DualElementOnField') {
        return false;
      }
      // Omit dual-element fusion passives
      if (sk.id && sk.id.startsWith('fusion_')) {
        return false;
      }
      // Omit all elemental reactions for MMO characters (MMO characters do not have reactions)
      if (
        sk.isReaction ||
        sk.category === 'Reaction' ||
        (sk.id && /^reaction_/i.test(sk.id)) ||
        /^(?:armor dissolve|force impact|ice shell|flame|grievous|volt|altered|superpower|растворение брони|силовое воздействие|ледяная оболочка|огонь|тяжелое ранение|электричество|аберрация|искажение)$/i.test((sk.name_en || sk.name_ru || '').trim())
      ) {
        return false;
      }
      // Omit all elemental resonances and resonance passives for MMO characters (MMO characters do not have resonances)
      if (
        (sk.id && /resonance/i.test(sk.id) && !/^GA_/i.test(sk.id)) ||
        ((sk.category === 'Passive' || sk.type === 'Passive' || !sk.category || sk.isPassive || /^(?:buff_|passive_)/i.test(sk.id || '')) &&
         (/resonance/i.test(sk.name_en || '') || /резонанс/i.test(sk.name_ru || '')))
      ) {
        return false;
      }
      return true;
    });

    const candidateNsList = getCandidateMMONamespaces(fam, wKey, slug, mmoEnNsLower);
    const lookupMMOActiveText = (key) => {
      if (!key) return null;
      const keyLower = key.toLowerCase();
      for (const nsName of candidateNsList) {
        const entry = mmoEnNsLower.get(nsName.toLowerCase());
        if (!entry) continue;
        if (enDict[entry.ns] && enDict[entry.ns][key]) {
          return { textEn: enDict[entry.ns][key], textRu: ruDict?.[entry.ns]?.[key] || enDict[entry.ns][key], ns: entry.ns, key };
        }
        const hit = entry.tableLower.get(keyLower);
        if (hit) {
          const origK = hit.originalKey;
          return {
            textEn: hit.value,
            textRu: ruDict?.[entry.ns]?.[origK] || hit.value,
            ns: entry.ns,
            key: origK
          };
        }
      }
      const globalHit = mmoGlobalLowerEn.get(keyLower);
      if (globalHit) {
        return {
          textEn: globalHit.textEn,
          textRu: ruDict?.[globalHit.ns]?.[globalHit.key] || globalHit.textEn,
          ns: globalHit.ns,
          key: globalHit.key
        };
      }
      return null;
    };

    const skills = filteredSkills.map(sk => {
      const cleanSk = { ...sk };
      delete cleanSk.has_discharge_shield;
      delete cleanSk.has_mmo_discharge_shield;
      delete cleanSk.discharge_shield_pct;
      delete cleanSk.discharge_shield_stat;
      if (cleanSk.mmo_mechanics) {
        delete cleanSk.mmo_mechanics.discharge_shield;
        delete cleanSk.mmo_mechanics.shield_percent;
        delete cleanSk.mmo_mechanics.shield_stat;
        delete cleanSk.mmo_mechanics.shield_description_en;
        delete cleanSk.mmo_mechanics.shield_description_ru;
      }

      const actionBase = sk.id || '';
      const baseNorm = actionBase
        .replace(/powear/i, 'Power')
        .replace(/forwardevadeattack/i, 'ForwardAttack')
        .replace(/_new_/gi, '_')
        .replace(/_succ?ess/gi, '')
        .replace(/Normal$/i, '');

      const nameKeys = [
        actionBase + '_Name',
        actionBase + '_name',
        'Name_' + actionBase,
        baseNorm + '_name',
        actionBase.replace(/Power/i, 'Powear') + '_name',
        actionBase.replace(/ForwardAttack/i, 'ForwardEvadeAttack') + '_name',
        actionBase.replace(/_succ?ess/gi, '') + '_name'
      ];

      const desKeys = [
        actionBase + '_Des',
        actionBase + '_des',
        actionBase + '_Des_Balance',
        actionBase + '_des_Balance',
        actionBase + '_Des_MMO',
        actionBase + '_des_MMO',
        'Des_' + actionBase,
        actionBase + '_des_OS',
        actionBase + '_OS',
        baseNorm + '_Des',
        baseNorm + '_des',
        'Des_' + baseNorm
      ];

      let foundName = null;
      for (const nk of nameKeys) {
        foundName = lookupMMOActiveText(nk);
        if (foundName) break;
      }

      let foundDesc = null;
      for (const dk of desKeys) {
        foundDesc = lookupMMOActiveText(dk);
        if (foundDesc) break;
      }

      let sNameEn = cleanHtmlTags(foundName?.textEn || sk.name_en || actionBase);
      let sNameRu = cleanHtmlTags(foundName?.textRu || sk.name_ru || sNameEn);
      let sDescEn = cleanHtmlTags(foundDesc?.textEn || sk.desc_en || '');
      let sDescRu = cleanHtmlTags(foundDesc?.textRu || sk.desc_ru || sDescEn);

      const matchedTips = matchMMOTips(actionBase, fam.toLowerCase(), slug.toLowerCase(), mmoSkillTips);
      const tipsToUse = matchedTips.length > 0 ? matchedTips : (sk.parameters || []);

      const descDisplayEn = formatSkillDescription(sDescEn, { id: actionBase, name_en: sNameEn, parameters: tipsToUse }, efRows);
      const descDisplayRu = formatSkillDescription(sDescRu, { id: actionBase, name_en: sNameRu || sNameEn, parameters: tipsToUse }, efRows);

      cleanSk.name_en = sNameEn;
      cleanSk.name_ru = sNameRu;
      cleanSk.desc_en = cleanHtmlTags(sDescEn);
      cleanSk.desc_ru = cleanHtmlTags(sDescRu);
      cleanSk.desc_display_en = cleanHtmlTags(cleanMMOSkillDescription(descDisplayEn));
      cleanSk.desc_display_ru = cleanHtmlTags(cleanMMOSkillDescription(descDisplayRu));
      cleanSk.parameters = tipsToUse;

      if (tipsToUse.length > 0 && typeof tipsToUse[0]?.levels?.[1] === 'number') {
        cleanSk.pct = Math.round(tipsToUse[0].levels[1] * 100) / 100;
      }

      // Assign authentic MMO provenance and strip legacy Gacha / Overseas metadata
      delete cleanSk.overseasWon;
      if (Array.isArray(cleanSk.parameters)) {
        for (const p of cleanSk.parameters) {
          delete p.overseasWon;
          delete p.isOverseas;
        }
      }

      cleanSk.provenance = {
        source: 'DataTable_MMO/StaticWeaponDataTable_MMO',
        namespace: foundName?.ns || foundDesc?.ns || `${fam}Des`,
        nameKey: foundName?.key || (cleanSk.provenance?.nameKey) || (actionBase ? `${actionBase}_Name` : undefined),
        descKey: foundDesc?.key || (cleanSk.provenance?.descKey) || (actionBase ? `${actionBase}_Des` : undefined),
        curveTable: curveTableName
      };

      return cleanSk;
    }).filter(sk => sk && ((sk.desc_display_en && sk.desc_display_en.trim()) || (sk.desc_en && sk.desc_en.trim())));

    // Attach matching single-element MMO balance reaction based on primary element
    if (element && MMO_REACTION_PASSIVES_DATA[element]) {
      const mb = MMO_REACTION_PASSIVES_DATA[element];
      const mmoReactionIcon = resolveSingleElementIcon(element) || null;
      const mmoReactionPassive = {
        id: `reaction_${element.toLowerCase()}`,
        name_en: mb.name_en,
        name_ru: mb.name_ru,
        desc_en: mb.desc_en,
        desc_ru: mb.desc_ru,
        desc_display_en: mb.desc_en,
        desc_display_ru: mb.desc_ru,
        category: 'Passive',
        type: 'Passive',
        combo: null,
        type_tags: [],
        pct: null,
        icon: mmoReactionIcon,
        icon_thumb: mmoReactionIcon,
        parameters: [],
        isReaction: true,
        isBalanceReaction: true,
        provenance: {
          source: 'QRSLCommon_ST_Balance',
          namespace: 'QRSLCommon_ST_Balance',
          key: element,
          nameKey: `reaction_${element.toLowerCase()}`,
          descKey: `reaction_${element.toLowerCase()}`
        }
      };
      skills.unshift(mmoReactionPassive);
    }

    const mmoProfile = {
      id: `${slug}-mmo`,
      slug,
      canonical_id: slug,
      avatar_id: avatarId,
      imitation_id: imitId,
      weapon_id: wKey,
      name_en: cNameEn,
      name_ru: cNameRu,
      weapon_name_en: wNameEn,
      weapon_name_ru: wNameRu,
      element,
      element_secondary: null,
      element_combo_icon: null,
      role,
      role_icon: roleIcon,
      resonance: role,
      rarity: (wRow.ItemRarity && wRow.ItemRarity.includes('SSR')) ? 'SSR' : 'SR',
      server_mode: 'mmo',
      edition: 'mmo',
      season: seasonIdx,
      season_tag: seasonTag,
      season_badge: seasonTag,
      season_name_en: seasonTag,
      season_name_ru: seasonTagRu,
      has_matrices: false,
      no_matrices: true,
      matrices_available: false,
      matrix_suit_id: null,
      matrix_suit_num: null,
      matrix: {
        available: false,
        has_matrices: false,
        suit_id: null,
        notice_en: 'No matrix suits are available for weapons in MMO mode.',
        notice_ru: 'Комплекты матриц недоступны для оружия в режиме MMO.'
      },
      mmo_mechanics: {
        no_matrices: true,
        season: seasonTag
      },
      efficiency_radar: efficiencyRadar,
      radar_abilities: efficiencyRadar,
      avatar: gachaProfile?.avatar || null,
      avatar_thumb: gachaProfile?.avatar_thumb || null,
      portrait: gachaProfile?.portrait || null,
      portrait_thumb: gachaProfile?.portrait_thumb || null,
      detail_art: gachaProfile?.detail_art || null,
      detail_art_thumb: gachaProfile?.detail_art_thumb || null,
      card: gachaProfile?.card || null,
      icon: gachaProfile?.icon || null,
      round_icon: gachaProfile?.round_icon || null,
      assets: (() => {
        const baseSlug = (slug || '').toLowerCase();
        const manifestCandidates = [
          path.join(projectRoot, 'info', 'simulacra', 'data', `${baseSlug}-assets.json`),
        ];
        for (const cand of manifestCandidates) {
          if (fs.existsSync(cand)) {
            try {
              return JSON.parse(readGameSourceFileSync(cand, 'utf8'));
            } catch (_) {}
          }
        }
        return gachaProfile?.assets || [];
      })(),
      base_stats: {
        attack: 0,
        hp: 0,
        crit: 0,
        def: 0,
        shatter: 0,
        charge: 0,
        shatter_grade: 'A',
        charge_grade: 'A'
      },
      advancements: mmoAdvancements,
      weapon: {
        id: wKey,
        name_en: wNameEn,
        name_ru: wNameRu,
        element,
        element_secondary: null,
        role,
        role_icon: roleIcon,
        resonance: role,
        has_matrices: false,
        no_matrices: true,
        efficiency_radar: efficiencyRadar,
        radar_abilities: efficiencyRadar,
        mmo_mechanics: {
          no_matrices: true
        },
        skills,
        skillsByCategory: {
          normal: skills.filter(s => s.category === 'Normal'),
          dodge: skills.filter(s => s.category === 'Dodge'),
          skill: skills.filter(s => s.category === 'Skill'),
          discharge: skills.filter(s => s.category === 'Discharge'),
          passive: skills.filter(s => s.category === 'Passive'),
          other: skills.filter(s => s.category === 'Other')
        }
      },
      coefficients: gachaProfile?.coefficients || null,
      traits: [],
      affinity_ladder: [],
      sources: {
        identifiers: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_Imitation_MMO',
            label_en: 'MMO Imitation & Avatar identities (DT_Imitation_MMO)',
            label_ru: 'Связь симулякра и аватара в режиме MMO (DT_Imitation_MMO)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/StaticWeaponDataTable_MMO',
            label_en: 'MMO Base Weapon Table & Season Mapping (StaticWeaponDataTable_MMO)',
            label_ru: 'Таблица оружия и сезонов MMO (StaticWeaponDataTable_MMO)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_MMOServerSeason',
            label_en: 'MMO Server Season Definitions (DT_MMOServerSeason)',
            label_ru: 'Конфигурация сезонов серверов MMO (DT_MMOServerSeason)'
          }
        ],
        base_stats: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/StaticWeaponDataTable_MMO',
            label_en: 'MMO Base Weapon Stats: Attack, HP, Crit, Shatter, Charge',
            label_ru: 'Базовые параметры оружия MMO: атака, ОЗ, крит, раскол, заряд'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_MMOServerSeason',
            label_en: 'MMO Server Season Stat Boundaries (DT_MMOServerSeason)',
            label_ru: 'Сезонные ограничения характеристик MMO (DT_MMOServerSeason)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponUpgradeStarData_MMO',
            label_en: 'MMO Weapon Upgrade & Level Scaling (WeaponUpgradeStarData_MMO)',
            label_ru: 'Параметры улучшения и масштабирования оружия MMO (WeaponUpgradeStarData_MMO)'
          }
        ],
        advancements: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponUpgradeStarData_MMO',
            label_en: 'MMO 1★–15★ Advancements (RemouldDetail & Params)',
            label_ru: 'Улучшения 1★–15★ MMO (RemouldDetail и параметры)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/StaticWeaponDataTable_MMO',
            label_en: 'MMO Upgrade Star Pack Mapping (UpgradeStarPackID)',
            label_ru: 'Конфигурация звездных пакетов оружия MMO (UpgradeStarPackID)'
          }
        ],
        curves: [
          {
            path: curveTablePath,
            label_en: `MMO Skill Multiplier Curves (${curveTableName})`,
            label_ru: `Кривые множителей навыков MMO (${curveTableName})`
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/Skill/SkillUpdateTips_balance',
            label_en: 'MMO Balance Skill Multiplier Progression (SkillUpdateTips_balance)',
            label_ru: 'Балансная прогрессия множителей навыков MMO (SkillUpdateTips_balance)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips',
            label_en: 'Base Skill Progression Steps & Curves (SkillUpdateTips)',
            label_ru: 'Базовые шаги прогрессии и кривые навыков (SkillUpdateTips)'
          }
        ],
        skills: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/StaticWeaponDataTable_MMO',
            label_en: 'MMO Weapon Active Skills & GameplayActions (StaticWeaponDataTable_MMO)',
            label_ru: 'Активные навыки и действия оружия MMO (StaticWeaponDataTable_MMO)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/Skill/SkillUpdateTips_balance',
            label_en: 'MMO Skill Balance Values & Parameter Formulas (SkillUpdateTips_balance)',
            label_ru: 'Балансные значения и формулы параметров навыков MMO (SkillUpdateTips_balance)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips',
            label_en: 'Base Skill Update Values & Parameter Steps (SkillUpdateTips)',
            label_ru: 'Базовые значения параметров навыков (SkillUpdateTips)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable_Balance/StringTable/QRSLCommon_ST_Balance',
            label_en: 'MMO Elemental Balance Reactions (QRSLCommon_ST_Balance)',
            label_ru: 'Элементальные балансные реакции MMO (QRSLCommon_ST_Balance)'
          },
          {
            path: 'Hotta/Content/Localization/Game/en/Game',
            label_en: `English Localized Skill Names (${fam}Des, QRSLCommon_ST_Balance, WeaponDes)`,
            label_ru: `Английские названия навыков (${fam}Des, QRSLCommon_ST_Balance, WeaponDes)`
          },
          {
            path: 'Hotta/Content/Localization/Game/ru/Game',
            label_en: `Russian Localized Skill Names (${fam}Des, QRSLCommon_ST_Balance, WeaponDes)`,
            label_ru: `Русские названия навыков (${fam}Des, QRSLCommon_ST_Balance, WeaponDes)`
          }
        ]
      },
      provenance: {
        source: 'DataTable_MMO/StaticWeaponDataTable_MMO',
        weaponKey: wKey,
        imitationId: imitId,
        avatarId,
        skillCount: skills.length,
        hasMatrices: false
      }
    };

    const baseSlug = (mmoProfile.canonical_id || mmoProfile.slug || mmoProfile.id.replace(/-mmo$/, '')).toLowerCase();
    if (!mmoProfile.assets || !Array.isArray(mmoProfile.assets) || mmoProfile.assets.length === 0) {
      const manifestCandidates = [
        path.join(projectRoot, 'info', 'simulacra', 'data', `${baseSlug}-assets.json`),
      ];
      for (const cand of manifestCandidates) {
        if (fs.existsSync(cand)) {
          try {
            mmoProfile.assets = JSON.parse(readGameSourceFileSync(cand, 'utf8'));
            break;
          } catch (_) {}
        }
      }
      if ((!mmoProfile.assets || mmoProfile.assets.length === 0) && gachaProfile?.assets && Array.isArray(gachaProfile.assets)) {
        mmoProfile.assets = gachaProfile.assets;
      }
    }
    if (!mmoProfile.assets) {
      mmoProfile.assets = [];
    }

    mmoProfiles.push(mmoProfile);
  }

  return mmoProfiles;
}

function preparePassives(charData, options: Record<string, any> = {}) {
  if (!charData) return [];
  const isMmo = Boolean(
    options.isMmo ||
    charData.server_mode === 'mmo' ||
    charData.edition === 'mmo' ||
    String(charData.id || '').toLowerCase().endsWith('-mmo') ||
    String(charData.slug || '').toLowerCase().endsWith('-mmo') ||
    String(charData.canonical_id || '').toLowerCase().endsWith('-mmo')
  );

  const rawPassives = (
    charData.weapon?.skillsByCategory?.passive ||
    (charData.weapon?.skills || []).filter(s => (s.category || '').toLowerCase() === 'passive') ||
    (charData.weapon?.passives || []) ||
    []
  );

  let filtered = rawPassives.filter(p => {
    if (isMmo) {
      const id = String(p.id || '').toLowerCase();
      const nEn = String(p.name_en || '').toLowerCase().trim();
      const nRu = String(p.name_ru || '').toLowerCase().trim();
      // Strip dual-element reactions
      if (
        id.includes('physical_flame') || id.includes('flame_physical') ||
        id.includes('volt_frost') || id.includes('frost_volt') ||
        id.includes('armor_dissolve') || id.includes('force_impact') ||
        id.startsWith('fusion_') ||
        nEn === 'armor dissolve' || nRu === 'растворение брони' ||
        nEn === 'force impact' || nRu === 'силовое воздействие'
      ) return false;
      // Strip resonance passives
      if (/buff_.*_resonance/i.test(id) || (id.includes('resonance') && !/^ga_/i.test(id)) || nEn.includes('resonance') || nRu.includes('резонанс')) return false;
      // Strip old reaction passives
      if (p.isReaction || p.category === 'Reaction' || id.startsWith('reaction_')) return false;
    }
    return true;
  });

  const dedupedMap = new Map<any, any>();
  for (const p of filtered) {
    const key = (p.name_en || '').toLowerCase().trim();
    if (!dedupedMap.has(key)) dedupedMap.set(key, p);
  }
  let list = Array.from(dedupedMap.values());

  const element = charData.element || charData.weapon?.element;
  const elementSecondary = charData.element_secondary || charData.weapon?.element_secondary;

  if (isMmo) {
    let mmoKey = null;
    const eLower = (element || '').toLowerCase().trim();
    if (eLower === 'altered' || eLower === 'superpower') mmoKey = 'Altered';
    else if (eLower === 'frost' || eLower === 'ice') mmoKey = 'Frost';
    else if (eLower === 'volt' || eLower === 'thunder') mmoKey = 'Volt';
    else if (eLower === 'flame' || eLower === 'fire') mmoKey = 'Flame';
    else if (eLower === 'physical' || eLower === 'physics' || eLower === 'phys') mmoKey = 'Physical';
    else if (element && MMO_REACTION_PASSIVES_DATA[element]) mmoKey = element;

    if (mmoKey && MMO_REACTION_PASSIVES_DATA[mmoKey]) {
      const mb = MMO_REACTION_PASSIVES_DATA[mmoKey];
      const mmoReactionId = (mmoKey === 'Altered' || mmoKey === 'Superpower') ? 'reaction_altered' : `reaction_${mmoKey.toLowerCase()}`;
      const mmoIcon = resolveSingleElementIcon(mmoKey);
      list.unshift({
        id: mmoReactionId,
        name_en: mb.name_en,
        name_ru: mb.name_ru,
        desc_en: mb.desc_en,
        desc_ru: mb.desc_ru,
        desc_display_en: mb.desc_en,
        desc_display_ru: mb.desc_ru,
        category: 'Passive',
        type: 'Passive',
        isReaction: true,
        isBalanceReaction: true,
        icon: mmoIcon,
        icon_thumb: mmoIcon,
        provenance: { source: 'QRSLCommon_ST_Balance', key: mmoKey }
      });
    }
  } else {
    let reactionKey = null;
    if (element && elementSecondary && element !== elementSecondary) {
      if ((element === 'Physical' && elementSecondary === 'Flame') || (element === 'Flame' && elementSecondary === 'Physical')) {
        reactionKey = `${element}+${elementSecondary}`;
      } else if ((element === 'Volt' && elementSecondary === 'Frost') || (element === 'Frost' && elementSecondary === 'Volt')) {
        reactionKey = `${element}+${elementSecondary}`;
      }
    }
    if (!reactionKey && element && REACTION_PASSIVES_DATA[element]) {
      reactionKey = element;
    }
    if (reactionKey && REACTION_PASSIVES_DATA[reactionKey]) {
      const r = REACTION_PASSIVES_DATA[reactionKey];
      const comboIcon = resolveElementComboIcon(element, elementSecondary);
      const singleIcon = resolveSingleElementIcon(element);
      const reactionIcon = comboIcon || singleIcon || null;
      const reactionId = (reactionKey === 'Superpower' || reactionKey === 'Altered') ? 'reaction_altered' : `reaction_${reactionKey.toLowerCase().replace('+', '_')}`;
      list = list.filter(p => !p.isReaction && p.id !== reactionId && (p.name_en || '').toLowerCase() !== 'altered' && (p.name_en || '').toLowerCase() !== r.name_en.toLowerCase());
      list.unshift({
        id: reactionId,
        name_en: r.name_en,
        name_ru: r.name_ru,
        desc_en: r.desc_en,
        desc_ru: r.desc_ru,
        desc_display_en: r.desc_en,
        desc_display_ru: r.desc_ru,
        category: 'Passive',
        type: 'Passive',
        isReaction: true,
        icon: reactionIcon,
        icon_thumb: reactionIcon,
        provenance: { source: 'QRSLCommon_ST', key: reactionKey }
      });
    }
  }

  function getPassiveRank(p) {
    const n = (p.name_en || '').toLowerCase().trim();
    const nRu = (p.name_ru || '').toLowerCase().trim();
    if (p.isReaction || p.isBalanceReaction || ['grievous', 'ice shell', 'flame', 'volt', 'armor dissolve', 'force impact', 'altered', 'superpower', 'altered damage'].includes(n) || ['аберрация', 'искажение', 'измененный урон', 'ледяная оболочка', 'огонь', 'тяжелое ранение', 'электричество'].includes(nRu)) return 10;
    if (p.isFusion || n.startsWith('fusion of')) return 20;
    if (p.isOnField || n.includes(': on-field')) return 25;
    if (n.includes('resonance')) return 30;
    if (n.includes('fortitude') || n.includes('benediction') || n.includes('balance') || n.includes('attack resonance')) return 40;
    return 50;
  }
  list.sort((a, b) => getPassiveRank(a) - getPassiveRank(b));
  return list;
}


// Reaction and fusion passives are curated in English/Russian. In a culture pass the same game strings exist in that
// culture's Game.json (the English slot holds it), found through the Russian table, which is always canonical:
// names by exact Russian match, descriptions by Russian match with numbers masked, fusion text by its
// "<shuzhi>Fusion of A and B</>: ..." line. Nothing matched keeps the curated text.
const maskNumbers = (text: string) => String(text).replace(/<[^>]*>/g, '').replace(/\{\d+\}|\d+(?:[.,]\d+)?/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
const stripTags = (text: string) => String(text).replace(/<[^>]*>/g, '');
const numberTokens = (text: string) => stripTags(text).match(/\{\d+\}|\d+(?:[.,]\d+)?/g) ?? [];
// The index covers the whole Russian table (~300k strings); it is built once per table, not once per character.
const passiveIndexes = new WeakMap<object, { exact: Map<string, string[]>; masked: Map<string, string[]>; fusion: Map<string, string[]> }>();
function passiveIndex(ru: any) {
  const cached = passiveIndexes.get(ru);
  if (cached) return cached;
  const exact = new Map<string, string[]>();
  const masked = new Map<string, string[]>();
  const fusion = new Map<string, string[]>();
  for (const [ns, table] of Object.entries<any>(ru)) {
    if (!table || typeof table !== 'object') continue;
    for (const [key, value] of Object.entries<any>(table)) {
      if (typeof value !== 'string') continue;
      const ref = `${ns}\u0000${key}`;
      const plain = stripTags(value).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!exact.has(plain)) exact.set(plain, []);
      exact.get(plain)!.push(ref);
      const mask = maskNumbers(value);
      if (!masked.has(mask)) masked.set(mask, []);
      masked.get(mask)!.push(ref);
      const lead = /^<shuzhi>([^<]+)<\/>/.exec(value.trim());
      if (lead && /(?:Слияние|Fusion)/i.test(lead[1])) {
        const name = lead[1].trim().toLowerCase();
        if (!fusion.has(name)) fusion.set(name, []);
        fusion.get(name)!.push(ref);
      }
    }
  }
  const index = { exact, masked, fusion };
  passiveIndexes.set(ru, index);
  return index;
}

function localizeCuratedPassives(passives: any[], en: any, ru: any, culture: boolean) {
  if (!culture || !ru) return;
  if (!passives.some(p => p.isReaction || p.isFusion)) return;
  const { exact, masked, fusion } = passiveIndex(ru);
  const read = (ref: string) => { const [ns, key] = ref.split('\u0000'); const v = en?.[ns]?.[key]; return typeof v === 'string' ? v : null; };
  const prefer = (refs: string[] | undefined, pattern: RegExp) => (refs ?? []).find(ref => pattern.test(ref)) ?? refs?.[0];
  for (const p of passives) {
    if (!p.isReaction && !p.isFusion) continue;
    const ruName = String(p.name_ru || '').trim().toLowerCase();
    if (p.isFusion) {
      const ref = fusion.get(ruName)?.[0];
      const line = ref ? read(ref) : null;
      if (line) {
        const first = line.split(/\r?\n/).find(l => l.includes('<shuzhi>')) ?? line;
        p.name_en = stripTags(/^<shuzhi>([^<]+)<\/>/.exec(first.trim())?.[1] ?? p.name_en);
        const text = stripTags(first).replace(/^[^:：]*[:：]\s*/, '').trim();
        if (text) { p.desc_en = text; p.desc_display_en = text; }
      }
      continue;
    }
    const nameRef = prefer(exact.get(ruName), /QRSLCommon_ST\u0000ui_weapon_charge/);
    const nameValue = nameRef ? read(nameRef) : null;
    if (nameValue) p.name_en = stripTags(nameValue).trim();
    const descRef = prefer(masked.get(maskNumbers(p.desc_ru || '')), /QRSLCommon_ST\u0000ui_weapon_charge/);
    const descValue = descRef ? read(descRef) : null;
    const ruRef = descRef ? (() => { const [ns, key] = descRef.split('\u0000'); return typeof ru?.[ns]?.[key] === 'string' ? ru[ns][key] : null; })() : null;
    if (descValue && ruRef) {
      // Fill {n} placeholders from the curated numbers: both texts list their numbers in the same order.
      const gameNumbers = numberTokens(ruRef);
      const curated = numberTokens(p.desc_ru || '');
      const values = new Map<string, string>();
      if (gameNumbers.length === curated.length) gameNumbers.forEach((token, index) => { if (token.startsWith('{')) values.set(token, curated[index]); });
      const text = stripTags(descValue).replace(/\{\d+\}/g, token => values.get(token) ?? token).replace(/\s+/g, ' ').trim();
      if (text && !/\{\d+\}/.test(text)) { p.desc_en = text; p.desc_display_en = text; }
    }
  }
}

function buildSimulacraDataset() {
  const projectRoot = resolveProjectRoot();
  const rawDir = resolveRawDir(projectRoot);
  const outDir = path.join(projectRoot, 'info', 'simulacra', 'data');
  const targetDirs = [outDir];
  const imageCopier = new ImageCopier(rawDir, projectRoot);
  const archiveReader = new RawArchiveReader(projectRoot, rawDir);

  console.log(`[build-simulacra] Project root: ${projectRoot}`);
  console.log(`[build-simulacra] Raw data dir: ${rawDir}`);

  // Ensure wuqi icons (combined dual element, roles, single elements) are available in media store
  const wuqiAssets = [
    'icon_element_huowu', 'icon_element_wuhuo', 'icon_element_leibing', 'icon_element_binglei',
    'icon_qianggong', 'icon_zengyi', 'icon_fangyu',
    'icon_element_bing', 'icon_element_huo', 'icon_element_lei', 'icon_element_wu', 'icon_element_powers'
  ];
  const wuqiSrcDir = path.join(rawDir, 'Hotta/Content/Resources/UI/wuqi');
  const mediaWuqiDirs = [path.join(projectRoot, 'datamine/shared/media/Hotta/Content/Resources/UI/wuqi')];
  for (const name of wuqiAssets) {
    const srcFile = path.join(wuqiSrcDir, `${name}.webp`);
    if (fs.existsSync(srcFile)) {
      for (const mDir of mediaWuqiDirs) {
        if (fs.existsSync(path.dirname(mDir))) {
          fs.mkdirSync(mDir, { recursive: true });
          const dstFile = path.join(mDir, `${name}.webp`);
          if (!fs.existsSync(dstFile)) {
            try { fs.copyFileSync(srcFile, dstFile); } catch {}
          }
        }
      }
    }
  }

  // 1. Load Localizations
  const enRes = archiveReader.findAndRead(['Hotta/Content/Localization/Game/en/Game.json', 'en/Game.json']);
  const ruRes = archiveReader.findAndRead(['Hotta/Content/Localization/Game/ru/Game.json', 'ru/Game.json']);
  const en = enRes?.data || {};
  const ru = ruRes?.data || {};

  const locResolver = createLocalizationResolver();
  if (enRes?.data) locResolver.loadLocale('en', en);
  if (ruRes?.data) locResolver.loadLocale('ru', ru);

  // Precompute lowercase lookup maps for fast O(1) active text resolution
  const enNsLower = new Map<any, any>();
  for (const [ns, table] of Object.entries(en)) {
    if (!table || typeof table !== 'object') continue;
    const tableLower = new Map<any, any>();
    for (const [k, v] of Object.entries(table)) {
      tableLower.set(k.toLowerCase(), { originalKey: k, value: v });
    }
    enNsLower.set(ns.toLowerCase(), { ns, table, tableLower });
  }

  const globalLowerEn = new Map<any, any>();
  for (const [ns, table] of Object.entries(en)) {
    if (!table || typeof table !== 'object') continue;
    for (const [k, v] of Object.entries(table)) {
      const kl = k.toLowerCase();
      if (!globalLowerEn.has(kl)) {
        globalLowerEn.set(kl, { ns, key: k, textEn: v });
      }
    }
  }

  const enNsMap = new Map<any, any>();
  for (const k of Object.keys(en)) {
    enNsMap.set(k.toLowerCase(), k);
  }

  // 2. Load Weapon Table (Base & Overseas union, Overseas overrides)
  const weaponMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/StaticWeaponDataTable.json',
      'StaticWeaponDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticWeaponDataTable_Overseas.json',
      'StaticWeaponDataTable_Overseas.json'
    ],
    'StaticWeaponDataTable'
  );
  const weaponRows = weaponMerge.rows;

  // 3. Load DT_Imitation
  const imitationRes = archiveReader.findAndRead([
    'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/DT_Imitation.json',
    'DT_Imitation.json'
  ]);
  const rawImitation = imitationRes?.data;
  const imitationRows = Array.isArray(rawImitation) && rawImitation[0]?.Rows ? rawImitation[0].Rows : (rawImitation?.Rows || rawImitation || {});

  // 4. Load Matrix Suit Table (Base & Overseas union, Overseas overrides)
  const matrixMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/WeaponMatrix/StaticMatrixSuitDataTable.json',
      'StaticMatrixSuitDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticMatrixSuitDataTable_Overseas.json',
      'StaticMatrixSuitDataTable_Overseas.json'
    ],
    'StaticMatrixSuitDataTable'
  );
  const matrixRows = matrixMerge.rows;

  // 5. Load SkillUpdateTips (Base & Overseas union, Overseas overrides)
  const skillMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips.json',
      'SkillUpdateTips.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/SkillUpdateTips_Overseas.json',
      'SkillUpdateTips_Overseas.json'
    ],
    'SkillUpdateTips'
  );
  const skillRows = skillMerge.rows;

  // 5b. Load GameplayEffectTipsDataTable (Base & Overseas union, Overseas overrides)
  const geTipsMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/GameplayEffectTipsDataTable.json',
      'GameplayEffectTipsDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/GameplayEffectTipsDataTable_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Skill/GameplayEffectTipsDataTable_Overseas.json',
      'GameplayEffectTipsDataTable_Overseas.json'
    ],
    'GameplayEffectTipsDataTable'
  );
  const geTipsRows = geTipsMerge.rows;
  const geTipsLower = new Map<any, any>();
  const tipsByDescKey = new Map<any, any>();
  for (const [k, v] of Object.entries(geTipsRows)) {
    geTipsLower.set(k.toLowerCase(), v);
    const dk = v?.Desc?.Key;
    if (dk) {
      tipsByDescKey.set(dk.toLowerCase(), v);
    }
  }

  // 5b-1. Load GameplayAbilityTipsDataTable (Base & Overseas union, Overseas overrides)
  const gaTipsMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayAbilityTipsDataTable.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Weapon/GameplayAbilityTipsDataTable.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/GameplayAbilityTipsDataTable.json',
      'GameplayAbilityTipsDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/GameplayAbilityTipsDataTable_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Extra/GameplayAbilityTipsDataTable_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Skill/GameplayAbilityTipsDataTable_Overseas.json',
      'GameplayAbilityTipsDataTable_Overseas.json'
    ],
    'GameplayAbilityTipsDataTable'
  );
  const gaTipsRows = gaTipsMerge.rows;
  const gaTipsMap = new Map<any, any>();
  const gaTipsNormMap = new Map<any, any>();

  const registerGaIcon = (key, iconPath) => {
    if (!key || !iconPath || iconPath === 'None') return;
    const kl = key.toLowerCase();
    if (!gaTipsMap.has(kl)) gaTipsMap.set(kl, iconPath);
    if (kl.startsWith('ga_mplayer')) {
      const swapped = kl.replace('ga_mplayer', 'ga_fplayer');
      if (!gaTipsMap.has(swapped)) gaTipsMap.set(swapped, iconPath);
    } else if (kl.startsWith('ga_fplayer')) {
      const swapped = kl.replace('ga_fplayer', 'ga_mplayer');
      if (!gaTipsMap.has(swapped)) gaTipsMap.set(swapped, iconPath);
    }
    const norm = kl.replace(/^ga_(?:[fm]player)?/i, '').replace(/_os$/i, '');
    if (!gaTipsNormMap.has(norm)) gaTipsNormMap.set(norm, iconPath);
  };

  for (const [rowKey, rowVal] of Object.entries(gaTipsRows)) {
    if (rowVal?.Icon?.AssetPathName) {
      registerGaIcon(rowKey, rowVal.Icon.AssetPathName);
    }
    if (Array.isArray(rowVal?.GABranchStruct)) {
      for (const branch of rowVal.GABranchStruct) {
        if (branch?.Key && branch?.Value?.Icon?.AssetPathName) {
          registerGaIcon(branch.Key, branch.Value.Icon.AssetPathName);
        }
      }
    }
    if (Array.isArray(rowVal?.GAInfoStruct)) {
      for (const info of rowVal.GAInfoStruct) {
        if (info?.Key && info?.Icon?.AssetPathName) {
          registerGaIcon(info.Key, info.Icon.AssetPathName);
        }
      }
    }
  }

  // Authoritative action -> branch mapping from GameplayAbilityTipsDataTable
  const abilityBranchMap = new Map<any, any>();
  for (const [topKey, topVal] of Object.entries(gaTipsRows)) {
    const branches = topVal?.GABranchStruct || [];
    for (const b of branches) {
      const bKey = b.Key;
      if (!bKey) continue;
      const bKeyLower = bKey.toLowerCase();
      const nameKey = b.Value?.Name?.Key;
      const descKey = b.Value?.Desc?.Key;

      abilityBranchMap.set(bKeyLower, bKey);
      if (nameKey) {
        abilityBranchMap.set(nameKey.toLowerCase(), bKey);
        abilityBranchMap.set(nameKey.replace(/_name$/i, '').toLowerCase(), bKey);
      }
      if (descKey) {
        abilityBranchMap.set(descKey.toLowerCase(), bKey);
        abilityBranchMap.set(descKey.replace(/_des(?:_os)?$/i, '').toLowerCase(), bKey);
      }
    }
  }

  // 5b-2. Load WeaponUpgradeStarData (Base & Overseas union, Overseas overrides)
  const weaponUpgradeStarMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponUpgradeStarData.json',
      'WeaponUpgradeStarData.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/WeaponUpgradeStarData_Overseas.json',
      'WeaponUpgradeStarData_Overseas.json'
    ],
    'WeaponUpgradeStarData'
  );
  const weaponUpgradeStarRows = weaponUpgradeStarMerge.rows;
  const weaponUpgradeStarLowerMap = new Map<any, any>();
  for (const [k, v] of Object.entries(weaponUpgradeStarRows)) {
    weaponUpgradeStarLowerMap.set(k.toLowerCase(), v);
  }
  for (const [k, v] of Object.entries(weaponUpgradeStarRows)) {
    if (k.toLowerCase().startsWith('breakfate_')) continue;
    const dk = v?.RemouldDetail?.Key;
    if (dk) {
      tipsByDescKey.set(dk.toLowerCase(), {
        DescParam: v.RemouldDetailParams,
        ...v
      });
    }
    if (Array.isArray(v?.MultiElementRemouldDetail)) {
      for (const m of v.MultiElementRemouldDetail) {
        const mKey = m?.Value?.RemouldDetail?.Key;
        if (mKey) {
          tipsByDescKey.set(mKey.toLowerCase(), {
            DescParam: m.Value?.RemouldDetailParams,
            ...m.Value
          });
        }
      }
    }
  }

  // 5c. Load ImitationLikeabilityDataTable (Base & Overseas union, Overseas overrides)
  const likeMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/ImitationLikeabilityDataTable.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/ImitationLikeabilityDataTable.json',
      'ImitationLikeabilityDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Fashion/ImitationLikeabilityDataTable_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/ImitationLikeabilityDataTable_Overseas.json',
      'ImitationLikeabilityDataTable_Overseas.json'
    ],
    'ImitationLikeabilityDataTable'
  );
  const likeRows = likeMerge.rows;

  // 5d. Load ModifyDataTable (Base & Overseas union, Overseas overrides)
  const modifyMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/ModifyDataTable.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Weapon/ModifyDataTable.json',
      'ModifyDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/ModifyDataTable_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/ModifyDataTable_Overseas.json',
      'ModifyDataTable_Overseas.json'
    ],
    'ModifyDataTable'
  );
  const modifyRows = modifyMerge.rows;
  const modifyRowsLower = new Map<any, any>();
  for (const [k, v] of Object.entries(modifyRows)) {
    modifyRowsLower.set(k.toLowerCase(), v);
  }

  // 5e. Load DT_WeaponUpgrade (Base & Overseas union, Overseas overrides)
  const weaponUpgradeMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/DT_WeaponUpgrade.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Weapon/DT_WeaponUpgrade.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/DT_WeaponUpgrade.json',
      'DT_WeaponUpgrade.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/DT_WeaponUpgrade_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/WeaponData/DT_WeaponUpgrade_Overseas.json',
      'DT_WeaponUpgrade_Overseas.json'
    ],
    'DT_WeaponUpgrade'
  );
  const weaponUpgradeRows = weaponUpgradeMerge.rows;
  const weaponUpgradeRowsLower = new Map<any, any>();
  for (const [k, v] of Object.entries(weaponUpgradeRows)) {
    weaponUpgradeRowsLower.set(k.toLowerCase(), v);
  }

  // 5f. Load EquipStrengthenEffectPackDataTable (Base & Overseas union, Overseas overrides)
  const equipEffectPackMerge = mergeArchiveTable(
    archiveReader,
    [
      'Hotta/Content/Resources/CoreBlueprints/DataTable/EquipDataTables/EquipStrengthenEffectPackDataTable.json',
      'Hotta/Content/Resources/CoreBlueprints/DataTable/Equipment/EquipStrengthenEffectPackDataTable.json',
      'EquipStrengthenEffectPackDataTable.json'
    ],
    [
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipStrengthenEffectPackDataTable_Overseas.json',
      'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/EquipDataTables/EquipStrengthenEffectPackDataTable_Overseas.json',
      'EquipStrengthenEffectPackDataTable_Overseas.json'
    ],
    'EquipStrengthenEffectPackDataTable'
  );
  const equipEffectPackRows = equipEffectPackMerge.rows;
  const equipEffectPackRowsLower = new Map<any, any>();
  for (const [k, v] of Object.entries(equipEffectPackRows)) {
    equipEffectPackRowsLower.set(k.toLowerCase(), v);
  }

  // 6. Discover EffectFigure Files (from zip and disk, Overseas curves registered and overriding base)
  const efFileMap = new Map<any, any>();
  const registerEfTable = (filename, rows) => {
    if (!rows || typeof rows !== 'object') return;
    const baseClean = path.basename(filename).replace(/\.json$/i, '').toLowerCase();
    const isOverseas = /_(?:overseas?|os)$/i.test(baseClean);
    const cleanRaw = baseClean.replace(/_(?:overseas?|os)$/i, '');
    const shortName = cleanRaw.replace(/effectfigure$/i, '');

    if (isOverseas) {
      efFileMap.set(shortName + '_oversea', rows);
      efFileMap.set(shortName + '_overseas', rows);
      efFileMap.set(cleanRaw + '_oversea', rows);
      efFileMap.set(cleanRaw + '_overseas', rows);
    }

    const existingShort = efFileMap.get(shortName);
    if (existingShort) {
      efFileMap.set(shortName, isOverseas ? { ...existingShort, ...rows } : { ...rows, ...existingShort });
    } else {
      efFileMap.set(shortName, rows);
    }

    const existingRaw = efFileMap.get(cleanRaw);
    if (existingRaw) {
      efFileMap.set(cleanRaw, isOverseas ? { ...existingRaw, ...rows } : { ...rows, ...existingRaw });
    } else {
      efFileMap.set(cleanRaw, rows);
    }

    efFileMap.set(baseClean, rows);

    const strippedRarity = shortName.replace(/_(?:ssr|sr|r|n)$/i, '');
    const strippedElement = strippedRarity.replace(/_(?:physic|phy|fire|ice|thunder|elec|wind|superpower)$/i, '');
    const altPhy = shortName.includes('_phy') ? shortName.replace(/_phy/g, '_physic') : shortName.replace(/_physic/g, '_phy');

    for (const alias of [strippedRarity, strippedElement, altPhy]) {
      if (alias && alias !== shortName) {
        const existing = efFileMap.get(alias);
        if (existing) {
          efFileMap.set(alias, isOverseas ? { ...existing, ...rows } : { ...rows, ...existing });
        } else {
          efFileMap.set(alias, rows);
        }
      }
    }
  };

  const isEfJson = (name) => /effectfigure(?:_(?:overseas?|os))?\.json$/i.test(name);

  if (archiveReader.zipEntries && archiveReader.zipEntries.size > 0) {
    for (const [normName, entry] of archiveReader.zipEntries.entries()) {
      if (isEfJson(normName)) {
        const efRes = archiveReader.findAndRead([entry.name]);
        if (efRes?.data) {
          const rows = Array.isArray(efRes.data) && efRes.data[0]?.Rows ? efRes.data[0].Rows : (efRes.data?.Rows || efRes.data || {});
          registerEfTable(entry.name, rows);
        }
      }
    }
  }

  const scanEfDirs = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) scanEfDirs(full);
        else if (e.isFile() && isEfJson(e.name)) {
          const rawEf = readJsonFile(full);
          if (rawEf) {
            const rows = Array.isArray(rawEf) && rawEf[0]?.Rows ? rawEf[0].Rows : (rawEf?.Rows || rawEf || {});
            registerEfTable(e.name, rows);
          }
        }
      }
    } catch {}
  };
  scanEfDirs(path.join(rawDir, 'Hotta/Content/Resources'));
  scanEfDirs(path.join(rawDir, 'Hotta/Content/ResourcesOverSea'));

  // 7. Load pre-computed Matrices Dataset (produced by build-matrices.js)
  const matrixSuitsMap = new Map<any, any>();
  const matricesDatasetCandidates = [
    path.join(projectRoot, 'info', 'matrices', 'data', 'matrices.json'),
    path.join(projectRoot, 'datamine2', 'matrices', 'data', 'matrices.json')
  ];
  for (const p of matricesDatasetCandidates) {
    if (fs.existsSync(p)) {
      try {
        const matData = JSON.parse(readGameSourceFileSync(p, 'utf8'));
        const suitsList = Array.isArray(matData.suits) ? matData.suits : (matData.suits ? Object.values(matData.suits) : []);
        for (const s of suitsList) {
          if (s.id) matrixSuitsMap.set(s.id.toLowerCase(), s);
          if (s.suit_id) matrixSuitsMap.set(s.suit_id.toLowerCase(), s);
        }
        console.log(`[build-simulacra] Joined ${matrixSuitsMap.size} matrix suits from ${p}`);
        break;
      } catch (e) {
        console.warn(`[build-simulacra] Warning loading matrices dataset at ${p}:`, e.message);
      }
    }
  }

  const targetSlugArg = process.argv.find((arg) => arg.startsWith('--target-slug=') || arg.startsWith('--target-char='));
  const targetSlug = targetSlugArg ? targetSlugArg.split('=')[1].toLowerCase().trim() : null;

  for (const d of targetDirs) {
    if (fs.existsSync(d)) {
      if (process.env.CLEAN_SIMULACRA_DATA === 'true' && !targetSlug) {
        for (const f of fs.readdirSync(d)) {
          if (f.endsWith('.json')) {
            try { fs.unlinkSync(path.join(d, f)); } catch (e) {}
          }
        }
      }
    } else {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  const characterIndex = [];
  const processedSlugs = new Set<any>();
  const gachaProfiles = [];
  const gachaProfilesMap = new Map<any, any>();
  const roleStats = {
    DPS: 0,
    Tank: 0,
    Benediction: 0,
    Unknown: 0
  };

  let totalEntities = 0;
  let exactFieldMatches = 0;
  let namingMatches = 0;
  let unresolvedCount = 0;
  // Card-art (UI/huanxing/lihui, via imitation AwakenPhoto) export-coverage gate.
  // Most of the roster carries an AwakenPhoto reference, so if EVERY card fails to
  // resolve it means the huanxing/lihui image group was not exported — abort loudly
  // instead of silently publishing a roster with no card art.
  let cardExpected = 0;
  let cardResolved = 0;
  const imageManifest: Record<string, any> = {};

  // 7b. Pre-analyze active weapons, slugs, and weapon families to isolate variants from base kits
  // e.g. SwordX (Claudia Storm Eye) vs Sword (Claudia), GunBox (Carrot) vs Gun (Cobalt-B)
  const eligibleWeapons = [];
  for (const [wKey, wRow] of Object.entries(weaponRows)) {
    if (!wRow || typeof wRow !== 'object') continue;

    const wKeyLower = wKey.toLowerCase();
    if (
      wKeyLower.includes('fashion') ||
      wKeyLower.includes('level') ||
      wKeyLower.match(/_?lv\d+$/i) ||
      wKeyLower.includes('test') ||
      wKeyLower.includes('show') ||
      wKeyLower.includes('breakfate') ||
      wKeyLower.includes('imitation') ||
      wKeyLower.startsWith('weapon_exp') ||
      wKeyLower.startsWith('exp_') ||
      wKeyLower.startsWith('dwsk_') ||
      wKeyLower === 'weapon_handbp'
    ) {
      continue;
    }

    if (wRow.ItemRarity !== 'EItemRarity::ITEM_RARITY_SSR' && wRow.ItemRarity !== 'EItemRarity::ITEM_RARITY_SR') {
      continue;
    }

    // Join to DT_Imitation
    let fashionId = wRow.WeaponFashionID || '';
    let imitRow = null;
    let imitId = null;

    if (fashionId && imitationRows[fashionId]) {
      imitId = fashionId;
      imitRow = imitationRows[fashionId];
    } else {
      for (const [iKey, iRow] of Object.entries(imitationRows)) {
        if (iRow.WeaponId === wKey || iRow.PreviewWeaponId === wKey) {
          imitId = iKey;
          imitRow = iRow;
          break;
        }
      }
    }

    const avatarId = imitRow?.AvatarId || wKey;
    const avatarKey = avatarId.toLowerCase();
    const slug = CANONICAL_SLUG_MAP[avatarKey] || CANONICAL_SLUG_MAP[wKeyLower] || avatarKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const fam = extractWeaponFamily(wKey, wRow);
    const famLower = fam.toLowerCase();
    const baseLower = wKey.split('_')[0].toLowerCase();

    eligibleWeapons.push({
      wKey,
      wRow,
      wKeyLower,
      imitId,
      imitRow,
      avatarId,
      avatarKey,
      slug,
      fam,
      famLower,
      baseLower
    });
  }

  // Map active families across distinct characters to discover variant extensions
  const famMap = new Map<any, any>();
  for (const w of eligibleWeapons) {
    if (!famMap.has(w.famLower)) famMap.set(w.famLower, new Set<any>());
    famMap.get(w.famLower).add(w.slug);
  }

  const familyExcludedPrefixes = new Map<any, any>();
  for (const [f1, slugs1] of famMap.entries()) {
    for (const [f2, slugs2] of famMap.entries()) {
      if (f1 !== f2 && f2.startsWith(f1)) {
        const overlap = Array.from(slugs1).some(s => slugs2.has(s));
        if (!overlap) {
          if (!familyExcludedPrefixes.has(f1)) familyExcludedPrefixes.set(f1, new Set<any>());
          const exSet = familyExcludedPrefixes.get(f1);
          exSet.add(`ga_fplayer${f2}`);
          exSet.add(`ga_mplayer${f2}`);
          exSet.add(`ga_player${f2}`);
          exSet.add(`ga_fplaye${f2}`);
          exSet.add(`ga_mplaye${f2}`);
          exSet.add(`ga_${f2}`);
          exSet.add(f2);
          exSet.add(`buff_${f2}_`);
          exSet.add(`ge_${f2}_`);
        }
      }
    }
  }

  // Sort eligible weapons so variants with longer/more specific families are processed first
  // (e.g. SwordX_physic before sword_physic, GunBox_fire before gun_fire)
  eligibleWeapons.sort((a, b) => {
    if (b.famLower.length !== a.famLower.length) {
      return b.famLower.length - a.famLower.length;
    }
    return a.wKey.localeCompare(b.wKey);
  });

  const claimedActiveSkills = new Map<any, any>(); // normalized skill base -> slug

  // Track discovered weapons
  for (const weaponItem of eligibleWeapons) {
    const { wKey, wRow, wKeyLower, imitId, imitRow, avatarId, avatarKey, slug } = weaponItem;

    if (targetSlug && slug !== targetSlug && avatarKey !== targetSlug && wKeyLower !== targetSlug) {
      continue;
    }

    if (processedSlugs.has(slug)) continue;
    processedSlugs.add(slug);

    // Strict assertions for core identities
    if (wKey === 'brush_fire') {
      if (imitId !== 'imitation_37' || avatarId !== 'liuhuo') {
        throw new Error(`CRITICAL INTEGRITY FAILURE: brush_fire must join to imitation_37 (liuhuo), got ${imitId} (${avatarId})`);
      }
    }
    if (wKey === 'DFishChess_Fire') {
      if (imitId !== 'imitation_57' || avatarId !== 'jiyu') {
        throw new Error(`CRITICAL INTEGRITY FAILURE: DFishChess_Fire must join to imitation_57 (jiyu), got ${imitId} (${avatarId})`);
      }
    }
    if (wKey === 'queen_superpower') {
      if (imitId !== 'imitation_36' || avatarId !== 'feiouna') {
        throw new Error(`CRITICAL INTEGRITY FAILURE: queen_superpower must join to imitation_36 (feiouna), got ${imitId} (${avatarId})`);
      }
    }

    // Localized Character & Weapon Names strictly from Game.json FText
    const wNameEn = cleanHtmlTags(locResolver.resolve(wRow.ItemName, { locale: 'en' }).text || wKey);
    const wNameRu = cleanHtmlTags(locResolver.resolve(wRow.ItemName, { locale: 'ru' }).text || wNameEn);

    let cNameEn = '';
    let cNameRu = '';
    if (imitRow && imitRow.Name) {
      cNameEn = cleanHtmlTags(locResolver.resolve(imitRow.Name, { locale: 'en' }).text || avatarId);
      cNameRu = cleanHtmlTags(locResolver.resolve(imitRow.Name, { locale: 'ru' }).text || cNameEn);
    } else {
      cNameEn = wNameEn;
      cNameRu = wNameRu;
    }

    const effectKey = extractWeaponFamily(wKey, wRow);
    const effectKeyLower = effectKey.toLowerCase();
    const baseKeyLower = wKey.split('_')[0].toLowerCase();

    // Locate EffectFigure file
    const effectKeyBase = effectKey.replace(/(?:sp|chess|rogue)$/i, '').toLowerCase();
    const rarityLower = (wRow.ItemRarity === 'EItemRarity::ITEM_RARITY_SSR' ? 'ssr' : 'sr');
    const efCandidates = [
      wKeyLower + '_' + rarityLower,
      wKeyLower.replace(/physic/g, 'phy') + '_' + rarityLower,
      baseKeyLower + '_' + rarityLower,
      effectKeyLower + '_' + rarityLower,
      effectKeyBase + '_' + rarityLower,
      effectKeyLower,
      effectKeyBase,
      baseKeyLower,
      wKeyLower,
      wKeyLower.replace(/physic/g, 'phy'),
      avatarId.toLowerCase(),
      (imitRow?.Name?.Key || '').replace(/_name$/i, '').toLowerCase()
    ];
    let efRows: Record<string, any> = {};
    for (const cand of efCandidates) {
      if (cand && efFileMap.has(cand)) {
        efRows = efFileMap.get(cand);
        break;
      }
    }

    const { primary: element, secondary: elementSecondary } = resolveElements(wKey, wRow, geTipsRows);
    const role = resolveWeaponRole(wRow);
    const resonance = role;
    roleStats[role] = (roleStats[role] || 0) + 1;
    if (role === 'Unknown') {
      console.warn(`[build-simulacra] Unclassified weapon role for ${wKey} (${slug}) - emitted typed Unknown`);
    }
    const rarity = wRow.ItemRarity === 'EItemRarity::ITEM_RARITY_SSR' ? 'SSR' : 'SR';

    // Base Stats - Extract authentic Shatter (ArmorBroken) and Charge (Charging) from WeaponUpgradeStarData at star 0
    const starPackId = (wRow.UpgradeStarPackID || '').toLowerCase();
    const star0Candidates = [
      starPackId ? `${starPackId}_0` : null,
      starPackId ? `${starPackId}_1` : null,
      `${wKeyLower}_star_0`,
      `${wKeyLower}_ssr_star_0`,
      `${wKeyLower}_sr_star_0`,
      `${wKeyLower}_star_1`
    ].filter(Boolean);

    let star0Row = null;
    for (const cand of star0Candidates) {
      if (weaponUpgradeStarLowerMap.has(cand)) {
        star0Row = weaponUpgradeStarLowerMap.get(cand);
        break;
      }
    }

    const realShatter = typeof star0Row?.ArmorBroken === 'number'
      ? star0Row.ArmorBroken
      : (typeof wRow.Shatter === 'number' ? wRow.Shatter : (typeof wRow.BreakShieldPoint === 'number' ? wRow.BreakShieldPoint : 12.0));

    const realCharge = typeof star0Row?.Charging === 'number'
      ? star0Row.Charging
      : (typeof wRow.Charge === 'number' ? wRow.Charge : (typeof wRow.EnergyChargePoint === 'number' ? wRow.EnergyChargePoint : 12.0));

    // Authentic Weapon Stats: computed from StaticWeaponDataTable (ModifyData) -> ModifyDataTable and WeaponUpgradeStarData (AttributeCoefficientList at 6★)
    const isSSR = rarity === 'SSR';
    const modKey = (wRow.ModifyData || '').toLowerCase();
    const modRow = modifyRowsLower.get(modKey);

    const star6Candidates = [
      starPackId ? `${starPackId}_6` : null,
      starPackId ? `${starPackId}_5` : null,
      `${wKeyLower}_ssr_star_6`,
      `${wKeyLower}_sr_star_6`,
      `${wKeyLower}_star_6`
    ].filter(Boolean);

    let star6Row = null;
    for (const cand of star6Candidates) {
      if (weaponUpgradeStarLowerMap.has(cand)) {
        star6Row = weaponUpgradeStarLowerMap.get(cand);
        break;
      }
    }

    const star6CoefMap = new Map<any, any>();
    if (Array.isArray(star6Row?.AttributeCoefficientList)) {
      for (const c of star6Row.AttributeCoefficientList) {
        if (c?.PropName && typeof c.PropCoefficient === 'number') {
          star6CoefMap.set(c.PropName, c.PropCoefficient);
        }
      }
    }

    // Authentic Weapon Upgrade Progression: resolve level 200 upgrade row from DT_WeaponUpgrade
    // and extract stat progression AddAttrValues from EquipStrengthenEffectPackDataTable
    const lv200Candidates = [
      `${wKeyLower}_ssr_lv_200`,
      `${wKeyLower}_sr_lv_200`,
      `${wKeyLower}_lv_200`,
      `${wKeyLower}_200`
    ];
    let lv200Row = null;
    for (const cand of lv200Candidates) {
      if (weaponUpgradeRowsLower.has(cand)) {
        lv200Row = weaponUpgradeRowsLower.get(cand);
        break;
      }
    }
    if (!lv200Row) {
      for (const [uk, uv] of weaponUpgradeRowsLower.entries()) {
        if (uk.startsWith(wKeyLower + '_') && uk.endsWith('_200')) {
          lv200Row = uv;
          break;
        }
      }
    }

    let packValues = null;
    if (lv200Row && lv200Row.ModifyPack) {
      const packRow = equipEffectPackRowsLower.get(lv200Row.ModifyPack.toLowerCase());
      if (packRow && Array.isArray(packRow.AddAttrValues)) {
        packValues = packRow.AddAttrValues;
      }
    }

    let calcAtk = null;
    let calcAtkBase = null;
    let calcHp = null;
    let calcCrit = null;
    let calcDef = null;

    let baseAtkVal = null;
    let baseHpVal = null;
    let baseCritVal = null;
    let baseDefVal = null;

    if (modRow && Array.isArray(modRow.ModifyData)) {
      modRow.ModifyData.forEach((item, idx) => {
        const prop = item.PropName;
        const rawPropVal = typeof item.PropValue === 'number' ? item.PropValue : 0;
        const packAttrVal = (packValues && typeof packValues[idx] === 'number') ? packValues[idx] : null;

        // When authoritative upgrade pack exists, use its growth value and authentic level 1 base (upgrade * 6)
        const upgradeVal = packAttrVal !== null ? packAttrVal : (rawPropVal / 6);
        const baseVal = packAttrVal !== null ? (packAttrVal * 6) : rawPropVal;

        const g = prop === 'MaxHealthAdded' ? Math.floor(baseVal) : baseVal;
        const coef6 = star6CoefMap.get(prop) ?? 2.0;

        const maxVal = Math.floor((g + upgradeVal * 200) * coef6);
        const base0Val = Math.floor(g + upgradeVal * 200);

        if (prop === 'CommonAtkAdded') {
          calcAtk = maxVal;
          calcAtkBase = base0Val;
          baseAtkVal = Math.round(baseVal);
        } else if (prop === 'MaxHealthAdded') {
          calcHp = maxVal;
          baseHpVal = Math.floor(baseVal);
        } else if (prop === 'CritAdded') {
          calcCrit = maxVal;
          baseCritVal = Math.round(baseVal);
        } else if (prop === 'ElementDef') {
          calcDef = maxVal;
          baseDefVal = Math.round(baseVal);
        }
      });
    }

    const finalAtk = calcAtk ?? (isSSR ? 1612 : 862);
    const finalAtkBase = calcAtkBase ?? (isSSR ? 1300 : 695);
    const finalHp = calcHp ?? (isSSR ? 79999 : 52121);
    const finalCrit = calcCrit;
    const finalDef = calcDef;

    function calcGrade(val) {
      const num = parseFloat(val);
      if (isNaN(num)) return null;
      if (num >= 15.0) return 'SS';
      if (num >= 10.0) return 'S';
      if (num >= 8.0) return 'A';
      if (num >= 4.0) return 'B';
      return 'C';
    }

    const shatterGrade = calcGrade(realShatter);
    const chargeGrade = calcGrade(realCharge);

    const baseStats = {
      attack: baseAtkVal ?? (typeof wRow.Attack === 'number' ? wRow.Attack : (typeof wRow.CommonAtkBase === 'number' ? wRow.CommonAtkBase : 16)),
      hp: baseHpVal ?? (typeof wRow.Health === 'number' ? wRow.Health : (typeof wRow.MaxHealth === 'number' ? wRow.MaxHealth : 1010)),
      ...(baseCritVal !== null ? { crit: baseCritVal } : {}),
      ...(baseDefVal !== null ? { def: baseDefVal, resistance: baseDefVal } : (baseCritVal === null ? { crit: 12 } : {})),
      shatter: realShatter,
      shatter_grade: shatterGrade,
      charge: realCharge,
      charge_grade: chargeGrade
    };

    // Max Level (200) Stats computed from authentic growth curves and 6★ star bonuses
    const maxStats = {
      level: 200,
      attack: finalAtk,
      attack_base: finalAtkBase,
      hp: finalHp,
      ...(finalCrit !== null ? { crit: finalCrit } : {}),
      ...(finalDef !== null ? { def: finalDef, resistance: finalDef } : (finalCrit === null ? { crit: isSSR ? 998 : 361 } : {})),
      shatter: realShatter,
      shatter_grade: shatterGrade,
      charge: realCharge,
      charge_grade: chargeGrade
    };

    // Advancements (A1-A6)
    const advancements = [];
    for (let star = 1; star <= 6; star++) {
      const adv = resolveAdvancement({
        locResolver,
        fam: effectKey,
        wKey,
        star,
        rarity,
        efRows,
        tipsByDescKey,
        efFileMap,
        en,
        ru,
        enNsMap,
        weaponUpgradeStarRows
      });

      advancements.push({
        star: adv.star,
        name_en: adv.name_en,
        name_ru: adv.name_ru,
        desc_en: adv.desc_en,
        desc_ru: adv.desc_ru,
        multipliers: adv.multipliers
      });
    }

    // Matrix Set Effects (2pc / 4pc)
    const suitId = wRow.MatrixSuitArray?.[0]?.MatrixSuitName || '';
    const matrixRow = matrixRows[suitId] || matrixRows[suitId.replace(/^suit_/i, 'Suit_')] || matrixRows[suitId.replace(/^suit_/i, 'suit_')] || Object.entries(matrixRows).find(([k]) => k.toLowerCase() === suitId.toLowerCase())?.[1] || null;
    const rawMatrixIconRef = matrixRow?.SuitIcon?.AssetPathName || matrixRow?.SuitRemouldIcon?.AssetPathName || matrixRow?.SuitIconTemp?.AssetPathName || '';

    // Check pre-computed matrix dataset for complete star scaling and resolved tokens
    const matchedSuit = suitId ? matrixSuitsMap.get(suitId.toLowerCase()) : null;
    const effect2 = matchedSuit?.effects?.find(e => e.count === 2 || e.piece === 2 || e.piece === '2');
    const effect4 = matchedSuit?.effects?.find(e => e.count === 4 || e.piece === 4 || e.piece === '4');

    const rawSet2En = resolveMatrixPiece(locResolver, matrixRow, effectKey, suitId, 0, 'en');
    const rawSet2Ru = resolveMatrixPiece(locResolver, matrixRow, effectKey, suitId, 0, 'ru');
    const set2En = effect2?.text_en || rawSet2En || '2-Piece Set: Increases damage and attack power.';
    const set2Ru = effect2?.text_ru || rawSet2Ru || (rawSet2En || '2 предмета: Повышает урон и силу атаки.');

    const rawSet4En = resolveMatrixPiece(locResolver, matrixRow, effectKey, suitId, 1, 'en');
    const rawSet4Ru = resolveMatrixPiece(locResolver, matrixRow, effectKey, suitId, 1, 'ru');
    const set4En = effect4?.text_en || rawSet4En || '4-Piece Set: Grants elemental damage bonuses and resonance boosts.';
    const set4Ru = effect4?.text_ru || rawSet4Ru || (rawSet4En || '4 предмета: Дает бонусы к стихийному урону и резонансу.');

    const matrixPieces = Array.isArray(matchedSuit?.pieces) ? matchedSuit.pieces.map(p => ({
      slot: p.slot,
      slot_name_en: p.slot_name_en || (p.slot === 1 ? 'Mind' : p.slot === 2 ? 'Memory' : p.slot === 3 ? 'Belief' : 'Emotion'),
      slot_name_ru: p.slot_name_ru || (p.slot === 1 ? 'Разум' : p.slot === 2 ? 'Память' : p.slot === 3 ? 'Вера' : 'Эмоция'),
      name_en: p.name_en || '',
      name_ru: p.name_ru || '',
      description_en: p.description_en || '',
      description_ru: p.description_ru || '',
      icon: p.icon_thumb || p.icon || ''
    })) : [];

    const matrix = {
      suit_id: suitId,
      suit_name_en: matchedSuit?.name_en || `${cNameEn} Matrix Set`,
      suit_name_ru: matchedSuit?.name_ru || `Комплект матриц: ${cNameRu}`,
      chip_icon: matchedSuit?.icon_thumb || matchedSuit?.icon || null,
      suit_icon: matchedSuit?.media?.suit_icon?.fullUrl || matchedSuit?.suit_portrait || null,
      suit_icon_asset: matchedSuit?.media?.suit_icon?.assetRef || null,
      remould_icon: matchedSuit?.media?.remould_art?.fullUrl || matchedSuit?.remould_icon || null,
      remould_icon_asset: matchedSuit?.media?.remould_art?.assetRef || null,
      pieces: matrixPieces,
      set2: {
        desc_en: cleanHtmlTags(set2En),
        desc_ru: cleanHtmlTags(set2Ru),
        template_en: effect2?.template_en || null,
        template_ru: effect2?.template_ru || null,
        stars: effect2?.stars || [],
        values: effect2?.values || []
      },
      set4: {
        desc_en: cleanHtmlTags(set4En),
        desc_ru: cleanHtmlTags(set4Ru),
        template_en: effect4?.template_en || null,
        template_ru: effect4?.template_ru || null,
        stars: effect4?.stars || [],
        values: effect4?.values || []
      }
    };

    // Variable Complete Skill Graph (Entity-Linked Graph Resolution: Active Skills from WeaponSkillList, Passives from GameplayEffectTipsDataTable)
    let discoveredSkills = [];
    const seenActionBases = new Set<any>();
    const accountedTips = new Set<any>();
    const weaponSkillList = Array.isArray(wRow.WeaponSkillList) ? wRow.WeaponSkillList : [];

    // Active skill search prefixes
    const gaPrefixes = new Set<any>();
    gaPrefixes.add(`ga_fplayer${effectKeyLower}`);
    gaPrefixes.add(`ga_mplayer${effectKeyLower}`);
    gaPrefixes.add(`ga_player${effectKeyLower}`);
    gaPrefixes.add(`ga_fplaye${effectKeyLower}`);
    gaPrefixes.add(`ga_mplaye${effectKeyLower}`);
    gaPrefixes.add(`ga_${effectKeyLower}`);
    gaPrefixes.add(`ga_fplayer${baseKeyLower}`);
    gaPrefixes.add(`ga_mplayer${baseKeyLower}`);
    gaPrefixes.add(`ga_player${baseKeyLower}`);
    gaPrefixes.add(`ga_fplaye${baseKeyLower}`);
    gaPrefixes.add(`ga_mplaye${baseKeyLower}`);
    gaPrefixes.add(`ga_${baseKeyLower}`);
    gaPrefixes.add(effectKeyLower);
    gaPrefixes.add(baseKeyLower);
    for (const ga of weaponSkillList) {
      gaPrefixes.add(ga.toLowerCase());
    }

    const candidateNsSet = new Set<any>();
    const addCandidateNs = (ns) => {
      if (!ns) return;
      const entry = enNsLower.get(ns.toLowerCase());
      if (entry) candidateNsSet.add(entry.ns);
    };

    const nsStems = [
      effectKey,
      baseKeyLower,
      wKey.split('_')[0],
      effectKey.replace(/(?:sp|chess|rogue)$/i, ''),
      baseKeyLower.replace(/(?:sp|chess|rogue)$/i, '')
    ];

    for (const stem of nsStems) {
      addCandidateNs(`${stem}Des_Oversea`);
      addCandidateNs(`${stem}Des`);
      addCandidateNs(`${stem}Des_MMO`);
      addCandidateNs(stem);
    }

    addCandidateNs('Skill_Overseas');
    addCandidateNs('Skill');
    addCandidateNs('SkillDes_Oversea');
    addCandidateNs('SkillDes');

    for (const stem of [effectKeyLower, baseKeyLower]) {
      if (stem.length >= 4) {
        for (const [lowerNs, entry] of enNsLower.entries()) {
          if (/balance/i.test(lowerNs)) continue;
          if (lowerNs.includes(stem)) {
            candidateNsSet.add(entry.ns);
          }
        }
      }
    }

    const candidateNsList = Array.from(candidateNsSet);

    const lookupActiveText = (key) => {
      if (!key) return null;
      const keyLower = key.toLowerCase();
      for (const candidateNs of candidateNsList) {
        const entry = enNsLower.get(candidateNs.toLowerCase());
        if (!entry) continue;
        if (en[entry.ns] && en[entry.ns][key]) {
          return { textEn: en[entry.ns][key], textRu: ru?.[entry.ns]?.[key] || en[entry.ns][key], ns: entry.ns, key };
        }
        const hit = entry.tableLower.get(keyLower);
        if (hit) {
          const origK = hit.originalKey;
          return {
            textEn: hit.value,
            textRu: ru?.[entry.ns]?.[origK] || hit.value,
            ns: entry.ns,
            key: origK
          };
        }
      }
      const globalHit = globalLowerEn.get(keyLower);
      if (globalHit) {
        return {
          textEn: globalHit.textEn,
          textRu: ru?.[globalHit.ns]?.[globalHit.key] || globalHit.textEn,
          ns: globalHit.ns,
          key: globalHit.key
        };
      }
      return null;
    };

    const famExcluded = [
      ...(familyExcludedPrefixes.get(effectKeyLower) ? Array.from(familyExcludedPrefixes.get(effectKeyLower)) : []),
      ...(familyExcludedPrefixes.get(baseKeyLower) ? Array.from(familyExcludedPrefixes.get(baseKeyLower)) : [])
    ];
    const isExcludedByVariant = (str) => {
      if (!str || famExcluded.length === 0) return false;
      const s = str.toLowerCase();
      for (const pfx of famExcluded) {
        if (s.startsWith(pfx)) return true;
      }
      return false;
    };

    // 1. Gather candidate active bases from WeaponSkillList, SkillUpdateTips, and matching localization tables
    const candidateActiveBases = [];
    for (const ga of weaponSkillList) {
      if (!isExcludedByVariant(ga) && !candidateActiveBases.includes(ga)) candidateActiveBases.push(ga);
    }

    for (const tipKey of Object.keys(skillRows)) {
      if (isExcludedByVariant(tipKey)) continue;
      const tipLower = tipKey.toLowerCase();
      for (const pfx of gaPrefixes) {
        if (tipLower.startsWith(pfx)) {
          const base = tipKey.replace(/_\d+$/, '');
          if (!isExcludedByVariant(base) && !candidateActiveBases.includes(base)) candidateActiveBases.push(base);
          break;
        }
      }
    }

    for (const candidateNs of candidateNsList) {
      const entry = enNsLower.get(candidateNs.toLowerCase());
      const table = entry ? entry.table : (en[candidateNs] || null);
      if (!table || typeof table !== 'object') continue;
      for (const k of Object.keys(table)) {
        if (/balance/i.test(k)) continue;
        let actionBase = null;
        if (/_name$/i.test(k)) actionBase = k.replace(/_name$/i, '');
        else if (/^Name_/i.test(k)) actionBase = k.replace(/^Name_/i, '');
        if (!actionBase) continue;
        if (isExcludedByVariant(actionBase)) continue;

        const actLower = actionBase.toLowerCase();
        let matches = false;
        for (const pfx of gaPrefixes) {
          if (actLower.startsWith(pfx) || actLower.startsWith('ga_' + pfx)) {
            matches = true;
            break;
          }
        }
        if (matches && !candidateActiveBases.includes(actionBase)) {
          candidateActiveBases.push(actionBase);
        }
      }
    }

    // 2. Process ACTIVE SKILLS
    for (const actionBase of candidateActiveBases) {
      if (/(?:_fail|fail$)/i.test(actionBase)) continue;
      if (/balance/i.test(actionBase)) continue;
      if (isExcludedByVariant(actionBase)) continue;

      if (rarityLower === 'ssr' && /_(?:sr|r)(?:$|_)/i.test(actionBase) && !/star|res/i.test(actionBase)) continue;
      if (rarityLower === 'sr' && /_ssr(?:$|_)/i.test(actionBase)) continue;

      const actionBaseLower = actionBase.toLowerCase();
      const baseNorm = actionBase
        .replace(/powear/i, 'Power')
        .replace(/forwardevadeattack/i, 'ForwardAttack')
        .replace(/_new_/gi, '_')
        .replace(/_succ?ess/gi, '')
        .replace(/Normal$/i, '');
      const normLower = baseNorm.toLowerCase();

      if (seenActionBases.has(normLower) || seenActionBases.has(actionBaseLower)) continue;

      const claimedBy = claimedActiveSkills.get(normLower) || claimedActiveSkills.get(actionBaseLower);
      if (claimedBy && claimedBy !== slug) {
        const claimingFam = eligibleWeapons.find(w => w.slug === claimedBy)?.famLower;
        if (claimingFam && (claimingFam.startsWith(effectKeyLower) || claimingFam.startsWith(baseKeyLower)) && claimingFam !== effectKeyLower && claimingFam !== baseKeyLower) {
          continue;
        }
      }
      if (
        /^buff_matrix/i.test(actionBase) ||
        /^matrix_/i.test(actionBase) ||
        /^nitai_/i.test(actionBase) ||
        /^buff_imitation/i.test(actionBase) ||
        /^choose_matrix/i.test(actionBase)
      ) {
        continue;
      }

      const nameKeys = [
        actionBase + '_name',
        actionBase + '_Name',
        'Name_' + actionBase,
        baseNorm + '_name',
        actionBase.replace(/Power/i, 'Powear') + '_name',
        actionBase.replace(/ForwardAttack/i, 'ForwardEvadeAttack') + '_name',
        actionBase.replace(/_succ?ess/gi, '') + '_name'
      ];

      let foundName = null;
      for (const nk of nameKeys) {
        foundName = lookupActiveText(nk);
        if (foundName) break;
      }

      // Check bare actionBase as fallback for name only if short and not instructional description
      if (!foundName) {
        const bareLookup = lookupActiveText(actionBase.replace(/_succ?ess/gi, ''));
        if (bareLookup && bareLookup.textEn) {
          const cleanBare = cleanHtmlTags(bareLookup.textEn).trim();
          if (cleanBare.length < 40 && !/^(?:press|hold|use|deals?|при|нажмите|удерживайте)\b/i.test(cleanBare)) {
            foundName = bareLookup;
          }
        }
      }

      const desKeys = [
        actionBase + '_des_OS', actionBase + '_des', actionBase + '_Des', actionBase + '_des1', actionBase + 'Des',
        actionBase + '_name_des', baseNorm + '_name_des',
        actionBase + '_OS', actionBase + '_os',
        baseNorm + '_des_OS', baseNorm + '_des', baseNorm + '_Des',
        baseNorm + '_OS', baseNorm + '_os',
        actionBase.replace(/Attack/i, 'Attac') + '_Des',
        baseNorm.replace(/Attack/i, 'Attac') + '_Des',
        'Des_' + actionBase + '_OS', 'Des_' + actionBase,
        'Des_' + baseNorm + '_OS', 'Des_' + baseNorm,
        actionBase,
        baseNorm
      ];

      let foundDesc = null;
      for (const dk of desKeys) {
        foundDesc = lookupActiveText(dk);
        if (foundDesc) break;
      }

      // If no name found yet, but description was found: extract title or format clean action name
      if (!foundName && foundDesc) {
        const mEn = foundDesc.textEn.match(/(?:to trigger|triggering|to cast)\s+([A-Za-z0-9\s'’-]+?),/i);
        const mRu = foundDesc.textRu ? foundDesc.textRu.match(/(?:выполнить|активировать)\s+([А-Яа-яA-Za-z0-9\s'’-]+?),/i) : null;
        if (mEn && mEn[1] && mEn[1].trim().length < 30) {
          foundName = {
            textEn: mEn[1].trim(),
            textRu: mRu ? mRu[1].trim() : mEn[1].trim(),
            ns: foundDesc.ns,
            key: actionBase + '_derived_name'
          };
        } else {
          const cleanAction = actionBase
            .replace(/^GA_(?:[FM]Player)?[A-Za-z0-9]+?(?:Skill|Evade|Melee)?_/i, '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/_/g, ' ')
            .trim();
          foundName = {
            textEn: cleanAction || actionBase,
            textRu: cleanAction || actionBase,
            ns: 'Derived',
            key: actionBase
          };
        }
      }

      if (!foundName) continue;

      seenActionBases.add(normLower);
      seenActionBases.add(actionBaseLower);

      let sNameEn = cleanHtmlTags(foundName.textEn);
      let sNameRu = cleanHtmlTags(foundName.textRu || sNameEn);

      let sDescEn = cleanHtmlTags(foundDesc?.textEn || '');
      let sDescRu = cleanHtmlTags(foundDesc?.textRu || sDescEn);

      // Handle inverted name/desc from upstream game tables
      if (sNameEn.length > 80) {
        if (sDescEn.length > 0 && sDescEn.length < 50) {
          const tempNameEn = sNameEn;
          const tempNameRu = sNameRu;
          sNameEn = sDescEn;
          sNameRu = sDescRu;
          sDescEn = tempNameEn;
          sDescRu = tempNameRu;
        } else if (sDescEn.length === 0) {
          sDescEn = sNameEn;
          sDescRu = sNameRu;
          const cleanAction = actionBase
            .replace(/^GA_(?:[FM]Player)?[A-Za-z0-9]+?(?:Skill|Evade|Melee)?_/i, '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/_/g, ' ')
            .trim();
          sNameEn = cleanAction || actionBase;
          sNameRu = cleanAction || actionBase;
        }
      }

      // Discard dummy / placeholder / null skills (e.g. GA_FPlayerQueenSkill_None) or un-discovered skills with no real name/desc
      const isNoneName = /^none$/i.test(sNameEn) || /^нет$/i.test(sNameRu);
      const isNoneId = /(?:^|_)(?:none|null|dummy)(?:$|_)/i.test(actionBase);
      if (isNoneName || (isNoneId && (!sDescEn || sDescEn === '—'))) {
        continue;
      }
      const hasValidName = sNameEn && sNameEn !== '—' && !/^none$/i.test(sNameEn);
      const hasValidDesc = (sDescEn && sDescEn !== '—') || (sDescRu && sDescRu !== '—');
      if (!hasValidName && !hasValidDesc) {
        continue;
      }

      const category = classifySkillCategory(actionBase, sNameEn, sDescEn);

      // Match parameters in SkillUpdateTips
      const matchedTips = [];
      const branchKey = abilityBranchMap.get(actionBaseLower) ||
                        abilityBranchMap.get(baseNorm.toLowerCase()) ||
                        (foundName?.key ? abilityBranchMap.get(foundName.key.toLowerCase()) : null) ||
                        (foundName?.key ? abilityBranchMap.get(foundName.key.replace(/_name$/i, '').toLowerCase()) : null);

      if (branchKey) {
        const branchLower = branchKey.toLowerCase();
        for (const [tipKey, tipRow] of Object.entries(skillRows)) {
          const tipLower = tipKey.toLowerCase();
          if (tipLower.startsWith(branchLower + '_') || tipLower === branchLower) {
            accountedTips.add(tipKey);
            const keys = tipRow.Keys || [];
            const levels: Record<string, any> = {};
            keys.forEach((kv, idx) => {
              levels[idx + 1] = kv.Value !== undefined ? kv.Value : kv;
            });
            matchedTips.push({
              key: tipKey,
              levels,
              interpMode: tipRow.InterpMode || 'RCIM_Linear',
              defaultValue: tipRow.DefaultValue
            });
          }
        }
      }

      // If branchKey didn't yield any matchedTips, fall back to heuristic matching
      if (matchedTips.length === 0) {
        for (const [tipKey, tipRow] of Object.entries(skillRows)) {
          const tipLower = tipKey.toLowerCase();
          if (tipLower.includes(effectKeyLower) || tipLower.includes(baseKeyLower)) {
            let matches = false;
            const actionNorm = actionBaseLower.replace(/^ga_fplayer|^ga_mplayer|^ga_|^buff_/i, '');
            const tipNorm = tipLower.replace(/^ga_fplayer|^ga_mplayer|^ga_|^buff_/i, '');

            if (actionNorm.includes('melee_air') && tipNorm.includes('airattack')) matches = true;
            else if (actionNorm.includes('jumpattack') && tipNorm.includes('jumpattack')) matches = true;
            else if (actionNorm.includes('powerattack') && tipNorm.includes('powerattack')) matches = true;
            else if (actionNorm.includes('evadeattack_front') && tipNorm.includes('forwardattack')) matches = true;
            else if (actionNorm.includes('evadeattack_back') && tipNorm.includes('backattack')) matches = true;
            else if (actionNorm.includes('realskill2') && (tipNorm.includes('skill2') || tipNorm.includes('skill_2'))) matches = true;
            else if (actionNorm.includes('changeskill') && tipNorm.includes('changeskill')) matches = true;
            else if (actionNorm.endsWith('_melee') && tipNorm.includes('melee_melee')) matches = true;
            else if (tipNorm.includes(actionNorm) || actionNorm.includes(tipNorm.split('_')[0])) {
              matches = true;
            }

            if (matches) {
              accountedTips.add(tipKey);
              const keys = tipRow.Keys || [];
              const levels: Record<string, any> = {};
              keys.forEach((kv, idx) => {
                levels[idx + 1] = kv.Value !== undefined ? kv.Value : kv;
              });
              matchedTips.push({
                key: tipKey,
                levels,
                interpMode: tipRow.InterpMode || 'RCIM_Linear',
                defaultValue: tipRow.DefaultValue
              });
            }
          }
        }
      }

      // Sort tips sequentially by suffix number (_1, _2, etc.)
      matchedTips.sort((a, b) => {
        const numA = parseInt(a.key.match(/_(\d+)$/)?.[1] || '0', 10);
        const numB = parseInt(b.key.match(/_(\d+)$/)?.[1] || '0', 10);
        return numA - numB;
      });

      // Resolve Skill Icon from exact reference (no filename guessing)
      totalEntities++;
      const charKeys = [effectKey, baseKeyLower, avatarId, wKey, slug].filter(Boolean);
      const resolvedSkillIcon = resolveExactSkillIcon({
        actionBase,
        category,
        charKeys,
        geTipsRows,
        geTipsLower,
        gaTipsMap,
        gaTipsNormMap,
        imageCopier
      });

      if (resolvedSkillIcon.resolved) {
        exactFieldMatches++;
        imageManifest[resolvedSkillIcon.assetRef] = {
          full: resolvedSkillIcon.full,
          thumb: resolvedSkillIcon.thumb,
          strategy: resolvedSkillIcon.strategy
        };
      } else {
        unresolvedCount++;
      }

      let pct = null;
      if (matchedTips.length > 0) {
        const firstLevel = matchedTips[0].levels[1];
        if (typeof firstLevel === 'number') {
          pct = Math.round(firstLevel * 100) / 100;
        }
      }

      const descDisplayEn = formatSkillDescription(sDescEn, { id: actionBase, name_en: sNameEn, parameters: matchedTips }, efRows);
      const descDisplayRu = formatSkillDescription(sDescRu, { id: actionBase, name_en: sNameRu || sNameEn, parameters: matchedTips }, efRows);

      discoveredSkills.push({
        id: actionBase,
        name_en: sNameEn,
        name_ru: sNameRu,
        desc_en: cleanHtmlTags(sDescEn),
        desc_ru: cleanHtmlTags(sDescRu),
        desc_display_en: cleanHtmlTags(descDisplayEn),
        desc_display_ru: cleanHtmlTags(descDisplayRu),
        category,
        type: category === 'Normal' ? 'Normal Attack' : (category === 'Dodge' ? 'Dodge' : (category === 'Discharge' ? 'Discharge' : 'Skill')),
        combo: null,
        type_tags: [],
        pct,
        icon: resolvedSkillIcon,
        icon_thumb: resolvedSkillIcon.resolved ? resolvedSkillIcon.thumb : null,
        parameters: matchedTips,
        provenance: {
          source: 'WeaponSkillList',
          namespace: foundName.ns,
          nameKey: foundName.key,
          tipsCount: matchedTips.length,
          overseasWon: /_oversea/i.test(foundName.ns || '') || /_os$/i.test(foundName.key || '') || (matchedTips.length > 0 && skillMerge.stat.replacedCount > 0)
        }
      });
      claimedActiveSkills.set(actionBaseLower, slug);
      claimedActiveSkills.set(normLower, slug);
    }

    // 3. Process PASSIVES & RESONANCES from GameplayEffectTipsDataTable[_Overseas]
    // A passive/buff appears for a weapon ONLY if its row key carries that weapon's identity prefix, or its ability is in WeaponSkillList.
    // Filter strictly by the ROW KEY, never by Desc.Key. Exclude matrix, nitai, and imitation traits.
    const geIdentityPrefixes = [
      `buff_${effectKeyLower}_`,
      `buff_${baseKeyLower}_`,
      `ge_${effectKeyLower}_`,
      `ge_buff_${effectKeyLower}_`,
      `actor_ge_buff_${effectKeyLower}_`
    ];

    for (const [rowKey, geRow] of Object.entries(geTipsRows)) {
      const rkLower = rowKey.toLowerCase();
      if (isExcludedByVariant(rkLower)) continue;
      if (
        /matrix/i.test(rkLower) ||
        /imitation/i.test(rkLower) ||
        /nitai/i.test(rkLower) ||
        /_trait/i.test(rkLower) ||
        /_level[12]$/i.test(rkLower) ||
        /_lv[12]$/i.test(rkLower) ||
        /_dmgdown/i.test(rkLower) ||
        /_bedmgdown/i.test(rkLower) ||
        /_damdown/i.test(rkLower) ||
        /_damagereduction/i.test(rkLower) ||
        /_bedamagereduction/i.test(rkLower) ||
        /rogue/i.test(rkLower) ||
        /_breakfate/i.test(rkLower) ||
        /_pvp/i.test(rkLower) ||
        /_fashion/i.test(rkLower)
      ) {
        continue;
      }

      let matches = geIdentityPrefixes.some(pfx => rkLower.startsWith(pfx));
      if (!matches && weaponSkillList.length > 0) {
        matches = weaponSkillList.some(ga => rkLower.startsWith(ga.toLowerCase()));
      }

      if (!matches) continue;
      if (seenActionBases.has(rkLower)) continue;
      seenActionBases.add(rkLower);

      // Strict FText localization resolution
      const nameEnRes = locResolver.resolve(geRow.Name, { locale: 'en' });
      const descEnRes = locResolver.resolve(geRow.Desc, { locale: 'en' });
      const nameRuRes = locResolver.resolve(geRow.Name, { locale: 'ru', fallbackLocale: 'en' });
      const descRuRes = locResolver.resolve(geRow.Desc, { locale: 'ru', fallbackLocale: 'en' });

      let sNameEn = cleanHtmlTags(nameEnRes?.text);
      let sDescEn = cleanHtmlTags(descEnRes?.text);
      let sNameRu = cleanHtmlTags(nameRuRes?.text || sNameEn);
      let sDescRu = cleanHtmlTags(descRuRes?.text || sDescEn);

      // Where a referenced buff has no authentic description or only a placeholder, drop it completely
      if (!sDescEn || !sDescEn.trim() || /^Passive effect for /i.test(sDescEn)) {
        continue;
      }
      if (!sNameEn) {
        sNameEn = rowKey.replace(/^Buff_|^GE_Buff_|^GE_|^Actor_GE_Buff_/i, '').replace(/([A-Z])/g, ' $1').trim();
      }
      if (!sNameRu) {
        sNameRu = sNameEn;
      }
      if (!sDescRu) {
        sDescRu = sDescEn;
      }

      if (sNameEn.toLowerCase() === 'damage reduction' && /damage reduction/i.test(sDescEn)) {
        continue;
      }
      if (['passion', 'effort point'].includes(sNameEn.toLowerCase())) {
        continue;
      }

      // Discard dummy / placeholder / null passives or un-discovered entries
      const isNonePassiveName = /^none$/i.test(sNameEn) || /^нет$/i.test(sNameRu);
      const isNonePassiveId = /(?:^|_)(?:none|null|dummy)(?:$|_)/i.test(rowKey);
      if (isNonePassiveName || (isNonePassiveId && (!sDescEn || sDescEn === '—'))) {
        continue;
      }

      const category = 'Passive';

      // Resolve parameters from DescParam & EffectFigure
      const matchedTips = [];
      let anyOverseasWon = false;
      if (geRow.DescParam && Array.isArray(geRow.DescParam)) {
        geRow.DescParam.forEach((dp, idx) => {
          const ct = dp.Curve?.CurveTable?.ObjectName || dp.Curve?.CurveTable?.ObjectPath || '';
          const rn = dp.Curve?.RowName;
          if (typeof dp.Value === 'number' && (!rn || rn === 'None')) {
            matchedTips.push({
              key: `${rowKey}_param_${idx + 1}`,
              levels: { 1: dp.Value },
              source: 'DirectValue'
            });
            return;
          }
          const curveMeta: Record<string, any> = {};
          let rawVal = findCurveValue(efFileMap, ct, rn, curveMeta);
          if (rawVal === null || rawVal === undefined) {
            const curveRow = efRows?.[rn] || Object.entries(efRows || {}).find(([k]) => k.toLowerCase() === (rn || '').toLowerCase())?.[1];
            rawVal = curveRow?.Keys?.[0]?.Value !== undefined ? curveRow.Keys[0].Value : (curveRow?.DefaultValue !== undefined && curveRow.DefaultValue < 1e30 ? curveRow.DefaultValue : null);
          }
          if (rawVal !== null && rawVal !== undefined) {
            if (curveMeta.isOverseas) anyOverseasWon = true;
            const mult = typeof dp.Value === 'number' ? dp.Value : 1;
            const val = Math.round(rawVal * mult * 1000) / 1000;
            matchedTips.push({
              key: `${rowKey}_param_${idx + 1}`,
              levels: { 1: val },
              source: 'DescParam',
              curveTable: ct,
              rowName: rn,
              isOverseas: !!curveMeta.isOverseas
            });
          }
        });
      }

      totalEntities++;
      const charKeys = [effectKey, baseKeyLower, avatarId, wKey, slug].filter(Boolean);
      const resolvedSkillIcon = resolveExactSkillIcon({
        actionBase: rowKey,
        category,
        charKeys,
        geTipsRows,
        geTipsLower,
        gaTipsMap,
        gaTipsNormMap,
        imageCopier
      });

      if (resolvedSkillIcon.resolved) {
        exactFieldMatches++;
        imageManifest[resolvedSkillIcon.assetRef] = {
          full: resolvedSkillIcon.full,
          thumb: resolvedSkillIcon.thumb,
          strategy: resolvedSkillIcon.strategy
        };
      } else {
        unresolvedCount++;
      }

      let pct = null;
      if (matchedTips.length > 0) {
        const firstLevel = matchedTips[0].levels[1];
        if (typeof firstLevel === 'number') {
          pct = Math.round(firstLevel * 100) / 100;
        }
      }

      const descDisplayEn = formatSkillDescription(sDescEn, { id: rowKey, name_en: sNameEn, parameters: matchedTips }, efRows, geRow.DescParam);
      const descDisplayRu = formatSkillDescription(sDescRu, { id: rowKey, name_en: sNameRu || sNameEn, parameters: matchedTips }, efRows, geRow.DescParam);

      discoveredSkills.push({
        id: rowKey,
        name_en: sNameEn,
        name_ru: sNameRu,
        desc_en: cleanHtmlTags(sDescEn),
        desc_ru: cleanHtmlTags(sDescRu),
        desc_display_en: cleanHtmlTags(descDisplayEn),
        desc_display_ru: cleanHtmlTags(descDisplayRu),
        category,
        type: 'Passive',
        combo: null,
        type_tags: [],
        pct,
        icon: resolvedSkillIcon.resolved ? resolvedSkillIcon : null,
        icon_thumb: resolvedSkillIcon.resolved ? resolvedSkillIcon.thumb : null,
        parameters: matchedTips,
        provenance: {
          source: 'GameplayEffectTipsDataTable',
          tableId: geRow.Name?.TableId,
          nameKey: geRow.Name?.Key,
          descKey: geRow.Desc?.Key,
          strategy: nameEnRes?.strategy,
          tipsCount: matchedTips.length,
          overseasWon: /_oversea/i.test(geRow.Desc?.TableId || '') || /_os$/i.test(geRow.Desc?.Key || '') || anyOverseasWon
        }
      });
    }

    // Stable category sorting
    const categoryOrder = { Normal: 1, Dodge: 2, Skill: 3, Discharge: 4, Passive: 5, Other: 6 };
    discoveredSkills.sort((a, b) => {
      const orderDiff = (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
      if (orderDiff !== 0) return orderDiff;
      return a.id.localeCompare(b.id);
    });

    const skillsByCategory = {
      normal: discoveredSkills.filter(s => s.category === 'Normal'),
      dodge: discoveredSkills.filter(s => s.category === 'Dodge'),
      skill: discoveredSkills.filter(s => s.category === 'Skill'),
      discharge: discoveredSkills.filter(s => s.category === 'Discharge'),
      passive: discoveredSkills.filter(s => s.category === 'Passive'),
      other: discoveredSkills.filter(s => s.category === 'Other')
    };

    // Base Coefficients
    const coefficients: Record<string, any> = {};
    for (const [k, v] of Object.entries(efRows)) {
      if (k.toLowerCase().includes('coefficient') || k.toLowerCase().includes('cooldown') || k.toLowerCase().includes('damage')) {
        if (v?.Keys?.[0]?.Value !== undefined) {
          coefficients[k] = v.Keys[0].Value;
        }
      }
    }

    // Awakening Traits (1200 & 4000 affinity)
    let trait1Row = null;
    let trait2Row = null;

    const candidateTokens = new Set<any>();
    if (effectKey) candidateTokens.add(effectKey.toLowerCase());
    if (baseKeyLower) {
      candidateTokens.add(baseKeyLower);
      candidateTokens.add(baseKeyLower.replace(/(?:chess|rogue)$/i, ''));
    }
    if (avatarId) candidateTokens.add(avatarId.toLowerCase());
    if (wKey) {
      candidateTokens.add(wKey.toLowerCase());
      const b = wKey.split('_')[0].toLowerCase();
      candidateTokens.add(b);
      candidateTokens.add(b.replace(/(?:chess|rogue)$/i, ''));
    }
    if (slug) {
      candidateTokens.add(slug.toLowerCase());
      candidateTokens.add(slug.toLowerCase().replace(/-/g, ''));
    }
    if (cNameEn) {
      candidateTokens.add(cNameEn.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    for (const t of Array.from(candidateTokens)) {
      if (TRAIT_ALIASES[t]) candidateTokens.add(TRAIT_ALIASES[t]);
    }

    for (const token of candidateTokens) {
      const p1List = [
        `buff_imitation_${token}_level1`,
        `buff_imitation_${token}_lv1`,
        `buff_imitation_${token}1`,
        `buff_${token}_imitation_level1`,
        `buff_${token}_imitation_lv1`,
        `buff_${token}_imitation_1`,
        `buff_${token}_imitationlikelevel1`,
        `buff_${token}_imitationlike1`,
        `buff_${token}_level1`,
        `buff_${token}_lv1`,
        `buff_${token}1`
      ];
      const p2List = [
        `buff_imitation_${token}_level2`,
        `buff_imitation_${token}_lv2`,
        `buff_imitation_${token}2`,
        `buff_${token}_imitation_level2`,
        `buff_${token}_imitation_lv2`,
        `buff_${token}_imitation_2`,
        `buff_${token}_imitationlikelevel2`,
        `buff_${token}_imitationlike2`,
        `buff_${token}_level2`,
        `buff_${token}_lv2`,
        `buff_${token}2`
      ];

      for (const p of p1List) {
        if (!trait1Row && geTipsLower.has(p)) {
          trait1Row = geTipsLower.get(p);
          break;
        }
      }
      for (const p of p2List) {
        if (!trait2Row && geTipsLower.has(p)) {
          trait2Row = geTipsLower.get(p);
          break;
        }
      }
      if (trait1Row && trait2Row) break;
    }

    let trait1NameEn = trait1Row?.Name ? cleanHtmlTags(locResolver.resolve(trait1Row.Name, { locale: 'en' }).text) : '';
    let trait1NameRu = trait1Row?.Name ? cleanHtmlTags(locResolver.resolve(trait1Row.Name, { locale: 'ru', fallbackLocale: 'en' }).text) : '';
    let trait1DescEn = trait1Row?.Desc ? cleanHtmlTags(locResolver.resolve(trait1Row.Desc, { locale: 'en' }).text) : '';
    let trait1DescRu = trait1Row?.Desc ? cleanHtmlTags(locResolver.resolve(trait1Row.Desc, { locale: 'ru', fallbackLocale: 'en' }).text) : '';

    let trait2NameEn = trait2Row?.Name ? cleanHtmlTags(locResolver.resolve(trait2Row.Name, { locale: 'en' }).text) : '';
    let trait2NameRu = trait2Row?.Name ? cleanHtmlTags(locResolver.resolve(trait2Row.Name, { locale: 'ru', fallbackLocale: 'en' }).text) : '';
    let trait2DescEn = trait2Row?.Desc ? cleanHtmlTags(locResolver.resolve(trait2Row.Desc, { locale: 'en' }).text) : '';
    let trait2DescRu = trait2Row?.Desc ? cleanHtmlTags(locResolver.resolve(trait2Row.Desc, { locale: 'ru', fallbackLocale: 'en' }).text) : '';

    // Fallbacks if not in GameplayEffectTipsDataTable
    if (!trait1NameEn || !trait1DescEn || !trait2NameEn || !trait2DescEn) {
      for (const tok of candidateTokens) {
        const pTok = toPascalCase(tok);
        if (!trait1NameEn) {
          trait1NameEn = cleanHtmlTags(locResolver.resolve(`Imitation_${tok}_Level1_name`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || locResolver.resolve(`Imitation_${pTok}_Level1_name`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || '');
        }
        if (!trait1DescEn) {
          trait1DescEn = cleanHtmlTags(locResolver.resolve(`Imitation_${tok}_Level1_des_OS`, { locale: 'en', defaultNamespace: `${pTok}Des_Oversea` }).text || locResolver.resolve(`Imitation_${tok}_Level1_des`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || locResolver.resolve(`Imitation_${pTok}_Level1_des_OS`, { locale: 'en', defaultNamespace: `${pTok}Des_Oversea` }).text || locResolver.resolve(`Imitation_${pTok}_Level1_des`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || '');
        }
        if (!trait2NameEn) {
          trait2NameEn = cleanHtmlTags(locResolver.resolve(`Imitation_${tok}_Level2_name`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || locResolver.resolve(`Imitation_${pTok}_Level2_name`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || '');
        }
        if (!trait2DescEn) {
          trait2DescEn = cleanHtmlTags(locResolver.resolve(`Imitation_${tok}_Level2_des_OS`, { locale: 'en', defaultNamespace: `${pTok}Des_Oversea` }).text || locResolver.resolve(`Imitation_${tok}_Level2_des`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || locResolver.resolve(`Imitation_${pTok}_Level2_des_OS`, { locale: 'en', defaultNamespace: `${pTok}Des_Oversea` }).text || locResolver.resolve(`Imitation_${pTok}_Level2_des`, { locale: 'en', defaultNamespace: `${pTok}Des` }).text || '');
        }
        if (trait1NameEn && trait1DescEn && trait2NameEn && trait2DescEn) break;
      }
    }

    if (trait1DescEn) trait1DescEn = formatTraitDescription(trait1DescEn, trait1Row, efFileMap);
    if (trait1DescRu) trait1DescRu = formatTraitDescription(trait1DescRu, trait1Row, efFileMap);
    if (trait2DescEn) trait2DescEn = formatTraitDescription(trait2DescEn, trait2Row, efFileMap);
    if (trait2DescRu) trait2DescRu = formatTraitDescription(trait2DescRu, trait2Row, efFileMap);

    if (!trait1NameEn) trait1NameEn = `${cNameEn} Trait I`;
    if (!trait1NameRu) trait1NameRu = trait1NameEn;
    if (!trait2NameEn) trait2NameEn = `${cNameEn} Trait II`;
    if (!trait2NameRu) trait2NameRu = trait2NameEn;
    if (!trait1DescEn) {
      trait1DescEn = 'No awakening trait description available.';
      trait1DescRu = 'Описание черты пробуждения отсутствует.';
    }
    if (!trait2DescEn) {
      trait2DescEn = 'No awakening trait description available.';
      trait2DescRu = 'Описание черты пробуждения отсутствует.';
    }

    const trait1Match = trait1DescEn.match(/(\d+(?:\.\d+)?)%/);
    const trait1Val = trait1Match ? parseFloat(trait1Match[1]) : 14;
    const trait2Match = trait2DescEn.match(/(\d+(?:\.\d+)?)%/);
    const trait2Val = trait2Match ? parseFloat(trait2Match[1]) : 18;

    let affinityLadder = [];
    const likeRow = imitId ? likeRows[imitId] : null;
    if (likeRow && Array.isArray(likeRow.UpgradeLikeabilityArray)) {
      for (const step of likeRow.UpgradeLikeabilityArray) {
        if (step.LikeabilityType === 'ELikeabilityFunctionType::Attribute' && Array.isArray(step.Attributes)) {
          for (const attr of step.Attributes) {
            if (attr.ModifyId) {
              const mod = modifyRows[attr.ModifyId];
              let atk = 0;
              let hp = 0;
              if (mod && Array.isArray(mod.ModifyData)) {
                for (const md of mod.ModifyData) {
                  if (md.PropName === 'CommonAtkAdded') atk += md.PropValue;
                  if (md.PropName === 'MaxHealthAdded') hp += md.PropValue;
                }
              }
              affinityLadder.push({
                level_pts: step.Condition?.LikeabilityValue || 0,
                atk,
                hp
              });
            }
          }
        }
      }
    }

    const driver1 = extractTraitDriver(trait1DescEn, trait1DescRu, wNameEn, wNameRu);
    const driver2 = extractTraitDriver(trait2DescEn, trait2DescRu, wNameEn, wNameRu);

    const traits = [
      {
        affinity: 1200,
        name_en: trait1NameEn,
        name_ru: trait1NameRu,
        desc_en: trait1DescEn,
        desc_ru: trait1DescRu,
        value: trait1Val,
        ...(driver1 ? { driver_en: driver1.driver_en, driver_ru: driver1.driver_ru } : {}),
        ...(affinityLadder.length > 0 ? { affinity_ladder: affinityLadder } : {})
      },
      {
        affinity: 4000,
        name_en: trait2NameEn,
        name_ru: trait2NameRu,
        desc_en: trait2DescEn,
        desc_ru: trait2DescRu,
        value: trait2Val,
        ...(driver2 ? { driver_en: driver2.driver_en, driver_ru: driver2.driver_ru } : {}),
        ...(affinityLadder.length > 0 ? { affinity_ladder: affinityLadder } : {})
      }
    ];

    // Clean, dedupe, inject reaction passive, and sort passives
    const traitNamesSet = new Set<any>([trait1NameEn, trait2NameEn].map(n => (n || '').toLowerCase().trim()).filter(Boolean));
    const traitNamesRuSet = new Set<any>([trait1NameRu, trait2NameRu].map(n => (n || '').toLowerCase().trim()).filter(Boolean));

    let cleanPassives = (skillsByCategory.passive || []).filter(p => {
      const pNameLower = (p.name_en || '').toLowerCase().trim();
      const pNameRuLower = (p.name_ru || '').toLowerCase().trim();
      if (traitNamesSet.has(pNameLower) || traitNamesRuSet.has(pNameRuLower)) return false;
      const id = (p.id || '').toLowerCase();
      if (/_imitation/i.test(id) || /imitation_/i.test(id) || /imitationlike/i.test(id) || /_trait/i.test(id)) return false;
      if (/_level[12]$/i.test(id) || /_lv[12]$/i.test(id)) return false;
      if (/_dmgdown/i.test(id) || /_bedmgdown/i.test(id) || /_damdown/i.test(id) || /_damagereduction/i.test(id) || /_bedamagereduction/i.test(id) || /rogue/i.test(id) || /_breakfate/i.test(id) || /_pvp/i.test(id) || /_fashion/i.test(id)) return false;
      if (pNameLower === 'damage reduction' && /damage reduction/i.test(p.desc_en || '')) return false;
      if (!p.isOnField && !p.isFusion && !p.isReaction && (!p.desc_en || !p.desc_en.trim() || /^Passive effect for /i.test(p.desc_en))) return false;
      if (['passion', 'effort point'].includes(pNameLower)) return false;
      return true;
    });

    const dedupedPassivesMap = new Map<any, any>();
    for (const p of cleanPassives) {
      const key = (p.name_en || '').toLowerCase().trim();
      if (!dedupedPassivesMap.has(key)) {
        dedupedPassivesMap.set(key, p);
      } else {
        const existing = dedupedPassivesMap.get(key);
        const exDesc = existing.desc_en || '';
        const curDesc = p.desc_en || '';
        const curHasTeam = /team play/i.test(curDesc);
        const exHasTeam = /team play/i.test(exDesc);
        if (curHasTeam && !exHasTeam) dedupedPassivesMap.set(key, p);
        else if (curDesc.length > exDesc.length && !exHasTeam) dedupedPassivesMap.set(key, p);
      }
    }
    cleanPassives = Array.from(dedupedPassivesMap.values());

    let reactionKey = null;
    if (element && elementSecondary && element !== elementSecondary) {
      if ((element === 'Physical' && elementSecondary === 'Flame') || (element === 'Flame' && elementSecondary === 'Physical')) {
        reactionKey = `${element}+${elementSecondary}`;
      } else if ((element === 'Volt' && elementSecondary === 'Frost') || (element === 'Frost' && elementSecondary === 'Volt')) {
        reactionKey = `${element}+${elementSecondary}`;
      }
    }
    if (!reactionKey && element && REACTION_PASSIVES_DATA[element]) {
      reactionKey = element;
    }
    if (reactionKey && REACTION_PASSIVES_DATA[reactionKey]) {
      const r = REACTION_PASSIVES_DATA[reactionKey];
      const hasReaction = cleanPassives.some(p => (p.name_en || '').toLowerCase() === r.name_en.toLowerCase());
      if (!hasReaction) {
        const comboIcon = resolveElementComboIcon(element, elementSecondary);
        const singleIcon = resolveSingleElementIcon(element);
        const reactionIcon = comboIcon || singleIcon || null;
        cleanPassives.unshift({
          id: `reaction_${reactionKey.toLowerCase().replace('+', '_')}`,
          name_en: r.name_en,
          name_ru: r.name_ru,
          desc_en: r.desc_en,
          desc_ru: r.desc_ru,
          desc_display_en: r.desc_en,
          desc_display_ru: r.desc_ru,
          category: 'Passive',
          type: 'Passive',
          combo: null,
          type_tags: [],
          pct: null,
          icon: reactionIcon,
          icon_thumb: reactionIcon,
          parameters: [],
          isReaction: true,
          provenance: { source: 'QRSLCommon_ST', key: reactionKey }
        });
      }
    }

    // Dual-Element Fusion Passive
    if (element && elementSecondary && element !== elementSecondary) {
      let fusionData = null;
      let fusionPairKey = null;
      if ((element === 'Physical' && elementSecondary === 'Flame') || (element === 'Flame' && elementSecondary === 'Physical')) {
        fusionPairKey = 'physical_flame';
        fusionData = {
          name_en: 'Fusion of Mass and Flame',
          name_ru: 'Слияние Массы и Пламени',
          desc_en: 'The weapon is considered both Physical and Flame. Its damage calculation is influenced by base Physical & Flame ATK, Physical & Flame ATK percentage, and Physical & Flame damage boost, with the higher value taking precedence.',
          desc_ru: 'Оружие считается одновременно физическим и огненным. На расчет его урона влияют базовая физическая и огненная атака, процент физической и огненной атаки, а также бонус к физическому и огненному урону, при этом приоритет отдается большему значению.'
        };
      } else if ((element === 'Volt' && elementSecondary === 'Frost') || (element === 'Frost' && elementSecondary === 'Volt')) {
        fusionPairKey = 'frost_volt';
        fusionData = {
          name_en: 'Fusion of Frost and Volt',
          name_ru: 'Слияние мороза и вольта',
          desc_en: 'The weapon is considered both Volt and Frost. Its damage calculation is influenced by base Volt & Frost ATK, Volt & Frost ATK percentage, and Volt & Frost damage boost, with the higher value taking precedence.',
          desc_ru: 'Оружие считается одновременно электрическим и морозным. На расчет его урона влияют базовая электрическая и морозная атака, процент электрической и морозной атаки, а также бонус к электрическому и морозному урону, при этом приоритет отдается большему значению.'
        };
      }

      if (fusionData) {
        const hasFusion = cleanPassives.some(p => (p.name_en || '').toLowerCase().startsWith('fusion of'));
        if (!hasFusion) {
          const comboIcon = resolveElementComboIcon(element, elementSecondary);
          const fusionIcon = comboIcon ? {
            resolved: true,
            assetRef: comboIcon,
            full: comboIcon,
            thumb: comboIcon,
            strategy: 'element_combo_icon'
          } : {
            resolved: false,
            placeholder: true,
            placeholderType: 'Passive',
            strategy: 'unresolved_typed_placeholder',
            diagnostic: 'Dual-element fusion passive'
          };
          cleanPassives.unshift({
            id: `fusion_${fusionPairKey}`,
            name_en: fusionData.name_en,
            name_ru: fusionData.name_ru,
            desc_en: fusionData.desc_en,
            desc_ru: fusionData.desc_ru,
            desc_display_en: fusionData.desc_en,
            desc_display_ru: fusionData.desc_ru,
            category: 'Passive',
            type: 'Passive',
            combo: null,
            type_tags: [],
            pct: null,
            icon: fusionIcon,
            icon_thumb: fusionIcon.resolved ? fusionIcon.thumb : null,
            parameters: [],
            isFusion: true,
            provenance: { source: 'DualElementFusion', pair: fusionPairKey }
          });
        }
      }

      // Dual-Element On-Field Passive
      const onFieldPassive = resolveDualOnFieldPassive(slug, wKey, wNameEn, wNameRu, element, elementSecondary, en, ru, efFileMap);
      if (onFieldPassive) {
        const hasOnField = cleanPassives.some(p => p.isOnField || (p.name_en || '').toLowerCase().includes(': on-field'));
        if (!hasOnField) {
          cleanPassives.unshift(onFieldPassive);
        }
      }
    }

    function getPassiveRank(p) {
      const n = (p.name_en || '').toLowerCase().trim();
      const nRu = (p.name_ru || '').toLowerCase().trim();
      if (p.isReaction || ['grievous', 'ice shell', 'flame', 'volt', 'armor dissolve', 'force impact', 'altered', 'superpower'].includes(n) || ['аберрация', 'искажение'].includes(nRu)) return 10;
      if (p.isFusion || n.startsWith('fusion of')) return 20;
      if (p.isOnField || n.includes(': on-field')) return 25;
      if (n.includes('resonance')) return 30;
      if (n.includes('fortitude') || n.includes('benediction') || n.includes('balance') || n.includes('attack resonance')) return 40;
      return 50;
    }
    cleanPassives.sort((a, b) => getPassiveRank(a) - getPassiveRank(b));
    localizeCuratedPassives(cleanPassives, en, ru, hasGameLocalizationSource());
    skillsByCategory.passive = cleanPassives;

    // Deduplicate active skills within each category by normalized name, keeping highest quality
    for (const cat of ['normal', 'dodge', 'skill', 'discharge']) {
      const catSkills = skillsByCategory[cat] || [];
      const dedupMap = new Map<any, any>();
      for (const s of catSkills) {
        const key = (s.name_en || '').toLowerCase().trim();
        if (!key) continue;
        if (!dedupMap.has(key)) {
          dedupMap.set(key, s);
        } else {
          const ex = dedupMap.get(key);
          const exScore = (ex.desc_en?.length || 0) + (ex.parameters?.length || 0) * 20 + (ex.icon?.resolved ? 50 : 0);
          const curScore = (s.desc_en?.length || 0) + (s.parameters?.length || 0) * 20 + (s.icon?.resolved ? 50 : 0);
          if (curScore > exScore) {
            dedupMap.set(key, s);
          }
        }
      }
      skillsByCategory[cat] = Array.from(dedupMap.values());
    }

    discoveredSkills = [
      ...(skillsByCategory.normal || []),
      ...(skillsByCategory.dodge || []),
      ...(skillsByCategory.skill || []),
      ...(skillsByCategory.discharge || []),
      ...(skillsByCategory.passive || []),
      ...(skillsByCategory.other || [])
    ];

    for (const s of discoveredSkills) {
      if (s.category !== 'Passive') {
        const idLower = (s.id || '').toLowerCase();
        const nameLower = (s.name_en || '').toLowerCase().trim();
        claimedActiveSkills.set(idLower, slug);
        if (nameLower) claimedActiveSkills.set(nameLower, slug);
      }
    }

    // Character and Weapon Artwork resolution
    totalEntities += 5;

    const rawAvatarRef = imitRow?.Painting?.AssetPathName || wRow.LotteryDrawing?.AssetPathName || wRow.LotteryCardImage?.AssetPathName || '';
    const rawCardRef = imitRow?.AwakenPhoto?.AssetPathName || wRow.LotteryCardImage?.AssetPathName || wRow.LotteryDrawing?.AssetPathName || '';
    const rawWeaponIconRef = wRow.ItemLargeIcon?.AssetPathName || wRow.WeaponIconForMatrix?.AssetPathName || wRow.Icon?.AssetPathName || '';

    // Portrait / detail art resolution (fuller nitai/xiangqing art)
    const imitNumMatch = imitId ? String(imitId).match(/\d+/) : null;
    const imitNum = imitNumMatch ? imitNumMatch[0] : null;

    const portraitCandidates = [];
    if (imitRow?.TitlePicture?.AssetPathName && /xiangqing\/imitation/i.test(imitRow.TitlePicture.AssetPathName)) {
      portraitCandidates.push(imitRow.TitlePicture.AssetPathName);
    }
    if (imitNum) {
      portraitCandidates.push(`/Game/Resources/UI/shizhuang/nitai/xiangqing/imitation_${imitNum}.imitation_${imitNum}`);
    }
    if (imitId) {
      portraitCandidates.push(`/Game/Resources/UI/shizhuang/nitai/xiangqing/${imitId}.${imitId}`);
    }
    if (imitRow?.Name2Picture?.AssetPathName && /xiangqing/i.test(imitRow.Name2Picture.AssetPathName)) {
      portraitCandidates.push(imitRow.Name2Picture.AssetPathName);
    }

    let resolvedPortrait = null;
    let rawPortraitRef = '';
    for (const cand of portraitCandidates) {
      resolvedPortrait = imageCopier.copyAsset('simulacra', cand, 'portraits', { structured: true });
      if (resolvedPortrait) {
        rawPortraitRef = cand;
        break;
      }
    }

    if (resolvedPortrait) {
      exactFieldMatches++;
      imageManifest[rawPortraitRef] = { full: resolvedPortrait.full, thumb: resolvedPortrait.thumb, strategy: resolvedPortrait.matchStrategy || 'exact_game_path' };
    } else {
      unresolvedCount++;
    }

    const resolvedAvatar = rawAvatarRef ? imageCopier.copyAsset('simulacra', rawAvatarRef, 'avatars', { structured: true }) : null;
    if (resolvedAvatar) {
      exactFieldMatches++;
      imageManifest[rawAvatarRef] = { full: resolvedAvatar.full, thumb: resolvedAvatar.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const resolvedCard = rawCardRef ? imageCopier.copyAsset('simulacra', rawCardRef, 'cards', { structured: true }) : null;
    if (rawCardRef) cardExpected++;
    if (resolvedCard) {
      exactFieldMatches++;
      cardResolved++;
      imageManifest[rawCardRef] = { full: resolvedCard.full, thumb: resolvedCard.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const resolvedWeaponIcon = rawWeaponIconRef ? imageCopier.copyAsset('simulacra', rawWeaponIconRef, 'weapons', { structured: true }) : null;
    if (resolvedWeaponIcon) {
      exactFieldMatches++;
      imageManifest[rawWeaponIconRef] = { full: resolvedWeaponIcon.full, thumb: resolvedWeaponIcon.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const resolvedMatrixIcon = rawMatrixIconRef ? imageCopier.copyAsset('simulacra', rawMatrixIconRef, 'matrices', { structured: true }) : null;
    if (resolvedMatrixIcon) {
      exactFieldMatches++;
      imageManifest[rawMatrixIconRef] = { full: resolvedMatrixIcon.full, thumb: resolvedMatrixIcon.thumb, strategy: 'exact_config_field' };
    } else {
      unresolvedCount++;
    }

    const finalPortrait = resolvedPortrait?.full || resolvedCard?.full || resolvedAvatar?.full || null;
    const finalPortraitThumb = resolvedPortrait?.thumb || resolvedCard?.thumb || resolvedAvatar?.thumb || null;

    const media = {
      portrait: {
        assetRef: rawPortraitRef || (resolvedCard ? (rawCardRef || 'fallback_card') : (rawAvatarRef || 'fallback_avatar')),
        rawExportPath: resolvedPortrait?.sourcePng || resolvedCard?.sourcePng || resolvedAvatar?.sourcePng || '',
        fullUrl: finalPortrait,
        thumbUrl: finalPortraitThumb,
        strategy: resolvedPortrait ? (resolvedPortrait.matchStrategy || 'exact_game_path') : (resolvedCard ? 'fallback_card' : 'fallback_avatar'),
        joinIdentity: imitId || wKey
      },
      avatar: {
        assetRef: rawAvatarRef || 'None',
        rawExportPath: resolvedAvatar?.sourcePng || '',
        fullUrl: resolvedAvatar?.full || null,
        thumbUrl: resolvedAvatar?.thumb || null,
        strategy: resolvedAvatar ? 'exact_config_field' : 'unresolved',
        joinIdentity: wKey
      },
      card: {
        assetRef: rawCardRef || 'None',
        rawExportPath: resolvedCard?.sourcePng || '',
        fullUrl: resolvedCard?.full || null,
        thumbUrl: resolvedCard?.thumb || null,
        strategy: resolvedCard ? 'exact_config_field' : 'unresolved',
        joinIdentity: wKey
      },
      weapon_icon: {
        assetRef: rawWeaponIconRef || 'None',
        rawExportPath: resolvedWeaponIcon?.sourcePng || '',
        fullUrl: resolvedWeaponIcon?.full || null,
        thumbUrl: resolvedWeaponIcon?.thumb || null,
        strategy: resolvedWeaponIcon ? 'exact_config_field' : 'unresolved',
        joinIdentity: wKey
      },
      matrix_icon: {
        assetRef: rawMatrixIconRef || 'None',
        rawExportPath: resolvedMatrixIcon?.sourcePng || '',
        fullUrl: resolvedMatrixIcon?.full || null,
        thumbUrl: resolvedMatrixIcon?.thumb || null,
        strategy: resolvedMatrixIcon ? 'exact_config_field' : 'unresolved',
        joinIdentity: suitId || wKey
      }
    };

    // Full profile object
    const elementComboIcon = resolveElementComboIcon(element, elementSecondary);
    const roleIcon = resolveRoleIcon(role);

    const profile: Record<string, any> = {
      id: slug,
      avatar_id: avatarId,
      imitation_id: imitId,
      name_en: cNameEn,
      name_ru: cNameRu,
      element,
      element_secondary: elementSecondary,
      element_combo_icon: elementComboIcon,
      role,
      role_icon: roleIcon,
      resonance: role,
      rarity: wRow.ItemRarity === 'EItemRarity::ITEM_RARITY_SSR' ? 'SSR' : 'SR',
      edition: 'gacha',
      avatar: resolvedAvatar?.full || null,
      avatar_thumb: resolvedAvatar?.thumb || null,
      portrait: finalPortrait,
      portrait_thumb: finalPortraitThumb,
      detail_art: finalPortrait,
      detail_art_thumb: finalPortraitThumb,
      card: resolvedCard?.full || null,
      card_thumb: resolvedCard?.thumb || null,
      art_focus: ART_FOCAL_MAP[slug] || null,
      icon: resolvedWeaponIcon?.full || null,
      icon_thumb: resolvedWeaponIcon?.thumb || null,
      assets: (() => {
        const baseSlug = (slug || avatarId || '').toLowerCase();
        const manifestCandidates = [
          path.join(outDir, `${baseSlug}-assets.json`),
          path.join(projectRoot, 'info', 'simulacra', 'data', `${baseSlug}-assets.json`),
        ];
        for (const cand of manifestCandidates) {
          if (fs.existsSync(cand)) {
            try {
              return JSON.parse(readGameSourceFileSync(cand, 'utf8'));
            } catch (_) {}
          }
        }
        return [];
      })(),
      base_stats: {
        ...baseStats,
        max_level: 200,
        max_stats: maxStats
      },
      max_stats: maxStats,
      advancements,
      matrix,
      weapon: {
        id: wKey,
        name_en: wNameEn,
        name_ru: wNameRu,
        element,
        element_secondary: elementSecondary,
        element_combo_icon: elementComboIcon,
        role,
        role_icon: roleIcon,
        resonance: role,
        icon: resolvedWeaponIcon?.full || null,
        icon_thumb: resolvedWeaponIcon?.thumb || null,
        skills: discoveredSkills,
        skillsByCategory
      },
      coefficients,
      traits,
      ...(affinityLadder.length > 0 ? { affinity_ladder: affinityLadder } : {}),
      media,
      sources: {
        identifiers: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/DT_Imitation',
            label_en: 'Imitation & Avatar identities (DT_Imitation)',
            label_ru: 'Связь симулякра и аватара (DT_Imitation)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/StaticWeaponDataTable',
            label_en: 'Base Weapon Table (StaticWeaponDataTable)',
            label_ru: 'Базовая таблица оружия (StaticWeaponDataTable)'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticWeaponDataTable_Overseas',
            label_en: 'Overseas Weapon Overrides (StaticWeaponDataTable_Overseas)',
            label_ru: 'Глобальные переопределения оружия (StaticWeaponDataTable_Overseas)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/WeaponMatrix/StaticMatrixSuitDataTable',
            label_en: 'Base Matrix Suit Table (StaticMatrixSuitDataTable)',
            label_ru: 'Базовая таблица комплектов матриц (StaticMatrixSuitDataTable)'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticMatrixSuitDataTable_Overseas',
            label_en: 'Overseas Matrix Suit Overrides (StaticMatrixSuitDataTable_Overseas)',
            label_ru: 'Глобальные переопределения матриц (StaticMatrixSuitDataTable_Overseas)'
          }
        ],
        base_stats: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/StaticWeaponDataTable',
            label_en: 'Base Weapon Stats: Attack, HP, Crit, Shatter, Charge',
            label_ru: 'Базовые параметры оружия: атака, ОЗ, крит, раскол, заряд'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticWeaponDataTable_Overseas',
            label_en: 'Overseas Weapon Stat Overrides',
            label_ru: 'Глобальные переопределения параметров оружия'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/DT_WeaponUpgrade_Overseas',
            label_en: 'Weapon Upgrade Level Progression (DT_WeaponUpgrade_Overseas)',
            label_ru: 'Прогрессия уровней оружия (DT_WeaponUpgrade_Overseas)'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipStrengthenEffectPackDataTable_Overseas',
            label_en: 'Weapon Stat Scaling Curves (EquipStrengthenEffectPackDataTable_Overseas)',
            label_ru: 'Кривые роста параметров оружия (EquipStrengthenEffectPackDataTable_Overseas)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponUpgradeStarData',
            label_en: 'Weapon Upgrade & Level Growth Curves',
            label_ru: 'Параметры улучшения и кривые роста уровней оружия'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/WeaponUpgradeStarData_Overseas',
            label_en: 'Overseas Weapon Upgrade Progression',
            label_ru: 'Глобальная прогрессия улучшений оружия'
          }
        ],
        matrix: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponData/WeaponMatrix/StaticMatrixSuitDataTable',
            label_en: 'Matrix Suit Configuration & Piece Data',
            label_ru: 'Конфигурация комплекта матриц и данные слотов'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticMatrixSuitDataTable_Overseas',
            label_en: 'Overseas Matrix Suit Overrides',
            label_ru: 'Глобальные переопределения комплектов матриц'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable',
            label_en: 'Base Matrix Set Buff Formulas & Descriptions',
            label_ru: 'Базовые формулы баффов и описания наборов'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Skill/GameplayEffectTipsDataTable_Overseas',
            label_en: 'Overseas Matrix Set Buff Values & Multipliers',
            label_ru: 'Глобальные множители и значения эффектов наборов'
          },
          {
            path: 'info/matrices/data/matrices',
            label_en: 'Canonical Matrix Catalog & Star Tier Scalings',
            label_ru: 'Каноничный каталог матриц и прогрессия звезд'
          }
        ],
        traits: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/DT_Imitation',
            label_en: 'Simulacrum Awakening Trait Linkage',
            label_ru: 'Связь черт пробуждения с симулякром'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Fashion/ImitationLikeabilityDataTable',
            label_en: 'Base Trait Likeability, Points & Drivers',
            label_ru: 'Базовая таблица доверия, порогов очков и триггеров'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Fashion/ImitationLikeabilityDataTable_Overseas',
            label_en: 'Overseas Trait Passives & Stat Ladder Overrides',
            label_ru: 'Глобальные пассивки черт и лестница прибавок характеристик'
          },
          {
            path: 'Hotta/Content/Localization/Game/en/Game',
            label_en: 'English Localized Trait Names & Descriptions',
            label_ru: 'Английские локализованные названия и описания'
          },
          {
            path: 'Hotta/Content/Localization/Game/ru/Game',
            label_en: 'Russian Localized Trait Names & Descriptions',
            label_ru: 'Русские локализованные названия и описания'
          }
        ],
        coefficients: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/ModifyDataTable',
            label_en: 'Base Damage Calculation Formulas & Formula Keys',
            label_ru: 'Базовые формулы расчета урона и формульные ключи'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/ModifyDataTable_Overseas',
            label_en: 'Overseas Damage Formula Overrides',
            label_ru: 'Глобальные переопределения формульных коэффициентов'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/StaticWeaponDataTable',
            label_en: 'Weapon Formula Mapping & Default Modifiers',
            label_ru: 'Привязка формул к оружию и дефолтные модификаторы'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/StaticWeaponDataTable_Overseas',
            label_en: 'Overseas Weapon Formula Mapping',
            label_ru: 'Глобальная привязка формул к оружию'
          }
        ],
        advancements: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/WeaponUpgradeStarData',
            label_en: 'Base 1★–6★ Advancements (RemouldDetail & Params)',
            label_ru: 'Базовые улучшения 1★–6★ (RemouldDetail и параметры)'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/WeaponUpgradeStarData_Overseas',
            label_en: 'Overseas 1★–6★ Advancement Overrides & Multi-Element Remould',
            label_ru: 'Глобальные переопределения 1★–6★ и мульти-элементный ремоулдинг'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable',
            label_en: 'Base Advancement Gameplay Effect Buff Keys',
            label_ru: 'Базовые ключи баффов эффектов пробуждения'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Skill/GameplayEffectTipsDataTable_Overseas',
            label_en: 'Overseas Advancement Gameplay Effect Buff Values',
            label_ru: 'Глобальные числовые значения баффов эффектов пробуждения'
          }
        ],
        curves: [
          {
            path: `Hotta/Content/Resources/CoreBlueprints/DataTable/Curve/EffectFigure/EffectFigure_${effectKey}`,
            label_en: `Base Skill Curve & Progression Data (EffectFigure_${effectKey})`,
            label_ru: `Базовые кривые прогрессии параметров навыков (EffectFigure_${effectKey})`
          },
          {
            path: `Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Curve/EffectFigure/EffectFigure_${effectKey}_Overseas`,
            label_en: `Overseas Skill Curve Balancing (EffectFigure_${effectKey}_Overseas)`,
            label_ru: `Глобальная балансировка кривых навыков (EffectFigure_${effectKey}_Overseas)`
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips',
            label_en: 'Base Skill Progression Level Steps & Curves',
            label_ru: 'Базовые шаги уровней и кривые прогрессии навыков'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Weapon/SkillUpdateTips_Overseas',
            label_en: 'Overseas Skill Progression Steps Overrides',
            label_ru: 'Глобальные переопределения шагов прогрессии навыков'
          }
        ],
        skills: [
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/WeaponSkillList',
            label_en: 'Base Active Skills & GameplayActions (WeaponSkillList)',
            label_ru: 'Базовые активные навыки и действия оружия (WeaponSkillList)'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Skill/WeaponSkillList_Overseas',
            label_en: 'Overseas Active Skills & Combos (WeaponSkillList_Overseas)',
            label_ru: 'Глобальные активные навыки и комбинации (WeaponSkillList_Overseas)'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable',
            label_en: 'Base Passives, Discharges & Resonance Definitions',
            label_ru: 'Базовые пассивки, разрядки и резонансы стихий'
          },
          {
            path: 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Skill/GameplayEffectTipsDataTable_Overseas',
            label_en: 'Overseas Passives, Elemental Reactions & Resonance Overrides',
            label_ru: 'Глобальные пассивки, реакции стихий и резонансы'
          },
          {
            path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/SkillUpdateTips',
            label_en: 'Skill Description Values & Parameter Bindings',
            label_ru: 'Параметры и значения описаний навыков'
          },
          {
            path: 'Hotta/Content/Localization/Game/en/Game',
            label_en: `English Localized Skill Names (${effectKey}Des, QRSLCommon_ST, WeaponDes)`,
            label_ru: `Английские названия навыков (${effectKey}Des, QRSLCommon_ST, WeaponDes)`
          },
          {
            path: 'Hotta/Content/Localization/Game/ru/Game',
            label_en: `Russian Localized Skill Names (${effectKey}Des, QRSLCommon_ST, WeaponDes)`,
            label_ru: `Русские названия навыков (${effectKey}Des, QRSLCommon_ST, WeaponDes)`
          }
        ]
      },
      provenance: {
        weaponKey: wKey,
        imitationId: imitId,
        avatarId,
        skillCount: discoveredSkills.length,
        accountedTipsCount: accountedTips.size
      }
    };

    const matrixSuitId = profile.matrix?.suit_id || null;
    const matrixSuitNum = matrixSuitId ? (parseInt(matrixSuitId.replace(/\D+/g, ''), 10) || null) : null;

    profile.server_mode = 'gacha';
    profile.edition = 'gacha';
    profile.season = null;
    profile.season_tag = null;
    profile.season_badge = null;
    profile.has_matrices = !!matrixSuitId;
    profile.no_matrices = !matrixSuitId;

    // Embed asset manifests into gacha profile before writing to disk
    const baseSlug = (profile.canonical_id || profile.slug || slug || '').toLowerCase();
    if (!profile.assets || !Array.isArray(profile.assets) || profile.assets.length === 0) {
      const manifestCandidates = [
        path.join(outDir, `${baseSlug}-assets.json`),
        path.join(projectRoot, 'info', 'simulacra', 'data', `${baseSlug}-assets.json`),
      ];
      for (const cand of manifestCandidates) {
        if (fs.existsSync(cand)) {
          try {
            profile.assets = JSON.parse(readGameSourceFileSync(cand, 'utf8'));
            break;
          } catch (_) {}
        }
      }
    }
    if (!profile.assets) {
      profile.assets = [];
    }

    gachaProfiles.push(profile);
    gachaProfilesMap.set(slug.toLowerCase(), profile);
    if (avatarId) gachaProfilesMap.set(avatarId.toLowerCase(), profile);
    if (wKey) gachaProfilesMap.set(wKey.toLowerCase(), profile);

    if (process.env.SIMULACRA_UNIFIED_ONLY !== 'true') {
      for (const dir of targetDirs) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(profile, null, 2), 'utf8');
        if (avatarId && avatarId.toLowerCase() !== slug.toLowerCase()) {
          fs.writeFileSync(path.join(dir, `${avatarId.toLowerCase()}.json`), JSON.stringify(profile, null, 2), 'utf8');
        }
      }
    }

    characterIndex.push({
      id: slug,
      avatar_id: avatarId,
      imitation_id: imitId,
      weapon_id: wKey,
      matrix_suit_id: matrixSuitId,
      matrix_suit_num: matrixSuitNum,
      name_en: cNameEn,
      name_ru: cNameRu,
      weapon_name_en: wNameEn,
      weapon_name_ru: wNameRu,
      element,
      element_secondary: elementSecondary,
      element_combo_icon: elementComboIcon,
      role,
      role_icon: roleIcon,
      resonance: role,
      rarity: profile.rarity,
      server_mode: 'gacha',
      edition: 'gacha',
      has_matrices: !!matrixSuitId,
      no_matrices: !matrixSuitId,
      season: null,
      season_tag: null,
      season_badge: null,
      avatar: profile.avatar,
      avatar_thumb: profile.avatar_thumb,
      portrait: profile.portrait,
      portrait_thumb: profile.portrait_thumb,
      detail_art: profile.detail_art,
      detail_art_thumb: profile.detail_art_thumb,
      card: profile.card,
      card_thumb: profile.card_thumb,
      art_focus: profile.art_focus || null,
      icon: profile.icon,
      icon_thumb: profile.icon_thumb
    });
  }

  // Card-art export-coverage gate (see counter declarations above).
  if (!targetSlug) {
    const cardCoveragePct = cardExpected > 0 ? (cardResolved / cardExpected * 100) : 0;
    console.log(`[build-simulacra] Card art (UI/huanxing/lihui): ${cardResolved}/${cardExpected} references resolved (${cardCoveragePct.toFixed(1)}%).`);
    if (cardExpected >= 20 && cardResolved === 0) {
      throw new Error(
        `CARD-ART EXPORT MISSING: ${cardExpected} characters reference AwakenPhoto card art but 0 resolved. ` +
        `The UI/huanxing/lihui image group was not exported. Ensure the rule ` +
        `"Hotta/Content/Resources/UI/huanxing/lihui/.*\\.uasset:png" is in export-datamine-config.json and re-run RUN_EXPORT_FULL (or RUN_EXPORT_PIC), ` +
        `then unpack into raw_exports and RUN_PROCESS again.`
      );
    }
    if (cardExpected >= 20 && cardCoveragePct < 50) {
      console.warn(`[build-simulacra] WARNING: card-art coverage is only ${cardCoveragePct.toFixed(1)}% (${cardResolved}/${cardExpected}). The huanxing/lihui export may be partial.`);
    }
  }

  // Write media registry for cross-linking
  const mediaRegistry: Record<string, any> = {};
  for (const c of characterIndex) {
    const entry = {
      id: c.id,
      name_en: c.name_en,
      name_ru: c.name_ru,
      avatar: c.avatar,
      avatar_thumb: c.avatar_thumb,
      portrait: c.portrait,
      portrait_thumb: c.portrait_thumb,
      detail_art: c.detail_art,
      detail_art_thumb: c.detail_art_thumb,
      card: c.card,
      card_thumb: c.card_thumb,
      icon: c.icon,
      icon_thumb: c.icon_thumb,
      weapon_id: c.weapon_id
    };
    mediaRegistry[c.id] = entry;
    if (c.avatar_id) {
      mediaRegistry[c.avatar_id] = entry;
      mediaRegistry[c.avatar_id.toLowerCase()] = entry;
    }
    if (c.weapon_id) {
      mediaRegistry[c.weapon_id] = entry;
      mediaRegistry[c.weapon_id.toLowerCase()] = entry;
    }
    if (c.name_en) {
      mediaRegistry[c.name_en] = entry;
      mediaRegistry[c.name_en.toLowerCase()] = entry;
    }
  }

  // Register known canonical aliases for multype characters
  const aliasPairs = [
    ['zeke', 'ming-jing'],
    ['Zeke', 'ming-jing'],
    ['Ace', 'anka'],
    ['ace', 'anka'],
    ['Antoria', 'antoria'],
    ['antoria', 'antoria'],
    ['Loslyn', 'roslyn'],
    ['loslyn', 'roslyn'],
    ['NanYin', 'nan-yin'],
    ['nanyin', 'nan-yin'],
    ['Fenrir', 'fenrir'],
    ['fenrir', 'fenrir']
  ];
  for (const [alias, targetId] of aliasPairs) {
    if (mediaRegistry[targetId]) {
      mediaRegistry[alias] = mediaRegistry[targetId];
    }
  }

  // Write master index, media registry, manifest, and report
  if (process.env.SIMULACRA_UNIFIED_ONLY !== 'true') {
    for (const dir of targetDirs) {
      fs.mkdirSync(dir, { recursive: true });
      if (targetSlug) {
        const idxPath = path.join(dir, 'simulacra-index.json');
        let existingIndex = [];
        if (fs.existsSync(idxPath)) {
          try { existingIndex = JSON.parse(readGameSourceFileSync(idxPath, 'utf8')); } catch (e) {}
        }
        for (const newChar of characterIndex) {
          const foundIdx = existingIndex.findIndex(c => c.id === newChar.id || c.avatar_id === newChar.avatar_id || c.weapon_id === newChar.weapon_id);
          if (foundIdx !== -1) {
            existingIndex[foundIdx] = newChar;
          } else {
            existingIndex.push(newChar);
          }
        }
        fs.writeFileSync(idxPath, JSON.stringify(existingIndex, null, 2), 'utf8');

        const regPath = path.join(dir, 'simulacra-media-registry.json');
        let existingReg: Record<string, any> = {};
        if (fs.existsSync(regPath)) {
          try { existingReg = JSON.parse(readGameSourceFileSync(regPath, 'utf8')); } catch (e) {}
        }
        Object.assign(existingReg, mediaRegistry);
        fs.writeFileSync(regPath, JSON.stringify(existingReg, null, 2), 'utf8');

        const manPath = path.join(dir, 'simulacra-image-manifest.json');
        let existingMan = { stats: {}, images: {} };
        if (fs.existsSync(manPath)) {
          try { existingMan = JSON.parse(readGameSourceFileSync(manPath, 'utf8')); } catch (e) {}
        }
        existingMan.images = Object.assign(existingMan.images || {}, imageManifest);
        fs.writeFileSync(manPath, JSON.stringify(existingMan, null, 2), 'utf8');
      } else {
        fs.writeFileSync(path.join(dir, 'simulacra-index.json'), JSON.stringify(characterIndex, null, 2), 'utf8');
        fs.writeFileSync(path.join(dir, 'simulacra-media-registry.json'), JSON.stringify(mediaRegistry, null, 2), 'utf8');
        fs.writeFileSync(path.join(dir, 'simulacra-image-manifest.json'), JSON.stringify({
          stats: {
            totalEntities,
            exactFieldMatches,
            namingMatches,
            unresolvedCount,
            coveragePct: totalEntities > 0 ? ((exactFieldMatches + namingMatches) / totalEntities * 100).toFixed(1) : 0
          },
          images: imageManifest
        }, null, 2), 'utf8');
      }
      const precedenceReport = {
        generatedAt: new Date().toISOString(),
        totalCharacters: characterIndex.length,
        roleDistribution: roleStats,
        localizationStats: locResolver.getStats(),
        tableMergeStats: {
          weapon: weaponMerge.stat,
          matrixSuit: matrixMerge.stat,
          skillTips: skillMerge.stat,
          gameplayEffectTips: geTipsMerge.stat
        }
      };
      fs.writeFileSync(path.join(dir, 'simulacra-precedence-report.json'), JSON.stringify(precedenceReport, null, 2), 'utf8');

      fs.writeFileSync(path.join(dir, 'simulacra-image-report.json'), JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalCharacters: characterIndex.length,
        totalEntities,
        exactFieldMatches,
        namingMatches,
        unresolvedCount
      }, null, 2), 'utf8');
    }
    // Visual assets are the separate build-simulacra-assets job (contracts/jobs.json).
  }

  // Extract authentic MMO Simulacra & weapons dataset
  let mmoProfiles = [];
  try {
    mmoProfiles = extractMMOSimulacra({
      projectRoot,
      rawDir,
      archiveReader,
      locResolver,
      efFileMap,
      gachaProfilesMap,
      en,
      ru,
      enNsLower,
      globalLowerEn
    });
    console.log(`[build-simulacra] Extracted ${mmoProfiles.length} MMO simulacra profiles.`);
  } catch (mmoErr) {
    console.error('[build-simulacra] Error extracting MMO simulacra:', mmoErr);
    mmoProfiles = [];
  }

  const allProfiles = [...gachaProfiles, ...mmoProfiles];
  for (const p of allProfiles) {
    const baseSlug = (p.canonical_id || p.slug || p.id.replace(/-mmo$/, '')).toLowerCase();
    const manifestCandidates = [
      path.join(outDir, `${baseSlug}-assets.json`),
      path.join(projectRoot, 'info', 'simulacra', 'data', `${baseSlug}-assets.json`),
    ];
    for (const cand of manifestCandidates) {
      if (fs.existsSync(cand)) {
        try {
          p.assets = JSON.parse(readGameSourceFileSync(cand, 'utf8'));
          break;
        } catch (_) {}
      }
    }
  }

  // Refresh individual gacha files to ensure disk exports include any visual assets generated during pipeline execution
  if (process.env.SIMULACRA_UNIFIED_ONLY !== 'true') {
    for (const dir of targetDirs) {
      for (const gacha of gachaProfiles) {
        if (targetSlug && gacha.slug?.toLowerCase() !== targetSlug && gacha.id?.toLowerCase() !== targetSlug) {
          continue;
        }
        if (gacha.assets && Array.isArray(gacha.assets) && gacha.assets.length > 0) {
          fs.writeFileSync(path.join(dir, `${gacha.id}.json`), JSON.stringify(gacha, null, 2), 'utf8');
          if (gacha.avatar_id && gacha.avatar_id.toLowerCase() !== gacha.id.toLowerCase()) {
            fs.writeFileSync(path.join(dir, `${gacha.avatar_id.toLowerCase()}.json`), JSON.stringify(gacha, null, 2), 'utf8');
          }
        }
      }
    }
  }

  const simulacraOutput = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: allProfiles.length,
    counts: {
      total: allProfiles.length,
      gacha: gachaProfiles.length,
      mmo: mmoProfiles.length,
      ssr: allProfiles.filter(i => (i.rarity || '').includes('SSR')).length,
      sr: allProfiles.filter(i => (i.rarity || '').includes('SR')).length
    },
    items: allProfiles,
    simulacra: allProfiles,
    modes: {
      gacha: gachaProfiles,
      mmo: mmoProfiles
    }
  };

  const simulacraMirrorDirs = [path.join(projectRoot, 'info', 'simulacra', 'data')];

  for (const sDir of simulacraMirrorDirs) {
    fs.mkdirSync(sDir, { recursive: true });
    fs.writeFileSync(path.join(sDir, 'simulacra.json'), JSON.stringify(simulacraOutput, null, 2), 'utf8');
    console.log(`[build-simulacra] Unified simulacra dataset written to ${path.join(sDir, 'simulacra.json')}`);
  }

  // Write individual MMO character profiles and lightweight MMO index
  if (process.env.SIMULACRA_UNIFIED_ONLY !== 'true' && mmoProfiles.length > 0) {
    const mmoIndex = mmoProfiles.map(p => ({
      id: p.id,
      avatar_id: p.avatar_id,
      imitation_id: p.imitation_id,
      weapon_id: p.weapon_id,
      name_en: p.name_en,
      name_ru: p.name_ru,
      weapon_name_en: p.weapon_name_en,
      weapon_name_ru: p.weapon_name_ru,
      element: p.element,
      role: p.role,
      resonance: p.resonance,
      rarity: p.rarity,
      server_mode: p.server_mode,
      edition: p.edition,
      season: p.season,
      season_tag: p.season_tag,
      season_badge: p.season_badge,
      avatar: p.avatar,
      portrait: p.portrait,
      card: p.card,
      icon: p.icon
    }));

    for (const dir of targetDirs) {
      fs.mkdirSync(dir, { recursive: true });

      // Write individual MMO character profiles: `${mmoProfile.id}.json`
      for (const mmo of mmoProfiles) {
        if (targetSlug && mmo.slug?.toLowerCase() !== targetSlug && mmo.id?.toLowerCase() !== targetSlug) {
          continue;
        }
        const baseSlug = (mmo.canonical_id || mmo.slug || mmo.id.replace(/-mmo$/, '')).toLowerCase();
        if (!mmo.assets || !Array.isArray(mmo.assets) || mmo.assets.length === 0) {
          const manifestCandidates = [
            path.join(dir, `${baseSlug}-assets.json`),
            path.join(outDir, `${baseSlug}-assets.json`),
            path.join(projectRoot, 'info', 'simulacra', 'data', `${baseSlug}-assets.json`),
          ];
          for (const cand of manifestCandidates) {
            if (fs.existsSync(cand)) {
              try {
                mmo.assets = JSON.parse(readGameSourceFileSync(cand, 'utf8'));
                break;
              } catch (_) {}
            }
          }
        }
        fs.writeFileSync(path.join(dir, `${mmo.id}.json`), JSON.stringify(mmo, null, 2), 'utf8');
      }

      // Write lightweight MMO index: `simulacra-mmo-index.json`
      const mmoIdxPath = path.join(dir, 'simulacra-mmo-index.json');
      if (targetSlug) {
        let existingMmoIndex = [];
        if (fs.existsSync(mmoIdxPath)) {
          try { existingMmoIndex = JSON.parse(readGameSourceFileSync(mmoIdxPath, 'utf8')); } catch (e) {}
        }
        for (const newMmo of mmoIndex) {
          const foundIdx = existingMmoIndex.findIndex(c => c.id === newMmo.id || c.avatar_id === newMmo.avatar_id || c.weapon_id === newMmo.weapon_id);
          if (foundIdx !== -1) {
            existingMmoIndex[foundIdx] = newMmo;
          } else {
            existingMmoIndex.push(newMmo);
          }
        }
        fs.writeFileSync(mmoIdxPath, JSON.stringify(existingMmoIndex, null, 2), 'utf8');
      } else {
        fs.writeFileSync(mmoIdxPath, JSON.stringify(mmoIndex, null, 2), 'utf8');
      }
      console.log(`[build-simulacra] MMO index (${mmoIndex.length} characters) written to ${mmoIdxPath}`);
    }
  }

  console.log(`[build-simulacra] Successfully built ${characterIndex.length} simulacra profiles (${gachaProfiles.length} gacha, ${mmoProfiles.length} MMO).`);
  console.log(`[build-simulacra] Master index written to ${path.join(outDir, 'simulacra-index.json')}`);
  return {
    characterCount: characterIndex.length,
    gachaCount: gachaProfiles.length,
    mmoCount: mmoProfiles.length,
    totalCount: allProfiles.length,
    roleDistribution: roleStats,
    diagnostics: {
      roleDistribution: roleStats,
      localization: locResolver.getStats(),
      tableMerges: {
        weapon: weaponMerge.stat,
        matrixSuit: matrixMerge.stat,
        skillTips: skillMerge.stat,
        gameplayEffectTips: geTipsMerge.stat,
        weaponUpgrade: weaponUpgradeMerge.stat,
        equipEffectPack: equipEffectPackMerge.stat
      }
    }
  };
}

if (require.main === module) {
  buildSimulacraDataset();
}

export {
  buildSimulacraDataset,
  extractMMOSimulacra,
  parseEfficiencyRadar,
  resolveMMOAdvancement,
  ABILITY_HEXAGON_METRICS,
  RawArchiveReader,
  inferElement,
  resolveElements,
  inferResonance,
  resolveWeaponRole,
  extractWeaponFamily,
  classifySkillCategory,
  resolveExactSkillIcon,
  findCurveValue,
  formatSkillDescription,
  normalizeSkillFormulaSpacing,
  formatTraitDescription,
  extractTraitDriver,
  mergeArchiveTable,
  CANONICAL_SLUG_MAP,
  TRAIT_ALIASES,
  resolveAdvancement,
  resolveAdvancementText,
  REACTION_PASSIVES_DATA,
  MMO_REACTION_PASSIVES_DATA,
  preparePassives,
};

