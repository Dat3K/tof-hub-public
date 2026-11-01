export interface MatrixTraitIconAsset {
  relativePath?: unknown;
  status?: unknown;
}

export interface MatrixTraitIconCharacter {
  avatar_id?: unknown;
  weapon_id?: unknown;
  id?: unknown;
}

export function createMatrixTraitIconResolver(
  assets: readonly MatrixTraitIconAsset[]
): (character: MatrixTraitIconCharacter) => string | null;
