import {Global,Module} from '@nestjs/common';
import {PioneerService} from './pioneer.service';
import {RankingCacheModule} from '../cache/ranking-cache.module';
@Global()
@Module({imports:[RankingCacheModule],providers:[PioneerService],exports:[PioneerService]})
export class PioneerModule {}
