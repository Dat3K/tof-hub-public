'use strict';
/**
 * Boss base stats from DT_MonsterStaticData, shared by the Team8P raid and FCE boss processors.
 *
 * Sources (Overseas rows win; the shared table only fills bosses the Overseas table has no match for):
 * - Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json
 * - Hotta/Content/Resources/CoreBlueprints/DataTable/DT_MonsterStaticData.json
 */

const fs = require('node:fs');
const path = require('node:path');

const TofFormulas = require('./tof-formulas.js');

const MONSTER_OVERSEAS_RELATIVE = 'Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json';
const MONSTER_SHARED_RELATIVE = 'Hotta/Content/Resources/CoreBlueprints/DataTable/DT_MonsterStaticData.json';

/** Raid and FCE rows carry no boss level; the formulas' default level (the level cap) is used and recorded. */
const RESIST_FORMULA_LEVEL = 100;
const RESIST_FIELDS = { physical: 'PhyDefBase', flame: 'FireDefBase', frost: 'IceDefBase', volt: 'ThunderDefBase', altered: 'SuperpowerDefBase' };

function loadMonsterTables(rawDir) {
  return [
    { path: MONSTER_OVERSEAS_RELATIVE, selection: 'overseas-row' },
    { path: MONSTER_SHARED_RELATIVE, selection: 'shared-base-fallback' },
  ].filter((table) => fs.existsSync(path.join(rawDir, table.path))).map((table) => {
    const data = JSON.parse(fs.readFileSync(path.join(rawDir, table.path), 'utf8').replace(/^﻿/, ''));
    return { ...table, rows: (Array.isArray(data) ? data[0]?.Rows : data.Rows) || {} };
  });
}

/** `resist = X / (X + K(L))` per element (same formula as the Origin of War page) and FinalCritDef as a percent. */
function deriveBossStats(fields) {
  const resistPct = Object.fromEntries(Object.entries(RESIST_FIELDS).map(([element, field]) => {
    const x = fields?.[field];
    return [element, typeof x === 'number' ? TofFormulas.calcResist(x, RESIST_FORMULA_LEVEL).resistPct * 100 : null];
  }));
  return {
    formulaLevel: RESIST_FORMULA_LEVEL,
    resistK: TofFormulas.resistK(RESIST_FORMULA_LEVEL),
    resistPct,
    finalCritDefPct: typeof fields?.FinalCritDef === 'number' ? fields.FinalCritDef * 100 : null,
  };
}

function statRow(rowId, fields, table) {
  return { rowId, selection: table.selection, sourcePath: table.path, fields, derived: deriveBossStats(fields) };
}

/**
 * Last-phase stats of an FCE boss: rows keyed `Boss_[hum_]<number>_<phase>` (leading zeros ignored on both
 * parts, e.g. `Boss_hum_046_5`, `Boss_015_05`); the highest row suffix is returned. `phase` is the ordinal of that row
 * among the boss's phase rows (rows `_0`…`_4` are five phases, like `_1`…`_5`), `rowPhase` the raw suffix.
 */
function lastPhaseStats(bossNumber, tables) {
  if (!Number.isFinite(bossNumber)) return null;
  for (const table of tables) {
    const phases = Object.entries(table.rows).flatMap(([rowId, fields]) => {
      const match = rowId.match(/^boss_(?:hum_)?0*(\d+)_0*(\d)$/i);
      return match && Number(match[1]) === bossNumber && fields && typeof fields === 'object' ? [{ phase: Number(match[2]), rowId, fields }] : [];
    }).sort((a, b) => b.phase - a.phase);
    if (phases[0]) return { phase: phases.length, rowPhase: phases[0].phase, joinMethod: 'boss-number-and-phase', ...statRow(phases[0].rowId, phases[0].fields, table) };
  }
  return null;
}

/**
 * Fallback for bosses whose card number does not name their monster rows (Valkyrie: card `boss_hum_032`, ladder
 * waves `bjzq_3_1`…`bjzq_3_5`): the exact BorderWar wave attribute IDs of the boss's ladder entry, highest
 * trailing phase number.
 */
function lastPhaseStatsByAttributeIds(attributeIds, tables) {
  const wanted = new Map((attributeIds || []).map((id) => [String(id).toLowerCase(), id]));
  for (const table of tables) {
    const phases = Object.entries(table.rows).flatMap(([rowId, fields]) => {
      const match = rowId.match(/_0*(\d)$/);
      return match && wanted.has(rowId.toLowerCase()) && fields && typeof fields === 'object' ? [{ phase: Number(match[1]), rowId, fields }] : [];
    }).sort((a, b) => b.phase - a.phase);
    if (phases[0]) return { phase: phases.length, rowPhase: phases[0].phase, joinMethod: 'ladder-attribute-id', ...statRow(phases[0].rowId, phases[0].fields, table) };
  }
  return null;
}

module.exports = { MONSTER_OVERSEAS_RELATIVE, MONSTER_SHARED_RELATIVE, loadMonsterTables, deriveBossStats, statRow, lastPhaseStats, lastPhaseStatsByAttributeIds };
