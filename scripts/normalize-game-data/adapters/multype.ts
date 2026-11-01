import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { deepClone } from '../split-merge';

const FALLBACK_MULTYPE_RENAMES = {
  version: 1,
  sourceFile: 'module_extra_to_files_mapping3.json',
  mainRenames: {
    NoModule: 'No category',
    ModuleExtraType_Talent: 'Matrix',
    ModuleExtraType_WeaponActive: 'Weapon "active"',
    ModuleExtraType_WeaponPassive: 'Weapon "passive"',
    ModuleExtraType_ProfessionPassive: 'Class resonance',
    ModuleExtraType_Pet: 'Traits',
    ModuleExtraType_CardPassive: 'Relics',
    ModuleExtraType_Wormhole: 'Bygone + old content',
  },
  subRenames: {
    'NoModule::FireAtkBeExtraUpMult': 'Flame debuff',
    'NoModule::FinalDamageExtraUpMult': 'Normal',
    'NoModule::IceAtkBeExtraUpMult': 'Frost debuff',
    'NoModule::ThunderAtkBeExtraUpMult': 'Volt debuff',
    'NoModule::PhyAtkBeExtraUpMult': 'Phys debuff',
  },
  valueRenames: {
    'Buff_Lan_Level2_1.json': 'Lan Trait',
  },
  groupRenames: {},
};

const RU_MAIN_RENAMES: Record<string, string> = {
  NoModule: 'Без категории',
  ModuleExtraType_Talent: 'Матрицы',
  ModuleExtraType_WeaponActive: 'Оружие (активное)',
  ModuleExtraType_WeaponPassive: 'Оружие (пассивное)',
  ModuleExtraType_ProfessionPassive: 'Резонанс класса',
  ModuleExtraType_Pet: 'Трейты симулякров',
  ModuleExtraType_CardPassive: 'Реликвии',
  ModuleExtraType_Wormhole: 'Былое + старый контент',
};

export function normalizeMultypeDataset(legacySourceDir: string): DatasetNormalizationResult {
  const renamesPath = path.join(legacySourceDir, 'datamine', 'multype', 'data', 'renames.base.json');
  const mappingPath = path.join(
    legacySourceDir,
    'datamine',
    'multype',
    'data',
    'module_extra_to_files_mapping3.json'
  );
  const guessesPath = path.join(legacySourceDir, 'datamine', 'multype', 'data', 'multype_ai_guesses.json');
  const scanPath = path.join(legacySourceDir, 'datamine', 'multype', 'data', 'multype-scan.json');

  let rawRenames: any = null;
  let rawMapping: Record<string, any> = {};
  let aiGuesses: Record<string, any> = {};

  if (fs.existsSync(renamesPath)) {
    try {
      rawRenames = JSON.parse(fs.readFileSync(renamesPath, 'utf8'));
    } catch {
      rawRenames = null;
    }
  }

  if (!rawRenames) {
    rawRenames = deepClone(FALLBACK_MULTYPE_RENAMES);
  }

  if (fs.existsSync(mappingPath)) {
    try {
      rawMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    } catch {
      rawMapping = {};
    }
  }

  if (fs.existsSync(guessesPath)) {
    try {
      const guessPayload = JSON.parse(fs.readFileSync(guessesPath, 'utf8'));
      aiGuesses = guessPayload.guesses || {};
    } catch {
      aiGuesses = {};
    }
  }

  // Written by the owner-run Advanced Multype scan; the site pipeline never rescans.
  let scan: { gameVersion: string | null; generatedAt: string | null } = { gameVersion: null, generatedAt: null };
  if (fs.existsSync(scanPath)) {
    try {
      const scanPayload = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
      scan = {
        gameVersion: typeof scanPayload.gameVersion === 'string' ? scanPayload.gameVersion : null,
        generatedAt: typeof scanPayload.generatedAt === 'string' ? scanPayload.generatedAt : null,
      };
    } catch {
      // Unknown scan version stays null.
    }
  }

  const core = {
    version: rawRenames.version || 1,
    sourceFile: rawRenames.sourceFile || 'module_extra_to_files_mapping3.json',
    scan,
    mapping: rawMapping,
    aiGuesses,
  };

  const overlayEn = {
    mainRenames: rawRenames.mainRenames || {},
    subRenames: rawRenames.subRenames || {},
    valueRenames: rawRenames.valueRenames || {},
    groupRenames: rawRenames.groupRenames || {},
    aiGuesses,
  };

  const overlayRuMain: Record<string, string> = {
    ...(rawRenames.mainRenames || {}),
  };
  for (const [key, ruLabel] of Object.entries(RU_MAIN_RENAMES)) {
    if (overlayRuMain[key]) {
      overlayRuMain[key] = ruLabel;
    }
  }

  const overlayRu = {
    mainRenames: overlayRuMain,
    subRenames: rawRenames.subRenames || {},
    valueRenames: rawRenames.valueRenames || {},
    groupRenames: rawRenames.groupRenames || {},
    aiGuesses,
  };

  const matEn = {
    version: core.version,
    sourceFile: core.sourceFile,
    scan,
    mainRenames: overlayEn.mainRenames,
    subRenames: overlayEn.subRenames,
    valueRenames: overlayEn.valueRenames,
    groupRenames: overlayEn.groupRenames,
    mapping: rawMapping,
    aiGuesses,
  };

  const matRu = {
    version: core.version,
    sourceFile: core.sourceFile,
    scan,
    mainRenames: overlayRu.mainRenames,
    subRenames: overlayRu.subRenames,
    valueRenames: overlayRu.valueRenames,
    groupRenames: overlayRu.groupRenames,
    mapping: rawMapping,
    aiGuesses,
  };

  const totalCategories = Object.keys(rawMapping).length || Object.keys(rawRenames.mainRenames || {}).length || 1;

  return {
    datasetName: 'multype',
    core: {
      total: totalCategories,
      ...core,
    },
    overlays: {
      en: overlayEn,
      ru: overlayRu,
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts: {
      total: totalCategories,
      mappingCategories: Object.keys(rawMapping).length,
    },
  };
}
