import { Controller, Get } from '@nestjs/common';
import { VersionStatusService } from './version-status.service';
import { VersionTrackerService } from './version-tracker.service';
import type { SiteVersionStatus, LiveGlobalVersion } from '@tof-hub/contracts';

@Controller('version-status')
export class VersionStatusController {
  constructor(private readonly versionStatusService: VersionStatusService, private readonly tracker: VersionTrackerService) {}

  @Get('tracker')
  getTracker() { return this.tracker.getTracker(); }

  /**
   * GET /api/v1/version-status
   * Full site version comparison, provenance, and update alert determination.
   */
  @Get()
  async getStatus(): Promise<SiteVersionStatus> {
    return this.versionStatusService.getVersionStatus();
  }

  /**
   * GET /api/v1/version-status/live-global
   * Authoritative live Global launcher version.
   */
  @Get('live-global')
  async getLiveGlobal(): Promise<LiveGlobalVersion> {
    return this.versionStatusService.getLiveGlobalVersion();
  }
}
