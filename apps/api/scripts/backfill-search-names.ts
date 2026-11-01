// Fills players.search_name and player_names.search_name (normalizeSearchText) for rows stored before the column
// existed. Run: DATABASE_URL=… pnpm --filter api backfill:search-names
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {normalizeSearchText} from '@tof-hub/contracts';

async function main() {
  if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL to the Postgres database');
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
  try {
    let players=0,names=0;
    for(const row of await prisma.player.findMany({where:{nickname:{not:null}},select:{id:true,nickname:true}})){
      await prisma.player.update({where:{id:row.id},data:{searchName:normalizeSearchText(row.nickname!)}});players++;}
    for(const row of await prisma.playerName.findMany({select:{id:true,nickname:true}})){
      await prisma.playerName.update({where:{id:row.id},data:{searchName:normalizeSearchText(row.nickname)}});names++;}
    console.log({players,names});
  } finally {await prisma.$disconnect();await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
