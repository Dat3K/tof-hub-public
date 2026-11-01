/**
 * The shared queue of heavy operations (docs/architecture/job-queue.md): what the API answers for a job and for the
 * queue board, read by the Tools pages.
 */
export const QUEUE_KINDS = ['wish-import', 'players-import', 'build-import', 'build-profile'] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];
export type QueueState = 'queued' | 'processing' | 'complete' | 'failed';

/** A failed job keeps the HTTP status and message the operation would have answered with, plus its extra fields. */
export interface QueueJobError {
  status: number;
  message: string;
  data?: Record<string, unknown>;
}

/** A job as its requester sees it. */
export interface QueueJob {
  id: string;
  seq: number;
  kind: QueueKind;
  state: QueueState;
  /** Place in the queue (1 = next); 0 once processing or finished. */
  position: number;
  /** Rough wait until the job finishes, from the recent durations of each kind; null when unknown. */
  estimateMs: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result?: unknown;
  /** True when a private, short-lived result for the submitting page can be fetched separately. */
  deliveryAvailable?: boolean;
  error?: QueueJobError;
}

/** /tools/queue: every job without who sent it; `mine` marks the viewer's own (same IP). */
export interface QueueBoard {
  active: { seq: number; kind: QueueKind; state: QueueState; position: number; createdAt: string; startedAt: string | null; mine: boolean }[];
  recent: { seq: number; kind: QueueKind; state: QueueState; createdAt: string; startedAt: string | null; finishedAt: string | null; durationMs: number | null; mine: boolean }[];
  averageMs: Partial<Record<QueueKind, number>>;
  limits: { maxWaiting: number; perIp: number };
}
