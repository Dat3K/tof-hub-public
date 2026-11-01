// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { localizedUi, translateUiText } from '@tof-hub/i18n';
import { buildHelpTranslations } from '../../packages/i18n/src/locales/extra/build/help';

const require = createRequire(import.meta.url);
const { localizeBuildPage } = require('../../scripts/generators/build-page-locales.cjs') as {
  localizeBuildPage: (catalog: any, root: string, sourceCatalog: any, culture?: string) => any;
};

const cultures = ['de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'] as const;
const gameNames = Object.fromEntries(cultures.map(locale => [locale, `Meryl ${locale}`]));
const sourceCatalog = { simulacra: [{ id: 'meryl', name_de: 'Meryl DE', weapon_name_de: 'Rose DE', trait_desc_de: 'Trait DE', ...Object.fromEntries(cultures.filter(locale => locale !== 'de').map(locale => [`name_${locale}`, gameNames[locale]])) }] };

function fixture() {
  return {
    weapons: [{ id: 'meryl', name: { en: 'Meryl', ru: 'Мэрил' }, weapon: { en: 'Rosy Edge', ru: 'Розовое лезвие' }, trait: { en: 'Trait EN', ru: 'Trait RU' }, resonances: [], selectableSkills: [], selectableModes: [] }],
    consumables: [{ name: { en: 'Food', ru: 'Еда' }, items: [] }],
    gear: [{ name: { en: 'Helmet', ru: 'Шлем' } }],
    matrixStats: { slots: [{ name: { en: 'Mind', ru: 'Разум' } }] },
    computing: [{ effects: [{ name: { en: 'All resistances', ru: 'Все сопротивления' } }] }],
    artworks: [], avatars: [], avatarFrames: [],
  };
}

describe('Build page locale generator', () => {
  it('uses game projections for game text and the shared UI dictionary for authored labels', () => {
    const output = localizeBuildPage(fixture(), 'ignore/nonexistent-build-locale-fixture', sourceCatalog, 'de');
    expect(output.weapons[0]).toMatchObject({
      name: { en: 'Meryl', ru: 'Мэрил', de: 'Meryl DE' },
      weapon: { en: 'Rosy Edge', ru: 'Розовое лезвие', de: 'Rose DE' },
      trait: { en: 'Trait EN', ru: 'Trait RU', de: 'Trait DE' },
    });
    expect(output.consumables[0].name.de).toBe(translateUiText('Food', 'de'));
    expect(output.gear[0].name.de).toBe(translateUiText('Helmet', 'de'));
    expect(output.matrixStats.slots[0].name.de).toBe(translateUiText('Mind', 'de'));
    expect(output.computing[0].effects[0].name.de).toBe(translateUiText('All resistances', 'de'));
  });

  it('provides the authored Food label in every fully projected site culture', () => {
    for (const locale of cultures) {
      const output = localizeBuildPage(fixture(), 'ignore/nonexistent-build-locale-fixture', sourceCatalog, locale);
      expect(output.consumables[0].name[locale]).toBe(translateUiText('Food', locale));
      expect(output.consumables[0].name[locale]).not.toBe('Food');
    }
  });

  it('routes every authored calculation-help title and paragraph through the shared UI catalog', () => {
    const englishSources = Object.keys(buildHelpTranslations.de ?? {});
    expect(englishSources).toHaveLength(46);
    for (const locale of cultures) {
      const translations = buildHelpTranslations[locale];
      expect(translations).toBeDefined();
      for (const source of englishSources) {
        expect(translations?.[source]).toBeTruthy();
        expect(translations?.[source]).not.toBe(source);
        expect(localizedUi({ en: source }, locale)).toBe(translations?.[source]);
      }
    }
    const chineseTitle = 'What the capture contains';
    expect(localizedUi({ en: chineseTitle }, 'zh-Hans')).toBe(buildHelpTranslations['zh-CN']?.[chineseTitle]);
    expect(localizedUi({ en: chineseTitle }, 'zh-Hans-SG')).toBe(buildHelpTranslations['zh-CN']?.[chineseTitle]);
  });
});
