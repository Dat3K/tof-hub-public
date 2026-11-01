import type { SeqCacheDataset } from '@tof-hub/contracts';

export interface SeqStageItem {
  stage: number;
  codename: string;
  enemyCode: string;
  enemyNameEn: string | null;
  enemyNameRu: string | null;
  name_en: string | null;
  name_ru: string | null;
  nameStatus: 'confirmed' | 'unresolved';
  nameSource: string;
  roomId: string;
  roomNameEn: string;
  roomNameRu: string;
  maxHealth: number;
  effectiveHp: number;
  atk: number | null;
  def: number | null;
  crit: number;
  critResist: number;
  element: string;
  portrait: string | null;
  isMechanicsAdjusted: boolean;
  mechanicsNote: string;
  powercreep: number;
}

export type SeqStageView = '16plus' | 'all';

export type SeqChartTheme = 'dark' | 'light';

export type SeqChartKey = 'effective' | 'pure' | 'powercreep';

export interface SeqViewProps {
  initialData?: SeqCacheDataset | null;
  initialLocale?: string;
  initialStageView?: SeqStageView | null;
  initialChartTheme?: SeqChartTheme | null;
  /** Defence constant K at L100 (build-reference.json resistanceFormula); null when unavailable. */
  resistanceConstant?: number | null;
  /** DMG% per Space Support Sequential module level (index = level); null when unavailable. */
  supportDamageByLevel?: number[] | null;
}
