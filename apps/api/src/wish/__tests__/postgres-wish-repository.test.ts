import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresWishRepository } from '../adapters/postgres-wish-repository';
import type { PrismaClient } from '@prisma/client';
import type { WishProfileEntity, WishBannerEntity } from '../entities/wish.entities';

describe('PostgresWishRepository', () => {
  let mockPrisma: any;
  let repo: PostgresWishRepository;

  beforeEach(() => {
    mockPrisma = {
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      player: { upsert: vi.fn().mockResolvedValue({ id: 'player_1' }) },
      playerName: { upsert: vi.fn().mockResolvedValue({}) },
      wishProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      wishBanner: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      wishRecord: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      wishCashbackTransaction: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    repo = new PostgresWishRepository(mockPrisma as unknown as PrismaClient);
  });

  it('connects and disconnects', async () => {
    await repo.init();
    expect(mockPrisma.$connect).toHaveBeenCalled();

    await repo.close();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
  });

  it('saves and maps profile', async () => {
    const profile: WishProfileEntity = {
      id: 'prof_test',
      uid: '12345',
      name: 'Test Profile',
      isDefault: true,
      isDemo: false,
      region: 'global',
      server: 'Global-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.saveProfile(profile);
    expect(mockPrisma.wishProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prof_test' },
      })
    );
    // Imported histories are linked to the game character and its nickname history.
    expect(mockPrisma.player.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { uid: '12345' } }));
    expect(mockPrisma.playerName.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { playerId_nickname: { playerId: 'player_1', nickname: 'Test Profile' } } }));
    expect(mockPrisma.wishProfile.upsert.mock.calls[0][0].create.playerId).toBe('player_1');

    mockPrisma.wishProfile.findUnique.mockResolvedValueOnce({
      ...profile,
      createdAt: new Date(profile.createdAt),
      updatedAt: new Date(profile.updatedAt),
    });

    const retrieved = await repo.getProfile('prof_test');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.uid).toBe('12345');
  });

  it('saves banner and queries banners', async () => {
    const banner: WishBannerEntity = {
      id: 'banner_test',
      name: 'Test Weapon',
      nameEn: 'Test Weapon',
      nameRu: 'Тестовое оружие',
      bannerType: 'weapon_limited',
      characterId: 'yanmiao',
      weaponId: 'Killknife_physic',
      pityTarget: 80,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      currency: 'red_nucleus',
      cashbackCurrency: 'flame_gold',
      featuredSsr: ['Killknife_physic'],
      assets: {
        background: '/bg.webp',
        splash: '/splash.webp',
        icon: '/icon.webp',
      },
    };


    await repo.saveBanner(banner);
    expect(mockPrisma.wishBanner.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'banner_test' },
      })
    );
  });

  it('maps an absent pull slot like the import payload does', async () => {
    const pullTimestamp = new Date('2026-09-29T00:00:00Z');
    mockPrisma.wishRecord.findMany.mockResolvedValueOnce([
      { id: 'weapon-pull', slot: null, pullTimestamp },
      { id: 'matrix-pull', slot: 'mind', pullTimestamp },
    ]);

    const records = await repo.getAllWishRecords('prof_test');
    expect(records.map(record => record.slot)).toEqual([undefined, 'mind']);
  });
});
