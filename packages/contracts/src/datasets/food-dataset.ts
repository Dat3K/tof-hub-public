import { z } from 'zod';

export const FoodDishRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  star: z.number().optional(),
  rarity: z.string().optional(),
  quality: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
  type_ru: z.string().optional(),
  categories: z.array(z.string()).optional(),
  satiety: z.number().optional(),
  has_heal: z.boolean().optional(),
  formatted_effects_en: z.string().optional(),
  formatted_effects_ru: z.string().optional(),
  effect_text_en: z.string().optional(),
  effect_text_ru: z.string().optional(),
  buffs: z.array(z.record(z.string(), z.unknown())).optional(),
  recipe: z.record(z.string(), z.unknown()).nullable().optional(),
  icon: z.string().optional(),
});

export const FoodIngredientRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  rarity: z.string().optional(),
  icon: z.string().optional(),
  description_en: z.string().optional(),
  description_ru: z.string().optional(),
  sources_en: z.array(z.string()).optional(),
  sources_ru: z.array(z.string()).optional(),
  used_in: z.array(z.string()).optional(),
});

export const FoodPotionRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  rarity: z.string().optional(),
  quality: z.string().optional(),
  subcategory: z.string().optional(),
  icon: z.string().optional(),
  duration: z.number().optional(),
  duration_text_en: z.string().optional(),
  duration_text_ru: z.string().optional(),
  categories: z.array(z.string()).optional(),
  satiety: z.number().optional(),
  endurance: z.number().optional(),
  speed_percent: z.number().optional(),
  atk_percent: z.number().optional(),
  atk_flat: z.number().optional(),
  formatted_effects_en: z.string().optional(),
  formatted_effects_ru: z.string().optional(),
  description_en: z.string().optional(),
  description_ru: z.string().optional(),
  buffs: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const FoodDishesDatasetSchema = z.array(FoodDishRawSchema);
export const FoodIngredientsDatasetSchema = z.array(FoodIngredientRawSchema);
export const FoodPotionsDatasetSchema = z.array(FoodPotionRawSchema);
