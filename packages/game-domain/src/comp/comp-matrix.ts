import type { Rarity } from '../common/rarities';
import type { LocalizedText } from '../common/localization';

export interface CompMatrixCarrier {
  id: string;
  name: LocalizedText;
  weaponName?: LocalizedText;
  element?: string;
  role?: string;
}

export interface CompMatrixView {
  id: string; // e.g. "Suit_SSR70"
  name: LocalizedText;
  quality: Rarity;
  icon: string;
  suitPortrait: string;
  remouldIcon: string | null;
  desc2p: LocalizedText | null;
  desc3p: LocalizedText | null;
  desc4p: LocalizedText | null;
  simulacrumId?: string | null;
  simName?: LocalizedText | null;
  carriers?: CompMatrixCarrier[];
  aliases?: string[];
}
