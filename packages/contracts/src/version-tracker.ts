import { z } from 'zod';

export const trackedVersionEventSchema = z.object({
  id: z.string(), version: z.string(), observedAt: z.string().datetime(),
  precision: z.enum(['day', 'instant']), origin: z.enum(['legacy', 'monitor']),
  resourceBranch: z.string().nullable().optional(), sourceUrl: z.string().url().nullable().optional(),
  launcherVersion: z.string().nullable().optional(),
});
export const trackedBranchSchema = z.object({
  id: z.string(), label: z.string(), branch: z.string(), sourceUrl: z.string().url(),
  group: z.enum(['live', 'other']).optional(),
  version: z.string().nullable(), changedAt: z.string().datetime().nullable(),
  checkedAt: z.string().datetime().nullable(), attemptedAt: z.string().datetime().nullable(),
  error: z.boolean(), history: z.array(trackedVersionEventSchema),
  launcherVersion: z.string().nullable().optional(),
  launcher: z.object({versionUrls: z.array(z.string().url()).min(1), resourceBases: z.array(z.string().url()).min(1), appId: z.string()}).optional(),
});
export const versionTrackerSchema = z.object({
  schemaVersion: z.literal(1), mode: z.enum(['archive', 'live']),
  branches: z.array(trackedBranchSchema),
});
export type TrackedVersionEvent = z.infer<typeof trackedVersionEventSchema>;
export type TrackedBranch = z.infer<typeof trackedBranchSchema>;
export type VersionTracker = z.infer<typeof versionTrackerSchema>;
