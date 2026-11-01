import type {
  ReleaseManifest,
  SimulacraDataset,
  MatricesDataset,
  RelicsDataset,
  PetsDataset,
  CosmeticsDataset,
  ArtworksDataset,
} from '@tof-hub/contracts';

export interface ServerGameDataOptions {
  /**
   * Optional custom data root directory.
   * If omitted, falls back to process.env.GAME_DATA_ROOT or local public/game-data.
   */
  dataRoot?: string;

  /**
   * Whether to throw when a dataset file is missing.
   * Defaults to true.
   */
  throwOnNotFound?: boolean;
  /** Load this entity's generated detail shard for a direct profile/modal URL. */
  selectedId?: string | null;
  selectedCollection?: string;
}

export type TypedDatasetName =
  | 'simulacra'
  | 'matrices'
  | 'relics'
  | 'pets'
  | 'food'
  | 'cosmetics'
  | 'arts';

export interface TypedDatasetsMap {
  simulacra: SimulacraDataset;
  matrices: MatricesDataset;
  relics: RelicsDataset;
  pets: PetsDataset;
  food: any;
  cosmetics: CosmeticsDataset;
  arts: ArtworksDataset;
}
