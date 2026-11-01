import { z } from 'zod';
import { RaritySchema } from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';

export const MatrixPieceSchema = z.object({
  slot: z.string(),
  id: z.string(),
  name: LocalizedTextSchema,
  icon: z.string(),
  stats: z
    .array(
      z.object({
        name: z.string(),
        value: z.number(),
      })
    )
    .optional(),
});

export const MatrixEffectStarSchema = z.object({
  star: z.number(),
  text: LocalizedTextSchema,
  html: LocalizedTextSchema.optional(),
  csScore: z.number().optional(),
  buffId: z.string().optional(),
  isGlobal: z.boolean().optional(),
});

export const MatrixEffectSchema = z.object({
  pieceCount: z.number(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  buffId: z.string().nullable(),
  stars: z.array(MatrixEffectStarSchema),
});

export const MatrixCarrierSchema = z.object({
  id: z.string(),
  name: LocalizedTextSchema,
  weaponName: LocalizedTextSchema.optional(),
  element: z.string().optional(),
  role: z.string().optional(),
});

export const MatrixSuitCoreSchema = z.object({
  stableId: z.string(),
  slug: z.string(),
  name: LocalizedTextSchema,
  quality: RaritySchema,
  icon: z.string(),
  suitPortrait: z.string(),
  remouldIcon: z.string().nullable(),
});

export const MatrixSuitDetailSchema = MatrixSuitCoreSchema.extend({
  pieces: z.array(MatrixPieceSchema),
  effects: z.array(MatrixEffectSchema),
  carriers: z.array(MatrixCarrierSchema),
  isOpened: z.boolean().optional(),
  playableCarrier: z.boolean().optional(),
  hasCarrier: z.boolean().optional(),
});
