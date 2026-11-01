import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SqliteWishRepository } from '../adapters/sqlite-wish-repository';
import type { WishRecordEntity } from '../entities/wish.entities';

describe('SqliteWishRepository Pagination & Deduplication', () => {
  let repo: SqliteWishRepository;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = path.resolve(process.cwd(), `.test_sqlite_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
    repo = new SqliteWishRepository(testDbPath);
    await repo.init();
  });

  afterEach(async () => {
    await repo.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  it('paginates accurately across identical timestamps without dropping items', async () => {
    await repo.saveProfile({
      id: 'prof_test_page',
      uid: '10001',
      name: 'Tester',
      isDefault: true,
      isDemo: true,
      region: 'global',
      server: '9999001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await repo.saveBanner({
      id: 'weapon-yanmiao',
      name: 'Eternal Bladestorm',
      nameEn: 'Eternal Bladestorm',
      nameRu: 'Бесконечная буря клинков',
      bannerType: 'weapon_limited',
      characterId: 'yanmiao',
      weaponId: 'Killknife_physic',
      pityTarget: 80,
      startDate: '2023-12-21T04:00:00.000Z',
      endDate: '2024-01-08T21:00:00.000Z',
      currency: 'red_nucleus',
      cashbackCurrency: 'flame_gold',
      featuredSsr: ['Killknife_physic'],
      assets: {
        background: '/bg.webp',
        splash: '/splash.webp',
        icon: '/icon.webp',
      },
    });


    const identicalTimestamp = '2023-12-21T12:00:00.000Z';
    const batchRecords: WishRecordEntity[] = [];

    // 10 pulls from the exact same batch sharing identical timestamp
    for (let i = 1; i <= 10; i++) {
      batchRecords.push({
        id: `rec_batch_${i.toString().padStart(3, '0')}`,
        profileId: 'prof_test_page',
        bannerId: 'weapon-yanmiao',
        bannerType: 'weapon_limited',
        itemId: `item_${i}`,
        itemName: `Item ${i}`,
        itemType: 'weapon',
        rarity: i === 10 ? 4 : 3,
        pityCount: i,
        isGuaranteedPity: false,
        isFeatured: false,
        streakOutcome: null,
        pullTimestamp: identicalTimestamp,
        groupTicks: '638308820000000000',
        itemIndex: i - 1,
      });
    }

    const inserted = await repo.insertWishRecords(batchRecords);
    expect(inserted).toBe(10);

    // Page 1 with limit = 5
    const page1 = await repo.getWishRecords({
      profileId: 'prof_test_page',
      limit: 5,
    });

    expect(page1.items.length).toBe(5);
    expect(page1.totalCount).toBe(10);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2 with cursor from Page 1 and limit = 5
    const page2 = await repo.getWishRecords({
      profileId: 'prof_test_page',
      cursor: page1.nextCursor!,
      limit: 5,
    });

    expect(page2.items.length).toBe(5);
    expect(page2.nextCursor).toBeNull();

    // Verify all 10 items were retrieved with no overlap and no omission
    const allIds = [...page1.items.map((r) => r.id), ...page2.items.map((r) => r.id)];
    expect(new Set(allIds).size).toBe(10);
  });
});
