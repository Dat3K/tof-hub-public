import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ResolvedMediaTool {
  toolType: 'cwebp' | 'ffmpeg';
  binaryPath: string;
  version?: string;
}

export interface ResolveToolOptions {
  customBinaryPath?: string;
  preferTool?: 'cwebp' | 'ffmpeg';
  searchDirs?: string[];
}

export interface ConvertWebpOptions {
  tool?: ResolvedMediaTool;
  lossless?: boolean;
  quality?: number;
  force?: boolean;
  mockConverter?: (src: string, dest: string) => boolean | Promise<boolean>;
}

export interface ConvertWebpResult {
  success: boolean;
  srcPngPath: string;
  destWebpPath: string;
  pngSizeBytes: number;
  webpSizeBytes: number;
  sha256Png: string;
  sha256Webp: string;
  width: number | null;
  height: number | null;
  toolUsed: string;
  durationMs: number;
  error?: string;
}

export interface PngDimensions {
  width: number | null;
  height: number | null;
  isValidPng: boolean;
}

/**
 * Parses image dimensions and validates PNG signature from file header.
 */
export function getPngDimensions(filePath: string): PngDimensions {
  if (!fs.existsSync(filePath)) {
    return { width: null, height: null, isValidPng: false };
  }

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(32);
    fs.readSync(fd, buf, 0, 32, 0);
    fs.closeSync(fd);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a;

    if (isPng) {
      // IHDR chunk starts at byte 12; width is at 16, height is at 20 (both uint32 big endian)
      return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
        isValidPng: true,
      };
    }
  } catch {
    // Non-fatal, return null dimensions
  }

  return { width: null, height: null, isValidPng: false };
}

/**
 * Computes SHA-256 hexadecimal hash of a file synchronously.
 */
/** Reads through the libuv thread pool so concurrent media workers overlap their disk I/O. */
async function computeSha256Async(filePath: string): Promise<string> {
  return crypto.createHash('sha256').update(await fs.promises.readFile(filePath)).digest('hex');
}

export function computeSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Probes for available native media binaries with priority:
 * 1. Bundled package bin directory (dist/tof-exporter-portable/bin or bin/)
 * 2. Custom passed binary path or env var (TOF_CWEBP_PATH, TOF_FFMPEG_PATH)
 * 3. System PATH fallback
 */
export function resolveNativeMediaTool(options: ResolveToolOptions = {}): ResolvedMediaTool | null {
  // 1. Explicit argument
  if (options.customBinaryPath && fs.existsSync(options.customBinaryPath)) {
    const base = path.basename(options.customBinaryPath).toLowerCase();
    const toolType = base.includes('cwebp') ? 'cwebp' : 'ffmpeg';
    return {
      toolType,
      binaryPath: path.resolve(options.customBinaryPath),
    };
  }

  // 2. Environment variables
  if (process.env.TOF_CWEBP_PATH && fs.existsSync(process.env.TOF_CWEBP_PATH)) {
    return {
      toolType: 'cwebp',
      binaryPath: path.resolve(process.env.TOF_CWEBP_PATH),
    };
  }
  if (process.env.TOF_FFMPEG_PATH && fs.existsSync(process.env.TOF_FFMPEG_PATH)) {
    return {
      toolType: 'ffmpeg',
      binaryPath: path.resolve(process.env.TOF_FFMPEG_PATH),
    };
  }

  // 3. Candidate directories relative to script / execution directory
  const candidateDirs: string[] = [
    ...(options.searchDirs || []),
    // Package bin locations
    path.resolve(__dirname, '../bin'),
    // Repository runs: src/ -> tools/patch-exporter/dist/tof-exporter-portable/bin
    path.resolve(__dirname, '../dist/tof-exporter-portable/bin'),
    path.resolve(process.cwd(), 'bin'),
    path.resolve(process.cwd(), 'tools/patch-exporter/bin'),
    path.resolve(process.cwd(), 'tools/patch-exporter/dist/tof-exporter-portable/bin'),
    path.resolve(__dirname, '../runtime'),
  ];

  // Try cwebp first (leanest official binary)
  for (const dir of candidateDirs) {
    const cwebpWin = path.join(dir, 'cwebp.exe');
    const cwebpUnix = path.join(dir, 'cwebp');
    if (fs.existsSync(cwebpWin)) {
      return { toolType: 'cwebp', binaryPath: cwebpWin };
    }
    if (fs.existsSync(cwebpUnix)) {
      return { toolType: 'cwebp', binaryPath: cwebpUnix };
    }
  }

  // Try ffmpeg second
  for (const dir of candidateDirs) {
    const ffmpegWin = path.join(dir, 'ffmpeg.exe');
    const ffmpegUnix = path.join(dir, 'ffmpeg');
    if (fs.existsSync(ffmpegWin)) {
      return { toolType: 'ffmpeg', binaryPath: ffmpegWin };
    }
    if (fs.existsSync(ffmpegUnix)) {
      return { toolType: 'ffmpeg', binaryPath: ffmpegUnix };
    }
  }

  // 4. System PATH probe
  try {
    const isWindows = process.platform === 'win32';
    const probeCmd = isWindows ? 'where.exe' : 'which';

    try {
      const cwebpOut = execFileSync(probeCmd, ['cwebp'], { stdio: 'pipe', encoding: 'utf8' }).trim();
      const firstLine = cwebpOut.split(/\r?\n/)[0];
      if (firstLine && fs.existsSync(firstLine)) {
        return { toolType: 'cwebp', binaryPath: firstLine };
      }
    } catch {
      // Not found in PATH
    }

    try {
      const ffmpegOut = execFileSync(probeCmd, ['ffmpeg'], { stdio: 'pipe', encoding: 'utf8' }).trim();
      const firstLine = ffmpegOut.split(/\r?\n/)[0];
      if (firstLine && fs.existsSync(firstLine)) {
        return { toolType: 'ffmpeg', binaryPath: firstLine };
      }
    } catch {
      // Not found in PATH
    }
  } catch {
    // PATH probe failed
  }

  return null;
}

/**
 * Converts a PNG image to WebP using the resolved native tool or mock converter.
 */
export async function convertPngToWebp(
  srcPngPath: string,
  destWebpPath: string,
  options: ConvertWebpOptions = {}
): Promise<ConvertWebpResult> {
  const startTime = Date.now();

  const canonicalSrc = path.resolve(srcPngPath);
  const canonicalDest = path.resolve(destWebpPath);

  if (!fs.existsSync(canonicalSrc)) {
    throw new Error(`Source PNG file does not exist: "${canonicalSrc}"`);
  }

  const dims = getPngDimensions(canonicalSrc);
  const sha256Png = await computeSha256Async(canonicalSrc);
  const pngSizeBytes = fs.statSync(canonicalSrc).size;

  // Ensure output directory exists
  const destDir = path.dirname(canonicalDest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 1. Check custom mock converter (for unit tests and simulated runs)
  if (options.mockConverter) {
    const mockSuccess = await options.mockConverter(canonicalSrc, canonicalDest);
    if (!mockSuccess || !fs.existsSync(canonicalDest)) {
      return {
        success: false,
        srcPngPath: canonicalSrc,
        destWebpPath: canonicalDest,
        pngSizeBytes,
        webpSizeBytes: 0,
        sha256Png,
        sha256Webp: '',
        width: dims.width,
        height: dims.height,
        toolUsed: 'mock',
        durationMs: Date.now() - startTime,
        error: 'Mock converter failed to generate WebP',
      };
    }

    const webpSizeBytes = fs.statSync(canonicalDest).size;
    const sha256Webp = computeSha256(canonicalDest);
    return {
      success: true,
      srcPngPath: canonicalSrc,
      destWebpPath: canonicalDest,
      pngSizeBytes,
      webpSizeBytes,
      sha256Png,
      sha256Webp,
      width: dims.width,
      height: dims.height,
      toolUsed: 'mock',
      durationMs: Date.now() - startTime,
    };
  }

  // 2. Resolve native tool
  const tool = options.tool || resolveNativeMediaTool();

  if (!tool) {
    throw new Error(
      `No native media conversion tool found. Please ensure cwebp.exe or ffmpeg.exe is present in the portable package bin/ directory or system PATH.`
    );
  }

  // WebP is the delivery format. Use lossy compression by default so the
  // generated derivative is materially smaller while retaining good visual
  // quality; callers can opt into lossless explicitly.
  const isLossless = options.lossless === true;
  const quality = typeof options.quality === 'number' ? options.quality : 85;

  // Older exports and the preserved archive hold some textures as WebP under a .png name:
  // that file already is the delivery format.
  const signature = Buffer.alloc(12);
  const signatureFd = fs.openSync(canonicalSrc, 'r');
  fs.readSync(signatureFd, signature, 0, 12, 0);
  fs.closeSync(signatureFd);
  if (signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP') {
    await fs.promises.copyFile(canonicalSrc, canonicalDest);
    return {
      success: true,
      srcPngPath: canonicalSrc,
      destWebpPath: canonicalDest,
      pngSizeBytes,
      webpSizeBytes: fs.statSync(canonicalDest).size,
      sha256Png,
      sha256Webp: await computeSha256Async(canonicalDest),
      width: dims.width,
      height: dims.height,
      toolUsed: tool.toolType,
      durationMs: Date.now() - startTime,
    };
  }

  // Re-encoding is the slowest pipeline stage. With TOF_MEDIA_CACHE_DIR set, a
  // WebP is reused when the identical PNG was encoded with the same settings.
  const cacheDir = process.env.TOF_MEDIA_CACHE_DIR;
  const cacheFile = cacheDir
    ? path.join(cacheDir, sha256Png.slice(0, 2), `${sha256Png}-${isLossless ? 'lossless' : `q${quality}`}.webp`)
    : null;
  if (cacheFile && !options.force && fs.existsSync(cacheFile)) {
    await fs.promises.copyFile(cacheFile, canonicalDest);
    return {
      success: true,
      srcPngPath: canonicalSrc,
      destWebpPath: canonicalDest,
      pngSizeBytes,
      webpSizeBytes: fs.statSync(canonicalDest).size,
      sha256Png,
      sha256Webp: await computeSha256Async(canonicalDest),
      width: dims.width,
      height: dims.height,
      toolUsed: tool.toolType,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    if (tool.toolType === 'cwebp') {
      const args: string[] = [];
      if (isLossless) {
        args.push('-lossless');
      } else {
        args.push('-q', String(quality));
      }
      // cwebp cannot open paths beyond MAX_PATH (260); deep package folders exceed it.
      // Encode through short temporary names and let Node move the result.
      const longPath = canonicalSrc.length > 240 || canonicalDest.length > 240;
      const tempDir = longPath ? fs.mkdtempSync(path.join(os.tmpdir(), 'tofwebp-')) : '';
      const inputPath = longPath ? path.join(tempDir, 'in.png') : canonicalSrc;
      const outputPath = longPath ? path.join(tempDir, 'out.webp') : canonicalDest;
      try {
        if (longPath) fs.copyFileSync(canonicalSrc, inputPath);
        args.push(inputPath, '-o', outputPath);
        await execFileAsync(tool.binaryPath, args);
        if (longPath) fs.copyFileSync(outputPath, canonicalDest);
      } finally {
        if (longPath) fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } else if (tool.toolType === 'ffmpeg') {
      const args: string[] = [
        '-y',
        '-i',
        canonicalSrc,
        '-c:v',
        'libwebp',
        isLossless ? '-lossless' : '-quality',
        isLossless ? '1' : String(quality),
        canonicalDest,
      ];
      await execFileAsync(tool.binaryPath, args);
    }

    if (!fs.existsSync(canonicalDest) || fs.statSync(canonicalDest).size === 0) {
      throw new Error(`Output WebP file was not created or has 0 bytes at "${canonicalDest}"`);
    }

    if (cacheFile) {
      try {
        fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
        fs.copyFileSync(canonicalDest, cacheFile);
      } catch {
        // The cache is an optimization only.
      }
    }

    const webpSizeBytes = fs.statSync(canonicalDest).size;
    const sha256Webp = await computeSha256Async(canonicalDest);

    return {
      success: true,
      srcPngPath: canonicalSrc,
      destWebpPath: canonicalDest,
      pngSizeBytes,
      webpSizeBytes,
      sha256Png,
      sha256Webp,
      width: dims.width,
      height: dims.height,
      toolUsed: tool.toolType,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      srcPngPath: canonicalSrc,
      destWebpPath: canonicalDest,
      pngSizeBytes,
      webpSizeBytes: 0,
      sha256Png,
      sha256Webp: '',
      width: dims.width,
      height: dims.height,
      toolUsed: tool.toolType,
      durationMs: Date.now() - startTime,
      error: err.message || String(err),
    };
  }
}
