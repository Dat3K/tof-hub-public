# Job queue

Every heavy file operation goes through one shared queue, so a burst of uploads cannot overload the API or the database. Each request waits its turn, and the page that sent it shows its position.

## Operations

| Kind | Endpoint (`POST`) | Work done in the queue |
| --- | --- | --- |
| `wish-import` | `/api/v1/wish/import/jobs` | Decrypt or parse the file, import pulls, grant the uploader read access |
| `players-import` | `/api/v1/ranking/inspect` | Validate and store every player, rescore the ranking |
| `build-import` | `/api/v1/build/import` | Check buffs and slots, store the player, sign the capture |
| `build-profile` | `/api/v1/build/profiles` | Verify the signature and digest, save the profile |

The endpoint runs only cheap checks immediately: configuration, size, envelope schema, key and request shape. A refused request gets a `4xx` or `503` straight away. An accepted request gets back a **job**; the actual work is the service's existing method, registered as the handler for that kind.

Handlers store a compact `result` on the job. The build import additionally places the card, backpack and signature in a separate `delivery` field so the uploading page can continue editing. `GET /api/v1/queue/jobs/:id/delivery` returns it once and clears it; unclaimed deliveries expire after one hour.

## Rules

| Rule | Detail |
| --- | --- |
| One worker, oldest first | Admission and claiming share a PostgreSQL advisory lock, so several API processes never run heavy jobs concurrently. |
| One active job per requester | Across all kinds. A second request gets `429`. |
| At most 20 waiting jobs | `MAX_WAITING`. The next request gets `503 The queue is full`. |
| At most 128 MiB of active payloads | Plus per-file-type size caps and daily per-requester budgets. |
| Polling is bound to the requester | `GET /api/v1/queue/jobs/:id` returns `404` to anyone else. Requesters are identified by a salted SHA-256 of their IP (`IP_HASH_SALT`). |
| Failures keep their answer | A failed job stores the HTTP status, message and extra fields, so the page can react exactly as it would to a direct error. Unknown errors become `500`. |

Identical build files may be uploaded again so Build and Optimizer can reopen a capture after its one-time delivery was consumed. The storage layer detects the existing capture digest and skips duplicate writes. Wish and player files keep their duplicate limits.

## Privacy and retention

- The uploaded payload and the raw IP are cleared as soon as a job finishes.
- Each requester keeps their five newest finished jobs for at most 24 hours. Older rows are removed at startup and every ten minutes.
- Results hold only the fields needed for the requester's own action summary.
- The public queue board shows kind, state and timing only, never results.

## Reliability

- **Stale jobs.** Jobs processing for more than an hour are marked failed and their payload is cleared. Interrupted writes are not replayed; the user can resubmit.
- **Database outages.** The worker backs off for 2, 4, 8, 16 and then 30 seconds. If a handler finished but saving its final state failed, the worker retries that write before claiming another job, without rerunning the import.
- **Estimates.** `estimateMs` adds the remaining time of the running job to the average duration of each job ahead, using jobs completed in the last hour.

## Storage

- With PostgreSQL (`WISH_DB_DRIVER=postgres`) jobs live in the `queue_jobs` table (Prisma model `QueueJob`) and survive restarts.
- Without a database, `MemoryQueueStore` keeps them in memory. This is used by tests and quick local runs.

## Code map

| Area | Location |
| --- | --- |
| Contract | `packages/contracts/src/queue.ts`: `QUEUE_KINDS`, `QueueJob`, `QueueBoard`, `QueueJobError` |
| API | `apps/api/src/queue/`: `job-queue.store.ts`, `job-queue.service.ts`, `queue.module.ts` |
| Web client | `apps/web/src/features/queue/client.ts`: `submitJob`, `waitForJob`, `runQueued`, `fetchBoard` |
| File uploads | `apps/web/src/features/queue/sealed-upload.ts`: `submitSealedFile` |
| UI | `queue-notice.tsx` (inline status), `queue-view.tsx` (the `/tools/queue/` page) |

## Adding an operation

1. Add the kind to `QUEUE_KINDS` in `packages/contracts/src/queue.ts` and a label to `KIND_LABEL` in the web client.
2. In the service, keep the work in one method and register it with `queue.register(kind, handler)` in `onModuleInit`.
3. In the controller, run only cheap checks before `queue.enqueue(kind, payload, ip)`.
4. On the page, call `runQueued(url, init, setJob)` and render `<QueueNotice job={job} />`.
5. Add a result line to `ResultLine` in `queue-view.tsx`.
