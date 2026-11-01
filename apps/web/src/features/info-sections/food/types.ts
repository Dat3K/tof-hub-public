import type { Locale } from '@tof-hub/i18n';
import type { ServerMode } from '@tof-hub/ui';

export type FoodViewTab = 'dishes' | 'ingredients' | 'potions';

export type FoodRarityFilter = 'all' | 'GOLD' | 'SSR' | 'SR' | 'R' | 'N';

export type FoodRecipeFilter = 'all' | 'has-recipe' | 'no-recipe';

export type FoodPotionSubcategory =
  | 'all'
  | 'shots'
  | 'mushrooms'
  | 'nutripastes'
  | 'utility'
  | 'drinks'
  | 'pills'
  | 'combat_food';

export interface FoodBuff {
  buff_id?: string;
  name_en?: string;
  name_ru?: string;
  description_en?: string;
  description_ru?: string;
  icon?: string | null;
}

export interface FoodRecipeIngredient {
  id: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  count: number;
  /** MMO kitchen: amount for a perfect dish (PrefectIngredientAmount). */
  perfect?: number;
  is_core?: boolean;
  rarity?: string;
  icon?: string | null;
  sources?: string[];
  sources_en?: string[];
  sources_ru?: string[];
}

/** Structured MMO buff from scripts/generators/build-mmo-food.cjs. */
export interface FoodMmoEffect {
  kind: string;
  element?: string;
  value: number | null;
  duration?: number | null;
  curve?: string | null;
}

export interface FoodDishItem {
  id: string;
  /** Raw item id when `id` carries the `mmo_` prefix. */
  item_id?: string;
  /** MMO kitchen requirements (CookRecipesDataTable_MMO). */
  cook_level?: number;
  player_level?: number;
  vitality_cost?: number;
  effects?: FoodMmoEffect[];
  star?: number;
  rarity?: string;
  quality?: string | number;
  categories?: string[];
  satiety?: number;
  has_heal?: boolean;
  icon?: string | null;
  name?: string;
  name_en?: string;
  name_ru?: string;
  type?: string;
  type_ru?: string;
  formatted_effects?: string[];
  formatted_effects_en?: string[];
  formatted_effects_ru?: string[];
  effect_text?: string;
  effect_text_en?: string;
  effect_text_ru?: string;
  description?: string;
  description_en?: string;
  description_ru?: string;
  buffs?: FoodBuff[];
  recipe?: {
    recipe_id?: string;
    ingredients?: FoodRecipeIngredient[];
  } | null;
}

export interface FoodUsedInDish {
  id: string;
  name_en?: string;
  name_ru?: string;
  icon?: string | null;
  rarity?: string;
}

export interface FoodIngredientItem {
  id: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  rarity?: string;
  icon?: string | null;
  description?: string;
  description_en?: string;
  description_ru?: string;
  sources?: string[];
  sources_en?: string[];
  sources_ru?: string[];
  used_in?: FoodUsedInDish[];
}

export interface FoodPotionItem {
  id: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  rarity?: string;
  quality?: string | number;
  subcategory?: string;
  icon?: string | null;
  duration?: number;
  duration_text?: string;
  duration_text_en?: string;
  duration_text_ru?: string;
  categories?: string[];
  satiety?: number;
  endurance?: number | null;
  speed_percent?: number | null;
  atk_percent?: number | null;
  atk_flat?: number | null;
  formatted_effects?: string[];
  formatted_effects_en?: string[];
  formatted_effects_ru?: string[];
  description?: string;
  description_en?: string;
  description_ru?: string;
  buffs?: FoodBuff[];
}

export interface FoodCornerBadge {
  icon: string;
  title: string;
  isHeal?: boolean;
}

export interface FoodStrings {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  filterCategory: string;
  tabDishes: string;
  tabIngredients: string;
  tabPotions: string;
  filterRarity: string;
  filterRecipe: string;
  hasRecipe: string;
  noRecipe: string;
  filterEffects: string;
  allEffects: string;
  all: string;
  colItem: string;
  colEffect: string;
  colRecipe: string;
  colIngredient: string;
  colSources: string;
  colUsedIn: string;
  colPotion: string;
  colPotionType: string;
  filterSubcategory: string;
  potionSub_all: string;
  potionSub_shots: string;
  potionSub_mushrooms: string;
  potionSub_nutripastes: string;
  potionSub_utility: string;
  potionSub_drinks: string;
  potionSub_pills: string;
  potionSub_combatFood: string;
  sortBy: string;
  sortDefault: string;
  sortQualityDesc: string;
  sortQualityAsc: string;
  sortBuffPercentDesc: string;
  sortBuffPercentAsc: string;
  sortNameAsc: string;
  sortNameDesc: string;
  sortIdAsc: string;
  sortIdDesc: string;
  sortEffectDesc: string;
  sortEffectAsc: string;
  sortDurationDesc: string;
  sortDurationAsc: string;
  sortCookLevelAsc: string;
  sortCookLevelDesc: string;
  loadingMmo: string;
  cookLevel: string;
  requiredLevel: string;
  vitalityCost: string;
  showing: string;
  of: string;
  recipes: string;
  ingredientsCount: string;
  potionsCount: string;
  loading: string;
  noMatches: string;
  noIngredients: string;
  noPotions: string;
  recipeIngredients: string;
  buffEffects: string;
  satietyRestoration: string;
  durationLabel: string;
  close: string;
  copied: string;
  clickToCopyId: string;
  resetFilters: string;
  instantHealing: string;
  enduranceRecovery: string;
  enduranceReduction: string;
  cleanPoison: string;
}

export interface FoodCatalogViewProps {
  initialData?: any;
  /** MMO dataset, preloaded only for direct `?server=mmo` links. */
  initialMmoData?: any;
  initialServerMode?: ServerMode | null;
  initialLocale?: string;
  initialTab?: FoodViewTab | null;
  initialSearchQuery?: string;
  initialRarity?: FoodRarityFilter | null;
  initialRecipe?: FoodRecipeFilter | null;
  initialPotionSubcategory?: FoodPotionSubcategory | null;
  initialEffects?: string[];
  initialSort?: string | null;
  initialSelectedItemId?: string | null;
}

export interface FoodDishCardProps {
  item: FoodDishItem;
  locale: Locale;
  strings: FoodStrings;
  onSelect: (dish: FoodDishItem) => void;
  onSelectIngredient?: (ingredientName: string) => void;
}

export interface FoodIngredientCardProps {
  item: FoodIngredientItem;
  locale: Locale;
  strings: FoodStrings;
  onSelectDish?: (dishId: string) => void;
}

export interface FoodPotionCardProps {
  item: FoodPotionItem;
  locale: Locale;
  strings: FoodStrings;
  onSelect: (potion: FoodPotionItem) => void;
}

export interface FoodDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: FoodDishItem | FoodPotionItem | null;
  locale: Locale;
  strings: FoodStrings;
  onSelectIngredient?: (ingredientId: string) => void;
}
