import {describe,expect,it,vi} from 'vitest';
import {TestAccountsService,testObservationInterval,canonicalTestDistribution} from './test-accounts.service';
import {scanFixture} from '../import/scan-session.fixture';

describe('test participation intervals',()=>{
  const uid='1302104471',importedAt=new Date('2026-10-11T12:00:00Z'),scan={...scanFixture(),distribution:'global-pioneer' as const};
  it('prefers individual first/last times, retaining both endpoints and their provenance',()=>{
    const row={uid,scan,firstSeenAt:'2026-10-10T20:49:33.096Z',lastSeenAt:'2026-10-10T20:54:53.592Z'};
    expect(testObservationInterval(row,importedAt)).toEqual({firstAt:new Date(row.firstSeenAt),lastAt:new Date(row.lastSeenAt),firstSource:'observation',lastSource:'observation'});
    expect(testObservationInterval({...row,lastSeenAt:null},importedAt)?.lastAt).toEqual(new Date(row.firstSeenAt));
  });
  it('falls back through capture, scan and import and rejects reversed boundaries',()=>{
    expect(testObservationInterval({uid,capturedAt:'2026-10-10T15:00:00Z'},importedAt)?.firstSource).toBe('observation');
    expect(testObservationInterval({uid,scan},importedAt)?.firstSource).toBe('scan');
    expect(testObservationInterval({uid,lastSeenAt:'invalid'},importedAt)).toMatchObject({firstAt:importedAt,lastAt:importedAt,firstSource:'import',lastSource:'import'});
    expect(testObservationInterval({uid,firstSeenAt:'2026-10-11T12:00:00Z',lastSeenAt:'2026-10-10T12:00:00Z'},importedAt)).toBeNull();
    expect(canonicalTestDistribution('legacy-korea-dev')).toBe('korea-dev');
  });
  it('ignores live or unidentified UIDs without touching storage',async()=>{
    const prisma={$transaction:vi.fn()},service=new TestAccountsService(prisma as never);
    expect(await service.observe([{uid,scan:scanFixture('live')},{uid:'invalid',scan}])).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('loads the page in one query, deduplicates UID/client rows and preserves unknown legacy dates',async()=>{
    const query=vi.fn().mockResolvedValue([{uid,distribution:'global-pioneer',first_seen_at:new Date('2026-10-10'),last_seen_at:new Date('2026-10-11'),first_time_source:'observation',last_time_source:'observation'},
      {uid,distribution:'korea-dev',first_seen_at:null,last_seen_at:null},{uid,distribution:'korea-dev',first_seen_at:null,last_seen_at:null}]);
    const service=new TestAccountsService({$queryRaw:query} as never);
    expect((await service.forUids([uid,uid,null])).get(uid)).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(1);
    expect((await service.forUids([])).size).toBe(0);expect(query).toHaveBeenCalledTimes(1);
  });
});
