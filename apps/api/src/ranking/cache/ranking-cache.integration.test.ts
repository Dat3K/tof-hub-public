import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import Redis from 'ioredis';
import {RankingCacheService} from './ranking-cache.service';
import type {RankingQuery} from '../ranking.service';

describe.skipIf(!process.env.RANKING_REDIS_TEST_URL)('Ranking with a real isolated Redis',()=>{
  let cache:RankingCacheService,control:Redis,revision=String(Date.now());
  const query:RankingQuery={track:'all',role:'dps',limit:100};
  beforeAll(async()=>{
    vi.stubEnv('REDIS_URL',process.env.RANKING_REDIS_TEST_URL!);
    control=new Redis(process.env.REDIS_URL!,{maxRetriesPerRequest:1});
    cache=new RankingCacheService({scoringRevision:{findUnique:async()=>({fingerprint:revision})}} as never);
    await cache.onModuleInit();
    expect(cache.isReady()).toBe(true);
  });
  afterAll(async()=>{await cache?.onModuleDestroy();await control?.quit();vi.unstubAllEnvs();});
  it('writes expiring results, hits Redis, and follows the PostgreSQL revision',async()=>{
    const compute=vi.fn(async()=>({available:true,entries:[],total:1}));
    await cache.getOrCompute(query,compute);await cache.getOrCompute(query,compute);
    expect(compute).toHaveBeenCalledOnce();
    expect(await control.ttl(cache.buildCacheKey(query,revision))).toBeGreaterThan(0);
    revision=String(BigInt(revision)+1n);
    await control.set('ranking:players:revision','obsolete');
    await cache.getOrCompute(query,compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect((await cache.getMetrics()).hits).toBeGreaterThan(0);
  });
  it('forces daily refresh and retains one small Pioneer snapshot key',async()=>{
    const compute=vi.fn(async()=>({available:true,entries:[],total:2}));
    await cache.getOrCompute(query,compute,{refresh:true});
    expect(compute).toHaveBeenCalledOnce();
    const key=cache.pioneerKey(query);
    await cache.getSnapshot(key,revision,compute);
    await cache.getSnapshot(key,revision,compute);
    expect(compute).toHaveBeenCalledTimes(2);
    await cache.getSnapshot(key,revision,compute,{refresh:true});
    expect(compute).toHaveBeenCalledTimes(3);
    expect(await control.ttl(key)).toBeGreaterThan(3600);
  });
  it('caches gear in separate expiring keys, including the selected slot',async()=>{
    const compute=vi.fn(async()=>({available:true,entries:[{kind:'gear'}]}));
    await cache.getOrCompute(query,compute,{board:'gear'});
    await cache.getOrCompute(query,compute,{board:'gear'});
    expect(compute).toHaveBeenCalledOnce();
    const slot={...query,slot:'helmet'};
    await cache.getOrCompute(slot,compute,{board:'gear'});
    expect(compute).toHaveBeenCalledTimes(2);
    expect(await control.ttl(cache.buildCacheKey(slot,revision,'gear'))).toBeGreaterThan(0);
    expect((await cache.getMetrics()).gearKeysCount).toBe(2);
    revision=String(BigInt(revision)+1n);
    await cache.getOrCompute(query,compute,{board:'gear'});
    expect(compute).toHaveBeenCalledTimes(3);
  });
  it('shares verified results between independent API clients and separates each public board filter',async()=>{
    const visitor=new RankingCacheService({scoringRevision:{findUnique:async()=>({fingerprint:revision})}} as never);
    await visitor.onModuleInit();
    try {
      for(const board of ['players','gear'] as const) for(const role of ['dps','healer','tank'] as const) {
        const filtered={...query,role,verified:true,sort:'cs' as const,places:'global' as const};
        const compute=vi.fn(async()=>({available:true,entries:[{board,role}]}));
        await cache.getOrCompute(filtered,compute,{board});
        expect(await visitor.getOrCompute(filtered,compute,{board})).toMatchObject({entries:[{board,role}]});
        expect(compute).toHaveBeenCalledOnce();
        const key=cache.buildCacheKey(filtered,revision,board);
        expect(await control.ttl(key)).toBeGreaterThan(0);
        expect(await control.get(key)).not.toBeNull();
        expect(key).not.toBe(cache.buildCacheKey({...filtered,verified:false},revision,board));
      }
    } finally {await visitor.onModuleDestroy();}
  },15_000);
  it('stores both raid identity bindings with expiry and rechecks a renamed player after an import revision',async()=>{
    const entry={identifier:'123',uid:'456',nickname:'Before',observedAt:'2026-11-02T00:00:00.000Z'};
    const compute=vi.fn(async()=>({available:true,entries:[entry]}));
    await cache.getPlayerIdentities(['123'],[],compute);
    expect(await cache.getPlayerIdentities([],['456'],compute)).toMatchObject({entries:[entry]});
    expect(compute).toHaveBeenCalledOnce();
    for(const key of ['role:123','uid:456']) {
      const name=`ranking:identities:s1:v${revision}:${key}`;
      expect(JSON.parse((await control.get(name))!).entries[0]).toEqual(entry);
      expect(await control.ttl(name)).toBeGreaterThan(0);
    }
    revision=String(BigInt(revision)+1n);
    const renamed={...entry,nickname:'After'};
    expect(await cache.getPlayerIdentities(['123'],[],async()=>({available:true,entries:[renamed]}))).toMatchObject({entries:[renamed]});
    expect(await cache.getPlayerIdentities([],['456'],compute)).toMatchObject({entries:[renamed]});
  });
  it('continues serving PostgreSQL results with Redis disconnected',async()=>{
    await cache.onModuleDestroy();
    expect(await cache.getOrCompute(query,async()=>({available:true,entries:[],total:3}))).toMatchObject({total:3});
  });
});
