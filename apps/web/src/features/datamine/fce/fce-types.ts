import type { LocalizedText } from '@tof-hub/game-domain';
import type { FceIndexDataset } from '@tof-hub/contracts';

export type FceMode = 'standard' | 'mmo';

export interface FceMechanicItem {
  index: string;
  html: string;
  text?: string;
  key?: string;
  [key: string]: unknown;
}

export interface FceBossItem {
  slug: string;
  order?: number;
  season?: number;
  encounter?: 'oow';
  boss_id: string;
  boss_num: number;
  name: string;
  name_ru: string;
  name_color?: string;
  art: string;
  preview: string;
  displayWebpUrl?: string;
  cardThumbnail?: string;
  downloadPngUrl?: string;
  lineupPortrait?: string;
  lineupPortraitThumb?: string;
  detailImage?: string;
  mechanics_count?: number;
  ladder_level?: number;
  ladder_key?: string;
  art_object_position?: string;
  art_scale?: number;
  art_x?: number;
  art_y?: number;
  name_right?: number;
  name_y?: number;
  name_width?: number;
  name_scale?: number;
  copy_y?: number;
  copy_width?: number;
  copy_scale?: number;
  /** Highest-phase `DT_MonsterStaticData` row (`Boss_<number>_<phase>`) with pipeline-derived resist percents. */
  last_phase?: {
    phase: number;
    rowId: string;
    fields: {MaxHealth?: number};
    derived: {resistPct: Record<string, number | null>; finalCritDefPct: number | null};
  };
  mechanics: FceMechanicItem[];
  ru_mechanics?: FceMechanicItem[];
  /** Per-culture in-game name and mechanic text from the game's own localization (see docs/pipeline.md). */
  l10n?: Partial<Record<string, {name?: string; mechanics: FceMechanicItem[]}>>;
}

export interface FceViewProps {
  initialData?: FceIndexDataset | null;
  initialCards?: {standard: FceBossItem[]; mmo: FceBossItem[]} | null;
  initialLocale?: string;
  initialMode?: FceMode | null;
  initialBoss?: string | null;
  /** Origin of War HP / crit-resistance icons for the stat plate. */
  statIcons?: {hp?: string | null; crit?: string | null};
}

export interface FceCopyTable {
  brand: string;
  eyebrow: string;
  title: string;
  metaDescription: string;
  gameMode: string;
  mmoMode: string;
  download: string;
  rendering: string;
  downloadAria: string;
  loading: string;
  noBoss: string;
  loadError: string;
  bossLoadError: string;
  retry: string;
  downloadError: string;
}
