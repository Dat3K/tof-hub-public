import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  deepCompareValues,
  isPlaceholderValue,
  classifyChangePath,
  compareCharacterValues,
  compareEditionChangelogs,
  compareSimulacraChangelogs,
  applyChangelogsToCharacters,
  generateChangelogDiffReport,
  saveChangelogArtifacts,
} from '../changelog';
import type {
  ChangelogBaselineCharacter,
  ChangelogBaselinePayload,
} from '../baseline';

function createMockCharacter(
  id: string,
  overrides: Partial<ChangelogBaselineCharacter> = {}
): ChangelogBaselineCharacter {
  return {
    id,
    avatar_id: `Avatar_${id}`,
    weapon_id: `Weapon_${id}`,
    name_en: `Character ${id}`,
    name_ru: `Персонаж ${id}`,
    element: 'Frost',
    role: 'DPS',
    rarity: 'SSR',
    base_stats: {
      attack: 19,
      hp: 1165,
      crit: 15,
      shatter: 16,
      charge: 14,
    },
    max_stats: {
      attack: 1612,
      hp: 79999,
    },
    advancements: [
      {
        star: 1,
        name: '1 Star Advancement',
        description: 'Increases Frost Damage by 9%. Increases damage to 5,400%.',
      },
      {
        star: 2,
        name: '2 Star Advancement',
        description: 'Increases Base ATK growth by 16%.',
      },
    ],
    traits: [
      {
        affinity: 1200,
        name: 'First Trait',
        description: 'Increases Final Damage by 14%.',
      },
      {
        affinity: 4000,
        name: 'Second Trait',
        description: 'Increases Final Damage by 18%.',
      },
    ],
    weapon: {
      id: `Weapon_${id}`,
      name: `Weapon of ${id}`,
      shatter: 16,
      charge: 14,
      skills: [
        {
          id: 'skill_normal_1',
          name: 'Normal Attack',
          category: 'Normal',
          description: 'Deal damage equal to 50.5% of ATK.',
        },
        {
          id: 'skill_discharge_1',
          name: 'Discharge Attack',
          category: 'Discharge',
          description: 'Deal massive damage equal to 850% of ATK.',
        },
      ],
      passives: [
        {
          id: 'passive_1',
          name: 'Frost Resonance',
          description: 'Increase Frost ATK by 15% and Frost Resistance by 25%.',
        },
      ],
    },
    ...overrides,
  };
}

function createMockPayload(
  edition: 'gacha' | 'mmo',
  characters: Record<string, ChangelogBaselineCharacter>
): ChangelogBaselinePayload {
  return {
    schemaVersion: 1,
    edition,
    generatedAt: '2026-09-18T00:00:00.000Z',
    total: Object.keys(characters).length,
    characters,
  };
}

describe('changelog diff engine', () => {
  describe('isPlaceholderValue and extractNumbers', () => {
    it('correctly identifies placeholder and empty values', () => {
      assert.strictEqual(isPlaceholderValue(''), true);
      assert.strictEqual(isPlaceholderValue('   '), true);
      assert.strictEqual(isPlaceholderValue('—'), true);
      assert.strictEqual(isPlaceholderValue('-'), true);
      assert.strictEqual(isPlaceholderValue('TBD'), true);
      assert.strictEqual(isPlaceholderValue('none'), true);
      assert.strictEqual(isPlaceholderValue('null'), true);
      assert.strictEqual(isPlaceholderValue('N/A'), true);
      assert.strictEqual(isPlaceholderValue(null), true);
      assert.strictEqual(isPlaceholderValue(undefined), true);

      assert.strictEqual(isPlaceholderValue('Increases damage by 10%'), false);
      assert.strictEqual(isPlaceholderValue('Frost Damage'), false);
    });
  });

  describe('classifyChangePath', () => {
    it('correctly classifies paths into domain categories', () => {
      assert.strictEqual(classifyChangePath('advancements.0.description'), 'Advancement');
      assert.strictEqual(classifyChangePath('traits.1200.description'), 'Trait');
      assert.strictEqual(classifyChangePath('passives.0.description'), 'Passive');
      assert.strictEqual(classifyChangePath('weapon.passives.0.description'), 'Passive');
      assert.strictEqual(classifyChangePath('matrices.piece2.description'), 'Matrix');
      assert.strictEqual(classifyChangePath('base_stats.attack'), 'Stat');
      assert.strictEqual(classifyChangePath('max_stats.hp'), 'Stat');
      assert.strictEqual(classifyChangePath('weapon.skills.0.description', { category: 'Discharge' }), 'Discharge');
      assert.strictEqual(classifyChangePath('skills.0.description', { category: 'Normal' }), 'Normal');
      assert.strictEqual(classifyChangePath('skills.0.description'), 'Skill');
      assert.strictEqual(classifyChangePath('metadata.custom'), 'Other');
    });
  });

  describe('deepCompareValues', () => {
    it('detects numeric changes in string descriptions', () => {
      const oldText = 'Increases Frost Damage by 9%. Increases damage to 5,400%.';
      const newText = 'Increases Frost Damage by 12%. Increases damage to 6,000%.';

      const changes = deepCompareValues(oldText, newText, 'advancements.0.description');
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].type, 'Advancement');
      assert.strictEqual(changes[0].old, oldText);
      assert.strictEqual(changes[0].new, newText);
    });

    it('ignores text modifications when numbers remain identical (avoids false positive wording diffs)', () => {
      const oldText = 'Increases Frost Damage by 9%.';
      const newText = 'Boosts Frost Damage by 9%.';

      const changes = deepCompareValues(oldText, newText, 'advancements.0.description');
      assert.strictEqual(changes.length, 0);
    });

    it('detects numeric stat adjustments', () => {
      const changes = deepCompareValues(19, 25, 'base_stats.attack');
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].type, 'Stat');
      assert.strictEqual(changes[0].old, 19);
      assert.strictEqual(changes[0].new, 25);
    });

    it('ignores uninitialized 0 -> number transitions representing placeholder fill', () => {
      const changes = deepCompareValues(0, 15, 'base_stats.crit');
      assert.strictEqual(changes.length, 0);
    });

    it('detects number -> 0 transitions (e.g. cooldown eliminated)', () => {
      const changes = deepCompareValues(15, 0, 'base_stats.crit');
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].old, 15);
      assert.strictEqual(changes[0].new, 0);
    });

    it('ignores transitions from placeholder to real value', () => {
      const changes1 = deepCompareValues('—', 'Increases ATK by 10%', 'traits.0.description');
      assert.strictEqual(changes1.length, 0);

      const changes2 = deepCompareValues('TBD', 'Deals 200% damage', 'skills.0.description');
      assert.strictEqual(changes2.length, 0);
    });
  });

  describe('compareCharacterValues', () => {
    it('returns hasChanges: false when character tracked values are identical', () => {
      const oldChar = createMockCharacter('alyss');
      const newChar = createMockCharacter('alyss');

      const diff = compareCharacterValues(oldChar, newChar);
      assert.strictEqual(diff.hasChanges, false);
      assert.strictEqual(diff.changes.length, 0);
      assert.strictEqual(diff.changelogEntry, undefined);
    });

    it('detects single numeric change in advancements', () => {
      const oldChar = createMockCharacter('alyss');
      const newChar = createMockCharacter('alyss', {
        advancements: [
          {
            star: 1,
            name: '1 Star Advancement',
            description: 'Increases Frost Damage by 12%. Increases damage to 5,400%.',
          },
          oldChar.advancements![1],
        ],
      });

      const diff = compareCharacterValues(oldChar, newChar, { patch: 'v4.5' });
      assert.strictEqual(diff.hasChanges, true);
      assert.strictEqual(diff.changes.length, 1);
      assert.strictEqual(diff.changes[0].type, 'Advancement');
      assert.strictEqual(diff.changelogEntry?.patch, 'v4.5');
      assert.strictEqual(diff.changelogEntry?.changes.length, 1);
    });

    it('detects multiple changes across skills, traits, and stats', () => {
      const oldChar = createMockCharacter('alyss');
      const newChar = createMockCharacter('alyss', {
        base_stats: { ...oldChar.base_stats, attack: 35 },
        traits: [
          { affinity: 1200, name: 'First Trait', description: 'Increases Final Damage by 20%.' },
          oldChar.traits![1],
        ],
        weapon: {
          ...oldChar.weapon,
          skills: [
            {
              id: 'skill_normal_1',
              name: 'Normal Attack',
              category: 'Normal',
              description: 'Deal damage equal to 75.0% of ATK.',
            },
            oldChar.weapon!.skills[1],
          ],
        },
      });

      const diff = compareCharacterValues(oldChar, newChar);
      assert.strictEqual(diff.hasChanges, true);
      assert.strictEqual(diff.changes.length, 3);

      const types = diff.changes.map((c) => c.type).sort();
      assert.deepStrictEqual(types, ['Skill', 'Stat', 'Trait']);
    });
  });

  describe('compareEditionChangelogs strict rules', () => {
    it('RULE: New characters in newIds strictly produce ZERO value-change entries', () => {
      const oldBaseline = createMockPayload('gacha', {
        alyss: createMockCharacter('alyss'),
      });

      // Fresh export has alyss (unchanged) + brand new character "nemesis"
      const newBaseline = createMockPayload('gacha', {
        alyss: createMockCharacter('alyss'),
        nemesis: createMockCharacter('nemesis', {
          advancements: [
            { star: 1, name: '1 Star', description: 'Heals all allies by 100% ATK.' },
          ],
        }),
      });

      const result = compareEditionChangelogs('gacha', oldBaseline, newBaseline);

      assert.strictEqual(result.status, 'no_changes');
      assert.strictEqual(result.charactersWithChangesCount, 0);
      assert.strictEqual(result.totalValueChangesCount, 0);
      assert.deepStrictEqual(result.commonIds, ['alyss']);
      assert.deepStrictEqual(result.newIds, ['nemesis']);
      assert.strictEqual(result.addedCharacters.length, 1);
      assert.strictEqual(result.addedCharacters[0].id, 'nemesis');
      assert.strictEqual(Object.keys(result.characterDiffs).length, 0);
    });

    it('RULE: Removed characters in removedIds are partitioned into separate category', () => {
      const oldBaseline = createMockPayload('gacha', {
        alyss: createMockCharacter('alyss'),
        retired_char: createMockCharacter('retired_char'),
      });

      // Fresh export omits retired_char
      const newBaseline = createMockPayload('gacha', {
        alyss: createMockCharacter('alyss'),
      });

      const result = compareEditionChangelogs('gacha', oldBaseline, newBaseline);

      assert.strictEqual(result.status, 'no_changes');
      assert.deepStrictEqual(result.commonIds, ['alyss']);
      assert.deepStrictEqual(result.newIds, []);
      assert.deepStrictEqual(result.removedIds, ['retired_char']);
      assert.strictEqual(result.removedCharacters.length, 1);
      assert.strictEqual(result.removedCharacters[0].id, 'retired_char');
      assert.strictEqual(result.charactersWithChangesCount, 0);
    });

    it('RULE: Only commonIds characters with changed values produce value diff entries', () => {
      const oldBaseline = createMockPayload('gacha', {
        alyss: createMockCharacter('alyss'),
        echo: createMockCharacter('echo'),
        retired: createMockCharacter('retired'),
      });

      const newBaseline = createMockPayload('gacha', {
        alyss: createMockCharacter('alyss', {
          base_stats: { ...createMockCharacter('alyss').base_stats, attack: 50 },
        }),
        echo: createMockCharacter('echo'), // unchanged
        newbie: createMockCharacter('newbie'), // brand new
      });

      const result = compareEditionChangelogs('gacha', oldBaseline, newBaseline);

      assert.strictEqual(result.status, 'ok');
      assert.strictEqual(result.charactersWithChangesCount, 1);
      assert.strictEqual(result.totalValueChangesCount, 1);
      assert.strictEqual(Boolean(result.characterDiffs['alyss']), true);
      assert.strictEqual(Boolean(result.characterDiffs['echo']), false);
      assert.strictEqual(Boolean(result.characterDiffs['newbie']), false);
      assert.strictEqual(Boolean(result.characterDiffs['retired']), false);
      assert.deepStrictEqual(result.newIds, ['newbie']);
      assert.deepStrictEqual(result.removedIds, ['retired']);
    });

    it('handles baseline_unavailable gracefully without fabricating fake changelogs', () => {
      const newBaseline = createMockPayload('gacha', {
        alyss: createMockCharacter('alyss'),
        echo: createMockCharacter('echo'),
      });

      const result = compareEditionChangelogs('gacha', null, newBaseline);

      assert.strictEqual(result.status, 'baseline_unavailable');
      assert.strictEqual(result.charactersWithChangesCount, 0);
      assert.strictEqual(result.totalValueChangesCount, 0);
      assert.deepStrictEqual(result.commonIds, []);
      assert.deepStrictEqual(result.newIds, ['alyss', 'echo']);
      assert.strictEqual(result.addedCharacters.length, 2);
    });

    it('handles malformed baseline data safely', () => {
      const result = compareEditionChangelogs('gacha', null, null);
      assert.strictEqual(result.status, 'malformed');
      assert.strictEqual(result.charactersWithChangesCount, 0);
    });
  });

  describe('compareSimulacraChangelogs (Gacha & MMO separation)', () => {
    it('strictly isolates Gacha and MMO comparisons (MMO-only change)', () => {
      const oldBaselines = {
        gacha: createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
        }),
        mmo: createMockPayload('mmo', {
          alyss_mmo: createMockCharacter('alyss_mmo', { server_mode: 'mmo' as any }),
        }),
      };

      const freshBaselines = {
        gacha: createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'), // No change in Gacha
        }),
        mmo: createMockPayload('mmo', {
          alyss_mmo: createMockCharacter('alyss_mmo', {
            server_mode: 'mmo' as any,
            base_stats: { ...createMockCharacter('alyss_mmo').base_stats, hp: 5000 }, // Changed in MMO
          }),
        }),
      };

      const result = compareSimulacraChangelogs(oldBaselines, freshBaselines);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'ready');

      // Gacha: 0 changes
      assert.strictEqual(result.gacha.status, 'no_changes');
      assert.strictEqual(result.gacha.charactersWithChangesCount, 0);
      assert.strictEqual(result.gacha.totalValueChangesCount, 0);

      // MMO: 1 change
      assert.strictEqual(result.mmo.status, 'ok');
      assert.strictEqual(result.mmo.charactersWithChangesCount, 1);
      assert.strictEqual(result.mmo.totalValueChangesCount, 1);
      assert.strictEqual(result.summary.totalCharactersWithChanges, 1);
      assert.strictEqual(result.summary.totalValueChanges, 1);
    });

    it('returns status no_changes when both editions have zero value changes', () => {
      const oldBaselines = {
        gacha: createMockPayload('gacha', { alyss: createMockCharacter('alyss') }),
        mmo: createMockPayload('mmo', { alyss_mmo: createMockCharacter('alyss_mmo') }),
      };
      const freshBaselines = {
        gacha: createMockPayload('gacha', { alyss: createMockCharacter('alyss') }),
        mmo: createMockPayload('mmo', { alyss_mmo: createMockCharacter('alyss_mmo') }),
      };

      const result = compareSimulacraChangelogs(oldBaselines, freshBaselines);
      assert.strictEqual(result.status, 'no_changes');
      assert.strictEqual(result.summary.totalCharactersWithChanges, 0);
      assert.strictEqual(result.summary.totalValueChanges, 0);
    });

    it('returns baseline_unavailable when both baselines are null', () => {
      const freshBaselines = {
        gacha: createMockPayload('gacha', { alyss: createMockCharacter('alyss') }),
        mmo: createMockPayload('mmo', { alyss_mmo: createMockCharacter('alyss_mmo') }),
      };

      const result = compareSimulacraChangelogs(null, freshBaselines);
      assert.strictEqual(result.status, 'baseline_unavailable');
      assert.strictEqual(result.warnings?.length, 2);
    });
  });

  describe('applyChangelogsToCharacters', () => {
    it('prepends new changelog entry to modified character and preserves history', () => {
      const existingHistory = [
        {
          patch: 'v3.8',
          client: 'Korea Dev 1',
          clientRu: 'Корея Dev 1',
          date: '2026-08-01',
          edition: 'gacha' as const,
          server_mode: 'gacha' as const,
          changes: [],
        },
      ];

      const character = createMockCharacter('alyss', {
        changelogs: [...existingHistory],
      });

      const editionDiff = compareEditionChangelogs(
        'gacha',
        createMockPayload('gacha', { alyss: createMockCharacter('alyss') }),
        createMockPayload('gacha', {
          alyss: createMockCharacter('alyss', {
            base_stats: { ...createMockCharacter('alyss').base_stats, attack: 30 },
          }),
        }),
        { patch: 'v4.0', date: '2026-09-18' }
      );

      const count = applyChangelogsToCharacters([character], editionDiff);
      assert.strictEqual(count, 1);
      assert.strictEqual(character.changelogs.length, 2);
      assert.strictEqual(character.changelogs[0].patch, 'v4.0');
      assert.strictEqual(character.changelogs[1].patch, 'v3.8');
    });

    it('does not modify characters without changes or new characters', () => {
      const unchangedChar = createMockCharacter('echo');
      const newChar = createMockCharacter('newbie');

      const editionDiff = compareEditionChangelogs(
        'gacha',
        createMockPayload('gacha', { echo: createMockCharacter('echo') }),
        createMockPayload('gacha', {
          echo: createMockCharacter('echo'),
          newbie: createMockCharacter('newbie'),
        })
      );

      const count = applyChangelogsToCharacters([unchangedChar, newChar], editionDiff);
      assert.strictEqual(count, 0);
      assert.strictEqual(unchangedChar.changelogs, undefined);
      assert.strictEqual(newChar.changelogs, undefined);
    });
  });

  describe('report generation and artifact saving', () => {
    it('generates clear diff report and saves JSON and TXT artifacts to disk', () => {
      const oldBaselines = {
        gacha: createMockPayload('gacha', {
          alyss: createMockCharacter('alyss'),
          retired: createMockCharacter('retired'),
        }),
        mmo: createMockPayload('mmo', {
          alyss_mmo: createMockCharacter('alyss_mmo'),
        }),
      };

      const freshBaselines = {
        gacha: createMockPayload('gacha', {
          alyss: createMockCharacter('alyss', {
            base_stats: { ...createMockCharacter('alyss').base_stats, attack: 42 },
          }),
          brand_new: createMockCharacter('brand_new'),
        }),
        mmo: createMockPayload('mmo', {
          alyss_mmo: createMockCharacter('alyss_mmo'),
        }),
      };

      const result = compareSimulacraChangelogs(oldBaselines, freshBaselines, {
        patch: 'Update 2026-09-18',
      });

      const reportText = generateChangelogDiffReport(result);
      assert.match(reportText, /GACHA EDITION/);
      assert.match(reportText, /MMO EDITION/);
      assert.match(reportText, /\[alyss\]/);
      assert.match(reportText, /New Characters Added/);
      assert.match(reportText, /brand_new/);
      assert.match(reportText, /Characters Absent in New Data/);
      assert.match(reportText, /retired/);

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-changelog-test-'));
      try {
        const artifacts = saveChangelogArtifacts(tempDir, result);
        assert.strictEqual(fs.existsSync(artifacts.diffJsonPath), true);
        assert.strictEqual(fs.existsSync(artifacts.reportTxtPath), true);

        const loadedJson = JSON.parse(fs.readFileSync(artifacts.diffJsonPath, 'utf8'));
        assert.strictEqual(loadedJson.success, true);
        assert.strictEqual(loadedJson.gacha.charactersWithChangesCount, 1);
        assert.strictEqual(loadedJson.gacha.newIds.length, 1);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
