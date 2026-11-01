import type { GearTopEntry, PlayerTopEntry, RankingResponse } from './types';

type BoardResponse = RankingResponse<GearTopEntry | PlayerTopEntry>;
const TTL_MS = 60_000, MAX_BOARDS = 12, MAX_ROWS = 600;

/** A row budget matters: twelve accumulated infinite boards can be much larger than twelve first pages. */
export class RankingResponseCache {
  private readonly entries = new Map<string, { at: number; response: BoardResponse }>();
  private prune(now: number) {
    for (const [key, entry] of this.entries) if (now - entry.at >= TTL_MS) this.entries.delete(key);
  }
  get(key: string): BoardResponse | null {
    this.prune(Date.now());
    const hit = this.entries.get(key);
    if (!hit) return null;
    this.entries.delete(key); this.entries.set(key, hit);
    return hit.response;
  }
  set(key: string, response: BoardResponse) {
    this.prune(Date.now());
    const at = this.entries.get(key)?.at ?? Date.now();
    this.entries.delete(key);
    // The active board still displays all loaded rows; oversized lists are simply not retained after leaving it.
    if (response.entries.length > MAX_ROWS) return;
    this.entries.set(key, { at, response });
    let rows = [...this.entries.values()].reduce((sum, entry) => sum + entry.response.entries.length, 0);
    while (rows > MAX_ROWS || this.entries.size > MAX_BOARDS) {
      const oldest = this.entries.keys().next().value!;
      rows -= this.entries.get(oldest)!.response.entries.length;
      this.entries.delete(oldest);
    }
  }
  clear() { this.entries.clear(); }
}
