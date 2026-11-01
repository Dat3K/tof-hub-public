import { z } from 'zod';

export const ElementSchema = z.enum([
  'Volt',
  'Flame',
  'Frost',
  'Physical',
  'Altered',
]);

export const RaritySchema = z.enum(['SSR', 'SR', 'R', 'N']);

export const WeaponRoleSchema = z.enum([
  'DPS',
  'Tank',
  'Benediction',
  'Balance',
]);

export const ServerModeSchema = z.enum(['gacha', 'mmo']);

export const RelicPropertySchema = z.enum([
  'Attack',
  'Defense',
  'Assist',
  'Function',
]);
