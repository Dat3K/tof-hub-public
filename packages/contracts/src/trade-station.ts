/**
 * Shape of `datamine/trade-station/data/trade-station.json`, served to the site as
 * `runtime/trade-station.json`. The processor (`scripts/game-processors/processors/
 * build-trade-station.ts`) produces it and the `/tools/trade-station/` view consumes it, so the
 * interface lives here instead of being declared twice. See `docs/game-data/trade-station.md`.
 */
export interface TradeCurrency {
  /** `EHottaCurrencyType::` member the table trades in; the Overseas station uses `TradeDiamond`. */
  code: string;
  name: string;
}

/** A `Typeindex` or `SubTypeIndex` bucket with the label resolved from `DA_TradeLine`. */
export interface TradeTypeNode {
  index: number;
  name: string;
}

export interface TradeSection {
  /** `TradeQuality`, e.g. `TQ_COM`. Kept a plain string: a patch may add a section. */
  id: string;
  name: string;
  types: TradeTypeNode[];
}

export interface TradeRulesSection {
  title: string;
  items: string[];
}

/** A curated band the Overseas build uses instead of `PutAwardRange`. */
export interface TradePriceBand {
  /** Id prefix the band applies to. */
  idPrefix: string;
  minRatio: number;
  maxRatio: number;
  /** The interval between rungs, as the station measures it (13.3333%). */
  stepRatio: number;
  /** The price buttons the station shows inside the band, as percents of the reference price. */
  percentRungs: number[];
  note?: string;
}

export interface TradeStationRules {
  /** `client` when every band comes from `PutAwardRange`, `observed` when curated rules replace some. */
  source: 'client' | 'observed';
  observedAt: string;
  serverTimeZone: string;
  /** Bands already applied to the rows; kept so the page can explain where a band came from. */
  priceBands?: TradePriceBand[];
  en: { sections: TradeRulesSection[] };
}

export interface TradeStationRow {
  id: string;
  /** Null only if neither the item catalogs nor `ItemConfigs` name the id. */
  name: string | null;
  /** Served WebP URL under `/game-assets/webp/...`. */
  icon: string;
  quality: string;
  section: string;
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
  /**
   * A curated band's price buttons, as the percents the station labels them with, bottom first.
   * Absent on client bands, whose ladder the view walks in whole UC steps.
   */
  percentRungs?: number[];
  /** A `frag_*` id: the item is a shard, and ten of them combine into `shardOfId`. */
  shard: boolean;
  /** The item this shard combines into, when that item has its own row here. */
  shardOfId: string | null;
}

export interface TradeStationDataset {
  currency: TradeCurrency;
  /** SHA-256 of each input read, keyed by its logical raw, stage or curated path. */
  sources?: Record<string, string>;
  sections: TradeSection[];
  rows: TradeStationRow[];
  /** Curated rules for the Overseas MMO build; absent when the curated file is missing. */
  rules?: TradeStationRules;
}
