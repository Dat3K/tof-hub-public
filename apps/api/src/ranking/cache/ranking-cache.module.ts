import {Global, Module} from '@nestjs/common';
import {RankingCacheService} from './ranking-cache.service';

@Global()
@Module({providers: [RankingCacheService], exports: [RankingCacheService]})
export class RankingCacheModule {}
