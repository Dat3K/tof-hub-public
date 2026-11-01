// @vitest-environment node
import {Pool} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {afterAll,describe,expect,it} from 'vitest';
import {AbuseService} from './abuse.service';
import {PrismaQueueStore} from '../queue/job-queue.store';
import {createHmac,randomUUID} from 'node:crypto';
const url=process.env.TOF_HUB_TEST_DATABASE_URL;
describe.skipIf(!url)('Persistent abuse and atomic queue on Postgres',()=>{
  const pool=new Pool({connectionString:url}),db=new PrismaClient({adapter:new PrismaPg(pool)});
  const jobs:string[]=[],salt=process.env.IP_HASH_SALT,testSalt=randomUUID();
  const ip=`198.18.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
  afterAll(async()=>{
    const identity=createHmac('sha256',testSalt).update(ip).digest('hex');
    const keys=['invalid','ban'].map(scope=>createHmac('sha256',testSalt).update(`${identity}:${scope}`).digest('hex'));
    await db.abuseCounter.deleteMany({where:{key:{in:keys}}});
    await db.queueJob.deleteMany({where:{id:{in:jobs}}});await db.$disconnect();await pool.end();
    if(salt===undefined)delete process.env.IP_HASH_SALT;else process.env.IP_HASH_SALT=salt;
  });
  it('counts concurrent violations atomically and preserves the ban in a new service instance',async()=>{
    process.env.IP_HASH_SALT=testSalt;
    const first=new AbuseService(db);
    const violations=await Promise.allSettled(Array.from({length:5},()=>first.violation(ip)));
    expect(violations.filter(result=>result.status==='fulfilled')).toHaveLength(4);
    await expect(new AbuseService(db).assertAllowed(ip)).rejects.toMatchObject({status:429});
  });
  it('admits one active job from concurrent independent stores',async()=>{
    const stores=[new PrismaQueueStore(db),new PrismaQueueStore(db)];
    const results=await Promise.allSettled(Array.from({length:8},(_,index)=>{
      const id=randomUUID();jobs.push(id);
      return stores[index%2]!.insert({id,kind:'build-import',ipHash:ip,ip,payload:Buffer.from('x')});
    }));
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  });
});
