import { gameAsset } from '@tof-hub/game-assets';
import type { CompCatalogView } from '@tof-hub/game-domain';
import type { Locale } from '@tof-hub/i18n';
import type { HandbookTitanData } from '@/features/datamine/contracts/handbook';
import {
  DAMAGE_CATEGORIES, TITAN_STAT_KEYS, TITAN_STATS, buildTitanModel, isLegalTitan, rankTitans, removeTitan,
  type DamageVector, type TitanLevels, type TitanStat,
} from '@/features/titan-calculator/model';
import { parseDamageTable } from '@/features/titan-calculator/parse-table';
import { EXAMPLE_TITAN, EXAMPLE_WEAPONS } from '@/features/titan-calculator/titan-example';
import { matchWeapon } from '@/features/titan-calculator/weapon-match';

interface TitanPreviewWeapon {
  name: { en: string } & Partial<Record<Locale, string>>;
  icon?: string;
  damage: DamageVector;
}

export interface TitanPreviewData {
  weapons: TitanPreviewWeapon[];
  clean: DamageVector;
  bestWithoutWeakPoint: TitanLevels;
  stats: Record<TitanStat, Pick<HandbookTitanData['rareValues'][number], 'name' | 'icon'>>;
}

export function buildTitanPreview(data: HandbookTitanData | null, catalog: CompCatalogView | null): TitanPreviewData | null {
  if (!data) return null;
  const model = buildTitanModel(data);
  if (!model || !isLegalTitan(EXAMPLE_TITAN, model)) return null;

  const weapons = (catalog?.weapons ?? [])
    .filter(({ serverMode }) => serverMode !== 'mmo')
    .map(({ name, icon }) => ({ weapon: name, icon }));

  const preview: TitanPreviewWeapon[] = [];
  const total: DamageVector = { normal: 0, dodge: 0, discharge: 0, passive: 0, skill: 0 };
  for (const { name, table } of EXAMPLE_WEAPONS) {
    const { rows } = parseDamageTable(table);
    const recorded = {} as DamageVector;
    for (const category of DAMAGE_CATEGORIES) {
      const row = rows[category];
      if (row?.final == null || row.status === 'check') return null;
      recorded[category] = row.final;
      total[category] += row.final;
    }

    const match = matchWeapon(name, weapons);
    preview.push({
      name: match?.weapon ?? { en: name },
      icon: match?.icon ? gameAsset(match.icon) : undefined,
      damage: removeTitan(recorded, EXAMPLE_TITAN, model, { weakPoint: true }),
    });
  }
  const clean = removeTitan(total, EXAMPLE_TITAN, model, { weakPoint: true });
  const best = rankTitans(clean, model, { weakPoint: false }, 1)[0];
  if (!best) return null;
  const stats = Object.fromEntries(TITAN_STAT_KEYS.map((stat) => {
    const entry = data.rareValues.find(({ id }) => id === TITAN_STATS[stat]);
    return [stat, { name: entry?.name ?? { en: stat, ru: stat }, icon: entry?.icon ?? null }];
  })) as TitanPreviewData['stats'];
  return { weapons: preview, clean, bestWithoutWeakPoint: best.levels, stats };
}
