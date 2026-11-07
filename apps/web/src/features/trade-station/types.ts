/** The published dataset and its rows are declared once, in `@tof-hub/contracts`. */
export type {
  TradePriceBand,
  TradeRulesSection,
  TradeSection,
  TradeStationDataset,
  TradeStationRow,
  TradeStationRules,
  TradeTypeNode,
} from '@tof-hub/contracts';

const TRADE_SORT_VALUES = ['category', 'price-desc', 'price-asc', 'name-asc'] as const;

export type TradeSort = (typeof TRADE_SORT_VALUES)[number];

/** One guard for the URL, the session storage and the sort select, so the values stay in one list. */
export function isTradeSort(value: unknown): value is TradeSort {
  return typeof value === 'string' && (TRADE_SORT_VALUES as readonly string[]).includes(value);
}

export interface TradeStationInitialState {
  /** True when the URL carried a filter, so a stored filter must not override an explicit link. */
  explicit: boolean;
  search: string;
  /** A section id from the dataset, or `all`; kept a plain string so a new section needs no code. */
  section: string;
  type: number | null;
  sort: TradeSort;
  showUnlistable: boolean;
}
