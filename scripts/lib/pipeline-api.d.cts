/** Portable CLI boundary. Implementations are checked by their source projects and integration fixtures. */
export function normalizeGameData(options: Record<string, unknown>): Promise<{
  countsByDataset: Record<string, number>;
  unmappedWishPools?: Array<{
    recordName: string; kind: 'weapon' | 'matrix'; key: string; featuredItem: string;
    maxUnluckyCount: number | null; voucherItem: string | null; awardPool: string | null;
    widgetPath: string | null; sourcePath: string; mappingIssue?: string;
  }>;
}>;
export function buildDataManifest(options: Record<string, unknown>): Promise<unknown>;
export function validateGeneratedData(options: Record<string, unknown>): Promise<{
  valid: boolean; passedChecks: number; totalChecks: number; errors: string[];
}>;
export function buildRuntimeData(root: string): unknown;
