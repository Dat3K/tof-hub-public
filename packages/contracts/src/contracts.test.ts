import { describe, it, expect } from 'vitest';

// Real-data checks read a prepared legacy stage (TOF_LEGACY_DIR, as the generators do) when one is available.
const legacyFile = (relative: string) => `${process.env.TOF_LEGACY_DIR ?? 'missing-legacy-stage'}/${relative}`;
import {
  SimulacrumSummarySchema,
  SimulacrumDetailSchema,
  WeaponDetailSchema,
  MatrixSuitDetailSchema,
  RelicDetailSchema,
  SmartServantDetailSchema,
  FoodDishCoreSchema,
  ArtworkCoreSchema,
  CompCatalogSchema,
  MatricesDatasetSchema,
  RelicsDatasetSchema,
  PetsDatasetSchema,
  ArtworksDatasetSchema,
  FceIndexDatasetSchema,
  OowCurrentSummaryDatasetSchema,
  BygoneDatasetSchema,
  SeqCacheDatasetSchema,
  DatamineItemsDatasetSchema,
  MultypeRenamesDatasetSchema,
} from './index';
import {
  adaptSimulacrumSummary,
  adaptSimulacrumDetail,
  adaptMatrixSuitDetail,
  adaptRelicDetail,
  adaptSmartServantDetail,
  adaptFoodDish,
  adaptArtwork,
  adaptCompCatalog,
} from '@tof-hub/game-domain';

describe('Zod Contracts & Runtime Validation', () => {
  it('validates SimulacrumSummary schema', () => {
    const model = adaptSimulacrumSummary({
      id: 'alyss',
      imitation_id: 'imitation_23',
      avatar_id: 'Alyss',
      weapon_id: 'Alyss_ice',
      name_en: 'Alyss',
      name_ru: 'Алиса',
      weapon_name_en: 'Unyielding Wing',
      weapon_name_ru: 'Неукротимое крыло',
      element: 'Frost',
      role: 'DPS',
      rarity: 'SSR',
      server_mode: 'gacha',
      avatar: '/media/alyss.webp',
      card: '/media/alyss_card.webp',
    });

    const parsed = SimulacrumSummarySchema.safeParse(model);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stableId).toBe('imitation_23');
      expect(parsed.data.slug).toBe('alyss');
      expect(parsed.data.name.en).toBe('Alyss');
    }
  });

  it('validates SimulacrumDetail schema with full weapon and advancements', () => {
    const model = adaptSimulacrumDetail({
      id: 'alyss',
      imitation_id: 'imitation_23',
      name_en: 'Alyss',
      name_ru: 'Алиса',
      weapon_name_en: 'Unyielding Wing',
      weapon_name_ru: 'Неукротимое крыло',
      element: 'Frost',
      role: 'DPS',
      rarity: 'SSR',
      server_mode: 'gacha',
      base_stats: { attack: 100, hp: 1000 },
      max_stats: { attack: 1500, hp: 20000 },
      advancements: [
        { star: 1, name_en: 'Star 1', name_ru: 'Звезда 1', desc_en: 'Desc', desc_ru: 'Опис' },
      ],
      traits: [
        { affinity: 1200, name_en: 'Trait 1', name_ru: 'Трейт 1', desc_en: 'Desc', desc_ru: 'Опис' },
      ],
      affinity_ladder: [{ level_pts: 1200, atk: 50, hp: 500 }],
      weapon: {
        id: 'Alyss_ice',
        name_en: 'Unyielding Wing',
        name_ru: 'Неукротимое крыло',
        element: 'Frost',
        role: 'DPS',
        rarity: 'SSR',
        shatter: { value: 12, tier: 'S' },
        charge: { value: 8, tier: 'A' },
        skills: { normals: [], dodges: [], skills: [], discharges: [] },
      },
    });

    const parsed = SimulacrumDetailSchema.safeParse(model);
    expect(parsed.success).toBe(true);
  });

  it('validates MatrixSuitDetail schema', () => {
    const model = adaptMatrixSuitDetail({
      id: 'Suit_SSR70',
      name_en: 'Child of Lockhart',
      name_ru: 'Дитя Локхарта',
      quality: 'SSR',
      icon: '/icon.webp',
      suit_portrait: '/portrait.webp',
      remould_icon: null,
      pieces: [
        { slot: 'emotion', id: 'p1', name_en: 'Piece 1', name_ru: 'Часть 1', icon: '/p1.webp' },
      ],
      effects: [
        {
          piece_count: 2,
          name_en: '2-Piece Bonus',
          name_ru: 'Бонус 2 частей',
          desc_en: 'Increases Physical ATK',
          desc_ru: 'Увеличивает физ. атаку',
          buff_id: 'buff_1',
          stars: [{ star: 0, text_en: '28%', text_ru: '28%' }],
        },
      ],
      carriers: [{ id: 'zoey', name_en: 'Zoey', name_ru: 'Зои' }],
    });

    const parsed = MatrixSuitDetailSchema.safeParse(model);
    expect(parsed.success).toBe(true);
  });

  it('validates RelicDetail schema', () => {
    const model = adaptRelicDetail({
      id: 'artifact_ssr_028',
      canonical_id: 'artifact_ssr_028',
      name_en: 'Escape Master',
      name_ru: 'Мастер побега',
      desc_en: 'Escape gadget',
      desc_ru: 'Устройство для побега',
      quality: 'SSR',
      property: 'Function',
      server_mode: 'gacha',
      icon: '/icon.webp',
      card_image: '/card.webp',
      stars: [{ star: 1, desc_en: 'Star 1 effect', desc_ru: 'Эффект 1 звезды' }],
      cooldown: 60,
      fragment_item_id: 'frag_1',
      ability_tag: 'tag',
      drawing: null,
    });

    const parsed = RelicDetailSchema.safeParse(model);
    expect(parsed.success).toBe(true);
  });

  it('validates SmartServantDetail schema', () => {
    const model = adaptSmartServantDetail({
      id: 'FightPet_1',
      category: 'combat',
      name_en: 'Kalka',
      name_ru: 'Калка',
      desc_en: 'Combat pet',
      desc_ru: 'Боевой питомец',
      quality: 'SSR',
      element: 'Physical',
      role: 'DPS',
      icon: '/icon.webp',
      photo: '/photo.webp',
      stars: [{ star: 0, desc_en: 'Inherits ATK', desc_ru: 'Перенимает атаку' }],
      skills: [{ name_en: 'Impact', name_ru: 'Удар', desc_en: 'Hits hard', desc_ru: 'Сильный удар', icon: '/skill.webp' }],
      stats_progression: null,
    });

    const parsed = SmartServantDetailSchema.safeParse(model);
    expect(parsed.success).toBe(true);
  });

  it('validates FoodDishCore schema', () => {
    const model = adaptFoodDish({
      id: 'item_Cooking_3013',
      name_en: 'Cactus Special',
      name_ru: 'Кактусовый коктейль',
      star: 2,
      rarity: 'SR',
      quality: 'ITEM_QUALITY_RARE',
      type: 'Entrée',
      categories: ['Satiety'],
      satiety: 10,
      has_heal: false,
      formatted_effects_en: 'Effects',
      formatted_effects_ru: 'Эффекты',
      buffs: [],
      recipe: null,
      icon: '/icon.webp',
    });

    const parsed = FoodDishCoreSchema.safeParse(model);
    expect(parsed.success).toBe(true);
  });

  it('validates ArtworkCore schema', () => {
    const model = adaptArtwork({
      id: 'art_1',
      title: 'Art 1',
      category: 'wallpapers',
      subCategory: null,
      themeTag: null,
      width: 1920,
      height: 1080,
      aspectRatio: 1.777,
      aspectLabel: '16:9',
      url: '/art.webp',
      webpUrl: '/art.webp',
      pngUrl: '/art.png',
      thumbUrl: '/thumb.webp',
      sizeBytes: 1024,
    });

    const parsed = ArtworkCoreSchema.safeParse(model);
    expect(parsed.success).toBe(true);
  });

  it('validates CompCatalogSchema', () => {
    const catalog = adaptCompCatalog({
      roles: [
        { id: 'tank', name_en: 'Fortitude', name_ru: 'Защита', short_en: 'Tank', short_ru: 'Танк', color: '#fff', bg_color: '#000', icon: '/tank.webp' },
      ],
      simulacra: [
        {
          id: 'rei-ayanami',
          name_en: 'Rei',
          name_ru: 'Рэй Аянами',
          avatar: '/a.webp',
          weapon_id: 'w1',
          weapon_name_en: 'Salvation',
          weapon_name_ru: 'Спасение',
          weapon_icon: '/w.webp',
          element: 'Volt',
          role: 'DPS',
          role_icon: '/r.webp',
          rarity: 'SSR',
          matrix_suit_id: 'm1',
          card: '/c.webp',
          trait_name_en: 'T',
          trait_name_ru: 'Т',
          trait_desc_en: 'D',
          trait_desc_ru: 'Д',
        },
      ],
      matrices: [
        { id: 'm1', name_en: 'M1', name_ru: 'М1', quality: 'SSR', icon: '/m.webp', suit_portrait: '/sp.webp', remould_icon: null },
      ],
      relics: [
        { id: 'r1', name_en: 'R1', name_ru: 'Р1', quality: 'SSR', property: 'Attack', icon: '/r.webp', desc_en: 'D', desc_ru: 'Д', stars: [] },
      ],
      pets: [
        { id: 'p1', name_en: 'P1', name_ru: 'П1', quality: 'SSR', icon: '/p.webp', stars: [] },
      ],
    });

    const parsed = CompCatalogSchema.safeParse(catalog);
    expect(parsed.success).toBe(true);
  });

  it('validates raw Matrices dataset envelope', () => {
    const rawEnvelope = {
      schemaVersion: 1,
      generatedAt: '2026-09-10T16:49:47.625Z',
      total: 1,
      items: [
        {
          id: 'Suit_SSR70',
          name_en: 'Child of Lockhart',
          name_ru: 'Дитя Локхарта',
          quality: 'SSR',
        },
      ],
    };

    const parsed = MatricesDatasetSchema.safeParse(rawEnvelope);
    expect(parsed.success).toBe(true);
  });

  it('validates all real Simulacra in simulacra-index.json', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('info/simulacra/data/simulacra-index.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(50);

    for (const raw of data) {
      const adapted = adaptSimulacrumSummary(raw);
      expect(adapted.stableId).toBeTruthy();
      expect(adapted.slug).toBeTruthy();
      expect(adapted.name.en).toBeTruthy();

      const result = SimulacrumSummarySchema.safeParse(adapted);
      expect(result.success).toBe(true);
    }
  });

  it('validates all real Matrices in matrices.json', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('info/matrices/data/matrices.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const datasetResult = MatricesDatasetSchema.safeParse(data);
    expect(datasetResult.success).toBe(true);

    for (const raw of data.items) {
      const adapted = adaptMatrixSuitDetail(raw);
      expect(adapted.stableId).toBeTruthy();
      expect(adapted.slug).toBeTruthy();
      expect(adapted.name.en).toBeTruthy();

      const result = MatrixSuitDetailSchema.safeParse(adapted);
      expect(result.success).toBe(true);
    }
  });

  it('validates all real Relics in relics.json', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('info/relics/data/relics.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const datasetResult = RelicsDatasetSchema.safeParse(data);
    expect(datasetResult.success).toBe(true);

    for (const raw of data.items) {
      const adapted = adaptRelicDetail(raw);
      expect(adapted.stableId).toBeTruthy();
      expect(adapted.slug).toBeTruthy();
      expect(adapted.name.en).toBeTruthy();

      const result = RelicDetailSchema.safeParse(adapted);
      expect(result.success).toBe(true);
    }
  });

  it('validates all real Pets in pets.json', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('info/pets/data/pets.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const datasetResult = PetsDatasetSchema.safeParse(data);
    expect(datasetResult.success).toBe(true);

    for (const raw of data.items) {
      const adapted = adaptSmartServantDetail(raw);
      expect(adapted.stableId).toBeTruthy();
      expect(adapted.slug).toBeTruthy();
      expect(adapted.name.en).toBeTruthy();

      const result = SmartServantDetailSchema.safeParse(adapted);
      expect(result.success).toBe(true);
    }
  });

  it('validates all real Food dishes in food.json', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('info/food/data/food.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(100);

    for (const raw of data) {
      const adapted = adaptFoodDish(raw);
      expect(adapted.stableId).toBeTruthy();
      expect(adapted.slug).toBeTruthy();
      expect(adapted.name.en).toBeTruthy();

      const result = FoodDishCoreSchema.safeParse(adapted);
      expect(result.success).toBe(true);
    }
  });

  it('validates all real Artworks in artworks.json', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('info/arts/data/artworks.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const datasetResult = ArtworksDatasetSchema.safeParse(data);
    expect(datasetResult.success).toBe(true);

    for (const raw of data.items) {
      const adapted = adaptArtwork(raw);
      expect(adapted.stableId).toBeTruthy();
      expect(adapted.title).toBeTruthy();

      const result = ArtworkCoreSchema.safeParse(adapted);
      expect(result.success).toBe(true);
    }
  });

  it('validates full real Comp catalog in tools/data/catalog.json', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('tools/data/catalog.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const catalog = adaptCompCatalog(data);

    const result = CompCatalogSchema.safeParse(catalog);
    expect(result.success).toBe(true);
    expect(catalog.simulacra.length).toBe(73);
    expect(catalog.weapons!.length).toBe(73);
    expect(catalog.matrices.length).toBe(88);
    expect(catalog.relics).toHaveLength(49);
    expect(catalog.pets).toHaveLength(12);
    expect(catalog.roles).toHaveLength(4);
  });

  it('validates real FCE index data', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('datamine/fce/data/fce-index.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const result = FceIndexDatasetSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      // Game patches add bosses; fewer than the last verified export means lost data.
      expect(result.data.bosses.length).toBeGreaterThanOrEqual(37);
    }
  });

  it('validates real OoW current summary data', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('datamine/oow/data/current/summary.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const result = OowCurrentSummaryDatasetSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('validates real Seq cache data', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('datamine/seq/data/seq-boss-cache.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const result = SeqCacheDatasetSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stages.length).toBeGreaterThanOrEqual(35);
    }
  });

  it('validates real Bygone Phantasm data', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('datamine/bygone/data/bygone.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const result = BygoneDatasetSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalFloors).toBe(600);
      expect(result.data.floors.length).toBe(600);
    }
  });

  it('validates real Multype taxonomy data', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('datamine/multype/data/renames.base.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const result = MultypeRenamesDatasetSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
      expect(result.data.mainRenames).toBeDefined();
    }
  });

  it('validates real Items datamine sample data', async () => {
    const fs = await import('node:fs');
    const path = legacyFile('datamine/items/data/merged_mapping_with_original.json');
    if (!fs.existsSync(path)) return;

    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    // Validate first 20 items to verify schema without traversing 12k items in unit test
    const sample: Record<string, any> = {};
    const keys = Object.keys(data).slice(0, 20);
    for (const k of keys) {
      sample[k] = data[k];
    }
    const result = DatamineItemsDatasetSchema.safeParse(sample);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).length).toBe(20);
    }
  });
});
