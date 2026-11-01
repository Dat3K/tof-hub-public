import { z } from 'zod';
import {
  ElementSchema,
  RaritySchema,
  WeaponRoleSchema,
  RelicPropertySchema,
} from '../common/enums';
import { LocalizedTextSchema } from '../common/localization';
import type {
  CompRoleKey,
  CompRole,
  CompSimulacrumView,
  CompWeaponView,
  CompMatrixCarrier,
  CompMatrixView,
  CompRelicStar,
  CompRelicView,
  CompPetStar,
  CompPetView,
  CompCatalogView,
} from '@tof-hub/game-domain';

export const CompRoleKeySchema = z.enum([
  'tank',
  'dps',
  'support',
  'balanced',
]) as z.ZodType<CompRoleKey>;

export const CompRoleSchema = z.object({
  id: CompRoleKeySchema,
  name: LocalizedTextSchema,
  short: LocalizedTextSchema,
  color: z.string(),
  bgColor: z.string(),
  icon: z.string(),
}) as z.ZodType<CompRole>;

export const CompSimulacrumViewSchema = z.object({
  serverMode: z.enum(['standard', 'mmo']).optional(),
  season: z.number().optional(),
  imitationId: z.string().optional(),
  matrixSuitNum: z.number().optional(),
  id: z.string(),
  name: LocalizedTextSchema,
  avatar: z.string(),
  traitIcon: z.string().nullable().optional(),
  weaponId: z.string(),
  weaponName: LocalizedTextSchema,
  weaponIcon: z.string(),
  element: ElementSchema,
  elementSecondary: ElementSchema.nullable(),
  elementComboIcon: z.string().nullable(),
  role: WeaponRoleSchema,
  roleIcon: z.string(),
  rarity: RaritySchema,
  matrixSuitId: z.string().nullable(),
  card: z.string(),
  traitName: LocalizedTextSchema,
  traitDesc: LocalizedTextSchema,
}) as z.ZodType<CompSimulacrumView>;

export const CompWeaponViewSchema = z.object({
  serverMode: z.enum(['standard', 'mmo']).optional(),
  id: z.string(),
  weaponId: z.string(),
  simulacrumId: z.string(),
  name: LocalizedTextSchema,
  simName: LocalizedTextSchema,
  element: ElementSchema,
  elementSecondary: ElementSchema.nullable(),
  elementComboIcon: z.string().nullable().optional(),
  role: WeaponRoleSchema,
  canonicalRole: CompRoleKeySchema,
  rarity: RaritySchema,
  matrixSuitId: z.string().nullable(),
  matrixSuitNum: z.number().optional(),
  season: z.number().optional(),
  imitationId: z.string().optional(),
  releaseOrder: z.number().optional(),
  icon: z.string(),
  avatar: z.string(),
  aliases: z.array(z.string()).optional(),
}) as z.ZodType<CompWeaponView>;

export const CompMatrixCarrierSchema = z.object({
  id: z.string(),
  name: LocalizedTextSchema,
  weaponName: LocalizedTextSchema.optional(),
  element: z.string().optional(),
  role: z.string().optional(),
}) as z.ZodType<CompMatrixCarrier>;

export const CompMatrixViewSchema = z.object({
  id: z.string(),
  name: LocalizedTextSchema,
  quality: RaritySchema,
  icon: z.string(),
  suitPortrait: z.string(),
  remouldIcon: z.string().nullable(),
  desc2p: LocalizedTextSchema.nullable(),
  desc3p: LocalizedTextSchema.nullable(),
  desc4p: LocalizedTextSchema.nullable(),
  simulacrumId: z.string().nullable().optional(),
  simName: LocalizedTextSchema.nullable().optional(),
  carriers: z.array(CompMatrixCarrierSchema).optional(),
  aliases: z.array(z.string()).optional(),
}) as z.ZodType<CompMatrixView>;

export const CompRelicStarSchema = z.object({
  star: z.number(),
  desc: LocalizedTextSchema,
}) as z.ZodType<CompRelicStar>;

export const CompRelicViewSchema = z.object({
  serverMode: z.enum(['standard', 'mmo']).optional(),
  id: z.string(),
  name: LocalizedTextSchema,
  quality: RaritySchema,
  property: RelicPropertySchema,
  category: z.enum(['damage', 'defense', 'utility']).optional(),
  icon: z.string(),
  desc: LocalizedTextSchema,
  stars: z.array(CompRelicStarSchema),
  aliases: z.array(z.string()).optional(),
}) as z.ZodType<CompRelicView>;

export const CompPetStarSchema = z.object({
  star: z.number(),
  desc: LocalizedTextSchema,
}) as z.ZodType<CompPetStar>;

export const CompPetViewSchema = z.object({
  id: z.string(),
  name: LocalizedTextSchema,
  quality: RaritySchema,
  icon: z.string(),
  stars: z.array(CompPetStarSchema),
}) as z.ZodType<CompPetView>;

export const CompCatalogSchema = z.object({
  generatedAt: z.string().optional(),
  totalSimulacra: z.number().optional(),
  totalMatrices: z.number().optional(),
  totalRelics: z.number().optional(),
  totalPets: z.number().optional(),
  roles: z.array(CompRoleSchema),
  simulacra: z.array(CompSimulacrumViewSchema),
  weapons: z.array(CompWeaponViewSchema).optional(),
  matrices: z.array(CompMatrixViewSchema),
  relics: z.array(CompRelicViewSchema),
  pets: z.array(CompPetViewSchema),
}) as z.ZodType<CompCatalogView>;
