import type { SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import { normalizeElement } from '@tof-hub/game-domain';
import { MMO_REACTION_PASSIVES_DATA, REACTION_PASSIVES_DATA } from '../constants';
import { normalizeSkillFormulaSpacing } from './format-rich-text';

export function charLevelToSkillParamLevel(charLevel: number): number {
  const lvl = Math.max(1, Math.min(200, Math.round(Number(charLevel) || 200)));
  if (lvl >= 200) return 21;
  if (lvl <= 19) return 1;
  return Math.floor(lvl / 10);
}

export {getWeaponStatsAtLevel,type WeaponStatsAtLevel} from '@tof-hub/game-domain';

function resolveParamForPlaceholder(skill: any, placeholderIdx: number): any | null {
  const params = skill?.parameters;
  if (!Array.isArray(params) || params.length === 0) return null;

  const targetSuffix = `_${placeholderIdx + 1}`;
  const normalizeKey = (value: unknown) => String(value || '')
    .toLowerCase()
    .replace(/^ga_fplayer|^ga_mplayer|^ga_|^buff_/i, '')
    .replace(/_success$/i, '')
    .replace(/powear/i, 'power')
    .replace(/forwardevadeattack/i, 'forwardattack');

  const skillKey = normalizeKey(skill.id || skill.action_id);
  const findMatchingParam = (key: string) => params.find((param: any) => {
    const paramKey = normalizeKey(param?.key);
    return paramKey.endsWith(targetSuffix) && paramKey.includes(key);
  });

  let matched = findMatchingParam(skillKey);
  if (!matched) matched = findMatchingParam(skillKey.replace(/_normal$/i, ''));
  if (!matched) matched = params.find((param: any) => String(param?.key || '').endsWith(targetSuffix));
  if (!matched) matched = params[placeholderIdx];

  return matched || null;
}

function getParamValueAtLevel(param: any, selectedLevel: number): unknown {
  const levels = param?.levels;
  if (!levels) return null;

  if (Array.isArray(levels)) {
    return levels[selectedLevel - 1] ?? levels[levels.length - 1] ?? null;
  }

  if (typeof levels !== 'object') return null;
  const levelKeys = Object.keys(levels)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (levelKeys.length === 0) return null;

  if (levels[selectedLevel] !== undefined) return levels[selectedLevel];
  if(param.interpMode==='RCIM_Linear'){
    const lower=levelKeys.filter(key=>key<selectedLevel).pop();
    const upper=levelKeys.find(key=>key>selectedLevel);
    if(lower!==undefined&&upper!==undefined){
      const before=Number(levels[lower]),after=Number(levels[upper]);
      if(Number.isFinite(before)&&Number.isFinite(after))return before+(after-before)*(selectedLevel-lower)/(upper-lower);
    }
  }
  const nearestLevel = levelKeys.filter((key) => key <= selectedLevel).pop() ?? levelKeys[0];
  return levels[nearestLevel];
}

function formatSkillValue(value: unknown): string | null {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(1).replace(/\.0$/, '');
}

export function isDiscardableSkill(skill: any): boolean {
  if (!skill) return true;
  const nameEn = String(skill.name_en || skill.name || '').trim();
  const nameRu = String(skill.name_ru || '').trim();
  const descEn = String(skill.desc_en || skill.desc_display_en || skill.description || '').trim();
  const descRu = String(skill.desc_ru || skill.desc_display_ru || '').trim();
  const id = String(skill.id || skill.action_id || '').trim();

  // 1. Literal 'None' / 'Нет' names or dummy/null IDs
  const isNoneName = /^none$/i.test(nameEn) || /^нет$/i.test(nameRu);
  const isNoneId = /(?:^|_)(?:none|null|dummy)(?:$|_)/i.test(id);
  if (isNoneName || (isNoneId && (!descEn || descEn === '—'))) {
    return true;
  }

  // 2. Completely empty/unresolved: no authentic name and no authentic description
  const hasValidName = nameEn && nameEn !== '—' && !/^none$/i.test(nameEn);
  const hasValidDesc = (descEn && descEn !== '—') || (descRu && descRu !== '—');
  if (!hasValidName && !hasValidDesc) {
    return true;
  }

  return false;
}

/**
 * MMO keeps weapon-specific passives only. Legacy excludes elemental
 * reactions, resonance/benediction effects, and generated fusion/on-field
 * entries from this section.
 */
export function isMmoExcludedPassive(passive: any): boolean {
  if (!passive) return false;

  const id = String(passive.id || passive.action_id || '').toLowerCase();
  const nameEn = String(passive.name_en || passive.name || '').toLowerCase().trim();
  const nameRu = String(passive.name_ru || '').toLowerCase().trim();

  if (
    id.includes('physical_flame') ||
    id.includes('flame_physical') ||
    id.includes('volt_frost') ||
    id.includes('frost_volt') ||
    id.includes('armor_dissolve') ||
    id.includes('force_impact') ||
    id.startsWith('fusion_') ||
    passive.isFusion ||
    passive.isOnField
  ) {
    return true;
  }

  if (
    nameEn === 'armor dissolve' ||
    nameRu === 'растворение брони' ||
    nameEn === 'force impact' ||
    nameRu === 'силовое воздействие'
  ) {
    return true;
  }

  if (
    /buff_.*_resonance/i.test(id) ||
    (id.includes('resonance') && !/^ga_/i.test(id)) ||
    /buff_.*_treat_friend/i.test(id) ||
    /benediction/i.test(id) ||
    passive.isBenediction
  ) {
    return true;
  }

  if (
    nameEn.includes('resonance') ||
    nameRu.includes('резонанс') ||
    nameEn.includes('benediction') ||
    nameRu.includes('посвящен')
  ) {
    return true;
  }

  if (
    passive.isReaction ||
    String(passive.category || passive.type || '').toLowerCase() === 'reaction' ||
    id.startsWith('reaction_') ||
    id === 'reaction'
  ) {
    return true;
  }

  const reactionNames = new Set([
    'armor dissolve',
    'force impact',
    'ice shell',
    'flame',
    'grievous',
    'volt',
    'altered',
    'superpower',
    'altered damage',
    'растворение брони',
    'силовое воздействие',
    'ледяная оболочка',
    'огонь',
    'тяжелое ранение',
    'электричество',
    'аберрация',
    'искажение',
    'измененный урон',
  ]);

  return reactionNames.has(nameEn) || reactionNames.has(nameRu);
}

export function getSkillDescriptionForLevel(
  skill: any,
  level = 200,
  lang = 'en',
  maxLevel = 200
): string {
  if (!skill) return '';
  const charLevel = typeof level === 'number' && !Number.isNaN(level) ? level : 200;
  const sName = (lang === 'ru' ? (skill.name_ru || skill.name_en) : skill.name_en) || '';
  const baseDesc = (lang === 'ru' ? (skill.desc_ru || skill.desc_en || '') : (skill.desc_en || '')) || '';
  let display = lang === 'ru'
    ? (skill.desc_display_ru || skill.desc_ru || skill.desc_display_en || skill.desc_en || skill.description)
    : (skill.desc_display_en || skill.desc_en || skill.description);

  if (sName.length > 80 && baseDesc.length < 50 && baseDesc.length > 0) {
    display = sName;
  }

  const hasPlaceholders = /\{(\d+)\}/.test(baseDesc);
  const displayHasPlaceholders = typeof display === 'string' && /\{(\d+)\}/.test(display);
  if (!hasPlaceholders || (charLevel >= maxLevel && !displayHasPlaceholders)) {
    if (display && display.trim() !== '') {
      return normalizeSkillFormulaSpacing(display);
    }
  }

  if (!baseDesc || typeof baseDesc !== 'string') return '';
  if (sName && baseDesc.trim().toLowerCase() === sName.trim().toLowerCase()) {
    return baseDesc.trim();
  }

  const paramLevel = charLevelToSkillParamLevel(charLevel);

  let formatted = baseDesc.replace(/\{(\d+)\}/g, (match, p1) => {
    const placeholderIdx = parseInt(p1, 10);
    const matchedParam = resolveParamForPlaceholder(skill, placeholderIdx);
    const formattedValue = formatSkillValue(getParamValueAtLevel(matchedParam, paramLevel));
    return formattedValue ?? match;
  });

  formatted = formatted.replace(/\{[0-9]+\}%?/g, '—').replace(/\{[^{}]*\}/g, '—');
  return normalizeSkillFormulaSpacing(formatted);
}

export function getCleanSkills(data: SimulacraDatasetItemRaw): any[] {
  if (!data) return [];
  const skillsContainer = data.weapon?.skills as any;
  if (!skillsContainer) return [];

  let rawList: any[] = [];
  if (Array.isArray(skillsContainer)) {
    rawList = skillsContainer;
  } else if (typeof skillsContainer === 'object') {
    const { normals = [], dodges = [], skills = [], discharges = [], passives = [], other = [] } = skillsContainer;
    rawList = [
      ...normals.map((s: any) => ({ ...s, category: s.category || 'Normal' })),
      ...dodges.map((s: any) => ({ ...s, category: s.category || 'Dodge' })),
      ...skills.map((s: any) => ({ ...s, category: s.category || 'Skill' })),
      ...discharges.map((s: any) => ({ ...s, category: s.category || 'Discharge' })),
      ...passives.map((s: any) => ({ ...s, category: s.category || 'Passive' })),
      ...other.map((s: any) => ({ ...s, category: s.category || 'Other' })),
    ];
  }

  return rawList.filter((s) => !isDiscardableSkill(s));
}

export function getCleanPassives(data: SimulacraDatasetItemRaw, _lang = 'en'): any[] {
  if (!data) return [];
  const isMmo = data.server_mode === 'mmo' || data.edition === 'mmo';

  const allSkills = getCleanSkills(data);
  const candidatePassives = allSkills
    .filter((s) => (s.category || '').toLowerCase() === 'passive')
    .filter((passive) => !isMmo || !isMmoExcludedPassive(passive));

  // Synthesize the appropriate elemental weapon-charge passive for the mode.
  const element = data.element ? normalizeElement(data.element) : null;
  const elementSecondary = data.element_secondary ? normalizeElement(data.element_secondary) : null;
  const isDual = Boolean(element && elementSecondary && element !== elementSecondary);
  // Gacha records contain the real dual-element reaction skill from legacy
  // (for example Armor Dissolve or Force Impact). Keep that source skill
  // intact. MMO has a different legacy presentation and is normalized below.
  const list = [...candidatePassives];

  let reactionKey: string | null = null;
  if (isDual && element && elementSecondary) {
    if (
      (element === 'Physical' && elementSecondary === 'Flame') ||
      (element === 'Flame' && elementSecondary === 'Physical')
    ) {
      reactionKey = 'Physical';
    } else if (
      (element === 'Volt' && elementSecondary === 'Frost') ||
      (element === 'Frost' && elementSecondary === 'Volt')
    ) {
      reactionKey = 'Frost';
    }
  }

  if (!reactionKey && element && REACTION_PASSIVES_DATA[element]) {
    reactionKey = element;
  }

  const passiveData = isMmo ? MMO_REACTION_PASSIVES_DATA : REACTION_PASSIVES_DATA;
  if (reactionKey && passiveData[reactionKey]) {
    const r = passiveData[reactionKey];
    const reactionId = `reaction_${reactionKey.toLowerCase()}`;
    const alreadyPresent = list.some((p) => {
      const id = String(p.id || p.action_id || '').toLowerCase();
      return p.isReaction || id.startsWith('reaction_') || id === reactionId;
    });

    if (!alreadyPresent) {
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
        icon: r.icon || data.element_combo_icon || null,
        parameters: [],
      });
    }
  }

  return list;
}
