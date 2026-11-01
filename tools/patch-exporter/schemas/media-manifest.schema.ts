import { z } from 'zod';

export const MediaAssetRecordSchema = z.object({
  rawPath: z.string().min(1),
  relativePath: z.string().min(1),
  pngPath: z.string().min(1),
  webpPath: z.string().min(1),
  pngSizeBytes: z.number().int().nonnegative(),
  webpSizeBytes: z.number().int().nonnegative(),
  sha256Png: z.string(),
  sha256Webp: z.string(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  status: z.enum(['converted', 'copied', 'verified', 'error']),
}).superRefine((record, context) => {
  if (record.status !== 'error') {
    if (!record.sha256Png) context.addIssue({ code: 'custom', path: ['sha256Png'], message: 'Successful media must include a PNG hash.' });
    if (!record.sha256Webp) context.addIssue({ code: 'custom', path: ['sha256Webp'], message: 'Successful media must include a WebP hash.' });
  }
});

export type MediaAssetRecord = z.infer<typeof MediaAssetRecordSchema>;

export const MediaManifestSchema = z.object({
  manifestVersion: z.literal('1.0.0'),
  generatedAt: z.string().min(1),
  counts: z.object({
    total: z.number().int().nonnegative(),
    png: z.number().int().nonnegative(),
    webp: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  }),
  assets: z.array(MediaAssetRecordSchema),
});

export type MediaManifest = z.infer<typeof MediaManifestSchema>;
