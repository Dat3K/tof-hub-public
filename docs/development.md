# Development

## Requirements

- Node.js `>=24.15.0 <25` (see [`.node-version`](../.node-version))
- pnpm `12.5.1`
- Docker, for PostgreSQL and Redis
- Windows x64 with Visual Studio 2022 Build Tools, only if you build the exporter executable

The lockfile is part of the source. Always install with `--frozen-lockfile`.

## First setup

```bash
pnpm install --frozen-lockfile
node scripts/setup.mjs
node scripts/bootstrap.mjs
pnpm --filter "@tof-hub/contracts..." --filter "@tof-hub/game-assets..." --filter "@tof-hub/game-domain..." build
```

Then generate or install game data for the parts you are working on (see the [pipeline guide](pipeline.md)).

`pnpm dev` starts the web and API development servers. PostgreSQL and Redis keep running in containers; point `DATABASE_URL` at a host-reachable address when the API runs on the host. The Compose stack in the [README](../README.md#getting-started) remains the reference end-to-end setup.

Windows local helpers live in `scripts/local/`: `ensure-local-database.mjs`
checks the configured existing database, and `run-local-api.ps1` builds and starts
the API while retaining an existing listener. Set `DATABASE_URL` in the process
environment before using them. The database check does not create or seed a database.

## Checks

Run these before every commit:

```bash
node scripts/check-public-source.mjs  # Public source, configuration and script layout
pnpm lint                     # ESLint + UI localization check
pnpm typecheck
pnpm test:unit                # Vitest
pnpm prisma:validate
pnpm build:api
pnpm build:web
pnpm validate:import-examples
```

Exporter checks use the Node test runner, separately from Vitest:

```bash
pnpm --filter @tof-hub/tof-exporter typecheck
pnpm --filter @tof-hub/tof-exporter build
pnpm exec tsx --test --test-concurrency=4 tools/patch-exporter/src/__tests__/*.test.ts
```

For browser checks against Next directly, set `PLAYWRIGHT_BASE_URL` and
`PLAYWRIGHT_SKIP_WEBSERVER=1`, plus `PLAYWRIGHT_DIRECT_APP=1`. This explicitly skips
the two nginx cache-policy tests; run them without that flag against the Compose
proxy before verifying deployment. Other route, metadata and browser assertions
still run against the chosen origin.

Set `TOF_EXPORTER_TEST_EXE` to a built executable to enable its standalone integration test.

The web typecheck and about 40 regression test files read generated game data and fail without it. CI runs only the checks that need no game data (see `.github/workflows/ci.yml`); run the rest locally after generating the data. Passing them shows the code handles that data correctly, not that every future game client is covered.

## Browser tests

Start the Compose stack, then:

```bash
pnpm exec playwright test tests/e2e/info.spec.ts tests/e2e/shared-ui.spec.ts
```

Playwright uses your installed Chrome and `http://localhost:8080`. Set `PLAYWRIGHT_BASE_URL` for another origin. Reports and traces go to ignored output directories.

When changing UI, check English and Russian, narrow mobile widths, keyboard interaction, missing images and empty or error states.

## Changing game data

1. Find the existing processor or generator and every reader of its output before adding a new path.
2. Record the exact raw path, table, row keys, units, region and version, and the output that consumes it.
3. Change the processor, schema or editorial input, then regenerate.

Never edit generated JSON to fix a bug; the next pipeline run will overwrite it. Keep unresolved interpretations explicit instead of guessing. See [data provenance](data-provenance.md).

## Repository hygiene

The repository holds code, contracts, tests, configuration templates and documentation. Generated data, game images, binaries, caches, local environments and credentials stay out of Git.

Before committing:

```bash
node scripts/check-public-source.mjs
git diff --cached
```

Remember that `.gitignore` does not untrack a file that is already committed, and it does not remove anything from history.
