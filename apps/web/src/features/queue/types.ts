import type { QueueJob } from './client';

export type { QueueBoard, QueueJob, QueueKind, QueueState } from './client';

/** The import's job in the shared queue (docs/architecture/job-queue.md). */
export type JobStatus = QueueJob & {
  result?: { profileId: string; inserted: number; duplicates: number; unresolved: number; accessToken?: string };
};
