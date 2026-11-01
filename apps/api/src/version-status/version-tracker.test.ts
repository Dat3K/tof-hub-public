import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { VersionTrackerService } from './version-tracker.service';
import type { TrackedBranch } from '@tof-hub/contracts';
import * as launcherSource from './launcher-version-source';

const source: TrackedBranch = {id: 'test', label: 'Test', branch: 'Test', sourceUrl: 'https://example.com/version.xml', version: null, changedAt: null, checkedAt: null, attemptedAt: null, error: false, history: []};

function fixture(version: string | null) {
  const row = {id: 'test', version, resourceBranch: 'Test', launcherVersion: null as string | null, changedAt: new Date('2026-01-01T00:00:00Z'), checkedAt: null as Date | null, attemptedAt: null as Date | null, error: false};
  const events: unknown[] = [];
  const tx = {$executeRaw: vi.fn(), gameVersionBranch: {
    findUniqueOrThrow: vi.fn(async () => row),
    update: vi.fn(async ({data}) => Object.assign(row, data)),
  }, gameVersionEvent: {create: vi.fn(async ({data}) => events.push(data))}};
  const prisma = {$transaction: vi.fn(async (fn) => fn(tx))} as unknown as PrismaClient;
  return {service: new VersionTrackerService(prisma), row, events, tx};
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Persistent launcher observations', () => {
  it('records a resource-branch change even when its version string is unchanged', async () => {
    const {service, row, events} = fixture('1.2.3');
    vi.spyOn(launcherSource, 'resolveLauncherVersion').mockResolvedValue({version: '1.2.3', resourceBranch: 'NextBranch', sourceUrl: 'https://example.com/next.xml', launcherVersion: '2.0.0'});
    await service.checkBranch(source);
    expect(row.resourceBranch).toBe('NextBranch');
    expect(events).toEqual([expect.objectContaining({version: '1.2.3', resourceBranch: 'NextBranch', launcherVersion: '2.0.0'})]);
    const date = row.changedAt;
    row.attemptedAt = null;
    await service.checkBranch(source);
    expect(events).toHaveLength(1);
    expect(row.changedAt).toBe(date);
  });
  it('does not reset the update date for an unchanged version; replicas skip recent attempts', async () => {
    const {service, row, events} = fixture('1.2.3');
    const fetcher = vi.fn(async () => new Response('<ResVersion>1.2.3</ResVersion>'));
    vi.stubGlobal('fetch', fetcher);
    await service.checkBranch(source);
    await service.checkBranch(source);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(row.changedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(row.checkedAt).toBeInstanceOf(Date);
    expect(events).toHaveLength(0);
  });
  it('records version rollback as a new event', async () => {
    const {service, row, events} = fixture('1.2.3');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<Version>1.2.2</Version>')));
    await service.checkBranch(source);
    expect(row.version).toBe('1.2.2');
    expect(events).toEqual([expect.objectContaining({version: '1.2.2', precision: 'instant', origin: 'monitor'})]);
  });
  it('retains the last known version and success timestamp when XML is malformed', async () => {
    const {service, row, events} = fixture('1.2.3');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>unavailable</html>')));
    await service.checkBranch(source);
    expect(row.version).toBe('1.2.3');
    expect(row.checkedAt).toBeNull();
    expect(row.error).toBe(true);
    expect(events).toHaveLength(0);
  });
  it('returns an explicit unavailable response without a database', async () => {
    await expect(new VersionTrackerService(null).getTracker()).rejects.toThrow('requires PostgreSQL');
  });
});
