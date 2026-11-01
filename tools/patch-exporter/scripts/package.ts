import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetchNodeRuntime, fetchUnrealExporter, loadRuntimeConfig } from './fetch-runtime';
import { buildBundle } from './build-bundle';
import { stagePipelinePackage } from './package-pipeline';
import { buildExecutablePackage } from './package-executable';

export interface PackageOptions {
  outDir?: string;
  createZip?: boolean;
  createExe?: boolean;
  skipRuntime?: boolean;
  forceRuntimeDownload?: boolean;
}

export interface PackageResult {
  portableDir: string;
  zipPath?: string;
  exePath?: string;
  runtimeNodeExe: string;
  unrealExe: string;
  bundledScripts: string[];
}

/**
 * Creates the standard batch file content that binds exclusively to the bundled node.exe runtime.
 */
function createBatchWrapper(scriptRelativePath: string, title: string): string {
  return `@echo off
setlocal enabledelayedexpansion
title ${title}

set "SCRIPT_DIR=%~dp0"
set "NODE_EXE=%SCRIPT_DIR%runtime\\node.exe"

if not exist "%NODE_EXE%" (
    echo =======================================================================
    echo [FATAL ERROR] Bundled Node.js runtime not found at:
    echo   %NODE_EXE%
    echo.
    echo Please ensure the portable exporter archive was extracted completely.
    echo Global system PATH node is intentionally disabled to guarantee
    echo deterministic, isolated execution.
    echo =======================================================================
    pause
    exit /b 1
)

"%NODE_EXE%" "%SCRIPT_DIR%${scriptRelativePath}" %*
exit /b !ERRORLEVEL!
`;
}

/**
 * Creates the README.txt for the portable archive distribution.
 */
function createReadmeContent(nodeVersion: string): string {
  return `===============================================================================
Tower of Fantasy Portable Game Data Exporter (tof-exporter)
===============================================================================

This package is a self-contained, offline portable tool for Tower of Fantasy
game data extraction, normalization, and public JSON/WebP materialization.

ZERO DEPENDENCIES:
You do NOT need to install Node.js, Python, pnpm, or Git.
This package contains its own verified, pinned Node.js LTS runtime (${nodeVersion})
located in "runtime/node.exe", Unreal Engine extraction tools in "bin/",
and WebP image conversion tools.

WORKFLOWS:

1. Standard Export Workflow (End-User / Maintainer Live Extraction):
   Double-click or run:
     export.bat [options]

   This will:
   - Locate the installed Tower of Fantasy game client (Steam, Epic, or Standalone)
   - Extract required data tables and icons surgically (using bin/UnrealExporter.exe)
   - Normalize data and materialize localized EN and RU datasets
   - Convert UI textures to lossless WebP preserving in-game relative paths
   - Output deploy-ready JSON and WebP media to deploy/

2. Prepared-File Workflow (Offline / Testing / Migration):
   Run from command line:
     process-existing.bat --input <path_to_raw_exports> --output <path_to_deploy>

   This strictly skips game discovery and extraction, processing pre-extracted raw fixtures.
   Mandatory arguments: --input and --output. Output must reside outside input.

3. Integrity Verification:
   Run from command line:
     validate.bat --input <deploy_dir>

FILES & FOLDERS:
  export.bat              Main user export entrypoint (future live extraction)
  process-existing.bat    Prepared-file processing entrypoint (worker safe)
  validate.bat            Data integrity verification script
  runtime/node.exe        Pinned standalone Node.js LTS runtime
  runtime/NODE_LICENSE    Node.js and V8 license attribution
  bin/UnrealExporter.exe  CUE4Parse selective Unreal Engine data extractor (v2.0.0)
  bin/libSkiaSharp.dll    Skia graphics engine for UnrealExporter
  bin/blake3_dotnet.dll   BLAKE3 hashing engine for UnrealExporter
  bin/cwebp.exe           Google WebP encoder for image conversion
  bin/LICENSE.txt         Apache 2.0 license for UnrealExporter
  scripts/cli.js          Compiled standalone JavaScript CLI dispatcher
  scripts/process-existing.js Standalone prepared-file processor
  config/export-rules.json 165 selective extraction rules and requirements
  config/runtime.json     Authoritative runtime checksums and manifests

===============================================================================
`;
}

/**
 * Compresses a directory into a zip archive using tar.exe or PowerShell.
 */
function createZipArchive(sourceDir: string, destZipPath: string): void {
  const destDir = path.dirname(destZipPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  if (fs.existsSync(destZipPath)) {
    fs.rmSync(destZipPath, { force: true });
  }

  // Try tar.exe (built-in on Windows 10/11)
  let zipped = false;
  try {
    const parentDir = path.dirname(sourceDir);
    const baseName = path.basename(sourceDir);
    execFileSync('tar.exe', ['-a', '-cf', destZipPath, '-C', parentDir, baseName], {
      stdio: 'pipe',
    });
    if (fs.existsSync(destZipPath) && fs.statSync(destZipPath).size > 0) {
      zipped = true;
    }
  } catch {
    zipped = false;
  }

  // Fallback to PowerShell
  if (!zipped) {
    const psScript = `
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [System.IO.Compression.ZipFile]::CreateFromDirectory('${sourceDir.replace(/'/g, "''")}', '${destZipPath.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)
    `;
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      stdio: 'pipe',
    });
  }

  if (!fs.existsSync(destZipPath)) {
    throw new Error(`Failed to create ZIP archive at ${destZipPath}`);
  }
}

/**
 * Builds the complete portable distribution package.
 */
export async function buildPortablePackage(options: PackageOptions = {}): Promise<PackageResult> {
  const config = loadRuntimeConfig();
  const nodeInfo = config.runtimes.node;
  const unrealInfo = config.runtimes.unrealExporter;

  const portableDir = options.outDir
    ? path.resolve(options.outDir)
    : path.resolve(__dirname, '../dist/tof-exporter-portable');

  console.log(`[PACKAGE] Assembling portable package in ${portableDir}...`);

  // The default folder is rebuilt from scratch so files dropped from the package do not linger
  if (!options.outDir) {
    fs.rmSync(portableDir, { recursive: true, force: true });
  }
  fs.mkdirSync(portableDir, { recursive: true });

  const runtimeTargetDir = path.join(portableDir, 'runtime');
  const scriptsTargetDir = path.join(portableDir, 'scripts');
  const configTargetDir = path.join(portableDir, 'config');
  const binTargetDir = path.join(portableDir, 'bin');
  const curatedTargetDir = path.join(portableDir, 'curated-inputs');

  fs.mkdirSync(runtimeTargetDir, { recursive: true });
  fs.mkdirSync(scriptsTargetDir, { recursive: true });
  fs.mkdirSync(configTargetDir, { recursive: true });
  fs.mkdirSync(binTargetDir, { recursive: true });
  fs.mkdirSync(curatedTargetDir, { recursive: true });

  // 1. Stage Pinned Bundled Node.js Runtime
  let nodeExePath = path.join(runtimeTargetDir, 'node.exe');
  if (!options.skipRuntime) {
    console.log(`[PACKAGE] Fetching and staging pinned Node.js runtime (${nodeInfo.version})...`);
    const runtimeResult = await fetchNodeRuntime({
      targetRuntimeDir: runtimeTargetDir,
      force: options.forceRuntimeDownload,
    });
    nodeExePath = runtimeResult.nodeExePath;
  }

  // 2. Stage Verified Pinned UnrealExporter v2.0.0 Toolchain
  let unrealExePath = path.join(binTargetDir, 'UnrealExporter.exe');
  if (!options.skipRuntime) {
    console.log(`[PACKAGE] Staging verified UnrealExporter v${unrealInfo.version} toolchain...`);
    const unrealResult = await fetchUnrealExporter({
      targetBinDir: binTargetDir,
      force: options.forceRuntimeDownload,
    });
    unrealExePath = unrealResult.unrealExePath;
  }

  // 3. Compile and Bundle TypeScript Scripts to Standalone JS
  console.log(`[PACKAGE] Compiling and bundling TypeScript scripts...`);
  const bundleResult = await buildBundle(scriptsTargetDir);
  await stagePipelinePackage(portableDir, unrealInfo.runtimeDlls);

  // 4. Copy Config Files
  const sourceConfigDir = path.resolve(__dirname, '../config');
  if (fs.existsSync(sourceConfigDir)) {
    for (const file of fs.readdirSync(sourceConfigDir)) {
      if (file.endsWith('.json')) {
        fs.copyFileSync(
          path.join(sourceConfigDir, file),
          path.join(configTargetDir, file)
        );
      }
    }
  }

  // Optional hand-curated aliases travel with the archive. Advanced Multype
  // does not require them: its primary reference index is extracted directly
  // from the raw JSON tree in the same parallel pass.
  const sourceCuratedDir = path.resolve(__dirname, '../curated-inputs');
  if (fs.existsSync(sourceCuratedDir)) {
    fs.cpSync(sourceCuratedDir, curatedTargetDir, { recursive: true, force: true });
  }

  // 5. Stage Package Entrypoints & Documentation from package/ or template
  console.log(`[PACKAGE] Staging batch entrypoints and README...`);
  const sourcePackageDir = path.resolve(__dirname, '../package');

  const entryFiles = [
    { name: 'RUN.bat', fallback: createBatchWrapper('scripts\\cli.js run', 'Tower of Fantasy - site data update') },
    { name: 'export.bat', fallback: createBatchWrapper('scripts\\cli.js export', 'Tower of Fantasy Game Data Exporter') },
    { name: 'process-existing.bat', fallback: createBatchWrapper('scripts\\cli.js process-existing', 'Tower of Fantasy - Process Existing Data') },
    { name: 'validate.bat', fallback: createBatchWrapper('scripts\\process-existing.js --validate-only', 'Tower of Fantasy - Validate Datasets') },
    { name: 'README.txt', fallback: createReadmeContent(nodeInfo.version) },
  ];

  for (const entry of entryFiles) {
    const srcPath = path.join(sourcePackageDir, entry.name);
    const destPath = path.join(portableDir, entry.name);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    } else {
      fs.writeFileSync(destPath, entry.fallback, 'utf8');
    }
  }

  // The folder is an intermediate; the default release artifact is one executable.
  let exePath: string | undefined;
  if (options.createExe !== false) {
    exePath = await buildExecutablePackage(portableDir, path.join(path.dirname(portableDir), 'ToFExporter.exe'));
  }

  // ZIP remains an explicit diagnostic/compatibility option.
  let zipPath: string | undefined;
  const shouldCreateZip = options.createZip === true;
  if (shouldCreateZip) {
    const zipDest = path.resolve(
      path.dirname(portableDir),
      config.packageConfig.archiveName || 'tof-exporter-portable.zip'
    );
    console.log(`[PACKAGE] Creating portable zip archive: ${zipDest}...`);
    createZipArchive(portableDir, zipDest);
    zipPath = zipDest;
    console.log(`[PACKAGE] ZIP archive created (${fs.statSync(zipDest).size} bytes).`);
  }

  console.log(`[PACKAGE] Portable distribution successfully assembled at:`);
  console.log(`  Directory: ${portableDir}`);
  if (exePath) console.log(`  Executable: ${exePath}`);
  if (zipPath) {
    console.log(`  Archive: ${zipPath}`);
  }

  return {
    portableDir,
    zipPath,
    exePath,
    runtimeNodeExe: nodeExePath,
    unrealExe: unrealExePath,
    bundledScripts: bundleResult.bundledFiles,
  };
}

// CLI entrypoint
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('package.ts'))) {
  const args = process.argv.slice(2);
  const createZip = args.includes('--zip') && !args.includes('--no-zip');
  const forceRuntime = args.includes('--force-runtime');

  let customOut: string | undefined;
  const outIdx = args.indexOf('--outdir');
  if (outIdx !== -1 && args[outIdx + 1]) {
    customOut = args[outIdx + 1];
  }

  buildPortablePackage({
    outDir: customOut,
    createZip,
    createExe: !args.includes('--no-exe'),
    forceRuntimeDownload: forceRuntime,
  })
    .then((res) => {
      console.log(`\n[SUCCESS] Package build complete.`);
      console.log(`  Portable Dir: ${res.portableDir}`);
      if (res.exePath) console.log(`  Release EXE: ${res.exePath}`);
      console.log(`  Runtime Node: ${res.runtimeNodeExe}`);
      console.log(`  UnrealExporter: ${res.unrealExe}`);
      if (res.zipPath) {
        console.log(`  Portable ZIP: ${res.zipPath}`);
      }
    })
    .catch((err) => {
      console.error(`\n[ERROR] Package build failed: ${err.message}`);
      process.exit(1);
    });
}
