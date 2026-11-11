import {Global,Logger,Module} from '@nestjs/common';
import type {PrismaClient} from '@prisma/client';
import {PRISMA} from '../database/database.module';
import {PlayerStoreService} from './player-store.service';
import {PrismaPlayerStoreRepository} from './prisma-player-store.repository';
import {loadScoringCatalog} from './scoring-catalog';
import {TestAccountsService} from './test-accounts.service';
import {NegativeCombatScoreService} from './negative-combat-score.service';
import {PwgIdentityService} from './pwg-identity.service';
import {PlayerDirectoryService} from './player-directory.service';
import {PlayersController} from './players.controller';
import {isScoringRevisionCurrent} from './scoring-revision';

export const PLAYER_STORE='PLAYER_STORE';

/** Postgres-only. Without it imports still work; nothing about players is stored. */
async function playerStore(prisma:PrismaClient|null):Promise<PlayerStoreService|null> {
  if(!prisma)return null;
  const catalog=loadScoringCatalog();
  if(!catalog)throw new Error('Generated build catalog not found: current ranking scores cannot be verified.');
  // Stored scores are served as they are; only a manual rescore changes them (docs/architecture/server-release.md).
  if(!await isScoringRevisionCurrent(prisma,catalog))new Logger('PlayerStore').warn('Stored ranking scores were computed with a different scoring model or catalog. Run a manual rescore if rankings should change: server-rescore-rankings.bat.');
  return new PlayerStoreService(new PrismaPlayerStoreRepository(prisma),catalog);
}

@Global()
@Module({controllers:[PlayersController],providers:[PlayerDirectoryService,TestAccountsService,NegativeCombatScoreService,PwgIdentityService,{provide:PLAYER_STORE,useFactory:playerStore,inject:[PRISMA]}],exports:[PLAYER_STORE,TestAccountsService,NegativeCombatScoreService,PwgIdentityService]})
export class PlayersModule {}
