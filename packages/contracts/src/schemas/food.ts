import { z } from 'zod';
import { RaritySchema } from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';
import type {
  FoodBuff,
  FoodRecipeIngredient,
  FoodRecipe,
  FoodDishCore,
  FoodIngredientCore,
  FoodPotionCore,
} from '@tof-hub/game-domain';

export const FoodBuffSchema = z.object({
  buffId: z.string(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
}) as z.ZodType<FoodBuff>;

export const FoodRecipeIngredientSchema = z.object({
  id: z.string(),
  name: LocalizedTextSchema,
  count: z.number(),
  isCore: z.boolean(),
  rarity: RaritySchema,
  icon: z.string(),
  sources: z
    .object({
      en: z.array(z.string()),
      ru: z.array(z.string()),
    })
    .optional(),
}) as z.ZodType<FoodRecipeIngredient>;

export const FoodRecipeSchema = z.object({
  recipeId: z.string(),
  ingredients: z.array(FoodRecipeIngredientSchema),
}) as z.ZodType<FoodRecipe>;

export const FoodDishCoreSchema = z.object({
  stableId: z.string(),
  slug: z.string(),
  name: LocalizedTextSchema,
  star: z.number(),
  rarity: RaritySchema,
  quality: z.string(),
  type: z.string(),
  typeRu: z.string().optional(),
  categories: z.array(z.string()),
  satiety: z.number(),
  hasHeal: z.boolean(),
  effectsText: LocalizedTextSchema,
  buffs: z.array(FoodBuffSchema),
  recipe: FoodRecipeSchema.nullable(),
  icon: z.string(),
}) as z.ZodType<FoodDishCore>;

export const FoodIngredientCoreSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  icon: z.string(),
  description: LocalizedTextSchema,
  sources: z.object({
    en: z.array(z.string()),
    ru: z.array(z.string()),
  }),
  usedIn: z.array(z.string()),
}) as z.ZodType<FoodIngredientCore>;

export const FoodPotionCoreSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  quality: z.string().optional(),
  subcategory: z.string(),
  icon: z.string(),
  duration: z.number(),
  durationText: LocalizedTextSchema,
  categories: z.array(z.string()).optional(),
  satiety: z.number(),
  endurance: z.number(),
  speedPercent: z.number().optional(),
  atkPercent: z.number().optional(),
  atkFlat: z.number().optional(),
  effectsText: LocalizedTextSchema.optional(),
  buffs: z.array(FoodBuffSchema),
  description: LocalizedTextSchema,
}) as z.ZodType<FoodPotionCore>;
