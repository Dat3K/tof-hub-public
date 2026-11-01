import {z} from 'zod';
import {canSaveBuildCapture} from './capture-session';
import {playerServerRefusal, resolvePlayerServer} from './wish/servers';
import type {BuildCapture} from './build-capture';

/**
 * Public MMO (Warp) build cards per character UID (docs/imports.md): one card per role,
 * opened at /tools/build/mmo/<uid>/<role>/. The roles are the player's choice (no element: MMO has no GRV rating).
 */
export const MMO_PROFILE_ROLES = ['dps', 'tank', 'healer', 'balance'] as const;
export type MmoProfileRole = (typeof MMO_PROFILE_ROLES)[number];
export const isMmoProfileRole = (value: unknown): value is MmoProfileRole => MMO_PROFILE_ROLES.includes(value as MmoProfileRole);

export interface MmoProfileSummary {
  role: MmoProfileRole;
  name: string | null;
  savedAt: string;
  capturedAt: string;
}

/**
 * A signed MMO capture that may become public: the `mmo` block, a verified live scan (no test or DEV client) and a
 * catalog Warp server. Null when allowed, otherwise the reason.
 */
export function mmoProfileRefusal(capture: BuildCapture): 'not-mmo' | 'test-capture' | 'not-warp' | null {
  if (!capture.mmo) return 'not-mmo';
  if (!canSaveBuildCapture(capture.capture.scan)) return 'test-capture';
  const uid = capture.capture.subject.uid;
  return playerServerRefusal({uid}) === 'unsupported-game' && resolvePlayerServer({uid}).regionCode === 'WS' ? null : 'not-warp';
}

export const MmoProfileDirectoryQuerySchema = z.object({
  q: z.string().trim().max(40).default(''),
  role: z.enum(MMO_PROFILE_ROLES).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type MmoProfileDirectoryQuery = z.infer<typeof MmoProfileDirectoryQuerySchema>;
export interface MmoProfileDirectoryEntry {
  uid: string; name: string | null; serverId: string | null; updatedAt: string; profiles: MmoProfileSummary[];
}
export interface MmoProfileDirectoryResponse {
  available: boolean; entries: MmoProfileDirectoryEntry[]; total: number; offset: number; limit: number;
}
