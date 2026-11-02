/** Preserve the historical name observation even when a stable participant ID is known. */
export interface RaidRankingMember {
  nickname: string;
  /** Packet RoleID, or an explicitly authorized offline historical identity match. */
  identifier?: string;
  identifierEvidence?: 'packet' | 'exact-name-once' | 'normalized-name-once' | 'owner-confirmed';
  nicknameStatus?: 'blank' | 'unreadable';
  /** Keeps unidentified blank observations distinct; this is never an account identifier. */
  observationId?: string;
  resonance: { label: string; icon: string | null; raw: string | null } | null;
}

export interface RaidRankingEntry {
  id: string;
  rank: number;
  duration: { raw: string; milliseconds: number | null; exactTicks?: string };
  /** Preserve the source clock text when its timezone is unknown. */
  recordedAt: string | null;
  /** null means unavailable; [] is an observed empty roster. */
  members: RaidRankingMember[] | null;
  raw?: Record<string, string | number>;
}

export interface RaidRankingBoard {
  id: string;
  seasonId: string;
  sourceId: string;
  scope: { kind: 'region' | 'server'; region: string; subregion?: string; serverId: string | null; serverName: string | null };
  coverage: 'summary' | 'partial' | 'complete';
  capturedAt: string | null;
  entries: RaidRankingEntry[];
  /** Runtime index: the first place stays inline; the complete observation is an immutable detail shard. */
  _detail?: string;
  entryCount?: number;
  raw?: Record<string, string | number | null>;
}

export interface RaidRankingDataset {
  schemaVersion: 1;
  resonances?: {value: string; roleId: string; name: {en: string; ru: string; [language: string]: string}; icon: string | null}[];
  sources: { id: string; kind: 'community' | 'capture'; method?: 'ocr'; title: string; url: string | null; author: string | null; observedAt: string; sha256: string }[];
  seasons: { id: string; label: string; bossLabel: string | null; raidId: string | null; raidJoin: 'unique-boss-name' | 'documented-season' | 'unresolved' }[];
  boards: RaidRankingBoard[];
}

/** Search selects complete teams. Without a search, unique view retains the first appearance of each player. */
export function projectRaidRanking(board: RaidRankingBoard, unique: boolean, query = '', identifiers?: ReadonlySet<string>): RaidRankingEntry[] {
  const seen = new Set<string>();
  const search = query.trim().normalize('NFKC').toLocaleLowerCase();
  const result: RaidRankingEntry[] = [];
  for (const entry of [...board.entries].sort((a, b) => a.rank - b.rank)) {
    let members = entry.members;
    if (search || identifiers?.size) {
      if (!members?.some(member => member.identifier && identifiers?.has(member.identifier)
        || search && member.nickname.normalize('NFKC').toLocaleLowerCase().includes(search))) continue;
      result.push({...entry, members});
      continue;
    }
    if (members && unique) {
      members = members.filter(member => {
        const key = member.identifier ? `role:${member.identifier}` : member.observationId ? `observation:${member.observationId}` : `name:${member.nickname}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    result.push({ ...entry, members });
  }
  return result;
}

/** The source's first place, not the fastest row reconstructed from partial data. */
export function firstRaidResult(board: RaidRankingBoard): RaidRankingEntry | undefined {
  return board.entries.find(entry => entry.rank === 1);
}

/** 100 ns source values remain integers; display truncation never participates in ordering. */
export function compareRaidDurations(a: RaidRankingEntry['duration'], b: RaidRankingEntry['duration']): number {
  const ticks = (value: RaidRankingEntry['duration']) => value.exactTicks !== undefined ? BigInt(value.exactTicks)
    : value.milliseconds === null ? null : BigInt(value.milliseconds) * 10000n;
  const left = ticks(a), right = ticks(b);
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function preciseRaidDuration(value: RaidRankingEntry['duration']): string {
  const ticks = value.exactTicks !== undefined ? BigInt(value.exactTicks) : value.milliseconds === null ? null : BigInt(value.milliseconds) * 10000n;
  if (ticks === null) return value.raw;
  const fraction = (ticks % 10000000n).toString().padStart(7, '0').replace(/0+$/, '');
  return `${ticks / 10000000n}${fraction ? `.${fraction}` : ''} s`;
}

/** Keep the game's M:SS:CC notation and append the source precision below a hundredth. */
export function displayRaidDuration(value: RaidRankingEntry['duration']): string {
  if (value.exactTicks === undefined) return value.raw;
  const ticks = BigInt(value.exactTicks);
  const tail = (ticks % 100000n).toString().padStart(5, '0').replace(/0+$/, '');
  return `${value.raw}${tail}`;
}

/** Select one observation per season/scope; never merge entries from different snapshots. */
export function latestRaidBoards(boards: RaidRankingBoard[]): RaidRankingBoard[] {
  const selected = new Map<string, RaidRankingBoard>();
  for (const board of boards) {
    const key = JSON.stringify([board.seasonId, board.scope.kind, board.scope.region, board.scope.subregion, board.scope.serverId]);
    const previous = selected.get(key);
    // An empty partial response does not invalidate a previously observed result.
    if (previous?.entries.length && board.coverage === 'partial' && !board.entries.length) continue;
    if (board.entries.length && previous?.coverage === 'partial' && !previous.entries.length) {
      selected.set(key, board);
      continue;
    }
    const richerAtSameTime = previous && board.capturedAt === previous.capturedAt
      && board.entries.some(entry => entry.members?.length) && !previous.entries.some(entry => entry.members?.length);
    if (!previous || richerAtSameTime || (board.capturedAt ?? '') > (previous.capturedAt ?? '')) selected.set(key, board);
  }
  return [...selected.values()];
}

/** Site-wide places in the known archive, computed before region/search/unique presentation filters. */
export function globalRaidPlaces(boards: RaidRankingBoard[]): Map<string, number> {
  const seasons = new Map<string, {board: RaidRankingBoard; entry: RaidRankingEntry}[]>();
  for (const board of latestRaidBoards(boards)) {
    if (board.scope.kind !== 'region') continue;
    const rows = seasons.get(board.seasonId) ?? [];
    rows.push(...board.entries.map(entry => ({board, entry})));
    seasons.set(board.seasonId, rows);
  }
  const places = new Map<string, number>();
  for (const rows of seasons.values()) {
    rows.sort((a, b) => compareRaidDurations(a.entry.duration, b.entry.duration)
      || a.board.scope.region.localeCompare(b.board.scope.region)
      || (a.board.scope.subregion ?? '').localeCompare(b.board.scope.subregion ?? '')
      || a.entry.rank - b.entry.rank || a.entry.id.localeCompare(b.entry.id));
    rows.forEach(({entry}, index) => places.set(entry.id, index + 1));
  }
  return places;
}

export interface RaidNicknameStats {
  boardId: string; seasonId: string; scope: RaidRankingBoard['scope'];
  bestRank: number; appearances: number;
  /** One resonance observation per matching team; keys retain source labels. */
  resonanceCounts: Record<string, number>;
  bestEntryId: string;
  bestResonance: string;
  /** Disjoint title place ranges; observed appearances do not establish final reward eligibility. */
  places1To8: number; places9To24: number; places25To100: number; outside100: number;
}

/** One appearance per team containing the identity (exact name fallback), independent of display deduplication. */
export function raidNicknameStats(boards: RaidRankingBoard[], nickname: string, identifier?: string, observationId?: string): RaidNicknameStats[] {
  const matches = (member: RaidRankingMember) => identifier ? member.identifier === identifier : observationId ? member.observationId === observationId : member.nickname === nickname;
  return latestRaidBoards(boards).flatMap(board => {
    const entries = board.entries.filter(entry => entry.members?.some(matches));
    if (!entries.length) return [];
    const resonances = new Map<string, number>();
    for (const entry of entries) {
      const label = entry.members?.find(matches)?.resonance?.label ?? 'unknown';
      resonances.set(label, (resonances.get(label) ?? 0) + 1);
    }
    const best = entries.reduce((best, entry) => entry.rank < best.rank || entry.rank === best.rank && compareRaidDurations(entry.duration, best.duration) < 0 ? entry : best);
    return [{boardId: board.id, seasonId: board.seasonId, scope: board.scope,
      bestRank: Math.min(...entries.map(entry => entry.rank)), appearances: entries.length,
      resonanceCounts: Object.fromEntries(resonances),
      bestEntryId: best.id, bestResonance: best.members?.find(matches)?.resonance?.label ?? 'unknown',
      places1To8: entries.filter(entry => entry.rank <= 8).length,
      places9To24: entries.filter(entry => entry.rank >= 9 && entry.rank <= 24).length,
      places25To100: entries.filter(entry => entry.rank >= 25 && entry.rank <= 100).length,
      outside100: entries.filter(entry => entry.rank > 100).length}];
  });
}

/** A season belongs to one disjoint band, determined by its best regional place. */
export function raidSeasonPlaceCounts(stats: readonly Pick<RaidNicknameStats, 'seasonId' | 'bestRank'>[]) {
  const best = new Map<string, number>();
  for (const row of stats) best.set(row.seasonId, Math.min(best.get(row.seasonId) ?? Infinity, row.bestRank));
  const counts = {places1To8: 0, places9To24: 0, places25To100: 0, outside100: 0};
  for (const rank of best.values()) {
    if (rank <= 8) counts.places1To8++;
    else if (rank <= 24) counts.places9To24++;
    else if (rank <= 100) counts.places25To100++;
    else counts.outside100++;
  }
  return counts;
}
