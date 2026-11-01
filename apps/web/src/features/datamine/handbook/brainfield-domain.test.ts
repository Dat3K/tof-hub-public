import { describe, expect, it } from 'vitest';
import { brainfieldCosts, brainfieldLayout, brainfieldStats, type BrainfieldNode, type BrainfieldGroup } from './brainfield-domain';

const node = (id: string, costs: number[]): BrainfieldNode => ({
  id, maxLevel: costs.length, kind: 'attribute', groupIndex: 0, name: null, description: null,
  icons: {activated: null, unactivated: null, blink: null}, layout: null,
  levels: costs.map((count, index) => ({level: index + 1, rowKey: `${id}_${index + 1}`, unlockConditions: [],
    attribute: {isTag: false, propName: null, propValue: null, modifierOp: null}, buffClass: null,
    buffDescription: null, descriptionParams: [], materials: [{id: 'material', count, icon: null, name: null}], bannedLevels: []})),
});

describe('Brainfield upgrade plans', () => {
  it('sums the selected additive rows across neurons, including variable per-level values', () => {
    const attributeNode = (id: string, values: number[]): BrainfieldNode => ({...node(id, values), levels: node(id, values).levels.map((level, index) => ({...level,
      attribute: {isTag: false, propName: 'Attack', propValue: values[index]!, modifierOp: 'MODIFY_MODOP_ADDITIVE'},
    }))});
    const a = attributeNode('a', [1.5, 2.75, 40]);
    const b = attributeNode('b', [3, 5]);
    expect(brainfieldStats([a, b], {a: 2, b: 1})).toEqual({Attack: 7.25});
    expect(brainfieldStats([a, b], {})).toEqual({});
    expect(brainfieldStats([{...a, maxLevel: 2}], {a: 99})).toEqual({Attack: 4.25});
    expect(brainfieldStats([{...b, kind: 'skill'}], {b: 2})).toEqual({});
    expect(brainfieldStats([{...b, levels: b.levels.map(level => ({...level, attribute: {...level.attribute, isTag: true}}))}], {b: 2})).toEqual({});
  });
  it('adds variable per-level prices across selected neurons and caps at the configured maximum', () => {
    const nodes = [node('a', [3, 5, 8]), node('b', [10, 20])];
    expect(brainfieldCosts(nodes, {})).toEqual({});
    expect(brainfieldCosts(nodes, {a: 2, b: 1})).toEqual({material: 18});
    expect(brainfieldCosts(nodes, {a: 99, b: 0})).toEqual({material: 16});
  });
  it('retains relative game coordinates and keeps unplaced skills off the graph', () => {
    const a = {...node('a', [1]), layout: {panel: 'A', offsets: {Left: -200, Top: -80}, anchors: null, alignment: null}};
    const b = {...node('b', [1]), layout: {panel: 'A', offsets: {Left: 20, Top: 8}, anchors: null, alignment: null}};
    const group = {nodes: [a, b, node('skill', [1])]} as BrainfieldGroup;
    const {positions, width, height} = brainfieldLayout(group);
    expect(positions.get('b')!.x - positions.get('a')!.x).toBe(220);
    expect(positions.get('b')!.y - positions.get('a')!.y).toBe(88);
    expect(positions.has('skill')).toBe(false);
    expect(width).toBeGreaterThan(positions.get('b')!.x);
    expect(height).toBeGreaterThan(positions.get('b')!.y);
  });
});
