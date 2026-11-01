import { z } from 'zod';
import { ElementSchema, RaritySchema, WeaponRoleSchema } from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';

export const SmartServantSkillSchema = z.object({
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  icon: z.string(),
});

export const SmartServantStarSchema = z.object({
  star: z.number(),
  description: LocalizedTextSchema,
  atkInheritance: z.string().optional(),
  moduleSlots: z.number().optional(),
  moduleLoad: z.number().optional(),
  goldCost: z.number().optional(),
  petLevelReq: z.number().optional(),
});

export const PetModuleLevelSchema = z.object({
  level: z.number(),
  description: LocalizedTextSchema,
});

export const PetModuleSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  familyId: z.string(),
  name: LocalizedTextSchema,
  owner: z.string().nullable(),
  quality: RaritySchema,
  needLoad: z.number(),
  icon: z.string(),
  levels: z.array(PetModuleLevelSchema),
});

export const SmartServantCoreSchema = z.object({
  stableId: z.string(),
  slug: z.string(),
  category: z.enum(['combat', 'cute']),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  quality: RaritySchema,
  element: ElementSchema,
  role: WeaponRoleSchema,
  icon: z.string(),
  photo: z.string(),
});

export const SmartServantDetailSchema = SmartServantCoreSchema.extend({
  stars: z.array(SmartServantStarSchema),
  skills: z.array(SmartServantSkillSchema),
  statsProgression: z.record(z.string(), z.unknown()).nullable(),
  tokenIcon: z.string().optional(),
});
