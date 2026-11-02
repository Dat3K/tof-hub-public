import { z } from 'zod';

export const RaidCurrentNamesRequestSchema = z.object({
  identifiers: z.array(z.string().regex(/^[1-9]\d{0,19}$/).refine(value => /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 0xffffffffffffffffn)).max(500),
  uids: z.array(z.string().regex(/^[1-9]\d{0,19}$/)).max(500).optional(),
}).refine(value => value.identifiers.length + (value.uids?.length ?? 0) <= 500, 'Too many player identities');
export const RaidCurrentNamesResponseSchema = z.object({
  available: z.boolean(), entries: z.array(z.object({identifier: z.string(), uid: z.string().nullable().optional(), nickname: z.string(), observedAt: z.iso.datetime()})),
});

export const RaidRankingDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  resonances: z.array(z.object({value: z.string(), roleId: z.string(), name: z.object({en: z.string(), ru: z.string()}).catchall(z.string()), icon: z.string().nullable()})).optional(),
  sources: z.array(z.object({
    id: z.string().min(1), kind: z.enum(['community', 'capture']), title: z.string().min(1),
    method: z.literal('ocr').optional(),
    url: z.url().nullable(), author: z.string().nullable(), observedAt: z.union([z.iso.date(), z.iso.datetime()]), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })),
  seasons: z.array(z.object({
    id: z.string().min(1), label: z.string().min(1), bossLabel: z.string().nullable(),
    raidId: z.string().nullable(), raidJoin: z.enum(['unique-boss-name', 'documented-season', 'unresolved']),
  })),
  boards: z.array(z.object({
    id: z.string().min(1), seasonId: z.string().min(1), sourceId: z.string().min(1),
    _detail: z.string().regex(/^runtime\/details\/raid-rankings\/[a-f0-9]{24}$/).optional(),
    entryCount: z.number().int().nonnegative().optional(),
    scope: z.object({ kind: z.enum(['region', 'server']), region: z.string().min(1), subregion: z.string().min(1).optional(), serverId: z.string().nullable(), serverName: z.string().nullable() }),
    coverage: z.enum(['summary', 'partial', 'complete']), capturedAt: z.iso.datetime().nullable(),
    raw: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
    entries: z.array(z.object({
      id: z.string().min(1), rank: z.number().int().positive(),
      duration: z.object({ raw: z.string().min(1), milliseconds: z.number().int().nonnegative().nullable(), exactTicks: z.string().regex(/^\d{1,20}$/).optional() }),
      recordedAt: z.string().nullable(),
      members: z.array(z.object({ nickname: z.string(), identifier: z.string().optional(), identifierEvidence: z.enum(['packet', 'exact-name-once', 'normalized-name-once', 'owner-confirmed']).optional(),
        nicknameStatus: z.enum(['blank', 'unreadable']).optional(), observationId: z.string().optional(),
        resonance: z.object({ label: z.string(), icon: z.string().nullable(), raw: z.string().nullable() }).nullable() })).nullable(),
      raw: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    })),
  })),
}).superRefine((data, ctx) => {
  const sources = new Set(data.sources.map(source => source.id));
  const seasons = new Set(data.seasons.map(season => season.id));
  for (const [index, board] of data.boards.entries()) {
    if (!sources.has(board.sourceId) || !seasons.has(board.seasonId)) ctx.addIssue({ code: 'custom', path: ['boards', index], message: 'Unknown source or season' });
    if (board.scope.kind === 'server' && !board.scope.serverId) ctx.addIssue({ code: 'custom', path: ['boards', index, 'scope'], message: 'A server board requires a source server ID' });
    if (new Set(board.entries.map(entry => entry.id)).size !== board.entries.length) ctx.addIssue({ code: 'custom', path: ['boards', index, 'entries'], message: 'Duplicate entry IDs' });
  }
  for (const [key, values] of [['sources', data.sources], ['seasons', data.seasons], ['boards', data.boards]] as const) {
    if (new Set(values.map(value => value.id)).size !== values.length) ctx.addIssue({ code: 'custom', path: [key], message: 'Duplicate IDs' });
  }
});
