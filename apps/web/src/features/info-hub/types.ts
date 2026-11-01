import type { HubPreviewShape } from '@/components/section-hub';
import type { HubInfoSection } from '@/lib/hub-summary';

export type InfoSectionId = 'simulacra' | HubInfoSection;

/** Fact keys emitted by scripts/generators/build-hub-summary.cjs. */
export type InfoFactKey =
  | 'sets'
  | 'ssr'
  | 'sr'
  | 'combat'
  | 'cute'
  | 'dishes'
  | 'ingredients'
  | 'potions'
  | 'outfits'
  | 'mounts'
  | 'titles'
  | 'season';

export interface InfoCardConfig {
  id: HubInfoSection;
  href: string;
  /** Unit after the card count. */
  countUnit: 'sets' | 'gadgets' | 'companions' | 'recipes' | 'items' | 'artworks';
  /** 16:9 thumbnails instead of square icons. */
  wideStrip?: boolean;
  /** Pick from a longer strip (head + random middle); without it the whole strip shows. */
  stripPreview?: HubPreviewShape;
}

export interface InfoHubStrings {
  heroTitle: string;
  heroSubtitle: string;
  sectionsAria: string;
  openPage: string;
  serverMode: string;
  gacha: string;
  mmo: string;
  slotLatest: string;
  slotPrevious: string;
  slotAltered: string;
  slotEarlier: string;
  mmoSeason: string;
  characters: string;
  sets: string;
  gadgets: string;
  companions: string;
  recipes: string;
  items: string;
  artworks: string;
  facts: Record<InfoFactKey, string>;
  simulacraTitle: string;
  simulacraDesc: string;
  matricesTitle: string;
  matricesDesc: string;
  relicsTitle: string;
  relicsDesc: string;
  petsTitle: string;
  petsDesc: string;
  foodTitle: string;
  foodDesc: string;
  cosmeticsTitle: string;
  cosmeticsDesc: string;
  artsTitle: string;
  artsDesc: string;
}
