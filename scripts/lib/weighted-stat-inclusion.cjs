// Exact marginal inclusion probabilities for weighted draws without replacement.
// Equal-weight stats are exchangeable, so track counts per weight group rather
// than every ordered draw or individual subset. Guaranteed entries fill slots first.
module.exports = function weightedStatInclusion(weights, slots) {
  if (!Number.isInteger(slots) || slots < 0 || weights.some(w => !Number.isFinite(w) || w < -1)) return null;
  const guaranteed = weights.filter(w => w === -1).length;
  if (guaranteed > slots) return null;
  const groups = [];
  const indexByWeight = new Map();
  for (const weight of weights.filter(w => w > 0)) {
    if (!indexByWeight.has(weight)) {
      indexByWeight.set(weight, groups.length);
      groups.push({weight, count: 0});
    }
    groups[indexByWeight.get(weight)].count++;
  }
  const remaining = slots - guaranteed;
  const available = groups.reduce((sum, group) => sum + group.count, 0);
  if (remaining > available) return null;
  let states = new Map([['', {counts: groups.map(() => 0), probability: 1}]]);
  for (let draw = 0; draw < remaining; draw++) {
    const next = new Map();
    for (const {counts, probability} of states.values()) {
      const total = groups.reduce((sum, group, i) => sum + (group.count - counts[i]) * group.weight, 0);
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i], left = group.count - counts[i];
        if (!left) continue;
        const selected = counts.slice();
        selected[i]++;
        const key = selected.join(',');
        const state = next.get(key) ?? {counts: selected, probability: 0};
        state.probability += probability * left * group.weight / total;
        next.set(key, state);
      }
    }
    states = next;
  }
  const included = groups.map((group, i) => {
    let expected = 0;
    for (const {counts, probability} of states.values()) expected += counts[i] * probability;
    return Math.max(0, Math.min(1, expected / group.count));
  });
  return weights.map(weight => weight === -1 ? 1 : weight > 0 ? included[indexByWeight.get(weight)] : 0);
};
