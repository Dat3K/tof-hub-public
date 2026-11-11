import { describe, expect, it } from 'vitest';
import { getCleanPassives, getSkillDescriptionForLevel, getWeaponStatsAtLevel } from './skill-scaling';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('skill scaling values', () => {
  it('uses Gefion raw curve times and interpolates sparse values instead of stopping at the point count',()=>{
    const dataset=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../../public/game-data/en/simulacra.json'),'utf8'));
    const gefion=dataset.gacha.find((item:any)=>item.id==='gefion');
    const skill=gefion.weapon.skills.normals.find((item:any)=>item.name_en==='Ascending Step');
    expect(getSkillDescriptionForLevel(skill,118)).toContain('1118% of ATK + 3525');
    expect(getSkillDescriptionForLevel(skill,118)).toContain('1057% of ATK + 3332');
    expect(getSkillDescriptionForLevel(skill,118)).toContain('1417% of ATK + 4467');
    expect(getSkillDescriptionForLevel(skill,160)).toContain('1417% of ATK + 6708');
    expect(getSkillDescriptionForLevel(skill,190)).toContain('1118% of ATK + 6354');
    expect(getSkillDescriptionForLevel(skill,190)).toContain('1417% of ATK + 8053');
    expect(getSkillDescriptionForLevel(skill,200)).toContain('1417% of ATK + 8949');
  });
  const zoey = {
    base_stats: { attack: 19, hp: 1165, crit: 15, max_level: 200 },
    max_stats: { level: 200, attack: 1612, attack_base: 650, hp: 79999, crit: 1000 },
  } as any;

  it('scales weapon stats with the shared character level control', () => {
    expect(getWeaponStatsAtLevel(zoey, 1)).toMatchObject({ level: 1, attack: 54, hp: 2718, crit: 34 });
    expect(getWeaponStatsAtLevel(zoey, 100)).toMatchObject({ level: 100, attack: 829, hp: 41164, crit: 515 });
    expect(getWeaponStatsAtLevel(zoey, 200)).toMatchObject({ level: 200, attack: 1612, hp: 79999, crit: 1000 });
  });

  const airAttack = {
    id: 'GA_FPlayerZoeyMelee_AirAttack',
    name_en: 'Air Attack',
    desc_en: 'Deals damage up to {0}% of ATK + {1}.',
    desc_display_en: 'Deals damage up to 776% of ATK + 4901.',
    parameters: [
      { key: 'GA_FPlayerZoeyMelee_AirAttack_1', levels: { 1: 776, 2: 776 } },
      {
        key: 'GA_FPlayerZoeyMelee_AirAttack_2',
        levels: { 1: 41, 13: 3183, 14: 3428, 21: 4901 },
      },
    ],
  };

  it('resolves percentage and flat values from object-based level curves', () => {
    expect(getSkillDescriptionForLevel(airAttack, 141)).toBe('Deals damage up to 776% of ATK + 3428.');
  });

  it('keeps the final static display at max level', () => {
    expect(getSkillDescriptionForLevel(airAttack, 200)).toBe('Deals damage up to 776% of ATK + 4901.');
  });

  it('adds the localized MMO Balance passive for each elemental weapon', () => {
    const cases = [
      ['Physical', 'Grievous', '100% of ATK', 'icon_element_wu'],
      ['Flame', 'Flame', '20% of ATK every second', 'icon_element_huo'],
      ['Frost', 'Ice Shell', 'speed is reduced by 30%', 'icon_element_bing'],
      ['Volt', 'Volt', 'electrified for 5 seconds', 'icon_element_lei'],
      ['Altered', 'Altered Damage', 'up to a total of 160%', 'icon_element_powers'],
    ] as const;

    for (const [element, name, text, icon] of cases) {
      const [passive] = getCleanPassives({
        id: `mmo-${element.toLowerCase()}`,
        server_mode: 'mmo',
        element,
        weapon: { skills: { passives: [] } },
      });

      expect(passive).toMatchObject({
        id: `reaction_${element.toLowerCase()}`,
        name_en: name,
        icon: expect.stringContaining(icon),
        isReaction: true,
      });
      expect(passive.desc_en).toContain(text);
    }
  });

  it('keeps MMO dual reactions excluded while attaching the primary Balance passive', () => {
    const [passive] = getCleanPassives({
      id: 'mmo-physical-flame',
      server_mode: 'mmo',
      element: 'Physical',
      element_secondary: 'Flame',
      weapon: {
        skills: {
          passives: [
            {
              id: 'reaction_physical_flame',
              name_en: 'Armor Dissolve',
              desc_en: 'Dual reaction',
            },
          ],
        },
      },
    });

    expect(passive).toMatchObject({
      id: 'reaction_physical',
      name_en: 'Grievous',
      isReaction: true,
    });
    expect(passive.desc_en).toContain('reducing their healing effect by 30%');
  });

  it('keeps the source Volt passive for the Gacha Volt + Frost weapon pairing', () => {
    const passives = getCleanPassives({
      id: 'ciper',
      server_mode: 'gacha',
      element: 'Volt',
      element_secondary: 'Frost',
      weapon: {
        skills: {
          passives: [
            {
              id: 'reaction_volt',
              name_en: 'Volt',
              isReaction: true,
              category: 'Passive',
            },
            {
              id: 'Buff_Commodore_Ice_Resonance',
              name_en: 'Frost Resonance',
              category: 'Passive',
            },
          ],
        },
      },
    });

    expect(passives.map((passive) => passive.name_en)).toEqual([
      'Volt',
      'Frost Resonance',
    ]);
  });

  it('keeps the legacy dual reaction instead of replacing it with a single element passive', () => {
    const passives = getCleanPassives({
      id: 'zoey',
      server_mode: 'gacha',
      element: 'Physical',
      element_secondary: 'Flame',
      weapon: {
        skills: {
          passives: [
            {
              id: 'reaction_physical_flame',
              name_en: 'Armor Dissolve',
              isReaction: true,
              category: 'Passive',
            },
            {
              id: 'Buff_Zoey_Flame_Resonance',
              name_en: 'Flame Resonance',
              category: 'Passive',
            },
          ],
        },
      },
    });

    expect(passives.map((passive) => passive.name_en)).toEqual([
      'Armor Dissolve',
      'Flame Resonance',
    ]);
  });
});
