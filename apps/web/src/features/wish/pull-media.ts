'use client';

import { useEffect, useState } from 'react';
import type { WishRecordDto } from '@tof-hub/contracts';
import type { WishLocale } from './wish-i18n';
import { getLocalizedFields } from '@tof-hub/game-domain';

export interface WishMediaEntry {
  kind: 'weapon' | 'matrix';
  rarity?: 4 | 5;
  image: string | null;
  weapon_icon?: string | null;
  portrait_zoom?: 'tight';
  name_en: string;
  name_ru: string;
  character_name_en?: string | null;
  character_name_ru?: string | null;
  weapon_name_en?: string | null;
  weapon_name_ru?: string | null;
  ref: string;
}

export interface WishMediaMap {
  version: number;
  generatedAt: string;
  byKey: Record<string, WishMediaEntry>;
  currencyIcons?: Record<string, string>;
  /** Generated default artwork per aggregate banner; a local custom image overrides it. */
  aggregateArtworks?:Partial<Record<'all'|'characters'|'matrices',{id:string;image:string;position:{x:number;y:number};scale:number}>>;
}

export interface ResolvedPullMedia {
  image: string | null;
  portraitZoom: 'tight' | null;
  rarity: 4 | 5 | null;
  name: string;
  characterName: string | null;
  weaponName: string | null;
  primaryName: string;
  secondaryName: string | null;
  displayName: string;
  ref: string | null;
}

function localizedMediaText(entry: WishMediaEntry | null, field: string, locale: WishLocale): string | null {
  const values = getLocalizedFields(entry, field);
  const value = values[locale] || values.en;
  return typeof value === 'string' && value ? value : null;
}

let cachedMapPromise: Promise<WishMediaMap | null> | null = null;

export function loadWishMediaMap(): Promise<WishMediaMap | null> {
  if (!cachedMapPromise) {
    cachedMapPromise = fetch('/game-data/runtime/wish-media-map.json')
      .then((res) => (res.ok ? (res.json() as Promise<WishMediaMap>) : null))
      .catch(() => null);
  }
  return cachedMapPromise;
}

export function useWishMediaMap(): WishMediaMap | null {
  const [map, setMap] = useState<WishMediaMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadWishMediaMap().then((loaded) => {
      if (!cancelled) setMap(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return map;
}

function lookupEntry(map: WishMediaMap, record: WishRecordDto): WishMediaEntry | null {
  const keys = [
    record.item_id,
    record.item_name,
    record.item_name_ru ?? undefined,
    record.item_name ? record.item_name.replace(/\s*\(.*?\)\s*/g, '').trim() : undefined,
    record.item_name_ru ? record.item_name_ru.replace(/\s*\(.*?\)\s*/g, '').trim() : undefined,
  ];
  for (const key of keys) {
    if (!key) continue;
    const entry = map.byKey[key.toLowerCase()];
    if (entry) return entry;
  }
  return null;
}

export function resolvePullMedia(
  map: WishMediaMap | null,
  record: WishRecordDto,
  locale: WishLocale,
): ResolvedPullMedia {
  const entry = map ? lookupEntry(map, record) : null;
  const name =
    locale === 'ru'
      ? record.item_name_ru || entry?.name_ru || record.item_name
      : locale === 'en' ? record.item_name || entry?.name_en || record.item_id
        : localizedMediaText(entry, 'name', locale) || record.item_name || record.item_id;
  let image = entry?.image ?? null;
  // 3* (R) items are weapons/materials, not simulacra, and must never display a character avatar portrait
  if (record.rarity === 3 && image && image.toLowerCase().includes('touxiang_')) {
    image = null;
  }

  const characterName =
    locale === 'ru'
      ? entry?.character_name_ru ?? null
      : localizedMediaText(entry, 'character_name', locale);

  const weaponName =
    locale === 'ru'
      ? entry?.weapon_name_ru ?? (entry?.name_ru || name)
      : localizedMediaText(entry, 'weapon_name', locale) ?? (localizedMediaText(entry, 'name', locale) || name);

  const isSimulacraWeapon = (record.rarity === 4 || record.rarity === 5) && Boolean(characterName);

  const primaryName = isSimulacraWeapon && characterName ? characterName : name;
  const secondaryName =
    isSimulacraWeapon && weaponName && weaponName.toLowerCase() !== (characterName?.toLowerCase() ?? '')
      ? weaponName
      : null;
  const displayName = secondaryName ? `${primaryName} (${secondaryName})` : primaryName;

  return {
    image,
    portraitZoom: entry?.portrait_zoom ?? null,
    rarity: entry?.rarity ?? null,
    name,
    characterName,
    weaponName,
    primaryName,
    secondaryName,
    displayName,
    ref: entry?.ref ?? null,
  };
}
