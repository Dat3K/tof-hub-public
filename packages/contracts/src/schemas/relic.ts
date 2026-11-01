import { z } from 'zod';
import { RaritySchema, ServerModeSchema, RelicPropertySchema } from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';

export const RelicStarEffectSchema = z.object({
  star: z.number(),
  description: LocalizedTextSchema,
});

export const RelicCoreSchema = z.object({
  id: z.string(),
  stableId: z.string(),
  slug: z.string(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  quality: RaritySchema,
  property: RelicPropertySchema,
  serverMode: ServerModeSchema,
  icon: z.string(),
  cardImage: z.string(),
});

export const RelicDetailSchema = RelicCoreSchema.extend({
  stars: z.array(RelicStarEffectSchema),
  cooldown: z.number().nullable(),
  fragmentItemId: z.string().nullable(),
  abilityTag: z.string().nullable(),
  advanceAttributeId: z.string().nullable().optional(),
  drawing: z.string().nullable(),
  variants: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])).optional(),
});
