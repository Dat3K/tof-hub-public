import { adaptCompCatalog, type CompCatalogView, type CompSimulacrumView } from '@tof-hub/game-domain';
import { PRESET_FROST_8P } from '@/features/comp/presets';
import { getPlayerActiveRole } from '@/features/comp/state';
import type { SquadRole } from '@/features/comp/types';

// Server-side rows of the Tools hub Comp miniature: the Comp page's default squad (the "Frost" 8-player preset,
// presets.ts) with roles, portraits, weapons, matrices and relics resolved from the Comp catalog as the page does.

export interface CompPreviewRow {
  role: SquadRole;
  /** Simulacrum view for `resolveCompTraitIcon` (matrix portrait, avatar fallback). */
  trait: Pick<CompSimulacrumView, 'id' | 'avatar' | 'traitIcon' | 'matrixSuitId'> | null;
  /** Game asset paths (unresolved) of the three weapons, matrices and two relics; null for an empty slot. */
  weapons: (string | null)[];
  matrices: (string | null)[];
  relics: (string | null)[];
}

const ROWS = 4;
const byId = <T extends { id: string }>(list: readonly T[] | undefined, id: string | null | undefined) =>
  id ? list?.find((item) => item.id.toLowerCase() === id.toLowerCase()) ?? null : null;

/** First player of every role in squad order, then the next players, keeping the squad order (four rows). */
function pickRows<T extends { role: SquadRole }>(rows: readonly T[]): T[] {
  const firsts = new Set<number>();
  const seen = new Set<SquadRole>();
  rows.forEach((row, index) => {
    if (!seen.has(row.role)) {
      seen.add(row.role);
      firsts.add(index);
    }
  });
  rows.forEach((_, index) => {
    if (firsts.size < ROWS) firsts.add(index);
  });
  return rows.filter((_, index) => firsts.has(index)).slice(0, ROWS);
}

export function buildCompPreview(rawCatalog: unknown): CompPreviewRow[] {
  if (!rawCatalog) return [];
  const catalog: CompCatalogView = adaptCompCatalog(rawCatalog);
  const rows = PRESET_FROST_8P.players.map((player): CompPreviewRow => {
    const sim = byId(catalog.simulacra, player.trait);
    return {
      role: getPlayerActiveRole(player, catalog),
      trait: sim ? { id: sim.id, avatar: sim.avatar, traitIcon: sim.traitIcon ?? null, matrixSuitId: sim.matrixSuitId ?? null } : null,
      weapons: player.weapons.map((slot) => {
        const weapon = slot.id
          ? catalog.weapons?.find((item) => [item.id, item.weaponId].some((id) => id?.toLowerCase() === slot.id!.toLowerCase()))
          : null;
        return weapon ? weapon.icon || weapon.avatar || null : null;
      }),
      matrices: player.weapons.map((slot) => {
        const matrix = byId(catalog.matrices, slot.matrix?.id);
        return matrix ? matrix.icon || matrix.suitPortrait || null : null;
      }),
      relics: player.relics.map((slot) => byId(catalog.relics, slot.id)?.icon || null),
    };
  });
  return pickRows(rows);
}
