import type { SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import { getStandardPetStatsAtLevel } from '@tof-hub/game-domain';
import type { Locale } from '@tof-hub/i18n';
import { SIMULACRA_STRINGS_EN, SIMULACRA_STRINGS_RU } from '../../simulacra/copy';
import { getPetsStrings } from './copy';
import { getElementLabel, getRoleLabel } from '@tof-hub/game-domain';
import type { SimulacraAssetItem, SimulacraStrings } from '../../simulacra/types';
import type { SimulacraDevData } from '../../simulacra/components/simulacra-dev-section';
import type { PetItem, PetModuleFamily } from './types';

function localizedName(
  locale: Locale,
  nameEn?: string | null,
  nameRu?: string | null,
  fallback = '',
) {
  return locale === 'ru' ? nameRu || nameEn || fallback : nameEn || nameRu || fallback;
}

function assetCategory(category: string): SimulacraAssetItem['category'] {
  switch (category) {
    case 'art':
      return 'art';
    case 'token':
      return 'avatar';
    case 'skill':
      return 'skill';
    default:
      return 'item';
  }
}

export function createPetSimulacraData(
  pet: PetItem,
  moduleFamilies: PetModuleFamily[],
): SimulacraDatasetItemRaw {
  const isMmo = pet.source_edition === 'mmo' || pet.id.toLowerCase().startsWith('mmo_');
  const assets: Array<Record<string, unknown>> = [];
  const seenPaths = new Set<string>();
  const addAsset = (
    id: string,
    category: string,
    nameEn: string,
    nameRu: string,
    path?: string | null,
  ) => {
    if (!path || seenPaths.has(path)) return;
    seenPaths.add(path);
    assets.push({
      id,
      file: path,
      name_en: nameEn,
      name_ru: nameRu,
      category: assetCategory(category),
      badge_en: category === 'module' ? 'Module' : category,
      badge_ru: category === 'module' ? 'Модуль' : category,
      pngUrl: path,
      webpUrl: path,
      unrealPath: path,
    });
  };

  addAsset(
    'pet-art',
    'art',
    `${pet.name_en || pet.name || pet.id} Artwork`,
    `Иллюстрация: ${pet.name_ru || pet.name_en || pet.name || pet.id}`,
    pet.photo || pet.photo_thumb,
  );
  addAsset(
    'pet-token',
    'token',
    `${pet.name_en || pet.name || pet.id} Token`,
    `Токен: ${pet.name_ru || pet.name_en || pet.name || pet.id}`,
    pet.token_icon || pet.token_icon_thumb,
  );

  (pet.skills || []).forEach((skill, index) => {
    const nameEn = skill.name_en || skill.name || skill.name_ru || `Skill ${index + 1}`;
    const nameRu = skill.name_ru || skill.name || skill.name_en || `Навык ${index + 1}`;
    addAsset(`pet-skill-${index + 1}`, 'skill', nameEn, nameRu, skill.icon);
  });

  const element = (pet.element_norm || pet.element || '').toLowerCase();
  const elementSuffix = element.includes('phys')
    ? 'wu'
    : element.includes('fire') || element.includes('flame')
      ? 'huo'
      : element.includes('frost') || element.includes('ice')
        ? 'bing'
        : element.includes('volt') || element.includes('electric')
          ? 'lei'
          : 'powers';
  if (element && element !== 'all') {
    addAsset(
      'pet-element',
      'element',
      `${pet.name_en || pet.name || pet.id} Element`,
      `Стихия: ${pet.name_ru || pet.name_en || pet.name || pet.id}`,
      `Hotta/Content/Resources/UI/wuqi/icon_element_${elementSuffix}`,
    );
  }

  const role = (pet.role_norm || pet.role || '').toLowerCase();
  const roleIsTank = role.includes('tank') || role.includes('def');
  addAsset(
    'pet-resonance',
    'resonance',
    roleIsTank ? 'Tank Resonance' : 'DPS Resonance',
    roleIsTank ? 'Резонанс танка' : 'Резонанс DPS',
    `Hotta/Content/Resources/UI/wuqi/icon_${roleIsTank ? 'fangyu' : 'qianggong'}`,
  );

  const petKeys = [pet.id, pet.name, pet.name_en, pet.name_ru]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase().trim());
  moduleFamilies
    .filter((module) => {
      const owners = [module.owner_id, module.owner, module.owner_en, module.owner_ru]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase().trim());
      return owners.length === 0 || owners.some((owner) => petKeys.includes(owner));
    })
    .forEach((module) => {
      const nameEn = module.name_en || module.name || module.family_id;
      const nameRu = module.name_ru || module.name_en || module.name || module.family_id;
      (module.levels || []).forEach((level) => {
        addAsset(
          `pet-module-${module.family_id}-${level.level}`,
          'module',
          `${nameEn} ★${level.level}`,
          `${nameRu} ★${level.level}`,
          level.icon || level.icon_thumb || module.icon || module.icon_thumb,
        );
      });
    });

  const levelOne = isMmo
    ? pet.stats_progression?.levels?.['1'] || Object.values(pet.stats_progression?.levels || {})[0]
    : getStandardPetStatsAtLevel(1);
  const skills = (pet.skills || []).map((skill, index) => ({
    id: `pet-skill-${index + 1}`,
    name_en: skill.name_en || skill.name || skill.name_ru,
    name_ru: skill.name_ru || skill.name || skill.name_en,
    description_en: skill.description_en || skill.description,
    description_ru: skill.description_ru || skill.description,
    action_id: skill.name_en || skill.name || `pet-skill-${index + 1}`,
  }));

  return {
    id: pet.id,
    name_en: pet.name_en || pet.name || pet.id,
    name_ru: pet.name_ru || pet.name_en || pet.name || pet.id,
    avatar_id: pet.token_icon || pet.token_icon_thumb || undefined,
    imitation_id: pet.id,
    server_mode: isMmo ? 'mmo' : 'gacha',
    edition: isMmo ? 'mmo' : 'gacha',
    rarity: pet.quality,
    element: pet.element_norm || pet.element,
    role: pet.role_norm || pet.role,
    base_stats: {
      attack: levelOne?.atk ?? '—',
      hp: '—',
      crit: levelOne?.crit ?? '—',
      shatter: '—',
      charge: '—',
    },
    advancements: (pet.stars || []).map((star) => ({
      star: star.star,
      multipliers: {
        atk_inheritance: star.atk_inheritance ?? '—',
        module_slots: star.module_slots ?? '—',
        module_load: star.module_load ?? '—',
      },
    })),
    weapon: { id: `pet-${pet.id}`, skills },
    assets,
  };
}

const petDevSources = {
  identifiers: [
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFight', label_en: 'Pet Blueprint Data Table', label_ru: 'Таблица конфигураций питомцев' },
    { path: 'Hotta/Content/Localization/Game/en/PetFight', label_en: 'English Localization', label_ru: 'Английская локализация смарт-слуг' },
    { path: 'Hotta/Content/Localization/Game/ru/PetFight', label_en: 'Russian Localization', label_ru: 'Русская локализация смарт-слуг' },
  ],
  stats: [
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFight', label_en: 'Base Stats & Scaling Table', label_ru: 'Таблица базовых характеристик' },
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFightLevel', label_en: 'Star Advancement & Level Scaling', label_ru: 'Таблица прокачки уровней и звезд' },
  ],
  advancements: [
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFightLevel', label_en: 'Star Advancement & Level Scaling', label_ru: 'Таблица прокачки уровней и звезд' },
  ],
  skills: [
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFightSkill', label_en: 'Combat Skills Blueprint Table', label_ru: 'Таблица боевых навыков' },
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFightSkillEffect', label_en: 'Skill Multipliers & Damage Curves Table', label_ru: 'Таблица эффектов и множителей навыков' },
  ],
  modules: [
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFightSkillModule', label_en: 'Module Families & Load Table', label_ru: 'Таблица семейств модулей и нагрузки' },
    { path: 'Hotta/Content/Resources/CoreBlueprints/DataTable/PetFight/DT_PetFightSkillModuleLevel', label_en: 'Module Levels & Tier Ranges Table', label_ru: 'Таблица уровней и рангов модулей' },
  ],
  assets: [
    { path: 'Hotta/Content/Resources/UI/PetFight/icon/', label_en: 'Servant Portraits & Icons Registry', label_ru: 'Реестр портретов и иконок слуг' },
    { path: 'Hotta/Content/Resources/Icon/skill/BattleRobotSkill/', label_en: 'Combat Skill Icons Registry', label_ru: 'Реестр иконок боевых навыков' },
    { path: 'Hotta/Content/Resources/Icon/pet/FightPet/', label_en: 'Skill Module & Token Art Registry', label_ru: 'Реестр артов модулей и токенов' },
  ],
} as const;

function petAssetRef(asset: { assetRef?: string } | undefined, fallback?: string | null) {
  return asset?.assetRef || fallback || '—';
}

function elementLabel(pet: PetItem, locale: Locale) {
  const element = (pet.element_norm || pet.element || '').toLowerCase();
  if (element.includes('volt') || element.includes('thunder') || element.includes('electric')) return getElementLabel('volt', locale);
  if (element.includes('frost') || element.includes('ice')) return getElementLabel('frost', locale);
  if (element.includes('fire') || element.includes('flame')) return getElementLabel('flame', locale);
  if (element.includes('phys')) return getElementLabel('phys', locale);
  return pet.element || pet.element_norm || '—';
}

export function createPetDevData(
  pet: PetItem,
  moduleFamilies: PetModuleFamily[],
  locale: Locale,
): SimulacraDevData {
  const isMmo = pet.source_edition === 'mmo' || pet.id.toLowerCase().startsWith('mmo_');
  const stars = pet.stars || [];
  const maxStar = stars[stars.length - 1];
  const petKeys = [pet.id, pet.name, pet.name_en, pet.name_ru].filter(Boolean).map((value) => String(value).toLowerCase().trim());
  const ownedModules = moduleFamilies.filter((module) => {
    const owners = [module.owner_id, module.owner, module.owner_en, module.owner_ru].filter(Boolean).map((value) => String(value).toLowerCase().trim());
    return owners.length === 0 || owners.some((owner) => petKeys.includes(owner));
  });
  const exclusiveModules = ownedModules.filter((module) => Boolean(module.owner_id || module.owner || module.owner_en || module.owner_ru));
  const universalModules = ownedModules.filter((module) => !module.owner_id && !module.owner && !module.owner_en && !module.owner_ru);
  const petStrings = getPetsStrings(locale);
  const names = { cn: petStrings.devLabelCn, category: petStrings.devLabelCategory, quality: petStrings.devLabelQuality, element: petStrings.devLabelElement, role: petStrings.devLabelRole, stars: petStrings.devLabelStars, skills: petStrings.devLabelSkills };
  const photoRef = petAssetRef(pet.media?.photo, pet.photo);
  const tokenRef = petAssetRef(pet.media?.token_icon, pet.token_icon);
  const skillRows = (pet.skills || []).map((skill, index) => ({
    name: localizedName(locale, skill.name_en, skill.name_ru, skill.name || `Skill ${index + 1}`),
    action: petStrings.devSkillAction,
    source: petAssetRef(skill.media?.icon, skill.icon),
  }));

  const moduleFields: Array<{ label: string; value: string | number }> = [];
  exclusiveModules.forEach((module) => {
    moduleFields.push({ label: petStrings.devFamilyId, value: module.family_id || module.id });
    moduleFields.push({ label: petStrings.devType, value: petStrings.devExclusive });
    moduleFields.push({ label: petStrings.devOwner, value: localizedName(locale, module.owner_en || module.owner, module.owner_ru, pet.name_en || pet.name || pet.id) });
    moduleFields.push({ label: petStrings.devLevels, value: module.levels?.length || 0 });
  });
  if (universalModules.length > 0) {
    moduleFields.push({ label: petStrings.devUniversalPool, value: `${universalModules.length} ${petStrings.devFamilies}` });
  }

  return {
    kind: 'pet',
    identifiers: [
      { label: petStrings.devPetIdentifier, value: pet.id },
      { label: names.cn, value: pet.original_name || '—' },
      { label: names.category, value: pet.category || (isMmo ? 'mmo' : 'combat') },
      { label: names.quality, value: pet.quality || '—' },
      { label: names.element, value: elementLabel(pet, locale) },
      { label: names.role, value: pet.role || pet.role_norm || '—' },
      { label: names.stars, value: stars.length },
      { label: names.skills, value: skillRows.length },
    ],
    stats: [
      { label: petStrings.atkInherit, value: isMmo ? '100%' : maxStar?.atk_inheritance || '—' },
      { label: petStrings.moduleSlots, value: isMmo ? '—' : maxStar?.module_slots ?? '—' },
      { label: petStrings.moduleLoad, value: isMmo ? '—' : maxStar?.module_load ?? '—' },
      { label: names.element, value: elementLabel(pet, locale) },
    ],
    advancements: stars.map((star) => ({
      star: star.star,
      fields: [
        { label: 'atk_inheritance', value: star.atk_inheritance || '—' },
        { label: 'module_slots', value: star.module_slots ?? '—' },
        { label: 'module_load', value: star.module_load ?? '—' },
      ],
    })),
    skills: skillRows,
    modules: moduleFields,
    assets: [
      { label: petStrings.devPhotoAsset, value: photoRef },
      { label: petStrings.devTokenAsset, value: tokenRef },
      ...skillRows.map((skill, index) => ({ label: petStrings.devSkillIconLabel.replace('{name}', skill.name || `Skill ${index + 1}`), value: skill.source })),
    ],
    rawJson: pet,
    sources: petDevSources,
  };
}

export function getPetSimulacraStrings(locale: Locale): SimulacraStrings {
  const strings = locale === 'ru' ? SIMULACRA_STRINGS_RU : SIMULACRA_STRINGS_EN;
  const petStrings = getPetsStrings(locale);
  return {
    ...strings,
    assetsFilterArt: petStrings.devAssetsFilterArt,
    assetsFilterAvatar: petStrings.devAssetsFilterAvatar,
    assetsFilterSkill: petStrings.devAssetsFilterSkill,
    assetsFilterItem: petStrings.devAssetsFilterItem,
    assetsCopyPath: petStrings.devAssetsCopyPath,
    assetsCopied: petStrings.devAssetsCopied,
    devBaseStatsTitle: petStrings.devBaseStatsTitle,
    devBaseAtk: petStrings.devBaseAtk,
    devBaseHp: petStrings.devBaseHp,
    devBaseDef: petStrings.devBaseDef,
    devBaseCrit: petStrings.devBaseCrit,
    devBaseShatter: petStrings.devBaseShatter,
    devBaseCharge: petStrings.devBaseCharge,
  };
}
