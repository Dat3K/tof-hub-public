import { describe, it, expect } from 'vitest';
import type { WishRecordDto } from '@tof-hub/contracts';
import { resolvePullMedia, type WishMediaMap } from './pull-media';

const MAP: WishMediaMap = {
  version: 1,
  generatedAt: '2026-09-22T00:00:00.000Z',
  byKey: {
    zoey_phy: {
      kind: 'weapon',
      image: '/datamine/shared/media/artworks/zoey/touxiang_zuoyi.webp',
      name_en: 'Rosebud',
      name_ru: 'Розовый бутон',
      ref: 'zoey',
    },
    vesper: {
      kind: 'weapon',
      image: '/datamine/shared/media/artworks/xinghuan/touxiang_xinghuan.webp',
      name_en: 'Vesper',
      name_ru: 'Веспер',
      ref: 'xinghuan',
    },
    matrix_ssr70_2: {
      kind: 'matrix',
      image: '/game-assets/webp/Hotta/Content/Resources/Icon/yizhi/512/icon_matrix_SSR70_512.webp',
      name_en: "Prophet's Light",
      name_ru: 'Свет Пророка',
      ref: 'Suit_SSR70',
    },
  },
};

function record(overrides: Partial<WishRecordDto> = {}): WishRecordDto {
  return {
    id: 'zoey_weapon_1',
    profile_id: 'demo-user-profile',
    banner_id: 'weapon-zoey',
    banner_type: 'weapon_limited',
    item_id: 'Zoey_Phy',
    item_name: 'Vesper',
    item_name_ru: 'Веспер (Лира)',
    item_type: 'weapon',
    rarity: 5,
    pity_count: 2,
    is_guaranteed_pity: false,
    is_featured: true,
    streak_outcome: 'win',
    pull_timestamp: '2026-09-27T03:16:57.000Z',
    ...overrides,
  } as WishRecordDto;
}

describe('resolvePullMedia', () => {
  it('resolves weapon avatars by item id and prefers record RU names', () => {
    const media = resolvePullMedia(MAP, record(), 'ru');
    expect(media.image).toBe('/datamine/shared/media/artworks/zoey/touxiang_zuoyi.webp');
    expect(media.name).toBe('Веспер (Лира)');
  });

  it('falls back to map names when the record lacks a localized name', () => {
    const withoutRu = record({ item_name_ru: undefined });
    expect(resolvePullMedia(MAP, withoutRu, 'ru').name).toBe('Розовый бутон');
    const byNameOnly = record({ item_id: 'unknown_id', item_name: 'Vesper', item_name_ru: undefined });
    const media = resolvePullMedia(MAP, byNameOnly, 'en');
    expect(media.image).toBe('/datamine/shared/media/artworks/xinghuan/touxiang_xinghuan.webp');
    expect(media.name).toBe('Vesper');
  });

  it('resolves matrix icons by piece id', () => {
    const media = resolvePullMedia(
      MAP,
      record({
        item_id: 'matrix_SSR70_2',
        item_name: "Prophet's Light",
        item_name_ru: 'Свет Пророка',
        item_type: 'matrix',
        banner_type: 'matrix_limited',
      }),
      'en',
    );
    expect(media.image).toContain('icon_matrix_SSR70_512.webp');
    expect(media.name).toBe("Prophet's Light");
  });

  it('returns no image and record names when nothing matches or the map is missing', () => {
    const unknown = record({ item_id: 'mystery_x', item_name: 'Mystery', item_name_ru: undefined });
    expect(resolvePullMedia(MAP, unknown, 'en')).toMatchObject({ image: null, name: 'Mystery', primaryName: 'Mystery' });
    expect(resolvePullMedia(null, record(), 'ru')).toMatchObject({
      image: null,
      name: 'Веспер (Лира)',
      primaryName: 'Веспер (Лира)',
    });
  });

  it('resolves character and weapon names when available in map', () => {
    const mapWithChar: WishMediaMap = {
      version: 1,
      generatedAt: '2026-09-22T00:00:00.000Z',
      byKey: {
        vesper: {
          kind: 'weapon',
          image: '/artworks/xinghuan/touxiang_xinghuan.webp',
          name_en: 'Vesper',
          name_ru: 'Веспер',
          character_name_en: 'Lyra',
          character_name_ru: 'Лира',
          weapon_name_en: 'Vesper',
          weapon_name_ru: 'Веспер',
          ref: 'xinghuan',
        },
      },
    };
    const rec = record({ item_id: 'vesper', item_name: 'Vesper', item_name_ru: undefined, rarity: 5 });
    const en = resolvePullMedia(mapWithChar, rec, 'en');
    expect(en.characterName).toBe('Lyra');
    expect(en.primaryName).toBe('Lyra');
    expect(en.secondaryName).toBe('Vesper');
    expect(en.displayName).toBe('Lyra (Vesper)');

    const ru = resolvePullMedia(mapWithChar, rec, 'ru');
    expect(ru.characterName).toBe('Лира');
    expect(ru.primaryName).toBe('Лира');
    expect(ru.secondaryName).toBe('Веспер');
    expect(ru.displayName).toBe('Лира (Веспер)');
  });

  it('resolves standard pool R weapons without character avatar fallback', () => {
    const mapWithStandard: WishMediaMap = {
      version: 1,
      generatedAt: '2026-09-28T00:00:00.000Z',
      byKey: {
        spear_ice: {
          kind: 'weapon',
          image: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/CaJian_item_Weapon_R_Spear_Ice01.webp',
          name_en: 'Frosted Spear',
          name_ru: 'Ледяное копьё',
          ref: 'standard_spear_ice',
        },
        digger_physic: {
          kind: 'weapon',
          image: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_R_Ds_Phy01.webp',
          name_en: 'Combat Blade',
          name_ru: 'Боевой клинок',
          ref: 'standard_digger_physic',
        },
        sword_thunder: {
          kind: 'weapon',
          image: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_R_Sword_Thunder01.webp',
          name_en: 'EM Blade',
          name_ru: 'Электромагнитный клинок',
          ref: 'standard_sword_thunder',
        },
        bow_fire: {
          kind: 'weapon',
          image: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_SR_Bow_Fire01.webp',
          name_en: 'Composite Bow',
          name_ru: 'Составной лук',
          ref: 'standard_bow_fire',
        },
        weaponfragment_up74: {
          kind: 'weapon',
          image: '/datamine/shared/media/artworks/zoey/UI_UP_zuoyi_WQ_Icon.webp',
          name_en: 'Flame Gold (Zoey)',
          name_ru: 'Огненное золото (Зои)',
          ref: 'currency_flame_gold_zoey',
        },
        weapon_exp_r: {
          kind: 'weapon',
          image: '/game-assets/webp/Hotta/Content/Resources/Icon/item/Weapon_R_Exp01.webp',
          name_en: 'Weapon Battery II',
          name_ru: 'Аккумулятор оружия II',
          ref: 'standard_battery_r',
        },
      },
    };

    const frostedSpear = resolvePullMedia(
      mapWithStandard,
      record({ item_id: 'spear_ice', item_name: 'Frosted Spear', item_name_ru: 'Ледяное копьё (Эхо)', rarity: 3 }),
      'ru',
    );
    expect(frostedSpear.image).toBe('/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/CaJian_item_Weapon_R_Spear_Ice01.webp');

    const combatBlade = resolvePullMedia(
      mapWithStandard,
      record({ item_id: 'digger_physic', item_name: 'Combat Blade', item_name_ru: 'Боевой клинок', rarity: 3 }),
      'en',
    );
    expect(combatBlade.image).toBe('/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_R_Ds_Phy01.webp');

    const emBlade = resolvePullMedia(
      mapWithStandard,
      record({ item_id: 'sword_thunder', item_name: 'EM Blade', item_name_ru: 'Электромагнитный клинок', rarity: 3 }),
      'ru',
    );
    expect(emBlade.image).toBe('/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_R_Sword_Thunder01.webp');

    const compositeBow = resolvePullMedia(
      mapWithStandard,
      record({ item_id: 'bow_fire', item_name: 'Composite Bow', item_name_ru: 'Составной лук', rarity: 3 }),
      'en',
    );
    expect(compositeBow.image).toBe('/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_SR_Bow_Fire01.webp');

    expect(mapWithStandard.byKey.weaponfragment_up74.image).toBe('/datamine/shared/media/artworks/zoey/UI_UP_zuoyi_WQ_Icon.webp');
    expect(mapWithStandard.byKey.weapon_exp_r.image).toBe('/game-assets/webp/Hotta/Content/Resources/Icon/item/Weapon_R_Exp01.webp');
  });
});
