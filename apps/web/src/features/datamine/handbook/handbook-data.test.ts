import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import type { HandbookRandomStatsMode } from '../contracts/handbook';
import {formatGameRichText} from '@tof-hub/ui';

// Invariants of the committed Handbook data (scripts/generators/build-handbook.cjs, docs/game-data/README.md).
const root = path.resolve(import.meta.dirname, '../../../../../..');
const load = (file: string) => JSON.parse(readFileSync(path.join(root, 'apps/web/public/game-data', file), 'utf8'));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('handbook data', () => {
  it('keeps the localized supercomputer projection reproducible from Build data', () => {
    expect(() => execFileSync(process.execPath, [path.join(root, 'scripts/generators/build-handbook.cjs'), '--supercomputer-from-build', '--check'], {stdio: 'pipe'})).not.toThrow();
  });
  it('keeps all expansion cards and their item/slot evidence in the Handbook projection', () => {
    const data = load('handbook/mmo-expansion.json');
    const build = load('build-mmo-page.json');
    expect(data.cards.map((card: {id: string}) => card.id)).toEqual(build.cards.map((card: {id: string}) => card.id));
    expect(data.coverage.cards).toBe(build.cards.length);
    expect(data.coverage.cards).toBe(data.cards.length);
    expect(data.coverage.configuredSlots + data.coverage.describedSlots).toBe(data.cards.length);
    expect(data.coverage).toMatchObject({cards: data.cards.length,
      configuredSlots: data.cards.filter((card: {slotEvidence: {kind:string}})=>card.slotEvidence.kind==='configuration').length,
      describedSlots: data.cards.filter((card: {slotEvidence: {kind:string}})=>card.slotEvidence.kind==='item-description').length,
      missingSlots: [], unknownSlotEnums: []});
    const slotIds = new Set(data.slots.map((slot: {id: string}) => slot.id));
    const gearArt = Object.values(load('build-gear-icons.json').gear) as {slot: string; icons: {normal: string}}[];
    const gearNames = load('handbook/random-stats.json').slotNames;
    for (const slot of data.slots) {
      const shared = gearArt.find(entry => entry.slot === `EQUIPMENT_SLOT_${slot.slot}`);
      expect(slot.icon).toBe(shared?.icons.normal);
      expect(slot.iconSource.kind).toBe('shared-gear');
      expect(slot.name).toMatchObject({en: gearNames[slot.iconSource.row].en, ru: gearNames[slot.iconSource.row].ru});
    }
    for (const card of data.cards) {
      expect(card.slots.length).toBeGreaterThan(0);
      expect(card.slots.every((id: string) => slotIds.has(id))).toBe(true);
      expect(card.item.useDescription.en).toBeTruthy();
      expect(card.item.useDescription.ru).toBeTruthy();
      // EN/RU are the supported rendering contract. Other raw localizations can
      // contain malformed translated markup, which the renderer must escape.
      for (const text of [card.description?.en, card.description?.ru, card.item.useDescription.en, card.item.useDescription.ru]) {
        expect(formatGameRichText(text as string), `${card.id}: unhandled game tag`).not.toMatch(/&lt;\/?[\p{L}][^&]*&gt;/u);
      }
      const original = build.cards.find((entry: {id: string}) => entry.id === card.id);
      expect(card.params).toEqual(original.params);
      expect(card.stats).toEqual(original.stats);
    }
    expect(data.cards.find((card: {id: string}) => card.id === 'orange2_Skill_1')).toMatchObject({
      slots: ['armband', 'pants'], slotEvidence: {kind: 'item-description', rawSlots: ['EQUIPMENT_SLOT_NONE']},
    });
    expect(data.seasons.find((season: {index: number}) => season.index === 0).name).toBeNull();
  });
  it('exports localized game descriptions for every MMO random-stat variant', () => {
    const stats = load('handbook/random-stats.json').modes.mmo.stats;
    for (const stat of Object.values(stats) as {description: {en: string; ru: string}}[]) {
      expect(stat.description.en).toBeTruthy();
      expect(stat.description.ru).toBeTruthy();
    }
    expect(stats.EquipAttrWeaknessAtk.description.en).toContain('{0}');
    expect(stats.CritAdded_1.description).toEqual(stats.CritAdded.description);
  });
  it('reuses all Suppressor level stats from Tools Build', () => {
    const levels = load('handbook/suppressor.json').modes.global.levels;
    const build = load('build-page.json');
    const keys = {Attack: 'atk', HP: 'hp', Crit: 'crit', Resistance: 'res'} as const;
    for (const level of levels) {
      const original = build.suppressors.find((entry: {id: string}) => entry.id === level.row)?.stats;
      if (!original) expect(level.stats).toEqual([]);
      else for (const stat of level.stats) expect(stat.value).toBe(original[keys[stat.type as keyof typeof keys]]);
    }
  });
  it('joins MMO Suppressor combat buffs by the raw effect key and preserves the base row', () => {
    const handbook = load('handbook/suppressor.json');
    const levels = handbook.modes.mmo.levels;
    const byRow = Object.fromEntries(levels.map((level: {row: string}) => [level.row, level]));
    expect(levels).toHaveLength(81);
    expect(handbook.sources['Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/DT_SuppressorEffect_MMO.json'].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(byRow['01_0'].effects).toEqual([]);
    expect(byRow['01_1'].effects).toEqual([{sourceIndex: 0, minLevel: 0, maxLevel: 40, attackDamageMulti: 0.02, beAttackedDamageReduceMulti: 0.02}]);
    expect(byRow['02_1'].effects).toEqual([
      {sourceIndex: 1, minLevel: 0, maxLevel: 40, attackDamageMulti: 0.1, beAttackedDamageReduceMulti: 0.1},
      {sourceIndex: 0, minLevel: 41, maxLevel: 50, attackDamageMulti: 0.02, beAttackedDamageReduceMulti: 0.02},
    ]);
    expect(byRow['02_5'].effects.map((effect: {attackDamageMulti: number}) => effect.attackDamageMulti)).toEqual([0.1, 0.1]);
    expect(levels.filter((level: {effectKey: string | null}) => level.effectKey).every((level: {effects: unknown[]}) => level.effects.length > 0)).toBe(true);
  });
  it('scores other systems with the Tools Build model', () => {
    const systems = load('handbook/cs.json').systems;
    for (const node of systems.supercomputer)
      expect([1, 10, 20].map(level => node.levels.find((l: {level: number}) => l.level === level).cs)).toEqual([1880, 18800, 47000]);
    const max = (id: string) => systems.spaceSupport.find((m: {id: string}) => m.id === id).levels.at(-1);
    expect(max('PhysicalAttack')).toEqual({level: 10, cs: 2250, estimate: false});
    expect(max('PhysicalDamage')).toEqual({level: 10, cs: 3760, estimate: false});
    // Content modules (Buff_FinDamageUp_WH10, FinalDamageExtraUpMult 0.1) borrow the DMG% weight: twice a base DMG module.
    expect(max('NewRow_4')).toEqual({level: 10, cs: 7520, estimate: true});
    expect(systems.suppressor.at(-1).cs).toBeCloseTo(6018.16, 2);
  });
  it('shares Augmented and Titan enhancement main stats on every slot', () => {
    for (const slot of load('handbook/enhancement.json').modes.global.stats) {
      expect(slot.stages.augmented, slot.slot).toEqual(slot.stages.titan);
    }
  });
  it('aggregates enhancement costs by real Normal and Vera slot counts', () => {
    const mode = load('handbook/enhancement.json').modes.global;
    const groups = mode.costGroups;
    expect(groups.map((group: {slotCount: number}) => group.slotCount)).toEqual([1, 1, 8, 4, 12]);
    const byId = Object.fromEntries(groups.map((group: {id: string}) => [group.id, group]));
    for (const [id, single, count] of [['normal-all', 'normal-one', 8], ['vera-all', 'vera-one', 4]] as const) {
      for (const level of byId[id].levels) {
        const base = byId[single].levels.find((entry: {level: number}) => entry.level === level.level);
        expect(level.cumulative).toEqual(Object.fromEntries(Object.entries<number>(base.cumulative).map(([item, value]) => [item, value * count])));
      }
    }
    expect(byId.all.levels.at(-1).cumulative).toEqual(mode.allSlotsMaxTotal);
  });
  it('reuses Build Supercomputer order, icons and bonuses', () => {
    const handbook = load('handbook/supercomputer.json');
    const build = load('build-page.json');
    expect(handbook.nodes.map((node: {icon: string}) => node.icon)).toEqual(build.computing.map((node: {icon: string}) => node.icon));
    for (const node of handbook.nodes) {
      const source = build.computing.find((entry: {icon: string}) => entry.icon === node.icon);
      expect(source, `Build Supercomputer node for ${node.icon}`).toBeDefined();
      expect(node.effects).toEqual(source.effects);
      expect(node.effects).toHaveLength(3);
    }
  });
  it('materializes complementary whole-item probabilities and reserves guaranteed slots', () => {
    const {modes} = load('handbook/random-stats.json');
    const global = modes.global as HandbookRandomStatsMode;
    const helmet = global.slots.helmet!.orange!.find(p => p.pool === 'helmet_randompool_orange')!;
    const hp = helmet.weights.find(w => w.stat === 'MaxHealthAdded')!;
    expect(hp.onItemChance).toBeCloseTo(0.851131, 6);
    expect(hp.withoutStatChance).toBeCloseTo(0.148869, 6);
    for (const mode of Object.values<HandbookRandomStatsMode>(modes)) {
      expect(mode.itemChanceModel.statCount).toBe(4);
      for (const pool of Object.values(mode.slots).flatMap(qualities => Object.values(qualities).flat())) {
        if (pool.weights.every(w => w.onItemChance !== null))
          expect(sum(pool.weights.map(w => w.onItemChance!))).toBeCloseTo(mode.itemChanceModel.statCount, 4);
        for (const w of pool.weights) {
          if (w.onItemChance === null) { expect(w.withoutStatChance).toBeNull(); continue; }
          expect(w.onItemChance + w.withoutStatChance!).toBeCloseTo(1, 6);
          if (w.weight === -1) expect([w.onItemChance, w.withoutStatChance]).toEqual([1, 0]);
        }
      }
    }
  });
  it('categorizes ordinary, promo and guaranteed pools without merging guaranteed outcomes', () => {
    const {modes} = load('handbook/random-stats.json');
    const helmet = modes.global.slots.helmet.orange;
    const blue = modes.global.slots.visor.blue;
    expect(blue.filter((p: {selection: {category: string}}) => p.selection.category === 'standard')).toHaveLength(1);
    expect(blue.filter((p: {selection: {category: string}}) => p.selection.category === 'promo')).toHaveLength(4);
    expect(blue.map((pool: {selection: {variant: {variant: {en: string}} | null}}) => pool.selection.variant?.variant.en ?? 'Standard'))
      .toEqual(['Standard', 'Overload', 'Glaze', 'Burst', 'Arc']);
    expect(helmet.filter((p: {selection: {category: string}}) => p.selection.category === 'standard')).toHaveLength(1);
    expect(helmet.filter((p: {selection: {category: string}}) => p.selection.category === 'promo')).toHaveLength(4);
    expect(helmet.filter((p: {selection: {category: string}}) => p.selection.category === 'premium')).toHaveLength(4);
    const variants = modes.global.slots.visor.orange.filter((p: {pool: string}) => /^visor_randompool_premium_fire\d$/.test(p.pool));
    expect(variants).toHaveLength(4);
    expect(new Set(variants.map((p: {selection: {guaranteedStats: string[]}}) => p.selection.guaranteedStats.join(','))).size).toBe(4);
    for (const pool of variants) {
      expect(pool.selection.category).toBe('premium');
      expect(pool.selection.variant.variant.en).toBe('Burst');
      expect(pool.selection.guaranteedStats).toHaveLength(3);
      expect(pool.selection.guaranteedStats).toEqual(pool.weights.filter((w: {weight: number}) => w.weight === -1).map((w: {stat: string}) => w.stat));
    }
  });
  it('splits localized gear variants and uses the existing game element icons', () => {
    const pools = load('handbook/random-stats.json').modes.global.slots.helmet.orange;
    const icons = load('build-page.json').elementIcons;
    for (const [variant, element] of [['Overload', 'Physical'], ['Glaze', 'Frost'], ['Burst', 'Flame'], ['Arc', 'Volt']]) {
      const presentation = pools.find((pool: {presentation: {variant: {en: string}} | null}) => pool.presentation?.variant.en === variant)?.presentation;
      expect(presentation?.name.en).toBe('Fortress Helmet');
      expect(presentation?.variant.ru).toBeTruthy();
      expect(presentation?.icon).toBe(icons[element!].icon);
    }
  });
  it('resolves original containers through drop and identification chains with localized names', () => {
    const { modes } = load('handbook/random-stats.json');
    const helmet = modes.global.slots.helmet.orange.find((p: { pool: string }) => p.pool === 'helmet_randompool_premium_fire');
    expect(helmet.origins).toContainEqual(expect.objectContaining({
      id: 'choose_equip8_premium_fire', kind: 'container',
      name: expect.objectContaining({ en: 'Metaload Equipment Box (Burst)', ru: 'Метапрочный ящик со снаряжением (вспышка)' }),
    }));
    expect(helmet.origins[0].presentation).toMatchObject({name: {en: 'Metaload Equipment Box', ru: 'Метапрочный ящик со снаряжением'},
      variant: {en: 'Burst', ru: 'вспышка'}, element: 'Flame', icon: load('build-page.json').elementIcons.Flame.icon});
    const engine = modes.global.slots.core.orange.find((p: { pool: string }) => p.pool === 'core_randompool_premium_fire1');
    expect(engine.origins).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'choose_equip4_premium_fire', kind: 'container',
        name: expect.objectContaining({ en: 'Calibrated Equipment Box (Burst)' }) }),
    ]));
    for (const mode of Object.values<{slots: Record<string, Record<string, { origins: {id: string; name: {en: string | null; ru: string | null}; kind: string}[] }[]>>}>(modes))
      for (const pool of Object.values(mode.slots).flatMap(qualities => Object.values(qualities).flat())) {
        expect(new Set(pool.origins.map(source => source.id)).size).toBe(pool.origins.length);
        for (const source of pool.origins) {
          expect(['container', 'hint']).toContain(source.kind);
          expect(Boolean(source.name.en || source.name.ru)).toBe(true);
        }
      }
  });
  it('reproduces the Gold stat ranges reference', () => {
    const {stats} = load('handbook/random-stats.json').modes.global;
    const reference = JSON.parse(readFileSync(path.join(root, 'scripts/data/build-stat-ranges-reference.json'), 'utf8')).stats;
    const byType = Object.fromEntries(Object.values<{type: string | null; ranges: Record<string, Record<string, number>>}>(stats)
      .filter(stat => stat.type).map(stat => [stat.type, stat.ranges.orange]));
    for (const [type, want] of Object.entries<Record<string, number>>(reference)) {
      const tolerance = type.endsWith('%') ? 0.00006 : 0.51;
      expect(Math.abs(byType[type]!.max! - want.maxRoll!), type).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(byType[type]!.maximum! - want.maximum5!), type).toBeLessThanOrEqual(tolerance);
    }
  });

  it('normalizes every stat pool and Titan bracket', () => {
    let guaranteed = 0;
    for (const mode of Object.values<{slots: Record<string, Record<string, {weights: {weight: number; chance: number}[]}[]>>}>(load('handbook/random-stats.json').modes))
      for (const pool of Object.values(mode.slots).flatMap(qualities => Object.values(qualities).flat())) {
        const random = pool.weights.filter(w => w.weight >= 0);
        expect(sum(random.map(w => w.chance))).toBeCloseTo(1, 4);
        for (const entry of pool.weights) {
          expect(entry.chance).toBeGreaterThanOrEqual(0);
          expect(entry.chance).toBeLessThanOrEqual(1);
          if (entry.weight === -1) {
            guaranteed++;
            expect(entry.chance).toBe(1);
          }
        }
      }
    expect(guaranteed).toBeGreaterThan(0);
    for (const pool of load('handbook/titan.json').pools)
      for (const bracket of pool.brackets) expect(sum(bracket.chances.map((c: {chance: number}) => c.chance))).toBeCloseTo(1, 4);
  });

  it('keeps cumulative costs consistent', () => {
    const support = load('handbook/space-support.json');
    expect(sum(support.modules.map((m: {levels: {cost: number}[]}) => sum(m.levels.map(l => l.cost))))).toBe(support.totalAllModules);
    const suppressor = load('handbook/suppressor.json').modes.global;
    expect(suppressor.levels.at(-1).cumulative).toEqual(suppressor.total);
    const {families} = load('handbook/enhancement.json').modes.global;
    for (const family of Object.values<{levels: {gold: number; cumulative: Record<string, number>}[]}>(families))
      expect(family.levels.at(-1)!.cumulative.Gold).toBe(sum(family.levels.map(l => l.gold)));
  });
});
