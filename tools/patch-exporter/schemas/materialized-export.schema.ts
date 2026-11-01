import { z } from 'zod';
import {
  ReleaseManifestSchema,
  SimulacraDatasetSchema,
  MatricesDatasetSchema,
  RelicsDatasetSchema,
  PetsDatasetSchema,
  FoodDishesDatasetSchema,
  CosmeticsDatasetSchema,
  ArtworksDatasetSchema,
} from '@tof-hub/contracts';

export const DatasetNameSchema = z.enum([
  'simulacra',
  'matrices',
  'relics',
  'pets',
  'food',
  'cosmetics',
  'arts',
]);

export type DatasetName = z.infer<typeof DatasetNameSchema>;

export const DatasetSchemas = {
  simulacra: SimulacraDatasetSchema,
  matrices: MatricesDatasetSchema,
  relics: RelicsDatasetSchema,
  pets: PetsDatasetSchema,
  food: FoodDishesDatasetSchema,
  cosmetics: CosmeticsDatasetSchema,
  arts: ArtworksDatasetSchema,
} as const;

export const PreparedProcessingRecordSchema = z.object({
  status: z.literal('SUCCESS'),
  mode: z.string().min(1),
  timestamp: z.string().min(1),
  sourceInput: z.string().min(1),
  unpackedRoot: z.string().min(1),
  isDoubleNested: z.boolean(),
  hasHottaContent: z.boolean(),
  stagedFilesCount: z.number().int().nonnegative(),
  dataMaterialized: z.boolean().optional(),
  mediaExported: z.boolean().optional(),
  validated: z.boolean().optional(),
  validationPassed: z.boolean().nullable().optional(),
  durationMs: z.number().nonnegative(),
});

export type PreparedProcessingRecord = z.infer<typeof PreparedProcessingRecordSchema>;

export {
  ReleaseManifestSchema,
  SimulacraDatasetSchema,
  MatricesDatasetSchema,
  RelicsDatasetSchema,
  PetsDatasetSchema,
  FoodDishesDatasetSchema,
  CosmeticsDatasetSchema,
  ArtworksDatasetSchema,
};
