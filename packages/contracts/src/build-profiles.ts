import { z } from 'zod';

/**
 * Saved build-card profiles per character UID (docs/imports.md): one card per
 * role × rated element, opened at /tools/build/<uid>/<role>-<element>/. Shared by the API and the Build page.
 */
export const PROFILE_ROLES = ['dps', 'healer', 'tank'] as const;
export const PROFILE_ELEMENTS = ['Frost', 'Volt', 'Flame', 'Physical', 'Altered'] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];
export type ProfileElement = (typeof PROFILE_ELEMENTS)[number];

/** Position of a signed equipped set among players' best known sets, from a profile or verified import. */
export interface EquippedBuildRanking {
  available: boolean;
  digest?: string;
  track?: string;
  global?: number;
  region?: {code: string; rank: number} | null;
  calculatedAt?: string;
}

export function equippedRankingTrack(element: ProfileElement): string[] {
  return element === 'Frost' || element === 'Volt' ? ['Frost', 'Volt']
    : element === 'Physical' || element === 'Flame' ? ['Physical', 'Flame'] : [element];
}

/** URL slot of a profile: `dps-frost`, `healer-volt`, `tank-physical`. */
export const profileSlot = (role: ProfileRole, element: ProfileElement) => `${role}-${element.toLowerCase()}`;

export function parseProfileSlot(slot: string | null | undefined): { role: ProfileRole; element: ProfileElement } | null {
  const [role, element] = (slot ?? '').split('-');
  const matched = PROFILE_ELEMENTS.find((item) => item.toLowerCase() === element);
  return PROFILE_ROLES.includes(role as ProfileRole) && matched ? { role: role as ProfileRole, element: matched } : null;
}

/** A background from the site's art catalog with its framing; custom images are never stored. */
export const ProfileArtSchema = z.object({
  id: z.string().regex(/^[\w.-]{1,160}$/),
  zoom: z.number().finite().min(0.1).max(10),
  x: z.number().finite().min(-1e4).max(1e4),
  y: z.number().finite().min(-1e4).max(1e4),
  offsetX: z.number().finite().min(-1e4).max(1e4),
  offsetY: z.number().finite().min(-1e4).max(1e4),
}).strict();
export type ProfileArt = z.infer<typeof ProfileArtSchema>;

export interface ProfileSummary {
  role: ProfileRole;
  element: ProfileElement;
  slot: string;
  name: string | null;
  savedAt: string;
  capturedAt: string;
}
