import type {
  WishProfileEntity,
  WishBannerEntity,
  WishRecordEntity,
  WishCashbackTransactionEntity,
} from '../entities/wish.entities';

/** Single page-size cap shared by the controller and both repositories. */
export const MAX_WISH_PULLS_LIMIT = 500;

export interface WishRecordsQueryOptions {
  profileId: string;
  bannerType?: string;
  bannerId?: string;
  rarity?: number;
  streakOutcome?: string;
  slot?: string;
  cursor?: string;
  limit?: number;
}

export interface WishCursorPayload {
  timestamp: string;
  id: string;
}

export function encodeWishCursor(payload: WishCursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeWishCursor(cursor?: string | null): WishCursorPayload | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.timestamp === 'string' && typeof parsed.id === 'string') {
      return parsed;
    }
  } catch {
    // fallback if legacy raw ISO timestamp string was passed
    if (cursor.includes('T') || cursor.includes('-')) {
      return { timestamp: cursor, id: '' };
    }
  }
  return null;
}

export interface WishRecordsQueryResult {
  items: WishRecordEntity[];
  nextCursor: string | null;
  totalCount: number;
}

export interface IWishRepository {

  init(): Promise<void>;
  close(): Promise<void>;

  saveProfile(profile: WishProfileEntity): Promise<void>;
  getProfile(id: string): Promise<WishProfileEntity | null>;
  getImportedProfileByUid(uid: string): Promise<WishProfileEntity | null>;
  /** Every non-demo profile, most recently updated first. */
  getImportedProfiles(): Promise<WishProfileEntity[]>;
  getDefaultProfile(): Promise<WishProfileEntity | null>;

  saveBanner(banner: WishBannerEntity): Promise<void>;
  getBanners(): Promise<WishBannerEntity[]>;
  getBanner(id: string): Promise<WishBannerEntity | null>;

  insertWishRecords(records: WishRecordEntity[]): Promise<number>;
  updateWishRecordDerived(records: WishRecordEntity[]): Promise<void>;
  getWishRecords(options: WishRecordsQueryOptions): Promise<WishRecordsQueryResult>;
  getAllWishRecords(profileId: string, bannerType?: string, bannerId?: string): Promise<WishRecordEntity[]>;
  getCommunityWishRecords(): Promise<WishRecordEntity[]>;

  recordCashbackTransaction(tx: WishCashbackTransactionEntity): Promise<void>;
  getCashbackTransactions(profileId: string): Promise<WishCashbackTransactionEntity[]>;
}

export const WISH_REPOSITORY_TOKEN = Symbol('IWishRepository');
