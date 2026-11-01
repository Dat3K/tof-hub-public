import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLauncherVersion, readLauncherConfigZip } from './launcher-version-source';
import type { TrackedBranch } from '@tof-hub/contracts';

// Minimal stored ZIP with a central directory, independent of the reader implementation.
function zipConfig(value: unknown) {
  const name = Buffer.from('PatcherConfig.json'), body = Buffer.from(JSON.stringify(value));
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + body.length, 16);
  return Buffer.concat([local, name, body, central, name, end]);
}
const source: TrackedBranch = {id: 'fixture', label: 'Fixture', branch: 'AdvLaunch52', sourceUrl: 'https://htcdn1.wmupd.com/clientRes/AdvLaunch52/Version/Windows/config.xml',
  version: null, changedAt: null, checkedAt: null, attemptedAt: null, error: false, history: [],
  launcher: {appId: '1256', versionUrls: ['https://htcdn2.wmupd.com/hd/AdvLaunch30/launcher/Version.ini', 'https://htcdn1.wmupd.com/hd/AdvLaunch30/launcher/Version.ini'], resourceBases: ['https://htcdn2.wmupd.com/clientRes', 'https://htcdn1.wmupd.com/clientRes']}};
afterEach(() => vi.unstubAllGlobals());

describe('Rotating official launcher sources', () => {
  it('follows launcher config to a future branch instead of querying the obsolete archive branch', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url);
      if (url.endsWith('Version.ini')) return new Response('[VERSION]\nVersion=1.2.3.4\nFileListURL=https://htcdn1.wmupd.com/hd/AdvLaunch30/launcher/current/AllFiles.xml');
      if (url.endsWith('.zip')) return new Response(new Uint8Array(zipConfig({branchName: 'AdvLaunch99', appId: '1256'})));
      if (url.includes('/AdvLaunch99/')) return new Response('<ResVersion>9.9.1</ResVersion>');
      throw new Error('Unexpected old branch request');
    }));
    await expect(resolveLauncherVersion(source)).resolves.toMatchObject({resourceBranch: 'AdvLaunch99', version: '9.9.1', launcherVersion: '1.2.3.4'});
    expect(urls.some((url) => url.includes('AdvLaunch52'))).toBe(false);
  });
  it('uses a healthy official mirror when the other one fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('htcdn2')) throw new Error('Mirror unavailable');
      if (url.endsWith('Version.ini')) return new Response('Version=1.2.3.4\nFileListURL=https://htcdn2.wmupd.com/hd/AdvLaunch30/launcher/current/AllFiles.xml');
      if (url.endsWith('.zip')) return new Response(new Uint8Array(zipConfig({branchName: 'AdvLaunch65', appId: '1256'})));
      return new Response('<ResVersion>6.5.0</ResVersion>');
    }));
    await expect(resolveLauncherVersion(source)).resolves.toMatchObject({resourceBranch: 'AdvLaunch65', version: '6.5.0'});
  });
  it('fails closed on malformed metadata and does not use a still-responsive old branch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Version=1.2.3\nFileListURL=https://untrusted.example/AllFiles.xml')));
    await expect(resolveLauncherVersion(source)).rejects.toThrow();
    expect(() => readLauncherConfigZip(Buffer.from('not a zip'))).toThrow();
    expect(() => readLauncherConfigZip(zipConfig({branchName: 'test'}).subarray(0, 20))).toThrow();
  });
});
