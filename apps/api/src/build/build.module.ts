import {Module} from '@nestjs/common';
import {BuildController,BuildProfilesController,MmoBuildProfilesController} from './build.controller';
import {BuildImportService} from './build-import.service';
import {BuildProfilesService} from './build-profiles.service';
import {SavedBuildRankingService} from './saved-build-ranking.service';
import {BuildProfileDirectoryService} from './build-profile-directory.service';
import {PioneerModule} from '../ranking/pioneer/pioneer.module';
import {RankingModule} from '../ranking/ranking.module';

@Module({imports:[PioneerModule,RankingModule],controllers:[BuildController,BuildProfilesController,MmoBuildProfilesController],providers:[BuildImportService,BuildProfilesService,SavedBuildRankingService,BuildProfileDirectoryService]})
export class BuildModule {}
