import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
const root = path.resolve('apps/web/public/game-data');
const load = (file: string) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
// Historical screenshots verify descriptions; current rotation follows the versioned raw fixture.
describe('MMO pipeline regressions', () => {
  it('preserves the approved S1/S2 rosters and raw provenance for additional seasons', () => {
    const cards = load('fce-cards.json');
    expect(cards.mmo.filter((boss: any) => boss.season === 1)).toHaveLength(7);
    expect(cards.mmo.filter((boss: any) => boss.season === 2)).toHaveLength(7);
    for(const boss of cards.mmo) {
      expect(boss.source.file).toBe('Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/BorderWarSeasonDataTable_MMO.json');
      expect(Number(boss.source.row)).toBe(boss.season+1);
      expect(boss.source.map).toMatch(/^BorderWar_/);
    }
    expect(cards.mmo.find((boss: any) => boss.slug === 's2-merbelle')).toMatchObject({ladder_level:29, source:{row:'3', map:'BorderWar_D97'}});
    const boss = cards.standard.find((boss: any) => boss.slug === 'devourer');
    expect(cards.mmo.some((boss: any) => boss.encounter === 'oow')).toBe(false);
    expect(boss.mechanics).toHaveLength(4);
    expect(boss.mechanics[0].html).toContain('10 instances');
  });
  it('keeps the raw 6.5.0 MMO rotation for the first five floors', () => {
    const data = load('en/oow/seasons/mmo_s04.json');
    const rotation = JSON.parse(readFileSync(path.resolve('tests/fixtures/oow-mmo-6.5.0-rotation.json'), 'utf8'));
    expect(data.startDate).toBe('2026-08-03');
    for (const expected of rotation.floors) {
      const floor = data.floors.find((item: any) => item.floor === expected.floor);
      expect(floor.source.row).toBe(expected.row);
      expect(floor.stageMutators.map((buff: any) => buff.id)).toEqual([...expected.showBuffIds, ...expected.weaknessIds]);
    }
    const first = data.floors.find((floor: any) => floor.floor === 1);
    expect(first.stageMutators.map((buff: any) => buff.nameEn)).toEqual(['Physical Boost Lv. 1','Frozen Beauty','Healing Shield Lv. 1','Freezing Halo Lv. 2','Physical Fear']);
    expect(first.stageMutators.at(-1)).toMatchObject({ id: 'buff_origin_balance99_4th', kind: 'weakness' });
    expect(first.stageMutators.map((buff: any) => [buff.id, buff.icon])).toEqual([
      ['buff_origin_balance1_10', '/datamine/shared/media/Hotta/Content/Resources/Icon/wormhole/player/buff_chongdong_monster_015.webp'],
      ['buff_origin_balance5_2', '/datamine/shared/media/Hotta/Content/Resources/Icon/buff/buff_frigg_damageup.webp'],
      ['buff_origin_balance4_11', '/datamine/shared/media/Hotta/Content/Resources/Icon/buff_balance/balance_humbuff_17.webp'],
      ['buff_origin_balance99_9', '/datamine/shared/media/Hotta/Content/Resources/Icon/buff/buff_cubeshield_001.webp'],
      ['buff_origin_balance99_4th', '/datamine/shared/media/Hotta/Content/Resources/UI/blood/weakpoint_physics.webp'],
    ]);
    const judgment = data.floors.find((floor: any) => floor.floor === 17).stageMutators.find((buff: any) => buff.nameEn === 'Judgment Lv. 1');
    expect(judgment.descEn).toContain('160%');
    for (const floor of data.floors) {
      expect(floor.source.seasonId).toBe('4');
      for (const enemy of floor.enemies) expect(enemy.mode).toBe('mmo');
    }
  });
  it('preserves all five food quality tiers including gold', () => {
    const items = load('en/food-mmo.json').items;
    expect(new Set(items.map((item: any) => item.rarity))).toEqual(new Set(['N','R','SR','SSR','GOLD']));
    expect(items.find((item: any) => item.name === 'Baked Black Bread')).toMatchObject({rarity:'GOLD',cook_level:19});
    expect(items.find((item: any) => item.name === 'Barnacle seafood pizza')).toMatchObject({rarity:'SSR',cook_level:15});
  });
});
