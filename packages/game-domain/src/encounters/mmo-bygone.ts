export interface MmoBygoneHpScaling {
  curveValue: number;
  stacks: number;
  multiplier: number;
}

/** MMO floor HP: each whole stack adds one baseline. Keep curve precision until conversion. */
export function getMmoBygoneHpScaling(curveValue: number | null | undefined): MmoBygoneHpScaling | null {
  if (curveValue == null || !Number.isFinite(curveValue) || curveValue < 0) return null;
  const stacks = Math.trunc(curveValue);
  if (!Number.isSafeInteger(stacks) || !Number.isSafeInteger(stacks + 1)) return null;
  return {curveValue, stacks, multiplier: 1 + stacks};
}

/** Counts, resistance and enemy level do not multiply the HP of an individual enemy. */
export function getMmoBygoneHp(baseHp: number | null | undefined, scaling: MmoBygoneHpScaling | null): number | null {
  if (baseHp == null || !Number.isFinite(baseHp) || baseHp <= 0 || !scaling) return null;
  const hp = baseHp * scaling.multiplier;
  return Number.isFinite(hp) && hp > 0 ? hp : null;
}

export type MmoBygoneDefenseElement = 'physical' | 'flame' | 'frost' | 'volt' | 'altered';
export interface MmoBygoneDefenseEstimate {
  model: 'base-plus-whole-defense-stacks';
  verified: false;
  curveValue: number;
  stacks: number;
  values: Record<MmoBygoneDefenseElement, number | null>;
}

/** Explicit display estimate: one DEF per whole curve stack. Runtime magnitude/rounding are unverified. */
export function estimateMmoBygoneDefense(
  bases: Partial<Record<MmoBygoneDefenseElement, number | null>> | null | undefined,
  curveValue: number | null | undefined,
): MmoBygoneDefenseEstimate | null {
  if (!bases || curveValue == null || !Number.isFinite(curveValue) || curveValue < 0) return null;
  const stacks = Math.trunc(curveValue);
  if (!Number.isSafeInteger(stacks)) return null;
  const estimate = (base: number | null | undefined) => {
    if (base == null || !Number.isFinite(base) || base < 0) return null;
    const result = base + stacks;
    return Number.isFinite(result) && result <= Number.MAX_SAFE_INTEGER ? result : null;
  };
  return {model: 'base-plus-whole-defense-stacks', verified: false, curveValue, stacks,
    values: {physical: estimate(bases.physical), flame: estimate(bases.flame), frost: estimate(bases.frost),
      volt: estimate(bases.volt), altered: estimate(bases.altered)}};
}
