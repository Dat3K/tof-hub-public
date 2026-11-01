import fs from 'node:fs';
import path from 'node:path';
import {
  type ChangelogBaselineCharacter,
  type ChangelogBaselinePayload,
  type BaselineIdPartition,
  partitionBaselineIds,
} from './baseline';

export type ChangelogCategory =
  | 'Skill'
  | 'Normal'
  | 'Dodge'
  | 'Discharge'
  | 'Passive'
  | 'Advancement'
  | 'Trait'
  | 'Matrix'
  | 'Stat'
  | 'Other';

export interface ChangelogValueChange {
  type: ChangelogCategory;
  path: string;
  old: string | number;
  new: string | number;
  field?: string;
  skill_id?: string;
  action_id?: string;
  passive_id?: string;
}

export interface CharacterChangelogEntry {
  patch: string;
  client: string;
  clientRu: string;
  date: string;
  edition: 'gacha' | 'mmo';
  server_mode: 'gacha' | 'mmo';
  changes: ChangelogValueChange[];
}

export interface CharacterDiffSummary {
  characterId: string;
  name_en?: string;
  name_ru?: string;
  edition: 'gacha' | 'mmo';
  hasChanges: boolean;
  changes: ChangelogValueChange[];
  changelogEntry?: CharacterChangelogEntry;
}

export interface ChangelogEditionComparison {
  edition: 'gacha' | 'mmo';
  status: 'ok' | 'no_changes' | 'baseline_unavailable' | 'malformed';
  totalOld: number;
  totalNew: number;
  commonIds: string[];
  newIds: string[];
  removedIds: string[];
  charactersWithChangesCount: number;
  totalValueChangesCount: number;
  characterDiffs: Record<string, CharacterDiffSummary>;
  removedCharacters: Array<{ id: string; name_en?: string; name_ru?: string }>;
  addedCharacters: Array<{ id: string; name_en?: string; name_ru?: string }>;
}

export interface ChangelogComparisonResult {
  success: boolean;
  status: 'ready' | 'no_changes' | 'baseline_unavailable' | 'malformed';
  generatedAt: string;
  patch: string;
  client: string;
  clientRu: string;
  date: string;
  gacha: ChangelogEditionComparison;
  mmo: ChangelogEditionComparison;
  summary: {
    totalCommonCharacters: number;
    totalNewCharacters: number;
    totalRemovedCharacters: number;
    totalCharactersWithChanges: number;
    totalValueChanges: number;
  };
  warnings?: string[];
  errors?: string[];
}

export interface ChangelogComparisonOptions {
  patch?: string;
  client?: string;
  clientRu?: string;
  date?: string;
  verbose?: boolean;
}

export interface CharacterCompareOptions {
  edition?: 'gacha' | 'mmo';
  patch?: string;
  client?: string;
  clientRu?: string;
  date?: string;
}

const NUMERIC_REGEX = /\d+(?:\.\d+)?/g;
const PLACEHOLDER_REGEX = /^(?:—|-|tbd|none|null|n\/a)$/i;

/**
 * Checks whether a raw string represents an uninitialized or placeholder value.
 */
export function isPlaceholderValue(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return true;
    return PLACEHOLDER_REGEX.test(trimmed);
  }
  return false;
}

/**
 * Extracts numeric sequence from text to test for balance modifications.
 */
export function extractNumbers(val: string): string[] {
  return val.match(NUMERIC_REGEX) || [];
}

/**
 * Classifies a property path into standard category types matching legacy info/simulacra/changelog behavior.
 */
export function classifyChangePath(pathStr: string, itemObj?: any): ChangelogCategory {
  const normalized = pathStr.toLowerCase();
  const parts = normalized.split('.');
  const root = parts[0];

  if (root === 'advancements' || root.startsWith('advancement')) {
    return 'Advancement';
  }
  if (root === 'traits' || root === 'awakening' || root.startsWith('trait')) {
    return 'Trait';
  }
  if (root === 'passives' || (root === 'weapon' && parts[1] === 'passives')) {
    return 'Passive';
  }
  if (root === 'matrices' || root === 'matrix') {
    return 'Matrix';
  }
  if (
    root === 'base_stats' ||
    root === 'max_stats' ||
    root === 'stats' ||
    parts.includes('base_stats') ||
    parts.includes('max_stats')
  ) {
    return 'Stat';
  }
  if (root === 'skills' || root === 'skill' || (root === 'weapon' && (parts[1] === 'skills' || parts[1] === 'skill'))) {
    if (itemObj && typeof itemObj === 'object') {
      const cat = String(itemObj.category || '').toLowerCase();
      if (cat === 'normal') return 'Normal';
      if (cat === 'dodge') return 'Dodge';
      if (cat === 'discharge') return 'Discharge';
      if (cat === 'passive') return 'Passive';
    }
    if (normalized.includes('discharge')) return 'Discharge';
    if (normalized.includes('dodge')) return 'Dodge';
    if (normalized.includes('normal')) return 'Normal';
    if (normalized.includes('passive')) return 'Passive';
    return 'Skill';
  }

  return 'Other';
}

/**
 * Recursively compares two objects and detects tracked value modifications.
 * Invariant: Text descriptions without numeric differences are ignored to avoid wording false positives.
 */
export function deepCompareValues(
  val1: any,
  val2: any,
  basePath: string = ''
): ChangelogValueChange[] {
  const changes: ChangelogValueChange[] = [];

  if (val1 === undefined || val2 === undefined || val1 === null || val2 === null) {
    return changes;
  }

  if (typeof val1 !== typeof val2) {
    return changes;
  }

  // 1. Array comparison
  if (Array.isArray(val1) && Array.isArray(val2)) {
    const minLen = Math.min(val1.length, val2.length);
    for (let i = 0; i < minLen; i++) {
      const item1 = val1[i];
      const item2 = val2[i];
      const itemPath = basePath ? `${basePath}.${i}` : `${i}`;
      changes.push(...deepCompareValues(item1, item2, itemPath));
    }
    return changes;
  }

  // 2. Object comparison
  if (typeof val1 === 'object') {
    const keys = Object.keys(val2);
    for (const key of keys) {
      if (key === 'changelogs') continue; // Do not recursively diff historical changelog records
      const currentPath = basePath ? `${basePath}.${key}` : key;
      changes.push(...deepCompareValues(val1[key], val2[key], currentPath));
    }
    return changes;
  }

  // 3. Leaf value comparison
  if (val1 !== val2) {
    // 3a. String values
    if (typeof val1 === 'string' && typeof val2 === 'string') {
      const s1 = val1.trim();
      const s2 = val2.trim();

      if (isPlaceholderValue(s1) || isPlaceholderValue(s2)) {
        return changes;
      }

      const nums1 = extractNumbers(s1);
      const nums2 = extractNumbers(s2);

      // Only track when both strings contain numeric values and those values actually changed
      if (nums1.length > 0 && nums2.length > 0 && nums1.join(',') !== nums2.join(',')) {
        changes.push({
          type: classifyChangePath(basePath),
          path: basePath,
          old: val1,
          new: val2,
        });
      }
    } else if (typeof val1 === 'number' && typeof val2 === 'number') {
      // 3b. Number values
      // Exclude uninitialized 0 -> number transitions representing initial placeholder fill
      if (val1 !== 0 || val2 === 0) {
        changes.push({
          type: classifyChangePath(basePath),
          path: basePath,
          old: val1,
          new: val2,
        });
      }
    }
  }

  return changes;
}

/**
 * Compares tracked values for an individual character present in both baselines.
 */
export function compareCharacterValues(
  oldChar: ChangelogBaselineCharacter,
  newChar: ChangelogBaselineCharacter,
  options: CharacterCompareOptions = {}
): CharacterDiffSummary {
  const characterId = String(newChar.id || oldChar.id);
  const edition = options.edition || (newChar.server_mode === 'mmo' || oldChar.server_mode === 'mmo' ? 'mmo' : 'gacha');
  const date = options.date || new Date().toISOString().split('T')[0];
  const patch = options.patch || `Update ${date}`;
  const client = options.client || 'Korea Dev 1';
  const clientRu = options.clientRu || 'Корея Dev 1';

  const changes: ChangelogValueChange[] = [];

  // Tracked section 1: Advancements
  const oldAdv = Array.isArray(oldChar.advancements) ? oldChar.advancements : [];
  const newAdv = Array.isArray(newChar.advancements) ? newChar.advancements : [];
  if (oldAdv.length > 0 && newAdv.length > 0) {
    const advChanges = deepCompareValues(oldAdv, newAdv, 'advancements');
    for (const c of advChanges) {
      c.type = 'Advancement';
      changes.push(c);
    }
  }

  // Tracked section 2: Traits / Awakening
  const oldTraits = Array.isArray(oldChar.traits) ? oldChar.traits : [];
  const newTraits = Array.isArray(newChar.traits) ? newChar.traits : [];
  if (oldTraits.length > 0 && newTraits.length > 0) {
    const traitChanges = deepCompareValues(oldTraits, newTraits, 'traits');
    for (const c of traitChanges) {
      c.type = 'Trait';
      changes.push(c);
    }
  }

  // Tracked section 3: Weapon skills
  const oldSkills = Array.isArray(oldChar.weapon?.skills)
    ? oldChar.weapon.skills
    : Array.isArray(oldChar.skills)
      ? oldChar.skills
      : (oldChar.weapon?.skills && typeof oldChar.weapon.skills === 'object' ? oldChar.weapon.skills : null);

  const newSkills = Array.isArray(newChar.weapon?.skills)
    ? newChar.weapon.skills
    : Array.isArray(newChar.skills)
      ? newChar.skills
      : (newChar.weapon?.skills && typeof newChar.weapon.skills === 'object' ? newChar.weapon.skills : null);

  if (oldSkills && newSkills) {
    const skillChanges = deepCompareValues(oldSkills, newSkills, 'skills');
    for (const c of skillChanges) {
      if (c.type === 'Other') {
        c.type = 'Skill';
      }
      changes.push(c);
    }
  }

  // Tracked section 4: Weapon passives
  const oldPassives = Array.isArray(oldChar.weapon?.passives)
    ? oldChar.weapon.passives
    : Array.isArray(oldChar.passives)
      ? oldChar.passives
      : null;

  const newPassives = Array.isArray(newChar.weapon?.passives)
    ? newChar.weapon.passives
    : Array.isArray(newChar.passives)
      ? newChar.passives
      : null;

  if (oldPassives && newPassives) {
    const passiveChanges = deepCompareValues(oldPassives, newPassives, 'passives');
    for (const c of passiveChanges) {
      c.type = 'Passive';
      changes.push(c);
    }
  }

  // Tracked section 5: Base & Max Stats
  if (oldChar.base_stats && newChar.base_stats) {
    const statChanges = deepCompareValues(oldChar.base_stats, newChar.base_stats, 'base_stats');
    for (const c of statChanges) {
      c.type = 'Stat';
      changes.push(c);
    }
  }

  if (oldChar.max_stats && newChar.max_stats) {
    const statChanges = deepCompareValues(oldChar.max_stats, newChar.max_stats, 'max_stats');
    for (const c of statChanges) {
      c.type = 'Stat';
      changes.push(c);
    }
  }

  // Tracked section 6: Weapon top-level attributes (shatter, charge)
  if (oldChar.weapon && newChar.weapon) {
    const weaponKeys = ['shatter', 'charge'];
    for (const wk of weaponKeys) {
      const v1 = oldChar.weapon[wk];
      const v2 = newChar.weapon[wk];
      if (typeof v1 === 'number' && typeof v2 === 'number' && v1 !== v2) {
        if (v1 !== 0 || v2 === 0) {
          changes.push({
            type: 'Stat',
            path: `weapon.${wk}`,
            old: v1,
            new: v2,
          });
        }
      }
    }
  }

  const hasChanges = changes.length > 0;
  let changelogEntry: CharacterChangelogEntry | undefined;

  if (hasChanges) {
    changelogEntry = {
      patch,
      client,
      clientRu,
      date,
      edition,
      server_mode: edition,
      changes,
    };
  }

  return {
    characterId,
    name_en: newChar.name_en || oldChar.name_en,
    name_ru: newChar.name_ru || oldChar.name_ru,
    edition,
    hasChanges,
    changes,
    changelogEntry,
  };
}

/**
 * Compares an individual edition (gacha or mmo) against its baseline.
 * Strictly guarantees:
 *  - Only common IDs are compared for value changes.
 *  - New IDs produce 0 value-change records.
 *  - Missing IDs are categorized separately as removed.
 */
export function compareEditionChangelogs(
  edition: 'gacha' | 'mmo',
  oldBaseline: ChangelogBaselinePayload | null,
  newBaseline: ChangelogBaselinePayload | null,
  options: ChangelogComparisonOptions = {}
): ChangelogEditionComparison {
  if (!newBaseline || typeof newBaseline !== 'object' || !newBaseline.characters) {
    return {
      edition,
      status: 'malformed',
      totalOld: oldBaseline?.total || 0,
      totalNew: 0,
      commonIds: [],
      newIds: [],
      removedIds: oldBaseline ? Object.keys(oldBaseline.characters).sort() : [],
      charactersWithChangesCount: 0,
      totalValueChangesCount: 0,
      characterDiffs: {},
      removedCharacters: [],
      addedCharacters: [],
    };
  }

  if (!oldBaseline || typeof oldBaseline !== 'object' || !oldBaseline.characters) {
    const newIds = Object.keys(newBaseline.characters).sort();
    const addedCharacters = newIds.map((id) => ({
      id,
      name_en: newBaseline.characters[id]?.name_en,
      name_ru: newBaseline.characters[id]?.name_ru,
    }));

    return {
      edition,
      status: 'baseline_unavailable',
      totalOld: 0,
      totalNew: newBaseline.total || newIds.length,
      commonIds: [],
      newIds,
      removedIds: [],
      charactersWithChangesCount: 0,
      totalValueChangesCount: 0,
      characterDiffs: {},
      removedCharacters: [],
      addedCharacters,
    };
  }

  const partition: BaselineIdPartition = partitionBaselineIds(oldBaseline, newBaseline);

  const characterDiffs: Record<string, CharacterDiffSummary> = {};
  let totalValueChangesCount = 0;
  let charactersWithChangesCount = 0;

  // Compare only IDs present in both the old baseline and the fresh export
  for (const id of partition.commonIds) {
    const oldChar = oldBaseline.characters[id];
    const newChar = newBaseline.characters[id];

    if (!oldChar || !newChar) continue;

    const diff = compareCharacterValues(oldChar, newChar, {
      edition,
      patch: options.patch,
      client: options.client,
      clientRu: options.clientRu,
      date: options.date,
    });

    if (diff.hasChanges) {
      characterDiffs[id] = diff;
      charactersWithChangesCount++;
      totalValueChangesCount += diff.changes.length;
    }
  }

  const addedCharacters = partition.newIds.map((id) => ({
    id,
    name_en: newBaseline.characters[id]?.name_en,
    name_ru: newBaseline.characters[id]?.name_ru,
  }));

  const removedCharacters = partition.removedIds.map((id) => ({
    id,
    name_en: oldBaseline.characters[id]?.name_en,
    name_ru: oldBaseline.characters[id]?.name_ru,
  }));

  const status = charactersWithChangesCount > 0 ? 'ok' : 'no_changes';

  return {
    edition,
    status,
    totalOld: oldBaseline.total || Object.keys(oldBaseline.characters).length,
    totalNew: newBaseline.total || Object.keys(newBaseline.characters).length,
    commonIds: partition.commonIds,
    newIds: partition.newIds,
    removedIds: partition.removedIds,
    charactersWithChangesCount,
    totalValueChangesCount,
    characterDiffs,
    removedCharacters,
    addedCharacters,
  };
}

/**
 * Top-level Simulacra changelog comparison engine.
 * Evaluates Gacha and MMO editions separately, ensuring new characters never produce value diffs.
 */
export function compareSimulacraChangelogs(
  oldBaselines: {
    gacha: ChangelogBaselinePayload | null;
    mmo: ChangelogBaselinePayload | null;
  } | null,
  freshBaselines: {
    gacha: ChangelogBaselinePayload | null;
    mmo: ChangelogBaselinePayload | null;
  },
  options: ChangelogComparisonOptions = {}
): ChangelogComparisonResult {
  const generatedAt = new Date().toISOString();
  const date = options.date || generatedAt.split('T')[0];
  const patch = options.patch || `Update ${date}`;
  const client = options.client || 'Korea Dev 1';
  const clientRu = options.clientRu || 'Корея Dev 1';

  const warnings: string[] = [];
  const errors: string[] = [];

  const gachaDiff = compareEditionChangelogs(
    'gacha',
    oldBaselines?.gacha || null,
    freshBaselines.gacha || null,
    { ...options, patch, client, clientRu, date }
  );

  const mmoDiff = compareEditionChangelogs(
    'mmo',
    oldBaselines?.mmo || null,
    freshBaselines.mmo || null,
    { ...options, patch, client, clientRu, date }
  );

  if (gachaDiff.status === 'baseline_unavailable') {
    warnings.push('Gacha baseline was unavailable; changelog comparison skipped for Gacha.');
  }
  if (mmoDiff.status === 'baseline_unavailable') {
    warnings.push('MMO baseline was unavailable; changelog comparison skipped for MMO.');
  }
  if (gachaDiff.status === 'malformed') {
    errors.push('Gacha fresh export baseline is malformed.');
  }
  if (mmoDiff.status === 'malformed') {
    errors.push('MMO fresh export baseline is malformed.');
  }

  const totalCommonCharacters = gachaDiff.commonIds.length + mmoDiff.commonIds.length;
  const totalNewCharacters = gachaDiff.newIds.length + mmoDiff.newIds.length;
  const totalRemovedCharacters = gachaDiff.removedIds.length + mmoDiff.removedIds.length;
  const totalCharactersWithChanges =
    gachaDiff.charactersWithChangesCount + mmoDiff.charactersWithChangesCount;
  const totalValueChanges =
    gachaDiff.totalValueChangesCount + mmoDiff.totalValueChangesCount;

  let overallStatus: ChangelogComparisonResult['status'] = 'ready';
  if (errors.length > 0) {
    overallStatus = 'malformed';
  } else if (
    gachaDiff.status === 'baseline_unavailable' &&
    mmoDiff.status === 'baseline_unavailable'
  ) {
    overallStatus = 'baseline_unavailable';
  } else if (totalCharactersWithChanges === 0) {
    overallStatus = 'no_changes';
  }

  if (options.verbose) {
    console.log(`[CHANGELOG-COMPARE] Comparison completed (status: ${overallStatus}):`);
    console.log(`  Gacha: ${gachaDiff.charactersWithChangesCount} characters changed (${gachaDiff.totalValueChangesCount} values)`);
    console.log(`  MMO:   ${mmoDiff.charactersWithChangesCount} characters changed (${mmoDiff.totalValueChangesCount} values)`);
    console.log(`  New IDs (excluded from value changes): ${totalNewCharacters}`);
    console.log(`  Removed IDs (separate category):       ${totalRemovedCharacters}`);
  }

  return {
    success: errors.length === 0,
    status: overallStatus,
    generatedAt,
    patch,
    client,
    clientRu,
    date,
    gacha: gachaDiff,
    mmo: mmoDiff,
    summary: {
      totalCommonCharacters,
      totalNewCharacters,
      totalRemovedCharacters,
      totalCharactersWithChanges,
      totalValueChanges,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Applies computed changelog entries to an array or record of characters.
 * Preserves historical changelogs and prepends the new patch changelog at index 0.
 * Guarantees that new characters receive 0 synthetic changelog entries.
 */
export function applyChangelogsToCharacters(
  characters: Record<string, any> | any[],
  editionDiff: ChangelogEditionComparison
): number {
  let updatedCount = 0;

  if (Array.isArray(characters)) {
    for (const char of characters) {
      const id = String(char.id || char.slug || '');
      const diff = editionDiff.characterDiffs[id];
      if (diff && diff.hasChanges && diff.changelogEntry) {
        const existingLogs = Array.isArray(char.changelogs) ? char.changelogs : [];
        char.changelogs = [diff.changelogEntry, ...existingLogs];
        updatedCount++;
      }
    }
  } else if (characters && typeof characters === 'object') {
    for (const [id, char] of Object.entries(characters)) {
      const diff = editionDiff.characterDiffs[id];
      if (diff && diff.hasChanges && diff.changelogEntry) {
        const existingLogs = Array.isArray(char.changelogs) ? char.changelogs : [];
        char.changelogs = [diff.changelogEntry, ...existingLogs];
        updatedCount++;
      }
    }
  }

  return updatedCount;
}

/**
 * Generates a human-readable text diff report.
 */
export function generateChangelogDiffReport(result: ChangelogComparisonResult): string {
  const lines: string[] = [];
  lines.push('================================================================================');
  lines.push(`Tower of Fantasy Simulacra Changelog Comparison Report`);
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Patch:     ${result.patch} | Client: ${result.client} (${result.clientRu})`);
  lines.push(`Status:    ${result.status.toUpperCase()}`);
  lines.push('================================================================================');
  lines.push('');

  lines.push('SUMMARY:');
  lines.push(`  Common Characters Compared:   ${result.summary.totalCommonCharacters}`);
  lines.push(`  Characters With Value Changes: ${result.summary.totalCharactersWithChanges}`);
  lines.push(`  Total Value Changes Tracked:   ${result.summary.totalValueChanges}`);
  lines.push(`  New Characters (Excluded):     ${result.summary.totalNewCharacters}`);
  lines.push(`  Removed Characters (Separate): ${result.summary.totalRemovedCharacters}`);
  lines.push('');

  // Gacha Edition Details
  lines.push(`--------------------------------------------------------------------------------`);
  lines.push(`GACHA EDITION (${result.gacha.status}):`);
  lines.push(`  Baseline Total: ${result.gacha.totalOld} | Fresh Export Total: ${result.gacha.totalNew}`);
  lines.push(`  Characters with Changes: ${result.gacha.charactersWithChangesCount}`);

  if (result.gacha.charactersWithChangesCount > 0) {
    for (const [id, diff] of Object.entries(result.gacha.characterDiffs)) {
      lines.push(`  - [${id}] ${diff.name_en || id} (${diff.changes.length} changes):`);
      for (const c of diff.changes) {
        lines.push(`      * [${c.type}] ${c.path}: "${c.old}" -> "${c.new}"`);
      }
    }
  } else {
    lines.push(`  (No value changes detected for existing Gacha characters)`);
  }

  if (result.gacha.newIds.length > 0) {
    lines.push(`  New Characters Added (${result.gacha.newIds.length}, zero value changes):`);
    lines.push(`    ${result.gacha.newIds.join(', ')}`);
  }

  if (result.gacha.removedIds.length > 0) {
    lines.push(`  Characters Absent in New Data (${result.gacha.removedIds.length}):`);
    lines.push(`    ${result.gacha.removedIds.join(', ')}`);
  }
  lines.push('');

  // MMO Edition Details
  lines.push(`--------------------------------------------------------------------------------`);
  lines.push(`MMO EDITION (${result.mmo.status}):`);
  lines.push(`  Baseline Total: ${result.mmo.totalOld} | Fresh Export Total: ${result.mmo.totalNew}`);
  lines.push(`  Characters with Changes: ${result.mmo.charactersWithChangesCount}`);

  if (result.mmo.charactersWithChangesCount > 0) {
    for (const [id, diff] of Object.entries(result.mmo.characterDiffs)) {
      lines.push(`  - [${id}] ${diff.name_en || id} (${diff.changes.length} changes):`);
      for (const c of diff.changes) {
        lines.push(`      * [${c.type}] ${c.path}: "${c.old}" -> "${c.new}"`);
      }
    }
  } else {
    lines.push(`  (No value changes detected for existing MMO characters)`);
  }

  if (result.mmo.newIds.length > 0) {
    lines.push(`  New Characters Added (${result.mmo.newIds.length}, zero value changes):`);
    lines.push(`    ${result.mmo.newIds.join(', ')}`);
  }

  if (result.mmo.removedIds.length > 0) {
    lines.push(`  Characters Absent in New Data (${result.mmo.removedIds.length}):`);
    lines.push(`    ${result.mmo.removedIds.join(', ')}`);
  }
  lines.push('');

  if (result.warnings && result.warnings.length > 0) {
    lines.push('WARNINGS:');
    for (const w of result.warnings) {
      lines.push(`  ! ${w}`);
    }
    lines.push('');
  }

  if (result.errors && result.errors.length > 0) {
    lines.push('ERRORS:');
    for (const e of result.errors) {
      lines.push(`  x ${e}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Saves changelog comparison artifacts (machine-readable JSON + human-readable TXT) to the target directory.
 */
export function saveChangelogArtifacts(
  outputDir: string,
  result: ChangelogComparisonResult
): {
  diffJsonPath: string;
  reportTxtPath: string;
} {
  const resolvedOut = path.resolve(outputDir);
  const changelogDir = path.join(resolvedOut, 'game-data', 'changelog');
  const valDir = path.join(resolvedOut, 'validation');

  if (!fs.existsSync(changelogDir)) {
    fs.mkdirSync(changelogDir, { recursive: true });
  }
  if (!fs.existsSync(valDir)) {
    fs.mkdirSync(valDir, { recursive: true });
  }

  const diffJsonPath = path.join(changelogDir, 'changelog-diff.json');
  const reportTxtPath = path.join(valDir, 'changelog-report.txt');
  const reportJsonPath = path.join(valDir, 'changelog-report.json');

  const jsonContent = JSON.stringify(result, null, 2);
  const textContent = generateChangelogDiffReport(result);

  fs.writeFileSync(diffJsonPath, jsonContent, 'utf8');
  fs.writeFileSync(reportJsonPath, jsonContent, 'utf8');
  fs.writeFileSync(reportTxtPath, textContent, 'utf8');

  return {
    diffJsonPath,
    reportTxtPath,
  };
}
