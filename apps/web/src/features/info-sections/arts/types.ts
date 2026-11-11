import type { BaseCatalogViewProps } from '../common/types';
import type { ArtworksDataset } from '@tof-hub/contracts';

export type ArtCategory =
  | 'all'
  | 'new'
  | 'wallpapers'
  | 'loading'
  | 'character_bg'
  | 'characters'
  | 'gashapon'
  | 'events'
  | 'others';

export interface ArtworkItem {
  id: string;
  title?: string | { en?: string; ru?: string };
  category?: string;
  subCategory?: string | null;
  themeTag?: string | null;
  width?: number;
  height?: number;
  aspectRatio?: number | string;
  aspectLabel?: string;
  url?: string;
  webpUrl?: string;
  pngUrl?: string;
  thumbUrl?: string;
  originalFileName?: string;
  sourcePath?: string;
  sizeBytes?: number;
  pngSizeBytes?: number;
  characterKey?: string | null;
  characterName?: string | { en?: string; ru?: string } | null;
  season?: string | number | null;
  addedInRevision?: number;
  addedInVersion?: string | null;
  isNew?: boolean;
}

export interface ArtsStrings {
  eyebrow: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  filterCategory: string;
  tabAll: string;
  tabNew: string;
  tabWallpapers: string;
  tabLoading: string;
  tabCharacterBg: string;
  tabCharacters: string;
  tabGashapon: string;
  tabEvents: string;
  tabOthers: string;
  badgeWallpaper: string;
  badgeCharacterArt: string;
  badgeCharacterBg: string;
  badgeLoading: string;
  badgeGashapon: string;
  badgeEvents: string;
  badgeOthers: string;
  sortBy: string;
  sortDefault: string;
  sortReleaseDesc: string;
  sortReleaseAsc: string;
  sortTitle: string;
  sortTitleDesc: string;
  sortRes: string;
  sortResAsc: string;
  sortSize: string;
  sortSizeAsc: string;
  showing: string;
  of: string;
  artworks: string;
  noResultsTitle: string;
  noResultsDesc: string;
  resetFilters: string;
  download: string;
  copyPath: string;
  copied: string;
  zoom: string;
  resolution: string;
  fileSize: string;
  gamePath: string;
  preview: string;
  itemFallback: string;
  prev: string;
  next: string;
  close: string;
  loading: string;
}

export type ArtsCatalogViewProps = BaseCatalogViewProps<ArtworksDataset> & {
  initialCategory?: ArtCategory | null;
  initialSearchQuery?: string;
  initialSort?: string | null;
};

export interface ArtCardItemProps {
  artwork: ArtworkItem;
  strings: ArtsStrings;
  isRu: boolean;
  locale?: string;
  index: number;
  onClick: (index: number) => void;
}

export interface ArtLightboxModalProps {
  isOpen: boolean;
  artworks: ArtworkItem[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  strings: ArtsStrings;
  isRu: boolean;
  locale?: string;
}
