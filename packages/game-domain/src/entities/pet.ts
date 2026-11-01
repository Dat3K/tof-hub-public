import type { Element } from '../common/elements';
import type { Rarity } from '../common/rarities';
import type { WeaponRole } from '../common/roles';
import type { LocalizedText } from '../common/localization';

export type SmartServantCategory = 'combat' | 'cute';

export interface SmartServantSkill {
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
}

export interface SmartServantStar {
  star: number;
  description: LocalizedText;
  atkInheritance?: string;
  moduleSlots?: number;
  moduleLoad?: number;
  goldCost?: number;
  petLevelReq?: number;
}

export interface PetModuleLevel {
  level: number;
  description: LocalizedText;
}

export interface PetModule {
  id: string;
  groupId: string;
  familyId: string;
  name: LocalizedText;
  owner: string | null;
  quality: Rarity;
  needLoad: number;
  icon: string;
  levels: PetModuleLevel[];
}

export interface SmartServantCore {
  /**
   * Stable engine pet identifier (e.g. FightPet_1)
   */
  stableId: string;
  /**
   * URL-safe slug (e.g. kalka)
   */
  slug: string;
  category: SmartServantCategory;
  name: LocalizedText;
  description: LocalizedText;
  quality: Rarity;
  element: Element;
  role: WeaponRole;
  icon: string;
  photo: string;
}

export interface SmartServantDetail extends SmartServantCore {
  stars: SmartServantStar[];
  skills: SmartServantSkill[];
  statsProgression: Record<string, unknown> | null;
  tokenIcon?: string;
}
