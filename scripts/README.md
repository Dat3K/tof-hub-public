# Repository scripts

| Directory / entry | Purpose |
| --- | --- |
| `generators/` | Site catalogs, progression, Handbook, hub summaries, previews and runtime projections |
| `checks/` | UI localization and game-calculation audits |
| `lib/` | Shared generator helpers, locale projection and the pipeline API |
| `local/` | Local PostgreSQL checks and the Windows API launcher; connection settings come from the environment |
| `data/` | Maintained reference inputs and server snapshots; preserved media is restored from the bootstrap package |
| `game-processors/` | Raw game export to processor outputs, with the dependency graph and curated inputs |
| `normalize-game-data/` | Canonical entities, locale overlays and site datasets |
| `build-data-manifest/`, `validate-generated/` | Release provenance and output validation |
| `generate-wish-media-map/` | Wish media registry |
| `_shared/` | TypeScript pipeline helpers |
| `setup.mjs`, `bootstrap.mjs`, `install-public-data.mjs` | Installation setup and verified content installation |
| `import-json.mjs`, `validate-import-examples.ts` | Public JSON imports and example validation |
| `check-public-source.mjs` | Checks source files before publication |

Root `package.json` exposes the normal commands. The exporter calls the same
generators through `SITE_GENERATORS` in `tools/patch-exporter/src/pipeline-run.ts`;
the portable package bundles them into a flat generator directory.

Use `lib/site-paths.cjs` for repository, raw, staging and public paths.
`generatorDataDir` resolves maintained inputs in the checkout or the portable
package. Extend the existing extraction rules, processors and generators when
adding game data; see [the pipeline guide](../docs/pipeline.md).

Keep exploratory scripts and reports in ignored `ignore/` directories. Generated
game content, credentials and local configuration do not belong in source control.
