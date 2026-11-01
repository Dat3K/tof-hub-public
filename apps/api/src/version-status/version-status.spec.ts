import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionStatusService } from './version-status.service';
import { VersionStatusController } from './version-status.controller';
import { VersionTrackerService } from './version-tracker.service';
import type { ReleaseManifest } from '@tof-hub/contracts';

describe('VersionStatus (NestJS Service & Controller)', () => {
  let service: VersionStatusService;
  let controller: VersionStatusController;

  const mockManifest: ReleaseManifest = {
    schemaVersion: 1,
    gameVersion: '6.3.14',
    generatedAt: '2026-09-18T16:06:02.562Z',
    exporterVersion: '1.0.0',
    locales: ['en', 'ru'],
    assets: { png: true, webp: true },
    snapshot: {
      version: '6.3.14',
      exportedAt: '2026-09-05T08:02:13.567Z',
      sources: [
        {
          client: 'Korea Dev 1',
          branch: 'TestPC_KR2New',
          clientRu: 'Корея Dev 1',
          appVersion: '3.0.0',
          hash: '100a25',
        },
      ],
    },
    clientVersions: {
      global: {
        version: '6.2.0',
        lastChanged: '2026-08-21T08:55:33.877Z',
        lastChangedFormatted: '21.08.2026',
      },
    },
    build: {
      builtAt: '2026-09-10T16:59:49.628Z',
      status: 'fresh-success',
    },
  };

  beforeEach(() => {
    service = new VersionStatusService();
    controller = new VersionStatusController(service, new VersionTrackerService(null));
    service._resetCache();
    vi.restoreAllMocks();
  });

  it('evaluates current/up-to-date status when dataset is newer than or equal to Global (equal/newer)', async () => {
    vi.spyOn(service, 'loadManifest').mockReturnValue(mockManifest);
    vi.spyOn(service, 'getLiveGlobalVersion').mockResolvedValue({
      version: '6.2.0',
      checkedAt: '2026-09-18T12:00:00.000Z',
      source: 'Tower of Fantasy Global launcher',
    });

    const status = await controller.getStatus();
    expect(status.state).toBe('current');
    expect(status.datasetVersion).toBe('6.3.14');
    expect(status.globalVersion).toBe('6.2.0');
    expect(status.isCurrent).toBe(true);
    expect(status.updateAvailable).toBe(false);
    expect(status.formattedExportDate.en).toBe('5 Sep 2026');
    expect(status.formattedExportDate.ru).toBe('5 сентября 2026');
    expect(status.sourceBranch.en).toBe('Korea Dev 1 — TestPC_KR2New');
    expect(status.sourceBranch.ru).toBe('Корея Dev 1 — TestPC_KR2New');
  });

  it('evaluates outdated status when live Global is strictly newer than dataset', async () => {
    const outdatedManifest: ReleaseManifest = {
      ...mockManifest,
      snapshot: {
        ...mockManifest.snapshot,
        version: '6.3.0',
      },
    };

    vi.spyOn(service, 'loadManifest').mockReturnValue(outdatedManifest);
    vi.spyOn(service, 'getLiveGlobalVersion').mockResolvedValue({
      version: '6.4.0',
      checkedAt: '2026-09-18T12:00:00.000Z',
      source: 'Tower of Fantasy Global launcher',
    });

    const status = await controller.getStatus();
    expect(status.state).toBe('outdated');
    expect(status.datasetVersion).toBe('6.3.0');
    expect(status.globalVersion).toBe('6.4.0');
    expect(status.isCurrent).toBe(false);
    expect(status.updateAvailable).toBe(true);
  });

  it('evaluates unavailable status when dataset version or manifest is missing', async () => {
    vi.spyOn(service, 'loadManifest').mockReturnValue(null);
    vi.spyOn(service, 'getLiveGlobalVersion').mockResolvedValue({
      version: '6.2.0',
      checkedAt: '2026-09-18T12:00:00.000Z',
      source: 'Tower of Fantasy Global launcher',
    });

    const status = await controller.getStatus();
    expect(status.state).toBe('unavailable');
    expect(status.datasetVersion).toBeNull();
    expect(status.isCurrent).toBeNull();
    expect(status.updateAvailable).toBe(false);
  });

  it('evaluates unavailable status when Global version cannot be resolved', async () => {
    const brokenManifest: ReleaseManifest = {
      ...mockManifest,
      clientVersions: undefined,
    };

    vi.spyOn(service, 'loadManifest').mockReturnValue(brokenManifest);
    vi.spyOn(service, 'getLiveGlobalVersion').mockRejectedValue(
      new Error('Network error and no fallback')
    );

    const status = await controller.getStatus();
    expect(status.state).toBe('unavailable');
    expect(status.globalVersion).toBeNull();
    expect(status.isCurrent).toBeNull();
    expect(status.updateAvailable).toBe(false);
  });

  it('falls back to manifest clientVersions.global when live fetch fails', async () => {
    vi.spyOn(service, 'loadManifest').mockReturnValue(mockManifest);
    // Mock global fetch failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));

    const live = await controller.getLiveGlobal();
    expect(live.version).toBe('6.2.0');
    expect(live.source).toBe('release-manifest.json fallback');

    globalThis.fetch = originalFetch;
  });
});
