import type {
  WishBannerDto,
  WishRecordDto,
  WishTallyBannerSummary,
  WishTallyData,
  WishTallyItemDrop,
  WishTallyPityPoint,
} from './types';

/** Build public, anonymous statistics from imported pull records only. */
export function buildWishTallyData(
  banners: WishBannerDto[],
  records: WishRecordDto[],
): WishTallyData[] {
  const recordsByBanner = new Map<string, WishRecordDto[]>();
  for (const record of records) {
    const group = recordsByBanner.get(record.banner_id) ?? [];
    group.push(record);
    recordsByBanner.set(record.banner_id, group);
  }

  const populatedBanners = banners
    .map((banner) => ({ banner, records: recordsByBanner.get(banner.id) ?? [] }))
    .filter(({ records: bannerRecords }) => bannerRecords.length > 0);

  const summaries = populatedBanners.map(({ banner, records: bannerRecords }) =>
    summarizeBanner(banner, bannerRecords),
  );
  return populatedBanners.map(({ banner, records: bannerRecords }, index) => {
    const summary = summaries[index];
    const intervals = getObservedIntervals(banner, bannerRecords);
    return {
      banner,
      summary,
      pity_distribution: buildPityDistribution(banner, bannerRecords, intervals.ssr),
      ssr_drops: buildItemDrops(bannerRecords.filter((record) => record.rarity === 5), intervals.ssr, summary.total_ssr),
      sr_drops: buildItemDrops(bannerRecords.filter((record) => record.rarity === 4), intervals.sr, summary.total_sr),
      all_banner_summaries: summaries,
    };
  });
}

function summarizeBanner(banner: WishBannerDto, records: WishRecordDto[]): WishTallyBannerSummary {
  const ssr = records.filter((record) => record.rarity === 5);
  const sr = records.filter((record) => record.rarity === 4);
  const outcomes = banner.banner_type.includes('limited')
    ? ssr.filter((record) => record.streak_outcome === 'win' || record.streak_outcome === 'loss')
    : [];
  const won = outcomes.filter((record) => record.streak_outcome === 'win').length;
  const lost = outcomes.length - won;
  const intervals = getObservedIntervals(banner, records);

  return {
    banner_id: banner.id,
    banner_name: banner.name_en || banner.name,
    banner_name_ru: banner.name_ru || banner.name,
    banner_type: banner.banner_type,
    featured_character: banner.name_en || banner.name,
    featured_character_ru: banner.name_ru || banner.name,
    start_date: banner.start_date,
    end_date: banner.end_date,
    icon: banner.assets.icon || banner.assets.weapon_icon || banner.assets.matrix_icon || '',
    splash: banner.assets.splash || banner.assets.background || '',
    total_pulls: records.length,
    total_ssr: ssr.length,
    ssr_rate: percent(ssr.length, records.length),
    avg_ssr_pity: average(ssr.map((record) => intervals.ssr.get(record.id) ?? 0).filter(Boolean)),
    won_count: won,
    lost_count: lost,
    win_rate: percent(won, outcomes.length),
    total_sr: sr.length,
    sr_rate: percent(sr.length, records.length),
    avg_sr_pity: average(sr.map((record) => intervals.sr.get(record.id) ?? 0).filter(Boolean)),
    total_users: new Set(records.map((record) => record.profile_id)).size,
  };
}

function getObservedIntervals(banner: WishBannerDto, records: WishRecordDto[]) {
  const byProfile = new Map<string, WishRecordDto[]>();
  for (const record of records) {
    const profileRecords = byProfile.get(record.profile_id) ?? [];
    profileRecords.push(record);
    byProfile.set(record.profile_id, profileRecords);
  }

  const ssr = new Map<string, number>();
  const sr = new Map<string, number>();
  for (const profileRecords of byProfile.values()) {
    profileRecords.sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp) || a.id.localeCompare(b.id));
    let sinceSsr = 0;
    let sinceSr = 0;
    let ssrIntervalKnown=true,srIntervalKnown=true;
    for (const record of profileRecords) {
      if(record.rarity===0){ssrIntervalKnown=false;srIntervalKnown=false;}
      sinceSsr += 1;
      sinceSr += 1;
      if (record.rarity === 5) {
        if (record.pity_count > 0 && (banner.pity_target>0 || ssrIntervalKnown)) ssr.set(record.id, banner.pity_target > 0 ? record.pity_count : sinceSsr);
        sinceSsr = 0;
        ssrIntervalKnown=true;
      }
      if (record.rarity >= 4) {
        if (record.rarity === 4&&srIntervalKnown) sr.set(record.id, sinceSr);
        sinceSr = 0;
        srIntervalKnown=true;
      }
    }
  }
  return { ssr, sr };
}

function buildPityDistribution(
  banner: WishBannerDto,
  records: WishRecordDto[],
  intervals: Map<string, number>,
): WishTallyPityPoint[] {
  const ssr = records.filter((record) => record.rarity === 5);
  const maxPity = banner.pity_target > 0
    ? banner.pity_target
    : ssr.reduce((max, record) => Math.max(max, intervals.get(record.id) ?? 0), 0);
  if (!maxPity) return [];

  const winsByPity = new Map<number, number>();
  const lossesByPity = new Map<number, number>();
  const countByPity = new Map<number, number>();
  for (const record of ssr) {
    const pity = intervals.get(record.id) ?? 0;
    if (pity < 1 || pity > maxPity) continue;
    countByPity.set(pity, (countByPity.get(pity) ?? 0) + 1);
    if (record.streak_outcome === 'win') winsByPity.set(pity, (winsByPity.get(pity) ?? 0) + 1);
    if (record.streak_outcome === 'loss') lossesByPity.set(pity, (lossesByPity.get(pity) ?? 0) + 1);
  }

  let cumulative = 0;
  return Array.from({ length: maxPity }, (_, index): WishTallyPityPoint => {
    const pity = index + 1;
    const won = winsByPity.get(pity) ?? 0;
    const lost = lossesByPity.get(pity) ?? 0;
    const count = countByPity.get(pity) ?? 0;
    cumulative += count;
    return {
      pity,
      total_ssr: count,
      won_ssr: won,
      lost_ssr: lost,
      cumulative_rate: percent(cumulative, ssr.length),
    };
  });
}

function buildItemDrops(
  records: WishRecordDto[],
  intervals: Map<string, number>,
  total: number,
): WishTallyItemDrop[] {
  const groups = new Map<string, WishRecordDto[]>();
  for (const record of records) {
    const group = groups.get(record.item_id) ?? [];
    group.push(record);
    groups.set(record.item_id, group);
  }

  return [...groups.entries()].map(([itemId, drops]) => {
    const observedPity = drops.map((drop) => intervals.get(drop.id) ?? 0).filter(Boolean);
    return {
      item_id: itemId,
      item_name: drops[0].item_name || itemId,
      item_name_ru: drops[0].item_name_ru || drops[0].item_name || itemId,
      item_type: drops[0].item_type,
      rarity: drops[0].rarity,
      icon: '',
      count: drops.length,
      share_pct: percent(drops.length, total),
      avg_pity: average(observedPity),
      min_pity: observedPity.length ? Math.min(...observedPity) : 0,
      max_pity: observedPity.length ? Math.max(...observedPity) : 0,
      is_featured: drops.some((drop) => drop.is_featured),
    };
  }).sort((a, b) => b.count - a.count || a.item_name.localeCompare(b.item_name));
}

function percent(part: number, whole: number): number {
  return whole ? Number(((part / whole) * 100).toFixed(2)) : 0;
}

function average(values: number[]): number {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;
}
