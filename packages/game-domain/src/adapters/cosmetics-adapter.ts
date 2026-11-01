import { normalizeRarity } from '../common/rarities';
import {createLocalizedText, getLocalizedFields } from '../common/localization';
import type {
  AvatarCosmetic,
  AvatarFrameCosmetic,
  ChatBackgroundCosmetic,
  MountCosmetic,
  OutfitCosmetic,
  TitleCosmetic,
  CutePetCosmetic,
} from '../entities/cosmetic';

export function adaptAvatar(raw: any): AvatarCosmetic {
  return {
    stableId: raw.id || '',
    name: createLocalizedText(raw.name_en ?? raw.name?.en, raw.name_ru ?? raw.name?.ru, { ...getLocalizedFields(raw, 'name') }),
    rarity: normalizeRarity(raw.rarity || raw.quality),
    quality: String(raw.quality ?? raw.rarity ?? 'SSR'),
    icon: raw.icon || '',
  };
}

export function adaptAvatarFrame(raw: any): AvatarFrameCosmetic {
  return {
    stableId: raw.id || '',
    name: createLocalizedText(raw.name_en ?? raw.name?.en, raw.name_ru ?? raw.name?.ru, { ...getLocalizedFields(raw, 'name') }),
    rarity: normalizeRarity(raw.rarity || raw.quality),
    quality: String(raw.quality ?? raw.rarity ?? 'SSR'),
    description: createLocalizedText(raw.description_en ?? raw.desc_en, raw.description_ru ?? raw.desc_ru, { ...getLocalizedFields(raw, 'description'), ...getLocalizedFields(raw, 'desc') }),
    icon: raw.icon || '',
  };
}

export function adaptChatBackground(raw: any): ChatBackgroundCosmetic {
  return {
    stableId: raw.id || '',
    name: createLocalizedText(raw.name_en ?? raw.name?.en, raw.name_ru ?? raw.name?.ru, { ...getLocalizedFields(raw, 'name') }),
    rarity: normalizeRarity(raw.rarity || raw.quality),
    quality: String(raw.quality ?? raw.rarity ?? 'SSR'),
    description: createLocalizedText(raw.description_en ?? raw.desc_en, raw.description_ru ?? raw.desc_ru, { ...getLocalizedFields(raw, 'description'), ...getLocalizedFields(raw, 'desc') }),
    icon: raw.icon || '',
  };
}

export function adaptMount(raw: any): MountCosmetic {
  return {
    stableId: raw.id || '',
    name: createLocalizedText(raw.name_en ?? raw.name?.en, raw.name_ru ?? raw.name?.ru, { ...getLocalizedFields(raw, 'name') }),
    rarity: normalizeRarity(raw.rarity || raw.quality),
    quality: String(raw.quality ?? raw.rarity ?? 'SSR'),
    description: createLocalizedText(raw.desc_en ?? raw.description_en, raw.desc_ru ?? raw.description_ru, { ...getLocalizedFields(raw, 'desc'), ...getLocalizedFields(raw, 'description') }),
    unlock: createLocalizedText(raw.unlock_en, raw.unlock_ru, { ...getLocalizedFields(raw, 'unlock') }),
    source: createLocalizedText(raw.source_en, raw.source_ru, { ...getLocalizedFields(raw, 'source') }),
    fashionType: raw.fashion_type,
    movementType: raw.movement_type,
    mountType: raw.mount_type,
    icon: raw.icon || '',
    photo: raw.photo || raw.icon || '',
    maxLevel: typeof raw.max_level === 'number' ? raw.max_level : undefined,
    maxStrengthenLevel: typeof raw.max_strengthen_level === 'number' ? raw.max_strengthen_level : undefined,
  };
}

export function adaptOutfit(raw: any): OutfitCosmetic {
  return {
    stableId: raw.id || '',
    name: createLocalizedText(raw.name_en ?? raw.name?.en, raw.name_ru ?? raw.name?.ru, { ...getLocalizedFields(raw, 'name') }),
    description: createLocalizedText(raw.desc_en ?? raw.description_en, raw.desc_ru ?? raw.description_ru, { ...getLocalizedFields(raw, 'desc'), ...getLocalizedFields(raw, 'description') }),
    fashionType: raw.fashion_type || 'Dress',
    quality: String(raw.quality ?? 'SSR'),
    sortOrder: Number(raw.sort_order ?? 0),
    icon: raw.icon || '',
    isSimulacrum: Boolean(raw.is_simulacrum),
  };
}

export function adaptTitle(raw: any): TitleCosmetic {
  return {
    stableId: raw.id || '',
    name: createLocalizedText(raw.name_en ?? raw.name?.en, raw.name_ru ?? raw.name?.ru, { ...getLocalizedFields(raw, 'name') }),
    rarity: normalizeRarity(raw.rarity || raw.quality),
    quality: String(raw.quality ?? raw.rarity ?? 'SSR'),
    description: createLocalizedText(raw.description_en ?? raw.desc_en, raw.description_ru ?? raw.desc_ru, { ...getLocalizedFields(raw, 'description'), ...getLocalizedFields(raw, 'desc') }),
    icon: raw.icon || '',
  };
}

export function adaptCutePet(raw: any): CutePetCosmetic {
  return {
    stableId: raw.id || '',
    name: createLocalizedText(raw.name_en ?? raw.name?.en, raw.name_ru ?? raw.name?.ru, { ...getLocalizedFields(raw, 'name') }),
    description: createLocalizedText(raw.desc_en ?? raw.description_en, raw.desc_ru ?? raw.description_ru, { ...getLocalizedFields(raw, 'desc'), ...getLocalizedFields(raw, 'description') }),
    fashionType: raw.fashion_type || '',
    quality: String(raw.quality ?? 'SSR'),
    sortOrder: Number(raw.sort_order ?? 0),
    petType: raw.pet_type || '',
    subType: createLocalizedText(raw.sub_type_en, raw.sub_type_ru, { ...getLocalizedFields(raw, 'sub_type') }),
    icon: raw.icon || '',
  };
}
