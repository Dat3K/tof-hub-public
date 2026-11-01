// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOowDifficultyRestorer, sampleOowDifficulty } from '../../scripts/normalize-game-data/oow-difficulty';

const curve = {
  InterpMode: 'RCIM_Linear',
  Keys: [{ Time: 1, Value: 2000 }, { Time: 30, Value: 2000 }, { Time: 35, Value: 1000 },
    { Time: 37, Value: 1000 }, { Time: 53, Value: 400 }, { Time: 55, Value: 400 },
    { Time: 58, Value: 100 }, { Time: 90, Value: 100 }],
};
const at = (steps: ReturnType<typeof sampleOowDifficulty>, day: number) =>
  steps.find((step) => step.startDay <= day && step.endDay >= day)?.pct;

describe('OoW difficulty generation', () => {
  it('interpolates daily ramps and bounds the final plateau by the season', () => {
    const steps = sampleOowDifficulty(curve, 61);
    expect([30, 31, 32, 33, 34, 35].map((day) => at(steps, day)))
      .toEqual([2000, 1800, 1600, 1400, 1200, 1000]);
    expect([55, 56, 57, 58].map((day) => at(steps, day))).toEqual([400, 300, 200, 100]);
    expect(steps[0]).toMatchObject({ startDay: 1, endDay: 30, durationDays: 30 });
    expect(steps.at(-1)).toMatchObject({ startDay: 58, endDay: 61, pct: 100 });
    expect(at(steps, 62)).toBeUndefined();
  });

  it('preserves constant interpolation and rejects unsupported modes', () => {
    const steps = sampleOowDifficulty({ ...curve, InterpMode: 'RCIM_Constant' }, 61);
    expect(at(steps, 34)).toBe(2000);
    expect(at(steps, 35)).toBe(1000);
    expect(() => sampleOowDifficulty({ ...curve, InterpMode: 'RCIM_Cubic' }, 61)).toThrow('Unsupported');
  });

  it('uses exact table and row references for challenge floors, preserving the calendar', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oow-difficulty-'));
    const write = (relative: string, Rows: unknown) => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify([{ Rows }]));
    };
    try {
      const dungeon = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/';
      const source = 'Hotta/Content/Resources/Abilities/DataTables/OriginWarMonster';
      const Rows = Object.fromEntries([23, 24, 25, 26, 27, 28].map((floor) => [String(floor + 600), {
        OriginSeasonID: 23, OriginRound: floor,
        MonsterStrength: { RowName: `1_${floor > 25 ? floor - 3 : floor}`,
          CurveTable: { ObjectName: "CurveTable'OriginWarMonster'", ObjectPath: source + '.0' } },
      }]));
      write(dungeon + 'OriginWarRoundConfigDataTable_Overseas.json', Rows);
      write(dungeon + 'OriginWarSeasonConfigDataTable_Overseas.json', {
        23: { SeasonBeginTime: '2026-9-12 5:00:00', SeasonEndTime: '2026-11-11 23:59:59' },
      });
      write(source + '.json', Object.fromEntries([23, 24, 25].map((floor) => [`1_${floor}`, {
        ...curve, Keys: curve.Keys.map((key, index) => ({ ...key, Time: index > 0 && index < 4 ? key.Time + floor - 25 : key.Time })),
      }])));
      // A conflicting regional table must never override the explicit asset reference.
      write(dungeon + 'OriginWarMonster_Overseas.json', { '1_28': { ...curve, Keys: [{ Time: 1, Value: 999 }] } });
      const season = createOowDifficultyRestorer(root)({ season: 23,
        floors: [23, 24, 25, 26, 27, 28].map((floor) => ({ floor, difficultySchedule: { unlockDay: floor } })) });
      expect(season.startDate).toBe('2026-09-12');
      expect(season.endDate).toBe('2026-11-11');
      expect(season.seasonBeginTime).toBe('2026-9-12 5:00:00');
      expect(season.floors.map((floor: any) => at(floor.difficultySchedule.steps, 30)))
        .toEqual([1600, 1800, 2000, 1600, 1800, 2000]);
      expect(season.floors[5].difficultySchedule).toMatchObject({ rowName: '1_25', roundRow: '628', sourcePath: source + '.json' });
      expect(season.floors.every((floor: any) => floor.difficultySchedule.steps.at(-1).endDay === 61)).toBe(true);
      expect(season.difficultySummary.floors).toHaveLength(6);
      const unresolved = createOowDifficultyRestorer(root)({ season: 23, floors: [{ floor: 29 }] });
      expect(unresolved.floors[0].difficultySchedule).toMatchObject({ diagnosticStatus: 'unresolved', steps: [] });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
