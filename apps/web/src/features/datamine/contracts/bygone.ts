import type { LocalizedText } from '@tof-hub/game-domain';

export interface BygoneDeepLinkParams {
  floor?: number | null;
  range?: string | null;
  bossOnly?: boolean | null;
}

export interface BygoneWeakness {
  element: string;
  elementRu?: string;
  icon?: string;
}

export interface BygonePrimaryEnemy {
  className: string;
  canonicalEnemyId: string;
  name: LocalizedText;
  element: string;
  isBoss: boolean;
  image: string | null;
  imageThumb: string | null;
}

export interface BygoneFloor {
  floor: number;
  isBossFloor: boolean;
  isDuplicate: boolean;
  duplicatedFromFloor: number | null;
  scalingStateKey: string;
  hpBuffStacks: number;
  atkBuffStacks: number;
  displayedDifficulty: number;
  hpMultiplier: number;
  atkMultiplier: number;
  monsterLevel: number;
  roundGs: number;
  finalHp: number;
  finalAtk: number;
  computedStats: {
    final_hp: number;
    final_atk: number;
  };
  weakness: BygoneWeakness[];
  primaryEnemy: BygonePrimaryEnemy | null;
  monstersCount: number;
}

export interface BygoneMonsterPool {
  poolId: string;
  roundRange: [number, number];
  isBossPool: boolean;
  primaryEnemy: unknown;
  monsters: unknown[];
}

export interface BygoneDatasetPayload {
  schemaVersion: number;
  generatedAt: string;
  totalFloors: number;
  totalUniqueFloors: number;
  totalRepeatFloors: number;
  totalCollapsedRanges: number;
  floors: BygoneFloor[];
  monsterPools: BygoneMonsterPool[];
}

export interface BygoneFilterState {
  floorSearch: string;
  bossOnly: boolean;
  elementFilter: string | null;
}
