# ToF Exporter

Source for the Windows exporter is included in this directory when you clone
`tof-hub-public`. It extracts the tables, localizations and images the website
uses from an installed Tower of Fantasy client, runs the full processing pipeline
and produces a full or delta content update.

The exporter shares its schemas, processors and generators with the website; it is not a second implementation. See the [pipeline guide](../../docs/pipeline.md) for stages, options and recovery, and the [project README](../../README.md) for installing the site.

## Commands

Run from the repository root after `pnpm install --frozen-lockfile` and restoring the bootstrap package:

```bash
pnpm --filter @tof-hub/tof-exporter typecheck
pnpm --filter @tof-hub/tof-exporter build        # JavaScript: tools/patch-exporter/dist/scripts/
pnpm --filter @tof-hub/tof-exporter package      # Windows EXE: tools/patch-exporter/dist/ToFExporter.exe
```

`package` runs the JavaScript build too, so a separate `build` is not required
before it. EXE packaging requires Windows x64, Visual Studio C++ Build Tools and
the Windows SDK. The command downloads and verifies pinned third-party runtimes
and tools; the project's exporter, processor and generator code comes from this
checkout. A prebuilt download from GitHub Releases is optional.

Run the executable you built:

```powershell
.\tools\patch-exporter\dist\ToFExporter.exe --full
```

Select the installed game. Results are placed next to the EXE under
`output/tof-update-*/`; install the result with the `apply-update` command using
an absolute path, as described in the [pipeline guide](../../docs/pipeline.md).

Process an existing raw export without the executable:

```bash
pnpm --filter @tof-hub/tof-exporter run pipeline --raw <RAW_ROOT> --out <OUTPUT_DIR> --jobs 8
```

Raw input is never modified. Put the output directory outside the raw tree and read the validation reports before applying a release.

## Layout

| Location | Responsibility |
| --- | --- |
| `src/run-command.ts` | Discovery, extraction, pipeline and release orchestration |
| `src/pipeline-run.ts` | Processor and generator order, locales, validation |
| `src/selective-list.ts` | Extraction rules and key configuration |
| `src/media-exporter.ts` | Media resolution, original PNGs and WebP previews |
| `src/release-package.ts` | Full and delta manifests and packages |
| `scripts/package*.ts` | Portable runtime and native executable assembly |
| `scripts/apply-update.ts` | Installs an update, including deletions |
| `config/runtime.json` | Pinned upstream downloads and checksums |
| `config/export-rules.json` | Extraction coverage |
| `native/` | C++ launcher that unpacks and starts the bundled runtime |
| `package/` | Batch files and the end-user README shipped with the release |
| `upstream/` | Notes and licenses for bundled third-party tools |

## Tests

```bash
pnpm exec tsx --test --test-concurrency=4 tools/patch-exporter/src/__tests__/*.test.ts
```

Set `TOF_EXPORTER_TEST_EXE` to a built executable to run its standalone integration test. Fixture tests cover packaging, path handling and processing contracts; a full extraction requires an installed client.

## Keys and binaries

Game extraction keys come from the bootstrap package or are supplied explicitly. They are unrelated to the website's import key.

Binary components (`.exe`, `.dll`, archives) are release artifacts and are never committed. Their licenses ship with the package; see [third-party notices](../../docs/third-party.md).
