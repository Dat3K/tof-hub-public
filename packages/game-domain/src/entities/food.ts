import type { Rarity } from '../common/rarities';
import type { LocalizedText } from '../common/localization';

export interface FoodBuff {
  buffId: string;
  name: LocalizedText;
  description: LocalizedText;
}

export interface FoodRecipeIngredient {
  id: string;
  name: LocalizedText;
  count: number;
  isCore: boolean;
  rarity: Rarity;
  icon: string;
  sources?: {
    en: string[];
    ru: string[];
  };
}

export interface FoodRecipe {
  recipeId: string;
  ingredients: FoodRecipeIngredient[];
}

export interface FoodDishCore {
  /**
   * Stable engine item identifier (e.g. item_Cooking_3013)
   */
  stableId: string;
  /**
   * URL-safe slug (e.g. cactus-special)
   */
  slug: string;
  name: LocalizedText;
  star: number;
  rarity: Rarity;
  quality: string;
  type: string;
  typeRu?: string;
  categories: string[];
  satiety: number;
  hasHeal: boolean;
  effectsText: LocalizedText;
  buffs: FoodBuff[];
  recipe: FoodRecipe | null;
  icon: string;
}

export interface FoodIngredientCore {
  /**
   * Stable ingredient identifier (e.g. Item_Area2Medicine)
   */
  stableId: string;
  name: LocalizedText;
  rarity: Rarity;
  icon: string;
  description: LocalizedText;
  sources: {
    en: string[];
    ru: string[];
  };
  usedIn: string[];
}

export interface FoodPotionCore {
  /**
   * Stable potion identifier (e.g. Item_Vera_Drinking1)
   */
  stableId: string;
  name: LocalizedText;
  rarity: Rarity;
  quality?: string;
  subcategory: string;
  icon: string;
  duration: number;
  durationText: LocalizedText;
  categories?: string[];
  satiety: number;
  endurance: number;
  speedPercent?: number;
  atkPercent?: number;
  atkFlat?: number;
  effectsText?: LocalizedText;
  buffs: FoodBuff[];
  description: LocalizedText;
}
