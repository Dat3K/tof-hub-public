import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const entry = {identifier: '123', uid: '456', nickname: 'Current name', observedAt: '2026-10-27T00:00:00.000Z'};
const reply = (entries: unknown[], available = true) => ({ok: true, json: async () => ({available, entries})});

beforeEach(() => {vi.resetModules(); localStorage.clear(); vi.useFakeTimers();});
afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});

describe('browser raid identity cache', () => {
  it('shares a pending bulk request with overlapping hover and toggle lookups', async () => {
    let finish!: (response: ReturnType<typeof reply>) => void;
    const fetch = vi.fn(() => new Promise(resolve => {finish = resolve;}));
    vi.stubGlobal('fetch', fetch);
    const {loadRaidPlayers} = await import('./raid-player-cache');
    const bulk = loadRaidPlayers(['123', '789']);
    const hover = loadRaidPlayers(['123']);
    const toggle = loadRaidPlayers(['789', '123']);
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(reply([entry, {...entry, identifier: '789', uid: '987'}]));
    expect((await hover).entries).toEqual([entry]);
    expect((await bulk).entries).toHaveLength(2);
    expect((await toggle).entries).toHaveLength(2);
  });
  it('bounds concurrent identity requests and releases queued work after a failure', async () => {
    const finish: (() => void)[] = [];
    const fetch = vi.fn((_url: unknown, options: {body: string}) => new Promise(resolve => {
      const identifier = JSON.parse(options.body).identifiers[0];
      finish.push(() => resolve(identifier === '1' ? {ok: false} : reply([{...entry, identifier}])));
    }));
    vi.stubGlobal('fetch', fetch);
    const {loadRaidPlayers} = await import('./raid-player-cache');
    const results = Promise.allSettled(Array.from({length: 5}, (_, index) => loadRaidPlayers([String(index + 1)])));
    expect(fetch).toHaveBeenCalledTimes(4);
    finish.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(5);
    finish.forEach(resolve => resolve());
    expect((await results).map(result => result.status)).toEqual(['rejected', 'fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
  });
  it('shares role/UID results and restores them after a page/module reload', async () => {
    const fetch = vi.fn().mockResolvedValue(reply([entry]));
    vi.stubGlobal('fetch', fetch);
    const {loadRaidPlayers} = await import('./raid-player-cache');
    await loadRaidPlayers(['123']);
    expect((await loadRaidPlayers([], ['456'])).entries).toEqual([entry]);
    await vi.advanceTimersByTimeAsync(50);
    vi.resetModules();
    const restored = await import('./raid-player-cache');
    expect((await restored.loadRaidPlayers(['123'])).entries).toEqual([entry]);
    expect((await restored.loadRaidPlayers([], ['456'])).entries).toEqual([entry]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retains a full 4,000-player archive across repeated bulk toggles', async () => {
    const fetch = vi.fn(async (_url: unknown, options: {body: string}) => reply(JSON.parse(options.body).identifiers.map((identifier: string) => ({...entry, identifier, uid: `9${identifier}`}))));
    vi.stubGlobal('fetch', fetch);
    const {loadRaidPlayers} = await import('./raid-player-cache');
    const batches = Array.from({length: 8}, (_, batch) => Array.from({length: 500}, (_, index) => String(batch * 500 + index + 1)));
    await Promise.all(batches.map(ids => loadRaidPlayers(ids)));
    await vi.advanceTimersByTimeAsync(50);
    await Promise.all(batches.map(ids => loadRaidPlayers(ids)));
    expect(fetch).toHaveBeenCalledTimes(8);
    vi.resetModules();
    const restored = await import('./raid-player-cache');
    await Promise.all(batches.map(ids => restored.loadRaidPlayers(ids)));
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it('refreshes an unknown identity after its short negative-cache lifetime', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply([entry]));
    vi.stubGlobal('fetch', fetch);
    const {loadRaidPlayers} = await import('./raid-player-cache');
    expect((await loadRaidPlayers(['123'])).entries).toEqual([]);
    expect((await loadRaidPlayers(['123'])).entries).toEqual([]);
    await vi.advanceTimersByTimeAsync(15001);
    expect((await loadRaidPlayers(['123'])).entries).toEqual([entry]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not persist a temporarily unavailable identity store as a missing player', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply([], false)).mockResolvedValueOnce(reply([entry]));
    vi.stubGlobal('fetch', fetch);
    const {loadRaidPlayers} = await import('./raid-player-cache');
    expect((await loadRaidPlayers(['123'])).available).toBe(false);
    expect((await loadRaidPlayers(['123'])).entries).toEqual([entry]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
