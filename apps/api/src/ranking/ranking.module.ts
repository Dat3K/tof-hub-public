import {Module} from '@nestjs/common';
import {RankingController} from './ranking.controller';
import {RankingService} from './ranking.service';
import {InspectImportService} from './inspect-import.service';
import {PioneerModule} from './pioneer/pioneer.module';
import {RankingCacheModule} from './cache/ranking-cache.module';
import {RankingCacheWarmupService} from './cache/ranking-cache-warmup.service';

@Module({
  imports:[PioneerModule,RankingCacheModule],
  controllers:[RankingController],
  providers:[RankingService,InspectImportService,RankingCacheWarmupService],
  exports:[RankingService,RankingCacheModule,RankingCacheWarmupService],
})
export class RankingModule {}
