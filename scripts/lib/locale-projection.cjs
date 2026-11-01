'use strict';
// Locale projection shared by the exporter pipeline (tools/patch-exporter/src/localization.ts) and the
// derived generators. A locale lane re-runs the English projection with the target culture's text in the
// `en` slot; its result is merged into the canonical en/ru datasets here. Derived generators (they read only
// generated catalogs) run after that merge and rebuild their locale variants from per-locale views of the
// merged catalogs, so the pipeline output and their `--check` are the same computation.
const fs = require('node:fs');
const path = require('node:path');

const PROJECTED_ROOTS = new Set(['en', 'ru', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN', 'zh-Hans', 'zh-Hans-SG']);

/** Merge only explicitly localized fields; numeric values and identities stay in the base dataset. */
function mergeLocaleProjection(base, translated, locale, options = {}) {
  if (Array.isArray(base)) {
    // English output owns entity and array shape. A locale pass can omit entries
    // when translated labels affect a downstream parser; merge matching rows by
    // identity and keep the English row when a localized counterpart is absent.
    if (!Array.isArray(translated)) return base;
    const identity = value => value && typeof value === 'object'
      ? ['id', 'slug', 'key', 'floor', 'stage', 'level', 'rank'].find(key => value[key] !== undefined)
      : undefined;
    const sameLength = base.length === translated.length;
    if (!sameLength && !base.some(value => identity(value))) return base;
    const indexes = new Map();
    return base.map((value, index) => {
      const key = identity(value);
      if (key && !indexes.has(key)) {
        const entries = new Map();
        for (const row of translated) if (row?.[key] !== undefined) entries.set(row[key], entries.has(row[key]) ? null : row);
        indexes.set(key, entries);
      }
      if (!key && !sameLength) return value;
      const indexed = key ? indexes.get(key).get(value[key]) : undefined;
      const other = key ? indexed ?? (translated[index]?.[key] === value[key] ? translated[index] : null) : translated[index];
      if (key && !other) return value;
      return mergeLocaleProjection(value, other, locale, options);
    });
  }
  if (!base || typeof base !== 'object' || !translated || typeof translated !== 'object') return base;
  const output = {...base};
  // `preserve`: a culture the base build already resolved from a direct source (e.g. card l10n) is kept.
  if (Object.hasOwn(base, 'en') && Object.hasOwn(base, 'ru') && Object.hasOwn(translated, 'en') && !(options.preserve && Object.hasOwn(base, locale))) output[locale] = translated.en;
  for (const [key, value] of Object.entries(base)) {
    const localized = `${key.slice(0, -3)}_${locale}`;
    if (key.endsWith('_en') && Object.hasOwn(translated, key) && !(options.preserve && Object.hasOwn(base, localized))) output[localized] = translated[key];
    if (value && typeof value === 'object' && translated[key] != null) output[key] = mergeLocaleProjection(value, translated[key], locale, options);
  }
  return output;
}

/** Inverse of the merge: the dataset as the `locale` lane saw it (the culture's text in the `en` slot). */
function localeView(value, locale) {
  if (Array.isArray(value)) return value.map(entry => localeView(entry, locale));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) output[key] = localeView(child, locale);
  if (Object.hasOwn(value, 'en') && Object.hasOwn(value, 'ru') && Object.hasOwn(value, locale)) output.en = value[locale];
  for (const key of Object.keys(value)) {
    const localized = `${key.slice(0, -3)}_${locale}`;
    if (key.endsWith('_en') && Object.hasOwn(value, localized)) output[key] = value[localized];
  }
  return output;
}

/** Cultures merged into this game-data tree (localization-manifest.json), excluding the canonical en/ru. */
function projectedLocales(gameData) {
  const file = path.join(gameData, 'localization-manifest.json');
  if (!fs.existsSync(file)) return [];
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (manifest.availableLocales ?? []).filter(locale => locale !== 'en' && locale !== 'ru' && fs.existsSync(path.join(gameData, locale)));
}

/**
 * Build a derived dataset for en/ru and every merged culture. `build(reader)` reads generated files only through
 * `reader(relativePath)`; in a culture view `en/…` resolves to that culture's dataset and shared catalogs are read
 * through localeView(). Provenance and other non-localized fields always come from the canonical build.
 */
function buildWithLocaleViews(gameData, build) {
  const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  let output = build(relative => ({bytes: fs.readFileSync(path.join(gameData, relative)), value: null}));
  for (const locale of projectedLocales(gameData)) {
    const translated = build(relative => {
      const parts = relative.split(/[\\/]/);
      if (parts[0] === 'en') {
        const localized = path.join(gameData, locale, ...parts.slice(1));
        if (fs.existsSync(localized)) return {bytes: null, value: readJson(localized)};
      }
      if (PROJECTED_ROOTS.has(parts[0])) return {bytes: null, value: readJson(path.join(gameData, relative))};
      return {bytes: null, value: localeView(readJson(path.join(gameData, relative)), locale)};
    });
    output = mergeLocaleProjection(output, translated, locale, {preserve: true});
  }
  return output;
}

module.exports = {mergeLocaleProjection, localeView, projectedLocales, buildWithLocaleViews};
