import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { isIP } from 'node:net';
import { EVENT_BANNER_TYPES, WISH_BANNER_TYPES, WISH_MATRIX_SLOTS, WISH_STREAK_OUTCOMES } from '@tof-hub/game-domain';
import { MAX_WISH_PULLS_LIMIT } from './adapters/wish-repository.interface';

/** Canonical requester identity for per-IP import queueing and access grants. */
export function normalizeIp(ip: string): string {
  const normalized = ip.trim().toLowerCase().replace(/^::ffff:/, '');
  return isIP(normalized) ? normalized : 'unknown';
}

/** Single page-size cap shared by the controller and both repositories. */
export const MAX_PULLS_LIMIT = MAX_WISH_PULLS_LIMIT;
export const DEFAULT_PULLS_LIMIT = 50;

const IMPORT_PROFILE_ID_PATTERN = /^import-[a-f0-9]{32}$/;
const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BANNER_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export const DEMO_PROFILE_ALIASES = new Set(['demo', 'demo-user-profile']);

const PULLS_BANNER_TYPES = new Set<string>(WISH_BANNER_TYPES);

const ANALYTICS_BANNER_TYPES = new Set<string>(EVENT_BANNER_TYPES);

const STREAK_OUTCOMES = new Set<string>(WISH_STREAK_OUTCOMES);
const MATRIX_SLOTS = new Set<string>(WISH_MATRIX_SLOTS);
const RARITIES = new Set([3, 4, 5]);

export function isDemoProfileId(profileId: string): boolean {
  return DEMO_PROFILE_ALIASES.has(profileId);
}

export function isImportProfileId(profileId: string): boolean {
  return IMPORT_PROFILE_ID_PATTERN.test(profileId);
}

/** Rejects anything that is neither the demo alias nor a server-issued import id. */
export function assertReadableProfileId(profileId: string): void {
  if (isDemoProfileId(profileId) || isImportProfileId(profileId)) return;
  throw new NotFoundException('Profile not found');
}

export function assertJobId(jobId: string): void {
  if (!JOB_ID_PATTERN.test(jobId)) throw new NotFoundException('Import job not found');
}

export interface ParsedPullsQuery {
  bannerType?: string;
  bannerId?: string;
  rarity?: number;
  streakOutcome?: string;
  slot?: string;
  cursor?: string;
  limit: number;
}

function parseIntegerParam(value: string, name: string): number {
  if (!/^\d{1,10}$/.test(value)) throw new BadRequestException(`Invalid ${name}`);
  const parsed = parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) throw new BadRequestException(`Invalid ${name}`);
  return parsed;
}

export function parsePullsQuery(query: {
  bannerType?: string;
  bannerId?: string;
  rarity?: string;
  streakOutcome?: string;
  slot?: string;
  cursor?: string;
  limit?: string;
}): ParsedPullsQuery {
  let limit = DEFAULT_PULLS_LIMIT;
  if (query.limit !== undefined) {
    limit = parseIntegerParam(query.limit, 'limit');
    limit = Math.min(MAX_PULLS_LIMIT, Math.max(1, limit));
  }

  let rarity: number | undefined;
  if (query.rarity !== undefined) {
    rarity = parseIntegerParam(query.rarity, 'rarity');
    if (!RARITIES.has(rarity)) throw new BadRequestException('Invalid rarity');
  }

  if (query.bannerType !== undefined && !PULLS_BANNER_TYPES.has(query.bannerType)) {
    throw new BadRequestException('Invalid bannerType');
  }
  if (query.bannerId !== undefined && !BANNER_ID_PATTERN.test(query.bannerId)) {
    throw new BadRequestException('Invalid bannerId');
  }
  if (query.streakOutcome !== undefined && !STREAK_OUTCOMES.has(query.streakOutcome)) {
    throw new BadRequestException('Invalid streakOutcome');
  }
  if (query.slot !== undefined && !MATRIX_SLOTS.has(query.slot)) {
    throw new BadRequestException('Invalid slot');
  }
  if (query.cursor !== undefined && query.cursor.length > 512) {
    throw new BadRequestException('Invalid cursor');
  }

  return {
    bannerType: query.bannerType,
    bannerId: query.bannerId,
    rarity,
    streakOutcome: query.streakOutcome,
    slot: query.slot,
    cursor: query.cursor,
    limit,
  };
}

export function parseAnalyticsQuery(query: { bannerType?: string; bannerId?: string }): {
  bannerType: 'weapon_limited' | 'matrix_limited';
  bannerId?: string;
} {
  const bannerType = query.bannerType ?? 'weapon_limited';
  if (!ANALYTICS_BANNER_TYPES.has(bannerType)) throw new BadRequestException('Invalid bannerType');
  if (query.bannerId !== undefined && !BANNER_ID_PATTERN.test(query.bannerId)) {
    throw new BadRequestException('Invalid bannerId');
  }
  return { bannerType: bannerType as 'weapon_limited' | 'matrix_limited', bannerId: query.bannerId };
}

const EXPORT_WINDOW_MS = 60_000;
const EXPORT_MAX_PER_WINDOW = 30;
const exportHits = new Map<string, number[]>();

/** Tiny in-memory per-IP throttle for the full-history export endpoint. */
export function assertExportRateLimit(ip: string): void {
  const now = Date.now();
  const hits = (exportHits.get(ip) ?? []).filter((at) => now - at < EXPORT_WINDOW_MS);
  if (hits.length >= EXPORT_MAX_PER_WINDOW) {
    throw new HttpException('Too many export requests', HttpStatus.TOO_MANY_REQUESTS);
  }
  hits.push(now);
  if (!exportHits.has(ip) && exportHits.size >= 10_000) {
    for (const [key, values] of exportHits) if (values.every(at => now-at >= EXPORT_WINDOW_MS)) exportHits.delete(key);
    if (exportHits.size >= 10_000) throw new HttpException('Export service is busy', HttpStatus.SERVICE_UNAVAILABLE);
  }
  exportHits.set(ip, hits);
}

export function __resetExportRateLimitForTests(): void {
  exportHits.clear();
}
