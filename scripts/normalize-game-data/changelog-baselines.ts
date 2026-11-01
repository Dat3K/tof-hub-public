import type { DatasetNormalizationResult } from './types';
import { sortById, deepClone } from './split-merge';

export interface ChangelogBaselinePayload {
  schemaVersion: number;
  edition: 'gacha' | 'mmo';
  generatedAt: string;
  total: number;
  characters: Record<string, any>;
}

/**
 * Builds baseline files for Gacha and MMO Simulacra from the normalized simulacra dataset.
 * These baselines establish the reference point for downstream value diffing.
 */
export function buildChangelogBaselines(
  simulacraResult: DatasetNormalizationResult
): {
  gachaBaseline: ChangelogBaselinePayload;
  mmoBaseline: ChangelogBaselinePayload;
} {
  const gachaList: any[] = simulacraResult.materialized.en?.gacha || simulacraResult.materialized.en?.items || [];
  const mmoList: any[] = simulacraResult.materialized.en?.mmo || [];

  const extractBaselineChar = (item: any) => ({
    id: item.id,
    avatar_id: item.avatar_id,
    weapon_id: item.weapon_id,
    name_en: item.name_en || item.name,
    name_ru: item.name_ru || item.name,
    element: item.element,
    role: item.role,
    rarity: item.rarity,
    base_stats: deepClone(item.base_stats || {}),
    max_stats: deepClone(item.max_stats || {}),
    advancements: deepClone(item.advancements || []),
    traits: deepClone(item.traits || []),
    weapon: deepClone(item.weapon || {}),
  });

  const gachaCharacters: Record<string, any> = {};
  for (const item of sortById(gachaList)) {
    gachaCharacters[item.id] = extractBaselineChar(item);
  }

  const mmoCharacters: Record<string, any> = {};
  for (const item of sortById(mmoList)) {
    mmoCharacters[item.id] = extractBaselineChar(item);
  }

  const now = new Date().toISOString();

  const gachaBaseline: ChangelogBaselinePayload = {
    schemaVersion: 1,
    edition: 'gacha',
    generatedAt: now,
    total: Object.keys(gachaCharacters).length,
    characters: gachaCharacters,
  };

  const mmoBaseline: ChangelogBaselinePayload = {
    schemaVersion: 1,
    edition: 'mmo',
    generatedAt: now,
    total: Object.keys(mmoCharacters).length,
    characters: mmoCharacters,
  };

  return {
    gachaBaseline,
    mmoBaseline,
  };
}
