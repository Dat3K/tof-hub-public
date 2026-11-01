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
import {ensureCurrentPlayerScores} from './scoring-revision';

export const PLAYER_STORE='PLAYER_STORE';

/** Postgres-only. Without it imports still work; nothing about players is stored. */
async function playerStore(prisma:PrismaClient|null):Promise<PlayerStoreService|null> {
  if(!prisma)return null;
  const catalog=loadScoringCatalog();
  if(!catalog)throw new Error('Generated build catalog not found: current ranking scores cannot be verified.');
  const logger=new Logger('PlayerStore');
  logger.log('Checking persisted ranking revision; a changed scoring model requires an atomic rescore before API readiness.');
  const result=await ensureCurrentPlayerScores(prisma,catalog);
  if(result.rescored)new Logger('PlayerStore').log(`Scoring revision updated: ${result.players} players, ${result.gear} gear rescored before startup.`);
  return new PlayerStoreService(new PrismaPlayerStoreRepository(prisma),catalog);
}

@Global()
@Module({controllers:[PlayersController],providers:[PlayerDirectoryService,TestAccountsService,NegativeCombatScoreService,PwgIdentityService,{provide:PLAYER_STORE,useFactory:playerStore,inject:[PRISMA]}],exports:[PLAYER_STORE,TestAccountsService,NegativeCombatScoreService,PwgIdentityService]})
export class PlayersModule {}
