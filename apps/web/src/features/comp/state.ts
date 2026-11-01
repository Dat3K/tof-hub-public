import type {
  SquadMode,
  CompServer,
  SquadRole,
  SquadPlayer,
  SquadWeaponSlot,
  SquadMatrixSlot,
  SquadRelicSlot,
  SquadState,
} from './types';
import { PRESETS, PRESET_FROST_8P } from './presets';
import type { CompCatalogView, CompWeaponView } from './data';

export const MAX_PLAYERS = 8;
export const DEFAULT_MODE: SquadMode = 8;
export const WEAPONS_PER_PLAYER = 3;
export const RELICS_PER_PLAYER = 2;

export function createEmptyWeaponSlot(): SquadWeaponSlot {
  return {
    id: null,
    stars: 6,
    matrix: null,
    customText: '',
  };
}

export function createEmptyRelicSlot(): SquadRelicSlot {
  return {
    id: null,
    rank: 5,
    customText: '',
  };
}

export function createEmptyPlayer(index = 0): SquadPlayer {
  const weapons: SquadWeaponSlot[] = [];
  for (let i = 0; i < WEAPONS_PER_PLAYER; i++) {
    weapons.push(createEmptyWeaponSlot());
  }

  const relics: SquadRelicSlot[] = [];
  for (let i = 0; i < RELICS_PER_PLAYER; i++) {
    relics.push(createEmptyRelicSlot());
  }

  return {
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    role: 'dps',
    customRole: null,
    trait: null,
    traitCustomText: '',
    weapons,
    relics,
  };
}

export function createInitialSquadState(
  mode: SquadMode = DEFAULT_MODE,
  title = 'Squad Composition',
  server: CompServer = 'standard'
): SquadState {
  const players: SquadPlayer[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    players.push(createEmptyPlayer(i));
  }
  return {
    mode,
    server,
    title,
    players,
  };
}

export function ensurePlayerSlots(state: SquadState): SquadState {
  if (!state.players || !Array.isArray(state.players)) {
    state.players = [];
  }
  while (state.players.length < MAX_PLAYERS) {
    state.players.push(createEmptyPlayer(state.players.length));
  }
  return state;
}

export function setSquadMode(state: SquadState, newMode: SquadMode): SquadState {
  ensurePlayerSlots(state);
  return {
    ...state,
    mode: newMode === 8 ? 8 : 4,
  };
}

export function getActivePlayers(state: SquadState): SquadPlayer[] {
  ensurePlayerSlots(state);
  return state.players.slice(0, state.mode);
}

// Fallback lookup sets matching legacy comp-core.js
const KNOWN_TANK_WEAPONS = new Set([
  'lan', 'saki-fuwa', 'meryl', 'meryl-ironheart', 'huang', 'ene',
  'stabdagger', 'xiuma', 'asuka', 'make', 'marc',
]);

const KNOWN_HEALER_WEAPONS = new Set([
  'fiona', 'ling', 'zero', 'xinghuan', 'lyra', 'brevey',
  'avatar06', 'nemesis', 'kekelite', 'coco', 'cocoritter', 'pepper',
  'lechesis', 'greyfox',
]);

import { isCustomText, isCustomPhoto } from './types';

export function getWeaponCanonicalRole(weaponId: string | null | undefined, catalog?: CompCatalogView | null): SquadRole {
  if (!weaponId || isCustomText(weaponId)) return 'dps';
  const id = String(weaponId).toLowerCase().trim();

  if (catalog && catalog.weapons) {
    const found = catalog.weapons.find((w: CompWeaponView) => w.id.toLowerCase() === id || (w.weaponId && w.weaponId.toLowerCase() === id));
    if (found) {
      if (found.canonicalRole) {
        const cr = found.canonicalRole.toLowerCase();
        if (cr === 'tank' || cr === 'fortitude') return 'tank';
        if (cr === 'healer' || cr === 'support' || cr === 'benediction') return 'healer';
        if (cr === 'balance' || cr === 'balanced') return 'balance';
        return 'dps';
      }
      if (found.role) {
        const r = found.role.toLowerCase();
        if (r === 'tank' || r === 'fortitude' || r === 'защита') return 'tank';
        if (r === 'benediction' || r === 'healer' || r === 'heal' || r === 'благословение' || r === 'хил') return 'healer';
        if (r === 'balance' || r === 'bal' || r === 'баланс') return 'balance';
        return 'dps';
      }
    }
  }

  // Fallback to simulacra collection in catalog
  if (catalog && catalog.simulacra) {
    const sim = catalog.simulacra.find((s) => s.id.toLowerCase() === id || (s.weaponId && s.weaponId.toLowerCase() === id));
    if (sim && sim.role) {
      const r = sim.role.toLowerCase();
      if (r === 'tank' || r === 'fortitude' || r === 'defense' || r === 'защита') return 'tank';
      if (r === 'benediction' || r === 'support' || r === 'healer' || r === 'heal' || r === 'благословение' || r === 'хил') return 'healer';
      if (r === 'balance' || r === 'bal' || r === 'баланс') return 'balance';
      return 'dps';
    }
  }

  if (KNOWN_TANK_WEAPONS.has(id)) return 'tank';
  if (KNOWN_HEALER_WEAPONS.has(id)) return 'healer';
  // MMO roster reuses gacha slugs with an -mmo suffix.
  const baseId = id.replace(/-mmo$/, '');
  if (baseId !== id) {
    if (KNOWN_TANK_WEAPONS.has(baseId)) return 'tank';
    if (KNOWN_HEALER_WEAPONS.has(baseId)) return 'healer';
  }
  return 'dps';
}

/**
 * Automatically detects player resonance role from equipped weapons:
 * - Tank: 2+ Fortitude weapons
 * - Healer: 2+ Benediction weapons
 * - DPS: 2+ Attack weapons
 * - Balance: 2+ equipped without a dominant role
 * - Single weapon: that weapon's role
 * - Empty: DPS fallback
 */
export function detectResonance(weapons: SquadWeaponSlot[], catalog?: CompCatalogView | null): SquadRole {
  if (!weapons || !Array.isArray(weapons)) return 'dps';

  let tankCount = 0;
  let healerCount = 0;
  let dpsCount = 0;
  let totalEquipped = 0;

  for (const w of weapons) {
    if (!w || !w.id || isCustomText(w.id)) continue;
    totalEquipped++;
    const role = getWeaponCanonicalRole(w.id, catalog);
    if (role === 'tank') tankCount++;
    else if (role === 'healer') healerCount++;
    else if (role === 'dps') dpsCount++;
  }

  if (totalEquipped === 0) return 'dps';
  if (tankCount >= 2) return 'tank';
  if (healerCount >= 2) return 'healer';
  if (dpsCount >= 2) return 'dps';
  if (totalEquipped >= 2) return 'balance';
  if (totalEquipped === 1) {
    if (tankCount === 1) return 'tank';
    if (healerCount === 1) return 'healer';
    if (dpsCount === 1) return 'dps';
  }
  return 'dps';
}

export function getPlayerActiveRole(player: SquadPlayer, catalog?: CompCatalogView | null): SquadRole {
  if (!player) return 'dps';
  if (player.customRole) return player.customRole;
  return detectResonance(player.weapons, catalog);
}

export function movePlayer(state: SquadState, fromIndex: number, toIndex: number): SquadState {
  ensurePlayerSlots(state);
  if (fromIndex < 0 || fromIndex >= state.players.length || toIndex < 0 || toIndex >= state.players.length) {
    return state;
  }
  const newPlayers = [...state.players];
  const [removed] = newPlayers.splice(fromIndex, 1);
  newPlayers.splice(toIndex, 0, removed);
  return { ...state, players: newPlayers };
}

export function swapPlayers(state: SquadState, index1: number, index2: number): SquadState {
  ensurePlayerSlots(state);
  if (index1 < 0 || index1 >= state.players.length || index2 < 0 || index2 >= state.players.length) {
    return state;
  }
  const newPlayers = [...state.players];
  const tmp = newPlayers[index1];
  newPlayers[index1] = newPlayers[index2];
  newPlayers[index2] = tmp;
  return { ...state, players: newPlayers };
}

export function swapWeaponSlots(
  state: SquadState,
  pIdx1: number,
  wIdx1: number,
  pIdx2: number,
  wIdx2: number
): SquadState {
  ensurePlayerSlots(state);
  const newPlayers = [...state.players];
  const p1 = { ...newPlayers[pIdx1], weapons: [...newPlayers[pIdx1].weapons] };
  const p2 = pIdx1 === pIdx2 ? p1 : { ...newPlayers[pIdx2], weapons: [...newPlayers[pIdx2].weapons] };

  const tmp = p1.weapons[wIdx1];
  p1.weapons[wIdx1] = p2.weapons[wIdx2];
  p2.weapons[wIdx2] = tmp;

  newPlayers[pIdx1] = p1;
  newPlayers[pIdx2] = p2;
  return { ...state, players: newPlayers };
}

export function swapMatrixSlots(
  state: SquadState,
  pIdx1: number,
  mIdx1: number,
  pIdx2: number,
  mIdx2: number
): SquadState {
  ensurePlayerSlots(state);
  if (pIdx1 === pIdx2 && mIdx1 === mIdx2) return state;
  const newPlayers = [...state.players];
  const p1 = { ...newPlayers[pIdx1], weapons: [...newPlayers[pIdx1].weapons] };
  const p2 = pIdx1 === pIdx2 ? p1 : { ...newPlayers[pIdx2], weapons: [...newPlayers[pIdx2].weapons] };
  if (!p1.weapons[mIdx1] || !p2.weapons[mIdx2]) return state;

  const w1 = { ...p1.weapons[mIdx1] };
  const w2 = { ...p2.weapons[mIdx2] };
  const tmp = w1.matrix;
  w1.matrix = w2.matrix ? { ...w2.matrix } : null;
  w2.matrix = tmp ? { ...tmp } : null;
  p1.weapons[mIdx1] = w1;
  p2.weapons[mIdx2] = w2;

  newPlayers[pIdx1] = p1;
  newPlayers[pIdx2] = p2;
  return { ...state, players: newPlayers };
}

/**
 * Legacy parity (comp-ui.js matrix 2+2 button): split a single matrix set
 * into two 2pc chips, defaulting the second chip to the same set.
 */
export function splitMatrix2Plus2(state: SquadState, playerIdx: number, slotIdx: number): SquadState {
  ensurePlayerSlots(state);
  const player = state.players[playerIdx];
  const matrix = player?.weapons[slotIdx]?.matrix;
  if (!matrix || !matrix.id || matrix.id2) return state;
  const newPlayers = [...state.players];
  const p = { ...newPlayers[playerIdx], weapons: [...newPlayers[playerIdx].weapons] };
  const w = { ...p.weapons[slotIdx] };
  w.matrix = {
    ...matrix,
    count: 2,
    id2: matrix.id,
    count2: 2,
    stars2: matrix.stars ?? 3,
  };
  p.weapons[slotIdx] = w;
  newPlayers[playerIdx] = p;
  return { ...state, players: newPlayers };
}

export function swapRelicSlots(
  state: SquadState,
  pIdx1: number,
  rIdx1: number,
  pIdx2: number,
  rIdx2: number
): SquadState {
  ensurePlayerSlots(state);
  if (pIdx1 === pIdx2 && rIdx1 === rIdx2) return state;
  const newPlayers = [...state.players];
  const p1 = { ...newPlayers[pIdx1], relics: [...newPlayers[pIdx1].relics] };
  const p2 = pIdx1 === pIdx2 ? p1 : { ...newPlayers[pIdx2], relics: [...newPlayers[pIdx2].relics] };
  if (!p1.relics[rIdx1] || !p2.relics[rIdx2]) return state;

  const tmp = p1.relics[rIdx1];
  p1.relics[rIdx1] = p2.relics[rIdx2];
  p2.relics[rIdx2] = tmp;

  newPlayers[pIdx1] = p1;
  newPlayers[pIdx2] = p2;
  return { ...state, players: newPlayers };
}

export function swapTraits(state: SquadState, pIdx1: number, pIdx2: number): SquadState {
  ensurePlayerSlots(state);
  if (pIdx1 === pIdx2) return state;
  const newPlayers = [...state.players];
  const p1 = { ...newPlayers[pIdx1] };
  const p2 = { ...newPlayers[pIdx2] };

  const tmpTrait = p1.trait;
  const tmpText = p1.traitCustomText;
  p1.trait = p2.trait;
  p1.traitCustomText = p2.traitCustomText;
  p2.trait = tmpTrait;
  p2.traitCustomText = tmpText;

  newPlayers[pIdx1] = p1;
  newPlayers[pIdx2] = p2;
  return { ...state, players: newPlayers };
}

export function clearPlayerSlot(
  state: SquadState,
  playerIdx: number,
  slotType: 'trait' | 'weapon' | 'matrix' | 'relic',
  slotIdx = 0,
  chipIdx = 0
): SquadState {
  ensurePlayerSlots(state);
  const newPlayers = [...state.players];
  const player = { ...newPlayers[playerIdx] };

  if (slotType === 'trait') {
    player.trait = null;
    player.traitCustomText = '';
  } else if (slotType === 'weapon') {
    const weapons = [...player.weapons];
    const w = { ...weapons[slotIdx] };
    if (chipIdx === 1 && w.id2) {
      delete w.skills2; delete w.mode2; delete w.element2;
      w.id2 = null;
      w.stars2 = 6;
      w.customText2 = '';
    } else {
      delete w.skills; delete w.mode; delete w.element;
      w.id = null;
      w.stars = 6;
      w.customText = '';
    }
    weapons[slotIdx] = w;
    player.weapons = weapons;
    player.customRole = null;
    player.role = detectResonance(weapons);
  } else if (slotType === 'matrix') {
    const weapons = [...player.weapons];
    const w = { ...weapons[slotIdx] };
    if (w.matrix) {
      if (chipIdx === 1 && w.matrix.id2) {
        w.matrix = {
          id: w.matrix.id,
          count: 4,
          stars: w.matrix.stars,
          customText: w.matrix.customText,
        };
      } else {
        w.matrix = null;
      }
    }
    weapons[slotIdx] = w;
    player.weapons = weapons;
  } else if (slotType === 'relic') {
    const relics = [...player.relics];
    relics[slotIdx] = createEmptyRelicSlot();
    player.relics = relics;
  }

  newPlayers[playerIdx] = player;
  return { ...state, players: newPlayers };
}

export function clearPlayer(state: SquadState, playerIdx: number): SquadState {
  ensurePlayerSlots(state);
  const newPlayers = [...state.players];
  newPlayers[playerIdx] = createEmptyPlayer(playerIdx);
  return { ...state, players: newPlayers };
}

export function clearSquad(state: SquadState): SquadState {
  return createInitialSquadState(state.mode, state.title, state.server ?? 'standard');
}

export function setSquadServer(state: SquadState, server: CompServer): SquadState {
  ensurePlayerSlots(state);
  return {
    ...state,
    server: server === 'mmo' ? 'mmo' : 'standard',
  };
}

export function loadSquadPreset(presetId: string): SquadState {
  const norm = presetId.toLowerCase().trim().replace(/[\s_]+/g, '-');
  const found = PRESETS[norm] || PRESET_FROST_8P;
  const clonedPlayers = JSON.parse(JSON.stringify(found.players)) as SquadPlayer[];

  const newState: SquadState = {
    mode: found.mode,
    server: found.server ?? 'standard',
    title: found.name_en,
    players: clonedPlayers,
  };
  ensurePlayerSlots(newState);
  return newState;
}
