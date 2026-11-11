import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {canonicalPlayerUid} from '@tof-hub/contracts';
import {
  PrismaClient,
  type WishBanner,
  type WishRecord,
  type WishProfile,
  type WishCashbackTransaction,
} from '@prisma/client';
import {
  type IWishRepository,
  type WishRecordsQueryOptions,
  type WishRecordsQueryResult,
  MAX_WISH_PULLS_LIMIT,
  decodeWishCursor,
  encodeWishCursor,
} from './wish-repository.interface';
import type {
  WishProfileEntity,
  WishBannerEntity,
  WishRecordEntity,
  WishCashbackTransactionEntity,
} from '../entities/wish.entities';

export class PostgresWishRepository implements IWishRepository {
  private readonly prisma: PrismaClient;
  private readonly pool?: Pool;

  constructor(prisma?: PrismaClient, connectionString?: string) {
    if (prisma) {
      this.prisma = prisma;
    } else {
      const connStr =
        connectionString ??
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/tof_hub';
      this.pool = new Pool({ connectionString: connStr });
      const adapter = new PrismaPg(this.pool);
      this.prisma = new PrismaClient({ adapter });
    }
  }

  public async init(): Promise<void> {
    await this.prisma.$connect();
  }

  public async close(): Promise<void> {
    await this.prisma.$disconnect();
    if (this.pool) {
      await this.pool.end();
    }
  }


  public async saveProfile(profile: WishProfileEntity): Promise<void> {
    if(!profile.isDemo)profile={...profile,uid:canonicalPlayerUid(profile.uid,{serverId:profile.server})};
    // Imported histories belong to a game character; the player row is shared with builds and gear.
    const player = profile.isDemo ? null : await this.prisma.player.upsert({
      where: { uid: profile.uid },
      create: { uid: profile.uid, nickname: profile.name, serverId: profile.server, region: profile.region },
      update: { nickname: profile.name, serverId: profile.server, region: profile.region, lastSeenAt: new Date(profile.updatedAt) },
    });
    if (player) {
      await this.prisma.playerName.upsert({
        where: { playerId_nickname: { playerId: player.id, nickname: profile.name } },
        create: { playerId: player.id, nickname: profile.name },
        update: { lastSeenAt: new Date(profile.updatedAt) },
      });
    }
    await this.prisma.wishProfile.upsert({
      where: { id: profile.id },
      create: {
        id: profile.id,
        uid: profile.uid,
        name: profile.name,
        isDefault: profile.isDefault,
        avatarId: profile.avatarId ?? null, avatarFrameId: profile.avatarFrameId ?? null,
        pitySnapshots: profile.pitySnapshots ? JSON.stringify(profile.pitySnapshots) : null,
        isDemo: profile.isDemo,
        region: profile.region,
        server: profile.server,
        playerId: player?.id ?? null,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
      },
      update: {
        uid: profile.uid,
        name: profile.name,
        isDefault: profile.isDefault,
        avatarId: profile.avatarId ?? null, avatarFrameId: profile.avatarFrameId ?? null,
        pitySnapshots: profile.pitySnapshots ? JSON.stringify(profile.pitySnapshots) : null,
        isDemo: profile.isDemo,
        region: profile.region,
        server: profile.server,
        playerId: player?.id ?? null,
        updatedAt: new Date(profile.updatedAt),
      },
    });
  }

  public async getProfile(id: string): Promise<WishProfileEntity | null> {
    const row = await this.prisma.wishProfile.findUnique({ where: { id } });
    return row ? this.mapProfile(row) : null;
  }

  public async getImportedProfileByUid(uid: string): Promise<WishProfileEntity | null> {
    const row = await this.prisma.wishProfile.findFirst({ where: { uid, isDemo: false }, orderBy: { createdAt: 'asc' } });
    return row ? this.mapProfile(row) : null;
  }

  public async getImportedProfiles(): Promise<WishProfileEntity[]> {
    const rows = await this.prisma.wishProfile.findMany({ where: { isDemo: false }, orderBy: { updatedAt: 'desc' } });
    return rows.map((row: WishProfile) => this.mapProfile(row));
  }

  public async getDefaultProfile(): Promise<WishProfileEntity | null> {
    let row = await this.prisma.wishProfile.findFirst({
      where: { isDefault: true },
    });
    if (!row) {
      row = await this.prisma.wishProfile.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }
    return row ? this.mapProfile(row) : null;
  }

  public async saveBanner(banner: WishBannerEntity): Promise<void> {
    await this.prisma.wishBanner.upsert({
      where: { id: banner.id },
      create: {
        id: banner.id,
        name: banner.name,
        nameEn: banner.nameEn,
        nameRu: banner.nameRu,
        bannerType: banner.bannerType,
        characterId: banner.characterId,
        weaponId: banner.weaponId ?? null,
        matrixId: banner.matrixId ?? null,
        pityTarget: banner.pityTarget,
        startDate: new Date(banner.startDate),
        endDate: new Date(banner.endDate),
        currency: banner.currency,
        cashbackCurrency: banner.cashbackCurrency,
        featuredSsr: JSON.stringify(banner.featuredSsr),
        standardPoolItems: JSON.stringify(banner.standardPoolItems ?? []),
        assets: JSON.stringify(banner.assets),
      },
      update: {
        name: banner.name,
        nameEn: banner.nameEn,
        nameRu: banner.nameRu,
        bannerType: banner.bannerType,
        characterId: banner.characterId,
        weaponId: banner.weaponId ?? null,
        matrixId: banner.matrixId ?? null,
        pityTarget: banner.pityTarget,
        startDate: new Date(banner.startDate),
        endDate: new Date(banner.endDate),
        currency: banner.currency,
        cashbackCurrency: banner.cashbackCurrency,
        featuredSsr: JSON.stringify(banner.featuredSsr),
        standardPoolItems: JSON.stringify(banner.standardPoolItems ?? []),
        assets: JSON.stringify(banner.assets),
      },
    });
  }

  public async getBanners(): Promise<WishBannerEntity[]> {
    const rows = await this.prisma.wishBanner.findMany({
      orderBy: { startDate: 'desc' },
    });
    return rows.map((r: WishBanner) => this.mapBanner(r));
  }

  public async getBanner(id: string): Promise<WishBannerEntity | null> {
    const row = await this.prisma.wishBanner.findUnique({ where: { id } });
    return row ? this.mapBanner(row) : null;
  }

  public async insertWishRecords(records: WishRecordEntity[]): Promise<number> {
    if (records.length === 0) return 0;

    // Prisma createMany with skipDuplicates handles duplicate composite IDs gracefully
    const res = await this.prisma.wishRecord.createMany({
      data: records.map((r) => ({
        id: r.id,
        profileId: r.profileId,
        bannerId: r.bannerId,
        bannerType: r.bannerType,
        itemId: r.itemId,
        itemName: r.itemName,
        itemType: r.itemType,
        rarity: r.rarity,
        pityCount: r.pityCount,
        isGuaranteedPity: r.isGuaranteedPity,
        isFeatured: r.isFeatured,
        streakOutcome: r.streakOutcome ?? null,
        slot: r.slot ?? null,
        pullTimestamp: new Date(r.pullTimestamp),
        groupTicks: r.groupTicks ?? null,
        rawBannerCode: r.rawBannerCode ?? null,
        itemIndex: r.itemIndex ?? null,
        trackPullNumber: r.trackPullNumber ?? null,
        compensation: r.compensation ? JSON.stringify(r.compensation) : null,
      })),
      skipDuplicates: true,
    });

    return res.count;
  }

  public async updateWishRecordDerived(records: WishRecordEntity[]): Promise<void> {
    for (const record of records) {
      await this.prisma.wishRecord.updateMany({
        where: { id: record.id, profileId: record.profileId },
        data: { rarity:record.rarity,pityCount: record.pityCount, isGuaranteedPity: record.isGuaranteedPity, trackPullNumber: record.trackPullNumber ?? null,
          pullTimestamp: new Date(record.pullTimestamp), bannerId: record.bannerId, itemName: record.itemName,
          isFeatured: record.isFeatured, streakOutcome: record.streakOutcome ?? null },
      });
    }
  }

  public async getWishRecords(options: WishRecordsQueryOptions): Promise<WishRecordsQueryResult> {
    const where: Record<string, unknown> = {
      profileId: options.profileId,
    };

    if (options.bannerType) where.bannerType = options.bannerType;
    if (options.bannerId) where.bannerId = options.bannerId;
    if (options.rarity) where.rarity = options.rarity;
    if (options.streakOutcome) where.streakOutcome = options.streakOutcome;
    if (options.slot) where.slot = options.slot;

    const totalCount = await this.prisma.wishRecord.count({ where });

    const cursorData = decodeWishCursor(options.cursor);
    const limit = Math.min(MAX_WISH_PULLS_LIMIT, Math.max(1, options.limit ?? 50));

    const findManyArgs: any = {
      where,
      orderBy: [{ pullTimestamp: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };

    if (cursorData) {
      if (cursorData.id) {
        findManyArgs.cursor = { id: cursorData.id };
        findManyArgs.skip = 1;
      } else {
        where.pullTimestamp = { lt: new Date(cursorData.timestamp) };
      }
    }

    const rows = await this.prisma.wishRecord.findMany(findManyArgs);

    const hasNext = rows.length > limit;
    const items = (hasNext ? rows.slice(0, limit) : rows).map((r: WishRecord) => this.mapRecord(r));
    const nextCursor =
      hasNext && items.length > 0
        ? encodeWishCursor({
            timestamp: items[items.length - 1].pullTimestamp,
            id: items[items.length - 1].id,
          })
        : null;


    return {
      items,
      nextCursor,
      totalCount,
    };
  }

  public async getAllWishRecords(
    profileId: string,
    bannerType?: string,
    bannerId?: string
  ): Promise<WishRecordEntity[]> {
    const where: Record<string, unknown> = { profileId };
    if (bannerType) where.bannerType = bannerType;
    if (bannerId) where.bannerId = bannerId;

    const rows = await this.prisma.wishRecord.findMany({
      where,
      orderBy: [{ pullTimestamp: 'asc' }, { id: 'asc' }],
    });

    return rows.map((r: WishRecord) => this.mapRecord(r));
  }

  public async getCommunityWishRecords(): Promise<WishRecordEntity[]> {
    const rows = await this.prisma.wishRecord.findMany({
      where: { profile: { isDemo: false } },
      orderBy: [{ pullTimestamp: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row: WishRecord) => this.mapRecord(row));
  }

  public async recordCashbackTransaction(tx: WishCashbackTransactionEntity): Promise<void> {
    await this.prisma.wishCashbackTransaction.create({
      data: {
        id: tx.id,
        profileId: tx.profileId,
        bannerId: tx.bannerId ?? null,
        currencyType: tx.currencyType,
        amountChange: tx.amountChange,
        balanceAfter: tx.balanceAfter,
        reason: tx.reason,
        timestamp: new Date(tx.timestamp),
      },
    });
  }

  public async getCashbackTransactions(profileId: string): Promise<WishCashbackTransactionEntity[]> {
    const rows = await this.prisma.wishCashbackTransaction.findMany({
      where: { profileId },
      orderBy: { timestamp: 'desc' },
    });
    return rows.map((r: WishCashbackTransaction) => ({
      id: r.id,
      profileId: r.profileId,
      bannerId: r.bannerId ?? undefined,
      currencyType: r.currencyType,
      amountChange: r.amountChange,
      balanceAfter: r.balanceAfter,
      reason: r.reason,
      timestamp: r.timestamp.toISOString(),
    }));
  }

  private mapProfile(row: WishProfile): WishProfileEntity {
    return {
      id: row.id,
      uid: row.uid,
      name: row.name,
      isDefault: row.isDefault,
      avatarId: row.avatarId ?? undefined, avatarFrameId: row.avatarFrameId ?? undefined,
      pitySnapshots: row.pitySnapshots ? JSON.parse(row.pitySnapshots) : undefined,
      isDemo: row.isDemo,
      region: row.region,
      server: row.server,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapBanner(row: WishBanner): WishBannerEntity {
    return {
      id: row.id,
      name: row.name,
      nameEn: row.nameEn,
      nameRu: row.nameRu,
      bannerType: row.bannerType as WishBannerEntity['bannerType'],
      characterId: row.characterId,
      weaponId: row.weaponId ?? undefined,
      matrixId: row.matrixId ?? undefined,
      pityTarget: row.pityTarget,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      currency: row.currency || 'unknown',
      cashbackCurrency: row.cashbackCurrency,
      featuredSsr: JSON.parse(row.featuredSsr),
      standardPoolItems: JSON.parse(row.standardPoolItems),
      assets: JSON.parse(row.assets),
    };
  }

  private mapRecord(row: WishRecord): WishRecordEntity {
    return {
      id: row.id,
      profileId: row.profileId,
      bannerId: row.bannerId,
      bannerType: row.bannerType as WishRecordEntity['bannerType'],
      itemId: row.itemId,
      itemName: row.itemName,
      itemType: row.itemType as WishRecordEntity['itemType'],
      rarity: row.rarity,
      pityCount: row.pityCount,
      isGuaranteedPity: row.isGuaranteedPity,
      isFeatured: row.isFeatured,
      streakOutcome: row.streakOutcome as WishRecordEntity['streakOutcome'],
      slot: (row.slot ?? undefined) as WishRecordEntity['slot'],
      pullTimestamp: row.pullTimestamp.toISOString(),
      groupTicks: row.groupTicks ?? undefined,
      rawBannerCode: row.rawBannerCode ?? undefined,
      itemIndex: row.itemIndex ?? undefined,
      trackPullNumber: row.trackPullNumber ?? undefined,
      compensation: row.compensation ? JSON.parse(row.compensation) : undefined,
    };
  }
}
