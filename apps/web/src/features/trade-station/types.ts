export type TradeSectionId = 'TQ_COM' | 'TQ_RATE' | 'TQ_RATE_FASHION';

/** A `Typeindex` or `SubTypeIndex` bucket with the label resolved from `DA_TradeLine`. */
export interface TradeCategoryNode {
  index: number;
  name: string;
}

export interface TradeSection {
  id: TradeSectionId;
  name: string;
  types: TradeCategoryNode[];
}

export interface TradeStationRow {
  id: string;
  /** Null only if neither the item catalogs nor `ItemConfigs` name the id. */
  name: string | null;
  icon: string;
  quality: string;
  section: TradeSectionId;
  type: number;
  /** `TradeBasePrice.Amount`, in Universal Crystals. */
  basePrice: number;
  /** `round(basePrice × minRatio)`. */
  minPrice: number;
  /** `round(basePrice × maxRatio)`. */
  maxPrice: number;
  minRatio: number;
  maxRatio: number;
  canList: boolean;
  canSystemBuy: boolean;
  systemMinPrice: number;
  systemMaxPrice: number;
  bindOnPurchase: boolean;
  /** `TradePriceMinDif`: the minimum step between two prices, as a ratio of the reference price. */
  priceStep: number;
  /**
   * Where the band came from: `client` is `PutAwardRange`, `server` is a curated override for the
   * Overseas build that the client table cannot express.
   */
  bandSource: 'client' | 'server';
  /** A `frag_*` id: the item is a shard, and ten of them combine into `shardOfId`. */
  shard: boolean;
  /** The item this shard combines into, when that item has its own row here. */
  shardOfId: string | null;
}

export interface TradeRulesSection {
  title: string;
  items: string[];
}

export interface TradePriceBand {
  idPrefix: string;
  minRatio: number;
  maxRatio: number;
  stepRatio: number;
  note?: string;
}

export interface TradeStationRules {
  source: 'client' | 'observed';
  observedAt: string;
  serverTimeZone: string;
  /** Bands the Overseas build uses instead of `PutAwardRange`; already applied to the rows. */
  priceBands?: TradePriceBand[];
  en: { sections: TradeRulesSection[] };
}

export interface TradeStationDataset {
  currency: { code: string; name: string };
  sections: TradeSection[];
  rows: TradeStationRow[];
  /** Curated rules for the Overseas MMO build; absent when the curated file is missing. */
  rules?: TradeStationRules;
}

export type TradeSort = 'category' | 'price-desc' | 'price-asc' | 'name-asc';

export interface TradeStationInitialState {
  /** True when the URL carried a filter, so a stored filter must not override an explicit link. */
  explicit: boolean;
  search: string;
  section: TradeSectionId | 'all';
  type: number | null;
  sort: TradeSort;
  showUnlistable: boolean;
}

export interface TradeStationViewProps {
  dataset: TradeStationDataset;
  initial: TradeStationInitialState;
}
