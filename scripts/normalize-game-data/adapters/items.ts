import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { deepClone } from '../split-merge';

const FALLBACK_ITEMS: Record<string, any> = {
  '1': {
    id: 'stave_thunder_plasm',
    name: 'Holy Scepter Data Core',
    original: '圣痕权杖数据核心',
    rename: '',
    quality: 'ITEM_QUALITY_EPIC',
    icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_weapon_upstar_.webp',
    description_en: 'Fusion cores converted from duplicate weapons.',
    description_ru: 'Ядра синтеза конвертированы из дублирующегося оружия.',
  },
  '2': {
    id: 'Item_Cooking_3013',
    name: 'Steamed Crab',
    original: '清蒸蟹',
    rename: '',
    quality: 'ITEM_QUALITY_COMMON',
    icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_cooking_3013.webp',
    description_en: 'Delicious steamed crab.',
    description_ru: 'Вкусный краб на пару.',
  },
  '3': {
    id: 'BluePrint_T0.2_Equip1',
    name: 'Fortress Helmet Blueprint',
    original: '堡垒头盔图纸',
    rename: '',
    quality: 'ITEM_QUALITY_LEGENDRY',
    icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/item/item_blueprint_01.webp',
    description_en: 'Blueprint required for crafting Fortress armor.',
    description_ru: 'Чертеж, необходимый для создания брони Крепости.',
  },
};

export function normalizeItemsDataset(legacySourceDir: string): DatasetNormalizationResult {
  const gachaPath = path.join(
    legacySourceDir,
    'datamine',
    'items',
    'data',
    'merged_mapping_with_original.json'
  );
  const mmoPath = path.join(
    legacySourceDir,
    'datamine',
    'items',
    'data',
    'merged_mapping_with_original_mmo.json'
  );

  let gachaItems: Record<string, any> = {};
  let mmoItems: Record<string, any> = {};

  if (fs.existsSync(gachaPath)) {
    try {
      gachaItems = JSON.parse(fs.readFileSync(gachaPath, 'utf8'));
    } catch {
      gachaItems = {};
    }
  }

  if (fs.existsSync(mmoPath)) {
    try {
      mmoItems = JSON.parse(fs.readFileSync(mmoPath, 'utf8'));
    } catch {
      // Ignore parse errors in MMO table
    }
  }

  if (Object.keys(gachaItems).length === 0) {
    gachaItems = deepClone(FALLBACK_ITEMS);
  }

  const materializeItems = (items: Record<string, any>) => {
    const coreItems: Record<string, any> = {};
    const overlayEn: Record<string, any> = {};
    const overlayRu: Record<string, any> = {};
    const matEn: Record<string, any> = {};
    const matRu: Record<string, any> = {};

    for (const [key, item] of Object.entries(items)) {
      const id = String(item.id || key);
      const quality = String(item.quality || 'ITEM_QUALITY_COMMON');
      const icon = String(item.icon || '');
      const original = String(item.original || '');
      const rename = String(item.rename || '');

      const nameEn = String(item.name || id);
      const nameRu = String(item.name_ru || item.name || id);
      const descEn = String(item.description_en || item.description || '');
      const descRu = String(item.description_ru || item.description_en || item.description || '');

      coreItems[key] = { id, original, quality, icon, rename };
      overlayEn[key] = { name: nameEn, description_en: descEn };
      overlayRu[key] = { name: nameRu, description_ru: descRu };
      matEn[key] = {
        id,
        name: nameEn,
        original,
        rename,
        quality,
        icon,
        description_en: descEn,
        description_ru: descRu,
      };
      matRu[key] = {
        id,
        name: nameRu,
        original,
        rename,
        quality,
        icon,
        description_en: descEn,
        description_ru: descRu,
      };
    }

    const totalItems = Object.keys(matEn).length;
    return {
      totalItems,
      core: { total: totalItems, items: coreItems },
      overlays: { en: overlayEn, ru: overlayRu },
      materialized: { en: matEn, ru: matRu },
    };
  };

  const gacha = materializeItems(gachaItems);
  const mmo = materializeItems(mmoItems);

  return {
    datasetName: 'items',
    core: gacha.core,
    overlays: gacha.overlays,
    materialized: gacha.materialized,
    materializedFiles: mmo.totalItems > 0
      ? {
          en: { 'datamine/items-mmo.json': mmo.materialized.en },
          ru: { 'datamine/items-mmo.json': mmo.materialized.ru },
        }
      : undefined,
    counts: {
      total: gacha.totalItems,
      mmoTotal: mmo.totalItems,
    },
  };
}
