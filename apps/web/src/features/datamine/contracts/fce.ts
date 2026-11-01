import type { LocalizedText, BossMechanic, BossSummary, BossDetail } from '@tof-hub/game-domain';

export type FceMode = 'standard' | 'mmo';

export interface FceDeepLinkParams {
  mode?: FceMode | null;
  boss?: string | null;
  tab?: string | null;
}

export type FceBossSummary = BossSummary;

export type FceBossDetail = BossDetail;

export type FceMechanic = BossMechanic;

export interface FceIndexPayload {
  mode: FceMode;
  bosses: FceBossSummary[];
}

export interface FceFilterState {
  searchQuery: string;
  selectedElement: string | null;
  selectedBossSlug: string | null;
}
