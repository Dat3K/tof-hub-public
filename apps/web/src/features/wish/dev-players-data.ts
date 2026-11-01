import type { WishRecordDto } from '@tof-hub/contracts';
import {
  getZoeyWeaponPulls,
  getZoeyMatrixPulls,
  ZOEY_MATRIX_PULLS,
  ZOEY_WEAPON_BANNER,
  ZOEY_MATRIX_BANNER,
  STANDARD_WEAPON_BANNER,
  STANDARD_MATRIX_BANNER,
  BLACK_NUCLEUS_BANNER,
} from '@tof-hub/contracts';
import type { BannerTrack } from './types';
import demoBanners from '../../../public/game-data/wish-demo-banners.json';
import demoProfile from '../../../public/game-data/wish-demo-profile.json';
import { evaluateStreak, type WishStreakOutcome } from '@tof-hub/game-domain';
import {
  resolveServerFromUid,
  formatServerDisplay,
  type ServerRegion,
} from '@tof-hub/contracts';

export type PlayerTag = 'whale' | 'lucky' | 'unlucky' | 'collector' | 'starter' | 'veteran';
/** Server regions come from the contracts catalog; 'Global' / 'Global-Demo' mark profiles without a known server. */
export type PlayerRegion = ServerRegion | 'Global' | 'Global-Demo';

export interface WishPlayerProfile {
  pitySnapshots?: import('@tof-hub/contracts').WishPitySnapshot[];
  id: string;
  uid: string;
  nickname: string;
  server: string;
  serverId?: string;
  serverRegion: PlayerRegion;
  avatar: string;
  avatarCosmetic?: import('@tof-hub/ui').ProfileAvatarImage;
  avatarFrameCosmetic?: import('@tof-hub/ui').ProfileAvatarImage;
  characterName: string;
  totalPulls: number;
  pullsByTrack: {
    weapon_limited: number;
    matrix_limited: number;
    standard_weapon: number;
    standard_matrix: number;
    black_nucleus: number;
  };
  ssrCount: number;
  winRate5050: number; // percentage, e.g. 66.7
  lastActive: string;
  tag: PlayerTag;
  getPulls: () => {
    weaponLimited: WishRecordDto[];
    matrixLimited: WishRecordDto[];
    standardWeapon: WishRecordDto[];
    standardMatrix: WishRecordDto[];
    blackNucleus: WishRecordDto[];
  };
}

// Deterministic Pseudo-Random Generator based on seed string
function createSeededRandom(seedStr: string) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return function () {
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEAPON_SSR_POOL = [
  { id: 'Zoey_Phy', name: 'Vesper', name_ru: 'Веспер (Лира)', isLimited: true },
  { id: 'dkatana_ice', name: 'Heartstream', name_ru: 'Сердечный поток (Саки Фува)', isLimited: true },
  { id: 'suspension_thunder', name: 'Venus', name_ru: 'Венера (Немезида)', isLimited: false },
  { id: 'dgun_thunder', name: 'Dual EM Stars', name_ru: 'Парные ЭМ-звезды (Самир)', isLimited: false },
  { id: 'sickle_fire', name: 'Scythe of the Crow', name_ru: 'Коса ворона (Кинг)', isLimited: false },
  { id: 'bigsword_ice', name: 'Rosy Edge', name_ru: 'Лезвие розы (Мерил)', isLimited: false },
  { id: 'cube_fire', name: 'Negating Cube', name_ru: 'Отрицающий куб (Зеро)', isLimited: false },
  { id: 'bow_ice', name: 'Icewind Arrow', name_ru: 'Ледяная стрела (Цубаса)', isLimited: false },
];

const ZOEY_MATRIX_SSR_POOLS = {
  featured: ZOEY_MATRIX_PULLS.filter((pull) => pull.rarity === 5 && pull.is_featured),
  offBanner: ZOEY_MATRIX_PULLS.filter((pull) => pull.rarity === 5 && !pull.is_featured),
};
const MATRIX_SR_POOL = [
  ...new Map(
    ZOEY_MATRIX_PULLS.filter((pull) => pull.rarity === 4).map((pull) => [pull.item_id, pull]),
  ).values(),
];
const MATRIX_R_POOL = [
  ...new Map(
    ZOEY_MATRIX_PULLS.filter((pull) => pull.rarity === 3).map((pull) => [pull.item_id, pull]),
  ).values(),
];

const REAL_ZOEY_EXPORT_PULLS = {
  weaponLimited: getZoeyWeaponPulls(),
  matrixLimited: getZoeyMatrixPulls(),
};
const REAL_ZOEY_EXPORT_EVENT_SSRS = [
  ...REAL_ZOEY_EXPORT_PULLS.weaponLimited,
  ...REAL_ZOEY_EXPORT_PULLS.matrixLimited,
].filter((pull) => pull.rarity === 5);
const REAL_ZOEY_EXPORT_OUTCOMES = REAL_ZOEY_EXPORT_EVENT_SSRS.filter(
  (pull) => pull.streak_outcome === 'win' || pull.streak_outcome === 'loss'
);
const REAL_ZOEY_EXPORT_PULL_COUNT =
  REAL_ZOEY_EXPORT_PULLS.weaponLimited.length + REAL_ZOEY_EXPORT_PULLS.matrixLimited.length;
const REAL_ZOEY_EXPORT_LATEST_PULL = [...REAL_ZOEY_EXPORT_PULLS.weaponLimited, ...REAL_ZOEY_EXPORT_PULLS.matrixLimited]
  .reduce((latest, pull) => pull.pull_timestamp > latest ? pull.pull_timestamp : latest, '');

const SR_WEAPONS = [
  { id: 'spear_thunder', name: 'Thunderous Halberd', name_ru: 'Громовая алебарда (Эхо)' },
  { id: 'stave_thunder', name: 'Staff of Scars', name_ru: 'Посох шрамов (Пеппер)' },
  { id: 'hammer_ice', name: 'Pummeler', name_ru: 'Громила (Эне)' },
  { id: 'cannon_ice', name: 'The Terminator', name_ru: 'Терминатор (Хильда)' },
  { id: 'bow_fire', name: 'Composite Bow', name_ru: 'Составной лук (Бай Лин)' },
];

const R_WEAPONS = [
  { id: 'spear_ice', name: 'Frosted Spear', name_ru: 'Ледяное копьё (Эхо)' },
  { id: 'weapon_exp_sr', name: 'Weapon Battery III', name_ru: 'Аккумулятор оружия III' },
  { id: 'bow_fire_r', name: 'Composite Bow', name_ru: 'Составной лук' },
  { id: 'digger_physic', name: 'Combat Blade', name_ru: 'Боевой клинок' },
  { id: 'sword_thunder', name: 'EM Blade', name_ru: 'Электромагнитный клинок' },
];

const MATRIX_SLOTS = ['mind', 'memory', 'belief', 'emotion'] as const;

/**
 * Procedurally generates realistic, valid pull records for any custom profile
 * perfectly matching their track counts and SSR metrics.
 */
function generateSyntheticPullsForProfile(
  profileId: string,
  counts: {
    weapon_limited: number;
    matrix_limited: number;
    standard_weapon: number;
    standard_matrix: number;
    black_nucleus: number;
  },
  winRate: number,
  options: { includeFullOffBannerWeaponPool?: boolean; enforceStreakRules?: boolean } = {},
) {
  const rand = createSeededRandom(profileId);
  const baseTime = new Date('2026-09-20T10:00:00.000Z').getTime();

  // 1. Weapon Limited Pulls
  const weaponLimited: WishRecordDto[] = [];
  const weaponStreakHistory: WishStreakOutcome[] = [];
  let offBannerWeaponIndex = 0;
  let wPity = 0;
  for (let i = 1; i <= counts.weapon_limited; i++) {
    wPity++;
    const isHardPity = wPity >= 80;
    const isEarlySsr = rand() < 0.015;
    const isSsr = isHardPity || isEarlySsr;
    const isSr = !isSsr && (wPity % 10 === 0 || rand() < 0.08);
    const pullTime = new Date(baseTime + i * 25000).toISOString();
    const offBannerWeaponPool = options.includeFullOffBannerWeaponPool
      ? WEAPON_SSR_POOL.filter((weapon) => !weapon.isLimited)
      : WEAPON_SSR_POOL.slice(2, 7);

    if (isSsr) {
      const predictedOutcome = options.enforceStreakRules
        ? evaluateStreak(weaponStreakHistory).nextPrediction
        : 'unknown';
      const isWin = predictedOutcome === 'forced_win'
        ? true
        : predictedOutcome === 'forced_loss'
        ? false
        : rand() * 100 <= winRate;
      const featured = isWin
        ? WEAPON_SSR_POOL[0]
        : options.includeFullOffBannerWeaponPool
        ? offBannerWeaponPool[offBannerWeaponIndex++ % offBannerWeaponPool.length]
        : offBannerWeaponPool[Math.floor(rand() * offBannerWeaponPool.length)];
      weaponLimited.push({
        id: `${profileId}_w_lim_${i}`,
        profile_id: profileId,
        banner_id: ZOEY_WEAPON_BANNER.id,
        banner_type: 'weapon_limited',
        item_id: featured.id,
        item_name: featured.name,
        item_name_ru: featured.name_ru,
        item_type: 'weapon',
        rarity: 5,
        pity_count: wPity,
        is_guaranteed_pity: isHardPity,
        is_featured: isWin,
        streak_outcome: isWin ? 'win' : 'loss',
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260700000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'flame_gold',
          amount: 1,
          extra_items: [],
        },
      });
      weaponStreakHistory.push(isWin ? 'win' : 'loss');
      if (isHardPity) wPity = 0;
    } else if (isSr) {
      const sr = SR_WEAPONS[Math.floor(rand() * SR_WEAPONS.length)];
      weaponLimited.push({
        id: `${profileId}_w_lim_${i}`,
        profile_id: profileId,
        banner_id: ZOEY_WEAPON_BANNER.id,
        banner_type: 'weapon_limited',
        item_id: sr.id,
        item_name: sr.name,
        item_name_ru: sr.name_ru,
        item_type: 'weapon',
        rarity: 4,
        pity_count: wPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260700000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'flame_gold',
          amount: 1,
          extra_items: [],
        },
      });
    } else {
      const r = R_WEAPONS[Math.floor(rand() * R_WEAPONS.length)];
      weaponLimited.push({
        id: `${profileId}_w_lim_${i}`,
        profile_id: profileId,
        banner_id: ZOEY_WEAPON_BANNER.id,
        banner_type: 'weapon_limited',
        item_id: r.id,
        item_name: r.name,
        item_name_ru: r.name_ru,
        item_type: 'weapon',
        rarity: 3,
        pity_count: wPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260700000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'flame_gold',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  // 2. Matrix Limited Pulls
  const matrixLimited: WishRecordDto[] = [];
  const matrixStreakHistory: WishStreakOutcome[] = [];
  let mPity = 0;
  for (let i = 1; i <= counts.matrix_limited; i++) {
    mPity++;
    const isHardPity = mPity >= 40;
    const isEarlySsr = rand() < 0.02;
    const isSsr = isHardPity || isEarlySsr;
    const isSr = !isSsr && (mPity % 10 === 0 || rand() < 0.08);
    const pullTime = new Date(baseTime + 100000 + i * 20000).toISOString();
    const slot = MATRIX_SLOTS[i % MATRIX_SLOTS.length];

    if (isSsr) {
      const predictedOutcome = options.enforceStreakRules
        ? evaluateStreak(matrixStreakHistory).nextPrediction
        : 'unknown';
      const isWin = predictedOutcome === 'forced_win'
        ? true
        : predictedOutcome === 'forced_loss'
        ? false
        : rand() * 100 <= winRate;
      const itemPool = isWin ? ZOEY_MATRIX_SSR_POOLS.featured : ZOEY_MATRIX_SSR_POOLS.offBanner;
      const item = itemPool[Math.floor(rand() * itemPool.length)];
      matrixLimited.push({
        id: `${profileId}_m_lim_${i}`,
        profile_id: profileId,
        banner_id: ZOEY_MATRIX_BANNER.id,
        banner_type: 'matrix_limited',
        item_id: item.item_id,
        item_name: item.item_name,
        item_name_ru: item.item_name_ru,
        item_type: 'matrix',
        rarity: 5,
        slot: item.slot,
        pity_count: mPity,
        is_guaranteed_pity: isHardPity,
        is_featured: isWin,
        streak_outcome: isWin ? 'win' : 'loss',
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260800000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'overclocking_chip',
          amount: 1,
          extra_items: [],
        },
      });
      matrixStreakHistory.push(isWin ? 'win' : 'loss');
      if (isHardPity) mPity = 0;
    } else if (isSr) {
      const matrix = MATRIX_SR_POOL[Math.floor(rand() * MATRIX_SR_POOL.length)];
      matrixLimited.push({
        id: `${profileId}_m_lim_${i}`,
        profile_id: profileId,
        banner_id: ZOEY_MATRIX_BANNER.id,
        banner_type: 'matrix_limited',
        item_id: matrix.item_id,
        item_name: matrix.item_name,
        item_name_ru: matrix.item_name_ru,
        item_type: 'matrix',
        rarity: 4,
        slot: matrix.slot,
        pity_count: mPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260800000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'overclocking_chip',
          amount: 1,
          extra_items: [],
        },
      });
    } else {
      const matrix = MATRIX_R_POOL[Math.floor(rand() * MATRIX_R_POOL.length)];
      matrixLimited.push({
        id: `${profileId}_m_lim_${i}`,
        profile_id: profileId,
        banner_id: ZOEY_MATRIX_BANNER.id,
        banner_type: 'matrix_limited',
        item_id: matrix.item_id,
        item_name: matrix.item_name,
        item_name_ru: matrix.item_name_ru,
        item_type: 'matrix',
        rarity: 3,
        slot: matrix.slot,
        pity_count: mPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260800000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'overclocking_chip',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  // 3. Standard Weapon Pulls
  const standardWeapon: WishRecordDto[] = [];
  let swPity = 0;
  for (let i = 1; i <= counts.standard_weapon; i++) {
    swPity++;
    const isHardPity = swPity >= 80;
    const isEarlySsr = rand() < 0.015;
    const isSsr = isHardPity || isEarlySsr;
    const isSr = !isSsr && (swPity % 10 === 0 || rand() < 0.08);
    const pullTime = new Date(baseTime + 200000 + i * 15000).toISOString();

    if (isSsr) {
      const weapon = WEAPON_SSR_POOL[2 + Math.floor(rand() * (WEAPON_SSR_POOL.length - 2))];
      standardWeapon.push({
        id: `${profileId}_sw_${i}`,
        profile_id: profileId,
        banner_id: STANDARD_WEAPON_BANNER.id,
        banner_type: 'standard_weapon',
        item_id: weapon.id,
        item_name: weapon.name,
        item_name_ru: weapon.name_ru,
        item_type: 'weapon',
        rarity: 5,
        pity_count: swPity,
        is_guaranteed_pity: isHardPity,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260900000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'black_gold',
          amount: 1,
          extra_items: [],
        },
      });
      if (isHardPity) swPity = 0;
    } else if (isSr) {
      const sr = SR_WEAPONS[Math.floor(rand() * SR_WEAPONS.length)];
      standardWeapon.push({
        id: `${profileId}_sw_${i}`,
        profile_id: profileId,
        banner_id: STANDARD_WEAPON_BANNER.id,
        banner_type: 'standard_weapon',
        item_id: sr.id,
        item_name: sr.name,
        item_name_ru: sr.name_ru,
        item_type: 'weapon',
        rarity: 4,
        pity_count: swPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260900000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'black_gold',
          amount: 1,
          extra_items: [],
        },
      });
    } else {
      const r = R_WEAPONS[Math.floor(rand() * R_WEAPONS.length)];
      standardWeapon.push({
        id: `${profileId}_sw_${i}`,
        profile_id: profileId,
        banner_id: STANDARD_WEAPON_BANNER.id,
        banner_type: 'standard_weapon',
        item_id: r.id,
        item_name: r.name,
        item_name_ru: r.name_ru,
        item_type: 'weapon',
        rarity: 3,
        pity_count: swPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639260900000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'black_gold',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  // 4. Standard Matrix Pulls
  const standardMatrix: WishRecordDto[] = [];
  let smPity = 0;
  for (let i = 1; i <= counts.standard_matrix; i++) {
    smPity++;
    const isHardPity = smPity >= 40;
    const isEarlySsr = rand() < 0.02;
    const isSsr = isHardPity || isEarlySsr;
    const isSr = !isSsr && (smPity % 10 === 0 || rand() < 0.08);
    const pullTime = new Date(baseTime + 300000 + i * 18000).toISOString();
    const slot = MATRIX_SLOTS[i % MATRIX_SLOTS.length];

    if (isSsr) {
      const matrixPool = ZOEY_MATRIX_SSR_POOLS.offBanner;
      const mat = matrixPool[Math.floor(rand() * matrixPool.length)];
      standardMatrix.push({
        id: `${profileId}_sm_${i}`,
        profile_id: profileId,
        banner_id: STANDARD_MATRIX_BANNER.id,
        banner_type: 'standard_matrix',
        item_id: mat.item_id,
        item_name: mat.item_name,
        item_name_ru: mat.item_name_ru,
        item_type: 'matrix',
        rarity: 5,
        slot: mat.slot,
        pity_count: smPity,
        is_guaranteed_pity: isHardPity,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639261000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'base_chip',
          amount: 1,
          extra_items: [],
        },
      });
      if (isHardPity) smPity = 0;
    } else {
      const matrix = isSr
        ? MATRIX_SR_POOL[Math.floor(rand() * MATRIX_SR_POOL.length)]
        : MATRIX_R_POOL[Math.floor(rand() * MATRIX_R_POOL.length)];
      standardMatrix.push({
        id: `${profileId}_sm_${i}`,
        profile_id: profileId,
        banner_id: STANDARD_MATRIX_BANNER.id,
        banner_type: 'standard_matrix',
        item_id: matrix.item_id,
        item_name: matrix.item_name,
        item_name_ru: matrix.item_name_ru,
        item_type: 'matrix',
        rarity: isSr ? 4 : 3,
        slot: matrix.slot,
        pity_count: smPity,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639261000000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'base_chip',
          amount: 1,
          extra_items: [],
        },
      });
    }
  }

  // 5. Black Nucleus Pulls
  const blackNucleus: WishRecordDto[] = [];
  let bnInterval = 0;
  for (let i = 1; i <= counts.black_nucleus; i++) {
    bnInterval++;
    const isSsr = rand() < 0.003;
    const isSr = !isSsr && rand() < 0.03;
    const pullTime = new Date(baseTime + 400000 + i * 8000).toISOString();

    if (isSsr) {
      const weapon = WEAPON_SSR_POOL[2 + Math.floor(rand() * (WEAPON_SSR_POOL.length - 2))];
      blackNucleus.push({
        id: `${profileId}_bn_${i}`,
        profile_id: profileId,
        banner_id: BLACK_NUCLEUS_BANNER.id,
        banner_type: 'black_nucleus',
        item_id: weapon.id,
        item_name: weapon.name,
        item_name_ru: weapon.name_ru,
        item_type: 'weapon',
        rarity: 5,
        pity_count: bnInterval,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639261100000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'none',
          amount: 0,
          extra_items: [],
        },
      });
      bnInterval = 0;
    } else {
      const item = isSr
        ? SR_WEAPONS[Math.floor(rand() * SR_WEAPONS.length)]
        : R_WEAPONS[Math.floor(rand() * R_WEAPONS.length)];
      blackNucleus.push({
        id: `${profileId}_bn_${i}`,
        profile_id: profileId,
        banner_id: BLACK_NUCLEUS_BANNER.id,
        banner_type: 'black_nucleus',
        item_id: item.id,
        item_name: item.name,
        item_name_ru: item.name_ru,
        item_type: 'weapon',
        rarity: isSr ? 4 : 3,
        pity_count: bnInterval,
        is_guaranteed_pity: false,
        is_featured: false,
        streak_outcome: null,
        pull_timestamp: pullTime,
        item_index: (i - 1) % 10,
        group_ticks: `639261100000${i.toString().padStart(6, '0')}`,
        compensation: {
          currency_id: 'none',
          amount: 0,
          extra_items: [],
        },
      });
    }
  }

  return {
    weaponLimited,
    matrixLimited,
    standardWeapon,
    standardMatrix,
    blackNucleus,
  };
}

// A complete, clearly synthetic account for checking all five order tracks.
// The final event uses a redated copy of the sanitized Zoey sample. Standard
// and Black Nucleus records are deterministic fixtures.
const FULL_HISTORY_DEMO_ID = 'full-history-demo';
const FULL_HISTORY_DEMO_EXTRA = generateSyntheticPullsForProfile(
  FULL_HISTORY_DEMO_ID,
  {
    weapon_limited: 0,
    matrix_limited: 0,
    standard_weapon: 110,
    standard_matrix: 48,
    black_nucleus: 320,
  },
  50,
);

// Curated fictional pulls on real recent banners from the generated registry.
const demoBanner = (id: string) => {
  const banner = demoBanners.find((entry) => entry.id === id);
  if (!banner) throw new Error(`Missing generated demo banner: ${id}`);
  return banner;
};
const demoWeaponItem = (banner: ReturnType<typeof demoBanner>) => {
  const { id, name, nameRu } = banner.featuredItems[0];
  return { id, name, nameRu };
};
const toDotNetTicks = (timestamp: string) =>
  (621_355_968_000_000_000n + BigInt(Date.parse(timestamp)) * 10_000n).toString();

function createHistoricalDemoBannerPulls({
  bannerId,
  bannerType,
  totalPulls,
  startAt,
  ssrPityPositions,
  outcomes,
  featuredItem,
  featuredMatrixItems,
  startingPity = 0,
  matrix = false,
}: {
  bannerId: string;
  bannerType: 'weapon_limited' | 'matrix_limited';
  totalPulls: number;
  startAt: string;
  ssrPityPositions: number[];
  outcomes: Array<'win' | 'loss'>;
  featuredItem: { id: string; name: string; nameRu: string; slot?: WishRecordDto['slot'] };
  featuredMatrixItems?: Array<{ id: string; name: string; nameRu: string; slot: WishRecordDto['slot'] }>;
  startingPity?: number;
  matrix?: boolean;
}): WishRecordDto[] {
  const templates = matrix
    ? REAL_ZOEY_EXPORT_PULLS.matrixLimited
    : REAL_ZOEY_EXPORT_PULLS.weaponLimited;
  const standardTemplates = FULL_HISTORY_DEMO_EXTRA.standardWeapon;
  const featuredMatrixTemplate = matrix
    ? ZOEY_MATRIX_PULLS.find((pull) => pull.item_id === featuredItem.id)
    : undefined;
  const offBannerMatrixTemplates = matrix
    ? ZOEY_MATRIX_PULLS.filter((pull) => pull.rarity === 5 && !pull.is_featured)
    : [];
  const featuredWeaponTemplate = !matrix
    ? WEAPON_SSR_POOL.find((weapon) => weapon.id.toLowerCase() === featuredItem.id.toLowerCase())
    : undefined;
  const template = featuredMatrixTemplate ?? templates[0] ?? standardTemplates[0];
  const templateByRarity = (rarity: number) =>
    templates.find((pull) => pull.rarity === rarity) ?? standardTemplates.find((pull) => pull.rarity === rarity) ?? template;
  const pityLimit = matrix ? 40 : 80;
  const ssrPullIndices = new Set<number>();
  let nextPullIndex = 0;
  let previousSsrPity = startingPity;
  for (const pityPosition of ssrPityPositions) {
    nextPullIndex += previousSsrPity === pityLimit
      ? pityPosition
      : pityPosition - previousSsrPity;
    ssrPullIndices.add(nextPullIndex);
    previousSsrPity = pityPosition;
  }

  const startTime = Date.parse(startAt);
  const currencyId = matrix ? 'overclocking_chip' : 'flame_gold';
  let pity = startingPity;
  let srPity = 0;
  let outcomeIndex = 0;
  let featuredMatrixIndex = 0;

  return Array.from({ length: totalPulls }, (_, index) => {
    const pullNumber = index + 1;
    pity += 1;
    srPity += 1;
    const isSsr = ssrPullIndices.has(pullNumber);
    const isHardPity = isSsr && pity === pityLimit;
    const isSr = !isSsr && srPity === 10;
    const rarity = isSsr ? 5 : isSr ? 4 : 3;
    const pullTimestamp = new Date(startTime + index * 15 * 60_000).toISOString();
    let source = templateByRarity(rarity);
    let itemId = source.item_id;
    let itemName = source.item_name;
    let itemNameRu = source.item_name_ru;
    let itemType: 'weapon' | 'matrix' = matrix ? 'matrix' : 'weapon';
    let slot = source.slot;
    let isFeatured = false;
    let streakOutcome: WishStreakOutcome | null = null;

    if (isSsr) {
      const outcome = outcomes[outcomeIndex++] ?? 'loss';
      isFeatured = outcome === 'win';
      streakOutcome = outcome;
      if (isFeatured) {
        const featured = matrix && featuredMatrixItems?.length
          ? featuredMatrixItems[featuredMatrixIndex++ % featuredMatrixItems.length]
          : featuredItem;
        itemId = featured.id;
        itemName = featured.name;
        itemNameRu = featured.nameRu;
        slot = featured.slot ?? slot;
        if (featuredMatrixTemplate) {
          source = featuredMatrixTemplate;
          itemType = 'matrix';
        }
      } else if (matrix) {
        const offBanner = offBannerMatrixTemplates[(outcomeIndex - 1) % offBannerMatrixTemplates.length];
        if (offBanner) {
          source = offBanner;
          itemId = offBanner.item_id;
          itemName = offBanner.item_name;
          itemNameRu = offBanner.item_name_ru;
          slot = offBanner.slot;
          itemType = 'matrix';
        }
      } else if (!matrix) {
        const offBanner = WEAPON_SSR_POOL.filter((weapon) =>
          !weapon.isLimited
          && weapon.id !== featuredWeaponTemplate?.id
          && weapon.id !== 'suspension_thunder',
        );
        const picked = offBanner[(outcomeIndex - 1) % offBanner.length];
        itemId = picked.id;
        itemName = picked.name;
        itemNameRu = picked.name_ru;
      }
    }

    const record: WishRecordDto = {
      ...source,
      id: `${FULL_HISTORY_DEMO_ID}_${bannerId}_${pullNumber}`,
      profile_id: FULL_HISTORY_DEMO_ID,
      banner_id: bannerId,
      banner_type: bannerType,
      item_id: itemId,
      item_name: itemName,
      item_name_ru: itemNameRu,
      item_type: itemType,
      rarity,
      ...(matrix ? { slot } : {}),
      pity_count: pity,
      is_guaranteed_pity: isHardPity,
      is_featured: isSsr && isFeatured,
      streak_outcome: streakOutcome,
      pull_timestamp: pullTimestamp,
      item_index: index % 10,
      group_ticks: toDotNetTicks(pullTimestamp),
      compensation: { currency_id: currencyId, amount: 1, extra_items: [] },
    };

    if (isHardPity) pity = 0;
    if (isSsr || isSr) srPity = 0;
    return record;
  });
}

const AGLEIA_WEAPON = demoBanner('weapon-agleia');
const AGLEIA_MATRIX = demoBanner('matrix-agleia');
const BERRY_WEAPON = demoBanner('weapon-berry');
const BERRY_MATRIX = demoBanner('matrix-berry');
const GEFION_WEAPON = demoBanner('weapon-gefion');

const AGLEIA_WEAPON_PULLS = createHistoricalDemoBannerPulls({
  bannerId: AGLEIA_WEAPON.id,
  bannerType: 'weapon_limited',
  totalPulls: 90,
  startAt: '2025-12-28T12:00:00.000Z',
  ssrPityPositions: [50, 80],
  outcomes: ['win', 'loss'],
  featuredItem: demoWeaponItem(AGLEIA_WEAPON),
});

const AGLEIA_MATRIX_PULLS = createHistoricalDemoBannerPulls({
  bannerId: AGLEIA_MATRIX.id,
  bannerType: 'matrix_limited',
  totalPulls: 240,
  startAt: '2026-01-03T12:00:00.000Z',
  ssrPityPositions: [40, 40, 40, 40, 40, 40],
  outcomes: ['win', 'win', 'loss', 'win', 'win', 'loss'],
  featuredItem: { ...AGLEIA_MATRIX.featuredItems[0], slot: 'mind' },
  featuredMatrixItems: AGLEIA_MATRIX.featuredItems as Array<{
    id: string; name: string; nameRu: string; slot: WishRecordDto['slot'];
  }>,
  matrix: true,
});

const BERRY_C6R0_WEAPON_PULLS = createHistoricalDemoBannerPulls({
  bannerId: BERRY_WEAPON.id,
  bannerType: 'weapon_limited',
  totalPulls: 470,
  startAt: '2026-01-20T12:00:00.000Z',
  // Agleia ends at 10/80. Seven featured copies give Berry A6.
  startingPity: 10,
  ssrPityPositions: [50, 80, 42, 80, 58, 80, 35, 80, 48, 80, 80],
  outcomes: ['win', 'win', 'loss', 'win', 'win', 'loss', 'win', 'win', 'loss', 'win', 'loss'],
  featuredItem: demoWeaponItem(BERRY_WEAPON),
});

const BERRY_R0_MATRIX_PULLS = createHistoricalDemoBannerPulls({
  bannerId: BERRY_MATRIX.id,
  bannerType: 'matrix_limited',
  totalPulls: 240,
  startAt: '2026-01-26T12:00:00.000Z',
  ssrPityPositions: [40, 40, 40, 40, 40, 40],
  outcomes: ['win', 'loss', 'win', 'win', 'loss', 'win'],
  featuredItem: { ...BERRY_MATRIX.featuredItems[0], slot: 'mind' },
  featuredMatrixItems: BERRY_MATRIX.featuredItems as Array<{
    id: string; name: string; nameRu: string; slot: WishRecordDto['slot'];
  }>,
  matrix: true,
});

const GEFION_WEAPON_PULLS = createHistoricalDemoBannerPulls({
  bannerId: GEFION_WEAPON.id,
  bannerType: 'weapon_limited',
  totalPulls: 80,
  startAt: '2026-04-14T12:00:00.000Z',
  ssrPityPositions: [30, 80],
  outcomes: ['win', 'loss'],
  featuredItem: demoWeaponItem(GEFION_WEAPON),
});

const dateDemoPulls = (pulls: WishRecordDto[], offsetMs: number) => pulls.map((pull) => ({
  ...pull,
  pull_timestamp: new Date(Date.parse(pull.pull_timestamp) + offsetMs).toISOString(),
  group_ticks: pull.group_ticks
    ? (BigInt(pull.group_ticks) + BigInt(offsetMs) * 10_000n).toString()
    : undefined,
}));

const SAKI_STANDARD_DROP = (() => {
  const standardPulls = dateDemoPulls(FULL_HISTORY_DEMO_EXTRA.standardWeapon,
    Date.parse('2023-08-08T00:00:00.000Z')
    - Date.parse(FULL_HISTORY_DEMO_EXTRA.standardWeapon[0].pull_timestamp));
  const sakiDropIndex = standardPulls.findIndex((pull) => pull.rarity === 5);
  if (sakiDropIndex < 0) return standardPulls;

  const drop = standardPulls[sakiDropIndex];
  standardPulls[sakiDropIndex] = {
    ...drop,
    item_id: 'Dkatana_ice',
    item_name: 'Heartstream',
    item_name_ru: 'Поток сердца (Саки Фува)',
    banner_id: STANDARD_WEAPON_BANNER.id,
    banner_type: 'standard_weapon',
    is_featured: false,
    streak_outcome: null,
  };
  return standardPulls;
})();

// The sanitized sample preserves its original exported timestamps. Only its
// copy in the fictional account is dated inside Zoey's actual banner period.
const zoeyDemoOffsetMs = Date.parse(demoBanner('weapon-zoey').startDate)
  + 13 * 24 * 60 * 60_000 + 9 * 60 * 60_000
  - Date.parse(REAL_ZOEY_EXPORT_PULLS.weaponLimited[0].pull_timestamp);
const orderDemoPulls = (pulls: WishRecordDto[]) => pulls
  .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
    || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '')
    || (a.item_index ?? 0) - (b.item_index ?? 0))
  .map((pull) => ({
    ...pull,
    id: `${FULL_HISTORY_DEMO_ID}_${pull.id}`,
    profile_id: FULL_HISTORY_DEMO_ID,
  }));
// This fictional veteran starts with all SR weapons and Meryl at 6★. The
// sanitized Zoey source also records which standard SSRs were already maxed.
// Compensation amounts include the base +1 Flame/Black Gold for that pull.
const FULL_HISTORY_DEMO_MAXED_STANDARD_IDS = new Set([
  'bigsword_ice',
  ...REAL_ZOEY_EXPORT_PULLS.weaponLimited
    .filter((pull) => pull.rarity === 5 && !pull.is_featured && (pull.compensation?.amount ?? 0) >= 10)
    .map((pull) => pull.item_id.toLowerCase()),
]);
const withDemoWeaponCashback = (pulls: WishRecordDto[]) => pulls.map((pull) => {
  if (pull.rarity < 4) return pull;
  const extra = pull.rarity === 4
    ? 1
    : !pull.is_featured && FULL_HISTORY_DEMO_MAXED_STANDARD_IDS.has(pull.item_id.toLowerCase())
      ? 10
      : 0;
  const currencyId = pull.banner_type === 'standard_weapon' ? 'black_gold' : 'flame_gold';
  return {
    ...pull,
    compensation: {
      currency_id: currencyId,
      amount: 1 + extra,
      extra_items: extra > 0 ? [{ item_id: currencyId, count: extra }] : [],
    },
  };
});
const FULL_HISTORY_DEMO_PULLS = {
  weaponLimited: withDemoWeaponCashback(orderDemoPulls([
    ...AGLEIA_WEAPON_PULLS,
    ...BERRY_C6R0_WEAPON_PULLS,
    ...GEFION_WEAPON_PULLS,
    ...dateDemoPulls(REAL_ZOEY_EXPORT_PULLS.weaponLimited, zoeyDemoOffsetMs),
  ])),
  matrixLimited: orderDemoPulls([
    ...AGLEIA_MATRIX_PULLS,
    ...BERRY_R0_MATRIX_PULLS,
    ...dateDemoPulls(REAL_ZOEY_EXPORT_PULLS.matrixLimited, zoeyDemoOffsetMs),
  ]),
  standardWeapon: withDemoWeaponCashback(SAKI_STANDARD_DROP),
  standardMatrix: dateDemoPulls(FULL_HISTORY_DEMO_EXTRA.standardMatrix,
    Date.parse('2026-03-08T12:00:00.000Z') - Date.parse(FULL_HISTORY_DEMO_EXTRA.standardMatrix[0].pull_timestamp)),
  blackNucleus: dateDemoPulls(FULL_HISTORY_DEMO_EXTRA.blackNucleus,
    Date.parse('2026-03-20T12:00:00.000Z') - Date.parse(FULL_HISTORY_DEMO_EXTRA.blackNucleus[0].pull_timestamp)),
};
const FULL_HISTORY_DEMO_RECORDS = Object.values(FULL_HISTORY_DEMO_PULLS).flat();
const FULL_HISTORY_DEMO_OUTCOMES = [
  ...FULL_HISTORY_DEMO_PULLS.weaponLimited,
  ...FULL_HISTORY_DEMO_PULLS.matrixLimited,
].filter((pull) => pull.rarity === 5 && (pull.streak_outcome === 'win' || pull.streak_outcome === 'loss'));
const ASTRA_WHALE_ID = 'player-astra-whale';
const ASTRA_WHALE_COUNTS = {
  weapon_limited: 640,
  matrix_limited: 320,
  standard_weapon: 240,
  standard_matrix: 120,
  black_nucleus: 160,
};
const ASTRA_WHALE_PULLS = generateSyntheticPullsForProfile(
  ASTRA_WHALE_ID,
  ASTRA_WHALE_COUNTS,
  60,
  { includeFullOffBannerWeaponPool: true, enforceStreakRules: true },
);
const ASTRA_WHALE_RECORDS = Object.values(ASTRA_WHALE_PULLS).flat();
const ASTRA_WHALE_EVENT_SSRS = [
  ...ASTRA_WHALE_PULLS.weaponLimited,
  ...ASTRA_WHALE_PULLS.matrixLimited,
].filter((pull) => pull.rarity === 5);
const ASTRA_WHALE_OUTCOMES = ASTRA_WHALE_EVENT_SSRS.filter(
  (pull) => pull.streak_outcome === 'win' || pull.streak_outcome === 'loss',
);

const FULL_HISTORY_DEMO_SERVER = resolveServerFromUid(demoProfile.uid);

// Canonical Roster of Players
export const DEV_PLAYERS_DATA: WishPlayerProfile[] = ([
  {
    id: FULL_HISTORY_DEMO_ID,
    // Same example account as the Build card demo (generated wish-demo-profile.json); the pulls stay synthetic.
    uid: demoProfile.uid,
    nickname: demoProfile.nickname,
    server: FULL_HISTORY_DEMO_SERVER ? formatServerDisplay(FULL_HISTORY_DEMO_SERVER) : 'Synthetic fixture',
    serverId: FULL_HISTORY_DEMO_SERVER?.id,
    serverRegion: FULL_HISTORY_DEMO_SERVER?.region ?? ('Global-Demo' as const),
    avatar: demoProfile.avatar.icon,
    avatarCosmetic: demoProfile.avatar,
    avatarFrameCosmetic: demoProfile.avatarFrame,
    characterName: 'Hilda',
    totalPulls: FULL_HISTORY_DEMO_RECORDS.length,
    pullsByTrack: {
      weapon_limited: FULL_HISTORY_DEMO_PULLS.weaponLimited.length,
      matrix_limited: FULL_HISTORY_DEMO_PULLS.matrixLimited.length,
      standard_weapon: FULL_HISTORY_DEMO_PULLS.standardWeapon.length,
      standard_matrix: FULL_HISTORY_DEMO_PULLS.standardMatrix.length,
      black_nucleus: FULL_HISTORY_DEMO_PULLS.blackNucleus.length,
    },
    ssrCount: FULL_HISTORY_DEMO_RECORDS.filter((pull) => pull.rarity === 5).length,
    winRate5050: FULL_HISTORY_DEMO_OUTCOMES.length > 0
      ? (FULL_HISTORY_DEMO_OUTCOMES.filter((pull) => pull.streak_outcome === 'win').length / FULL_HISTORY_DEMO_OUTCOMES.length) * 100
      : 0,
    lastActive: FULL_HISTORY_DEMO_RECORDS.reduce((latest, pull) => pull.pull_timestamp > latest ? pull.pull_timestamp : latest, '').slice(0, 16).replace('T', ' '),
    tag: 'veteran',
    getPulls: () => FULL_HISTORY_DEMO_PULLS,
  },
  {
    id: 'demo-user-profile',
    uid: 'Sanitized',
    nickname: 'Real Zoey Export Sample',
    server: 'Sanitized export',
    serverRegion: 'Global-Demo' as const,
    avatar: '/datamine/shared/media/artworks/zoey/touxiang_zuoyi_s.webp',
    characterName: 'Zoey',
    totalPulls: REAL_ZOEY_EXPORT_PULL_COUNT,
    pullsByTrack: {
      weapon_limited: REAL_ZOEY_EXPORT_PULLS.weaponLimited.length,
      matrix_limited: REAL_ZOEY_EXPORT_PULLS.matrixLimited.length,
      standard_weapon: 0,
      standard_matrix: 0,
      black_nucleus: 0,
    },
    ssrCount: REAL_ZOEY_EXPORT_EVENT_SSRS.length,
    winRate5050: REAL_ZOEY_EXPORT_OUTCOMES.length > 0
      ? (REAL_ZOEY_EXPORT_OUTCOMES.filter((pull) => pull.streak_outcome === 'win').length / REAL_ZOEY_EXPORT_OUTCOMES.length) * 100
      : 0,
    lastActive: REAL_ZOEY_EXPORT_LATEST_PULL.slice(0, 16).replace('T', ' '),
    tag: 'veteran',
    getPulls: () => ({
      weaponLimited: getZoeyWeaponPulls(),
      matrixLimited: getZoeyMatrixPulls(),
      standardWeapon: [],
      standardMatrix: [],
      blackNucleus: [],
    }),
  },
  {
    id: ASTRA_WHALE_ID,
    uid: '1200581920',
    nickname: 'AstraWhale',
    server: 'Solaris',
    serverId: '12005',
    serverRegion: 'North America',
    avatar: '/datamine/shared/media/artworks/lin/touxiang_linye_s.webp',
    characterName: 'Lin (Лин)',
    totalPulls: ASTRA_WHALE_RECORDS.length,
    pullsByTrack: ASTRA_WHALE_COUNTS,
    ssrCount: ASTRA_WHALE_RECORDS.filter((pull) => pull.rarity === 5).length,
    winRate5050: ASTRA_WHALE_OUTCOMES.length > 0
      ? (ASTRA_WHALE_OUTCOMES.filter((pull) => pull.streak_outcome === 'win').length / ASTRA_WHALE_OUTCOMES.length) * 100
      : 0,
    lastActive: ASTRA_WHALE_RECORDS.reduce((latest, pull) => pull.pull_timestamp > latest ? pull.pull_timestamp : latest, '').slice(0, 16).replace('T', ' '),
    tag: 'whale',
    getPulls: () => ASTRA_WHALE_PULLS,
  },
  {
    id: 'player-f2p-lucky',
    uid: '1300249182',
    nickname: 'F2P_LuckyStrike',
    server: 'Alintheus',
    serverId: '13002',
    serverRegion: 'Europe',
    avatar: '/datamine/shared/media/artworks/claudia/touxiang_kelaodiya_s.webp',
    characterName: 'Claudia (Клаудия)',
    totalPulls: 210,
    pullsByTrack: {
      weapon_limited: 90,
      matrix_limited: 0,
      standard_weapon: 60,
      standard_matrix: 20,
      black_nucleus: 40,
    },
    ssrCount: 8,
    winRate5050: 100.0,
    lastActive: '2026-09-27 12:05',
    tag: 'lucky',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-f2p-lucky',
        {
          weapon_limited: 90,
          matrix_limited: 0,
          standard_weapon: 60,
          standard_matrix: 20,
          black_nucleus: 40,
        },
        100.0
      ),
  },
  {
    id: 'player-saki-enjoyer',
    uid: '1301512441',
    nickname: 'SakiEnjoyer99',
    server: 'Ether',
    serverId: '13015',
    serverRegion: 'Europe',
    avatar: '/datamine/shared/media/artworks/saki-fuwa/touxiang_bupoxiao_s.webp',
    characterName: 'Saki Fuwa (Саки Фува)',
    totalPulls: 520,
    pullsByTrack: {
      weapon_limited: 310,
      matrix_limited: 110,
      standard_weapon: 50,
      standard_matrix: 30,
      black_nucleus: 20,
    },
    ssrCount: 14,
    winRate5050: 60.0,
    lastActive: '2026-09-27 14:15',
    tag: 'whale',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-saki-enjoyer',
        {
          weapon_limited: 310,
          matrix_limited: 110,
          standard_weapon: 50,
          standard_matrix: 30,
          black_nucleus: 20,
        },
        60.0
      ),
  },
  {
    id: 'player-dolphin-king',
    uid: '1100584712',
    nickname: 'DolphinKing',
    server: 'Babel',
    serverId: '11005',
    serverRegion: 'Asia-Pacific',
    avatar: '/datamine/shared/media/artworks/alyss/touxiang_ailisi_s.webp',
    characterName: 'Alyss (Алисс)',
    totalPulls: 430,
    pullsByTrack: {
      weapon_limited: 180,
      matrix_limited: 70,
      standard_weapon: 90,
      standard_matrix: 40,
      black_nucleus: 50,
    },
    ssrCount: 11,
    winRate5050: 50.0,
    lastActive: '2026-09-27 10:20',
    tag: 'veteran',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-dolphin-king',
        {
          weapon_limited: 180,
          matrix_limited: 70,
          standard_weapon: 90,
          standard_matrix: 40,
          black_nucleus: 50,
        },
        50.0
      ),
  },
  {
    id: 'player-hard-pity',
    uid: '1200983109',
    nickname: 'HardPityCurse',
    server: 'Tempest',
    serverId: '12009',
    serverRegion: 'North America',
    avatar: '/datamine/shared/media/artworks/saimier/touxiang_saimier.webp',
    characterName: 'Samir (Самир)',
    totalPulls: 360,
    pullsByTrack: {
      weapon_limited: 190,
      matrix_limited: 40,
      standard_weapon: 70,
      standard_matrix: 30,
      black_nucleus: 30,
    },
    ssrCount: 6,
    winRate5050: 33.3,
    lastActive: '2026-09-26 23:45',
    tag: 'unlucky',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-hard-pity',
        {
          weapon_limited: 190,
          matrix_limited: 40,
          standard_weapon: 70,
          standard_matrix: 30,
          black_nucleus: 30,
        },
        33.3
      ),
  },
  {
    id: 'player-matrix-collector',
    uid: '1300652194',
    nickname: 'MatrixCollector',
    server: 'Valstamm',
    serverId: '13006',
    serverRegion: 'Europe',
    avatar: '/datamine/shared/media/artworks/ruby/touxiang_leibei_s.webp',
    characterName: 'Ruby (Руби)',
    totalPulls: 580,
    pullsByTrack: {
      weapon_limited: 140,
      matrix_limited: 240,
      standard_weapon: 60,
      standard_matrix: 100,
      black_nucleus: 40,
    },
    ssrCount: 15,
    winRate5050: 50.0,
    lastActive: '2026-09-27 11:55',
    tag: 'collector',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-matrix-collector',
        {
          weapon_limited: 140,
          matrix_limited: 240,
          standard_weapon: 60,
          standard_matrix: 100,
          black_nucleus: 40,
        },
        50.0
      ),
  },
  {
    id: 'player-nucleus-hoarder',
    uid: '1102141928',
    nickname: 'PurpleNucleusHoarder',
    server: 'Atlantis',
    serverId: '11021',
    serverRegion: 'Asia-Pacific',
    avatar: '/datamine/shared/media/artworks/king/touxiang_king_s.webp',
    characterName: 'King (Кинг)',
    totalPulls: 1380,
    pullsByTrack: {
      weapon_limited: 60,
      matrix_limited: 0,
      standard_weapon: 80,
      standard_matrix: 40,
      black_nucleus: 1200,
    },
    ssrCount: 9,
    winRate5050: 50.0,
    lastActive: '2026-09-27 08:30',
    tag: 'collector',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-nucleus-hoarder',
        {
          weapon_limited: 60,
          matrix_limited: 0,
          standard_weapon: 80,
          standard_matrix: 40,
          black_nucleus: 1200,
        },
        50.0
      ),
  },
  {
    id: 'player-fiona-main',
    uid: '1200218231',
    nickname: 'FionaMain',
    server: 'Nightfall',
    serverId: '12002',
    serverRegion: 'North America',
    avatar: '/datamine/shared/media/artworks/fiona/touxiang_feiouna_s.webp',
    characterName: 'Fiona (Фиона)',
    totalPulls: 460,
    pullsByTrack: {
      weapon_limited: 220,
      matrix_limited: 100,
      standard_weapon: 80,
      standard_matrix: 30,
      black_nucleus: 30,
    },
    ssrCount: 12,
    winRate5050: 66.7,
    lastActive: '2026-09-27 13:00',
    tag: 'whale',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-fiona-main',
        {
          weapon_limited: 220,
          matrix_limited: 100,
          standard_weapon: 80,
          standard_matrix: 30,
          black_nucleus: 30,
        },
        66.7
      ),
  },
  {
    id: 'player-standard-vet',
    uid: '1300200448',
    nickname: 'StandardVeteran',
    server: 'Alintheus',
    serverId: '13002',
    serverRegion: 'Europe',
    avatar: '/datamine/shared/media/artworks/nemesis-voidpiercer/avatar_liekong_a0.webp',
    characterName: 'Nemesis (Немезида)',
    totalPulls: 820,
    pullsByTrack: {
      weapon_limited: 150,
      matrix_limited: 50,
      standard_weapon: 380,
      standard_matrix: 160,
      black_nucleus: 80,
    },
    ssrCount: 22,
    winRate5050: 50.0,
    lastActive: '2026-09-26 19:20',
    tag: 'veteran',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-standard-vet',
        {
          weapon_limited: 150,
          matrix_limited: 50,
          standard_weapon: 380,
          standard_matrix: 160,
          black_nucleus: 80,
        },
        50.0
      ),
  },
  {
    id: 'player-fenrir-beat',
    uid: '1500392831',
    nickname: 'FenrirBeat',
    server: 'Tiamat',
    serverId: '15003',
    serverRegion: 'South America',
    avatar: '/datamine/shared/media/artworks/fenrir/touxiang_fenlier_s.webp',
    characterName: 'Fenrir (Фенрир)',
    totalPulls: 390,
    pullsByTrack: {
      weapon_limited: 170,
      matrix_limited: 60,
      standard_weapon: 80,
      standard_matrix: 40,
      black_nucleus: 40,
    },
    ssrCount: 10,
    winRate5050: 60.0,
    lastActive: '2026-09-27 05:12',
    tag: 'lucky',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-fenrir-beat',
        {
          weapon_limited: 170,
          matrix_limited: 60,
          standard_weapon: 80,
          standard_matrix: 40,
          black_nucleus: 40,
        },
        60.0
      ),
  },
  {
    id: 'player-sea-fan',
    uid: '1600188219',
    nickname: 'PhantasiaStar',
    server: 'Phantasia',
    serverId: '16001',
    serverRegion: 'Southeast Asia',
    avatar: '/datamine/shared/media/artworks/fenrir/touxiang_fenlier_s.webp',
    characterName: 'Fenrir (Фенрир)',
    totalPulls: 340,
    pullsByTrack: {
      weapon_limited: 160,
      matrix_limited: 40,
      standard_weapon: 80,
      standard_matrix: 30,
      black_nucleus: 30,
    },
    ssrCount: 9,
    winRate5050: 66.7,
    lastActive: '2026-09-27 16:30',
    tag: 'veteran',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-sea-fan',
        {
          weapon_limited: 160,
          matrix_limited: 40,
          standard_weapon: 80,
          standard_matrix: 30,
          black_nucleus: 30,
        },
        66.7
      ),
  },
  {
    id: 'player-kr-pioneer',
    uid: '1400199412',
    nickname: '아이다개척자',
    server: 'Astra',
    serverId: '14001',
    serverRegion: 'Korea',
    avatar: '/datamine/shared/media/artworks/lin/touxiang_linye_s.webp',
    characterName: 'Lin (Лин)',
    totalPulls: 890,
    pullsByTrack: {
      weapon_limited: 420,
      matrix_limited: 210,
      standard_weapon: 140,
      standard_matrix: 70,
      black_nucleus: 50,
    },
    ssrCount: 24,
    winRate5050: 71.4,
    lastActive: '2026-09-27 17:05',
    tag: 'whale',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-kr-pioneer',
        {
          weapon_limited: 420,
          matrix_limited: 210,
          standard_weapon: 140,
          standard_matrix: 70,
          black_nucleus: 50,
        },
        71.4
      ),
  },
  {
    id: 'player-tw-wanderer',
    uid: '115000144910',
    nickname: '星島流浪者',
    server: '#1150001',
    serverId: '1150001',
    serverRegion: 'Taiwan',
    avatar: '/datamine/shared/media/artworks/ruby/touxiang_leibei_s.webp',
    characterName: 'Ruby (Руби)',
    totalPulls: 260,
    pullsByTrack: {
      weapon_limited: 120,
      matrix_limited: 0,
      standard_weapon: 80,
      standard_matrix: 30,
      black_nucleus: 30,
    },
    ssrCount: 9,
    winRate5050: 80.0,
    lastActive: '2026-09-27 14:50',
    tag: 'lucky',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-tw-wanderer',
        {
          weapon_limited: 120,
          matrix_limited: 0,
          standard_weapon: 80,
          standard_matrix: 30,
          black_nucleus: 30,
        },
        80.0
      ),
  },
  {
    id: 'player-newbie-exp',
    uid: '1300294112',
    nickname: 'NewbieExplorer',
    server: 'Alintheus',
    serverId: '13002',
    serverRegion: 'Europe',
    avatar: '/datamine/shared/media/artworks/pepper/tips_avatar_sr_peipei.webp',
    characterName: 'Pepper (Пеппер)',
    totalPulls: 75,
    pullsByTrack: {
      weapon_limited: 35,
      matrix_limited: 0,
      standard_weapon: 25,
      standard_matrix: 0,
      black_nucleus: 15,
    },
    ssrCount: 2,
    winRate5050: 100.0,
    lastActive: '2026-09-27 15:02',
    tag: 'starter',
    getPulls: () =>
      generateSyntheticPullsForProfile(
        'player-newbie-exp',
        {
          weapon_limited: 35,
          matrix_limited: 0,
          standard_weapon: 25,
          standard_matrix: 0,
          black_nucleus: 15,
        },
        100.0
      ),
  },
] as WishPlayerProfile[]).filter((profile) => profile.id === FULL_HISTORY_DEMO_ID);
