import type { Rarity } from '../common/rarities';
import type { ServerMode } from '../common/server-mode';
import type { LocalizedText } from '../common/localization';

export type RelicProperty = 'Attack' | 'Defense' | 'Assist' | 'Function';

export const RELIC_PROPERTIES: readonly RelicProperty[] = [
  'Attack',
  'Defense',
  'Assist',
  'Function',
] as const;

export function normalizeRelicProperty(raw: string | null | undefined): RelicProperty {
  if (!raw) return 'Attack';
  const norm = raw.trim().toLowerCase();
  switch (norm) {
    case 'attack':
    case 'damage':
      return 'Attack';
    case 'defense':
      return 'Defense';
    case 'assist':
    case 'support':
      return 'Assist';
    case 'function':
    case 'utility':
      return 'Function';
    default:
      return 'Attack';
  }
}

export interface RelicStarEffect {
  star: number;
  description: LocalizedText;
}

export interface RelicCore {
  /**
   * Specific edition identifier (e.g. artifact_ssr_028 or artifact_ssr_026-mmo)
   */
  id: string;
  /**
   * Canonical stable ID without edition suffix (e.g. artifact_ssr_028)
   */
  stableId: string;
  /**
   * URL-safe slug (e.g. escape-master)
   */
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  quality: Rarity;
  property: RelicProperty;
  serverMode: ServerMode;
  icon: string;
  cardImage: string;
}

export interface RelicDetail extends RelicCore {
  stars: RelicStarEffect[];
  cooldown: number | null;
  fragmentItemId: string | null;
  abilityTag: string | null;
  advanceAttributeId?: string | null;
  drawing: string | null;
  variants?: Array<string | Record<string, unknown>>;
}
