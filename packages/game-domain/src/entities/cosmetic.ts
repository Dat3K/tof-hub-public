import type { Rarity } from '../common/rarities';
import type { LocalizedText } from '../common/localization';

export type CosmeticKind =
  | 'avatar'
  | 'avatarFrame'
  | 'chatBackground'
  | 'mount'
  | 'outfit'
  | 'title'
  | 'cutePet';

export interface CosmeticBase {
  stableId: string;
  name: LocalizedText;
  rarity: Rarity;
  quality: string;
  icon: string;
}

export type AvatarCosmetic = CosmeticBase;

export interface AvatarFrameCosmetic extends CosmeticBase {
  description: LocalizedText;
}

export interface ChatBackgroundCosmetic extends CosmeticBase {
  description: LocalizedText;
}

export interface MountCosmetic extends CosmeticBase {
  description: LocalizedText;
  unlock: LocalizedText;
  source: LocalizedText;
  fashionType?: string;
  movementType?: string;
  mountType?: string;
  photo: string;
  maxLevel?: number;
  maxStrengthenLevel?: number;
}

export interface OutfitCosmetic {
  stableId: string;
  name: LocalizedText;
  description: LocalizedText;
  fashionType: string;
  quality: string;
  sortOrder: number;
  icon: string;
  isSimulacrum: boolean;
}

export interface TitleCosmetic extends CosmeticBase {
  description: LocalizedText;
}

export interface CutePetCosmetic {
  stableId: string;
  name: LocalizedText;
  description: LocalizedText;
  fashionType: string;
  quality: string;
  sortOrder: number;
  petType: string;
  subType: LocalizedText;
  icon: string;
}

export type CosmeticItem =
  | ({ kind: 'avatar' } & AvatarCosmetic)
  | ({ kind: 'avatarFrame' } & AvatarFrameCosmetic)
  | ({ kind: 'chatBackground' } & ChatBackgroundCosmetic)
  | ({ kind: 'mount' } & MountCosmetic)
  | ({ kind: 'outfit' } & OutfitCosmetic)
  | ({ kind: 'title' } & TitleCosmetic)
  | ({ kind: 'cutePet' } & CutePetCosmetic);
