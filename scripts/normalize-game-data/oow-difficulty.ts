import fs from 'node:fs';
import path from 'node:path';

type RecordData = Record<string, any>;
interface CurveKey { Time: number; Value: number }
interface Step { startDay: number; endDay: number; durationDays: number; pct: number; multiplier: number }

const roundSource = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarRoundConfigDataTable_Overseas.json';
const seasonSource = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarSeasonConfigDataTable_Overseas.json';

function readRows(file: string): RecordData {
  if (!fs.existsSync(file)) return {};
  const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  return (Array.isArray(data) ? data[0] : data)?.Rows || {};
}

function dateOnly(value: string): string {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
}

/** Sample game curve time at integer season days; merge only identical daily values. */
export function sampleOowDifficulty(curve: RecordData, lastDay: number): Step[] {
  if (!['RCIM_Linear', 'RCIM_Constant'].includes(curve.InterpMode)) {
    throw new Error(`Unsupported OoW interpolation: ${curve.InterpMode}`);
  }
  const keys: CurveKey[] = curve.Keys;
  if (!Array.isArray(keys) || !keys.length || keys.some((key, index) =>
    !Number.isFinite(key.Time) || !Number.isFinite(key.Value) ||
    (index > 0 && key.Time <= keys[index - 1].Time))) {
    throw new Error('Invalid OoW curve keys');
  }
  if (!Number.isInteger(lastDay) || lastDay < 1) throw new Error('Invalid OoW season duration');
  const steps: Step[] = [];
  for (let day = 1; day <= lastDay; day++) {
    let value = keys[0].Value;
    if (day < keys[0].Time && curve.PreInfinityExtrap !== 'RCCE_Constant') {
      throw new Error('Unsupported OoW pre-infinity extrapolation');
    }
    if (day > keys[keys.length - 1].Time && curve.PostInfinityExtrap !== 'RCCE_Constant') {
      throw new Error('Unsupported OoW post-infinity extrapolation');
    }
    for (let index = 0; index < keys.length; index++) {
      const current = keys[index];
      if (day < current.Time) break;
      value = current.Value;
      const next = keys[index + 1];
      if (next && day < next.Time) {
        if (curve.InterpMode === 'RCIM_Linear') {
          value += (next.Value - current.Value) * (day - current.Time) / (next.Time - current.Time);
        }
        break;
      }
    }
    // Remove floating-point noise, without rounding game percentages to integers.
    const pct = Number(value.toFixed(8));
    const previous = steps[steps.length - 1];
    if (previous?.pct === pct) {
      previous.endDay = day;
      previous.durationDays++;
    } else {
      steps.push({ startDay: day, endDay: day, durationDays: 1, pct, multiplier: pct / 100 });
    }
  }
  return steps;
}

/** Exact asset references take precedence over regional filename/name guesses. */
export function createOowDifficultyRestorer(rawRoot?: string) {
  const rounds = rawRoot ? readRows(path.join(rawRoot, roundSource)) : {};
  const seasons = rawRoot ? readRows(path.join(rawRoot, seasonSource)) : {};
  const tables = new Map<string, RecordData>();
  const roundsBySeasonFloor = new Map<string, { row: string; data: RecordData }>();
  for (const [row, data] of Object.entries(rounds) as [string, RecordData][]) {
    roundsBySeasonFloor.set(`${data.OriginSeasonID}:${data.OriginRound}`, { row, data });
  }

  return (season: RecordData): RecordData => {
    const rawSeason = seasons[String(season.season)];
    const startDate = rawSeason ? dateOnly(rawSeason.SeasonBeginTime) : season.startDate;
    const endDate = rawSeason ? dateOnly(rawSeason.SeasonEndTime) : season.endDate;
    const lastDay = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
    const floors = (season.floors || []).map((floor: RecordData) => {
      const round = roundsBySeasonFloor.get(`${season.season}:${floor.floor}`);
      let difficultySchedule: RecordData;
      try {
        if (!rawRoot || !rawSeason || !round) throw new Error('Raw OoW season/round source unavailable');
        const reference = round.data.MonsterStrength;
        const objectPath = reference?.CurveTable?.ObjectPath;
        const rowName = reference?.RowName;
        if (typeof objectPath !== 'string' || typeof rowName !== 'string') {
          throw new Error('Missing OoW MonsterStrength asset reference');
        }
        const sourcePath = objectPath.replace(/\.\d+$/, '') + '.json';
        const sourceFile = path.resolve(rawRoot, sourcePath);
        const relative = path.relative(path.resolve(rawRoot), sourceFile);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid OoW curve path');
        if (!tables.has(sourcePath)) tables.set(sourcePath, readRows(sourceFile));
        const curve = tables.get(sourcePath)?.[rowName];
        if (!curve) throw new Error(`Missing OoW curve row: ${sourcePath}#${rowName}`);
        const steps = sampleOowDifficulty(curve, lastDay);
        const keys: CurveKey[] = curve.Keys;
        const finalPct = keys[keys.length - 1].Value;
        difficultySchedule = {
          curveTable: reference.CurveTable.ObjectName,
          sourcePath,
          roundSource,
          roundRow: round.row,
          rowName,
          interpMode: curve.InterpMode,
          initialPct: steps[0].pct,
          finalPct,
          daysToMin: steps.find((step) => step.pct === finalPct)?.startDay ?? null,
          unlockDay: floor.difficultySchedule?.unlockDay ?? 1,
          // This coefficient describes the imported enemy-stat snapshot, not the current day.
          appliedCoefficient: floor.difficultySchedule?.appliedCoefficient ?? null,
          keys: keys.map(({ Time, Value }) => ({ Time, Value })),
          steps,
          diagnosticStatus: 'confirmed',
        };
      } catch (error) {
        difficultySchedule = {
          keys: [], steps: [], initialPct: null, finalPct: null, daysToMin: null,
          unlockDay: floor.difficultySchedule?.unlockDay ?? 1,
          diagnosticStatus: 'unresolved',
          diagnosticReason: error instanceof Error ? error.message : String(error),
        };
      }
      return { ...floor, difficultySchedule };
    });
    return {
      ...season, startDate, endDate,
      ...(rawSeason ? { seasonBeginTime: rawSeason.SeasonBeginTime, seasonEndTime: rawSeason.SeasonEndTime, seasonSource } : {}),
      floors,
      maxDifficulty: Math.max(0, ...floors.map((floor: RecordData) => floor.difficultySchedule.initialPct ?? 0)),
      difficultySummary: {
        ...season.difficultySummary,
        maxDifficulty: Math.max(0, ...floors.map((floor: RecordData) => floor.difficultySchedule.initialPct ?? 0)),
        floors: floors.map((floor: RecordData) => ({
        floor: floor.floor,
        unlockDay: floor.difficultySchedule.unlockDay,
        initialPct: floor.difficultySchedule.initialPct,
        daysToMin: floor.difficultySchedule.daysToMin,
        stepsCount: floor.difficultySchedule.steps.length,
        steps: floor.difficultySchedule.steps,
        })),
      },
    };
  };
}
