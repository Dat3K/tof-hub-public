import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WishAccessService } from '../wish-access.service';

const PROFILE = 'import-0123456789abcdef0123456789abcdef';

function tmpStore(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wish-access-'));
  return path.join(dir, 'access.json');
}

describe('WishAccessService', () => {
  it('denies strangers, allows importer IP and device tokens', () => {
    const access = new WishAccessService(tmpStore());
    expect(access.checkAccess(PROFILE, { ip: '192.0.2.1' })).toBe(false);

    const first = access.grantImporterAccess(PROFILE, '192.0.2.1');
    expect(first).toMatch(/^wtk_[a-f0-9]{48}$/);
    expect(access.checkAccess(PROFILE, { ip: '192.0.2.1' })).toBe(true);
    expect(access.checkAccess(PROFILE, { token: first!, ip: '192.0.2.2' })).toBe(true);
    // Token use learns the new IP (second device on another network).
    expect(access.checkAccess(PROFILE, { ip: '192.0.2.2' })).toBe(true);
    expect(access.checkAccess(PROFILE, { ip: '192.0.2.3' })).toBe(false);

    // Update imports note the new IP but mint no extra token.
    expect(access.grantImporterAccess(PROFILE, '192.0.2.3')).toBeNull();
    expect(access.checkAccess(PROFILE, { ip: '192.0.2.3' })).toBe(true);

    const second = access.issueDeviceToken(PROFILE, 'phone');
    expect(second).not.toBe(first);
    expect(access.checkAccess(PROFILE, { token: second, ip: '192.0.2.9' })).toBe(true);
  });

  it('revokes tokens and clears IP grants', () => {
    const access = new WishAccessService(tmpStore());
    const first = access.grantImporterAccess(PROFILE, '192.0.2.1')!;
    const second = access.issueDeviceToken(PROFILE, 'phone');

    expect(access.revokeToken(PROFILE, 'wtk_wrong')).toBe(false);
    expect(access.revokeToken(PROFILE, first)).toBe(true);
    expect(access.checkAccess(PROFILE, { token: first, ip: '192.0.2.8' })).toBe(false);
    expect(access.checkAccess(PROFILE, { token: second, ip: '192.0.2.8' })).toBe(true);
    // Unknown IPs never authorized revocation-only state: known IP still works.
    expect(access.checkAccess(PROFILE, { ip: '192.0.2.1' })).toBe(true);

    access.clearIps(PROFILE);
    // Token access survives IP clearing (IP change case).
    expect(access.checkAccess(PROFILE, { token: second, ip: '192.0.2.8' })).toBe(true);
    expect(access.checkAccess(PROFILE, { ip: '192.0.2.1' })).toBe(false);
  });

  it('persists grants across restarts and rejects corrupt stores', () => {
    const store = tmpStore();
    const first = new WishAccessService(store);
    const token = first.grantImporterAccess(PROFILE, '192.0.2.1')!;

    const second = new WishAccessService(store);
    expect(second.checkAccess(PROFILE, { ip: '192.0.2.1' })).toBe(true);
    expect(second.checkAccess(PROFILE, { token, ip: '192.0.2.5' })).toBe(true);

    fs.writeFileSync(store, '{broken');
    expect(() => new WishAccessService(store)).toThrow();
  });
});
