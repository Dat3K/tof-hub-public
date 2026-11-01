import type { HandbookTeamRaidData } from '../contracts/handbook';

type Raid = HandbookTeamRaidData['raids'][number];
type StatRow = NonNullable<Raid['bosses'][number]['stats']>[number];

export interface BossDefenses {
  /** Element → percent (OOW formula at the recorded level), from `stats[].derived`. */
  resistPct: Record<string, number | null>;
  finalCritDefPct: number | null;
  /** Raw `MaxHealth` of the same row. */
  maxHealth: number | null;
}

/**
 * Defenses of the Challenge fight, or null when the data does not say which row that is.
 * Challenge rows carry a `_II` / `_2` / `_NM` / `_KN` suffix (Heroic: none / `_HD` / `_PT`; an inference from the paired variants, e.g. Team8P_01_D uses `..._8P`, Team8P_01_D_II `..._8P_KN`); of those the boss's own row is the shortest key
 * (`Boss_hum_067_Team8P_II`, not `..._FireShadow_II`). Without such a row every matched row must agree.
 */
export function challengeDefenses(raid: Raid | undefined, bossIds: readonly string[]): BossDefenses | null {
  const bosses = bossIds.flatMap(id => raid?.bosses.find(boss => boss.id === id) ?? []);
  const all = [...new Map(bosses.flatMap(boss => boss.stats ?? []).map(row => [row.rowId, row])).values()];
  const challenge = all.filter(row => /_(ii|2|kn|nm)$/i.test(row.rowId));
  const shortest = Math.min(...challenge.map(row => row.rowId.length));
  const own = challenge.filter(row => row.rowId.length === shortest);
  const rows: StatRow[] = own.length ? own : all;
  const first = rows[0]?.derived;
  if (!first) return null;
  const maxHealth = (row: StatRow) => typeof row.fields.MaxHealth === 'number' ? row.fields.MaxHealth : null;
  const same = rows.every(row => JSON.stringify(row.derived) === JSON.stringify(first) && maxHealth(row) === maxHealth(rows[0]));
  return same ? { resistPct: first.resistPct, finalCritDefPct: first.finalCritDefPct, maxHealth: maxHealth(rows[0]) } : null;
}
