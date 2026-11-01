import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { sortById, deepClone, extractLocalizedStrings } from '../split-merge';

export function normalizeFoodDataset(legacySourceDir: string): DatasetNormalizationResult {
  const foodDir = path.join(legacySourceDir, 'info', 'food', 'data');
  const foodPath = path.join(foodDir, 'food.json');
  const ingredientsPath = path.join(foodDir, 'ingredients.json');
  const potionsPath = path.join(foodDir, 'potions.json');

  const readJson = (p: string): any[] => {
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        return Array.isArray(parsed) ? parsed : parsed.items || [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const rawDishes = readJson(foodPath);
  const rawIngredients = readJson(ingredientsPath);
  const rawPotions = readJson(potionsPath);

  // 1. Dishes normalization
  const dishesCore: any[] = [];
  const dishesEn: any[] = [];
  const dishesRu: any[] = [];
  const dishesMatEn: any[] = [];
  const dishesMatRu: any[] = [];

  for (const raw of rawDishes) {
    const id = String(raw.id || '');
    const names = extractLocalizedStrings(raw, 'name');
    const effectTexts = extractLocalizedStrings(raw, 'effect_text');

    const core: Record<string, any> = {
      id,
      star: Number(raw.star ?? 0),
      rarity: raw.rarity || 'N',
      quality: raw.quality || 'ITEM_QUALITY_COMMON',
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      satiety: Number(raw.satiety ?? 0),
      has_heal: Boolean(raw.has_heal),
      icon: raw.icon || '',
      recipe: raw.recipe
        ? {
            recipe_id: raw.recipe.recipe_id,
            ingredients: Array.isArray(raw.recipe.ingredients)
              ? raw.recipe.ingredients.map((ing: any) => ({
                  id: ing.id,
                  count: ing.count,
                  is_core: ing.is_core,
                  rarity: ing.rarity,
                  icon: ing.icon,
                }))
              : [],
          }
        : null,
    };

    const overlayEn = {
      id,
      name: names.en,
      name_en: names.en,
      name_ru: names.ru,
      type: raw.type || 'Entrée',
      formatted_effects: raw.formatted_effects_en || [],
      effect_text: effectTexts.en,
      recipe: raw.recipe
        ? {
            ...core.recipe,
            ingredients: (core.recipe?.ingredients || []).map((ing: any, i: number) => {
              const rawIng = raw.recipe.ingredients[i] || {};
              const ingNames = extractLocalizedStrings(rawIng, 'name');
              return {
                ...ing,
                name: ingNames.en,
                sources: rawIng.sources_en || [],
              };
            }),
          }
        : null,
    };

    const overlayRu = {
      id,
      name: names.ru,
      name_en: names.en,
      name_ru: names.ru,
      type: raw.type_ru || raw.type || 'Основное блюдо',
      type_ru: raw.type_ru,
      formatted_effects: raw.formatted_effects_ru || raw.formatted_effects_en || [],
      effect_text: effectTexts.ru,
      recipe: raw.recipe
        ? {
            ...core.recipe,
            ingredients: (core.recipe?.ingredients || []).map((ing: any, i: number) => {
              const rawIng = raw.recipe.ingredients[i] || {};
              const ingNames = extractLocalizedStrings(rawIng, 'name');
              return {
                ...ing,
                name: ingNames.ru,
                sources: rawIng.sources_ru || rawIng.sources_en || [],
              };
            }),
          }
        : null,
    };

    const matEn = {
      ...deepClone(core),
      ...overlayEn,
    };

    const matRu = {
      ...deepClone(core),
      ...overlayRu,
    };

    dishesCore.push(core);
    dishesEn.push(overlayEn);
    dishesRu.push(overlayRu);
    dishesMatEn.push(matEn);
    dishesMatRu.push(matRu);
  }

  // 2. Ingredients normalization
  const ingredientsMatEn: any[] = [];
  const ingredientsMatRu: any[] = [];
  for (const raw of rawIngredients) {
    const names = extractLocalizedStrings(raw, 'name');
    const descs = extractLocalizedStrings(raw, 'description');
    ingredientsMatEn.push({
      ...raw,
      name: names.en,
      name_en: names.en,
      name_ru: names.ru,
      description: descs.en,
      sources: raw.sources_en || [],
    });
    ingredientsMatRu.push({
      ...raw,
      name: names.ru,
      name_en: names.en,
      name_ru: names.ru,
      description: descs.ru,
      sources: raw.sources_ru || raw.sources_en || [],
    });
  }

  // 3. Potions normalization
  const potionsMatEn: any[] = [];
  const potionsMatRu: any[] = [];
  for (const raw of rawPotions) {
    const names = extractLocalizedStrings(raw, 'name');
    const descs = extractLocalizedStrings(raw, 'description');
    potionsMatEn.push({
      ...raw,
      name: names.en,
      name_en: names.en,
      name_ru: names.ru,
      description: descs.en,
      duration_text: raw.duration_text_en,
      formatted_effects: raw.formatted_effects_en,
    });
    potionsMatRu.push({
      ...raw,
      name: names.ru,
      name_en: names.en,
      name_ru: names.ru,
      description: descs.ru,
      duration_text: raw.duration_text_ru || raw.duration_text_en,
      formatted_effects: raw.formatted_effects_ru || raw.formatted_effects_en,
    });
  }

  const sortedDishesCore = sortById(dishesCore);
  const sortedDishesEn = sortById(dishesMatEn);
  const sortedDishesRu = sortById(dishesMatRu);

  const matEn = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedDishesEn.length,
    counts: {
      dishes: sortedDishesEn.length,
      ingredients: ingredientsMatEn.length,
      potions: potionsMatEn.length,
    },
    items: sortedDishesEn,
    dishes: sortedDishesEn,
    ingredients: sortById(ingredientsMatEn),
    potions: sortById(potionsMatEn),
  };

  const matRu = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: sortedDishesRu.length,
    counts: {
      dishes: sortedDishesRu.length,
      ingredients: ingredientsMatRu.length,
      potions: potionsMatRu.length,
    },
    items: sortedDishesRu,
    dishes: sortedDishesRu,
    ingredients: sortById(ingredientsMatRu),
    potions: sortById(potionsMatRu),
  };

  return {
    datasetName: 'food',
    core: {
      schemaVersion: 1,
      total: sortedDishesCore.length,
      dishes: sortedDishesCore,
      ingredients: rawIngredients,
      potions: rawPotions,
    },
    overlays: {
      en: {
        total: dishesEn.length,
        dishes: dishesEn,
      },
      ru: {
        total: dishesRu.length,
        dishes: dishesRu,
      },
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts: {
      total: sortedDishesEn.length,
      dishes: sortedDishesEn.length,
      ingredients: ingredientsMatEn.length,
      potions: potionsMatEn.length,
    },
  };
}
