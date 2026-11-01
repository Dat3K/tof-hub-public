import fs from 'node:fs';
import path from 'node:path';
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type {
  WishBannerDto,
  WishProfileSummaryDto,
  WishPullsResponseDto,
  WishAnalyticsDto,
  WishImportV2Payload,
  WishRecordDto,
  WishStreakOutcome,
} from '@tof-hub/contracts';
import { generateYanmiaoImportPayloadV2 } from '@tof-hub/contracts';
import {
  calculateAnalytics,
  replayPityChain,
  calculateCashbackSummary,
  buildWishTallyData,
  evaluateStreak,
  DEMO_PROFILE_ID,
  DEMO_UID,
  YANMIAO_WEAPON_BANNER,
  YANMIAO_MATRIX_BANNER,
  generateYanmiaoWeaponPulls,
  generateYanmiaoMatrixPulls,
} from '@tof-hub/game-domain';
import {
  WISH_REPOSITORY_TOKEN,
  type IWishRepository,
  type WishRecordsQueryOptions,
} from './adapters/wish-repository.interface';
import type { WishRecordEntity, WishBannerEntity } from './entities/wish.entities';
import { NotFoundException } from '@nestjs/common';

type ProfileCosmeticAsset = {id:string;icon:string;canvas?:{width:number;height:number;centerX:number;centerY:number}};

function bannerEntityFromDto(banner:typeof YANMIAO_WEAPON_BANNER):WishBannerEntity {
  return {id:banner.id,name:banner.name,nameEn:banner.name_en,nameRu:banner.name_ru,bannerType:banner.banner_type,characterId:banner.character_id,
    weaponId:banner.weapon_id,matrixId:banner.matrix_id,pityTarget:banner.pity_target,startDate:banner.start_date,endDate:banner.end_date,
    currency:banner.currency,cashbackCurrency:banner.cashback_currency,featuredSsr:banner.featured_ssr,featuredSr:banner.featured_sr??[],
    standardPoolItems:banner.standard_pool_items??[],assets:banner.assets as WishBannerEntity['assets']};
}
function recordEntityFromDto(record:WishRecordDto):WishRecordEntity {
  return {id:record.id,profileId:record.profile_id,bannerId:record.banner_id,bannerType:record.banner_type,itemId:record.item_id,
    itemName:record.item_name,itemType:record.item_type,rarity:record.rarity,pityCount:record.pity_count,trackPullNumber:record.track_pull_number,
    isGuaranteedPity:record.is_guaranteed_pity,isFeatured:record.is_featured,streakOutcome:record.streak_outcome,slot:record.slot,
    pullTimestamp:record.pull_timestamp,groupTicks:record.group_ticks,rawBannerCode:record.raw_banner_code,itemIndex:record.item_index,
    compensation:record.compensation};
}
function bannerDtoFromEntity(banner:WishBannerEntity):WishBannerDto {
  return {id:banner.id,name:banner.name,name_en:banner.nameEn,name_ru:banner.nameRu,banner_type:banner.bannerType,
    character_id:banner.characterId,weapon_id:banner.weaponId,matrix_id:banner.matrixId,pity_target:banner.pityTarget,
    start_date:banner.startDate,end_date:banner.endDate,currency:(banner.currency||'unknown') as WishBannerDto['currency'],
    cashback_currency:banner.cashbackCurrency as WishBannerDto['cashback_currency'],featured_ssr:banner.featuredSsr,
    featured_sr:banner.featuredSr??[],standard_pool_items:banner.standardPoolItems??[],assets:banner.assets};
}
function recordDtoFromEntity(record:WishRecordEntity):WishRecordDto {
  return {id:record.id,profile_id:record.profileId,banner_id:record.bannerId,banner_type:record.bannerType,
    item_id:record.itemId,item_name:record.itemName,item_type:record.itemType,rarity:record.rarity,
    pity_count:record.rawBannerCode&&!record.trackPullNumber?-1:record.pityCount,track_pull_number:record.trackPullNumber,
    is_guaranteed_pity:record.rawBannerCode&&!record.trackPullNumber?false:record.isGuaranteedPity,
    is_featured:record.isFeatured,streak_outcome:record.streakOutcome??'unknown',slot:record.slot,
    pull_timestamp:record.pullTimestamp,group_ticks:record.groupTicks,raw_banner_code:record.rawBannerCode,
    item_index:record.itemIndex,compensation:record.compensation};
}

@Injectable()
export class WishService implements OnModuleInit {
  private readonly cosmetics: {avatars:ProfileCosmeticAsset[];avatarFrames:ProfileCosmeticAsset[]};
  constructor(
    @Inject(WISH_REPOSITORY_TOKEN)
    private readonly repository: IWishRepository
  ) {
    const gameData = process.env.WISH_GAME_DATA_DIR ?? path.resolve(__dirname, '..', '..', '..', '..', 'apps', 'web', 'public', 'game-data');
    const catalogPath = path.join(gameData, 'build-page.json');
    const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : {};
    this.cosmetics = {avatars:catalog.avatars ?? [],avatarFrames:catalog.avatarFrames ?? []};
  }

  public async onModuleInit(): Promise<void> {
    await this.repository.init();
    await this.seedDemoIfEmpty();
  }

  public async seedDemoIfEmpty(): Promise<void> {
    // 1. Ensure Demo Profile exists
    let profile = await this.repository.getProfile(DEMO_PROFILE_ID);
    if (!profile) {
      profile = {
        id: DEMO_PROFILE_ID,
        uid: DEMO_UID,
        name: 'HT4002 (Demo)',
        isDefault: true,
        isDemo: true,
        region: 'global',
        server: '9999001',
        createdAt: '2023-12-21T04:00:00.000Z',
        updatedAt: new Date().toISOString(),
      };
      await this.repository.saveProfile(profile);
    }

    // 2. Ensure Yanmiao Banners exist. The fixtures are DTOs (snake_case); the Postgres adapter reads entity fields only.
    await this.repository.saveBanner(bannerEntityFromDto(YANMIAO_WEAPON_BANNER));
    await this.repository.saveBanner(bannerEntityFromDto(YANMIAO_MATRIX_BANNER));

    // 3. Seed Weapon Pulls (248 pulls) & Matrix Pulls (120 pulls)
    const weaponPulls = generateYanmiaoWeaponPulls().map(recordEntityFromDto);
    const matrixPulls = generateYanmiaoMatrixPulls().map(recordEntityFromDto);

    await this.repository.insertWishRecords(weaponPulls);
    await this.repository.insertWishRecords(matrixPulls);
  }

  public async getBanners(): Promise<WishBannerDto[]> {
    const entities = await this.repository.getBanners();
    return entities.map(bannerDtoFromEntity);
  }

  public async getCommunityTally(): Promise<{
    banners: ReturnType<typeof buildWishTallyData>;
    profile_count: number;
    total_pulls: number;
  }> {
    const [banners, records] = await Promise.all([
      this.repository.getBanners(),
      this.repository.getCommunityWishRecords(),
    ]);
    const dtoRecords = records.map(recordDtoFromEntity);
    const dtoBanners = banners.map(bannerDtoFromEntity);
    return {
      banners: buildWishTallyData(dtoBanners, dtoRecords),
      profile_count: new Set(records.map((record) => record.profileId)).size,
      total_pulls: records.length,
    };
  }

  /** Dev1 player directory: per-profile aggregates only, never the pull records themselves. */
  public async getCommunityPlayers() {
    const [profiles, records] = await Promise.all([
      this.repository.getImportedProfiles(),
      this.repository.getCommunityWishRecords(),
    ]);
    const byProfile = new Map<string, WishRecordEntity[]>();
    for (const record of records) {
      const group = byProfile.get(record.profileId) ?? [];
      group.push(record);
      byProfile.set(record.profileId, group);
    }
    return profiles.map((profile) => {
      const own = byProfile.get(profile.id) ?? [];
      const pullsByTrack = { weapon_limited: 0, matrix_limited: 0, standard_weapon: 0, standard_matrix: 0, black_nucleus: 0 };
      for (const record of own) pullsByTrack[record.bannerType] += 1;
      // Same rule as the Wish page: only event SSRs with a known streak outcome count toward 50/50.
      const eventSsr = own.filter((record) => record.rarity === 5 && record.bannerType.endsWith('_limited')
        && (record.streakOutcome === 'win' || record.streakOutcome === 'loss'));
      return {
        id: profile.id, uid: profile.uid, name: profile.name, region: profile.region, server: profile.server,
        updated_at: profile.updatedAt,
        avatar_cosmetic: this.cosmetics.avatars.find(item => item.id.toLowerCase() === profile.avatarId?.toLowerCase()),
        avatar_frame_cosmetic: this.cosmetics.avatarFrames.find(item => item.id.toLowerCase() === profile.avatarFrameId?.toLowerCase()),
        total_pulls: own.length,
        pulls_by_track: pullsByTrack,
        ssr_count: own.filter((record) => record.rarity === 5).length,
        event_wins: eventSsr.filter((record) => record.streakOutcome === 'win').length,
        event_outcomes: eventSsr.length,
        unresolved_pulls: own.filter((record) => record.bannerId.startsWith('unresolved-')).length,
      };
    });
  }

  private async requireProfileId(profileId: string = DEMO_PROFILE_ID): Promise<string> {
    const id = profileId === 'demo' ? DEMO_PROFILE_ID : profileId;
    if (id === DEMO_PROFILE_ID) return id;
    if (!/^import-[a-f0-9]{32}$/.test(id)) throw new NotFoundException('Profile not found');
    const profile = await this.repository.getProfile(id);
    if (!profile || profile.isDemo) throw new NotFoundException('Profile not found');
    return id;
  }

  public async getImportedProfile(profileId: string) {
    if (!/^import-[a-f0-9]{32}$/.test(profileId)) throw new NotFoundException('Profile not found');
    const profile = await this.repository.getProfile(profileId);
    if (!profile || profile.isDemo) throw new NotFoundException('Profile not found');
    const records = await this.repository.getAllWishRecords(profileId);
    const ids = new Set(records.map((record) => record.bannerId));
    const banners = (await this.repository.getBanners()).filter((banner) => ids.has(banner.id));
    return {
      profile: { ...profile,
        avatarCosmetic: this.cosmetics.avatars.find(item => item.id.toLowerCase() === profile.avatarId?.toLowerCase()),
        avatarFrameCosmetic: this.cosmetics.avatarFrames.find(item => item.id.toLowerCase() === profile.avatarFrameId?.toLowerCase()),
      },
      records: records.map(recordDtoFromEntity),
      banners: banners.map(bannerDtoFromEntity),
    };
  }

  public async getProfileSummary(profileId: string = DEMO_PROFILE_ID): Promise<WishProfileSummaryDto> {
    const id = await this.requireProfileId(profileId);
    const allWeaponPulls = (await this.repository.getAllWishRecords(id, 'weapon_limited')).map(recordDtoFromEntity);
    const allMatrixPulls = (await this.repository.getAllWishRecords(id, 'matrix_limited')).map(recordDtoFromEntity);

    const weaponState = replayPityChain(allWeaponPulls, 'weapon_limited', {
      initialStreaks: id === DEMO_PROFILE_ID ? ['loss', 'win'] : [],
    });
    const matrixState = replayPityChain(allMatrixPulls, 'matrix_limited');

    const weaponCashback = calculateCashbackSummary(allWeaponPulls);
    const matrixCashback = calculateCashbackSummary(allMatrixPulls);

    const nextWeaponStreak = evaluateStreak(weaponState.streaks);
    const nextMatrixStreak = evaluateStreak(matrixState.streaks);

    // Calculate matrix slot counts
    const matrixSlots = { mind: 0, memory: 0, belief: 0, emotion: 0 };
    for (const pull of allMatrixPulls) {
      if (pull.rarity === 5 && pull.slot) {
        matrixSlots[pull.slot] = (matrixSlots[pull.slot] ?? 0) + 1;
      }
    }

    const combinedFeed = [...weaponState.ssrFeed, ...matrixState.ssrFeed].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      profile_id: id,
      total_pulls: allWeaponPulls.length + allMatrixPulls.length,
      weapon_pulls: allWeaponPulls.length,
      matrix_pulls: allMatrixPulls.length,
      current_weapon_pity: weaponState.currentPity,
      current_matrix_pity: matrixState.currentPity,
      weapon_ssr_count: weaponState.totalSsr,
      matrix_ssr_count: matrixState.totalSsr,
      weapon_early_ssr_count: weaponState.earlySsrCount,
      matrix_early_ssr_count: matrixState.earlySsrCount,
      next_weapon_streak: nextWeaponStreak.nextPrediction,
      next_matrix_streak: nextMatrixStreak.nextPrediction,
      recent_weapon_streaks: weaponState.streaks.slice(-5),
      recent_matrix_streaks: matrixState.streaks.slice(-5),
      cashback: {
        flame_gold_awarded: weaponCashback.totalCurrencyAwarded,
        overclocking_chips_awarded: matrixCashback.totalCurrencyAwarded,
        base_currency: weaponCashback.baseCurrency + matrixCashback.baseCurrency,
        extra_duplicate_currency: weaponCashback.extraDuplicateCurrency + matrixCashback.extraDuplicateCurrency,
      },
      matrix_slots: matrixSlots,
      recent_ssr_feed: combinedFeed.slice(0, 10),
    };
  }

  public async getPulls(query: WishRecordsQueryOptions): Promise<WishPullsResponseDto> {
    const id = await this.requireProfileId(query.profileId);
    const res = await this.repository.getWishRecords({
      ...query,
      profileId: id,
    });

    return {
      items: res.items.map(recordDtoFromEntity),
      next_cursor: res.nextCursor,
      total_count: res.totalCount,
    };
  }

  public async getAnalytics(
    profileId: string = DEMO_PROFILE_ID,
    bannerType: 'weapon_limited' | 'matrix_limited' = 'weapon_limited',
    bannerId?: string
  ): Promise<WishAnalyticsDto> {
    const id = await this.requireProfileId(profileId);
    const pulls = await this.repository.getAllWishRecords(id, bannerType, bannerId);

    const initialStreaks: WishStreakOutcome[] = id === DEMO_PROFILE_ID && bannerType === 'weapon_limited' ? ['loss', 'win'] : [];

    return calculateAnalytics(pulls.map(recordDtoFromEntity), bannerType, {
      initialStreaks,
    });
  }

  public async exportProfile(profileId: string = DEMO_PROFILE_ID): Promise<WishImportV2Payload> {
    const id = await this.requireProfileId(profileId);
    if (id === DEMO_PROFILE_ID) {
      return generateYanmiaoImportPayloadV2();
    }

    const allPulls = await this.repository.getAllWishRecords(id);
    const batches: WishImportV2Payload['batches'] = [];
    const grouped = new Map<string, WishRecordEntity[]>();
    for (const pull of allPulls) {
      if (!pull.groupTicks || pull.itemIndex === undefined || !pull.rawBannerCode) continue;
      const key = `${pull.rawBannerCode}:${pull.groupTicks}`;
      const group = grouped.get(key) ?? [];
      group.push(pull);
      grouped.set(key, group);
    }
    for (const slice of grouped.values()) {
      slice.sort((a, b) => (a.itemIndex ?? 0) - (b.itemIndex ?? 0));
      const first = slice[0];
      batches.push({
        batch_id: `batch_${first.groupTicks}`,
        banner_id: first.bannerId,
        raw_banner_code: first.rawBannerCode!,
        banner_type: first.bannerType,
        group_ticks: first.groupTicks!,
        timestamp: first.pullTimestamp,
        pulls: slice.map((p) => ({
          index_in_batch: p.itemIndex!,
          track_pull_number: p.trackPullNumber,
          item_id: p.itemId,
          rarity: p.rarity,
          is_featured: p.isFeatured,
          slot: p.slot,
          compensation: p.compensation,
        })),
      });
    }

    const profile = await this.repository.getProfile(id);
    if (!profile) throw new NotFoundException('Profile not found');

    return {
      version: 2,
      pity_snapshots: profile.pitySnapshots,
      export_metadata: {
        exported_at: new Date().toISOString(),
        exporter_name: 'tof-hub-wish-api',
        exporter_version: '2.0.0',
      },
      account: {
        uid: profile.uid,
        region: profile.region,
        server_id: profile.server,
        nickname: profile.name,
        avatar_id: profile.avatarId, avatar_frame_id: profile.avatarFrameId,
        timezone: 'UTC',
      },
      batches,
    };
  }
}
