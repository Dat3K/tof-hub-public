import {describe, expect, it, vi} from 'vitest';
import {RankingCacheService} from './cache/ranking-cache.service';
import {RankingService} from './ranking.service';

function setup() {
  const values = new Map<string, string>();
  const revision = {value: '1'};
  const findMany = vi.fn();
  const prisma = {player: {findMany}, scoringRevision: {findUnique: vi.fn(async () => ({fingerprint: revision.value}))}};
  const cache = new RankingCacheService(prisma as never);
  const redis = {
    mget: vi.fn(async (...keys: string[]) => keys.map(key => values.get(key) ?? null)),
    pipeline: () => {
      const pending: [string, string][] = [];
      const pipeline = {set(key: string, value: string) {pending.push([key, value]); return pipeline;}, async exec() {for (const [key, value] of pending) values.set(key, value); return [];}};
      return pipeline;
    },
  };
  Object.assign(cache, {redis, isConnected: true});
  const service = new RankingService(prisma as never, null, null, cache);
  return {service, cache, values, revision, findMany};
}

const player = {roleId: '123', uid: '456', nickname: 'Current name', lastSeenAt: new Date('2026-10-27T00:00:00Z')};

describe('cached raid identities', () => {
  it('shares role and UID bindings between different request batches without querying player records again', async () => {
    const {service, findMany} = setup();
    findMany.mockResolvedValue([player]);
    expect((await service.currentPlayerNames(['123', '999'])).entries[0].uid).toBe('456');
    expect((await service.currentPlayerNames([], ['456'])).entries[0].identifier).toBe('123');
    expect((await service.currentPlayerNames(['123'])).entries[0].nickname).toBe('Current name');
    expect((await service.currentPlayerNames(['999'])).entries).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('resolves a previously unknown identity after a new profile changes the durable ranking revision', async () => {
    const {service, revision, findMany} = setup();
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([player]);
    expect((await service.currentPlayerNames(['123'])).entries).toEqual([]);
    expect((await service.currentPlayerNames(['123'])).entries).toEqual([]);
    revision.value = '2';
    expect((await service.currentPlayerNames(['123'])).entries[0].uid).toBe('456');
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('shares simultaneous requests and only queries identities missing from Redis', async () => {
    const {service, findMany} = setup();
    findMany.mockResolvedValue([player]);
    await Promise.all([service.currentPlayerNames(['123']), service.currentPlayerNames(['123'])]);
    expect(findMany).toHaveBeenCalledTimes(1);
    findMany.mockResolvedValue([]);
    await service.currentPlayerNames(['123', '789']);
    expect(findMany.mock.calls[1][0].where.roleId.in).toEqual(['789']);
  });

  it('does not reuse cached public profile data after a revision removes that profile', async () => {
    const {service, revision, findMany} = setup();
    findMany.mockResolvedValueOnce([player]).mockResolvedValueOnce([]);
    await service.currentPlayerNames(['123']);
    revision.value = '2';
    expect((await service.currentPlayerNames(['123'])).entries).toEqual([]);
    expect(findMany.mock.calls[1][0].where.hidden).toBe(false);
  });
});
