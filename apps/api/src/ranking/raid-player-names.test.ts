import { describe, expect, it, vi } from 'vitest';
import { RankingService } from './ranking.service';
import { RaidCurrentNamesRequestSchema } from '@tof-hub/contracts';

describe('raid current nickname lookup', () => {
  it('looks up exact stable identities in one query and excludes hidden profiles', async () => {
    const findMany = vi.fn().mockResolvedValue([{roleId: '47300474936903', uid: '12345', nickname: 'CurrentName', lastSeenAt: new Date('2026-10-26T10:00:00Z')}]);
    const service = new RankingService({player: {findMany}} as never);
    expect(await service.currentPlayerNames(['47300474936903', '47300474936903'])).toEqual({available: true, entries: [{identifier: '47300474936903', uid: '12345', nickname: 'CurrentName', observedAt: '2026-10-26T10:00:00.000Z'}]});
    expect(findMany).toHaveBeenCalledExactlyOnceWith({where: {roleId: {in: ['47300474936903']}, hidden: false}, select: {roleId: true, uid: true, nickname: true, lastSeenAt: true}});
  });
  it('resolves exact UIDs to stable raid identities, including profiles without a known nickname', async () => {
    const findMany = vi.fn().mockResolvedValue([{roleId: '123', uid: '456', nickname: null, lastSeenAt: new Date('2026-10-26T10:00:00Z')}]);
    const service = new RankingService({player: {findMany}} as never);
    expect(await service.currentPlayerNames([], ['456', '456'])).toEqual({available: true, entries: [{identifier: '123', uid: '456', nickname: '', observedAt: '2026-10-26T10:00:00.000Z'}]});
    expect(findMany.mock.calls[0][0].where).toEqual({hidden: false, roleId: {not: null}, OR: [{uid: {in: ['456']}}]});
  });
  it('distinguishes unavailable storage from a known empty result', async () => {
    expect(await new RankingService().currentPlayerNames(['123'])).toEqual({available: false, entries: []});
    const findMany = vi.fn();
    expect(await new RankingService({player: {findMany}} as never).currentPlayerNames([])).toEqual({available: true, entries: []});
    expect(findMany).not.toHaveBeenCalled();
  });
  it('bounds public batches and refuses invalid/overflowing identities', () => {
    for (const identifiers of [['name'], ['0'], ['18446744073709551616'], Array(501).fill('123')]) expect(RaidCurrentNamesRequestSchema.safeParse({identifiers}).success).toBe(false);
    for (const uids of [['name'], ['0'], Array(501).fill('123')]) expect(RaidCurrentNamesRequestSchema.safeParse({identifiers: [], uids}).success).toBe(false);
    expect(RaidCurrentNamesRequestSchema.safeParse({identifiers: Array(500).fill('123'), uids: ['456']}).success).toBe(false);
  });
});
