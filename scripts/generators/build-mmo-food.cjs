const { readGameSourceFileSync } = require('../game-processors/processors/game-source-reader.ts');
// MMO food for /info/food/: the MMO kitchen (DataTable_MMO/cooking) and the MMO-server buffs of
// global food items (ItemConfigs.BuffsInServerModes). Provenance: docs/pipeline.md.
const sitePaths=require('../lib/site-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');

const RAW = sitePaths.rawDir;
const PUBLIC = sitePaths.publicDir;
const OUT_DIR = path.join(PUBLIC, 'game-data');
const LOCALES = ['en', 'ru'];

const CB = 'Hotta/Content/Resources/CoreBlueprints/';
const FILES = {
  recipes: CB + 'DataTable_MMO/cooking/CookRecipesDataTable_MMO.json',
  foods: CB + 'DataTable_MMO/cooking/CookingFoodDataTable_MMO.json',
  curves: CB + 'DataTable_MMO/EffectFigure/CookingFoodEffectFigure_MMO.json',
  items: CB + 'DataTable/Item/ItemConfigs.json',
  localization: (locale) => `Hotta/Content/Localization/Game/${locale}/Game.json`,
};

const readJson = (relative) => JSON.parse(readGameSourceFileSync(path.join(RAW, relative), 'utf8'));
const tableRows = (relative, name) => {
  const object = readJson(relative).find((entry) => entry.Rows && (!name || entry.Name === name));
  if (!object) throw new Error(`Missing rows in ${relative}`);
  return object.Rows;
};

// Same quality → rarity mapping as the existing Food dataset (EPIC SSR, RARE SR, COMMON R, POOR N).
// Preserve the separate gold quality used by MMO recipes.
const RARITY = {
  ITEM_QUALITY_LEGENDRY: 'GOLD',
  ITEM_QUALITY_EPIC: 'SSR',
  ITEM_QUALITY_RARE: 'SR',
  ITEM_QUALITY_COMMON: 'R',
  ITEM_QUALITY_POOR: 'N',
};
const rarityOf = (quality) => RARITY[quality] || 'N';

const ELEMENTS = { Phy: 'Phy', PHY: 'Phy', Fire: 'Fire', FIRE: 'Fire', Ice: 'Ice', ICE: 'Ice', Thu: 'Thunder', THU: 'Thunder', Thunder: 'Thunder' };
// Phrases follow the game's own RU buff descriptions (BuffDes_Balance).
const PHRASES = {
  en: {
    atk: { Phy: 'Physical Attack', Fire: 'Flame Attack', Ice: 'Frost Attack', Thunder: 'Volt Attack' },
    def: { Phy: 'Physical Defense', Fire: 'Flame Defense', Ice: 'Frost Defense', Thunder: 'Volt Defense' },
    damage: { Phy: 'Physical', Fire: 'Flame', Ice: 'Frost', Thunder: 'Volt' },
  },
  ru: {
    atk: { Phy: 'физическую атаку', Fire: 'атаку огнём', Ice: 'атаку льдом', Thunder: 'атаку вольтом' },
    def: { Phy: 'Физическую защиту', Fire: 'Защиту от Огня', Ice: 'Защиту от Льда', Thunder: 'Защиту от Электричества' },
    damage: { Phy: 'физического', Fire: 'огненного', Ice: 'ледяного', Thunder: 'вольтового' },
  },
};
const groupDigits = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// RU replacement for game strings that were left partly in English in this export.
function russianEffectLine(buff) {
  const value = groupDigits(buff.value);
  const stacking = 'Эффекты разных типов суммируются, а для каждого типа применяется только самый недавно полученный эффект.';
  switch (buff.kind) {
    case 'atk_flat':
      return `Увеличивает ${PHRASES.ru.atk[buff.element]} на ${value} в течение ${groupDigits(buff.duration)}с. ${stacking}`;
    case 'def_flat':
      return `Увеличивает ${PHRASES.ru.def[buff.element]} на ${value} в течение ${groupDigits(buff.duration)}с.${
        buff.tank_multiplier ? ` ${formatNumber(buff.tank_multiplier * 100)}% дополнительный эффект к Стойкости. Эта характеристика действует в бою, но не отображается на экране Характеристик Персонажа.` : ''
      } ${stacking}`;
    case 'extra_damage':
      return `Наносит ${value} дополнительного ${PHRASES.ru.damage[buff.element]} урона в течение ${groupDigits(buff.duration)}с. Перезарядка: ${buff.cooldown}с. Применяется только последний полученный эффект.`;
    case 'heal':
      return `Восстанавливает ${value} ОЗ при использовании. Перезарядка: ${buff.cooldown}с.`;
    default:
      return null;
  }
}
const hasUntranslatedEnglish = (text) => /[A-Za-z]{3,}/.test(text);
const numbersIn = (text) => new Set((stripMarkup(text).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((token) => token.replace(/,/g, '')));

const iconPath = (assetPath) => {
  if (!assetPath || assetPath === 'None') return null;
  const [asset] = assetPath.split('.');
  return `/datamine/shared/media/Hotta/Content/${asset.replace(/^\/Game\//, '')}.webp`;
};

const stripMarkup = (text) =>
  String(text ?? '')
    .replace(/<ComLbl[A-Za-z]*>([\s\S]*?)<\/>/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function loadLocalization() {
  const tables = Object.fromEntries(LOCALES.map((locale) => [locale, readJson(FILES.localization(locale))]));
  const text = (locale, ref) => {
    if (!ref?.Key) return '';
    const namespace = ref.TableId ? ref.TableId.split('.').pop() : ref.Namespace;
    return tables[locale][namespace]?.[ref.Key] ?? ref.LocalizedString ?? '';
  };
  // BuffDes_Balance keys differ from class names only in case (…_LV9 / …_Lv9).
  const buffText = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      Object.fromEntries(Object.entries(tables[locale].BuffDes_Balance || {}).map(([key, value]) => [key.toLowerCase(), value])),
    ])
  );
  return { text, buffDescription: (locale, className) => buffText[locale][className.toLowerCase()] ?? null };
}

// Blueprint GE chain: a class default object inherits unset properties from its Template.
function createEffectResolver(curves) {
  const fileCache = new Map();
  const loadObject = (reference) => {
    let file;
    let name = null;
    if (reference.startsWith('/Game/')) {
      const [asset, className] = reference.split('.');
      file = `Hotta/Content/${asset.slice('/Game/'.length)}.json`;
      name = `Default__${className}`;
    } else {
      file = `${reference.replace(/\.\d+$/, '')}.json`;
    }
    if (!fileCache.has(file)) {
      const absolute = path.join(RAW, file);
      fileCache.set(file, fs.existsSync(absolute) ? JSON.parse(readGameSourceFileSync(absolute, 'utf8')) : null);
    }
    const objects = fileCache.get(file);
    if (!objects) return null;
    return objects.find((entry) => (name ? entry.Name === name : entry.Name?.startsWith('Default__'))) ?? null;
  };

  const resolve = (reference) => {
    const properties = {};
    const chain = [];
    let current = loadObject(reference);
    while (current) {
      chain.push(current.Name.replace(/^Default__/, ''));
      for (const [key, value] of Object.entries(current.Properties || {})) if (!(key in properties)) properties[key] = value;
      const parent = current.Template?.ObjectPath;
      if (!parent || parent.startsWith('/Script')) break;
      current = loadObject(parent);
    }
    return { chain, properties };
  };

  const curveValue = (magnitude) => {
    const scalable = magnitude?.ScalableFloatMagnitude;
    if (!scalable) return null;
    const row = scalable.Curve?.RowName;
    if (!row || row === 'None') return { value: scalable.Value, curve: null };
    const point = curves[row]?.Keys?.[0];
    return point ? { value: scalable.Value * point.Value, curve: row } : { value: null, curve: row };
  };

  const modifiers = (properties) => {
    return (properties.Modifiers || []).map((info) => ({
      attribute: info.Attribute.AttributeName,
      op: info.ModifierOp?.split('::')[1] ?? null,
      ...curveValue(info.ModifierMagnitude),
    }));
  };

  return { resolve, curveValue, modifiers, curves };
}

// Structured effect of one MMO kitchen buff class.
function describeBuff(className, assetPath, effects) {
  const { chain, properties } = effects.resolve(assetPath);
  const duration = effects.curveValue(properties.DurationMagnitude);
  const base = { buff: className, chain, duration: duration?.value ?? null };
  const mods = effects.modifiers(properties);

  const attack = mods.find((mod) => /^(Phy|Fire|Ice|Thunder)AtkAdded$/.test(mod.attribute));
  if (attack) {
    const element = attack.attribute.replace('AtkAdded', '');
    return { ...base, kind: 'atk_flat', element: ELEMENTS[element], value: attack.value, curve: attack.curve };
  }
  const utility = mods.find((mod) =>
    ['MoveSpeedMult', 'JumpZVelocityMult', 'EnergyRecoverMult', 'EnergyConsumeDownMult'].includes(mod.attribute)
  );
  if (utility) return { ...base, kind: 'utility', attribute: utility.attribute, value: utility.value, curve: utility.curve };

  // Defense uses a CustomCalculationClass (TankDefUp_lv<n>) whose bytecode is not exported; the level picks the row.
  const def = className.match(/^Buff_Food_MMO_Default_DEF_(PHY|FIRE|Fire|ICE|THU)_L[Vv](\d+)_C$/);
  if (def) {
    const row = `Buff_Food_ElementDefAdd_Lv${def[2]}`;
    return {
      ...base,
      kind: 'def_flat',
      element: ELEMENTS[def[1]],
      value: effects.curves[row]?.Keys?.[0]?.Value ?? null,
      curve: row,
      // Shown in every DEF tooltip as "300% … Tenacity"; the MMC that applies it is not exported.
      tank_multiplier: effects.curves.Buff_Food_ElementDefAdd_TankUp?.Keys?.[0]?.Value ?? null,
      inferred: 'level → curve row',
    };
  }
  // On-hit extra damage: BUFFER_EVENT_SKILL_AFTER_HIT applies …ExtraDamage_Start; the level picks the curve row.
  const extra = className.match(/^Buff_Food_(Phy|Fire|Ice|Thu)ExtraDamage_Level(\d+)_C$/);
  if (extra) {
    const element = extra[1] === 'Thu' ? 'Thunder' : extra[1];
    const row = `Buff_Food_ElementExtraDamage_Lv${extra[2]}`;
    return {
      ...base,
      kind: 'extra_damage',
      element,
      value: effects.curves[row]?.Keys?.[0]?.Value ?? null,
      curve: row,
      cooldown: effects.curves.Buff_Food_ExtraDamage_CD?.Keys?.[0]?.Value ?? null,
      inferred: 'level → curve row',
    };
  }
  // Instant HP: FoodReplyHealthExecution with no curve in the GE; the level picks Buff_Food_Recover_<n>.
  const recover = className.match(/^Buff_Food_MMO_Recover_Level(\d+)_C$/);
  if (recover) {
    const row = `Buff_Food_Recover_${recover[1]}`;
    return {
      ...base,
      kind: 'heal',
      value: effects.curves[row]?.Keys?.[0]?.Value ?? null,
      curve: row,
      cooldown: effects.curves.Buff_Food_Recover_UseCD?.Keys?.[0]?.Value ?? null,
      inferred: 'level → curve row',
    };
  }
  if (className === 'GE_UseCoolDown_MMO_C') return { ...base, kind: 'use_cooldown', value: duration?.value ?? null };
  return { ...base, kind: 'unknown', value: null };
}

const formatNumber = (value) => (Number.isInteger(value) ? value : Number(value.toFixed(4)));
const durationText = (seconds) => ({
  en: `${seconds}s (${Math.round(seconds / 60)}m)`,
  ru: `${seconds} сек. (${Math.round(seconds / 60)} мин.)`,
});

function main() {
  const loc = loadLocalization();
  const curves = tableRows(FILES.curves);
  const effects = createEffectResolver(curves);
  const recipes = tableRows(FILES.recipes);
  const foods = tableRows(FILES.foods);
  const itemRows = tableRows(FILES.items, 'ItemConfigs');
  const gacha = Object.fromEntries(
    LOCALES.map((locale) => [locale, JSON.parse(readGameSourceFileSync(path.join(OUT_DIR, locale, 'food.json'), 'utf8'))])
  );
  const gachaIngredients = Object.fromEntries(gacha.en.ingredients.map((entry) => [entry.id, entry]));
  const gachaPotions = Object.fromEntries(gacha.en.potions.map((entry) => [entry.id, entry]));
  const warnings = [];

  // 1. MMO kitchen. The quest recipe (ShowQuestID) is not part of the in-game 153 recipe list.
  const visibleRecipes = Object.entries(recipes).filter(([, recipe]) => recipe.ShowQuestID === 'None');
  const dishes = visibleRecipes.map(([recipeId, recipe]) => {
    const row = foods[recipe.FoodItemID];
    if (!row) throw new Error(`Recipe ${recipeId} points to missing ${recipe.FoodItemID}`);
    const buffs = (row.Buffs || []).map((buff) => {
      const assetPath = buff.BuffClass.AssetPathName;
      return describeBuff(assetPath.split('.').pop(), assetPath, effects);
    });
    const displayed = buffs.filter((buff) => buff.kind !== 'use_cooldown');
    // Every value must also appear in the game's own buff description (the in-game tooltip text).
    for (const buff of displayed) {
      const description = loc.buffDescription('en', buff.buff.replace(/_C$/, ''));
      const expected = buff.kind === 'utility' ? formatNumber(buff.value * 100) : formatNumber(buff.value ?? NaN);
      if (buff.value === null || buff.kind === 'unknown') warnings.push(`${recipe.FoodItemID}: unresolved ${buff.buff}`);
      else if (!description) warnings.push(`${recipe.FoodItemID}: no BuffDes_Balance text for ${buff.buff}`);
      else if (!numbersIn(description).has(String(expected))) warnings.push(`${recipe.FoodItemID}: ${buff.buff}=${expected} not in BuffDes text`);
    }
    const effectLines = (locale) => {
      const lines = displayed
        .map((buff) => {
          const text = loc.buffDescription(locale, buff.buff.replace(/_C$/, ''));
          if (!text) return null;
          const plain = stripMarkup(text);
          return locale === 'ru' && hasUntranslatedEnglish(plain) ? russianEffectLine(buff) ?? plain : plain;
        })
        .filter(Boolean);
      // Satiety dishes carry no buff: UseDescription keeps the game's {0} placeholder (shown as "—").
      return lines.length ? lines : [stripMarkup(loc.text(locale, row.UseDescription))].filter(Boolean);
    };
    return {
      id: `mmo_${recipe.FoodItemID}`,
      item_id: recipe.FoodItemID,
      recipe_id: recipeId,
      star: row.FoodStar || 0,
      quality: row.ItemQuality,
      rarity: rarityOf(row.ItemQuality),
      categories: row.Categories || [],
      has_heal: (row.Categories || []).includes('AddHealth'),
      satiety: null,
      icon: iconPath(row.ItemIcon?.AssetPathName),
      cook_level: recipe.NeedCookLevel,
      player_level: recipe.NeedPlayerLevel,
      vitality_cost: recipe.NeedPhysicsStrength,
      effects: buffs.map(({ chain, ...buff }) => buff),
      names: Object.fromEntries(LOCALES.map((locale) => [locale, loc.text(locale, row.ItemName) || recipe.FoodItemID])),
      descriptions: Object.fromEntries(LOCALES.map((locale) => [locale, stripMarkup(loc.text(locale, row.Description))])),
      lines: Object.fromEntries(LOCALES.map((locale) => [locale, effectLines(locale)])),
      ingredients: recipe.Ingredients.map((ingredient) => ({
        id: ingredient.DesignedItemsID[0],
        count: ingredient.MinNeedIngredientAmount,
        perfect: ingredient.PrefectIngredientAmount,
        is_core: Boolean(ingredient.bIsCore),
      })),
    };
  });

  // 2. Ingredients used by the MMO kitchen; existing Food entries keep their names, sources and art.
  const ingredientIds = [...new Set(dishes.flatMap((dish) => dish.ingredients.map((ingredient) => ingredient.id)))];
  const ingredientInfo = Object.fromEntries(
    ingredientIds.map((id) => {
      const known = gachaIngredients[id];
      if (known) return [id, { known, rarity: known.rarity, icon: known.icon }];
      const row = itemRows[id];
      if (!row) {
        warnings.push(`ingredient ${id} missing from ItemConfigs`);
        return [id, { rarity: 'N', icon: null, names: { en: id, ru: id }, descriptions: { en: '', ru: '' } }];
      }
      return [
        id,
        {
          rarity: rarityOf(row.ItemQuality),
          icon: iconPath(row.ItemIcon?.AssetPathName),
          mmoOnly: row.AvailableServerMode === 'EHottaServerModeLimit::MMOServerOnly',
          names: Object.fromEntries(LOCALES.map((locale) => [locale, loc.text(locale, row.ItemName) || id])),
          descriptions: Object.fromEntries(LOCALES.map((locale) => [locale, stripMarkup(loc.text(locale, row.Description))])),
        },
      ];
    })
  );

  // 3. Global food items with an MMO-server buff override (all keyed EHottaServerMode::MMOServer).
  const potions = Object.entries(itemRows)
    .filter(([, row]) => row.BuffsInServerModes?.length)
    .flatMap(([id, row]) =>
      row.BuffsInServerModes.filter((entry) => entry.Key === 'EHottaServerMode::MMOServer').map((entry) => {
        const buff = entry.Value.Buffs[0];
        const className = buff.BuffClass.AssetPathName.split('.').pop();
        const element = className.match(/^buff_Add(Phy|Fire|Ice|Thunder)AtkFoodBase_MMO_C$/)?.[1];
        if (!element) warnings.push(`${id}: unexpected MMO buff ${className}`);
        const { fDuration: duration, fStrengthMult: strengthMult, fStrengthAdd: strengthAdd } = buff.ModifyData;
        const known = gachaPotions[id];
        return {
          id: `mmo_${id}`,
          item_id: id,
          quality: row.ItemQuality,
          rarity: known?.rarity ?? rarityOf(row.ItemQuality),
          // Existing Food grouping when the item is already listed; otherwise by item family.
          subcategory: known?.subcategory ?? (/_Drinking/.test(id) ? 'drinks' : 'combat_food'),
          icon: known?.icon ?? iconPath(row.ItemIcon?.AssetPathName),
          categories: element ? [`${element}Atk`] : [],
          duration,
          // SetByCaller *AtkMult: fStrengthMult read as the ATK fraction (inference, see README).
          atk_percent: element ? Number((strengthMult * 100).toFixed(4)) : null,
          effects: [{ kind: 'atk_percent', element, value: strengthMult, duration, buff: className, inferred: 'fStrengthMult → SetByCaller' }],
          raw: { fStrengthMult: strengthMult, fStrengthAdd: strengthAdd },
          names: Object.fromEntries(LOCALES.map((locale) => [locale, loc.text(locale, row.ItemName) || id])),
          descriptions: Object.fromEntries(LOCALES.map((locale) => [locale, stripMarkup(loc.text(locale, row.Description))])),
        };
      })
    );

  const version = (() => {
    try {
      const value = readJson('export-version.json');
      return { version: value.version, branch: value.branch, lastUpdate: value.lastUpdateIso };
    } catch {
      return null;
    }
  })();

  for (const locale of LOCALES) {
    const other = locale === 'en' ? 'ru' : 'en';
    const ingredientEntry = (id, extra = {}) => {
      const info = ingredientInfo[id];
      const known = info.known;
      const name_en = known ? known.name_en : info.names.en;
      const name_ru = known ? known.name_ru : info.names.ru;
      return {
        id,
        name: locale === 'ru' ? name_ru : name_en,
        name_en,
        name_ru,
        rarity: info.rarity,
        icon: info.icon,
        sources: known ? known[`sources_${locale}`] ?? [] : [],
        ...extra,
      };
    };
    const localizedDishes = dishes.map((dish) => ({
      id: dish.id,
      item_id: dish.item_id,
      star: dish.star,
      rarity: dish.rarity,
      quality: dish.quality,
      categories: dish.categories,
      satiety: dish.satiety,
      has_heal: dish.has_heal,
      icon: dish.icon,
      cook_level: dish.cook_level,
      player_level: dish.player_level,
      vitality_cost: dish.vitality_cost,
      effects: dish.effects,
      recipe: {
        recipe_id: dish.recipe_id,
        ingredients: dish.ingredients.map((ingredient) =>
          ingredientEntry(ingredient.id, { count: ingredient.count, perfect: ingredient.perfect, is_core: ingredient.is_core })
        ),
      },
      name: dish.names[locale],
      name_en: dish.names.en,
      name_ru: dish.names.ru,
      formatted_effects: dish.lines[locale],
      formatted_effects_en: dish.lines.en,
      formatted_effects_ru: dish.lines.ru,
      effect_text: dish.lines[locale].join(' '),
      description: dish.descriptions[locale],
      description_en: dish.descriptions.en,
      description_ru: dish.descriptions.ru,
    }));
    const localizedIngredients = ingredientIds.map((id) => {
      const info = ingredientInfo[id];
      const known = info.known;
      const usedIn = dishes
        .filter((dish) => dish.ingredients.some((ingredient) => ingredient.id === id))
        .map((dish) => ({ id: dish.id, name_en: dish.names.en, name_ru: dish.names.ru, icon: dish.icon, rarity: dish.rarity }));
      return {
        id,
        name_en: known ? known.name_en : info.names.en,
        name_ru: known ? known.name_ru : info.names.ru,
        rarity: info.rarity,
        icon: info.icon,
        description_en: known ? known.description_en : info.descriptions.en,
        description_ru: known ? known.description_ru : info.descriptions.ru,
        sources_en: known?.sources_en ?? [],
        sources_ru: known?.sources_ru ?? [],
        ...(info.mmoOnly ? { mmo_only: true } : {}),
        used_in: usedIn,
      };
    });
    const potionLine = (potion, target) => {
      const attack = PHRASES[target].atk[potion.categories[0]?.replace('Atk', '')] ?? '';
      return target === 'ru'
        ? `Увеличивает ${attack} на ${potion.atk_percent}% в течение ${groupDigits(potion.duration)}с.`
        : `Increases ${attack} by ${potion.atk_percent}% for ${groupDigits(potion.duration)}s.`;
    };
    const localizedPotions = potions.map((potion) => {
      const durations = durationText(potion.duration);
      return {
        id: potion.id,
        item_id: potion.item_id,
        name: potion.names[locale],
        name_en: potion.names.en,
        name_ru: potion.names.ru,
        rarity: potion.rarity,
        quality: potion.quality,
        subcategory: potion.subcategory,
        icon: potion.icon,
        duration: potion.duration,
        duration_text: durations[locale],
        duration_text_en: durations.en,
        duration_text_ru: durations.ru,
        categories: potion.categories,
        satiety: null,
        endurance: null,
        speed_percent: null,
        atk_percent: potion.atk_percent,
        atk_flat: null,
        effects: potion.effects,
        raw: potion.raw,
        formatted_effects: [potionLine(potion, locale)],
        formatted_effects_en: [potionLine(potion, 'en')],
        formatted_effects_ru: [potionLine(potion, 'ru')],
        description: potion.descriptions[locale] || potion.descriptions[other],
        description_en: potion.descriptions.en,
        description_ru: potion.descriptions.ru,
      };
    });

    const output = {
      schemaVersion: 1,
      source: {
        raw: version,
        files: [FILES.recipes, FILES.foods, FILES.curves, FILES.items, FILES.localization(locale)],
        generator: 'scripts/generators/build-mmo-food.cjs',
      },
      counts: { dishes: localizedDishes.length, ingredients: localizedIngredients.length, potions: localizedPotions.length },
      items: localizedDishes,
      ingredients: localizedIngredients,
      potions: localizedPotions,
    };
    fs.writeFileSync(path.join(OUT_DIR, locale, 'food-mmo.json'), JSON.stringify(output, null, 2) + '\n');
  }

  console.log(`MMO food: ${dishes.length} dishes, ${ingredientIds.length} ingredients, ${potions.length} potions`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
}

main();
