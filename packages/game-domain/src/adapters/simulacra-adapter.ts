import { normalizeElement } from '../common/elements';
import { normalizeRarity } from '../common/rarities';
import { normalizeRole } from '../common/roles';
import { normalizeServerMode } from '../common/server-mode';
import {createLocalizedText, getLocalizedFields } from '../common/localization';
import type {
  SimulacrumSummary,
  SimulacrumDetail,
  SimulacrumAdvancement,
  SimulacrumTrait,
} from '../entities/simulacrum';
import type { WeaponDetail, WeaponSkill } from '../entities/weapon';

export function adaptSimulacrumSummary(raw: any): SimulacrumSummary {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';
  const weaponNameEn = raw.weapon_name_en ?? raw.weapon_name?.en ?? '';
  const weaponNameRu = raw.weapon_name_ru ?? raw.weapon_name?.ru ?? '';

  const stableId = raw.imitation_id || raw.avatar_id || raw.id || '';
  const slug = raw.id || raw.slug || '';

  return {
    stableId,
    slug,
    name: createLocalizedText(nameEn, nameRu),
    rarity: normalizeRarity(raw.rarity),
    element: normalizeElement(raw.element),
    elementSecondary: raw.element_secondary ? normalizeElement(raw.element_secondary) : null,
    role: normalizeRole(raw.role || raw.resonance),
    serverMode: normalizeServerMode(raw.server_mode || raw.edition),
    weaponId: raw.weapon_id || '',
    weaponName: createLocalizedText(weaponNameEn, weaponNameRu),
    matrixSuitId: raw.matrix_suit_id || null,
    avatar: raw.avatar || '',
    card: raw.card || '',
    avatarId: raw.avatar_id || null,
    imitationId: raw.imitation_id || null,
    matrixSuitNum: typeof raw.matrix_suit_num === 'number' ? raw.matrix_suit_num : null,
    resonance: raw.resonance || raw.role || null,
    season: raw.season || null,
    icon: raw.icon || '',
    portrait: raw.portrait || '',
    detailArt: raw.detail_art || raw.portrait || '',
  };
}

export function adaptSimulacrumDetail(raw: any): SimulacrumDetail {
  const summary = adaptSimulacrumSummary(raw);

  const baseStats: Record<string, number> = {};
  if (raw.base_stats && typeof raw.base_stats === 'object') {
    for (const [k, v] of Object.entries(raw.base_stats)) {
      if (typeof v === 'number') baseStats[k] = v;
    }
  }

  const maxStats: Record<string, number> = {};
  if (raw.max_stats && typeof raw.max_stats === 'object') {
    for (const [k, v] of Object.entries(raw.max_stats)) {
      if (typeof v === 'number') maxStats[k] = v;
    }
  }

  const advancements: SimulacrumAdvancement[] = Array.isArray(raw.advancements)
    ? raw.advancements.map((a: any) => ({
        star: Number(a.star ?? 0),
        name: createLocalizedText(a.name_en ?? a.name?.en, a.name_ru ?? a.name?.ru, { ...getLocalizedFields(a, 'name') }),
        description: createLocalizedText(a.desc_en ?? a.desc?.en, a.desc_ru ?? a.desc?.ru, { ...getLocalizedFields(a, 'desc') }),
        multipliers: a.multipliers,
      }))
    : [];

  const traits: SimulacrumTrait[] = Array.isArray(raw.traits)
    ? raw.traits.map((t: any) => ({
        affinity: Number(t.affinity ?? 0),
        name: createLocalizedText(t.name_en ?? t.name?.en, t.name_ru ?? t.name?.ru, { ...getLocalizedFields(t, 'name') }),
        description: createLocalizedText(t.desc_en ?? t.desc?.en, t.desc_ru ?? t.desc?.ru, { ...getLocalizedFields(t, 'desc') }),
        value: typeof t.value === 'number' ? t.value : undefined,
      }))
    : [];

  const affinityLadder = Array.isArray(raw.affinity_ladder)
    ? raw.affinity_ladder.map((m: any) => ({
        levelPts: Number(m.level_pts ?? 0),
        atk: Number(m.atk ?? 0),
        hp: Number(m.hp ?? 0),
      }))
    : [];

  const rawW = raw.weapon || {};
  const weapon: WeaponDetail = {
    stableId: rawW.id || summary.weaponId,
    slug: raw.id || summary.slug,
    simulacrumId: summary.stableId,
    name: createLocalizedText(rawW.name_en ?? rawW.name?.en ?? summary.weaponName.en, rawW.name_ru ?? rawW.name?.ru ?? summary.weaponName.ru, { ...getLocalizedFields(rawW, 'name') }),
    element: normalizeElement(rawW.element ?? summary.element),
    elementSecondary: rawW.element_secondary ? normalizeElement(rawW.element_secondary) : summary.elementSecondary,
    role: normalizeRole(rawW.role ?? summary.role),
    rarity: normalizeRarity(rawW.rarity ?? summary.rarity),
    icon: rawW.icon || summary.icon,
    shatter: {
      value: Number(rawW.shatter?.value ?? rawW.shatter ?? 0),
      tier: String(rawW.shatter?.tier ?? rawW.shatter_tier ?? 'A'),
    },
    charge: {
      value: Number(rawW.charge?.value ?? rawW.charge ?? 0),
      tier: String(rawW.charge?.tier ?? rawW.charge_tier ?? 'A'),
    },
    type: rawW.type ?? null,
    skills: {
      normals: adaptWeaponSkillList(rawW.skills?.normals),
      dodges: adaptWeaponSkillList(rawW.skills?.dodges),
      skills: adaptWeaponSkillList(rawW.skills?.skills),
      discharges: adaptWeaponSkillList(rawW.skills?.discharges),
    },
  };

  const matrix = raw.matrix
    ? {
        suitId: raw.matrix.suit_id || '',
        suitName: createLocalizedText(raw.matrix.suit_name_en, raw.matrix.suit_name_ru, { ...getLocalizedFields(raw.matrix, 'suit_name') }),
        chipIcon: raw.matrix.chip_icon,
        suitIcon: raw.matrix.suit_icon,
      }
    : null;

  return {
    ...summary,
    baseStats,
    maxStats,
    advancements,
    traits,
    affinityLadder,
    weapon,
    matrix,
    provenance: raw.provenance ?? null,
  };
}

function adaptWeaponSkillList(list: any): WeaponSkill[] {
  if (!Array.isArray(list)) return [];
  return list.map((s: any) => ({
    id: s.id || '',
    name: createLocalizedText(s.name_en ?? s.name?.en, s.name_ru ?? s.name?.ru, { ...getLocalizedFields(s, 'name') }),
    description: createLocalizedText(s.desc_en ?? s.desc?.en, s.desc_ru ?? s.desc?.ru, { ...getLocalizedFields(s, 'desc') }),
    icon: s.icon || '',
    category: s.category || 'normal',
    cooldown: typeof s.cooldown === 'number' ? s.cooldown : null,
  }));
}
