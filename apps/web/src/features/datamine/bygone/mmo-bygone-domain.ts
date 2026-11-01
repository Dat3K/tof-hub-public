import type { HandbookMmoBygoneData, HandbookMmoBygoneEnemy, HandbookMmoBygoneMedia } from '../contracts/handbook';
import { getFloorPowercreep } from './bygone-domain';
import type { BygoneChartKind } from './bygone-types';

export type MmoBygoneRound = HandbookMmoBygoneData['rounds'][number]['rounds'][number] & {index: number};

export function mmoBygoneRounds(season: HandbookMmoBygoneData['rounds'][number] | undefined, identities?: HandbookMmoBygoneMedia['identities']): MmoBygoneRound[] {
  return (season?.rounds ?? []).filter((round): round is MmoBygoneRound => round.index != null && Number.isFinite(round.index)).map(round => identities && round.pool ? {
    ...round, pool: {...round.pool, monsters: round.pool.monsters.map(enemy => ({...enemy, name: (enemy.classPath ? identities[enemy.classPath]?.name : null) ?? enemy.name}))},
  } : round).sort((a, b) => a.index - b.index);
}

/** A configured enemy needs a class and a positive count. Combine only exact variants. */
export function mmoBygoneLineup(round: Pick<MmoBygoneRound, 'pool'>): (HandbookMmoBygoneEnemy & {count: number; sourceSlots: number[]})[] {
  const lineup = new Map<string, HandbookMmoBygoneEnemy & {count: number; sourceSlots: number[]}>();
  for (const [index, enemy] of (round.pool?.monsters ?? []).entries()) {
    if (!enemy.classPath || enemy.count == null || !Number.isFinite(enemy.count) || enemy.count <= 0) continue;
    const key = JSON.stringify([enemy.classPath, enemy.type, enemy.attributeId, enemy.stats, enemy.hp]);
    const previous = lineup.get(key);
    lineup.set(key, {...enemy, count: (previous?.count ?? 0) + enemy.count, sourceSlots: [...previous?.sourceSlots ?? [], index + 1]});
  }
  return [...lineup.values()];
}

/** Keep the same number of configured floors around the requested floor, including at either end. */
export function mmoBygoneWindow(rounds: MmoBygoneRound[], floor: number, size = 20) {
  const found = rounds.findIndex(round => round.index >= floor);
  const index = found < 0 ? Math.max(0, rounds.length - 1) : found;
  const count = Math.max(1, Math.min(rounds.length, Math.round(size)));
  const start = Math.max(0, Math.min(index - Math.floor(count / 2), rounds.length - count));
  return {minFloor: rounds[start]?.index ?? 0, maxFloor: rounds[start + count - 1]?.index ?? 0};
}

/** One enemy's highest known generated HP after floor stacks. Counts never multiply it. */
export function mmoBygoneMaxEnemyHp(round: Pick<MmoBygoneRound, 'pool'>) {
  let maximum: {hp: number; enemy: ReturnType<typeof mmoBygoneLineup>[number]} | null = null;
  let missingHpEnemyCount = 0;
  for (const enemy of mmoBygoneLineup(round)) {
    const hp = enemy.hp;
    if (hp == null || !Number.isFinite(hp) || hp <= 0) {
      missingHpEnemyCount += enemy.count;
      continue;
    }
    if (!maximum || hp > maximum.hp) maximum = {hp, enemy};
  }
  return {hp: maximum?.hp ?? null, enemy: maximum?.enemy ?? null, missingHpEnemyCount};
}

/** Compare the same single-enemy HP measure across floors, never the buff curve. */
export function mmoBygoneValue(round: MmoBygoneRound, field: BygoneChartKind, previous?: MmoBygoneRound) {
  const value = mmoBygoneMaxEnemyHp(round).hp;
  if (value == null) return null;
  if (field === 'hp') return value;
  const previousHp = previous ? mmoBygoneMaxEnemyHp(previous).hp : null;
  if (!previous || previousHp == null) return null;
  return getFloorPowercreep(
    [{floor: previous.index, hp_buff_stacks: previousHp, is_duplicate: false}],
    {floor: round.index, hp_buff_stacks: value},
  )?.percent ?? null;
}
