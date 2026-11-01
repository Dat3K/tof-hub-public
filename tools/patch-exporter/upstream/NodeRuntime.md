# Node.js portable runtime

The authoritative runtime version, official download URL, SHA-256, archive paths and license URL are in [runtime.json](../config/runtime.json). The current Windows x64 package uses Node.js 24.15.0.

The fetch step verifies the downloaded archive before extracting node.exe and its upstream license. npm, Corepack and the upstream node_modules tree are excluded from the portable runtime. Application dependencies are bundled separately by the package scripts.

The native launcher starts the bundled runtime. Users of the released executable do not need to install Node.js. Building from source requires the workspace's Node/pnpm versions and, for the native launcher, the Windows C++ build tools described in [the pipeline manual](../../../docs/pipeline.md).

Keep NODE_LICENSE with redistributed packages. Do not copy stale runtime hashes into documentation; update the manifest and rebuild the package together.
