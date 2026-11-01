import type { Rarity } from '../common/rarities';
import type { LocalizedText } from '../common/localization';
import type { RelicProperty } from '../entities/relic';

export interface CompRelicStar {
  star: number;
  desc: LocalizedText;
}

export interface CompRelicView {
  serverMode?: 'standard' | 'mmo';
  id: string; // e.g. "artifact_ssr_028"
  name: LocalizedText;
  quality: Rarity;
  property: RelicProperty;
  category?: 'damage' | 'defense' | 'utility';
  icon: string;
  desc: LocalizedText;
  stars: CompRelicStar[];
  aliases?: string[];
}
