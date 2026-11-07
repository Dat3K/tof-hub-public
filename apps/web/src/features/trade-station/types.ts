import type { TradeStationDataset } from '@tof-hub/contracts';

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

export type TradeSort = 'category' | 'price-desc' | 'price-asc' | 'name-asc';

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

export interface TradeStationViewProps {
  dataset: TradeStationDataset;
  initial: TradeStationInitialState;
}
