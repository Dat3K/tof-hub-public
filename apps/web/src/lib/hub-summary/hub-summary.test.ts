import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HubSummary } from './types';

// Invariants of the generated hub summary (scripts/generators/build-hub-summary.cjs).
const publicDir = path.resolve(import.meta.dirname, '../../../public');
const summary = JSON.parse(
  readFileSync(path.join(publicDir, 'game-data/hub-summary.json'), 'utf8')
) as HubSummary & { sources: Record<string, { sha256: string }> };

describe('hub summary data', () => {
  it('records the current content of its generated inputs', () => {
    const sources = Object.entries(summary.sources);
    expect(sources.length).toBeGreaterThan(0);
    for (const [name, { sha256 }] of sources) {
      const file = path.join(publicDir, name.replace(/^public\//, ''));
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
      expect(hash, name).toBe(sha256);
    }
  });

  it('shows three different simulacra with the latest Altered one per server', () => {
    for (const mode of ['gacha', 'mmo'] as const) {
      const slots = summary.info.simulacra[mode];
      expect(slots).toHaveLength(3);
      expect(new Set(slots.map((slot) => slot.slug)).size).toBe(3);
      expect(slots[0]!.slot).toBe('latest');
      expect(slots[1]!.slot).toBe('previous');
      // The third slot is the latest Altered simulacrum unless it already holds one of the first two.
      const third = slots[2]!;
      if (third.slot === 'altered') expect(third.element).toBe('Altered');
      else expect(slots.slice(0, 2).some((slot) => slot.element === 'Altered')).toBe(true);
    }
  });

  it('keeps every FCE boss for the hub picker in ladder order', () => {
    expect(summary.datamine.fce.bosses).toHaveLength(summary.datamine.counts.fce);
    expect(summary.datamine.fce.bosses.every((boss) => boss.mechanic.en)).toBe(true);
  });

  it('plots ascending curves with the section page metrics', () => {
    for (const curve of [summary.datamine.bygone.curve, summary.datamine.seq.curve]) {
      const xs = curve.map(([x]) => x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    }
    expect(summary.datamine.bygone.curve.at(-1)![0]).toBe(summary.datamine.counts.bygone);
  });

  it('describes the final floor of every listed OOW season', () => {
    for (const mode of ['gacha', 'mmo'] as const) {
      for (const season of summary.datamine.oow[mode].seasons) {
        if (!season.finalFloor) continue;
        expect(season.finalFloor.floor).toBe(season.floorCount);
      }
    }
  });
});
