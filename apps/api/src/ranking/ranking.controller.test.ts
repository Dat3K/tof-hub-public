import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {ForbiddenException} from '@nestjs/common';
import {RankingController} from './ranking.controller';

describe('RankingController cache/status security', () => {
  let controller: RankingController;
  let mockRanking: any;
  let mockInspect: any;
  let mockCache: any;
  let mockWarmup: any;
  const originalEnv = {...process.env};

  beforeEach(() => {
    mockRanking = {};
    mockInspect = {};
    mockCache = {
      getMetrics: vi.fn().mockResolvedValue({connected: true, revision: '10', keysCount: 15}),
      bumpRevision: vi.fn().mockResolvedValue('11'),
    };
    mockWarmup = {
      getLastSummary: vi.fn().mockReturnValue({planned: 10, warmed: 10, revision: '10'}),
      triggerWarmup: vi.fn().mockResolvedValue(null),
    };
    controller = new RankingController(mockRanking, mockInspect, mockCache, mockWarmup);
  });

  afterEach(() => {
    process.env = {...originalEnv};
  });

  it('allows access in development mode without admin key', async () => {
    process.env.NODE_ENV = 'development';
    const status = await controller.cacheStatus();
    expect(status.connected).toBe(true);
    expect(status.revision).toBe('10');
    expect(status.lastWarmup?.planned).toBe(10);
  });

  it('throws ForbiddenException in production mode if no key provided', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RANKING_CACHE_STATUS_KEY = 'secret-token-123456';
    await expect(controller.cacheStatus()).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException in production mode if wrong key provided', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RANKING_CACHE_STATUS_KEY = 'secret-token-123456';
    await expect(controller.cacheStatus('wrong-token')).rejects.toThrow(ForbiddenException);
  });

  it('allows access in production mode with matching x-admin-key header', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RANKING_CACHE_STATUS_KEY = 'secret-token-123456';
    const status = await controller.cacheStatus('secret-token-123456');
    expect(status.connected).toBe(true);
    expect(status.revision).toBe('10');
  });

  it('forces on-demand warmup through POST', async () => {
    process.env.NODE_ENV = 'development';
    await controller.warmupCache(undefined,{mode:'full'});
    expect(mockWarmup.triggerWarmup).toHaveBeenCalledWith('manual-api','full',true);
  });

  it('status never mutates ranking data', async () => {
    process.env.NODE_ENV = 'development';
    await controller.cacheStatus();
    expect(mockCache.bumpRevision).not.toHaveBeenCalled();
  });
});
