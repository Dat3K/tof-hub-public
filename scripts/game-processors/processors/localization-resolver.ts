
/**
 * localization-resolver.js
 *
 * Canonical namespace-aware FText and game localization resolver for Tower of Fantasy datamine pipeline.
 *
 * Design contracts:
 * 1. Namespaced table isolation: game strings are strictly resolved within their source TableId / namespace.
 * 2. Cross-namespace key flattening is forbidden: unrelated tables never overwrite one another.
 * 3. Multi-table collision diagnostics: when a key exists in multiple namespaces, logs candidates and requires namespace context.
 * 4. Deterministic 4-tier fallback order:
 *    Tier 1: Exact namespace/table leaf + exact (or deterministic case-variant) key lookup.
 *    Tier 2: Explicit localized string stored on the source row / FText (e.g. LocalizedString).
 *    Tier 3: FText SourceString belonging to that exact reference.
 *    Tier 4: Source entity ID / codename as a visibly diagnostic fallback.
 * 5. Separate provenance and diagnostic state tracking (preserves TableId, key, locale, resolution status, collision diagnostics).
 * 6. Immutable original game names (no synthetic human-name fabrication from codenames).
 */

import { hasGameLocalizationSource } from './game-source-reader';

function normalizeTableId(tableId) {
  if (!tableId || typeof tableId !== 'string') return '';
  let clean = tableId.trim().replace(/\\/g, '/');
  // Strip trailing dot suffixes: e.g. "/Game/.../SkullDes.SkullDes" -> "/Game/.../SkullDes"
  const lastDot = clean.lastIndexOf('.');
  if (lastDot !== -1) {
    const afterDot = clean.slice(lastDot + 1);
    const beforeDot = clean.slice(0, lastDot);
    const lastSlash = beforeDot.lastIndexOf('/');
    const leafBefore = lastSlash !== -1 ? beforeDot.slice(lastSlash + 1) : beforeDot;
    if (afterDot.toLowerCase() === leafBefore.toLowerCase()) {
      clean = beforeDot;
    }
  }
  // Strip file extensions if present (.json, .uasset, .locres)
  clean = clean.replace(/\.(json|uasset|locres)$/i, '');
  // Extract leaf name
  const parts = clean.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : clean;
}

function cleanHtmlTags(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

class LocalizationResolver {
  declare dictionaries: any;
  declare keyToNamespaces: any;
  declare collisionLog: any;
  declare stats: any;

  constructor() {
    // locale -> Map(normalizedNamespaceLower -> { originalNamespace, entries: Map(exactKey -> value), lowerEntries: Map(lowerKey -> { exactKey, value }) })
    this.dictionaries = new Map<any, any>();
    // locale -> Map(lowerKey -> Set(originalNamespace))
    this.keyToNamespaces = new Map<any, any>();
    // Recorded collision diagnostics
    this.collisionLog = [];
    // Diagnostic stats for Global/Overseas resolution drift tracking
    this.stats = {
      overseasWonCount: 0,
      keptBaseCount: 0,
      unresolvedCount: 0
    };
  }

  /**
   * Loads and indexes localization entries for a given locale.
   * Accepts:
   *  - Game.json object: { "Namespace": { "Key": "Value" } }
   *  - StringTable array: [ { Type: "StringTable", StringTable: { TableNamespace: "...", KeysToEntries: { ... } } } ]
   *  - StringTable object: { StringTable: { TableNamespace: "...", KeysToEntries: { ... } } } or { KeysToEntries: { ... } }
   *  - Flat dictionary object: { "Key": "Value" } (requires defaultNamespace or falls back to 'default')
   */
  loadLocale(locale, rawData, defaultNamespace = null) {
    if (!locale || !rawData || typeof rawData !== 'object') return this;
    const loc = String(locale).toLowerCase();

    if (!this.dictionaries.has(loc)) {
      this.dictionaries.set(loc, new Map<any, any>());
      this.keyToNamespaces.set(loc, new Map<any, any>());
    }

    const dictMap = this.dictionaries.get(loc);
    const keyMap = this.keyToNamespaces.get(loc);

    const registerNamespaceEntries = (nsName, entries) => {
      if (!entries || typeof entries !== 'object') return;
      const originalNs = nsName !== null && nsName !== undefined ? String(nsName).trim() : '';
      const normNs = originalNs ? normalizeTableId(originalNs) : '';
      const normNsLower = normNs.toLowerCase();

      let nsRecord = dictMap.get(normNsLower);
      if (!nsRecord) {
        nsRecord = {
          originalNamespace: originalNs,
          normalizedNamespace: normNs,
          entries: new Map<any, any>(),
          lowerEntries: new Map<any, any>()
        };
        dictMap.set(normNsLower, nsRecord);
      }

      for (const [rawKey, rawVal] of Object.entries(entries)) {
        if (rawVal === null || rawVal === undefined) continue;
        const key = String(rawKey);
        const val = typeof rawVal === 'string' ? rawVal : (rawVal.SourceString || rawVal.Translation || String(rawVal));
        const lowerKey = key.toLowerCase();

        // Supplementary raw StringTables must not overwrite the localized Game.json
        // loaded first in an additional locale pass.
        if (loc === 'en' && hasGameLocalizationSource() && nsRecord.entries.has(key)) continue;

        nsRecord.entries.set(key, val);
        if (!nsRecord.lowerEntries.has(lowerKey)) {
          nsRecord.lowerEntries.set(lowerKey, { exactKey: key, value: val });
        }

        let nsSet = keyMap.get(lowerKey);
        if (!nsSet) {
          nsSet = new Set<any>();
          keyMap.set(lowerKey, nsSet);
        }
        nsSet.add(normNs);
      }
    };

    // Case 1: Array of StringTable exports
    if (Array.isArray(rawData)) {
      for (const item of rawData) {
        if (item && typeof item === 'object') {
          const st = item.StringTable || item;
          const ns = st.TableNamespace !== undefined ? st.TableNamespace : (item.Name || defaultNamespace || 'StringTable');
          const entries = st.KeysToEntries || item.KeysToEntries || (item.Key && (item.SourceString || item.Translation) ? { [item.Key]: item.Translation || item.SourceString } : null);
          if (entries) registerNamespaceEntries(ns, entries);
        }
      }
      return this;
    }

    // Case 2: Direct StringTable object ({ StringTable: { ... } }) or ({ KeysToEntries: { ... } })
    if (rawData.StringTable && typeof rawData.StringTable === 'object') {
      const st = rawData.StringTable;
      const ns = st.TableNamespace || defaultNamespace || 'StringTable';
      const entries = st.KeysToEntries || {};
      registerNamespaceEntries(ns, entries);
      return this;
    }
    if (rawData.KeysToEntries && typeof rawData.KeysToEntries === 'object') {
      const ns = rawData.TableNamespace || defaultNamespace || 'StringTable';
      registerNamespaceEntries(ns, rawData.KeysToEntries);
      return this;
    }

    // Case 3: Standard Game.json ({ "Namespace1": { "Key1": "Val1" }, ... })
    // or Flat dictionary ({ "Key1": "Val1" })
    let isNamespacedObject = false;
    for (const val of Object.values(rawData)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        isNamespacedObject = true;
        break;
      }
    }

    if (isNamespacedObject) {
      for (const [nsKey, nsVal] of Object.entries(rawData)) {
        if (nsVal && typeof nsVal === 'object' && !Array.isArray(nsVal)) {
          registerNamespaceEntries(nsKey, nsVal);
        } else if (typeof nsVal === 'string' && defaultNamespace) {
          registerNamespaceEntries(defaultNamespace, { [nsKey]: nsVal });
        }
      }
    } else {
      // Flat dictionary
      const ns = defaultNamespace !== null && defaultNamespace !== undefined ? defaultNamespace : '';
      registerNamespaceEntries(ns, rawData);
    }

    return this;
  }

  /**
   * Returns conflicting namespaces if the key exists in multiple namespaces for the given locale.
   */
  getKeyCollisionCandidates(locale, key) {
    if (!key) return [];
    const loc = String(locale || 'en').toLowerCase();
    const keyMap = this.keyToNamespaces.get(loc);
    if (!keyMap) return [];
    const nsSet = keyMap.get(String(key).toLowerCase());
    return nsSet && nsSet.size > 1 ? Array.from<string>(nsSet) : [];
  }

  /**
   * Primary canonical FText resolver adhering to the 4-tier deterministic fallback contract.
   */
  resolve(ftext, options: Record<string, any> = {}) {
    const locale = String(options.locale || 'en').toLowerCase();
    const fallbackLocale = options.fallbackLocale ? String(options.fallbackLocale).toLowerCase() : (locale !== 'en' ? 'en' : null);
    const clean = options.clean !== false;

    let tableId = null;
    let key = null;
    let sourceString = null;
    let localizedString = null;

    if (ftext && typeof ftext === 'object') {
      tableId = ftext.TableId || ftext.Namespace || options.defaultNamespace || null;
      key = ftext.Key || null;
      sourceString = ftext.SourceString !== undefined ? ftext.SourceString : null;
      localizedString = ftext.LocalizedString !== undefined ? ftext.LocalizedString : null;
    } else if (typeof ftext === 'string') {
      if (options.defaultNamespace) {
        tableId = options.defaultNamespace;
        key = ftext;
      } else {
        sourceString = ftext;
      }
    }

    // Explicit row fallbacks
    if (!localizedString && options.fallbackSourceRow) {
      if (options.fallbackSourceRow.LocalizedString) localizedString = options.fallbackSourceRow.LocalizedString;
      else if (options.fallbackSourceRow.ActorName) localizedString = options.fallbackSourceRow.ActorName;
    }
    if (!sourceString && options.fallbackSourceRow) {
      if (options.fallbackSourceRow.SourceString) sourceString = options.fallbackSourceRow.SourceString;
      else if (options.fallbackSourceRow.ItemName && typeof options.fallbackSourceRow.ItemName === 'object' && options.fallbackSourceRow.ItemName.SourceString) {
        sourceString = options.fallbackSourceRow.ItemName.SourceString;
      }
    }

    const codenameFallback = options.fallbackCodename || options.fallbackId || null;
    const normNs = tableId ? normalizeTableId(tableId) : null;
    const normNsLower = normNs ? normNs.toLowerCase() : null;

    let resolvedText = null;
    let strategy = 'unresolved';
    let resolvedLocale = null;
    let collisions = null;

    // Check collision diagnostics if key is present
    if (key) {
      const candidates = this.getKeyCollisionCandidates(locale, key);
      if (candidates.length > 1) {
        collisions = candidates;
        if (!normNsLower) {
          this.collisionLog.push({
            key,
            candidates,
            locale,
            message: `Key "${key}" exists in multiple namespaces (${candidates.join(', ')}). Caller namespace required; refusing cross-namespace guess.`
          });
        }
      }
    }

    let isOverseasWon = false;
    let matchedNs = null;
    let matchedKey = null;

    // TIER 1: Exact namespace/table leaf + exact or case-variant key lookup with Overseas-First precedence
    if (key) {
      const overseasNsList = [];
      const baseNsList = [];

      if (normNsLower) {
        const isAlreadyOverseas = /_overseas?$/i.test(normNsLower) || /_os$/i.test(normNsLower);
        const strippedDes = normNsLower.replace(/_?des$/i, '');
        const strippedOverseas = normNsLower.replace(/_?overseas?$/i, '').replace(/_?os$/i, '');
        const strippedBoth = strippedOverseas.replace(/_?des$/i, '');

        if (isAlreadyOverseas) {
          overseasNsList.push(normNsLower);
          if (strippedDes && !overseasNsList.includes(strippedDes)) overseasNsList.push(strippedDes);
        } else {
          overseasNsList.push(`${normNsLower}_oversea`);
          overseasNsList.push(`${normNsLower}_overseas`);
          if (strippedDes) {
            overseasNsList.push(`${strippedDes}_oversea`);
            overseasNsList.push(`${strippedDes}_overseas`);
            overseasNsList.push(`${strippedDes}des_oversea`);
          }
        }

        baseNsList.push(normNsLower);
        if (strippedDes && !baseNsList.includes(strippedDes)) baseNsList.push(strippedDes);
        if (strippedOverseas && !baseNsList.includes(strippedOverseas)) baseNsList.push(strippedOverseas);
        if (strippedBoth && !baseNsList.includes(strippedBoth)) baseNsList.push(strippedBoth);
      }
      if (!baseNsList.includes('')) baseNsList.push('');

      const keyIsOs = /_os$/i.test(key) || /_overseas?$/i.test(key);
      const overseasKeys = keyIsOs
        ? [key]
        : [`${key}_OS`, `${key}_os`, `${key}_Overseas`, `${key}_overseas`];
      const baseKeys = keyIsOs
        ? [key, key.replace(/_os$/i, ''), key.replace(/_overseas?$/i, '')]
        : [key];

      const lookupInDict = (dictMap, nsList, keyList) => {
        if (!dictMap) return null;
        for (const ns of nsList) {
          const nsRecord = dictMap.get(ns);
          if (!nsRecord) continue;
          for (const k of keyList) {
            if (nsRecord.entries.has(k)) {
              return {
                text: nsRecord.entries.get(k),
                matchedNs: nsRecord.originalNamespace || ns,
                matchedKey: k,
                strat: 'exact_namespace_key'
              };
            }
            const lowerK = k.toLowerCase();
            if (nsRecord.lowerEntries.has(lowerK)) {
              const item = nsRecord.lowerEntries.get(lowerK);
              return {
                text: item.value,
                matchedNs: nsRecord.originalNamespace || ns,
                matchedKey: item.exactKey,
                strat: 'case_variant_namespace_key'
              };
            }
          }
        }
        return null;
      };

      const dictMap = this.dictionaries.get(locale);

      // Phase 1: Target Locale -> Overseas Namespaces + Overseas Keys
      let match = lookupInDict(dictMap, overseasNsList, overseasKeys);
      if (match) {
        resolvedText = match.text;
        matchedNs = match.matchedNs;
        matchedKey = match.matchedKey;
        strategy = match.strat;
        resolvedLocale = locale;
        isOverseasWon = true;
      }

      // Phase 2: Target Locale -> Overseas Namespaces + Base Keys
      if (resolvedText === null) {
        match = lookupInDict(dictMap, overseasNsList, baseKeys);
        if (match) {
          resolvedText = match.text;
          matchedNs = match.matchedNs;
          matchedKey = match.matchedKey;
          strategy = match.strat;
          resolvedLocale = locale;
          isOverseasWon = true;
        }
      }

      // Phase 3: Target Locale -> Base Namespaces + Overseas Keys
      if (resolvedText === null) {
        match = lookupInDict(dictMap, baseNsList, overseasKeys);
        if (match) {
          resolvedText = match.text;
          matchedNs = match.matchedNs;
          matchedKey = match.matchedKey;
          strategy = match.strat;
          resolvedLocale = locale;
          isOverseasWon = true;
        }
      }

      // Phase 4: Target Locale -> Base Namespaces + Base Keys
      if (resolvedText === null) {
        match = lookupInDict(dictMap, baseNsList, baseKeys);
        if (match) {
          resolvedText = match.text;
          matchedNs = match.matchedNs;
          matchedKey = match.matchedKey;
          strategy = match.strat;
          resolvedLocale = locale;
          isOverseasWon = keyIsOs;
        }
      }

      // Repeat for Fallback Locale
      if (resolvedText === null && fallbackLocale) {
        const fallbackDictMap = this.dictionaries.get(fallbackLocale);
        // Phase 1b
        match = lookupInDict(fallbackDictMap, overseasNsList, overseasKeys);
        if (match) {
          resolvedText = match.text;
          matchedNs = match.matchedNs;
          matchedKey = match.matchedKey;
          strategy = 'fallback_locale_' + (match.strat === 'exact_namespace_key' ? 'exact' : 'case');
          resolvedLocale = fallbackLocale;
          isOverseasWon = true;
        }
        // Phase 2b
        if (resolvedText === null) {
          match = lookupInDict(fallbackDictMap, overseasNsList, baseKeys);
          if (match) {
            resolvedText = match.text;
            matchedNs = match.matchedNs;
            matchedKey = match.matchedKey;
            strategy = 'fallback_locale_' + (match.strat === 'exact_namespace_key' ? 'exact' : 'case');
            resolvedLocale = fallbackLocale;
            isOverseasWon = true;
          }
        }
        // Phase 3b
        if (resolvedText === null) {
          match = lookupInDict(fallbackDictMap, baseNsList, overseasKeys);
          if (match) {
            resolvedText = match.text;
            matchedNs = match.matchedNs;
            matchedKey = match.matchedKey;
            strategy = 'fallback_locale_' + (match.strat === 'exact_namespace_key' ? 'exact' : 'case');
            resolvedLocale = fallbackLocale;
            isOverseasWon = true;
          }
        }
        // Phase 4b
        if (resolvedText === null) {
          match = lookupInDict(fallbackDictMap, baseNsList, baseKeys);
          if (match) {
            resolvedText = match.text;
            matchedNs = match.matchedNs;
            matchedKey = match.matchedKey;
            strategy = 'fallback_locale_' + (match.strat === 'exact_namespace_key' ? 'exact' : 'case');
            resolvedLocale = fallbackLocale;
            isOverseasWon = keyIsOs;
          }
        }
      }

      // Unique key discovery (Overseas keys first, then Base keys)
      if (resolvedText === null && dictMap) {
        for (const ok of overseasKeys) {
          const cands = this.getKeyCollisionCandidates(locale, ok);
          if (cands.length === 1) {
            const rec = dictMap.get(cands[0].toLowerCase());
            if (rec) {
              if (rec.entries.has(ok)) {
                resolvedText = rec.entries.get(ok);
                matchedNs = cands[0];
                matchedKey = ok;
                strategy = 'unique_key_discovery';
                resolvedLocale = locale;
                isOverseasWon = true;
                break;
              }
              const lk = ok.toLowerCase();
              if (rec.lowerEntries.has(lk)) {
                resolvedText = rec.lowerEntries.get(lk).value;
                matchedNs = cands[0];
                matchedKey = rec.lowerEntries.get(lk).exactKey;
                strategy = 'unique_key_discovery_case';
                resolvedLocale = locale;
                isOverseasWon = true;
                break;
              }
            }
          }
        }
      }

      if (resolvedText === null && dictMap) {
        for (const bk of baseKeys) {
          const cands = this.getKeyCollisionCandidates(locale, bk);
          if (cands.length === 1) {
            const rec = dictMap.get(cands[0].toLowerCase());
            if (rec) {
              if (rec.entries.has(bk)) {
                resolvedText = rec.entries.get(bk);
                matchedNs = cands[0];
                matchedKey = bk;
                strategy = 'unique_key_discovery';
                resolvedLocale = locale;
                isOverseasWon = keyIsOs;
                break;
              }
              const lk = bk.toLowerCase();
              if (rec.lowerEntries.has(lk)) {
                resolvedText = rec.lowerEntries.get(lk).value;
                matchedNs = cands[0];
                matchedKey = rec.lowerEntries.get(lk).exactKey;
                strategy = 'unique_key_discovery_case';
                resolvedLocale = locale;
                isOverseasWon = keyIsOs;
                break;
              }
            }
          }
        }
      }
    }

    // TIER 2: Explicit localized string stored on the source row / FText
    if (resolvedText === null && localizedString && typeof localizedString === 'string' && localizedString.trim() !== '') {
      resolvedText = localizedString;
      strategy = 'row_localized_string';
      resolvedLocale = locale;
    }

    // TIER 3: FText SourceString belonging to that exact reference
    if (resolvedText === null && sourceString && typeof sourceString === 'string' && sourceString.trim() !== '') {
      resolvedText = sourceString;
      strategy = 'ftext_source_string';
      resolvedLocale = 'source';
    }

    // TIER 4: Source entity ID / codename as visibly diagnostic fallback
    if (resolvedText === null && codenameFallback) {
      resolvedText = String(codenameFallback);
      strategy = 'diagnostic_codename_fallback';
      resolvedLocale = 'diagnostic';
    }

    // Unresolved
    if (resolvedText === null) {
      resolvedText = '';
      strategy = 'unresolved';
      resolvedLocale = null;
    }

    const finalText = clean ? cleanHtmlTags(resolvedText) : String(resolvedText);
    const originalGameName = sourceString ? (clean ? cleanHtmlTags(sourceString) : String(sourceString)) : (localizedString ? (clean ? cleanHtmlTags(localizedString) : String(localizedString)) : finalText);

    let status = 'unresolved';
    if (strategy === 'exact_namespace_key' || strategy === 'case_variant_namespace_key' || strategy === 'fallback_locale_exact' || strategy === 'fallback_locale_case' || strategy.startsWith('unique_key')) {
      status = 'resolved';
      if (isOverseasWon) {
        this.stats.overseasWonCount++;
      } else {
        this.stats.keptBaseCount++;
      }
    } else if (strategy === 'row_localized_string' || strategy === 'ftext_source_string' || strategy === 'literal_string') {
      status = 'source_fallback';
      this.stats.keptBaseCount++;
    } else if (strategy === 'diagnostic_codename_fallback') {
      status = 'codename_fallback';
      this.stats.unresolvedCount++;
    } else {
      this.stats.unresolvedCount++;
    }

    return {
      text: finalText,
      displayName: finalText,
      originalGameName,
      codename: codenameFallback || '',
      strategy,
      isOverseasWon,
      provenance: {
        tableId: tableId || null,
        key: key || null,
        matchedNamespace: matchedNs || normNs || null,
        matchedKey: matchedKey || key || null,
        normalizedNamespace: normNs || null,
        requestedLocale: locale,
        resolvedLocale,
        status,
        overseasWon: isOverseasWon,
        collisions: collisions || null
      }
    };
  }

  getStats() {
    return { ...this.stats };
  }

  /**
   * Convenience helper returning plain resolved string.
   */
  resolveString(ftext, options: Record<string, any> = {}) {
    return this.resolve(ftext, options).text;
  }

  /**
   * Convenience helper resolving bilingual (EN and RU) names with provenance.
   */
  resolveBilingual(ftext, options: Record<string, any> = {}) {
    const enRes = this.resolve(ftext, { ...options, locale: 'en' });
    const ruRes = this.resolve(ftext, { ...options, locale: 'ru', fallbackLocale: 'en' });
    return {
      name_en: enRes.text,
      name_ru: ruRes.text || enRes.text,
      originalGameName: enRes.originalGameName,
      codename: options.fallbackCodename || options.fallbackId || '',
      provenance: {
        en: enRes.provenance,
        ru: ruRes.provenance
      }
    };
  }

  /**
   * Direct lookup by explicit namespace and key.
   */
  resolveByNamespaceAndKey(namespace, key, options: Record<string, any> = {}) {
    return this.resolve({ TableId: namespace, Key: key }, options);
  }
}

function createLocalizationResolver() {
  return new LocalizationResolver();
}

export {
  LocalizationResolver,
  createLocalizationResolver,
  normalizeTableId,
  cleanHtmlTags,
};
