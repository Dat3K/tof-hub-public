import {formatServerDisplay,resolvePlayerServer} from '@tof-hub/contracts';
import type { ProfileAvatarImage } from '@tof-hub/ui';
import type { WishBannerDto, WishRecordDto } from '@tof-hub/contracts';
import type { WishPlayerProfile } from '../dev-players-data';

export const IMPORTED_PROFILE_IDS_KEY = 'tof-wish-imported-profile-ids';
const PROFILE_TOKENS_KEY = 'tof-wish-profile-tokens';
const TOKEN_PATTERN = /^wtk_[a-f0-9]{48}$/;

export interface ImportedProfileResponse {
  profile: {
    id: string; uid: string; name: string; region: string; server: string; updatedAt: string;
    avatarId?:string; avatarFrameId?:string; avatarCosmetic?:ProfileAvatarImage; avatarFrameCosmetic?:ProfileAvatarImage;
    pitySnapshots?: import('@tof-hub/contracts').WishPitySnapshot[];
  };
  records: WishRecordDto[];
  banners: WishBannerDto[];
}

export interface ImportedProfileEntry {
  player: WishPlayerProfile;
  banners: WishBannerDto[];
}

export function readImportedProfileIds(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(IMPORTED_PROFILE_IDS_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string' && /^import-[a-f0-9]{32}$/.test(id)).slice(0, 30)
      : [];
  } catch {
    return [];
  }
}

export function rememberImportedProfileId(id: string): void {
  if (!/^import-[a-f0-9]{32}$/.test(id)) return;
  window.localStorage.setItem(IMPORTED_PROFILE_IDS_KEY, JSON.stringify([id, ...readImportedProfileIds().filter((old) => old !== id)].slice(0, 30)));
}

export function forgetImportedProfileId(id: string): void {
  window.localStorage.setItem(IMPORTED_PROFILE_IDS_KEY, JSON.stringify(readImportedProfileIds().filter((old) => old !== id)));
  forgetProfileToken(id);
}

function readProfileTokens(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PROFILE_TOKENS_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const entries = Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] =>
        /^import-[a-f0-9]{32}$/.test(entry[0]) && typeof entry[1] === 'string' && TOKEN_PATTERN.test(entry[1])
    );
    return Object.fromEntries(entries.slice(0, 30));
  } catch {
    return {};
  }
}

/** Device token for this browser; sent as `x-wish-token` on profile reads. */
export function readProfileToken(profileId: string): string | null {
  try {
    return readProfileTokens()[profileId] ?? null;
  } catch {
    return null;
  }
}

export function rememberProfileToken(profileId: string, token: string): void {
  if (!/^import-[a-f0-9]{32}$/.test(profileId) || !TOKEN_PATTERN.test(token)) return;
  try {
    window.localStorage.setItem(PROFILE_TOKENS_KEY, JSON.stringify({ ...readProfileTokens(), [profileId]: token }));
  } catch {
    // Reads still work from a known IP without the stored token.
  }
}

export function forgetProfileToken(profileId: string): void {
  try {
    const tokens = readProfileTokens();
    delete tokens[profileId];
    window.localStorage.setItem(PROFILE_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Best effort only.
  }
}

export function toImportedProfileEntry(data: ImportedProfileResponse): ImportedProfileEntry {
  const records = [...data.records].sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
    || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '')
    || (a.item_index ?? 0) - (b.item_index ?? 0));
  const byTrack = {
    weaponLimited: records.filter((record) => record.banner_type === 'weapon_limited'),
    matrixLimited: records.filter((record) => record.banner_type === 'matrix_limited'),
    standardWeapon: records.filter((record) => record.banner_type === 'standard_weapon'),
    standardMatrix: records.filter((record) => record.banner_type === 'standard_matrix'),
    blackNucleus: records.filter((record) => record.banner_type === 'black_nucleus'),
  };
  const eventSsr = [...byTrack.weaponLimited, ...byTrack.matrixLimited].filter((record) => record.rarity === 5 && record.streak_outcome !== 'unknown');
  const wins = eventSsr.filter((record) => record.streak_outcome === 'win').length;
  const { server } = resolvePlayerServer({ uid: data.profile.uid, serverId: data.profile.server });
  return {
    player: {
      pitySnapshots: data.profile.pitySnapshots,
      id: data.profile.id, uid: data.profile.uid, nickname: data.profile.name,
      server: server ? formatServerDisplay(server) : data.profile.server, serverId: server?.id ?? data.profile.server,
      serverRegion: server?.region ?? 'Global', avatar: data.profile.avatarCosmetic?.icon ?? '',
      avatarCosmetic: data.profile.avatarCosmetic, avatarFrameCosmetic: data.profile.avatarFrameCosmetic,
      characterName: '', totalPulls: records.length,
      pullsByTrack: {
        weapon_limited: byTrack.weaponLimited.length,
        matrix_limited: byTrack.matrixLimited.length,
        standard_weapon: byTrack.standardWeapon.length,
        standard_matrix: byTrack.standardMatrix.length,
        black_nucleus: byTrack.blackNucleus.length,
      },
      ssrCount: records.filter((record) => record.rarity === 5).length,
      winRate5050: eventSsr.length ? wins / eventSsr.length * 100 : 0,
      lastActive: data.profile.updatedAt, tag: 'starter',
      getPulls: () => byTrack,
    },
    banners: data.banners,
  };
}
