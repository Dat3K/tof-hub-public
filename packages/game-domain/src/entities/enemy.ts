import type { Element } from '../common/elements';
import type { LocalizedText } from '../common/localization';

export type EnemyKind = 'normal' | 'elite' | 'boss';

export type MonsterType = 'BS_MONSTER_NORMAL' | 'BS_MONSTER_ELITE' | 'BS_MONSTER_BOSS';

export interface EnemyCore {
  /**
   * Stable engine identifier (e.g. boss_hum_046, elite_hum_035, BigSecret_boss_ntr)
   */
  stableId: string;
  codeName: string;
  name: LocalizedText;
  kind: EnemyKind;
  monsterType?: MonsterType;
  element: Element | 'None';
  image?: string | null;
  thumb?: string | null;
}

export interface BossMechanic {
  index: string;
  description: LocalizedText;
  html?: LocalizedText;
}

export interface BossSummary {
  slug: string;
  bossId: string;
  bossNum: number;
  order?: number;
  name: LocalizedText;
  nameColor: string;
  art: string;
  preview: string;
  lineupPortrait: string;
  lineupPortraitThumb?: string;
  downloadPngUrl?: string;
  mechanicsCount: number;
  hasMechanics: boolean;
  ladderLevel?: number;
  ladderKey?: string;
}

export interface BossDetail extends BossSummary {
  sourcePsd?: string;
  artObjectPosition?: string;
  mechanics: BossMechanic[];
}
