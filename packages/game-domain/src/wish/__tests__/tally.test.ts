import { describe, expect, it } from 'vitest';
import type { WishBannerDto, WishRecordDto } from '../types';
import { buildWishTallyData } from '../tally';

const banner: WishBannerDto = {
  id: 'limited-test',
  name: 'Limited test banner',
  name_en: 'Limited test banner',
  name_ru: 'Тестовый ивентовый баннер',
  banner_type: 'weapon_limited',
  character_id: 'test-character',
  weapon_id: 'test-weapon',
  pity_target: 80,
  start_date: '2026-01-01T00:00:00.000Z',
  end_date: '2026-01-15T00:00:00.000Z',
  currency: 'red_nucleus',
  cashback_currency: 'flame_gold',
  featured_ssr: ['featured-weapon'],
  featured_sr: [],
  standard_pool_items: [],
  assets: { background: '', splash: '', icon: '' },
};

function pull(overrides: Partial<WishRecordDto> & Pick<WishRecordDto, 'id' | 'rarity'>): WishRecordDto {
  const { id, rarity, ...rest } = overrides;
  return {
    id,
    profile_id: 'profile-1',
    banner_id: banner.id,
    banner_type: banner.banner_type,
    item_id: 'featured-weapon',
    item_name: 'Featured Weapon',
    item_type: 'weapon',
    rarity,
    pity_count: 1,
    is_guaranteed_pity: false,
    is_featured: rarity === 5,
    streak_outcome: 'unknown',
    pull_timestamp: `2026-01-01T00:00:${String(Number(id.replace('pull-', ''))).padStart(2, '0')}.000Z`,
    ...rest,
  };
}

describe('Wish community tally aggregation', () => {
  it('returns no banners when there are no imported records', () => {
    expect(buildWishTallyData([banner], [])).toEqual([]);
  });

  it('derives counts, rates, pity and outcomes only from supplied records', () => {
    const records = [
      pull({ id: 'pull-1', rarity: 3 }),
      pull({ id: 'pull-2', rarity: 4, item_id: 'sr-weapon', item_name: 'SR weapon', is_featured: false }),
      pull({ id: 'pull-3', rarity: 3 }),
      pull({ id: 'pull-4', rarity: 5, pity_count: 4, streak_outcome: 'win' }),
      pull({ id: 'pull-5', rarity: 5, pity_count: 6, is_featured: false, streak_outcome: 'loss' }),
    ];

    const [tally] = buildWishTallyData([banner], records);

    expect(tally.summary.total_pulls).toBe(5);
    expect(tally.summary.total_ssr).toBe(2);
    expect(tally.summary.total_sr).toBe(1);
    expect(tally.summary.total_users).toBe(1);
    expect(tally.summary.won_count).toBe(1);
    expect(tally.summary.lost_count).toBe(1);
    expect(tally.summary.win_rate).toBe(50);
    expect(tally.summary.avg_ssr_pity).toBe(5);
    expect(tally.pity_distribution[3].total_ssr).toBe(1);
    expect(tally.pity_distribution[5].total_ssr).toBe(1);
    expect(tally.ssr_drops[0].count).toBe(2);
    expect(tally.sr_drops[0].count).toBe(1);
  });
});
