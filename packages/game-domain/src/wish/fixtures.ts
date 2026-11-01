import type {
  WishBannerDto,
  WishRecordDto,
  WishMatrixSlot,
} from './types';

export const DEMO_PROFILE_ID = 'demo-user-profile';
export const DEMO_UID = 'demo-user-0000000001';


export const YANMIAO_WEAPON_BANNER: WishBannerDto = {
  id: 'weapon-yanmiao',
  name: 'Eternal Bladestorm',
  name_en: 'Eternal Bladestorm',
  name_ru: 'Бесконечная буря клинков',
  banner_type: 'weapon_limited',
  character_id: 'yanmiao',
  weapon_id: 'Killknife_physic',
  pity_target: 80,
  start_date: '2023-12-21T04:00:00.000Z',
  end_date: '2024-01-08T21:00:00.000Z',
  currency: 'red_nucleus',
  cashback_currency: 'flame_gold',
  featured_ssr: ['Killknife_physic'],
  featured_sr: [],
  standard_pool_items: [
    'digger_thunder',
    'sword_ice',
    'dual_pistol',
    'cube_fire',
    'shield_fire',
    'chakram_physic',
    'bow_ice',
    'scythe_fire',
  ],
  assets: {
    background: '/datamine/shared/media/artworks/yanmiao/UI_UPyanmiaobg.webp',
    splash: '/datamine/shared/media/artworks/yanmiao/UI_UP_yanmiao_lihui_01.webp',
    icon: '/game-assets/webp/Hotta/Content/Resources/Icon/weapon/Icon/item_Weapon_SSR_Killknife.webp',
    weapon_icon: '/game-assets/webp/Hotta/Content/Resources/Icon/weapon/Icon/item_Weapon_SSR_Killknife.webp',
  },
};

export const YANMIAO_MATRIX_BANNER: WishBannerDto = {
  id: 'matrix-yanmiao',
  name: 'Yan Miao Matrix Special Order',
  name_en: 'Yan Miao Matrix Special Order',
  name_ru: 'Спецзаказ матриц: Янь Мяо',
  banner_type: 'matrix_limited',
  character_id: 'yanmiao',
  matrix_id: 'suit_SSR39',
  pity_target: 40,
  start_date: '2023-12-21T04:00:00.000Z',
  end_date: '2024-01-08T21:00:00.000Z',
  currency: 'special_voucher',
  cashback_currency: 'overclocking_chip',
  featured_ssr: ['suit_SSR39'],
  featured_sr: [],
  standard_pool_items: [
    'suit_SSR1',
    'suit_SSR2',
    'suit_SSR3',
    'suit_SSR4',
    'suit_SSR5',
    'suit_SSR6',
    'suit_SSR7',
    'suit_SSR8',
  ],
  assets: {
    background: '/datamine/shared/media/artworks/yanmiao/UI_UPyanmiaobg.webp',
    splash: '/datamine/shared/media/artworks/yanmiao/UI_UP_yanmiao_lihui_01.webp',
    icon: '/datamine/shared/media/artworks/yanmiao/icon_matrix_ssr39_512.webp',
    matrix_icon: '/datamine/shared/media/artworks/yanmiao/icon_matrix_ssr39_512.webp',
  },
};

export const ALL_DEMO_BANNERS: WishBannerDto[] = [
  YANMIAO_WEAPON_BANNER,
  YANMIAO_MATRIX_BANNER,
];

// Helper to generate the 248 weapon pull fixture
export function generateYanmiaoWeaponPulls(): WishRecordDto[] {
  const records: WishRecordDto[] = [];
  const baseTime = new Date('2023-12-21T10:00:00.000Z').getTime();

  // Defined SSR positions and outcomes
  // SSR on: 23 (Win), 80 (Loss), 137 (Loss), 160 (Win), 240 (Loss)
  const ssrMap: Record<number, { itemId: string; name: string; isFeatured: boolean; outcome: 'win' | 'loss' }> = {
    23: { itemId: 'Killknife_physic', name: 'Equilibrium', isFeatured: true, outcome: 'win' },
    80: { itemId: 'digger_thunder', name: 'Thunderous Halberd', isFeatured: false, outcome: 'loss' },
    137: { itemId: 'sword_ice', name: 'Rosy Edge', isFeatured: false, outcome: 'loss' },
    160: { itemId: 'Killknife_physic', name: 'Equilibrium', isFeatured: true, outcome: 'win' },
    240: { itemId: 'dual_pistol', name: 'Dual EM Stars', isFeatured: false, outcome: 'loss' },
  };

  let currentPity = 0;

  for (let pullNum = 1; pullNum <= 248; pullNum++) {
    currentPity += 1;
    const isHardPity = currentPity === 80;
    const isSsr = pullNum in ssrMap;
    const isSr = !isSsr && (pullNum % 10 === 0);
    const pullTimestamp = new Date(baseTime + pullNum * 30000).toISOString();
    const groupTicks = `63830882${Math.floor(pullNum / 10).toString().padStart(6, '0')}0000000`;
    const itemIndex = (pullNum - 1) % 10;

    if (isSsr) {
      const ssrInfo = ssrMap[pullNum];
      const compensationAmount = ssrInfo.isFeatured ? 1 : 11;
      const extraItems = ssrInfo.isFeatured
        ? []
        : [{ item_id: 'WeaponFragment_UP29', count: 10 }];

      records.push({
        id: `wish_weapon_${DEMO_PROFILE_ID}_${pullNum}`,
        profile_id: DEMO_PROFILE_ID,
        banner_id: YANMIAO_WEAPON_BANNER.id,
        banner_type: 'weapon_limited',
        item_id: ssrInfo.itemId,
        item_name: ssrInfo.name,
        item_type: 'weapon',
        rarity: 5,
        pity_count: currentPity,
        is_guaranteed_pity: isHardPity,
        is_featured: ssrInfo.isFeatured,
        streak_outcome: ssrInfo.outcome,
        pull_timestamp: pullTimestamp,
        group_ticks: groupTicks,
        item_index: itemIndex,
        compensation: {
          currency_id: 'WeaponFragment_UP29',
          amount: compensationAmount,
          extra_items: extraItems,
        },
      });

      if (isHardPity) {
        currentPity = 0;
      }
    } else if (isSr) {
      records.push({
        id: `wish_weapon_${DEMO_PROFILE_ID}_${pullNum}`,
        profile_id: DEMO_PROFILE_ID,
        banner_id: YANMIAO_WEAPON_BANNER.id,
        banner_type: 'weapon_limited',
        item_id: 'stave_thunder',
        item_name: 'Staff of Scars',
        item_type: 'weapon',
        rarity: 4,
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTimestamp,
        group_ticks: groupTicks,
        item_index: itemIndex,
        compensation: {
          currency_id: 'WeaponFragment_UP29',
          amount: 2,
          extra_items: [{ item_id: 'WeaponFragment_UP29', count: 1 }],
        },
      });
    } else {
      records.push({
        id: `wish_weapon_${DEMO_PROFILE_ID}_${pullNum}`,
        profile_id: DEMO_PROFILE_ID,
        banner_id: YANMIAO_WEAPON_BANNER.id,
        banner_type: 'weapon_limited',
        item_id: 'bow_fire',
        item_name: 'Composite Bow',
        item_type: 'weapon',
        rarity: 3,
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTimestamp,
        group_ticks: groupTicks,
        item_index: itemIndex,
        compensation: {
          currency_id: 'WeaponFragment_UP29',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  return records;
}

// Helper to generate 120 matrix pull fixture
export function generateYanmiaoMatrixPulls(): WishRecordDto[] {
  const records: WishRecordDto[] = [];
  const baseTime = new Date('2023-12-22T10:00:00.000Z').getTime();

  const ssrMatrixMap: Record<number, { slot: WishMatrixSlot; isHardPity: boolean }> = {
    40: { slot: 'mind', isHardPity: true },
    72: { slot: 'memory', isHardPity: false },
    80: { slot: 'belief', isHardPity: true },
    120: { slot: 'emotion', isHardPity: true },
  };

  let currentPity = 0;

  for (let pullNum = 1; pullNum <= 120; pullNum++) {
    currentPity += 1;
    const isSsr = pullNum in ssrMatrixMap;
    const isSr = !isSsr && (pullNum % 10 === 0);
    const pullTimestamp = new Date(baseTime + pullNum * 30000).toISOString();
    const groupTicks = `63830982${Math.floor(pullNum / 10).toString().padStart(6, '0')}0000000`;
    const itemIndex = (pullNum - 1) % 10;

    if (isSsr) {
      const info = ssrMatrixMap[pullNum];
      records.push({
        id: `wish_matrix_${DEMO_PROFILE_ID}_${pullNum}`,
        profile_id: DEMO_PROFILE_ID,
        banner_id: YANMIAO_MATRIX_BANNER.id,
        banner_type: 'matrix_limited',
        item_id: `suit_SSR39_${info.slot}`,
        item_name: `Yan Miao Matrix [${info.slot.toUpperCase()}]`,
        item_type: 'matrix',
        rarity: 5,
        pity_count: currentPity,
        is_guaranteed_pity: info.isHardPity,
        is_featured: true,
        slot: info.slot,
        streak_outcome: null,
        pull_timestamp: pullTimestamp,
        group_ticks: groupTicks,
        item_index: itemIndex,
        compensation: {
          currency_id: 'overclocking_chip',
          amount: 1,
          extra_items: [],
        },
      });

      if (info.isHardPity) {
        currentPity = 0;
      }
    } else if (isSr) {
      records.push({
        id: `wish_matrix_${DEMO_PROFILE_ID}_${pullNum}`,
        profile_id: DEMO_PROFILE_ID,
        banner_id: YANMIAO_MATRIX_BANNER.id,
        banner_type: 'matrix_limited',
        item_id: 'matrix_sr_pepper',
        item_name: 'Pepper Matrix',
        item_type: 'matrix',
        rarity: 4,
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTimestamp,
        group_ticks: groupTicks,
        item_index: itemIndex,
        compensation: {
          currency_id: 'overclocking_chip',
          amount: 1,
          extra_items: [],
        },
      });
    } else {
      records.push({
        id: `wish_matrix_${DEMO_PROFILE_ID}_${pullNum}`,
        profile_id: DEMO_PROFILE_ID,
        banner_id: YANMIAO_MATRIX_BANNER.id,
        banner_type: 'matrix_limited',
        item_id: 'matrix_r_generic',
        item_name: 'Standard Matrix R',
        item_type: 'matrix',
        rarity: 3,
        pity_count: currentPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTimestamp,
        group_ticks: groupTicks,
        item_index: itemIndex,
        compensation: {
          currency_id: 'overclocking_chip',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  return records;
}

export const EMPTY_WISH_HISTORY: WishRecordDto[] = [];

export const PARTIAL_WISH_HISTORY: WishRecordDto[] = generateYanmiaoWeaponPulls().slice(0, 35);

export const UNKNOWN_ITEM_WISH_RECORD: WishRecordDto = {
  id: `wish_unknown_${DEMO_PROFILE_ID}_99999`,
  profile_id: DEMO_PROFILE_ID,
  banner_id: YANMIAO_WEAPON_BANNER.id,
  banner_type: 'weapon_limited',
  item_id: 'item_unknown_custom_001',
  item_name: 'Unrecognized Relic Shard',
  item_type: 'weapon',
  rarity: 3,
  pity_count: 1,
  is_guaranteed_pity: false,
  is_featured: false,
  streak_outcome: null,
  pull_timestamp: '2023-12-21T12:00:00.000Z',
  group_ticks: '638308820000000000',
  item_index: 0,
  compensation: {
    currency_id: 'unknown_currency_code',
    amount: 1,
    extra_items: [],
  },
};

