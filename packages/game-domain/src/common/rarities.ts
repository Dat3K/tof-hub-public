export type Rarity = 'SSR' | 'SR' | 'R' | 'N';

export const RARITIES: readonly Rarity[] = ['SSR', 'SR', 'R', 'N'] as const;

export type ItemQuality =
  | 'ITEM_QUALITY_POOR'
  | 'ITEM_QUALITY_COMMON'
  | 'ITEM_QUALITY_FINE'
  | 'ITEM_QUALITY_RARE'
  | 'ITEM_QUALITY_EPIC'
  | 'ITEM_QUALITY_LEGENDRY';

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && RARITIES.includes(value as Rarity);
}

export function normalizeRarity(raw: string | null | undefined): Rarity {
  if (!raw) return 'N';
  const norm = raw.trim().toUpperCase();
  switch (norm) {
    case 'SSR':
    case 'ORANGE':
    case 'GOLD':
      return 'SSR';
    case 'SR':
    case 'PURPLE':
      return 'SR';
    case 'R':
    case 'BLUE':
      return 'R';
    case 'N':
    case 'GREEN':
    case 'WHITE':
      return 'N';
    default:
      return 'N';
  }
}
