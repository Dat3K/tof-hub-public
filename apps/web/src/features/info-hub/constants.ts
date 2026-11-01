import type { InfoCardConfig } from './types';

export const INFO_SECTION_CARDS: InfoCardConfig[] = [
  // Two newest sets plus two random ones (the summary lists every SSR set, newest first).
  { id: 'matrices', href: '/info/matrices/', countUnit: 'sets', stripPreview: { head: 2, middle: 2 } },
  { id: 'relics', href: '/info/relics/', countUnit: 'gadgets' },
  { id: 'pets', href: '/info/pets/', countUnit: 'companions' },
  { id: 'food', href: '/info/food/', countUnit: 'recipes' },
  { id: 'cosmetics', href: '/info/cosmetics/', countUnit: 'items' },
  { id: 'arts', href: '/info/arts/', countUnit: 'artworks', wideStrip: true },
];
