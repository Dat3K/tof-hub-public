import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {expect, it} from 'vitest';

const repo = path.resolve(import.meta.dirname, '../../../../../..');
const scratch = path.join(repo, 'ignore', 'sequential-schedule-tests');

it('extracts regional periods without replacing saved combat, base dates or source hashes', () => {
  fs.mkdirSync(scratch, {recursive: true});
  const directory = fs.mkdtempSync(path.join(scratch, 'case-'));
  try {
    const raw = path.join(directory, 'raw'), publicDir = path.join(directory, 'public');
    const write = (file: string, data: unknown) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(data));};
    const input = {schemaVersion: 1, sources: {combat: {sha256: 'unchanged'}}, seasons: [
      {id: 'Activity1', start: {year: 2020}, end: {year: 2021}, levels: [{id: 'level', waves: [{hp: 123}]}]},
      {id: 'older-only-row', levels: []},
    ]};
    const output = path.join(publicDir, 'game-data/handbook/biochemical-collapse.json');
    write(output, input);
    write(path.join(raw, 'Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OptionalBossDataAsset_MMO.json'), [{
      Name: 'OptionalBossDataAsset_MMO', Properties: {ActivityConfigDataTable_BalanceServer: {AssetPathName: '/Game/Test/Calendar.Calendar'}},
    }]);
    const regional = {Year: 2026, Month: 10, Day: 19, Hour: 21, Minute: 0, Second: 0};
    write(path.join(raw, 'Hotta/Content/Test/Calendar.json'), [{Rows: {Activity1: {
      OpenLevels: ['level'], StartDateTime: {Year: 1999}, EndDateTime: {Year: 1999},
      StartDateTime_Region: [{Key: 'fixture-region', Value: regional}],
      EndDateTime_Region: [{Key: 'fixture-region', Value: {...regional, Month: 11, Day: 23}}],
    }}}]);
    const run = (check = false) => execFileSync(process.execPath, [path.join(repo, 'scripts/generators/build-handbook.cjs'), '--biochemical-schedule-only', ...(check ? ['--check'] : [])], {
      cwd: repo, env: {...process.env, TOF_RAW_GAME_DIR: raw, TOF_PUBLIC_DIR: publicDir}, stdio: 'pipe',
    });
    run(); run(true);
    const result = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(result.sources).toEqual(input.sources);
    expect(result.seasons[0].start).toEqual(input.seasons[0].start);
    expect(result.seasons[0].levels).toEqual(input.seasons[0].levels);
    expect(result.seasons[0].regionalPeriods[0]).toEqual({region: 'fixture-region', start: {year: 2026, month: 10, day: 19, hour: 21, minute: 0, second: 0}, end: {year: 2026, month: 11, day: 23, hour: 21, minute: 0, second: 0}});
    expect(result.calendarCoverage.missingActivities).toEqual(['older-only-row']);
    expect(result.seasons[1]).toEqual(input.seasons[1]);
    expect(result.calendarSources['Hotta/Content/Test/Calendar.json'].sha256).toMatch(/^[a-f0-9]{64}$/);
    const beforeMismatch = fs.readFileSync(output, 'utf8');
    write(path.join(raw, 'Hotta/Content/Test/Calendar.json'), [{Rows: {Activity1: {OpenLevels: ['different-lineup']}}}]);
    expect(() => run()).toThrow();
    expect(fs.readFileSync(output, 'utf8')).toBe(beforeMismatch);
  } finally {
    if (!path.resolve(directory).startsWith(scratch + path.sep)) throw new Error('Fixture outside task scratch');
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
