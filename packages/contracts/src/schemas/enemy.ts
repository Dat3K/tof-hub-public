import { z } from 'zod';
import { ElementSchema } from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';

export const EnemyKindSchema = z.enum(['normal', 'elite', 'boss']);

export const MonsterTypeSchema = z.enum([
  'BS_MONSTER_NORMAL',
  'BS_MONSTER_ELITE',
  'BS_MONSTER_BOSS',
]);

export const EnemyCoreSchema = z.object({
  stableId: z.string(),
  codeName: z.string(),
  name: LocalizedTextSchema,
  kind: EnemyKindSchema,
  monsterType: MonsterTypeSchema.optional(),
  element: z.union([ElementSchema, z.literal('None')]),
  image: z.string().nullable().optional(),
  thumb: z.string().nullable().optional(),
});

export const BossMechanicSchema = z.object({
  index: z.string(),
  description: LocalizedTextSchema,
  html: LocalizedTextSchema.optional(),
});

export const BossSummarySchema = z.object({
  slug: z.string(),
  bossId: z.string(),
  bossNum: z.number().int(),
  order: z.number().int().optional(),
  name: LocalizedTextSchema,
  nameColor: z.string(),
  art: z.string(),
  preview: z.string(),
  lineupPortrait: z.string(),
  lineupPortraitThumb: z.string().optional(),
  downloadPngUrl: z.string().optional(),
  mechanicsCount: z.number().int().nonnegative(),
  hasMechanics: z.boolean(),
  ladderLevel: z.number().int().optional(),
  ladderKey: z.string().optional(),
});

export const BossDetailSchema = BossSummarySchema.extend({
  sourcePsd: z.string().optional(),
  artObjectPosition: z.string().optional(),
  mechanics: z.array(BossMechanicSchema),
});

export type EnemyCoreDto = z.infer<typeof EnemyCoreSchema>;
export type BossMechanicDto = z.infer<typeof BossMechanicSchema>;
export type BossSummaryDto = z.infer<typeof BossSummarySchema>;
export type BossDetailDto = z.infer<typeof BossDetailSchema>;
