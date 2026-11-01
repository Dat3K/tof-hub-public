import { z } from 'zod';

/** Animation is published only after its frame layout/timing and generated files are verified. */
export const CosmeticAnimationSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('unresolved'),
    kind: z.enum(['material', 'dynamic-emoji']),
    references: z.array(z.object({field: z.string(), asset: z.string().optional(), value: z.string().optional()})),
  }),
  z.object({
    status: z.literal('ready'),
    posterPng: z.string(), posterWebp: z.string(), gif: z.string(), webp: z.string(),
    frameCount: z.number().int().min(2), durationMs: z.number().positive(),
    /** `inferred`: frame order/timing derived from material parameters, not read from a cooked graph. */
    timing: z.enum(['verified', 'inferred']),
    /** Game reference the animation was rendered from (e.g. the sticker material), never a generated file. */
    source: z.string().optional(),
  }),
]);
export type CosmeticAnimation = z.infer<typeof CosmeticAnimationSchema>;

export const CosmeticAvatarRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  rarity: z.string().optional(),
  quality: z.string().optional(),
  icon: z.string().optional(),
});

export const CosmeticAvatarFrameRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  rarity: z.string().optional(),
  quality: z.string().optional(),
  description_en: z.string().optional(),
  description_ru: z.string().optional(),
  icon: z.string().optional(),
});

export const CosmeticMountRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  desc_en: z.string().optional(),
  desc_ru: z.string().optional(),
  description_en: z.string().optional(),
  description_ru: z.string().optional(),
  unlock_en: z.string().optional(),
  unlock_ru: z.string().optional(),
  source_en: z.string().optional(),
  source_ru: z.string().optional(),
  fashion_type: z.string().optional(),
  movement_type: z.string().optional(),
  mount_type: z.string().optional(),
  icon: z.string().optional(),
  photo: z.string().optional(),
  max_level: z.number().optional(),
  max_strengthen_level: z.number().optional(),
});

export const CosmeticOutfitRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  desc_en: z.string().optional(),
  desc_ru: z.string().optional(),
  fashion_type: z.string().optional(),
  quality: z.string().optional(),
  sort_order: z.number().optional(),
  icon: z.string().optional(),
  is_simulacrum: z.boolean().optional(),
});

export const CosmeticTitleRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  rarity: z.string().optional(),
  quality: z.string().optional(),
  description_en: z.string().optional(),
  description_ru: z.string().optional(),
  icon: z.string().optional(),
});

export const CosmeticCutePetRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  desc_en: z.string().optional(),
  desc_ru: z.string().optional(),
  fashion_type: z.string().optional(),
  quality: z.string().optional(),
  sort_order: z.number().optional(),
  pet_type: z.string().optional(),
  sub_type_en: z.string().optional(),
  sub_type_ru: z.string().optional(),
  icon: z.string().optional(),
});

export const CosmeticsDatasetSchema = z.object({
  schemaVersion: z.number().optional(),
  generatedAt: z.string().optional(),
  counts: z.record(z.string(), z.number()).optional(),
  categories: z.array(z.unknown()).optional(),
});

export type CosmeticsDataset = z.infer<typeof CosmeticsDatasetSchema>;
