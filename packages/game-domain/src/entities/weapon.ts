import type { Element } from '../common/elements';
import type { Rarity } from '../common/rarities';
import type { WeaponRole } from '../common/roles';
import type { LocalizedText } from '../common/localization';

export interface WeaponSkill {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  category: 'normal' | 'dodge' | 'skill' | 'discharge';
  cooldown?: number | null;
}

export interface WeaponCore {
  /**
   * Stable engine weapon identifier (e.g. AyanamiRei_thunder)
   */
  stableId: string;
  /**
   * Slug identifier (e.g. salvation)
   */
  slug: string;
  /**
   * Parent simulacrum stable ID or slug (if paired)
   */
  simulacrumId: string | null;
  name: LocalizedText;
  element: Element;
  elementSecondary: Element | null;
  role: WeaponRole;
  rarity: Rarity;
  icon: string;
}

export interface WeaponDetail extends WeaponCore {
  shatter: {
    value: number;
    tier: string;
  };
  charge: {
    value: number;
    tier: string;
  };
  type: string | null;
  skills: {
    normals: WeaponSkill[];
    dodges: WeaponSkill[];
    skills: WeaponSkill[];
    discharges: WeaponSkill[];
  };
}
