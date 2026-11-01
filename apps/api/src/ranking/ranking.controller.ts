import {BadRequestException,Body,Controller,ForbiddenException,Get,Header,Headers,Inject,Ip,Optional,Post,Query} from '@nestjs/common';
import {checkAdminKey as compareAdminKey} from '../security/admin-key';
import {RankingService,parseRankingQuery} from './ranking.service';
import {InspectImportService} from './inspect-import.service';

import {RankingCacheService} from './cache/ranking-cache.service';
import {RankingCacheWarmupService} from './cache/ranking-cache-warmup.service';
import {RaidCurrentNamesRequestSchema} from '@tof-hub/contracts';

function checkAdminKey(providedKey: string | undefined): boolean {
  const expectedKey = process.env.RANKING_CACHE_STATUS_KEY || process.env.ADMIN_KEY;
  return compareAdminKey(providedKey, expectedKey);
}

@Controller('ranking')
export class RankingController {
  constructor(
    private readonly ranking:RankingService,
    private readonly inspect:InspectImportService,
    @Optional() @Inject(RankingCacheService) private readonly cache:RankingCacheService|null=null,
    @Optional() @Inject(RankingCacheWarmupService) private readonly warmup:RankingCacheWarmupService|null=null,
  ) {}

  @Get('cache/status') @Header('Cache-Control','no-store')
  async cacheStatus(
    @Headers('x-admin-key') adminHeader?: string,
  ) {
    if (process.env.NODE_ENV === 'production') {
      const isAuthorized = checkAdminKey(adminHeader);
      if (!isAuthorized) {
        throw new ForbiddenException('Ranking cache status is restricted in production');
      }
    }

    const metrics = await this.cache?.getMetrics() ?? { connected: false, revision: '1' };
    const lastWarmup = this.warmup?.getLastSummary() ?? null;
    return { ...metrics, lastWarmup };
  }

  @Post('cache/warmup') @Header('Cache-Control','no-store')
  async warmupCache(@Headers('x-admin-key') key?: string, @Body() body?: {mode?: string}) {
    if (process.env.NODE_ENV === 'production' && !checkAdminKey(key)) throw new ForbiddenException();
    const mode = body?.mode ?? 'minimal';
    if (mode !== 'minimal' && mode !== 'full') throw new BadRequestException('Invalid warmup mode');
    return this.warmup?.triggerWarmup('manual-api', mode, true) ?? null;
  }

  @Get('gear') @Header('Cache-Control','public, max-age=60')
  gear(@Query() query:Record<string,unknown>) {return this.ranking.gear(parseRankingQuery(query));}
  @Get('players') @Header('Cache-Control','public, max-age=60')
  players(@Query() query:Record<string,unknown>) {return this.ranking.players(parseRankingQuery(query));}
  /** Read-only batched identity lookup; historical raid observations are never rewritten. */
  @Post('player-names') @Header('Cache-Control','no-store')
  currentPlayerNames(@Body() body: unknown) {
    const parsed = RaidCurrentNamesRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid player identifiers');
    return this.ranking.currentPlayerNames(parsed.data.identifiers, parsed.data.uids);
  }
  /** Place a score (`score`, percent) would take on a board: a build's full-Titan potential, an item's Titan maximum. */
  @Get('players/rank') @Header('Cache-Control','public, max-age=60')
  playerRank(@Query() query:Record<string,unknown>) {return this.ranking.boardRank('players',parseRankingQuery(query),Number(query.score));}
  /** Places of stored pieces (`ids`, comma separated) on their own slot's gear board: a player's build. */
  @Get('gear/ranks') @Header('Cache-Control','public, max-age=60')
  gearRanks(@Query() query:Record<string,unknown>) {return this.ranking.gearRanks(parseRankingQuery(query),String(query.ids??'').split(',').filter(Boolean));}
  @Get('gear/rank') @Header('Cache-Control','public, max-age=60')
  gearRank(@Query() query:Record<string,unknown>) {return this.ranking.boardRank('gear',parseRankingQuery(query),Number(query.score));}
  /** `players-<date>.tofplayers` from the capture app, sent as application/octet-stream; answers with its queue job. */
  @Post('inspect') @Header('Cache-Control','no-store')
  importInspect(@Body() body:Buffer,@Ip() ip:string) {return this.inspect.enqueue(body,ip);}
}
