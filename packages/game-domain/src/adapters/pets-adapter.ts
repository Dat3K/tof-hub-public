import { normalizeElement } from '../common/elements';
import { normalizeRarity } from '../common/rarities';
import { normalizeRole } from '../common/roles';
import {createLocalizedText, getLocalizedFields } from '../common/localization';
import { slugify } from '../common/identifiers';
import type {
  SmartServantCore,
  SmartServantDetail,
  SmartServantStar,
  SmartServantSkill,
  PetModule,
} from '../entities/pet';

export function adaptSmartServantCore(raw: any): SmartServantCore {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';
  const descEn = raw.desc_en ?? raw.desc?.en ?? raw.description_en ?? '';
  const descRu = raw.desc_ru ?? raw.desc?.ru ?? raw.description_ru ?? '';

  const stableId = raw.id || '';
  const slug = slugify(nameEn || stableId);

  return {
    stableId,
    slug,
    category: raw.category === 'cute' ? 'cute' : 'combat',
    name: createLocalizedText(nameEn, nameRu),
    description: createLocalizedText(descEn, descRu),
    quality: normalizeRarity(raw.quality),
    element: normalizeElement(raw.element_norm || raw.element),
    role: normalizeRole(raw.role_norm || raw.role),
    icon: raw.icon || '',
    photo: raw.photo || raw.icon || '',
  };
}

export function adaptSmartServantDetail(raw: any): SmartServantDetail {
  const core = adaptSmartServantCore(raw);

  const stars: SmartServantStar[] = Array.isArray(raw.stars)
    ? raw.stars.map((s: any) => ({
        star: Number(s.star ?? 0),
        description: createLocalizedText(s.desc_en ?? s.desc?.en, s.desc_ru ?? s.desc?.ru, { ...getLocalizedFields(s, 'desc') }),
        atkInheritance: s.atk_inheritance,
        moduleSlots: s.module_slots,
        moduleLoad: s.module_load,
        goldCost: s.gold_cost,
        petLevelReq: s.pet_level_req,
      }))
    : [];

  const skills: SmartServantSkill[] = Array.isArray(raw.skills)
    ? raw.skills.map((sk: any) => ({
        name: createLocalizedText(sk.name_en ?? sk.name?.en, sk.name_ru ?? sk.name?.ru, { ...getLocalizedFields(sk, 'name') }),
        description: createLocalizedText(sk.desc_en ?? sk.desc?.en, sk.desc_ru ?? sk.desc?.ru, { ...getLocalizedFields(sk, 'desc') }),
        icon: sk.icon || '',
      }))
    : [];

  return {
    ...core,
    stars,
    skills,
    statsProgression: raw.stats_progression ?? null,
    tokenIcon: raw.token_icon || undefined,
  };
}

export function adaptPetModule(raw: any): PetModule {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';

  return {
    id: raw.id || '',
    groupId: raw.group_id || '',
    familyId: raw.family_id || '',
    name: createLocalizedText(nameEn, nameRu),
    owner: raw.owner || null,
    quality: normalizeRarity(raw.quality),
    needLoad: Number(raw.need_load ?? 0),
    icon: raw.icon || '',
    levels: Array.isArray(raw.levels)
      ? raw.levels.map((lvl: any) => ({
          level: Number(lvl.level ?? 0),
          description: createLocalizedText(lvl.desc_en ?? lvl.desc?.en, lvl.desc_ru ?? lvl.desc?.ru, { ...getLocalizedFields(lvl, 'desc') }),
        }))
      : [],
  };
}
