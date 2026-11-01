import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  BASELINE_STANDARD_BOSSES,
  BASELINE_MMO_BOSSES,
  getBaselineBosses,
  getDefaultBossSlug,
  mergeFceData,
  toBossUrlHash,
  resolveBossSlugFromHash,
} from './fce-data';
import { FCE_COPY } from './fce-copy';

describe('FCE Datamine Feature', () => {
  it('has 37 baseline standard bosses and 14 MMO bosses (2 seasons)', () => {
    expect(BASELINE_STANDARD_BOSSES.length).toBe(37);
    expect(BASELINE_MMO_BOSSES.length).toBe(14);
    expect(getBaselineBosses('standard').length).toBe(37);
    expect(getBaselineBosses('mmo').length).toBe(14);
  });

  it('contains expected boss identities and mechanics in standard catalog', () => {
    const robarg = BASELINE_STANDARD_BOSSES.find((b) => b.slug === 'robarg');
    expect(robarg).toBeDefined();
    expect(robarg?.name).toBe('Robarg');
    expect(robarg?.name_ru).toBe('Робарг');
    expect(robarg?.mechanics.length).toBeGreaterThanOrEqual(4);
  });

  it('contains expected boss identities in MMO catalog', () => {
    const chaosArmorMmo = BASELINE_MMO_BOSSES.find((b) => b.slug === 'chaos-armor');
    expect(chaosArmorMmo).toBeDefined();
    expect(chaosArmorMmo?.name).toBe('Chaos Armor');
  });

  it('mergeFceData correctly overlays dynamic index over baseline', () => {
    const merged = mergeFceData(
      {
        totalBosses: 1,
        bosses: [
          {
            slug: 'robarg',
            boss_id: 'boss_hum_001',
            boss_num: 1,
            name: 'Robarg Custom',
            name_ru: 'Робарг Кастом',
            category: 'World Boss',
            category_ru: 'Мировой босс',
            element: 'wood',
            weakness: 'fire',
            image: '/test.webp',
            banner_image: '/banner.webp',
            description: 'Desc',
            description_ru: 'Описание',
            mechanics: [],
            stats: { hp: 100 },
          },
        ],
      } as any,
      'standard'
    );

    const robarg = merged.find((b) => b.slug === 'robarg');
    expect(robarg?.name).toBe('Robarg Custom');
    expect(robarg?.name_ru).toBe('Робарг Кастом');
    expect(merged.length).toBe(1);
  });

  it('provides comprehensive bilingual copy table', () => {
    expect(FCE_COPY.en.title).toBe('Boss mechanics archive');
    expect(FCE_COPY.ru.title).toBe('Архив механик боссов');
    expect(FCE_COPY.en.download).toBe('Download PNG');
    expect(FCE_COPY.ru.download).toBe('Скачать PNG');
  });

  it('opens on the latest added boss: last of the standard ladder, last of the newest MMO season', () => {
    expect(getDefaultBossSlug('standard')).toBe('ground-controller');
    expect(getDefaultBossSlug('mmo')).toBe('sobek');
  });

  it('omits the MMO season prefix from URL hashes', () => {
    expect(toBossUrlHash('merbelle')).toBe('merbelle');
    expect(toBossUrlHash('chaos-armor')).toBe('chaos-armor');
    expect(toBossUrlHash('s2-merbelle')).toBe('merbelle');
  });

  it('resolves short hashes to the latest season entry', () => {
    const mmo = getBaselineBosses('mmo');
    expect(resolveBossSlugFromHash('merbelle', mmo)).toBe('merbelle');
    expect(resolveBossSlugFromHash('chaos-armor', mmo)).toBe('chaos-armor');
    expect(resolveBossSlugFromHash('#merbelle', mmo)).toBe('merbelle');
    expect(resolveBossSlugFromHash('robarg', getBaselineBosses('standard'))).toBe('robarg');
    expect(resolveBossSlugFromHash('no-such-boss', mmo)).toBeNull();
    expect(resolveBossSlugFromHash('', mmo)).toBeNull();
  });

  it('cross-resolves boss slugs and preserves URL hash between standard and MMO modes', () => {
    const std = getBaselineBosses('standard');
    const mmo = getBaselineBosses('mmo');

    // Switching MMO -> Standard for Merbelle
    const stdMerbelle = resolveBossSlugFromHash('merbelle', std);
    expect(stdMerbelle).toBe('merbelle');
    expect(toBossUrlHash(stdMerbelle!)).toBe('merbelle');

    // Switching Standard -> MMO for Merbelle
    const mmoMerbelle = resolveBossSlugFromHash('merbelle', mmo);
    expect(mmoMerbelle).toBe('merbelle');
    expect(toBossUrlHash(mmoMerbelle!)).toBe('merbelle');

    // Switching MMO -> Standard for Chaos Armor
    const stdChaos = resolveBossSlugFromHash('chaos-armor', std);
    expect(stdChaos).toBe('chaos-armor');
    expect(toBossUrlHash(stdChaos!)).toBe('chaos-armor');

    // Switching Standard -> MMO for Frigg
    const mmoFrigg = resolveBossSlugFromHash('frigg', mmo);
    expect(mmoFrigg).toBe('frigg');
    expect(toBossUrlHash(mmoFrigg!)).toBe('frigg');

    // Standard-only boss does not exist in MMO
    expect(resolveBossSlugFromHash('singer', mmo)).toBeNull();
  });

  it('keeps the MMO boss art and name static (no Ken Burns zoom)', () => {
    const css = readFileSync(join(import.meta.dirname, 'fce.module.css'), 'utf8');
    expect(css).not.toContain('fceKenBurns');
  });

  it('loads game mechanics for MMO Sobek without custom markup', () => {
    const sobek = getBaselineBosses('mmo').find((b) => b.slug === 'sobek');
    expect(sobek?.mechanics[0]?.html).toBe(
      'When Sobek locks onto a target, their critical hit rate is significantly reduced.'
    );
    expect(sobek?.ru_mechanics?.[0]?.html).toBe(
      'Когда Собек фиксирует цель, их шанс критического удара значительно снижается.'
    );
  });

});
