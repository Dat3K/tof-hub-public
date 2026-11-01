import { z } from 'zod';
import { LocalizedTextSchema } from '../common/localization';
import { RaritySchema } from '../common/enums';

export const ItemQualitySchema = z.enum([
  'ITEM_QUALITY_POOR',
  'ITEM_QUALITY_COMMON',
  'ITEM_QUALITY_FINE',
  'ITEM_QUALITY_RARE',
  'ITEM_QUALITY_EPIC',
  'ITEM_QUALITY_LEGENDRY',
]);

export const DatamineItemCoreSchema = z.object({
  stableId: z.string(),
  name: LocalizedTextSchema,
  originalName: z.string(),
  rename: z.string().optional(),
  quality: ItemQualitySchema,
  rarity: RaritySchema,
  icon: z.string(),
  description: LocalizedTextSchema,
});

export type ItemQualityDto = z.infer<typeof ItemQualitySchema>;
export type DatamineItemCoreDto = z.infer<typeof DatamineItemCoreSchema>;
