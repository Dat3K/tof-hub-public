import { describe, expect, it } from 'vitest';
import { compareRaidDurations, displayRaidDuration, firstRaidResult, globalRaidPlaces, latestRaidBoards, projectRaidRanking, raidNicknameStats, raidSeasonPlaceCounts, type RaidRankingBoard } from './raid-rankings';

const member = (nickname: string, label = '1') => ({nickname, resonance: {label, raw: label, icon: null}});
const board = (names: string[][]): RaidRankingBoard => ({id: 'board', seasonId: 'S16', sourceId: 'capture', capturedAt: '2026-10-26T09:30:31Z', coverage: 'partial',
  scope: {kind: 'region', region: 'AP', serverId: null, serverName: null},
  entries: names.map((names, i) => ({id: `row-${i}`, rank: i + 1, duration: {raw: '00:27:49', milliseconds: 27496}, recordedAt: null, members: names.map(name => member(name))}))});

describe('raid ranking observations', () => {
  it('computes overall places across regions per season before presentation filtering', () => {
    const ap = board([['A'], ['B']]);
    ap.entries.forEach((entry, index) => {entry.id = `AP:${index}`; entry.duration.exactTicks = ['215650000', '220000000'][index];});
    const eu = {...board([['C']]), id: 'EU', scope: {...ap.scope, region: 'EU'}};
    eu.entries[0] = {...eu.entries[0], id: 'EU:0', duration: {raw: '00:21:56', milliseconds: 21562, exactTicks: '215620000'}};
    const older = {...ap, id: 'older', capturedAt: '2026-10-25T00:00:00Z', entries: [{...ap.entries[0], id: 'old:0', duration: {raw: '00:01:00', milliseconds: 1000}}]};
    const anotherSeason = {...eu, seasonId: 'S15', id: 'S15', entries: [{...eu.entries[0], id: 'S15:0'}]};
    const places = globalRaidPlaces([older, ap, eu, anotherSeason]);
    expect([...places.entries()]).toEqual([['EU:0', 1], ['AP:0', 2], ['AP:1', 3], ['S15:0', 1]]);
    expect(ap.entries.map(entry => entry.rank)).toEqual([1, 2]);
    expect(projectRaidRanking(ap, true, 'B').map(entry => places.get(entry.id))).toEqual([3]);
  });
  it('orders identical visible timers using full 64-bit precision, including sub-millisecond differences', () => {
    const a = {raw: '00:27:49', milliseconds: 27496, exactTicks: '274960001'};
    const b = {raw: '00:27:49', milliseconds: 27496, exactTicks: '274969999'};
    expect(compareRaidDurations(a, b)).toBe(-1);
    expect(compareRaidDurations(b, a)).toBe(1);
    expect(compareRaidDurations(a, {...a})).toBe(0);
  });
  it('keeps one stable identity through renamed observations and statistics', () => {
    const input = board([['OldName'], ['NewName']]);
    input.entries.forEach(entry => {entry.members![0].identifier = '12345';});
    expect(projectRaidRanking(input, true).map(entry => entry.members?.length)).toEqual([1, 0]);
    expect(raidNicknameStats([input], 'NewName', '12345')[0].appearances).toBe(2);
  });
  it('shows precision in the game timer without adding trailing zeros or changing historical text', () => {
    expect(displayRaidDuration({raw: '02:28:28', milliseconds: 148288, exactTicks: '1482880000'})).toBe('02:28:288');
    expect(displayRaidDuration({raw: '00:27:49', milliseconds: 27496, exactTicks: '274960001'})).toBe('00:27:4960001');
    expect(displayRaidDuration({raw: '00:29:95', milliseconds: 29950, exactTicks: '299500000'})).toBe('00:29:95');
    expect(displayRaidDuration({raw: '5:46:69', milliseconds: 346690})).toBe('5:46:69');
  });
  it('keeps blank observations with unresolved identities separate in unique view and statistics', () => {
    const input = board([[''], ['']]);
    input.entries.forEach((entry, index) => {entry.members![0].observationId = `source:${index}`;});
    expect(projectRaidRanking(input, true)).toHaveLength(2);
    expect(raidNicknameStats([input], '', undefined, 'source:0')[0].appearances).toBe(1);
  });
  it('keeps best team places/roles and retains compact placeholders for fully repeated teams', () => {
    const input = board([['Alice', 'Bob'], ['Alice', 'Carol'], ['Alice', 'Bob'], ['Dave']]);
    input.entries[1].members![0].resonance!.label = '3';
    const result = projectRaidRanking(input, true);
    expect(result.map(entry => [entry.rank, entry.members?.map(member => member.nickname)])).toEqual([[1, ['Alice', 'Bob']], [2, ['Carol']], [3, []], [4, ['Dave']]]);
    expect(projectRaidRanking(input, true, 'Dave').map(entry => entry.rank)).toEqual([4]);
    expect(result[0].members![0].resonance?.label).toBe('1');
    expect(input.entries[1].members).toHaveLength(2);
  });
  it('deduplicates before search and preserves exact Unicode/whitespace identities', () => {
    const input = board([[' Suica', 'Alice'], ['Suica', 'alice', 'Ａlice'], ['Alice']]);
    expect(projectRaidRanking(input, true, 'alice').map(entry => entry.rank)).toEqual([1, 2]);
    expect(projectRaidRanking(input, true).flatMap(entry => entry.members!).map(member => member.nickname)).toEqual([' Suica', 'Alice', 'Suica', 'alice', 'Ａlice']);
    expect(projectRaidRanking(input, true, 'Suica')).toHaveLength(2);
  });
  it('preserves unknown rosters and never reconstructs missing first place', () => {
    const input = board([['Alice']]); input.entries[0].members = null;
    expect(projectRaidRanking(input, true)[0].members).toBeNull();
    expect(projectRaidRanking(input, true, 'Alice')).toEqual([]);
    input.entries[0].rank = 4;
    expect(firstRaidResult(input)).toBeUndefined();
  });
  it('uses one whole snapshot and never mixes seasons/scopes', () => {
    const old = board([['Alice']]);
    const newer = {...board([['Bob']]), id: 'new', capturedAt: '2026-10-26T10:00:00Z'};
    const otherRegion = {...old, id: 'EU', scope: {...old.scope, region: 'EU'}};
    const otherSeason = {...old, id: 'S15', seasonId: 'S15'};
    expect(latestRaidBoards([old, newer, otherRegion, otherSeason]).map(item => item.id)).toEqual(['new', 'EU', 'S15']);
  });
  it('counts one appearance per team, using disjoint place ranges and raw data regardless of unique view', () => {
    const input = board([['Alice', 'Alice'], ['Alice'], ['Alice'], ['Alice']]);
    input.entries.forEach((entry, i) => { entry.rank = [4, 9, 26, 101][i]; });
    const result = raidNicknameStats([input], 'Alice')[0];
    expect(result).toMatchObject({bestRank: 4, appearances: 4, places1To8: 1, places9To24: 1, places25To100: 1, outside100: 1});
    expect(result.resonanceCounts).toEqual({'1': 4});
    projectRaidRanking(input, true);
    expect(raidNicknameStats([input], 'Alice')).toEqual([result]);
    expect(raidNicknameStats([input], 'alice')).toEqual([]);
  });
  it('counts each season once in its best disjoint regional range', () => {
    const rows = [{seasonId: 'S1', bestRank: 4}, {seasonId: 'S1', bestRank: 14}, {seasonId: 'S2', bestRank: 9}, {seasonId: 'S3', bestRank: 26}, {seasonId: 'S4', bestRank: 101}];
    expect(raidSeasonPlaceCounts(rows)).toEqual({places1To8: 1, places9To24: 1, places25To100: 1, outside100: 1});
  });
  it('puts places 24 and 25 into different title ranges, including all boundary places', () => {
    const ranks = [1, 8, 9, 24, 25, 100, 101];
    const input = board(ranks.map(() => ['Alice']));
    input.entries.forEach((entry, i) => {entry.rank = ranks[i];});
    expect(raidNicknameStats([input], 'Alice')[0]).toMatchObject({
      places1To8: 2, places9To24: 2, places25To100: 2, outside100: 1,
    });
    expect(raidSeasonPlaceCounts(ranks.map((bestRank, i) => ({seasonId: `S${i + 1}`, bestRank})))).toEqual({
      places1To8: 2, places9To24: 2, places25To100: 2, outside100: 1,
    });
  });
  it('retains the resonance of the best regional result separately from all appearances', () => {
    const input = board([['Alice'], ['Alice'], ['Alice']]);
    input.entries.forEach((entry, index) => {entry.rank = [9, 2, 4][index]; entry.members![0].resonance!.label = ['3', '2', '1'][index];});
    const stats = raidNicknameStats([input], 'Alice')[0];
    expect(stats.appearances).toBe(3);
    expect(stats.resonanceCounts).toEqual({'1': 1, '2': 1, '3': 1});
    expect(stats.bestEntryId).toBe('row-1');
    expect(stats.bestResonance).toBe('2');
  });
  it('retains known historical results when a newer partial response is empty', () => {
    const history = {...board([['Alice']]), coverage: 'summary' as const, capturedAt: null};
    const empty = {...board([]), id: 'empty'};
    expect(latestRaidBoards([history, empty])).toEqual([history]);
    expect(latestRaidBoards([empty, history])).toEqual([history]);
    expect(latestRaidBoards([history, {...empty, coverage: 'complete'}])[0].id).toBe('empty');
  });
  it('prefers a roster over a same-date summary and keeps PS regional scopes separate', () => {
    const summary = {...board([['Alice']]), capturedAt: null}; summary.entries[0].members = null;
    const roster = {...board([['Alice']]), capturedAt: null, id: 'roster'};
    expect(latestRaidBoards([summary, roster])).toEqual([roster]);
    const eu = {...roster, scope: {...roster.scope, region: 'PS', subregion: 'EU'}};
    const na = {...roster, id: 'ps-na', scope: {...roster.scope, region: 'PS', subregion: 'NA'}};
    expect(latestRaidBoards([eu, na])).toHaveLength(2);
  });
});
