import type { WishBannerDto } from './types';

export const ZOEY_WEAPON_BANNER: WishBannerDto = {
  id: 'weapon-zoey',
  name: 'Zoey Special Order',
  name_en: 'Zoey Special Order',
  name_ru: 'Спецзаказ: Зои',
  banner_type: 'weapon_limited',
  character_id: 'zoey',
  weapon_id: 'Zoey_Phy',
  pity_target: 80,
  start_date: '2026-09-27T03:00:00.000Z',
  end_date: '2026-09-27T04:00:00.000Z',
  currency: 'red_nucleus',
  cashback_currency: 'flame_gold',
  featured_ssr: ['Zoey_Phy'],
  featured_sr: [],
  standard_pool_items: [
    'digger_thunder',
    'spear_thunder',
    'cube_fire',
  ],
  assets: {
    background: '/datamine/shared/media/artworks/zoey/Bg_UpZY.webp',
    splash: '/datamine/shared/media/artworks/zoey/Img_ZY01.webp',
    icon: '/datamine/shared/media/artworks/zoey/touxiang_zuoyi_s.webp',
    weapon_icon: '/datamine/shared/media/artworks/zoey/weapon_icon.webp',
    title_image_en: '/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_en.png',
    title_image_ru: '/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_ru.png',
  },
};

export const ZOEY_MATRIX_BANNER: WishBannerDto = {
  id: 'matrix-zoey',
  name: 'Zoey Matrix Special Order',
  name_en: 'Zoey Matrix Special Order',
  name_ru: 'Спецзаказ матриц: Зои',
  banner_type: 'matrix_limited',
  character_id: 'zoey',
  matrix_id: 'suit_SSR70',
  pity_target: 40,
  start_date: '2026-09-27T03:00:00.000Z',
  end_date: '2026-09-27T04:00:00.000Z',
  currency: 'special_voucher',
  cashback_currency: 'overclocking_chip',
  featured_ssr: ['suit_SSR70'],
  featured_sr: [],
  standard_pool_items: [
    'suit_SSR3',
    'suit_SSR9',
    'suit_SR12',
  ],
  assets: {
    background: '/datamine/shared/media/artworks/zoey/Bg_UpZY.webp',
    splash: '/datamine/shared/media/artworks/zoey/Img_ZY02.webp',
    icon: '/datamine/shared/media/artworks/zoey/touxiang_zuoyi_s.webp',
    matrix_icon: '/datamine/shared/media/artworks/zoey/icon_matrix_ssr70_256.webp',
    title_image_en: '/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_en.png',
    title_image_ru: '/datamine/shared/media/artworks/zoey/UI_UP_asilada_Title_L10N_ru.png',
  },
};

export const ALL_ZOEY_BANNERS: WishBannerDto[] = [
  ZOEY_WEAPON_BANNER,
  ZOEY_MATRIX_BANNER,
];
