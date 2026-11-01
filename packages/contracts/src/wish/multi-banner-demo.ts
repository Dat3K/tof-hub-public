import type { WishBannerDto, WishRecordDto } from './types';
import { ZOEY_WEAPON_BANNER, ZOEY_MATRIX_BANNER } from './zoey-example';
import { getZoeyWeaponPulls, getZoeyMatrixPulls } from './zoey-example.pulls';

export { ZOEY_WEAPON_BANNER, ZOEY_MATRIX_BANNER, getZoeyWeaponPulls, getZoeyMatrixPulls };

export const STANDARD_WEAPON_BANNER: WishBannerDto = {
  id: 'weapon-standard',
  name: 'Choice Weapons',
  name_en: 'Choice Weapons',
  name_ru: 'Оружие на выбор (Стандарт)',
  banner_type: 'standard_weapon',
  character_id: 'saimier',
  weapon_id: 'dual_pistol',
  pity_target: 80,
  start_date: '2022-08-11T00:00:00.000Z',
  end_date: '2030-12-31T23:59:59.000Z',
  currency: 'gold_nucleus',
  cashback_currency: 'black_gold',
  featured_ssr: ['dual_pistol', 'sickle_fire', 'sword_ice', 'digger_thunder', 'cube_fire'],
  featured_sr: ['stave_thunder', 'spear_ice', 'bow_fire', 'hammer_ice', 'cannon_ice'],
  standard_pool_items: ['dual_pistol', 'sickle_fire', 'sword_ice', 'digger_thunder', 'cube_fire'],
  assets: {
    background: '/datamine/shared/media/artworks/saimier/UI_UP_SAMIR_Bkg.webp',
    splash: '/datamine/shared/media/artworks/saimier/card_lihui.webp',
    icon: '/datamine/shared/media/artworks/saimier/touxiang_saimier.webp',
    weapon_icon: '/datamine/shared/media/artworks/saimier/weapon_icon.webp',
  },
};

export const STANDARD_MATRIX_BANNER: WishBannerDto = {
  id: 'matrix-standard',
  name: 'Choice Matrices',
  name_en: 'Choice Matrices',
  name_ru: 'Матрицы на выбор (Стандарт)',
  banner_type: 'standard_matrix',
  character_id: 'king',
  matrix_id: 'suit_SSR4',
  pity_target: 40,
  start_date: '2022-08-11T00:00:00.000Z',
  end_date: '2030-12-31T23:59:59.000Z',
  currency: 'proof_of_purchase',
  cashback_currency: 'base_chip',
  featured_ssr: ['suit_SSR1', 'suit_SSR2', 'suit_SSR3', 'suit_SSR4', 'suit_SSR9'],
  featured_sr: ['matrix_sr_pepper', 'matrix_sr_echo', 'matrix_sr_hilda', 'matrix_sr_ene'],
  standard_pool_items: ['suit_SSR1', 'suit_SSR2', 'suit_SSR3', 'suit_SSR4', 'suit_SSR9'],
  assets: {
    background: '/datamine/shared/media/artworks/saimier/UI_UP_SAMIR_Bkg.webp',
    splash: '/datamine/shared/media/artworks/king/card_lihui.webp',
    icon: '/datamine/shared/media/artworks/king/touxiang_king.webp',
    matrix_icon: '/datamine/shared/media/artworks/king/icon_matrix_ssr4_512.webp',
  },
};

export const BLACK_NUCLEUS_BANNER: WishBannerDto = {
  id: 'weapon-black-nucleus',
  name: 'Weapons Galore',
  name_en: 'Weapons Galore',
  name_ru: 'Множество оружия (Фиолетовые крутки)',
  banner_type: 'black_nucleus',
  character_id: 'saimier',
  pity_target: 0,
  start_date: '2022-08-11T00:00:00.000Z',
  end_date: '2030-12-31T23:59:59.000Z',
  currency: 'black_nucleus',
  cashback_currency: 'none',
  featured_ssr: [],
  featured_sr: ['stave_thunder', 'spear_ice', 'bow_fire', 'hammer_ice', 'cannon_ice'],
  standard_pool_items: ['dual_pistol', 'sickle_fire', 'sword_ice', 'digger_thunder', 'cube_fire'],
  assets: {
    background: '/datamine/shared/media/artworks/saimier/UI_UP_SAMIR_Bkg.webp',
    splash: '/datamine/shared/media/artworks/saimier/card_lihui.webp',
    icon: '/datamine/shared/media/artworks/saimier/touxiang_saimier.webp',
    weapon_icon: '/datamine/shared/media/artworks/saimier/weapon_icon.webp',
  },
};

export const ALL_APP_BANNERS: WishBannerDto[] = [
  ZOEY_WEAPON_BANNER,
  ZOEY_MATRIX_BANNER,
  STANDARD_WEAPON_BANNER,
  STANDARD_MATRIX_BANNER,
  BLACK_NUCLEUS_BANNER,
];



// Generates 115 pulls on the Standard Weapon banner (Gold Nucleus).
// Features fixed 80-pity guarantee, early SSR at pull 28, Black Gold currency,
// and NO 50/50 win/loss streaks (all drops are standard pool).
export function getStandardWeaponPulls(): WishRecordDto[] {
  const pulls: WishRecordDto[] = [];
  const baseTime = new Date('2026-08-15T12:00:00.000Z').getTime();

  // SSR drops at pull 28 (early) and pull 80 (hard guarantee!)
  let currentPity = 0;
  for (let i = 1; i <= 115; i++) {
    currentPity += 1;
    const isHardPity = currentPity === 80;
    const isEarlySsr = i === 28;
    const isSsr = isHardPity || isEarlySsr;
    const isSr = !isSsr && (i % 10 === 0);
    const pullTime = new Date(baseTime + i * 15000).toISOString();

    if (isSsr) {
      const isSamir = i === 28;
      pulls.push({
        id: `std_weapon_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: STANDARD_WEAPON_BANNER.id,
        banner_type: 'standard_weapon',
        item_id: isSamir ? 'dual_pistol' : 'sickle_fire',
        item_name: isSamir ? 'Dual EM Stars' : 'Scythe of the Crow',
        item_name_ru: isSamir ? 'Электромагнитные звёзды (Самир)' : 'Коса ворона (Кинг)',
        item_type: 'weapon',
        rarity: 5,
        pity_count: currentPity,
        is_guaranteed_pity: isHardPity,
        is_featured: false,
        streak_outcome: null, // No 50/50 on standard banners!
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639250000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'black_gold',
          amount: 11,
          extra_items: [{ item_id: 'black_gold', count: 10 }],
        },
      });
      if (isHardPity) {
        currentPity = 0;
      }
    } else if (isSr) {
      pulls.push({
        id: `std_weapon_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: STANDARD_WEAPON_BANNER.id,
        banner_type: 'standard_weapon',
        item_id: 'hammer_ice',
        item_name: 'Pummeler',
        item_name_ru: 'Громила (Эне)',
        item_type: 'weapon',
        rarity: 4,
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639250000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'black_gold',
          amount: 2,
          extra_items: [{ item_id: 'black_gold', count: 1 }],
        },
      });
    } else {
      pulls.push({
        id: `std_weapon_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: STANDARD_WEAPON_BANNER.id,
        banner_type: 'standard_weapon',
        item_id: 'spear_ice',
        item_name: 'Frosted Spear',
        item_name_ru: 'Ледяное копьё (Эхо)',
        item_type: 'weapon',
        rarity: 3,
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639250000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'black_gold',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  return pulls;
}

// Generates 75 pulls on the Standard Matrix banner (Proof of Purchase).
// Fixed 40-pity guarantee, Base Chip currency, 4 matrix slots (mind, memory, belief, emotion),
// and NO 50/50 win/loss streaks.
export function getStandardMatrixPulls(): WishRecordDto[] {
  const pulls: WishRecordDto[] = [];
  const baseTime = new Date('2026-08-18T10:00:00.000Z').getTime();

  let currentPity = 0;
  for (let i = 1; i <= 75; i++) {
    currentPity += 1;
    const isHardPity = currentPity === 40;
    const isEarlySsr = i === 18;
    const isSsr = isHardPity || isEarlySsr;
    const isSr = !isSsr && (i % 10 === 0);
    const pullTime = new Date(baseTime + i * 12000).toISOString();

    if (isSsr) {
      const slot = isHardPity ? 'belief' : 'mind';
      pulls.push({
        id: `std_matrix_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: STANDARD_MATRIX_BANNER.id,
        banner_type: 'standard_matrix',
        item_id: `suit_SSR4_${slot}`,
        item_name: `KING Matrix [${slot.toUpperCase()}]`,
        item_name_ru: `Матрица Кинг [${slot.toUpperCase()}]`,
        item_type: 'matrix',
        rarity: 5,
        slot,
        pity_count: currentPity,
        is_guaranteed_pity: isHardPity,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639251000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'base_chip',
          amount: 6,
          extra_items: [{ item_id: 'base_chip', count: 5 }],
        },
      });
      if (isHardPity) {
        currentPity = 0;
      }
    } else if (isSr) {
      pulls.push({
        id: `std_matrix_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: STANDARD_MATRIX_BANNER.id,
        banner_type: 'standard_matrix',
        item_id: 'matrix_sr_pepper_mind',
        item_name: 'Pepper Matrix [MIND]',
        item_name_ru: 'Матрица Пеппер [MIND]',
        item_type: 'matrix',
        rarity: 4,
        slot: 'mind',
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639251000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'base_chip',
          amount: 2,
          extra_items: [{ item_id: 'base_chip', count: 1 }],
        },
      });
    } else {
      pulls.push({
        id: `std_matrix_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: STANDARD_MATRIX_BANNER.id,
        banner_type: 'standard_matrix',
        item_id: 'matrix_r_generic',
        item_name: 'Standard Matrix R',
        item_name_ru: 'Стандартная матрица R',
        item_type: 'matrix',
        rarity: 3,
        slot: 'mind',
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639251000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'base_chip',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  return pulls;
}

// Generates 150 pulls on the Black Nucleus banner (Weapons Galore).
// Flat 0.3% SSR chance with NO pity counter (pity_target: 0),
// no Flame/Black Gold cashback, drops standard SSR (Samir at pull 92),
// and blue weapons convert to weapon battery EXP.
export function getBlackNucleusPulls(): WishRecordDto[] {
  const pulls: WishRecordDto[] = [];
  const baseTime = new Date('2026-08-01T08:00:00.000Z').getTime();

  for (let i = 1; i <= 150; i++) {
    const isSsr = i === 92; // 1 SSR out of 150 pulls (~0.67% observed rate)
    const isSr = !isSsr && (i % 25 === 0);
    const pullTime = new Date(baseTime + i * 8000).toISOString();

    if (isSsr) {
      pulls.push({
        id: `bn_pull_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: BLACK_NUCLEUS_BANNER.id,
        banner_type: 'black_nucleus',
        item_id: 'dual_pistol',
        item_name: 'Dual EM Stars',
        item_name_ru: 'Электромагнитные звёзды (Самир)',
        item_type: 'weapon',
        rarity: 5,
        pity_count: i,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639240000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'weapon_battery_iii',
          amount: 5,
          extra_items: [],
        },
      });
    } else if (isSr) {
      pulls.push({
        id: `bn_pull_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: BLACK_NUCLEUS_BANNER.id,
        banner_type: 'black_nucleus',
        item_id: 'stave_thunder',
        item_name: 'Staff of Scars',
        item_name_ru: 'Посох шрамов (Пеппер)',
        item_type: 'weapon',
        rarity: 4,
        pity_count: i,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639240000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'weapon_battery_ii',
          amount: 2,
          extra_items: [],
        },
      });
    } else {
      pulls.push({
        id: `bn_pull_${i}`,
        profile_id: 'demo-user-profile',
        banner_id: BLACK_NUCLEUS_BANNER.id,
        banner_type: 'black_nucleus',
        item_id: 'bow_fire',
        item_name: 'Composite Bow',
        item_name_ru: 'Составной лук',
        item_type: 'weapon',
        rarity: 3,
        pity_count: i,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639240000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'weapon_exp_r',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  return pulls;
}

// Generates 25 synthetic pulls on the concurrent Saki Fuwa rerun banner.
// These pulls immediately follow Zoey pulls (which ended at pity 18)
// and advance the shared pity counter from 19 to 43!
export function getCombinedLimitedWeaponPulls(): WishRecordDto[] {
  // Kept for compatibility; the sanitized demo currently contains only the Zoey event history.
  return [...getZoeyWeaponPulls()].sort(
    (a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
      || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '')
      || (a.item_index ?? 0) - (b.item_index ?? 0),
  );
}
