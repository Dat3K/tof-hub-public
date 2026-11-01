import { describe, it, expect } from 'vitest';
import { BASELINE_BYGONE_FLOORS, mergeBygoneData } from './bygone-data';
import {
  formatHpG,
  formatPowercreep,
  getFloorPowercreep,
  getEnemyDisplayName,
  getMissingBygoneEnemyName,
  formatNumber,
  getWeaknessGameIcon,
  formatRangeStatus,
} from './bygone-domain';
import { BYGONE_COPY } from './bygone-copy';

describe('Bygone Phantasm Feature Module', () => {
  describe('Baseline Catalog Integrity', () => {
    it('contains exactly 600 floors', () => {
      expect(BASELINE_BYGONE_FLOORS.length).toBe(600);
    });

    it('has 584 unique floors and 16 duplicate floors', () => {
      const nonDups = BASELINE_BYGONE_FLOORS.filter((f) => !f.is_duplicate);
      const dups = BASELINE_BYGONE_FLOORS.filter((f) => f.is_duplicate);
      expect(nonDups.length).toBe(584);
      expect(dups.length).toBe(16);
    });

    it('verifies floor 1 initial values', () => {
      const f1 = BASELINE_BYGONE_FLOORS[0];
      expect(f1.floor).toBe(1);
      expect(f1.is_boss_floor).toBe(false);
      expect(f1.is_duplicate).toBe(false);
      expect(f1.hp_buff_stacks).toBe(13);
      expect(f1.displayed_difficulty).toBe(113);
      expect(f1.primary_enemy?.canonicalEnemyId).toBe('elite_ldz_dljqr');
    });

    it('verifies floor 5 boss encounter', () => {
      const f5 = BASELINE_BYGONE_FLOORS[4];
      expect(f5.floor).toBe(5);
      expect(f5.is_boss_floor).toBe(true);
      expect(f5.primary_enemy?.name_en).toBe('Minotaur');
      expect(f5.primary_enemy?.name_ru).toBe('Минотавр');
    });

    it('verifies floor 584 terminal curve values', () => {
      const f584 = BASELINE_BYGONE_FLOORS[583];
      expect(f584.floor).toBe(584);
      expect(f584.is_duplicate).toBe(false);
      expect(f584.hp_buff_stacks).toBe(100974450);
      expect(f584.atk_buff_stacks).toBe(33339);
    });

    it('verifies floor 600 repeat state', () => {
      const f600 = BASELINE_BYGONE_FLOORS[599];
      expect(f600.floor).toBe(600);
      expect(f600.is_duplicate).toBe(true);
      expect(f600.duplicated_from_floor).toBe(584);
      expect(f600.hp_buff_stacks).toBe(100974450);
    });
  });

  describe('Domain & Mathematical Calculations', () => {
    it('formats HP in G, K, and raw counts', () => {
      expect(formatHpG(100974450)).toBe('100.9G');
      expect(formatHpG(1500000)).toBe('1.5G');
      expect(formatHpG(50000)).toBe('50.0K');
      expect(formatHpG(203)).toBe('203');
      expect(formatHpG(0)).toBe('0');
    });
    it('formats actual MMO health in M/G without applying the Gacha stack-unit conversion', () => {
      expect(formatHpG(5062400202, 'hp')).toBe('5.1G');
      expect(formatHpG(1383998602, 'hp', 2)).toBe('1.38G');
      expect(formatHpG(124146054, 'hp')).toBe('124.1M');
      expect(formatHpG(1605509, 'hp')).toBe('1.6M');
      expect(formatHpG(0, 'hp')).toBe('0');
    });

    it('formats powercreep with 2 decimal places and +/- sign', () => {
      expect(formatPowercreep(15.456)).toBe('+15.46%');
      expect(formatPowercreep(-3.2)).toBe('-3.20%');
      expect(formatPowercreep(0)).toBe('+0.00%');
      expect(formatPowercreep(null)).toBe('—');
      expect(formatPowercreep(undefined)).toBe('—');
    });

    it('computes floor-to-floor powercreep correctly', () => {
      const f1 = BASELINE_BYGONE_FLOORS[0]; // hp = 13
      const f2 = BASELINE_BYGONE_FLOORS[1]; // hp = 15
      const pc = getFloorPowercreep(BASELINE_BYGONE_FLOORS, f2);
      expect(pc).not.toBeNull();
      expect(pc?.previousFloor).toBe(1);
      // ((15 - 13) / 13) * 100 = 15.3846%
      expect(pc?.percent).toBeCloseTo(15.38, 1);
    });

    it('resolves localized enemy names properly', () => {
      const enemy = {
        canonicalEnemyId: 'mon_hum_006',
        name_en: 'Minotaur',
        name_ru: 'Минотавр',
        element: 'Physical',
        is_boss: true,
      };
      expect(getEnemyDisplayName(enemy, false)).toBe('Minotaur');
      expect(getEnemyDisplayName(enemy, true)).toBe('Минотавр');
      expect(getEnemyDisplayName(null, false)).toBe('Unknown Monster');
    });

    it('omits scaling-template enemy names after floor 500', () => {
      expect(getMissingBygoneEnemyName(500, false)).toBe('Scaling Template: BigSecret_Boss');
      expect(getMissingBygoneEnemyName(501, false)).toBe('');
      expect(getMissingBygoneEnemyName(501, true)).toBe('');
    });

    it('uses Simulacra element icons for floor weaknesses', () => {
      expect(getWeaknessGameIcon('Physical')).toContain('icon_element_wu.webp');
      expect(getWeaknessGameIcon('Flame')).toContain('icon_element_huo.webp');
      expect(getWeaknessGameIcon('Frost')).toContain('icon_element_bing.webp');
      expect(getWeaknessGameIcon('Volt')).toContain('icon_element_lei.webp');
      expect(getWeaknessGameIcon('Altered')).toContain('icon_element_powers.webp');
      expect(getWeaknessGameIcon('Unknown')).toBeNull();
    });

    it('formats numbers with thousand separators', () => {
      expect(formatNumber(10800)).toBe('10,800');
      expect(formatNumber(100974450)).toBe('100,974,450');
    });

    it('interpolates range status strings', () => {
      const tpl = 'Floors {start}–{end} · {count} floors';
      expect(formatRangeStatus(tpl, 565, 584, 20)).toBe('Floors 565–584 · 20 floors');
    });
  });

  describe('Bilingual Copy Tables', () => {
    it('verifies English and Russian string tables contain all necessary keys', () => {
      expect(BYGONE_COPY.en.title).toContain('Bygone Phantasm');
      expect(BYGONE_COPY.ru.title).toContain('Былого фантазма');
      expect(BYGONE_COPY.en.rangeLatest20).toBe('Latest 20');
      expect(BYGONE_COPY.ru.rangeLatest20).toBe('Последние 20');
      expect(BYGONE_COPY.en.downloadPng).toBe('Download PNG');
      expect(BYGONE_COPY.ru.downloadPng).toBe('Скачать PNG');
    });
  });

  describe('Merge Strategy', () => {
    it('returns baseline when server data is null or empty', () => {
      expect(mergeBygoneData(null)).toEqual(BASELINE_BYGONE_FLOORS);
      expect(mergeBygoneData(undefined)).toEqual(BASELINE_BYGONE_FLOORS);
      expect(mergeBygoneData({ totalFloors: 0, floors: [] })).toEqual(BASELINE_BYGONE_FLOORS);
    });

    it('merges live overrides over baseline', () => {
      const liveData = {
        totalFloors: 1,
        floors: [
          {
            floor: 1,
            is_boss_floor: false,
            monster_level: 25,
            hp_buff_stacks: 99,
            displayed_difficulty: 199,
          },
        ],
      };
      const merged = mergeBygoneData(liveData as any);
      expect(merged[0].floor).toBe(1);
      expect(merged[0].hp_buff_stacks).toBe(99);
      expect(merged[0].displayed_difficulty).toBe(199);
      expect(merged[0].monster_level).toBe(25);
      // Preserves primary enemy from baseline
      expect(merged[0].primary_enemy?.canonicalEnemyId).toBe('elite_ldz_dljqr');
    });
  });
});
