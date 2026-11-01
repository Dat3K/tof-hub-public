import type { HandbookServer, HandbookSpaceSupportData, ItemCounts } from '../contracts/handbook';

/** Hide special pool variants from the advanced-slot picker, keeping base and premium pools. */
export function visibleStatPools<T extends { pool: string }>(pools: T[], advancedSlot: boolean): T[] {
  return advancedSlot ? pools.filter((pool) => !/_sp\d+$/.test(pool.pool)) : pools;
}

/** Keep one choice for qualities whose complete generated stat ranges are identical. */
export function distinctRangeQualities(mode: { qualities: string[]; stats: Record<string, { ranges: Record<string, unknown> }> }): string[] {
  const seen = new Set<string>();
  const stats = Object.values(mode.stats);
  return mode.qualities.filter((quality) => {
    const signature = JSON.stringify(stats.map((stat) => stat.ranges[quality] ?? null));
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

/** Follow generated quality order; omit equivalent ranges whose pools are already available. */
export function slotQualityChoices(mode: {
  qualities: string[];
  stats: Record<string, { ranges: Record<string, unknown> }>;
  slots: Record<string, Record<string, { pool: string; weights: unknown[] }[]>>;
}, slot: string): string[] {
  const pools = mode.slots[slot] ?? {};
  const stats = Object.values(mode.stats);
  const choices: string[] = [];
  for (const quality of mode.qualities.filter((q) => pools[q]?.length)) {
    const duplicate = choices.some((previous) =>
      stats.every((stat) => JSON.stringify(stat.ranges[quality]) === JSON.stringify(stat.ranges[previous])) &&
      pools[quality]!.every((pool) => pools[previous]!.some((other) =>
        pool.pool === other.pool && JSON.stringify(pool.weights) === JSON.stringify(other.weights))));
    if (!duplicate) choices.push(quality);
  }
  return choices;
}

/** Difference of two cumulative totals (`to − from`), dropping zero entries. */
export function cumulativeDifference(to: ItemCounts | undefined, from: ItemCounts | undefined): ItemCounts {
  const result: ItemCounts = {};
  for (const [id, count] of Object.entries(to ?? {})) {
    const value = count - (from?.[id] ?? 0);
    if (value > 0) result[id] = value;
  }
  return result;
}

/** Range and weighted mean of the value drawn from weighted uniform bands `[lower, upper, weight]`. */
export function bandSummary(bands: readonly (readonly [number, number, number])[]) {
  const total = bands.reduce((sum, band) => sum + band[2], 0);
  const used = bands.filter((band) => band[2] > 0);
  return {
    min: used.length ? Math.min(...used.map((band) => band[0])) : 0,
    max: used.length ? Math.max(...used.map((band) => band[1])) : 0,
    expected: total ? bands.reduce((sum, band) => sum + ((band[0] + band[1]) / 2) * band[2], 0) / total : 0,
  };
}

/** Raw rows of a rate table whose value changes, so long runs of the same rate collapse into ranges. */
export function rateRuns(rows: readonly { count: number; rate: number }[]) {
  const runs: { from: number; to: number; rate: number }[] = [];
  for (const row of rows) {
    const last = runs[runs.length - 1];
    if (last && last.rate === row.rate) last.to = row.count;
    else runs.push({ from: row.count, to: row.count, rate: row.rate });
  }
  return runs;
}

export type SpaceSupportLevels = Record<string, { current: number; target: number }>;

/**
 * Talent points to raise every module from its current to its target level, plus the cost of lifting the base
 * modules to the level the second system level requires when any target exceeds the first level's cap.
 */
export function spaceSupportPlan(data: HandbookSpaceSupportData, levels: SpaceSupportLevels) {
  const cumulative = (id: string, level: number) =>
    level <= 0 ? 0 : data.modules.find((m) => m.id === id)?.levels.find((l) => l.level === level)?.cumulative ?? 0;
  const [first, second] = [...data.systemLevels].sort((a, b) => a.level - b.level);
  let modules = 0;
  for (const module of data.modules) {
    const { current, target } = levels[module.id] ?? { current: 0, target: 0 };
    if (target > current) modules += cumulative(module.id, target) - cumulative(module.id, current);
  }
  const needsSecond = Boolean(first && second && data.modules.some((m) => (levels[m.id]?.target ?? 0) > first.maxModuleLevel));
  const required = second?.needAllModuleLevel ?? 0;
  const blocking = needsSecond
    ? data.modules.filter((m) => m.base && Math.max(levels[m.id]?.current ?? 0, levels[m.id]?.target ?? 0) < required)
    : [];
  const unlock = blocking.reduce(
    (sum, m) => sum + cumulative(m.id, required) - cumulative(m.id, Math.max(levels[m.id]?.current ?? 0, levels[m.id]?.target ?? 0)),
    0
  );
  return { modules, unlock, total: modules + unlock, blocking: blocking.map((m) => m.id), required };
}

export type ServerGroup = 'global' | 'ps' | 'warp' | 'china' | 'taiwan' | 'korea' | 'test';

export function serverGroup(server: HandbookServer): ServerGroup {
  if (server.kind === 'test') return 'test';
  if (server.kind === 'warp') return 'warp';
  if (server.platform === 'ps') return 'ps';
  if (server.region === 'China') return 'china';
  if (server.region === 'Taiwan') return 'taiwan';
  if (server.regionCode === 'KR' || server.region === 'Korea') return 'korea';
  return 'global';
}

/** Servers of a group by in-game tab, tabs in first-seen order and servers by id. */
export function serversByTab(servers: readonly HandbookServer[], group: ServerGroup) {
  const tabs = new Map<string, HandbookServer[]>();
  for (const server of servers) {
    if (serverGroup(server) !== group) continue;
    tabs.set(server.tab, [...(tabs.get(server.tab) ?? []), server]);
  }
  return [...tabs].map(([tab, list]) => ({ tab, servers: list.sort((a, b) => Number(a.id) - Number(b.id)) }));
}

/** Server whose id is the longest prefix of the UID's digits (5 digits globally, longer for some regions). */
export function serverForUid(servers: readonly HandbookServer[], uid: string): HandbookServer | null {
  const digits = uid.replace(/\D/g, '');
  if (digits.length < 5) return null;
  let match: HandbookServer | null = null;
  for (const server of servers)
    if (digits.startsWith(server.id) && server.id.length >= 5 && (!match || server.id.length > match.id.length)) match = server;
  return match;
}

/** Value of a linear game curve at `x`: interpolated between keys, held at the first/last key outside them. */
export function curveValue(keys: readonly { level: number; value: number }[], x: number): number | null {
  if (!keys.length) return null;
  const sorted = [...keys].sort((a, b) => a.level - b.level);
  if (x <= sorted[0]!.level) return sorted[0]!.value;
  for (let i = 1; i < sorted.length; i++) {
    const right = sorted[i]!, left = sorted[i - 1]!;
    if (x <= right.level) return left.value + ((right.value - left.value) * (x - left.level)) / (right.level - left.level);
  }
  return sorted[sorted.length - 1]!.value;
}

/**
 * Resistance ignore `ignore` and shred `shred` (fractions) applied to the target's numeric RES, then the reduction
 * recomputed (without the sheet's intermediate rounding).
 */
export function resistanceAfterIgnore(resistance: number, constant: number, ignore: number, shred: number) {
  const kept = (1 - ignore) * (1 - shred);
  const effective = resistance * kept;
  return {
    effective,
    reduction: effective / (effective + constant),
    damageFactor: (constant + resistance) / (constant + effective),
  };
}
