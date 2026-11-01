import { Module } from '@nestjs/common';
import { VersionStatusController } from './version-status.controller';
import { VersionStatusService } from './version-status.service';
import { VersionTrackerService } from './version-tracker.service';

@Module({
  controllers: [VersionStatusController],
  providers: [VersionStatusService, VersionTrackerService],
  exports: [VersionStatusService],
})
export class VersionStatusModule {}
