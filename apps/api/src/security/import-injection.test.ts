// @vitest-environment node
import {describe,expect,it,vi} from 'vitest';
import {constants,createCipheriv,generateKeyPairSync,publicEncrypt,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {Prisma,type PrismaClient} from '@prisma/client';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import {buildFixture as fixture} from '../import/capture-import-policy.fixture';
import {BuildImportService} from '../build/build-import.service';
import {BuildProfilesService} from '../build/build-profiles.service';
import {scanFixture} from '../import/scan-session.fixture';
import {playerSearchSql} from '../players/player-search';
import {PwgIdentityService} from '../players/pwg-identity.service';
import {NegativeCombatScoreService} from '../players/negative-combat-score.service';
import {TestAccountsService} from '../players/test-accounts.service';
import {SqliteWishRepository} from '../wish/adapters/sqlite-wish-repository';
import {assertRuntimeDatabaseRole} from './database-role';

const attacks=["x'); DROP TABLE players; --","'; DROP DATABASE tof_hub; --","' OR 1=1 --","'); SELECT pg_sleep(60); --",'<script>alert(1)</script>'];
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
function seal(payload:unknown) {
  const format='tof-hub-build-sealed',key_id=process.env.WISH_IMPORT_KEY_ID??'local-1',key=randomBytes(32),nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(`${format}:1:${key_id}`));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return {format,version:1,key_id,wrapped_key:publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64url'),nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')};
}

describe('Imported fields never become database commands',()=>{
  it('rejects an authenticated incompatible capture without classifying it as upload abuse',async()=>{
    const previous=process.env.WISH_IMPORT_PRIVATE_KEY_PEM;
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    try {
      const importer=new BuildImportService();
      await expect(importer.import(seal({...fixture,unknownNewCaptureField:true}))).rejects.toMatchObject({
        response:{code:'INCOMPATIBLE_CAPTURE'},status:400,
      });
    }finally{if(previous===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=previous;}
  });
  it('imports and saves signed Build text as data; rejects injected identifiers and types',async()=>{
    const previous=process.env.WISH_IMPORT_PRIVATE_KEY_PEM;
    process.env.WISH_IMPORT_PRIVATE_KEY_PEM=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    try {
      const store=vi.fn(async(_snapshot:unknown)=>({})),upsert=vi.fn(async(_request:unknown)=>({}));
      const importer=new BuildImportService({store} as never);
      const profiles=new BuildProfilesService(null,{buildProfile:{findUnique:async()=>null,upsert}} as never);
      for(const attack of attacks) {
        const capture={...fixture,capture:{...fixture.capture,scan:scanFixture('live')},profile:{...fixture.profile,name:attack}};
        const imported=await importer.import(seal(capture));
        expect(imported.data.profile.name).toBe(attack);
        await profiles.save({capture:imported.data,digest:imported.source.digest,signature:imported.source.signature,role:'dps',element:'Physical'});
        const data=upsert.mock.calls.at(-1)![0] as unknown as {create:{name:string;capture:string}};
        expect(data.create.name).toBe(attack);expect(JSON.parse(data.create.capture).profile.name).toBe(attack);
      }
      expect(store).toHaveBeenCalledTimes(attacks.length);
      const invalidUid=await importer.import(seal({...fixture,capture:{...fixture.capture,scan:scanFixture('live'),subject:{...fixture.capture.subject,uid:attacks[0]}}}));
      await expect(profiles.save({capture:invalidUid.data,digest:invalidUid.source.digest,signature:invalidUid.source.signature,role:'dps',element:'Physical'})).rejects.toThrow('The file has no character UID');
      expect(upsert).toHaveBeenCalledTimes(attacks.length);
      expect(BuildCaptureSchema.safeParse({...fixture,profile:{...fixture.profile,level:attacks[0]}}).success).toBe(false);
    } finally {if(previous===undefined)delete process.env.WISH_IMPORT_PRIVATE_KEY_PEM;else process.env.WISH_IMPORT_PRIVATE_KEY_PEM=previous;}
  });

  it('keeps every raw PostgreSQL ledger field and search term in bound parameters',async()=>{
    const captured:Prisma.Sql[]=[];
    const tx={$executeRaw:async(sql:Prisma.Sql)=>{captured.push(sql);return 1;},$queryRaw:async(sql:Prisma.Sql)=>{captured.push(sql);return [{imported_at:new Date()}];}};
    const prisma={...tx,$transaction:async(work:(client:typeof tx)=>Promise<unknown>)=>work(tx)} as unknown as PrismaClient;
    for(const attack of attacks) {
      const capture=BuildCaptureSchema.parse(fixture);
      await new PwgIdentityService(prisma).remember({...capture,pwg:{uid:'123456',roleId:'123456',serverId:'13021',appId:'1000129',observedAt:fixture.capture.capturedAt,source:'HottaBrowser.log'}},attack);
      await new NegativeCombatScoreService(prisma).observe([{uid:'1302104471',cs:-1}],{kind:'build',fileHash:attack});
      await new TestAccountsService(prisma).observe([{uid:'1302104471',nickname:attack,scan:{...scanFixture('test'),distribution:'taiwan-dev'}}],{kind:'build',fileHash:attack});
      captured.push(playerSearchSql(attack));
    }
    expect(captured.length).toBeGreaterThan(attacks.length);
    for(const sql of captured)for(const attack of attacks)expect(sql.sql).not.toContain(attack);
    for(const attack of attacks)expect(captured.some(sql=>sql.values.some(value=>typeof value==='string'&&value.includes(attack)))).toBe(true);
  });

  it('proves SQLite text and filters cannot execute a second statement on a real disposable database',async()=>{
    const repository=new SqliteWishRepository(':memory:');await repository.init();
    try {
      for(let index=0;index<attacks.length;index++) {
        const attack=attacks[index]!,id=`injection-${index}`,at=new Date().toISOString();
        await repository.saveProfile({id,uid:String(100000+index),name:attack,isDefault:false,isDemo:false,region:'EU',server:'13021',createdAt:at,updatedAt:at});
        expect((await repository.getProfile(id))?.name).toBe(attack);
        expect(await repository.getProfile(attack)).toBeNull();
        expect((await repository.getWishRecords({profileId:attack,bannerId:attack,limit:10})).items).toEqual([]);
      }
      expect((await repository.getProfile('injection-0'))?.name).toBe(attacks[0]);
    } finally {await repository.close();}
  });

  it('production role guard fails closed for owner privileges and missing verification',async()=>{
    await expect(assertRuntimeDatabaseRole({$queryRaw:async()=>[{unsafe:false}]} as never)).resolves.toBeUndefined();
    for(const result of [[{unsafe:true}],[],[{unsafe:null}]])await expect(assertRuntimeDatabaseRole({$queryRaw:async()=>result} as never)).rejects.toThrow('Unsafe production database role');
    await expect(assertRuntimeDatabaseRole({$queryRaw:async()=>{throw new Error('database offline');}} as never)).rejects.toThrow();
  });

  it('disallows unsafe raw-query APIs in production API source',()=>{
    const root=path.resolve(__dirname,'..'),files:string[]=[];
    const walk=(directory:string)=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.ts')&&!/\.(test|spec)\.ts$/.test(file))files.push(file);
    }};walk(root);
    for(const file of files)expect(fs.readFileSync(file,'utf8'),path.relative(root,file)).not.toMatch(/\$(?:query|execute)RawUnsafe\b|Prisma\.raw\s*\(/);
  });
});
