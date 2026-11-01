import { describe, it, expect, vi } from 'vitest';
import {
  getSeasonsList,
  getBuffsDictionary,
  fetchSeasonFloors,
} from './oow-data';
import {
  resolveFceBoss,
  getEnemyPresentation,
  formatHpValue,
  formatPercentDelta,
  formatResistancePercent,
  formatMobsCount,
  buildMainEnemiesList,
  createOowMobHash,
  getOowMobLinkId,
  getSeasonColor,
  getLiveSeasonNumber,
} from './oow-domain';
import { OOW_COPY } from './oow-copy';
import { getBaselineBosses } from '../fce/fce-data';

describe('OOW Datamine Feature', () => {
  it('stores an opened enemy in the URL hash and reads legacy query links', () => {
    expect(createOowMobHash('boss/hum 061')).toBe('#mob=boss%2Fhum+061');
    expect(getOowMobLinkId('?s=23&mob=legacy-id', '#mob=boss%2Fhum+061')).toBe('boss/hum 061');
    expect(getOowMobLinkId('?s=23&mob=legacy-id', '')).toBe('legacy-id');
    expect(getOowMobLinkId('?s=23', '')).toBeNull();
  });

  it('returns only materialized seasons and never manufactures a fallback history', () => {
    const summary = {
      recentSeasons: [{ season: 23, title: 'Season 23', floorCount: 28 }],
      currentSeason: { season: 23, title: 'Season 23', floorCount: 28 },
      mmoRecentSeasons: [
        { season: 4, title: 'MMO Season 4', floorCount: 36 },
        { season: 5, title: 'MMO Season 5', floorCount: 36 },
      ],
    };

    expect(getSeasonsList(summary, 'standard')).toHaveLength(1);
    expect(getSeasonsList(summary, 'standard')[0].season).toBe(23);
    expect(getSeasonsList(summary, 'mmo').map((season) => season.season)).toEqual([4, 5]);
    expect(getSeasonsList(null, 'standard')).toEqual([]);
  });

  it('requests floor data by an unseen future MMO season ID', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ floors: [{ floor: 1 }] }),
    } as Response);

    try {
      await expect(fetchSeasonFloors('mmo', 5)).resolves.toEqual([{ floor: 1 }]);
      expect(fetchSpy).toHaveBeenCalledWith('/game-data/en/oow/seasons/mmo_s05.json');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('builds the buff lookup from materialized data only', () => {
    const buffs = getBuffsDictionary({
      flame_boost: { name: 'Flame Boost', desc: 'Increase flame damage.', icon: '/buff.webp' },
    });

    expect(buffs.size).toBe(1);
    expect(buffs.get('flame_boost')?.nameEn).toBe('Flame Boost');
  });

  it('retains the exact culture for season shards and falls back only on 404', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ floors: [{ floor: 1 }] }) } as Response);
    try {
      await expect(fetchSeasonFloors('mmo', 5, 'zh-Hans-SG')).resolves.toEqual([{ floor: 1 }]);
      expect(fetchSpy.mock.calls.map(call => call[0])).toEqual([
        '/game-data/zh-Hans-SG/oow/seasons/mmo_s05.json', '/game-data/en/oow/seasons/mmo_s05.json',
      ]);
      fetchSpy.mockClear().mockResolvedValue({ ok: false, status: 500 } as Response);
      await expect(fetchSeasonFloors('mmo', 5, 'ja')).resolves.toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally { fetchSpy.mockRestore(); }
  });

  describe('resolveFceBoss', () => {
    it('maps known legacy boss overrides correctly', () => {
      const zhuge = resolveFceBoss({ codeName: 'boss_hum_061_shtt', enemyKind: 'boss' });
      expect(zhuge).not.toBeNull();
      expect(zhuge.slug).toBe('zhuge-chen');

      const devourer = resolveFceBoss({ codeName: 'boss_038_balance', enemyKind: 'boss' });
      expect(devourer).not.toBeNull();
      expect(devourer.slug).toBe('devourer');

      const aegis = resolveFceBoss({ codeName: 'boss_hum_022', enemyKind: 'boss' });
      expect(aegis).not.toBeNull();
      expect(aegis.slug).toBe('aegis');
    });

    it('returns null for non-boss entities', () => {
      expect(resolveFceBoss({ codeName: 'elite_hum_035', enemyKind: 'elite' })).toBeNull();
      expect(resolveFceBoss(null)).toBeNull();
    });

    it('offers only the verified PNG that belongs to the selected detail image', () => {
      const image = '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/mon_hum_049.webp';
      const png = '/game-assets/png/Hotta/Content/Resources/UI/void/boss/mon_hum_049.png';
      const enemy = { codeName: '049_Balance', image, detailImageFull: image };
      expect(getEnemyPresentation(enemy).detailImagePng).toBeNull();
      expect(getEnemyPresentation({ ...enemy, detailImagePng: png }).detailImagePng).toBe(png);
      expect(getEnemyPresentation({
        ...enemy, imagePng: png, detailImageFull: image.replace('mon_hum_049', 'other_fixture'),
      }).detailImagePng).toBeNull();
    });

    it('uses legacy OoW identity overrides for materialized records', () => {
      const presentation = getEnemyPresentation({
        nameEn: 'Unknown Boss',
        nameRu: 'Неизвестный босс',
        codeName: 'boss_072',
        enemyKind: 'boss',
        image: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_04.webp',
      });

      expect(presentation.nameEn).toBe('Weaver');
      expect(presentation.nameRu).toBe('Ткач');
      expect(presentation.avatar).toContain('Boss_hum_072.webp');
    });

    it('joins OoW boss records to the canonical FCE mechanics catalog', () => {
      const fceIndex = { bosses: getBaselineBosses('standard') };
      const rudolph = resolveFceBoss({ codeName: 'boss_030', enemyKind: 'boss' }, fceIndex);

      expect(rudolph?.slug).toBe('rudolph');
      expect(rudolph?.mechanics).toHaveLength(4);
      expect(rudolph?.mechanics[1].html).toContain('Damage reduction 60% from front.');
    });

    it('uses the MMO WorldBossList portrait for Devourer', () => {
      const presentation = getEnemyPresentation(
        { codeName: 'boss_038_balance', enemyKind: 'boss' },
        { mode: 'mmo', bosses: getBaselineBosses('mmo') },
      );

      expect(presentation.avatar).toContain('/WorldBossList/BOSS/Boss_7.webp');
      expect(presentation.detailImage).toContain('/WorldBossList/BOSS/Boss_7.webp');
    });

    it('uses a materialized portrait for Quasivita', () => {
      const presentation = getEnemyPresentation({ codeName: 'boss_hum_058', enemyKind: 'boss' });

      expect(presentation.avatar).toContain('/void/boss/boss_hum_058.webp');
      expect(presentation.avatar).not.toContain('TX_boss_hum_058.webp');
    });
  });

  describe('Formatting domain helpers', () => {
    it('formats HP values correctly in G, M, and RAW units', () => {
      const gResult = formatHpValue(5000000000, 'G');
      expect(gResult.value).toBe('5.00');
      expect(gResult.unitLabel).toBe('G');

      const mResult = formatHpValue(5000000000, 'M');
      expect(mResult.value).toBe('5000.0');
      expect(mResult.unitLabel).toBe('M');

      const rawResult = formatHpValue(5000000000, 'RAW');
      expect(rawResult.unitLabel).toBe('');
      expect(rawResult.value).toContain('5,000,000,000');
    });

    it('formats percentage deltas correctly', () => {
      const up = formatPercentDelta(50);
      expect(up.text).toBe('+50.0%');
      expect(up.color).toBe('#ff7d95');

      const down = formatPercentDelta(-50);
      expect(down.text).toBe('-50.0%');
      expect(down.color).toBe('#4fe3c1');

      const flat = formatPercentDelta(0);
      expect(flat.text).toBe('0%');
      expect(flat.color).toBe('#cbc2de');
    });

    it('formats mob count strings', () => {
      expect(formatMobsCount(1, false)).toBe('1 mob');
      expect(formatMobsCount(5, false)).toBe('5 mobs');
      expect(formatMobsCount(1, true)).toBe('1 моб');
      expect(formatMobsCount(3, true)).toBe('3 моба');
      expect(formatMobsCount(5, true)).toBe('5 мобов');
    });

    it('matches legacy one-decimal resistance presentation', () => {
      expect(formatResistancePercent(73.93)).toBe('73.9');
      expect(formatResistancePercent(undefined)).toBe('85.0');
    });
  });

  describe('buildMainEnemiesList', () => {
    it('summarizes normal mobs or lists bosses', () => {
      const floor = {
        floor: 1,
        enemies: [{ enemyKind: 'normal', nameEn: 'Test Enemy', count: 3, hp: 100 }],
      } as any;
      const lineup = buildMainEnemiesList(floor, null, false);
      expect(lineup.length).toBeGreaterThan(0);
    });
  });

  it('provides comprehensive bilingual copy table', () => {
    expect(OOW_COPY.en.heroTitle).toBe('Enemy Stats & Seasonal Scaling');
    expect(OOW_COPY.ru.heroTitle).toBe('Характеристики противников и сезонная сложность');
    expect(OOW_COPY.en.tableTabLabel).toBe('Floor Table & Lineups');
    expect(OOW_COPY.ru.tableTabLabel).toBe('Таблица этажей и составы');
    expect(OOW_COPY.en.badgeDrop).toBe('DROP');
    expect(OOW_COPY.ru.badgeDrop).toBe('ДРОП');
    expect(OOW_COPY.en.badgeMutator).toBe('MUTATOR');
    expect(OOW_COPY.ru.badgeMutator).toBe('МУТАТОР');
    expect(OOW_COPY.en.waveFinalBoss).toBe('FINAL BOSS');
    expect(OOW_COPY.ru.waveFinalBoss).toBe('ФИНАЛЬНЫЙ БОСС');
    expect(OOW_COPY.en.kindElite).toBe('Elite');
    expect(OOW_COPY.ru.kindElite).toBe('Элита');
    expect(OOW_COPY.en.seasonMany).toBe('seasons');
    expect(OOW_COPY.ru.seasonMany).toBe('сезонов');
    expect(OOW_COPY.en.seasonFew).toBe('seasons');
    expect(OOW_COPY.ru.seasonFew).toBe('сезона');
    expect(OOW_COPY.en.ovrExecute).toBe('Execution Multiplier');
    expect(OOW_COPY.ru.ovrExecute).toBe('Множитель казни');
    expect(OOW_COPY.en.dblClickRestore).toBe('Double-click to restore');
    expect(OOW_COPY.ru.dblClickRestore).toBe('Двойной клик — вернуть');
  });

  describe('getSeasonColor', () => {
    it('produces legacy-compatible coprime hue distribution for past and future seasons', () => {
      // S1: 65 deg (lime)
      expect(getSeasonColor(1)).toBe('hsl(65 68% 64%)');
      // S20: 238 deg (indigo)
      expect(getSeasonColor(20)).toBe('hsl(238 68% 64%)');
      // S21: 285 deg (violet)
      expect(getSeasonColor(21)).toBe('hsl(285 68% 64%)');
      // S22: 332 deg (rose/magenta)
      expect(getSeasonColor(22)).toBe('hsl(332 68% 64%)');
      // S23: 19 deg (vibrant orange/amber)
      expect(getSeasonColor(23)).toBe('hsl(19 68% 64%)');
      // Future season 24: 66 deg
      expect(getSeasonColor(24)).toBe('hsl(66 68% 64%)');
      // All consecutive seasons have at least 40 deg hue separation
      for (let s = 1; s <= 50; s++) {
        expect(getSeasonColor(s)).toMatch(/^hsl\(\d+ 68% 64%\)$/);
      }
    });
  });

  describe('getLiveSeasonNumber', () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const shift = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);

    it('returns the season whose date range contains today', () => {
      const now = new Date('2026-09-25T12:00:00Z');
      const seasons = [
        { season: 22, startDate: iso(shift(now, -70)), endDate: iso(shift(now, -10)) },
        { season: 23, startDate: iso(shift(now, -13)), endDate: iso(shift(now, 47)) },
        { season: 24, startDate: iso(shift(now, 48)), endDate: iso(shift(now, 100)) },
      ];
      expect(getLiveSeasonNumber(seasons, now)).toBe(23);
    });

    it('matches boundary days and skips entries with missing dates', () => {
      const now = new Date('2026-09-25T00:00:00Z');
      const today = iso(now);
      expect(getLiveSeasonNumber([{ season: 1, startDate: today, endDate: today }], now)).toBe(1);
      expect(
        getLiveSeasonNumber(
          [{ season: 1 }, { season: 2, startDate: 'bad', endDate: today }],
          now
        )
      ).toBeNull();
      expect(getLiveSeasonNumber([], now)).toBeNull();
    });

    it('returns null in a gap between seasons', () => {
      const now = new Date('2026-09-25T12:00:00Z');
      const seasons = [
        { season: 22, startDate: iso(shift(now, -70)), endDate: iso(shift(now, -5)) },
        { season: 23, startDate: iso(shift(now, 5)), endDate: iso(shift(now, 60)) },
      ];
      expect(getLiveSeasonNumber(seasons, now)).toBeNull();
    });
  });
});

