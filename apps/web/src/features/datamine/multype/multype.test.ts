import { describe, it, expect } from 'vitest';
import {
  BASELINE_MULTYPE_MAPPING,
  BASELINE_MULTYPE_RENAMES,
  mergeMultypeData,
} from './multype-data';
import {
  generateRainbowColors,
  createSubSurfacePalette,
  getAttributeColorMeta,
  stripJsonExtension,
  canonicalizeValueBaseKey,
  composeSubRenameKey,
  composeValueRenameKey,
  composeGroupRenameKey,
  resolveValueRename,
  matchesSingleElementFilter,
  buildMultypeViewModel,
  buildGlobalStats,
} from './multype-domain';
import { MULTYPE_COPY, CATEGORY_LABELS_RU } from './multype-copy';

describe('Multype Datamine Feature', () => {
  describe('Baseline Catalog Integrity', () => {
    it('contains all 16 canonical categories in baseline mapping', () => {
      const categories = Object.keys(BASELINE_MULTYPE_MAPPING);
      expect(categories).toHaveLength(16);
      expect(categories).toContain('NoModule');
      expect(categories).toContain('ModuleExtraType_Talent');
      expect(categories).toContain('ModuleExtraType_WeaponActive');
      expect(categories).toContain('ModuleExtraType_WeaponPassive');
      expect(categories).toContain('ModuleExtraType_Pet');
      expect(categories).toContain('ModuleExtraType_CardPassive');
      expect(categories).toContain('ModuleExtraType_Wormhole');
    });

    it('contains valid rename dictionary structure', () => {
      expect(BASELINE_MULTYPE_RENAMES.version).toBe(1);
      expect(BASELINE_MULTYPE_RENAMES.sourceFile).toBe('module_extra_to_files_mapping3.json');
      expect(Object.keys(BASELINE_MULTYPE_RENAMES.mainRenames || {}).length).toBeGreaterThan(0);
      expect(Object.keys(BASELINE_MULTYPE_RENAMES.subRenames || {}).length).toBeGreaterThan(0);
      expect(Object.keys(BASELINE_MULTYPE_RENAMES.valueRenames || {}).length).toBeGreaterThan(0);
      expect(Object.keys(BASELINE_MULTYPE_RENAMES.groupRenames || {}).length).toBeGreaterThan(0);
    });

    it('merges server payload with baseline cleanly', () => {
      const customPayload = {
        version: 2,
        sourceFile: 'custom_source.json',
        mainRenames: {
          CustomCategory: 'Custom Label',
        },
      };

      const merged = mergeMultypeData(customPayload as any);
      expect(merged.version).toBe(2);
      expect(merged.sourceFile).toBe('custom_source.json');
      expect(merged.renames.mainRenames?.CustomCategory).toBe('Custom Label');
      expect(merged.renames.mainRenames?.NoModule).toBe('No cathegory');
      expect(Object.keys(merged.mapping)).toHaveLength(16);
    });
  });

  describe('Domain Logic & Key Normalization', () => {
    it('strips .json extension correctly', () => {
      expect(stripJsonExtension('Buff_Lan_Level2_1.json')).toBe('Buff_Lan_Level2_1');
      expect(stripJsonExtension('Simple.JSON')).toBe('Simple');
      expect(stripJsonExtension('NoExtension')).toBe('NoExtension');
    });

    it('canonicalizes value base keys removing level indicators', () => {
      expect(canonicalizeValueBaseKey('Buff_Lan_Level2_1')).toBe('Buff_Lan_1');
      expect(canonicalizeValueBaseKey('Buff_Matrix_SSR_4_level1_3')).toBe('Buff_Matrix_SSR_4_3');
    });

    it('composes sub, value, and group rename keys with double colons', () => {
      expect(composeSubRenameKey('NoModule', 'FireAtkBeExtraUpMult')).toBe(
        'NoModule::FireAtkBeExtraUpMult'
      );
      expect(
        composeValueRenameKey('NoModule', 'FireAtkBeExtraUpMult', 'Buff_Lan_1.json')
      ).toBe('NoModule::FireAtkBeExtraUpMult::Buff_Lan_1.json');
      expect(
        composeGroupRenameKey('NoModule', 'FireAtkBeExtraUpMult', 'Buff_Lan_1')
      ).toBe('NoModule::FireAtkBeExtraUpMult::Buff_Lan_1');
    });

    it('generates non-empty rainbow hex colors for categories', () => {
      const colors = generateRainbowColors(16);
      expect(colors).toHaveLength(16);
      colors.forEach((color) => {
        expect(color).toMatch(/^[0-9A-F]{6}$/);
      });
    });

    it('maps attribute names to element colors and treats only Def attributes as defensive', () => {
      const fireMeta = getAttributeColorMeta('FireAtkBeExtraUpMult');
      expect(fireMeta).not.toBeNull();
      expect(fireMeta?.hex).toBe('EC5353');
      expect(fireMeta?.isDarkened).toBe(false);

      const defDownMeta = getAttributeColorMeta('FireDefDownMult');
      expect(defDownMeta).not.toBeNull();
      expect(defDownMeta?.isDarkened).toBe(true);

      expect(getAttributeColorMeta('FireDefFixedAdded')?.isDarkened).toBe(true);
      expect(getAttributeColorMeta('FireDefIgnore')?.isDarkened).toBe(true);
      expect(getAttributeColorMeta('FireAtkBeExtraDownMult')?.isDarkened).toBe(false);
      expect(getAttributeColorMeta('FireAtkExtraUpMult')?.isDarkened).toBe(false);

      const critMeta = getAttributeColorMeta('CritAtkExtraUp');
      expect(critMeta?.hex).toBe('FFFF00');
    });

    it('visibly separates elemental attack buffs from defensive reductions in both palettes', () => {
      const attack = getAttributeColorMeta('IceAtkExtraUpMult')!;
      const defense = getAttributeColorMeta('IceDefBeExtraDownMult')!;
      expect(attack.hex).toBe(defense.hex);
      expect(attack.isDarkened).toBe(false);
      expect(defense.isDarkened).toBe(true);

      const attackLight = createSubSurfacePalette(attack.hex, attack.isDarkened, 'light');
      const defenseLight = createSubSurfacePalette(defense.hex, defense.isDarkened, 'light');
      const attackDark = createSubSurfacePalette(attack.hex, attack.isDarkened, 'dark');
      const defenseDark = createSubSurfacePalette(defense.hex, defense.isDarkened, 'dark');

      expect(defenseLight.accentPanel).not.toBe(attackLight.accentPanel);
      expect(defenseLight.accentLine).not.toBe(attackLight.accentLine);
      expect(defenseDark.accentPanel).not.toBe(attackDark.accentPanel);
      expect(defenseDark.accentLine).not.toBe(attackDark.accentLine);

      const panelBrightness = (color: string) => {
        const [red, green, blue] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        return red * 0.299 + green * 0.587 + blue * 0.114;
      };
      expect(panelBrightness(attackLight.accentPanel)).toBeGreaterThan(
        panelBrightness(defenseLight.accentPanel)
      );
      expect(panelBrightness(defenseDark.accentPanel)).toBeLessThan(
        panelBrightness(attackDark.accentPanel)
      );
    });

    it('resolves value renames by exact match then group fallback', () => {
      const renames = {
        valueRenames: {
          'NoModule::FireAtkBeExtraUpMult::Buff_Lan_Level2_1.json': 'Lan Trait Exact',
        },
        groupRenames: {
          'ModuleExtraType_Talent::FireAtkBeExtraDownMult::Buff_Lan_1': 'Lan Trait Group',
        },
      };

      const exact = resolveValueRename(
        renames,
        'NoModule',
        'FireAtkBeExtraUpMult',
        'Buff_Lan_Level2_1.json'
      );
      expect(exact.rename).toBe('Lan Trait Exact');
      expect(exact.renameSource).toBe('exact');

      const group = resolveValueRename(
        renames,
        'ModuleExtraType_Talent',
        'FireAtkBeExtraDownMult',
        'Buff_Lan_Level2_1.json'
      );
      expect(group.rename).toBe('Lan Trait Group');
      expect(group.renameSource).toBe('group');
    });

    it('filters elements correctly', () => {
      expect(matchesSingleElementFilter('FireAtkBeExtraUpMult', 'Flame debuff', 'fire')).toBe(true);
      expect(matchesSingleElementFilter('IceAtkBeExtraUpMult', 'Frost debuff', 'fire')).toBe(false);
      expect(matchesSingleElementFilter('ThunderAtkMult', 'Volt buff', 'volt')).toBe(true);
      expect(matchesSingleElementFilter('PhyAtkMult', 'Phys buff', 'phys')).toBe(true);
    });
  });

  describe('View Model Builder & Aggregation', () => {
    it('shows generated candidates only in AI guess mode and keeps evidence', () => {
      const vm = buildMultypeViewModel(
        { ModuleExtraType_CardPassive: { FinalDamageBeExtraUpMult: ['GE_ArtifactSSR005_BeAtkUp.json'] } },
        {},
        {
          mode: 'ai-guess',
          search: '',
          mainFilter: 'all',
          subFilter: 'all',
          renameFilter: 'all',
          elementFilter: 'all',
          palette: 'dark',
          scale: 1,
        },
        'en',
        {
          'GE_ArtifactSSR005_BeAtkUp.json': {
            sourceKey: 'GE_ArtifactSSR005_BeAtkUp.json',
            candidates: [{
              label: 'Spacetime Rift',
              confidence: 0.98,
              evidence: ['filename identity “artifactssr005”'],
            }],
          },
        }
      );

      const item = vm.groups[0].subColumns[0].values[0];
      expect(item.displayLabel).toBe('Spacetime Rift');
      expect(item.originalLabel).toBe('GE_ArtifactSSR005_BeAtkUp');
      expect(item.aiGuessConfidence).toBe(0.98);
      expect(item.tooltipLines).toContain('98% · exact ID match');
      expect(item.tooltipLines).toContain('Source buff files');
      expect(MULTYPE_COPY.en.aiMatchExact).toBe('exact ID match');
      expect(MULTYPE_COPY.ru.aiMatchExact).toBe('точное совпадение ID');
      expect(MULTYPE_COPY.en.aiSourceFiles).toBe('Source buff files');
      expect(MULTYPE_COPY.ru.aiSourceFiles).toBe('Исходные buff-файлы');
      expect(MULTYPE_COPY.en.manualRename).toBe('Manual rename');
      expect(MULTYPE_COPY.ru.manualRename).toBe('Ручной rename');
      expect(MULTYPE_COPY.en.generalCategory).toBe('General / No Category');
      expect(MULTYPE_COPY.ru.generalCategory).toBe('Общее / без категории');
      expect(MULTYPE_COPY.en.aiMatrixSet).toBe('Set');
      expect(MULTYPE_COPY.ru.aiMatrixSet).toBe('Комплект');
    });

    it('enriches matrix set names into character 2p/4p and retains suit name for tooltip', () => {
      // Test Russian localization
      const vmRu = buildMultypeViewModel(
        {
          ModuleExtraType_Talent: {
            IceAtkExtraUpMult: [
              'Buff_Matrix113_IceAtkUp_Level1.json',
              'Buff_Matrix113_IceAtkUp_Level2.json',
              'Buff_Matrix113_IceAtkUp_Level3.json',
              'Buff_Matrix113_IceAtkUp_Level4.json',
            ],
          },
        },
        {},
        {
          mode: 'ai-guess',
          search: '',
          mainFilter: 'all',
          subFilter: 'all',
          renameFilter: 'all',
          elementFilter: 'all',
          palette: 'dark',
          scale: 1,
        },
        'ru'
      );

      const subColRu = vmRu.groups[0].subColumns[0];
      expect(subColRu.values).toHaveLength(1); // All 4 levels deduplicated into 1
      const itemRu = subColRu.values[0];
      expect(itemRu.displayLabel).toBe('Матрицы Линсис 2p');
      expect(itemRu.aiGuessSuitName).toBe('Новое шоу');
      expect(itemRu.allValueKeys).toHaveLength(4);
      expect(itemRu.isDeduped).toBe(true);

      // Test English localization
      const vmEn = buildMultypeViewModel(
        {
          ModuleExtraType_Talent: {
            IceAtkExtraUpMult: [
              'Buff_Matrix113_IceAtkUp_Level1.json',
            ],
          },
        },
        {},
        {
          mode: 'ai-guess',
          search: '',
          mainFilter: 'all',
          subFilter: 'all',
          renameFilter: 'all',
          elementFilter: 'all',
          palette: 'dark',
          scale: 1,
        },
        'en'
      );

      const itemEn = vmEn.groups[0].subColumns[0].values[0];
      expect(itemEn.displayLabel).toBe('Lyncis 2p');
      expect(itemEn.aiGuessSuitName).toBe('New Show');
    });

    it('enriches traits, resonances, and relics correctly', () => {
      const vmRu = buildMultypeViewModel(
        {
          ModuleExtraType_Pet: {
            DamageExtraUp: ['Buff_Imitation_74.json'],
          },
          ModuleExtraType_WeaponPassive: {
            PhysicAtkExtraUp: ['Buff_Ace_Physic_Resonance.json'],
          },
          ModuleExtraType_CardPassive: {
            DamageUp: ['Buff_Artifact_SSR_015.json'],
          },
        },
        {},
        {
          mode: 'ai-guess',
          search: '',
          mainFilter: 'all',
          subFilter: 'all',
          renameFilter: 'all',
          elementFilter: 'all',
          palette: 'dark',
          scale: 1,
        },
        'ru'
      );

      const traitItem = vmRu.groups.find((g) => g.mainKey === 'ModuleExtraType_Pet')?.subColumns[0]?.values[0];
      expect(traitItem?.displayLabel).toBe('Черта: Линсис');

      const resonanceItem = vmRu.groups.find((g) => g.mainKey === 'ModuleExtraType_WeaponPassive')?.subColumns[0]?.values[0];
      expect(resonanceItem?.displayLabel).toBe('Физ. резонанс (Клаудия)');

      const relicItem = vmRu.groups.find((g) => g.mainKey === 'ModuleExtraType_CardPassive')?.subColumns[0]?.values[0];
      expect(relicItem?.displayLabel).toBe('Мини-пеликан');
    });

    it('builds view model in renamed mode with deduplication', () => {
      const filterState = {
        mode: 'renamed' as const,
        search: '',
        mainFilter: 'all',
        subFilter: 'all',
        renameFilter: 'all' as const,
        elementFilter: 'all' as const,
        palette: 'dark' as const,
        scale: 0.8,
      };

      const vm = buildMultypeViewModel(
        BASELINE_MULTYPE_MAPPING,
        BASELINE_MULTYPE_RENAMES,
        filterState,
        'en'
      );

      expect(vm.groups.length).toBeGreaterThan(0);
      expect(vm.totalVisibleValues).toBeGreaterThan(0);

      // In renamed mode, all rendered values must have hasRename === true
      vm.groups.forEach((group) => {
        group.subColumns.forEach((sub) => {
          sub.values.forEach((val) => {
            expect(val.hasRename).toBe(true);
          });
        });
      });
    });

    it('hides fully unrenamed keys in AI guess mode', () => {
      const vm = buildMultypeViewModel(
        { ModuleExtraType_CardPassive: { FinalDamageBeExtraUpMult: ['GE_ArtifactSSR005_BeAtkUp.json', 'GE_Unknown_NoGuess.json'] } },
        {},
        {
          mode: 'ai-guess',
          search: '',
          mainFilter: 'all',
          subFilter: 'all',
          renameFilter: 'all',
          elementFilter: 'all',
          palette: 'dark',
          scale: 1,
        },
        'en',
        {
          'GE_ArtifactSSR005_BeAtkUp.json': {
            sourceKey: 'GE_ArtifactSSR005_BeAtkUp.json',
            candidates: [{
              label: 'Spacetime Rift',
              confidence: 0.98,
              evidence: ['filename identity'],
            }],
          },
        }
      );

      const labels = vm.groups[0].subColumns[0].values.map((v) => v.displayLabel);
      expect(labels).toContain('Spacetime Rift');
      expect(labels).not.toContain('GE_Unknown_NoGuess');
    });

    it('builds distinct surfaces for light and dark palettes', () => {
      const baseState = {
        mode: 'combined' as const,
        search: '',
        mainFilter: 'all',
        subFilter: 'all',
        renameFilter: 'all' as const,
        elementFilter: 'all' as const,
        scale: 0.8,
      };
      const light = buildMultypeViewModel(
        BASELINE_MULTYPE_MAPPING,
        BASELINE_MULTYPE_RENAMES,
        { ...baseState, palette: 'light' },
        'en'
      );
      const dark = buildMultypeViewModel(
        BASELINE_MULTYPE_MAPPING,
        BASELINE_MULTYPE_RENAMES,
        { ...baseState, palette: 'dark' },
        'en'
      );

      expect(light.groups[0]?.accentInk).not.toBe(dark.groups[0]?.accentInk);
      expect(light.groups[0]?.subColumns[0]?.surface.accentInk).not.toBe(
        dark.groups[0]?.subColumns[0]?.surface.accentInk
      );
      expect(light.groups[0]?.subColumns[0]?.surface.accentPanel).not.toBe(
        dark.groups[0]?.subColumns[0]?.surface.accentPanel
      );
    });

    it('computes global stats across full dataset', () => {
      const stats = buildGlobalStats(BASELINE_MULTYPE_MAPPING, BASELINE_MULTYPE_RENAMES);
      expect(stats.totalCategories).toBe(16);
      expect(stats.totalSubcategories).toBeGreaterThan(50);
      expect(stats.totalBuffs).toBeGreaterThan(9000);
      expect(stats.renamedValueCount).toBeGreaterThan(50);
    });

    it('localizes categories into Russian', () => {
      expect(CATEGORY_LABELS_RU.NoModule).toBe('Без категории');
      expect(CATEGORY_LABELS_RU.ModuleExtraType_Talent).toBe('Матрицы');
      expect(CATEGORY_LABELS_RU.ModuleExtraType_Pet).toBe('Трейты симулякров');
      expect(MULTYPE_COPY.ru.title).toBe('Мультипликативные усиления');
    });
  });
});
