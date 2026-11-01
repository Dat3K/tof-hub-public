import { normalizeRarity } from '../common/rarities';
import {createLocalizedText, getLocalizedFields } from '../common/localization';
import { slugify } from '../common/identifiers';
import type {
  FoodDishCore,
  FoodIngredientCore,
  FoodPotionCore,
  FoodBuff,
  FoodRecipe,
  FoodRecipeIngredient,
} from '../entities/food';

export function adaptFoodDish(raw: any): FoodDishCore {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';
  const stableId = raw.id || '';
  const slug = slugify(nameEn || stableId);

  const buffs: FoodBuff[] = Array.isArray(raw.buffs)
    ? raw.buffs.map((b: any) => ({
        buffId: b.buff_id || '',
        name: createLocalizedText(b.name_en ?? b.name?.en, b.name_ru ?? b.name?.ru, { ...getLocalizedFields(b, 'name') }),
        description: createLocalizedText(b.description_en ?? b.desc_en, b.description_ru ?? b.desc_ru, { ...getLocalizedFields(b, 'description'), ...getLocalizedFields(b, 'desc') }),
      }))
    : [];

  let recipe: FoodRecipe | null = null;
  if (raw.recipe && typeof raw.recipe === 'object') {
    const ingredients: FoodRecipeIngredient[] = Array.isArray(raw.recipe.ingredients)
      ? raw.recipe.ingredients.map((ing: any) => ({
          id: ing.id || '',
          name: createLocalizedText(ing.name_en ?? ing.name?.en, ing.name_ru ?? ing.name?.ru, { ...getLocalizedFields(ing, 'name') }),
          count: Number(ing.count ?? 1),
          isCore: Boolean(ing.is_core),
          rarity: normalizeRarity(ing.rarity),
          icon: ing.icon || '',
          sources: ing.sources_en
            ? {
                en: Array.isArray(ing.sources_en) ? ing.sources_en : [ing.sources_en],
                ru: Array.isArray(ing.sources_ru) ? ing.sources_ru : [ing.sources_ru],
              }
            : undefined,
        }))
      : [];

    recipe = {
      recipeId: raw.recipe.recipe_id || '',
      ingredients,
    };
  }

  return {
    stableId,
    slug,
    name: createLocalizedText(nameEn, nameRu),
    star: Number(raw.star ?? 0),
    rarity: normalizeRarity(raw.rarity),
    quality: String(raw.quality ?? 'ITEM_QUALITY_COMMON'),
    type: raw.type || 'Entrée',
    typeRu: raw.type_ru,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    satiety: Number(raw.satiety ?? 0),
    hasHeal: Boolean(raw.has_heal),
    effectsText: createLocalizedText(raw.formatted_effects_en || raw.effect_text_en, raw.formatted_effects_ru || raw.effect_text_ru, { ...getLocalizedFields(raw, 'formatted_effects'), ...getLocalizedFields(raw, 'effect_text') }),
    buffs,
    recipe,
    icon: raw.icon || '',
  };
}

export function adaptFoodIngredient(raw: any): FoodIngredientCore {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';
  const descEn = raw.description_en ?? raw.desc_en ?? '';
  const descRu = raw.description_ru ?? raw.desc_ru ?? '';

  return {
    stableId: raw.id || '',
    name: createLocalizedText(nameEn, nameRu),
    rarity: normalizeRarity(raw.rarity),
    icon: raw.icon || '',
    description: createLocalizedText(descEn, descRu),
    sources: {
      en: Array.isArray(raw.sources_en) ? raw.sources_en : [],
      ru: Array.isArray(raw.sources_ru) ? raw.sources_ru : [],
    },
    usedIn: Array.isArray(raw.used_in) ? raw.used_in : [],
  };
}

export function adaptFoodPotion(raw: any): FoodPotionCore {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';
  const descEn = raw.description_en ?? raw.desc_en ?? '';
  const descRu = raw.description_ru ?? raw.desc_ru ?? '';

  const buffs: FoodBuff[] = Array.isArray(raw.buffs)
    ? raw.buffs.map((b: any) => ({
        buffId: b.buff_id || '',
        name: createLocalizedText(b.name_en ?? b.name?.en, b.name_ru ?? b.name?.ru, { ...getLocalizedFields(b, 'name') }),
        description: createLocalizedText(b.description_en ?? b.desc_en, b.description_ru ?? b.desc_ru, { ...getLocalizedFields(b, 'description'), ...getLocalizedFields(b, 'desc') }),
      }))
    : [];

  return {
    stableId: raw.id || '',
    name: createLocalizedText(nameEn, nameRu),
    rarity: normalizeRarity(raw.rarity),
    quality: raw.quality,
    subcategory: raw.subcategory || 'drinks',
    icon: raw.icon || '',
    duration: Number(raw.duration ?? 0),
    durationText: createLocalizedText(raw.duration_text_en, raw.duration_text_ru, { ...getLocalizedFields(raw, 'duration_text') }),
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    satiety: Number(raw.satiety ?? 0),
    endurance: Number(raw.endurance ?? 0),
    speedPercent: typeof raw.speed_percent === 'number' ? raw.speed_percent : undefined,
    atkPercent: typeof raw.atk_percent === 'number' ? raw.atk_percent : undefined,
    atkFlat: typeof raw.atk_flat === 'number' ? raw.atk_flat : undefined,
    effectsText: raw.formatted_effects_en ? createLocalizedText(raw.formatted_effects_en, raw.formatted_effects_ru, { ...getLocalizedFields(raw, 'formatted_effects') }) : undefined,
    buffs,
    description: createLocalizedText(descEn, descRu),
  };
}
