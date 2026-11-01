import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteWishRepository } from '../adapters/sqlite-wish-repository';
import { WishService } from '../wish.service';

describe('WishService and SqliteWishRepository', () => {
  let tmpDir: string;
  let dbPath: string;
  let repo: SqliteWishRepository;
  let service: WishService;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tof-wish-test-'));
    dbPath = path.join(tmpDir, 'test-wish.sqlite');
    repo = new SqliteWishRepository(dbPath);
    await repo.init();
    service = new WishService(repo);
  });

  afterEach(async () => {
    await repo.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it('seeds demo data idempotently without duplicate records', async () => {
    await service.seedDemoIfEmpty();

    const banners = await service.getBanners();
    expect(banners.length).toBe(2);

    const initialPulls = await service.getPulls({ profileId: 'demo', limit: 1000 });
    // 248 weapon + 120 matrix = 368 total pulls
    expect(initialPulls.total_count).toBe(368);
    expect(initialPulls.items.length).toBe(368);

    // Re-running seed must NOT duplicate records
    await service.seedDemoIfEmpty();

    const pullsAfterSecondSeed = await service.getPulls({ profileId: 'demo', limit: 1000 });
    expect(pullsAfterSecondSeed.total_count).toBe(368);
  });

  it('computes accurate profile summary on seeded demo data', async () => {
    await service.seedDemoIfEmpty();

    const summary = await service.getProfileSummary('demo');
    expect(summary.total_pulls).toBe(368);
    expect(summary.weapon_pulls).toBe(248);
    expect(summary.matrix_pulls).toBe(120);

    // Weapon hard pity state: 248 total, SSR on 240, so pity is 8 / 80
    expect(summary.current_weapon_pity).toBe(8);
    expect(summary.weapon_ssr_count).toBe(5);
    expect(summary.weapon_early_ssr_count).toBe(2);

    // Matrix hard pity state: 120 total (40 hard pity), resets at 120 -> pity is 0
    expect(summary.current_matrix_pity).toBe(0);
    expect(summary.matrix_ssr_count).toBe(4);

    // 4 Matrix slots populated
    expect(summary.matrix_slots.mind).toBeGreaterThanOrEqual(1);
    expect(summary.matrix_slots.memory).toBeGreaterThanOrEqual(1);
    expect(summary.matrix_slots.belief).toBeGreaterThanOrEqual(1);
    expect(summary.matrix_slots.emotion).toBeGreaterThanOrEqual(1);

    // Recent SSR feed is populated
    expect(summary.recent_ssr_feed.length).toBeGreaterThan(0);
  });

  it('supports pagination with cursor and filters', async () => {
    await service.seedDemoIfEmpty();

    // Query first page of 20
    const page1 = await service.getPulls({
      profileId: 'demo',
      bannerType: 'weapon_limited',
      limit: 20,
    });

    expect(page1.items.length).toBe(20);
    expect(page1.next_cursor).not.toBeNull();
    expect(page1.total_count).toBe(248);

    // Query second page using cursor
    const page2 = await service.getPulls({
      profileId: 'demo',
      bannerType: 'weapon_limited',
      cursor: page1.next_cursor!,
      limit: 20,
    });

    expect(page2.items.length).toBe(20);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);

    // Filter by rarity 5 (SSR)
    const ssrPulls = await service.getPulls({
      profileId: 'demo',
      bannerType: 'weapon_limited',
      rarity: 5,
    });
    expect(ssrPulls.items.length).toBe(5);
    expect(ssrPulls.total_count).toBe(5);
  });

  it('calculates personal analytics with correct averages and true 50/50 win rate', async () => {
    await service.seedDemoIfEmpty();

    const analytics = await service.getAnalytics('demo', 'weapon_limited');
    expect(analytics.total_pulls).toBe(248);
    expect(analytics.total_ssr).toBe(5);
    expect(analytics.avg_ssr_interval).toBe(48.0);
    expect(analytics.median_ssr_interval).toBe(57);
    expect(analytics.wins_count).toBe(2);
    expect(analytics.losses_count).toBe(3);
  });

  it('exports valid version 2 import payload', async () => {
    await service.seedDemoIfEmpty();

    const payload = await service.exportProfile('demo');
    expect(payload.version).toBe(2);
    expect(payload.account.uid).toBeDefined();
    expect(payload.batches.length).toBeGreaterThan(0);
  });

  it('rejects unknown or malformed profile ids without leaking data', async () => {
    await service.seedDemoIfEmpty();

    await expect(service.getProfileSummary('no-such-profile')).rejects.toThrow('Profile not found');
    await expect(service.getProfileSummary('import-0123456789abcdef0123456789abcdef')).rejects.toThrow('Profile not found');
    await expect(service.getPulls({ profileId: 'no-such-profile', limit: 20 })).rejects.toThrow('Profile not found');
    await expect(service.getAnalytics('no-such-profile')).rejects.toThrow('Profile not found');
    await expect(service.exportProfile('no-such-profile')).rejects.toThrow('Profile not found');
  });
});
