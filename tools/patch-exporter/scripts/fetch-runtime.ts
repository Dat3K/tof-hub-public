import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import { execFileSync } from 'node:child_process';

export interface RuntimeEntry {
  name: string;
  version: string;
  channel: string;
  codename: string;
  platform: string;
  arch: string;
  fileName: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  license: string;
  licenseUrl: string;
  internalArchivePaths: {
    binary: string;
    license: string;
  };
  targetPackagePaths: {
    binary: string;
    license: string;
  };
  excludedArchiveEntries: string[];
}

export interface UnrealExporterEntry {
  name: string;
  version: string;
  repo: string;
  fileName: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  license: string;
  binariesToPackage: string[];
  secretsToExclude: string[];
  targetDir: string;
  /** DLLs CUE4Parse otherwise downloads on first run; packaged when available. */
  runtimeDlls?: Array<{ name: string; sha256: string }>;
  runtimeDllsNote?: string;
}

export interface RuntimeConfig {
  runtimes: {
    node: RuntimeEntry;
    unrealExporter: UnrealExporterEntry;
    webp: { version: string; fileName: string; url: string; sha256: string; archiveRoot: string };
  };
  packageConfig: {
    outputDir: string;
    archiveName: string;
    bundledRuntimePath: string;
    entrypoints: Record<string, string>;
  };
}

/** Always ship the native media converter instead of depending on a developer's local bin/. */
export async function fetchWebpConverter(targetBinDir: string): Promise<void> {
  const info = loadRuntimeConfig().runtimes.webp;
  const cached = path.resolve(__dirname, '../.cache', info.fileName);
  if (!fs.existsSync(cached)) await downloadFile(info.url, cached);
  if (await computeFileSha256(cached) !== info.sha256) throw new Error(`WebP archive checksum mismatch: ${cached}`);
  extractSpecificZipEntries(cached, [
    { internalPath: `${info.archiveRoot}/bin/cwebp.exe`, targetFilePath: path.join(targetBinDir, 'cwebp.exe') },
  ]);
  for (const name of ['WEBP_COPYING', 'WEBP_PATENTS']) fs.copyFileSync(path.resolve(__dirname, '../upstream', name), path.join(targetBinDir, name));
  const version = execFileSync(path.join(targetBinDir, 'cwebp.exe'), ['-version'], { encoding: 'utf8' }).trim();
  if (version.split(/\r?\n/)[0] !== info.version) throw new Error(`Unexpected cwebp version: ${version}`);
}

export interface FetchOptions {
  cacheDir?: string;
  targetRuntimeDir?: string;
  force?: boolean;
  verifyOnly?: boolean;
}

export interface FetchUnrealOptions {
  cacheDir?: string;
  targetBinDir?: string;
  force?: boolean;
  verifyOnly?: boolean;
}

export interface FetchUnrealResult {
  cachedZipPath: string;
  unrealExePath: string;
  stagedFiles: string[];
  version: string;
  sha256: string;
  sizeBytes: number;
}

export interface FetchResult {
  cachedZipPath: string;
  nodeExePath: string;
  licensePath: string;
  version: string;
  sha256: string;
  sizeBytes: number;
}

/**
 * Confirms the executable starts and prints its CLI banner without relying on
 * the machine's console language or code page. ASCII survives the supported
 * Windows console encodings, while the rest of --help may be localized.
 */
export function smokeTestUnrealExporter(executablePath: string): void {
  const helpOutput = execFileSync(executablePath, ['--help']);
  if (!/\bunrealexporter(?:\.exe)?\b/i.test(helpOutput.toString('latin1'))) {
    throw new Error('Help output did not contain the UnrealExporter CLI banner.');
  }
}

/**
 * Loads and parses the authoritative runtime configuration.
 */
export function loadRuntimeConfig(): RuntimeConfig {
  const configPath = path.resolve(__dirname, '../config/runtime.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Runtime configuration not found at ${configPath}`);
  }
  const content = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(content) as RuntimeConfig;
}

/**
 * Computes SHA-256 checksum of a file.
 */
export function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Downloads a file over HTTPS, following redirects, to a destination path.
 */
export function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parentDir = path.dirname(destPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const tempPath = `${destPath}.tmp-${Date.now()}`;
    const file = fs.createWriteStream(tempPath);

    function doRequest(targetUrl: string, redirectCount = 0): void {
      if (redirectCount > 5) {
        file.close();
        fs.rmSync(tempPath, { force: true });
        reject(new Error(`Too many redirects when downloading ${url}`));
        return;
      }

      https.get(targetUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, targetUrl).toString();
          doRequest(redirectUrl, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.rmSync(tempPath, { force: true });
          reject(new Error(`Download failed with HTTP status ${res.statusCode} from ${targetUrl}`));
          return;
        }

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            fs.renameSync(tempPath, destPath);
            resolve();
          });
        });
      }).on('error', (err) => {
        file.close();
        fs.rmSync(tempPath, { force: true });
        reject(err);
      });
    }

    doRequest(url);
  });
}

/**
 * Extracts specific entries from a ZIP file into a target directory.
 * Uses Windows built-in tar or PowerShell System.IO.Compression.ZipFile.
 */
export function extractSpecificZipEntries(
  zipPath: string,
  entryMap: Array<{ internalPath: string; targetFilePath: string }>
): void {
  for (const { internalPath, targetFilePath } of entryMap) {
    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Try extracting with built-in tar (bsdtar) on Windows
    let extracted = false;
    try {
      // tar.exe -xf <archive.zip> -C <targetDir> --strip-components <N> <internalPath>
      const tempExtractDir = path.join(targetDir, `_extract_${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });
      execFileSync('tar.exe', ['-xf', zipPath, '-C', tempExtractDir, internalPath], {
        stdio: 'pipe',
      });
      const extractedPath = path.join(tempExtractDir, internalPath);
      if (fs.existsSync(extractedPath)) {
        if (fs.existsSync(targetFilePath)) {
          fs.rmSync(targetFilePath, { force: true });
        }
        fs.renameSync(extractedPath, targetFilePath);
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
        extracted = true;
      }
    } catch {
      extracted = false;
    }

    // Fallback to PowerShell if tar was unavailable or failed
    if (!extracted) {
      const psScript = `
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}')
        $entry = $zip.Entries | Where-Object { $_.FullName -eq '${internalPath.replace(/'/g, "''")}' }
        if ($null -eq $entry) {
          exit 1
        }
        $target = '${targetFilePath.replace(/'/g, "''")}'
        if (Test-Path $target) { Remove-Item $target -Force }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        $zip.Dispose()
      `;
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        stdio: 'pipe',
      });
    }

    if (!fs.existsSync(targetFilePath)) {
      throw new Error(`Failed to extract "${internalPath}" to "${targetFilePath}"`);
    }
  }
}

/**
 * Downloads, verifies, and stages the pinned Node.js LTS portable runtime.
 */
export async function fetchNodeRuntime(options: FetchOptions = {}): Promise<FetchResult> {
  const config = loadRuntimeConfig();
  const nodeInfo = config.runtimes.node;

  const cacheDir = options.cacheDir
    ? path.resolve(options.cacheDir)
    : path.resolve(__dirname, '../.cache');
  const targetRuntimeDir = options.targetRuntimeDir
    ? path.resolve(options.targetRuntimeDir)
    : path.resolve(__dirname, '../runtime');

  const zipDest = path.join(cacheDir, nodeInfo.fileName);

  // 1. Verify or Download Zip
  let needsDownload = true;
  if (fs.existsSync(zipDest) && !options.force) {
    const existingHash = await computeFileSha256(zipDest);
    if (existingHash.toLowerCase() === nodeInfo.sha256.toLowerCase()) {
      needsDownload = false;
    } else {
      console.warn(`[RUNTIME] Cached zip checksum mismatch (${existingHash} vs expected ${nodeInfo.sha256}). Re-downloading...`);
    }
  }

  if (needsDownload) {
    console.log(`[RUNTIME] Downloading pinned Node.js runtime (${nodeInfo.version}, ${nodeInfo.arch})...`);
    console.log(`  Source: ${nodeInfo.url}`);
    console.log(`  Destination: ${zipDest}`);
    await downloadFile(nodeInfo.url, zipDest);

    const downloadedHash = await computeFileSha256(zipDest);
    if (downloadedHash.toLowerCase() !== nodeInfo.sha256.toLowerCase()) {
      fs.rmSync(zipDest, { force: true });
      throw new Error(
        `SHA-256 verification failed for downloaded Node.js runtime!\nExpected: ${nodeInfo.sha256}\nComputed: ${downloadedHash}`
      );
    }
    console.log(`[RUNTIME] SHA-256 verified successfully: ${downloadedHash}`);
  } else {
    console.log(`[RUNTIME] Using cached Node.js runtime zip: ${zipDest}`);
  }

  if (options.verifyOnly) {
    return {
      cachedZipPath: zipDest,
      nodeExePath: '',
      licensePath: '',
      version: nodeInfo.version,
      sha256: nodeInfo.sha256,
      sizeBytes: fs.statSync(zipDest).size,
    };
  }

  // 2. Selectively Extract Only Needed Files (node.exe and LICENSE)
  const nodeExeTarget = path.join(targetRuntimeDir, 'node.exe');
  const licenseTarget = path.join(targetRuntimeDir, 'NODE_LICENSE');

  console.log(`[RUNTIME] Selectively extracting standalone runtime to ${targetRuntimeDir}...`);
  extractSpecificZipEntries(zipDest, [
    {
      internalPath: nodeInfo.internalArchivePaths.binary,
      targetFilePath: nodeExeTarget,
    },
    {
      internalPath: nodeInfo.internalArchivePaths.license,
      targetFilePath: licenseTarget,
    },
  ]);

  // 3. Smoke Test the Extracted Binary
  console.log(`[RUNTIME] Running smoke test on extracted binary: ${nodeExeTarget}...`);
  try {
    const versionOutput = execFileSync(nodeExeTarget, ['--version'], { encoding: 'utf8' }).trim();
    if (!versionOutput.startsWith(`v${nodeInfo.version}`)) {
      throw new Error(
        `Extracted node.exe reported version "${versionOutput}", expected "v${nodeInfo.version}"`
      );
    }
    console.log(`[RUNTIME] Verification passed: node.exe is functional (${versionOutput}).`);
  } catch (err) {
    throw new Error(`Smoke test failed for extracted node.exe: ${(err as Error).message}`);
  }

  const stat = fs.statSync(zipDest);
  return {
    cachedZipPath: zipDest,
    nodeExePath: nodeExeTarget,
    licensePath: licenseTarget,
    version: nodeInfo.version,
    sha256: nodeInfo.sha256,
    sizeBytes: stat.size,
  };
}

/**
 * Downloads, verifies, and stages the pinned UnrealExporter v2.0.0 toolchain.
 * Strictly excludes game keys (aes.txt, olderkeys.txt) and stages supporting DLLs and cwebp.
 */
export async function fetchUnrealExporter(options: FetchUnrealOptions = {}): Promise<FetchUnrealResult> {
  const config = loadRuntimeConfig();
  const unrealInfo = config.runtimes.unrealExporter;

  const cacheDir = options.cacheDir
    ? path.resolve(options.cacheDir)
    : path.resolve(__dirname, '../.cache');
  const targetBinDir = options.targetBinDir
    ? path.resolve(options.targetBinDir)
    : path.resolve(cacheDir, 'bin');

  const zipDest = path.join(cacheDir, unrealInfo.fileName);

  // 1. Verify or Download Zip
  let needsDownload = true;
  if (fs.existsSync(zipDest) && !options.force) {
    const existingHash = await computeFileSha256(zipDest);
    if (existingHash.toLowerCase() === unrealInfo.sha256.toLowerCase()) {
      needsDownload = false;
    } else {
      console.warn(
        `[RUNTIME] Cached UnrealExporter checksum mismatch (${existingHash} vs ${unrealInfo.sha256}). Re-downloading...`
      );
    }
  }

  if (needsDownload) {
    console.log(`[RUNTIME] Downloading pinned UnrealExporter (${unrealInfo.version})...`);
    console.log(`  Source: ${unrealInfo.url}`);
    console.log(`  Destination: ${zipDest}`);
    await downloadFile(unrealInfo.url, zipDest);

    const downloadedHash = await computeFileSha256(zipDest);
    if (downloadedHash.toLowerCase() !== unrealInfo.sha256.toLowerCase()) {
      fs.rmSync(zipDest, { force: true });
      throw new Error(
        `SHA-256 verification failed for UnrealExporter!\nExpected: ${unrealInfo.sha256}\nComputed: ${downloadedHash}`
      );
    }
    console.log(`[RUNTIME] UnrealExporter SHA-256 verified successfully: ${downloadedHash}`);
  } else {
    console.log(`[RUNTIME] Using cached UnrealExporter archive: ${zipDest}`);
  }

  if (options.verifyOnly) {
    return {
      cachedZipPath: zipDest,
      unrealExePath: '',
      stagedFiles: [],
      version: unrealInfo.version,
      sha256: unrealInfo.sha256,
      sizeBytes: fs.statSync(zipDest).size,
    };
  }

  // 2. Selectively Extract Binaries & Exclude Secret Keys
  if (!fs.existsSync(targetBinDir)) {
    fs.mkdirSync(targetBinDir, { recursive: true });
  }

  const archivePrefix = `UnrealExporter-${unrealInfo.version}/`;
  const extractEntries = [
    { internalPath: `${archivePrefix}UnrealExporter.exe`, targetFilePath: path.join(targetBinDir, 'UnrealExporter.exe') },
    { internalPath: `${archivePrefix}libSkiaSharp.dll`, targetFilePath: path.join(targetBinDir, 'libSkiaSharp.dll') },
    { internalPath: `${archivePrefix}blake3_dotnet.dll`, targetFilePath: path.join(targetBinDir, 'blake3_dotnet.dll') },
    { internalPath: `${archivePrefix}LICENSE.txt`, targetFilePath: path.join(targetBinDir, 'LICENSE.txt') },
    { internalPath: `${archivePrefix}README.md`, targetFilePath: path.join(targetBinDir, 'README.md') },
  ];

  console.log(`[RUNTIME] Extracting UnrealExporter binaries to ${targetBinDir}...`);
  extractSpecificZipEntries(zipDest, extractEntries);

  // Security guard: verify secrets are never staged
  for (const secretFile of unrealInfo.secretsToExclude) {
    const leakPath = path.join(targetBinDir, secretFile);
    if (fs.existsSync(leakPath)) {
      console.warn(`[SECURITY WARNING] Stripping proprietary key from distribution: ${leakPath}`);
      fs.rmSync(leakPath, { force: true });
    }
  }

  // 3. Always stage the pinned native WebP encoder, including its license.
  await fetchWebpConverter(targetBinDir);

  // 4. Smoke test extracted UnrealExporter.exe
  const unrealExeTarget = path.join(targetBinDir, 'UnrealExporter.exe');
  console.log(`[RUNTIME] Running smoke test on extracted UnrealExporter: ${unrealExeTarget}...`);
  try {
    smokeTestUnrealExporter(unrealExeTarget);
    console.log(`[RUNTIME] UnrealExporter smoke test passed.`);
  } catch (err) {
    throw new Error(`Smoke test failed for UnrealExporter.exe: ${(err as Error).message}`);
  }

  const stagedFiles = fs.readdirSync(targetBinDir);
  return {
    cachedZipPath: zipDest,
    unrealExePath: unrealExeTarget,
    stagedFiles,
    version: unrealInfo.version,
    sha256: unrealInfo.sha256,
    sizeBytes: fs.statSync(zipDest).size,
  };
}

// CLI execution entrypoint
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('fetch-runtime.ts'))) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const verifyOnly = args.includes('--verify-only');
  const unrealOnly = args.includes('--unreal-only');

  (async () => {
    if (!unrealOnly) {
      const nodeRes = await fetchNodeRuntime({ force, verifyOnly });
      console.log(`[SUCCESS] Node.js portable runtime prepared successfully.`);
      if (nodeRes.nodeExePath) {
        console.log(`  Binary: ${nodeRes.nodeExePath}`);
        console.log(`  License: ${nodeRes.licensePath}`);
      }
    }

    const unrealRes = await fetchUnrealExporter({ force, verifyOnly });
    console.log(`[SUCCESS] UnrealExporter portable toolchain prepared successfully.`);
    if (unrealRes.unrealExePath) {
      console.log(`  Binary: ${unrealRes.unrealExePath}`);
      console.log(`  Staged files: ${unrealRes.stagedFiles.join(', ')}`);
    }
  })().catch((err) => {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  });
}
