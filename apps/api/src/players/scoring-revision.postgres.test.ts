import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {PlayerStoreService} from './player-store.service';
import {loadScoringCatalog} from './scoring-catalog';
import {ensureCurrentPlayerScores} from './scoring-revision';

const url=process.env.TOF_HUB_TEST_DATABASE_URL;
describe.skipIf(!url)('scoring startup gate on isolated Postgres schema',()=>{
  // No live scores are touched. Even the revision marker lives in this temporary schema.
  const schema='scoring_test_'+randomUUID().replaceAll('-','');
  const admin=new Pool({connectionString:url});
  const pool=new Pool({connectionString:url,options:`-c search_path=${schema}`});
  const prisma=new PrismaClient({adapter:new PrismaPg(pool,{schema})});
  const catalog=loadScoringCatalog()!;
  beforeAll(async()=>{
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await pool.query('CREATE TABLE "scoring_revisions" ("id" TEXT NOT NULL PRIMARY KEY, "fingerprint" TEXT NOT NULL, "updated_at" TIMESTAMP(3) NOT NULL)');
  });
  afterAll(async()=>{
    await prisma.$disconnect();await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();
  });
  it('serializes simultaneous starts, skips restarts, and retains the old revision on a failed update',async()=>{
    const rescore=vi.spyOn(PlayerStoreService.prototype,'rescoreAll').mockResolvedValue({players:2,gear:24});
    try {
      const starts=await Promise.allSettled([ensureCurrentPlayerScores(prisma,pool,catalog,'first'),ensureCurrentPlayerScores(prisma,pool,catalog,'first')]);
      expect(starts.filter(result=>result.status==='fulfilled'&&result.value.rescored)).toHaveLength(1);
      expect(rescore).toHaveBeenCalledOnce();
      expect((await ensureCurrentPlayerScores(prisma,pool,catalog,'first')).rescored).toBe(false);
      rescore.mockRejectedValueOnce(new Error('failed score write'));
      await expect(ensureCurrentPlayerScores(prisma,pool,catalog,'next')).rejects.toThrow('failed score write');
      expect(await prisma.scoringRevision.findUnique({where:{id:'live-players'}})).toMatchObject({fingerprint:'first'});
      expect((await ensureCurrentPlayerScores(prisma,pool,catalog,'next')).rescored).toBe(true);
      expect(await prisma.scoringRevision.findUnique({where:{id:'live-players'}})).toMatchObject({fingerprint:'next'});
    } finally {rescore.mockRestore();}
  });
});
