import { z } from 'zod';

export const ArtworkRawSchema = z.object({
  id: z.string(),
  title: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  category: z.string().optional(),
  subCategory: z.string().nullable().optional(),
  themeTag: z.string().nullable().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  aspectRatio: z.union([z.number(), z.string()]).optional(),
  aspectLabel: z.string().optional(),
  url: z.string().optional(),
  webpUrl: z.string().optional(),
  pngUrl: z.string().optional(),
  thumbUrl: z.string().optional(),
  originalFileName: z.string().optional(),
  sourcePath: z.string().optional(),
  sizeBytes: z.number().optional(),
  pngSizeBytes: z.number().optional(),
  characterKey: z.string().nullable().optional(),
  characterName: z.union([z.string(), z.record(z.string(), z.string())]).nullable().optional(),
  season: z.union([z.string(), z.number()]).nullable().optional(),
});

export const ArtworksDatasetSchema = z.object({
  total: z.number().int().nonnegative(),
  categories: z.record(z.string(), z.number()).optional(),
  items: z.array(ArtworkRawSchema),
});

export type ArtworksDataset = z.infer<typeof ArtworksDatasetSchema>;
