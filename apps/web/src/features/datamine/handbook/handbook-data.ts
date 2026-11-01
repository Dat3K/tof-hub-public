import { loadServerGameData } from '@/lib/game-data-server';
import type {
  HandbookDataset,
  HandbookMode,
  HandbookSectionId,
  HandbookSectionState,
  HandbookSectionsData,
  HandbookServer,
  HandbookRandomStat,
} from '../contracts/handbook';
import { bandSummary } from './handbook-domain';
import { visibleHandbookSections } from './handbook-sections';

/** Items kept per pool for its label; the rest are only counted. */
const POOL_LABEL_ITEMS = 3;

// Raw file shapes (scripts/generators/build-handbook.cjs) where they differ from the per-mode payloads.
type ModeFile<T> = HandbookDataset & { modes: { gacha?: T; global?: T; mmo?: T } } & Record<string, unknown>;

const modeOf = <T,>(file: ModeFile<T>, mode: HandbookMode): T | undefined => (mode === 'mmo' ? file.modes.mmo : file.modes.global);

/** Shapes one generated file into the payload of its section for `mode`; undefined when the mode has no data. */
function shape(id: HandbookSectionId, file: any, mode: HandbookMode): unknown {
  switch (id) {
    case 'random-stats': {
      const data = modeOf<any>(file, mode);
      if (!data) return undefined;
      // Availability belongs to the exact random-property row, not its display name
      // or base attribute: MMO pools use distinct tiered copies of several stats.
      const rollable = new Set<string>();
      if (mode === 'mmo') for (const qualities of Object.values(data.slots)) {
        for (const pools of Object.values(qualities as Record<string, any[]>)) for (const pool of pools) {
          for (const weight of pool.weights) if (weight.weight > 0 || weight.weight === -1) rollable.add(weight.stat);
        }
      }
      const stats = mode === 'mmo' ? Object.fromEntries(Object.entries(data.stats).map(([id, stat]) =>
        [id, {...stat as HandbookRandomStat, unreleased: !rollable.has(id)}])) : data.stats;
      const used = new Set<string>();
      const slots = Object.fromEntries(Object.entries(data.slots).map(([slot, qualities]) => [slot, Object.fromEntries(
        Object.entries(qualities as Record<string, any[]>).map(([quality, pools]) => [quality, pools.map((pool) => {
          const items = pool.items.slice(0, POOL_LABEL_ITEMS);
          items.forEach((id: string) => used.add(id));
          return { ...pool, items, itemCount: pool.items.length };
        })])
      )]));
      const itemNames = Object.fromEntries([...used].map((id) => [id, file.itemNames[id] ?? null]));
      const canonical = file.modes.global?.stats ?? data.stats;
      const statOrder = Object.entries(canonical).map(([id, stat]) => (stat as {type: string | null}).type ?? id);
      const statPresentation = Object.fromEntries(Object.entries(canonical).filter(([id]) => !data.stats[id]).map(([id, value]) => {
        const stat = value as HandbookRandomStat;
        return [id, {type: stat.type, name: stat.name, icon: stat.icon}];
      }));
      return { mode: { ...data, stats, slots }, statOrder, statPresentation, slotNames: file.slotNames, slotIcons: file.slotIcons, itemNames };
    }
    case 'enhancement': {
      const data = modeOf<any>(file, mode);
      if (!data) return undefined;
      const stats = data.stats?.map((slot: any) => ({
        slot: slot.slot,
        stages: Object.fromEntries(
          Object.entries(slot.stages).map(([stage, levels]) => [stage, (levels as { level: number }[]).filter((l) => l.level % 5 === 0)])
        ),
      }));
      return { items: file.items, slotNames: file.slotNames, slotIcons: file.slotIcons, statNames: file.statNames, statIcons: file.statIcons, families: data.families, costGroups: data.costGroups, allSlotsMaxTotal: data.allSlotsMaxTotal ?? null, stars: data.stars ?? null, stats: stats ?? null };
    }
    case 'suppressor': {
      const data = modeOf<any>(file, mode);
      return data && { items: file.items, statNames: file.statNames, statIcons: file.statIcons, levels: data.levels, total: data.total };
    }
    case 'titan':
      // Growth bands → min / expected / max per augmentation count.
      return { ...file, mainGrowth: file.mainGrowth.map((g: any) => ({ ...g, levels: g.levels.map((l: any) => ({ count: l.count, ...bandSummary(l.bands) })) })) };
    default:
      return file;
  }
}

/**
 * Server loader for the sections visible in `mode`. game-data/ is not in git, so a missing file is a normal
 * deployment state and becomes an unavailable section instead of a page error.
 */
export async function loadHandbook(mode: HandbookMode): Promise<{ sections: HandbookSectionState[]; data: HandbookSectionsData }> {
  const data: Record<string, unknown> = {};
  const sections = await Promise.all(
    visibleHandbookSections(mode).map(async (section): Promise<HandbookSectionState> => {
      if (!section.file) {
        const list = await loadServerGameData<Record<string, HandbookServer> | null>('', 'server-list', { throwOnNotFound: false });
        if (list) data[section.id] = Object.values(list);
        return { id: section.id, available: Boolean(list), sources: ['game-data/server-list.json'] };
      }
      const file = await loadServerGameData<HandbookDataset | null>('handbook', section.file, { throwOnNotFound: false });
      const payload = file ? shape(section.id, file, mode) : undefined;
      if (payload) data[section.id] = payload;
      return { id: section.id, available: Boolean(payload), sources: Object.keys(file?.sources ?? {}) };
    })
  );
  return { sections, data: data as HandbookSectionsData };
}
