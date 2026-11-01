# API

NestJS service behind `/api/v1`. It accepts player imports, scores and ranks
gear, stores builds and order histories, and tracks game versions. Game data is
read from the generated files mounted at `GAME_DATA_ROOT`; user data lives in
PostgreSQL through Prisma, with Redis as a cache.

## Modules

| Module | Responsibility |
| --- | --- |
| [`import/`](src/import) | Plain JSON and sealed files: AES-256-GCM payloads whose key is wrapped with this installation's RSA-OAEP key, with sizes checked before any decryption |
| [`queue/`](src/queue) | One PostgreSQL job queue for every heavy import: an advisory lock keeps a single worker across API replicas, one active job per requester, a waiting limit, one-time private delivery and retention cleanup ([details](../../docs/architecture/job-queue.md)) |
| [`build/`](src/build) | Build imports, signed build-card profiles (RSA-PSS over the capture digest) for Global and MMO, and the ranking of a saved card's equipped gear |
| [`players/`](src/players) | Player store and search, gear retention across imports, nickname history, canonical character UIDs and the negative Combat Strength ledger |
| [`ranking/`](src/ranking) | Item and player leaderboards per role and element track, precomputed best rows for "all" and element pairs, and a Redis cache versioned by a database revision |
| [`wish/`](src/wish) | Order-history imports, deduplication, analytics and public tallies; access through device tokens, never by knowing a UID |
| [`version-status/`](src/version-status) | Polls the official launcher endpoints every ten minutes; database locks coordinate replicas |
| [`security/`](src/security) | Request admission before body parsing, JSON depth and prototype-key checks, abuse counters on salted IP hashes, admin-key comparison, and a startup check that refuses to run in production if the database role can own objects, create schemas, truncate tables or hold elevated memberships |
| [`notifications/`](src/notifications) | Optional Telegram notifications, off by default |
| [`feedback/`](src/feedback) | Site feedback survey with owner-only export |

Scoring itself is not implemented here: every service calls
[`@tof-hub/game-domain`](../../packages/game-domain), and request and file
formats come from [`@tof-hub/contracts`](../../packages/contracts).

## Data

The schema is [`prisma/schema.prisma`](prisma/schema.prisma). A new installation
applies one baseline migration; triggers keep character UIDs canonical, and CHECK
constraints guard feedback and Combat Strength values in the database itself.
Migrations run as the schema owner; the API connects as a role that can read and
write rows but cannot change the schema ([configuration](../../docs/configuration.md#database)).

## Running and testing

The API normally runs inside the Compose stack (see the
[project README](../../README.md#getting-started)). For host development:

```bash
pnpm --filter api dev
pnpm --filter api typecheck
pnpm exec vitest run apps/api
```

Tests named `*.postgres.test.ts` run against a disposable database when
`TOF_HUB_TEST_DATABASE_URL` points at one that `prisma migrate deploy` has
migrated; without it they are skipped.
