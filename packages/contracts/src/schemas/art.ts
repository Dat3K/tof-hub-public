import { z } from 'zod';
import type { ArtworkCore, ArtworkCategory } from '@tof-hub/game-domain';

export const ArtworkCategorySchema = z.enum([
  'wallpapers',
  'characters',
  'character_bg',
  'events',
  'gashapon',
  'loading',
  'others',
]) as z.ZodType<ArtworkCategory>;

export const ArtworkCoreSchema = z.object({
  stableId: z.string(),
  title: z.string(),
  category: ArtworkCategorySchema,
  subCategory: z.string().nullable(),
  themeTag: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  aspectRatio: z.number(),
  aspectLabel: z.string(),
  url: z.string(),
  webpUrl: z.string(),
  pngUrl: z.string(),
  thumbUrl: z.string(),
  sizeBytes: z.number(),
  pngSizeBytes: z.number().optional(),
  characterKey: z.string().nullable().optional(),
  characterName: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
}) as z.ZodType<ArtworkCore>;
