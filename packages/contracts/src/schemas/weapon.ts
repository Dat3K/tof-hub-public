import { z } from 'zod';
import { ElementSchema, RaritySchema, WeaponRoleSchema } from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';

export const WeaponSkillSchema = z.object({
  id: z.string(),
  name: LocalizedTextSchema,
  description: LocalizedTextSchema,
  icon: z.string(),
  category: z.enum(['normal', 'dodge', 'skill', 'discharge']),
  cooldown: z.number().nullable().optional(),
});

export const WeaponCoreSchema = z.object({
  stableId: z.string(),
  slug: z.string(),
  simulacrumId: z.string().nullable(),
  name: LocalizedTextSchema,
  element: ElementSchema,
  elementSecondary: ElementSchema.nullable(),
  role: WeaponRoleSchema,
  rarity: RaritySchema,
  icon: z.string(),
});

export const WeaponDetailSchema = WeaponCoreSchema.extend({
  shatter: z.object({
    value: z.number(),
    tier: z.string(),
  }),
  charge: z.object({
    value: z.number(),
    tier: z.string(),
  }),
  type: z.string().nullable(),
  skills: z.object({
    normals: z.array(WeaponSkillSchema),
    dodges: z.array(WeaponSkillSchema),
    skills: z.array(WeaponSkillSchema),
    discharges: z.array(WeaponSkillSchema),
  }),
});
