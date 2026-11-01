import {Global,Injectable,Logger,Module,type OnModuleDestroy,type OnModuleInit} from '@nestjs/common';
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {assertRuntimeDatabaseRole} from '../security/database-role';

/** Injection token of the API's one Postgres client (`PrismaClient | null`). */
export const PRISMA='PRISMA';

/** Postgres when `WISH_DB_DRIVER=postgres` and `DATABASE_URL` are set; otherwise null (memory queue, SQLite wish store). */
export function createDatabase():{prisma:PrismaClient;close:()=>Promise<void>}|null {
  if(process.env.WISH_DB_DRIVER!=='postgres'||!process.env.DATABASE_URL)return null;
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:5_000,idleTimeoutMillis:30_000,statement_timeout:15_000});
  pool.on('error',()=>new Logger('Database').error('Idle PostgreSQL connection failed'));
  const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
  return {prisma,close:async()=>{await prisma.$disconnect();await pool.end();}};
}

@Injectable()
class Database implements OnModuleDestroy,OnModuleInit {
  private readonly connection=createDatabase();
  get prisma() {return this.connection?.prisma??null;}
  async onModuleInit() {if(process.env.NODE_ENV==='production'&&this.prisma)await assertRuntimeDatabaseRole(this.prisma);}
  async onModuleDestroy() {await this.connection?.close();}
}

/**
 * One connection pool for every module (wish store, players, ranking, saved builds, the queue) instead of one per
 * service. Inject with `@Optional() @Inject(PRISMA) prisma: PrismaClient | null`.
 */
@Global()
@Module({providers:[Database,{provide:PRISMA,inject:[Database],useFactory:(database:Database)=>database.prisma}],exports:[PRISMA]})
export class DatabaseModule {}
