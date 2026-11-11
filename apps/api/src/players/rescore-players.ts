// Run after a scoring change with DATABASE_URL set: pnpm --filter api rescore:players
// The current revision is skipped. An interrupted run resumes from its last checkpoint.
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {loadScoringCatalog} from './scoring-catalog';
import {ensureCurrentPlayerScores} from './scoring-revision';

async function main() {
  if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL to the Postgres database');
  const catalog=loadScoringCatalog();
  if(!catalog)throw new Error('Generated build catalog not found (apps/web/public/game-data)');
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
  try {console.log(await ensureCurrentPlayerScores(prisma,pool,catalog,undefined,{log:console.log}));}
  finally {await prisma.$disconnect();await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
