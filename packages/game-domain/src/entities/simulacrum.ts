import type { Element } from '../common/elements';
import type { Rarity } from '../common/rarities';
import type { WeaponRole } from '../common/roles';
import type { ServerMode } from '../common/server-mode';
import type { LocalizedText } from '../common/localization';
import type { WeaponDetail } from './weapon';

export interface SimulacrumAdvancement {
  star: number;
  name: LocalizedText;
  description: LocalizedText;
  multipliers?: Record<string, number>;
}

export interface SimulacrumTrait {
  affinity: number;
  name: LocalizedText;
  description: LocalizedText;
  value?: number;
}

export interface SimulacrumAffinityMilestone {
  levelPts: number;
  atk: number;
  hp: number;
}

export interface SimulacrumCore {
  /**
   * Stable engine identifier (e.g. imitation_56, AyanamiRei)
   */
  stableId: string;
  /**
   * URL-safe slug (e.g. rei-ayanami)
   */
  slug: string;
  name: LocalizedText;
  rarity: Rarity;
  element: Element;
  elementSecondary: Element | null;
  role: WeaponRole;
  serverMode: ServerMode;
  weaponId: string;
  weaponName: LocalizedText;
  matrixSuitId: string | null;
  avatar: string;
  card: string;
}

export interface SimulacrumSummary extends SimulacrumCore {
  avatarId: string | null;
  imitationId: string | null;
  matrixSuitNum: number | null;
  resonance: string | null;
  season: string | null;
  icon: string;
  portrait: string;
  detailArt: string;
}

export interface SimulacrumDetail extends SimulacrumSummary {
  baseStats: Record<string, number>;
  maxStats: Record<string, number>;
  advancements: SimulacrumAdvancement[];
  traits: SimulacrumTrait[];
  affinityLadder: SimulacrumAffinityMilestone[];
  weapon: WeaponDetail;
  matrix: {
    suitId: string;
    suitName: LocalizedText;
    chipIcon?: string;
    suitIcon?: string;
  } | null;
  provenance: Record<string, unknown> | null;
}
