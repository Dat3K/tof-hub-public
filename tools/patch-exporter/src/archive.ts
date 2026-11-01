import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const deflateRaw = promisify(zlib.deflateRaw);

/** Already-compressed formats: deflating them again only costs CPU. */
const STORED_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.zip', '.gz', '.br', '.mp4', '.webm', '.woff2']);

const ZIP64_LIMIT = 0xffffffff;
const ZIP64_ENTRY_LIMIT = 0xffff;

export interface ArchiveEntry {
  /** Absolute source path on disk. */
  readonly source: string;
  /** Forward-slash path inside the archive. */
  readonly name: string;
}

export interface ArchiveOptions {
  /** Parallel compression jobs. Defaults to the logical CPU count. */
  readonly jobs?: number;
  /** Deflate level for compressible files (1 fastest .. 9 smallest). */
  readonly level?: number;
  readonly onProgress?: (completed: number, total: number) => void;
}

export interface ArchiveResult {
  readonly entries: number;
  readonly bytesIn: number;
  readonly bytesOut: number;
  readonly durationMs: number;
}

interface PreparedEntry {
  readonly name: Buffer;
  readonly data: Buffer;
  readonly method: 0 | 8;
  readonly crc: number;
  readonly size: number;
  readonly mtime: Date;
}

interface CentralRecord extends Omit<PreparedEntry, 'data'> {
  readonly compressedSize: number;
  readonly offset: number;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function prepare(entry: ArchiveEntry, level: number): Promise<PreparedEntry> {
  const raw = await fs.promises.readFile(entry.source);
  const stat = await fs.promises.stat(entry.source);
  const crc = zlib.crc32(raw);
  const stored = STORED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) || raw.length === 0;
  let data = raw;
  let method: 0 | 8 = 0;
  if (!stored) {
    const compressed = await deflateRaw(raw, { level });
    if (compressed.length < raw.length) {
      data = compressed;
      method = 8;
    }
  }
  return { name: Buffer.from(entry.name, 'utf8'), data, method, crc, size: raw.length, mtime: stat.mtime };
}

function localHeader(entry: PreparedEntry, offset: number): Buffer {
  const zip64 = entry.size >= ZIP64_LIMIT || entry.data.length >= ZIP64_LIMIT || offset >= ZIP64_LIMIT;
  const extra = zip64 ? Buffer.alloc(20) : Buffer.alloc(0);
  if (zip64) {
    extra.writeUInt16LE(0x0001, 0);
    extra.writeUInt16LE(16, 2);
    extra.writeBigUInt64LE(BigInt(entry.size), 4);
    extra.writeBigUInt64LE(BigInt(entry.data.length), 12);
  }
  const header = Buffer.alloc(30);
  const { time, date } = dosDateTime(entry.mtime);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(zip64 ? 45 : 20, 4);
  header.writeUInt16LE(0x0800, 6); // UTF-8 names
  header.writeUInt16LE(entry.method, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(entry.crc >>> 0, 14);
  header.writeUInt32LE(zip64 ? ZIP64_LIMIT : entry.data.length, 18);
  header.writeUInt32LE(zip64 ? ZIP64_LIMIT : entry.size, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(extra.length, 28);
  return Buffer.concat([header, entry.name, extra]);
}

function centralHeader(record: CentralRecord): Buffer {
  const zip64Fields: bigint[] = [];
  if (record.size >= ZIP64_LIMIT) zip64Fields.push(BigInt(record.size));
  if (record.compressedSize >= ZIP64_LIMIT) zip64Fields.push(BigInt(record.compressedSize));
  if (record.offset >= ZIP64_LIMIT) zip64Fields.push(BigInt(record.offset));
  const extra = zip64Fields.length ? Buffer.alloc(4 + zip64Fields.length * 8) : Buffer.alloc(0);
  if (zip64Fields.length) {
    extra.writeUInt16LE(0x0001, 0);
    extra.writeUInt16LE(zip64Fields.length * 8, 2);
    zip64Fields.forEach((value, index) => extra.writeBigUInt64LE(value, 4 + index * 8));
  }
  const header = Buffer.alloc(46);
  const { time, date } = dosDateTime(record.mtime);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(zip64Fields.length ? 45 : 20, 4);
  header.writeUInt16LE(zip64Fields.length ? 45 : 20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(record.method, 10);
  header.writeUInt16LE(time, 12);
  header.writeUInt16LE(date, 14);
  header.writeUInt32LE(record.crc >>> 0, 16);
  header.writeUInt32LE(Math.min(record.compressedSize, ZIP64_LIMIT), 20);
  header.writeUInt32LE(Math.min(record.size, ZIP64_LIMIT), 24);
  header.writeUInt16LE(record.name.length, 28);
  header.writeUInt16LE(extra.length, 30);
  header.writeUInt32LE(Math.min(record.offset, ZIP64_LIMIT), 42);
  return Buffer.concat([header, record.name, extra]);
}

function endRecords(count: number, centralOffset: number, centralSize: number): Buffer {
  const parts: Buffer[] = [];
  const zip64 = count >= ZIP64_ENTRY_LIMIT || centralOffset >= ZIP64_LIMIT || centralSize >= ZIP64_LIMIT;
  if (zip64) {
    const record = Buffer.alloc(56);
    record.writeUInt32LE(0x06064b50, 0);
    record.writeBigUInt64LE(44n, 4);
    record.writeUInt16LE(45, 12);
    record.writeUInt16LE(45, 14);
    record.writeBigUInt64LE(BigInt(count), 24);
    record.writeBigUInt64LE(BigInt(count), 32);
    record.writeBigUInt64LE(BigInt(centralSize), 40);
    record.writeBigUInt64LE(BigInt(centralOffset), 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeBigUInt64LE(BigInt(centralOffset + centralSize), 8);
    locator.writeUInt32LE(1, 16);
    parts.push(record, locator);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Math.min(count, ZIP64_ENTRY_LIMIT), 8);
  end.writeUInt16LE(Math.min(count, ZIP64_ENTRY_LIMIT), 10);
  end.writeUInt32LE(Math.min(centralSize, ZIP64_LIMIT), 12);
  end.writeUInt32LE(Math.min(centralOffset, ZIP64_LIMIT), 16);
  parts.push(end);
  return Buffer.concat(parts);
}

/**
 * Writes a ZIP archive. Files are read and deflated concurrently (libuv thread
 * pool, so UV_THREADPOOL_SIZE should match the core count), while the archive
 * itself is written sequentially in input order. Images are stored as-is.
 */
export async function writeZipArchive(
  outputFile: string,
  entries: readonly ArchiveEntry[],
  options: ArchiveOptions = {}
): Promise<ArchiveResult> {
  const startedAt = Date.now();
  const cpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const jobs = Math.max(1, Math.floor(options.jobs ?? cpus));
  const level = options.level ?? 6;
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  const partial = `${outputFile}.partial`;
  const handle = await fs.promises.open(partial, 'w');
  const central: CentralRecord[] = [];
  let offset = 0;
  let bytesIn = 0;
  // Coalesce small headers and files into large sequential writes.
  let buffered: Buffer[] = [];
  let bufferedBytes = 0;
  const flush = async () => {
    if (!bufferedBytes) return;
    await handle.write(buffered.length === 1 ? buffered[0] : Buffer.concat(buffered, bufferedBytes));
    buffered = [];
    bufferedBytes = 0;
  };
  const write = async (chunk: Buffer) => {
    buffered.push(chunk);
    bufferedBytes += chunk.length;
    if (bufferedBytes >= 8 * 1024 * 1024) await flush();
  };
  try {
    // A bounded look-ahead keeps memory flat while every core stays busy.
    const window = jobs * 4;
    const pending = new Map<number, Promise<PreparedEntry>>();
    let scheduled = 0;
    const schedule = () => {
      while (scheduled < entries.length && pending.size < window) {
        pending.set(scheduled, prepare(entries[scheduled], level));
        scheduled++;
      }
    };
    for (let index = 0; index < entries.length; index++) {
      schedule();
      const entry = await pending.get(index)!;
      pending.delete(index);
      const header = localHeader(entry, offset);
      await write(header);
      await write(entry.data);
      central.push({ name: entry.name, method: entry.method, crc: entry.crc, size: entry.size, mtime: entry.mtime, compressedSize: entry.data.length, offset });
      offset += header.length + entry.data.length;
      bytesIn += entry.size;
      options.onProgress?.(index + 1, entries.length);
    }
    const centralOffset = offset;
    let centralSize = 0;
    for (const record of central) {
      const header = centralHeader(record);
      await write(header);
      centralSize += header.length;
    }
    await write(endRecords(central.length, centralOffset, centralSize));
    await flush();
  } finally {
    await handle.close();
  }
  fs.renameSync(partial, outputFile);
  return { entries: central.length, bytesIn, bytesOut: fs.statSync(outputFile).size, durationMs: Date.now() - startedAt };
}

/** Lists every file below `root` as archive entries named `prefix + relative path`. */
export function collectArchiveEntries(root: string, prefix = ''): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const walk = (directory: string) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.isFile()) entries.push({ source: full, name: prefix + path.relative(root, full).split(path.sep).join('/') });
    }
  };
  if (fs.existsSync(root)) walk(root);
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
