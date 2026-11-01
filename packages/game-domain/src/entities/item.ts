import type { LocalizedText } from '../common/localization';
import type { ItemQuality, Rarity } from '../common/rarities';

export interface DatamineItemCore {
  /**
   * Game stable identifier (e.g. stave_thunder_plasm, Item_Cooking_3013)
   */
  stableId: string;
  name: LocalizedText;
  originalName: string;
  rename?: string;
  quality: ItemQuality;
  rarity: Rarity;
  icon: string;
  description: LocalizedText;
}

/**
 * Maps raw game item quality enum to unified canonical Rarity.
 */
export function itemQualityToRarity(quality: ItemQuality | string): Rarity {
  switch (quality) {
    case 'ITEM_QUALITY_COMMON':
      return 'N';
    case 'ITEM_QUALITY_FINE':
      return 'R';
    case 'ITEM_QUALITY_RARE':
      return 'SR';
    case 'ITEM_QUALITY_EPIC':
      return 'SSR';
    case 'ITEM_QUALITY_LEGENDRY':
      return 'SSR';
    default:
      return 'N';
  }
}
