import { z } from 'zod';
import {
  ElementSchema,
  RaritySchema,
  WeaponRoleSchema,
  ServerModeSchema,
} from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';
import { WeaponDetailSchema } from './weapon';

export const SimulacrumAdvancementSchema = z.object({
  star: z.number(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  multipliers: z.record(z.string(), z.number()).optional(),
});

export const SimulacrumTraitSchema = z.object({
  affinity: z.number(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  value: z.number().optional(),
});

export const SimulacrumAffinityMilestoneSchema = z.object({
  levelPts: z.number(),
  atk: z.number(),
  hp: z.number(),
});

export const SimulacrumCoreSchema = z.object({
  stableId: z.string(),
  slug: z.string(),
  name: LocalizedTextSchema,
  rarity: RaritySchema,
  element: ElementSchema,
  elementSecondary: ElementSchema.nullable(),
  role: WeaponRoleSchema,
  serverMode: ServerModeSchema,
  weaponId: z.string(),
  weaponName: LocalizedTextSchema,
  matrixSuitId: z.string().nullable(),
  avatar: z.string(),
  card: z.string(),
});

export const SimulacrumSummarySchema = SimulacrumCoreSchema.extend({
  avatarId: z.string().nullable(),
  imitationId: z.string().nullable(),
  matrixSuitNum: z.number().nullable(),
  resonance: z.string().nullable(),
  season: z.string().nullable(),
  icon: z.string(),
  portrait: z.string(),
  detailArt: z.string(),
});

export const SimulacrumDetailSchema = SimulacrumSummarySchema.extend({
  baseStats: z.record(z.string(), z.number()),
  maxStats: z.record(z.string(), z.number()),
  advancements: z.array(SimulacrumAdvancementSchema),
  traits: z.array(SimulacrumTraitSchema),
  affinityLadder: z.array(SimulacrumAffinityMilestoneSchema),
  weapon: WeaponDetailSchema,
  matrix: z
    .object({
      suitId: z.string(),
      suitName: LocalizedTextSchema,
      chipIcon: z.string().optional(),
      suitIcon: z.string().optional(),
    })
    .nullable(),
  provenance: z.record(z.string(), z.unknown()).nullable(),
});
