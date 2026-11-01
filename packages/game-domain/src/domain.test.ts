import { describe, it, expect } from 'vitest';
import {
  adaptSimulacrumSummary,
  adaptMatrixSuitDetail,
  adaptRelicDetail,
  adaptSmartServantDetail,
  adaptFoodDish,
  adaptArtwork,
  adaptCompCatalog,
  normalizeElement,
  normalizeRarity,
  normalizeRole,
  slugify,
  itemQualityToRarity,
  getElementLabel,
  getRoleLabel,
} from './index';

describe('Game Domain Models & Adapters', () => {
  it('separates stable ID, slug, and localized display names', () => {
    const rawSim = {
      id: 'rei-ayanami',
      imitation_id: 'imitation_56',
      avatar_id: 'AyanamiRei',
      weapon_id: 'AyanamiRei_thunder',
      name_en: 'Rei',
      name_ru: 'Рэй Аянами',
      weapon_name_en: 'Salvation',
      weapon_name_ru: 'Спасение',
      element: 'Volt',
      element_secondary: 'Frost',
      role: 'DPS',
      rarity: 'SSR',
      server_mode: 'gacha',
      avatar: '/media/avatar.webp',
      card: '/media/card.webp',
    };

    const adapted = adaptSimulacrumSummary(rawSim);

    expect(adapted.stableId).toBe('imitation_56');
    expect(adapted.slug).toBe('rei-ayanami');
    expect(adapted.name).toEqual({ en: 'Rei', ru: 'Рэй Аянами' });
    expect(adapted.weaponName).toEqual({ en: 'Salvation', ru: 'Спасение' });
    expect(adapted.element).toBe('Volt');
    expect(adapted.elementSecondary).toBe('Frost');
    expect(adapted.role).toBe('DPS');
    expect(adapted.rarity).toBe('SSR');
    expect(adapted.serverMode).toBe('gacha');
  });

  it('normalizes elements and roles correctly', () => {
    expect(normalizeElement('Thunder')).toBe('Volt');
    expect(normalizeElement('Ice')).toBe('Frost');
    expect(normalizeElement('Physics')).toBe('Physical');
    expect(normalizeElement('Fire')).toBe('Flame');
    expect(normalizeElement('Superpower')).toBe('Altered');

    expect(normalizeRole('Attack')).toBe('DPS');
    expect(normalizeRole('Fortitude')).toBe('Tank');
    expect(normalizeRole('Benediction')).toBe('Benediction');
    expect(normalizeRole('Balance')).toBe('Balance');

    expect(normalizeRarity('orange')).toBe('SSR');
    expect(normalizeRarity('purple')).toBe('SR');
    expect(normalizeRarity('blue')).toBe('R');
    expect(normalizeRarity('green')).toBe('N');
  });

  it('slugify generates clean ASCII identifiers', () => {
    expect(slugify('Child of Lockhart')).toBe('child-of-lockhart');
    expect(slugify('Rei Ayanami')).toBe('rei-ayanami');
    expect(slugify('Special: 100% Boost!')).toBe('special-100-boost');
  });

  it('adapts matrix suit with pieces, set effects, and carriers', () => {
    const rawMatrix = {
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
          name_en: '2-Piece Set',
          name_ru: 'Набор из 2',
          desc_en: 'Increase Physical ATK',
          desc_ru: 'Увеличивает физ. атаку',
          buff_id: 'buff_1',
          stars: [{ star: 0, text_en: '28%', text_ru: '28%' }],
        },
      ],
      carriers: [{ id: 'zoey', name_en: 'Zoey', name_ru: 'Зои' }],
    };

    const adapted = adaptMatrixSuitDetail(rawMatrix);

    expect(adapted.stableId).toBe('Suit_SSR70');
    expect(adapted.slug).toBe('child-of-lockhart');
    expect(adapted.quality).toBe('SSR');
    expect(adapted.pieces).toHaveLength(1);
    expect(adapted.effects).toHaveLength(1);
    expect(adapted.carriers).toHaveLength(1);
  });

  it('adapts relic record with stars and canonical ID', () => {
    const rawRelic = {
      id: 'artifact_ssr_026-mmo',
      canonical_id: 'artifact_ssr_026',
      edition: 'mmo',
      name_en: 'Blocker Device',
      name_ru: 'Блокиратор',
      desc_en: 'A defensive device',
      desc_ru: 'Защитное устройство',
      quality: 'SSR',
      property: 'Defense',
      attack_icon: '/attack.webp',
      card_image: '/card.webp',
      stars: [{ star: 1, desc_en: 'Cooldown reduced', desc_ru: 'Откат снижен' }],
    };

    const adapted = adaptRelicDetail(rawRelic);

    expect(adapted.id).toBe('artifact_ssr_026-mmo');
    expect(adapted.stableId).toBe('artifact_ssr_026');
    expect(adapted.slug).toBe('blocker-device');
    expect(adapted.serverMode).toBe('mmo');
    expect(adapted.property).toBe('Defense');
    expect(adapted.stars).toHaveLength(1);
  });

  it('adapts combat pet record with element and role normalization', () => {
    const rawPet = {
      id: 'FightPet_1',
      category: 'combat',
      name_en: 'Kalka',
      name_ru: 'Калка',
      desc_en: 'A combat companion',
      desc_ru: 'Боевой спутник',
      quality: 'SSR',
      element_norm: 'phys',
      role_norm: 'dps',
      icon: '/icon.webp',
      photo: '/photo.webp',
      skills: [
        { name_en: 'Kalka Impact', name_ru: 'Удар Калки', desc_en: 'Rushes forward', desc_ru: 'Бросок', icon: '/skill.webp' },
      ],
      stars: [
        { star: 0, desc_en: 'Inherits ATK', desc_ru: 'Перенимает атаку' },
      ],
    };

    const adapted = adaptSmartServantDetail(rawPet);

    expect(adapted.stableId).toBe('FightPet_1');
    expect(adapted.slug).toBe('kalka');
    expect(adapted.category).toBe('combat');
    expect(adapted.element).toBe('Physical');
    expect(adapted.role).toBe('DPS');
    expect(adapted.skills).toHaveLength(1);
    expect(adapted.stars).toHaveLength(1);
  });

  it('adapts food dish with recipe ingredients and buffs', () => {
    const rawFood = {
      id: 'item_Cooking_3013',
      name_en: 'Cactus Special',
      name_ru: 'Кактусовый коктейль',
      star: 2,
      rarity: 'SR',
      quality: 'ITEM_QUALITY_RARE',
      type: 'Entrée',
      categories: ['Satiety', 'Flame Attack'],
      satiety: 10,
      has_heal: false,
      formatted_effects_en: 'Regenerates satiety',
      formatted_effects_ru: 'Восстанавливает сытость',
      buffs: [
        { buff_id: 'buff_1', name_en: 'Flame Buff', name_ru: 'Бафф огня', description_en: 'Increases flame atk', description_ru: 'Увеличивает атаку' },
      ],
      recipe: {
        recipe_id: 'Cooking_3013',
        ingredients: [
          { id: 'Item_1', name_en: 'Ball Cactus', name_ru: 'Шаровой кактус', count: 2, is_core: true, rarity: 'N', icon: '/cactus.webp' },
        ],
      },
      icon: '/icon.webp',
    };

    const adapted = adaptFoodDish(rawFood);

    expect(adapted.stableId).toBe('item_Cooking_3013');
    expect(adapted.slug).toBe('cactus-special');
    expect(adapted.recipe?.recipeId).toBe('Cooking_3013');
    expect(adapted.recipe?.ingredients).toHaveLength(1);
    expect(adapted.buffs).toHaveLength(1);
  });

  it('adapts artwork item with aspect ratio calculations', () => {
    const rawArt = {
      id: 'art_1',
      title: 'Wallpaper 1',
      category: 'wallpapers',
      width: 1920,
      height: 1080,
      aspectRatio: 1.777,
      aspectLabel: '16:9',
      webpUrl: '/art.webp',
      pngUrl: '/art.png',
      thumbUrl: '/thumb.webp',
      sizeBytes: 102400,
    };

    const adapted = adaptArtwork(rawArt);

    expect(adapted.stableId).toBe('art_1');
    expect(adapted.category).toBe('wallpapers');
    expect(adapted.aspectLabel).toBe('16:9');
  });

  it('adapts Comp catalog and derives weapon collection', () => {
    const rawComp = {
      roles: [
        { id: 'tank', name_en: 'Fortitude', name_ru: 'Защита', short_en: 'Tank', short_ru: 'Танк', color: '#ff0000', bg_color: '#330000', icon: '/tank.webp' },
      ],
      simulacra: [
        {
          id: 'rei-ayanami',
          name_en: 'Rei',
          name_ru: 'Рэй Аянами',
          avatar: '/avatar.webp',
          weapon_id: 'AyanamiRei_thunder',
          weapon_name_en: 'Salvation',
          weapon_name_ru: 'Спасение',
          weapon_icon: '/weapon.webp',
          element: 'Volt',
          role: 'DPS',
          role_icon: '/role.webp',
          rarity: 'SSR',
          matrix_suit_id: 'suit_SSR44',
          card: '/card.webp',
          trait_name_en: 'Trait',
          trait_name_ru: 'Трейт',
          trait_desc_en: 'Desc',
          trait_desc_ru: 'Описание',
        },
      ],
      matrices: [
        { id: 'Suit_SSR44', name_en: 'Suit 44', name_ru: 'Сьют 44', quality: 'SSR', icon: '/mat.webp', suit_portrait: '/sp.webp', remould_icon: null },
      ],
      relics: [
        { id: 'rel_1', name_en: 'Relic 1', name_ru: 'Релик 1', quality: 'SSR', property: 'Attack', icon: '/r.webp', desc_en: 'Desc', desc_ru: 'Опис', stars: [] },
      ],
      pets: [
        { id: 'pet_1', name_en: 'Pet 1', name_ru: 'Пэт 1', quality: 'SSR', icon: '/p.webp', stars: [] },
      ],
    };

    const catalog = adaptCompCatalog(rawComp);

    expect(catalog.roles).toHaveLength(1);
    expect(catalog.simulacra).toHaveLength(1);
    expect(catalog.weapons).toHaveLength(1);
    expect(catalog.weapons![0].canonicalRole).toBe('dps');
    expect(catalog.weapons![0].simName.en).toBe('Rei');
    expect(catalog.matrices).toHaveLength(1);
    expect(catalog.relics).toHaveLength(1);
    expect(catalog.pets).toHaveLength(1);
  });

  it('maps item quality to canonical rarity correctly', () => {
    expect(itemQualityToRarity('ITEM_QUALITY_COMMON')).toBe('N');
    expect(itemQualityToRarity('ITEM_QUALITY_FINE')).toBe('R');
    expect(itemQualityToRarity('ITEM_QUALITY_RARE')).toBe('SR');
    expect(itemQualityToRarity('ITEM_QUALITY_EPIC')).toBe('SSR');
    expect(itemQualityToRarity('ITEM_QUALITY_LEGENDRY')).toBe('SSR');
    expect(itemQualityToRarity('UNKNOWN_QUALITY')).toBe('N');
  });

  it('resolves centralized element labels in both locales', () => {
    expect(getElementLabel('frost', 'en')).toBe('Frost');
    expect(getElementLabel('frost', 'ru')).toBe('Ледяной');
    expect(getElementLabel('thunder', 'ru')).toBe('Электрический');
    expect(getElementLabel('phys', 'ru')).toBe('Физический');
    expect(getElementLabel('volt', 'ru', 'short')).toBe('Электро');
    expect(getElementLabel('frost', 'ru', 'short')).toBe('Лед');
    expect(getElementLabel('altered', 'ru', 'short')).toBe('Аберрация');
  });

  it('resolves centralized role labels in both locales', () => {
    expect(getRoleLabel('dps', 'en')).toBe('DPS');
    expect(getRoleLabel('dps', 'ru')).toBe('ДПС');
    expect(getRoleLabel('tank', 'ru')).toBe('Танк');
    expect(getRoleLabel('tank', 'ru', 'full')).toBe('Защита');
    expect(getRoleLabel('dps', 'ru', 'full')).toBe('Атака');
    expect(getRoleLabel('benediction', 'ru', 'full')).toBe('Поддержка');
  });
});

