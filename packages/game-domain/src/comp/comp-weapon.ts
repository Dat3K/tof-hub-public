import type { Element } from '../common/elements';
import type { Rarity } from '../common/rarities';
import type { WeaponRole } from '../common/roles';
import type { LocalizedText } from '../common/localization';
import type { CompRoleKey } from './comp-role';

export interface CompWeaponView {
  serverMode?: 'standard' | 'mmo';
  id: string; // simulacrum slug / weapon identifier
  weaponId: string; // raw weapon asset key e.g. "AyanamiRei_thunder"
  simulacrumId: string;
  name: LocalizedText; // weapon name
  simName: LocalizedText; // simulacrum name
  element: Element;
  elementSecondary: Element | null;
  elementComboIcon?: string | null;
  role: WeaponRole;
  canonicalRole: CompRoleKey;
  rarity: Rarity;
  matrixSuitId: string | null;
  matrixSuitNum?: number;
  season?: number;
  imitationId?: string;
  releaseOrder?: number;
  icon: string;
  avatar: string;
  aliases?: string[];
}
