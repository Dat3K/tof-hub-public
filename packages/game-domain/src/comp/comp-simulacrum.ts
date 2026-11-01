import type { Element } from '../common/elements';
import type { Rarity } from '../common/rarities';
import type { WeaponRole } from '../common/roles';
import type { LocalizedText } from '../common/localization';

export interface CompSimulacrumView {
  serverMode?: 'standard' | 'mmo';
  season?: number;
  imitationId?: string;
  matrixSuitNum?: number;
  id: string; // e.g. "rei-ayanami"
  name: LocalizedText;
  avatar: string;
  traitIcon?: string | null;
  weaponId: string;
  weaponName: LocalizedText;
  weaponIcon: string;
  element: Element;
  elementSecondary: Element | null;
  elementComboIcon: string | null;
  role: WeaponRole;
  roleIcon: string;
  rarity: Rarity;
  matrixSuitId: string | null;
  card: string;
  traitName: LocalizedText;
  traitDesc: LocalizedText;
}
