import type { Rarity } from '../common/rarities';
import type { LocalizedText } from '../common/localization';

export interface CompPetStar {
  star: number;
  desc: LocalizedText;
}

export interface CompPetView {
  id: string; // e.g. "FightPet_1"
  name: LocalizedText;
  quality: Rarity;
  icon: string;
  stars: CompPetStar[];
}
