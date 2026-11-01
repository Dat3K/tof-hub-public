import type { LocalizedText } from '../common/localization';

export type CompRoleKey = 'tank' | 'dps' | 'support' | 'balanced';

export interface CompRole {
  id: CompRoleKey;
  name: LocalizedText;
  short: LocalizedText;
  color: string;
  bgColor: string;
  icon: string;
}

export const COMP_ROLE_KEYS: readonly CompRoleKey[] = [
  'tank',
  'dps',
  'support',
  'balanced',
] as const;

export function canonicalizeCompRole(raw: string | null | undefined): CompRoleKey {
  if (!raw) return 'dps';
  const norm = raw.trim().toLowerCase();
  switch (norm) {
    case 'tank':
    case 'fortitude':
      return 'tank';
    case 'support':
    case 'benediction':
      return 'support';
    case 'balance':
    case 'balanced':
      return 'balanced';
    case 'dps':
    case 'attack':
    default:
      return 'dps';
  }
}
