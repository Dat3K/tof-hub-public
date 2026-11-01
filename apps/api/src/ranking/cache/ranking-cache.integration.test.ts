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
  it('continues serving PostgreSQL results with Redis disconnected',async()=>{
    await cache.onModuleDestroy();
    expect(await cache.getOrCompute(query,async()=>({available:true,entries:[],total:3}))).toMatchObject({total:3});
  });
});
