import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {afterAll,describe,expect,it} from 'vitest';
import {TestAccountsService} from './test-accounts.service';
import {scanFixture} from '../import/scan-session.fixture';

const url=process.env.TOF_HUB_TEST_DATABASE_URL;
describe.skipIf(!url)('test participation on Postgres',()=>{
  const pool=new Pool({connectionString:url}),prisma=new PrismaClient({adapter:new PrismaPg(pool)}),service=new TestAccountsService(prisma);
  const uid='888'+String(Date.now()),hash=randomUUID(),undatedHash=randomUUID();
  afterAll(async()=>{
    await prisma.testAccountServer.deleteMany({where:{uid}});await prisma.testAccount.deleteMany({where:{uid}});
    await prisma.testAccountImport.deleteMany({where:{fileHash:{in:[hash,undatedHash]}}});
    await prisma.$disconnect();await pool.end();
  });
  it('keeps independent first/last intervals through old, repeated, concurrent and gearless imports',async()=>{
    const scan={...scanFixture(),distribution:'global-pioneer' as const};
    const row={uid,scan,firstSeenAt:'2026-10-05T10:00:00Z',lastSeenAt:'2026-10-10T10:00:00Z'};
    await service.observe([row,row],{fileHash:hash,kind:'players'});
    await Promise.all([
      service.observe([{...row,firstSeenAt:'2026-10-01T10:00:00Z',lastSeenAt:'2026-10-03T10:00:00Z'}]),
      service.observe([{...row,firstSeenAt:'2026-10-11T10:00:00Z',lastSeenAt:'2026-10-12T10:00:00Z'}]),
    ]);
    await service.observe([row],{fileHash:hash,kind:'players'});
    await service.observe([{...row,scan:{...scan,distribution:'korea-dev'},firstSeenAt:'2026-10-08T10:00:00Z',lastSeenAt:'2026-10-09T10:00:00Z'}]);
    const marks=(await service.forUids([uid])).get(uid)!;
    expect(marks.find(mark=>mark.distribution==='global-pioneer')).toMatchObject({firstSeenAt:'2026-10-01T10:00:00.000Z',lastSeenAt:'2026-10-12T10:00:00.000Z'});
    expect(marks.find(mark=>mark.distribution==='korea-dev')).toMatchObject({firstSeenAt:'2026-10-08T10:00:00.000Z',lastSeenAt:'2026-10-09T10:00:00.000Z'});
    expect(await prisma.player.findFirst({where:{uid}})).toBeNull();
    const undated={uid,scan:{...scan,distribution:'taiwan-dev' as const,startedAt:null,finishedAt:null,status:'capturing' as const}};
    await service.observe([undated],{fileHash:undatedHash,importedAt:new Date('2026-10-11T12:00:00Z')});
    await service.observe([undated],{fileHash:undatedHash,importedAt:new Date('2026-10-12T12:00:00Z')});
    expect((await service.forUids([uid])).get(uid)!.find(mark=>mark.distribution==='taiwan-dev')).toMatchObject({
      firstSeenAt:'2026-10-11T12:00:00.000Z',lastSeenAt:'2026-10-11T12:00:00.000Z',lastTimeSource:'import'});
    await service.observe([{...undated,capturedAt:'2026-10-11T12:00:00Z'}]);
    expect((await service.forUids([uid])).get(uid)!.find(mark=>mark.distribution==='taiwan-dev')).toMatchObject({
      firstTimeSource:'observation',lastTimeSource:'observation'});
  });
  it('retains legacy clients without manufacturing their per-client dates',async()=>{
    await prisma.testAccount.update({where:{uid},data:{distributions:{push:'legacy-unknown-test'}}});
    expect((await service.forUids([uid])).get(uid)).toContainEqual({distribution:'unknown-test',firstSeenAt:null,lastSeenAt:null});
  });
});
