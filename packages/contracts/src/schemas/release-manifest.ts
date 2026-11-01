import { z } from 'zod';

export const ManifestSourceSchema = z.object({
  client: z.string(),
  branch: z.string(),
  clientRu: z.string().optional(),
  appVersion: z.string().optional(),
  hash: z.string().optional(),
});
export type ManifestSource = z.infer<typeof ManifestSourceSchema>;

export const ManifestSnapshotSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  sources: z.array(ManifestSourceSchema),
});
export type ManifestSnapshot = z.infer<typeof ManifestSnapshotSchema>;

export const ManifestClientVersionSchema = z.object({
  version: z.string(),
  lastChanged: z.string().optional(),
  lastChangedFormatted: z.string().optional(),
});
export type ManifestClientVersion = z.infer<typeof ManifestClientVersionSchema>;

export const ManifestBuildSchema = z.object({
  builtAt: z.string(),
  status: z.string(),
});
export type ManifestBuild = z.infer<typeof ManifestBuildSchema>;

export const ManifestAssetsSchema = z.object({
  png: z.boolean(),
  webp: z.boolean(),
});
export type ManifestAssets = z.infer<typeof ManifestAssetsSchema>;

export const ReleaseManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  gameVersion: z.string(),
  generatedAt: z.string(),
  exporterVersion: z.string(),
  locales: z.array(z.string()),
  assets: ManifestAssetsSchema,
  snapshot: ManifestSnapshotSchema,
  clientVersions: z.record(z.string(), ManifestClientVersionSchema).optional(),
  build: ManifestBuildSchema,
  fileCounts: z.record(z.string(), z.number()).optional(),
  validationStatus: z.string().optional(),
  datasets: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;
