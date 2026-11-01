import { normalizeRarity } from '../common/rarities';
import { normalizeServerMode } from '../common/server-mode';
import {createLocalizedText, getLocalizedFields } from '../common/localization';
import { slugify } from '../common/identifiers';
import {
  normalizeRelicProperty,
  type RelicCore,
  type RelicDetail,
  type RelicStarEffect,
} from '../entities/relic';

export function adaptRelicCore(raw: any): RelicCore {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';
  const descEn = raw.desc_en ?? raw.desc?.en ?? raw.description_en ?? '';
  const descRu = raw.desc_ru ?? raw.desc?.ru ?? raw.description_ru ?? '';

  const id = raw.id || '';
  const stableId = raw.canonical_id || raw.id?.replace(/-mmo$/, '') || '';
  const slug = slugify(nameEn || stableId);

  return {
    id,
    stableId,
    slug,
    name: createLocalizedText(nameEn, nameRu),
    description: createLocalizedText(descEn, descRu),
    quality: normalizeRarity(raw.quality),
    property: normalizeRelicProperty(raw.property),
    serverMode: normalizeServerMode(raw.server_mode || raw.edition),
    icon: raw.attack_icon || raw.item_icon || raw.icon || '',
    cardImage: raw.card_image || raw.icon || '',
  };
}

export function adaptRelicDetail(raw: any): RelicDetail {
  const core = adaptRelicCore(raw);

  const stars: RelicStarEffect[] = Array.isArray(raw.stars)
    ? raw.stars.map((s: any) => ({
        star: Number(s.star ?? 0),
        description: createLocalizedText(s.desc_en ?? s.desc?.en, s.desc_ru ?? s.desc?.ru, { ...getLocalizedFields(s, 'desc') }),
      }))
    : [];

  return {
    ...core,
    stars,
    cooldown: typeof raw.cooldown === 'number' ? raw.cooldown : null,
    fragmentItemId: raw.fragment_item_id || null,
    abilityTag: raw.ability_tag || null,
    advanceAttributeId: raw.advance_attribute_id || null,
    drawing: raw.drawing || null,
    variants: Array.isArray(raw.variants) ? raw.variants : undefined,
  };
}
