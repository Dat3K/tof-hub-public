import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {RankingCacheWarmupService,nextDailyWarmup} from './ranking-cache-warmup.service';

describe('RankingCacheWarmupService', () => {
  let warmup: RankingCacheWarmupService;
  let mockCache: any;
  let mockRanking: any;
  let cached: Set<string>;
  const key=(query:any,board='players')=>JSON.stringify({board,...query});

  beforeEach(() => {
    vi.stubEnv('RANKING_WARMUP_MODE','minimal');
    cached=new Set();
    mockCache = {
      isReady:vi.fn().mockReturnValue(true),
      hasSnapshot:vi.fn(async(q:any)=>cached.has(key(q))),
      getRevision: vi.fn().mockResolvedValue('1'),
      canonicalQueryKey: vi.fn().mockImplementation((q) => `${q.role || 'dps'}:${q.track}:${q.region || 'all'}:${q.limit}${q.verified ? ':verified=1' : ''}`),
      get: vi.fn(async(q:any,_revision:string,board='players')=>cached.has(key(q,board))?{available:true,entries:[]}:null),
      recordWarmup: vi.fn(),
    };
    mockRanking = {
      players: vi.fn().mockImplementation(async(q:any)=>{
        cached.add(key(q));
        return {available:true,entries:[]};
      }),
      gear: vi.fn().mockImplementation(async(q:any)=>{
        cached.add(key(q,'gear'));
        return {available:true,entries:[]};
      }),
    };
    warmup = new RankingCacheWarmupService(mockCache, mockRanking);
  });
  afterEach(()=>{warmup.onModuleDestroy();vi.useRealTimers();vi.unstubAllEnvs();});

  it('runs minimal warmup with prioritized queries', async () => {
    process.env.RANKING_WARMUP_MODE = 'minimal';
    const summary = await warmup.triggerWarmup('initial');

    expect(summary).not.toBeNull();
    expect(summary?.planned).toBe(14);
    expect(summary?.warmed).toBe(14);
    expect(summary?.failed).toBe(0);
    expect(mockRanking.players).toHaveBeenCalledWith(expect.objectContaining({track:'all',dataset:'pioneer'}),{refresh:false});
    expect(mockRanking.gear).toHaveBeenCalledExactlyOnceWith({track:'all',role:'dps',limit:100},{refresh:false});
    expect(mockRanking.players.mock.calls.filter(([query]:[any])=>query.verified).map(([query]:[any])=>query)).toEqual([
      {track:'all',role:'dps',limit:50,verified:true},
      {track:'all',role:'dps',limit:100,verified:true},
    ]);
  });

  it('skips already cached queries', async () => {
    process.env.RANKING_WARMUP_MODE = 'minimal';
    cached.add(key({track:'all',role:'dps',limit:50}));
    cached.add(key({track:'all',role:'dps',limit:100}));
    cached.add(key({track:'Physical-Flame',role:'dps',region:'AP',limit:50}));
    const summary = await warmup.triggerWarmup('initial');
    expect(summary?.skipped).toBe(3);
    expect(summary?.warmed).toBe(11);
  });

  it('prevents multiple simultaneous warmups', async () => {
    process.env.RANKING_WARMUP_MODE = 'minimal';
    const promise1 = warmup.triggerWarmup('initial');
    const promise2 = warmup.triggerWarmup('revision-change');

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1).not.toBeNull();
    expect(res2).toBeNull(); // second one skipped
  });

  it('runs full warmup with all tracks and regions', async () => {
    vi.useFakeTimers();
    const pending = warmup.triggerWarmup('manual', 'full');
    await vi.runAllTimersAsync();
    const summary = await pending;
    expect(summary).not.toBeNull();
    expect(summary?.planned).toBeGreaterThan(50);
    expect((summary?.warmed??0)+(summary?.skipped??0)).toBe(summary?.planned);
  });

  it('does not subscribe to imports/revisions and schedules a forced run at 03:01 UTC', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T03:00:59Z'));
    mockCache.setOnRevisionChange=vi.fn();
    const triggerSpy=vi.spyOn(warmup,'triggerWarmup').mockResolvedValue(null);
    warmup.onApplicationBootstrap();
    expect(mockCache.setOnRevisionChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(triggerSpy).toHaveBeenCalledWith('daily-03:01-utc','full',true);
  });

  it('does no work when disabled or disconnected',async()=>{
    mockCache.isReady.mockReturnValue(false);
    expect(await warmup.triggerWarmup()).toBeNull();
    expect(mockRanking.players).not.toHaveBeenCalled();
    mockCache.isReady.mockReturnValue(true);
    vi.stubEnv('RANKING_WARMUP_ENABLED','false');
    expect(await warmup.triggerWarmup()).toBeNull();
  });

  it('forces recomputation even for cached targets',async()=>{
    mockCache.get.mockResolvedValue({available:true,entries:[]});
    mockCache.hasSnapshot.mockResolvedValue(true);
    const summary=await warmup.triggerWarmup('daily','minimal',true);
    expect(summary?.skipped).toBe(0);
    expect(mockRanking.players).toHaveBeenCalledTimes(13);
    expect(mockRanking.players).toHaveBeenCalledWith(expect.anything(),{refresh:true});
    expect(mockRanking.gear).toHaveBeenCalledExactlyOnceWith({track:'all',role:'dps',limit:100},{refresh:true});
  });

  it('uses UTC across day and month boundaries',()=>{
    expect(nextDailyWarmup(new Date('2026-10-31T03:01:00Z')).toISOString()).toBe('2026-11-01T03:01:00.000Z');
    expect(nextDailyWarmup(new Date('2026-10-18T03:00:00Z')).toISOString()).toBe('2026-10-18T03:01:00.000Z');
  });

  it('preserves a forced full run queued behind startup warmup',async()=>{
    vi.useFakeTimers();
    const initial=warmup.triggerWarmup('initial');
    expect(await warmup.triggerWarmup('daily-03:01-utc','full',true)).toBeNull();
    await vi.runAllTimersAsync();
    await initial;
    expect(warmup.getLastSummary()?.planned).toBe(131);
    expect(mockRanking.players.mock.calls.filter(([,options]:[unknown,{refresh:boolean}])=>options.refresh)).toHaveLength(130);
  });
});
