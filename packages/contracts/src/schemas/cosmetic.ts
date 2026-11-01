import { z } from 'zod';
import { RaritySchema } from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';

export const AvatarCosmeticSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  quality: z.string(),
  icon: z.string(),
});

export const AvatarFrameCosmeticSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  quality: z.string(),
  description: LocalizedTextSchema,
  icon: z.string(),
});

export const ChatBackgroundCosmeticSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  quality: z.string(),
  description: LocalizedTextSchema,
  icon: z.string(),
});

export const MountCosmeticSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  quality: z.string(),
  description: LocalizedTextSchema,
  unlock: LocalizedTextSchema,
  source: LocalizedTextSchema,
  fashionType: z.string().optional(),
  movementType: z.string().optional(),
  mountType: z.string().optional(),
  icon: z.string(),
  photo: z.string(),
  maxLevel: z.number().optional(),
  maxStrengthenLevel: z.number().optional(),
});

export const OutfitCosmeticSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  fashionType: z.string(),
  quality: z.string(),
  sortOrder: z.number(),
  icon: z.string(),
  isSimulacrum: z.boolean(),
});

export const TitleCosmeticSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  quality: z.string(),
  description: LocalizedTextSchema,
  icon: z.string(),
});

export const CutePetCosmeticSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  fashionType: z.string(),
  quality: z.string(),
  sortOrder: z.number(),
  petType: z.string(),
  subType: LocalizedTextSchema,
  icon: z.string(),
});

export const CosmeticItemSchema = z.discriminatedUnion('kind', [
  AvatarCosmeticSchema.extend({ kind: z.literal('avatar') }),
  AvatarFrameCosmeticSchema.extend({ kind: z.literal('avatarFrame') }),
  ChatBackgroundCosmeticSchema.extend({ kind: z.literal('chatBackground') }),
  MountCosmeticSchema.extend({ kind: z.literal('mount') }),
  OutfitCosmeticSchema.extend({ kind: z.literal('outfit') }),
  TitleCosmeticSchema.extend({ kind: z.literal('title') }),
  CutePetCosmeticSchema.extend({ kind: z.literal('cutePet') }),
]);
