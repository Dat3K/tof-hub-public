import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { sortById, deepClone, extractLocalizedStrings } from '../split-merge';

export interface EnemyAssetSource {
  /** Directory under Hotta/Content/Resources/, e.g. 'UI/void/boss'. */
  subDir: string;
  /** Tag used in item ids to keep the two sources distinct. */
  sourceTag: 'void' | 'worldboss';
  /** Keep predicate on the file name (with extension). */
  keep: (fileName: string) => boolean;
}

export const ENEMY_ASSET_SOURCES: EnemyAssetSource[] = [
  // UI\void\boss: every opponent starting with bigboss.
  { subDir: 'UI/void/boss', sourceTag: 'void', keep: (fileName) => /^bigboss/i.test(fileName) },
  // UI\WorldBossList\BOSS: everything without _yuan in the name.
  { subDir: 'UI/WorldBossList/BOSS', sourceTag: 'worldboss', keep: (fileName) => !/_yuan/i.test(fileName) },
];

const ENEMY_THUMB_SUFFIX = '.thumb.webp';
const ENEMY_MEDIA_PREFIX = '/datamine/shared/media/Hotta/Content/Resources/';

export function prettifyEnemyAssetName(baseName: string): string {
  const spaced = baseName.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface EnemyKnownName {
  en: string;
  ru: string;
}

/**
 * Hand-verified enemy names keyed by lowercased asset base name, sourced
 * from data already in the repo: FCE boss cards (standard roster wins when
 * MMO reuses the portrait), OOW boss resolution and seq enemy names.
 * Assets missing here fall back to the prettified file name.
 */
export const ENEMY_KNOWN_NAMES: Record<string, EnemyKnownName> = {
  // FCE roster (fce-data.ts, art field). Portraits shared by two different
  // bosses (bigboss015 Apophis/Sobek, bigboss069 Hive Mother/Eva,
  // bigboss_sy_02 Valkyrie/Gaia) are deliberately absent: any single name
  // would be wrong, so they fall back to the file name.
  bigboss001: { en: 'Robarg', ru: 'Робарг' },
  bigboss002: { en: 'Minotaur', ru: 'Минотавр' },
  bigboss003: { en: 'Minotaur', ru: 'Минотавр' },
  bigboss004: { en: 'Chiron', ru: 'Хирон' },
  bigboss005: { en: 'Franken', ru: 'Франкен' },
  bigboss008: { en: 'Frost Bot', ru: 'Фрост Бот' },
  bigboss012: { en: 'Frigg', ru: 'Фригг' },
  bigboss016: { en: 'Valkyrie', ru: 'Валькирия' },
  bigboss018: { en: 'Habaka', ru: 'Хабака' },
  bigboss020: { en: 'Sweetie', ru: 'Милашка' },
  bigboss025: { en: 'Xing Tian', ru: 'Син Тянь' },
  bigboss036: { en: 'Culton', ru: 'Калтон' },
  bigboss059: { en: 'Black Crow', ru: 'Чёрный ворон' },
  bigboss060: { en: 'Gu Chen', ru: 'Гу Чэнь' },
  bigboss061: { en: 'Ying Zhao', ru: 'Ин Чжао' },
  bigboss065: { en: 'Merbelle', ru: 'Мербелль' },
  bigboss073: { en: 'Asurada', ru: 'Асурада' },
  bigboss074: { en: 'Scorpion', ru: 'Скорпион' },
  bigboss075: { en: 'Sphere', ru: 'Сфера' },
  bigboss078: { en: 'Ground Controller', ru: 'Наземный контроллер' },
  bigboss079: { en: 'Defender', ru: 'Защитник' },
  bigboss_fl: { en: 'Fei Lian', ru: 'Фэй Лянь' },
  bigboss_nd: { en: 'Nanto', ru: 'Нанто' },
  bigboss_sy_01: { en: 'Rudolph', ru: 'Рудольф' },
  bigboss_sy_03: { en: 'Barbarossa', ru: 'Барбаросса' },
  bigboss_sy_05: { en: 'Singer', ru: 'Сингер' },
  bigboss_sy_06: { en: 'Seraph', ru: 'Сераф' },
  bigboss_sy_062: { en: 'Nan Yin', ru: 'Нань Инь' },
  bigboss_sy_064: { en: 'Hive Mother', ru: 'Улей-Мать' },
  bigboss_sy_07: { en: 'Hyena Mech', ru: 'Гиена-Мех' },
  bigboss_sy_08: { en: 'Chaos Armor', ru: 'Хаос Армор' },
  bigboss_sy_09: { en: 'Jormungand', ru: 'Йормунганд' },
  bigboss_sy_10: { en: 'Zhuyan', ru: 'Чжуянь' },
  bigboss_sy_11: { en: 'Iron Tomb', ru: 'Саркофаг' },
  // FCE MMO roster portraits.
  world_boss_4: { en: 'Sobek', ru: 'Собек' },
  // OOW boss resolution (oow-domain.ts).
  bigboss009: { en: 'Seele', ru: 'Зеле' },
  bigboss010: { en: 'Aegis', ru: 'Эгида' },
  boss_7: { en: 'Devourer', ru: 'Пожиратель' },
  // Seq enemy names (seq-data.ts).
  bigboss024: { en: 'Taotie', ru: 'Таоте' },
};

export function resolveEnemyName(baseName: string): EnemyKnownName {
  const known = ENEMY_KNOWN_NAMES[baseName.toLowerCase()];
  if (known) return known;
  const fallback = prettifyEnemyAssetName(baseName);
  return { en: fallback, ru: fallback };
}

export interface EnemyCosmeticSeed {
  id: string;
  name_en: string;
  name_ru: string;
  icon: string;
}

/**
 * Scans the public game-assets webp mirror and builds one cosmetic item per
 * enemy portrait. Only files present on disk become items, so every emitted
 * icon is guaranteed servable; thumbnails are never items.
 */
/**
 * Enemy cosmetics come from the boss textures themselves. With `rawSourceDir`
 * the raw export's PNGs are listed (a fresh pipeline run); otherwise the
 * already-published WebP mirror under `publicDir` is used. Either way the
 * public URL is the WebP the media export produces for that texture.
 */
export function collectEnemyCosmeticItems(publicDir: string, rawSourceDir?: string, preservedMediaDir?: string): EnemyCosmeticSeed[] {
  const seeds: EnemyCosmeticSeed[] = [];
  const listing = (dir: string, toWebp: boolean): string[] => {
    try {
      return fs.readdirSync(dir).map((name) => (toWebp ? name.replace(/\.png$/i, '.webp') : name));
    } catch {
      return [];
    }
  };
  for (const source of ENEMY_ASSET_SOURCES) {
    // Raw boss textures, plus the preserved archive for bosses no longer in the client.
    const files = rawSourceDir
      ? [...new Set([
          ...listing(path.join(rawSourceDir, 'Hotta', 'Content', 'Resources', source.subDir), true),
          ...(preservedMediaDir ? listing(path.join(preservedMediaDir, 'Hotta', 'Content', 'Resources', source.subDir), true) : []),
        ])]
      : listing(path.join(publicDir, 'game-assets', 'webp', 'Hotta', 'Content', 'Resources', source.subDir), false);
    if (files.length === 0) continue;
    for (const file of files) {
      if (!/\.webp$/i.test(file)) continue;
      if (file.toLowerCase().endsWith(ENEMY_THUMB_SUFFIX)) continue;
      if (!source.keep(file)) continue;
      const base = file.replace(/\.webp$/i, '');
      const names = resolveEnemyName(base);
      seeds.push({
        id: `enemy_${source.sourceTag}_${base.toLowerCase()}`,
        name_en: names.en,
        name_ru: names.ru,
        icon: `${ENEMY_MEDIA_PREFIX}${source.subDir}/${file}`,
      });
    }
  }
  return seeds.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export interface NormalizeCosmeticsOptions {
  /** apps/web/public mirror with game-assets/webp. Defaults to <legacySourceDir>/apps/web/public. */
  publicDir?: string;
  /** Raw export root; when set, enemy textures are listed from it instead of the published mirror. */
  rawSourceDir?: string;
  /** Preserved game media (bosses removed from the current client). */
  preservedMediaDir?: string;
}

export interface EnemyCategoryEntries {
  core: any[];
  overlayEn: any[];
  overlayRu: any[];
  matEn: any[];
  matRu: any[];
}

/**
 * Builds the core/overlay/materialized rows for enemy seeds in the exact
 * shape the dataset assembly uses. Shared by the pipeline and the local
 * merge tooling so both produce identical rows.
 */
export function buildEnemyCategoryEntries(seeds: EnemyCosmeticSeed[]): EnemyCategoryEntries {
  const core: any[] = [];
  const overlayEn: any[] = [];
  const overlayRu: any[] = [];
  const matEn: any[] = [];
  const matRu: any[] = [];
  for (const seed of seeds) {
    const coreRow = {
      id: seed.id,
      category: 'enemies',
      rarity: 'SSR',
      quality: 'SSR',
      icon: seed.icon,
      photo: seed.icon,
      fashion_type: 'Enemy',
      movement_type: null,
      mount_type: null,
      active_source: '',
      sort_order: 0,
      is_simulacrum: false,
    };
    const overlayEnRow = {
      id: seed.id,
      category: 'enemies',
      name: seed.name_en,
      name_en: seed.name_en,
      name_ru: seed.name_ru,
      description: '',
      desc_en: '',
      unlock: '',
      source: '',
      sub_type: '',
    };
    const overlayRuRow = {
      ...overlayEnRow,
      name: seed.name_ru,
    };
    core.push(coreRow);
    overlayEn.push(overlayEnRow);
    overlayRu.push(overlayRuRow);
    matEn.push({ ...deepClone(coreRow), ...overlayEnRow });
    matRu.push({ ...deepClone(coreRow), ...overlayRuRow });
  }
  return {
    core: sortById(core),
    overlayEn: sortById(overlayEn),
    overlayRu: sortById(overlayRu),
    matEn: sortById(matEn),
    matRu: sortById(matRu),
  };
}

export function normalizeCosmeticsDataset(
  legacySourceDir: string,
  options?: NormalizeCosmeticsOptions
): DatasetNormalizationResult {
  const cosmeticsDir = path.join(legacySourceDir, 'info', 'cosmetics', 'data');

  const readCategory = (filename: string): any[] => {
    const fullPath = path.join(cosmeticsDir, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        return Array.isArray(parsed) ? parsed : parsed.items || [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const filesMap: Record<string, string> = {
    avatars: 'avatars.json',
    chatStickers: 'chat-stickers.json',
    badges: 'badges.json',
    avatarFrames: 'avatarFrames.json',
    chatBackgrounds: 'chatBackgrounds.json',
    mounts: 'mounts.json',
    outfits: 'outfits.json',
    titles: 'titles.json',
    cutePets: 'cute-pets.json',
  };

  const coreCategories: Record<string, any[]> = {};
  const overlayEnCategories: Record<string, any[]> = {};
  const overlayRuCategories: Record<string, any[]> = {};
  const matEnCategories: Record<string, any[]> = {};
  const matRuCategories: Record<string, any[]> = {};

  const allMatEn: any[] = [];
  const allMatRu: any[] = [];

  for (const [catKey, filename] of Object.entries(filesMap)) {
    const rawList = readCategory(filename);
    const coreList: any[] = [];
    const enList: any[] = [];
    const ruList: any[] = [];
    const matEnList: any[] = [];
    const matRuList: any[] = [];

    for (const raw of rawList) {
      const id = String(raw.id || '');
      const names = extractLocalizedStrings(raw, 'name');
      const descriptionStrings = extractLocalizedStrings(raw, 'description');
      const legacyDescriptionStrings = extractLocalizedStrings(raw, 'desc');
      const descs = {
        en: descriptionStrings.en || legacyDescriptionStrings.en,
        ru: descriptionStrings.ru || legacyDescriptionStrings.ru,
      };
      const displayIcon = raw.icon || raw.photo || '';

      const core: Record<string, any> = {
        id,
        category: catKey,
        rarity: raw.rarity || raw.quality || (['chatStickers', 'badges'].includes(catKey) ? undefined : 'SSR'),
        quality: raw.quality || raw.rarity || (['chatStickers', 'badges'].includes(catKey) ? undefined : 'SSR'),
        icon: displayIcon,
        photo: raw.photo || raw.icon || '',
        animation: raw.animation,
        provenance: raw.provenance,
        emoji_id: raw.emoji_id,
        fashion_type: raw.fashion_type || null,
        movement_type: raw.movement_type || null,
        mount_type: raw.mount_type || null,
        active_source: raw.active_source || '',
        sort_order: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
        is_simulacrum: Boolean(raw.is_simulacrum),
      };

      const overlayEn = {
        id,
        category: catKey,
        name: names.en,
        name_en: names.en,
        name_ru: names.ru,
        description: descs.en,
        desc_en: descs.en,
        unlock: raw.unlock_en || '',
        source: raw.source_en || raw.active_source || '',
        sub_type: raw.sub_type_en || '',
      };

      const overlayRu = {
        id,
        category: catKey,
        name: names.ru,
        name_en: names.en,
        name_ru: names.ru,
        description: descs.ru,
        desc_ru: descs.ru,
        unlock: raw.unlock_ru || raw.unlock_en || '',
        source: raw.source_ru || raw.source_en || raw.active_source || '',
        sub_type: raw.sub_type_ru || raw.sub_type_en || '',
      };

      const matEnItem = { ...deepClone(core), ...overlayEn };
      const matRuItem = { ...deepClone(core), ...overlayRu };

      coreList.push(core);
      enList.push(overlayEn);
      ruList.push(overlayRu);
      matEnList.push(matEnItem);
      matRuList.push(matRuItem);
      allMatEn.push(matEnItem);
      allMatRu.push(matRuItem);
    }

    coreCategories[catKey] = sortById(coreList);
    overlayEnCategories[catKey] = sortById(enList);
    overlayRuCategories[catKey] = sortById(ruList);
    matEnCategories[catKey] = sortById(matEnList);
    matRuCategories[catKey] = sortById(matRuList);
  }

  // Enemies have no legacy JSON rows: they are synthesized from the
  // on-disk asset mirror (UI\void\boss bigboss* + UI\WorldBossList\BOSS
  // without _yuan). Missing mirror dirs yield zero enemies, never an error.
  const publicDir = options?.publicDir || path.join(legacySourceDir, 'apps', 'web', 'public');
  const enemyEntries = buildEnemyCategoryEntries(collectEnemyCosmeticItems(publicDir, options?.rawSourceDir, options?.preservedMediaDir));
  coreCategories['enemies'] = enemyEntries.core;
  overlayEnCategories['enemies'] = enemyEntries.overlayEn;
  overlayRuCategories['enemies'] = enemyEntries.overlayRu;
  matEnCategories['enemies'] = enemyEntries.matEn;
  matRuCategories['enemies'] = enemyEntries.matRu;
  allMatEn.push(...enemyEntries.matEn);
  allMatRu.push(...enemyEntries.matRu);

  const counts: Record<string, number> = {
    total: allMatEn.length,
  };
  for (const [k, v] of Object.entries(matEnCategories)) {
    counts[k] = v.length;
  }

  const matEn = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: allMatEn.length,
    counts,
    items: sortById(allMatEn),
    ...matEnCategories,
  };

  const matRu = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: allMatRu.length,
    counts,
    items: sortById(allMatRu),
    ...matRuCategories,
  };

  return {
    datasetName: 'cosmetics',
    core: {
      schemaVersion: 1,
      total: allMatEn.length,
      counts,
      ...coreCategories,
    },
    overlays: {
      en: {
        total: allMatEn.length,
        ...overlayEnCategories,
      },
      ru: {
        total: allMatRu.length,
        ...overlayRuCategories,
      },
    },
    materialized: {
      en: matEn,
      ru: matRu,
    },
    counts,
  };
}
