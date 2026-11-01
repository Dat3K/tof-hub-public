import type { LocalizedText } from './localization';

export interface IdentifierTuple {
  /**
   * The canonical, immutable engine identifier (e.g. imitation_56, Suit_SSR70, artifact_ssr_028)
   */
  stableId: string;
  /**
   * URL-safe ASCII slug used in routing and filenames (e.g. rei-ayanami, child-of-lockhart)
   */
  slug: string;
  /**
   * Localized display name (never used as a dictionary key)
   */
  name: LocalizedText;
}

export function slugify(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
