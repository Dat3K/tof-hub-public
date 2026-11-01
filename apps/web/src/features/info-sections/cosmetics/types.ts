import type { BaseCatalogViewProps } from '../common/types';
import type { CosmeticsDataset, CosmeticAnimation } from '@tof-hub/contracts';

export type CosmeticCategory =
  | 'all'
  | 'SimulacrumHauteCouture'
  | 'Dress'
  | 'Headwear'
  | 'Glider'
  | 'GuideNPC'
  | 'Medal'
  | 'CutePet'
  | 'Mount'
  | 'Enemies'
  | 'Title'
  | 'Avatar'
  | 'AvatarFrame'
  | 'ChatBubble'
  | 'ChatBox'
  | 'ChatSticker'
  | 'Badge';

export interface MountCraftingPart {
  id: string;
  name?: string;
  name_en?: string;
  name_ru?: string;
  title?: string;
  count?: number;
  quantity?: number;
  quality?: string;
  rarity?: string;
  icon?: string;
  source?: string;
  source_en?: string;
  source_ru?: string;
  location?: string;
  location_en?: string;
  location_ru?: string;
  drop_rate?: string;
  dropRate?: string;
  lore?: string;
  lore_en?: string;
  lore_ru?: string;
}

export interface CosmeticItem {
  id: string;
  category?: string;
  rarity?: string;
  quality?: string;
  icon?: string;
  photo?: string;
  painting?: string;
  animation?: CosmeticAnimation;
  fashion_type?: string | null;
  movement_type?: string | null;
  movement?: string | null;
  mount_type?: string | null;
  sort_order?: number;
  is_simulacrum?: boolean;
  name?: string;
  name_en?: string;
  name_ru?: string;
  name_cn?: string;
  description?: string;
  desc_en?: string;
  desc_ru?: string;
  unlock?: string;
  unlock_en?: string;
  unlock_ru?: string;
  source?: string;
  source_en?: string;
  source_ru?: string;
  active_source?: string;
  sub_type?: string;
  sub_type_en?: string;
  sub_type_ru?: string;
  pet_type?: string;
  owner_simulacrum_id?: string;
  parts?: MountCraftingPart[];
}

export interface CosmeticsStrings {
  eyebrow: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  filterCategory: string;
  all: string;
  typeHauteCouture: string;
  typeDress: string;
  typeHeadwear: string;
  typeGlider: string;
  typeServant: string;
  typeMedal: string;
  typeCutePet: string;
  typeMount: string;
  typeEnemies: string;
  typeTitle: string;
  typeAvatar: string;
  typeAvatarFrame: string;
  typeChatBubble: string;
  typeChatBox: string;
  typeChatSticker: string;
  typeBadge: string;
  animated: string;
  mediaEffect: string;
  imageUnavailable: string;
  animationUnavailable: string;
  animationTimingInferred: string;
  mountGround: string;
  mountUnderwater: string;
  mountMovement: string;
  mountCraftingParts: string;
  mountDropRate: string;
  mountAcquisition: string;
  petTypeCommon: string;
  petTypeFish: string;
  infoPetType: string;
  sortBy: string;
  sortOrderDesc: string;
  sortOrderAsc: string;
  sortName: string;
  sortNameDesc: string;
  sortQuality: string;
  sortQualityAsc: string;
  sortIdDesc: string;
  sortIdAsc: string;
  showing: string;
  of: string;
  items: string;
  noMatches: string;
  infoSource: string;
  infoAsset: string;
  infoOwner: string;
  copyPath: string;
  copied: string;
  resetFilters: string;
  paintingView: string;
  preview: string;
  itemFallback: string;
  downloadPng: string;
  downloadWebp: string;
  downloadGif: string;
  close: string;
  loading: string;
}

export type CosmeticsCatalogViewProps = BaseCatalogViewProps<CosmeticsDataset> & {
  initialCategory?: CosmeticCategory | null;
  initialSearchQuery?: string;
  initialSort?: string | null;
};

export interface CosmeticCardItemProps {
  item: CosmeticItem;
  strings: CosmeticsStrings;
  isRu: boolean;
  onClick: (item: CosmeticItem) => void;
}

export interface CosmeticDetailModalProps {
  isOpen: boolean;
  item: CosmeticItem | null;
  onClose: () => void;
  isRu: boolean;
  strings: CosmeticsStrings;
  onOpenLightbox: (src: string, caption: string, webpSrc?: string, animation?: CosmeticAnimation) => void;
}
