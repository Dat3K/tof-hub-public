# Game processors

Processors turn a raw game export into the staging tree (`info/...`, `datamine/...`) that `scripts/normalize-game-data` and the site generators read. They run as the `processors` step of the [pipeline](../../docs/pipeline.md) (`tools/patch-exporter/src/pipeline-run.ts`).

```text
processors/   one TypeScript module per dataset, each run as a separate process
build/        dependency-graph runner (run-processors --dag) and staging preparation
contracts/    jobs.json (dependency graph and arguments), outputs.json (paths cleared before a run)
curated/      editorial inputs copied into the staging tree before every run
```

`processors/shared/tof-formulas.js` is a browser UMD script shared with the website.

## Build

Sources are TypeScript (`tsconfig.json`), type-checked by `pnpm --filter @tof-hub/tof-exporter typecheck`. `tools/patch-exporter/scripts/compile-processors.ts` transpiles them file by file with esbuild into a CommonJS tree with the same layout: the repository pipeline compiles into `<work>/processors-dist`, and the portable package ships the compiled `processors/`. `contracts/jobs.json` refers to the compiled `.js` files.

## Rules

- Every processor takes `--raw-dir=<raw export root> --project-root=<staging>`.
- A processor must not depend on files left over from an earlier run. If it reads another processor's output, `jobs.json` must order them. `tools/patch-exporter/scripts/trace-report.ts` lists undeclared reads as hidden dependencies.

## Editing curated inputs

| Goal | File |
| --- | --- |
| Add a boss card | Copy a draft from the pipeline report `fce-boss-drafts/` to `curated/datamine/fce/data/bosses/` |
| Give an enemy a picture | `processors/monster-image-mapping.json` (monster class → texture). Candidates are listed in the `enemies-without-art.md` report. |
| Artwork titles on `/info/arts` | `curated/info/arts/artworks-catalog.json`. New candidates appear in the `new-artworks.json` report. |
| Item names and renames | `curated/datamine/items/curated/*.json` |
| Sequential mechanics notes | `curated/datamine/seq/data/seq-mechanics-overrides.json` |
| Keep a texture removed from the client | Store the PNG or WebP under `curated/datamine/shared/media/Hotta/...` |

## Running one processor

```bash
npx tsx scripts/game-processors/processors/build-cute-pets.ts --raw-dir=<raw> --project-root=<staging>
```
