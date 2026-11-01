import { z } from 'zod';

export const RelicsDatasetItemRawSchema = z.object({
  id: z.string(),
  canonical_id: z.string().optional(),
  server_mode: z.string().optional(),
  edition: z.string().optional(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  original_name: z.string().optional(),
  desc_en: z.string().optional(),
  desc_ru: z.string().optional(),
  quality: z.string().optional(),
  property: z.string().optional(),
  card_image: z.string().optional(),
  card_image_thumb: z.string().optional(),
  attack_icon: z.string().optional(),
  item_icon: z.string().optional(),
  drawing: z.string().nullable().optional(),
  fragment_item_id: z.string().nullable().optional(),
  ability_tag: z.string().nullable().optional(),
  cooldown: z.number().nullable().optional(),
  stars: z.array(z.record(z.string(), z.unknown())).optional(),
  effect_numbers: z.record(z.string(), z.unknown()).optional(),
  variants: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])).optional(),
});

export const RelicsDatasetSchema = z.object({
  schemaVersion: z.number().optional(),
  generatedAt: z.string().optional(),
  total: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number()).optional(),
  items: z.array(RelicsDatasetItemRawSchema),
  relics: z.array(RelicsDatasetItemRawSchema).optional(),
  gacha: z.array(RelicsDatasetItemRawSchema).optional(),
  mmo: z.array(RelicsDatasetItemRawSchema).optional(),
});

export type RelicsDataset = z.infer<typeof RelicsDatasetSchema>;
