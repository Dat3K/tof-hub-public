import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SUPPORTED_LOCALES, type Locale } from '../../../packages/i18n/src/constants';
import { mergeLocaleProjection as mergeShared } from '../../../scripts/lib/locale-projection.cjs';

type Json = any;
export const GAME_LOCALIZATION_ROOT = 'Hotta/Content/Localization/Game';
export interface LocalizationSource {
  locale: Locale;
  path: string;
  sha256: string;
  keys: number;
  fallbackKeys: number;
  projectionFile: string;
  projectionPath: string;
  projectionSha256: string;
  englishFallbackSha256: string;
}

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value) + '\n');
};
/** Rewrite a generated file in its own layout: generators that indent keep their bytes stable across a merge. */
const rewrite = (file: string, value: unknown) => {
  const indent = /^[[{]\r?\n([ \t]+)/.exec(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))?.[1];
  fs.writeFileSync(file, JSON.stringify(value, null, indent) + '\n');
};

/** Exact namespace/key overlay: coinciding keys from unrelated tables never mix. */
export function overlayGameLocalization(english: Json, target: Json): { table: Json; keys: number; fallbackKeys: number } {
  const table: Json = {};
  let keys = 0;
  let fallbackKeys = 0;
  for (const namespace of new Set([...Object.keys(english), ...Object.keys(target)])) {
    const base = english[namespace] ?? {};
    const translated = target[namespace] ?? {};
    table[namespace] = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(translated)])) {
      const value = translated[key];
      if (typeof value === 'string' && value.trim()) {
        table[namespace][key] = value;
        keys++;
      } else if (typeof base[key] === 'string') {
        table[namespace][key] = base[key];
        fallbackKeys++;
      }
    }
  }
  return { table, keys, fallbackKeys };
}

/**
 * Raw cultures not projected into datasets. The Global client's zh-Hans (191 keys) and
 * zh-Hans-SG (11,121 keys) Game.json tables are partial overlays; the complete Simplified
 * Chinese table is zh-CN (298,357 keys). Projecting them would publish near-English copies.
 */
export const UNPROJECTED_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['zh-Hans', 'zh-Hans-SG']);

export function prepareLocalizationSources(rawDir: string, workDir: string): LocalizationSource[] {
  const root = path.join(rawDir, GAME_LOCALIZATION_ROOT);
  const englishFile = path.join(root, 'en/Game.json');
  if (!fs.existsSync(englishFile)) throw new Error(`English fallback localization is required: ${englishFile}`);
  const englishBytes = fs.readFileSync(englishFile);
  const english = JSON.parse(englishBytes.toString('utf8').replace(/^\uFEFF/, ''));
  return SUPPORTED_LOCALES.flatMap(locale => {
    const relative = `${GAME_LOCALIZATION_ROOT}/${locale}/Game.json`;
    const file = path.join(rawDir, relative);
    if (UNPROJECTED_LOCALES.has(locale) || !fs.existsSync(file)) return [];
    const bytes = fs.readFileSync(file);
    const { table, keys, fallbackKeys } = overlayGameLocalization(english, JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
    const projectionFile = path.join(workDir, 'localization', `${locale}.json`);
    write(projectionFile, table);
    return [{ locale, path: relative, sha256: createHash('sha256').update(bytes).digest('hex'), keys, fallbackKeys, projectionFile,
      projectionPath: `localization/${locale}.json`, projectionSha256: createHash('sha256').update(fs.readFileSync(projectionFile)).digest('hex'),
      englishFallbackSha256: createHash('sha256').update(englishBytes).digest('hex') }];
  });
}

/** Merge only explicitly localized fields; shared with the derived generators (scripts/lib/locale-projection.cjs). */
export function mergeLocaleProjection(base: Json, translated: Json, locale: Locale): Json {
  return mergeShared(base, translated, locale);
}

function jsonFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? jsonFiles(full) : entry.name.endsWith('.json') ? [full] : [];
  });
}

/** Publish the existing processors' English projection under the actual target culture. */
export function publishLocaleProjection(sourceData: string, targetData: string, locale: Locale): void {
  const sourceMetadata = (value: Json): Json => {
    if (typeof value === 'string') return value.replace(/^.*?Hotta[\\/]Content[\\/]Localization[\\/]Game[\\/]en[\\/]Game(?:\.json)?(?=[#!]|$)/, `localization/${locale}.json`);
    if (Array.isArray(value)) return value.map(sourceMetadata);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [sourceMetadata(key), sourceMetadata(child)]));
  };
  for (const file of jsonFiles(path.join(sourceData, 'en'))) {
    const value = read(file);
    const localized = sourceMetadata(mergeLocaleProjection(value, value, locale));
    if (localized && typeof localized === 'object' && !Array.isArray(localized)) {
      if (Object.hasOwn(localized, '_locale')) localized._locale = locale;
      if (localized.locale === 'en') localized.locale = locale;
    }
    write(path.join(targetData, locale, path.relative(path.join(sourceData, 'en'), file)), localized);
  }
  for (const file of jsonFiles(sourceData)) {
    const relative = path.relative(sourceData, file);
    if (SUPPORTED_LOCALES.some(code => relative.startsWith(code + path.sep)) || relative.startsWith('changelog' + path.sep)) continue;
    const target = path.join(targetData, relative);
    if (!fs.existsSync(target) || relative === 'release-manifest.json') continue;
    rewrite(target, mergeLocaleProjection(read(target), read(file), locale));
  }
}

export function writeLocalizationManifest(gameData: string, sources: LocalizationSource[]): void {
  write(path.join(gameData, 'localization-manifest.json'), {
    schemaVersion: 1,
    supportedLocales: SUPPORTED_LOCALES,
    availableLocales: sources.map(source => source.locale),
    fallbackLocale: 'en',
    sources: sources.map(({ projectionFile: _scratch, ...source }) => source),
    missingLocales: SUPPORTED_LOCALES.filter(locale => !sources.some(source => source.locale === locale)),
    fallback: 'Missing or empty keys use English from the same namespace/key. Editorial text without a translation stays English.',
  });
}
