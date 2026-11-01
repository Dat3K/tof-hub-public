import { z } from 'zod';

export const PetsDatasetItemRawSchema = z.object({
  id: z.string(),
  category: z.string().optional(),
  source_edition: z.string().optional(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  original_name: z.string().optional(),
  desc_en: z.string().optional(),
  desc_ru: z.string().optional(),
  quality: z.string().optional(),
  element: z.string().optional(),
  element_norm: z.string().optional(),
  property: z.string().optional(),
  role: z.string().optional(),
  role_norm: z.string().optional(),
  icon: z.string().optional(),
  photo: z.string().optional(),
  token_icon: z.string().optional(),
  media: z.record(z.string(), z.unknown()).optional(),
  stars: z.array(z.record(z.string(), z.unknown())).optional(),
  stats_progression: z.record(z.string(), z.unknown()).nullable().optional(),
  skills: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const PetModuleRawSchema = z.object({
  id: z.string(),
  group_id: z.string().optional(),
  family_id: z.string().optional(),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  owner: z.string().nullable().optional(),
  quality: z.string().optional(),
  need_load: z.number().optional(),
  icon: z.string().optional(),
  levels: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const PetsDatasetSchema = z.object({
  schemaVersion: z.number().optional(),
  generatedAt: z.string().optional(),
  total: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number()).optional(),
  items: z.array(PetsDatasetItemRawSchema),
  pets: z.array(PetsDatasetItemRawSchema).optional(),
  modules: z.array(PetModuleRawSchema).optional(),
  module_families: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type PetsDataset = z.infer<typeof PetsDatasetSchema>;
