import type { LocalizedText } from '@tof-hub/game-domain';

export interface SeqDeepLinkParams {
  stage?: number | null;
  element?: string | null;
}

export interface SeqStage {
  stage: number;
  codename: string;
  enemyCode?: string;
  enemyName: LocalizedText;
  nameStatus: 'confirmed' | 'unresolved';
  nameSource?: string;
  roomId: string;
  roomName: LocalizedText;
  maxHealth: number;
  effectiveHp: number;
  atk: number;
  def: number;
  crit: number;
  critResist: number;
  element: string;
  portrait: string | null;
  isMechanicsAdjusted: boolean;
  mechanics: string | string[] | null;
}

export interface SeqMeta {
  generatedAt: string;
  sourceFile: string;
  cachedUpToStage: number;
  effectiveHpMultiplier: number;
  detectedCutoffType: string;
  detectedCutoffReason: string;
  rowCount: number;
  resolveReport?: {
    totalStages: number;
    enemyNamesResolved: number;
    enemyNamesUnresolved: number;
    roomNamesResolved: number;
    unresolvedIds: string[];
  };
}

export interface SeqCachePayload {
  meta: SeqMeta;
  rows: Record<string, number>;
  stages: SeqStage[];
}

export interface SeqMechanicsOverride {
  enemyCode?: string;
  enemyNameEn?: string;
  enemyNameRu?: string;
  portrait?: string;
  mechanics?: string;
}

export interface SeqFilterState {
  stageSearch: string;
  elementFilter: string | null;
}
