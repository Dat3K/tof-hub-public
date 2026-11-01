/**
 * image-copier.js
 *
 * Exact, collision-safe, provenance-aware shared game-media resolver & copier.
 * Resolves game asset references into canonical original-game-path shared media store (/datamine/shared/media/Hotta/Content/.../*.webp).
 * Uses deterministic lossless WebP conversion, preserves FCE boss PNG downloads as siblings, and records verbatim provenance.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

import { normalizeUnrealSoftReference, toCanonicalMediaUrl, toCanonicalDiskPath, isFceBossDownloadAsset } from './canonical-media-library';

let crc32Table: Int32Array | null = null;

function crc32(buf) {
  let c;
  let crcTable = crc32Table;
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[n] = c;
    }
    crc32Table = crcTable;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function getPngDimensions(buffer) {
  if (!buffer || buffer.length < 24) return { width: null, height: null };
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
    return { width: null, height: null };
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function parsePng(buffer) {
  if (!buffer || buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idatChunks = [];
  let palette = null;
  let trns = null;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.slice(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (!width || !height || idatChunks.length === 0) return null;
  if (bitDepth !== 8) return null;

  let bytesPerPixel = 4;
  if (colorType === 6) bytesPerPixel = 4;
  else if (colorType === 2) bytesPerPixel = 3;
  else if (colorType === 3) bytesPerPixel = 1;
  else if (colorType === 0) bytesPerPixel = 1;
  else if (colorType === 4) bytesPerPixel = 2;
  else return null;

  const compressed = Buffer.concat(idatChunks);
  let decompressed;
  try {
    decompressed = zlib.inflateSync(compressed);
  } catch {
    return null;
  }

  const stride = width * bytesPerPixel;
  const rgba = Buffer.alloc(width * height * 4);

  let srcPos = 0;
  const prevRow = Buffer.alloc(stride);
  const curRow = Buffer.alloc(stride);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcPos++];
    for (let x = 0; x < stride; x++) {
      const raw = decompressed[srcPos++];
      const a = x >= bytesPerPixel ? curRow[x - bytesPerPixel] : 0;
      const b = prevRow[x];
      const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;

      let val = raw;
      if (filter === 1) val = (raw + a) & 0xff;
      else if (filter === 2) val = (raw + b) & 0xff;
      else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (raw + paeth(a, b, c)) & 0xff;

      curRow[x] = val;
    }

    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const dstIdx = rowOffset + x * 4;
      const srcIdx = x * bytesPerPixel;

      if (colorType === 6) {
        rgba[dstIdx] = curRow[srcIdx];
        rgba[dstIdx + 1] = curRow[srcIdx + 1];
        rgba[dstIdx + 2] = curRow[srcIdx + 2];
        rgba[dstIdx + 3] = curRow[srcIdx + 3];
      } else if (colorType === 2) {
        rgba[dstIdx] = curRow[srcIdx];
        rgba[dstIdx + 1] = curRow[srcIdx + 1];
        rgba[dstIdx + 2] = curRow[srcIdx + 2];
        rgba[dstIdx + 3] = 255;
      } else if (colorType === 3 && palette) {
        const palIdx = curRow[srcIdx] * 3;
        rgba[dstIdx] = palette[palIdx] || 0;
        rgba[dstIdx + 1] = palette[palIdx + 1] || 0;
        rgba[dstIdx + 2] = palette[palIdx + 2] || 0;
        rgba[dstIdx + 3] = (trns && curRow[srcIdx] < trns.length) ? trns[curRow[srcIdx]] : 255;
      } else if (colorType === 0) {
        const g = curRow[srcIdx];
        rgba[dstIdx] = g;
        rgba[dstIdx + 1] = g;
        rgba[dstIdx + 2] = g;
        rgba[dstIdx + 3] = 255;
      } else if (colorType === 4) {
        const g = curRow[srcIdx];
        rgba[dstIdx] = g;
        rgba[dstIdx + 1] = g;
        rgba[dstIdx + 2] = g;
        rgba[dstIdx + 3] = curRow[srcIdx + 1];
      }
    }

    curRow.copy(prevRow);
  }

  return { width, height, data: rgba };
}

function resizeRgba(src, targetWidth, targetHeight) {
  const dst = Buffer.alloc(targetWidth * targetHeight * 4);
  const xRatio = src.width / targetWidth;
  const yRatio = src.height / targetHeight;

  for (let dy = 0; dy < targetHeight; dy++) {
    const syStart = Math.floor(dy * yRatio);
    const syEnd = Math.min(src.height - 1, Math.floor((dy + 1) * yRatio));
    for (let dx = 0; dx < targetWidth; dx++) {
      const sxStart = Math.floor(dx * xRatio);
      const sxEnd = Math.min(src.width - 1, Math.floor((dx + 1) * xRatio));

      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = syStart; sy <= syEnd; sy++) {
        for (let sx = sxStart; sx <= sxEnd; sx++) {
          const idx = (sy * src.width + sx) * 4;
          r += src.data[idx];
          g += src.data[idx + 1];
          b += src.data[idx + 2];
          a += src.data[idx + 3];
          count++;
        }
      }

      const dstIdx = (dy * targetWidth + dx) * 4;
      dst[dstIdx] = count > 0 ? Math.round(r / count) : 0;
      dst[dstIdx + 1] = count > 0 ? Math.round(g / count) : 0;
      dst[dstIdx + 2] = count > 0 ? Math.round(b / count) : 0;
      dst[dstIdx + 3] = count > 0 ? Math.round(a / count) : 0;
    }
  }

  return { width: targetWidth, height: targetHeight, data: dst };
}

function encodePng(rgbaImage) {
  const { width, height, data } = rgbaImage;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const stride = width * 4;
  const rawScanlines = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const dstPos = y * (stride + 1);
    rawScanlines[dstPos] = 0;
    data.copy(rawScanlines, dstPos + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createThumbnail(srcPngPath, destThumbPath, maxDimension = 96) {
  try {
    const srcBuf = fs.readFileSync(srcPngPath);
    const parsed = parsePng(srcBuf);
    if (!parsed) {
      fs.copyFileSync(srcPngPath, destThumbPath);
      return false;
    }

    const { width, height } = parsed;
    const scale = Math.min(maxDimension / width, maxDimension / height);
    if (scale >= 1.0) {
      const encoded = encodePng(parsed);
      fs.writeFileSync(destThumbPath, encoded);
      return true;
    }

    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const resized = resizeRgba(parsed, targetWidth, targetHeight);
    const encoded = encodePng(resized);
    fs.writeFileSync(destThumbPath, encoded);
    return true;
  } catch {
    fs.copyFileSync(srcPngPath, destThumbPath);
    return false;
  }
}

function getWebpDimensions(buffer) {
  if (!buffer || buffer.length < 30) return { width: null, height: null };
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || webp !== 'WEBP') return { width: null, height: null };

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8 ') {
    if (buffer.length < 30) return { width: null, height: null };
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  } else if (chunkType === 'VP8L') {
    if (buffer.length < 25) return { width: null, height: null };
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    const width = 1 + (b1 | ((b2 & 0x3f) << 8));
    const height = 1 + (((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)));
    return { width, height };
  } else if (chunkType === 'VP8X') {
    if (buffer.length < 30) return { width: null, height: null };
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }

  return { width: null, height: null };
}

/**
 * Processors only stage source textures. WebP files and thumbnails are encoded by the pipeline media step
 * (tools/patch-exporter media-converter: bundled cwebp, content-hash cache); an ffmpeg found on PATH here made the
 * staging tree depend on the machine and cost one synchronous process per icon. Reports whether the target exists.
 */
function generateWebp(srcPngPath, destWebpPath, options: Record<string, any> = {}) {
  return fs.existsSync(destWebpPath) && fs.statSync(destWebpPath).size > 0;
}

function normalizeAssetPath(refStr): string {
  const norm = normalizeUnrealSoftReference(refStr);
  return (norm as any).relativePackagePath.replace(/\.webp$/i, '');
}

class ImageCopier {
  declare rawDir: any;
  declare projectRoot: any;
  declare exactPathIndex: any;
  declare leafIndex: any;
  declare stats: any;
  declare missingAssets: any;
  declare collisionLogs: any;
  declare sharedRegistry: Map<string, any>;
  declare fileHashMap: any;
  declare resolveCache: any;
  declare copyCache: any;

  constructor(rawDir, projectRoot) {
    this.rawDir = rawDir;
    this.projectRoot = projectRoot || path.resolve(__dirname, '../..');
    this.exactPathIndex = new Map<any, any>(); // normalized relative game path -> full path on disk
    this.leafIndex = new Map<any, any>(); // lowercase leaf name (no ext) -> full path[]
    this.stats = {}; // tab -> count
    this.missingAssets = [];
    this.collisionLogs = [];
    this.sharedRegistry = new Map<any, any>(); // canonicalPackagePath -> AssetRecord
    this.fileHashMap = new Map<any, any>();
    this.resolveCache = new Map<any, any>();
    this.copyCache = new Map<any, any>();
    this.init();
  }

  init() {
    const searchDirs = [
      this.rawDir,
      path.join(this.projectRoot, 'tof-fast-datamine', 'raw_exports'),
      path.join(this.projectRoot, 'raw_exports'),
      path.join(this.projectRoot, 'datamine')
    ].filter((d, i, arr) => d && fs.existsSync(d) && arr.indexOf(d) === i);

    for (const rootDir of searchDirs) {
      this._indexDirectory(rootDir, rootDir);
    }
  }

  _indexDirectory(dir, rootDir, depth = 0) {
    if (depth > 20) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const nameLower = e.name.toLowerCase();
        if (e.isFile() && (nameLower.endsWith('.png') || nameLower.endsWith('.webp')) && !nameLower.endsWith('.thumb.png') && !nameLower.endsWith('.thumb.webp')) {
          const relFromRoot = path.relative(rootDir, full).replace(/\\/g, '/');
          const normRel = relFromRoot.toLowerCase();
          const leafNoExt = path.basename(e.name, path.extname(e.name)).toLowerCase();
          // Search roots are ordered from the fresh raw export to curated
          // fallbacks. Keep the first exact hit so a fallback can fill a
          // missing legacy asset without ever shadowing a newly exported one.
          const setExactIfMissing = (key) => {
            if (!this.exactPathIndex.has(key)) this.exactPathIndex.set(key, full);
          };

          // Exact relative paths
          setExactIfMissing(normRel);
          const noExt = normRel.replace(/\.(png|webp)$/i, '');
          setExactIfMissing(noExt);

          // Canonical /Game/ and game/ paths
          const hottaRel = normRel.replace(/^(?:datamine\/)?shared\/media\//i, '');
          if (hottaRel.startsWith('hotta/content/')) {
            const afterHotta = hottaRel.substring('hotta/content/'.length);
            setExactIfMissing(`game/${afterHotta}`);
            setExactIfMissing(`/game/${afterHotta}`);
            setExactIfMissing(`game/${afterHotta.replace(/\.(png|webp)$/i, '')}`);
            setExactIfMissing(`/game/${afterHotta.replace(/\.(png|webp)$/i, '')}`);
            setExactIfMissing(afterHotta.replace(/\.(png|webp)$/i, ''));
            setExactIfMissing(`hotta/content/${afterHotta}`);
            setExactIfMissing(`hotta/content/${afterHotta.replace(/\.(png|webp)$/i, '')}`);
          } else if (normRel.startsWith('content/')) {
            const afterContent = normRel.substring('content/'.length);
            setExactIfMissing(`game/${afterContent}`);
            setExactIfMissing(`/game/${afterContent}`);
            setExactIfMissing(`game/${afterContent.replace(/\.(png|webp)$/i, '')}`);
            setExactIfMissing(`/game/${afterContent.replace(/\.(png|webp)$/i, '')}`);
          }

          // Multi-candidate leaf index for collision safety
          if (!this.leafIndex.has(leafNoExt)) {
            this.leafIndex.set(leafNoExt, []);
          }
          const list = this.leafIndex.get(leafNoExt);
          if (!list.includes(full)) {
            list.push(full);
          }
        } else if (e.isDirectory()) {
          if (
            nameLower === 'node_modules' ||
            nameLower === '.git' ||
            nameLower === 'temperary' ||
            nameLower === 'export-scan'
          ) {
            continue;
          }
          this._indexDirectory(full, rootDir, depth + 1);
        }
      }
    } catch {}
  }

  getFileHash(p) {
    if (this.fileHashMap.has(p)) return this.fileHashMap.get(p);
    try {
      if (fs.existsSync(p)) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        this.fileHashMap.set(p, hash);
        return hash;
      }
    } catch {}
    return null;
  }

  resolveAsset(assetRef, options: Record<string, any> = {}) {
    if (!assetRef) {
      return {
        resolved: false,
        sourceAssetRef: '',
        normalizedAssetPath: '',
        canonicalUrl: '',
        sourceFile: null,
        sourceIsWebp: false,
        matchStrategy: 'unresolved',
        collisionCount: 0,
        collisionPaths: [],
        width: null,
        height: null
      };
    }

    const refStr = typeof assetRef === 'object'
      ? (assetRef.AssetPathName || assetRef.asset_path_name || '')
      : String(assetRef);

    if (!refStr || refStr === 'None' || refStr === 'null') {
      return {
        resolved: false,
        sourceAssetRef: refStr,
        normalizedAssetPath: '',
        canonicalUrl: '',
        sourceFile: null,
        sourceIsWebp: false,
        matchStrategy: 'unresolved',
        collisionCount: 0,
        collisionPaths: [],
        width: null,
        height: null
      };
    }

    const cacheKey = `${refStr}|${options.destSubdir || ''}|${options.tab || ''}`;
    if (this.resolveCache && this.resolveCache.has(cacheKey)) {
      return this.resolveCache.get(cacheKey);
    }

    const normPkg = normalizeUnrealSoftReference(refStr);
    const canonicalRelPath = normPkg ? (normPkg.endsWith('.webp') ? normPkg : `${normPkg}.webp`) : '';
    const canonicalUrl = normPkg ? toCanonicalMediaUrl(normPkg) : '';

    let clean = refStr.trim().replace(/\\/g, '/');
    const dotIdx = clean.lastIndexOf('.');
    if (dotIdx > 0 && !clean.endsWith('.png') && !clean.endsWith('.webp')) {
      clean = clean.substring(0, dotIdx);
    }

    const leafNoExt = path.basename(clean, path.extname(clean)).toLowerCase();

    // 1. Exact game path resolution
    let relGame = clean.toLowerCase();
    if (relGame.startsWith('/game/')) relGame = relGame.substring(6);
    else if (relGame.startsWith('game/')) relGame = relGame.substring(5);
    else if (relGame.startsWith('/')) relGame = relGame.substring(1);

    const exactCandidates = [
      canonicalRelPath ? canonicalRelPath.toLowerCase() : '',
      canonicalRelPath ? canonicalRelPath.toLowerCase().replace(/\.webp$/i, '.png') : '',
      canonicalRelPath ? canonicalRelPath.toLowerCase().replace(/^hotta\/content\//i, '') : '',
      relGame,
      `${relGame}.webp`,
      `${relGame}.png`,
      `hotta/content/${relGame}`,
      `hotta/content/${relGame}.webp`,
      `hotta/content/${relGame}.png`,
      `content/${relGame}`,
      `content/${relGame}.webp`,
      `content/${relGame}.png`,
      `resources/${relGame}`,
      `resources/${relGame}.webp`,
      `resources/${relGame}.png`,
      `game/${relGame}`,
      `game/${relGame}.webp`,
      `game/${relGame}.png`,
      `/game/${relGame}`,
      `/game/${relGame}.webp`,
      `/game/${relGame}.png`
    ];

    for (const cand of exactCandidates) {
      if (this.exactPathIndex.has(cand)) {
        const full = this.exactPathIndex.get(cand);
        const isWebp = full.toLowerCase().endsWith('.webp');
        const buf = fs.existsSync(full) ? fs.readFileSync(full) : null;
        const dims = buf ? (isWebp ? getWebpDimensions(buf) : getPngDimensions(buf)) : { width: null, height: null };

        // Derive exact-case canonical path and URL from the actual file on disk if available
        let exactCanonicalUrl = canonicalUrl;
        let exactAssetPath = canonicalRelPath;
        const hottaMatch = full.replace(/\\/g, '/').match(/(Hotta\/Content\/[^\s]+)$/i);
        if (hottaMatch) {
          exactAssetPath = hottaMatch[1];
          exactCanonicalUrl = toCanonicalMediaUrl(exactAssetPath);
        }

        const result = {
          resolved: true,
          sourceAssetRef: refStr,
          normalizedAssetPath: exactAssetPath,
          canonicalUrl: exactCanonicalUrl,
          sourceFile: full,
          sourceIsWebp: isWebp,
          matchStrategy: 'exact_game_path',
          collisionCount: 0,
          collisionPaths: [],
          width: dims.width,
          height: dims.height
        };
        if (this.resolveCache) this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    // Direct filesystem check under rawDir
    if (this.rawDir) {
      for (const cand of exactCandidates) {
        const full = path.join(this.rawDir, cand);
        if (fs.existsSync(full)) {
          const isWebp = full.toLowerCase().endsWith('.webp');
          const buf = fs.readFileSync(full);
          const dims = isWebp ? getWebpDimensions(buf) : getPngDimensions(buf);
          const result = {
            resolved: true,
            sourceAssetRef: refStr,
            normalizedAssetPath: canonicalRelPath,
            canonicalUrl,
            sourceFile: full,
            sourceIsWebp: isWebp,
            matchStrategy: 'exact_game_path',
            collisionCount: 0,
            collisionPaths: [],
            width: dims.width,
            height: dims.height
          };
          if (this.resolveCache) this.resolveCache.set(cacheKey, result);
          return result;
        }
      }
    }

    // 2. Leaf fallback with collision detection
    if (this.leafIndex.has(leafNoExt)) {
      const candidates = this.leafIndex.get(leafNoExt);
      if (candidates.length === 1) {
        const full = candidates[0];
        const isWebp = full.toLowerCase().endsWith('.webp');
        const buf = fs.existsSync(full) ? fs.readFileSync(full) : null;
        const dims = buf ? (isWebp ? getWebpDimensions(buf) : getPngDimensions(buf)) : { width: null, height: null };
        const result = {
          resolved: true,
          sourceAssetRef: refStr,
          normalizedAssetPath: canonicalRelPath,
          canonicalUrl,
          sourceFile: full,
          sourceIsWebp: isWebp,
          matchStrategy: 'unique_leaf',
          collisionCount: 1,
          collisionPaths: candidates,
          width: dims.width,
          height: dims.height
        };
        if (this.resolveCache) this.resolveCache.set(cacheKey, result);
        return result;
      } else if (candidates.length > 1) {
        // Disambiguate by subpath or role
        if (options.destSubdir) {
          const subMatch = candidates.filter(c => c.replace(/\\/g, '/').toLowerCase().includes(`/${options.destSubdir.toLowerCase()}/`));
          if (subMatch.length === 1) {
            const full = subMatch[0];
            const isWebp = full.toLowerCase().endsWith('.webp');
            const buf = fs.existsSync(full) ? fs.readFileSync(full) : null;
            const dims = buf ? (isWebp ? getWebpDimensions(buf) : getPngDimensions(buf)) : { width: null, height: null };
            const result = {
              resolved: true,
              sourceAssetRef: refStr,
              normalizedAssetPath: canonicalRelPath,
              canonicalUrl,
              sourceFile: full,
              sourceIsWebp: isWebp,
              matchStrategy: 'unique_leaf',
              collisionCount: 1,
              collisionPaths: candidates,
              width: dims.width,
              height: dims.height
            };
            if (this.resolveCache) this.resolveCache.set(cacheKey, result);
            return result;
          }
        }

        // Disambiguate by canonical package candidate (Hotta/Content or rawDir)
        const canonicalCands = candidates.filter(c => {
          const norm = c.replace(/\\/g, '/').toLowerCase();
          return norm.includes('/hotta/content/') || norm.includes('/raw_exports/') || norm.includes('/temperary/');
        });
        if (canonicalCands.length === 1) {
          const full = canonicalCands[0];
          const isWebp = full.toLowerCase().endsWith('.webp');
          const buf = fs.existsSync(full) ? fs.readFileSync(full) : null;
          const dims = buf ? (isWebp ? getWebpDimensions(buf) : getPngDimensions(buf)) : { width: null, height: null };
          const result = {
            resolved: true,
            sourceAssetRef: refStr,
            normalizedAssetPath: canonicalRelPath,
            canonicalUrl,
            sourceFile: full,
            sourceIsWebp: isWebp,
            matchStrategy: 'unique_leaf',
            collisionCount: 1,
            collisionPaths: candidates,
            width: dims.width,
            height: dims.height
          };
          if (this.resolveCache) this.resolveCache.set(cacheKey, result);
          return result;
        }

        // Check if all candidates have identical content hashes
        const hashes = new Set<any>();
        for (const cand of candidates) {
          const h = this.getFileHash(cand);
          if (h) hashes.add(h);
        }
        if (hashes.size === 1) {
          const full = candidates[0];
          const isWebp = full.toLowerCase().endsWith('.webp');
          const buf = fs.existsSync(full) ? fs.readFileSync(full) : null;
          const dims = buf ? (isWebp ? getWebpDimensions(buf) : getPngDimensions(buf)) : { width: null, height: null };
          const result = {
            resolved: true,
            sourceAssetRef: refStr,
            normalizedAssetPath: canonicalRelPath,
            canonicalUrl,
            sourceFile: full,
            sourceIsWebp: isWebp,
            matchStrategy: 'unique_leaf',
            collisionCount: 1,
            collisionPaths: candidates,
            width: dims.width,
            height: dims.height
          };
          if (this.resolveCache) this.resolveCache.set(cacheKey, result);
          return result;
        }

        this.collisionLogs.push({
          assetRef: refStr,
          leafName: leafNoExt,
          collisionCount: candidates.length,
          candidates
        });

        const result = {
          resolved: false,
          sourceAssetRef: refStr,
          normalizedAssetPath: canonicalRelPath,
          canonicalUrl: '',
          sourceFile: null,
          sourceIsWebp: false,
          matchStrategy: 'collision_rejected',
          collisionCount: candidates.length,
          collisionPaths: candidates,
          width: null,
          height: null
        };
        if (this.resolveCache) this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    const result = {
      resolved: false,
      sourceAssetRef: refStr,
      normalizedAssetPath: canonicalRelPath,
      canonicalUrl: '',
      sourceFile: null,
      sourceIsWebp: false,
      matchStrategy: 'unresolved',
      collisionCount: 0,
      collisionPaths: [],
      width: null,
      height: null
    };
    if (this.resolveCache) this.resolveCache.set(cacheKey, result);
    return result;
  }

  resolveSourcePng(assetRef) {
    const res = this.resolveAsset(assetRef);
    return res.resolved ? res.sourceFile : null;
  }

  copyAsset(tab, assetRef, destSubdir = '', options: Record<string, any> = {}) {
    if (!assetRef) return null;
    const res = this.resolveAsset(assetRef, { ...options, destSubdir, tab });
    if (!res.resolved || !res.sourceFile) {
      const refStr = typeof assetRef === 'object' ? (assetRef.AssetPathName || '') : String(assetRef);
      if (refStr && refStr !== 'None' && refStr !== 'null') {
        this.missingAssets.push({ tab, assetRef: refStr, strategy: res.matchStrategy });
      }
      return null;
    }

    const srcFile = res.sourceFile;
    const normPkg = normalizeUnrealSoftReference(res.sourceAssetRef);
    const relWebp = res.normalizedAssetPath || (normPkg ? (normPkg.endsWith('.webp') ? normPkg : `${normPkg}.webp`) : (path.basename(srcFile, path.extname(srcFile)) + '.webp'));
    const relPng = relWebp.replace(/\.webp$/i, '.png');
    const relThumbWebp = relWebp.replace(/\.webp$/i, '.thumb.webp');
    const publicUrl = res.canonicalUrl || toCanonicalMediaUrl(relWebp);
    const isFceDownload = (tab === 'fce') && isFceBossDownloadAsset(relWebp) && options.preservePng !== false;
    const thumbnailOptions = options.thumbnail && typeof options.thumbnail === 'object'
      ? options.thumbnail
      : null;
    const thumbPublicUrl = thumbnailOptions
      ? publicUrl.replace(/\.webp$/i, '.thumb.webp')
      : publicUrl;
    const sharedMediaDirs = [path.join(this.projectRoot, 'datamine', 'shared', 'media')];

    if (!this.copyCache.has(relWebp)) {
      let destWebpDisk = null;
      let destPngDisk = null;

      for (const mediaDir of sharedMediaDirs) {
        const targetWebp = path.join(mediaDir, relWebp);
        const targetPng = path.join(mediaDir, relPng);
        const targetDir = path.dirname(targetWebp);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        if (res.sourceIsWebp) {
          const sourceIsTarget = path.resolve(srcFile).toLowerCase() === path.resolve(targetWebp).toLowerCase();
          if (!sourceIsTarget) {
            fs.copyFileSync(srcFile, targetWebp);
          }
          // The UI source may already be WebP while the fresh export also
          // contains the original PNG. Preserve that exact sibling only for
          // explicitly requested FCE download assets.
          if (isFceDownload && !fs.existsSync(targetPng)) {
            const indexedPng = this.exactPathIndex.get(relPng.toLowerCase());
            if (indexedPng && fs.existsSync(indexedPng)) {
              const pngIsTarget = path.resolve(indexedPng).toLowerCase() === path.resolve(targetPng).toLowerCase();
              if (!pngIsTarget) fs.copyFileSync(indexedPng, targetPng);
            }
          }
        } else {
          // Source is PNG: convert to lossless WebP
          const sourceIsTarget = path.resolve(srcFile).toLowerCase() === path.resolve(targetPng).toLowerCase();
          if (!sourceIsTarget || !fs.existsSync(targetWebp)) {
            generateWebp(srcFile, targetWebp, { lossless: true, quality: 100 });
          }
          // If FCE boss, also copy the PNG sibling for download
          if (isFceDownload && !sourceIsTarget) {
            fs.copyFileSync(srcFile, targetPng);
          }
        }

        if (!destWebpDisk && fs.existsSync(targetWebp)) destWebpDisk = targetWebp;
        if (!destPngDisk && fs.existsSync(targetPng)) destPngDisk = targetPng;
      }

      const webpBytes = destWebpDisk && fs.existsSync(destWebpDisk) ? fs.statSync(destWebpDisk).size : 0;
      const pngBytes = destPngDisk && fs.existsSync(destPngDisk) ? fs.statSync(destPngDisk).size : 0;

      this.copyCache.set(relWebp, {
        webpBytes,
        pngBytes: isFceDownload ? pngBytes : 0
      });
    }

    if (thumbnailOptions) {
      const maxDimension = Number(thumbnailOptions.maxDimension) || 96;
      const quality = Number(thumbnailOptions.quality) || 82;
      for (const mediaDir of sharedMediaDirs) {
        const targetWebp = path.join(mediaDir, relWebp);
        const targetThumb = path.join(mediaDir, relThumbWebp);
        fs.mkdirSync(path.dirname(targetThumb), { recursive: true });
        if (!fs.existsSync(targetThumb) || options.forceThumbnail === true) {
          const generated = generateWebp(srcFile, targetThumb, {
            lossless: false,
            quality,
            maxDimension
          });
          // Keep the media contract usable on systems without ffmpeg. The
          // fallback is the unchanged full WebP; ffmpeg-enabled exports always
          // produce the requested 96px/q82 thumbnail.
          if (!generated && fs.existsSync(targetWebp)) {
            fs.copyFileSync(targetWebp, targetThumb);
          }
        }
      }
    }

    const cachedCopy = this.copyCache.get(relWebp);

    // Update shared registry
    if (!this.sharedRegistry.has(relWebp)) {
      this.sharedRegistry.set(relWebp, {
        sourceAssetRef: res.sourceAssetRef,
        relativePackagePath: relWebp,
        publicUrl,
        thumbWebpUrl: thumbnailOptions ? thumbPublicUrl : null,
        fcePngDownloadUrl: isFceDownload && cachedCopy.pngBytes > 0 ? publicUrl.replace(/\.webp$/i, '.png') : null,
        mediaRole: isFceDownload ? 'fce_boss_download' : (destSubdir || 'general'),
        sourceFile: srcFile,
        webpBytes: cachedCopy.webpBytes,
        pngBytes: cachedCopy.pngBytes,
        width: res.width,
        height: res.height,
        provenanceReferences: []
      });
    }

    const regEntry = this.sharedRegistry.get(relWebp);
    const provRef = {
      tab: tab || 'unknown',
      role: destSubdir || 'general',
      entityId: options.entityId || ''
    };
    if (!regEntry.provenanceReferences.some(p => p.tab === provRef.tab && p.role === provRef.role && p.entityId === provRef.entityId)) {
      regEntry.provenanceReferences.push(provRef);
    }

    this.stats[tab] = (this.stats[tab] || 0) + 1;

    if (options.structured) {
      return {
        sourceAssetRef: res.sourceAssetRef,
        normalizedAssetPath: relWebp,
        canonicalId: relWebp,
        publicUrl,
        preferredFull: publicUrl,
        preferredThumb: thumbPublicUrl,
        preferredFullFormat: 'webp',
        preferredThumbFormat: 'webp',
        fallbackFull: publicUrl,
        fallbackThumb: thumbPublicUrl,
        full: publicUrl,
        thumb: thumbPublicUrl,
        fullWebp: publicUrl,
        thumbWebp: thumbPublicUrl,
        matchStrategy: res.matchStrategy,
        fcePngDownloadUrl: (tab === 'fce' && isFceDownload && cachedCopy.pngBytes > 0) ? publicUrl.replace(/\.webp$/i, '.png') : null,
        width: res.width,
        height: res.height
      };
    }

    return publicUrl;
  }

  saveSharedManifest(customOutPath = null) {
    const defaultOut = path.join(this.projectRoot, 'datamine', 'shared-data', 'shared-media-manifest.json');
    const outPath = customOutPath || defaultOut;
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const assetsObj: Record<string, any> = {};
    for (const [id, rec] of this.sharedRegistry.entries()) {
      assetsObj[id] = rec;
    }

    const manifest = {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalAssets: this.sharedRegistry.size,
      totalProvenanceReferences: Array.from(this.sharedRegistry.values()).reduce((sum, r) => sum + r.provenanceReferences.length, 0),
      assets: assetsObj
    };

    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');

    return manifest;
  }

  getStats() {
    return this.stats;
  }

  getMissingAssets() {
    return this.missingAssets;
  }

  getCollisions() {
    return this.collisionLogs;
  }

  getSharedRegistry() {
    return this.sharedRegistry;
  }
}

export default ImageCopier;
export { getPngDimensions, getWebpDimensions, createThumbnail, generateWebp, parsePng, encodePng, normalizeAssetPath, toCanonicalMediaUrl };

