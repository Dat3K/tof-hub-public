import { describe, it, expect } from 'vitest';
import {
  BASELINE_GACHA_ITEMS,
  BASELINE_MMO_ITEMS,
  mergeItemsData,
} from './items-data';
import {
  cleanItemName,
  resolveMediaUrl,
  getRarityBorderColor,
  getItemsTradeCategories,
  filterItemRows,
  buildHighlightedParts,
  normalizeItemRows,
  sortItemRows,
} from './items-domain';
import { ITEMS_COPY } from './items-copy';
import { mergeTradeStationItems } from '../../../../../../scripts/normalize-game-data/adapters/items';
import { buildRow } from '../../../../../../scripts/game-processors/processors/build-trade-station';

describe('Items Datamine Feature', () => {
  it('joins by item ID and keeps unlistable and unknown MMO items distinct', () => {
    const item = {name: 'Trade name', icon: '', quality: ''};
    const fixture = (id: string, canList: boolean) => buildRow(id, {
      TradeBasePrice: {Amount: 10}, PutAwardRange: {X: 0.5, Y: 2}, bCanList: canList,
    }, item);
    const joined = mergeTradeStationItems({
      '1': {id: 'exact', name: 'Localized item'},
      '10': {id: 'EXACT', name: 'Other item'},
    }, {
      currency: {code: 'fixture', name: 'Fixture currency'},
      sections: [],
      rows: [fixture('exact', true), fixture('trade-only', false)],
    });
    const rows = normalizeItemRows(joined);
    expect(rows.find(row => row.id === 'exact')).toMatchObject({
      name: 'Localized item', trade: {basePrice: 10, minPrice: 5, maxPrice: 20, canList: true},
    });
    expect(rows.find(row => row.id === 'EXACT')?.trade).toBeUndefined();
    expect(filterItemRows(rows, 'tradeable', '').map(row => row.id)).toEqual(['exact']);
    expect(filterItemRows(rows, 'unlistable', '').map(row => row.id)).toEqual(['trade-only']);
    expect(rows.find(row => row.id === 'trade-only')?.num).toBe('11');
    expect(sortItemRows(rows, 'num', 'descending', 'en').map(row => row.num)).toEqual(['11', '10', '1']);
    expect(sortItemRows(rows, 'trade', 'descending', 'en').at(-1)?.id).toBe('EXACT');
  });

  it('filters by section and type without adding unused indices to a category', () => {
    const item = {name: 'Trade name', icon: '', quality: ''};
    const row = (id: string, TradeQuality: string, Typeindex: number) =>
      buildRow(id, {TradeQuality, Typeindex, bCanList: true}, item);
    const rows = normalizeItemRows(mergeTradeStationItems({}, {
      currency: {code: 'fixture', name: 'Currency'}, sections: [],
      rows: [row('a', 'supply', 0), row('b', 'rare', 0), row('c', 'supply', 3), row('d', 'rare', 2)],
    }));
    expect(getItemsTradeCategories(rows, [{id: 'supply', name: 'Supply', types: [
      {index: 0, name: 'Materials'}, {index: 2, name: 'Unused type'},
    ]}])).toEqual([
      {id: 'supply', name: 'Supply', types: [{index: 0, name: 'Materials'}, {index: 3, name: '#3'}]},
      {id: 'rare', name: 'rare', types: [{index: 0, name: '#0'}, {index: 2, name: '#2'}]},
    ]);
    expect(filterItemRows(rows, 'tradeable', '', undefined, {section: 'supply', type: 0}).map(item => item.id)).toEqual(['a']);
  });

  describe('Baseline Items Integrity', () => {
    it('contains baseline items for both Gacha and MMO modes', () => {
      expect(Object.keys(BASELINE_GACHA_ITEMS).length).toBeGreaterThan(50);
      expect(Object.keys(BASELINE_MMO_ITEMS).length).toBeGreaterThan(20);
    });

    it('contains both canonical renamed summer skins', () => {
      const gachaItems = normalizeItemRows(BASELINE_GACHA_ITEMS);
      const skin1 = gachaItems.find((it) => it.id === 'imitation_fashion_43');
      const skin2 = gachaItems.find((it) => it.id === 'imitation_fashion_43_w');

      expect(skin1).toBeDefined();
      expect(skin1?.rename).toBe('Ling Han Summer skin');
      expect(skin2).toBeDefined();
      expect(skin2?.rename).toBe('Ling Han Summer weapon skin');
    });

    it('merges custom server payload into normalized rows', () => {
      const customPayload = {
        '101': {
          id: 'custom_item_id',
          name: 'Custom Weapon',
          original: '自定义武器',
          rename: 'Custom Renamed Weapon',
          quality: 'ITEM_QUALITY_EPIC',
          icon: '/custom/icon.webp',
        },
      };

      const rows = mergeItemsData(customPayload as any, 'gacha');
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('custom_item_id');
      expect(rows[0].rename).toBe('Custom Renamed Weapon');
      expect(rows[0].rarity).toBe('SSR');
    });
  });

  describe('Domain Logic & Sanitization', () => {
    it('cleans item names stripping decorative symbols, quotes, and notes', () => {
      expect(cleanItemName('“Golden Apple”')).toBe('Golden Apple');
      expect(cleanItemName('《Holy Scepter》')).toBe('Holy Scepter');
      expect(cleanItemName('♪ Music Disc ♫')).toBe('Music Disc');
      expect(cleanItemName('#Special Token*')).toBe('Special Token');
      expect(cleanItemName('---Energy Core')).toBe('Energy Core');
      expect(cleanItemName('Simple Item')).toBe('Simple Item');
    });

    it('resolves media URLs correctly', () => {
      expect(resolveMediaUrl('/datamine/shared/media/icon.png')).toBe(
        '/game-assets/webp/icon.webp'
      );
      expect(resolveMediaUrl('shared/media/icon.png')).toBe(
        '/game-assets/webp/icon.webp'
      );
      expect(resolveMediaUrl('../shared/media/icon.png')).toBe(
        '/game-assets/webp/icon.webp'
      );
      expect(resolveMediaUrl('')).toBe('');
    });

    it('returns valid rarity border colors', () => {
      expect(getRarityBorderColor('SSR')).toBe('#f5d97a');
      expect(getRarityBorderColor('SR')).toBe('#a77add');
      expect(getRarityBorderColor('R')).toBe('#5fa8ff');
      expect(getRarityBorderColor('N')).toBe('rgba(255, 255, 255, 0.3)');
    });

    it('builds highlighted tokens matching search terms', () => {
      const tokens = buildHighlightedParts('Holy Scepter Data Core', 'scepter');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ text: 'Holy ', match: false });
      expect(tokens[1]).toEqual({ text: 'Scepter', match: true });
      expect(tokens[2]).toEqual({ text: ' Data Core', match: false });
    });
  });

  describe('Filtering & Sorting', () => {
    it('filters by renamed only', () => {
      const rows = normalizeItemRows(BASELINE_GACHA_ITEMS);
      const renamedOnly = filterItemRows(rows, 'renamed', '');
      expect(renamedOnly.length).toBeGreaterThan(0);
      renamedOnly.forEach((item) => {
        expect(item.rename.trim().length).toBeGreaterThan(0);
      });
    });

    it('filters by search query across ID, name, and original', () => {
      const rows = normalizeItemRows(BASELINE_GACHA_ITEMS);
      const results = filterItemRows(rows, 'all', 'ling han');
      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach((item) => {
        expect(item.searchText).toContain('ling han');
      });
    });

    it('sorts numeric keys in ascending order', () => {
      const raw = {
        '10': { id: 'item_10', name: 'Item 10' },
        '2': { id: 'item_2', name: 'Item 2' },
        '1': { id: 'item_1', name: 'Item 1' },
      };

      const sorted = normalizeItemRows(raw);
      expect(sorted[0].num).toBe('1');
      expect(sorted[1].num).toBe('2');
      expect(sorted[2].num).toBe('10');
    });

    it('sorts the whole row dataset by selected column without detaching NUM', () => {
      const rows = normalizeItemRows({
        '10': { id: 'z-item', name: 'Zulu' },
        '2': { id: 'a-item', name: 'Alpha' },
        '1': { id: 'm-item', name: 'Mike' },
      });

      const ascending = sortItemRows(rows, 'name', 'ascending', 'en');
      expect(ascending.map((row) => [row.num, row.id])).toEqual([
        ['2', 'a-item'], ['1', 'm-item'], ['10', 'z-item'],
      ]);
      expect(sortItemRows(ascending, 'name', 'descending', 'en').map((row) => row.num))
        .toEqual(['10', '1', '2']);
      expect(sortItemRows(ascending, 'num', 'ascending', 'en').map((row) => row.num))
        .toEqual(['1', '2', '10']);
    });

    it('contains bilingual copy tables in EN and RU', () => {
      expect(ITEMS_COPY.en.title).toBe('Item ID database');
      expect(ITEMS_COPY.ru.title).toBe('Идентификаторы предметов');
      expect(ITEMS_COPY.en.gacha).toBe('Gacha');
      expect(ITEMS_COPY.ru.gacha).toBe('Gacha');
      expect(ITEMS_COPY.en.mmo).toBe('MMO');
      expect(ITEMS_COPY.ru.mmo).toBe('MMO');
    });
  });
});
