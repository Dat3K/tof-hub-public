import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

export class SqliteWishRepository implements IWishRepository {
  private db: DatabaseSync | null = null;
  private readonly dbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else {
      const dataDir = path.resolve(process.cwd(), '.data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'wish.sqlite');
    }
  }

  public async init(): Promise<void> {
    if (this.db) return;

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');

    this.createTables();
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wish_profiles (
        id TEXT PRIMARY KEY,
        uid TEXT NOT NULL,
        name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        pity_snapshots TEXT,
        avatar_id TEXT,
        avatar_frame_id TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0,
        region TEXT NOT NULL DEFAULT 'global',
        server TEXT NOT NULL DEFAULT '9999001',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wish_banners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_en TEXT NOT NULL,
        name_ru TEXT NOT NULL,
        banner_type TEXT NOT NULL,
        character_id TEXT NOT NULL,
        weapon_id TEXT,
        matrix_id TEXT,
        pity_target INTEGER NOT NULL DEFAULT 80,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        currency TEXT NOT NULL,
        cashback_currency TEXT NOT NULL,
        featured_ssr TEXT NOT NULL,
        standard_pool_items TEXT NOT NULL DEFAULT '[]',
        assets TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wish_records (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        banner_id TEXT NOT NULL,
        banner_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        rarity INTEGER NOT NULL,
        pity_count INTEGER NOT NULL,
        is_guaranteed_pity INTEGER NOT NULL DEFAULT 0,
        is_featured INTEGER NOT NULL DEFAULT 0,
        streak_outcome TEXT,
        slot TEXT,
        pull_timestamp TEXT NOT NULL,
        group_ticks TEXT,
        raw_banner_code TEXT,
        item_index INTEGER,
        track_pull_number INTEGER,
        compensation TEXT,
        FOREIGN KEY (profile_id) REFERENCES wish_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (banner_id) REFERENCES wish_banners(id)
      );

      CREATE TABLE IF NOT EXISTS wish_cashback_transactions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        banner_id TEXT,
        currency_type TEXT NOT NULL,
        amount_change INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reason TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES wish_profiles(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_wish_records_profile_type_time
        ON wish_records (profile_id, banner_type, pull_timestamp);

      CREATE INDEX IF NOT EXISTS idx_wish_records_banner
        ON wish_records (banner_id);

      CREATE INDEX IF NOT EXISTS idx_wish_cashback_profile
        ON wish_cashback_transactions (profile_id, currency_type);
    `);
    const profileColumns = this.db.prepare('PRAGMA table_info(wish_profiles)').all() as Array<{name: string}>;
    if (!profileColumns.some(column => column.name === 'pity_snapshots')) this.db.exec('ALTER TABLE wish_profiles ADD COLUMN pity_snapshots TEXT');
    for (const column of ['avatar_id', 'avatar_frame_id']) if (!profileColumns.some(value => value.name === column)) this.db.exec(`ALTER TABLE wish_profiles ADD COLUMN ${column} TEXT`);
    const columns = this.db.prepare('PRAGMA table_info(wish_records)').all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'track_pull_number')) {
      this.db.exec('ALTER TABLE wish_records ADD COLUMN track_pull_number INTEGER');
    }
    if (!columns.some((column) => column.name === 'raw_banner_code')) {
      this.db.exec('ALTER TABLE wish_records ADD COLUMN raw_banner_code TEXT');
    }
  }

  public async saveProfile(profile: WishProfileEntity): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO wish_profiles (id, uid, name, is_default, is_demo, region, server, created_at, updated_at, pity_snapshots, avatar_id, avatar_frame_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        uid = excluded.uid,
        name = excluded.name,
        is_default = excluded.is_default,
        is_demo = excluded.is_demo,
        region = excluded.region,
        server = excluded.server,
        updated_at = excluded.updated_at,
        pity_snapshots = excluded.pity_snapshots,
        avatar_id = excluded.avatar_id,
        avatar_frame_id = excluded.avatar_frame_id
    `);

    stmt.run(
      profile.id,
      profile.uid,
      profile.name,
      profile.isDefault ? 1 : 0,
      profile.isDemo ? 1 : 0,
      profile.region,
      profile.server,
      profile.createdAt,
      profile.updatedAt,
      profile.pitySnapshots ? JSON.stringify(profile.pitySnapshots) : null,
      profile.avatarId ?? null, profile.avatarFrameId ?? null
    );
  }

  public async getProfile(id: string): Promise<WishProfileEntity | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM wish_profiles WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return this.mapProfile(row);
  }

  public async getImportedProfileByUid(uid: string): Promise<WishProfileEntity | null> {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db.prepare('SELECT * FROM wish_profiles WHERE uid = ? AND is_demo = 0 ORDER BY created_at ASC LIMIT 1').get(uid) as Record<string, unknown> | undefined;
    return row ? this.mapProfile(row) : null;
  }

  public async getImportedProfiles(): Promise<WishProfileEntity[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = this.db.prepare('SELECT * FROM wish_profiles WHERE is_demo = 0 ORDER BY updated_at DESC').all() as Record<string, unknown>[];
    return rows.map((row) => this.mapProfile(row));
  }

  public async getDefaultProfile(): Promise<WishProfileEntity | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM wish_profiles WHERE is_default = 1 LIMIT 1');
    let row = stmt.get() as Record<string, unknown> | undefined;

    if (!row) {
      const anyStmt = this.db.prepare('SELECT * FROM wish_profiles ORDER BY created_at ASC LIMIT 1');
      row = anyStmt.get() as Record<string, unknown> | undefined;
    }

    return row ? this.mapProfile(row) : null;
  }

  public async saveBanner(banner: WishBannerEntity): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO wish_banners (
        id, name, name_en, name_ru, banner_type, character_id, weapon_id, matrix_id,
        pity_target, start_date, end_date, currency, cashback_currency,
        featured_ssr, standard_pool_items, assets, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        name_en = excluded.name_en,
        name_ru = excluded.name_ru,
        banner_type = excluded.banner_type,
        character_id = excluded.character_id,
        weapon_id = excluded.weapon_id,
        matrix_id = excluded.matrix_id,
        pity_target = excluded.pity_target,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        currency = excluded.currency,
        cashback_currency = excluded.cashback_currency,
        featured_ssr = excluded.featured_ssr,
        standard_pool_items = excluded.standard_pool_items,
        assets = excluded.assets
    `);

    const nameEn = banner.nameEn ?? (banner as any).name_en ?? banner.name;
    const nameRu = banner.nameRu ?? (banner as any).name_ru ?? banner.name;
    const bannerType = banner.bannerType ?? (banner as any).banner_type ?? 'weapon_limited';
    const characterId = banner.characterId ?? (banner as any).character_id ?? '';
    const weaponId = banner.weaponId ?? (banner as any).weapon_id ?? null;
    const matrixId = banner.matrixId ?? (banner as any).matrix_id ?? null;
    const pityTarget = Number(banner.pityTarget ?? (banner as any).pity_target ?? 80);
    const startDate = banner.startDate ?? (banner as any).start_date ?? new Date().toISOString();
    const endDate = banner.endDate ?? (banner as any).end_date ?? new Date().toISOString();
    const currency = banner.currency ?? 'red_nucleus';
    const cashbackCurrency = banner.cashbackCurrency ?? (banner as any).cashback_currency ?? 'flame_gold';
    const featuredSsr = banner.featuredSsr ?? (banner as any).featured_ssr ?? [];
    const standardPool = banner.standardPoolItems ?? (banner as any).standard_pool_items ?? [];
    const assets = banner.assets ?? {};

    stmt.run(
      banner.id,
      banner.name,
      nameEn,
      nameRu,
      bannerType,
      characterId,
      weaponId,
      matrixId,
      pityTarget,
      startDate,
      endDate,
      currency,
      cashbackCurrency,
      JSON.stringify(featuredSsr),
      JSON.stringify(standardPool),
      JSON.stringify(assets),
      new Date().toISOString()
    );
  }

  public async getBanners(): Promise<WishBannerEntity[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM wish_banners ORDER BY start_date DESC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.mapBanner(r));
  }

  public async getBanner(id: string): Promise<WishBannerEntity | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM wish_banners WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.mapBanner(row) : null;
  }

  public async insertWishRecords(records: WishRecordEntity[]): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    if (records.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO wish_records (
        id, profile_id, banner_id, banner_type, item_id, item_name, item_type,
        rarity, pity_count, is_guaranteed_pity, is_featured, streak_outcome,
        slot, pull_timestamp, group_ticks, raw_banner_code, item_index, compensation, track_pull_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;
    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const record of records) {
        const r = record as any;
        const profileId = record.profileId ?? r.profile_id ?? '';
        const bannerId = record.bannerId ?? r.banner_id ?? '';
        const bannerType = record.bannerType ?? r.banner_type ?? 'weapon_limited';
        const itemId = record.itemId ?? r.item_id ?? '';
        const itemName = record.itemName ?? r.item_name ?? '';
        const itemType = record.itemType ?? r.item_type ?? 'weapon';
        const rarity = Number(record.rarity ?? r.rarity ?? 3);
        const pityCount = Number(record.pityCount ?? r.pity_count ?? 1);
        const isGuaranteed = record.isGuaranteedPity ?? r.is_guaranteed_pity ?? false;
        const isFeatured = record.isFeatured ?? r.is_featured ?? false;
        const streakOutcome = record.streakOutcome ?? r.streak_outcome ?? null;
        const slot = record.slot ?? r.slot ?? null;
        const pullTimestamp = record.pullTimestamp ?? r.pull_timestamp ?? new Date().toISOString();
        const groupTicks = record.groupTicks ?? r.group_ticks ?? null;
        const rawBannerCode = record.rawBannerCode ?? r.raw_banner_code ?? null;
        const itemIndex = record.itemIndex !== undefined ? record.itemIndex : (r.item_index !== undefined ? r.item_index : null);
        const compensation = record.compensation ?? r.compensation ?? null;

        const info = stmt.run(
          record.id,
          profileId,
          bannerId,
          bannerType,
          itemId,
          itemName,
          itemType,
          rarity,
          pityCount,
          isGuaranteed ? 1 : 0,
          isFeatured ? 1 : 0,
          streakOutcome,
          slot,
          pullTimestamp,
          groupTicks,
          rawBannerCode,
          itemIndex,
          compensation ? JSON.stringify(compensation) : null,
          record.trackPullNumber ?? null
        );
        insertedCount += Number(info.changes);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return insertedCount;
  }

  public async updateWishRecordDerived(records: WishRecordEntity[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    // pull_timestamp is derived from group_ticks and may be corrected by a file with a known server clock.
    // banner_id/item_name/is_featured/streak_outcome change when an unresolved raw code resolves later.
    const stmt = this.db.prepare('UPDATE wish_records SET rarity = ?, pity_count = ?, is_guaranteed_pity = ?, track_pull_number = ?, pull_timestamp = ?, banner_id = ?, item_name = ?, is_featured = ?, streak_outcome = ? WHERE id = ? AND profile_id = ?');
    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const record of records) stmt.run(record.rarity, record.pityCount, record.isGuaranteedPity ? 1 : 0, record.trackPullNumber ?? null, record.pullTimestamp,
        record.bannerId, record.itemName, record.isFeatured ? 1 : 0, record.streakOutcome ?? null, record.id, record.profileId);
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  public async getWishRecords(options: WishRecordsQueryOptions): Promise<WishRecordsQueryResult> {
    if (!this.db) throw new Error('Database not initialized');

    type SqlVal = string | number | bigint | null | Uint8Array;
    const conditions: string[] = ['profile_id = ?'];
    const params: SqlVal[] = [options.profileId];

    if (options.bannerType) {
      conditions.push('banner_type = ?');
      params.push(options.bannerType);
    }

    if (options.bannerId) {
      conditions.push('banner_id = ?');
      params.push(options.bannerId);
    }

    if (options.rarity) {
      conditions.push('rarity = ?');
      params.push(options.rarity);
    }

    if (options.streakOutcome) {
      conditions.push('streak_outcome = ?');
      params.push(options.streakOutcome);
    }

    if (options.slot) {
      conditions.push('slot = ?');
      params.push(options.slot);
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM wish_records WHERE ${whereClause}`);
    const countRow = countStmt.get(...params) as { count: number };
    const totalCount = countRow?.count ?? 0;

    // Cursor condition (newest first: pull_timestamp DESC, id DESC)
    let paginationClause = '';
    const queryParams: SqlVal[] = [...params];

    const cursorData = decodeWishCursor(options.cursor);
    if (cursorData) {
      if (cursorData.id) {
        paginationClause = ' AND (pull_timestamp < ? OR (pull_timestamp = ? AND id < ?))';
        queryParams.push(cursorData.timestamp, cursorData.timestamp, cursorData.id);
      } else {
        paginationClause = ' AND pull_timestamp < ?';
        queryParams.push(cursorData.timestamp);
      }
    }

    const limit = Math.min(MAX_WISH_PULLS_LIMIT, Math.max(1, options.limit ?? 50));
    queryParams.push(limit + 1); // fetch limit + 1 to check if next page exists

    const recordsStmt = this.db.prepare(`
      SELECT * FROM wish_records
      WHERE ${whereClause} ${paginationClause}
      ORDER BY pull_timestamp DESC, id DESC
      LIMIT ?
    `);

    const rows = recordsStmt.all(...queryParams) as Record<string, unknown>[];
    const hasNext = rows.length > limit;
    const items = (hasNext ? rows.slice(0, limit) : rows).map((r) => this.mapRecord(r));
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
    if (!this.db) throw new Error('Database not initialized');

    type SqlVal = string | number | bigint | null | Uint8Array;
    const conditions: string[] = ['profile_id = ?'];
    const params: SqlVal[] = [profileId];

    if (bannerType) {
      conditions.push('banner_type = ?');
      params.push(bannerType);
    }

    if (bannerId) {
      conditions.push('banner_id = ?');
      params.push(bannerId);
    }

    const whereClause = conditions.join(' AND ');
    const stmt = this.db.prepare(`
      SELECT * FROM wish_records
      WHERE ${whereClause}
      ORDER BY pull_timestamp ASC, id ASC
    `);

    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapRecord(r));
  }

  public async getCommunityWishRecords(): Promise<WishRecordEntity[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = this.db.prepare(`
      SELECT records.*
      FROM wish_records AS records
      INNER JOIN wish_profiles AS profiles ON profiles.id = records.profile_id
      WHERE profiles.is_demo = 0
      ORDER BY records.pull_timestamp ASC, records.id ASC
    `).all() as Record<string, unknown>[];
    return rows.map((row) => this.mapRecord(row));
  }

  public async recordCashbackTransaction(tx: WishCashbackTransactionEntity): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO wish_cashback_transactions (id, profile_id, banner_id, currency_type, amount_change, balance_after, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      tx.id,
      tx.profileId,
      tx.bannerId ?? null,
      tx.currencyType,
      tx.amountChange,
      tx.balanceAfter,
      tx.reason,
      tx.timestamp
    );
  }

  public async getCashbackTransactions(profileId: string): Promise<WishCashbackTransactionEntity[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM wish_cashback_transactions WHERE profile_id = ? ORDER BY timestamp DESC'
    );
    const rows = stmt.all(profileId) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      profileId: String(r.profile_id),
      bannerId: r.banner_id ? String(r.banner_id) : undefined,
      currencyType: String(r.currency_type),
      amountChange: Number(r.amount_change),
      balanceAfter: Number(r.balance_after),
      reason: String(r.reason),
      timestamp: String(r.timestamp),
    }));
  }

  private mapProfile(row: Record<string, unknown>): WishProfileEntity {
    return {
      id: String(row.id),
      uid: String(row.uid),
      name: String(row.name),
      isDefault: Boolean(row.is_default),
      avatarId: row.avatar_id ? String(row.avatar_id) : undefined,
      avatarFrameId: row.avatar_frame_id ? String(row.avatar_frame_id) : undefined,
      pitySnapshots: row.pity_snapshots ? JSON.parse(String(row.pity_snapshots)) : undefined,
      isDemo: Boolean(row.is_demo),
      region: String(row.region),
      server: String(row.server),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapBanner(row: Record<string, unknown>): WishBannerEntity {
    return {
      id: String(row.id),
      name: String(row.name),
      nameEn: String(row.name_en),
      nameRu: String(row.name_ru),
      bannerType: row.banner_type as WishBannerEntity['bannerType'],
      characterId: String(row.character_id),
      weaponId: row.weapon_id ? String(row.weapon_id) : undefined,
      matrixId: row.matrix_id ? String(row.matrix_id) : undefined,
      pityTarget: Number(row.pity_target),
      startDate: String(row.start_date),
      endDate: String(row.end_date),
      currency: String(row.currency || 'unknown'),
      cashbackCurrency: String(row.cashback_currency),
      featuredSsr: JSON.parse(String(row.featured_ssr)),
      standardPoolItems: JSON.parse(String(row.standard_pool_items || '[]')),
      assets: JSON.parse(String(row.assets)),
    };
  }

  private mapRecord(row: Record<string, unknown>): WishRecordEntity {
    const isGuaranteed = Boolean(row.is_guaranteed_pity);
    const isFeatured = Boolean(row.is_featured);
    const streakOutcome = row.streak_outcome ? (row.streak_outcome as WishRecordEntity['streakOutcome']) : null;
    const compensation = row.compensation ? JSON.parse(String(row.compensation)) : undefined;

    const res: WishRecordEntity & Record<string, unknown> = {
      id: String(row.id),
      profileId: String(row.profile_id),
      bannerId: String(row.banner_id),
      bannerType: row.banner_type as WishRecordEntity['bannerType'],
      itemId: String(row.item_id),
      itemName: String(row.item_name),
      itemType: row.item_type as WishRecordEntity['itemType'],
      rarity: Number(row.rarity),
      pityCount: Number(row.pity_count),
      isGuaranteedPity: isGuaranteed,
      isFeatured: isFeatured,
      streakOutcome,
      slot: row.slot ? (row.slot as WishRecordEntity['slot']) : undefined,
      pullTimestamp: String(row.pull_timestamp),
      groupTicks: row.group_ticks ? String(row.group_ticks) : undefined,
      rawBannerCode: row.raw_banner_code ? String(row.raw_banner_code) : undefined,
      trackPullNumber: row.track_pull_number == null ? undefined : Number(row.track_pull_number),
      itemIndex: row.item_index !== null && row.item_index !== undefined ? Number(row.item_index) : undefined,
      compensation,
      // Snake case aliases for contract compatibility
      profile_id: String(row.profile_id),
      banner_id: String(row.banner_id),
      banner_type: row.banner_type,
      item_id: String(row.item_id),
      item_name: String(row.item_name),
      item_type: row.item_type,
      pity_count: row.raw_banner_code && row.track_pull_number == null ? -1 : Number(row.pity_count),
      is_guaranteed_pity: isGuaranteed,
      is_featured: isFeatured,
      streak_outcome: streakOutcome,
      pull_timestamp: String(row.pull_timestamp),
      group_ticks: row.group_ticks ? String(row.group_ticks) : undefined,
      raw_banner_code: row.raw_banner_code ? String(row.raw_banner_code) : undefined,
      track_pull_number: row.track_pull_number == null ? undefined : Number(row.track_pull_number),
      item_index: row.item_index !== null && row.item_index !== undefined ? Number(row.item_index) : undefined,
    };
    return res;
  }
}
