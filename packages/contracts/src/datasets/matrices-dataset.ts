import { z } from 'zod';

export const MatricesDatasetItemRawSchema = z.object({
  id: z.string(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  original_name: z.string().optional(),
  quality: z.string().optional(),
  icon: z.string().optional(),
  icon_thumb: z.string().optional(),
  piece_icon: z.string().optional(),
  piece_icon_thumb: z.string().optional(),
  suit_portrait: z.string().optional(),
  suit_portrait_thumb: z.string().optional(),
  remould_icon: z.string().nullable().optional(),
  remould_icon_thumb: z.string().nullable().optional(),
  is_opened: z.boolean().optional(),
  playable_carrier: z.boolean().optional(),
  has_carrier: z.boolean().optional(),
  pieces: z.array(z.record(z.string(), z.unknown())).optional(),
  effects: z.array(z.record(z.string(), z.unknown())).optional(),
  carriers: z.array(z.record(z.string(), z.unknown())).optional(),
  media: z.record(z.string(), z.unknown()).optional(),
});

export const MatricesDatasetSchema = z.object({
  schemaVersion: z.number().optional(),
  generatedAt: z.string().optional(),
  total: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number()).optional(),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
  items: z.array(MatricesDatasetItemRawSchema),
  suits: z.array(MatricesDatasetItemRawSchema).optional(),
});

export type MatricesDataset = z.infer<typeof MatricesDatasetSchema>;
