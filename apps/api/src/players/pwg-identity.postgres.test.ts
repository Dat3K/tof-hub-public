import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {afterAll,describe,expect,it} from 'vitest';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import fixture from '../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {PwgIdentityService} from './pwg-identity.service';

const url=process.env.TOF_HUB_TEST_DATABASE_URL;
describe.skipIf(!url)('PWG identity on Postgres',()=>{
  const pool=new Pool({connectionString:url}),prisma=new PrismaClient({adapter:new PrismaPg(pool)}),service=new PwgIdentityService(prisma);
  const uid='13021'+String(Date.now());
  const capture=(pwgUid:string,observedAt:string)=>BuildCaptureSchema.parse({...fixture,capture:{...fixture.capture,subject:{uid,roleId:'55924769165687'}},
    pwg:{uid:pwgUid,roleId:'55924769165687',serverId:'13021',appId:'1000129',observedAt,source:'HottaBrowser.log'}});
  afterAll(async()=>{await prisma.playerPwgIdentity.deleteMany({where:{uid}});await prisma.$disconnect();await pool.end();});
  it('stores exact IDs without a Player row and preserves newer values through old, missing and duplicate uploads',async()=>{
    await service.remember(capture('60832888','2026-10-12T12:00:00Z'),'first');
    await Promise.all([
      service.remember(capture('999','2026-10-12T11:00:00Z'),'older'),
      service.remember(capture('60832888','2026-10-12T12:00:00Z'),'duplicate'),
    ]);
    await service.remember(BuildCaptureSchema.parse({...fixture,capture:{...fixture.capture,subject:{uid,roleId:'55924769165687'}}}),'missing');
    expect(await prisma.playerPwgIdentity.findUnique({where:{uid}})).toMatchObject({uid,pwgUid:'60832888',roleId:'55924769165687',serverId:'13021',appId:'1000129',fileHash:'first'});
    expect(await prisma.player.findFirst({where:{uid}})).toBeNull();
    await service.remember(capture('10000000000000000001','2026-10-12T13:00:00Z'),'newer');
    expect(await prisma.playerPwgIdentity.findUnique({where:{uid}})).toMatchObject({pwgUid:'10000000000000000001',fileHash:'newer'});
  });
});
