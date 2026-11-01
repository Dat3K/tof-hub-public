import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { BASELINE_SEQ_STAGES, DEFAULT_MECHANICS_OVERRIDES, mergeSeqData } from './seq-data';
import {
  BASE_RESIST_RATE,
  formatCompact,
  formatInteger,
  formatPercent,
  formatCritResist,
  getVisibleSequentialRows,
  getMechanicsNote,
  SEQ_SUPPORT_LEVEL_INITIAL,
  seqSupportDamageByLevel,
  SEQ_RESIST_IGNORE_RANGE,
  seqDamageBonusMultiplier,
  seqRequiredCactusDamage,
  seqResistanceHpMultiplier,
} from './seq-domain';
import { SEQ_COPY } from './seq-copy';

describe('Sequential Phantasm Feature Module', () => {
  describe('Baseline Catalog Integrity', () => {
    it('contains exactly 35 stages terminating at stage 35 cutoff', () => {
      expect(BASELINE_SEQ_STAGES.length).toBe(35);
      expect(BASELINE_SEQ_STAGES[0].stage).toBe(1);
      expect(BASELINE_SEQ_STAGES[34].stage).toBe(35);
    });

    it('verifies stage 1 Franken base and effective values', () => {
      const s1 = BASELINE_SEQ_STAGES[0];
      expect(s1.enemyNameEn).toBe('Franken');
      expect(s1.enemyNameRu).toBe('Франкен');
      expect(s1.maxHealth).toBe(266444540);
      expect(s1.effectiveHp).toBe(358927440);
      expect(s1.isMechanicsAdjusted).toBe(false);
    });

    it('verifies stage 6 mechanics adjustment override', () => {
      const s6 = BASELINE_SEQ_STAGES[5];
      expect(s6.stage).toBe(6);
      expect(s6.isMechanicsAdjusted).toBe(true);
      expect(s6.effectiveHp).toBe(DEFAULT_MECHANICS_OVERRIDES[6].effectiveHp);
      expect(s6.mechanicsNote).toBe('subtract 45-50 seconds');
    });

    it('verifies stage 10 Nan Yin fulltime damage reduction override', () => {
      const s10 = BASELINE_SEQ_STAGES[9];
      expect(s10.stage).toBe(10);
      expect(s10.enemyNameEn).toBe('Nan Yin');
      expect(s10.effectiveHp).toBe(2761910000);
      expect(s10.isMechanicsAdjusted).toBe(true);
      expect(s10.mechanicsNote).toBe('fulltime 50% dmg reduction');
    });

    it('verifies stage 35 unresolved name invariant', () => {
      const s35 = BASELINE_SEQ_STAGES[34];
      expect(s35.stage).toBe(35);
      expect(s35.codename).toBe('endless_special_boss_35');
      expect(s35.enemyNameEn).toBeNull();
      expect(s35.enemyNameRu).toBeNull();
      expect(s35.nameStatus).toBe('unresolved');
    });
  });

  describe('Domain Calculations & Formatting', () => {
    it('verifies base resist rate is 34.71%', () => {
      expect(BASE_RESIST_RATE).toBe(0.3471);
    });

    it('formats compact numbers properly (G, M, K)', () => {
      expect(formatCompact(266444540)).toBe('266.4M');
      expect(formatCompact(2413397000)).toBe('2.4G');
      expect(formatCompact(50000)).toBe('50.0K');
      expect(formatCompact(250)).toBe('250');
    });

    it('formats integer with commas', () => {
      expect(formatInteger(266444540)).toBe('266,444,540');
      expect(formatInteger(null)).toBe('—');
    });

    it('formats powercreep with sign and 2 decimals', () => {
      expect(formatPercent(9.0837)).toBe('+9.08%');
      expect(formatPercent(-5.123)).toBe('-5.12%');
      expect(formatPercent(null)).toBe('—');
    });

    it('formats crit resist percentage', () => {
      expect(formatCritResist(0.01)).toBe('1%');
      expect(formatCritResist(0)).toBe('0%');
      expect(formatCritResist(null)).toBe('0%');
    });

    it('filters rows by stage view (16plus vs all)', () => {
      const allRows = getVisibleSequentialRows(BASELINE_SEQ_STAGES, 'all');
      expect(allRows.length).toBe(35);

      const sixteenPlus = getVisibleSequentialRows(BASELINE_SEQ_STAGES, '16plus');
      expect(sixteenPlus.length).toBe(20); // stages 16 to 35
      expect(sixteenPlus[0].stage).toBe(16);
      expect(sixteenPlus[sixteenPlus.length - 1].stage).toBe(35);
    });

    it('resolves mechanics notes correctly', () => {
      const s6 = BASELINE_SEQ_STAGES[5];
      expect(getMechanicsNote(s6, false, 'Default')).toBe('subtract 45-50 seconds');
      expect(getMechanicsNote(s6, true, 'Default')).toBe('Default');

      const s1 = BASELINE_SEQ_STAGES[0];
      expect(getMechanicsNote(s1, false, 'Default')).toBe('');
    });
  });

  describe('Bilingual Copy Tables', () => {
    it('verifies all string keys in EN and RU are present', () => {
      expect(SEQ_COPY.en.title).toContain('Sequential boss scaling');
      expect(SEQ_COPY.ru.title).toContain('Рост характеристик боссов');
      expect(SEQ_COPY.en.stageView16Plus).toBe('16+');
      expect(SEQ_COPY.ru.stageView16Plus).toBe('16+');
      expect(SEQ_COPY.en.downloadPng).toBe('Download PNG');
      expect(SEQ_COPY.ru.downloadPng).toBe('Скачать PNG');
    });
  });

  describe('Merge Strategy', () => {
    it('returns baseline when server data is null or empty', () => {
      for (const result of [mergeSeqData(null), mergeSeqData(undefined), mergeSeqData({ stages: [] })]) {
        expect(result).toHaveLength(BASELINE_SEQ_STAGES.length);
        expect(result[0].enemyNameEn).toBe(BASELINE_SEQ_STAGES[0].enemyNameEn);
        expect(result[0].portrait).toBe(
          '/game-assets/webp/Hotta/Content/Resources/UI/void/boss/bigboss005.webp'
        );
        expect(result.every((stage) => stage.portrait?.startsWith('/game-assets/webp/'))).toBe(true);
      }
    });

    it('merges live overrides over baseline stages', () => {
      const liveData = {
        stages: [
          {
            stage: 1,
            codename: 'endless_special_boss_1',
            maxHealth: 300000000,
            effectiveHp: 400000000,
          },
        ],
      };
      const merged = mergeSeqData(liveData as any);
      expect(merged[0].stage).toBe(1);
      expect(merged[0].maxHealth).toBe(300000000);
      expect(merged[0].effectiveHp).toBe(400000000);
      expect(merged[0].enemyNameEn).toBe('Franken');
    });

    it('resolves manually curated legacy enemy portrait paths through the game asset resolver', () => {
      const merged = mergeSeqData({
        stages: [
          {
            stage: 1,
            codename: 'endless_special_boss_1',
            portrait: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss005.webp',
          },
        ],
      } as any);

      expect(merged[0].portrait).toBe(
        '/game-assets/webp/Hotta/Content/Resources/UI/void/boss/bigboss005.webp'
      );
    });
  });

  describe('Required cactus damage (first chart)', () => {
    const K = 14106;

    it('keeps the slider ranges and defaults agreed for the page', () => {
      expect(SEQ_RESIST_IGNORE_RANGE).toMatchObject({ min: 0, max: 0.5, step: 0.05, initial: 0.3 });
      expect(SEQ_SUPPORT_LEVEL_INITIAL).toBe(5);
    });

    it('matches the 34.71% base resist and recalculates RES after ignore', () => {
      expect(7500 / (7500 + K)).toBeCloseTo(0.3471, 4);
      expect(seqResistanceHpMultiplier(7500, K, 0)).toBeCloseTo(1 / (1 - 7500 / (7500 + K)), 10);
      expect(seqResistanceHpMultiplier(7500, K, 0.5)).toBeCloseTo(1 + 3750 / K, 10);
    });

    it('adds Sequential DMG% to the reference 50% with diminishing gain', () => {
      expect(seqDamageBonusMultiplier(0.05)).toBeCloseTo(1.55 / 1.5, 10);
      expect(seqDamageBonusMultiplier(0.05, 1)).toBeLessThan(seqDamageBonusMultiplier(0.05));
      expect(seqDamageBonusMultiplier(0)).toBe(1);
    });

    it('reads Space Support Sequential DMG% by level from build-page.json', () => {
      const catalog = JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../../../../public/game-data/build-page.json'), 'utf8')
      );
      const byLevel = seqSupportDamageByLevel(catalog.support.modules);
      expect(byLevel).toHaveLength(11);
      expect(byLevel![0]).toBe(0);
      expect(byLevel![5]).toBeCloseTo(0.05, 10);
      expect(byLevel![10]).toBeCloseTo(0.1, 10);
      expect(seqSupportDamageByLevel([])).toBeNull();
    });

    it('computes stage 1 at 30% ignore and +5% DMG', () => {
      const value = seqRequiredCactusDamage({
        maxHealth: 266444540,
        resistance: 7500,
        resistanceConstant: K,
        resistIgnore: 0.3,
        damageBonus: 0.05,
      });
      expect(value).toBeCloseTo(353816530.8, 0);
    });

    it('returns null without a resistance constant or DEF', () => {
      const base = { maxHealth: 1, resistIgnore: 0, damageBonus: 0 };
      expect(seqRequiredCactusDamage({ ...base, resistance: 7500, resistanceConstant: null })).toBeNull();
      expect(seqRequiredCactusDamage({ ...base, resistance: null, resistanceConstant: K })).toBeNull();
    });
  });
});
