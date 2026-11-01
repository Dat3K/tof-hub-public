import { describe, expect, it } from 'vitest';
import { distinctRangeQualities, slotQualityChoices, visibleStatPools } from './handbook-domain';

describe('visible stat pools', () => {
  it('hides special variants only for advanced slots while retaining base and premium pools', () => {
    const pools = [{ pool: 'core1_randompool_orange' }, { pool: 'core1_randompool_orange_sp1' },
      { pool: 'core1_randompool_orange_sp2' }, { pool: 'core_randompool_premium_fire1' }];
    expect(visibleStatPools(pools, true)).toEqual([pools[0], pools[3]]);
    expect(visibleStatPools(pools, false)).toEqual(pools);
  });
});

describe('slot quality choices', () => {
  const range = { min: 1, max: 2 };
  const pool = { pool: 'gold-pool', weights: [{ stat: 'attack', weight: 5 }] };
  const mode = {
    qualities: ['white', 'orange', 'red'],
    stats: { attack: { ranges: { white: { min: 0, max: 1 }, orange: range, red: range } } },
    slots: { helmet: { red: [pool], orange: [pool], white: [{ ...pool, pool: 'white-pool' }] } },
  };
  it('uses canonical order and removes equivalent pools already accessible under another quality', () => {
    expect(slotQualityChoices(mode, 'helmet')).toEqual(['white', 'orange']);
  });
  it('keeps distinct pools and changed weights', () => {
    expect(slotQualityChoices({ ...mode, slots: { helmet: { ...mode.slots.helmet,
      red: [{ ...pool, pool: 'unique-pool' }],
    } } }, 'helmet')).toEqual(['white', 'orange', 'red']);
    expect(slotQualityChoices({ ...mode, slots: { helmet: { ...mode.slots.helmet,
      red: [{ ...pool, weights: [{ stat: 'attack', weight: 10 }] }],
    } } }, 'helmet')).toEqual(['white', 'orange', 'red']);
  });
});

describe('stat range quality choices', () => {
  it('omits a duplicate quality only when every stat range matches', () => {
    const range = { base: 10, min: 2, max: 4 };
    expect(distinctRangeQualities({ qualities: ['orange', 'red'], stats: {
      attack: { ranges: { orange: range, red: { ...range } } },
    } })).toEqual(['orange']);
    expect(distinctRangeQualities({ qualities: ['orange', 'red'], stats: {
      attack: { ranges: { orange: range, red: range } },
      hp: { ranges: { orange: range, red: { ...range, max: 5 } } },
    } })).toEqual(['orange', 'red']);
  });

  it('retains tiers with distinct ranges or different available stats', () => {
    expect(distinctRangeQualities({ qualities: ['orange', 'orange_1', 'orange_2'], stats: {
      attack: { ranges: { orange: { min: 1 }, orange_1: { min: 2 } } },
      hp: { ranges: { orange_2: { min: 2 } } },
    } })).toEqual(['orange', 'orange_1', 'orange_2']);
  });
});
import type { HandbookServer, HandbookSpaceSupportData } from '../contracts/handbook';
import { bandSummary, cumulativeDifference, curveValue, rateRuns, resistanceAfterIgnore, serverForUid, serverGroup, serversByTab, spaceSupportPlan } from './handbook-domain';
import { HANDBOOK_COPY } from './handbook-copy';
import {
  HANDBOOK_SECTIONS,
  handbookHref,
  handbookHash,
  handbookSectionFromHash,
  parseHandbookHash,
  parseHandbookMode,
  visibleHandbookSections,
  legacyHandbookDestination,
} from './handbook-sections';

describe('handbook sections', () => {
  it('reads the server mode from ?server=', () => {
    expect(parseHandbookMode('mmo')).toBe('mmo');
    expect(parseHandbookMode('MMO')).toBe('mmo');
    expect(parseHandbookMode(['mmo', 'gacha'])).toBe('mmo');
    expect(parseHandbookMode('gacha')).toBe('gacha');
    expect(parseHandbookMode(undefined)).toBe('gacha');
    expect(parseHandbookMode('other')).toBe('gacha');
  });

  it('hides systems that do not exist in MMO', () => {
    expect(visibleHandbookSections('gacha').map((s) => s.id)).toEqual(
      HANDBOOK_SECTIONS.filter((section) => section.modes !== 'mmo').map((section) => section.id),
    );
    const mmo = visibleHandbookSections('mmo').map((s) => s.id);
    expect(mmo).not.toContain('titan');
    expect(mmo).not.toContain('supercomputer');
    expect(mmo).not.toContain('space-support');
    expect(mmo).toEqual(['random-stats', 'expansion', 'brainfield', 'suppressor', 'servers']);
  });

  it('builds mode URLs that keep only visible anchors', () => {
    expect(handbookHref('gacha')).toBe('/datamine/handbook/');
    expect(handbookHref('mmo', '#suppressor')).toBe('/datamine/handbook/?server=mmo#suppressor');
    expect(handbookHref('mmo', '#titan')).toBe('/datamine/handbook/?server=mmo');
    expect(handbookHref('gacha', '#titan')).toBe('/datamine/handbook/#titan');
    expect(handbookHref('gacha', '#unknown')).toBe('/datamine/handbook/');
  });

  it('resolves hashes to sections', () => {
    expect(handbookSectionFromHash('#space-support')?.id).toBe('space-support');
    expect(handbookSectionFromHash('')).toBeNull();
    expect(handbookSectionFromHash('#nope')).toBeNull();
    expect(handbookSectionFromHash('#titan/added')?.id).toBe('titan');
    expect(parseHandbookHash('#random-stats/chances')?.sub).toBe('chances');
    expect(parseHandbookHash('#random-stats')?.sub).toBeNull();
    expect(handbookHash('titan', 'added')).toBe('#titan/added');
    expect(handbookHref('mmo', '#random-stats/chances')).toBe('/datamine/handbook/?server=mmo#random-stats/chances');
    expect(handbookHref('mmo', '#titan/added')).toBe('/datamine/handbook/?server=mmo');
  });

  it('preserves old MMO encounter bookmarks after moving them to dedicated routes', () => {
    expect(legacyHandbookDestination('#bygone-phantasm')).toBe('/datamine/bygone/?mode=mmo');
    expect(legacyHandbookDestination('#mmo-raids')).toBe('/datamine/raids/');
    expect(legacyHandbookDestination('#biochemical-collapse/BalanceLevel_19_1')).toBe('/datamine/seq/?mode=mmo&pod=BalanceLevel_19_1');
    expect(legacyHandbookDestination('#brainfield')).toBeNull();
  });

  it('has EN and RU copy for every section', () => {
    for (const locale of ['en', 'ru'] as const)
      for (const section of HANDBOOK_SECTIONS) {
        const text = HANDBOOK_COPY[locale].sections[section.id];
        expect(text.nav && text.title, `${locale} ${section.id}`).toBeTruthy();
      }
  });
});

describe('handbook domain', () => {
  it('subtracts cumulative costs', () => {
    expect(cumulativeDifference({ a: 5, Gold: 100 }, { a: 2, Gold: 100 })).toEqual({ a: 3 });
  });

  it('summarises weighted bands and interpolates curves', () => {
    expect(bandSummary([[0, 10, 1], [10, 20, 1], [20, 30, 0]])).toEqual({ min: 0, max: 20, expected: 10 });
    const curve = [{ level: 1, value: 0.08 }, { level: 4, value: 0.14 }];
    expect(curveValue(curve, 1)).toBe(0.08);
    expect(curveValue(curve, 2)).toBeCloseTo(0.1);
    expect(curveValue(curve, 9)).toBe(0.14);
    expect(rateRuns([{ count: 1, rate: 0 }, { count: 2, rate: 0 }, { count: 3, rate: 0.25 }])).toEqual([{ from: 1, to: 2, rate: 0 }, { from: 3, to: 3, rate: 0.25 }]);
  });

  it('plans Space Support costs with the system level unlock', () => {
    const levels = (costs: number[]) => costs.map((cost, i) => ({ level: i + 1, cost, cumulative: costs.slice(0, i + 1).reduce((a, b) => a + b, 0), effect: { en: '', ru: '' }, attribute: null, value: 0 }));
    const data = {
      item: {}, totalAllModules: 0,
      systemLevels: [{ level: 1, name: null, maxModuleLevel: 2, needAllModuleLevel: 0, resetCooldownDays: 30 }, { level: 2, name: null, maxModuleLevel: 3, needAllModuleLevel: 2, resetCooldownDays: 30 }],
      modules: [
        { id: 'a', name: { en: 'A', ru: 'A' }, icon: null, base: true, maxLevel: 3, levels: levels([1, 2, 3]) },
        { id: 'b', name: { en: 'B', ru: 'B' }, icon: null, base: true, maxLevel: 3, levels: levels([1, 2, 3]) },
        { id: 'c', name: { en: 'C', ru: 'C' }, icon: null, base: false, maxLevel: 3, levels: levels([5, 5, 5]) },
      ],
    } satisfies HandbookSpaceSupportData;
    const plan = spaceSupportPlan(data, { a: { current: 0, target: 3 }, b: { current: 1, target: 1 }, c: { current: 0, target: 0 } });
    expect(plan).toEqual({ modules: 6, unlock: 2, total: 8, blocking: ['b'], required: 2 });
    expect(spaceSupportPlan(data, { a: { current: 0, target: 2 } }).unlock).toBe(0);
  });

  it('groups servers and finds a server by UID prefix', () => {
    const servers: HandbookServer[] = [
      { id: '12001', name: 'The Glades', region: 'North America', regionCode: 'NA', tab: 'North America' },
      { id: '1150008', name: 'TW', region: 'Taiwan', regionCode: 'TW', tab: '星島' },
      { id: '8144', name: 'Test', region: 'Test', regionCode: 'TEST', tab: 'China', kind: 'test' },
      { id: '12101', name: 'PS', region: 'North America', regionCode: 'NA', tab: 'PS-America', platform: 'ps' },
      { id: '9999101', name: '아스트라', region: 'Korea', regionCode: 'KR', tab: '에스페리아' },
    ];
    expect(servers.map(serverGroup)).toEqual(['global', 'taiwan', 'test', 'ps', 'korea']);
    expect(serversByTab(servers, 'korea')).toEqual([{ tab: '에스페리아', servers: [servers[4]] }]);
    expect(serversByTab(servers, 'global')).toEqual([{ tab: 'North America', servers: [servers[0]] }]);
    expect(serverForUid(servers, '120010001234')?.name).toBe('The Glades');
    expect(serverForUid(servers, '115000846102')?.id).toBe('1150008');
    expect(serverForUid(servers, '9999101001234')?.name).toBe('아스트라');
    expect(serverForUid(servers, '1234')).toBeNull();
  });
});

describe('resistance ignore and shred', () => {
  it('multiplies ignore and shred on numeric RES', () => {
    // Resistance ignore and shred: 30% + 30% at m0 = 50% → +34.2282% damage.
    const result = resistanceAfterIgnore(1000, 1000, 0.3, 0.3);
    expect(result.effective).toBeCloseTo(490);
    expect(result.damageFactor - 1).toBeCloseTo(0.342282, 5);
  });
});
