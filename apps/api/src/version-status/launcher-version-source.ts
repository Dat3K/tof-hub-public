import { inflateRawSync } from 'node:zlib';
import { parseResVersion, type TrackedBranch } from '@tof-hub/contracts';

const LIMIT = 2 * 1024 * 1024;

/** Small, bounded JSON member of the official launcher ZIP; never extracts files to disk. */
export function readLauncherConfigZip(bytes: Buffer): unknown {
  // Use the central directory: official ZIPs may have a data descriptor after their payload.
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) if (bytes.readUInt32LE(end) === 0x06054b50) break;
  if (end < 0 || bytes.length < 22 || bytes.readUInt32LE(end) !== 0x06054b50) throw new Error('Invalid launcher ZIP');
  const entries = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extra + comment;
    if (name !== 'PatcherConfig.json' && !name.endsWith('/PatcherConfig.json')) continue;
    if (size > LIMIT || compressed > LIMIT || local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid launcher config member');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressed > bytes.length) throw new Error('Truncated launcher config');
    const data = bytes.subarray(start, start + compressed);
    const content = method === 0 ? data : method === 8 ? inflateRawSync(data, {maxOutputLength: LIMIT}) : null;
    if (!content || content.length !== size) throw new Error('Invalid launcher config compression');
    return JSON.parse(content.toString('utf8').replace(/^\uFEFF/, ''));
  }
  throw new Error('Launcher config member missing');
}

async function read(url: string, signal: AbortSignal): Promise<Buffer> {
  const response = await fetch(url, {signal, redirect: 'error'});
  if (!response.ok || !response.body) throw new Error('Launcher source unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > LIMIT) throw new Error('Launcher source too large');
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

export interface LauncherObservation { version: string; resourceBranch: string; sourceUrl: string; launcherVersion: string | null }

/** Resolves stable launcher metadata before reading a rotating resource branch. Never scans branch numbers. */
export async function resolveLauncherVersion(source: TrackedBranch): Promise<LauncherObservation> {
  if (!source.launcher) return {version: parseResVersion((await read(source.sourceUrl, AbortSignal.timeout(5000))).toString('utf8')), resourceBranch: source.branch, sourceUrl: source.sourceUrl, launcherVersion: null};
  const launcher = source.launcher;
  const allowedHosts = new Set([...launcher.versionUrls, ...launcher.resourceBases].map((url) => new URL(url).hostname));
  // Start mirror chains together; a slow primary does not hide a healthy backup.
  return Promise.any(launcher.versionUrls.map(async (versionUrl) => {
    const signal = AbortSignal.timeout(8000);
    const ini = (await read(versionUrl, signal)).toString('utf8');
    const launcherVersion = ini.match(/^Version\s*=\s*([\d.]+)\s*$/mi)?.[1];
    const list = ini.match(/^FileListURL\s*=\s*(\S+)\s*$/mi)?.[1];
    if (!launcherVersion || !list) throw new Error('Incomplete launcher metadata');
    const fileList = new URL(list);
    if (fileList.protocol !== 'https:' || !allowedHosts.has(fileList.hostname) || fileList.username || fileList.password || fileList.port) throw new Error('Unexpected launcher metadata host');
    // Use the mirror that served Version.ini, even when its FileListURL names the other CDN.
    fileList.hostname = new URL(versionUrl).hostname;
    const zipUrl = new URL(`ResFilesM/${encodeURIComponent(launcher.appId)}/PatcherConfig/PatcherConfig.json.zip`, fileList);
    const config = readLauncherConfigZip(await read(zipUrl.href, signal)) as {branchName?: unknown; appId?: unknown};
    if (typeof config.branchName !== 'string' || !/^[A-Za-z0-9_-]+$/.test(config.branchName) || String(config.appId) !== launcher.appId) throw new Error('Invalid launcher branch config');
    const resourceBranch = config.branchName;
    const selectedBase = launcher.resourceBases.find((base) => new URL(base).hostname === fileList.hostname) ?? launcher.resourceBases[0];
    const sourceUrl = `${selectedBase}/${resourceBranch}/Version/Windows/config.xml`;
    const version = parseResVersion((await read(sourceUrl, signal)).toString('utf8'));
    return {version, resourceBranch, sourceUrl, launcherVersion};
  }));
}
