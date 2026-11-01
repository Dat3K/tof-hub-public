import type { CompRole } from './comp-role';
import type { CompSimulacrumView } from './comp-simulacrum';
import type { CompWeaponView } from './comp-weapon';
import type { CompMatrixView } from './comp-matrix';
import type { CompRelicView } from './comp-relic';
import type { CompPetView } from './comp-pet';

export interface CompCatalogView {
  generatedAt?: string;
  totalSimulacra?: number;
  totalMatrices?: number;
  totalRelics?: number;
  totalPets?: number;
  roles: CompRole[];
  simulacra: CompSimulacrumView[];
  weapons?: CompWeaponView[];
  matrices: CompMatrixView[];
  relics: CompRelicView[];
  pets: CompPetView[];
}
