/**
 * Tower of Fantasy Build Feature - Browser & Node Runtime
 * tools/build/js/build-runtime.js
 * 
 * Provides unified access to canonical BuildModel schema, registries,
 * validators, derived combat selectors, and IndexedDB persistence.
 * 
 * Supports both Browser (window.TofBuild) and Node.js (CommonJS require).
 */

(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && typeof module.exports === 'object') {
    // In Node.js, delegate to canonical build domain package
    try {
      module.exports = require('../../../build');
    } catch (_) {
      try {
        module.exports = require('../../build');
      } catch (e) {
        module.exports = factory();
      }
    }
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.TofBuild = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // --- 1. CONSTANTS ---
  const SCHEMA_VERSION = 1;

  const BUILD_MODES = {
    STRICT: 'strict',
    CUSTOM: 'custom'
  };

  const WEAPON_POSITIONS = ['left', 'middle', 'right'];
  const MATRIX_SLOTS = ['mind', 'memory', 'belief', 'emotion'];

  const GEAR_SLOTS = [
    'helmet', 'spaulders', 'armor', 'bracers',
    'belt', 'pants', 'boots', 'gloves',
    'visor', 'core', 'exoskeleton', 'reactor'
  ];

  const STANDARD_GEAR_SLOTS = [
    'helmet', 'spaulders', 'armor', 'bracers',
    'belt', 'pants', 'boots', 'gloves'
  ];

  const VERA_GEAR_SLOTS = [
    'visor', 'core', 'exoskeleton', 'reactor'
  ];

  const GEAR_SLOT_META = {
    helmet: { id: 'helmet', nameEn: 'Helmet', nameRu: 'Шлем', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/cloth.webp', isVera: false },
    spaulders: { id: 'spaulders', nameEn: 'Spaulders', nameRu: 'Наплечники', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/shawl.webp', isVera: false },
    armor: { id: 'armor', nameEn: 'Armor', nameRu: 'Броня', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/cloth.webp', isVera: false },
    bracers: { id: 'bracers', nameEn: 'Bracers', nameRu: 'Наручи', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/Arm.webp', isVera: false },
    belt: { id: 'belt', nameEn: 'Belt', nameRu: 'Пояс', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/belt.webp', isVera: false },
    pants: { id: 'pants', nameEn: 'Pants', nameRu: 'Штаны', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/pants.webp', isVera: false },
    boots: { id: 'boots', nameEn: 'Boots', nameRu: 'Ботинки', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/shoes.webp', isVera: false },
    gloves: { id: 'gloves', nameEn: 'Gloves', nameRu: 'Перчатки', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/glove.webp', isVera: false },
    visor: { id: 'visor', nameEn: 'Eyepiece', nameRu: 'Окуляр', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/eyepiece.webp', isVera: true },
    core: { id: 'core', nameEn: 'Combat Engine', nameRu: 'Боевой двигатель', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/Core.webp', isVera: true },
    exoskeleton: { id: 'exoskeleton', nameEn: 'Exoskeleton', nameRu: 'Экзоскелет', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/ectoskeleton.webp', isVera: true },
    reactor: { id: 'reactor', nameEn: 'Microreactor', nameRu: 'Микрореактор', icon: '/datamine/shared/media/Hotta/Content/Resources/UI/bag/equipment/reaction.webp', isVera: true }
  };

  const GEAR_STAT_REGISTRY = {
    attackCommon: { id: 'attackCommon', nameEn: 'Attack', nameRu: 'Атака', isPercent: false, step: 39, baseMin: 52, baseMax: 69 },
    attackFlame: { id: 'attackFlame', nameEn: 'Flame Attack', nameRu: 'Атака огнем', isPercent: false, step: 52, baseMin: 69, baseMax: 92 },
    attackFrost: { id: 'attackFrost', nameEn: 'Frost Attack', nameRu: 'Атака холодом', isPercent: false, step: 52, baseMin: 69, baseMax: 92 },
    attackPhysical: { id: 'attackPhysical', nameEn: 'Physical Attack', nameRu: 'Физическая атака', isPercent: false, step: 52, baseMin: 69, baseMax: 92 },
    attackVolt: { id: 'attackVolt', nameEn: 'Volt Attack', nameRu: 'Атака электричеством', isPercent: false, step: 52, baseMin: 69, baseMax: 92 },
    hp: { id: 'hp', nameEn: 'HP', nameRu: 'ОЗ', isPercent: false, step: 4050, baseMin: 4125, baseMax: 5500 },
    crit: { id: 'crit', nameEn: 'Crit', nameRu: 'Крит', isPercent: false, step: 258, baseMin: 258, baseMax: 344 },
    critRate: { id: 'critRate', nameEn: 'Crit Rate %', nameRu: 'Шанс крита %', isPercent: true, step: 0.48, baseMin: 1.15, baseMax: 1.54 },
    resistCommon: { id: 'resistCommon', nameEn: 'Resistance', nameRu: 'Сопротивление', isPercent: false, step: 65, baseMin: 65, baseMax: 86 },
    resistFlame: { id: 'resistFlame', nameEn: 'Flame Resistance', nameRu: 'Сопротивление огню', isPercent: false, step: 215, baseMin: 215, baseMax: 287 },
    resistFrost: { id: 'resistFrost', nameEn: 'Frost Resistance', nameRu: 'Сопротивление холоду', isPercent: false, step: 215, baseMin: 215, baseMax: 287 },
    resistPhysical: { id: 'resistPhysical', nameEn: 'Physical Resistance', nameRu: 'Сопротивление физ. урону', isPercent: false, step: 215, baseMin: 215, baseMax: 287 },
    resistVolt: { id: 'resistVolt', nameEn: 'Volt Resistance', nameRu: 'Сопротивление электричеству', isPercent: false, step: 215, baseMin: 215, baseMax: 287 },
    damageFlame: { id: 'damageFlame', nameEn: 'Flame Damage %', nameRu: 'Урон огнем %', isPercent: true, step: 0.38, baseMin: 0.77, baseMax: 1.03 },
    damageFrost: { id: 'damageFrost', nameEn: 'Frost Damage %', nameRu: 'Урон холодом %', isPercent: true, step: 0.38, baseMin: 0.77, baseMax: 1.03 },
    damagePhysical: { id: 'damagePhysical', nameEn: 'Physical Damage %', nameRu: 'Физический урон %', isPercent: true, step: 0.38, baseMin: 0.77, baseMax: 1.03 },
    damageVolt: { id: 'damageVolt', nameEn: 'Volt Damage %', nameRu: 'Урон электричеством %', isPercent: true, step: 0.38, baseMin: 0.77, baseMax: 1.03 }
  };

  const TITAN_RARE_STAT_REGISTRY = {
    normalAtkDmg: { id: 'normalAtkDmg', nameEn: 'Normal Attack Damage', nameRu: 'Урон от обычной атаки', minVal: 1.0, maxVal: 5.0, slots: ['helmet', 'spaulders', 'gloves', 'boots', 'visor', 'core', 'exoskeleton', 'reactor'] },
    weakPointDmg: { id: 'weakPointDmg', nameEn: 'Weak Point Damage', nameRu: 'Урон по уязвимым местам', minVal: 1.5, maxVal: 6.0, slots: ['gloves', 'boots', 'visor', 'core', 'exoskeleton', 'reactor', 'armor', 'belt', 'pants'] },
    delayDmg: { id: 'delayDmg', nameEn: 'Delay Damage', nameRu: 'Отложенный урон', minVal: 1.0, maxVal: 5.0, slots: ['helmet', 'spaulders', 'visor', 'core', 'exoskeleton', 'reactor'] },
    block: { id: 'block', nameEn: 'Block', nameRu: 'Блок', minVal: 1.0, maxVal: 5.0, slots: ['armor', 'belt', 'pants'] },
    dodgeRestore: { id: 'dodgeRestore', nameEn: 'Dodge Energy Recovery', nameRu: 'Восстановление энергии уклонения', minVal: 1.0, maxVal: 5.0, slots: ['boots', 'pants', 'visor', 'reactor'] },
    dmgReduction: { id: 'dmgReduction', nameEn: 'Damage Reduction', nameRu: 'Снижение получаемого урона', minVal: 1.0, maxVal: 4.5, slots: ['armor', 'belt', 'pants'] },
    critDmg: { id: 'critDmg', nameEn: 'Critical Damage', nameRu: 'Критический урон', minVal: 1.5, maxVal: 6.0, slots: ['gloves', 'boots', 'visor'] },
    lifesteal: { id: 'lifesteal', nameEn: 'Life Steal', nameRu: 'Похищение здоровья', minVal: 0.5, maxVal: 2.5, slots: ['helmet', 'spaulders', 'exoskeleton'] }
  };

  function getLegalStatsForSlot(slotId) {
    const isVera = VERA_GEAR_SLOTS.includes(slotId);
    const standardAtks = ['attackCommon', 'attackFlame', 'attackFrost', 'attackPhysical', 'attackVolt'];
    const standardRes = ['resistCommon', 'resistFlame', 'resistFrost', 'resistPhysical', 'resistVolt'];
    const base = [...standardAtks, ...standardRes, 'hp'];

    if (!isVera) {
      if (slotId === 'gloves' || slotId === 'boots') {
        return [...base, 'crit'];
      }
      return base;
    }

    const veraDmg = ['damageFlame', 'damageFrost', 'damagePhysical', 'damageVolt'];
    if (slotId === 'visor') {
      return [...base, ...veraDmg, 'critRate'];
    }
    return [...base, ...veraDmg];
  }

  function calculateRollAudit(piece) {
    if (!piece || !Array.isArray(piece.randomStats)) {
      return { totalEquivalentRolls: 0, qualityPercent: 0, rollsByStat: {} };
    }
    let totalRolls = 0;
    const rollsByStat = {};

    piece.randomStats.forEach(r => {
      if (!r.statId) return;
      const base = Number(r.value) || 0;
      const inc = Number(r.augmentIncrease) || 0;
      const step = GEAR_STAT_REGISTRY[r.statId]?.step || 50;
      const rolls = base > 0 ? Math.max(0, inc / step) : 0;
      totalRolls += rolls;
      rollsByStat[r.statId] = (rollsByStat[r.statId] || 0) + rolls;
    });

    const quality = Math.min(100, Math.round((totalRolls / 5) * 100));
    return {
      totalEquivalentRolls: Number(totalRolls.toFixed(2)),
      qualityPercent: quality,
      rollsByStat
    };
  }

  const DEFAULT_STAT_KEYS = [
    'hp', 'crit', 'critRate', 'attackFlame', 'attackFrost',
    'attackPhysical', 'attackVolt', 'attackAltered', 'damageFlame', 'damageFrost',
    'damagePhysical', 'damageVolt', 'damageAltered', 'resistFlame', 'resistFrost',
    'resistPhysical', 'resistVolt'
  ];

  // --- 2. ID & MODEL GENERATORS ---
  function generateBuildId() {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 9);
    return `build_${timestamp}_${rand}`;
  }

  function scanForForbiddenCustomUpload(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => scanForForbiddenCustomUpload(item, `${path}[${index}]`));
      return;
    }

    const FORBIDDEN_KEYS = new Set([
      'customImage', 'uploadedBlob', 'customImageData', 'customArtUrl', 'uploadedImage'
    ]);

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (FORBIDDEN_KEYS.has(key)) {
        throw new Error(`Security Violation: Forbidden custom upload field '${currentPath}' detected in build model.`);
      }

      if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
          throw new Error(`Security Violation: Embedded binary URI/blob detected at '${currentPath}'. Custom uploaded artwork must remain strictly in memory.`);
        }
        if (value.startsWith('file:///') || (value.length > 2 && value[1] === ':' && (value[2] === '\\' || value[2] === '/'))) {
          throw new Error(`Security Violation: Local file system path detected at '${currentPath}'.`);
        }
      } else if (typeof value === 'object' && value !== null) {
        scanForForbiddenCustomUpload(value, currentPath);
      }
    }
  }

  function createDefaultMatrixSlots() {
    const matrices = {};
    for (const slotId of MATRIX_SLOTS) {
      matrices[slotId] = { slotId, matrixId: null, star: 0 };
    }
    return matrices;
  }

  function createDefaultWeaponSlot(position) {
    return {
      position,
      weaponId: null,
      advancement: 0,
      nanYinMark: false,
      matrices: createDefaultMatrixSlots()
    };
  }

  function createDefaultGearPiece(slotId) {
    return {
      slotId,
      stars: 5,
      enhancementLevel: 0,
      mode: 'normal',
      randomStats: [
        { statId: null, value: 0, augmentIncrease: 0 },
        { statId: null, value: 0, augmentIncrease: 0 },
        { statId: null, value: 0, augmentIncrease: 0 },
        { statId: null, value: 0, augmentIncrease: 0 }
      ],
      augmentationStats: [
        { statId: null, value: 0 },
        { statId: null, value: 0 }
      ],
      titanStat: null
    };
  }

  function createDefaultGearCollection() {
    const gear = {};
    for (const slotId of GEAR_SLOTS) {
      gear[slotId] = createDefaultGearPiece(slotId);
    }
    return gear;
  }

  function createDefaultFinalStats() {
    const provenance = {};
    const values = {};
    for (const key of DEFAULT_STAT_KEYS) {
      provenance[key] = { source: 'manual', updatedAt: null };
      values[key] = 0;
    }
    return { provenance, values };
  }

  function createEmptyBuildModel(options = {}) {
    const now = new Date().toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      id: options.id || generateBuildId(),
      createdAt: options.createdAt || now,
      updatedAt: options.updatedAt || now,
      identity: {
        playerName: options.playerName || 'Wanderer',
        server: options.server || '',
        region: options.region || 'NA',
        uid: options.uid || '',
        buildName: options.buildName || 'Untitled Build',
        notes: options.notes || ''
      },
      mode: options.mode || BUILD_MODES.STRICT,
      weapons: {
        left: createDefaultWeaponSlot('left'),
        middle: createDefaultWeaponSlot('middle'),
        right: createDefaultWeaponSlot('right')
      },
      synthesis: {
        lin: { enabled: false, advancement: 0 },
        fiona: { enabled: false, advancement: 0 }
      },
      gear: createDefaultGearCollection(),
      supercomputing: {
        visor: 0,
        core: 0,
        exoskeleton: 0,
        reactor: 0
      },
      spaceSupport: {
        selectedContent: 'none',
        element: 'flame',
        chipLevel: 0,
        elementDamageLevel: 0,
        contentDamageLevel: 0
      },
      relics: [],
      servant: null,
      trait: null,
      finalStats: createDefaultFinalStats(),
      appearance: {
        artId: null,
        artMode: 'auto',
        autoArtUrl: null,
        heroArtUrl: null,
        themeMode: 'dark',
        accentColor: '#38bdf8',
        artTransform: { scale: 1.0, offsetX: 0, offsetY: 0, blur: 0 }
      }
    };
  }

  function cloneBuildModel(model) {
    if (!model || typeof model !== 'object') {
      throw new Error('cloneBuildModel requires a valid model object');
    }
    scanForForbiddenCustomUpload(model);
    return JSON.parse(JSON.stringify(model));
  }

  function serializeBuildModel(model) {
    if (!model || typeof model !== 'object') {
      throw new Error('serializeBuildModel requires a valid model object');
    }
    scanForForbiddenCustomUpload(model);
    return JSON.stringify(model);
  }

  function deserializeBuildModel(jsonString) {
    if (typeof jsonString !== 'string') {
      throw new Error('deserializeBuildModel expects a JSON string');
    }
    const parsed = JSON.parse(jsonString);
    scanForForbiddenCustomUpload(parsed);
    return parsed;
  }

  function migrateBuildModel(rawBuild) {
    let build = typeof rawBuild === 'string' ? JSON.parse(rawBuild) : JSON.parse(JSON.stringify(rawBuild || {}));
    scanForForbiddenCustomUpload(build);

    if (!build.schemaVersion || build.schemaVersion < 1) {
      build.schemaVersion = 1;
    }
    if (!build.id) build.id = generateBuildId();
    const now = new Date().toISOString();
    if (!build.createdAt) build.createdAt = now;
    if (!build.updatedAt) build.updatedAt = now;

    if (!build.identity) build.identity = {};
    build.identity.playerName = String(build.identity.playerName || 'Wanderer').trim();
    build.identity.server = String(build.identity.server || '').trim();
    build.identity.region = String(build.identity.region || 'NA').trim();
    build.identity.uid = String(build.identity.uid || '').trim();
    build.identity.buildName = String(build.identity.buildName || 'Untitled Build').trim();
    build.identity.notes = String(build.identity.notes || '').trim();

    build.mode = (build.mode === 'custom') ? 'custom' : 'strict';

    if (!build.weapons) build.weapons = {};
    for (const pos of WEAPON_POSITIONS) {
      if (!build.weapons[pos]) {
        build.weapons[pos] = createDefaultWeaponSlot(pos);
      } else {
        build.weapons[pos].position = pos;
        build.weapons[pos].weaponId = build.weapons[pos].weaponId || null;
        build.weapons[pos].advancement = Math.max(0, Math.min(6, parseInt(build.weapons[pos].advancement, 10) || 0));
        build.weapons[pos].nanYinMark = Boolean(build.weapons[pos].nanYinMark);
        if (!build.weapons[pos].matrices) build.weapons[pos].matrices = createDefaultMatrixSlots();
        for (const slot of MATRIX_SLOTS) {
          if (!build.weapons[pos].matrices[slot]) {
            build.weapons[pos].matrices[slot] = { slotId: slot, matrixId: null, star: 0 };
          } else {
            build.weapons[pos].matrices[slot].star = Math.max(0, Math.min(3, parseInt(build.weapons[pos].matrices[slot].star, 10) || 0));
          }
        }
      }
    }

    if (!build.gear) build.gear = createDefaultGearCollection();
    for (const slot of GEAR_SLOTS) {
      if (!build.gear[slot]) {
        build.gear[slot] = createDefaultGearPiece(slot);
      }
    }

    if (!build.supercomputing) {
      build.supercomputing = { visor: 0, core: 0, exoskeleton: 0, reactor: 0 };
    }
    if (!build.spaceSupport) {
      build.spaceSupport = { selectedContent: 'none', element: 'flame', chipLevel: 0, elementDamageLevel: 0, contentDamageLevel: 0 };
    }
    if (!build.synthesis) {
      build.synthesis = { lin: { enabled: false, advancement: 0 }, fiona: { enabled: false, advancement: 0 } };
    }
    if (!Array.isArray(build.relics)) build.relics = [];
    if (!build.finalStats) build.finalStats = createDefaultFinalStats();
    if (!build.appearance) {
      build.appearance = { artId: null, themeMode: 'dark', accentColor: '#38bdf8', artTransform: { scale: 1.0, offsetX: 0, offsetY: 0, blur: 0 } };
    }

    return build;
  }

  // --- 3. VALIDATION ---
  function validateBuildSchema(model) {
    const errors = [];
    const warnings = [];

    if (!model || typeof model !== 'object') {
      return { isValid: false, errors: [{ severity: 'error', code: 'SCHEMA_NOT_OBJECT', message: 'Build must be an object' }], warnings };
    }
    if (model.schemaVersion !== SCHEMA_VERSION) {
      errors.push({ severity: 'error', code: 'SCHEMA_INVALID_VERSION', message: `Expected schemaVersion ${SCHEMA_VERSION}` });
    }
    if (!model.id || typeof model.id !== 'string') {
      errors.push({ severity: 'error', code: 'SCHEMA_INVALID_ID', message: 'Missing or invalid build ID' });
    }
    if (!model.identity || typeof model.identity !== 'object') {
      errors.push({ severity: 'error', code: 'SCHEMA_MISSING_IDENTITY', message: 'Missing identity block' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  function validateBuild(model) {
    const schema = validateBuildSchema(model);
    if (!schema.isValid) return schema;

    const errors = [...schema.errors];
    const warnings = [...schema.warnings];
    const isCustom = model.mode === 'custom';

    // Verify weapon advancements (0-6)
    for (const pos of WEAPON_POSITIONS) {
      const w = model.weapons[pos];
      if (w && (w.advancement < 0 || w.advancement > 6)) {
        const issue = { severity: isCustom ? 'warning' : 'error', code: 'WEAPON_ADV_BOUNDS', message: `Weapon ${pos} advancement out of bounds (0-6)` };
        if (isCustom) warnings.push(issue); else errors.push(issue);
      }
    }

    // Verify gear legality
    if (model.gear) {
      for (const [slotId, piece] of Object.entries(model.gear)) {
        const legal = getLegalStatsForSlot(slotId);
        if (Array.isArray(piece.randomStats)) {
          piece.randomStats.forEach((r, idx) => {
            if (r.statId && !legal.includes(r.statId)) {
              const statName = GEAR_STAT_REGISTRY[r.statId]?.nameEn || r.statId;
              const slotName = GEAR_SLOT_META[slotId]?.nameEn || slotId;
              const issue = {
                severity: isCustom ? 'warning' : 'error',
                code: 'GEAR_ILLEGAL_STAT',
                message: `Illegal stat "${statName}" on ${slotName} (Slot ${idx + 1})`
              };
              if (isCustom) warnings.push(issue); else errors.push(issue);
            }
          });
        }
      }
    }

    // Verify supercomputing levels (0-20)
    if (model.supercomputing) {
      for (const [slot, lvl] of Object.entries(model.supercomputing)) {
        if (typeof lvl === 'number' && (lvl < 0 || lvl > 20)) {
          const issue = { severity: isCustom ? 'warning' : 'error', code: 'SUPERCOMPUTING_BOUNDS', message: `Supercomputing ${slot} level out of bounds (0-20)` };
          if (isCustom) warnings.push(issue); else errors.push(issue);
        }
      }
    }

    // Verify space support bounds (0-10)
    if (model.spaceSupport) {
      const ss = model.spaceSupport;
      ['chipLevel', 'elementDamageLevel', 'contentDamageLevel'].forEach(k => {
        const val = ss[k];
        if (typeof val === 'number' && (val < 0 || val > 10)) {
          const issue = { severity: isCustom ? 'warning' : 'error', code: 'SPACE_SUPPORT_BOUNDS', message: `Space Support ${k} out of bounds (0-10)` };
          if (isCustom) warnings.push(issue); else errors.push(issue);
        }
      });
    }

    // Verify relics constraint (0-2)
    if (Array.isArray(model.relics) && model.relics.length > 2) {
      const issue = { severity: isCustom ? 'warning' : 'error', code: 'RELICS_EXCEED_LIMIT', message: 'Maximum 2 relics allowed' };
      if (isCustom) warnings.push(issue); else errors.push(issue);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // --- 4. COMBAT SELECTORS ---
  function selectTotalCritRate(critRating, extraCritRatePercent = 0, level = 100) {
    const rating = Math.max(0, Number(critRating) || 0);
    const extra = Number(extraCritRatePercent) || 0;
    const denom = 30000;
    const ratingRate = denom > 0 ? (rating / denom) * 100 : 0;
    const totalRate = ratingRate + extra;
    return {
      critRating: rating,
      extraPercent: extra,
      ratingPercent: Number(ratingRate.toFixed(2)),
      totalPercent: Number(totalRate.toFixed(2)),
      display: `${totalRate.toFixed(1)}%`
    };
  }

  function selectResistanceBreakdown(rawResist, level = 100) {
    const resist = Math.max(0, Number(rawResist) || 0);
    // DR = Resist / (K + Resist)
    const K = 15000;
    const drFraction = (resist + K) > 0 ? resist / (resist + K) : 0;
    const drPercent = Number((drFraction * 100).toFixed(2));
    return {
      rawResist: resist,
      level,
      reductionPercent: drPercent,
      display: `${drPercent.toFixed(1)}%`
    };
  }

  function selectDamageBreakdown(baseDmgPercent = 0, spaceSupport = null, element = 'flame') {
    const base = Number(baseDmgPercent) || 0;
    const ss = spaceSupport && typeof calculateSpaceSupportBreakdown === 'function'
      ? calculateSpaceSupportBreakdown(spaceSupport)
      : { elementDamageBonus: 0, contentDamageBonus: 0, chipBonus: 0, totalDamageBonus: 0, selectedContent: 'none' };

    const isMatchingElement = !ss.element || ss.element.toLowerCase() === element.toLowerCase();
    const eleBonus = isMatchingElement ? (ss.elementDamageBonus * 100) : 0;
    const contentBonus = (ss.contentDamageBonus * 100);
    const chipBonus = (ss.chipBonus * 100);
    const total = base + eleBonus + contentBonus + chipBonus;

    return {
      basePercent: base,
      elementBonusPercent: eleBonus,
      contentBonusPercent: contentBonus,
      chipBonusPercent: chipBonus,
      totalPercent: Number(total.toFixed(2)),
      selectedContent: ss.selectedContent,
      display: `${total.toFixed(1)}%`
    };
  }

  // --- SUPERCOMPUTING & SPACE SUPPORT SELECTORS ---
  const SUPERCOMPUTING_SLOTS = [
    { id: 'visor', gearSlotId: 'eyepiece', nameEn: 'Eyepiece (Visor)', icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/equipment/Icon/item_equip_eyepatch_SSR.webp' },
    { id: 'core', gearSlotId: 'combatEngine', nameEn: 'Combat Engine', icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/equipment/Icon/item_equip_engine_SSR.webp' },
    { id: 'exoskeleton', gearSlotId: 'exoskeleton', nameEn: 'Exoskeleton', icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/equipment/Icon/item_equip_exoskeleton_SSR.webp' },
    { id: 'reactor', gearSlotId: 'microreactor', nameEn: 'Microreactor', icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/equipment/Icon/item_equip_microreactor_SSR.webp' }
  ];

  function calculateSupercomputingBonus(level) {
    const l = Math.max(0, Math.min(20, parseInt(level, 10) || 0));
    return Math.min(l, 10) * 0.005 + Math.max(0, Math.min(l, 20) - 10) * 0.01;
  }

  function calculateSpaceSupportBreakdown(spaceSupport) {
    if (!spaceSupport) {
      return { selectedContent: 'none', element: 'flame', chipBonus: 0, elementDamageBonus: 0, contentDamageBonus: 0, totalDamageBonus: 0 };
    }
    const chipLevel = Math.max(0, Math.min(10, parseInt(spaceSupport.chipLevel, 10) || 0));
    const elemLevel = Math.max(0, Math.min(10, parseInt(spaceSupport.elementDamageLevel, 10) || 0));
    const contentLevel = Math.max(0, Math.min(10, parseInt(spaceSupport.contentDamageLevel, 10) || 0));

    const elementDamageBonus = elemLevel * 0.01;
    const contentDamageBonus = contentLevel * 0.01;
    const chipBonus = chipLevel * 0.005;

    return {
      selectedContent: spaceSupport.selectedContent || 'none',
      element: spaceSupport.element || 'flame',
      chipLevel,
      elementDamageLevel: elemLevel,
      contentDamageLevel: contentLevel,
      chipBonus,
      elementDamageBonus,
      contentDamageBonus,
      totalDamageBonus: elementDamageBonus + contentDamageBonus + chipBonus
    };
  }

  // --- 5. INDEXEDDB PERSISTENCE ADAPTER ---
  const DB_NAME = 'tof_build_db';
  const DB_VERSION = 1;
  const STORES = {
    BUILDS: 'builds',
    DRAFT: 'draft'
  };

  class IndexedDBAdapter {
    constructor(options = {}) {
      this.dbName = options.dbName || DB_NAME;
      this.dbVersion = options.dbVersion || DB_VERSION;
      this._idbFactory = options.idbFactory || (typeof indexedDB !== 'undefined' ? indexedDB : null);
      this._dbPromise = null;
    }

    isAvailable() {
      return Boolean(this._idbFactory);
    }

    async openDatabase() {
      if (this._dbPromise) return this._dbPromise;
      if (!this._idbFactory) {
        throw new Error('IndexedDB is not supported or available in this environment.');
      }

      this._dbPromise = new Promise((resolve, reject) => {
        const req = this._idbFactory.open(this.dbName, this.dbVersion);

        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORES.BUILDS)) {
            const buildStore = db.createObjectStore(STORES.BUILDS, { keyPath: 'id' });
            buildStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            buildStore.createIndex('buildName', 'identity.buildName', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORES.DRAFT)) {
            db.createObjectStore(STORES.DRAFT, { keyPath: 'key' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
      });

      return this._dbPromise;
    }

    async put(storeName, record) {
      scanForForbiddenCustomUpload(record);
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error || new Error(`Failed to put record in ${storeName}`));
      });
    }

    async get(storeName, key) {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error(`Failed to get key '${key}' from ${storeName}`));
      });
    }

    async getAll(storeName) {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error || new Error(`Failed to getAll from ${storeName}`));
      });
    }

    async delete(storeName, key) {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error(`Failed to delete key '${key}' from ${storeName}`));
      });
    }

    async clear(storeName) {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error(`Failed to clear ${storeName}`));
      });
    }
  }

  // --- 6. LOCALSTORAGE PREFERENCES ---
  const PREF_PREFIX = 'tof_build_pref_';
  const PREF_KEYS = {
    LAST_OPENED_ID: `${PREF_PREFIX}last_opened_id`,
    LAST_RENDERER: `${PREF_PREFIX}last_renderer`,
    THEME: `${PREF_PREFIX}theme`,
    EDITOR_SECTIONS: `${PREF_PREFIX}editor_sections`,
    COMPACT_MODE: `${PREF_PREFIX}compact_mode`
  };

  class BuildPreferences {
    constructor(options = {}) {
      this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    }

    isAvailable() {
      return Boolean(this.storage);
    }

    getLastOpenedId() {
      if (!this.storage) return null;
      try { return this.storage.getItem(PREF_KEYS.LAST_OPENED_ID) || null; } catch (_) { return null; }
    }

    setLastOpenedId(id) {
      if (!this.storage) return;
      try {
        if (id) this.storage.setItem(PREF_KEYS.LAST_OPENED_ID, String(id));
        else this.storage.removeItem(PREF_KEYS.LAST_OPENED_ID);
      } catch (_) {}
    }

    getLastRenderer() {
      if (!this.storage) return 'showcase';
      try {
        const val = this.storage.getItem(PREF_KEYS.LAST_RENDERER);
        return (val === 'equipment') ? 'equipment' : 'showcase';
      } catch (_) { return 'showcase'; }
    }

    setLastRenderer(mode) {
      if (!this.storage) return;
      try { this.storage.setItem(PREF_KEYS.LAST_RENDERER, mode === 'equipment' ? 'equipment' : 'showcase'); } catch (_) {}
    }

    getTheme() {
      if (!this.storage) return 'dark';
      try { return this.storage.getItem(PREF_KEYS.THEME) || 'dark'; } catch (_) { return 'dark'; }
    }

    setTheme(theme) {
      if (!this.storage) return;
      try { this.storage.setItem(PREF_KEYS.THEME, theme); } catch (_) {}
    }

    getEditorSections() {
      if (!this.storage) return {};
      try {
        const raw = this.storage.getItem(PREF_KEYS.EDITOR_SECTIONS);
        return raw ? JSON.parse(raw) : {};
      } catch (_) { return {}; }
    }

    setEditorSections(sections) {
      if (!this.storage) return;
      try { this.storage.setItem(PREF_KEYS.EDITOR_SECTIONS, JSON.stringify(sections || {})); } catch (_) {}
    }
  }

  // --- 7. AUTOSAVE MANAGER ---
  class AutosaveManager {
    constructor(options = {}) {
      this.repository = options.repository;
      this.debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 500;
      this._timer = null;
      this._pendingBuild = null;
      this._pendingOriginalId = null;
      this.statusListeners = new Set();
    }

    onStatusChange(listener) {
      if (typeof listener === 'function') {
        this.statusListeners.add(listener);
      }
    }

    _notify(status, detail = null) {
      for (const listener of this.statusListeners) {
        try { listener(status, detail); } catch (_) {}
      }
    }

    schedule(build, originalBuildId = null) {
      this._pendingBuild = build;
      this._pendingOriginalId = originalBuildId;
      this._notify('pending', { buildId: build ? build.id : null });

      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this.flush();
      }, this.debounceMs);
    }

    async flush() {
      if (this._timer) {
        clearTimeout(this._timer);
        this._timer = null;
      }
      if (!this._pendingBuild) return;

      const toSave = this._pendingBuild;
      const origId = this._pendingOriginalId;
      this._pendingBuild = null;
      this._pendingOriginalId = null;

      try {
        this._notify('saving');
        if (this.repository && typeof this.repository.saveDraft === 'function') {
          await this.repository.saveDraft(toSave, { originalBuildId: origId });
          this._notify('saved', { savedAt: new Date().toISOString() });
        }
      } catch (err) {
        this._notify('error', { error: err.message });
      }
    }
  }

  // --- 8. CANONICAL BUILD REPOSITORY ---
  class BuildRepository {
    constructor(options = {}) {
      this.adapter = options.adapter || new IndexedDBAdapter({
        idbFactory: options.idbFactory
      });
      this.preferences = options.preferences || new BuildPreferences({
        storage: options.localStorage
      });
      this.autosave = new AutosaveManager({
        repository: this,
        debounceMs: options.autosaveDebounceMs || 500
      });
    }

    async list() {
      if (!this.adapter.isAvailable()) return [];
      const rows = await this.adapter.getAll(STORES.BUILDS);
      const summaries = [];

      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        try {
          const migrated = migrateBuildModel(row);
          summaries.push({
            id: migrated.id,
            buildName: migrated.identity?.buildName || 'Untitled Build',
            playerName: migrated.identity?.playerName || '',
            server: migrated.identity?.server || '',
            region: migrated.identity?.region || '',
            mode: migrated.mode || 'strict',
            createdAt: migrated.createdAt,
            updatedAt: migrated.updatedAt,
            isCorrupt: false
          });
        } catch (e) {
          summaries.push({
            id: row.id || 'unknown',
            buildName: '(Corrupted Build)',
            updatedAt: row.updatedAt || new Date().toISOString(),
            isCorrupt: true,
            recoveryError: e.message
          });
        }
      }

      summaries.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return summaries;
    }

    async get(id) {
      if (!this.adapter.isAvailable() || !id) return null;
      const raw = await this.adapter.get(STORES.BUILDS, id);
      if (!raw) return null;
      return migrateBuildModel(raw);
    }

    async save(build) {
      if (!build || typeof build !== 'object') {
        throw new Error('BuildRepository.save requires a valid build object');
      }
      scanForForbiddenCustomUpload(build);
      const toSave = cloneBuildModel(build);
      toSave.updatedAt = new Date().toISOString();

      await this.adapter.put(STORES.BUILDS, toSave);
      this.preferences.setLastOpenedId(toSave.id);
      return toSave;
    }

    async create(build) {
      return this.save(build);
    }

    async rename(id, newName) {
      const existing = await this.get(id);
      if (!existing) throw new Error(`Cannot rename: build '${id}' not found`);
      existing.identity.buildName = String(newName || '').trim() || 'Untitled Build';
      return this.save(existing);
    }

    async duplicate(id, customName = null) {
      const source = await this.get(id);
      if (!source) throw new Error(`Cannot duplicate: build '${id}' not found`);

      const cloned = cloneBuildModel(source);
      cloned.id = generateBuildId();
      const now = new Date().toISOString();
      cloned.createdAt = now;
      cloned.updatedAt = now;
      cloned.identity.buildName = customName
        ? String(customName).trim()
        : `${source.identity.buildName || 'Untitled Build'} (Copy)`;

      return this.save(cloned);
    }

    async delete(id) {
      if (!id) return false;
      await this.adapter.delete(STORES.BUILDS, id);

      if (this.preferences.getLastOpenedId() === id) {
        this.preferences.setLastOpenedId(null);
      }

      // Detach draft if it referenced this build
      try {
        const draft = await this.adapter.get(STORES.DRAFT, 'current');
        if (draft && draft.originalBuildId === id) {
          draft.originalBuildId = null;
          await this.adapter.put(STORES.DRAFT, draft);
        }
      } catch (_) {}

      return true;
    }

    async saveDraft(build, options = {}) {
      if (!build) return null;
      scanForForbiddenCustomUpload(build);
      const record = {
        key: 'current',
        schemaVersion: SCHEMA_VERSION,
        originalBuildId: options.originalBuildId || null,
        savedAt: new Date().toISOString(),
        build: cloneBuildModel(build)
      };
      await this.adapter.put(STORES.DRAFT, record);
      return record;
    }

    async getDraft() {
      if (!this.adapter.isAvailable()) return null;
      const rec = await this.adapter.get(STORES.DRAFT, 'current');
      if (!rec || !rec.build) return null;
      try {
        return {
          build: migrateBuildModel(rec.build),
          originalBuildId: rec.originalBuildId || null,
          savedAt: rec.savedAt || new Date().toISOString()
        };
      } catch (_) {
        return null;
      }
    }

    async clearDraft() {
      if (!this.adapter.isAvailable()) return true;
      return this.adapter.delete(STORES.DRAFT, 'current');
    }

    async restoreLastSession() {
      // 1. Check for active uncommitted draft
      try {
        const draft = await this.getDraft();
        if (draft && draft.build) {
          return {
            build: draft.build,
            source: 'draft',
            originalBuildId: draft.originalBuildId,
            isDraftRestored: true
          };
        }
      } catch (_) {}

      // 2. Check for last opened saved build
      const lastId = this.preferences.getLastOpenedId();
      if (lastId) {
        try {
          const saved = await this.get(lastId);
          if (saved) {
            return {
              build: saved,
              source: 'saved',
              originalBuildId: saved.id,
              isDraftRestored: false
            };
          }
        } catch (_) {}
      }

      // 3. Fall back to pristine empty build
      return {
        build: createEmptyBuildModel(),
        source: 'empty',
        originalBuildId: null,
        isDraftRestored: false
      };
    }
  }

  // --- 9. EXPORT PUBLIC API ---
  return {
    SCHEMA_VERSION,
    BUILD_MODES,
    WEAPON_POSITIONS,
    MATRIX_SLOTS,
    GEAR_SLOTS,
    STANDARD_GEAR_SLOTS,
    VERA_GEAR_SLOTS,
    GEAR_SLOT_META,
    DEFAULT_STAT_KEYS,
    GEAR_STAT_REGISTRY,
    TITAN_RARE_STAT_REGISTRY,
    getLegalStatsForSlot,
    calculateRollAudit,

    generateBuildId,
    scanForForbiddenCustomUpload,
    createDefaultMatrixSlots,
    createDefaultWeaponSlot,
    createDefaultGearPiece,
    createDefaultGearCollection,
    createDefaultFinalStats,
    createEmptyBuildModel,
    cloneBuildModel,
    serializeBuildModel,
    deserializeBuildModel,
    migrateBuildModel,

    validateBuildSchema,
    validateBuild,

    selectTotalCritRate,
    selectResistanceBreakdown,
    selectDamageBreakdown,

    SUPERCOMPUTING_SLOTS,
    calculateSupercomputingBonus,
    calculateSpaceSupportBreakdown,

    IndexedDBAdapter,
    BuildPreferences,
    AutosaveManager,
    BuildRepository
  };
});
