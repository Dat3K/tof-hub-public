import type { HandbookBrainfieldData } from '../contracts/handbook';

export type BrainfieldGroup = HandbookBrainfieldData['groups'][number];
export type BrainfieldNode = BrainfieldGroup['nodes'][number];

/** Sum actual per-level costs, which may change at every upgrade. */
export function brainfieldCosts(nodes: BrainfieldNode[], levels: Record<string, number>) {
  const totals: Record<string, number> = {};
  for (const node of nodes) for (const level of node.levels) {
    if (level.level > Math.min(node.maxLevel, levels[node.id] ?? 0)) continue;
    for (const material of level.materials) if (material.count != null)
      totals[material.id] = (totals[material.id] ?? 0) + material.count;
  }
  return totals;
}

/** The node fields the stat sum reads; the MMO build card passes this projection instead of whole Handbook nodes. */
export type BrainfieldStatNode = Pick<BrainfieldNode, 'id' | 'kind' | 'maxLevel'> & {
  levels: Pick<BrainfieldNode['levels'][number], 'level' | 'attribute'>[];
};

/** Sum direct additive attribute rows for the planned upgrades, excluding skill buffs. */
export function brainfieldStats(nodes: BrainfieldStatNode[], levels: Record<string, number>) {
  const totals: Record<string, number> = {};
  for (const node of nodes) for (const level of node.levels) {
    if (node.kind !== 'attribute' || level.level > Math.min(node.maxLevel, levels[node.id] ?? 0)) continue;
    const { propName, propValue, modifierOp, isTag } = level.attribute;
    if (!propName || propValue == null || !Number.isFinite(propValue) || isTag || modifierOp !== 'MODIFY_MODOP_ADDITIVE') continue;
    totals[propName] = (totals[propName] ?? 0) + propValue;
  }
  return totals;
}

/** Translate the game's UMG coordinates into visible canvas bounds. */
export function brainfieldLayout(group: BrainfieldGroup) {
  const placed = group.nodes.filter(node => node.layout?.offsets && Number.isFinite(node.layout.offsets.Left) && Number.isFinite(node.layout.offsets.Top));
  const minX = Math.min(0, ...placed.map(node => node.layout!.offsets!.Left!));
  const minY = Math.min(0, ...placed.map(node => node.layout!.offsets!.Top!));
  const positions = new Map(placed.map(node => [node.id, {
    x: node.layout!.offsets!.Left! - minX + 70,
    y: node.layout!.offsets!.Top! - minY + 60,
  }]));
  return { positions, width: Math.max(700, ...[...positions.values()].map(point => point.x + 80)),
    height: Math.max(250, ...[...positions.values()].map(point => point.y + 85)) };
}
