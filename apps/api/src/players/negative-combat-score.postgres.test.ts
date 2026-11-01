import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {afterAll,describe,expect,it} from 'vitest';
import {NegativeCombatScoreService} from './negative-combat-score.service';
import {scanFixture} from '../import/scan-session.fixture';

const url=process.env.TOF_HUB_TEST_DATABASE_URL;
describe.skipIf(!url)('negative current CS on Postgres',()=>{
  const pool=new Pool({connectionString:url}),prisma=new PrismaClient({adapter:new PrismaPg(pool)}),service=new NegativeCombatScoreService(prisma);
  const uid='887'+String(Date.now()),source={kind:'players' as const,fileHash:'fixture-negative-cs'};
  afterAll(async()=>{await prisma.negativeCombatScore.deleteMany({where:{uid}});await prisma.$disconnect();await pool.end();});
  it('atomically keeps the largest magnitude and its own scan date through concurrent, old, repeated and positive imports',async()=>{
    const scan={...scanFixture('live'),startedAt:'2026-10-10T12:00:00Z'};
    await service.observe([{uid,cs:-100,scan},{uid,cs:-900,scan}],source);
    await Promise.all([
      service.observe([{uid,cs:-500,scan:{...scan,startedAt:'2026-10-11T12:00:00Z'}}],source),
      service.observe([{uid,cs:-1000,scan:{...scan,startedAt:'2026-10-09T12:00:00Z',distribution:'korea-dev'}}],source),
    ]);
    await service.observe([{uid,cs:10000,scan},{uid,cs:-900,scan}],source);
    expect(await prisma.negativeCombatScore.findUnique({where:{uid}})).toMatchObject({
      score:-1000,scannedAt:new Date('2026-10-09T12:00:00Z'),distribution:'korea-dev'});
    await service.observe([{uid,cs:-1000,scan:{...scan,startedAt:'2026-10-12T12:00:00Z'}}],source);
    await service.observe([{uid,cs:-1000,scan}],source);
    expect(await prisma.negativeCombatScore.findUnique({where:{uid}})).toMatchObject({score:-1000,scannedAt:new Date('2026-10-12T12:00:00Z')});
    expect(await prisma.player.findFirst({where:{uid}})).toBeNull();
  });
});
