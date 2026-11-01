import { z } from 'zod';

export const FEEDBACK_SURVEY = 'site-feedback-v1';
export const FEEDBACK_METRICS = ['visual', 'dataTrust', 'usability', 'usefulness', 'aiTrace'] as const;
export type FeedbackMetric = typeof FEEDBACK_METRICS[number];
const rating = z.number().int().min(0).max(10).nullable();
const plainText = (min: number, max: number) => z.string().trim().min(min).max(max).regex(/^[^\u0000]*$/, 'Text must not contain null characters');
export const FeedbackRatingsSchema = z.object({
  visual: rating, dataTrust: rating, usability: rating, usefulness: rating, aiTrace: rating,
}).strict();
export type FeedbackRatings = z.infer<typeof FeedbackRatingsSchema>;
export const FeedbackNoteSchema = z.object({
  category: z.enum(['idea', 'data', 'interface', 'translation', 'other']),
  page: z.string().max(120).regex(/^\/(?:[a-z][a-z0-9-]*\/)*$/).nullable(),
  message: plainText(1, 3000),
}).strict();
export type FeedbackNote = z.infer<typeof FeedbackNoteSchema>;
/** Browser-reported context. The player is the character remembered after an import, not an authenticated account. */
export const FeedbackClientSchema = z.object({
  player: z.object({ uid: z.string().regex(/^\d{6,24}$/), nickname: z.string().max(64).regex(/^[^\u0000\r\n]*$/).nullable() }).strict().nullable(),
  timeZone: z.string().max(64).regex(/^[A-Za-z][A-Za-z0-9_+\-/]*$/).nullable(),
  screen: z.string().regex(/^\d{2,5}x\d{2,5}$/).nullable(),
}).strict();
export type FeedbackClient = z.infer<typeof FeedbackClientSchema>;
export const EMPTY_FEEDBACK_CLIENT: FeedbackClient = { player: null, timeZone: null, screen: null };
/** Derived by the API from request headers; never accepted from the browser. */
export const FeedbackOriginSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/).nullable(),
  device: z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
  os: z.string().max(32).nullable(), browser: z.string().max(32).nullable(),
}).strict();
export type FeedbackOrigin = z.infer<typeof FeedbackOriginSchema>;
export const FeedbackSubmissionSchema = z.object({
  id: z.uuid(),
  ratings: FeedbackRatingsSchema,
  notes: z.array(FeedbackNoteSchema).max(20),
  aiComment: plainText(0, 1000),
  locale: z.string().max(16).regex(/^[a-z]{2}(?:-[A-Za-z]{2,4}){0,2}$/),
  source: z.enum(['footer', 'prompt', 'direct']),
  // Optional so a page loaded before a deploy can still submit.
  client: FeedbackClientSchema.default(EMPTY_FEEDBACK_CLIENT),
}).strict().refine(value => Object.values(value.ratings).some(score => score !== null)
  || value.notes.length > 0 || value.aiComment.length > 0, { message: 'Choose a rating or write a comment' })
  .refine(value => value.notes.reduce((sum, note) => sum + note.message.length, value.aiComment.length) <= 12000,
    { message: 'Comments exceed the total length limit' });
export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;
export const FeedbackPromptClaimSchema = z.object({ reason: z.enum(['time', 'pages']) }).strict();

export type FeedbackMetricSummary = { count: number; median: number | null; distribution: { value: number; count: number }[] };
export type FeedbackStoredNote = FeedbackNote & { id: string };
export type FeedbackStoredResponse = FeedbackRatings & { id: string; createdAt: string; aiComment: string;
  locale: string; source: FeedbackSubmission['source']; release: string | null; notes: FeedbackStoredNote[];
  playerUid: string | null; playerNickname: string | null; timeZone: string | null; screen: string | null;
  country: string | null; device: FeedbackOrigin['device'] | null; os: string | null; browser: string | null };
export type FeedbackReport = { survey: string; total: number; metrics: Record<FeedbackMetric, FeedbackMetricSummary>;
  responses: FeedbackStoredResponse[]; nextCursor: string | null };
export type FeedbackNotesReport = { total: number; notes: (FeedbackStoredNote & { responseId: string; createdAt: string })[]; nextCursor: string | null };

export function emptyFeedbackRatings(): FeedbackRatings {
  return { visual: null, dataTrust: null, usability: null, usefulness: null, aiTrace: null };
}

/** Distributions contain answered questions only. AI visibility is deliberately independent. */
export function feedbackSummary(rows: readonly { metric: string; value: number; count: number }[]): Record<FeedbackMetric, FeedbackMetricSummary> {
  return Object.fromEntries(FEEDBACK_METRICS.map(metric => {
    const distribution = Array.from({ length: 11 }, (_, value) => ({ value,
      count: rows.find(row => row.metric === metric && row.value === value)?.count ?? 0 }));
    const count = distribution.reduce((sum, bin) => sum + bin.count, 0);
    const at = (position: number) => {
      let seen = 0;
      for (const bin of distribution) { seen += bin.count; if (seen > position) return bin.value; }
      return 0;
    };
    return [metric, { count, median: count ? (at(Math.floor((count - 1) / 2)) + at(Math.floor(count / 2))) / 2 : null, distribution }];
  })) as Record<FeedbackMetric, FeedbackMetricSummary>;
}
