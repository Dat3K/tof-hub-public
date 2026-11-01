export interface WeaponStatsAtLevel {
  level: number;
  attack: number | string;
  hp: number | string;
  crit: number | string;
  resistance: number | string;
}

/** Raw per-weapon growth from scripts/generators/build-weapon-growth.cjs (game-data/weapon-growth.json). */
export interface WeaponGrowth {
  maxLevel: number;
  stats: {id: "attack"|"hp"|"crit"|"resistance"; base: number; increments: {from: number; to: number; value: number}[]; stars: number[]}[];
}

/**
 * Game rule: float32 sum of the raw base and every
 * per-level increment up to the level, times the star coefficient, truncated.
 */
export function weaponGrowthValue(stat: WeaponGrowth["stats"][number], level: number, stars: number): number {
  const f = Math.fround;
  let value = f(stat.base);
  for (const run of stat.increments) {
    for (let current = run.from; current <= Math.min(run.to, level); current++) value = f(value + f(run.value));
  }
  const coefficient = stat.stars[Math.max(0, Math.min(stat.stars.length - 1, Math.round(stars)))] ?? 1;
  return Math.floor(f(value * f(coefficient)));
}

function finiteNumber(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Uses raw `growth` when present. Otherwise falls back to the legacy processor formula: the
 * normalized dataset stores raw Lv. 1 values, the unstarred Lv. 200 base ATK
 * when available, and the verified 6★ MAX values. Other stats use the game's
 * default 6★ coefficient of 2 when their unstarred endpoint is not stored.
 */
export function getWeaponStatsAtLevel(
  character: {base_stats?:unknown;max_stats?:unknown;growth?:WeaponGrowth|null},
  selectedLevel: number,
  stars = 6,
): WeaponStatsAtLevel {
  const growth = character.growth;
  if (growth?.stats.length) {
    const level = Math.max(0, Math.min(growth.maxLevel, Math.round(finiteNumber(selectedLevel) ?? growth.maxLevel)));
    const value = (id: string) => {
      const stat = growth.stats.find((entry) => entry.id === id);
      return stat ? weaponGrowthValue(stat, level, stars) : "—";
    };
    return {level, attack: value("attack"), hp: value("hp"), crit: value("crit"), resistance: value("resistance")};
  }
  const baseStats = (character.base_stats || {}) as Record<string, unknown>;
  const maxStats = (character.max_stats || baseStats.max_stats || {}) as Record<string, unknown>;
  const maxLevel = Math.max(1, Math.round(finiteNumber(maxStats.level ?? baseStats.max_level) ?? 200));
  const level = Math.max(1, Math.min(maxLevel, Math.round(finiteNumber(selectedLevel) ?? maxLevel)));
  const scale = (
    baseKey: string,
    maxKey: string,
    coefficient: number,
    rawMaxKey?: string,
  ): number | string => {
    const baseValue = finiteNumber(baseStats[baseKey]);
    const maxValue = finiteNumber(maxStats[maxKey]);
    if (baseValue === null) return maxValue ?? "—";
    if (maxValue === null) return baseValue;

    const rawMaxValue = finiteNumber(rawMaxKey ? maxStats[rawMaxKey] : undefined)
      ?? maxValue / coefficient;
    const rawAtLevel = baseValue + ((rawMaxValue - baseValue) * level) / maxLevel;
    return Math.floor(rawAtLevel * coefficient);
  };

  const attackBase = finiteNumber(maxStats.attack_base);
  const attackMax = finiteNumber(maxStats.attack);
  const attackCoefficient = attackBase && attackBase > 0 && attackMax !== null
    ? attackMax / attackBase
    : 2;
  const resistanceKey = maxStats.resistance !== undefined ? "resistance" : "def";
  const resistanceBaseKey = baseStats[resistanceKey] !== undefined
    ? resistanceKey
    : "resistance";

  return {
    level,
    attack: scale("attack", "attack", attackCoefficient, "attack_base"),
    hp: scale("hp", "hp", 2, "hp_base"),
    crit: scale("crit", "crit", 2, "crit_base"),
    resistance: scale(
      resistanceBaseKey,
      resistanceKey,
      2,
      "resistance_base",
    ),
  };
}

