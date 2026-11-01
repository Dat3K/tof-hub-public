import type { Rarity } from '../common/rarities';
import type { LocalizedText } from '../common/localization';

export type MatrixSlot = 'emotion' | 'mind' | 'faith' | 'memory';

export interface MatrixPiece {
  slot: MatrixSlot | string;
  id: string;
  name: LocalizedText;
  icon: string;
  stats?: Array<{ name: string; value: number }>;
}

export interface MatrixEffectStar {
  star: number;
  text: LocalizedText;
  html?: LocalizedText;
  csScore?: number;
  buffId?: string;
  isGlobal?: boolean;
}

export interface MatrixEffect {
  pieceCount: number; // 2, 3, 4
  name: LocalizedText;
  description: LocalizedText;
  buffId: string | null;
  stars: MatrixEffectStar[];
}

export interface MatrixCarrier {
  id: string;
  name: LocalizedText;
  weaponName?: LocalizedText;
  element?: string;
  role?: string;
}

export interface MatrixSuitCore {
  /**
   * Stable engine matrix suit identifier (e.g. Suit_SSR70)
   */
  stableId: string;
  /**
   * URL-safe slug (e.g. child-of-lockhart)
   */
  slug: string;
  name: LocalizedText;
  quality: Rarity;
  icon: string;
  suitPortrait: string;
  remouldIcon: string | null;
}

export interface MatrixSuitDetail extends MatrixSuitCore {
  pieces: MatrixPiece[];
  effects: MatrixEffect[];
  carriers: MatrixCarrier[];
  isOpened?: boolean;
  playableCarrier?: boolean;
  hasCarrier?: boolean;
}
