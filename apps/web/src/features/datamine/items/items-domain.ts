import { type Locale } from '@tof-hub/i18n';
import { itemQualityToRarity, type Rarity } from '@tof-hub/game-domain';
import { gameAsset } from '@tof-hub/game-assets';
import type { TradeSection } from '@tof-hub/contracts';
import type { ItemRow, ItemsFilter, ItemsSortColumn, ItemsSortDirection, ItemsTradeFilter } from './items-types';

/**
 * Strips outer quotes, musical notes, hashtags, hyphens, and decorative symbols.
 * Matches legacy items-core.js cleanItemName.
 */
export function cleanItemName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let cleaned = name.trim();

  // Strip outer / surrounding quotes
  cleaned = cleaned.replace(/^["'“‘《「『]\s*/, '').replace(/\s*["'”’》」』]$/, '').trim();
  cleaned = cleaned.replace(/^["'“‘《「『]\s*/, '').replace(/\s*["'”’》」』]$/, '').trim();

  // Strip musical notes, hashtags, hyphens/dashes, tildes, asterisks at start or end
  cleaned = cleaned.replace(/^[♪♫♬♩#\-\–\—\s~*]+\s*/, '');
  cleaned = cleaned.replace(/\s*[♪♫♬♩#\s~*]+$/, '');

  // Strip any inner quotes exposed after removing symbols
  cleaned = cleaned.replace(/^["'“‘《「『]\s*/, '').replace(/\s*["'”’》」』]$/, '').trim();

  // Remove leading hyphens/dashes
  cleaned = cleaned.replace(/^[-–—]+\s*/, '');

  return cleaned.trim();
}

/**
 * Resolves media URLs supporting both /datamine/shared/media and relative paths.
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return '';
  let str = String(url).trim().replace(/\\/g, '/');
  if (!str) return '';
  // Keep the legacy resolver's relative path semantics before handing the
  // reference to the canonical game-asset resolver.
  if (str.startsWith('shared/media/')) str = `/datamine/${str}`;
  if (str.startsWith('../shared/media/')) str = `/datamine/shared/media/${str.substring('../shared/media/'.length)}`;
  return gameAsset(str);
}

/**
 * Returns color accent based on item rarity.
 */
export function getRarityBorderColor(rarity: Rarity): string {
  switch (rarity) {
    case 'SSR':
      return '#f5d97a'; // Gold
    case 'SR':
      return '#a77add'; // Purple
    case 'R':
      return '#5fa8ff'; // Blue
    case 'N':
      return 'rgba(255, 255, 255, 0.3)'; // Gray/White
    default:
      return 'rgba(255, 255, 255, 0.15)';
  }
}

/**
 * Normalizes dictionary payload of items into sorted ItemRow array.
 */
export function normalizeItemRows(payload: Record<string, any>): ItemRow[] {
  return Object.entries(payload || {})
    .map(([key, item]) => {
      const quality = typeof item?.quality === 'string' ? item.quality : item?.quality != null ? String(item.quality) : '';
      const descEn = String(item?.description_en ?? item?.description ?? '');
      const descRu = String(item?.description_ru ?? item?.description_en ?? item?.description ?? '');
      const icon = String(item?.icon ?? '');
      const rawName = String(item?.name ?? item?.id ?? '');
      const name = cleanItemName(rawName);
      const original = String(item?.original ?? '');
      const rename = String(item?.rename ?? '');
      const rarity = itemQualityToRarity(quality);

      const searchStrings = [
        String(key),
        String(item?.id ?? ''),
        name,
        original,
        rename,
        descEn,
        descRu,
      ];

      return {
        key: String(key),
        num: String(key),
        id: String(item?.id ?? ''),
        name,
        original,
        rename,
        quality,
        hasQuality: Boolean(quality),
        icon,
        description_en: descEn,
        description_ru: descRu,
        rarity,
        searchText: searchStrings.join('\n').toLocaleLowerCase(),
        ...(item?.trade ? {trade: item.trade} : {}),
      };
    })
    .sort((left, right) => compareItemNumbers(left, right, 1));
}

function compareItemNumbers(left: ItemRow, right: ItemRow, multiplier: number): number {
  const leftNumber = Number(left.num);
  const rightNumber = Number(right.num);
  const comparison = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
    ? leftNumber - rightNumber
    : String(left.num).localeCompare(String(right.num), 'en', {numeric: true, sensitivity: 'base'});
  return comparison * multiplier;
}

export function getItemsTradeCategories(rows: ItemRow[], categories: TradeSection[] = []): TradeSection[] {
  const sections = new Map<string, Set<number>>();
  for (const {trade} of rows) {
    if (!trade?.section) continue;
    const types = sections.get(trade.section) ?? new Set<number>();
    types.add(trade.type);
    sections.set(trade.section, types);
  }
  const order = new Set([...categories.map(category => category.id), ...[...sections.keys()].sort()]);
  return [...order].flatMap(id => {
    const indexes = sections.get(id);
    if (!indexes) return [];
    const category = categories.find(candidate => candidate.id === id);
    return [{
      id,
      name: category?.name || id,
      types: [...indexes].sort((a, b) => a - b).map(index => ({
        index,
        name: category?.types.find(type => type.index === index)?.name || `#${index}`,
      })),
    }];
  });
}

/** Filters items by status, search text, quality and the selected Trade Station category. */
export function filterItemRows(
  rows: ItemRow[],
  filter: ItemsFilter,
  search: string,
  qualityFilter?: string,
  tradeFilter?: ItemsTradeFilter,
): ItemRow[] {
  const searchNeedle = search.trim().toLocaleLowerCase();

  return rows.filter((row) => {
    if (filter === 'tradeable' && row.trade?.canList !== true) return false;
    if (filter === 'unlistable' && row.trade?.canList !== false) return false;
    if (tradeFilter?.section && row.trade?.section !== tradeFilter.section) return false;
    if (tradeFilter?.type != null && row.trade?.type !== tradeFilter.type) return false;
    if (filter === 'renamed' && !row.rename.trim()) {
      return false;
    }

    if (qualityFilter && qualityFilter !== 'all' && row.quality !== qualityFilter) {
      return false;
    }

    if (searchNeedle && !row.searchText.includes(searchNeedle)) {
      return false;
    }

    return true;
  });
}

/** Sorts the complete filtered dataset while keeping every field attached to its row. */
export function sortItemRows(
  rows: ItemRow[],
  column: ItemsSortColumn,
  direction: ItemsSortDirection,
  locale: Locale
): ItemRow[] {
  const multiplier = direction === 'ascending' ? 1 : -1;
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });

  return [...rows].sort((left, right) => {
    let comparison: number;
    if (column === 'trade') {
      if (Boolean(left.trade) !== Boolean(right.trade)) return left.trade ? -1 : 1;
      comparison = (left.trade?.basePrice ?? 0) - (right.trade?.basePrice ?? 0);
    } else if (column === 'num') {
      return compareItemNumbers(left, right, multiplier);
    } else {
      const valueFor = (row: ItemRow) => {
        switch (column) {
          case 'icon': return row.icon;
          case 'id': return row.id;
          case 'name': return row.name;
          case 'description': return locale === 'ru' ? row.description_ru || row.description_en : row.description_en;
          case 'original': return row.original;
          case 'rename': return row.rename;
        }
      };
      comparison = collator.compare(valueFor(left), valueFor(right));
    }

    return comparison * multiplier || compareItemNumbers(left, right, multiplier);
  });
}

/**
 * Splits text into highlighted tokens based on search query for safe rendering.
 */
export function buildHighlightedParts(
  text: string,
  query: string
): Array<{ text: string; match: boolean }> {
  if (!query || !text) return [{ text: text || '', match: false }];
  const loweredSource = text.toLocaleLowerCase();
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [{ text, match: false }];

  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = loweredSource.indexOf(needle, cursor);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), match: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), match: false });
    }

    parts.push({ text: text.slice(matchIndex, matchIndex + needle.length), match: true });
    cursor = matchIndex + needle.length;
  }

  return parts;
}
