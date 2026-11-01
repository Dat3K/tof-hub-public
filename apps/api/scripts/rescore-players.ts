// Recomputes every stored gear and player score with the current tops rules.
// Run after a scoring change: DATABASE_URL=postgresql://… pnpm --filter api rescore:players
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {PlayerStoreService} from '../src/players/player-store.service';
import {PrismaPlayerStoreRepository} from '../src/players/prisma-player-store.repository';
import {loadScoringCatalog} from '../src/players/scoring-catalog';

async function main() {
  if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL to the Postgres database');
  const catalog=loadScoringCatalog();
  if(!catalog)throw new Error('Generated build catalog not found (apps/web/public/game-data)');
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
  try {console.log(await new PlayerStoreService(new PrismaPlayerStoreRepository(prisma),catalog).rescoreAll());}
  finally {await prisma.$disconnect();await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
