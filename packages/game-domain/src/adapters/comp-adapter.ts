import { normalizeElement } from '../common/elements';
import { normalizeRarity } from '../common/rarities';
import { normalizeRole } from '../common/roles';
import {createLocalizedText, getLocalizedFields } from '../common/localization';
import { normalizeRelicProperty } from '../entities/relic';
import { canonicalizeCompRole, type CompRole } from '../comp/comp-role';
import type { CompSimulacrumView } from '../comp/comp-simulacrum';
import type { CompWeaponView } from '../comp/comp-weapon';
import type { CompMatrixView } from '../comp/comp-matrix';
import type { CompRelicView } from '../comp/comp-relic';
import type { CompPetView } from '../comp/comp-pet';
import type { CompCatalogView } from '../comp/comp-catalog';

export function adaptCompRole(raw: any): CompRole {
  return {
    id: canonicalizeCompRole(raw.id),
    name: createLocalizedText(raw.name_en, raw.name_ru, { ...getLocalizedFields(raw, 'name') }),
    short: createLocalizedText(raw.short_en, raw.short_ru, { ...getLocalizedFields(raw, 'short') }),
    color: raw.color || '#ffffff',
    bgColor: raw.bg_color || 'rgba(0,0,0,0.5)',
    icon: raw.icon || '',
  };
}

export function adaptCompSimulacrum(raw: any): CompSimulacrumView {
  return {
    serverMode: raw.server_mode === 'mmo' || /-mmo$/i.test(raw.id || '') ? 'mmo' : 'standard',
    season: typeof raw.season==='number' ? raw.season : undefined,
    imitationId: typeof raw.imitation_id==='string' ? raw.imitation_id : undefined,
    matrixSuitNum: typeof raw.matrix_suit_num==='number' ? raw.matrix_suit_num : undefined,
    id: raw.id || '',
    name: createLocalizedText(raw.name_en, raw.name_ru, { ...getLocalizedFields(raw, 'name') }),
    avatar: raw.avatar || '',
    traitIcon: raw.trait_icon || null,
    weaponId: raw.weapon_id || raw.id || '',
    weaponName: createLocalizedText(raw.weapon_name_en || raw.name_en, raw.weapon_name_ru || raw.name_ru, { ...getLocalizedFields(raw, 'weapon_name'), ...getLocalizedFields(raw, 'name') }),
    weaponIcon: raw.weapon_icon || raw.avatar || '',
    element: normalizeElement(raw.element),
    elementSecondary: raw.element_secondary ? normalizeElement(raw.element_secondary) : null,
    elementComboIcon: raw.element_combo_icon || null,
    role: normalizeRole(raw.role),
    roleIcon: raw.role_icon || '',
    rarity: normalizeRarity(raw.rarity),
    matrixSuitId: raw.matrix_suit_id || null,
    card: raw.card || '',
    traitName: createLocalizedText(raw.trait_name_en, raw.trait_name_ru, { ...getLocalizedFields(raw, 'trait_name') }),
    traitDesc: createLocalizedText(raw.trait_desc_en, raw.trait_desc_ru, { ...getLocalizedFields(raw, 'trait_desc') }),
  };
}

export function deriveCompWeapon(sim: CompSimulacrumView, rawSim?: any): CompWeaponView {
  const cRole = canonicalizeCompRole(sim.role);
  let matrixSuitNum: number | undefined = undefined;
  if (rawSim && typeof rawSim.matrix_suit_num === 'number') {
    matrixSuitNum = rawSim.matrix_suit_num;
  } else if (sim.matrixSuitId) {
    const m = String(sim.matrixSuitId).match(/(\d+)/);
    if (m) matrixSuitNum = parseInt(m[1], 10);
  }

  return {
    serverMode: rawSim?.server_mode === 'mmo' || /-mmo$/.test(sim.id) ? 'mmo' : 'standard',
    id: sim.id,
    weaponId: sim.weaponId || sim.id,
    simulacrumId: sim.id,
    name: sim.weaponName,
    simName: sim.name,
    element: sim.element,
    elementSecondary: sim.elementSecondary,
    elementComboIcon: sim.elementComboIcon,
    role: sim.role,
    canonicalRole: cRole,
    rarity: sim.rarity,
    matrixSuitId: sim.matrixSuitId,
    matrixSuitNum,
    season: (() => {
      if (typeof rawSim?.season === 'number' && rawSim.season > 0) return rawSim.season;
      const parsed = Number.parseInt(
        String(rawSim?.season || rawSim?.season_badge || rawSim?.season_tag || '').replace(/\D+/g, ''),
        10,
      );
      return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    })(),
    imitationId: typeof rawSim?.imitation_id === 'string' ? rawSim.imitation_id : undefined,
    releaseOrder: typeof rawSim?.release_order === 'number' ? rawSim.release_order : undefined,
    icon: sim.weaponIcon || sim.avatar,
    avatar: sim.avatar,
  };
}

export function adaptCompMatrix(raw: any): CompMatrixView {
  return {
    id: raw.id || '',
    name: createLocalizedText(raw.name_en, raw.name_ru, { ...getLocalizedFields(raw, 'name') }),
    quality: normalizeRarity(raw.quality),
    icon: raw.icon || '',
    suitPortrait: raw.suit_portrait || raw.icon || '',
    remouldIcon: raw.remould_icon || null,
    desc2p: raw.desc_2p_en || raw.desc_2p_ru ? createLocalizedText(raw.desc_2p_en, raw.desc_2p_ru, { ...getLocalizedFields(raw, 'desc_2p') }) : null,
    desc3p: raw.desc_3p_en || raw.desc_3p_ru ? createLocalizedText(raw.desc_3p_en, raw.desc_3p_ru, { ...getLocalizedFields(raw, 'desc_3p') }) : null,
    desc4p: raw.desc_4p_en || raw.desc_4p_ru ? createLocalizedText(raw.desc_4p_en, raw.desc_4p_ru, { ...getLocalizedFields(raw, 'desc_4p') }) : null,
    simulacrumId: raw.simulacrum_id || null,
    simName: raw.sim_name_en || raw.sim_name_ru ? createLocalizedText(raw.sim_name_en, raw.sim_name_ru, { ...getLocalizedFields(raw, 'sim_name') }) : null,
    carriers: Array.isArray(raw.carriers)
      ? raw.carriers.map((c: any) => ({
          id: c.id,
          name: createLocalizedText(c.name_en, c.name_ru, { ...getLocalizedFields(c, 'name') }),
          weaponName: c.weapon_name_en ? createLocalizedText(c.weapon_name_en, c.weapon_name_ru, { ...getLocalizedFields(c, 'weapon_name') }) : undefined,
          element: c.element,
          role: c.role,
        }))
      : undefined,
  };
}

export function adaptCompRelic(raw: any): CompRelicView {
  const property = normalizeRelicProperty(raw.property);
  let category: 'damage' | 'defense' | 'utility' = 'damage';
  if (property === 'Function') category = 'utility';
  else if (property === 'Defense' || property === 'Assist') category = 'defense';

  return {
    serverMode: raw.server_mode === 'mmo' || raw.edition === 'mmo' ? 'mmo' : 'standard',
    id: raw.id || '',
    name: createLocalizedText(raw.name_en, raw.name_ru, { ...getLocalizedFields(raw, 'name') }),
    quality: normalizeRarity(raw.quality),
    property,
    category,
    icon: raw.icon || '',
    desc: createLocalizedText(raw.desc_en, raw.desc_ru, { ...getLocalizedFields(raw, 'desc') }),
    stars: Array.isArray(raw.stars)
      ? raw.stars.map((s: any) => ({
          star: Number(s.star ?? 0),
          desc: createLocalizedText(s.desc_en ?? s.desc?.en, s.desc_ru ?? s.desc?.ru, { ...getLocalizedFields(s, 'desc') }),
        }))
      : [],
  };
}

export function adaptCompPet(raw: any): CompPetView {
  return {
    id: raw.id || '',
    name: createLocalizedText(raw.name_en, raw.name_ru, { ...getLocalizedFields(raw, 'name') }),
    quality: normalizeRarity(raw.quality),
    icon: raw.icon || '',
    stars: Array.isArray(raw.stars)
      ? raw.stars.map((s: any) => ({
          star: Number(s.star ?? 0),
          desc: createLocalizedText(s.desc_en ?? s.desc?.en, s.desc_ru ?? s.desc?.ru, { ...getLocalizedFields(s, 'desc') }),
        }))
      : [],
  };
}

export function adaptCompCatalog(raw: any): CompCatalogView {
  const roles: CompRole[] = Array.isArray(raw.roles)
    ? raw.roles.map(adaptCompRole)
    : [];

  const simulacra: CompSimulacrumView[] = Array.isArray(raw.simulacra)
    ? raw.simulacra.map(adaptCompSimulacrum)
    : [];

  const weapons: CompWeaponView[] = Array.isArray(raw.simulacra)
    ? raw.simulacra.map((s: any) => deriveCompWeapon(adaptCompSimulacrum(s), s))
    : [];

  const matrices: CompMatrixView[] = Array.isArray(raw.matrices)
    ? raw.matrices.map(adaptCompMatrix)
    : [];

  const relics: CompRelicView[] = Array.isArray(raw.relics)
    ? raw.relics.map(adaptCompRelic)
    : [];

  const pets: CompPetView[] = Array.isArray(raw.pets)
    ? raw.pets.map(adaptCompPet)
    : [];

  return {
    generatedAt: raw.generatedAt,
    totalSimulacra: raw.totalSimulacra ?? simulacra.length,
    totalMatrices: raw.totalMatrices ?? matrices.length,
    totalRelics: raw.totalRelics ?? relics.length,
    totalPets: raw.totalPets ?? pets.length,
    roles,
    simulacra,
    weapons,
    matrices,
    relics,
    pets,
  };
}
