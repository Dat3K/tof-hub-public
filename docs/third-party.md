# Third-party notices

The project's own source code is released under the [MIT License](../LICENSE). Bundled tools, dependencies and game content keep their own licenses.

## Tools bundled with the exporter

| Component | Use | Pinned in |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | Portable runtime inside `ToFExporter.exe` | `tools/patch-exporter/config/runtime.json` |
| [UnrealExporter](https://github.com/luk-gg/UnrealExporter) (CUE4Parse) | Reads the game's Unreal Engine archives | `tools/patch-exporter/config/runtime.json` |
| [libwebp](https://chromium.googlesource.com/webm/libwebp) (`cwebp`) | PNG → WebP conversion | `tools/patch-exporter/config/runtime.json` |
| [7-Zip](https://www.7-zip.org/) (`7zr.exe`) | Self-extracting payload of the native launcher | `tools/patch-exporter/scripts/package-executable.ts` |
| [sharp](https://sharp.pixelplumbing.com/) | Image processing in generators and Open Graph images | `pnpm-lock.yaml` |

Upstream details: [Node runtime](../tools/patch-exporter/upstream/NodeRuntime.md), [UnrealExporter](../tools/patch-exporter/upstream/UnrealExporter.md), and the libwebp [license](../tools/patch-exporter/upstream/WEBP_COPYING) and [patent grant](../tools/patch-exporter/upstream/WEBP_PATENTS).

The exporter downloads these components into ignored caches and verifies their checksums. Executables, DLLs and archives are release artifacts, never committed to Git. Keep the license notices with any redistributed package.

## Data

- **Gear reference definitions** come from a pinned upstream revision; the source URL and revision are recorded in `scripts/generators/build-reference.cjs`.
- **Game content** (tables, text, images) is extracted from the installed client and belongs to its owners. It is not covered by this project's MIT license.
- **Preserved historical artwork** and normalized observations are separately declared inputs, delivered in the bootstrap package.
