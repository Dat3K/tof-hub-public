import type { BygoneDataset } from '@tof-hub/contracts';

export interface BygoneWeaknessItem {
  element: string;
  element_name_en?: string;
  element_name_ru?: string;
  name_en?: string;
  name_ru?: string;
  icon?: string | null;
}

export interface BygonePrimaryEnemyItem {
  canonicalEnemyId: string;
  name_en: string;
  name_ru: string;
  element: string;
  is_boss: boolean;
  image?: string | null;
  imageThumb?: string | null;
}

export interface BygoneFloorItem {
  floor: number;
  is_boss_floor: boolean;
  is_duplicate: boolean;
  duplicated_from_floor: number | null;
  hp_buff_stacks: number;
  atk_buff_stacks: number;
  displayed_difficulty: number;
  monster_level: number;
  round_gs: number;
  final_hp: number;
  final_atk: number;
  weakness: BygoneWeaknessItem[];
  primary_enemy: BygonePrimaryEnemyItem | null;
}

export type BygoneRangePreset = 'latest20' | 'all' | '1-500' | '501-600' | 'custom';

export interface BygoneRangeState {
  minFloor: number;
  maxFloor: number;
  preset: BygoneRangePreset;
}

export type BygoneFilterTab = 'all' | 'boss' | '1-500' | '501-600';

export type BygoneChartKind = 'hp' | 'powercreep';

export type BygoneChartTheme = 'dark' | 'light';

export interface BygonePowercreep {
  previousFloor: number;
  percent: number;
}

export interface BygoneViewProps {
  initialData?: BygoneDataset | null;
  initialLocale?: string;
  initialChartTheme?: BygoneChartTheme | null;
}
