import type { ReleaseManifest } from '@tof-hub/contracts';

export type SupportedLocale = 'en' | 'ru';

export interface NormalizerOptions {
  /**
   * Path to legacy site root or prepared site-facing export directory.
   * Defaults to the supplied raw/staging source, then the current project root.
   */
  legacySourceDir?: string;

  /**
   * Optional path to unpacked raw game exports directory (read-only).
   * Guarded to ensure no writes ever target raw source directory.
   */
  rawSourceDir?: string;

  /**
   * Output root for normalized language-independent core and locale overlays.
   * Defaults to <projectRoot>/pipeline/normalized.
   */
  normalizedOutputDir?: string;

  /**
   * Output directory for public materialized game-data.
   * Defaults to <projectRoot>/apps/web/public/game-data.
   */
  publicOutputDir?: string;

  /**
   * Intermediate staging directory for scratch pipeline jobs.
   * Defaults to <projectRoot>/pipeline/staging.
   */
  stagingDir?: string;

  /**
   * Locales to produce overlays and materialized datasets for.
   * Defaults to ['en', 'ru'].
   */
  locales?: SupportedLocale[];

  /**
   * Whether to write core and locale overlays to pipeline/normalized.
   * Defaults to true.
   */
  emitCoreAndOverlays?: boolean;

  /**
   * Whether to materialize finalized JSON to publicOutputDir.
   * Defaults to true.
   */
  emitMaterialized?: boolean;

  /**
   * Whether to produce changelog baseline files in changelog/.
   * Defaults to true.
   */
  emitChangelogBaselines?: boolean;

  /**
   * If true, runs validation and transforms in memory without writing to disk.
   */
  dryRun?: boolean;

  /**
   * Explicitly allow writing minimal fallback stubs to public game data.
   * Guard prevents accidental overwrite of production game data when legacy source is absent.
   */
  allowFallbacks?: boolean;
}

export interface DatasetNormalizationResult<TC = unknown, TO = unknown, TM = unknown> {
  datasetName: string;
  /**
   * The dataset carries no locale-specific content, so it is served from a single
   * `<public>/runtime/<dataset>.json` instead of per-locale copies. The normalizer also removes the
   * `{en,ru}` copies an older run may have written, so a stale file cannot shadow the served one.
   */
  localeIndependent?: boolean;
  core: TC;
  overlays: Record<SupportedLocale, TO>;
  materialized: Record<SupportedLocale, TM>;
  /** Additional locale-scoped files emitted beside the primary dataset JSON. */
  materializedFiles?: Partial<Record<SupportedLocale, Record<string, unknown>>>;
  counts: Record<string, number>;
}

export interface NormalizationSummary {
  timestamp: string;
  datasets: string[];
  totalEntities: number;
  countsByDataset: Record<string, number>;
  outputPath: string;
  normalizedPath: string;
  manifest?: ReleaseManifest;
  /** Raw eligible Wish pools without exactly one matching curated schedule row. */
  unmappedWishPools?: WishPoolCandidate[];
}

/** Pool identity/configuration discovered in raw game data, without an inferred schedule. */
export interface WishPoolCandidate {
  recordName: string;
  kind: 'weapon' | 'matrix';
  key: string;
  featuredItem: string;
  maxUnluckyCount: number | null;
  voucherItem: string | null;
  awardPool: string | null;
  widgetPath: string | null;
  sourcePath: string;
  mappingIssue?: string;
}
