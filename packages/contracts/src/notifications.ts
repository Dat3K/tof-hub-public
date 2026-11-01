import { z } from 'zod';
import { QUEUE_KINDS } from './queue';
import { sanitizeErrorMessage } from './sanitize-error';
import { FeedbackOriginSchema, FeedbackSubmissionSchema } from './feedback';

export const NotificationCategorySchema = z.enum(['queue', 'errors', 'validation', 'feedback']);
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;
export const NotificationSettingsSchema = z.object({
  queue: z.boolean(), errors: z.boolean(), validation: z.boolean(),
  feedback: z.boolean().default(true),
  pausedUntil: z.string().datetime().nullable(),
}).strict();
export const DEFAULT_NOTIFICATION_SETTINGS = { queue: true, errors: true, validation: false, feedback: true, pausedUntil: null };
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

/** Whitelisted diagnostics and explicitly submitted feedback; never capture private uploads or credentials. */
export const NotificationEventSchema = z.object({
  id: z.string().uuid(), environment: z.enum(['normal', 'local']),
  category: NotificationCategorySchema, type: z.enum(['queue.queued', 'queue.finished', 'error', 'feedback.submitted']),
  at: z.string().datetime(),
  jobId: z.string().uuid().optional(), seq: z.number().int().positive().optional(),
  action: z.enum(QUEUE_KINDS).optional(), requester: z.string().regex(/^[a-f0-9]{12}$/).optional(),
  bytes: z.number().int().nonnegative().max(128 * 1024 * 1024).optional(),
  state: z.enum(['complete', 'failed']).optional(), durationMs: z.number().nonnegative().optional(),
  identity: z.object({ uid: z.string().regex(/^\d{6,24}$/).optional(), nickname: z.string().max(64).optional() }).strict().optional(),
  counts: z.partialRecord(z.enum(['total', 'stored', 'duplicates', 'rejected', 'inserted', 'unresolved', 'gear', 'observed']), z.number().int().nonnegative()).optional(),
  source: z.string().max(100).optional(), code: z.string().max(80).optional(),
  message: z.string().max(1000).optional(), route: z.string().max(300).optional(),
  digest: z.string().max(80).optional(),
  feedback: FeedbackSubmissionSchema.optional(),
  feedbackOrigin: FeedbackOriginSchema.optional(),
  release: z.string().max(64).regex(/^[a-zA-Z0-9._-]+$/).optional(),
}).strict().superRefine((event, context) => {
  if (event.type === 'feedback.submitted'
    ? event.category !== 'feedback' || !event.feedback || event.feedback.id !== event.id
    : event.category === 'feedback' || event.feedback !== undefined || event.feedbackOrigin !== undefined) {
    context.addIssue({ code: 'custom', message: 'Feedback notification requires its matching submission' });
  }
  if (event.type.startsWith('queue.') && (!event.jobId || !event.action || !event.seq)) {
    context.addIssue({ code: 'custom', message: 'Queue notification requires its job identity' });
  }
}).transform(event => {
  for (const key of ['source', 'code', 'message', 'route', 'digest'] as const) {
    if (typeof event[key] === 'string') event[key] = sanitizeErrorMessage(event[key]);
  }
  if (event.identity?.nickname) event.identity.nickname = sanitizeErrorMessage(event.identity.nickname).replace(/[\r\n]/g, ' ');
  return event;
});
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

export const BrowserErrorReportSchema = z.object({
  source: z.enum(['boundary', 'window', 'promise']),
  name: z.string().max(80), message: z.string().max(500),
  route: z.string().max(300).startsWith('/'), digest: z.string().max(80).optional(),
}).strict();
